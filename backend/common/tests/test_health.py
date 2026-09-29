
import pytest


@pytest.mark.django_db
def test_health_endpoint():
    from django.urls import reverse
    from rest_framework.test import APIClient

    client = APIClient()

    response = client.get(reverse("health-check"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


