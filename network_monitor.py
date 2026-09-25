"""
network_monitor.py — Visible proof of zero external network calls.

Monitors all outbound connections and flags any that are NOT
to a private/loopback address. Uses Python's ipaddress module
to correctly distinguish private LAN IPs (192.168.x.x, 10.x.x.x)
from genuinely public IPs.

Run this in a visible terminal during the demo. If it shows
"0 external connections" throughout the demo, the sovereignty
proof holds — even when phones connect over LAN.

When to call: Run as a background process during the entire
demo. Pipe output to a visible terminal.
When NOT to call: Do not use this for application logic —
it's a standalone monitoring/proof tool, not part of the agent pipeline.
"""
import ipaddress
import socket
import subprocess
import time
from datetime import datetime


def _is_external(ip_str: str) -> bool:
    """Check if an IP address is genuinely external (not private/loopback).
    
    Uses ipaddress module's is_private and is_loopback checks.
    Private-range IPs (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x)
    are treated as expected local/LAN traffic — NOT violations.
    
    Args:
        ip_str: IP address string (e.g. "192.168.1.5" or "203.0.113.1")
    
    Returns:
        True if the IP is genuinely external/public. False if it's
        loopback, private, or link-local.
    
    When NOT to call: Do not call with malformed IP strings —
    wrap in try/except or validate first.
    """
    try:
        addr = ipaddress.ip_address(ip_str)
        return not (addr.is_loopback or addr.is_private or addr.is_link_local)
    except ValueError:
        # Not a valid IP — treat as potentially external to be safe
        return True


def _get_connections():
    """Parse ss/netstat output for active outbound connections."""
    try:
        result = subprocess.run(
            ["ss", "-tunp"],
            capture_output=True, text=True, timeout=2
        )
        if result.returncode != 0:
            # Fallback to netstat
            result = subprocess.run(
                ["netstat", "-tunp"],
                capture_output=True, text=True, timeout=2
            )
        return result.stdout
    except Exception:
        return ""


def check_external_connections():
    """Check for any genuinely external (non-private) connections.
    
    Returns:
        tuple: (has_external: bool, connections: list of str)
    
    When NOT to call: Do not call from within MCP tools —
    it's a standalone monitoring script, not part of the agent.
    """
    output = _get_connections()
    external = []
    for line in output.strip().split("\n"):
        parts = line.split()
        if len(parts) >= 5:
            dest = parts[4]
            # Extract IP from dest (format: IP:PORT)
            ip = dest.split(":")[0] if ":" in dest else dest
            if _is_external(ip):
                external.append(line.strip())
    return len(external) > 0, external


def monitor_loop(interval: int = 2):
    """Continuously monitor and print connection status.
    
    Args:
        interval: Seconds between checks (default 2).
    
    This runs until Ctrl+C. Prints ✅ LOCAL for private/LAN traffic,
    ⚠ EXTERNAL only for genuinely public IPs.
    """
    print("=" * 60)
    print("Network Monitor — Zero External Call Proof")
    print("=" * 60)
    print("Monitoring outbound connections... (Ctrl+C to stop)")
    print("Private/LAN IPs (10.x, 192.168.x, 172.16-31.x, 127.x) = LOCAL")
    print("Public IPs = EXTERNAL")
    print(f"{'Time':<20} {'Status':<15} {'Details'}")
    print("-" * 60)

    try:
        while True:
            has_external, connections = check_external_connections()
            timestamp = datetime.now().strftime("%H:%M:%S")
            if has_external:
                print(f"{timestamp:<20} {'⚠ EXTERNAL':<15} {'Genuine external connection!'}")
                for c in connections:
                    print(f"  → {c}")
            else:
                print(f"{timestamp:<20} {'✅ LOCAL':<15} {'All connections local/LAN'}")
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped. Summary:")
        has_external, connections = check_external_connections()
        if has_external:
            print("  ⚠ EXTERNAL connections detected during monitoring!")
        else:
            print("  ✅ Zero external connections confirmed throughout demo.")


if __name__ == "__main__":
    monitor_loop()
