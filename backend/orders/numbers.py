import secrets

# No I, L, O, 0 or 1: customers read these over the phone and WhatsApp.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
PREFIX = "KL-"
LENGTH = 8


def generate_order_number():
    return PREFIX + "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))
