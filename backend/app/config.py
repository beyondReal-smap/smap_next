import os
from pathlib import Path

from app.core.config import settings as core_settings


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}


class _SettingsProxy:
    def __init__(self, base_settings):
        self._base_settings = base_settings
        self.EMAIL_SENDER = os.getenv("EMAIL_SENDER", "")
        self.EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
        self.EMAIL_SMTP_SERVER = os.getenv("EMAIL_SMTP_SERVER", "smtp.gmail.com")
        self.EMAIL_SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "465"))

    def __getattr__(self, name):
        return getattr(self._base_settings, name)


settings = _SettingsProxy(core_settings)

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


def _resolve_path(path_value: str) -> str:
    path = Path(path_value)
    if path.is_absolute():
        return str(path)
    if path_value.startswith("backend/"):
        return str(REPO_ROOT / path_value)
    return str(BACKEND_DIR / path_value)


class Config:
    FIREBASE_CREDENTIALS_PATH = _resolve_path(
        os.getenv(
            "FIREBASE_CREDENTIALS_PATH",
            settings.FIREBASE_CREDENTIALS_PATH,
        )
    )
    IOS_BUNDLE_ID = os.getenv("IOS_BUNDLE_ID", "com.dmonster.smap")
    IOS_PUSH_RETRY_COUNT = int(os.getenv("IOS_PUSH_RETRY_COUNT", "3"))

    PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
    PASSWORD_BCRYPT_COST = int(os.getenv("PASSWORD_BCRYPT_COST", "12"))
    PASSWORD_REQUIRE_UPPERCASE = _get_bool("PASSWORD_REQUIRE_UPPERCASE", True)
    PASSWORD_REQUIRE_LOWERCASE = _get_bool("PASSWORD_REQUIRE_LOWERCASE", True)
    PASSWORD_REQUIRE_NUMBERS = _get_bool("PASSWORD_REQUIRE_NUMBERS", True)
    PASSWORD_REQUIRE_SPECIAL = _get_bool("PASSWORD_REQUIRE_SPECIAL", True)
