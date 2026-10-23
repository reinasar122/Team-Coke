from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Product, Promotion, Role, RoleAccessibility, User, Warehouse
from .pos_auth import create_pos_session_token


class PromotionTests(TestCase):
    def setUp(self):
        self.today = date(2026, 10, 17)
        self.day_patch = patch("api.promotions.promotion_today", return_value=self.today)
        self.day_patch.start()
        self.addCleanup(self.day_patch.stop)
        self.warehouse = Warehouse.objects.create(name="Main", email="main@example.com")
        self.other = Warehouse.objects.create(name="Other", email="other@example.com")
        self.product = Product.objects.create(product_name="Coke 1L", system_code="COKE", warehouse=self.warehouse)
        self.other_product = Product.objects.create(product_name="Yakult", system_code="YAKULT", warehouse=self.other)
        role = Role.objects.create(name="Cashier")
        self.permission = RoleAccessibility.objects.create(role=role, submenu="Trading", view=True, create=True)
        self.user = User.objects.create(role=role, warehouse=self.warehouse, phone_number="09123456789",
                                        is_active=True, is_approved=True, must_change_password=False)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + create_pos_session_token(self.user))
        self.payload = {"promotion_type": "occasional-discount", "discount_percent": "12.50",
                        "product_ids": [self.product.pk], "start_date": "2026-10-17", "end_date": "2026-10-17"}

    def test_saved_offer_is_public_with_exact_products_and_inclusive_dates(self):
        response = self.client.post("/api/promotions/", self.payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Promotion.objects.count(), 1)
        self.assertEqual(response.data["title"], "12.5% Off")
        self.assertEqual(response.data["status"], "Active")
        feed = APIClient().get("/api/promotions/active/")
        self.assertEqual(feed.status_code, 200)
        self.assertEqual(feed.data[0]["id"], response.data["id"])
        self.assertEqual(feed.data[0]["products"], [{"id": self.product.pk, "product_name": "Coke 1L"}])
        self.assertEqual(feed["Cache-Control"], "no-store")
        self.assertNotIn("created_by", feed.data[0])

    def test_feed_excludes_scheduled_expired_disabled_and_empty_promotions(self):
        for delta, active, attach in [(0, True, True), (1, True, True), (-1, True, True), (0, False, True), (0, True, False)]:
            day = self.today + timedelta(days=delta)
            promotion = Promotion.objects.create(warehouse=self.warehouse, promotion_type="free-shipping",
                                                  start_date=day, end_date=day, is_active=active)
            if attach:
                promotion.products.add(self.product)
        response = APIClient().get("/api/promotions/active/")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], "Active")
        self.assertEqual(APIClient().get(f"/api/promotions/active/?warehouse={self.other.pk}").data, [])
        self.assertEqual(APIClient().get("/api/promotions/active/?warehouse=wrong").status_code, 400)

    def test_invalid_dates_discounts_and_products_do_not_save(self):
        cases = [{"end_date": "2026-10-16"}, {"discount_percent": "0"}, {"discount_percent": "100.01"},
                 {"product_ids": []}, {"product_ids": [self.other_product.pk]}, {"product_ids": [99999]},
                 {"promotion_type": "unknown"}]
        for change in cases:
            with self.subTest(change=change):
                response = self.client.post("/api/promotions/", {**self.payload, **change}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(Promotion.objects.count(), 0)

    def test_writes_and_management_listing_require_trading_permission_and_warehouse(self):
        self.assertEqual(APIClient().post("/api/promotions/", self.payload, format="json").status_code, 401)
        self.assertEqual(APIClient().get("/api/promotions/").status_code, 401)
        self.assertEqual(self.client.post(f"/api/promotions/?warehouse={self.other.pk}", self.payload, format="json").status_code, 403)
        self.permission.create = False
        self.permission.save()
        self.assertEqual(self.client.post("/api/promotions/", self.payload, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/promotions/").status_code, 200)

    def test_non_discount_offers_do_not_keep_a_hidden_discount(self):
        response = self.client.post("/api/promotions/", {**self.payload, "promotion_type": "buy-one-take-one"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["discount_percent"], "0.00")
        self.assertEqual(response.data["title"], "Buy One Take One")

    def test_management_list_hides_expired_promotions(self):
        expired = Promotion.objects.create(
            warehouse=self.warehouse, promotion_type="free-shipping",
            start_date=self.today - timedelta(days=2), end_date=self.today - timedelta(days=1),
            is_active=True,
        )
        expired.products.add(self.product)
        active = Promotion.objects.create(
            warehouse=self.warehouse, promotion_type="free-shipping",
            start_date=self.today, end_date=self.today, is_active=True,
        )
        active.products.add(self.product)
        response = self.client.get("/api/promotions/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [active.pk])

    def test_active_promotion_can_be_edited(self):
        promotion = Promotion.objects.create(
            warehouse=self.warehouse, promotion_type="occasional-discount", discount_percent="12.50",
            start_date=self.today, end_date=self.today + timedelta(days=3), is_active=True,
        )
        promotion.products.add(self.product)
        response = self.client.patch(
            f"/api/promotions/{promotion.pk}/",
            {"discount_percent": "15.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["discount_percent"], "15.00")
        promotion.refresh_from_db()
        self.assertEqual(str(promotion.discount_percent), "15.00")

    def test_expired_promotion_cannot_be_edited(self):
        promotion = Promotion.objects.create(
            warehouse=self.warehouse, promotion_type="free-shipping",
            start_date=self.today - timedelta(days=2), end_date=self.today - timedelta(days=1),
            is_active=True,
        )
        promotion.products.add(self.product)
        response = self.client.patch(f"/api/promotions/{promotion.pk}/", {"end_date": "2026-10-30"}, format="json")
        self.assertEqual(response.status_code, 400)
