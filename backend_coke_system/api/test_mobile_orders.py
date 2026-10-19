from datetime import datetime, timezone as datetime_timezone
from decimal import Decimal
from unittest.mock import patch

from django.core import signing
from django.db import connections, DatabaseError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .mobile_orders import MobileOrdersDatabaseRouter
from .models import (Merchandising, MerchandisingItem, MobileOrderStockCommitment,
                     Product, Role, RoleAccessibility, Stock, TransactionType, User, Warehouse)
from .pos_auth import create_pos_session_token


class MobileOrderFixture(TestCase):
    databases = {"default", "mobile_orders"}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Reproduce only the columns read from the mobile app's existing schema.
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("CREATE TABLE warehouse (id integer primary key, name varchar(255))")
            cursor.execute("CREATE TABLE mobile_order_reference (id integer primary key, source_order_id varchar(20) unique)")
            cursor.execute("CREATE TABLE customer (id integer primary key, name varchar(255), address varchar(255))")
            cursor.execute("CREATE TABLE product (id integer primary key, product_name varchar(255), image_url varchar(500), system_code varchar(100))")
            cursor.execute("""CREATE TABLE merchandising (
                msp_no varchar(20) primary key, status varchar(50),
                expected_sale decimal(12,2), date_time datetime,
                customer_id integer, warehouse_id integer, remarks text)""")
            cursor.execute("""CREATE TABLE merchandising_item (
                id integer primary key, msp_no varchar(20), product_id integer,
                sold_pcs integer, selling_price decimal(10,2) default 62.25,
                discount_percent decimal(5,2) default 0)""")
            cursor.execute("""CREATE TABLE chatbot_order (
                chatbot_order_id varchar(32) primary key, msp_no varchar(20),
                fulfillment_status varchar(50), completed_at datetime)""")
            cursor.execute("""CREATE TABLE order_fulfillment (
                id integer primary key, chatbot_order_id varchar(32),
                fulfillment_stage varchar(50), stage_timestamp datetime, notes text)""")

    def setUp(self):
        self.warehouse = Warehouse.objects.create(name="Main Warehouse", email="main@example.com")
        self.other_warehouse = Warehouse.objects.create(name="Other Warehouse", email="other@example.com")
        self.role = Role.objects.create(name="Cashier")
        self.permission = RoleAccessibility.objects.create(role=self.role, submenu="Trading", view=True)
        self.user = User.objects.create(
            role=self.role, warehouse=self.warehouse, phone_number="09123456789",
            first_name="Test", last_name="Cashier", is_active=True,
            is_approved=True, must_change_password=False,
        )
        self.user.set_password("test-password")
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + create_pos_session_token(self.user))
        with connections["mobile_orders"].cursor() as cursor:
            # Different source IDs prove that warehouse mapping is not an ID guess.
            cursor.execute("INSERT INTO warehouse VALUES (70, %s), (80, %s)", ["Main Warehouse", "Other Warehouse"])
            cursor.execute("INSERT INTO customer VALUES (3, %s, %s)", ["Real Customer", "Cebu City"])
            cursor.execute("INSERT INTO product VALUES (9, %s, %s, 'COKE-001'), (10, %s, %s, 'COKE-002')", ["Coke 1L", "https://example.com/coke.jpg", "Coke 1L", "https://example.com/coke.jpg"])

    def save_mobile_order(self, number="MSP-20261005-001", warehouse_id=70, status="PENDING", at=None):
        at = at or datetime(2026, 10, 5, 2, 24, tzinfo=datetime_timezone.utc)
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("INSERT INTO merchandising (msp_no,status,expected_sale,date_time,customer_id,warehouse_id) VALUES (%s, %s, %s, %s, %s, %s)", [number, status, "124.50", at.replace(tzinfo=None), 3, warehouse_id])
            cursor.execute("INSERT INTO merchandising_item (msp_no, product_id, sold_pcs) VALUES (%s, %s, 2)", [number, 10 if warehouse_id == 80 else 9])


