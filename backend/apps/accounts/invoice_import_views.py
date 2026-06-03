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

_EXTRACT_PROMPT = """You extract gold jewellery purchase details from invoice images (photos, PDF scans, screenshots).
Indian invoices may use English, Malayalam, Tamil, Hindi, or mixed text.

If the image is too blurry, cropped, or unreadable to extract fields reliably, respond with ONLY this JSON:
{"is_legible": false, "reason": "brief explanation"}

Otherwise respond with ONLY this JSON (no markdown):
{
  "is_legible": true,
  "title": "short item name",
  "category": "ornament|coin|bar|other",
  "weight_grams": number or null,
  "purity": "e.g. BIS 916, 22K, 24K",
  "purchase_date": "YYYY-MM-DD or null",
  "purchase_source": "shop or jeweller name or empty string",
  "purchase_price_inr_per_gram": number or null,
  "invoice_number": "string or null",
  "confidence": "high|medium|low"
}
"""

_VALID_CATEGORIES = {c[0] for c in PersonalGoldHolding.CATEGORY_CHOICES}
_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _max_upload_bytes() -> int:
    return int(getattr(settings, "PERSONAL_HOLDING_MAX_UPLOAD_BYTES", 8 * 1024 * 1024))


def _file_ext(name: str) -> str:
    lower = (name or "").lower().strip()
    dot = lower.rfind(".")
    return lower[dot:] if dot >= 0 else ""


def _pdf_first_page_jpeg(pdf_bytes: bytes) -> bytes:
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if doc.page_count < 1:
        doc.close()
        raise ValueError("PDF has no pages.")
    page = doc[0]
    pix = page.get_pixmap(dpi=200)
    jpeg = pix.tobytes("jpeg")
    doc.close()
    return jpeg


def _image_mime_and_bytes(uploaded) -> tuple[str, bytes]:
    name = uploaded.name or "upload"
    ext = _file_ext(name)
    raw = uploaded.read()
    if ext == ".pdf":
        return "image/jpeg", _pdf_first_page_jpeg(raw)
    mime = _MIME_BY_EXT.get(ext, "image/jpeg")
    return mime, raw


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


def _normalize_extracted(data: dict) -> dict:
    out: dict = {"is_legible": bool(data.get("is_legible"))}
    if not out["is_legible"]:
        out["reason"] = str(data.get("reason") or "Image is not clear enough.").strip()[:500]
        return out

    title = str(data.get("title") or "").strip()[:255]
    cat = str(data.get("category") or "ornament").strip().lower()
    if cat not in _VALID_CATEGORIES:
        cat = "other"

    weight_raw = data.get("weight_grams")
    weight_s = ""
    if weight_raw is not None and str(weight_raw).strip():
        try:
            wg = Decimal(str(weight_raw))
            if wg > 0:
                weight_s = str(wg.quantize(Decimal("0.000001")))
        except (InvalidOperation, ValueError):
            weight_s = ""

    purity = str(data.get("purity") or "BIS 916").strip()[:64] or "BIS 916"
    purchase_source = str(data.get("purchase_source") or "").strip()[:512]
    invoice_number = str(data.get("invoice_number") or "").strip()[:120]
    purchase_date = None
    pd_raw = data.get("purchase_date")
    if pd_raw not in (None, "", "null"):
        pd_s = str(pd_raw).strip()[:10]
        if len(pd_s) >= 10:
            purchase_date = pd_s[:10]

    pp_s = ""
    pp_raw = data.get("purchase_price_inr_per_gram")
    if pp_raw is not None and str(pp_raw).strip():
        try:
            pp = Decimal(str(pp_raw))
            if pp >= 0:
                pp_s = str(pp.quantize(Decimal("0.0001")))
        except (InvalidOperation, ValueError):
            pp_s = ""

    conf = str(data.get("confidence") or "medium").strip().lower()
    if conf not in ("high", "medium", "low"):
        conf = "medium"

    out.update(
        {
            "is_legible": True,
            "title": title,
            "category": cat,
            "weight_grams": weight_s,
            "purity": purity,
            "purchase_date": purchase_date,
            "purchase_source": purchase_source,
            "purchase_price_inr_per_gram": pp_s or None,
            "invoice_number": invoice_number or None,
            "confidence": conf,
        }
    )
    return out


def _call_gemini_vision(mime_type: str, image_bytes: bytes) -> dict:
    import google.generativeai as genai

    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        raise RuntimeError("not_configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(
        [
            _EXTRACT_PROMPT,
            {"mime_type": mime_type, "data": image_bytes},
        ],
        generation_config={"temperature": 0.1, "response_mime_type": "application/json"},
    )
    text = getattr(response, "text", None) or ""
    if not text and response.candidates:
        parts = response.candidates[0].content.parts
        text = "".join(getattr(p, "text", "") or "" for p in parts)
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
            mime, img_bytes = _image_mime_and_bytes(f)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {"detail": "Could not read file. Try a clearer photo or PDF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not img_bytes:
            return Response({"detail": "Empty file."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            extracted = _call_gemini_vision(mime, img_bytes)
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
