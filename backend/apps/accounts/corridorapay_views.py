"""REST API: CridoraPay counter bills (jeweller bill → customer pay → personal holding)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.corridorapay_otp import issue_corridorapay_otp, verify_corridorapay_otp
from apps.accounts.fractional_service import MIN_GRAMS, jeweller_metal_rate_inr_per_gram
from apps.accounts.models import CridoraPayBill, PersonalGoldHolding
from apps.accounts.services.corridorapay.completion import (
    apply_vault_debit_for_bill,
    complete_corridorapay_bill,
    finalize_corridorapay_bill,
)
from apps.accounts.services.corridorapay.quote import corridorapay_quote_payload, corridorapay_split
from apps.accounts.services.fractional_upi import jeweller_upi_vpa
from apps.accounts.services.platform_operational import fractional_counter_otp_ttl_seconds_int

User = get_user_model()

BILL_EXPIRY_HOURS = 24
OPEN_STATUSES = (
    CridoraPayBill.STATUS_AWAITING_CUSTOMER,
    CridoraPayBill.STATUS_UPI_PENDING,
    CridoraPayBill.STATUS_VAULT_OTP_PENDING,
    CridoraPayBill.STATUS_CASH_PENDING,
)


def _expire_if_needed(bill: CridoraPayBill) -> CridoraPayBill:
    if bill.status not in OPEN_STATUSES:
        return bill
    if bill.expires_at and timezone.now() > bill.expires_at:
        bill.status = CridoraPayBill.STATUS_EXPIRED
        bill.save(update_fields=["status", "updated_at"])
    return bill


def _ser_customer_brief(c: User) -> dict:
    return {
        "id": c.id,
        "email": c.email,
        "name": f"{c.first_name} {c.last_name}".strip(),
        "cridora_member_id": c.cridora_member_id or "",
    }


def _ser_jeweller_brief(j: User) -> dict:
    return {
        "id": j.id,
        "business_name": j.business_name or j.email,
        "city": j.city or "",
    }


def _ser_bill(bill: CridoraPayBill, *, include_customer: bool, include_otp_expiry: bool) -> dict:
    bill = _expire_if_needed(bill)
    row = {
        "id": bill.id,
        "reference": bill.reference,
        "title": bill.title,
        "category": bill.category,
        "weight_grams": str(bill.weight_grams),
        "purity": bill.purity,
        "total_inr": str(bill.total_inr),
        "metal_rate_inr_per_gram": str(bill.metal_rate_inr_per_gram),
        "jeweller_note": bill.jeweller_note,
        "status": bill.status,
        "payment_method": bill.payment_method or "",
        "vault_grams_chosen": str(bill.vault_grams_chosen),
        "vault_inr_applied": str(bill.vault_inr_applied),
        "cash_payable_inr": str(bill.cash_payable_inr),
        "payee_upi_vpa": bill.payee_upi_vpa or "",
        "payment_note": bill.payment_note or "",
        "personal_holding_id": bill.personal_holding_id,
        "expires_at": bill.expires_at.isoformat() if bill.expires_at else None,
        "completed_at": bill.completed_at.isoformat() if bill.completed_at else None,
        "created_at": bill.created_at.isoformat(),
        "jeweller": _ser_jeweller_brief(bill.jeweller),
        "quote": corridorapay_quote_payload(bill),
    }
    if include_customer:
        row["customer"] = _ser_customer_brief(bill.customer)
    if include_otp_expiry:
        try:
            row["otp_expires_at"] = bill.settlement_otp.expires_at.isoformat()
        except Exception:
            row["otp_expires_at"] = None
    return row


def _db_unavailable_response() -> Response:
    return Response(
        {
            "detail": (
                "CridoraPay is not ready on this server. "
                "Apply migration accounts.0038_corridorapay and redeploy."
            )
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _parse_decimal(raw, field: str) -> tuple[Decimal | None, Response | None]:
    try:
        val = Decimal(str(raw).strip())
    except (InvalidOperation, TypeError, AttributeError):
        return None, Response({"detail": f"Invalid {field}."}, status=status.HTTP_400_BAD_REQUEST)
    return val, None


class JewellerCridoraPayBillCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete KYB before creating CridoraPay bills."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            customer_id = int(request.data.get("customer_id"))
        except (TypeError, ValueError):
            return Response({"detail": "customer_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        customer = User.objects.filter(
            pk=customer_id,
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        ).first()
        if not customer:
            return Response({"detail": "Verified customer not found."}, status=status.HTTP_400_BAD_REQUEST)

        grams, err = _parse_decimal(request.data.get("weight_grams", "0"), "weight_grams")
        if err:
            return err
        grams = grams.quantize(Decimal("0.000001"))
        if grams < MIN_GRAMS:
            return Response(
                {"detail": f"Minimum gold weight is {MIN_GRAMS} g."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_inr, err = _parse_decimal(request.data.get("total_inr", "0"), "total_inr")
        if err:
            return err
        total_inr = total_inr.quantize(Decimal("0.01"))
        if total_inr <= 0:
            return Response({"detail": "total_inr must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

        title = (request.data.get("title") or "Shop purchase").strip()[:255]
        category = (request.data.get("category") or PersonalGoldHolding.CATEGORY_ORNAMENT).strip().lower()
        valid_cat = {c[0] for c in PersonalGoldHolding.CATEGORY_CHOICES}
        if category not in valid_cat:
            return Response({"detail": "Invalid category."}, status=status.HTTP_400_BAD_REQUEST)
        purity = (request.data.get("purity") or "BIS 916").strip()[:64] or "BIS 916"
        note = (request.data.get("jeweller_note") or "").strip()[:500]
        rate = jeweller_metal_rate_inr_per_gram(request.user)
        if rate <= 0:
            return Response(
                {"detail": "Configure your jeweller metal rate before creating bills."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bill = CridoraPayBill.objects.create(
            customer=customer,
            jeweller=request.user,
            title=title,
            category=category,
            weight_grams=grams,
            purity=purity,
            total_inr=total_inr,
            metal_rate_inr_per_gram=rate,
            jeweller_note=note,
            expires_at=timezone.now() + timedelta(hours=BILL_EXPIRY_HOURS),
        )
        from apps.accounts.services.user_push_notify import notify_corridorapay_bill_created

        notify_corridorapay_bill_created(bill)
        return Response(_ser_bill(bill, include_customer=True, include_otp_expiry=False), status=status.HTTP_201_CREATED)


class JewellerCridoraPayBillsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = CridoraPayBill.objects.filter(jeweller=request.user).select_related(
            "customer", "jeweller", "settlement_otp"
        )
        status_filter = (request.query_params.get("status") or "open").strip().lower()
        if status_filter == "open":
            qs = qs.filter(status__in=OPEN_STATUSES)
        elif status_filter != "all":
            qs = qs.filter(status=status_filter)
        try:
            rows = []
            for b in qs[:100]:
                try:
                    rows.append(_ser_bill(b, include_customer=True, include_otp_expiry=True))
                except Exception:
                    continue
            return Response({"results": rows})
        except (OperationalError, ProgrammingError):
            return _db_unavailable_response()


class JewellerCridoraPayVerifyVaultOtpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        raw_otp = request.data.get("otp") if isinstance(request.data, dict) else None
        try:
            with transaction.atomic():
                bill = CridoraPayBill.objects.select_for_update().select_related(
                    "customer", "jeweller"
                ).get(pk=pk, jeweller=request.user)
                bill = _expire_if_needed(bill)
                if bill.status != CridoraPayBill.STATUS_VAULT_OTP_PENDING:
                    return Response(
                        {"detail": "Bill is not awaiting vault OTP."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                ok, detail = verify_corridorapay_otp(bill, str(raw_otp or ""))
                if not ok:
                    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
                err = apply_vault_debit_for_bill(bill)
                if err:
                    return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
                if bill.cash_payable_inr > 0:
                    bill.status = CridoraPayBill.STATUS_CASH_PENDING
                    bill.save(update_fields=["status", "updated_at"])
                    from apps.accounts.services.user_push_notify import notify_corridorapay_cash_pending

                    notify_corridorapay_cash_pending(bill)
                else:
                    complete_corridorapay_bill(bill)
                    from apps.accounts.services.user_push_notify import notify_corridorapay_completed

                    notify_corridorapay_completed(bill)
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill.refresh_from_db()
        return Response(_ser_bill(bill, include_customer=True, include_otp_expiry=True))


class JewellerCridoraPayMarkUpiPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                bill = CridoraPayBill.objects.select_for_update().get(
                    pk=pk, jeweller=request.user
                )
                bill = _expire_if_needed(bill)
                if bill.status != CridoraPayBill.STATUS_UPI_PENDING:
                    return Response(
                        {"detail": "Bill is not awaiting UPI confirmation."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                _, err = finalize_corridorapay_bill(bill)
                if err:
                    return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill.refresh_from_db()
        from apps.accounts.services.user_push_notify import notify_corridorapay_completed

        notify_corridorapay_completed(bill)
        return Response(_ser_bill(bill, include_customer=True, include_otp_expiry=False))


class JewellerCridoraPayMarkCashPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                bill = CridoraPayBill.objects.select_for_update().get(
                    pk=pk, jeweller=request.user
                )
                bill = _expire_if_needed(bill)
                if bill.status != CridoraPayBill.STATUS_CASH_PENDING:
                    return Response(
                        {"detail": "Bill is not awaiting cash payment."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                _, err = finalize_corridorapay_bill(bill)
                if err:
                    return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill.refresh_from_db()
        from apps.accounts.services.user_push_notify import notify_corridorapay_completed

        notify_corridorapay_completed(bill)
        return Response(_ser_bill(bill, include_customer=True, include_otp_expiry=False))


class JewellerCridoraPayCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                bill = CridoraPayBill.objects.select_for_update().get(
                    pk=pk, jeweller=request.user
                )
                if bill.status not in (
                    CridoraPayBill.STATUS_AWAITING_CUSTOMER,
                    CridoraPayBill.STATUS_UPI_PENDING,
                    CridoraPayBill.STATUS_VAULT_OTP_PENDING,
                ):
                    return Response(
                        {"detail": "Cannot cancel this bill at its current stage."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if bill.vault_debited:
                    return Response(
                        {"detail": "Vault already debited — cannot cancel."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                bill.status = CridoraPayBill.STATUS_CANCELLED
                bill.save(update_fields=["status", "updated_at"])
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_ser_bill(bill, include_customer=True, include_otp_expiry=False))


class CustomerCridoraPayBillsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        qs = CridoraPayBill.objects.filter(customer=request.user).select_related(
            "customer", "jeweller", "settlement_otp"
        )
        scope = (request.query_params.get("scope") or "all").strip().lower()
        if scope == "active":
            qs = qs.filter(status__in=OPEN_STATUSES)
        qs = qs.order_by("-created_at")[:50]
        try:
            rows = []
            for b in qs:
                try:
                    rows.append(_ser_bill(b, include_customer=False, include_otp_expiry=True))
                except Exception:
                    continue
            return Response({"results": rows})
        except (OperationalError, ProgrammingError):
            return _db_unavailable_response()


class JewellerCridoraPayResendNotifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.JEWELLER:
            return Response({"detail": "Jewellers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            bill = CridoraPayBill.objects.select_related("customer", "jeweller").get(
                pk=pk, jeweller=request.user
            )
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill = _expire_if_needed(bill)
        if bill.status not in OPEN_STATUSES:
            return Response(
                {"detail": "This bill is no longer open — create a new bill if needed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.accounts.services.user_push_notify import (
            notify_corridorapay_bill_created,
            notify_corridorapay_customer_reminder,
        )

        if bill.status == CridoraPayBill.STATUS_AWAITING_CUSTOMER:
            notify_corridorapay_bill_created(bill)
        else:
            notify_corridorapay_customer_reminder(bill)
        return Response(_ser_bill(bill, include_customer=True, include_otp_expiry=True))


class CustomerCridoraPayQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        bill = CridoraPayBill.objects.filter(pk=pk, customer=request.user).select_related(
            "jeweller"
        ).first()
        if not bill:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill = _expire_if_needed(bill)
        vg_raw = request.query_params.get("vault_grams")
        vg = None
        if vg_raw is not None and str(vg_raw).strip() != "":
            vg, err = _parse_decimal(vg_raw, "vault_grams")
            if err:
                return err
            if vg < 0:
                return Response({"detail": "vault_grams must be non-negative."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(corridorapay_quote_payload(bill, vg))


class CustomerCridoraPayAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {"detail": "Complete KYC before paying with CridoraPay."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        body = request.data if isinstance(request.data, dict) else {}
        pay_method = str(body.get("payment_method") or "").strip().lower()
        if pay_method not in (CridoraPayBill.PAY_VAULT, CridoraPayBill.PAY_UPI):
            return Response(
                {"detail": "payment_method must be vault or upi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            with transaction.atomic():
                bill = CridoraPayBill.objects.select_for_update().select_related(
                    "jeweller", "customer"
                ).get(pk=pk, customer=request.user)
                bill = _expire_if_needed(bill)
                if bill.status != CridoraPayBill.STATUS_AWAITING_CUSTOMER:
                    return Response(
                        {"detail": "Bill is no longer awaiting your confirmation."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if pay_method == CridoraPayBill.PAY_UPI:
                    vpa = jeweller_upi_vpa(bill.jeweller)
                    if not vpa:
                        return Response(
                            {"detail": "Jeweller has no UPI VPA configured."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    bill.payment_method = CridoraPayBill.PAY_UPI
                    bill.vault_grams_chosen = Decimal("0")
                    bill.vault_inr_applied = Decimal("0")
                    bill.cash_payable_inr = bill.total_inr
                    bill.payee_upi_vpa = vpa
                    bill.payment_note = f"Cridora CP-{bill.pk}"
                    bill.status = CridoraPayBill.STATUS_UPI_PENDING
                    bill.save()
                    from apps.accounts.services.user_push_notify import notify_corridorapay_upi_selected

                    notify_corridorapay_upi_selected(bill)
                else:
                    vg_raw = body.get("vault_grams")
                    vg, err = _parse_decimal(vg_raw if vg_raw is not None else "0", "vault_grams")
                    if err:
                        return err
                    split = corridorapay_split(bill, vg)
                    if split["vault_grams_chosen"] <= 0:
                        return Response(
                            {"detail": "No vault gold available at this jeweller for this bill."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    exp_cash = body.get("expected_cash_payable_inr")
                    exp_vg = body.get("expected_vault_grams_chosen")
                    if exp_cash is not None or exp_vg is not None:
                        try:
                            exp_cash_d = Decimal(str(exp_cash).strip()).quantize(Decimal("0.01"))
                            exp_vg_d = Decimal(str(exp_vg).strip()).quantize(Decimal("0.000001"))
                        except InvalidOperation:
                            return Response(
                                {"detail": "Invalid expected quote fields."},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        if (
                            exp_cash_d != split["cash_payable_inr"]
                            or exp_vg_d != split["vault_grams_chosen"]
                        ):
                            return Response(
                                {
                                    "detail": "Pricing changed since quote. Refresh and try again.",
                                    "quote": corridorapay_quote_payload(bill, vg),
                                },
                                status=status.HTTP_409_CONFLICT,
                            )
                    bill.payment_method = CridoraPayBill.PAY_VAULT
                    bill.vault_grams_chosen = split["vault_grams_chosen"]
                    bill.vault_inr_applied = split["vault_inr_applied"]
                    bill.cash_payable_inr = split["cash_payable_inr"]
                    bill.status = CridoraPayBill.STATUS_VAULT_OTP_PENDING
                    bill.save()
                    from apps.accounts.services.user_push_notify import notify_corridorapay_vault_selected

                    notify_corridorapay_vault_selected(bill)
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill.refresh_from_db()
        return Response(_ser_bill(bill, include_customer=False, include_otp_expiry=True))


class CustomerCridoraPayVaultOtpIssueView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            bill = CridoraPayBill.objects.select_related("jeweller").get(
                pk=pk, customer=request.user
            )
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        bill = _expire_if_needed(bill)
        if bill.status != CridoraPayBill.STATUS_VAULT_OTP_PENDING:
            return Response(
                {"detail": "Bill is not awaiting vault OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            code, expires_at = issue_corridorapay_otp(bill)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        from apps.accounts.services.user_push_notify import notify_corridorapay_otp_issued

        notify_corridorapay_otp_issued(bill)
        row = _ser_bill(bill, include_customer=False, include_otp_expiry=True)
        row["otp"] = code
        row["otp_expires_at"] = expires_at.isoformat()
        row["otp_policy_seconds"] = fractional_counter_otp_ttl_seconds_int()
        return Response(row)


class CustomerCridoraPayCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Customers only."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with transaction.atomic():
                bill = CridoraPayBill.objects.select_for_update().get(
                    pk=pk, customer=request.user
                )
                if bill.status not in (
                    CridoraPayBill.STATUS_AWAITING_CUSTOMER,
                    CridoraPayBill.STATUS_UPI_PENDING,
                    CridoraPayBill.STATUS_VAULT_OTP_PENDING,
                ):
                    return Response(
                        {"detail": "Cannot cancel this bill at its current stage."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if bill.vault_debited:
                    return Response(
                        {"detail": "Vault already debited — cannot cancel."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                bill.status = CridoraPayBill.STATUS_CANCELLED
                bill.save(update_fields=["status", "updated_at"])
        except CridoraPayBill.DoesNotExist:
            return Response({"detail": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_ser_bill(bill, include_customer=False, include_otp_expiry=False))
