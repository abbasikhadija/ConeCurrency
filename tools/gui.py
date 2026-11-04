#!/usr/bin/env python3
"""
ConeCurrency 🍦 - Artisanal Ice Cream Parlour UI
=================================================
A zero-dependency, retro-styled web dashboard designed for Linux/Ubuntu.
Connects directly over TCP to the C ticket-server on 127.0.0.1:8080.

Features:
- Single cone orders & synchronized rush-hour bursts (using threading.Barrier).
- Live POS ticket tape receipt ticker with millisecond latency timings.
- Dynamic cone visualizer with ice cream scoops stacking in real time.
- Direct C server health probe & error simulation (malformed commands).
- Pure Python standard library (no pip dependencies required).
"""

import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import socket
import sys
import threading
import time
import urllib.parse
import webbrowser

DEFAULT_SERVER_HOST = "127.0.0.1"
DEFAULT_SERVER_PORT = 8080
UI_PORT = 5050

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ConeCurrency 🍦 Artisanal Gelateria</title>
<style>
  :root {
    --cream: #FAF5EB;
    --parchment: #F4ECE1;
    --waffle: #C68B59;
    --waffle-dark: #8C5326;
    --vanilla: #FFF8E7;
    --strawberry: #E85D75;
    --pistachio: #70A288;
    --chocolate: #402E2A;
    --chocolate-light: #5A423D;
    --ink: #231C18;
    --soldout: #D94E34;
    --busy: #D9822B;
    --accent: #E85D75;
    --tape-bg: #FCFBF7;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background-color: var(--cream);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    padding: 24px;
    background-image: 
      radial-gradient(circle at 20px 20px, rgba(198, 139, 89, 0.08) 2px, transparent 0);
    background-size: 32px 32px;
  }

  .parlour-wrapper {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  header {
    background: var(--chocolate);
    color: var(--cream);
    border-radius: 12px;
    padding: 20px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 16px rgba(35, 28, 24, 0.12);
    border-bottom: 4px solid var(--waffle);
  }

  .branding h1 {
    font-family: "Georgia", serif;
    font-size: 26px;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .branding p {
    font-size: 13px;
    color: var(--waffle);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .server-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    font-size: 13px;
    font-family: monospace;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #888;
    transition: background 0.3s;
  }
  .status-dot.online { background: #48BB78; box-shadow: 0 0 8px #48BB78; }
  .status-dot.offline { background: var(--soldout); }

  .main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
  }

  @media (max-width: 860px) {
    .main-grid { grid-template-columns: 1fr; }
  }

  .card {
    background: white;
    border: 1px solid rgba(140, 83, 38, 0.18);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  }

  .card-title {
    font-family: "Georgia", serif;
    font-size: 18px;
    color: var(--chocolate);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px dashed var(--waffle);
    padding-bottom: 8px;
  }

  /* Parlour Stage */
  .stage-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .display-counter {
    background: var(--parchment);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    justify-content: space-around;
    align-items: center;
    text-align: center;
  }

  .stat-box .num {
    font-size: 28px;
    font-weight: 700;
    font-family: monospace;
    color: var(--chocolate);
  }

  .stat-box.booked .num { color: #2B6CB0; }
  .stat-box.soldout .num { color: var(--soldout); }
  .stat-box.busy .num { color: var(--busy); }

  .stat-box .lbl {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #666;
    margin-top: 2px;
  }

  /* Visualizer Cone */
  .scoop-canvas {
    height: 180px;
    background: linear-gradient(180deg, #FDFBF7 0%, var(--parchment) 100%);
    border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    padding-bottom: 15px;
    overflow: hidden;
    position: relative;
  }

  .waffle-cone {
    width: 0; 
    height: 0; 
    border-left: 36px solid transparent;
    border-right: 36px solid transparent;
    border-top: 60px solid var(--waffle);
    position: relative;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));
  }
  .waffle-cone::after {
    content: "";
    position: absolute;
    top: -60px;
    left: -36px;
    width: 72px;
    height: 60px;
    background: repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(140, 83, 38, 0.25) 6px, rgba(140, 83, 38, 0.25) 8px);
  }

  .scoop {
    width: 68px;
    height: 48px;
    border-radius: 50% 50% 30% 30%;
    margin-bottom: -16px;
    z-index: 2;
    box-shadow: inset -4px -4px 8px rgba(0,0,0,0.12), 0 3px 6px rgba(0,0,0,0.1);
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    animation: dropScoop 0.3s ease-out;
  }

  @keyframes dropScoop {
    0% { transform: translateY(-40px) scale(0.8); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  .scoop.strawberry { background: #FF7597; }
  .scoop.pistachio { background: #82C4A2; }
  .scoop.vanilla { background: #FFF1CC; }
  .scoop.chocolate { background: #684E45; }

  /* Controls */
  .control-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }

  button {
    cursor: pointer;
    border: none;
    border-radius: 8px;
    padding: 12px 14px;
    font-weight: 600;
    font-size: 13px;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  button:active { transform: translateY(1px); }

  .btn-primary {
    background: var(--strawberry);
    color: white;
    box-shadow: 0 4px 10px rgba(232, 93, 117, 0.28);
  }
  .btn-primary:hover { background: #D64560; }

  .btn-burst {
    background: var(--waffle);
    color: white;
    box-shadow: 0 4px 10px rgba(198, 139, 89, 0.28);
  }
  .btn-burst:hover { background: var(--waffle-dark); }

  .btn-bad {
    background: #E2E8F0;
    color: #4A5568;
  }
  .btn-bad:hover { background: #CBD5E0; }

  .btn-clear {
    background: transparent;
    color: #888;
    padding: 4px 8px;
    font-size: 11px;
    border: 1px solid #DDD;
  }

  /* Receipt Tape POS */
  .receipt-card {
    background: var(--tape-bg);
    border: 1px solid #E2D7C8;
    position: relative;
    display: flex;
    flex-direction: column;
    box-shadow: 0 6px 14px rgba(0,0,0,0.04);
  }
  .receipt-card::before {
    content: "";
    position: absolute;
    top: -6px; left: 0; right: 0;
    height: 6px;
    background: radial-gradient(circle, transparent, transparent 50%, var(--tape-bg) 50%, var(--tape-bg) 100%);
    background-size: 10px 10px;
  }

  .tape-header {
    text-align: center;
    padding: 6px 0 12px;
    border-bottom: 1px dashed #CCC;
    font-family: monospace;
    font-size: 12px;
    color: #666;
  }

  .tape-stream {
    height: 380px;
    overflow-y: auto;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    padding: 10px 0;
    display: flex;
    flex-direction: column-reverse;
    gap: 6px;
  }

  .tape-line {
    display: flex;
    justify-content: space-between;
    padding: 4px 6px;
    border-radius: 4px;
    background: rgba(0,0,0,0.015);
  }
  .tape-line.booked { color: #1A365D; border-left: 3px solid #3182CE; }
  .tape-line.sold_out { color: var(--soldout); border-left: 3px solid var(--soldout); }
  .tape-line.busy { color: var(--busy); border-left: 3px solid var(--busy); }
  .tape-line.bad { color: #805AD5; border-left: 3px solid #805AD5; }

  .tape-time { color: #888; font-size: 10px; margin-left: 4px; }

  .footer-note {
    text-align: center;
    font-size: 12px;
    color: #8C5326;
    margin-top: 8px;
    font-family: "Georgia", serif;
  }
</style>
</head>
<body>

<div class="parlour-wrapper">
  <header>
    <div class="branding">
      <h1><span>🍦</span> ConeCurrency Gelateria</h1>
      <p>Concurrent POSIX Ticket Booking Engine</p>
    </div>
    <div class="server-pill">
      <div id="statusDot" class="status-dot"></div>
      <span id="serverLabel">Checking 127.0.0.1:8080...</span>
    </div>
  </header>

  <div class="main-grid">
    <!-- Parlour Actions & Visualizer -->
    <div class="card stage-card">
      <div class="card-title">
        <span>Parlour Counter</span>
        <button class="btn-clear" onclick="resetCounts()">Reset Counters</button>
      </div>

      <div class="display-counter">
        <div class="stat-box booked">
          <div class="num" id="statBooked">0</div>
          <div class="lbl">Booked Cones</div>
        </div>
        <div class="stat-box soldout">
          <div class="num" id="statSoldOut">0</div>
          <div class="lbl">Sold Out</div>
        </div>
        <div class="stat-box busy">
          <div class="num" id="statBusy">0</div>
          <div class="lbl">Queue Shed (Busy)</div>
        </div>
        <div class="stat-box">
          <div class="num" id="statAvgLatency">0.0</div>
          <div class="lbl">Avg Latency (ms)</div>
        </div>
      </div>

      <div class="scoop-canvas" id="scoopCanvas">
        <div class="waffle-cone"></div>
      </div>

      <div class="control-group">
        <button class="btn-primary" onclick="orderOne()">
          <span>🍦</span> Order 1 Cone (BOOK)
        </button>
        <button class="btn-burst" onclick="orderBurst(10)">
          <span>⚡</span> Rush Hour (10 Cones)
        </button>
        <button class="btn-burst" onclick="orderBurst(25)">
          <span>🔥</span> Flash Mob (25 Cones)
        </button>
        <button class="btn-bad" onclick="sendBad()">
          <span>⚠️</span> Send Bad Request
        </button>
      </div>
    </div>

    <!-- Live Register Tape -->
    <div class="card receipt-card">
      <div class="card-title">
        <span>Register Tape (POS)</span>
        <button class="btn-clear" onclick="clearTape()">Clear</button>
      </div>
      <div class="tape-header">
        *** REAL-TIME TCP STREAM ***<br>
        127.0.0.1:8080 &bull; ASCII PROTOCOL
      </div>
      <div class="tape-stream" id="tapeStream">
        <!-- Lines dynamically prepended here -->
      </div>
    </div>
  </div>

  <div class="footer-note">
    CSC-251L Operating Systems &bull; Person 1 Concurrency & Synchronization Dashboard
  </div>
</div>

<script>
  let bookedCount = 0;
  let soldOutCount = 0;
  let busyCount = 0;
  let latencies = [];
  const flavors = ['strawberry', 'pistachio', 'vanilla', 'chocolate'];

  async function checkServerHealth() {
    try {
      const res = await fetch('/api/probe');
      const data = await res.json();
      const dot = document.getElementById('statusDot');
      const lbl = document.getElementById('serverLabel');
      if (data.online) {
        dot.className = 'status-dot online';
        lbl.innerText = `C Server Online (${data.host}:${data.port})`;
      } else {
        dot.className = 'status-dot offline';
        lbl.innerText = `Offline (${data.host}:${data.port})`;
      }
    } catch(e) {
      document.getElementById('statusDot').className = 'status-dot offline';
      document.getElementById('serverLabel').innerText = 'Backend Unreachable';
    }
  }

  function addScoop() {
    const canvas = document.getElementById('scoopCanvas');
    const existing = canvas.getElementsByClassName('scoop');
    if (existing.length >= 6) {
      // Remove lowest scoop so cone doesn't overflow screen
      canvas.removeChild(existing[0]);
    }
    const scoop = document.createElement('div');
    const flavor = flavors[Math.floor(Math.random() * flavors.length)];
    scoop.className = `scoop ${flavor}`;
    // Insert just above the cone
    const cone = canvas.querySelector('.waffle-cone');
    canvas.insertBefore(scoop, cone);
  }

  function appendTape(reply, latency, cmd) {
    const stream = document.getElementById('tapeStream');
    const line = document.createElement('div');
    let category = 'bad';
    if (reply.includes('OK BOOKED')) {
      category = 'booked';
      bookedCount++;
      document.getElementById('statBooked').innerText = bookedCount;
      addScoop();
    } else if (reply.includes('ERR SOLD_OUT')) {
      category = 'sold_out';
      soldOutCount++;
      document.getElementById('statSoldOut').innerText = soldOutCount;
    } else if (reply.includes('ERR BUSY')) {
      category = 'busy';
      busyCount++;
      document.getElementById('statBusy').innerText = busyCount;
    }

    if (latency > 0) {
      latencies.push(latency);
      const avg = latencies.reduce((a,b) => a+b, 0) / latencies.length;
      document.getElementById('statAvgLatency').innerText = avg.toFixed(1);
    }

    line.className = `tape-line ${category}`;
    line.innerHTML = `
      <span><strong>${cmd}</strong> &rarr; ${reply}</span>
      <span class="tape-time">${latency.toFixed(1)}ms</span>
    `;
    stream.prepend(line);
  }

  async function orderOne() {
    try {
      const res = await fetch('/api/book');
      const data = await res.json();
      appendTape(data.reply, data.latency_ms, 'BOOK');
    } catch(e) {
      appendTape('ERR_DISCONNECTED', 0, 'BOOK');
    }
  }

  async function orderBurst(n) {
    try {
      const res = await fetch(`/api/burst?count=${n}`);
      const data = await res.json();
      data.results.forEach(r => {
        appendTape(r.reply, r.latency_ms, 'BURST');
      });
    } catch(e) {
      appendTape('BURST_FAILED', 0, 'BURST');
    }
  }

  async function sendBad() {
    try {
      const res = await fetch('/api/custom?payload=GIBBERISH_DATA');
      const data = await res.json();
      appendTape(data.reply, data.latency_ms, 'GARBAGE');
    } catch(e) {
      appendTape('BAD_REQ_FAILED', 0, 'GARBAGE');
    }
  }

  function clearTape() {
    document.getElementById('tapeStream').innerHTML = '';
  }

  function resetCounts() {
    bookedCount = 0; soldOutCount = 0; busyCount = 0; latencies = [];
    document.getElementById('statBooked').innerText = '0';
    document.getElementById('statSoldOut').innerText = '0';
    document.getElementById('statBusy').innerText = '0';
    document.getElementById('statAvgLatency').innerText = '0.0';
    const canvas = document.getElementById('scoopCanvas');
    const scoops = canvas.querySelectorAll('.scoop');
    scoops.forEach(s => s.remove());
  }

  // Poll server state every 3 seconds
  setInterval(checkServerHealth, 3000);
  checkServerHealth();
</script>
</body>
</html>
"""


def raw_tcp_request(host, port, payload, timeout=3.0, barrier=None):
    """Sends raw payload to the C server over TCP and measures round-trip latency."""
    if barrier:
        barrier.wait(timeout=10)

    start = time.perf_counter()
    reply = "ERR_CONNECT"
    latency_ms = 0.0

    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.sendall(payload)
            buf = bytearray()
            while len(buf) < 64:
                chunk = sock.recv(64)
                if not chunk:
                    break
                buf.extend(chunk)
                if chunk.endswith(b"\n"):
                    break
            latency_ms = (time.perf_counter() - start) * 1000.0
            reply = bytes(buf).decode("ascii", errors="replace").strip()
    except Exception as exc:
        latency_ms = (time.perf_counter() - start) * 1000.0
        reply = f"ERR_{type(exc).__name__}"

    return reply, latency_ms


class ParlourRequestHandler(BaseHTTPRequestHandler):
    target_host = DEFAULT_SERVER_HOST
    target_port = DEFAULT_SERVER_PORT

    def log_message(self, format, *args):
        # Silence standard HTTP access logging to keep terminal tidy
        pass

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(url.query)

        if url.path == "/" or url.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
            return

        elif url.path == "/api/probe":
            # Quick non-blocking probe to verify if C server is listening
            online = False
            try:
                with socket.create_connection((self.target_host, self.target_port), timeout=0.5):
                    online = True
            except Exception:
                online = False

            self.send_json({"online": online, "host": self.target_host, "port": self.target_port})
            return

        elif url.path == "/api/book":
            reply, latency = raw_tcp_request(self.target_host, self.target_port, b"BOOK\n")
            self.send_json({"reply": reply, "latency_ms": latency})
            return

        elif url.path == "/api/custom":
            payload_str = params.get("payload", ["BOOK"])[0] + "\n"
            reply, latency = raw_tcp_request(self.target_host, self.target_port, payload_str.encode("ascii"))
            self.send_json({"reply": reply, "latency_ms": latency})
            return

        elif url.path == "/api/burst":
            count = int(params.get("count", [10])[0])
            count = max(1, min(count, 50))  # Cap between 1 and 50

            barrier = threading.Barrier(count)
            results = [None] * count

            def burst_worker(idx):
                rep, lat = raw_tcp_request(self.target_host, self.target_port, b"BOOK\n", barrier=barrier)
                results[idx] = {"reply": rep, "latency_ms": lat}

            threads = [threading.Thread(target=burst_worker, args=(i,)) for i in range(count)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=10)

            self.send_json({"results": results})
            return

        self.send_response(404)
        self.end_headers()

    def send_json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_gui(server_host, server_port, ui_port, no_browser=False):
    ParlourRequestHandler.target_host = server_host
    ParlourRequestHandler.target_port = server_port

    httpd = HTTPServer(("127.0.0.1", ui_port), ParlourRequestHandler)
    ui_url = f"http://127.0.0.1:{ui_port}"

    print("=" * 60)
    print("      CONECURRENCY ARTISANAL GELATERIA UI 🍦      ")
    print("=" * 60)
    print(f"[*] Dashboard URL:        {ui_url}")
    print(f"[*] Target C Server:      {server_host}:{server_port}")
    print("[*] Press Ctrl+C in this terminal to stop the UI server.")
    print("=" * 60)

    if not no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(ui_url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Stopping UI parlour server...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ConeCurrency Artisanal Parlour UI")
    parser.add_argument("--server-host", default=DEFAULT_SERVER_HOST, help="Target C server host")
    parser.add_argument("--server-port", type=int, default=DEFAULT_SERVER_PORT, help="Target C server port")
    parser.add_argument("--ui-port", type=int, default=UI_PORT, help="Port to serve web UI")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open browser")
    args = parser.parse_args()

    run_gui(
        server_host=args.server_host,
        server_port=args.server_port,
        ui_port=args.ui_port,
        no_browser=args.no_browser,
    )

