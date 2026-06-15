"""Personal holdings & gold records vault APIs."""

from __future__ import annotations

import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import (
    PersonalGoldHolding,
    PersonalHoldingDocument,
    PersonalPortfolioAuditLog,
    PortfolioUserNotification,
)
from apps.accounts.services.personal_holdings import (
    admin_personal_vault_user_summaries,
    calculate_holding_value_inr,
    customer_personal_holdings_qs,
    customer_portfolio_ledger_payload,
    normalize_phone_digits,
    reference_gold_rate_inr_per_gram,
    validate_document_upload,
)
from apps.accounts.services.customer_active_gold_ledger import customer_active_gold_ledger_payload
from apps.accounts.services.personal_holdings_audit import log_personal_portfolio_action
from apps.accounts.services.media_storage import delete_filefield
from apps.accounts.services.portfolio_user_notify import create_portfolio_notification
from apps.accounts.services.personal_vault_billing import (
    personal_vault_bill_breakdown,
    resolve_purchase_price_inr_per_gram,
)
from apps.marketplace.gold_billing import effective_gst_on_gold_percent, effective_gst_on_making_percent

User = get_user_model()


def _max_upload_bytes() -> int:
    return int(getattr(settings, "PERSONAL_HOLDING_MAX_UPLOAD_BYTES", 8 * 1024 * 1024))


def _parse_purchase_price_inr_per_gram_field(raw) -> tuple[Decimal | None, str | None]:
    """Return (quantized value, error_detail). None value with no error means clear field."""
    if raw in (None, "", "null"):
        return None, None
    try:
        pp = Decimal(str(raw))
    except Exception:
        return None, "Invalid purchase_price_inr_per_gram."
    if pp < 0:
        return None, "purchase_price_inr_per_gram must be >= 0."
    return pp.quantize(Decimal("0.0001")), None


def _parse_making_charge_percent_field(raw) -> tuple[Decimal | None, str | None]:
    """Return (quantized value, error_detail). None value with no error means clear field."""
    if raw in (None, "", "null"):
        return None, None
    try:
        mc = Decimal(str(raw))
    except Exception:
        return None, "Invalid making_charge_percent."
    if mc < 0:
        return None, "making_charge_percent must be >= 0."
    if mc > 100:
        return None, "making_charge_percent cannot exceed 100."
    return mc.quantize(Decimal("0.01")), None


def _parse_purchase_total_inr_field(raw) -> tuple[Decimal | None, str | None]:
    if raw in (None, "", "null"):
        return None, None
    try:
        total = Decimal(str(raw))
    except Exception:
        return None, "Invalid purchase_total_inr."
    if total <= 0:
        return None, "purchase_total_inr must be greater than 0."
    return total.quantize(Decimal("0.01")), None


def _resolve_holding_purchase_fields(
    *,
    weight_grams: Decimal,
    purchase_price_inr_per_gram_raw,
    purchase_total_inr_raw,
    making_charge_percent: Decimal | None,
) -> tuple[Decimal | None, str | None]:
    purchase_total_inr = None
    if purchase_total_inr_raw not in (None, "", "null"):
        purchase_total_inr, terr = _parse_purchase_total_inr_field(purchase_total_inr_raw)
        if terr:
            return None, terr

    purchase_price_inr_per_gram = None
    if purchase_price_inr_per_gram_raw not in (None, "", "null"):
        purchase_price_inr_per_gram, perr = _parse_purchase_price_inr_per_gram_field(
            purchase_price_inr_per_gram_raw
        )
        if perr:
            return None, perr

    resolved = resolve_purchase_price_inr_per_gram(
        weight_grams=weight_grams,
        purchase_price_inr_per_gram=purchase_price_inr_per_gram,
        purchase_total_inr=purchase_total_inr,
        making_charge_percent=making_charge_percent,
    )
    return resolved, None


def _recalc_holding_inr(h: PersonalGoldHolding) -> None:
    rate, _ = reference_gold_rate_inr_per_gram()
    h.estimated_current_value_inr = calculate_holding_value_inr(h.weight_grams, rate)


def _jeweller_label(u: User) -> str:
    return (u.business_name or u.email or "").strip()


