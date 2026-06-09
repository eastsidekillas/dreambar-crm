from django.db import migrations, models
import django.db.models.deletion


def populate_table_fk(apps, schema_editor):
    """Link existing reservations to Table by matching table_number → Table.number."""
    Reservation = apps.get_model('reservations', 'Reservation')
    Table = apps.get_model('tables', 'Table')

    table_map = {t.number: t for t in Table.objects.all()}
    for resv in Reservation.objects.exclude(table_number=''):
        matched = table_map.get(resv.table_number)
        if matched:
            resv.table_id = matched.id
            resv.save(update_fields=['table_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0002_table_number_max50'),
        ('tables', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='reservation',
            name='table',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reservations',
                to='tables.table',
                verbose_name='Стол',
            ),
        ),
        migrations.RunPython(populate_table_fk, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='reservation',
            name='table_number',
        ),
    ]
