import http.server
import socketserver

DIRECTORY = "Application"

#HTTPサーバー
server_address = ('127.0.0.1', 8000)
handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.HTTPServer(server_address, handler)

#サーバーを起動
print("HTTP Server Running on http://127.0.0.1:8000")
httpd.serve_forever()
