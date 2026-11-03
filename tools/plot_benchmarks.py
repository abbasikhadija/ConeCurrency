"""Plot measured summary CSV only. Install matplotlib separately if needed."""
import argparse
import csv
import json
from pathlib import Path
import statistics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("summary", type=Path)
    args = parser.parse_args()
    config = json.loads(args.summary.with_name("config.json").read_text())
    if config.get("status") != "complete":
        parser.error("Only completed benchmark suites may be plotted")
    with args.summary.open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    if not rows or any(int(row["failed"]) for row in rows):
        parser.error("Need nonempty measurements with no failed bookings")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    figure, axes = plt.subplots(1, 2, figsize=(11, 4.2))
    for mode in sorted({row["mode"] for row in rows}):
        users = sorted({int(row["users"]) for row in rows if row["mode"] == mode})
        for axis, metric, label in zip(axes, ("requests_per_s", "p95_ms"),
                                       ("Throughput (requests/s)", "p95 latency (ms)")):
            groups = [[float(row[metric]) for row in rows
                       if row["mode"] == mode and int(row["users"]) == n] for n in users]
            axis.errorbar(users, [statistics.mean(group) for group in groups],
                          yerr=[statistics.stdev(group) if len(group) > 1 else 0 for group in groups],
                          marker="o", capsize=3, label=mode)
            axis.set(xlabel="Simultaneous users", ylabel=label)
            axis.grid(alpha=.2)
            axis.legend()
    figure.suptitle("ConeCurrency — measured runs (mean ± sample standard deviation)")
    figure.tight_layout()
    output = args.summary.with_name("comparison.png")
    figure.savefig(output, dpi=180)
    print(output)


if __name__ == "__main__":
    main()
