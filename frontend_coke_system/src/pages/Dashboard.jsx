// src/pages/Dashboard.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useTransition,
  memo,
} from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/dashboard.scss";
import Statistics from "../components/Statistics";
import WidgetPickerModal, { SECTIONS, CATALOG_MAP } from "../components/WidgetPickerModal";
import MetricsCards from "../components/MetricsCards";
import ProductPerformance from "../components/ProductPerformance";
import TopSellingProductsWidget from "../components/TopSellingProductsWidget";

/* -------------------- helpers -------------------- */
const n = (v, d = 0) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const peso = (x) =>
  `₱${n(x).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

const isSameDayManila = (isoString) => {
  if (!isoString) return false;
  const manila = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = manila.format(new Date());
  const dateStr = manila.format(new Date(isoString));
  return todayStr === dateStr;
};

/* -------------------- inline icons (only those used here) -------------------- */
const IconWarehouse = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M3 9l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M7 20v-8h10v8" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const IconSales = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M4 20V8m6 12V4m6 16v-8" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/* -------------------- skeleton -------------------- */
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/60 ${className}`} />
);

/* -------------------- mini cards + accents -------------------- */
const ACCENTS = {
  stocks: "ring-amber-300/70 focus-visible:ring-amber-400 border-amber-100 hover:ring-amber-300/70",
  products: "ring-indigo-300/70 focus-visible:ring-indigo-400 border-indigo-100 hover:ring-indigo-300/70",
  receiving: "ring-emerald-300/70 focus-visible:ring-emerald-400 border-emerald-100 hover:ring-emerald-300/70",
  trading: "ring-rose-300/70 focus-visible:ring-rose-400 border-rose-100 hover:ring-rose-300/70",
  credit: "ring-purple-300/70 focus-visible:ring-purple-400 border-purple-100 hover:ring-purple-300/70",
  "supplier-returns": "ring-teal-300/70 focus-visible:ring-teal-400 border-teal-100 hover:ring-teal-300/70",
  "return-empties": "ring-sky-300/70 focus-visible:ring-sky-400 border-sky-100 hover:ring-sky-300/70",
  users: "ring-fuchsia-300/70 focus-visible:ring-fuchsia-400 border-fuchsia-100 hover:ring-fuchsia-300/70",
  roles: "ring-cyan-300/70 focus-visible:ring-cyan-400 border-cyan-100 hover:ring-cyan-300/70",
  vans: "ring-lime-300/70 focus-visible:ring-lime-400 border-lime-100 hover:ring-lime-300/70",
  suppliers: "ring-lime-300/70 focus-visible:ring-lime-400 border-lime-100 hover:ring-lime-300/70",
  warehouses: "ring-orange-300/70 focus-visible:ring-orange-400 border-orange-100 hover:ring-orange-300/70",
};

const MiniCard = memo(function MiniCard({
  title,
  onClick,
  onClose,
  children,
  accentKey,
  className = "",
}) {
  const accent = ACCENTS[accentKey] || "ring-brand-300/70 focus-visible:ring-brand-400";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.(e)}
      className={[
        "group rounded-xl border bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "border-gray-200/70 shadow-sm transition-all duration-200 ease-out",
        "hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]",
        "hover:ring-2 focus:outline-none focus-visible:ring-2",
        accent,
        "p-3 cursor-pointer",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          aria-label={`Remove ${title} widget`}
          title="Remove"
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        >
          ×
        </button>
      </div>
      <div className="min-h-[92px]">
        {children || <div className="text-slate-400">{title} quick glance</div>}
      </div>
    </div>
  );
});

