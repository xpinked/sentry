from __future__ import annotations

from base64 import urlsafe_b64encode
from functools import cached_property
from time import time
from typing import TYPE_CHECKING
from urllib.parse import urlparse

import orjson
from cryptography.exceptions import InvalidKey, InvalidSignature
from django.http.request import HttpRequest
from django.urls import reverse
from django.utils.functional import classproperty
from django.utils.translation import gettext_lazy as _
from fido2 import cbor
from fido2.client import ClientData
from fido2.ctap2 import AuthenticatorData, base
from fido2.server import Fido2Server, U2FFido2Server
from fido2.utils import websafe_decode
from fido2.webauthn import PublicKeyCredentialRpEntity
from u2flib_server.model import DeviceRegistration

from sentry import options
from sentry.auth.authenticators.base import EnrollmentStatus
from sentry.utils.dates import to_datetime
from sentry.utils.http import absolute_uri

from .base import ActivationChallengeResult, AuthenticatorInterface

if TYPE_CHECKING:
    from sentry.users.models.user import User


def decode_credential_id(device) -> str:
    return urlsafe_b64encode(device["binding"].credential_data.credential_id).decode("ascii")


def create_credential_object(registeredKey: dict[str, str]) -> base:
    return base.AttestedCredentialData.from_ctap1(
        websafe_decode(registeredKey["keyHandle"]),
        websafe_decode(registeredKey["publicKey"]),
    )


def _get_url_prefix() -> str:
    return options.get("system.url-prefix")


