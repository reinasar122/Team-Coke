# api/signals.py
from django.db.models.signals import post_save,post_delete
from django.dispatch import receiver
from django.db.models import Sum
from .models import Product, Stock,MiscellaneousItem, Merchandising

@receiver(post_save, sender=Product)
def create_stock_for_product(sender, instance, created, **kwargs):
    if created:
        Stock.objects.get_or_create(product=instance, defaults={'quantity_available': 0})
