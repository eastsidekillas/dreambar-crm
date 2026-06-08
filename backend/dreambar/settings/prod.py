"""Продакшен."""
from .base import *  # noqa
from .base import env, env_list

if SECRET_KEY == 'django-insecure-dev-only-change-me':
    raise RuntimeError(
        'DJANGO_SECRET_KEY не задан. Обязательно задайте переменную окружения в production.'
    )

DEBUG = False

# Сжатая статика с manifest-хешами (whitenoise). Требует collectstatic.
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# Хосты и доверенные источники задаются через .env (через запятую).
ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', [])

# Один origin = фронтенд (nginx). Если фронт и API на одном домене — CORS не нужен,
# но оставляем настраиваемым на случай отдельного домена.
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', [])
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', [])

# ── security ─────────────────────────────────────────────────────────────────
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Включается, когда сайт работает по HTTPS (за nginx/traefik с TLS).
_ssl = env('SECURE_SSL', 'false').lower() in ('1', 'true', 'yes', 'on')
SECURE_SSL_REDIRECT = _ssl
SESSION_COOKIE_SECURE = _ssl
CSRF_COOKIE_SECURE = _ssl
SECURE_HSTS_SECONDS = 31536000 if _ssl else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = _ssl
SECURE_HSTS_PRELOAD = _ssl

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ── logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '[{asctime}] {levelname} {name}: {message}', 'style': '{'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False},
    },
}
