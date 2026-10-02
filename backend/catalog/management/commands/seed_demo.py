from urllib.parse import quote_plus

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.models import Category, Product, ProductImage, ProductVariant
from inventory.models import Inventory

CATEGORIES = [
    (
        "Living Room",
        "living-room",
        "Deep sectionals, textured lounge armchairs, coffee pedestals & console tables.",
        "E3DDD1",
    ),
    (
        "Dining",
        "dining",
        "Solid timber extending dining tables, sculptural seating, credenzas & buffets.",
        "D9C7A8",
    ),
    (
        "Bedroom",
        "bedroom",
        "Platform bed frames, upholstered headboards, nightstands & cedar chests.",
        "CFC8BC",
    ),
    (
        "Home Office",
        "home-office",
        "Solid wood writing desks, cable management units, ergonomic executive seating.",
        "C9BFAE",
    ),
    (
        "Storage & Media",
        "storage-media",
        "Slatted credenzas, media sideboards, tailored shelving towers & armoires.",
        "BFB5A3",
    ),
    (
        "Outdoor Living",
        "outdoor-living",
        "Weather-ready teak lounge sets, garden benches & shaded dining.",
        "B8C2A8",
    ),
]

# (name, slug, category slug, badge, featured, description,
#  [(sku, variant name, color, hex, dimensions, price, compare_at, stock)])
PRODUCTS = [
    (
        "Mara 3-Seater Linen Sofa",
        "mara-3-seater-linen-sofa",
        "living-room",
        "Best Seller",
        True,
        "Deep, hand-upholstered three-seater in heavyweight Belgian linen on a kiln-dried Mvule frame.",
        [
            (
                "MARA-SOFA-SAND",
                "Mara Sofa, Sand Linen",
                "Sand Linen",
                "#E3DDD1",
                "220 x 95 x 85 cm",
                84500,
                92000,
                1,
            ),
            (
                "MARA-SOFA-CHARCOAL",
                "Mara Sofa, Charcoal",
                "Charcoal",
                "#3A3A3C",
                "220 x 95 x 85 cm",
                84500,
                92000,
                1,
            ),
            (
                "MARA-SOFA-FOREST",
                "Mara Sofa, Forest",
                "Forest",
                "#3F5A3A",
                "220 x 95 x 85 cm",
                88000,
                96000,
                1,
            ),
        ],
    ),
    (
        "Naivasha Teak Dining Table (8-Seater)",
        "naivasha-teak-dining-table-8-seater",
        "dining",
        "Solid Wood",
        True,
        "Hand-oiled solid teak with mortise-and-tenon joinery. Comfortably seats eight to ten.",
        [
            (
                "NAIVASHA-TABLE-NATURAL",
                "Naivasha Table, Natural Teak",
                "Natural Teak",
                "#B07A45",
                "240 x 100 x 76 cm",
                115000,
                None,
                6,
            ),
            (
                "NAIVASHA-TABLE-DARK",
                "Naivasha Table, Dark Oiled Teak",
                "Dark Oiled Teak",
                "#5A3B22",
                "240 x 100 x 76 cm",
                118000,
                None,
                4,
            ),
        ],
    ),
    (
        "Ol Pejeta Woven Rattan Armchair",
        "ol-pejeta-woven-rattan-armchair",
        "living-room",
        "",
        True,
        "Solid ash frame hand-woven with Kenyan natural cane.",
        [
            (
                "OLPEJETA-ARMCHAIR-CANE",
                "Ol Pejeta Armchair, Natural Cane",
                "Natural Cane",
                "#C9A96E",
                "68 x 72 x 82 cm",
                34200,
                None,
                12,
            )
        ],
    ),
    (
        "Baringo Platform Bed + Stands",
        "baringo-platform-bed-stands",
        "bedroom",
        "Bespoke Option",
        True,
        "Low platform bed in solid timber with matching bedside stands.",
        [
            (
                "BARINGO-BED-QUEEN",
                "Baringo Bed, Queen",
                "",
                "",
                "Queen 160 x 200 cm",
                96000,
                None,
                4,
            ),
            (
                "BARINGO-BED-KING",
                "Baringo Bed, King",
                "",
                "",
                "King 180 x 200 cm",
                112000,
                None,
                0,
            ),
        ],
    ),
    (
        "Kinangop Coffee Table",
        "kinangop-coffee-table",
        "living-room",
        "",
        False,
        "Low solid cypress coffee table with a hand-planed top.",
        [
            (
                "KINANGOP-COFFEE-NATURAL",
                "Kinangop Coffee Table, Natural",
                "Natural",
                "#C8A27A",
                "110 x 60 x 38 cm",
                28500,
                None,
                7,
            )
        ],
    ),
    (
        "Karen Credenza",
        "karen-credenza",
        "dining",
        "",
        False,
        "Four-door credenza with soft-close doors and adjustable shelves.",
        [
            (
                "KAREN-CREDENZA-WALNUT",
                "Karen Credenza, Walnut",
                "Walnut",
                "#6B4A32",
                "180 x 45 x 80 cm",
                62000,
                None,
                3,
            )
        ],
    ),
    (
        "Mvule Writing Desk",
        "mvule-writing-desk",
        "home-office",
        "Solid Wood",
        False,
        "Solid Mvule desk with a cable channel and a single drawer.",
        [
            (
                "MVULE-DESK-NATURAL",
                "Mvule Writing Desk, Natural",
                "Natural",
                "#A9784A",
                "140 x 70 x 75 cm",
                48000,
                None,
                5,
            )
        ],
    ),
    (
        "Runda Executive Chair",
        "runda-executive-chair",
        "home-office",
        "",
        False,
        "Ergonomic executive chair with breathable woven upholstery.",
        [
            (
                "RUNDA-CHAIR-GREY",
                "Runda Chair, Grey",
                "Grey",
                "#8A8D91",
                "65 x 65 x 115 cm",
                36500,
                None,
                0,
            )
        ],
    ),
    (
        "Lamu Slatted Sideboard",
        "lamu-slatted-sideboard",
        "storage-media",
        "",
        False,
        "Slatted media sideboard with cable pass-throughs.",
        [
            (
                "LAMU-SIDEBOARD-NATURAL",
                "Lamu Sideboard, Natural",
                "Natural",
                "#C19A6B",
                "200 x 40 x 60 cm",
                54000,
                None,
                9,
            )
        ],
    ),
    (
        "Tsavo Shelving Tower",
        "tsavo-shelving-tower",
        "storage-media",
        "",
        False,
        "Tall five-shelf tower in solid cypress.",
        [
            (
                "TSAVO-SHELF-NATURAL",
                "Tsavo Shelving Tower, Natural",
                "Natural",
                "#C8A27A",
                "80 x 35 x 190 cm",
                41000,
                None,
                10,
            )
        ],
    ),
    (
        "Nyali Outdoor Lounge Set",
        "nyali-outdoor-lounge-set",
        "outdoor-living",
        "Solid Wood",
        False,
        "Weather-ready teak lounge set with quick-dry cushions.",
        [
            (
                "NYALI-LOUNGE-TEAK",
                "Nyali Lounge Set, Teak",
                "Teak",
                "#B07A45",
                "Set of 4",
                135000,
                None,
                2,
            )
        ],
    ),
    (
        "Diani Teak Garden Bench",
        "diani-teak-garden-bench",
        "outdoor-living",
        "",
        False,
        "Two-seater garden bench in solid teak.",
        [
            (
                "DIANI-BENCH-TEAK",
                "Diani Garden Bench, Teak",
                "Teak",
                "#B07A45",
                "130 x 55 x 85 cm",
                39500,
                None,
                6,
            )
        ],
    ),
    (
        "Rift Bedside Table",
        "rift-bedside-table",
        "bedroom",
        "",
        False,
        "Single-drawer bedside table in solid cypress.",
        [
            (
                "RIFT-BEDSIDE-NATURAL",
                "Rift Bedside Table, Natural",
                "Natural",
                "#C8A27A",
                "45 x 40 x 55 cm",
                18900,
                None,
                15,
            )
        ],
    ),
]


