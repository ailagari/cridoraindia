import re
from urllib.request import Request, urlopen
from urllib.parse import urlencode

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/json",
    "Referer": "https://www.goodreturns.in/gold-rates/kerala.html",
    "X-Requested-With": "XMLHttpRequest",
}
html = urlopen(
    Request("https://www.goodreturns.in/gold-rates/kerala.html", headers=headers), timeout=20
).read().decode("utf-8", "replace")

idx = html.find("xhr.open('GET', window.location.pathname")
chunk = html[max(0, idx - 1500) : idx + 200]
print(chunk.replace("\n", " ")[:2000])

# try common param names
base = "https://www.goodreturns.in/gold-rates/kerala.html"
for params in [
    {"ajax": "1", "type": "history"},
    {"ajax": "gold-rate-history"},
    {"module": "gold_rate_history"},
    {"fetch": "history"},
    {"history": "1"},
    {"action": "history"},
    {"gold_rate_history": "1"},
    {"type": "historical"},
    {"view": "history"},
]:
    url = base + "?" + urlencode(params)
    try:
        resp = urlopen(Request(url, headers=headers), timeout=15)
        body = resp.read().decode("utf-8", "replace")
        print(params, "->", len(body), body[:120].replace("\n", " "))
    except Exception as e:
        print(params, "->", e)
