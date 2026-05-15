import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_admin_notifications'),
    ]

    operations = [
        migrations.CreateModel(
            name='JewellerLiabilityBalance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('liability_grams', models.DecimalField(decimal_places=6, default=0, max_digits=16)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('jeweller', models.OneToOneField(limit_choices_to={'user_type': 'jeweller'}, on_delete=django.db.models.deletion.CASCADE, related_name='custodial_liability_balance', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='JewellerLiabilityLedgerEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('grams', models.DecimalField(decimal_places=6, max_digits=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('customer', models.ForeignKey(blank=True, limit_choices_to={'user_type': 'customer'}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='jeweller_liability_entries_as_customer', to=settings.AUTH_USER_MODEL)),
                ('fractional_purchase', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='liability_entries', to='accounts.fractionalgoldpurchase')),
                ('jeweller', models.ForeignKey(limit_choices_to={'user_type': 'jeweller'}, on_delete=django.db.models.deletion.CASCADE, related_name='custodial_liability_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='FractionalCounterOtp',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code_hash', models.CharField(max_length=64)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('failed_attempts', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('purchase', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='counter_otp', to='accounts.fractionalgoldpurchase')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
