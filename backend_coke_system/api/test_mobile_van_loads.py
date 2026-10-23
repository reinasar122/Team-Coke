from decimal import Decimal
from unittest.mock import patch

from django.db import DatabaseError, connections
from django.db.backends.utils import CursorWrapper

from .models import (Merchandising, MerchandisingItem, MobileOrderStockCommitment,
                     MobileDeliveryAddress, MobileVanLoadBatch, Product,
                     ReturnableStock, Route, Stock, TransactionType, Van)
from .serializers import MerchandisingSerializer
from .test_mobile_orders import MobileOrderFixture


class MobileVanLoadTests(MobileOrderFixture):
    def setUp(self):
        super().setUp()
        self.permission.edit = True
        self.permission.save()
        self.product = Product.objects.create(system_code="COKE-001", product_name="Coke 1L", warehouse=self.warehouse)
        self.stock, _ = Stock.objects.update_or_create(product=self.product, warehouse=self.warehouse, defaults={"quantity_available": 100})
        self.route = Route.objects.create(route_name="Town route", warehouse=self.warehouse)
        self.van = Van.objects.create(van_id="V1", plate_number="TEST-001", warehouse=self.warehouse)
        self.tx_type, _ = TransactionType.objects.get_or_create(name="Van Load")
        self.numbers = ["WA-0001", "WA-0002", "WA-0003"]
        for number in self.numbers:
            self.save_mobile_order(number=number)
        with connections["mobile_orders"].cursor() as cursor:
            for index, number in enumerate(self.numbers):
                cursor.execute("INSERT INTO chatbot_order VALUES (%s, %s, 'PENDING', NULL)", [f"chat-{index}", number])

    def statuses(self):
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("SELECT msp_no, status FROM merchandising")
            return dict(cursor.fetchall())

    def prepare(self, numbers=None):
        return self.client.post("/api/mobile-orders/van-load/", {"order_numbers": self.numbers if numbers is None else numbers}, format="json")

    def dispatch(self, batch, quantity=6):
        url = f"/api/mobile-van-loads/{batch}/dispatch/" if batch else "/api/mobile-orders/van-load/dispatch/"
        return self.client.post(url, {
            "order_numbers": self.numbers,
            "warehouse": self.warehouse.pk, "transaction_type": self.tx_type.pk,
            "route": self.route.pk, "van": self.van.pk, "handled_by": "Test cashier",
            "status": "Complete", "actual_sale": "999", "items": [{
                "product": self.product.pk, "dispatched_pcs": quantity,
                "sold_pcs": quantity, "actual_return_pcs": quantity,
            }],
        }, format="json")

    def returns(self, batch, payload=None):
        batch = batch or MobileVanLoadBatch.objects.get().pk
        payload = payload or {
            "products": [{"productId": self.product.pk, "sold_pcs": 4,
                          "actual_return_pcs": 2, "empty_return_pcs": 3, "actual_sale": "249.00"}],
            "order_outcomes": {self.numbers[0]: "DELIVERED", self.numbers[1]: "DELIVERED", self.numbers[2]: "RETURNED"},
            "actual_sale": "249.00",
        }
        return self.client.post(f"/api/mobile-van-loads/{batch}/return/", payload, format="json")

    def test_confirmation_is_a_read_only_preview_and_orders_stay_pending(self):
        response = self.prepare()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["items"][0]["quantity"], 6)
        self.assertEqual(response.data["status"], "DRAFT")
        self.assertIsNone(response.data["id"])
        self.assertEqual(set(self.statuses().values()), {"PENDING"})
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertEqual(Merchandising.objects.count(), 0)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 0)
        self.assertEqual(MobileVanLoadBatch.objects.count(), 0)
        self.prepare()
        self.assertEqual(MobileVanLoadBatch.objects.count(), 0)
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("SELECT fulfillment_status FROM chatbot_order")
            self.assertEqual({row[0] for row in cursor.fetchall()}, {"PENDING"})
            cursor.execute("SELECT COUNT(*) FROM order_fulfillment")
            self.assertEqual(cursor.fetchone()[0], 0)

    def test_retry_confirmation_and_dispatch_deduct_only_once(self):
        batch = self.prepare().data["id"]
        self.assertEqual(self.prepare(list(reversed(self.numbers))).data["id"], batch)
        first = self.dispatch(batch)
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["status"], "Pending")
        self.assertEqual(first.data["items"][0]["sold_pcs"], 0)
        self.assertEqual(first.data["items"][0]["actual_return_pcs"], 0)
        self.assertEqual(self.dispatch(batch).data["id"], first.data["id"])
        self.assertEqual(self.prepare().data["sale_id"], first.data["id"])
        saved_batch = MobileVanLoadBatch.objects.get()
        self.assertEqual(self.dispatch(saved_batch.pk).data["id"], first.data["id"])
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 94)
        self.assertEqual(Merchandising.objects.count(), 1)
        self.assertEqual(set(self.statuses().values()), {"OUT_FOR_DELIVERY"})
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 3)

    def test_cancellation_after_preview_rejects_dispatch_without_stock_changes(self):
        self.assertEqual(self.prepare().status_code, 200)
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising SET status='CANCELLED' WHERE msp_no=%s", [self.numbers[0]])
        self.assertEqual(self.dispatch(None).status_code, 409)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertFalse(MobileVanLoadBatch.objects.exists())
        self.assertFalse(MobileOrderStockCommitment.objects.exists())

    def test_legacy_unsaved_processing_batch_resumes_without_another_stock_debit(self):
        batch = MobileVanLoadBatch.objects.create(warehouse=self.warehouse, created_by=self.user)
        for number in self.numbers:
            MobileOrderStockCommitment.objects.create(
                warehouse=self.warehouse, order_number=number, quantities={str(self.product.pk): 2},
                van_load_batch=batch, confirmed_by=self.user,
            )
        self.stock.quantity_available = 94
        self.stock.save()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising SET status='PROCESSING'")
        preview = self.prepare()
        self.assertEqual(preview.data["id"], str(batch.pk))
        self.assertEqual(preview.data["status"], "DRAFT")
        self.assertEqual(self.dispatch(batch.pk).status_code, 201)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 94)
        self.assertEqual(set(self.statuses().values()), {"OUT_FOR_DELIVERY"})

    def test_partial_selection_cannot_split_an_existing_batch(self):
        self.dispatch(None)
        self.assertEqual(self.prepare(self.numbers[:1]).status_code, 409)
        self.assertEqual(MobileVanLoadBatch.objects.count(), 1)

    def test_short_stock_rejects_entire_batch(self):
        self.stock.quantity_available = 5
        self.stock.save()
        self.assertEqual(self.prepare().status_code, 200)
        self.assertEqual(self.dispatch(None).status_code, 409)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 5)
        self.assertEqual(MobileVanLoadBatch.objects.count(), 0)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 0)
        self.assertEqual(set(self.statuses().values()), {"PENDING"})

    def test_source_history_failure_resumes_without_repeating_stock_movements(self):
        original = CursorWrapper.execute

        def fail_history(cursor, sql, params=None):
            if sql.startswith("INSERT INTO order_fulfillment"):
                raise DatabaseError("simulated source write failure")
            return original(cursor, sql, params)

        with patch.object(CursorWrapper, "execute", new=fail_history):
            response = self.dispatch(None)
        self.assertEqual(response.status_code, 503)
        self.stock.refresh_from_db()
        # Preparation did not leave a partial batch on a failed source write.
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertEqual(MobileVanLoadBatch.objects.count(), 0)
        self.assertEqual(set(self.statuses().values()), {"PENDING"})
        self.assertEqual(self.dispatch(None).status_code, 201)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 94)

    def test_dispatch_rejects_tampered_quantities_and_foreign_route(self):
        batch = self.prepare().data["id"]
        self.assertEqual(self.dispatch(batch, quantity=7).status_code, 400)
        self.route.warehouse = self.other_warehouse
        self.route.save()
        self.assertEqual(self.dispatch(batch).status_code, 400)
        self.assertEqual(Merchandising.objects.count(), 0)
        self.assertEqual(MobileVanLoadBatch.objects.count(), 0)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 0)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertEqual(set(self.statuses().values()), {"PENDING"})

    def test_failed_preview_leaves_no_batch_or_stock_changes(self):
        with patch("api.mobile_van_loads.load_data", side_effect=DatabaseError("source unavailable")):
            self.assertEqual(self.prepare().status_code, 503)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertEqual(set(self.statuses().values()), {"PENDING"})
        self.assertFalse(MobileVanLoadBatch.objects.exists())
        self.assertIsNone(self.prepare().data["id"])
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)

    def test_entire_load_can_be_returned_with_zero_sales(self):
        batch = self.prepare().data["id"]
        self.dispatch(batch)
        response = self.returns(batch, {
            "products": [{"productId": self.product.pk, "sold_pcs": 0, "actual_return_pcs": 6, "empty_return_pcs": 0, "actual_sale": 0}],
            "order_outcomes": {number: "RETURNED" for number in self.numbers},
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(self.statuses().values()), {"RETURNED"})
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)

    def test_confirmed_aiva_reservation_transfers_without_a_second_stock_debit(self):
        marker = "[AIVA:12345678-1234-1234-1234-123456789abc]"
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising SET remarks=%s WHERE msp_no=%s", [marker, self.numbers[0]])
        warehouse_type, _ = TransactionType.objects.get_or_create(name="Warehouse")
        reservation = Merchandising.objects.create(
            msp_no=self.numbers[0], warehouse=self.warehouse, transaction_type=warehouse_type,
            handled_by="AIVA", status="Reserved", expected_sale="124.50", remarks=marker,
        )
        MerchandisingItem.objects.create(merchandising=reservation, product=self.product, dispatched_pcs=2)
        batch = self.prepare().data["id"]
        self.assertEqual(self.dispatch(batch).status_code, 201)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, "Transferred to Van Load")
        update = MerchandisingSerializer(reservation, data={"status": "Complete"}, partial=True)
        self.assertFalse(update.is_valid())
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 94)

    def test_refused_order_is_returned_and_inventory_restored_once(self):
        batch = self.prepare().data["id"]
        sale = self.dispatch(batch).data
        batch = MobileVanLoadBatch.objects.get().pk
        outcomes = {
            self.numbers[0]: "DELIVERED",
            self.numbers[1]: "DELIVERED",
            self.numbers[2]: "RETURNED",
        }
        confirmation = self.client.post(
            f"/api/mobile-van-loads/{batch}/outcomes/",
            {"outcomes": outcomes}, format="json",
        )
        self.assertEqual(
            confirmation.status_code, 200,
            getattr(confirmation, "data", confirmation.content),
        )
        self.assertEqual(confirmation.data["outcomes_confirmed_by"], "Test Cashier")
        self.assertIsNotNone(confirmation.data["outcomes_confirmed_at"])
        detail = self.client.get(f"/api/mobile-van-loads/{batch}/")
        self.assertEqual(detail.data["outcomes"], outcomes)
        self.assertEqual(detail.data["outcomes_confirmed_by"], "Test Cashier")
        self.assertEqual(set(self.statuses().values()), {"OUT_FOR_DELIVERY"})
        self.assertEqual(self.returns(batch).status_code, 200)
        self.assertEqual(self.statuses()[self.numbers[2]], "RETURNED")
        self.assertEqual(self.statuses()[self.numbers[0]], "DELIVERED")
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 96)
        self.assertEqual(ReturnableStock.objects.get(product=self.product).empty_bottle_qty, 3)
        self.assertEqual(self.returns(batch).status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 96)
        self.assertEqual(ReturnableStock.objects.get(product=self.product).empty_bottle_qty, 3)
        instance = Merchandising.objects.get(pk=sale["id"])
        serializer = MerchandisingSerializer(instance, data={"status": "Complete"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertEqual(self.statuses()[self.numbers[2]], "RETURNED")

    def test_delivered_order_receipts_split_the_van_load_delivery_fee(self):
        batch = self.prepare().data["id"]
        self.dispatch(batch)
        batch = MobileVanLoadBatch.objects.get()
        MobileDeliveryAddress.objects.create(
            warehouse=self.warehouse, address=self.route.route_name, delivery_fee="10.00",
        )

        response = self.returns(batch.pk)

        self.assertEqual(response.status_code, 200, response.data)
        sale = batch.merchandising
        self.assertEqual(sale.delivery_fee, Decimal("10.00"))
        orders = self.client.get("/api/mobile-orders/").data["results"]
        fee_by_order = {order["order_number"]: order["delivery_fee"] for order in orders}
        self.assertEqual(fee_by_order, {
            self.numbers[0]: "3.34",
            self.numbers[1]: "3.33",
            self.numbers[2]: "3.33",
        })
        detail = self.client.get(f"/api/mobile-orders/{self.numbers[0]}/")
        self.assertEqual(detail.data["delivery_fee"], "3.34")

    def test_mobile_delivered_status_is_exposed_as_van_load_outcome(self):
        batch = self.prepare().data["id"]
        self.dispatch(batch)
        batch = MobileVanLoadBatch.objects.get()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute(
                "UPDATE merchandising SET status='Delivered' WHERE msp_no=%s",
                [self.numbers[0]],
            )

        response = self.client.get(f"/api/mobile-van-loads/{batch.pk}/")

        self.assertEqual(response.status_code, 200, response.data)
        order_statuses = {
            order["order_number"]: order["status"] for order in response.data["orders"]
        }
        self.assertEqual(order_statuses[self.numbers[0]], "DELIVERED")
        self.assertEqual(response.data["outcomes"][self.numbers[0]], "DELIVERED")
        self.assertNotIn(self.numbers[1], response.data["outcomes"])

    def test_return_history_failure_retries_only_source_updates(self):
        batch = self.prepare().data["id"]
        self.dispatch(batch)
        original = CursorWrapper.execute

        def fail_history(cursor, sql, params=None):
            if sql.startswith("INSERT INTO order_fulfillment"):
                raise DatabaseError("simulated history failure")
            return original(cursor, sql, params)

        with patch.object(CursorWrapper, "execute", new=fail_history):
            self.assertEqual(self.returns(batch).status_code, 503)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 96)
        self.assertEqual(set(self.statuses().values()), {"OUT_FOR_DELIVERY"})
        self.assertEqual(self.returns(batch).status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 96)

    def test_completion_requires_declaration_and_generic_cancellation_is_blocked(self):
        batch = self.prepare().data["id"]
        sale = self.dispatch(batch).data
        serializer = MerchandisingSerializer(Merchandising.objects.get(pk=sale["id"]), data={"status": "Complete"}, partial=True)
        self.assertFalse(serializer.is_valid())
        response = self.client.patch(f"/api/mobile-orders/{self.numbers[0]}/", {"status": "CANCELLED"}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.post("/api/van-load-return/", {"sale_id": sale["id"]}, format="json").status_code, 409)

    def test_remittance_can_continue_without_delivery_outcome_selections(self):
        batch = self.prepare().data["id"]
        self.dispatch(batch)
        response = self.returns(batch, {
            "products": [{
                "productId": self.product.pk, "sold_pcs": 4,
                "actual_return_pcs": 2, "empty_return_pcs": 0, "actual_sale": 0,
            }],
            "order_outcomes": {},
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(MobileVanLoadBatch.objects.get().return_outcomes, {})
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 96)

    def test_permissions_and_warehouse_isolation(self):
        self.permission.edit = False
        self.permission.save()
        self.assertEqual(self.prepare().status_code, 403)
        self.permission.edit = True
        self.permission.save()
        batch = self.prepare().data["id"]
        self.user.warehouse = self.other_warehouse
        self.user.save()
        self.assertEqual(self.dispatch(batch).status_code, 404)
