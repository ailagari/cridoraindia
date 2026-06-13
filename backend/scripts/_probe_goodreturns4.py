import re
from urllib.request import Request, urlopen

url = "https://www.goodreturns.in/gold-rates/kerala.html"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html",
    "Referer": "https://www.goodreturns.in/",
}
html = urlopen(Request(url, headers=headers), timeout=20).read().decode("utf-8", "replace")

for pat in ["gapi", "oneindia", "gold_rate", "goldrate", "rateHistory", "chart_url", "apiUrl", "city_id", "state_id"]:
    for m in re.finditer(rf".{{0,80}}{pat}.{{0,120}}", html, re.I):
        s = m.group(0).replace("\n", " ")
        if "function" not in s[:20]:
            print(s[:200])
            break

# find var apiUrl assignments near gold
for m in re.finditer(r"apiUrl\s*=\s*['\"]([^'\"]+)['\"]", html):
    print("apiUrl=", m.group(1))

for m in re.finditer(r"const\s+\w*[Uu]rl\s*=\s*['\"]([^'\"]+gold[^'\"]*)['\"]", html):
    print("url=", m.group(1))

for m in re.finditer(r"https://gapi\.oneindia\.com[^\"'\s]*", html):
    print(m.group(0))
