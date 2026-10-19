import uuid
from unittest.mock import patch
from django.db import connections, IntegrityError
from .models import MobileDelivery, MobileDeliveryAddress, MobileDeliveryOrder
from .test_mobile_orders import MobileOrderFixture


class MobileDeliveryTests(MobileOrderFixture):
    def setUp(self):
        super().setUp()
        self.permission.edit = True
        self.permission.save()
        self.destination = MobileDeliveryAddress.objects.create(warehouse=self.warehouse, address="Cebu City")

    def group(self, numbers=None, destination=None, request_id=None):
        return self.client.post("/api/mobile-deliveries/", {
            "order_numbers": numbers or ["MSP-20261005-001"],
            "destination_id": destination or self.destination.pk,
            "request_id": str(request_id or uuid.uuid4()),
        }, format="json")

    def test_save_address_and_retrieve_it_after_reload(self):
        response = self.client.post("/api/mobile-delivery-addresses/", {"address": "  Greenview   Cebu City  "}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["address"], "Greenview Cebu City")
        saved = self.client.get("/api/mobile-delivery-addresses/").data["saved"]
        self.assertIn(response.data, saved)

    def test_blank_or_duplicate_address_is_rejected(self):
        for address in ("   ", "cebu  CITY", "a" * 256):
            response = self.client.post("/api/mobile-delivery-addresses/", {"address": address}, format="json")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(MobileDeliveryAddress.objects.count(), 1)

    def test_address_options_and_filter_cover_orders_beyond_first_page(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        with connections["mobile_orders"].cursor() as cursor:
            cursor.execute("INSERT INTO customer VALUES (4, 'Another customer', 'Mandaue City')")
            cursor.execute("UPDATE merchandising SET customer_id=4 WHERE msp_no='MSP-20261005-002'")
        response = self.client.get("/api/mobile-delivery-addresses/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["available"], ["Cebu City", "Mandaue City"])
        filtered = self.client.get("/api/mobile-orders/", {"address": "mandaue", "limit": 1})
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(filtered.data["results"][0]["order_number"], "MSP-20261005-002")

    def test_address_filter_treats_wildcards_as_literal_text(self):
        self.save_mobile_order()
        for address in ("%", "_", "' OR 1=1 --"):
            response = self.client.get("/api/mobile-orders/", {"address": address})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 0)
        self.assertEqual(self.client.get("/api/mobile-orders/", {"address": "a" * 1001}).status_code, 400)

    def test_options_and_filters_use_checkout_snapshot_before_pagination(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        self.save_mobile_order("OTHER-WAREHOUSE", warehouse_id=80)
        first = "100%_! Street, " + "Palanas, " * 35 + "Ginatilan, Cebu"
        second = "Dalanawan, Catarman, Cordova, Cebu"
        with connections["mobile_orders"].cursor() as cursor:
            for number, address in (("MSP-20261005-001", first), ("MSP-20261005-002", second),
                                    ("OTHER-WAREHOUSE", "Private address in another warehouse")):
                cursor.execute("UPDATE merchandising SET remarks=%s WHERE msp_no=%s", [
                    f"[AIVA:c4b41acf-d15f-4c5e-b263-5546502e7e67] Deliver to: {address}; Delivery slot: Morning",
                    number,
                ])
        response = self.client.get("/api/mobile-delivery-addresses/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["available"], [first, second])
        for address in ("ginatilan", first, "%_!"):
            response = self.client.get("/api/mobile-orders/", {"address": address, "limit": 1})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 1)
            self.assertEqual(response.data["results"][0]["order_address"], first)
        response = self.client.get("/api/mobile-orders/", {"address": "Cebu", "limit": 1, "offset": 1})
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        for address in ("Cebu City", "Morning", "Private address", "c4b41acf", "' OR 1=1 --"):
            response = self.client.get("/api/mobile-orders/", {"address": address})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 0)

    def test_multiple_orders_are_saved_as_one_delivery_without_changing_customers(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        response = self.group(["MSP-20261005-001", "MSP-20261005-002"])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(MobileDelivery.objects.count(), 1)
        self.assertEqual(MobileDeliveryOrder.objects.count(), 2)
        self.assertEqual(response.data["order_numbers"], ["MSP-20261005-001", "MSP-20261005-002"])
        reloaded = self.client.get("/api/mobile-deliveries/").data["results"]
        self.assertEqual(reloaded[0]["id"], response.data["id"])
        for order in self.client.get("/api/mobile-orders/").data["results"]:
            self.assertEqual(order["delivery_id"], response.data["id"])
            self.assertEqual(order["delivery_address"], "Cebu City")
            self.assertEqual(order["customer_address"], "Cebu City")
            self.assertEqual(order["status"], "PENDING")

    def test_same_request_id_retries_without_creating_second_delivery(self):
        self.save_mobile_order()
        request_id = uuid.uuid4()
        first = self.group(request_id=request_id)
        retry = self.group(request_id=request_id)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(first.data["id"], retry.data["id"])
        self.assertEqual(MobileDelivery.objects.count(), 1)

    def test_reused_request_id_with_different_orders_is_rejected(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002")
        request_id = uuid.uuid4()
        self.group(request_id=request_id)
        self.assertEqual(self.group(["MSP-20261005-002"], request_id=request_id).status_code, 409)
        self.assertEqual(MobileDeliveryOrder.objects.count(), 1)

    def test_order_cannot_belong_to_two_deliveries(self):
        self.save_mobile_order()
        self.assertEqual(self.group().status_code, 201)
        self.assertEqual(self.group().status_code, 409)
        self.assertEqual(MobileDelivery.objects.count(), 1)

    def test_missing_or_different_warehouse_order_rejects_entire_group(self):
        self.save_mobile_order()
        self.save_mobile_order("MSP-20261005-002", warehouse_id=80)
        for second in ("missing", "MSP-20261005-002"):
            self.assertEqual(self.group(["MSP-20261005-001", second]).status_code, 404)
        self.assertEqual(MobileDelivery.objects.count(), 0)

    def test_other_warehouse_destination_cannot_be_used(self):
        self.save_mobile_order()
        elsewhere = MobileDeliveryAddress.objects.create(warehouse=self.other_warehouse, address="Other area")
        self.assertEqual(self.group(destination=elsewhere.pk).status_code, 400)
        self.assertEqual(MobileDelivery.objects.count(), 0)
        saved = self.client.get("/api/mobile-delivery-addresses/").data["saved"]
        self.assertNotIn(elsewhere.pk, [item["id"] for item in saved])

    def test_dispatched_completed_and_cancelled_orders_cannot_be_grouped(self):
        self.save_mobile_order()
        for status in ("OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "SHIPPED", "COMPLETED"):
            with connections["mobile_orders"].cursor() as cursor:
                cursor.execute("UPDATE merchandising SET status=%s", [status])
            self.assertEqual(self.group().status_code, 409)
        self.assertEqual(MobileDelivery.objects.count(), 0)

    def test_grouping_write_failure_rolls_back_delivery_header(self):
        self.save_mobile_order()
        with patch.object(MobileDeliveryOrder.objects, "bulk_create", side_effect=IntegrityError("conflict")):
            self.assertEqual(self.group().status_code, 409)
        self.assertEqual(MobileDelivery.objects.count(), 0)

    def test_view_only_user_cannot_add_address_or_group_orders(self):
        self.save_mobile_order()
        self.permission.edit = False
        self.permission.save()
        self.assertEqual(self.group().status_code, 403)
        self.assertEqual(self.client.post("/api/mobile-delivery-addresses/", {"address": "New area"}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/mobile-deliveries/").status_code, 200)

    def test_endpoints_require_login_and_reject_warehouse_override(self):
        for path in ("mobile-delivery-addresses", "mobile-deliveries"):
            self.assertEqual(self.client.get(f"/api/{path}/", {"warehouse": self.other_warehouse.pk}).status_code, 403)
        self.client.credentials()
        self.assertEqual(self.group().status_code, 401)
        self.assertEqual(self.client.get("/api/mobile-delivery-addresses/").status_code, 401)

    def test_duplicate_orders_are_rejected(self):
        self.save_mobile_order()
        self.assertEqual(self.group(["MSP-20261005-001"] * 2).status_code, 400)
        self.assertEqual(MobileDelivery.objects.count(), 0)
