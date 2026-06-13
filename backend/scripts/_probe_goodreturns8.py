import re
from urllib.request import Request, urlopen

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html",
    "Referer": "https://www.goodreturns.in/",
}
html = urlopen(
    Request("https://www.goodreturns.in/gold-rates/kerala.html", headers=headers), timeout=20
).read().decode("utf-8", "replace")

for m in re.finditer(r"xhr\.open\([^\)]+\)", html):
    s = m.group(0)
    if "gold" in s.lower() or "history" in s.lower() or "rate" in s.lower():
        print(s)

# broader context around gold-rate-history xhr
idx = html.find('document.getElementById("gold-rate-history")')
if idx >= 0:
    chunk = html[max(0, idx - 2500) : idx + 500]
    for m in re.finditer(r"xhr\.open\([^\)]+\)", chunk):
        print("CTX open:", m.group(0))
    for m in re.finditer(r"https?://[^\"']+", chunk):
        print("CTX url:", m.group(0)[:200])
    for m in re.finditer(r"['\"](/[^\"']+)['\"]", chunk):
        s = m.group(1)
        if "gold" in s or "history" in s or "rate" in s:
            print("CTX path:", s)
