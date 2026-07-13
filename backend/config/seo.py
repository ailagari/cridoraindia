"""Server-side SEO meta injection for SPA routes (crawler-visible HTML)."""
from __future__ import annotations

import html
import json
import re
from typing import Any
from urllib.parse import quote

SITE_URL = "https://www.cridoraindia.com"
SITE_NAME = "Cridora India"
SITE_LOGO_URL = f"{SITE_URL}/icon-512.png"
DEFAULT_OG_IMAGE = f"{SITE_URL}/og-preview.png"
_DEFAULT_ADSENSE_PUBLISHER_ID = "ca-pub-1180208702657280"


def adsense_publisher_id() -> str:
    from django.conf import settings

    return (getattr(settings, "ADSENSE_PUBLISHER_ID", "") or _DEFAULT_ADSENSE_PUBLISHER_ID).strip()


def adsense_meta_snippet() -> str:
    return f'    <meta name="google-adsense-account" content="{adsense_publisher_id()}">\n'


def adsense_script_snippet() -> str:
    pub_id = adsense_publisher_id()
    return (
        f'    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={pub_id}" '
        'crossorigin="anonymous"></script>\n'
    )

DEFAULT_KEYWORDS = (
    "gold rate today, Kerala gold rate, gold rate in India, 22K gold rate, "
    "24K gold rate, silver rate Kerala, gold price Kerala, gold rate India today, "
    "സ്വർണ്ണ വില, Kerala gold rate Malayalam"
)

GOLD_RATE_CITIES: list[dict[str, str]] = [
    {"slug": "kochi", "name": "Kochi", "name_ml": "കൊച്ചി", "gold_ml": "കൊച്ചി സ്വർണ്ണ വില"},
    {"slug": "ernakulam", "name": "Ernakulam", "name_ml": "എറണാകുളം", "gold_ml": "എറണാകുളം സ്വർണ്ണ വില"},
    {
        "slug": "thiruvananthapuram",
        "name": "Thiruvananthapuram",
        "name_ml": "തിരുവനന്തപുരം",
        "gold_ml": "തിരുവനന്തപുരം സ്വർണ്ണ വില",
    },
    {"slug": "kozhikode", "name": "Kozhikode", "name_ml": "കോഴിക്കോട്", "gold_ml": "കോഴിക്കോട് സ്വർണ്ണ വില"},
    {"slug": "thrissur", "name": "Thrissur", "name_ml": "തൃശ്ശൂർ", "gold_ml": "തൃശ്ശൂർ സ്വർണ്ണ വില"},
    {"slug": "kollam", "name": "Kollam", "name_ml": "കൊല്ലം", "gold_ml": "കൊല്ലം സ്വർണ്ണ വില"},
    {"slug": "kannur", "name": "Kannur", "name_ml": "കണ്ണൂർ", "gold_ml": "കണ്ണൂർ സ്വർണ്ണ വില"},
    {"slug": "palakkad", "name": "Palakkad", "name_ml": "\u0D2A\u0D3E\u0D32\u0D3E\u0D15\u0D15\u0D21", "gold_ml": "\u0D2A\u0D3E\u0D32\u0D3E\u0D15\u0D15\u0D21 \u0D38\u0D4D\u0D35\u0D7C\u0D23\u0D4D\u0D23 \u0D35\u0D3F\u0D32"},
    {"slug": "alappuzha", "name": "Alappuzha", "name_ml": "ആലപ്പുഴ", "gold_ml": "ആലപ്പുഴ സ്വർണ്ണ വില"},
    {"slug": "malappuram", "name": "Malappuram", "name_ml": "മലപ്പുറം", "gold_ml": "മലപ്പുറം സ്വർണ്ണ വില"},
    {"slug": "kottayam", "name": "Kottayam", "name_ml": "കോട്ടയം", "gold_ml": "കോട്ടയം സ്വർണ്ണ വില"},
    {"slug": "pathanamthitta", "name": "Pathanamthitta", "name_ml": "പത്തനംതിട്ട", "gold_ml": "പത്തനംതിട്ട സ്വർണ്ണ വില"},
    {"slug": "idukki", "name": "Idukki", "name_ml": "\u0D07\u0D21\u0D41\u0D15\u0D4D\u0D15\u0D3F", "gold_ml": "\u0D07\u0D21\u0D41\u0D15\u0D4D\u0D15\u0D3F \u0D38\u0D4D\u0D35\u0D7C\u0D23\u0D4D\u0D23 \u0D35\u0D3F\u0D32"},
    {"slug": "wayanad", "name": "Wayanad", "name_ml": "വയനാട്", "gold_ml": "വയനാട് സ്വർണ്ണ വില"},
    {"slug": "kasaragod", "name": "Kasaragod", "name_ml": "കാസർഗോഡ്", "gold_ml": "കാസർഗോഡ് സ്വർണ്ണ വില"},
]

CITY_BY_SLUG = {c["slug"]: c for c in GOLD_RATE_CITIES}

# Major Indian cities for national gold rate pages (non-Kerala)
INDIA_GOLD_RATE_CITIES: list[dict[str, str]] = [
    {"slug": "mumbai", "name": "Mumbai", "state": "Maharashtra"},
    {"slug": "delhi", "name": "Delhi", "state": "Delhi"},
    {"slug": "chennai", "name": "Chennai", "state": "Tamil Nadu"},
    {"slug": "bangalore", "name": "Bangalore", "state": "Karnataka", "alt": "Bengaluru"},
    {"slug": "hyderabad", "name": "Hyderabad", "state": "Telangana"},
    {"slug": "pune", "name": "Pune", "state": "Maharashtra"},
    {"slug": "kolkata", "name": "Kolkata", "state": "West Bengal"},
    {"slug": "jaipur", "name": "Jaipur", "state": "Rajasthan"},
    {"slug": "ahmedabad", "name": "Ahmedabad", "state": "Gujarat"},
    {"slug": "surat", "name": "Surat", "state": "Gujarat"},
    {"slug": "lucknow", "name": "Lucknow", "state": "Uttar Pradesh"},
    {"slug": "nagpur", "name": "Nagpur", "state": "Maharashtra"},
    {"slug": "indore", "name": "Indore", "state": "Madhya Pradesh"},
    {"slug": "bhopal", "name": "Bhopal", "state": "Madhya Pradesh"},
    {"slug": "visakhapatnam", "name": "Visakhapatnam", "state": "Andhra Pradesh", "alt": "Vizag"},
    {"slug": "patna", "name": "Patna", "state": "Bihar"},
    {"slug": "vadodara", "name": "Vadodara", "state": "Gujarat"},
    {"slug": "ludhiana", "name": "Ludhiana", "state": "Punjab"},
    {"slug": "agra", "name": "Agra", "state": "Uttar Pradesh"},
    {"slug": "nashik", "name": "Nashik", "state": "Maharashtra"},
    {"slug": "rajkot", "name": "Rajkot", "state": "Gujarat"},
    {"slug": "varanasi", "name": "Varanasi", "state": "Uttar Pradesh"},
    {"slug": "coimbatore", "name": "Coimbatore", "state": "Tamil Nadu"},
    {"slug": "madurai", "name": "Madurai", "state": "Tamil Nadu"},
    {"slug": "mysuru", "name": "Mysuru", "state": "Karnataka", "alt": "Mysore"},
    {"slug": "chandigarh", "name": "Chandigarh", "state": "Punjab"},
    {"slug": "guwahati", "name": "Guwahati", "state": "Assam"},
    {"slug": "bhubaneswar", "name": "Bhubaneswar", "state": "Odisha"},
]

