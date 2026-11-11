#!/usr/bin/env python3
"""
ConeCurrency 🍦 - Native Desktop X11 Gelateria UI (Tkinter)
============================================================
Lightweight native desktop application for Ubuntu/Linux.
Connects directly to the C ticket-server on 127.0.0.1:8080 over raw TCP.
Uses standard Python library (Tkinter).
"""

import socket
import sys
import threading
import time

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    print("[!] Tkinter not installed. On Ubuntu, install it using:")
    print("    sudo apt install python3-tk")
    sys.exit(1)

DEFAULT_SERVER_HOST = "127.0.0.1"
DEFAULT_SERVER_PORT = 8080


class GelateriaApp:
    def __init__(self, root, host=DEFAULT_SERVER_HOST, port=DEFAULT_SERVER_PORT):
        self.root = root
        self.host = host
        self.port = port
        self.root.title("ConeCurrency 🍦 Artisanal Gelateria")
        self.root.geometry("680x560")
        self.root.configure(bg="#FAF5EB")

        self.booked_count = 0
        self.soldout_count = 0
        self.busy_count = 0

        self.build_ui()
        self.check_connection()

    def build_ui(self):
        # Header banner
        header = tk.Frame(self.root, bg="#402E2A", pady=12, padx=16)
        header.pack(fill=tk.X)

        title = tk.Label(
            header,
            text="🍦 ConeCurrency Gelateria",
            font=("Georgia", 18, "bold"),
            fg="#FAF5EB",
            bg="#402E2A",
        )
        title.pack(side=tk.LEFT)

        self.lbl_status = tk.Label(
            header,
            text="Checking C Server...",
            font=("Courier", 11),
            fg="#C68B59",
            bg="#402E2A",
        )
        self.lbl_status.pack(side=tk.RIGHT)

        # Counter bar
        counter_frame = tk.Frame(self.root, bg="#F4ECE1", pady=10, padx=12, relief=tk.RIDGE, bd=1)
        counter_frame.pack(fill=tk.X, padx=16, pady=12)

        self.lbl_booked = tk.Label(
            counter_frame,
            text="Booked: 0",
            font=("Helvetica", 13, "bold"),
            fg="#2B6CB0",
            bg="#F4ECE1",
            padx=16,
        )
        self.lbl_booked.pack(side=tk.LEFT, expand=True)

        self.lbl_soldout = tk.Label(
            counter_frame,
            text="Sold Out: 0",
            font=("Helvetica", 13, "bold"),
            fg="#D94E34",
            bg="#F4ECE1",
            padx=16,
        )
        self.lbl_soldout.pack(side=tk.LEFT, expand=True)

        self.lbl_busy = tk.Label(
            counter_frame,
            text="Queue Shed: 0",
            font=("Helvetica", 13, "bold"),
            fg="#D9822B",
            bg="#F4ECE1",
            padx=16,
        )
        self.lbl_busy.pack(side=tk.LEFT, expand=True)

        # Main content area (split into controls and receipt tape)
        split = tk.Frame(self.root, bg="#FAF5EB")
        split.pack(fill=tk.BOTH, expand=True, padx=16, pady=6)

        # Left: Action buttons
        btn_frame = tk.LabelFrame(
            split,
            text=" Cashier Order Controls ",
            font=("Georgia", 11, "bold"),
            fg="#402E2A",
            bg="#FAF5EB",
            padx=12,
            pady=12,
        )
        btn_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 8))

        btn_single = tk.Button(
            btn_frame,
            text="🍦 Order 1 Cone (BOOK)",
            font=("Helvetica", 11, "bold"),
            bg="#E85D75",
            fg="white",
            activebackground="#D64560",
            activeforeground="white",
            relief=tk.FLAT,
            pady=8,
            command=self.order_single,
        )
        btn_single.pack(fill=tk.X, pady=6)

        btn_rush = tk.Button(
            btn_frame,
            text="⚡ Rush Hour Burst (10 Users)",
            font=("Helvetica", 11, "bold"),
            bg="#C68B59",
            fg="white",
            activebackground="#8C5326",
            activeforeground="white",
            relief=tk.FLAT,
            pady=8,
            command=lambda: self.order_burst(10),
        )
        btn_rush.pack(fill=tk.X, pady=6)

        btn_flash = tk.Button(
            btn_frame,
            text="🔥 Flash Mob (25 Users)",
            font=("Helvetica", 11, "bold"),
            bg="#C68B59",
            fg="white",
            activebackground="#8C5326",
            activeforeground="white",
            relief=tk.FLAT,
            pady=8,
            command=lambda: self.order_burst(25),
        )
        btn_flash.pack(fill=tk.X, pady=6)

        btn_bad = tk.Button(
            btn_frame,
            text="⚠️ Send Bad Request",
            font=("Helvetica", 10),
            bg="#E2E8F0",
            fg="#4A5568",
            relief=tk.FLAT,
            pady=6,
            command=self.send_bad,
        )
        btn_bad.pack(fill=tk.X, pady=6)

        btn_clear = tk.Button(
            btn_frame,
            text="Reset Counters",
            font=("Helvetica", 9),
            bg="#FAF5EB",
            fg="#888",
            command=self.reset_counters,
        )
        btn_clear.pack(side=tk.BOTTOM, fill=tk.X)

        # Right: Register tape (ListBox)
        tape_frame = tk.LabelFrame(
            split,
            text=" Live Register Tape (127.0.0.1:8080) ",
            font=("Georgia", 11, "bold"),
            fg="#402E2A",
            bg="#FAF5EB",
            padx=8,
            pady=8,
        )
        tape_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(8, 0))

        scroll = tk.Scrollbar(tape_frame)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.tape_list = tk.Listbox(
            tape_frame,
            yscrollcommand=scroll.set,
            font=("Courier", 10),
            bg="#FCFBF7",
            fg="#231C18",
            selectbackground="#C68B59",
            relief=tk.FLAT,
            bd=1,
        )
        self.tape_list.pack(fill=tk.BOTH, expand=True)
        scroll.config(command=self.tape_list.yview)

    def log_tape(self, cmd, reply, latency):
        timestr = time.strftime("%H:%M:%S")
        entry = f"[{timestr}] {cmd} -> {reply} ({latency:.1f}ms)"
        self.tape_list.insert(0, entry)

        if "OK BOOKED" in reply:
            self.booked_count += 1
            self.lbl_booked.config(text=f"Booked: {self.booked_count}")
        elif "ERR SOLD_OUT" in reply:
            self.soldout_count += 1
            self.lbl_soldout.config(text=f"Sold Out: {self.soldout_count}")
        elif "ERR BUSY" in reply:
            self.busy_count += 1
            self.lbl_busy.config(text=f"Queue Shed: {self.busy_count}")

    def tcp_call(self, payload):
        start = time.perf_counter()
        reply = "ERR_CONNECT"
        try:
            with socket.create_connection((self.host, self.port), timeout=3.0) as sock:
                sock.sendall(payload)
                buf = bytearray()
                while len(buf) < 64:
                    chunk = sock.recv(64)
                    if not chunk:
                        break
                    buf.extend(chunk)
                    if chunk.endswith(b"\n"):
                        break
                reply = bytes(buf).decode("ascii", errors="replace").strip()
        except Exception as exc:
            reply = f"ERR_{type(exc).__name__}"
        latency = (time.perf_counter() - start) * 1000.0
        return reply, latency

    def order_single(self):
        def work():
            rep, lat = self.tcp_call(b"BOOK\n")
            self.root.after(0, lambda: self.log_tape("BOOK", rep, lat))
        threading.Thread(target=work, daemon=True).start()

    def order_burst(self, count):
        def work():
            barrier = threading.Barrier(count)
            def burst_worker():
                barrier.wait(timeout=10)
                rep, lat = self.tcp_call(b"BOOK\n")
                self.root.after(0, lambda: self.log_tape("BURST", rep, lat))
            threads = [threading.Thread(target=burst_worker) for _ in range(count)]
            for t in threads: t.start()
            for t in threads: t.join()
        threading.Thread(target=work, daemon=True).start()

    def send_bad(self):
        def work():
            rep, lat = self.tcp_call(b"GARBAGE_PAYLOAD\n")
            self.root.after(0, lambda: self.log_tape("BAD", rep, lat))
        threading.Thread(target=work, daemon=True).start()

    def reset_counters(self):
        self.booked_count = 0
        self.soldout_count = 0
        self.busy_count = 0
        self.lbl_booked.config(text="Booked: 0")
        self.lbl_soldout.config(text="Sold Out: 0")
        self.lbl_busy.config(text="Queue Shed: 0")
        self.tape_list.delete(0, tk.END)

    def check_connection(self):
        def probe():
            online = False
            try:
                with socket.create_connection((self.host, self.port), timeout=0.5):
                    online = True
            except Exception:
                online = False
            color = "#48BB78" if online else "#D94E34"
            status_text = f"● Online ({self.host}:{self.port})" if online else f"● Offline ({self.host}:{self.port})"
            self.root.after(0, lambda: self.lbl_status.config(text=status_text, fg=color))
            self.root.after(3000, self.check_connection)
        threading.Thread(target=probe, daemon=True).start()


def main():
    root = tk.Tk()
    app = GelateriaApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()

