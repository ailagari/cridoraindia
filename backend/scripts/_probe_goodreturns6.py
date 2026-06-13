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

for m in re.finditer(r"controller\.php[^\"']*", html):
    print(m.group(0)[:200])

for m in re.finditer(r"module=gold[^\"'&]{0,80}", html, re.I):
    print(m.group(0))

for m in re.finditer(r"gold[^\"'\s]{0,30}\.json", html, re.I):
    print("json", m.group(0))

# canvas/chart ids
for m in re.finditer(r'id="[^"]*(chart|graph|history)[^"]*"', html, re.I):
    print(m.group(0))

# search for arrays of numbers that look like prices
for m in re.finditer(r"\[[\d,\s]{50,800}\]", html):
    s = m.group(0)
    if "136" in s or "148" in s:
        print("num array", s[:200])

# parse history table fully
tables = re.findall(r'<table class="gr-table table-conatiner">.*?</table>', html, re.S)
for t in tables:
    if "Date" not in t:
        continue
    rows = re.findall(r"<tr>\s*<td>([^<]+)</td>\s*<td>\s*&#x20b9;([\d,]+).*?<td>\s*&#x20b9;([\d,]+)", t, re.S)
    print("parsed rows", len(rows))
    print(rows[:3])
    print(rows[-3:])

# silver on page
if "Silver" in html:
    idx = html.find("Silver")
    print("silver ctx", html[idx : idx + 500].replace("\n", " ")[:500])
