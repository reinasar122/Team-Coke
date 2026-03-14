# api/views_reports.py
from __future__ import annotations

from datetime import date, timedelta, datetime
from decimal import Decimal

from django.db.models import (
    Sum, F, Q, Value, ExpressionWrapper,
    DecimalField, IntegerField, OuterRef, Subquery, Case, When, Avg, CharField
)

from django.db.models.functions import Cast, Coalesce, NullIf
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import FieldError
from datetime import date, timedelta, datetime, timezone as dt_timezone
from rest_framework import viewsets



from .serializers import CreditPaymentDisplaySerializer


from .models import (
    Merchandising,
    MerchandisingItem,
    MiscellaneousItem,
    Product,
    ReceivingItem,
    ReturnableStock,   # 👈 use latest unit_cost from receiving lines
    UnitType,
    CreditPayment,
    CreditLedger,
)

# ---------- helpers ----------
DECIMAL = DecimalField(max_digits=14, decimal_places=2)
DEC0 = Value(Decimal("0"), output_field=DECIMAL)
INT0 = Value(0, output_field=IntegerField())


def _daterange_from_period(period, start, end):
    today = timezone.localdate()

    if period == "this_month":
        start_d = today.replace(day=1)
        end_d = (start_d + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        return start_d, end_d

    if period == "custom" and start and end:
        try:
            return date.fromisoformat(start), date.fromisoformat(end)
        except ValueError:
            pass

    # ✅ Always cover full week (Mon..Sun)
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    return start_of_week, end_of_week



def _make_dt_window(start_d: date, end_d: date) -> tuple[datetime, datetime]:
    """
    Build a timezone-aware datetime window [start_dt, end_dt)
    in the current timezone (start at 00:00 local, end exclusive at next day 00:00 local).
    """
    tz = timezone.get_current_timezone()
    start_naive = datetime.combine(start_d, datetime.min.time())
    end_naive = datetime.combine(end_d + timedelta(days=1), datetime.min.time())
    start_dt = timezone.make_aware(start_naive, tz) if timezone.is_naive(start_naive) else start_naive
    end_dt = timezone.make_aware(end_naive, tz) if timezone.is_naive(end_naive) else end_naive
    return start_dt, end_dt


class SalesReportAPIView(APIView):
    """
    GET /api/sales_report/?warehouse_id=&route_id=&period=this_week|this_month|custom&start=YYYY-MM-DD&end=YYYY-MM-DD&debug=1
    """

    def get(self, request):
        warehouse_id = (request.query_params.get("warehouse_id") or "").strip()
        route_id = (request.query_params.get("route_id") or "").strip()
        period = request.query_params.get("period", "this_week")
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        start_date, end_date = _daterange_from_period(period, start, end)
        start_dt, end_dt = _make_dt_window(start_date, end_date)

        # Debugging date range
        print(f"Start Date: {start_dt}, End Date: {end_dt}")

        # === Normalize "all" ===
        if warehouse_id.lower() == "all":
            warehouse_id = None
        if route_id.lower() == "all":
            route_id = None

        # ------------------------------
        # FILTER SETUP
        # ------------------------------
        hdr_q = Q(date_time__gte=start_dt, date_time__lt=end_dt)
        if warehouse_id:
            hdr_q &= Q(warehouse_id=warehouse_id)
        if route_id:
            hdr_q &= Q(route_id=route_id)

        sales_hdr = Merchandising.objects.filter(hdr_q)

                # ------------------------------
        # Fetch credit sales data (FILTERED)
        # ------------------------------
        credit_q = Q(created_at__gte=start_dt, created_at__lt=end_dt)

        if warehouse_id:
            credit_q &= Q(warehouse_id=warehouse_id)

        if route_id:
            # CreditLedger has FK: merchandising -> Merchandising -> route
            credit_q &= Q(merchandising__route_id=route_id)

        credit_sales = (
            CreditLedger.objects
            .filter(credit_q)
            .annotate(
                credit_amount=ExpressionWrapper(
                    Coalesce(F("total_amount"), DEC0) - Coalesce(F("amount_paid"), DEC0),
                    output_field=DECIMAL,
                ),
                computed_status=Case(
                    When(amount_paid__gte=F("total_amount"), then=Value(CreditLedger.STATUS_PAID)),
                    When(amount_paid__gt=0, then=Value(CreditLedger.STATUS_PARTIAL)),
                    default=Value(CreditLedger.STATUS_PENDING),
                    output_field=CharField(),
                ),
            )
            .values(
                "customer_name",
                "total_amount",
                "amount_paid",
                "credit_amount",
                "due_date",
                "computed_status",
                "msp_no",
            )
            .order_by("-created_at")
        )

        credit_sales_data = [
            {
                "customerName": sale["customer_name"],
                "creditAmount": float(sale["credit_amount"] or 0),
                "totalAmount": float(sale["total_amount"] or 0),
                "amountPaid": float(sale["amount_paid"] or 0),
                "dueDate": sale["due_date"].strftime("%m-%d-%Y") if sale["due_date"] else None,
                "status": sale["computed_status"],
                "mspNo": sale["msp_no"],
            }
            for sale in credit_sales
        ]


        # ------------------------------
        # FILTER SETUP
        # ------------------------------
        items_base_q = Q(
            merchandising__date_time__gte=start_dt,
            merchandising__date_time__lt=end_dt,
        )

        if warehouse_id:
            items_base_q &= Q(merchandising__warehouse_id=warehouse_id)
        if route_id:
            items_base_q &= Q(merchandising__route_id=route_id)


       # ------------------------------
        # DISCREPANCIES (FULL) - PCS + SHELL (separate) ✅ FIXED
        # Shell loss must use shell_price only (NOT content_no * selling_price)
        # ------------------------------

        # Amount for pcs discrepancy: pcs * selling_price
        pcs_amount_expr = ExpressionWrapper(
            Cast(Coalesce(F("discrepancy_full_pcs"), INT0), DECIMAL) * Coalesce(F("selling_price"), DEC0),
            output_field=DECIMAL
        )

        # Amount for shell discrepancy: shell * shell_price  ✅
        # IMPORTANT: update the ORM path to your real pricing field if different
        shell_price_expr = Coalesce(F("product__price__shell_price"), DEC0)  # <-- change if needed

        shell_amount_expr = ExpressionWrapper(
            Cast(Coalesce(F("discrepancy_full_shell"), INT0), DECIMAL) * shell_price_expr,
            output_field=DECIMAL
        )

        discrepancies_full_qs = (
            MerchandisingItem.objects
            .filter(items_base_q)
            .select_related("product", "product__unit_type", "product__price")  # adjust if your relation name differs
            .values("product__product_name")
            .annotate(
                pcs_qty=Coalesce(Sum("discrepancy_full_pcs"), INT0),
                shell_qty=Coalesce(Sum("discrepancy_full_shell"), INT0),

                # ✅ total amount = sum(pcs_amount) + sum(shell_amount)
                amount=ExpressionWrapper(
                    Coalesce(Sum(pcs_amount_expr), DEC0) + Coalesce(Sum(shell_amount_expr), DEC0),
                    output_field=DECIMAL
                ),
            )
            .filter(Q(pcs_qty__gt=0) | Q(shell_qty__gt=0))
            .order_by("-amount")
        )

        discrepancies_full = [
            {
                "product": r["product__product_name"],
                "pcs_qty": int(r["pcs_qty"] or 0),
                "shell_qty": int(r["shell_qty"] or 0),
                "amount": float(r["amount"] or 0),
            }
            for r in discrepancies_full_qs
        ]


       # ------------------------------
        # DISCREPANCIES (EMPTY) - PCS + SHELL (separate) ✅ FIXED (no nested aggregates)
        # Bottle loss = pcs_qty * avg(empty_price_pc)
        # Shell loss  = shell_qty * avg(empty_price_shell)
        # ------------------------------

        discrepancies_empty_qs = (
            MerchandisingItem.objects
            .filter(items_base_q)
            .select_related("product")
            .values("product_id", "product__product_name")
            .annotate(
                pcs_qty=Coalesce(Sum("discrepancy_empties_pc"), INT0),
                shell_qty=Coalesce(Sum("discrepancy_empties_shell"), INT0),

                # get prices per product (within filter range)
                bottle_price=Coalesce(Avg("empty_price_pc"), DEC0),
                shell_price=Coalesce(Avg("empty_price_shell"), DEC0),
            )
            .annotate(
                amount=ExpressionWrapper(
                    Cast(F("pcs_qty"), DECIMAL) * F("bottle_price")
                    + Cast(F("shell_qty"), DECIMAL) * F("shell_price"),
                    output_field=DECIMAL
                )
            )
            .filter(Q(pcs_qty__gt=0) | Q(shell_qty__gt=0))
            .order_by("-amount")
        )

        discrepancies_empty = [
            {
                "product": r["product__product_name"],
                "pcs_qty": int(r["pcs_qty"] or 0),
                "shell_qty": int(r["shell_qty"] or 0),
                "amount": float(r["amount"] or 0),
            }
            for r in discrepancies_empty_qs
        ]


        # ------------------------------
        # PRODUCT BREAKDOWN (fixed)
        # ------------------------------
        items_aggs = (
            MerchandisingItem.objects
            .filter(items_base_q)
            .values("product_id", "product__product_name")
            .annotate(
                qty_sold=Coalesce(Sum("sold_pcs"), INT0),
                gross=Coalesce(Sum(ExpressionWrapper(
                    F("sold_pcs") * F("selling_price"),
                    output_field=DECIMAL
                )), DEC0),
                discount=Coalesce(Sum(ExpressionWrapper(
                    (F("sold_pcs") * F("selling_price")) * (F("discount_percent") / Value(100)),
                    output_field=DECIMAL
                )), DEC0),
            )
        )

        products = []
        total_revenue = Decimal("0")


        by_product_id = {r["product_id"]: r for r in items_aggs}

        # ✅ Use latest cost before or within period
        last_cost_sq = Subquery(
            ReceivingItem.objects
            .filter(product=OuterRef("pk"), receiving__date_time__lte=end_dt)
            .order_by("-receiving__date_time")
            .values("unit_cost")[:1]
        )

        products_with_cost = (
            Product.objects
            .filter(id__in=by_product_id.keys())
            .annotate(unit_cost=Coalesce(last_cost_sq, DEC0))
            .only("id", "product_name")
        )

        # Initialize totals
        total_gross = total_discount = total_returns_value = total_revenue = Decimal("0")
        total_qty = total_return_qty = 0
        products = []


        # ------------------------------
        # Filter returnable products
        # ------------------------------
        returnable_products = Product.objects.filter(unit_type__returnable=True)

        # Now, modify the base queryset to only consider returnable products for the return rate calculation.
        base_qs = MerchandisingItem.objects.filter(
            items_base_q,
            product__in=returnable_products  # Only include returnable products
        )

        # Aggregate the totals for returnable products only
        totals = base_qs.aggregate(
            total_disp_shell=Coalesce(Sum("dispatched_shell"), 0),
            total_empty_shell=Coalesce(Sum("empty_return_shell"), 0),
            total_disp_pcs=Coalesce(Sum("dispatched_pcs"), 0),
            total_empty_pcs=Coalesce(Sum("empty_return_pcs"), 0),
        )

        # Convert to Decimal for safe division
        total_disp_shell = Decimal(totals["total_disp_shell"] or 0)
        total_empty_shell = Decimal(totals["total_empty_shell"] or 0)
        total_disp_pcs = Decimal(totals["total_disp_pcs"] or 0)
        total_empty_pcs = Decimal(totals["total_empty_pcs"] or 0)

        # Weighted average rate calculation for returnables only
        shell_rate = Decimal("0")
        if total_disp_shell > 0:
            shell_rate = (total_empty_shell / total_disp_shell)

        pcs_rate = Decimal("0")
        if total_disp_pcs > 0:
            pcs_rate = (total_empty_pcs / total_disp_pcs)

        # If both exist, average them; otherwise use whichever is non-zero
        if total_disp_shell > 0 and total_disp_pcs > 0:
            avg_rate = (shell_rate + pcs_rate) / Decimal("2")
        else:
            avg_rate = shell_rate or pcs_rate

        # Send as float (fraction; frontend multiplies by 100 for %)
        returned_rate = float(avg_rate)

        # Now proceed with the return rate



        for p in products_with_cost:
            a = by_product_id.get(p.id) or {}
            qty_sold = int(a.get("qty_sold", 0) or 0)
            gross = Decimal(a.get("gross", 0) or 0)
            discount = Decimal(a.get("discount", 0) or 0)
            returned_qty = int(a.get("actual_return_pcs", 0) or 0)
            returned_value = Decimal(returned_qty) * Decimal(getattr(p, "unit_cost", 0))

            # ✅ Compute discount %
            discount_pct = Decimal("0.0")
            if gross > 0:
                discount_pct = (discount / gross * 100).quantize(Decimal("0.1"))

            # ✅ Net revenue & profit
            net_revenue = (gross - discount - returned_value).quantize(Decimal("0.01"))
            cogs = Decimal(getattr(p, "unit_cost", 0)) * Decimal(max(qty_sold - returned_qty, 0))
            profit = (net_revenue - cogs).quantize(Decimal("0.01"))

            products.append({
                "product": p.product_name,
                "qty_sold": qty_sold,
                "revenue": float(net_revenue),
                "profit": float(profit),

                # NEW: exact peso discount per product
                "discount_amount": float(discount),

                # Keep the rate for charts if needed
                "discount_rate": float(discount_pct),
            })


            # Accumulate totals
            total_gross += gross
            total_discount += discount
            total_returns_value += returned_value
            total_revenue += net_revenue
            total_qty += qty_sold
            total_return_qty += returned_qty

        # ------------------------------------
        # Misc Expenses (MSP only in notes)
        # ------------------------------------
        misc_items_qs = (
            MiscellaneousItem.objects
            .filter(
                merchandising__date_time__gte=start_dt,
                merchandising__date_time__lt=end_dt,
            )
            .select_related("merchandising")
            .order_by("-id")
        )

        if warehouse_id:
            misc_items_qs = misc_items_qs.filter(merchandising__warehouse_id=warehouse_id)
        if route_id:
            misc_items_qs = misc_items_qs.filter(merchandising__route_id=route_id)

        misc_expenses_list = []
        misc_total = Decimal("0")
        tz = timezone.get_current_timezone()

        for m in misc_items_qs:
            amt = Decimal(m.amount or 0)
            misc_total += amt
            merch = m.merchandising

            msp_no = getattr(merch, "msp_no", None)
            notes = f"MSP {msp_no}" if msp_no else None

            d = getattr(merch, "date_time", None)
            date_str = d.astimezone(tz).date().isoformat() if d else None

            misc_expenses_list.append({
                "description": m.description or "—",
                "notes": notes,
                "amount": float(amt),
                "date": date_str,
            })

        # Optional fallback: show header total if no itemized rows exist
        header_misc_total = (
            Merchandising.objects.filter(
                date_time__gte=start_dt,
                date_time__lt=end_dt,
                **({"warehouse_id": warehouse_id} if warehouse_id else {}),
                **({"route_id": route_id} if route_id else {}),
            )
            .aggregate(msum=Coalesce(Sum("miscellaneous"), DEC0))["msum"] or Decimal("0")
        )
        if not misc_expenses_list and header_misc_total:
            misc_total += Decimal(header_misc_total)
            misc_expenses_list.append({
                "description": "Miscellaneous (header total)",
                "notes": None,
                "amount": float(header_misc_total),
                "date": start_date.isoformat(),
            })



        # ------------------------------
        # KPI SUMMARY (aligned with product breakdown)
        # ------------------------------
        qs = MerchandisingItem.objects.filter(items_base_q).annotate(
            line_gross=F("sold_pcs") * F("selling_price"),  # Gross Revenue
            line_discount=F("sold_pcs") * F("selling_price") * (F("discount_percent") / Value(100, output_field=DECIMAL)),  # Discount
            line_returns=F("actual_return_pcs") * F("selling_price"),  # This is returns, but we won't use it for Net Revenue anymore
            last_unit_cost=Subquery(
                ReceivingItem.objects.filter(product=OuterRef("product")).order_by("-id").values("unit_cost")[:1]
            ),
            # ✅ Line COGS: Don't subtract returns from COGS (remove returns from here)
            line_cogs=ExpressionWrapper(
                F("sold_pcs") * Coalesce(F("last_unit_cost"), 0),
                output_field=DECIMAL,
            ),
            # ✅ Net Revenue = Gross Revenue - Discount (remove returns from Net Revenue calculation)
            line_net=ExpressionWrapper(
                F("line_gross") - Coalesce(F("line_discount"), 0),
                output_field=DECIMAL,
            ),
        )

        # 🩹 Ensure clean numeric aggregates (avoid CombinedExpression)
        sums = qs.aggregate(
            gross_revenue=Sum(Cast("line_gross", DECIMAL)),
            discount_total=Sum(Cast("line_discount", DECIMAL)),
            returns_total=Sum(Cast("line_returns", DECIMAL)),  # We still calculate returns but won't use it for Net Revenue
            net_revenue=Sum(Cast("line_net", DECIMAL)),  # Net Revenue is now gross - discount
            cogs=Sum(Cast("line_cogs", DECIMAL)),  # COGS will not include returns
        )

        # helper for safe conversion
        def _to_decimal(v):
            try:
                if v is None:
                    return Decimal("0.00")
                if isinstance(v, (int, float, Decimal)):
                    return Decimal(v)
                return Decimal(str(v))
            except Exception:
                return Decimal("0.00")

        # Get the totals for the summary
        gross_val = _to_decimal(sums.get("gross_revenue"))
        net_val = _to_decimal(sums.get("net_revenue"))  # Total Net Revenue (now gross - discount)
        cogs_val = _to_decimal(sums.get("cogs"))  # COGS is now calculated without returns
        disc_val = _to_decimal(sums.get("discount_total"))

        # ✅ Compute net profit after miscellaneous expenses (excluding returned value from the COGS)
        net_profit_value = (net_val - cogs_val - misc_total)  # Net Profit = Net Revenue - COGS - Misc Expenses

        # KPI summary (Net Revenue & Profit)
        revenue_summary = {
            "gross_revenue": float(gross_val),
            "net_revenue": float(net_val),  # The final Net Revenue (Gross - Discount)
            "cogs": float(cogs_val),  # COGS without returns
            "misc_expenses": float(misc_total),  # Total Miscellaneous Expenses
            "net_profit": float(net_profit_value),  # Final Net Profit (after COGS and Misc Expenses)
            "returned_rate": returned_rate,  # Add the return rate for returnable products
        }

        discount_summary = {
            "total_amount": float(disc_val),  # Total Discount Applied
        }


        # ------------------------------
        # Return Rate (weighted by totals)
        # ------------------------------
        # base_qs = MerchandisingItem.objects.filter(items_base_q)

        # totals = base_qs.aggregate(
        #     total_disp_shell=Coalesce(Sum("dispatched_shell"), 0),
        #     total_empty_shell=Coalesce(Sum("empty_return_shell"), 0),
        #     total_disp_pcs=Coalesce(Sum("dispatched_pcs"), 0),
        #     total_empty_pcs=Coalesce(Sum("empty_return_pcs"), 0),
        # )

        # Convert to Decimal for safe division
        total_disp_shell = Decimal(totals["total_disp_shell"] or 0)
        total_empty_shell = Decimal(totals["total_empty_shell"] or 0)
        total_disp_pcs = Decimal(totals["total_disp_pcs"] or 0)
        total_empty_pcs = Decimal(totals["total_empty_pcs"] or 0)

        shell_rate = Decimal("0")
        if total_disp_shell > 0:
            shell_rate = (total_empty_shell / total_disp_shell)

        pcs_rate = Decimal("0")
        if total_disp_pcs > 0:
            pcs_rate = (total_empty_pcs / total_disp_pcs)

        # If both exist, average them; otherwise use whichever is non-zero
        if total_disp_shell > 0 and total_disp_pcs > 0:
            avg_rate = (shell_rate + pcs_rate) / Decimal("2")
        else:
            avg_rate = shell_rate or pcs_rate

        # Send as float (fraction; frontend multiplies by 100 for %)
        returned_rate = float(avg_rate)

        # ------------------------------
        # By Route / Warehouse
        # ------------------------------
        revenue_line_expr = ExpressionWrapper(
            (F("sold_pcs") * F("selling_price"))
            - Coalesce((F("sold_pcs") * F("selling_price")) * (F("discount_percent") / Value(100, output_field=DECIMAL)), DEC0)
            - Coalesce(F("actual_return_pcs") * F("selling_price"), DEC0),
            output_field=DECIMAL,
        )

        items_for_charts = MerchandisingItem.objects.filter(merchandising__in=sales_hdr)

        by_route_qs = (
            items_for_charts.values("merchandising__route__route_name")
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_route = [
            {"name": r["merchandising__route__route_name"], "revenue": float(r["revenue"])}
            for r in by_route_qs if r["merchandising__route__route_name"]
        ]

        by_warehouse_qs = (
            items_for_charts.values("merchandising__warehouse__name")
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_warehouse = [
            {"name": r["merchandising__warehouse__name"], "revenue": float(r["revenue"])}
            for r in by_warehouse_qs if r["merchandising__warehouse__name"]
        ]

       # ------------------------------
        # Returns & Supplier Returnables (Route + Warehouse filtered)
        # ------------------------------
        merch_qs = Merchandising.objects.filter(date_time__gte=start_dt, date_time__lt=end_dt)
        if warehouse_id:
            merch_qs = merch_qs.filter(warehouse_id=warehouse_id)
        if route_id:
            merch_qs = merch_qs.filter(route_id=route_id)

        sums_hdr = merch_qs.aggregate(
            expected_sale_sum=Sum("expected_sale"),
            actual_sale_sum=Sum("actual_sale"),
        )

        # ✅ Supplier Returnables now route-aware
        ret_qs = ReturnableStock.objects.filter(last_updated__gte=start_dt, last_updated__lt=end_dt)

        if warehouse_id:
            ret_qs = ret_qs.filter(warehouse_id=warehouse_id)

        # --- If your model has route_id field directly ---
        if route_id and hasattr(ReturnableStock, "route_id"):
            ret_qs = ret_qs.filter(route_id=route_id)

        # --- If not, link through MerchandisingItem products ---
        elif route_id:
            related_products = MerchandisingItem.objects.filter(
                merchandising__route_id=route_id,
                merchandising__date_time__gte=start_dt,
                merchandising__date_time__lt=end_dt,
            ).values_list("product_id", flat=True)
            ret_qs = ret_qs.filter(product_id__in=related_products)

        ret_sums = ret_qs.aggregate(
            bottle_sum=Coalesce(Sum("empty_bottle_qty"), 0),
            shell_sum=Coalesce(Sum("empty_shell_qty"), 0),
        )


    
        #     # ------------------------------------
        #     # Summary  ✅ unchanged logic, but uses misc_total from above
        #     # ------------------------------------
        #     net_profit = total_revenue - misc_total

        #     summary = {
        #         "total_revenue": float(total_revenue),
        #         "net_profit": float(net_profit),
        #         "discounts": float(total_discount),
        #         "return_rate": overall_return_rate,
        #     }


        # # ------------------------------------
        # # Summary (unchanged for now)
        # # ------------------------------------
        # net_profit = total_revenue - misc_total

        # Safely convert expected/actual sale sums to floats before computing difference
        expected = float(sums_hdr.get("expected_sale_sum") or 0)
        actual = float(sums_hdr.get("actual_sale_sum") or 0)
        difference = actual - expected


        summary = {
            "revenue": revenue_summary,
            "discount": discount_summary,
            # "returned_rate": returned_rate,
        }

        payload = {
            "summary": summary,
            "products": products,
            "by_route": by_route,
            "by_warehouse": by_warehouse,
            "returns": {
                "expected_sale": expected,
                "actual_sale": actual,
                "difference": difference,
                "supplier_returnables": {
                    "bottle": float(ret_sums.get("bottle_sum") or 0),
                    "shell": float(ret_sums.get("shell_sum") or 0),
                },
            },
            "misc_expenses": misc_expenses_list,
            "credit_sales": credit_sales_data,
            "discrepancies_full": discrepancies_full,
            "discrepancies_empty": discrepancies_empty,
        }

        return Response(payload)



def _parse_period(period, start, end):
    now = datetime.now()
    if period == "this_month":
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # next month start then minus 1s
        if s.month == 12:
            next_month = s.replace(year=s.year + 1, month=1, day=1)
        else:
            next_month = s.replace(month=s.month + 1, day=1)
        e = next_month - timedelta(seconds=1)
        return s, e
    if period == "custom" and start and end:
        try:
            return datetime.fromisoformat(start), datetime.fromisoformat(end)
        except Exception:
            pass
    # default this_week (Mon..Sun)
    weekday = now.weekday()
    s = now - timedelta(days=weekday)
    s = s.replace(hour=0, minute=0, second=0, microsecond=0)
    e = s + timedelta(days=7) - timedelta(seconds=1)
    return s, e


class ProductBreakdownReport(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        warehouse_id = request.GET.get("warehouse_id")
        route_id = request.GET.get("route_id")
        period = request.GET.get("period", "this_week")
        start = request.GET.get("start")
        end = request.GET.get("end")

        start_dt, end_dt = _parse_period(period, start, end)

        base_qs = (
            MerchandisingItem.objects
            .select_related("merchandising", "product")
            .filter(
                merchandising__date_time__gte=start_dt,
                merchandising__date_time__lte=end_dt,
            )
        )

        if warehouse_id and warehouse_id != "all":
            base_qs = base_qs.filter(merchandising__warehouse_id=warehouse_id)

        if route_id and route_id != "all":
            base_qs = base_qs.filter(merchandising__route_id=route_id)

        DEC = DecimalField(max_digits=14, decimal_places=2)

        # Reuse same logic as KPI
        base_qs = base_qs.annotate(
            line_gross=F("sold_pcs") * F("selling_price"),
            line_discount=F("sold_pcs") * F("selling_price") * (F("discount_percent") / Value(100, output_field=DEC)),
            line_returns=F("actual_return_pcs") * F("selling_price"),
            last_unit_cost=Subquery(
                ReceivingItem.objects
                .filter(product=OuterRef("product"))
                .order_by("-id")
                .values("unit_cost")[:1]
            ),
            line_cogs=ExpressionWrapper(
                (F("sold_pcs") - Coalesce(F("actual_return_pcs"), 0)) * Coalesce(F("last_unit_cost"), 0),
                output_field=DEC,
            ),
            line_net=ExpressionWrapper(
                F("line_gross") - Coalesce(F("line_discount"), 0) - Coalesce(F("line_returns"), 0),
                output_field=DEC,
            ),
        )

        grouped = (
            base_qs
            .values("product_id", "product__product_name", "merchandising__warehouse_id")
            .annotate(
                qty=Coalesce(Sum("sold_pcs"), 0),
                revenue=Coalesce(Sum("line_net"), DEC0),   # Net revenue per product
                cogs=Coalesce(Sum("line_cogs"), DEC0),
                discount_amount=Coalesce(Sum("line_discount"), DEC0),  # new
            )
            .order_by("-revenue")
        )


        rows = []
        for g in grouped:
            revenue = Decimal(g["revenue"] or 0)
            cogs = Decimal(g["cogs"] or 0)
            profit = revenue - cogs  # product-level net profit (before misc)

            rows.append({
                "product": g["product__product_name"],
                "product_id": g["product_id"],
                "warehouse_id": g["merchandising__warehouse_id"],
                "qty": g["qty"],
                "revenue": float(revenue),
                "profit": float(profit),
                "discount_amount": float(g.get("discount_amount") or 0),  # new
            })


        return Response({"rows": rows})
    
    
class CreditSalesViewSet(viewsets.ModelViewSet):
    queryset = CreditPayment.objects.select_related('credit').all()  # This ensures CreditLedger is fetched along with CreditPayment
    serializer_class = CreditPaymentDisplaySerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        # Apply any filters you need, for example, filter by customer name, amount, etc.
        customer_name = request.query_params.get('customer_name')
        if customer_name:
            queryset = queryset.filter(credit__customer_name__icontains=customer_name)

        # Apply pagination and return the response
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
def get_sales_report(request):
    # Fetch filters from query params
    warehouse_id = request.query_params.get("warehouse_id", "").strip()
    route_id = request.query_params.get("route_id", "").strip()
    period = request.query_params.get("period", "this_week")
    start = request.query_params.get("start")
    end = request.query_params.get("end")

    start_date, end_date = _daterange_from_period(period, start, end)
    start_dt, end_dt = _make_dt_window(start_date, end_date)

    # Normalize "all" filters
    if warehouse_id.lower() == "all":
        warehouse_id = None
    if route_id.lower() == "all":
        route_id = None

    # ------------------------------
    # Fetch Credit Sales Data Dynamically
    # ------------------------------
    credit_sales = CreditLedger.objects.filter(
        date_time__gte=start_dt, 
        date_time__lt=end_dt
    ).values(
        'customer_name', 
        'total_amount', 
        'due_date', 
        'status', 
        'msp_no'
    )

    credit_sales_data = [
        {
            "customerName": sale["customer_name"],
            "amount": sale["total_amount"],
            "dueDate": sale["due_date"],
            "status": sale["status"],
            "mspNo": sale["msp_no"],  # Example of additional info
        }
        for sale in credit_sales
    ]
    
    # ------------------------------
    # Calculate Dynamic Values
    # ------------------------------
    total_gross_revenue = Decimal("0")
    total_discount = Decimal("0")
    total_revenue = Decimal("0")

    for sale in credit_sales:
        total_gross_revenue += Decimal(sale["total_amount"])
        # Example discount calculation - this would depend on your specific logic
        total_discount += Decimal(sale["total_amount"]) * 0.10  # assuming 10% discount for example
        total_revenue += total_gross_revenue - total_discount

    net_profit = total_revenue - total_cost - total_misc_expenses  # Adjust with your cost and expenses logic

    # ------------------------------
    # Summary data
    # ------------------------------
    summary = {
        "gross_revenue": float(total_gross_revenue),
        "net_revenue": float(total_revenue),  # Final Net Revenue (Gross - Discount)
        "net_profit": float(net_profit),  # Final Net Profit (after costs and expenses)
        "discounts": float(total_discount),  # Total Discount Applied
    }

    # ------------------------------
    # Prepare Final Response Data
    # ------------------------------
    response_data = {
        "summary": summary,
        "credit_sales": credit_sales_data,  # Include credit_sales in the response
        # Include other data fields as needed like products, by_route, returns, etc.
    }

    return Response(response_data)