def _holding_detail_dict(
    h: PersonalGoldHolding,
    *,
    include_documents: bool,
) -> dict:
    jeweller_name = ""
    purchase_jeweller_label = ""
    if h.jeweller_id:
        j = h.jeweller
        jeweller_name = _jeweller_label(j)
        purchase_jeweller_label = f"Purchased From {jeweller_name}"
    rate, _ = reference_gold_rate_inr_per_gram()
    live_inr = calculate_holding_value_inr(h.weight_grams, rate)
    doc_count = h.document_count if hasattr(h, "document_count") else None
    if doc_count is None:
        doc_count = h.documents.filter(is_removed=False).count()

    basis = None
    if h.purchase_price_inr_per_gram is not None:
        basis = (h.weight_grams * h.purchase_price_inr_per_gram).quantize(Decimal("0.01"))
    gain_inr_s = ""
    gain_pct_s = ""
    if basis is not None and basis > 0:
        gain_inr_s = str((live_inr - basis).quantize(Decimal("0.01")))
        gain_pct_s = str(((live_inr - basis) / basis * Decimal("100")).quantize(Decimal("0.01")))

    status_map = {
        PersonalGoldHolding.SELF_DECLARED: "Self Declared",
        PersonalGoldHolding.JEWELLER_ADDED: "Added by Jeweller",
        PersonalGoldHolding.VERIFIED: "Verified",
    }
    cp_bills = list(h.cridorapay_bills.all()) if hasattr(h, "cridorapay_bills") else []
    cp = cp_bills[0] if cp_bills else None
    if cp is None and not hasattr(h, "_prefetched_objects_cache"):
        from apps.accounts.models import CridoraPayBill

        cp = CridoraPayBill.objects.filter(personal_holding=h).only("id", "reference").first()
    status_badge = status_map.get(h.verification_status, h.verification_status)
    if cp is not None:
        status_badge = "CridoraPay purchase"
    out = {
        "id": h.id,
        "holding_type": h.holding_type,
        "title": h.title,
        "category": h.category,
        "weight_grams": str(h.weight_grams),
        "purity": h.purity,
        "purchase_date": h.purchase_date.isoformat() if h.purchase_date else None,
        "purchase_source": h.purchase_source or "",
        "purchase_price_inr_per_gram": (
            str(h.purchase_price_inr_per_gram) if h.purchase_price_inr_per_gram is not None else None
        ),
        "making_charge_percent": (
            str(h.making_charge_percent) if h.making_charge_percent is not None else None
        ),
        "purchase_total_inr": (
            str(h.purchase_total_inr.quantize(Decimal("0.01")))
            if h.purchase_total_inr is not None
            else None
        ),
        "purchase_cost_basis_inr": str(basis) if basis is not None else "",
        "reference_gain_inr": gain_inr_s,
        "reference_gain_percent": gain_pct_s,
        "estimated_current_value_inr": str(live_inr),
        "is_self_declared": h.is_self_declared,
        "verification_status": h.verification_status,
        "status_badge": status_badge,
        "is_cridorapay": cp is not None,
        "corridorapay_reference": cp.reference if cp else "",
        "created_by_type": h.created_by_type,
        "created_by_id": h.created_by_id,
        "jeweller_id": h.jeweller_id,
        "jeweller_name": jeweller_name,
        "purchase_jeweller_label": purchase_jeweller_label,
        "notes": h.notes or "",
        "document_count": doc_count,
        "created_at": h.created_at.isoformat(),
        "updated_at": h.updated_at.isoformat(),
        "mvp_note": "Tracking & Records Only in MVP — not transferable, redeemable, loan, sellback, or emergency fund.",
    }
    if include_documents:
        docs = []
        for d in h.documents.filter(is_removed=False).order_by("-created_at")[:40]:
            docs.append(_document_dict(d))
        out["documents"] = docs

    mc = h.making_charge_percent if h.making_charge_percent is not None else Decimal("0")
    bill_kwargs: dict = {"making_charge_percent": mc}
    if h.purchase_total_inr is not None and h.purchase_total_inr > 0:
        bill_kwargs["purchase_total_inr"] = h.purchase_total_inr
    elif h.purchase_price_inr_per_gram is not None and h.purchase_price_inr_per_gram > 0:
        bill_kwargs["metal_rate_inr_per_gram"] = h.purchase_price_inr_per_gram
    bill = personal_vault_bill_breakdown(h.weight_grams, **bill_kwargs)
    if bill:
        out["purchase_bill_breakdown"] = {
            "metal_inr": bill["metal_inr"],
            "making_inr": bill["making_inr"],
            "gst_on_gold_inr": bill["gst_on_gold_inr"],
            "gst_on_making_inr": bill["gst_on_making_inr"],
            "purchase_total_inr": bill["purchase_total_inr"],
            "metal_rate_inr_per_gram": bill["metal_rate_inr_per_gram"],
            "gst_on_gold_percent": str(effective_gst_on_gold_percent()),
            "gst_on_making_percent": str(effective_gst_on_making_percent()),
        }
    else:
        out["purchase_bill_breakdown"] = None

    return out