def placeholder(text, bg, size="800x1000"):
    return f"https://placehold.co/{size}/{bg}/3B2A1A?text={quote_plus(text)}"


class Command(BaseCommand):
    help = "Create realistic demo categories, products, variants and stock. Safe to run repeatedly."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true", help="Allow running with DEBUG off."
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed demo data with DEBUG off. Use --force if you really mean it."
            )

        categories = {}
        for order, (name, slug, description, bg) in enumerate(CATEGORIES, start=1):
            categories[slug], _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "description": description,
                    "image_url": placeholder(name, bg, "800x600"),
                    "sort_order": order,
                    "is_active": True,
                },
            )

        variant_total = 0
        for (
            name,
            slug,
            category_slug,
            badge,
            featured,
            description,
            variants,
        ) in PRODUCTS:
            product, _ = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "category": categories[category_slug],
                    "description": description,
                    "badge": badge,
                    "is_featured": featured,
                    "status": Product.Status.INACTIVE,  # activated below, once it has variants
                },
            )
            for (
                sku,
                variant_name,
                color,
                color_hex,
                dimensions,
                price,
                compare_at,
                stock,
            ) in variants:
                variant, _ = ProductVariant.objects.update_or_create(
                    sku=sku,
                    defaults={
                        "product": product,
                        "name": variant_name,
                        "color": color,
                        "color_hex": color_hex,
                        "dimensions": dimensions,
                        "price": price,
                        "compare_at_price": compare_at,
                        "is_active": True,
                    },
                )
                Inventory.objects.update_or_create(
                    variant=variant,
                    defaults={"quantity": stock, "reserved_quantity": 0},
                )
                variant_total += 1

            product.images.all().delete()
            ProductImage.objects.create(
                product=product,
                image_url=placeholder(name, "E8E0D2"),
                alt_text=f"{name}, front view",
                sort_order=0,
                is_primary=True,
            )
            ProductImage.objects.create(
                product=product,
                image_url=placeholder(f"{name} detail", "D9CFBE"),
                alt_text=f"{name}, detail",
                sort_order=1,
            )
            product.status = Product.Status.ACTIVE
            product.save(update_fields=["status", "updated_at"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(categories)} categories, {len(PRODUCTS)} products, {variant_total} variants."
            )
        )
