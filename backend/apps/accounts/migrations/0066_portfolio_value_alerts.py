from decimal import Decimal

from django.db import migrations, models


ENGAGEMENT_TEMPLATES = [
    (
        "Total portfolio value up (EN)",
        "portfolio_value_up",
        "default",
        "en",
        "Your gold grew today",
        (
            "{{first_name}}, your full portfolio is about {{portfolio_value}} — "
            "up {{value_change_amount}} as gold moved. Your {{portfolio_weight}} is still yours; "
            "the market re-priced it."
        ),
        ["first_name", "portfolio_value", "value_change_amount", "portfolio_weight"],
    ),
    (
        "Total portfolio value down (EN)",
        "portfolio_value_down",
        "default",
        "en",
        "Gold market moved",
        (
            "Today's rate shift trimmed about {{value_change_amount}} from your estimated total. "
            "Your {{portfolio_weight}} is unchanged — patient gold holders watch trends, not daily noise."
        ),
        ["value_change_amount", "portfolio_weight", "portfolio_value"],
    ),
    (
        "Personal collection up (EN)",
        "personal_collection_growth",
        "default",
        "en",
        "Your collection gained",
        (
            "Your personal gold pieces are up {{personal_collection_gain}} together — "
            "now about {{personal_collection_value}} estimated. A quiet win worth noticing."
        ),
        ["personal_collection_gain", "personal_collection_value"],
    ),
    (
        "Personal collection down (EN)",
        "personal_collection_down",
        "default",
        "en",
        "Collection estimate shifted",
        (
            "Your recorded pieces are about {{personal_collection_loss}} lower in today's estimate. "
            "The gold you logged is still yours — only the reference rate moved."
        ),
        ["personal_collection_loss", "personal_collection_value"],
    ),
    (
        "Individual holding down (EN)",
        "holding_value_down",
        "default",
        "en",
        "Market moved — {{holding_name}}",
        (
            "Gold dipped today — {{holding_name}} is about {{holding_loss_amount}} lower in estimate "
            "(~{{holding_value}} now). The weight you own is unchanged."
        ),
        ["holding_name", "holding_loss_amount", "holding_value"],
    ),
    (
        "Gold rate increase inbox (EN)",
        "market_rate_increase",
        "default",
        "en",
        "Gold rate rose",
        (
            "22K reference is up {{gold_change_percent}} — now {{gold_price}}. "
            "If you hold gold, your estimated value may reflect this over time."
        ),
        ["gold_change_percent", "gold_price"],
    ),
    (
        "Gold rate decrease inbox (EN)",
        "market_rate_decrease",
        "default",
        "en",
        "Gold rate eased",
        (
            "22K reference is down {{gold_change_percent}} — now {{gold_price}}. "
            "Short-term moves are normal in gold; your grams stay the same."
        ),
        ["gold_change_percent", "gold_price"],
    ),
    (
        "Individual holding up — refreshed (EN)",
        "holding_appreciation",
        "default",
        "en",
        "Good news — {{holding_name}}",
        (
            "{{holding_name}} gained {{holding_gain_amount}} in estimated value — "
            "now about {{holding_value}}. You've held it {{years_held}}; gold did the heavy lifting."
        ),
        ["holding_name", "holding_gain_amount", "holding_value", "years_held"],
    ),
    (
        "Portfolio growth — refreshed (EN)",
        "portfolio_growth",
        "default",
        "en",
        "Portfolio milestone moment",
        (
            "{{first_name}}, your gold portfolio is up {{portfolio_gain_amount}} versus what you paid in. "
            "Estimated total: {{portfolio_value}}."
        ),
        ["first_name", "portfolio_gain_amount", "portfolio_value"],
    ),
    (
        "Total portfolio up (ML)",
        "portfolio_value_up",
        "default",
        "ml",
        "നിങ്ങളുടെ സ്വർണ്ണം വളർന്നു",
        (
            "{{first_name}}, പൂർണ്ണ പോർട്ട്ഫോളിയോ ഏകദേശം {{portfolio_value}} — "
            "{{value_change_amount}} കൂടി. {{portfolio_weight}} നിങ്ങളുടേതാണ്."
        ),
        ["first_name", "portfolio_value", "value_change_amount", "portfolio_weight"],
    ),
    (
        "Gold rate up (ML)",
        "market_rate_increase",
        "default",
        "ml",
        "ഗോൾഡ് നിരക്ക് കൂടി",
        "22K നിരക്ക് {{gold_change_percent}} കൂടി — ഇപ്പോൾ {{gold_price}}.",
        ["gold_change_percent", "gold_price"],
    ),
    (
        "Gold rate down (ML)",
        "market_rate_decrease",
        "default",
        "ml",
        "ഗോൾഡ് നിരക്ക് കുറഞ്ഞു",
        "22K നിരക്ക് {{gold_change_percent}} കുറഞ്ഞു — ഇപ്പോൾ {{gold_price}}. ഗ്രാം മാറില്ല.",
        ["gold_change_percent", "gold_price"],
    ),
]


def seed_portfolio_engagement(apps, schema_editor):
    NotificationTemplate = apps.get_model("accounts", "NotificationTemplate")
    SystemNotificationMessage = apps.get_model("accounts", "SystemNotificationMessage")

    for name, cat, ctx, loc, title, body, variables in ENGAGEMENT_TEMPLATES:
        NotificationTemplate.objects.update_or_create(
            category=cat,
            context=ctx,
            locale=loc,
            defaults={
                "name": name,
                "title_template": title,
                "body_template": body,
                "variables": variables,
                "is_active": True,
            },
        )

    from apps.accounts.services.system_notification_catalog import SYSTEM_NOTIFICATION_CATALOG

    for row in SYSTEM_NOTIFICATION_CATALOG:
        if row["key"] not in (
            "gold_rate_alert_title_up",
            "gold_rate_alert_title_down",
            "gold_hourly_push_title_up",
            "gold_hourly_push_title_down",
            "gold_price_move_body_up",
            "gold_price_move_body_down",
        ):
            continue
        SystemNotificationMessage.objects.update_or_create(
            key=row["key"],
            locale=row["locale"],
            defaults={
                "name": row["name"],
                "group": row["group"],
                "description": row["description"],
                "title_template": row["title_template"],
                "body_template": row["body_template"],
                "variables": row["variables"],
                "alternative_titles": [],
                "alternative_bodies": [],
                "is_active": True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0065_rename_accounts_cl_surface_8a1f0d_idx_accounts_cl_surface_29148e_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userportfolionotificationstate",
            name="last_notified_total_value_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Total estimated portfolio INR at last portfolio_value_up/down alert.",
                max_digits=18,
            ),
        ),
        migrations.AddField(
            model_name="userportfolionotificationstate",
            name="last_notified_personal_value_inr",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Personal holdings aggregate INR at last personal_collection alert.",
                max_digits=18,
            ),
        ),
        migrations.RunPython(seed_portfolio_engagement, migrations.RunPython.noop),
    ]
