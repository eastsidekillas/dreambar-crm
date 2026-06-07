import base64
from rest_framework import serializers
from .models import PrintJob


class PrintJobAgentSerializer(serializers.ModelSerializer):
    payload_b64 = serializers.SerializerMethodField()

    class Meta:
        model = PrintJob
        fields = ['id', 'kind', 'status', 'payload_b64', 'created_at']

    def get_payload_b64(self, obj):
        return base64.b64encode(bytes(obj.payload)).decode('ascii')
