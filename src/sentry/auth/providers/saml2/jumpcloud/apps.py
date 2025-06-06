from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.jumpcloud"

    def ready(self) -> None:
        from sentry.auth import register

        from .provider import JumpcloudSAML2Provider

        register(JumpcloudSAML2Provider)
