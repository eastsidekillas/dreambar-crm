"""
Базовые настройки DreamBar — общие для всех окружений.
Конкретные значения переопределяются в dev.py / prod.py и через переменные
окружения (.env).
"""
import os
from pathlib import Path
from datetime import timedelta

# .../backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Подхватываем .env из корня backend, если он есть (локальная разработка).
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass


# ── helpers ──────────────────────────────────────────────────────────────────
def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(key, default=None):
    val = os.environ.get(key)
    if not val:
        return default or []
    return [item.strip() for item in val.split(',') if item.strip()]


# ── core ─────────────────────────────────────────────────────────────────────
SECRET_KEY = env('DJANGO_SECRET_KEY', 'django-insecure-dev-only-change-me')
DEBUG = env_bool('DEBUG', False)
ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', ['localhost', '127.0.0.1'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'apps.orders',
    'apps.analytics',
    'apps.exports',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'dreambar.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'dreambar.wsgi.application'


# ── database ─────────────────────────────────────────────────────────────────
# Postgres, если задан DATABASE_NAME, иначе SQLite (локальная разработка).
if env('DATABASE_NAME'):
    DATABASES = {
        'default': {
            'ENGINE': env('DATABASE_ENGINE', 'django.db.backends.postgresql'),
            'NAME': env('DATABASE_NAME'),
            'USER': env('DATABASE_USER', ''),
            'PASSWORD': env('DATABASE_PASSWORD', ''),
            'HOST': env('DATABASE_HOST', 'localhost'),
            'PORT': env('DATABASE_PORT', '5432'),
            'CONN_MAX_AGE': int(env('DATABASE_CONN_MAX_AGE', '60')),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = env('TIME_ZONE', 'Europe/Moscow')
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ── static / media ───────────────────────────────────────────────────────────
STATIC_URL = 'static/'
STATIC_ROOT = env('STATIC_ROOT', str(BASE_DIR / 'staticfiles'))
MEDIA_URL = 'media/'
MEDIA_ROOT = env('MEDIA_ROOT', str(BASE_DIR / 'media'))
# Хранилище статики по умолчанию (dev). В prod.py заменяется на whitenoise+manifest.


# ── DRF / JWT ────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=int(env('JWT_ACCESS_HOURS', '12'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(env('JWT_REFRESH_DAYS', '7'))),
}
