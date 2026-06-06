from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Printer, PrintJob
from ..serializers import PrintJobAgentSerializer


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
