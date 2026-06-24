"""Default copy for automated system notifications (seeded into DB)."""

from __future__ import annotations

from typing import TypedDict


class SystemNotificationDef(TypedDict):
    key: str
    name: str
    group: str
    locale: str
    title_template: str
    body_template: str
    variables: list[str]
    description: str


GROUP_TRANSACTION = "transaction"
GROUP_GOLD = "gold"
GROUP_CORRIDORAPAY = "corridorapay"
GROUP_PORTFOLIO = "portfolio"


SYSTEM_NOTIFICATION_CATALOG: list[SystemNotificationDef] = [
    {
        "key": "fractional_otp_jeweller",
        "name": "Fractional purchase — OTP ready (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Counter OTP ready",
        "body_template": (
            "{{customer_name}} generated a verification code for {{grams}} g — "
            "open Purchases to enter it."
        ),
        "variables": ["customer_name", "grams"],
        "description": "Jeweller tray alert when a customer generates a counter OTP for fractional gold.",
    },
    {
        "key": "fractional_otp_customer",
        "name": "Fractional purchase — OTP generated (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "OTP generated",
        "body_template": (
            "Show your code to {{jeweller_name}} after paying {{grams}} g at the counter."
        ),
        "variables": ["jeweller_name", "grams"],
        "description": "Customer inbox when they generate a fractional purchase OTP.",
    },
    {
        "key": "deposit_intake_customer",
        "name": "Gold deposit — intake recorded (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Deposit recorded — OTP needed",
        "body_template": (
            "{{jeweller_name}} logged {{grams}} g. Generate your OTP in the app to complete the deposit."
        ),
        "variables": ["jeweller_name", "grams"],
        "description": "Customer alert when jeweller logs a physical gold deposit intake.",
    },
    {
        "key": "deposit_otp_jeweller",
        "name": "Gold deposit — OTP ready (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Deposit OTP ready",
        "body_template": (
            "{{customer_name}} shared a verification code for {{grams}} g deposit — open Deposits to verify."
        ),
        "variables": ["customer_name", "grams"],
        "description": "Jeweller tray alert when customer shares deposit OTP.",
    },
    {
        "key": "deposit_otp_customer",
        "name": "Gold deposit — OTP generated (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Deposit OTP generated",
        "body_template": "Show your code to the jeweller. Open Deposits if you need to view it again.",
        "variables": [],
        "description": "Customer confirmation after generating deposit OTP.",
    },
    {
        "key": "sellback_pending_jeweller",
        "name": "Sellback request (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Sellback request",
        "body_template": (
            "{{customer_name}} requested cash sellback for {{grams}} g — review in Redemption."
        ),
        "variables": ["customer_name", "grams"],
        "description": "Jeweller alert for a new cash sellback request.",
    },
    {
        "key": "sellback_otp_customer",
        "name": "Sellback — share OTP (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Share sellback OTP",
        "body_template": (
            "Jeweller accepted your sellback. Open Cash sell and share your OTP after you receive payment."
        ),
        "variables": [],
        "description": "Customer prompt to share sellback OTP after jeweller acceptance.",
    },
    {
        "key": "loan_pending_jeweller",
        "name": "Gold loan request (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Gold loan request",
        "body_template": (
            "{{customer_name}} requested a loan on {{grams}} g collateral — review in Redemption."
        ),
        "variables": ["customer_name", "grams"],
        "description": "Jeweller alert for a new gold loan request.",
    },
    {
        "key": "loan_otp_customer",
        "name": "Gold loan — share OTP (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Share loan OTP",
        "body_template": "Jeweller accepted your loan. Open Loan and share your OTP after you receive cash.",
        "variables": [],
        "description": "Customer prompt to share loan OTP.",
    },
    {
        "key": "loan_repay_pending_jeweller",
        "name": "Loan repayment request (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Loan repayment",
        "body_template": (
            "{{customer_name}} wants to repay ₹{{amount_inr}} on LN-{{loan_id}} — review in Redemption."
        ),
        "variables": ["customer_name", "amount_inr", "loan_id"],
        "description": "Jeweller alert when customer initiates loan repayment.",
    },
    {
        "key": "loan_repay_otp_customer",
        "name": "Loan repayment — share OTP (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Share repayment OTP",
        "body_template": "Jeweller accepted your repayment. Pay cash at the counter, then share your OTP.",
        "variables": [],
        "description": "Customer prompt to share repayment OTP.",
    },
    {
        "key": "cross_redemption_source_jeweller",
        "name": "Cross-redemption — source approval (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Cross-redemption approval",
        "body_template": (
            "Customer needs {{grams}} g moved to {{destination_jeweller}} — open Redemption inbox."
        ),
        "variables": ["grams", "destination_jeweller"],
        "description": "Source jeweller must approve cross-shop gold movement.",
    },
    {
        "key": "cross_redemption_dest_jeweller",
        "name": "Cross-redemption — incoming (jeweller)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Incoming cross-redemption",
        "body_template": (
            "{{grams}} g cross-shop request pending source approval — track in Redemption inbox."
        ),
        "variables": ["grams"],
        "description": "Destination jeweller notified of pending cross-redemption.",
    },
    {
        "key": "cross_redemption_customer",
        "name": "Cross-redemption submitted (customer)",
        "group": GROUP_TRANSACTION,
        "locale": "en",
        "title_template": "Cross-redemption submitted",
        "body_template": "Request {{reference}} is awaiting source jeweller approval.",
        "variables": ["reference"],
        "description": "Customer confirmation after submitting cross-redemption.",
    },
    {
        "key": "fractional_completed_customer",
        "name": "Fractional gold credited (customer)",
        "group": GROUP_PORTFOLIO,
        "locale": "en",
        "title_template": "Fractional gold credited",
        "body_template": "{{grams}} g added to your vault at {{jeweller_name}}.",
        "variables": ["grams", "jeweller_name"],
        "description": "Customer inbox when fractional purchase completes.",
    },
    {
        "key": "deposit_completed_customer",
        "name": "Gold deposit credited (customer)",
        "group": GROUP_PORTFOLIO,
        "locale": "en",
        "title_template": "Gold deposit credited",
        "body_template": "{{grams}} g deposit vault credit is complete.",
        "variables": ["grams"],
        "description": "Customer inbox when physical deposit is credited.",
    },
    {
        "key": "primary_jeweller_changed",
        "name": "Primary customer changed (jeweller)",
        "group": GROUP_PORTFOLIO,
        "locale": "en",
        "title_template": "Primary customer changed",
        "body_template": (
            "{{customer_name}} set {{new_jeweller_name}} as their primary jeweller instead of your shop."
        ),
        "variables": ["customer_name", "new_jeweller_name"],
        "description": "Previous primary jeweller when a customer switches shops.",
    },
    {
        "key": "corridorapay_bill_created",
        "name": "CridoraPay bill to review (customer)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "Shop bill to review",
        "body_template": (
            "{{jeweller_name}} sent a bill for ₹{{total_inr}} — confirm and pay in CridoraPay."
        ),
        "variables": ["jeweller_name", "total_inr"],
        "description": "Customer alert when jeweller sends a CridoraPay bill.",
    },
    {
        "key": "corridorapay_bill_reminder",
        "name": "CridoraPay bill pending (customer)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "CridoraPay bill pending",
        "body_template": (
            "Your bill {{reference}} from {{jeweller_name}} is waiting — open CridoraPay in Invest."
        ),
        "variables": ["reference", "jeweller_name"],
        "description": "Reminder for an unpaid CridoraPay bill.",
    },
    {
        "key": "corridorapay_upi_jeweller",
        "name": "CridoraPay — customer paying by UPI (jeweller)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "Customer paying by UPI",
        "body_template": (
            "{{customer_name}} will pay {{reference}} (₹{{total_inr}}) outside the app — mark paid when received."
        ),
        "variables": ["customer_name", "reference", "total_inr"],
        "description": "Jeweller alert when customer selects external UPI payment.",
    },
    {
        "key": "corridorapay_vault_jeweller",
        "name": "CridoraPay — vault payment selected (jeweller)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "Vault payment selected",
        "body_template": (
            "{{customer_name}} chose vault for {{reference}}. Enter their OTP when ready."
        ),
        "variables": ["customer_name", "reference"],
        "description": "Jeweller alert when customer pays from vault.",
    },
    {
        "key": "corridorapay_otp_jeweller",
        "name": "CridoraPay — OTP ready (jeweller)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "CridoraPay OTP ready",
        "body_template": "{{customer_name}} generated a vault OTP for {{reference}}.",
        "variables": ["customer_name", "reference"],
        "description": "Jeweller alert when customer generates CridoraPay vault OTP.",
    },
    {
        "key": "corridorapay_cash_customer",
        "name": "CridoraPay — balance due at counter (customer)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "Balance due at counter",
        "body_template": "Vault applied for {{reference}}. Pay ₹{{cash_inr}} at the shop to complete.",
        "variables": ["reference", "cash_inr"],
        "description": "Customer alert when partial vault payment leaves a cash balance.",
    },
    {
        "key": "corridorapay_cash_jeweller",
        "name": "CridoraPay — collect cash balance (jeweller)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "Collect cash balance",
        "body_template": "Vault debited for {{reference}}. Collect ₹{{cash_inr}} from {{customer_name}}.",
        "variables": ["reference", "cash_inr", "customer_name"],
        "description": "Jeweller alert to collect remaining cash after vault debit.",
    },
    {
        "key": "corridorapay_completed_customer",
        "name": "CridoraPay purchase complete (customer)",
        "group": GROUP_CORRIDORAPAY,
        "locale": "en",
        "title_template": "Purchase complete",
        "body_template": "{{title}} ({{grams}} g) is recorded in your Gold Records.",
        "variables": ["title", "grams"],
        "description": "Customer confirmation when CridoraPay bill completes.",
    },
    {
        "key": "gold_rate_alert_title",
        "name": "Gold rate move alert — title",
        "group": GROUP_GOLD,
        "locale": "en",
        "title_template": "Gold rate alert",
        "body_template": "",
        "variables": [],
        "description": "Tray title when platform gold rate crosses the alert threshold.",
    },
    {
        "key": "gold_rate_alert_title",
        "name": "Gold rate move alert — title (Malayalam)",
        "group": GROUP_GOLD,
        "locale": "ml",
        "title_template": "ഗോൾഡ് നിരക്ക് അലർട്ട്",
        "body_template": "",
        "variables": [],
        "description": "Malayalam title for gold rate threshold alerts.",
    },
    {
        "key": "gold_hourly_push_title",
        "name": "Hourly gold digest — title",
        "group": GROUP_GOLD,
        "locale": "en",
        "title_template": "Gold price update",
        "body_template": "",
        "variables": [],
        "description": "Tray title for hourly gold price digest pushes.",
    },
    {
        "key": "gold_hourly_push_title",
        "name": "Hourly gold digest — title (Malayalam)",
        "group": GROUP_GOLD,
        "locale": "ml",
        "title_template": "ഗോൾഡ് നിരക്ക് അപ്‌ഡേറ്റ്",
        "body_template": "",
        "variables": [],
        "description": "Malayalam title for hourly gold digest.",
    },
    {
        "key": "gold_price_move_body",
        "name": "Gold price move — body",
        "group": GROUP_GOLD,
        "locale": "en",
        "title_template": "",
        "body_template": (
            "Gold price has {{direction_verb}} by ₹{{swing}} from {{baseline}} to {{current}}."
        ),
        "variables": ["direction_verb", "swing", "baseline", "current"],
        "description": "Body text when gold reference price moves (hourly digest and rate alerts).",
    },
    {
        "key": "gold_price_move_body",
        "name": "Gold price move — body (Malayalam)",
        "group": GROUP_GOLD,
        "locale": "ml",
        "title_template": "",
        "body_template": (
            "ഗോൾഡ് നിരക്ക് ₹{{swing}} {{direction_verb}} — ₹{{baseline}} ൽ നിന്ന് ₹{{current}} വരെ."
        ),
        "variables": ["direction_verb", "swing", "baseline", "current"],
        "description": "Malayalam body for gold price movement notifications.",
    },
]


def catalog_entry(key: str, locale: str = "en") -> SystemNotificationDef | None:
    loc = locale if locale in ("en", "ml") else "en"
    for row in SYSTEM_NOTIFICATION_CATALOG:
        if row["key"] == key and row["locale"] == loc:
            return row
    if loc != "en":
        return catalog_entry(key, "en")
    return None
