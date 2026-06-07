from rest_framework import serializers
from .models import MenuSection, MenuCategory, MenuItem, ModifierGroup, Modifier, MenuItemModifierGroup


class MenuSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuSection
        fields = ['id', 'name', 'station_type', 'icon', 'sort_order', 'is_active']


class MenuCategorySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    station_type = serializers.CharField(source='section.station_type', read_only=True)

    class Meta:
        model = MenuCategory
        fields = ['id', 'name', 'section', 'section_name', 'station_type',
                  'print_station', 'is_active', 'sort_order']


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_type = serializers.CharField(source='category.section.station_type', read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'volume', 'description', 'price', 'cost_price',
                  'is_active', 'is_out_of_stock', 'sort_order', 'category',
                  'category_name', 'category_type', 'print_station']


class MenuItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'volume', 'description', 'price', 'cost_price',
                  'is_active', 'is_out_of_stock', 'sort_order', 'category', 'print_station']


class ModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Modifier
        fields = ['id', 'group', 'name', 'price_delta', 'sort_order', 'is_active']


class ModifierGroupSerializer(serializers.ModelSerializer):
    modifiers = ModifierSerializer(many=True, read_only=True)

    class Meta:
        model  = ModifierGroup
        fields = ['id', 'name', 'is_required', 'max_selections', 'sort_order', 'is_active', 'modifiers']


class MenuItemModifierGroupSerializer(serializers.ModelSerializer):
    modifier_group_name = serializers.CharField(source='modifier_group.name', read_only=True)
    modifiers           = ModifierSerializer(source='modifier_group.modifiers', many=True, read_only=True)

    class Meta:
        model  = MenuItemModifierGroup
        fields = ['id', 'menu_item', 'modifier_group', 'modifier_group_name', 'modifiers', 'sort_order']