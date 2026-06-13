import re
from datetime import date, timedelta
from urllib.request import Request, urlopen

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html",
    "Referer": "https://www.goodreturns.in/",
}

base = "https://www.goodreturns.in/gold-rates/kerala.html"
html = urlopen(Request(base, headers=headers), timeout=20).read().decode("utf-8", "replace")

# links with dates in href
for m in re.finditer(r'href="(/gold-rates/[^"]+)"', html):
    s = m.group(1)
    if re.search(r"\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", s, re.I):
        print(s)

# try monthly archive slugs
today = date.today()
for months_back in [0, 1, 6, 12, 24]:
    d = today - timedelta(days=30 * months_back)
    slug = d.strftime("%B-%Y").lower()
    for pattern in [
        f"https://www.goodreturns.in/gold-rates/kerala/{slug}.html",
        f"https://www.goodreturns.in/gold-rates/kerala-{d.strftime('%B-%Y').lower()}.html",
        f"https://www.goodreturns.in/gold-rates/kerala/{d.year}/{d.month:02d}.html",
    ]:
        try:
            resp = urlopen(Request(pattern, headers=headers), timeout=10)
            body = resp.read()
            print("OK", pattern, len(body))
            break
        except Exception as e:
            pass

# POST to gapi with gold rates payload guess
import json
payloads = [
    {"action": "gold_rate_history", "city": "kerala", "days": 730},
    {"module": "gold_rates", "city": "kerala", "type": "history"},
    {"service": "goldrate", "location": "kerala", "range": "2y"},
]
for p in payloads:
    try:
        req = Request(
            "https://gapi.oneindia.com/gapi",
            data=json.dumps(p).encode(),
            headers={**headers, "Content-Type": "application/json"},
            method="POST",
        )
        resp = urlopen(req, timeout=10)
        print("POST", p, resp.status, resp.read()[:300])
    except Exception as e:
        print("POST fail", list(p.keys()), e)