INDIA_CITY_BY_SLUG = {c["slug"]: c for c in INDIA_GOLD_RATE_CITIES}

ALL_CITY_SLUGS = frozenset(
    {c["slug"] for c in GOLD_RATE_CITIES} | {c["slug"] for c in INDIA_GOLD_RATE_CITIES}
)


def _city_seo(city: dict[str, str]) -> dict[str, str]:
    name = city["name"]
    path = f"/gold-rates/{city['slug']}"
    return {
        "title": f"{name} Gold Rate Today — Live 22K, 24K & Silver Kerala | Cridora India",
        "description": (
            f"Live gold rate in {name}, Kerala today per gram — 22K (916), 24K, 18K gold and silver 999. "
            "Charts, history, calculator. Updated every few minutes."
        ),
        "keywords": (
            f"{name} gold rate today, gold rate {name}, {name} gold price, 22K gold rate Kerala, "
            f"24K gold rate Kerala, {city['gold_ml']}, gold rate Kerala"
        ),
        "path": path,
    }


def _india_city_seo(city: dict[str, str]) -> dict[str, str]:
    name = city["name"]
    state = city["state"]
    alt = city.get("alt", "")
    alt_note = f" ({alt})" if alt else ""
    path = f"/gold-rates/{city['slug']}"
    alt_kw = f", {alt} gold rate today" if alt else ""
    return {
        "title": f"{name} Gold Rate Today — Live 22K, 24K & Silver Price India | Cridora",
        "description": (
            f"Live gold rate in {name}{alt_note}, {state} today per gram — 22K (916 BIS), 24K, 18K gold "
            "and silver 999. Check today's gold price, free jewellery calculator with GST. "
            "Updated every few minutes on Cridora India."
        ),
        "keywords": (
            f"{name} gold rate today, gold rate in {name}, {name} gold price today, "
            f"gold rate {name} per gram, 22K gold rate {name}, 24K gold rate {name}, "
            f"today gold rate {name}, gold price India today, gold rate India{alt_kw}"
        ),
        "path": path,
    }


ROUTE_SEO: dict[str, dict[str, str]] = {
    "/": {
        "title": "Cridora India — Live Gold Rates Kerala, Digital Gold Portfolio & Jeweller Platform",
        "description": (
            "Live Kerala gold rates (22K, 24K, silver), digital gold portfolio tracking, "
            "bill vault, and verified jeweller engagement across India. "
            "Check today's gold price in Kerala on Cridora."
        ),
        "keywords": DEFAULT_KEYWORDS,
    },
    "/gold-rates/kerala": {
        "title": "Kerala Gold Rate Today — Live 22K, 24K & Silver Price | Cridora India",
        "description": (
            "Check live Kerala gold rate today per gram — 24K, 22K (916), 18K gold and silver 999. "
            "Daily price chart, 2-year history, jewellery calculator. Updated every few minutes."
        ),
        "keywords": (
            "Kerala gold rate today, gold rate Kerala, 22K gold rate Kerala, "
            "24K gold rate today Kerala, silver rate Kerala, gold price per gram Kerala, "
            "Kochi gold rate, Thiruvananthapuram gold rate, gold rate India, "
            "സ്വർണ്ണ വില Kerala, Kerala gold rate Malayalam"
        ),
    },
    "/gold-rates/india": {
        "title": "Gold Rate in India Today — Live Kerala 22K & 24K Prices | Cridora India",
        "description": (
            "Today's gold rate in India with live Kerala board references — 22K, 24K, 18K and silver per gram. "
            "Historical charts, daily rate table, and jewellery value calculator."
        ),
        "keywords": (
            "gold rate India, gold rate today India, gold price India, 22K gold rate India, "
            "24K gold rate today, Kerala gold rate, gold rate per gram India"
        ),
    },
    "/gold-calculator": {
        "title": "Gold Calculator India — 22K, 24K Jewellery Price with GST & Making Charges | Cridora",
        "description": (
            "Free gold jewellery calculator with live Kerala 22K and 24K rates. Estimate ornament price by weight, "
            "purity, making charges, and GST on gold and making. Updated every few minutes."
        ),
        "keywords": (
            "gold calculator, gold jewellery calculator, gold price calculator India, 22K gold calculator, "
            "gold making charges calculator, Kerala gold calculator, gold rate calculator, GST on gold calculator, "
            "സ്വർണ്ണ കാൽക്കുലേറ്റർ"
        ),
    },
    "/gold-rates": {
        "title": "Gold Rates — Kerala & India | Cridora India",
        "description": "Live gold and silver rates for Kerala and India on Cridora.",
        "keywords": DEFAULT_KEYWORDS,
    },
    "/jewellers": {
        "title": "Verified Jewellers in Kerala & India | Cridora India",
        "description": "Browse verified jewellers on Cridora India in Kerala and across India.",
        "keywords": "jewellers Kerala, gold shop Kerala, verified jeweller India",
    },
    "/marketplace": {
        "title": "Gold Jewellery Marketplace — Kerala & India | Cridora India",
        "description": "Shop gold jewellery from verified jewellers on Cridora India.",
        "keywords": "gold jewellery Kerala, buy gold online India, gold marketplace",
    },
    "/how-it-works": {
        "title": "How Cridora Works — Digital Gold Portfolio & Jeweller Platform",
        "description": "Learn how Cridora helps customers track gold and connect with jewellers.",
        "keywords": DEFAULT_KEYWORDS,
    },
    "/features": {
        "title": "Features — Digital Gold Portfolio & Live Gold Rates | Cridora India",
        "description": "Portfolio tracking, live gold rates, digital bill vault, and jeweller tools.",
        "keywords": DEFAULT_KEYWORDS,
    },
    "/privacy": {
        "title": "Privacy Policy — Cridora India",
        "description": (
            "Privacy policy for Cridora India: data collection, cookies, Google AdSense, and user choices."
        ),
        "keywords": "Cridora privacy policy, cookies, AdSense",
    },
    "/terms": {
        "title": "Terms of Use — Cridora India",
        "description": "Terms of use for the Cridora India website and platform.",
        "keywords": "Cridora terms of use",
    },
    "/disclaimer": {
        "title": "Disclaimer — Gold Rates & Financial Information | Cridora India",
        "description": "Gold rates are indicative only. Not investment advice. Not SEBI regulated.",
        "keywords": "gold rate disclaimer, not investment advice",
    },
    "/grievance": {
        "title": "Grievance Redressal — Cridora India",
        "description": "Grievance officer contact for Cridora India under IT rules.",
        "keywords": "grievance officer Cridora",
    },
    "/contact": {
        "title": "Contact & About — Cridora India",
        "description": "Contact Cridora India for support and partnerships. Based in Kerala, India.",
        "keywords": "contact Cridora India",
    },
    "/editorial-standards": {
        "title": "Editorial Standards & Data Sources — Cridora India",
        "description": (
            "How Cridora India sources, verifies, and corrects Kerala gold rate data, the gold jewellery "
            "calculator, and city rate references."
        ),
        "keywords": "Cridora data sources, gold rate accuracy, editorial standards",
    },
}

