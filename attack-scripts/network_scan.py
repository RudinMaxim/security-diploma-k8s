import socket
import threading
import sys
from concurrent.futures import ThreadPoolExecutor

def scan_port(host, port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        if result == 0:
            return port
    except:
        pass
    return None

def scan_host(host):
    print(f"[+] Scanning {host}")
    common_ports = [22, 80, 443, 3000, 5432, 6379, 8080, 9000]
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(scan_port, host, port) for port in common_ports]
        open_ports = [f.result() for f in futures if f.result()]
    
    if open_ports:
        print(f"[!] Open ports on {host}: {open_ports}")
    else:
        print(f"[-] No open ports found on {host}")

def discover_hosts():
    print("[+] Discovering hosts in cluster network")
    
    # Common K8s service networks
    networks = [
        "10.96.0",    # Default service network
        "10.244.0",   # Pod network
        "10.109.88",  # Your backend service
        "10.108.142", # Your nginx service
        "10.107.67",  # Your postgres service
        "10.106.139"  # Your redis service
    ]
    
    for network in networks:
        for i in range(1, 255):
            host = f"{network}.{i}"
            try:
                socket.gethostbyaddr(host)
                scan_host(host)
            except:
                continue

if __name__ == "__main__":
    discover_hosts()
