import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import api from "../api";


/* ---------------- Helpers ---------------- */
const formatPhp = (n) =>
  Number.isFinite(Number(n))
    ? `₱${Number(n).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "₱0.00";

const safe = (v, d = 0) => (v === null || v === undefined || v === "" ? d : v);

// ---------- Numeric helpers ----------
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const firstNumber = (...vals) => {
  for (const v of vals) {
    const n = num(v);
    if (n !== undefined) return n;
  }
  return 0;
};

const formatToManila = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

const StatusPill = ({ status }) => {
  const st = (status || "").toLowerCase();
  const base =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset";
  if (st === "pending")
    return (
      <span className={`${base} bg-yellow-50 text-yellow-800 ring-yellow-200`}>
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        Pending
      </span>
    );
  if (st === "complete" || st === "completed")
    return (
      <span className={`${base} bg-green-50 text-green-800 ring-green-200`}>
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Completed
      </span>
    );
  return (
    <span className={`${base} bg-gray-50 text-gray-700 ring-gray-200`}>
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      {status || "—"}
    </span>
  );
};

const pickName = (item) => {
  const p = item.product_detail || item.product || {};
  return item.product_name || p.product_name || p.name || p.title || `#${p.id ?? item.product_id ?? "—"}`;
};

const pickContentNo = (item) => {
  const p = item.product_detail || item.product || {};
  return Number(p?.unit_type?.content_no) || Number(p?.unit_type_content_no) || Number(p?.content_no) || 1;
};

const pickSellingPrice = (item) =>
  Number(safe(item.selling_price)) || Number(safe(item.unit_price)) || Number(safe(item.price));

const pickRouteLabel = (obj) => {
  if (!obj) return "";
  const val =
    obj.route_name ?? obj.name ?? obj.title ?? obj.routeName ?? (typeof obj === "string" ? obj : "");
  return typeof val === "string" ? val.trim() : "";
};

const InfoField = ({ label, value }) => (
  <div className="space-y-1">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="w-full rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-sm text-gray-800">
      {value ?? "—"}
    </div>
  </div>
);

/* --------------- Skeletons / Empty --------------- */
const Line = ({ className = "" }) => <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;

const HeaderSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="space-y-2">
        <Line className="h-3 w-24" />
        <Line className="h-9 w-full" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ title = "Nothing to show", subtitle = "No items found for this transaction." }) => (
  <div className="rounded-xl border border-dashed border-gray-300 p-6 md:p-8 text-center">
    <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
      <span className="text-xl">🗒️</span>
    </div>
    <div className="font-semibold text-gray-800">{title}</div>
    <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
  </div>
);

/* ---------- Misc helpers (extract + total) ---------- */
const normalizeMiscItem = (x, idx) => {
  if (!x) return null;
  const amount = num(x.amount) ?? num(x.total) ?? num(x.value) ?? num(x.price) ?? 0;
  const desc =
    (x.description ??
      x.desc ??
      x.name ??
      x.title ??
      x.label ??
      x.note ??
      `Misc #${idx + 1}`) || `Misc #${idx + 1}`;
  return { desc: String(desc), amount: Number(amount) || 0 };
};

const getMiscList = (sale) => {
  const rawLists = [
    ...(Array.isArray(sale?.misc_items) ? sale.misc_items : []),
    ...(Array.isArray(sale?.expense_items) ? sale.expense_items : []),
    ...(Array.isArray(sale?.miscellaneous) ? sale.miscellaneous : []),
    ...(Array.isArray(sale?.expenses) ? sale.expenses : []),
    ...(Array.isArray(sale?.fees) ? sale.fees : []),
  ];

  const singleCandidates = [sale?.misc_item, sale?.misc, sale?.expense, sale?.fee];
  singleCandidates.forEach((c) => {
    if (c && typeof c === "object") rawLists.push(c);
  });

  const list = rawLists.map((x, i) => normalizeMiscItem(x, i)).filter(Boolean);

  const fallbackTotal =
    firstNumber(sale?.expenses_total, sale?.total_expenses, sale?.misc_amount, sale?.fees_total) || 0;
  if (list.length === 0 && fallbackTotal > 0) {
    list.push({ desc: "Miscellaneous", amount: fallbackTotal });
  }

  return list;
};

const VanLoadProductDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const passedSale = location.state?.sale;
  const [sale, setSale] = useState(passedSale || null);
  const [loading, setLoading] = useState(!passedSale);

  const [resolvedRouteName, setResolvedRouteName] = useState("");

  // Fetch sale if not passed via state
  useEffect(() => {
    if (passedSale) return;
    let alive = true;
    setLoading(true);
    api
      .get(`/merchandisings/${id}/`)
      .then((res) => alive && setSale(res.data || null))
      .catch((err) => console.error("Failed to load sale:", err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, passedSale]);

  // Resolve Route name
  useEffect(() => {
    const flat = pickRouteLabel(sale);
    if (flat) {
      setResolvedRouteName(flat);
      return;
    }
    const nested = pickRouteLabel(sale?.route);
    if (nested) {
      setResolvedRouteName(nested);
      return;
    }

    const maybeId = sale?.route && typeof sale.route === "object" ? sale.route.id : sale?.route;
    const routeId = Number.isFinite(Number(maybeId)) ? Number(maybeId) : null;

    if (!routeId) {
      setResolvedRouteName("—");
      return;
    }

    const token = localStorage.getItem("token");
    const cfg = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    let alive = true;

    const tryDetail = () =>
      api
        .get(`/routes/${routeId}/`, cfg)
        .then((res) => {
          if (!alive) return false;
          const name = pickRouteLabel(res.data);
          if (name) {
            setResolvedRouteName(name);
            return true;
          }
          return false;
        })
        .catch(() => false);

    const tryListFallback = () => {
      const wid = sale?.warehouse;
      if (!wid) return Promise.resolve(false);
      return api
        .get(`/routes/?warehouse=${wid}`, cfg)
        .then((res) => {
          if (!alive) return false;
          const found = (Array.isArray(res.data) ? res.data : []).find((r) => String(r.id) === String(routeId));
          const name = pickRouteLabel(found);
          if (name) {
            setResolvedRouteName(name);
            return true;
          }
          return false;
        })
        .catch(() => false);
    };

    (async () => {
      const okDetail = await tryDetail();
      if (okDetail) return;
      const okList = await tryListFallback();
      if (okList) return;
      setResolvedRouteName(`#${routeId}`);
    })();

    return () => {
      alive = false;
    };
  }, [sale]);

  const routeLabel = resolvedRouteName || "—";

  // Items
  const items = useMemo(() => (Array.isArray(sale?.items) ? sale.items : []), [sale]);

  // PRODUCTS SOLD (gross only)
  const soldRows = useMemo(() => {
    return items.map((it) => {
      const name = pickName(it);
      const contentNo = pickContentNo(it);
      const soldShell = Number(safe(it.sold_shell));
      const soldPcs = Number(safe(it.sold_pcs));
      const sellingPrice = pickSellingPrice(it);

      const pcsFromShell = soldShell * contentNo;
      const totalPcs = soldPcs > 0 ? soldPcs : pcsFromShell;

      const lineTotal = sellingPrice * totalPcs; // GROSS only
      return { name, contentNo, soldShell, soldPcs, totalPcs, sellingPrice, lineTotal };
    });
  }, [items]);

  const soldTotals = useMemo(
    () =>
      soldRows.reduce(
        (acc, r) => {
          acc.shell += r.soldShell;
          acc.pcs += r.soldPcs;
          acc.totalPcs += r.totalPcs;
          acc.amount += r.lineTotal; // gross
          return acc;
        },
        { shell: 0, pcs: 0, totalPcs: 0, amount: 0 }
      ),
    [soldRows]
  );

  // ---------- Miscellaneous / Expenses (details table only) ----------
  const miscList = useMemo(() => getMiscList(sale), [sale]);
  const expensesTotal = useMemo(() => miscList.reduce((s, m) => s + (m?.amount || 0), 0), [miscList]);

  // Empties
  const emptiesRows = useMemo(() => {
    return items.map((it) => {
      const name = pickName(it);
      const contentNo = pickContentNo(it);
      const emptyShell = Number(safe(it.empty_return_shell));
      const emptyPcs = Number(safe(it.empty_return_pcs));
      const withContentShell = Number(safe(it.actual_return_shell));
      const withContentPcs = Number(safe(it.actual_return_pcs));
      return { name, contentNo, emptyShell, emptyPcs, withContentShell, withContentPcs };
    });
  }, [items]);

  const emptiesTotals = useMemo(
    () =>
      emptiesRows.reduce(
        (acc, r) => {
          acc.emptyShell += r.emptyShell;
          acc.emptyPcs += r.emptyPcs;
          acc.withContentShell += r.withContentShell;
          acc.withContentPcs += r.withContentPcs;
          return acc;
        },
        { emptyShell: 0, emptyPcs: 0, withContentShell: 0, withContentPcs: 0 }
      ),
    [emptiesRows]
  );

  // Header fields
  const handledBy = sale?.handled_by_name || sale?.handled_by_username || sale?.handled_by || "—";
  const statusText = sale?.status || "";
  const vanDisplay =
    sale?.van_label ||
    (sale?.van && [sale.van.code || sale.van.plate_no || sale.van.id, sale.van.name].filter(Boolean).join(" - ")) ||
    sale?.van_name ||
    "—";

  return (
    <div className="page w-full px-3 md:px-4 lg:px-5 xl:px-6 print:p-0">
      {/* Title Row */}
      <div className="mb-3 md:mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">Van Load Details</h1>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => navigate("/trading")}
          >
            ← Back
          </button>
          <button
            className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      {/* HEADER */}
      <div className="bg-white p-4 md:p-5 rounded-lg md:rounded-xl shadow-sm ring-1 ring-gray-200 print:ring-0 print:shadow-none">
        {loading ? (
          <HeaderSkeleton />
        ) : !sale ? (
          <EmptyState title="Sale not found" subtitle="We couldn’t locate this transaction." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <InfoField label="MSP No" value={sale.msp_no} />
            <InfoField label="Date & Time" value={formatToManila(sale.date_time)} />
            <InfoField label="Transaction Type" value={sale.transaction_type_name || "Van Load"} />
            <InfoField label="Route" value={routeLabel} />
            <InfoField label="Handled By" value={handledBy} />
            <InfoField label="Status" value={<StatusPill status={statusText} />} />
          </div>
        )}
      </div>

      {/* QUICK SUMMARY (no Net Sales card) */}
      {!loading && sale && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Sold (Shell)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{soldTotals.shell}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Sold (PCS)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{soldTotals.pcs}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Total Units (PCS)</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{soldTotals.totalPcs}</div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Gross Sales</div>
            <div className="mt-0.5 text-base md:text-lg font-semibold">{formatPhp(soldTotals.amount)}</div>
          </div>
        </div>
      )}

      {/* PRODUCTS SOLD (gross only; no misc allocation, no net column) */}
      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden print:ring-0 print:shadow-none">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Products Sold</div>
          {soldRows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No sold items" subtitle="This transaction has no recorded sales." />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Product</th>
                    <th className="p-2 md:p-3 text-center font-medium">Sold (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Sold (PCS)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Unit Price</th>
                    <th className="p-2 md:p-3 text-right font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {soldRows.map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-left text-gray-900">{r.name}</td>
                      <td className="p-2 md:p-3 text-center">{r.soldShell}</td>
                      <td className="p-2 md:p-3 text-center">{r.soldPcs}</td>
                      <td className="p-2 md:p-3 text-center">{formatPhp(r.sellingPrice)}</td>
                      <td className="p-2 md:p-3 text-right font-medium">{formatPhp(r.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold">
                    <td className="p-2 md:p-3 text-left" colSpan={4}>
                      TOTAL
                    </td>
                    <td className="p-2 md:p-3 text-right">{formatPhp(soldTotals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MISCELLANEOUS / EXPENSES (details only) */}
      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Miscellaneous / Expenses</div>
          {miscList.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No miscellaneous charges recorded.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Description</th>
                    <th className="p-2 md:p-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {miscList.map((m, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-gray-900">{m.desc}</td>
                      <td className="p-2 md:p-3 text-right">{formatPhp(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold">
                    <td className="p-2 md:p-3 text-left">TOTAL</td>
                    <td className="p-2 md:p-3 text-right">{formatPhp(expensesTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EMPTIES RETURNED */}
      {!loading && sale && (
        <div className="mt-4 rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden print:break-before-page print:ring-0 print:shadow-none">
          <div className="px-3 py-2.5 border-b bg-gray-50 font-semibold text-sm">Empties Returned</div>
          {emptiesRows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No empties" subtitle="No empty or with-content returns recorded." />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-600">
                    <th className="p-2 md:p-3 text-left font-medium">Product</th>
                    <th className="p-2 md:p-3 text-center font-medium">Empty (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">Empty (PCS)</th>
                    <th className="p-2 md:p-3 text-center font-medium">With Contents (Shell)</th>
                    <th className="p-2 md:p-3 text-center font-medium">With Contents (PCS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {emptiesRows.map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2 md:p-3 text-left text-gray-900">{r.name}</td>
                      <td className="p-2 md:p-3 text-center">{r.emptyShell}</td>
                      <td className="p-2 md:p-3 text-center">{r.emptyPcs}</td>
                      <td className="p-2 md:p-3 text-center">{r.withContentShell}</td>
                      <td className="p-2 md:p-3 text-center">{r.withContentPcs}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr className="font-semibold text-gray-800">
                    <td className="p-2 md:p-3 text-left">TOTAL</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.emptyShell}</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.emptyPcs}</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.withContentShell}</td>
                    <td className="p-2 md:p-3 text-center">{emptiesTotals.withContentPcs}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bottom Actions (hidden on print) 
      {!loading && sale && (
        <div className="mt-4 flex justify-end gap-2 print:hidden">
          <button
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => navigate("/trading")}
          >
            ← Back
          </button>
          <button
            className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      )}
      */}
    </div>
  );
};

export default VanLoadProductDetails;