for _city in GOLD_RATE_CITIES:
    _meta = _city_seo(_city)
    ROUTE_SEO[_meta["path"]] = _meta

for _city in INDIA_GOLD_RATE_CITIES:
    _meta = _india_city_seo(_city)
    ROUTE_SEO[_meta["path"]] = _meta

ML_GOLD_META: dict[str, dict[str, str]] = {
    "/gold-rates/kerala": {
        "title": "കേരള സ്വർണ്ണ വില ഇന്ന് — Live 22K, 24K & Silver | Cridora India",
        "description": (
            "കേരള സ്വർണ്ണ വില ഇന്ന് — 22K, 24K, 18K, silver per gram. "
            "2-year chart, history, calculator. Cridora India."
        ),
    },
    "/gold-rates/india": {
        "title": "ഇന്ത്യ സ്വർണ്ണ വില ഇന്ന് — Live 22K, 24K | Cridora India",
        "description": "ഇന്ത്യ സ്വർണ്ണ വില — Kerala board 22K, 24K, 18K, silver per gram on Cridora.",
    },
    "/gold-calculator": {
        "title": "സ്വർണ്ണ കാൽക്കുലേറ്റർ — Live 22K, 24K GST & Making | Cridora India",
        "description": (
            "സ്വർണ്ണ കാൽക്കുലേറ്റർ — live Kerala 22K, 24K rate, making charges, GST. Cridora India."
        ),
    },
}

for _city in GOLD_RATE_CITIES:
    _base = f"/gold-rates/{_city['slug']}"
    ML_GOLD_META[_base] = {
        "title": f"{_city['name_ml']} സ്വർണ്ണ വില ഇന്ന് — Live 22K, 24K | Cridora India",
        "description": f"{_city['gold_ml']} ഇന്ന് — 22K, 24K, 18K, silver per gram on Cridora India.",
    }

GOLD_RATE_BASE_PATHS = frozenset(
    {"/gold-rates/kerala", "/gold-rates/india", "/gold-rates"}
    | {f"/gold-rates/{c['slug']}" for c in GOLD_RATE_CITIES}
    | {f"/gold-rates/{c['slug']}" for c in INDIA_GOLD_RATE_CITIES}
)

GOLD_CALCULATOR_BASE_PATHS = frozenset({"/gold-calculator"})

for _base in sorted(GOLD_RATE_BASE_PATHS):
    if _base == "/gold-rates":
        continue
    _en = ROUTE_SEO.get(_base, ROUTE_SEO["/"])
    _ml = ML_GOLD_META.get(_base, _en)
    ROUTE_SEO[f"/ml{_base}"] = {**_en, "title": _ml["title"], "description": _ml["description"]}

for _calc_base in sorted(GOLD_CALCULATOR_BASE_PATHS):
    _en_calc = ROUTE_SEO[_calc_base]
    _ml_calc = ML_GOLD_META.get(_calc_base, _en_calc)
    ROUTE_SEO[f"/ml{_calc_base}"] = {
        **_en_calc,
        "title": _ml_calc["title"],
        "description": _ml_calc["description"],
    }

SITEMAP_PATHS: list[tuple[str, str, str]] = [
    ("/", "daily", "1.0"),
    ("/gold-rates/kerala", "hourly", "1.0"),
    ("/ml/gold-rates/kerala", "hourly", "0.98"),
    ("/gold-calculator", "hourly", "0.97"),
    ("/ml/gold-calculator", "hourly", "0.95"),
    ("/gold-rates/india", "daily", "0.96"),
    ("/ml/gold-rates/india", "daily", "0.93"),
    # Kerala city pages (en + ml)
    *[(f"/gold-rates/{c['slug']}", "hourly", "0.92") for c in GOLD_RATE_CITIES],
    *[(f"/ml/gold-rates/{c['slug']}", "hourly", "0.90") for c in GOLD_RATE_CITIES],
    # National India city pages are reachable but omitted from sitemap (reference-only, shared rates)
    ("/jewellers", "weekly", "0.8"),
    ("/marketplace", "daily", "0.85"),
    ("/how-it-works", "monthly", "0.7"),
    ("/features", "monthly", "0.7"),
    ("/why-cridora", "monthly", "0.6"),
    ("/discover", "monthly", "0.6"),
    ("/signup", "monthly", "0.5"),
    ("/privacy", "monthly", "0.4"),
    ("/terms", "monthly", "0.4"),
    ("/disclaimer", "monthly", "0.4"),
    ("/grievance", "monthly", "0.4"),
    ("/contact", "monthly", "0.5"),
    ("/editorial-standards", "monthly", "0.5"),
]

GOLD_RATE_PATHS = frozenset(
    GOLD_RATE_BASE_PATHS | {f"/ml{p}" for p in GOLD_RATE_BASE_PATHS if p != "/gold-rates"}
)

GOLD_CALCULATOR_PATHS = frozenset(
    GOLD_CALCULATOR_BASE_PATHS | {f"/ml{p}" for p in GOLD_CALCULATOR_BASE_PATHS}
)

GOLD_RATES_OG_URL = f"{SITE_URL}/og/gold-rates.svg"
GOLD_RATES_FEED_URL = f"{SITE_URL}/feed/gold-rates.xml"


def _strip_ml_prefix(path: str) -> str:
    if path.startswith("/ml/"):
        return path[3:]
    if path == "/ml":
        return "/"
    return path


def _is_gold_rate_path(path: str) -> bool:
    return _strip_ml_prefix(_normalize_path(path)) in GOLD_RATE_BASE_PATHS


def _is_gold_calculator_path(path: str) -> bool:
    return _strip_ml_prefix(_normalize_path(path)) in GOLD_CALCULATOR_BASE_PATHS


def _needs_live_rates(path: str) -> bool:
    return _is_gold_rate_path(path) or _is_gold_calculator_path(path)