/* -------------------- reusable table shell -------------------- */
const TableShell = ({ headers, rows, emptyText }) => {
  if (!rows) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-[92%]" />
        <Skeleton className="h-5 w-[86%]" />
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="text-xs text-slate-500">{emptyText}</div>;
  }
  return (
    <div className="w-full">
      <table className="w-full text-[12px] text-slate-800">
        <thead>
          <tr className="text-left text-slate-500">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`py-1 ${i === headers.length - 1 ? "pr-0" : "pr-2"} ${h.right ? "text-right" : ""}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id ?? idx} className="border-t">
              {headers.map((h, i) => (
                <td
                  key={h.key}
                  className={`py-1 ${i === headers.length - 1 ? "pr-0" : "pr-2"} ${h.right ? "text-right" : ""} ${h.truncate ? "truncate" : ""}`}
                  title={h.truncate ? (h.title ? h.title(r) : r[h.key]) : undefined}
                >
                  {h.render ? h.render(r[h.key], r) : r[h.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* -------------------- widgets -------------------- */
const LowStockWidget = memo(function LowStockWidget({ items }) {
  return (
    <TableShell
      headers={[
        { key: "name", label: "Product", truncate: true },
        { key: "pcs", label: "PCS", right: true, render: (v) => n(v).toLocaleString() },
        { key: "status", label: "Status", right: true },
      ]}
      rows={items}
      emptyText="No low/out-of-stock items"
    />
  );
});
const ProductsWidget = memo(function ProductsWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "system_code", label: "System" },
        { key: "name", label: "Name", truncate: true },
        { key: "category", label: "Category" },
      ]}
      rows={rows}
      emptyText="No products found"
    />
  );
});
const ReceivingWidget = memo(function ReceivingWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "receive_no", label: "Receipt" },
        { key: "supplier", label: "Supplier", truncate: true },
        { key: "net_amount", label: "Net", right: true, render: (v) => peso(v) },
      ]}
      rows={rows}
      emptyText="No recent receivings"
    />
  );
});
const SupplierReturnsWidget = memo(function SupplierReturnsWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "sup_no", label: "Sup No." },
        { key: "supplier", label: "Supplier", truncate: true },
        { key: "total_amount", label: "Total", right: true, render: (v) => peso(v) },
        { key: "date", label: "Date", right: true, render: (v) => (v ? formatToManila(v) : "—") },
      ]}
      rows={rows}
      emptyText="No recent supplier returns"
    />
  );
});
const ReturnEmptiesWidget = memo(function ReturnEmptiesWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "product_name", label: "Product", truncate: true },
        { key: "supplier_name", label: "Supplier", truncate: true },
        { key: "empty_return_shell", label: "Shells", right: true },
        { key: "empty_return_pcs", label: "PCs", right: true },
        { key: "transaction_count", label: "Txns", right: true },
        { key: "latest_date", label: "Latest", right: true, render: (v) => (v ? formatToManila(v) : "—") },
      ]}
      rows={rows}
      emptyText="No return empties found"
    />
  );
});
const UsersWidget = memo(function UsersWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "name", label: "Name", truncate: true },
        { key: "username", label: "Username" },
        { key: "role", label: "Role", right: true },
      ]}
      rows={rows}
      emptyText="No users found"
    />
  );
});
const RolesWidget = memo(function RolesWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "name", label: "Role" },
        { key: "users_count", label: "Users", right: true },
      ]}
      rows={rows}
      emptyText="No roles found"
    />
  );
});
const VansWidget = memo(function VansWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "van_id", label: "Van ID" },
        { key: "plate_number", label: "Plate Number", truncate: true },
      ]}
      rows={rows}
      emptyText="No vans found for this warehouse"
    />
  );
});
const WarehousesWidget = memo(function WarehousesWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "name", label: "Name", truncate: true },
        { key: "city", label: "City", truncate: true },
        { key: "province", label: "Province", truncate: true },
        { key: "phone_number", label: "Phone", right: true },
      ]}
      rows={rows}
      emptyText="No warehouses found"
    />
  );
});
const SuppliersWidget = memo(function SuppliersWidget({ rows }) {
  return (
    <TableShell
      headers={[
        { key: "registration_number", label: "Reg. No." },
        { key: "company_name", label: "Company", truncate: true },
        { key: "contact_person", label: "Contact", truncate: true },
        { key: "phone_number", label: "Phone", right: true },
      ]}
      rows={rows}
      emptyText="No suppliers found"
    />
  );
});

/* -------------------- generic sidebar widget -------------------- */
const GenericSidebarWidget = memo(function GenericSidebarWidget({
  id,
  title,
  route,
  children,
  onRemove,
}) {
  const handleClose = useCallback(() => onRemove?.(id), [onRemove, id]);
  return (
    <MiniCard title={title} onClick={() => (window.location.href = route)} onClose={handleClose} accentKey={id}>
      <div className="w-full">{children}</div>
    </MiniCard>
  );
});

/* -------------------- localStorage selections + cache -------------------- */
const LS_KEY = "dashboard:selectedWidgets";
const DATA_KEY = "dashboard:data";
const DATA_TTL_MS = 5 * 60 * 1000;

const loadSelection = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveSelection = (ids) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {}
};

const readCachedData = (wid) => {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.__ts || parsed.warehouseId !== wid) return null;
    if (Date.now() - parsed.__ts > DATA_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};
const writeCachedData = (wid, payload) => {
  try {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({ __ts: Date.now(), warehouseId: wid, ...payload })
    );
  } catch {}
};

/* -------------------- API helpers -------------------- */
const getCurrentWarehouseId = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  if ((user.role || "").toLowerCase() === "admin") {
    return selectedWarehouse?.id || user.warehouse_id;
  }
  return user.warehouse_id;
};
const axiosCfgForWarehouse = (wid) => (wid ? { headers: { "X-Warehouse-ID": wid } } : {});

/** Fetch everything the dashboard needs */
async function fetchDashboard(wid) {
  const qsWid = wid ? `?warehouse=${wid}` : "";
  const qsWidId = wid ? `?warehouse_id=${wid}` : "";

  const [
    stocksRes,
    productsRes,
    receivingsRes,
    merchSetRes,
    creditsRes,
    supplierReturnsRes,
    merchRes,
    suppliersRes,
    usersRes,
    rolesRes,
    vansRes,
    warehousesRes,
  ] = await Promise.all([
    axios.get(`http://localhost:8080/api/stocks/${qsWid}`),
    axios.get(`http://localhost:8080/api/products/${qsWidId}`),
    axios.get(`http://localhost:8080/api/receiving/`, axiosCfgForWarehouse(wid)),
    axios.get(`http://localhost:8080/api/merchandising-set/`, { params: { warehouse: wid } }),
    axios.get(`http://localhost:8080/api/credits/`, axiosCfgForWarehouse(wid)),
    axios.get(`http://localhost:8080/api/supplier-return-form/${qsWidId}`),
    axios.get(`http://localhost:8080/api/merchandisings/${qsWid}`),
    axios.get(`http://localhost:8080/api/suppliers/${qsWid}`),
    axios.get(`http://localhost:8080/api/users/`, axiosCfgForWarehouse(wid)),
    axios.get(`http://localhost:8080/api/roles/`),
    axios.get(`http://localhost:8080/api/vans/${qsWid}`),
    axios.get(`http://127.0.0.1:8080/api/warehouses/${qsWid}`),
  ]);

  const parseList = (res) =>
    Array.isArray(res.data) ? res.data : res.data?.results || res.data?.data || [];

  const stocks = parseList(stocksRes);
  const products = parseList(productsRes);
  const receivings = parseList(receivingsRes);
  const transactions = parseList(merchSetRes);
  const credits = parseList(creditsRes);
  const supplierReturns = parseList(supplierReturnsRes);
  const merch = parseList(merchRes);
  const warehouses = parseList(warehousesRes);

  const warehousesList = [...warehouses]
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .slice(0, 5)
    .map((w) => ({
      id: w.id,
      name: w.name || "—",
      city: w.city || "—",
      province: w.province || "—",
      phone_number: w.phone_number || "—",
    }));

  const suppliers = parseList(suppliersRes);
  const suppliersList = [...suppliers]
    .sort((a, b) => String(a.company_name || "").localeCompare(String(b.company_name || "")))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      registration_number: s.registration_number || "—",
      company_name: s.company_name || "—",
      contact_person: s.contact_person || "—",
      phone_number: s.phone_number || "—",
    }));
  const users = parseList(usersRes);
  const roles = parseList(rolesRes);
  const vans = parseList(vansRes);

  const supplierNameById = new Map(
    suppliers.map((s) => [s.id, s.company_name || s.name || `Supplier #${s.id}`])
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  /* -------- metrics -------- */
  const totalProducts = products.length;
  const totalStockPcs = stocks.reduce((sum, s) => sum + n(s.quantity_available), 0);
  const lowOrOutCount = stocks.reduce((sum, s) => {
    const status = (s.stock_status || "").toLowerCase();
    return sum + (status.includes("low") || status.includes("out") ? 1 : 0);
  }, 0);

  /* -------- lists -------- */
  const lowStockList = stocks
    .filter((s) => {
      const st = (s.stock_status || "").toLowerCase();
      return st.includes("low") || st.includes("out");
    })
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      name: s.product_name || "Unknown Product",
      pcs: n(s.quantity_available),
      status: s.stock_status || "",
    }));

  const productsList = products.slice(0, 5).map((p) => ({
    id: p.id,
    system_code: p.system_code || "—",
    name: p.product_name || p.name || "Untitled",
    category: p.product_category?.name || "N/A",
  }));

  const receivingsList = [...receivings]
    .sort((a, b) => new Date(b.date_time || 0) - new Date(a.date_time || 0))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      receive_no: r.receive_no || r.receiveNo || `#${r.id}`,
      supplier: r.supplier_name || r.supplier?.name || "—",
      date: r.date_time ? new Date(r.date_time) : null,
      net_amount: n(r.net_amount),
    }));

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date_time || 0) - new Date(a.date_time || 0))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      msp_no: t.msp_no || `#${t.id}`,
      date_time: t.date_time || null,
      transaction_type_name: t.transaction_type_name || t.transaction_type || "—",
      handled_by: t.handled_by_name || t.handled_by_username || t.handled_by || "—",
      status: t.status || "—",
    }));

  const supplierReturnsList = [...supplierReturns]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5)
    .map((sr) => ({
      id: sr.id,
      sup_no: sr.sup_no || `#${sr.id}`,
      supplier: sr.supplier_name || sr.supplier || "—",
      total_amount: n(sr.total_amount),
      date: sr.date || null,
    }));

  const todaysReturnsArray = supplierReturns.filter((sr) => isSameDayManila(sr.date));
  const todaysReturns = todaysReturnsArray.reduce((sum, sr) => sum + n(sr.total_amount), 0);
  const todaysReturnsCount = todaysReturnsArray.length;

  /* -------- Return Empties aggregation -------- */
  const emptiesRaw = [];
  for (const m of merch) {
    const type = m.transaction_type_name;
    if (!m.items || !["Warehouse", "Van Load"].includes(type)) continue;

    for (const it of m.items) {
      const emptyShell =
        (type === "Warehouse"
          ? n(it.empty_return_shell) || n(it.actual_return_shell) || n(it.returned_shell)
          : n(it.actual_return_shell) || n(it.empty_return_shell)) || 0;

      const emptyPcs =
        (type === "Warehouse"
          ? n(it.empty_return_pcs) || n(it.actual_return_pcs) || n(it.returned_pcs)
          : n(it.actual_return_pcs) || n(it.empty_return_pcs)) || 0;

      if (emptyShell > 0 || emptyPcs > 0) {
        const prod = productById.get(it.product);
        const supplierName = prod
          ? supplierNameById.get(prod.supplier) || "Unknown Supplier"
          : "Unknown Supplier";
        emptiesRaw.push({
          key: `${m.id}-${it.id}`,
          msp_no: m.msp_no,
          product_id: it.product,
          product_name: prod?.product_name || `Product #${it.product}`,
          supplier_name: supplierName,
          empty_return_shell: emptyShell,
          empty_return_pcs: emptyPcs,
          date: m.date_time || null,
          transaction_type: type,
        });
      }
    }
  }
  const grouped = new Map();
  for (const row of emptiesRaw) {
    const g = grouped.get(row.product_id);
    if (!g) {
      grouped.set(row.product_id, {
        id: `empties-${row.product_id}`,
        product_id: row.product_id,
        product_name: row.product_name,
        supplier_name: row.supplier_name,
        empty_return_shell: row.empty_return_shell,
        empty_return_pcs: row.empty_return_pcs,
        transaction_count: 1,
        transaction_types: [row.transaction_type],
        msp_numbers: [row.msp_no].filter(Boolean),
        latest_date: row.date,
      });
    } else {
      g.empty_return_shell += row.empty_return_shell;
      g.empty_return_pcs += row.empty_return_pcs;
      g.transaction_count += 1;
      if (!g.transaction_types.includes(row.transaction_type)) g.transaction_types.push(row.transaction_type);
      if (row.msp_no) g.msp_numbers.push(row.msp_no);
      if (row.date && (!g.latest_date || new Date(row.date) > new Date(g.latest_date))) {
        g.latest_date = row.date;
      }
    }
  }
  const returnEmptiesList = Array.from(grouped.values())
    .sort((a, b) => b.empty_return_shell + b.empty_return_pcs - (a.empty_return_shell + a.empty_return_pcs))
    .slice(0, 5);

  /* -------- Users / Roles / Credit -------- */
  const usersList = users.slice(0, 5).map((u) => ({
    id: u.id,
    name:
      u.full_name ||
      u.name ||
      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
      u.username ||
      "—",
    username: u.username || "—",
    role: u.role?.name || u.role || u.role_name || "—",
  }));

  const rolesList = roles.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name || r.role || "—",
    users_count: Number(r.users_count ?? r.user_count ?? 0),
  }));

  const creditSummary = (() => {
    const outstanding = credits.filter(
      (c) => String(c.status || "").toUpperCase() !== "PAID" && Number(c.balance || 0) > 0
    );
    const totalOutstandingBalance = outstanding.reduce((s, c) => s + Number(c.balance || 0), 0);
    return {
      countOutstanding: outstanding.length,
      totalOutstandingBalance,
    };
  })();

  const creditList = [...credits]
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      msp_no: c.msp_no || `#${c.id}`,
      customer: c.customer_name || "—",
      balance: Number(c.balance || 0),
      status: String(c.status || "").toUpperCase(),
      date_time: c.created_at || null,
    }));

  /* -------- Vans list -------- */
  const vansList = [...vans]
    .sort((a, b) => String(a.plate_number || "").localeCompare(String(b.plate_number || "")))
    .slice(0, 5)
    .map((v) => ({
      id: v.id,
      van_id: v.van_id || `#${v.id}`,
      plate_number: v.plate_number || "—",
    }));

  /* -------- Sales points for money chart (used by <Statistics/>) -------- */
  const salesPoints = merch
    .map((m) => ({
      date: m.date_time || m.created_at || m.updated_at,
      amount: n(m.actual_sale || m.total_amount || m.payment_amount || m.cash_received || 0),
    }))
    .filter((p) => p.date && p.amount >= 0);

  /* -------- Product Performance TIME SERIES -------- */
  const ppSeriesByDate = new Map();  // key: YYYY-MM-DD -> row object
  const categoryMapObj = {};         // product name -> category

  for (const m of merch) {
    const txDate = m?.date_time || m?.created_at || m?.updated_at;
    if (!txDate || !Array.isArray(m.items)) continue;
    const dateKey = new Date(txDate).toISOString().slice(0, 10);
    if (!ppSeriesByDate.has(dateKey)) ppSeriesByDate.set(dateKey, { date: dateKey });

    const row = ppSeriesByDate.get(dateKey);

    for (const it of m.items) {
      const prod = productById.get(it.product);
      const prodName = prod?.product_name || prod?.name || `Product #${it.product}`;
      const catName =
        prod?.product_category?.name ||
        prod?.category?.name ||
        prod?.category ||
        "Uncategorized";
      categoryMapObj[prodName] = catName;

      const qty = n(it.sold ?? it.sold_pcs ?? it.quantity ?? it.qty ?? it.actual_qty ?? 0);
      const price = n(it.price ?? it.selling_price ?? it.unit_price ?? it.actual_price ?? 0);
      const line =
        n(it.line_total ?? it.total_amount ?? it.actual_amount ?? 0) || qty * price;

      row[prodName] = n(row[prodName]) + n(line);
    }
  }

  const productPerformanceSeries = Array
    .from(ppSeriesByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  const catTotals = new Map();
  for (const row of productPerformanceSeries) {
    for (const [k, v] of Object.entries(row)) {
      if (k === "date") continue;
      const cat = categoryMapObj[k] || "Uncategorized";
      catTotals.set(cat, n(catTotals.get(cat)) + n(v));
    }
  }
  const productPerformance = Array.from(catTotals.entries())
    .map(([name, value]) => ({ name, value: n(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    metrics: {
      totalProducts,
      totalStockPcs,
      lowOrOutCount,
      stockValueEstimate: 0,
      todaysSales: 0,
      todaysReturns,
      todaysReturnsCount,
    },
    lists: {
      lowStockList,
      productsList,
      receivingsList,
      recentSales: [],
      recentTransactions,
      supplierReturnsList,
      returnEmptiesList,
      creditList,
      creditSummary,
      usersList,
      rolesList,
      vansList,
      suppliersList,
      warehousesList,
      salesPoints,
      productPerformance,        // category totals (optional)
      productPerformanceSeries,  // product daily series (for chart + widget)
      categoryMap: categoryMapObj,
    },
  };
}

/* -------------------- page -------------------- */
const Dashboard = () => {
  const location = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(loadSelection());

  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [metrics, setMetrics] = useState(null);
  const [lists, setLists] = useState({
    lowStockList: null,
    productsList: null,
    receivingsList: null,
    recentSales: [],
    recentTransactions: [],
    supplierReturnsList: null,
    returnEmptiesList: null,
    creditList: null,
    creditSummary: { countOutstanding: 0, totalOutstandingBalance: 0 },
    usersList: null,
    rolesList: null,
    vansList: null,
    suppliersList: null,
    warehousesList: null,
    salesPoints: [],
    productPerformance: [],
    productPerformanceSeries: [],
    categoryMap: {},
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  // 🔗 Shared period between Statistics, ProductPerformance, and TopSellingProductsWidget
  const [period, setPeriod] = useState("this-week");

  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  const userLS = JSON.parse(localStorage.getItem("user") || "{}");
  const warehouseMeta = selectedWarehouse || (userLS?.warehouse ? userLS.warehouse : null);

  useEffect(() => {
    if (location.state?.openWidgetsModal) {
      setPickerOpen(true);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  useEffect(() => saveSelection(selectedIds), [selectedIds]);

  const visibleSelectedItems = useMemo(
    () => selectedIds.map((id) => CATALOG_MAP.get(id)).filter(Boolean),
    [selectedIds]
  );

  const loadData = useCallback(
    async (force = false) => {
      try {
        setLoading(true);
        const wid = getCurrentWarehouseId();
        if (!wid) {
          setMetrics({
            totalProducts: 0,
            totalStockPcs: 0,
            lowOrOutCount: 0,
            stockValueEstimate: 0,
            todaysSales: 0,
            todaysReturns: 0,
            todaysReturnsCount: 0,
          });
          setLists({
            lowStockList: [],
            productsList: [],
            receivingsList: [],
            recentSales: [],
            recentTransactions: [],
            supplierReturnsList: [],
            returnEmptiesList: [],
            creditList: [],
            creditSummary: { countOutstanding: 0, totalOutstandingBalance: 0 },
            usersList: [],
            rolesList: [],
            vansList: [],
            suppliersList: [],
            warehousesList: [],
            salesPoints: [],
            productPerformance: [],
            productPerformanceSeries: [],
            categoryMap: {},
          });
          setLastUpdated(new Date());
          return;
        }

        if (!force) {
          const cached = readCachedData(wid);
          if (cached?.metrics && cached?.lists) {
            setMetrics(cached.metrics);
            setLists(cached.lists);
            setLastUpdated(new Date(cached.__ts));
            setLoading(false);
            startTransition(() => {
              fetchDashboard(wid)
                .then((fresh) => {
                  setMetrics(fresh.metrics);
                  setLists(fresh.lists);
                  writeCachedData(wid, fresh);
                  setLastUpdated(new Date());
                })
                .catch(() => {});
            });
            return;
          }
        }

        const fresh = await fetchDashboard(wid);
        setMetrics(fresh.metrics);
        setLists(fresh.lists);
        writeCachedData(wid, fresh);
        setLastUpdated(new Date());
      } catch (e) {
        console.error("Dashboard load error:", e);
        setMetrics({
          totalProducts: 0,
          totalStockPcs: 0,
          lowOrOutCount: 0,
          stockValueEstimate: 0,
          todaysSales: 0,
          todaysReturns: 0,
          todaysReturnsCount: 0,
        });
        setLists({
          lowStockList: [],
          productsList: [],
          receivingsList: [],
          recentSales: [],
          recentTransactions: [],
          supplierReturnsList: [],
          returnEmptiesList: [],
          creditList: [],
          creditSummary: { countOutstanding: 0, totalOutstandingBalance: 0 },
          usersList: [],
          rolesList: [],
          vansList: [],
          suppliersList: [],
          warehousesList: [],
          salesPoints: [],
          productPerformance: [],
          productPerformanceSeries: [],
          categoryMap: {},
        });
        setLastUpdated(new Date());
      } finally {
        setLoading(false);
      }
    },
    [startTransition]
  );

  useEffect(() => {
    loadData(false);
    const handleWarehouseChange = () => loadData(true);
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [loadData]);

  const removeWidget = useCallback((id) => setSelectedIds((prev) => prev.filter((x) => x !== id)), []);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(99,102,241,0.10),transparent)]">
      {/* Header */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm">
              <IconSales />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <IconWarehouse /> Warehouse:
                </span>
                <span className="font-medium">
                  {warehouseMeta?.warehouse || warehouseMeta?.name || "No Warehouse Assigned"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs shadow-sm hover:shadow"
            >
              ➕ Add Widgets
            </button>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* TOP METRICS ROW */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <MetricsCards
            data={{
              totalRevenue: metrics?.todaysSales ?? 0,
              productsSold: metrics?.totalProducts ?? 0,
              supplierReturnables: lists?.supplierReturnsList?.length ?? 0,
              miscCharges: 0,
              actualProfit: 0,
            }}
          />
        </div>

        {/* STATISTICS CHART */}
        <Statistics
          metrics={metrics}
          onRefresh={() => loadData(true)}
          loading={loading || isPending}
          lastUpdated={lastUpdated}
          salesPoints={lists.salesPoints}
          period={period}
          onPeriodChange={setPeriod}
        />

        {/* PRODUCT PERFORMANCE (category lines over time) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2">
          <ProductPerformance
            title="Product Performance (Zig-zag)"
            data={lists.productPerformanceSeries}
            categoryMap={lists.categoryMap}
            period={period}
            height={300}
          />
        </div>

        {/* TOP SELLING PRODUCTS (product-level, period-synced) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <TopSellingProductsWidget
            series={lists.productPerformanceSeries}
            period={period}
            topN={10}
          />
        </div>

        {/* Widgets */}
        {useMemo(() => visibleSelectedItems.map((item) => {
          const id = item.id;
          const route = item.route;

          if (id === "stocks") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <LowStockWidget items={lists.lowStockList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "products") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <ProductsWidget rows={lists.productsList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "receiving") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <ReceivingWidget rows={lists.receivingsList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "trading") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <TradingPreview rows={lists.recentTransactions} />
              </GenericSidebarWidget>
            );
          }

          if (id === "supplier-returns") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <SupplierReturnsWidget rows={lists.supplierReturnsList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "return-empties") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <ReturnEmptiesWidget rows={lists.returnEmptiesList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "credit") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <CreditWidget rows={lists.creditList} summary={lists.creditSummary} />
              </GenericSidebarWidget>
            );
          }

          if (id === "users") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <UsersWidget rows={lists.usersList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "roles") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <RolesWidget rows={lists.rolesList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "vans") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <VansWidget rows={lists.vansList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "suppliers") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <SuppliersWidget rows={lists.suppliersList} />
              </GenericSidebarWidget>
            );
          }

          if (id === "warehouses") {
            return (
              <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget}>
                <WarehousesWidget rows={lists.warehousesList} />
              </GenericSidebarWidget>
            );
          }

          return (
            <GenericSidebarWidget key={id} id={id} title={item.name} route={route} onRemove={removeWidget} />
          );
        }), [visibleSelectedItems, removeWidget, lists])}

        {/* Empty state */}
        {visibleSelectedItems.length === 0 && (
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-xl border-2 border-dashed border-slate-300/80 p-8 flex flex-col items-center justify-center text-slate-600 bg-white/50 hover:bg-white/70 transition"
          >
            <div className="text-base mb-1">➕</div>
            <div className="text-xs">No widgets selected</div>
            <div className="text-[11px] text-slate-500">Click to add widgets</div>
          </button>
        )}
      </div>

      {/* Modal */}
      <WidgetPickerModal
        open={pickerOpen}
        selectedIds={selectedIds}
        onClose={() => setPickerOpen(false)}
        onSave={(ids) => {
          setSelectedIds(ids);
          setPickerOpen(false);
        }}
      />
    </div>
  );
};

/* ---- tiny status components used above ---- */
const StatusPill = ({ status }) => {
  const st = (status || "").toLowerCase();
  const base = "px-2 py-0.5 rounded text-[11px] font-semibold inline-flex";
  if (st === "pending") return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st === "complete" || st === "completed") return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "—"}</span>;
};

