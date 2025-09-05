# app/views_reports.py
from __future__ import annotations

from datetime import date as _date, datetime, time as _time, timedelta
from decimal import Decimal
import logging
import os
from tracemalloc import start

from django.db.models import (
    Sum, F, Q, Value, Case, When, ExpressionWrapper,
    DecimalField, IntegerField, Avg
)
from django.db.models import F as DJF
from django.db.models.functions import Coalesce, Cast
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response

from django.core.exceptions import FieldError
from .models import Merchandising, MerchandisingItem, MiscellaneousItem, ReturnableStock
from django.db.models import Min, Max, Count
from rest_framework import status

# ---------- helpers for numeric types ----------
DECIMAL = DecimalField(max_digits=14, decimal_places=2)
DEC0 = Value(Decimal("0"), output_field=DECIMAL)
INT0 = Value(0, output_field=IntegerField())
ZERO = Decimal("0.00")  # kath


def _daterange_from_period(period: str, start: str | None, end: str | None) -> tuple[_date, _date]:
    today = timezone.localdate()
    if period == "this_month":
        return today.replace(day=1), today
    if period == "custom" and start and end:
        try:
            return _date.fromisoformat(start), _date.fromisoformat(end)
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

        sales_hdr = (
            Merchandising.objects
            .select_related("warehouse", "route")
            .filter(hdr_q)
        )

        # ------------------------------------
        # Product breakdown (via line items)
        # ------------------------------------
        items = (
            MerchandisingItem.objects
            .select_related("merchandising__warehouse", "merchandising__route", "product")
            .filter(merchandising__in=sales_hdr)
        )

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
        # Sales by Warehouse (use warehouse name)
        # ------------------------------------
        by_wh_qs = (
            items.values("merchandising__warehouse__name")  # <-- fixed here
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_warehouse = [
            {"name": r["merchandising__warehouse__name"] or "—", "revenue": float(r["revenue"])}
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


# Kath
# ---- Decimal types / constants ----
DEC_AMOUNT = DecimalField(max_digits=14, decimal_places=2)      # money
DEC_RATE   = DecimalField(max_digits=12, decimal_places=6)      # percentages
ZAMT       = Value(Decimal("0.00"),       output_field=DEC_AMOUNT)
ZRATE      = Value(Decimal("0.000000"),   output_field=DEC_RATE)
ONE_RATE   = Value(Decimal("1.000000"),   output_field=DEC_RATE)
HUNDRED    = Value(Decimal("100.000000"), output_field=DEC_RATE)


class RevenueSummaryView(APIView):
    def get(self, request):
        # ---------- query params ----------
        start_str = request.GET.get("start")
        end_str   = request.GET.get("end")
        debug     = (request.GET.get("debug") or "").lower() in {"1", "true", "yes"}

        def p(*args):
            # avoid duplicate prints from Django autoreload
            if debug and (os.environ.get("RUN_MAIN") == "true" or not os.environ.get("RUN_MAIN")):
                print("[RevenueSummary]", *args, flush=True)

        # ---------- resolve Manila local window [start, end) ----------
        if not start_str or not end_str:
            today   = timezone.localdate()
            start_d = today
            end_d   = today
        else:
            start_d = _date.fromisoformat(start_str)
            end_d   = _date.fromisoformat(end_str)

        tz = timezone.get_default_timezone()  # Asia/Manila (project setting)
        start_dt = timezone.make_aware(datetime.combine(start_d, _time.min), tz)
        end_dt   = timezone.make_aware(datetime.combine(end_d + timedelta(days=1), _time.min), tz)
        p(f"window_local: {start_dt} → {end_dt} (exclusive)")

        # ---------- status handling ----------
        # your DB uses 'Complete' (not 'Completed'); override via ?status=any or multiple &status=
        statuses = [s.strip() for s in request.GET.getlist("status") if s.strip()]
        use_status_filter = True
        if statuses:
            if statuses[0].lower() in {"any", "all"}:
                use_status_filter = False
        else:
            statuses = ["Complete"]
        p("statuses:", statuses, "use_status_filter:", use_status_filter)

        # ---------- extra filters ----------
        wid = (request.GET.get("warehouse_id") or "").strip()
        rid = (request.GET.get("route_id") or "").strip()
        p("extra filters:", {"warehouse_id": wid or None, "route_id": rid or None})

        # read available header fields once
        m_fields = {f.name for f in Merchandising._meta.get_fields()}

        # ---------- base queryset (items) ----------
        base_qs = MerchandisingItem.objects.filter(
            merchandising__date_time__gte=start_dt,
            merchandising__date_time__lt=end_dt,
        )
        if use_status_filter:
            base_qs = base_qs.filter(merchandising__status__in=statuses)

        # warehouse filter (items): header → van → product fallback
        if wid:
            if "warehouse" in m_fields:
                base_qs = base_qs.filter(merchandising__warehouse_id=wid)
                p("warehouse filter (items): merchandising__warehouse_id")
            elif "van" in m_fields:
                base_qs = base_qs.filter(merchandising__van__warehouse_id=wid)
                p("warehouse filter (items): merchandising__van__warehouse_id")
            else:
                base_qs = base_qs.filter(product__warehouse_id=wid)  # Product has warehouse FK
                p("warehouse filter (items): product__warehouse_id (fallback)")

        # route filter (items) if route exists on header
        if rid:
            if "route" in m_fields:
                base_qs = base_qs.filter(merchandising__route_id=rid)
                p("route filter (items): merchandising__route_id")
            else:
                p("route filter (items): skipped (no route field on Merchandising)")

        base_count = base_qs.count()
        p("matched_items:", base_count)

        if debug and base_count == 0:
            mm = Merchandising.objects.aggregate(min_dt=Min("date_time"), max_dt=Max("date_time"))
            p("merchandising date_time range:", mm)
            overall_statuses = list(Merchandising.objects.values("status").annotate(c=Count("id")).order_by("status"))
            p("overall status counts:", overall_statuses)
            inrange_statuses = list(
                Merchandising.objects.filter(date_time__gte=start_dt, date_time__lt=end_dt)
                .values("status").annotate(c=Count("id")).order_by("status")
            )
            p("in-range status counts:", inrange_statuses)

        # ---------- annotate math (Decimal-safe) ----------
        # Revenue pieces
        qs = base_qs.annotate(
            # selling price snapshot on line (FloatField) → cast to Decimal
            price=Cast(Coalesce(F("selling_price"), Value(0.0)), DEC_AMOUNT),

            sold=Cast(Coalesce(F("sold_pcs"), Value(0)), DEC_AMOUNT),

            line_gross=ExpressionWrapper(F("sold") * F("price"), output_field=DEC_AMOUNT),

            # normalize discount_percent to 0..1 (supports 10 or 0.10 storage)
            pct_raw=Coalesce(Cast(F("discount_percent"), DEC_RATE), ZRATE),
            pct_norm=Case(
                When(pct_raw__gt=ONE_RATE, then=ExpressionWrapper(F("pct_raw") / HUNDRED, output_field=DEC_RATE)),
                default=F("pct_raw"),
                output_field=DEC_RATE,
            ),

            # prefer stored actual_sale; else compute from percent
            line_net_calc=ExpressionWrapper(F("line_gross") * (ONE_RATE - F("pct_norm")), output_field=DEC_AMOUNT),
            line_net_safe=Coalesce(F("actual_sale"), F("line_net_calc")),

            # ---------- COGS: lock to Product.price.purchase_price ----------
            # Pricing.purchase_price is FloatField → cast to Decimal
            unit_cost=Cast(Coalesce(F("product__price__purchase_price"), Value(0.0)), DEC_AMOUNT),
            line_cogs=ExpressionWrapper(F("sold") * F("unit_cost"), output_field=DEC_AMOUNT),
        )

        sums = qs.aggregate(
            gross=Coalesce(Sum("line_gross"), ZAMT),
            net_from_lines=Coalesce(Sum("line_net_safe"), ZAMT),
            cogs=Coalesce(Sum("line_cogs"), ZAMT),
        )
        gross = sums["gross"]
        net_from_lines = sums["net_from_lines"]
        cogs = sums["cogs"]
        p("aggregates: gross=", gross, "net_from_lines=", net_from_lines, "cogs=", cogs)

        # ---------- header-level (transaction) discounts ----------
        hdr_qs = Merchandising.objects.filter(
            date_time__gte=start_dt,
            date_time__lt=end_dt,
        )
        if use_status_filter:
            hdr_qs = hdr_qs.filter(status__in=statuses)

        if wid:
            if "warehouse" in m_fields:
                hdr_qs = hdr_qs.filter(warehouse_id=wid)
                p("warehouse filter (header): warehouse_id")
            elif "van" in m_fields:
                hdr_qs = hdr_qs.filter(van__warehouse_id=wid)
                p("warehouse filter (header): van__warehouse_id")
            else:
                p("warehouse filter (header): skipped (no warehouse on header)")

        if rid:
            if "route" in m_fields:
                hdr_qs = hdr_qs.filter(route_id=rid)
                p("route filter (header): route_id")
            else:
                p("route filter (header): skipped (no route on header)")

        used_header_field = None
        txn_discount_total = Decimal("0.00")
        for field in ("discount_amount", "discount"):
            try:
                val = hdr_qs.aggregate(total=Coalesce(Sum(field), ZAMT))["total"]
                txn_discount_total = val or Decimal("0.00")
                used_header_field = field
                break
            except FieldError:
                continue
        p("header_discount:", used_header_field or "None", "=", txn_discount_total)

        # ---------- totals ----------
        line_discounts = gross - net_from_lines
        if line_discounts < Decimal("0.00"):
            p("line_discounts negative -> clamped:", line_discounts)
            line_discounts = Decimal("0.00")

        total_discounts = line_discounts + txn_discount_total
        net_revenue = gross - total_discounts

        

        # ---------- Operating Expenses: sum from Miscellaneous (or MiscExpense) ----------
        expenses = hdr_qs.aggregate(
            total=Coalesce(Sum(Cast(DJF("miscellaneous"), DEC_AMOUNT)), ZAMT)
        )["total"] or Decimal("0.00")
        p("expenses via Merchandising.miscellaneous:", expenses)

        # ---------- Return Rate (macro-average per product) ----------
        # Shell-based macro average: average of (actual_return_shell / dispatched_shell) across products (items)
        shell_qs = base_qs.filter(dispatched_shell__gt=0)
        shell_avg = shell_qs.aggregate(
            avg=Coalesce(
                Avg(
                    ExpressionWrapper(
                        Cast(DJF("empty_return_shell"), DEC_RATE) / Cast(DJF("dispatched_shell"), DEC_RATE),
                        output_field=DEC_RATE,
                    )
                ),
                ZRATE,
            )
        )["avg"] or Decimal("0.0")

        # Piece-based macro average (optional / diagnostic)
        pcs_qs = base_qs.filter(dispatched_pcs__gt=0)
        pcs_avg = pcs_qs.aggregate(
            avg=Coalesce(
                Avg(
                    ExpressionWrapper(
                        Cast(DJF("empty_return_pcs"), DEC_RATE) / Cast(DJF("dispatched_pcs"), DEC_RATE),
                        output_field=DEC_RATE,
                    )
                ),
                ZRATE,
            )
        )["avg"] or Decimal("0.0")

        # Simple combined average (optional): mean of the two macro-averages
        combined_avg = (shell_avg + pcs_avg) / Decimal("2") if (shell_qs.exists() and pcs_qs.exists()) else shell_avg

        # For your requirement: returned_rate = shell macro-average
        returned_rate = shell_avg

        p(
            "return-rate macro avg:",
            "shell_avg=", shell_avg, "pcs_avg=", pcs_avg, "combined_avg=", combined_avg,
            "using returned_rate=", returned_rate,
        )
        # ---------- Net Profit ----------
        net_profit = net_revenue - cogs - expenses
        p("final: net_revenue=", net_revenue, "cogs=", cogs, "expenses=", expenses, "net_profit=", net_profit)

        # ---------- payload ----------
        payload = {
            "gross_revenue": f"{gross:.2f}",
            "discounts":     f"{total_discounts:.2f}",
            "net_revenue":   f"{net_revenue:.2f}",
            "cogs":          f"{cogs:.2f}",
            "expenses":      f"{expenses:.2f}",   # <-- here
            "net_profit":    f"{net_profit:.2f}", # <-- and here
            "return_rate": f"{returned_rate:.6f}",       # 👈 this is (Σ shell ratios) / N
            "return_rate_shell_avg": f"{shell_avg:.6f}", # optional
            "return_rate_pcs_avg": f"{pcs_avg:.6f}",     # optional
            "return_rate_combined_avg": f"{combined_avg:.6f}",  # optional
        }
        if debug:
            payload["debug"] = {
                "matched_items": base_count,
                "line_discounts": f"{line_discounts:.2f}",
                "net_from_lines": f"{net_from_lines:.2f}",
                "statuses_applied": (statuses if use_status_filter else "ANY"),
                "warehouse_id": wid or None,
                "route_id": rid or None,
                "header_discount_field": used_header_field,
            }
        return Response(payload)
    
class SalesAndReturnables(APIView):
    
    def get(self, request, *args, **kwargs):
        # Optionally, filter the data based on some parameters, e.g., date, customer
        # For now, let's assume you want to fetch all Merchandising data.
        
        # Fetch the sales and return data
        merchandising_data = Merchandising.objects.all()

        # Calculate expected sale, actual sale, difference
        total_expected_sale = merchandising_data.aggregate(Sum('expected_sale'))['expected_sale__sum'] or 0
        total_actual_sale = merchandising_data.aggregate(Sum('actual_sale'))['actual_sale__sum'] or 0
        total_difference = total_actual_sale - total_expected_sale

        # Fetch the total supplier returnables
        total_supplier_returnables_bottle = ReturnableStock.objects.aggregate(Sum('empty_bottle_qty'))['empty_bottle_qty__sum'] or 0
        total_supplier_returnables_shell = ReturnableStock.objects.aggregate(Sum('empty_shell_qty'))['empty_shell_qty__sum'] or 0
        # Prepare the response data
        retanddisc = {
            "expected_sale": total_expected_sale,
            "actual_sale": total_actual_sale,
            "difference": total_difference,
            "supplier_returnables_bottle": total_supplier_returnables_bottle,
            "supplier_returnables_shell": total_supplier_returnables_shell
        }
        
        return Response(retanddisc, status=status.HTTP_200_OK)