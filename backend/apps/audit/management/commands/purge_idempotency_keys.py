from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.audit.models import IdempotencyKey


class Command(BaseCommand):
    help = 'Удаляет старые ключи идемпотентности (по умолчанию старше 7 дней).'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=7,
                            help='Возраст ключей в днях для удаления (по умолчанию 7).')

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(days=opts['days'])
        deleted, _ = IdempotencyKey.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f'Удалено ключей: {deleted}'))