def _document_dict(d: PersonalHoldingDocument) -> dict:
    return {
        "id": d.id,
        "document_type": d.document_type,
        "original_filename": d.original_filename or "",
        "invoice_number": d.invoice_number or "",
        "document_title": d.document_title or "",
        "remarks": d.remarks or "",
        "uploaded_by_type": d.uploaded_by_type,
        "uploaded_by_id": d.uploaded_by_id,
        "created_at": d.created_at.isoformat(),
        "mime_hint": d.original_filename.rsplit(".", 1)[-1].lower() if d.original_filename else "",
    }


def _can_access_holding(user: User, h: PersonalGoldHolding) -> bool:
    if not user.is_authenticated:
        return False
    if user.user_type == User.ADMIN or user.is_superuser:
        return True
    if h.user_id == user.id:
        return True
    if user.user_type == User.JEWELLER and h.jeweller_id == user.id:
        return True
    return False


def _can_mutate_holding_customer(user: User, h: PersonalGoldHolding) -> bool:
    return user.user_type == User.CUSTOMER and h.user_id == user.id and not h.is_removed


class CustomerPortfolioLedgerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        lf = (request.query_params.get("filter") or "all").strip()
        return Response(customer_portfolio_ledger_payload(request.user, ledger_filter=lf))


class CustomerActiveGoldLedgerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        return Response(customer_active_gold_ledger_payload(request.user))


class PortfolioUserNotificationsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit") or 40)
        except ValueError:
            limit = 40
        limit = max(1, min(limit, 100))
        qs = (
            PortfolioUserNotification.objects.filter(user=request.user, read_at__isnull=True)
            .order_by("-created_at")[:limit]
        )
        rows = [
            {
                "id": n.id,
                "kind": n.kind,
                "title": n.title,
                "body": n.body,
                "link_path": n.link_path,
                "read_at": None,
                "created_at": n.created_at.isoformat(),
            }
            for n in qs
        ]
        unread = len(rows)
        return Response({"results": rows, "unread_count": unread})


