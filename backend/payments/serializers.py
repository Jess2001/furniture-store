from rest_framework import serializers


class MpesaPaySerializer(serializers.Serializer):
    order_number = serializers.CharField(max_length=50)
    phone = serializers.CharField(max_length=30)
