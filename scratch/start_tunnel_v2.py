from pyngrok import ngrok
import time
import os

try:
    # Open a HTTP tunnel on port 5000
    public_url = ngrok.connect(5000).public_url
    print(f"PUBLIC_URL:{public_url}")
    
    # Write to a file so we can read it easily
    with open("ngrok_url.txt", "w") as f:
        f.write(public_url)
    
    # Keep it running
    while True:
        time.sleep(10)
except Exception as e:
    with open("ngrok_error.txt", "w") as f:
        f.write(str(e))
    print(f"ERROR:{e}")
