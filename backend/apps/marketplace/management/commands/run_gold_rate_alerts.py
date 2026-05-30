from django.core.management.base import BaseCommand

from apps.marketplace.platform_gold_notify import run_platform_gold_rate_notifications


class Command(BaseCommand):
    help = (
        "Check public 22K reference vs baseline; broadcast + customer inbox when threshold met. "
        "Schedule every 1–5 minutes on Railway."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Bypass cache lock (use after admin ticker save).",
        )

    def handle(self, *args, **options):
        out = run_platform_gold_rate_notifications(force=bool(options.get("force")))
        self.stdout.write(self.style.SUCCESS(str(out)))
