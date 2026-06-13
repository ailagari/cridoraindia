import json
import re
from urllib.request import Request, urlopen

url = "https://www.goodreturns.in/gold-rates/kerala.html"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html",
    "Referer": "https://www.goodreturns.in/",
}
html = urlopen(Request(url, headers=headers), timeout=20).read().decode("utf-8", "replace")

for m in re.finditer(r"https?://[^\"'\s]+", html):
    s = m.group(0)
    if any(k in s.lower() for k in ("ajax", "api", "history", "chart", "gold-rate")):
        if "goodreturns" in s:
            print(s[:200])

for m in re.finditer(r"fetch\([^\)]{10,200}\)", html):
    print("fetch", m.group(0)[:200])

for m in re.finditer(r"\.get\([^\)]{10,200}\)", html):
    print("get", m.group(0)[:200])

# script blocks mentioning history
for m in re.finditer(r"<script[^>]*>(.*?)</script>", html, re.S):
    body = m.group(1)
    if "rate-history" in body or "goldRate" in body or "history" in body.lower():
        if len(body) < 5000:
            print("SCRIPT:", body[:800])
        else:
            print("SCRIPT len", len(body), "snippet:", body[:400])

# data attributes
for m in re.finditer(r'data-[a-z-]+="[^"]+"', html):
    s = m.group(0)
    if "history" in s or "chart" in s or "city" in s:
        print(s[:120])
