from django.db import transaction
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Printer
from ..services.printing import build_test_page, send_to_printer


def _int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class PrinterListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        printers = Printer.objects.all().order_by('name')
        return Response([self._serialize(p) for p in printers])

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
        return Response(self._serialize(printer), status=201)

    @staticmethod
    def _serialize(p: Printer) -> dict:
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

        return Response(PrinterListView._serialize(printer))

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
            payload = build_test_page(printer)
            send_to_printer(printer, payload)
            return Response({'ok': True})
        except Exception as e:
            # Возвращаем 200 с ok=False — фронтенд обрабатывает через next:, а не error:
            return Response({'ok': False, 'error': str(e)})
