"""
AnimeHub Stream Capture Addon for mitmproxy
─────────────────────────────────────────────
Intercepts ALL traffic while the proxy is running and prints any
.m3u8 / .mp4 request URLs to the console AND saves them to
captured_streams.txt so you can copy them into Supabase.

Usage (run from project root):
  mitmdump -s scripts/capture_stream.py --listen-port 8080 --ssl-insecure

Then set your browser / system proxy to:
  HTTP:  127.0.0.1:8080
  HTTPS: 127.0.0.1:8080

Navigate to:
  https://megaplay.buzz/stream/s-2/160485/sub
  (or the megacloud URL — it redirects there)

The real m3u8 URL will print here within a few seconds.
"""

import re
from datetime import datetime
from mitmproxy import http

OUTFILE = "captured_streams.txt"
TARGETS = ["megaplay.buzz", "megacloud", "megacloud.bloggy.click"]

# Regex: any URL ending in .m3u8 (with optional query params) or .mp4
STREAM_RE = re.compile(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*|https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*')


def _banner(msg: str):
    bar = "=" * 60
    print(f"\n{bar}\n  {msg}\n{bar}\n")


def request(flow: http.HTTPFlow) -> None:
    url = flow.request.pretty_url

    # Capture direct .m3u8 / .mp4 requests (the player fetching the stream)
    if re.search(r'\.(m3u8|mp4)(\?|$)', url):
        _banner(f"🎬 STREAM URL CAPTURED:\n  {url}")
        _save(url)
        return

    # Also log interesting megaplay API calls for debugging
    if any(t in url for t in TARGETS):
        ct = flow.request.headers.get("content-type", "")
        if flow.request.method in ("POST", "GET") and "api" in url.lower():
            print(f"[API call] {flow.request.method} {url}")


def response(flow: http.HTTPFlow) -> None:
    url = flow.request.pretty_url
    ct = flow.response.headers.get("content-type", "")

    # JSON responses from megaplay that may contain stream info
    if any(t in url for t in TARGETS) and "json" in ct:
        body = flow.response.text or ""
        matches = STREAM_RE.findall(body)
        for m in matches:
            _banner(f"🎬 STREAM URL IN JSON BODY:\n  {m}")
            _save(m)

    # Scrape m3u8/mp4 from any HTML/JS response on the target domains
    if any(t in url for t in TARGETS) and any(x in ct for x in ("html", "javascript")):
        body = flow.response.text or ""
        matches = STREAM_RE.findall(body)
        for m in matches:
            _banner(f"🎬 STREAM URL IN PAGE SOURCE:\n  {m}")
            _save(m)


def _save(url: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(OUTFILE, "a", encoding="utf-8") as f:
        f.write(f"[{ts}] {url}\n")
    print(f"  → Saved to {OUTFILE}")
