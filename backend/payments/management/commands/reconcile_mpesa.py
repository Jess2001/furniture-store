from datetime import timedelta

from django.core.management.base import BaseCommand

from payments import services


class Command(BaseCommand):
    help = (
        "Settle M-Pesa payments whose callback never arrived, by asking Daraja what "
        "became of each prompt. Run it every few minutes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-age",
            type=int,
            default=90,
            help="Only look at prompts at least this many seconds old (default 90).",
        )
        parser.add_argument(
            "--max-age-hours",
            type=int,
            default=48,
            help="Ignore prompts older than this (default 48).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=50,
            help="Check at most this many payments per run (default 50).",
        )

    def handle(self, *args, **options):
        counts = services.reconcile_pending_payments(
            min_age=timedelta(seconds=options["min_age"]),
            max_age=timedelta(hours=options["max_age_hours"]),
            limit=options["limit"],
        )
        if not counts:
            self.stdout.write("Nothing to reconcile.")
            return
        summary = ", ".join(
            f"{count} {outcome}" for outcome, count in sorted(counts.items())
        )
        self.stdout.write(self.style.SUCCESS(f"Reconciled: {summary}."))
