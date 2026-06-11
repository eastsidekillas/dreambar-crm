#!/bin/sh
set -e

echo "→ Применяю миграции..."
python manage.py migrate --no-input

echo "→ Собираю статику..."
python manage.py collectstatic --no-input

echo "→ Запуск: $@"
exec "$@"