def _normalize_path(path: str) -> str:
    p = path.split("?", 1)[0].rstrip("/") or "/"
    return p


def seo_for_path(path: str) -> dict[str, str]:
    normalized = _normalize_path(path)
    return ROUTE_SEO.get(normalized, ROUTE_SEO["/"])


def inject_adsense_verification(html_doc: str, request_path: str = "/") -> str:
    """AdSense account meta on all pages; loader script only where ad slots render."""
    html_doc = re.sub(
        r'<meta\s+name=["\']google-adsense-account["\'][^>]*>\s*',
        "",
        html_doc,
        flags=re.I,
    )
    html_doc = re.sub(
        r'<script\b[^>]*pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js[^>]*>\s*</script>\s*',
        "",
        html_doc,
        flags=re.I | re.S,
    )
    snippet = adsense_meta_snippet()
    if _needs_live_rates(request_path):
        snippet += adsense_script_snippet()
    return html_doc.replace("<head>", f"<head>\n{snippet}", 1)


def ads_txt() -> str:
    pub_id = adsense_publisher_id().removeprefix("ca-pub-")
    return f"google.com, pub-{pub_id}, DIRECT, f08c47fec0942fa0\n"


def _ga4_snippet(measurement_id: str) -> str:
    safe_id = html.escape(measurement_id, quote=True)
    return (
        f'    <meta name="ga4-measurement-id" content="{safe_id}">\n'
        f'    <script async src="https://www.googletagmanager.com/gtag/js?id={safe_id}"></script>\n'
        "    <script>\n"
        "      window.dataLayer = window.dataLayer || [];\n"
        "      function gtag(){dataLayer.push(arguments);}\n"
        "      gtag('js', new Date());\n"
        f"      gtag('config', '{safe_id}', {{'send_page_view': true}});\n"
        "    </script>\n"
    )


def inject_ga4(html_doc: str, measurement_id: str) -> str:
    """Inject the GA4 gtag.js snippet once, on every page — no-op when unset."""
    if not measurement_id:
        return html_doc
    html_doc = re.sub(
        r'<!--\s*Google tag \(gtag\.js\)[^>]*-->\s*',
        "",
        html_doc,
        flags=re.I,
    )
    html_doc = re.sub(
        r'<meta\s+name=["\']ga4-measurement-id["\'][^>]*>\s*',
        "",
        html_doc,
        flags=re.I,
    )
    html_doc = re.sub(
        r'<script\b[^>]*googletagmanager\.com/gtag/js[^>]*>\s*</script>\s*'
        r'(<script>\s*window\.dataLayer[\s\S]*?</script>\s*)?',
        "",
        html_doc,
        flags=re.I,
    )
    return html_doc.replace("<head>", f"<head>\n{_ga4_snippet(measurement_id)}", 1)

def _replace_or_insert_title(html_doc: str, title: str) -> str:
    safe = html.escape(title, quote=True)
    if re.search(r"<title>[^<]*</title>", html_doc, flags=re.I):
        return re.sub(r"<title>[^<]*</title>", f"<title>{safe}</title>", html_doc, count=1, flags=re.I)
    return html_doc.replace("<head>", f"<head>\n    <title>{safe}</title>", 1)


def _replace_meta_content(html_doc: str, attr: str, key: str, content: str) -> str:
    safe = html.escape(content, quote=True)
    pattern = rf'(<meta\s+{attr}="{re.escape(key)}"\s+content=")[^"]*(")'
    if re.search(pattern, html_doc, flags=re.I):
        # Use \g<n> — plain \1{safe} breaks when safe starts with digits (e.g. 1200 → \11200).
        return re.sub(pattern, lambda m: f"{m.group(1)}{safe}{m.group(2)}", html_doc, count=1, flags=re.I)
    tag = f'    <meta {attr}="{key}" content="{safe}" />\n'
    return html_doc.replace("<head>", f"<head>\n{tag}", 1)


def _inject_link(html_doc: str, rel: str, href: str, **extra: str) -> str:
    safe_href = html.escape(href, quote=True)
    attrs = " ".join(f'{k}="{html.escape(v, quote=True)}"' for k, v in extra.items())
    attrs_str = f" {attrs}" if attrs else ""
    tag = f'    <link rel="{rel}" href="{safe_href}"{attrs_str} />\n'

    # Strip any existing <link> tag sharing the same rel (+ hreflang/type, if any),
    # regardless of its href. Without this, the static placeholder baked into
    # index.html (e.g. canonical -> homepage) survives alongside the tag we're
    # about to inject for the current path, producing duplicate/conflicting
    # canonical or hreflang tags — a real SEO/AdSense page-quality issue.
    identity_parts = [re.escape(f'rel="{rel}"')]
    for key, value in extra.items():
        identity_parts.append(re.escape(f'{key}="{html.escape(value, quote=True)}"'))
    lookahead = "".join(f"(?=[^>]*{part})" for part in identity_parts)
    stale_pattern = re.compile(r"[ \t]*<link\b" + lookahead + r"[^>]*/?>\n?")
    html_doc = stale_pattern.sub("", html_doc)

    return html_doc.replace("<head>", f"<head>\n{tag}", 1)


def _fetch_live_rates() -> dict[str, Any] | None:
    try:
        from apps.marketplace.kerala_board_history import latest_board_rates_payload

        payload = latest_board_rates_payload()
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _format_inr(value: float | int | None) -> str:
    if value is None:
        return "—"
    return f"₹{float(value):,.2f}"


def _rates_summary_html(rates: dict[str, Any] | None) -> str:
    if not rates:
        return ""
    gold = rates.get("gold") if isinstance(rates.get("gold"), dict) else {}
    silver = rates.get("silver") if isinstance(rates.get("silver"), dict) else {}
    parts = []
    if gold.get("22K") is not None:
        parts.append(f"22K gold: {_format_inr(gold.get('22K'))} per gram")
    if gold.get("24K") is not None:
        parts.append(f"24K gold: {_format_inr(gold.get('24K'))} per gram")
    if gold.get("18K") is not None:
        parts.append(f"18K gold: {_format_inr(gold.get('18K'))} per gram")
    if silver.get("999") is not None:
        parts.append(f"Silver 999: {_format_inr(silver.get('999'))} per gram")
    if not parts:
        return ""
    updated = rates.get("rate_date") or rates.get("source_updated_at") or "today"
    return (
        f"<p><strong>Live rates ({html.escape(str(updated))}):</strong> "
        f"{html.escape(' · '.join(parts))}</p>"
    )


