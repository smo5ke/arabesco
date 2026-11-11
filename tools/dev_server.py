#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Arabesco — خادم تطوير محلي مع رؤوس no-cache (يمنع مشاكل الكاش أثناء التعديل).

Usage:  python tools/dev_server.py  (from the Arabesco folder) — serves on http://localhost:8080
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serves files with no-cache headers so edits show up on a plain reload."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        # make sure .json is served as JSON (some Windows registries miss it)
        mime = super().guess_type(path)
        if mime in (None, "application/octet-stream") and path.endswith(".json"):
            return "application/json"
        return mime

    def log_message(self, fmt, *args):
        sys.stdout.write("• %s\n" % (fmt % args))


if __name__ == "__main__":
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler)
    except OSError:
        print(f"Port {PORT} busy — server may already be running on http://localhost:{PORT}")
        sys.exit(0)
    print(f"Arabesco dev server → http://localhost:{PORT}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
