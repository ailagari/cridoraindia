"""Server-side SEO meta injection for SPA routes (crawler-visible HTML)."""
from __future__ import annotations

import html
import json
import re
from typing import Any
from urllib.parse import quote

SITE_URL = "https://www.cridoraindia.com"
SITE_NAME = "Cridora India"
DEFAULT_OG_IMAGE = f"{SITE_URL}/icon-512.png"
ADSENSE_PUBLISHER_ID = "ca-pub-1180208702657280"
ADSENSE_HEAD_SNIPPET = (
    f'    <meta name="google-adsense-account" content="{ADSENSE_PUBLISHER_ID}">\n'
    f'    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_PUBLISHER_ID}" '
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
}

for _city in GOLD_RATE_CITIES:
    _meta = _city_seo(_city)
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
)

for _base in sorted(GOLD_RATE_BASE_PATHS):
    if _base == "/gold-rates":
        continue
    _en = ROUTE_SEO.get(_base, ROUTE_SEO["/"])
    _ml = ML_GOLD_META.get(_base, _en)
    ROUTE_SEO[f"/ml{_base}"] = {**_en, "title": _ml["title"], "description": _ml["description"]}

SITEMAP_PATHS: list[tuple[str, str, str]] = [
    ("/", "daily", "1.0"),
    ("/gold-rates/kerala", "hourly", "1.0"),
    ("/ml/gold-rates/kerala", "hourly", "0.98"),
    ("/gold-rates/india", "daily", "0.95"),
    ("/ml/gold-rates/india", "daily", "0.93"),
    *[(f"/gold-rates/{c['slug']}", "hourly", "0.92") for c in GOLD_RATE_CITIES],
    *[(f"/ml/gold-rates/{c['slug']}", "hourly", "0.90") for c in GOLD_RATE_CITIES],
    ("/jewellers", "weekly", "0.8"),
    ("/marketplace", "daily", "0.85"),
    ("/how-it-works", "monthly", "0.7"),
    ("/features", "monthly", "0.7"),
    ("/why-cridora", "monthly", "0.6"),
    ("/discover", "monthly", "0.6"),
    ("/signup", "monthly", "0.5"),
]

