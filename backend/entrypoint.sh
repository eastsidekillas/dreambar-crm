#!/bin/sh
set -e

echo "→ Применяю миграции..."
python manage.py migrate --no-input

echo "→ Собираю статику..."
python manage.py collectstatic --no-input

# Первичное наполнение (меню + сотрудники), только если SEED_ON_START=true
if [ "$SEED_ON_START" = "true" ]; then
  echo "→ Загружаю начальные данные (seed_menu)..."
  python manage.py seed_menu || true
fi

echo "→ Запуск: $@"
exec "$@"
