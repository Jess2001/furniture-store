"""A thin client for Safaricom's Daraja API (M-Pesa STK push).

Everything that talks to Safaricom lives here, so the rest of the app never
builds a Daraja request by hand and tests can replace one function.
"""

import base64
import logging
import re
from decimal import ROUND_CEILING, Decimal

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15
TOKEN_CACHE_KEY = "mpesa_access_token"


class MpesaError(Exception):
    """Safaricom could not be reached, or refused the request."""


def _base_url():
    if settings.MPESA_ENV == "production":
        return "https://api.safaricom.co.ke"
    return "https://sandbox.safaricom.co.ke"


def whole_shillings(amount):
    """M-Pesa only takes whole shillings, so round any cents up."""
    return Decimal(amount).to_integral_value(rounding=ROUND_CEILING)


def normalize_phone(raw):
    """Turn +254 7xx xxx xxx, 07xx..., 01xx... or 254... into 2547xxxxxxxx / 2541xxxxxxxx."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif len(digits) == 9 and digits[0] in "71":
        digits = "254" + digits
    if not re.fullmatch(r"254[71]\d{8}", digits):
        raise ValidationError(
            {"phone": ["Enter a valid Safaricom number, e.g. 0712 345 678."]}
        )
    return digits


def _access_token():
    token = cache.get(TOKEN_CACHE_KEY)
    if token:
        return token
    try:
        response = requests.get(
            f"{_base_url()}/oauth/v1/generate",
            params={"grant_type": "client_credentials"},
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        token = data["access_token"]
    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.exception("Could not get an M-Pesa access token")
        raise MpesaError("We could not reach M-Pesa. Please try again.") from exc
    cache.set(TOKEN_CACHE_KEY, token, max(60, int(data.get("expires_in", 3599)) - 60))
    return token


def stk_push(*, phone, amount, reference, description, callback_url):
    """Ask Safaricom to pop the 'enter your PIN' prompt on the customer's phone.

    Returns Safaricom's answer; its CheckoutRequestID is how the callback finds us.
    """
    timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
    ).decode()
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": reference[:12],
        "TransactionDesc": description[:13],
    }
    try:
        response = requests.post(
            f"{_base_url()}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {_access_token()}"},
            timeout=TIMEOUT_SECONDS,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.exception("M-Pesa STK push request failed")
        raise MpesaError("We could not reach M-Pesa. Please try again.") from exc

    if response.status_code != 200 or str(data.get("ResponseCode")) != "0":
        logger.warning("M-Pesa refused the STK push: %s", data)
        raise MpesaError(
            data.get("errorMessage")
            or data.get("CustomerMessage")
            or "M-Pesa did not accept the request. Please try again."
        )
    return data
