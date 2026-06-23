from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from apps.users.permissions_matrix import RequirePerm, Perm
from .models import SystemState, DEFAULT_STOP_MESSAGE
from .serializers import SystemStateSerializer


class SystemStatusView(APIView):
    """GET — публичный статус системы. Доступен без авторизации, чтобы заглушка
    показывалась даже на экране входа и опрос работал у любого устройства."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(SystemStateSerializer(SystemState.load()).data)


class SystemControlView(APIView):
    """POST stop/resume — только для тех, у кого есть право system.control (админ)."""
    permission_classes = [RequirePerm(Perm.SYSTEM_CONTROL)]

    def post(self, request, action: str):
        if action not in ('stop', 'resume'):
            return Response({'detail': 'Допустимо: stop, resume.'},
                            status=status.HTTP_400_BAD_REQUEST)
        state = SystemState.load()
        if action == 'stop':
            state.is_stopped = True
            msg = (request.data.get('message') or '').strip()
            state.message = msg or DEFAULT_STOP_MESSAGE
        else:  # resume
            state.is_stopped = False
        state.updated_by = request.user
        state.save()
        return Response(SystemStateSerializer(state).data)