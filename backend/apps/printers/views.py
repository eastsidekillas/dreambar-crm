from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.printers.services.printing import build_test_page, send_to_printer
from .models import Printer, PrintJob, ReceiptSettings
from .serializers import PrintJobAgentSerializer


def _int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _serialize_printer(p: Printer) -> dict:
    return {
        'id':         p.pk,
        'name':       p.name,
        'station':    p.station,
        'connection': p.connection,
        'host':       p.host,
        'port':       p.port,
        'agent_key':  p.agent_key,
        'width':      p.width,
        'is_default': p.is_default,
        'is_active':  p.is_active,
    }


class PrinterListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response([_serialize_printer(p) for p in Printer.objects.all().order_by('name')])

    def post(self, request):
        data = request.data
        with transaction.atomic():
            printer = Printer.objects.create(
                name=data.get('name', ''),
                station=data.get('station', ''),
                connection=data.get('connection', 'network'),
                host=data.get('host', ''),
                port=_int(data.get('port'), 9100),
                agent_key=data.get('agent_key', ''),
                width=_int(data.get('width'), 48),
                is_default=bool(data.get('is_default', False)),
                is_active=bool(data.get('is_active', True)),
            )
            if printer.is_default:
                Printer.objects.exclude(pk=printer.pk).update(is_default=False)
        return Response(_serialize_printer(printer), status=201)


class ReceiptSettingsView(APIView):
    """GET/PATCH настроек внешнего вида чека (одна запись)."""
    permission_classes = [IsAdminUser]

    @staticmethod
    def _serialize(rs: ReceiptSettings) -> dict:
        return {
            'title': rs.title,
            'subtitle': rs.subtitle,
            'footer': rs.footer,
            'qr_data': rs.qr_data,
            'qr_label': rs.qr_label,
            'print_second_copy': rs.print_second_copy,
        }

    def get(self, request):
        return Response(self._serialize(ReceiptSettings.get()))

    def patch(self, request):
        rs = ReceiptSettings.get()
        data = request.data
        if 'title' in data:
            title = str(data['title']).strip()
            if not title:
                return Response({'detail': 'Заголовок чека не может быть пустым.'}, status=400)
            rs.title = title[:50]
        if 'subtitle' in data:
            rs.subtitle = str(data['subtitle']).strip()[:500]
        if 'footer' in data:
            rs.footer = str(data['footer']).strip()[:100]
        if 'qr_data' in data:
            rs.qr_data = str(data['qr_data']).strip()[:200]
        if 'qr_label' in data:
            rs.qr_label = str(data['qr_label']).strip()[:100]
        if 'print_second_copy' in data:
            rs.print_second_copy = bool(data['print_second_copy'])
        rs.save()
        return Response(self._serialize(rs))


class PrinterDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        try:
            return Printer.objects.get(pk=pk)
        except Printer.DoesNotExist:
            return None

    def patch(self, request, pk):
        printer = self._get(pk)
        if not printer:
            return Response({'detail': 'Не найден.'}, status=404)
        data = request.data
        for field in ('name', 'station', 'connection', 'host', 'agent_key'):
            if field in data:
                setattr(printer, field, data[field])
        for field in ('port', 'width'):
            if field in data:
                setattr(printer, field, _int(data[field], getattr(printer, field)))
        for field in ('is_default', 'is_active'):
            if field in data:
                setattr(printer, field, bool(data[field]))
        with transaction.atomic():
            printer.save()
            if printer.is_default:
                Printer.objects.exclude(pk=printer.pk).update(is_default=False)
        return Response(_serialize_printer(printer))

    def delete(self, request, pk):
        printer = self._get(pk)
        if not printer:
            return Response({'detail': 'Не найден.'}, status=404)
        printer.delete()
        return Response(status=204)


class PrinterTestView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            printer = Printer.objects.get(pk=pk)
        except Printer.DoesNotExist:
            return Response({'detail': 'Не найден.'}, status=404)
        try:
            send_to_printer(printer, build_test_page(printer))
            return Response({'ok': True})
        except Exception as e:
            return Response({'ok': False, 'error': str(e)})


class PrinterAgentConfigView(APIView):
    """Готовый config.ini для агента печати — скачать и положить рядом с .exe."""
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            printer = Printer.objects.get(pk=pk)
        except Printer.DoesNotExist:
            return Response({'detail': 'Не найден.'}, status=404)
        if printer.connection != 'agent':
            return Response({'detail': 'Принтер сетевой — агент и config.ini не нужны.'},
                            status=400)

        backend_url = request.build_absolute_uri('/api').rstrip('/')
        lines = [
            '; Конфигурация агента печати DreamBar — сгенерирована в админке.',
            f'; Принтер: {printer.name}',
            '; Положите файл рядом с dreambar-print-agent.exe и запустите агента.',
            '[agent]',
            f'backend_url = {backend_url}',
            f'printer_id = {printer.pk}',
            f'agent_key = {printer.agent_key}',
            'poll_seconds = 2',
            'mode = windows',
            '; имя принтера как в «Устройства и принтеры»; пусто — принтер по умолчанию',
            'windows_printer = ',
        ]

        resp = HttpResponse('\n'.join(lines) + '\n',
                            content_type='text/plain; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="config.ini"'
        return resp


def _agent_printer(request):
    key        = request.headers.get('X-Agent-Key', '')
    printer_id = request.query_params.get('printer') or request.data.get('printer')
    if not key or not printer_id:
        return None
    return Printer.objects.filter(
        pk=printer_id, agent_key=key, is_active=True, connection='agent',
    ).first()


class AgentJobsView(APIView):
    authentication_classes = []
    permission_classes     = [AllowAny]

    # Задание, забранное агентом и не подтверждённое за это время, считается
    # зависшим (агент умер/перезапустился) и возвращается в очередь.
    STALE_AFTER = timedelta(minutes=5)

    def get(self, request):
        printer = _agent_printer(request)
        if printer is None:
            return Response({'detail': 'Неверный ключ или принтер.'}, status=403)
        now = timezone.now()
        with transaction.atomic():
            PrintJob.objects.filter(
                Q(claimed_at__lt=now - self.STALE_AFTER) | Q(claimed_at__isnull=True),
                printer=printer, status='printing',
            ).update(status='pending', claimed_at=None)
            jobs = list(
                PrintJob.objects.select_for_update()
                .filter(printer=printer, status='pending')
                .order_by('created_at')[:20]
            )
            PrintJob.objects.filter(pk__in=[j.id for j in jobs]).update(
                status='printing', claimed_at=now,
            )
        return Response(PrintJobAgentSerializer(jobs, many=True).data)


class AgentJobAckView(APIView):
    authentication_classes = []
    permission_classes     = [AllowAny]

    def post(self, request, job_id):
        printer = _agent_printer(request)
        if printer is None:
            return Response({'detail': 'Неверный ключ или принтер.'}, status=403)
        try:
            job = PrintJob.objects.get(pk=job_id, printer=printer)
        except PrintJob.DoesNotExist:
            return Response({'detail': 'Задание не найдено.'}, status=404)
        ok         = bool(request.data.get('ok', True))
        job.status = 'done' if ok else 'error'
        job.error  = '' if ok else str(request.data.get('error', ''))[:1000]
        job.sent_at = timezone.now()
        job.save(update_fields=['status', 'error', 'sent_at'])
        return Response({'id': job.id, 'status': job.status})
