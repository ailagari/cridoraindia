import re
from urllib.request import Request, urlopen

url = "https://www.goodreturns.in/gold-rates/kerala.html"
req = Request(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Referer": "https://www.goodreturns.in/",
    },
)
html = urlopen(req, timeout=20).read().decode("utf-8", "replace")

for m in re.finditer(r"rate-history[^\n\"'<>]{0,160}", html, re.I):
    print(m.group(0)[:160])

for m in re.finditer(r"/gold-rates/[^\"']+", html):
    s = m.group(0)
    if "history" in s.lower() or "archive" in s.lower():
        print("path", s[:120])

# history table
tables = re.findall(r'<table class="gr-table table-conatiner">.*?</table>', html, re.S)
for t in tables:
    if "Date" in t:
        rows = re.findall(r"<tr>.*?</tr>", t, re.S)
        print("history rows on page", len(rows))
        for r in rows[:2]:
            print(r[:250].replace("\n", " "))
        break

# try archive URL patterns
for suffix in [
    "kerala-gold-rate-history.html",
    "kerala-gold-rate-archives.html",
    "kerala-gold-rate-chart.html",
]:
    u = f"https://www.goodreturns.in/gold-rates/{suffix}"
    try:
        r = Request(u, headers=req.headers)
        resp = urlopen(r, timeout=15)
        print(suffix, resp.status, len(resp.read()))
    except Exception as e:
        print(suffix, e)
