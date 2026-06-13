import re
from datetime import date, timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://www.goodreturns.in/gold-rates/kerala.html",
    "X-Requested-With": "XMLHttpRequest",
    "X-OIGT-Header": "GITPL",
}
base = "https://www.goodreturns.in/gold-rates/kerala.html"

# single date
d = "2025-06-10"
params = urlencode({"gr_db_dynamic_content": "metal_past_price", "date": d})
resp = urlopen(Request(f"{base}?{params}", headers=headers), timeout=15)
body = resp.read().decode("utf-8", "replace")
print("single date len", len(body))
print(body[:800])

# search page for other gr_db_dynamic_content values
html = urlopen(
    Request(base, headers={**headers, "Accept": "text/html"}), timeout=20
).read().decode("utf-8", "replace")
for m in re.finditer(r"gr_db_dynamic_content['\"]:\s*['\"]([^'\"]+)['\"]", html):
    print("dynamic content:", m.group(1))

for m in re.finditer(r"'gr_db_dynamic_content'\s*,\s*'([^']+)'", html):
    print("dynamic2:", m.group(1))

# try history bulk
for content in ["metal_past_price", "metal_history", "gold_rate_history", "rate_history", "historical_rates"]:
    for extra in [{}, {"days": "730"}, {"range": "2y"}]:
        p = {"gr_db_dynamic_content": content, **extra}
        url = base + "?" + urlencode(p)
        try:
            b = urlopen(Request(url, headers=headers), timeout=15).read().decode("utf-8", "replace")
            if len(b) < 50000 and ("table" in b or "24K" in b or "error" not in b.lower()):
                print(content, extra, "len", len(b), b[:150].replace("\n", " "))
        except Exception as e:
            print(content, extra, e)
