"""Run the extension pages at http://localhost for quick development (no extension reload needed).

Usage:
  python dev.py          # http://localhost:8000/newtab.html  and  /options.html
  python dev.py 5500     # custom port

HTML pages get dev/chrome-stub.js injected, which emulates chrome.storage with localStorage.
Geolocation and the Bing daily photo may behave differently than in the installed extension.
"""
import http.server, pathlib, sys

ROOT = pathlib.Path(__file__).parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
STUB = '<script src="dev/chrome-stub.js"></script>\n  <script src="apps.js">'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        path = self.path.split("?")[0].lstrip("/") or "newtab.html"
        file = ROOT / path
        if file.suffix == ".html" and file.is_file():
            body = file.read_text(encoding="utf-8").replace('<script src="apps.js">', STUB, 1).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # always serve fresh edits
        super().end_headers()


print(f"Customizable TAB dev server: http://localhost:{PORT}/newtab.html  (settings: /options.html)")
http.server.ThreadingHTTPServer(("localhost", PORT), Handler).serve_forever()
