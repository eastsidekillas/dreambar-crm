#!/usr/bin/env bash
# Поднимает бэкенд на ИЗОЛИРОВАННОЙ e2e-БД (отдельный sqlite), не трогая dev db.sqlite3.
set -e
cd "$(dirname "$0")/../../backend"
export DATABASE_ENGINE=django.db.backends.sqlite3
export DATABASE_NAME="$PWD/e2e_db.sqlite3"
rm -f "$DATABASE_NAME"
poetry run python manage.py migrate --noinput
poetry run python manage.py seed_e2e
exec poetry run python manage.py runserver 127.0.0.1:8000 --noreload