def _prerender_heading(path: str, meta: dict[str, str]) -> str:
    base = _strip_ml_prefix(path)
    if base == "/gold-calculator":
        return "സ്വർണ്ണ കാൽക്കുലേറ്റർ" if path.startswith("/ml/") else "Gold Jewellery Calculator"
    if base.startswith("/gold-rates/") and base not in ("/gold-rates/kerala", "/gold-rates/india"):
        slug = base.rsplit("/", 1)[-1]
        city = CITY_BY_SLUG.get(slug)
        if city:
            if path.startswith("/ml/"):
                return f"{city['name_ml']} സ്വർണ്ണ വില ഇന്ന്"
            return f"{city['name']} Gold Rate Today"
    if base == "/gold-rates/kerala":
        return "കേരള സ്വർണ്ണ വില ഇന്ന്" if path.startswith("/ml/") else "Kerala Gold Rate Today"
    if base == "/gold-rates/india":
        return "ഇന്ത്യ സ്വർണ്ണ വില ഇന്ന്" if path.startswith("/ml/") else "Gold Rate in India Today"
    return meta["title"].split("—")[0].strip()


def _calculator_example_html(rates: dict[str, Any] | None) -> str:
    if not rates:
        return (
            "<p>Example: 8 g of 22K gold at today&apos;s live Kerala rate, plus making charges and GST.</p>"
        )
    gold = rates.get("gold") if isinstance(rates.get("gold"), dict) else {}
    r22 = gold.get("22K")
    if r22 is None:
        return "<p>Enter weight, purity, and making charges to estimate gold jewellery price with GST.</p>"
    metal = float(r22) * 8
    gst_gold = metal * 0.03
    total = metal + gst_gold
    return (
        f"<p><strong>Example (8 g 22K, no making charge):</strong> "
        f"metal {_format_inr(metal)} + GST on gold {_format_inr(gst_gold)} "
        f"≈ {_format_inr(total)} total at {_format_inr(r22)}/g.</p>"
    )


def _prerender_body(path: str, meta: dict[str, str], rates: dict[str, Any] | None) -> str:
    if _is_gold_calculator_path(path):
        base = _strip_ml_prefix(path)
        heading = _prerender_heading(path, meta)
        rates_html = _rates_summary_html(rates)
        example_html = _calculator_example_html(rates)
        lang = "ml-IN" if path.startswith("/ml/") else "en-IN"
        ml_link = (
            f'<p><a href="{SITE_URL}/ml{base}">Malayalam version</a></p>'
            if not path.startswith("/ml/")
            else ""
        )
        return f"""<noscript>
  <article id="seo-prerender" lang="{lang}">
    <h1>{html.escape(heading)}</h1>
    <p>{html.escape(meta["description"])}</p>
    {rates_html}
    {example_html}
    <p>Steps: enter weight → select 24K/22K/18K purity → add making charges → view GST and total.</p>
    <p><a href="{SITE_URL}/gold-rates/kerala">Live Kerala gold rates</a></p>
    {ml_link}
  </article>
</noscript>
"""
    if not _is_gold_rate_path(path):
        return ""
    base = _strip_ml_prefix(path)
    heading = _prerender_heading(path, meta)
    rates_html = _rates_summary_html(rates)
    lang = "ml-IN" if path.startswith("/ml/") else "en-IN"

    # For India city pages, link to other India cities and calculator
    slug = base.rsplit("/", 1)[-1] if "/" in base else ""
    is_india_city = slug in INDIA_CITY_BY_SLUG
    if is_india_city:
        city_data = INDIA_CITY_BY_SLUG[slug]
        city_links = " ".join(
            f'<a href="{SITE_URL}/gold-rates/{c["slug"]}">{html.escape(c["name"])} gold rate</a>'
            for c in INDIA_GOLD_RATE_CITIES[:10]
            if c["slug"] != slug
        )
        return f"""<noscript>
  <article id="seo-prerender" lang="en-IN">
    <h1>{html.escape(heading)}</h1>
    <p>{html.escape(meta["description"])}</p>
    {rates_html}
    <p>Gold rates in {html.escape(city_data["name"])}, {html.escape(city_data["state"])} — indicative India reference price based on MCX and major jeweller associations. Actual jewellery prices include making charges and GST.</p>
    <nav aria-label="Gold rate in Indian cities">{city_links}</nav>
    <p><a href="{SITE_URL}/gold-rates/india">All India gold rates</a></p>
    <p><a href="{SITE_URL}/gold-calculator">Gold jewellery calculator with GST</a></p>
  </article>
</noscript>
"""
    kerala_city_links = " ".join(
        f'<a href="{SITE_URL}/gold-rates/{c["slug"]}">{html.escape(c["name"])} gold rate</a>'
        for c in GOLD_RATE_CITIES[:8]
    )
    ml_link = f'<p><a href="{SITE_URL}/ml{base}">Malayalam version</a></p>' if not path.startswith("/ml/") else ""
    return f"""<noscript>
  <article id="seo-prerender" lang="{lang}">
    <h1>{html.escape(heading)}</h1>
    <p>{html.escape(meta["description"])}</p>
    {rates_html}
    <nav aria-label="Gold rate cities">{kerala_city_links}</nav>
    <p><a href="{SITE_URL}/gold-rates/kerala">Kerala gold rate charts and history</a></p>
    <p><a href="{SITE_URL}/gold-calculator">Gold jewellery price calculator India</a></p>
    {ml_link}
  </article>
</noscript>
"""


