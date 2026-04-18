from functools import partial
from pathlib import Path
import http.server
import webbrowser

BASE_DIR = Path(__file__).resolve().parent

server_address = ("127.0.0.1", 8000)
handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(BASE_DIR))
httpd = http.server.HTTPServer(server_address, handler)
url = f"http://{server_address[0]}:{server_address[1]}"

print(f"HTTP Server Running on http://127.0.0.1:8000 (serving {BASE_DIR})")
print(f"HTTP Server Running on {url} (serving {BASE_DIR})")
webbrowser.open(url)
httpd.serve_forever()