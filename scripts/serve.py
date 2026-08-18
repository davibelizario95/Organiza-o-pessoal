#!/usr/bin/env python3
import functools
import http.server
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # servidor só de desenvolvimento: nunca deixa o navegador cachear,
    # senão edições em js/css somem "sem motivo" até um hard-reload
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory=ROOT)
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
print(f"Serving {ROOT} on port {PORT}")
httpd.serve_forever()