class U2fInterface(AuthenticatorInterface):
    type = 3
    interface_id = "u2f"
    configure_button = _("Configure")
    name = _("Passkey / Biometric / Security Key")
    description = _(
        "Authenticate using a Passkey, Biometrics, or a physical security key such as a YubiKey."
    )
    allow_multi_enrollment = True

    @cached_property
    def rp_id(self) -> str | None:
        # rp is a relying party for webauthn, this would be sentry.io for SAAS
        # and the prefix for self-hosted / dev environments
        return urlparse(_get_url_prefix()).hostname

    @cached_property
    def rp(self) -> PublicKeyCredentialRpEntity:
        return PublicKeyCredentialRpEntity(self.rp_id, "Sentry")

    @cached_property
    def webauthn_registration_server(self) -> Fido2Server:
        return Fido2Server(self.rp)

    def __init__(
        self, authenticator=None, status: EnrollmentStatus = EnrollmentStatus.EXISTING
    ) -> None:
        super().__init__(authenticator, status)

        self.webauthn_authentication_server = U2FFido2Server(
            app_id=self.u2f_app_id, rp={"id": self.rp_id, "name": "Sentry"}
        )

    @classproperty
    def u2f_app_id(cls):
        rv = options.get("u2f.app-id")
        return rv or absolute_uri(reverse("sentry-u2f-app-id"))

    @classproperty
    def u2f_facets(cls):
        facets = options.get("u2f.facets")
        if not facets:
            return [_get_url_prefix()]
        return [x.rstrip("/") for x in facets]

    @classproperty
    def is_available(cls):
        url_prefix = _get_url_prefix()
        return url_prefix and url_prefix.startswith("https://")

    def _get_kept_devices(self, key: str):
        def _key_does_not_match(device):
            if isinstance(device["binding"], AuthenticatorData):
                return decode_credential_id(device) != key
            else:
                return device["binding"]["keyHandle"] != key

        return [device for device in self.config.get("devices", ()) if _key_does_not_match(device)]

    def generate_new_config(self):
        return {}

    def start_enrollment(self, user: User) -> tuple[cbor, Fido2Server]:
        credentials = self.credentials()
        registration_data, state = self.webauthn_registration_server.register_begin(
            user={
                "id": user.id.to_bytes(64, byteorder="big"),
                "name": user.username,
                "displayName": user.username,
            },
            credentials=credentials,
            # user_verification is where the authenticator verifies that the user is authorized
            # to use the authenticator, this isn't needed for our usecase so set a discouraged
            user_verification="discouraged",
        )
        return cbor.encode(registration_data), state

    def get_u2f_devices(self):
        rv = []
        for data in self.config.get("devices", ()):
            # XXX: The previous version of python-u2flib-server didn't store
            # the `version` in the device binding. Defaulting to `U2F_V2` here
            # so that we don't break existing u2f registrations.
            if isinstance(data["binding"], AuthenticatorData):
                rv.append(data["binding"])
            else:
                data["binding"].setdefault("version", "U2F_V2")
                rv.append(DeviceRegistration(data["binding"]))
        return rv

    def credentials(self):
        credentials = []
        # there are 2 types of registered keys from the registered devices, those with type
        # AuthenticatorData are those from WebAuthn registered devices that we don't have to modify
        # the other is those registered with u2f-api and it a dict with the keys keyHandle and publicKey
        for device in self.get_u2f_devices():
            if isinstance(device, AuthenticatorData):
                credentials.append(device.credential_data)
            else:
                credentials.append(create_credential_object(device))
        return credentials

    def remove_u2f_device(self, key: str) -> bool:
        """Removes a U2F device but never removes the last one.  This returns
        False if the last device would be removed.
        """
        devices = self._get_kept_devices(key)

        if devices:
            self.config["devices"] = devices
            return True
        return False

    def get_device_name(self, key: str):
        for device in self.config.get("devices", ()):
            if isinstance(device["binding"], AuthenticatorData):
                if decode_credential_id(device) == key:
                    return device["name"]
            elif device["binding"]["keyHandle"] == key:
                return device["name"]

    def get_registered_devices(self):
        rv = []
        for device in self.config.get("devices", ()):
            if isinstance(device["binding"], AuthenticatorData):
                rv.append(
                    {
                        "timestamp": to_datetime(device["ts"]),
                        "name": device["name"],
                        "key_handle": decode_credential_id(device),
                        "app_id": self.rp_id,
                    }
                )
            else:
                rv.append(
                    {
                        "timestamp": to_datetime(device["ts"]),
                        "name": device["name"],
                        "key_handle": device["binding"]["keyHandle"],
                        "app_id": device["binding"]["appId"],
                    }
                )
        rv.sort(key=lambda x: x["name"])
        return rv

    def try_enroll(
        self, enrollment_data: str, response_data: str, device_name=None, state=None
    ) -> None:
        data = orjson.loads(response_data)
        client_data = ClientData(websafe_decode(data["response"]["clientDataJSON"]))
        att_obj = base.AttestationObject(websafe_decode(data["response"]["attestationObject"]))
        binding = self.webauthn_registration_server.register_complete(state, client_data, att_obj)
        devices = self.config.setdefault("devices", [])
        devices.append(
            {"name": device_name or "Security Key", "ts": int(time()), "binding": binding}
        )

    def activate(self, request: HttpRequest) -> ActivationChallengeResult:
        credentials = self.credentials()
        challenge, state = self.webauthn_authentication_server.authenticate_begin(
            credentials=credentials
        )
        request.session["webauthn_authentication_state"] = state
        return ActivationChallengeResult(challenge=cbor.encode(challenge["publicKey"]))

    def validate_response(self, request: HttpRequest, challenge, response) -> bool:
        try:
            credentials = self.credentials()
            self.webauthn_authentication_server.authenticate_complete(
                state=request.session.get("webauthn_authentication_state"),
                credentials=credentials,
                credential_id=websafe_decode(response["keyHandle"]),
                client_data=ClientData(websafe_decode(response["clientData"])),
                auth_data=AuthenticatorData(websafe_decode(response["authenticatorData"])),
                signature=websafe_decode(response["signatureData"]),
            )
        except (InvalidSignature, InvalidKey, StopIteration):
            return False
        finally:
            # Cleanup the U2F state from the session
            request.session.pop("webauthn_authentication_state", None)
        return True
