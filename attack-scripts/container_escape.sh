#!/bin/bash

echo "[+] Attempting Container Escape"

# Check for privileged mode
echo "[*] Checking container privileges..."
if [ -w /proc/sys/kernel/core_pattern ]; then
    echo "[!] Container has write access to /proc/sys/kernel/core_pattern - CRITICAL"
else
    echo "[-] No write access to core_pattern"
fi

# Check for host devices
echo "[*] Checking host device access..."
ls -la /dev/ | grep -E "(sd[a-z]|nvme)" && echo "[!] Block devices accessible" || echo "[-] No block devices"

# Check for Docker socket
echo "[*] Checking Docker socket..."
ls -la /var/run/docker.sock && echo "[!] Docker socket exposed - CRITICAL" || echo "[-] No Docker socket"

# Check capabilities
echo "[*] Current capabilities:"
grep Cap /proc/self/status

# Try to read host files
echo "[*] Attempting to read host files..."
for path in /proc/1/environ /etc/hostname /etc/hosts; do
    if [ -r "$path" ]; then
        echo "[!] Can read $path"
        head -n 3 "$path" 2>/dev/null
    fi
done

# Check for shared namespaces
echo "[*] Checking namespaces..."
ls -la /proc/1/ns/