_COMMON_GOLD_FAQS = [
    {
        "@type": "Question",
        "name": "How often are gold rates updated on Cridora?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "Cridora refreshes live gold rates approximately every two minutes when market prices change. The Kerala board rates and MCX reference prices are polled automatically in the background.",
        },
    },
    {
        "@type": "Question",
        "name": "What is 22K (916) gold?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "22 karat gold is 91.6% pure gold — the BIS 916 hallmark standard widely used for Indian jewellery. The remaining 8.4% is typically copper or silver for added durability.",
        },
    },
    {
        "@type": "Question",
        "name": "What is the difference between 22K and 24K gold?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "24K gold is 99.9% pure gold, used for coins and bullion. 22K gold (91.6% pure) is the most popular choice for jewellery in India because it is harder and more durable than 24K. 18K gold (75% pure) is used for studded and diamond jewellery.",
        },
    },
    {
        "@type": "Question",
        "name": "What is BIS hallmark on gold?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "BIS (Bureau of Indian Standards) hallmark on gold jewellery certifies the purity of gold. The '916' hallmark denotes 22K (91.6%) gold. Hallmarking is mandatory in India for all gold jewellery above a certain weight. Always insist on BIS hallmarked gold when buying.",
        },
    },
    {
        "@type": "Question",
        "name": "How is GST calculated on gold jewellery in India?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "GST on gold jewellery in India is charged at two rates: 3% GST on the gold metal value, and 18% GST on making charges. So for a piece with ₹50,000 metal value and ₹5,000 making charges, GST = ₹1,500 (3% of gold) + ₹900 (18% of making) = ₹2,400 total.",
        },
    },
    {
        "@type": "Question",
        "name": "What is the gold rate per sovereign (8 grams)?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "One sovereign of gold equals 8 grams. Multiply today's 22K gold rate per gram by 8 to get the sovereign price. For example, if 22K gold is ₹7,200/gram, one sovereign costs ₹57,600.",
        },
    },
    {
        "@type": "Question",
        "name": "Why does the gold rate vary between cities in India?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "Gold rates across Indian cities are largely similar as they are based on MCX (Multi Commodity Exchange) prices and international LBMA rates. Minor variations occur due to local jeweller association pricing, state-level taxes, transportation costs, and demand. Kerala follows AKGSMA and Kerala Sarafa board rates, which are among the most widely followed in South India.",
        },
    },
    {
        "@type": "Question",
        "name": "Is it a good time to buy gold in India?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "Gold is a long-term store of value and a hedge against inflation in India. Experts suggest buying gold regularly (monthly) rather than trying to time the market. Festival seasons (Dhanteras, Akshay Tritiya) traditionally see high demand. Always check the live rate and buy BIS hallmarked gold from a verified jeweller.",
        },
    },
    {
        "@type": "Question",
        "name": "How do I calculate gold jewellery price with making charges?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "Gold jewellery price = (Weight in grams × Gold rate per gram) + Making charges + GST. Making charges vary from 8–25% of gold value depending on design complexity. Use the free Cridora Gold Calculator at cridoraindia.com/gold-calculator to get an instant estimate with live rates and GST.",
        },
    },
    {
        "@type": "Question",
        "name": "What factors affect gold price in India?",
        "acceptedAnswer": {
            "@type": "Answer",
            "text": "Key factors affecting India gold price: (1) International spot price on LBMA, London. (2) USD to INR exchange rate — a weaker rupee raises domestic gold price. (3) MCX trading sentiment. (4) RBI and government import duty (currently 15%). (5) Festive and wedding season demand. (6) Global economic uncertainty and geopolitical events.",
        },
    },
]


def _price_spec_blocks(rates: dict[str, Any] | None, city: str = "India") -> list[dict[str, Any]]:
    """Generate PriceSpecification schema for live gold rates — enables rich results."""
    if not rates:
        return []
    gold = rates.get("gold") if isinstance(rates.get("gold"), dict) else {}
    from datetime import date
    today = date.today().isoformat()
    blocks = []
    r22 = gold.get("22K")
    r24 = gold.get("24K")
    r18 = gold.get("18K")
    if r22 is not None:
        blocks.append({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": f"22K Gold per gram — {city}",
            "description": f"Live 22K (916 BIS hallmark) gold rate per gram in {city}. Updated every few minutes on Cridora India.",
            "category": "Precious Metal",
            "brand": {"@type": "Brand", "name": "BIS 916 Hallmark Gold"},
            "offers": {
                "@type": "Offer",
                "priceCurrency": "INR",
                "price": f"{float(r22):.2f}",
                "priceValidUntil": today,
                "availability": "https://schema.org/InStock",
                "seller": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL},
            },
        })
    if r24 is not None:
        blocks.append({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": f"24K Gold per gram — {city}",
            "description": f"Live 24K pure gold rate per gram in {city}. Updated every few minutes on Cridora India.",
            "category": "Precious Metal",
            "brand": {"@type": "Brand", "name": "24K Pure Gold"},
            "offers": {
                "@type": "Offer",
                "priceCurrency": "INR",
                "price": f"{float(r24):.2f}",
                "priceValidUntil": today,
                "availability": "https://schema.org/InStock",
                "seller": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL},
            },
        })
    if r18 is not None:
        blocks.append({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": f"18K Gold per gram — {city}",
            "description": f"Live 18K (750 hallmark) gold rate per gram in {city} on Cridora India.",
            "category": "Precious Metal",
            "offers": {
                "@type": "Offer",
                "priceCurrency": "INR",
                "price": f"{float(r18):.2f}",
                "priceValidUntil": today,
                "availability": "https://schema.org/InStock",
                "seller": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL},
            },
        })
    return blocks


