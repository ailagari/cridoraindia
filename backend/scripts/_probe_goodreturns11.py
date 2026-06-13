import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://www.goodreturns.in/gold-rates/kerala.html",
    "X-Requested-With": "XMLHttpRequest",
    "X-OIGT-Header": "GITPL",
}

def fetch_gold(date_str: str):
    url = "https://www.goodreturns.in/gold-rates/kerala.html?" + urlencode(
        {"gr_db_dynamic_content": "metal_past_price", "date": date_str}
    )
    resp = urlopen(Request(url, headers=headers), timeout=15)
    return json.loads(resp.read().decode())

for d in ["2024-06-10", "2023-01-15", "2026-06-10"]:
    try:
        data = fetch_gold(d)
        print(d, data)
    except Exception as e:
        print(d, e)

# silver kerala
silver_base = "https://www.goodreturns.in/silver-rates/kerala.html"
for content in ["metal_past_price", "silver_past_price"]:
    url = silver_base + "?" + urlencode({"gr_db_dynamic_content": content, "date": "2025-06-10"})
    h = {**headers, "Referer": silver_base}
    try:
        b = urlopen(Request(url, headers=h), timeout=15).read().decode()
        print("silver", content, b[:300])
    except Exception as e:
        print("silver", content, e)
