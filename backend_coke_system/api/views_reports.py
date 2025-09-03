# app/views_reports.py
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import (
    Sum, F, Q, Value, Case, When, ExpressionWrapper,
    DecimalField, IntegerField
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Merchandising, MerchandisingItem, MiscellaneousItem

# ---------- helpers for numeric types ----------
DECIMAL = DecimalField(max_digits=14, decimal_places=2)
DEC0 = Value(Decimal("0"), output_field=DECIMAL)
INT0 = Value(0, output_field=IntegerField())


def _daterange_from_period(period: str, start: str | None, end: str | None) -> tuple[date, date]:
    today = timezone.localdate()
    if period == "this_month":
        return today.replace(day=1), today
    if period == "custom" and start and end:
        try:
            return date.fromisoformat(start), date.fromisoformat(end)
        except ValueError:
            pass
    # default: this week (Mon..today)
    return today - timedelta(days=today.weekday()), today


class SalesReportAPIView(APIView):
    """
    GET /api/reports/sales/?warehouse_id=&route_id=&period=this_week|this_month|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
    """

    def get(self, request):
        warehouse_id = request.query_params.get("warehouse_id")
        route_id = request.query_params.get("route_id")
        period = request.query_params.get("period", "this_week")
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        start_date, end_date = _daterange_from_period(period, start, end)

        # -----------------------
        # Base filters (headers)
        # -----------------------
        hdr_q = Q(date_time__date__gte=start_date, date_time__date__lte=end_date)
        if warehouse_id and warehouse_id != "all":
            hdr_q &= Q(warehouse_id=warehouse_id)
        if route_id and route_id != "all":
            hdr_q &= Q(route_id=route_id)

        sales_hdr = Merchandising.objects.filter(hdr_q)

        # ------------------------------------
        # Product breakdown (via line items)
        # ------------------------------------
        items = MerchandisingItem.objects.filter(merchandising__in=sales_hdr)

        # gross = sold_pcs * selling_price  (Decimal)
        gross_expr = ExpressionWrapper(
            F("sold_pcs") * F("selling_price"),
            output_field=DECIMAL,
        )

        # discount_amount = gross * (discount_percent / 100)  (Decimal)
        disc_expr = ExpressionWrapper(
            gross_expr * (F("discount_percent") / Value(100, output_field=DECIMAL)),
            output_field=DECIMAL,
        )

        # revenue_line = prefer actual_sale if set (>0), else (gross - discount)  (Decimal)
        revenue_line_expr = Case(
            When(actual_sale__gt=0, then=F("actual_sale")),
            default=ExpressionWrapper(gross_expr - Coalesce(disc_expr, DEC0), output_field=DECIMAL),
            output_field=DECIMAL,
        )

        product_qs = (
            items
            .values("product__product_name")
            .annotate(
                qty_sold=Coalesce(Sum("sold_pcs"), INT0),
                gross=Coalesce(Sum(gross_expr), DEC0),
                discount=Coalesce(Sum(disc_expr), DEC0),
                revenue=Coalesce(Sum(revenue_line_expr), DEC0),
                returns_qty=Coalesce(Sum("actual_return_pcs"), INT0),
            )
            .order_by("-revenue")
        )

        products = []
        total_revenue = Decimal("0")
        total_gross = Decimal("0")
        total_discount = Decimal("0")
        total_qty = 0
        total_return_qty = 0

        for r in product_qs:
            name = r["product__product_name"] or "—"
            qty_sold = int(r["qty_sold"] or 0)
            gross = Decimal(r["gross"] or 0)
            discount = Decimal(r["discount"] or 0)
            revenue = Decimal(r["revenue"] or 0)
            returned = int(r["returns_qty"] or 0)

            discount_rate = float((discount / gross) if gross else Decimal("0"))
            denom = qty_sold + returned
            return_rate = float((Decimal(returned) / Decimal(denom)) if denom else Decimal("0"))

            profit = revenue  # no COGS available

            products.append({
                "product": name,
                "qty_sold": qty_sold,
                "revenue": float(revenue),
                "profit": float(profit),
                "discount_rate": discount_rate,
                "return_rate": return_rate,
            })

            total_revenue += revenue
            total_gross += gross
            total_discount += discount
            total_qty += qty_sold
            total_return_qty += returned

        overall_return_rate = float(
            (Decimal(total_return_qty) / Decimal(total_qty + total_return_qty))
            if (total_qty + total_return_qty) else Decimal("0")
        )

        # ------------------------------------
        # Sales by Route (use route_name)
        # ------------------------------------
        by_route_qs = (
            items.values("merchandising__route__route_name")
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_route = [
            {"name": r["merchandising__route__route_name"] or "—", "revenue": float(r["revenue"])}
            for r in by_route_qs
        ]

        # ------------------------------------
        # Sales by Warehouse (use warehouse_name)
        # ------------------------------------
        by_wh_qs = (
            items.values("merchandising__warehouse__warehouse_name")
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_warehouse = [
            {"name": r["merchandising__warehouse__warehouse_name"] or "—", "revenue": float(r["revenue"])}
            for r in by_wh_qs
        ]

        # ------------------------------------
        # Header-level expected vs actual
        # ------------------------------------
        hdr_aggs = sales_hdr.aggregate(
            expected=Coalesce(Sum("expected_sale"), DEC0),
            actual=Coalesce(Sum("actual_sale"), DEC0),
            misc_sum=Coalesce(Sum("miscellaneous"), DEC0),
        )
        expected_sale = Decimal(hdr_aggs["expected"] or 0)
        actual_sale = Decimal(hdr_aggs["actual"] or 0)
        difference = actual_sale - expected_sale

        # ------------------------------------
        # Misc Expenses
        # ------------------------------------
        misc_items_qs = MiscellaneousItem.objects.filter(merchandising__in=sales_hdr)

        misc_expenses_list = []
        misc_total = Decimal("0")
        for m in misc_items_qs.select_related("merchandising").order_by("-id"):
            amt = Decimal(m.amount or 0)
            misc_total += amt
            d = m.merchandising.date_time.date() if m.merchandising and m.merchandising.date_time else None
            misc_expenses_list.append({
                "description": m.description or "—",
                "notes": "",
                "amount": float(amt),
                "date": d.isoformat() if d else None,
            })

        # ------------------------------------
        # Summary
        # ------------------------------------
        net_profit = total_revenue - misc_total  # no COGS in schema

        summary = {
            "total_revenue": float(total_revenue),
            "net_profit": float(net_profit),
            "discounts": float(total_discount),
            "return_rate": overall_return_rate,
        }

        payload = {
            "summary": summary,
            "products": products,
            "by_route": by_route,
            "by_warehouse": by_warehouse,
            "returns": {
                "expected_sale": float(expected_sale),
                "actual_sale": float(actual_sale),
                "difference": float(difference),
                "supplier_returnables": 0.0,
            },
            "misc_expenses": misc_expenses_list,
        }
        return Response(payload)