GOLD_RATE_PATHS = frozenset(
    GOLD_RATE_BASE_PATHS | {f"/ml{p}" for p in GOLD_RATE_BASE_PATHS if p != "/gold-rates"}
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


def _normalize_path(path: str) -> str:
    p = path.split("?", 1)[0].rstrip("/") or "/"
    return p


def seo_for_path(path: str) -> dict[str, str]:
    normalized = _normalize_path(path)
    return ROUTE_SEO.get(normalized, ROUTE_SEO["/"])


def inject_adsense_verification(html_doc: str) -> str:
    """Place AdSense verification tags immediately after <head> (visible to crawlers)."""
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
    return html_doc.replace("<head>", f"<head>\n{ADSENSE_HEAD_SNIPPET}", 1)


def ads_txt() -> str:
    pub_id = ADSENSE_PUBLISHER_ID.removeprefix("ca-pub-")
    return f"google.com, pub-{pub_id}, DIRECT, f08c47fec0942fa0\n"

def _replace_or_insert_title(html_doc: str, title: str) -> str:
    safe = html.escape(title, quote=True)
    if re.search(r"<title>[^<]*</title>", html_doc, flags=re.I):
        return re.sub(r"<title>[^<]*</title>", f"<title>{safe}</title>", html_doc, count=1, flags=re.I)
    return html_doc.replace("<head>", f"<head>\n    <title>{safe}</title>", 1)


def _replace_meta_content(html_doc: str, attr: str, key: str, content: str) -> str:
    safe = html.escape(content, quote=True)
    pattern = rf'(<meta\s+{attr}="{re.escape(key)}"\s+content=")[^"]*(")'
    if re.search(pattern, html_doc, flags=re.I):
        return re.sub(pattern, rf"\1{safe}\2", html_doc, count=1, flags=re.I)
    tag = f'    <meta {attr}="{key}" content="{safe}" />\n'
    return html_doc.replace("<head>", f"<head>\n{tag}", 1)


def _inject_link(html_doc: str, rel: str, href: str, **extra: str) -> str:
    safe_href = html.escape(href, quote=True)
    attrs = " ".join(f'{k}="{html.escape(v, quote=True)}"' for k, v in extra.items())
    attrs_str = f" {attrs}" if attrs else ""
    tag = f'    <link rel="{rel}" href="{safe_href}"{attrs_str} />\n'
    if f'rel="{rel}" href="{safe_href}"' in html_doc:
        return html_doc
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


def _prerender_body(path: str, meta: dict[str, str], rates: dict[str, Any] | None) -> str:
    if not _is_gold_rate_path(path):
        return ""
    base = _strip_ml_prefix(path)
    heading = _prerender_heading(path, meta)
    rates_html = _rates_summary_html(rates)
    lang = "ml-IN" if path.startswith("/ml/") else "en-IN"
    city_links = " ".join(
        f'<a href="{SITE_URL}/gold-rates/{c["slug"]}">{html.escape(c["name"])} gold rate</a>'
        for c in GOLD_RATE_CITIES[:8]
    )
    ml_link = f'<p><a href="{SITE_URL}/ml{base}">Malayalam version</a></p>' if not path.startswith("/ml/") else ""
    return f"""<noscript>
  <article id="seo-prerender" lang="{lang}">
    <h1>{html.escape(heading)}</h1>
    <p>{html.escape(meta["description"])}</p>
    {rates_html}
    <nav aria-label="Gold rate cities">{city_links}</nav>
    <p><a href="{SITE_URL}/gold-rates/kerala">Kerala gold rate charts and history</a></p>
    {ml_link}
  </article>
</noscript>
"""


def _json_ld_for_path(path: str, meta: dict[str, str], rates: dict[str, Any] | None) -> list[dict[str, Any]]:
    url = f"{SITE_URL}{path if path != '/' else '/'}"
    blocks: list[dict[str, Any]] = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": SITE_NAME,
            "url": SITE_URL,
            "logo": DEFAULT_OG_IMAGE,
        },
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": SITE_NAME,
            "url": SITE_URL,
            "inLanguage": ["en-IN", "ml-IN"],
        },
    ]
    if _is_gold_rate_path(path):
        base = _strip_ml_prefix(path)
        date_modified = None
        if rates:
            date_modified = rates.get("rate_date") or rates.get("source_updated_at")
        blocks.append(
            {
                "@context": "https://schema.org",
                "@type": "WebPage",
                "name": meta["title"],
                "description": meta["description"],
                "url": url,
                "about": {"@type": "Thing", "name": "Gold price in Kerala, India"},
                **({"dateModified": str(date_modified)} if date_modified else {}),
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
                "author": {"@type": "Organization", "name": SITE_NAME},
                "publisher": {
                    "@type": "Organization",
                    "name": SITE_NAME,
                    "logo": {"@type": "ImageObject", "url": DEFAULT_OG_IMAGE},
                },
            }
        )
        if base in ("/gold-rates/kerala", "/gold-rates/india"):
            blocks.append(
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": [
                        {
                            "@type": "Question",
                            "name": "How often are Kerala gold rates updated?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "Live rates refresh about every two minutes when prices change.",
                            },
                        },
                        {
                            "@type": "Question",
                            "name": "What is 22K (916) gold?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": "22 karat gold is 91.6% pure — the BIS 916 hallmark standard used for most Indian jewellery.",
                            },
                        },
                    ],
                }
            )
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
    rates = _fetch_live_rates() if _is_gold_rate_path(path) else None
    og_image = DEFAULT_OG_IMAGE
    if _is_gold_rate_path(path):
        label = meta["title"].split("|")[0].strip()
        og_image = f"{GOLD_RATES_OG_URL}?label={quote(label)}"

    out = _replace_or_insert_title(html_doc, title)
    out = _replace_meta_content(out, "name", "description", description)
    out = _replace_meta_content(out, "name", "keywords", keywords)
    out = _replace_meta_content(out, "name", "robots", "index, follow, max-image-preview:large")

    gsc = getattr(settings, "GOOGLE_SITE_VERIFICATION", "").strip()
    if gsc:
        out = _replace_meta_content(out, "name", "google-site-verification", gsc)

    out = _replace_meta_content(out, "property", "og:title", title)
    out = _replace_meta_content(out, "property", "og:description", description)
    out = _replace_meta_content(out, "property", "og:url", canonical)
    out = _replace_meta_content(out, "property", "og:image", og_image)

    out = _replace_meta_content(out, "name", "twitter:title", title)
    out = _replace_meta_content(out, "name", "twitter:description", description)
    out = _replace_meta_content(out, "name", "twitter:image", og_image)

    out = _inject_link(out, "canonical", canonical)
    if _is_gold_rate_path(path):
        en_url = f"{SITE_URL}{base}"
        ml_url = f"{SITE_URL}/ml{base}"
        out = _inject_link(out, "alternate", en_url, hreflang="en-IN")
        out = _inject_link(out, "alternate", ml_url, hreflang="ml-IN")
        out = _inject_link(out, "alternate", en_url, hreflang="x-default")
        out = _inject_link(out, "alternate", GOLD_RATES_FEED_URL, type="application/rss+xml")
    else:
        out = _inject_link(out, "alternate", canonical, hreflang="en-IN")
        out = _inject_link(out, "alternate", canonical, hreflang="ml-IN")
        out = _inject_link(out, "alternate", canonical, hreflang="x-default")

    rates_for_ld = rates if _is_gold_rate_path(path) else None
    for block in _json_ld_for_path(path, meta, rates_for_ld):
        script = (
            f'    <script type="application/ld+json">{json.dumps(block, ensure_ascii=False)}</script>\n'
        )
        out = out.replace("<head>", f"<head>\n{script}", 1)

    prerender = _prerender_body(path, meta, rates)
    if prerender and 'id="seo-prerender"' not in out:
        out = out.replace("<div id=\"root\"></div>", prerender + '    <div id="root"></div>', 1)

    return inject_adsense_verification(out)


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
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path, changefreq, priority in SITEMAP_PATHS:
        loc = f"{SITE_URL}{path if path != '/' else '/'}"
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
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
