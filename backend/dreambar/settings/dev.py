"""Локальная разработка."""
from .base import *  # noqa
from .base import env_bool

DEBUG = env_bool('DEBUG', True)

ALLOWED_HOSTS = ['*']

# В разработке фронт крутится на http://localhost:4200 — пускаем всех.
CORS_ALLOW_ALL_ORIGINS = True

# Письма и прочее — в консоль.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
