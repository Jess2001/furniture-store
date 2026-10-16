import pytest

from payments import mpesa

pytestmark = pytest.mark.django_db


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload


@pytest.fixture
def daraja_says(monkeypatch):
    def say(payload, status=200):
        monkeypatch.setattr(mpesa, "_access_token", lambda: "token")
        monkeypatch.setattr(
            mpesa.requests, "post", lambda *a, **k: FakeResponse(payload, status)
        )

    return say


@pytest.mark.parametrize(
    "result_code, state",
    [
        ("0", "success"),
        (0, "success"),
        ("1032", "cancelled"),
        ("2001", "failed"),
        ("1", "failed"),
    ],
)
def test_the_query_turns_daraja_result_codes_into_a_state(
    daraja_says, result_code, state
):
    daraja_says({"ResponseCode": "0", "ResultCode": result_code, "ResultDesc": "x"})

    verdict = mpesa.stk_query("ws_CO_1")

    assert verdict.state == state
    assert verdict.code == int(result_code)


def test_a_transaction_still_being_processed_means_not_yet(daraja_says):
    daraja_says(
        {
            "errorCode": "500.001.1001",
            "errorMessage": "The transaction is being processed",
        },
        status=500,
    )

    assert mpesa.stk_query("ws_CO_1").state == "pending"


def test_an_unexplained_error_is_raised_not_guessed_at(daraja_says):
    daraja_says(
        {"errorCode": "404.001.03", "errorMessage": "Invalid Access Token"}, status=404
    )

    with pytest.raises(mpesa.MpesaError):
        mpesa.stk_query("ws_CO_1")


def test_an_unreadable_result_code_is_raised(daraja_says):
    daraja_says({"ResultCode": "abc"})

    with pytest.raises(mpesa.MpesaError):
        mpesa.stk_query("ws_CO_1")