const TradingPreview = memo(function TradingPreview({ rows }) {
  if (!rows) return <div className="text-xs text-slate-500">Loading…</div>;
  if (rows.length === 0) return <div className="text-xs text-slate-500">No recent transactions</div>;
  const latest = rows[0];
  return (
    <div className="text-sm text-slate-700">
      <div className="font-medium">
        Latest: {latest.msp_no} — {latest.transaction_type_name || "—"}{" "}
        <span className="ml-1 align-middle"><StatusPill status={latest.status} /></span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        {rows.length} recent {rows.length === 1 ? "transaction" : "transactions"} ·{" "}
        {latest.date_time ? formatToManila(latest.date_time) : "—"}
      </div>
    </div>
  );
});

/* ---- Credit widget (compact) ---- */
const CreditStatusPill = ({ status }) => {
  const st = String(status || "").toUpperCase();
  const base = "px-2 py-0.5 rounded text-[11px] font-semibold inline-flex";
  if (st === "PENDING") return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st === "PARTIAL") return <span className={`${base} bg-amber-100 text-amber-800`}>Partial</span>;
  if (st === "PAID") return <span className={`${base} bg-green-100 text-green-800`}>Paid</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "—"}</span>;
};
const CreditWidget = memo(function CreditWidget({ rows, summary }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <div>
          <span className="font-medium">Outstanding:</span>{" "}
          <span>{summary?.countOutstanding ?? 0}</span>
        </div>
        <div>
          <span className="font-medium">Total Balance:</span>{" "}
          <span className="font-semibold">{peso(summary?.totalOutstandingBalance ?? 0)}</span>
        </div>
      </div>

      <TableShell
        headers={[
          { key: "msp_no", label: "MSP" },
          { key: "customer", label: "Customer", truncate: true },
          { key: "balance", label: "Balance", right: true, render: (v) => peso(v) },
          { key: "status", label: "Status", right: true, render: (v) => <CreditStatusPill status={v} /> },
        ]}
        rows={rows}
        emptyText="No credit records"
      />
    </div>
  );
});

export default Dashboard;