class PersonalVaultDocumentsListView(APIView):
    """Recent documents across all personal holdings (single query)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            limit = int(request.query_params.get("limit") or 60)
        except ValueError:
            limit = 60
        limit = max(1, min(limit, 120))
        qs = (
            PersonalHoldingDocument.objects.filter(
                holding__user=request.user,
                holding__is_removed=False,
                is_removed=False,
            )
            .select_related("holding")
            .order_by("-created_at")[:limit]
        )
        rows = []
        for d in qs:
            rows.append(
                {
                    **_document_dict(d),
                    "holding_id": d.holding_id,
                    "holding_title": d.holding.title,
                }
            )
        return Response({"results": rows})


class PortfolioUserNotificationsMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.services.notification_ack import ack_portfolio_notifications

        mark_all = bool(request.data.get("all"))
        ids = request.data.get("notification_ids")
        if not mark_all and not (isinstance(ids, list) and ids):
            return Response(
                {"detail": "Provide notification_ids (array) or all=true."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        id_list = None
        if isinstance(ids, list):
            id_list = []
            for x in ids[:200]:
                try:
                    id_list.append(int(x))
                except (TypeError, ValueError):
                    continue
        deleted = ack_portfolio_notifications(
            request.user,
            notification_ids=id_list,
            mark_all=mark_all,
        )
        return Response({"ok": True, "deleted": deleted})


class PersonalHoldingsListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = customer_personal_holdings_qs(request.user)
        inc_docs = str(request.query_params.get("documents") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        if inc_docs:
            qs = qs.prefetch_related(
                Prefetch(
                    "documents",
                    queryset=PersonalHoldingDocument.objects.filter(is_removed=False).order_by(
                        "-created_at"
                    ),
                )
            )
        return Response(
            {
                "results": [_holding_detail_dict(h, include_documents=inc_docs) for h in qs],
                "reference_gold_inr_per_gram_22k": str(reference_gold_rate_inr_per_gram()[0].quantize(Decimal("0.01"))),
            }
        )

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        title = (request.data.get("title") or "").strip()
        category = (request.data.get("category") or "").strip().lower()
        if not title:
            return Response({"detail": "Title required."}, status=status.HTTP_400_BAD_REQUEST)
        valid_cat = {c[0] for c in PersonalGoldHolding.CATEGORY_CHOICES}
        if category not in valid_cat:
            return Response({"detail": "Invalid category."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            weight_grams = Decimal(str(request.data.get("weight_grams") or "0"))
        except Exception:
            return Response({"detail": "Invalid weight."}, status=status.HTTP_400_BAD_REQUEST)
        if weight_grams <= 0:
            return Response({"detail": "Grams must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
        purity = (request.data.get("purity") or "BIS 916").strip()[:64]
        if not purity:
            purity = "BIS 916"
        purchase_source = (request.data.get("purchase_source") or "").strip()[:512]
        notes = (request.data.get("notes") or "").strip()
        making_charge_percent = None
        if request.data.get("making_charge_percent") not in (None, "", "null"):
            making_charge_percent, merr = _parse_making_charge_percent_field(
                request.data.get("making_charge_percent")
            )
            if merr:
                return Response({"detail": merr}, status=status.HTTP_400_BAD_REQUEST)
        purchase_total_inr = None
        if request.data.get("purchase_total_inr") not in (None, "", "null"):
            purchase_total_inr, terr = _parse_purchase_total_inr_field(
                request.data.get("purchase_total_inr")
            )
            if terr:
                return Response({"detail": terr}, status=status.HTTP_400_BAD_REQUEST)
        purchase_price_inr_per_gram, perr = _resolve_holding_purchase_fields(
            weight_grams=weight_grams,
            purchase_price_inr_per_gram_raw=request.data.get("purchase_price_inr_per_gram"),
            purchase_total_inr_raw=request.data.get("purchase_total_inr"),
            making_charge_percent=making_charge_percent,
        )
        if perr:
            return Response({"detail": perr}, status=status.HTTP_400_BAD_REQUEST)
        purchase_date = None
        if request.data.get("purchase_date"):
            from datetime import date as date_cls

            try:
                purchase_date = date_cls.fromisoformat(str(request.data.get("purchase_date"))[:10])
            except ValueError:
                return Response({"detail": "Invalid purchase_date."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            h = PersonalGoldHolding(
                user=request.user,
                jeweller=None,
                title=title,
                category=category,
                weight_grams=weight_grams,
                purity=purity,
                purchase_date=purchase_date,
                purchase_source=purchase_source,
                purchase_price_inr_per_gram=purchase_price_inr_per_gram,
                making_charge_percent=making_charge_percent,
                purchase_total_inr=purchase_total_inr,
                is_self_declared=True,
                verification_status=PersonalGoldHolding.SELF_DECLARED,
                created_by_type=PersonalGoldHolding.CREATED_BY_USER,
                created_by_id=request.user.id,
                notes=notes,
            )
            _recalc_holding_inr(h)
            h.save()
            log_personal_portfolio_action(
                subject_user=request.user,
                action=PersonalPortfolioAuditLog.ACTION_CREATE_HOLDING,
                actor_type=PersonalGoldHolding.CREATED_BY_USER,
                actor_id=request.user.id,
                holding=h,
                metadata={"title": title},
            )
        try:
            create_portfolio_notification(
                user=request.user,
                kind=PortfolioUserNotification.KIND_HOLDING_ADDED,
                title="Personal holding added",
                body=f"{title} ({weight_grams} g) is now in your Gold Records Vault.",
                link_path="/userdashboard?section=portfolio_overview&portfolio_tab=personal",
            )
        except Exception:
            logger.exception(
                "portfolio notification failed after personal holding create user_id=%s holding_id=%s",
                request.user.pk,
                h.pk,
            )
        h = customer_personal_holdings_qs(request.user).get(pk=h.pk)
        return Response(_holding_detail_dict(h, include_documents=True), status=status.HTTP_201_CREATED)


class PersonalHoldingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk: int) -> PersonalGoldHolding:
        h = PersonalGoldHolding.objects.filter(pk=pk, is_removed=False).first()
        if not h:
            raise Http404
        if not _can_access_holding(request.user, h):
            raise Http404
        return h

    def get(self, request, pk: int):
        h = self.get_object(request, pk)
        annotated = customer_personal_holdings_qs(h.user).filter(pk=h.pk).first()
        return Response(_holding_detail_dict(annotated or h, include_documents=True))

    def patch(self, request, pk: int):
        h = PersonalGoldHolding.objects.filter(pk=pk, is_removed=False).first()
        if not h or not _can_mutate_holding_customer(request.user, h):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        for field in ("title", "category", "purchase_source", "notes", "purity"):
            if field in request.data:
                val = request.data.get(field)
                if field == "category":
                    val = str(val or "").strip().lower()
                    valid_cat = {c[0] for c in PersonalGoldHolding.CATEGORY_CHOICES}
                    if val not in valid_cat:
                        return Response({"detail": "Invalid category."}, status=status.HTTP_400_BAD_REQUEST)
                    setattr(h, field, val)
                elif field == "purity":
                    h.purity = str(val or "").strip()[:64] or "BIS 916"
                else:
                    setattr(h, field, str(val or "").strip()[:512] if field != "title" else str(val or "").strip()[:255])
        if "purchase_price_inr_per_gram" in request.data or "purchase_total_inr" in request.data:
            raw_pp = request.data.get("purchase_price_inr_per_gram")
            raw_total = request.data.get("purchase_total_inr")
            if (
                raw_pp in (None, "", "null")
                and raw_total in (None, "", "null")
                and "purchase_price_inr_per_gram" in request.data
            ):
                h.purchase_price_inr_per_gram = None
                h.purchase_total_inr = None
            else:
                ppv, perr = _resolve_holding_purchase_fields(
                    weight_grams=h.weight_grams,
                    purchase_price_inr_per_gram_raw=raw_pp,
                    purchase_total_inr_raw=raw_total,
                    making_charge_percent=h.making_charge_percent,
                )
                if perr:
                    return Response({"detail": perr}, status=status.HTTP_400_BAD_REQUEST)
                h.purchase_price_inr_per_gram = ppv
        if "purchase_total_inr" in request.data:
            raw_total = request.data.get("purchase_total_inr")
            if raw_total in (None, "", "null"):
                h.purchase_total_inr = None
            else:
                purchase_total_inr, terr = _parse_purchase_total_inr_field(raw_total)
                if terr:
                    return Response({"detail": terr}, status=status.HTTP_400_BAD_REQUEST)
                h.purchase_total_inr = purchase_total_inr
        if "making_charge_percent" in request.data:
            raw_mc = request.data.get("making_charge_percent")
            if raw_mc in (None, "", "null"):
                h.making_charge_percent = None
            else:
                mcv, merr = _parse_making_charge_percent_field(raw_mc)
                if merr:
                    return Response({"detail": merr}, status=status.HTTP_400_BAD_REQUEST)
                h.making_charge_percent = mcv
        if "weight_grams" in request.data:
            try:
                wg = Decimal(str(request.data.get("weight_grams") or "0"))
            except Exception:
                return Response({"detail": "Invalid weight."}, status=status.HTTP_400_BAD_REQUEST)
            if wg <= 0:
                return Response({"detail": "Grams must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
            h.weight_grams = wg
        if "purchase_total_inr" in request.data and "purchase_price_inr_per_gram" not in request.data:
            raw_total = request.data.get("purchase_total_inr")
            if raw_total not in (None, "", "null"):
                ppv, perr = _resolve_holding_purchase_fields(
                    weight_grams=h.weight_grams,
                    purchase_price_inr_per_gram_raw=None,
                    purchase_total_inr_raw=raw_total,
                    making_charge_percent=h.making_charge_percent,
                )
                if perr:
                    return Response({"detail": perr}, status=status.HTTP_400_BAD_REQUEST)
                h.purchase_price_inr_per_gram = ppv
            elif raw_total in (None, "", "null"):
                h.purchase_price_inr_per_gram = None
        if "purchase_date" in request.data:
            raw = request.data.get("purchase_date")
            if raw in (None, ""):
                h.purchase_date = None
            else:
                from datetime import date as date_cls

                try:
                    h.purchase_date = date_cls.fromisoformat(str(raw)[:10])
                except ValueError:
                    return Response({"detail": "Invalid purchase_date."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            _recalc_holding_inr(h)
            h.save()
            log_personal_portfolio_action(
                subject_user=h.user,
                action=PersonalPortfolioAuditLog.ACTION_UPDATE_HOLDING,
                actor_type=PersonalGoldHolding.CREATED_BY_USER,
                actor_id=request.user.id,
                holding=h,
            )
        h = customer_personal_holdings_qs(h.user).get(pk=h.pk)
        return Response(_holding_detail_dict(h, include_documents=True))

    def delete(self, request, pk: int):
        h = PersonalGoldHolding.objects.filter(pk=pk, is_removed=False).first()
        if not h or not _can_mutate_holding_customer(request.user, h):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            h.is_removed = True
            h.removed_at = timezone.now()
            h.removed_by = None
            h.save(update_fields=["is_removed", "removed_at", "removed_by", "updated_at"])
            log_personal_portfolio_action(
                subject_user=h.user,
                action=PersonalPortfolioAuditLog.ACTION_DELETE_HOLDING,
                actor_type=PersonalGoldHolding.CREATED_BY_USER,
                actor_id=request.user.id,
                holding=h,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PersonalHoldingDocumentsCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, holding_pk: int):
        h = PersonalGoldHolding.objects.filter(pk=holding_pk, is_removed=False).first()
        if not h or not _can_mutate_holding_customer(request.user, h):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        doc_type = (request.data.get("document_type") or "").strip().lower()
        valid_t = {c[0] for c in PersonalHoldingDocument.DOCUMENT_TYPE_CHOICES}
        if doc_type not in valid_t:
            return Response({"detail": "Invalid document_type."}, status=status.HTTP_400_BAD_REQUEST)
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file required."}, status=status.HTTP_400_BAD_REQUEST)
        max_b = _max_upload_bytes()
        err = validate_document_upload(
            filename=f.name, size_bytes=f.size or 0, max_bytes=max_b
        )
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        invoice_number = (request.data.get("invoice_number") or "").strip()[:120]
        document_title = (request.data.get("document_title") or "").strip()[:255]
        remarks = (request.data.get("remarks") or "").strip()
        with transaction.atomic():
            d = PersonalHoldingDocument(
                holding=h,
                document_type=doc_type,
                file=f,
                original_filename=f.name[:255],
                uploaded_by_type=PersonalHoldingDocument.UPLOADED_BY_USER,
                uploaded_by_id=request.user.id,
                invoice_number=invoice_number,
                document_title=document_title,
                remarks=remarks,
            )
            d.save()
            log_personal_portfolio_action(
                subject_user=h.user,
                action=PersonalPortfolioAuditLog.ACTION_UPLOAD_DOCUMENT,
                actor_type=PersonalHoldingDocument.UPLOADED_BY_USER,
                actor_id=request.user.id,
                holding=h,
                document=d,
                metadata={"document_type": doc_type},
            )
        create_portfolio_notification(
            user=h.user,
            kind=PortfolioUserNotification.KIND_DOCUMENT_UPLOADED,
            title="Vault document uploaded",
            body=f"New {doc_type.replace('_', ' ')} for “{h.title}”.",
            link_path=f"/userdashboard?section=portfolio_overview&portfolio_tab=personal&holding={h.id}",
        )
        return Response(_document_dict(d), status=status.HTTP_201_CREATED)


class PersonalHoldingDocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, holding_pk: int, doc_pk: int):
        d = (
            PersonalHoldingDocument.objects.select_related("holding")
            .filter(pk=doc_pk, holding_id=holding_pk, is_removed=False)
            .first()
        )
        if not d or not _can_access_holding(request.user, d.holding):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not d.file:
            return Response({"detail": "Missing file."}, status=status.HTTP_404_NOT_FOUND)
        fh = d.file.open("rb")
        resp = FileResponse(fh, as_attachment=True, filename=d.original_filename or d.file.name.rsplit("/", 1)[-1])
        return resp


class PersonalHoldingDocumentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, holding_pk: int, doc_pk: int):
        d = (
            PersonalHoldingDocument.objects.select_related("holding")
            .filter(pk=doc_pk, holding_id=holding_pk, is_removed=False)
            .first()
        )
        if not d or not _can_mutate_holding_customer(request.user, d.holding):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            delete_filefield(d.file)
            d.is_removed = True
            d.save(update_fields=["is_removed"])
            log_personal_portfolio_action(
                subject_user=d.holding.user,
                action=PersonalPortfolioAuditLog.ACTION_DELETE_DOCUMENT,
                actor_type=PersonalHoldingDocument.UPLOADED_BY_USER,
                actor_id=request.user.id,
                holding=d.holding,
                document=d,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class JewellerCustomerLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        member = (request.query_params.get("cridora_member_id") or "").strip().upper()
        phone_raw = (request.query_params.get("phone") or "").strip()
        qs = User.objects.filter(user_type=User.CUSTOMER, kyc_status=User.KYC_VERIFIED)
        u = None
        if member.startswith("CRI"):
            u = qs.filter(cridora_member_id__iexact=member).first()
        elif phone_raw:
            digits = normalize_phone_digits(phone_raw)
            if len(digits) >= 6:
                u = qs.filter(phone__icontains=digits).first()
        if not u:
            return Response({"found": False, "detail": "Verified customer not found."}, status=status.HTTP_404_NOT_FOUND)
        label = f"{u.first_name} {u.last_name}".strip() or (u.email or "")
        return Response(
            {
                "found": True,
                "customer": {
                    "id": u.id,
                    "label": label,
                    "cridora_member_id": u.cridora_member_id or "",
                    "phone": u.phone or "",
                },
            }
        )


class JewellerPersonalHoldingCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        jew = request.user
        if jew.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            cid = int(request.data.get("customer_id") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "customer_id required."}, status=status.HTTP_400_BAD_REQUEST)
        cust = User.objects.filter(
            pk=cid, user_type=User.CUSTOMER, kyc_status=User.KYC_VERIFIED
        ).first()
        if not cust:
            return Response({"detail": "Verified customer not found."}, status=status.HTTP_400_BAD_REQUEST)

        title = (request.data.get("title") or "").strip()
        category = (request.data.get("category") or "").strip().lower()
        valid_cat = {c[0] for c in PersonalGoldHolding.CATEGORY_CHOICES}
        if not title or category not in valid_cat:
            return Response({"detail": "Title and valid category required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            weight_grams = Decimal(str(request.data.get("weight_grams") or "0"))
        except Exception:
            return Response({"detail": "Invalid weight."}, status=status.HTTP_400_BAD_REQUEST)
        if weight_grams <= 0:
            return Response({"detail": "Grams must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
        purity = (request.data.get("purity") or "BIS 916").strip()[:64] or "BIS 916"
        invoice_number = (request.data.get("invoice_number") or "").strip()[:120]

        img = request.FILES.get("product_image")
        inv = request.FILES.get("invoice_file")
        max_b = _max_upload_bytes()
        for f in (x for x in (img, inv) if x):
            err = validate_document_upload(filename=f.name, size_bytes=f.size or 0, max_bytes=max_b)
            if err:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            h = PersonalGoldHolding(
                user=cust,
                jeweller=jew,
                title=title,
                category=category,
                weight_grams=weight_grams,
                purity=purity,
                is_self_declared=False,
                verification_status=PersonalGoldHolding.JEWELLER_ADDED,
                created_by_type=PersonalGoldHolding.CREATED_BY_JEWELLER,
                created_by_id=jew.id,
                purchase_source=_jeweller_label(jew),
            )
            _recalc_holding_inr(h)
            h.save()
            log_personal_portfolio_action(
                subject_user=cust,
                action=PersonalPortfolioAuditLog.ACTION_JEWELLER_ADD,
                actor_type=PersonalGoldHolding.CREATED_BY_JEWELLER,
                actor_id=jew.id,
                holding=h,
            )

            for f, dtp in ((img, PersonalHoldingDocument.PRODUCT_IMAGE), (inv, PersonalHoldingDocument.PURCHASE_INVOICE)):
                if not f:
                    continue
                d = PersonalHoldingDocument(
                    holding=h,
                    document_type=dtp,
                    file=f,
                    original_filename=f.name[:255],
                    uploaded_by_type=PersonalHoldingDocument.UPLOADED_BY_JEWELLER,
                    uploaded_by_id=jew.id,
                    invoice_number=invoice_number if dtp == PersonalHoldingDocument.PURCHASE_INVOICE else "",
                )
                d.save()
                log_personal_portfolio_action(
                    subject_user=cust,
                    action=PersonalPortfolioAuditLog.ACTION_UPLOAD_DOCUMENT,
                    actor_type=PersonalHoldingDocument.UPLOADED_BY_JEWELLER,
                    actor_id=jew.id,
                    holding=h,
                    document=d,
                )

        jname = _jeweller_label(jew)
        create_portfolio_notification(
            user=cust,
            kind=PortfolioUserNotification.KIND_JEWELLER_ADDED_HOLDING,
            title="Jeweller added to your vault",
            body=f"{jname} added “{title}” ({weight_grams} g) to your personal holdings.",
            link_path="/userdashboard?section=portfolio_overview&portfolio_tab=personal",
        )
        hs = customer_personal_holdings_qs(cust).filter(pk=h.pk).first()
        return Response(_holding_detail_dict(hs or h, include_documents=True), status=status.HTTP_201_CREATED)


def _admin_ok(request) -> bool:
    u = request.user
    return bool(
        u.is_authenticated
        and (u.user_type == User.ADMIN or (getattr(u, "is_superuser", False) and getattr(u, "is_staff", False)))
    )


class AdminPersonalHoldingsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _admin_ok(request):
            return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)
        uid_raw = request.query_params.get("user_id")
        user_id = None
        if uid_raw:
            try:
                user_id = int(uid_raw)
            except ValueError:
                pass
        q = (request.query_params.get("q") or "").strip()
        results = admin_personal_vault_user_summaries(q=q or None, user_id=user_id)
        return Response({"results": results})


class AdminPersonalHoldingRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if not _admin_ok(request):
            return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)
        h = PersonalGoldHolding.objects.filter(pk=pk, is_removed=False).first()
        if not h:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            h.is_removed = True
            h.removed_at = timezone.now()
            h.removed_by = request.user
            h.save(update_fields=["is_removed", "removed_at", "removed_by", "updated_at"])
            log_personal_portfolio_action(
                subject_user=h.user,
                action=PersonalPortfolioAuditLog.ACTION_ADMIN_REMOVE,
                actor_type=PersonalGoldHolding.CREATED_BY_ADMIN,
                actor_id=request.user.id,
                holding=h,
            )
        return Response({"ok": True})


class AdminPersonalHoldingVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        if not _admin_ok(request):
            return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)
        h = PersonalGoldHolding.objects.filter(pk=pk, is_removed=False).first()
        if not h:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        vs = (request.data.get("verification_status") or "").strip().lower()
        if vs != PersonalGoldHolding.VERIFIED:
            return Response({"detail": "Only verified status supported in MVP."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            prev = h.verification_status
            h.verification_status = PersonalGoldHolding.VERIFIED
            h.save(update_fields=["verification_status", "updated_at"])
            log_personal_portfolio_action(
                subject_user=h.user,
                action=PersonalPortfolioAuditLog.ACTION_VERIFICATION_CHANGE,
                actor_type=PersonalGoldHolding.CREATED_BY_ADMIN,
                actor_id=request.user.id,
                holding=h,
                metadata={"from": prev, "to": PersonalGoldHolding.VERIFIED},
            )
        create_portfolio_notification(
            user=h.user,
            kind=PortfolioUserNotification.KIND_VERIFICATION_UPDATED,
            title="Holding verification updated",
            body=f"“{h.title}” is now marked verified.",
            link_path="/userdashboard?section=portfolio_overview&portfolio_tab=personal",
        )
        hs = customer_personal_holdings_qs(h.user).filter(pk=h.pk).first()
        return Response(_holding_detail_dict(hs or h, include_documents=False))


class AdminPersonalDocumentRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, holding_pk: int, doc_pk: int):
        if not _admin_ok(request):
            return Response({"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN)
        d = PersonalHoldingDocument.objects.filter(pk=doc_pk, holding_id=holding_pk, is_removed=False).first()
        if not d:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            delete_filefield(d.file)
            d.is_removed = True
            d.save(update_fields=["is_removed"])
            log_personal_portfolio_action(
                subject_user=d.holding.user,
                action=PersonalPortfolioAuditLog.ACTION_DELETE_DOCUMENT,
                actor_type=PersonalGoldHolding.CREATED_BY_ADMIN,
                actor_id=request.user.id,
                holding=d.holding,
                document=d,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
