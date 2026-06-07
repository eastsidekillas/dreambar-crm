from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.printers.services.printing import build_test_page, send_to_printer
from .models import Printer, PrintJob
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
        for field in ('name', 'connection', 'host', 'agent_key'):
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

    def get(self, request):
        printer = _agent_printer(request)
        if printer is None:
            return Response({'detail': 'Неверный ключ или принтер.'}, status=403)
        PrintJob.objects.filter(printer=printer, status='printing').update(status='pending')
        jobs = list(PrintJob.objects.filter(printer=printer, status='pending')[:20])
        data = PrintJobAgentSerializer(jobs, many=True).data
        PrintJob.objects.filter(pk__in=[j.id for j in jobs]).update(status='printing')
        return Response(data)


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
