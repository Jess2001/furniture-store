from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from orders import services


class Command(BaseCommand):
    help = "Cancel unpaid orders whose stock reservation has expired and release their stock."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report how many orders would be expired.",
        )

    def handle(self, *args, **options):
        if options["dry_run"]:
            count = services.stale_orders(timezone.now()).count()
            self.stdout.write(
                f"{count} order(s) would be expired (dry run, nothing changed)."
            )
            return

        expired, failed = services.expire_stale_orders()
        self.stdout.write(self.style.SUCCESS(f"Expired {expired} order(s)."))
        if failed:
            raise CommandError(f"{failed} order(s) could not be expired; see the log.")
