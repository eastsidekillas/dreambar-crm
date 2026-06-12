from django.db import migrations, models


def close_duplicate_open_shifts(apps, schema_editor):
    """Перед констрейнтом закрываем дубли: открытой остаётся последняя по opened_at."""
    Shift = apps.get_model('shifts', 'Shift')
    open_ids = list(
        Shift.objects.filter(is_open=True).order_by('-opened_at').values_list('id', flat=True)
    )
    for shift_id in open_ids[1:]:
        Shift.objects.filter(pk=shift_id).update(is_open=False)


class Migration(migrations.Migration):

    dependencies = [
        ('shifts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(close_duplicate_open_shifts, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='shift',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_open', True)),
                fields=('is_open',),
                name='only_one_open_shift',
            ),
        ),
    ]