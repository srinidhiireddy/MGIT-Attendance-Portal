from pyngrok import ngrok
import time

try:
    # Open a HTTP tunnel on port 5000
    public_url = ngrok.connect(5000).public_url
    print(f"PUBLIC_URL:{public_url}")
    
    # Keep it running
    while True:
        time.sleep(10)
except Exception as e:
    print(f"ERROR:{e}")
