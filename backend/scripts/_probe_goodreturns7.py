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

idx = 0
while True:
    idx = html.find("gold-rate-history", idx)
    if idx < 0:
        break
    print(html[max(0, idx - 200) : idx + 400].replace("\n", " ")[:600])
    print("---")
    idx += 1

for m in re.finditer(r"gold.rate.history[^\n]{0,200}", html, re.I):
    print(m.group(0)[:200])

# external js files
for m in re.finditer(r'src="([^"]+\.js[^"]*)"', html):
    s = m.group(1)
    if "gold" in s.lower() or "rate" in s.lower() or "gr_" in s.lower():
        print("js", s[:150])
