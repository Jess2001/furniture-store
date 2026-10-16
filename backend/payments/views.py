import hmac
import logging

from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order

from . import services
from .serializers import MpesaPaySerializer

logger = logging.getLogger(__name__)


class MpesaPayView(APIView):
    """POST /payments/mpesa/pay/  {order_number, phone}  ->  sends the PIN prompt."""

    def post(self, request):
        serializer = MpesaPaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # scoping to the caller keeps other customers' orders unpayable and invisible
        order = get_object_or_404(
            Order,
            order_number=serializer.validated_data["order_number"],
            user=request.user,
        )
        payment = services.initiate_mpesa_payment(
            order, serializer.validated_data["phone"]
        )
        return Response(
            {"payment_id": str(payment.id), "status": payment.status},
            status=status.HTTP_202_ACCEPTED,
        )


class MpesaCallbackView(APIView):
    """Safaricom posts the result here. No login: the secret token in the URL is the gate."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, token):
        expected = settings.MPESA_CALLBACK_TOKEN
        if not expected or not hmac.compare_digest(token, expected):
            raise Http404
        try:
            services.record_mpesa_result(request.data)
        except Exception:
            # Always answer 200 so Safaricom does not hammer us; the full body is
            # in the log so the payment can be reconciled by hand.
            logger.exception("Could not process M-Pesa callback: %s", request.data)
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})
