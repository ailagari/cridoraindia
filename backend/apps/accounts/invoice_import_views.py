"""Smart Gold Invoice Import — analyze invoice image/PDF via Gemini Vision."""

from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PersonalGoldHolding
from apps.accounts.services.personal_holdings import validate_document_upload

User = get_user_model()

_EXTRACT_PROMPT = """You extract gold jewellery purchase details from Indian jeweller invoices (photos, PDF scans, screenshots).
Text may be English, Malayalam (മലയാളം), Tamil, Hindi, or mixed.

IMPORTANT RULES:
1. Read the FULL document including item tables, line-item rows, totals, and headers.
2. If the bill lists MULTIPLE gold items (table with rows), return ONE entry per gold item in "items".
   Skip non-gold rows (service charges, old gold exchange, cash discount, GST summary-only lines).
3. For each item use the row's net/gross weight in grams (ഗ്രാം, gms, g, wt). Prefer net weight when both exist.
4. Map item type: necklace/ring/bangle/chain/earring/pendant → ornament; coin → coin; bar/ingot → bar; else other.
5. Purity: normalize to BIS 916, 22K, 24K, 18K, etc. Default BIS 916 when invoice says 22K/916.
6. Price: if line shows amount/total for that row use price_mode "total" + purchase_total_inr.
   If only gold rate per gram is shown use price_mode "rate" + purchase_price_inr_per_gram.
   Extract making charge % (MC, VA, wastage, making) when visible per row or bill-wide.
7. Shop name, invoice date, invoice/bill number belong at the top level (shared across items).
8. Use null for fields you cannot read — do NOT guess weights or prices.
9. Set confidence per item: high = clear row match, medium = partial, low = inferred/unclear.

If too blurry, cropped, or unreadable:
{"is_legible": false, "reason": "brief explanation"}

Otherwise respond with ONLY this JSON (no markdown):
{
  "is_legible": true,
  "purchase_date": "YYYY-MM-DD or null",
  "purchase_source": "shop or jeweller name or empty string",
  "invoice_number": "string or null",
  "confidence": "high|medium|low",
  "items": [
    {
      "title": "short item name e.g. Gold Chain, 22K Ring",
      "category": "ornament|coin|bar|other",
      "weight_grams": number or null,
      "purity": "e.g. BIS 916, 22K, 24K",
      "price_mode": "rate|total",
      "purchase_price_inr_per_gram": number or null,
      "purchase_total_inr": number or null,
      "making_charge_percent": number or null,
      "confidence": "high|medium|low"
    }
  ]
}
"""

_VALID_CATEGORIES = {c[0] for c in PersonalGoldHolding.CATEGORY_CHOICES}
_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
_PDF_MAX_PAGES = 3


def _max_upload_bytes() -> int:
    return int(getattr(settings, "PERSONAL_HOLDING_MAX_UPLOAD_BYTES", 8 * 1024 * 1024))


def _gemini_model_name() -> str:
    return (getattr(settings, "GEMINI_INVOICE_MODEL", None) or "gemini-2.0-flash").strip()


def _file_ext(name: str) -> str:
    lower = (name or "").lower().strip()
    dot = lower.rfind(".")
    return lower[dot:] if dot >= 0 else ""


def _pdf_pages_jpeg(pdf_bytes: bytes, max_pages: int = _PDF_MAX_PAGES) -> list[bytes]:
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.page_count < 1:
        doc.close()
        raise ValueError("PDF has no pages.")
    pages: list[bytes] = []
    for i in range(min(doc.page_count, max_pages)):
        pix = doc[i].get_pixmap(dpi=200)
        pages.append(pix.tobytes("jpeg"))
    doc.close()
    return pages


def _upload_images(uploaded) -> list[tuple[str, bytes]]:
    name = uploaded.name or "upload"
    ext = _file_ext(name)
    raw = uploaded.read()
    if ext == ".pdf":
        return [("image/jpeg", page) for page in _pdf_pages_jpeg(raw)]
    mime = _MIME_BY_EXT.get(ext, "image/jpeg")
    return [(mime, raw)]


