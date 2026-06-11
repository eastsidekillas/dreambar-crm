FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=dreambar.settings.prod

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

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
