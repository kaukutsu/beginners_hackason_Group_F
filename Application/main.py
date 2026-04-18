from functools import partial
from pathlib import Path
import http.server

BASE_DIR = Path(__file__).resolve().parent

# Application folder is always served as the web root.
server_address = ("127.0.0.1", 8000)
handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(BASE_DIR))
httpd = http.server.HTTPServer(server_address, handler)

print(f"HTTP Server Running on http://127.0.0.1:8000 (serving {BASE_DIR})")
httpd.serve_forever()