def _json_ld_for_path(path: str, meta: dict[str, str], rates: dict[str, Any] | None) -> list[dict[str, Any]]:
    url = f"{SITE_URL}{path if path != '/' else '/'}"
    blocks: list[dict[str, Any]] = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": SITE_NAME,
            "url": SITE_URL,
            "logo": {"@type": "ImageObject", "url": SITE_LOGO_URL, "width": 512, "height": 512},
            "description": "Live gold rates in India (22K, 24K, 18K per gram), free gold calculator with GST, digital gold portfolio tracking, and verified jeweller platform.",
            "areaServed": {"@type": "Country", "name": "India"},
            "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer support",
                "email": "support@cridora.in",
                "areaServed": "IN",
                "availableLanguage": ["English", "Malayalam"],
            },
            "sameAs": [
                "https://www.instagram.com/cridoraindia",
                "https://www.facebook.com/cridoraindia",
                "https://twitter.com/cridoraindia",
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": SITE_NAME,
            "url": SITE_URL,
            "inLanguage": ["en-IN", "ml-IN"],
            "potentialAction": {
                "@type": "SearchAction",
                "target": f"{SITE_URL}/jewellers?q={{search_term_string}}",
                "query-input": "required name=search_term_string",
            },
        },
    ]
    if _is_gold_rate_path(path):
        base = _strip_ml_prefix(path)
        date_modified = None
        if rates:
            date_modified = rates.get("rate_date") or rates.get("source_updated_at")

        # Determine city name for PriceSpec
        city_name = "Kerala, India"
        if base.startswith("/gold-rates/") and base not in ("/gold-rates/kerala", "/gold-rates/india", "/gold-rates"):
            slug = base.rsplit("/", 1)[-1]
            if slug in INDIA_CITY_BY_SLUG:
                city_name = INDIA_CITY_BY_SLUG[slug]["name"]
            elif slug in CITY_BY_SLUG:
                city_name = f"{CITY_BY_SLUG[slug]['name']}, Kerala"
        elif base == "/gold-rates/india":
            city_name = "India"

        blocks.append(
            {
                "@context": "https://schema.org",
                "@type": "WebPage",
                "name": meta["title"],
                "description": meta["description"],
                "url": url,
                "about": {"@type": "Thing", "name": "Gold price in India"},
                **({"dateModified": str(date_modified)} if date_modified else {}),
                "datePublished": str(date_modified or "2024-01-01"),
                "inLanguage": "ml-IN" if path.startswith("/ml/") else "en-IN",
            }
        )
        blocks.append(
            {
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "headline": meta["title"].split("|")[0].strip(),
                "description": meta["description"],
                "url": url,
                "dateModified": str(date_modified or ""),
                "datePublished": str(date_modified or "2024-01-01"),
                "author": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL},
                "publisher": {
                    "@type": "Organization",
                    "name": SITE_NAME,
                    "logo": {"@type": "ImageObject", "url": SITE_LOGO_URL},
                },
                "about": {"@type": "Thing", "name": "Gold price India"},
                "keywords": meta.get("keywords", ""),
            }
        )

        # PriceSpecification — enables Google's gold price rich result
        blocks.extend(_price_spec_blocks(rates, city=city_name))

        if base in ("/gold-rates/kerala", "/gold-rates/india"):
            blocks.append(
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": _COMMON_GOLD_FAQS,
                }
            )
        elif base.startswith("/gold-rates/") and base not in ("/gold-rates/kerala", "/gold-rates/india"):
            slug = base.rsplit("/", 1)[-1]
            city_data = INDIA_CITY_BY_SLUG.get(slug) or CITY_BY_SLUG.get(slug)
            city_label = city_data["name"] if city_data else slug.title()
            extra_faq = [
                {
                    "@type": "Question",
                    "name": f"What is the gold rate in {city_label} today?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": f"Today's gold rate in {city_label} per gram is available live on Cridora India — 22K (916 BIS), 24K, and 18K. Rates are updated every few minutes from Kerala board and India reference prices.",
                    },
                },
                {
                    "@type": "Question",
                    "name": f"How is gold priced in {city_label}?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": f"Gold price in {city_label} is primarily determined by MCX (Multi Commodity Exchange) spot prices and international London Bullion Market rates, adjusted for USD/INR exchange rate and India import duty of 15%.",
                    },
                },
            ] + _COMMON_GOLD_FAQS[:5]
            blocks.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": extra_faq})

        if base == "/gold-rates/kerala":
            blocks.append(
                {
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "name": "Kerala gold rate by city",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": i + 1,
                            "name": f"{c['name']} gold rate today",
                            "url": f"{SITE_URL}/gold-rates/{c['slug']}",
                        }
                        for i, c in enumerate(GOLD_RATE_CITIES)
                    ],
                }
            )
        if base == "/gold-rates/india":
            blocks.append(
                {
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "name": "Gold rate in major Indian cities today",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": i + 1,
                            "name": f"{c['name']} gold rate today",
                            "url": f"{SITE_URL}/gold-rates/{c['slug']}",
                        }
                        for i, c in enumerate(INDIA_GOLD_RATE_CITIES[:10])
                    ],
                }
            )
    if _is_gold_calculator_path(path):
        date_modified = None
        if rates:
            date_modified = rates.get("rate_date") or rates.get("source_updated_at")
        blocks.extend(
            [
                {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "name": meta["title"],
                    "description": meta["description"],
                    "url": url,
                    "about": {"@type": "Thing", "name": "Gold jewellery price calculator India"},
                    **({"dateModified": str(date_modified)} if date_modified else {}),
                    "datePublished": str(date_modified or "2024-01-01"),
                    "inLanguage": "ml-IN" if path.startswith("/ml/") else "en-IN",
                },
                {
                    "@context": "https://schema.org",
                    "@type": "WebApplication",
                    "name": "Cridora Gold Jewellery Calculator India",
                    "url": url,
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "Any",
                    "browserRequirements": "Requires JavaScript",
                    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"},
                    "description": meta["description"],
                    "provider": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL},
                    "featureList": [
                        "Live 22K, 24K, 18K gold rates",
                        "GST calculation (3% on gold, 18% on making)",
                        "Making charges in ₹/gram or percentage",
                        "Sovereign and kilogram weight support",
                    ],
                },
                {
                    "@context": "https://schema.org",
                    "@type": "HowTo",
                    "name": "How to calculate gold jewellery price in India",
                    "description": "Use weight, purity, live gold rate, making charges, and GST to estimate ornament price.",
                    "totalTime": "PT1M",
                    "step": [
                        {"@type": "HowToStep", "name": "Enter gold weight", "text": "Enter weight in grams, sovereign (8 g), or kilograms."},
                        {"@type": "HowToStep", "name": "Select purity", "text": "Choose 24K, 22K (916 BIS), or 18K gold purity."},
                        {"@type": "HowToStep", "name": "Add making charges", "text": "Enter making charge as ₹ per gram or as a percentage of the metal value."},
                        {"@type": "HowToStep", "name": "View total with GST", "text": "See metal value, making charges, GST on gold (3%), GST on making (18%), and the estimated total price."},
                    ],
                },
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": [
                        {
                            "@type": "Question",
                            "name": "How does the Cridora gold jewellery calculator work?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "Multiply live gold rate per gram by weight to get metal value. Add making charges (₹/gram or % of metal value). Apply GST: 3% on gold metal value and 18% on making charges. The total is your estimated jewellery price.",
                            },
                        },
                        {
                            "@type": "Question",
                            "name": "How is GST calculated on gold jewellery?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "GST on gold in India: 3% on the gold metal value + 18% on making charges. For example, ₹50,000 gold + ₹5,000 making = ₹1,500 GST on gold + ₹900 GST on making = ₹2,400 total GST.",
                            },
                        },
                        {
                            "@type": "Question",
                            "name": "What is 916 BIS hallmark gold?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "916 BIS hallmark certifies the gold is 22 karat (91.6% pure). BIS hallmarking is mandatory in India for gold jewellery sold by registered jewellers.",
                            },
                        },
                        {
                            "@type": "Question",
                            "name": "How many grams is one sovereign of gold?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "One sovereign equals 8 grams of gold in India. Sovereign is a common weight unit used in Kerala and South India for gold jewellery transactions.",
                            },
                        },
                        {
                            "@type": "Question",
                            "name": "What is making charge in gold jewellery?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "Making charge is the labour cost for crafting gold jewellery, charged by jewellers as a flat ₹/gram amount or as a percentage (typically 8–25%) of the gold value. It varies by design complexity, jeweller, and city.",
                            },
                        },
                    ],
                },
            ]
        )
    return blocks


