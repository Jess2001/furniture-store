"""A thin client for Safaricom's Daraja API (M-Pesa STK push).

Everything that talks to Safaricom lives here, so the rest of the app never
builds a Daraja request by hand and tests can replace one function.
"""

import base64
import logging
import re
from dataclasses import dataclass
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


@dataclass(frozen=True)
class StkVerdict:
    """What Daraja says became of one STK push."""

    state: str  # "success" | "cancelled" | "failed" | "pending"
    code: int | None
    description: str


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


def _timestamp_and_password():
    timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
    ).decode()
    return timestamp, password


def stk_push(*, phone, amount, reference, description, callback_url):
    """Ask Safaricom to pop the 'enter your PIN' prompt on the customer's phone.

    Returns Safaricom's answer; its CheckoutRequestID is how the callback finds us.
    """
    timestamp, password = _timestamp_and_password()
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


def stk_query(checkout_request_id):
    """Ask Daraja what became of an STK push.

    This is how we double-check a callback before trusting it, and how we settle
    payments whose callback never arrived. It does not return the receipt number
    or the amount, only whether the customer paid.
    """
    timestamp, password = _timestamp_and_password()
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }
    try:
        response = requests.post(
            f"{_base_url()}/mpesa/stkpushquery/v1/query",
            json=payload,
            headers={"Authorization": f"Bearer {_access_token()}"},
            timeout=TIMEOUT_SECONDS,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.exception("M-Pesa STK query failed")
        raise MpesaError("We could not reach M-Pesa. Please try again.") from exc

    if "ResultCode" not in data:
        # While the customer is still deciding, Daraja answers with an error
        # saying the transaction is being processed. That means "not yet".
        if (
            data.get("errorCode") == "500.001.1001"
            or "being processed" in str(data.get("errorMessage", "")).lower()
        ):
            return StkVerdict("pending", None, "Still waiting for the customer.")
        raise MpesaError(data.get("errorMessage") or "Could not check the payment.")

    try:
        code = int(data["ResultCode"])
    except (TypeError, ValueError) as exc:
        raise MpesaError("M-Pesa sent an answer we could not read.") from exc
    state = "success" if code == 0 else "cancelled" if code == 1032 else "failed"
    return StkVerdict(state, code, str(data.get("ResultDesc", "")))
