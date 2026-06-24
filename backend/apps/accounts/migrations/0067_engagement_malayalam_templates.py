from django.db import migrations


ML_ENGAGEMENT_TEMPLATES = [
    (
        "Total portfolio value down (ML)",
        "portfolio_value_down",
        "default",
        "ml",
        "ഗോൾഡ് വിപണി മാറി",
        (
            "ഇന്നത്തെ നിരക്ക് മാറ്റം ഏകദേശം {{value_change_amount}} കുറച്ചു. "
            "നിങ്ങളുടെ {{portfolio_weight}} മാറിയിട്ടില്ല — ദീർഘകാല ദൃഷ്ടിയിൽ നോക്കാം."
        ),
        ["value_change_amount", "portfolio_weight", "portfolio_value"],
    ),
    (
        "Personal collection up (ML)",
        "personal_collection_growth",
        "default",
        "ml",
        "നിങ്ങളുടെ ശേഖരം വളർന്നു",
        (
            "നിങ്ങളുടെ personal gold pieces ഏകദേശം {{personal_collection_gain}} കൂടി — "
            "ഇപ്പോൾ ഏകദേശം {{personal_collection_value}}."
        ),
        ["personal_collection_gain", "personal_collection_value"],
    ),
    (
        "Personal collection down (ML)",
        "personal_collection_down",
        "default",
        "ml",
        "ശേഖരത്തിന്റെ estimate മാറി",
        (
            "നിങ്ങൾ രേഖപ്പെടുത്തിയ gold pieces ഏകദേശം {{personal_collection_loss}} കുറഞ്ഞ estimate-ൽ. "
            "സ്വർണ്ണം നിങ്ങളുടേതാണ് — reference rate മാത്രം മാറി."
        ),
        ["personal_collection_loss", "personal_collection_value"],
    ),
    (
        "Individual holding down (ML)",
        "holding_value_down",
        "default",
        "ml",
        "വിപണി മാറി — {{holding_name}}",
        (
            "ഗോൾഡ് നിരക്ക് കുറഞ്ഞു — {{holding_name}} ഏകദേശം {{holding_loss_amount}} കുറഞ്ഞ estimate "
            "(~{{holding_value}} ഇപ്പോൾ). നിങ്ങളുടെ weight മാറില്ല."
        ),
        ["holding_name", "holding_loss_amount", "holding_value"],
    ),
    (
        "Individual holding up (ML)",
        "holding_appreciation",
        "default",
        "ml",
        "ശുഭവാർത്ത — {{holding_name}}",
        (
            "{{holding_name}} ഏകദേശം {{holding_gain_amount}} മൂല്യം കൂടി — "
            "ഇപ്പോൾ ~{{holding_value}}. {{years_held}} നിങ്ങൾ hold ചെയ്തു; gold-ന് value കൂട്ടി."
        ),
        ["holding_name", "holding_gain_amount", "holding_value", "years_held"],
    ),
    (
        "Portfolio growth (ML)",
        "portfolio_growth",
        "default",
        "ml",
        "പോർട്ട്ഫോളിയോ milestone",
        (
            "{{first_name}}, നിങ്ങളുടെ gold portfolio {{portfolio_gain_amount}} കൂടി — "
            "estimated total: {{portfolio_value}}."
        ),
        ["first_name", "portfolio_gain_amount", "portfolio_value"],
    ),
]


def seed_ml_engagement_templates(apps, schema_editor):
    NotificationTemplate = apps.get_model("accounts", "NotificationTemplate")
    for name, cat, ctx, loc, title, body, variables in ML_ENGAGEMENT_TEMPLATES:
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


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0066_portfolio_value_alerts"),
    ]

    operations = [
        migrations.RunPython(seed_ml_engagement_templates, migrations.RunPython.noop),
    ]
