# api/signals.py
from django.db.models.signals import post_save,post_delete
from django.dispatch import receiver
from django.db.models import Sum
from .models import Product, Stock,MiscellaneousItem, Merchandising

@receiver(post_save, sender=Product)
def create_stock_for_product(sender, instance, created, **kwargs):
    if created:
        Stock.objects.get_or_create(product=instance, defaults={'quantity_available': 0})
def _recalc_misc_total(merch: Merchandising):
    total = merch.misc_items.aggregate(total=Sum('amount'))['total'] or 0
    # Update only the field to avoid triggering other signals
    Merchandising.objects.filter(pk=merch.pk).update(miscellaneous=total)

@receiver(post_save, sender=MiscellaneousItem)
def recalc_misc_on_save(sender, instance, **kwargs):
    if instance.merchandising_id:
        _recalc_misc_total(instance.merchandising)

@receiver(post_delete, sender=MiscellaneousItem)
def recalc_misc_on_delete(sender, instance, **kwargs):
    if instance.merchandising_id:
        _recalc_misc_total(instance.merchandising)