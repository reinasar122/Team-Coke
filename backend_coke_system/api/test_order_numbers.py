from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from .models import Merchandising, TransactionType, Warehouse


class WarehouseOrderNumberTests(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(name="Main", email="main@example.com")
        self.kind, _ = TransactionType.objects.get_or_create(name="Warehouse")

    def create_order(self, warehouse=None):
        return Merchandising.objects.create(
            warehouse=warehouse or self.warehouse, transaction_type=self.kind, status="Reserved")

    def test_every_order_on_the_same_day_advances_the_number(self):
        orders = [self.create_order() for _ in range(3)]
        self.assertEqual([o.msp_no for o in orders], ["WA-0001", "WA-0002", "WA-0003"])

    def test_next_day_continues_from_existing_orders(self):
        self.create_order()
        self.create_order()
        with patch("api.models.timezone.localdate", return_value=timezone.localdate() + timedelta(days=1)):
            self.assertEqual(self.create_order().msp_no, "WA-0003")
            self.assertEqual(self.create_order().msp_no, "WA-0004")

    def test_warehouses_have_independent_number_sequences(self):
        other = Warehouse.objects.create(name="Other", email="other@example.com")
        self.assertEqual(self.create_order().msp_no, "WA-0001")
        self.assertEqual(self.create_order().msp_no, "WA-0002")
        self.assertEqual(self.create_order(other).msp_no, "WA-0001")