def inject_route_seo(html_doc: str, request_path: str) -> str:
    from django.conf import settings

    path = _normalize_path(request_path)
    meta = seo_for_path(path)
    base = _strip_ml_prefix(path)
    canonical = f"{SITE_URL}{path if path != '/' else '/'}"
    title = meta["title"]
    description = meta["description"]
    keywords = meta.get("keywords", DEFAULT_KEYWORDS)
    rates = _fetch_live_rates() if _needs_live_rates(path) else None
    og_image = DEFAULT_OG_IMAGE
    if _needs_live_rates(path):
        label = meta["title"].split("|")[0].strip()
        og_image = f"{GOLD_RATES_OG_URL}?label={quote(label)}"

    out = _replace_or_insert_title(html_doc, title)
    out = _replace_meta_content(out, "name", "description", description)
    out = _replace_meta_content(out, "name", "keywords", keywords)
    slug = base.rsplit("/", 1)[-1] if base.startswith("/gold-rates/") else ""
    robots = (
        "noindex, follow"
        if slug in INDIA_CITY_BY_SLUG
        else "index, follow, max-image-preview:large"
    )
    out = _replace_meta_content(out, "name", "robots", robots)

    gsc = getattr(settings, "GOOGLE_SITE_VERIFICATION", "").strip()
    if gsc:
        out = _replace_meta_content(out, "name", "google-site-verification", gsc)

    out = _replace_meta_content(out, "property", "og:title", title)
    out = _replace_meta_content(out, "property", "og:description", description)
    out = _replace_meta_content(out, "property", "og:url", canonical)
    out = _replace_meta_content(out, "property", "og:image", og_image)
    if og_image == DEFAULT_OG_IMAGE:
        out = _replace_meta_content(out, "property", "og:image:width", "1200")
        out = _replace_meta_content(out, "property", "og:image:height", "630")
        out = _replace_meta_content(out, "property", "og:image:type", "image/png")
        out = _replace_meta_content(out, "property", "og:image:alt", title)
    out = _replace_meta_content(out, "name", "twitter:image:alt", title)

    out = _replace_meta_content(out, "name", "twitter:title", title)
    out = _replace_meta_content(out, "name", "twitter:description", description)
    out = _replace_meta_content(out, "name", "twitter:image", og_image)

    out = _inject_link(out, "canonical", canonical)
    if _is_gold_rate_path(path) or _is_gold_calculator_path(path):
        en_url = f"{SITE_URL}{base}"
        ml_url = f"{SITE_URL}/ml{base}"
        out = _inject_link(out, "alternate", en_url, hreflang="en-IN")
        out = _inject_link(out, "alternate", ml_url, hreflang="ml-IN")
        out = _inject_link(out, "alternate", en_url, hreflang="x-default")
        if _is_gold_rate_path(path):
            out = _inject_link(out, "alternate", GOLD_RATES_FEED_URL, type="application/rss+xml")
    else:
        out = _inject_link(out, "alternate", canonical, hreflang="en-IN")
        out = _inject_link(out, "alternate", canonical, hreflang="ml-IN")
        out = _inject_link(out, "alternate", canonical, hreflang="x-default")

    rates_for_ld = rates if _needs_live_rates(path) else None
    for block in _json_ld_for_path(path, meta, rates_for_ld):
        script = (
            f'    <script type="application/ld+json">{json.dumps(block, ensure_ascii=False)}</script>\n'
        )
        out = out.replace("<head>", f"<head>\n{script}", 1)

    prerender = _prerender_body(path, meta, rates)
    if prerender and 'id="seo-prerender"' not in out:
        out = out.replace("<div id=\"root\"></div>", prerender + '    <div id="root"></div>', 1)

    out = inject_adsense_verification(out, path)

    ga4_id = getattr(settings, "GA4_MEASUREMENT_ID", "").strip()
    if ga4_id:
        out = inject_ga4(out, ga4_id)

    return out


def robots_txt() -> str:
    return f"""User-agent: Mediapartners-Google
Allow: /

User-agent: Google-Display-Ads-Bot
Allow: /

User-agent: *
Allow: /

Disallow: /dashboard/
Disallow: /userdashboard/
Disallow: /api/
Disallow: /admin/

Sitemap: {SITE_URL}/sitemap.xml
"""


def sitemap_xml() -> str:
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path, changefreq, priority in SITEMAP_PATHS:
        loc = f"{SITE_URL}{path if path != '/' else '/'}"
        # Live gold rate pages always show today as lastmod (content updates hourly)
        lastmod = today if changefreq in ("hourly", "daily") else "2025-01-01"
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                f"    <lastmod>{lastmod}</lastmod>",
                f"    <changefreq>{changefreq}</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def gold_rates_og_svg(label: str = "Kerala Gold Rate Today") -> str:
    rates = _fetch_live_rates()
    gold = rates.get("gold") if isinstance(rates, dict) and isinstance(rates.get("gold"), dict) else {}
    silver = rates.get("silver") if isinstance(rates, dict) and isinstance(rates.get("silver"), dict) else {}
    r22 = _format_inr(gold.get("22K"))
    r24 = _format_inr(gold.get("24K"))
    r18 = _format_inr(gold.get("18K"))
    sil = _format_inr(silver.get("999"))
    updated = ""
    if isinstance(rates, dict):
        updated = str(rates.get("rate_date") or rates.get("source_updated_at") or "")
    safe_label = html.escape(label[:80])
    safe_updated = html.escape(updated[:40])
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07090f"/>
      <stop offset="100%" stop-color="#151922"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="60" y="90" fill="#c9a840" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="700">Cridora India</text>
  <text x="60" y="160" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="46" font-weight="800">{safe_label}</text>
  <text x="60" y="220" fill="#9aa3b2" font-family="Inter,Arial,sans-serif" font-size="24">Live Kerala gold rates per gram</text>
  <text x="60" y="310" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700">22K: {html.escape(r22)}/g</text>
  <text x="60" y="370" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700">24K: {html.escape(r24)}/g</text>
  <text x="60" y="430" fill="#d1d5db" font-family="Inter,Arial,sans-serif" font-size="28">18K: {html.escape(r18)}/g · Silver: {html.escape(sil)}/g</text>
  <text x="60" y="560" fill="#6b7280" font-family="Inter,Arial,sans-serif" font-size="22">www.cridoraindia.com · Updated {safe_updated}</text>
</svg>
"""


def gold_rates_feed_xml() -> str:
    from datetime import datetime, timezone

    rates = _fetch_live_rates()
    gold = rates.get("gold") if isinstance(rates, dict) and isinstance(rates.get("gold"), dict) else {}
    r22 = gold.get("22K")
    title = f"Kerala 22K Gold Rate: {_format_inr(r22)}/gram" if r22 is not None else "Kerala Gold Rate Today"
    pub = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    desc = "Live Kerala gold and silver rates on Cridora India — 22K, 24K, 18K per gram."
    if isinstance(rates, dict):
        parts = []
        if gold.get("22K") is not None:
            parts.append(f"22K {_format_inr(gold.get('22K'))}/g")
        if gold.get("24K") is not None:
            parts.append(f"24K {_format_inr(gold.get('24K'))}/g")
        if parts:
            desc = " · ".join(parts)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cridora India — Kerala Gold Rates</title>
    <link>{SITE_URL}/gold-rates/kerala</link>
    <description>Live gold rate updates for Kerala and India</description>
    <language>en-in</language>
    <lastBuildDate>{pub}</lastBuildDate>
    <item>
      <title>{html.escape(title)}</title>
      <link>{SITE_URL}/gold-rates/kerala</link>
      <guid isPermaLink="true">{SITE_URL}/gold-rates/kerala</guid>
      <pubDate>{pub}</pubDate>
      <description>{html.escape(desc)}</description>
    </item>
  </channel>
</rss>
"""
