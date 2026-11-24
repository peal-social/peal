"""The smoke test, which scripts/test.ts runs against a stand-in API: the
health check, the credential check with a bearer token, and the error a
refused token raises, through the wheel as PyPI ships it."""
import os

from peal import Credential_ApiKey, Peal
from peal.core.api_error import ApiError

base_url = os.environ["PEAL_API_URL"]
peal = Peal(base_url=base_url, token="peal_test")

peal.system.health()
credential = peal.credential.get()

assert isinstance(credential, Credential_ApiKey), credential
assert credential.workspace.name == "Studio", credential
assert credential.expires_at is None and credential.start is None, credential
assert "post:schedule" in credential.permissions, credential

try:
    Peal(base_url=base_url, token="refused").credential.get()
except ApiError as error:
    assert error.status_code == 401, error
else:
    raise AssertionError("A refused token got an answer")

print("ok")
