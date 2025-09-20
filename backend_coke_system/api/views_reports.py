# api/views_reports.py
from __future__ import annotations

from datetime import date, timedelta, datetime
from decimal import Decimal

from django.db.models import (
    Sum, F, Q, Value, ExpressionWrapper,
    DecimalField, IntegerField, OuterRef, Subquery, Case, When, Avg
)
from django.db.models.functions import Cast

from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import FieldError

from .models import (
    Merchandising,
    MerchandisingItem,
    MiscellaneousItem,
    Product,
    ReceivingItem,
    ReturnableStock,   # 👈 use latest unit_cost from receiving lines
)

# ---------- helpers ----------
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
        warehouse_id = request.query_params.get("warehouse_id")
        route_id = request.query_params.get("route_id")
        period = request.query_params.get("period", "this_week")
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        start_date, end_date = _daterange_from_period(period, start, end)
        start_dt, end_dt = _make_dt_window(start_date, end_date)

        # -----------------------
        # Base filters (headers)
        # -----------------------
        hdr_q = Q(date_time__gte=start_dt, date_time__lt=end_dt)
        if warehouse_id and warehouse_id != "all":
            hdr_q &= Q(warehouse_id=warehouse_id)
        if route_id and route_id != "all":
            hdr_q &= Q(route_id=route_id)

        sales_hdr = Merchandising.objects.filter(hdr_q)

        # ------------------------------------
        # Product breakdown (aggregated items)
        # ------------------------------------
        items_base_q = Q(
            merchandising__date_time__gte=start_dt,
            merchandising__date_time__lt=end_dt,
        )
        if warehouse_id and warehouse_id != "all":
            items_base_q &= Q(merchandising__warehouse_id=warehouse_id)
        if route_id and route_id != "all":
            items_base_q &= Q(merchandising__route_id=route_id)

        items_aggs = (
            MerchandisingItem.objects
            .filter(items_base_q)
            .values("product_id", "product__product_name")
            .annotate(
                qty_sold=Coalesce(Sum("sold_pcs"), INT0),
                gross=Coalesce(
                    Sum(ExpressionWrapper(F("sold_pcs") * F("selling_price"), output_field=DECIMAL)),
                    DEC0,
                ),
                discount=Coalesce(
                    Sum(ExpressionWrapper(
                        F("sold_pcs") * F("selling_price") * (F("discount_percent") / Value(100, output_field=DECIMAL)),
                        output_field=DECIMAL
                    )),
                    DEC0,
                ),
                returns_qty=Coalesce(Sum("actual_return_pcs"), INT0),
                returns_value=Coalesce(
                    Sum(ExpressionWrapper(F("actual_return_pcs") * F("selling_price"), output_field=DECIMAL)),
                    DEC0,
                ),
            )
        )
        by_product_id = {r["product_id"]: r for r in items_aggs}

        # ---- latest unit cost per product from ReceivingItem.unit_cost ----
        last_cost_sq = Subquery(
            ReceivingItem.objects
            .filter(product=OuterRef("pk"))
            .order_by("-id")
            .values("unit_cost")[:1]
        )

        # ✅ FIX: restrict products list based on warehouse filter
        if warehouse_id and warehouse_id != "all":
            products_with_cost = (
                Product.objects
                .filter(id__in=by_product_id.keys())
                .annotate(unit_cost=Coalesce(last_cost_sq, DEC0))
                .only("id", "product_name")
            )
        else:
            products_with_cost = (
                Product.objects
                .annotate(unit_cost=Coalesce(last_cost_sq, DEC0))
                .only("id", "product_name")
            )

        # -------------- build product rows --------------
        products = []
        total_gross = total_discount = total_returns_value = total_revenue = Decimal("0")
        total_qty = total_return_qty = 0

        for p in products_with_cost:
            a = by_product_id.get(p.id) or {}
            qty_sold = int(a.get("qty_sold", 0) or 0)
            gross = Decimal(a.get("gross", 0) or 0)
            discount = Decimal(a.get("discount", 0) or 0)
            returned_qty = int(a.get("returns_qty", 0) or 0)
            returns_value = Decimal(a.get("returns_value", 0) or 0)

            net_revenue = gross - discount - returns_value
            unit_cost = Decimal(getattr(p, "unit_cost", 0) or 0)
            net_units = max(qty_sold - returned_qty, 0)
            cogs = unit_cost * Decimal(net_units)
            profit = net_revenue - cogs

            discount_rate = float((discount / gross) if gross else Decimal("0"))
            denom = qty_sold + returned_qty
            return_rate = float((Decimal(returned_qty) / Decimal(denom)) if denom else Decimal("0"))

            products.append({
                "product": p.product_name or "—",
                "qty_sold": qty_sold,
                "revenue": float(net_revenue),
                "profit": float(profit),
                "discount_rate": discount_rate,
                "return_rate": return_rate,
            })

            total_gross += gross
            total_discount += discount
            total_returns_value += returns_value
            total_revenue += net_revenue
            total_qty += qty_sold
            total_return_qty += returned_qty

        # ---------- Return Rate (macro-average per product) ----------
        items_base_q = Q(
            merchandising__date_time__gte=start_dt,
            merchandising__date_time__lt=end_dt,
        )

        base_qs = MerchandisingItem.objects.filter(items_base_q)

        if warehouse_id and warehouse_id != "all":
            items_base_q &= Q(merchandising__warehouse_id=warehouse_id)
        if route_id and route_id != "all":
            items_base_q &= Q(merchandising__route_id=route_id)
        
        DEC_RATE = DecimalField(max_digits=10, decimal_places=4)
        ZRATE = Decimal("0.0")

        shell_qs = base_qs.filter(dispatched_shell__gt=0)
        shell_avg = shell_qs.aggregate(
            avg=Coalesce(
                Avg(
                    ExpressionWrapper(
                        Cast(F("empty_return_shell"), DEC_RATE) / Cast(F("dispatched_shell"), DEC_RATE),
                        output_field=DEC_RATE,
                    )
                ),
                ZRATE,
            )
        )["avg"] or Decimal("0.0")

        pcs_qs = base_qs.filter(dispatched_pcs__gt=0)
        pcs_avg = pcs_qs.aggregate(
            avg=Coalesce(
                Avg(
                    ExpressionWrapper(
                        Cast(F("empty_return_pcs"), DEC_RATE) / Cast(F("dispatched_pcs"), DEC_RATE),
                        output_field=DEC_RATE,
                    )
                ),
                ZRATE,
            )
        )["avg"] or Decimal("0.0")

        # Optional combined average
        combined_avg = (shell_avg + pcs_avg) / Decimal("2") if (shell_qs.exists() and pcs_qs.exists()) else shell_avg

        # Use shell macro-average as returned_rate
        returned_rate = float(shell_avg)

        # -------------------------------
        # Header-level discounts (transaction)
        # -------------------------------
        statuses = [s.strip() for s in request.GET.getlist("status") if s.strip()]
        use_status_filter = True
        if statuses:
            if statuses[0].lower() in {"any", "all"}:
                use_status_filter = False
        else:
            statuses = ["Complete"]

        # ---------- extra filters ----------
        wid = (request.GET.get("warehouse_id") or "").strip()
        rid = (request.GET.get("route_id") or "").strip()

        m_fields = {f.name for f in Merchandising._meta.get_fields()}

        hdr_qs = Merchandising.objects.filter(
            date_time__gte=start_dt,
            date_time__lt=end_dt,
        )

        if wid and wid.lower() != "all":
            if "warehouse" in m_fields:
                hdr_qs = hdr_qs.filter(warehouse_id=wid)
            elif "van" in m_fields:
                hdr_qs = hdr_qs.filter(van__warehouse_id=wid)

        if rid and rid.lower() != "all":
            if "route" in m_fields:
                hdr_qs = hdr_qs.filter(route_id=rid)

        discount_data = MerchandisingItem.objects.filter(
            merchandising__in=hdr_qs
        ).annotate(
            line_gross=F("sold_pcs") * Coalesce(F("selling_price"), Value(0, output_field=DecimalField())),
            pct_discount=Coalesce(F("discount_percent"), Value(0, output_field=DecimalField()))
        ).aggregate(
            total_gross=Coalesce(Sum("line_gross"), Value(0, output_field=DecimalField())),
            weighted_discount=Coalesce(
                Sum(F("line_gross") * F("pct_discount"), output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            ),
        )

        if discount_data["total_gross"] > 0:
            avg_discount_percent = discount_data["weighted_discount"] / discount_data["total_gross"]
        else:
            avg_discount_percent = 0

        discount_summary = {
            "total": float(avg_discount_percent / 100),  # as fraction, e.g., 0.10 for 10%
            "field": "discount_percent",
        }

        # ------------------------------------
        # Revenue summary (from RevenueSummaryView logic)
        # ------------------------------------
        qs = (
            MerchandisingItem.objects
            .filter(items_base_q)
            .annotate(
                price=Cast(Coalesce(F("selling_price"), Value(0.0)), DECIMAL),
                sold=Cast(Coalesce(F("sold_pcs"), Value(0)), DECIMAL),
                line_gross=ExpressionWrapper(F("sold") * F("price"), output_field=DECIMAL),

                pct_raw=Coalesce(Cast(F("discount_percent"), DECIMAL), DEC0),
                pct_norm=Case(
                    When(pct_raw__gt=Value(1, output_field=DECIMAL),
                        then=ExpressionWrapper(F("pct_raw") / Value(100, output_field=DECIMAL),
                                                output_field=DECIMAL)),
                    default=F("pct_raw"),
                    output_field=DECIMAL,
                ),

                line_net_calc=ExpressionWrapper(F("line_gross") * (Value(1, output_field=DECIMAL) - F("pct_norm")),
                                                output_field=DECIMAL),
                line_net_safe=Coalesce(F("actual_sale"), F("line_net_calc")),

                unit_cost=Cast(Coalesce(F("product__price__purchase_price"), Value(0.0)), DECIMAL),
                line_cogs=ExpressionWrapper(F("sold") * F("unit_cost"), output_field=DECIMAL),
            )
        )

        sums = qs.aggregate(
            gross=Coalesce(Sum("line_gross"), DEC0),
            net_from_lines=Coalesce(Sum("line_net_safe"), DEC0),
            cogs=Coalesce(Sum("line_cogs"), DEC0),
        )

        

        revenue_summary = {
            "gross_revenue": float(sums["gross"]),
            "net_revenue": float(sums["net_from_lines"]),
            "cogs": float(sums["cogs"]),
            "net_profit": float(sums["net_from_lines"] - sums["cogs"]),
        }


        # ------------------------------------
        # Sales by Route / Warehouse (from items filtered by headers)
        # ------------------------------------
        revenue_line_expr = ExpressionWrapper(
            (F("sold_pcs") * F("selling_price"))
            - Coalesce((F("sold_pcs") * F("selling_price")) * (F("discount_percent") / Value(100, output_field=DECIMAL)), DEC0)
            - Coalesce(F("actual_return_pcs") * F("selling_price"), DEC0),
            output_field=DECIMAL,
        )

        items_for_charts = MerchandisingItem.objects.filter(
            merchandising__in=sales_hdr
        )

        by_route_qs = (
            items_for_charts.values("merchandising__route__route_name")
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_route = [
            {"name": r["merchandising__route__route_name"], "revenue": float(r["revenue"])}
            for r in by_route_qs
            if r["merchandising__route__route_name"] and r["revenue"] > 0
        ]

        by_wh_qs = (
            items_for_charts.values("merchandising__warehouse__name")
            .annotate(revenue=Coalesce(Sum(revenue_line_expr), DEC0))
            .order_by("-revenue")
        )
        by_warehouse = [
            {"name": r["merchandising__warehouse__name"], "revenue": float(r["revenue"])}
            for r in by_wh_qs
            if r["merchandising__warehouse__name"] and r["revenue"] > 0
        ]


        # # ------------------------------------
        # # Header-level expected vs actual
        # # ------------------------------------
        # hdr_aggs = sales_hdr.aggregate(
        #     expected=Coalesce(Sum("expected_sale"), DEC0),
        #     actual=Coalesce(Sum("actual_sale"), DEC0),
        #     misc_sum=Coalesce(Sum("miscellaneous"), DEC0),
        # )
        # expected_sale = Decimal(hdr_aggs["expected"] or 0)
        # actual_sale = Decimal(hdr_aggs["actual"] or 0)
        # difference = actual_sale - expected_sale
        # --- Sales (Merchandising) ---
        
        # Turn "all" into None so we can ignore it later
        # --- Normalize params ---
        warehouse_id = (request.query_params.get("warehouse_id") or "").strip()
        route_id = (request.query_params.get("route_id") or "").strip()

        if warehouse_id.lower() == "all":
            warehouse_id = None
        if route_id.lower() == "all":
            route_id = None

        # --- Date range (use helpers you already have) ---
        period = request.query_params.get("period", "this_week")
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        start_date, end_date = _daterange_from_period(period, start, end)
        start_dt, end_dt = _make_dt_window(start_date, end_date)

        # --- Header Merchandising queryset ---
        m_fields = {f.name for f in Merchandising._meta.get_fields()}

        hdr_qs = Merchandising.objects.filter(
            date_time__gte=start_dt,
            date_time__lt=end_dt,
        )

        if warehouse_id:
            if "warehouse" in m_fields:
                hdr_qs = hdr_qs.filter(warehouse_id=warehouse_id)
            elif "van" in m_fields:
                hdr_qs = hdr_qs.filter(van__warehouse_id=warehouse_id)

        if route_id and "route" in m_fields:
            hdr_qs = hdr_qs.filter(route_id=route_id)

        # --- Sales (Merchandising) ---
        merch_qs = Merchandising.objects.filter(
            date_time__gte=start_dt,
            date_time__lt=end_dt,
        )
        if warehouse_id:
            merch_qs = merch_qs.filter(warehouse_id=warehouse_id)
        if route_id:
            merch_qs = merch_qs.filter(route_id=route_id)

        sums = merch_qs.aggregate(
            expected_sale_sum=Sum("expected_sale"),
            actual_sale_sum=Sum("actual_sale"),
        )

        # --- Supplier returnables ---
        ret_qs = ReturnableStock.objects.filter(
            last_updated__gte=start_dt,
            last_updated__lte=end_dt,
        )
        if warehouse_id:
            ret_qs = ret_qs.filter(warehouse_id=warehouse_id)

        ret_sums = ret_qs.aggregate(
            bottle_sum=Sum("empty_bottle_qty"),
            shell_sum=Sum("empty_shell_qty"),
        )

        data = {
            "expected_sale": sums["expected_sale_sum"] or 0,
            "actual_sale": sums["actual_sale_sum"] or 0,
            "difference": (sums["actual_sale_sum"] or 0) - (sums["expected_sale_sum"] or 0),
            "supplier_returnables_bottle": ret_sums["bottle_sum"] or 0,
            "supplier_returnables_shell": ret_sums["shell_sum"] or 0,
        }

       # ------------------------------------
        # Misc Expenses (MSP only in notes)
        # ------------------------------------
        misc_items_qs = (
            MiscellaneousItem.objects
            .filter(merchandising__in=sales_hdr)
            .select_related("merchandising")
            .order_by("-id")
        )

        misc_expenses_list = []
        misc_total = Decimal("0")
        tz = timezone.get_current_timezone()

        for m in misc_items_qs:
            amt = Decimal(m.amount or 0)
            misc_total += amt
            merch = m.merchandising

            # ✅ MSP only
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
        header_misc_total = (sales_hdr.aggregate(msum=Coalesce(Sum("miscellaneous"), DEC0))["msum"] or Decimal("0"))
        if not misc_expenses_list and header_misc_total:
            misc_total += Decimal(header_misc_total)
            misc_expenses_list.append({
                "description": "Miscellaneous (header total)",
                "notes": None,   # ✅ no MSP in header fallback
                "amount": float(header_misc_total),
                "date": start_date.isoformat(),
            })



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

        summary = {
            "revenue": revenue_summary,
            "discount": discount_summary,
            "returned_rate": returned_rate,
        }




        payload = {
            "summary": summary,
            "products": products,
            "by_route": by_route,
            "by_warehouse": by_warehouse,
            "returns": {
                "expected_sale": float(data["expected_sale"]),
                "actual_sale": float(data["actual_sale"]),
                "difference": float(data["difference"]),
                "supplier_returnables": {
                    "bottle": float(data["supplier_returnables_bottle"]),
                    "shell": float(data["supplier_returnables_shell"]),
                },
            },
            "misc_expenses": misc_expenses_list,
        }


        # -----------------------------
        # Debug output if ?debug=1
        # -----------------------------
        if request.query_params.get("debug") in ("1", "true", "yes"):
            dbg_items_qs = (
                MerchandisingItem.objects
                .filter(items_base_q)
                .select_related("product", "merchandising")
                .order_by("-id")[:10]
            )

            def _safe_iso(dt):
                try:
                    return dt.astimezone(timezone.get_current_timezone()).isoformat()
                except Exception:
                    return None

            debug_items = [
                {
                    "product": mi.product.product_name if mi.product else None,
                    "sold_pcs": mi.sold_pcs,
                    "selling_price": float(mi.selling_price or 0),
                    "discount_percent": float(mi.discount_percent or 0),
                    "actual_return_pcs": mi.actual_return_pcs,
                    "merch_date_time": _safe_iso(mi.merchandising.date_time) if getattr(mi.merchandising, "date_time", None) else None,
                    "msp_no": getattr(mi.merchandising, "msp_no", None),
                    "warehouse_id": getattr(mi.merchandising, "warehouse_id", None),
                    "route_id": getattr(mi.merchandising, "route_id", None),
                }
                for mi in dbg_items_qs
            ]

            payload["debug"] = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "start_dt": start_dt.isoformat(),
                "end_dt": end_dt.isoformat(),
                "headers_matched": sales_hdr.count(),
                "items_matched": MerchandisingItem.objects.filter(items_base_q).count(),
                "received_filters": {
                    "warehouse_id": warehouse_id,
                    "route_id": route_id,
                    "period": period,
                },
                "sample_items": debug_items,
            }

        return Response(payload)



from .models import MerchandisingItem

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

        qs = (MerchandisingItem.objects
              .select_related("merchandising", "product")
              .filter(merchandising__date_time__gte=start_dt,
                      merchandising__date_time__lte=end_dt))

        if warehouse_id and warehouse_id != "all":
            qs = qs.filter(merchandising__warehouse_id=warehouse_id)

        if route_id and route_id != "all":
            qs = qs.filter(merchandising__route_id=route_id)

        # Simple safe aggregations (adjust fields to your schema)
        qty = Coalesce(Sum("sold_pcs"), 0)

        revenue_expr = ExpressionWrapper(
            F("sold_pcs") * F("selling_price"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
        revenue = Coalesce(Sum(revenue_expr), 0)

        # If you have unit_cost on item, prefer F("unit_cost")
        cogs_expr = ExpressionWrapper(
            F("sold_pcs") * F("product__price__purchase_price"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
        profit = Coalesce(Sum(revenue_expr - cogs_expr), 0)

        grouped = (qs.values("product_id", "product__product_name", "merchandising__warehouse_id")
                     .annotate(qty=qty, revenue=revenue, profit=profit)
                     .order_by("-revenue"))

        rows = [{
            "product": g["product__product_name"],
            "product_id": g["product_id"],
            "warehouse_id": g["merchandising__warehouse_id"],
            "qty": g["qty"],
            "revenue": g["revenue"],
            "profit": g["profit"],
        } for g in grouped]

        return Response({"rows": rows})