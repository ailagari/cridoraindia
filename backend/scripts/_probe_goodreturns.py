import re
from urllib.request import Request, urlopen

url = "https://www.goodreturns.in/gold-rates/kerala.html"
req = Request(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
        "Referer": "https://www.goodreturns.in/",
    },
)
html = urlopen(req, timeout=20).read().decode("utf-8", "replace")
print("len", len(html))
for pat in ["historical", "chartData", "goldRateHistory", "Highcharts", "price-history", "rate-history"]:
    print(pat, html.lower().count(pat.lower()))

for name in ["chartData", "goldRateHistory", "historyData", "rateHistory", "gold_history"]:
    idx = html.find(name)
    if idx >= 0:
        print("found", name, "snippet:", html[idx : idx + 400].replace("\n", " ")[:400])

# historical table
for cls in ["historical", "history-table", "gold-history", "price-table"]:
    m = re.search(rf'class="[^"]*{cls}[^"]*"', html, re.I)
    if m:
        print("class", cls, m.group(0))

# all table with gold rates
tables = re.findall(r"<table[^>]*>.*?</table>", html, re.I | re.S)
print("tables", len(tables))
for i, t in enumerate(tables[:5]):
    print("--- table", i, "len", len(t))
    print(t[:500].replace("\n", " "))