class MobileOrderTests(MobileOrderFixture):
    def test_checkout_address_belongs_to_each_order_not_the_customer_profile(self):
        self.save_mobile_order(number="WA-0002")
        self.save_mobile_order(number="WA-0003")
        addresses = {
            "WA-0002": "Purok Tulingan, Palanas, Ginatilan, Cebu, Philippines",
            "WA-0003": "Dalanawan, Catarman, Cordova, Cebu, Philippines",
        }
        with connections["mobile_orders"].cursor() as cursor:
            for number, address in addresses.items():
                cursor.execute("UPDATE merchandising SET remarks=%s WHERE msp_no=%s", [
                    f"[AIVA:c4b41acf-d15f-4c5e-b263-5546502e7e67] Deliver to: {address}; Delivery slot: Morning",
                    number,
                ])
            # Changing a profile must not rewrite either checkout destination.
            cursor.execute("UPDATE customer SET address='New profile address'")
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({order["order_number"]: order["order_address"]
                          for order in response.data["results"]}, addresses)
        for number, address in addresses.items():
            detail = self.client.get(f"/api/mobile-orders/{number}/")
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.data["order_address"], address)
            self.assertEqual(detail.data["customer_address"], "New profile address")
            self.assertIsNone(detail.data["delivery_address"])

    def test_checkout_address_is_available_with_an_empty_profile_address(self):
        self.save_mobile_order()
        address = "Unit 2; Purok Tulingan, Palanas, Ginatilan, Cebu"
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE customer SET address=''")
            cursor.execute("UPDATE merchandising SET remarks=%s", [
                f"[AIVA:c4b41acf-d15f-4c5e-b263-5546502e7e67] Deliver to: {address}; Delivery slot: Morning",
            ])
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["order_address"], address)

    def test_legacy_orders_use_profile_or_an_empty_address(self):
        self.save_mobile_order()
        for remarks in (None, "", "Customer asked to call first", "Deliver to: unstructured note"):
            with connections["mobile_orders"].cursor() as cursor:
                cursor.execute("UPDATE merchandising SET remarks=%s", [remarks])
            response = self.client.get("/api/mobile-orders/")
            self.assertEqual(response.data["results"][0]["order_address"], "Cebu City")
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE customer SET address=NULL")
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.data["results"][0]["order_address"], "")

    def test_unmigrated_public_number_table_does_not_hide_existing_orders(self):
        self.save_mobile_order(number='WA-0002')
        with connections['mobile_orders'].cursor() as cursor:
            cursor.execute('DROP TABLE mobile_order_reference')
        response = self.client.get('/api/mobile-orders/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['order_number'], 'WA-0002')
        self.assertEqual(response.data['results'][0]['products'][0]['quantity'], 2)

    def test_public_mobile_number_preserves_the_pos_reference(self):
        self.save_mobile_order(number="WA-0003")
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("INSERT INTO mobile_order_reference VALUES (2, 'WA-0003')")
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["order_number"], "WA-0003")
        self.assertEqual(response.data["results"][0]["mobile_order_number"], "MO-0002")

    def test_no_orders_returns_real_empty_result(self):
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])
        self.assertEqual(response.data["count"], 0)

    def test_order_saved_by_mobile_backend_appears_on_next_request(self):
        self.assertEqual(self.client.get("/api/mobile-orders/").data["count"], 0)
        self.save_mobile_order()
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.status_code, 200)
        order = response.data["results"][0]
        self.assertEqual(order["order_number"], "MSP-20261005-001")
        self.assertEqual(order["customer_name"], "Real Customer")
        self.assertEqual(order["customer_address"], "Cebu City")
        self.assertEqual(float(order["total_amount"]), 124.50)
        self.assertEqual(order["created_at"], "2026-10-05T02:24:00+00:00")
        self.assertEqual(order["products"][0]["quantity"], 2)
        self.assertEqual(order["products"][0]["unit_price"], "62.25")
        self.assertEqual(order["products"][0]["line_total"], "124.50")
        self.assertEqual(order["products"][0]["name"], "Coke 1L")
        self.assertEqual(order["products"][0]["image_url"], "https://example.com/coke.jpg")
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_product_breakdown_uses_saved_price_and_discount_in_list_and_detail(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising_item SET selling_price=19.99, sold_pcs=3, discount_percent=12.5")
            cursor.execute("UPDATE merchandising SET expected_sale=52.47")
        for url in ("/api/mobile-orders/", "/api/mobile-orders/MSP-20261005-001/"):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            order = response.data["results"][0] if "results" in response.data else response.data
            item = order["products"][0]
            self.assertEqual(item["unit_price"], "19.99")
            self.assertEqual(Decimal(item["discount_percent"]), Decimal("12.5"))
            self.assertEqual(item["line_total"], "52.47")

    def test_status_changes_appear_without_duplicate_orders(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising SET status='OUT_FOR_DELIVERY'")
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["status"], "OUT_FOR_DELIVERY")

    def test_other_warehouse_orders_do_not_appear(self):
        self.save_mobile_order(warehouse_id=80)
        self.assertEqual(self.client.get("/api/mobile-orders/").data["count"], 0)

    def test_cashier_cannot_request_another_warehouse(self):
        response = self.client.get("/api/mobile-orders/", {"warehouse": self.other_warehouse.pk})
        self.assertEqual(response.status_code, 403)

    def test_admin_can_select_another_warehouse(self):
        self.role.name = "Administrator"
        self.role.save()
        self.save_mobile_order(warehouse_id=80)
        response = self.client.get("/api/mobile-orders/", {"warehouse": self.other_warehouse.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_unknown_warehouse_name_does_not_read_same_numeric_id(self):
        self.warehouse.name = "Unmapped Warehouse"
        self.warehouse.save()
        self.save_mobile_order()
        self.assertEqual(self.client.get("/api/mobile-orders/").data["count"], 0)

    def test_pagination_orders_newest_first(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002", at=datetime(2026, 10, 5, 3, tzinfo=datetime_timezone.utc))
        response = self.client.get("/api/mobile-orders/", {"limit": 1})
        self.assertEqual(response.data["count"], 2)
        self.assertIsNotNone(response.data["next"])
        self.assertEqual(response.data["results"][0]["order_number"], "MSP-20261005-002")
        response = self.client.get("/api/mobile-orders/", {"limit": 1, "offset": 1})
        self.assertEqual(response.data["results"][0]["order_number"], "MSP-20261005-001")

    def test_missing_or_forged_login_token_is_rejected(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer forged", HTTP_X_ADMIN_USER_ID=str(self.user.pk))
        self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 401)

    def test_password_change_invalidates_old_token(self):
        self.user.set_password("new-password")
        self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 401)

    def test_expired_token_is_rejected(self):
        with patch("api.pos_auth.signing.loads", side_effect=signing.SignatureExpired()):
            self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 401)

    def test_permission_removal_takes_effect_immediately(self):
        RoleAccessibility.objects.filter(pk=self.permission.pk).delete()
        self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 403)

    def test_inactive_account_is_rejected(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 401)

    def test_invalid_warehouse_parameter_is_rejected(self):
        self.assertEqual(self.client.get("/api/mobile-orders/", {"warehouse": "1 OR 1=1"}).status_code, 400)

    def test_source_failure_is_not_reported_as_empty(self):
        with patch("api.mobile_orders.read_mobile_orders", side_effect=DatabaseError("source down")), patch("api.mobile_orders.logger.exception"):
            response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("results", response.data)

    def test_login_issues_a_valid_order_access_token(self):
        self.client.credentials()
        response = self.client.post("/api/login/", {"phone_number": self.user.phone_number, "password": "test-password"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["token"])
        self.assertEqual(self.client.get("/api/mobile-orders/").status_code, 200)

    @override_settings(MOBILE_ORDERS_MEDIA_BASE_URL="http://mobile.test")
    def test_relative_images_use_configured_media_origin(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE product SET image_url='/media/coke.jpg'")
        response = self.client.get("/api/mobile-orders/")
        self.assertEqual(response.data["results"][0]["products"][0]["image_url"], "http://mobile.test/media/coke.jpg")

    def test_mobile_database_is_excluded_from_migrations(self):
        self.assertFalse(MobileOrdersDatabaseRouter().allow_migrate("mobile_orders", "api"))


class MobileOrderProcessingTests(MobileOrderFixture):
    def setUp(self):
        super().setUp()
        self.permission.edit = True
        self.permission.save()
        self.product = Product.objects.create(system_code="COKE-001", product_name="Coke 1L", warehouse=self.warehouse)
        self.other_product = Product.objects.create(system_code="COKE-002", product_name="Coke 1L", warehouse=self.other_warehouse)
        self.stock, _ = Stock.objects.get_or_create(product=self.product, warehouse=self.warehouse)
        self.stock.quantity_available = 100
        self.stock.save()
        Stock.objects.update_or_create(product=self.other_product, warehouse=self.other_warehouse, defaults={"quantity_available": 100})

    def status_of(self, number="MSP-20261005-001"):
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("SELECT status FROM merchandising WHERE msp_no = %s", [number])
            return cursor.fetchone()[0]

    def patch_status(self, status, **extra):
        return self.client.patch(
            "/api/mobile-orders/MSP-20261005-001/", {"status": status, **extra}, format="json",
        )

    def confirm(self, *numbers):
        return self.client.post("/api/mobile-orders/confirm/", {"order_numbers": list(numbers)}, format="json")

    def test_detail_returns_only_requested_order(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        response = self.client.get("/api/mobile-orders/MSP-20261005-001/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["order_number"], "MSP-20261005-001")
        self.assertEqual(len(response.data["products"]), 1)
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_missing_or_other_warehouse_order_is_not_disclosed(self):
        self.assertEqual(self.client.get("/api/mobile-orders/missing/").status_code, 404)
        self.save_mobile_order(warehouse_id=80)
        self.assertEqual(self.client.get("/api/mobile-orders/MSP-20261005-001/").status_code, 404)
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 404)
        self.assertEqual(self.status_of(), "PENDING")

    def test_view_permission_does_not_allow_processing(self):
        self.save_mobile_order()
        self.permission.edit = False
        self.permission.save()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 403)
        self.assertEqual(self.confirm("MSP-20261005-001").status_code, 403)
        self.assertEqual(self.client.get("/api/mobile-orders/MSP-20261005-001/").status_code, 200)
        self.assertEqual(self.status_of(), "PENDING")

    def test_full_permission_allows_processing(self):
        self.save_mobile_order()
        self.permission.edit = False
        self.permission.full = True
        self.permission.save()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 200)

    def test_processing_requires_login(self):
        self.save_mobile_order()
        self.client.credentials()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 401)
        self.assertEqual(self.confirm("MSP-20261005-001").status_code, 401)

    def test_warehouse_override_is_checked_for_writes(self):
        self.save_mobile_order(warehouse_id=80)
        response = self.client.patch(
            f"/api/mobile-orders/MSP-20261005-001/?warehouse={self.other_warehouse.pk}",
            {"status": "CONFIRMED"}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.status_of(), "PENDING")

    def test_admin_can_process_selected_warehouse(self):
        self.role.name = "Administrator"
        self.role.save()
        self.save_mobile_order(warehouse_id=80)
        response = self.client.patch(
            "/api/mobile-orders/MSP-20261005-001/", {"status": "CONFIRMED"},
            format="json", HTTP_X_WAREHOUSE_ID=str(self.other_warehouse.pk),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.status_of(), "CONFIRMED")

    def test_confirmation_syncs_chatbot_and_writes_history_once_on_retry(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("INSERT INTO chatbot_order VALUES ('chat-001', %s, 'PENDING', NULL)", ["MSP-20261005-001"])
        first = self.confirm("MSP-20261005-001")
        retry = self.confirm("MSP-20261005-001")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["updated_count"], 1)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.data["updated_count"], 0)
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("SELECT fulfillment_status, completed_at FROM chatbot_order")
            self.assertEqual(cursor.fetchone(), ("CONFIRMED", None))
            cursor.execute("SELECT fulfillment_stage, notes FROM order_fulfillment")
            history = cursor.fetchall()
            self.assertEqual(len(history), 1)
            self.assertEqual(history[0][0], "CONFIRMED")
            self.assertIn(f"POS user {self.user.pk}.", history[0][1])

    def test_delivery_lifecycle_and_completion_timestamp(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("INSERT INTO chatbot_order VALUES ('chat-001', %s, 'PENDING', NULL)", ["MSP-20261005-001"])
        for status in ("CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"):
            response = self.patch_status(status, notes="Processed at POS")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(self.status_of(), status)
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("SELECT fulfillment_status, completed_at FROM chatbot_order")
            status, completed_at = cursor.fetchone()
            self.assertEqual(status, "DELIVERED")
            self.assertIsNotNone(completed_at)
            cursor.execute("SELECT COUNT(*) FROM order_fulfillment")
            self.assertEqual(cursor.fetchone()[0], 4)

    def test_invalid_status_or_skipped_step_cannot_change_order(self):
        self.save_mobile_order()
        self.assertEqual(self.patch_status("PAID").status_code, 400)
        self.assertEqual(self.patch_status("DELIVERED").status_code, 409)
        self.assertEqual(self.status_of(), "PENDING")

    def test_stale_expected_status_returns_conflict(self):
        self.save_mobile_order(status="CONFIRMED")
        self.assertEqual(self.patch_status("PROCESSING", expected_status="PENDING").status_code, 409)
        self.assertEqual(self.status_of(), "CONFIRMED")
        self.assertEqual(self.patch_status("PROCESSING", expected_status="CONFIRMED").status_code, 200)

    def test_cancellation_before_dispatch_and_terminal_states(self):
        self.save_mobile_order()
        self.assertEqual(self.patch_status("CANCELLED").status_code, 200)
        self.assertEqual(self.patch_status("CANCELLED").data["updated_count"], 0)
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 409)
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising SET status='OUT_FOR_DELIVERY'")
        self.assertEqual(self.patch_status("CANCELLED").status_code, 409)
        self.assertEqual(self.status_of(), "OUT_FOR_DELIVERY")

    def test_legacy_status_alias_is_accepted(self):
        self.save_mobile_order(status="ORDER_CONFIRMED")
        self.assertEqual(self.patch_status("PROCESSING").status_code, 200)
        self.assertEqual(self.status_of(), "PROCESSING")

    def test_bulk_confirmation_processes_all_selected_orders(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        response = self.confirm("MSP-20261005-001", "MSP-20261005-002")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated_count"], 2)
        self.assertEqual(self.status_of("MSP-20261005-002"), "CONFIRMED")

    def test_bulk_confirmation_is_all_or_nothing(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002", status="DELIVERED")
        self.assertEqual(self.confirm("MSP-20261005-001", "MSP-20261005-002").status_code, 409)
        self.assertEqual(self.status_of(), "PENDING")
        self.assertEqual(self.confirm("MSP-20261005-001", "missing").status_code, 404)
        self.assertEqual(self.status_of(), "PENDING")

    def test_bulk_validation_rejects_empty_duplicate_or_oversized_requests(self):
        for numbers in ([], ["same", "same"], ["x" * 21], [f"order-{i}" for i in range(101)]):
            self.assertEqual(self.confirm(*numbers).status_code, 400)

    def test_history_failure_rolls_back_status_update(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("INSERT INTO chatbot_order VALUES ('chat-001', %s, 'PENDING', NULL)", ["MSP-20261005-001"])
        from django.db.backends.utils import CursorWrapper
        original_execute = CursorWrapper.execute

        def fail_history(cursor, sql, params=None):
            if sql.startswith("INSERT INTO order_fulfillment"):
                raise DatabaseError("history write failed")
            return original_execute(cursor, sql, params)

        with patch.object(CursorWrapper, "execute", new=fail_history), patch("api.mobile_orders.logger.exception"):
            self.assertEqual(self.patch_status("CONFIRMED").status_code, 503)
        self.assertEqual(self.status_of(), "PENDING")
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("SELECT fulfillment_status FROM chatbot_order")
            self.assertEqual(cursor.fetchone()[0], "PENDING")
        # Independent POS commit is retained as a receipt. Retry completes only
        # source synchronization instead of debiting those two pieces again.
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 98)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 1)
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 98)

    def test_confirmation_deducts_pieces_once_and_later_statuses_do_not_deduct_again(self):
        self.save_mobile_order()
        for status in ("CONFIRMED", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"):
            self.assertEqual(self.patch_status(status).status_code, 200)
            self.stock.refresh_from_db()
            self.assertEqual(self.stock.quantity_available, 98)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 1)
        self.assertEqual(Merchandising.objects.count(), 0)

    def test_insufficient_stock_prevents_confirmation_and_history(self):
        self.save_mobile_order()
        self.stock.quantity_available = 1
        self.stock.save()
        response = self.patch_status("CONFIRMED")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.status_of(), "PENDING")
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 1)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 0)

    def test_bulk_short_stock_rolls_back_all_inventory_receipts(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        self.stock.quantity_available = 3
        self.stock.save()
        self.assertEqual(self.confirm("MSP-20261005-001", "MSP-20261005-002").status_code, 409)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 3)
        self.assertEqual(MobileOrderStockCommitment.objects.count(), 0)
        self.assertEqual(self.status_of(), "PENDING")

    def test_cancellation_restores_confirmed_stock_once(self):
        self.save_mobile_order()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 200)
        self.assertEqual(self.patch_status("CANCELLED").status_code, 200)
        self.assertEqual(self.patch_status("CANCELLED").status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertFalse(MobileOrderStockCommitment.objects.get().active)

    def reservation(self, status="Reserved", quantity=2):
        marker = "[AIVA:12345678-1234-1234-1234-123456789abc]"
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE merchandising SET remarks=%s", [marker])
        transaction_type, _ = TransactionType.objects.get_or_create(name="Warehouse")
        sale = Merchandising.objects.create(
            msp_no="MSP-20261005-001", warehouse=self.warehouse, transaction_type=transaction_type,
            handled_by="AIVA", status=status, expected_sale="124.50", remarks=marker,
        )
        MerchandisingItem.objects.create(merchandising=sale, product=self.product, dispatched_pcs=quantity)
        return sale

    def test_pos_reservation_is_reused_and_completion_does_not_deduct_twice(self):
        sale = self.reservation()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 200)
        sale.refresh_from_db()
        self.assertEqual(sale.status, "Confirmed")
        self.assertEqual(sale.items.get().sold_pcs, 2)
        self.assertEqual(Merchandising.objects.count(), 1)
        self.assertEqual(MobileOrderStockCommitment.objects.get().merchandising, sale)
        from .serializers import MerchandisingSerializer
        serializer = MerchandisingSerializer(sale, data={"status": "Complete"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 98)

    def test_processed_pos_reservation_is_not_deducted_again(self):
        self.reservation(status="Complete")
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 409)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertEqual(self.status_of(), "PENDING")

    def test_pos_reservation_with_different_products_is_rejected(self):
        self.reservation(quantity=3)
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 409)
        self.assertEqual(self.status_of(), "PENDING")

    def test_linked_reservation_cancellation_restores_inventory_once(self):
        sale = self.reservation()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 200)
        self.assertEqual(self.patch_status("CANCELLED").status_code, 200)
        self.assertEqual(self.patch_status("CANCELLED").status_code, 200)
        self.stock.refresh_from_db()
        sale.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
        self.assertEqual(sale.status, "Cancelled")

    def test_mobile_cancellation_cannot_restore_goods_already_picked_up_in_pos(self):
        sale = self.reservation()
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 200)
        from .serializers import MerchandisingSerializer
        serializer = MerchandisingSerializer(sale, data={"status": "Complete"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertEqual(self.patch_status("CANCELLED").status_code, 409)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 98)
        self.assertEqual(self.status_of(), "CONFIRMED")

    def test_confirmed_history_excludes_pending_orders_and_survives_address_filtering(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002", status="CONFIRMED")
        response = self.client.get("/api/mobile-orders/", {"processed": "true"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([order["order_number"] for order in response.data["results"]], ["MSP-20261005-002"])

    def test_missing_product_mapping_is_rejected_without_guessing_numeric_id(self):
        self.save_mobile_order()
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("UPDATE product SET system_code='NOT-IN-POS' WHERE id=9")
        self.assertEqual(self.patch_status("CONFIRMED").status_code, 409)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)
