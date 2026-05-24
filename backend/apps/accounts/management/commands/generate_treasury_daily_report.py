"""Write daily treasury snapshot JSON (stdout or file)."""

from __future__ import annotations

import json
from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.services.platform_treasury_ledger import treasury_daily_report_snapshot


class Command(BaseCommand):
    help = "Generate treasury daily report snapshot JSON."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, default="", help="ISO date (default: today)")
        parser.add_argument("--output", type=str, default="", help="Optional output file path")

    def handle(self, *args, **options):
        raw = (options.get("date") or "").strip()
        report_date: date | None = None
        if raw:
            report_date = date.fromisoformat(raw)
        snapshot = treasury_daily_report_snapshot(report_date)
        body = json.dumps(snapshot, indent=2)
        out_path = (options.get("output") or "").strip()
        if out_path:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(body)
            self.stdout.write(self.style.SUCCESS(f"Wrote {out_path}"))
        else:
            self.stdout.write(body)
