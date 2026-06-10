import django.db.models.deletion
from django.db import migrations, models


def create_default_menu(apps, schema_editor):
    Menu = apps.get_model('menu', 'Menu')
    MenuSection = apps.get_model('menu', 'MenuSection')
    menu = Menu.objects.create(name='Основное меню', is_active=True)
    MenuSection.objects.all().update(menu=menu)


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0005_modifiers'),
    ]

    operations = [
        migrations.CreateModel(
            name='Menu',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Название')),
                ('is_active', models.BooleanField(default=False, verbose_name='Активное')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Меню',
                'verbose_name_plural': 'Меню',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='menusection',
            name='menu',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='sections',
                to='menu.menu',
                verbose_name='Меню',
            ),
        ),
        migrations.RunPython(create_default_menu, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='menusection',
            name='menu',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='sections',
                to='menu.menu',
                verbose_name='Меню',
            ),
        ),
    ]