import re

from rest_framework import serializers
from .models import Zone, Table


def natural_key(s):
    """Естественная сортировка номеров: «Стол 2» < «Стол 10» (а не лексикографически)."""
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r'(\d+)', s or '')]


class TableSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'zone', 'zone_name', 'number', 'seats', 'is_active', 'note']


class ZoneSerializer(serializers.ModelSerializer):
    tables = serializers.SerializerMethodField()

    class Meta:
        model = Zone
        fields = ['id', 'name', 'color', 'sort', 'tables']

    def get_tables(self, obj):
        tables = sorted(obj.tables.all(), key=lambda t: natural_key(t.number))
        return TableSerializer(tables, many=True).data
