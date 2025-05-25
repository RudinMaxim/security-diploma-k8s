#!/bin/bash

TARGET_URL=${1:-"http://localhost:8080"}
BACKEND_URL=${2:-"http://localhost:3000"}

echo "=== Starting Security Testing ==="
echo "Target: $TARGET_URL"
echo "Backend: $BACKEND_URL"
echo

# 1. SQL Injection
echo "[1] SQL Injection Tests"
python3 sql_injection.py $TARGET_URL

# 2. XSS Testing
echo -e "\n[2] XSS Tests"
python3 xss_test.py $TARGET_URL

# 3. Container Escape
echo -e "\n[3] Container Escape Attempts"
./container_escape.sh

# 4. Network Scanning
echo -e "\n[4] Network Scanning"
python3 network_scan.py

# 5. DoS Testing
echo -e "\n[5] DoS Testing"
./dos_test.sh $TARGET_URL

# 6. Secret Extraction
echo -e "\n[6] Secret Extraction"
./extract_secrets.sh

echo -e "\n=== Testing Complete ==="
