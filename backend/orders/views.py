

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Order
from .serializers import CheckoutSerializer, OrderListSerializer, OrderSerializer


class CheckoutView(APIView):
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipping = dict(serializer.validated_data)
        expected_subtotal = shipping.pop("expected_subtotal", None)

        order = services.checkout(request.user, shipping, expected_subtotal)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderListView(generics.ListAPIView):
    serializer_class = OrderListSerializer

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .annotate(item_count=Sum("items__quantity"))
            .order_by(
                "-created_at", "id"
            )  # spelled out: Meta.ordering is ignored with aggregates
        )


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    lookup_field = "order_number"

    def get_queryset(self):
        # scoping to the caller is what keeps other customers' orders invisible
        return Order.objects.filter(user=self.request.user).prefetch_related("items")


class OrderCancelView(APIView):
    def post(self, request, order_number):
        order = get_object_or_404(Order, order_number=order_number, user=request.user)
        order = services.cancel_order(order)
        return Response(OrderSerializer(order).data)
