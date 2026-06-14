FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VERSION=2.2.1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1 \
    DJANGO_SETTINGS_MODULE=dreambar.settings.prod

WORKDIR /app

# Poetry как менеджер зависимостей (источник правды — pyproject.toml + poetry.lock)
RUN pip install "poetry==${POETRY_VERSION}"

# Сначала только манифесты — слой с зависимостями кэшируется отдельно от кода.
# Ставим в системный python (virtualenvs.create=false), без самого пакета проекта и без dev-группы.
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root

# Код проекта
COPY . .
RUN chmod +x /app/entrypoint.sh

# Непривилегированный пользователь + каталоги для статики/медиа
RUN adduser --system --group app \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R app:app /app
USER app

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "dreambar.wsgi:application", "--bind=0.0.0.0:8000", "--workers=4", "--worker-class=gthread", "--threads=4", "--timeout=120"]
