from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "password"]
        read_only_fields = ["id"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
        }

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        candidate = User(
            email=attrs.get("email"),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "role"]
        read_only_fields = fields


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
