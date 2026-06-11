#!/bin/sh
set -e

echo "→ Применяю миграции..."
python manage.py migrate --no-input

echo "→ Собираю статику..."
python manage.py collectstatic --no-input

echo "→ Создаю аккаунт админа..."
python manage.py shell -c "
import os
from django.contrib.auth.models import User

username = os.environ.get('ADMIN_USERNAME', 'admin')
password = os.environ.get('ADMIN_PASSWORD', 'admin')

if User.objects.filter(username=username).exists():
    print(f'   админ \"{username}\" уже существует — пропускаю')
else:
    User.objects.create_superuser(username=username, password=password)
    print(f'   создан админ \"{username}\"')
"

echo "→ Запуск: $@"
exec "$@"
