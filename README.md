# DreamBar — запуск

## Разработка (локально)

**Бэкенд** (Django, SQLite, порт 8000):
```bash
cd backend
poetry install
poetry run python manage.py migrate
poetry run python manage.py seed_menu      # демо-меню + сотрудники
poetry run python manage.py runserver 8000 # настройки dreambar.settings.dev
```

**Фронтенд** (Angular, порт 4200):
```bash
cd frontend
npm install
npm start                                   # ng serve, обращается к http://localhost:8000/api
```

Тестовые учётки: `admin/dreambar2026`, `waiter1/waiter2026`, `bartender/bar2026`,
`kitchen/kuhnya2026`, `wardrobe/gard2026`.

---

## Продакшен (Docker)

Всё поднимается одной командой через `docker-compose.yml`: PostgreSQL + Django (gunicorn) +
Angular/nginx. Фронтенд (nginx) отдаёт SPA и проксирует `/api`, `/admin`, `/static` на бэкенд,
поэтому всё работает на одном порту/домене.

### 1. Настроить окружение
```bash
cp .env.example .env
# отредактируйте .env: DJANGO_SECRET_KEY, DATABASE_PASSWORD, ALLOWED_HOSTS,
# CSRF_TRUSTED_ORIGINS, при HTTPS — SECURE_SSL=true
```

Сгенерировать секретный ключ:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 2. Запустить
```bash
docker compose up -d --build
```
Сайт: **http://localhost:8080** (порт меняется через `WEB_PORT` в `.env`).

При первом старте контейнер бэкенда автоматически (`entrypoint.sh`):
- применяет миграции,
- собирает статику (whitenoise),
- наполняет демо-данными, если `SEED_ON_START=true`.

### 3. Полезное
```bash
docker compose logs -f backend          # логи
docker compose exec backend python manage.py createsuperuser
docker compose down                     # остановить
docker compose down -v                  # остановить и удалить данные БД
```

### Структура настроек
- `dreambar/settings/base.py` — общее, читает переменные из окружения/.env
- `dreambar/settings/dev.py` — разработка (DEBUG, SQLite, CORS *)
- `dreambar/settings/prod.py` — продакшен (security, логирование, CORS/CSRF по белому списку)

`manage.py` по умолчанию использует `dev`, `wsgi.py` и Docker — `prod`.

### Для реального домена с HTTPS
1. `ALLOWED_HOSTS=ваш-домен.ru`
2. `CSRF_TRUSTED_ORIGINS=https://ваш-домен.ru`
3. `SECURE_SSL=true`
4. Терминируйте TLS на внешнем reverse-proxy (Traefik/Caddy/nginx) перед сервисом `frontend`,
   либо добавьте сертификаты в nginx фронтенда.