def _parse_json_from_model_text(text: str) -> dict | None:
    t = (text or "").strip()
    if not t:
        return None
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        start = t.find("{")
        end = t.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(t[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _parse_decimal(raw, *, min_value: Decimal | None = None, places: str = "0.0001") -> str:
    if raw is None or not str(raw).strip():
        return ""
    try:
        val = Decimal(str(raw))
        if min_value is not None and val < min_value:
            return ""
        return str(val.quantize(Decimal(places)))
    except (InvalidOperation, ValueError):
        return ""


def _parse_weight(raw) -> str:
    return _parse_decimal(raw, min_value=Decimal("0"), places="0.000001")


def _parse_date(raw) -> str | None:
    if raw in (None, "", "null"):
        return None
    pd_s = str(raw).strip()[:10]
    if len(pd_s) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", pd_s):
        return pd_s[:10]
    return None


def _normalize_confidence(raw, default: str = "medium") -> str:
    conf = str(raw or default).strip().lower()
    if conf not in ("high", "medium", "low"):
        return default
    return conf


def _item_missing_fields(item: dict) -> list[str]:
    missing: list[str] = []
    if not (item.get("title") or "").strip():
        missing.append("title")
    if not (item.get("weight_grams") or "").strip():
        missing.append("weight_grams")
    has_rate = bool((item.get("purchase_price_inr_per_gram") or "").strip())
    has_total = bool((item.get("purchase_total_inr") or "").strip())
    if not has_rate and not has_total:
        missing.append("purchase_price")
    return missing


def _normalize_item(raw: dict) -> dict:
    title = str(raw.get("title") or "").strip()[:255]
    cat = str(raw.get("category") or "ornament").strip().lower()
    if cat not in _VALID_CATEGORIES:
        cat = "other"

    weight_s = _parse_weight(raw.get("weight_grams"))
    purity = str(raw.get("purity") or "BIS 916").strip()[:64] or "BIS 916"

    pp_s = _parse_decimal(raw.get("purchase_price_inr_per_gram"), min_value=Decimal("0"))
    total_s = _parse_decimal(raw.get("purchase_total_inr"), min_value=Decimal("0"), places="0.01")
    mc_s = _parse_decimal(raw.get("making_charge_percent"), min_value=Decimal("0"), places="0.01")

    price_mode = str(raw.get("price_mode") or "").strip().lower()
    if price_mode not in ("rate", "total"):
        price_mode = "total" if total_s else "rate"

    item = {
        "title": title,
        "category": cat,
        "weight_grams": weight_s,
        "purity": purity,
        "price_mode": price_mode,
        "purchase_price_inr_per_gram": pp_s or None,
        "purchase_total_inr": total_s or None,
        "making_charge_percent": mc_s or None,
        "confidence": _normalize_confidence(raw.get("confidence")),
    }
    item["missing_fields"] = _item_missing_fields(item)
    return item


def _legacy_single_item(data: dict) -> list[dict]:
    """Convert old single-item model output to items list."""
    return [
        {
            "title": data.get("title"),
            "category": data.get("category"),
            "weight_grams": data.get("weight_grams"),
            "purity": data.get("purity"),
            "price_mode": "rate" if data.get("purchase_price_inr_per_gram") else "total",
            "purchase_price_inr_per_gram": data.get("purchase_price_inr_per_gram"),
            "purchase_total_inr": data.get("purchase_total_inr"),
            "making_charge_percent": data.get("making_charge_percent"),
            "confidence": data.get("confidence"),
        }
    ]


def _normalize_extracted(data: dict) -> dict:
    out: dict = {"is_legible": bool(data.get("is_legible"))}
    if not out["is_legible"]:
        out["reason"] = str(data.get("reason") or "Image is not clear enough.").strip()[:500]
        return out

    raw_items = data.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raw_items = _legacy_single_item(data)

    items = [_normalize_item(it) for it in raw_items if isinstance(it, dict)]
    if not items:
        return {"is_legible": False, "reason": "No gold items found on this bill."}

    purchase_source = str(data.get("purchase_source") or "").strip()[:512]
    invoice_number = str(data.get("invoice_number") or "").strip()[:120]
    purchase_date = _parse_date(data.get("purchase_date"))
    conf = _normalize_confidence(data.get("confidence"))

    out.update(
        {
            "is_legible": True,
            "purchase_date": purchase_date,
            "purchase_source": purchase_source,
            "invoice_number": invoice_number or None,
            "confidence": conf,
            "items": items,
            "item_count": len(items),
        }
    )
    return out


def _call_gemini_vision(images: list[tuple[str, bytes]]) -> dict:
    import google.generativeai as genai

    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        raise RuntimeError("not_configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(_gemini_model_name())
    parts: list = [_EXTRACT_PROMPT]
    for mime_type, image_bytes in images:
        parts.append({"mime_type": mime_type, "data": image_bytes})
    if len(images) > 1:
        parts.append(
            f"This invoice has {len(images)} page(s). Combine information from all pages into one response."
        )

    response = model.generate_content(
        parts,
        generation_config={"temperature": 0.1, "response_mime_type": "application/json"},
    )
    text = getattr(response, "text", None) or ""
    if not text and response.candidates:
        content_parts = response.candidates[0].content.parts
        text = "".join(getattr(p, "text", "") or "" for p in content_parts)
    parsed = _parse_json_from_model_text(text)
    if not parsed:
        raise ValueError("Could not parse model response.")
    return _normalize_extracted(parsed)


class InvoiceImportAnalyzeView(APIView):
    """POST multipart file — returns extracted fields; does not create holdings."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)

        api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
        if not api_key:
            return Response(
                {"detail": "Invoice import not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file required."}, status=status.HTTP_400_BAD_REQUEST)

        max_b = _max_upload_bytes()
        err = validate_document_upload(filename=f.name, size_bytes=f.size or 0, max_bytes=max_b)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        try:
            images = _upload_images(f)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"detail": "Could not read file. Try a clearer photo or PDF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not images or not any(img[1] for img in images):
            return Response({"detail": "Empty file."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            extracted = _call_gemini_vision(images)
        except RuntimeError:
            return Response(
                {"detail": "Invoice import not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            return Response(
                {"detail": "Could not analyze invoice. Try again or enter details manually."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not extracted.get("is_legible"):
            return Response(
                {
                    "is_legible": False,
                    "reason": extracted.get("reason") or "Image is not clear enough.",
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        return Response(extracted)
