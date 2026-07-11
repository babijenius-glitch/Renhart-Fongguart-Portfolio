import http.server
import socketserver
import json
import os
import urllib.parse

PORT = 8082
DIRECTORY = "."

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Disable caching so edits show up immediately
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                target_path = data.get('path', '')
                html_content = data.get('html', '')
                
                # Clean the path
                if target_path.startswith('/'):
                    target_path = target_path[1:]
                
                # Basic security check
                if '..' in target_path or not target_path.endswith('.html'):
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Invalid path")
                    return
                    
                file_path = os.path.join(DIRECTORY, target_path)
                
                if os.path.exists(file_path):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'success'}).encode())
                else:
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b"File not found")
                    
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

print(f"Starting server at http://localhost:{PORT}")
print("Admin edits will be saved directly to .html files.")
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.serve_forever()
