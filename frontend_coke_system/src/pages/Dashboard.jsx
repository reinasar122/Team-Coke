// src/pages/Dashboard.jsx - COMPLETE FIXED VERSION WITH STRICT CREDIT FILTERING AND DEDUPLICATION
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useTransition,
  memo,
  useRef,
} from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/dashboard.scss";
import Statistics, { getPeriodRange, periodOptions } from "../components/Statistics";
import WidgetPickerModal, { SECTIONS, CATALOG_MAP } from "../components/WidgetPickerModal";
import MetricsCards from "../components/MetricsCards";
import ProductPerformance from "../components/ProductPerformance";
import TopSellingProductsWidget from "../components/TopSellingProductsWidget";
import api from "../api"; // ✅ correct

/* -------------------- Skeleton Component -------------------- */
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/60 ${className}`} />
);

/* -------------------- Icon Components -------------------- */
const IconWarehouse = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M3 9l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M7 20v-8h10v8" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconSales = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
    {...props}
  >
    {/* Left bar - Green */}
    <path d="M4 20V8" fill="none" stroke="#22c55e" strokeWidth="3" />
    {/* Middle bar - Yellow */}
    <path d="M10 20V4" fill="none" stroke="#eab308" strokeWidth="3" />
    {/* Right bar - Blue */}
    <path d="M16 20v-8" fill="none" stroke="#3b82f6" strokeWidth="3" />
  </svg>
);


const IconCalendar = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.6"/>
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.6"/>
    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);

const IconBuilding = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 12h.01M9 15h.01" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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

/* -------------------- Custom Period Options -------------------- */
const extendedPeriodOptions = [
  ...periodOptions,
  { value: "custom", label: "Custom" }
];

/* -------------------- Custom getPeriodRange function -------------------- */
const getCustomPeriodRange = (period, customStartDate, customEndDate) => {
  if (period === "custom" && customStartDate && customEndDate) {
    return {
      from: new Date(customStartDate + "T00:00:00"),
      to: new Date(customEndDate + "T23:59:59")
    };
  }
  return getPeriodRange(period);
};

/* -------------------- Warehouse Selection Dropdown -------------------- */
const WarehouseDropdown = ({ selectedWarehouseIds, onWarehouseChange, warehouses }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWarehouseSelect = (warehouseId) => {
    if (selectedWarehouseIds.includes(warehouseId)) {
      onWarehouseChange(selectedWarehouseIds.filter(id => id !== warehouseId));
    } else {
      onWarehouseChange([...selectedWarehouseIds, warehouseId]);
    }
  };

  const getDisplayText = () => {
    if (!selectedWarehouseIds.length) return "Select Warehouses";
    
    if (selectedWarehouseIds.length === warehouses.length) {
      if (warehouses.length === 2) {
        return "Both Warehouses";
      }
      return "All Warehouses Selected";
    }
    
    if (selectedWarehouseIds.length === 1) {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseIds[0]);
      return warehouse ? warehouse.name : "Unknown Warehouse";
    }
    
    if (selectedWarehouseIds.length === 2) {
      return "Both Warehouses";
    }
    
    if (selectedWarehouseIds.length >= 3) {
      return `${selectedWarehouseIds.length} or More Warehouses Selected`;
    }
    
    return `${selectedWarehouseIds.length} Warehouses Selected`;
  };

  const isSelected = (warehouseId) => selectedWarehouseIds.includes(warehouseId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 bg-white hover:bg-gray-50 transition-colors min-w-[160px]"
      >
        <IconBuilding />
        <span className="truncate">{getDisplayText()}</span>
        <svg 
          className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[240px]">
          <div className="py-2">
            {warehouses.map((warehouse, index) => (
              <label
                key={`warehouse-option-${warehouse.id}-${index}`}
                className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isSelected(warehouse.id)}
                  onChange={() => handleWarehouseSelect(warehouse.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="truncate">
                  {warehouse.name}
                  {warehouse.city && (
                    <span className="text-gray-500 ml-1">({warehouse.city})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------- Period Dropdown -------------------- */
const PeriodDropdown = ({ period, onPeriodChange, customStartDate, customEndDate, onCustomDatesChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionSelect = (value) => {
    onPeriodChange(value);
    setIsOpen(false);
  };

  const getPeriodDisplayText = () => {
    if (period === "custom" && customStartDate && customEndDate) {
      return `${customStartDate} to ${customEndDate}`;
    }
    const option = extendedPeriodOptions.find(o => o.value === period);
    return option ? option.label : 'Custom';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 bg-white hover:bg-gray-50 transition-colors min-w-[120px]"
        >
          <IconCalendar />
          <span className="truncate">{getPeriodDisplayText()}</span>
          <svg 
            className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
            <div className="py-1">
              {extendedPeriodOptions.map((option, index) => (
                <button
                  key={`period-option-${option.value}-${index}`}
                  onClick={() => handleOptionSelect(option.value)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 ${
                    period === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomDatesChange(e.target.value, customEndDate)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white"
            placeholder="Start Date"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomDatesChange(customStartDate, e.target.value)}
            min={customStartDate}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white"
            placeholder="End Date"
          />
          {customStartDate && customEndDate && (
            <button
              onClick={() => {/* Optional: Add apply action if needed */}}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
                key={`header-${h.key || h.label}-${i}`}
                className={`py-1 ${i === headers.length - 1 ? "pr-0" : "pr-2"} ${
                  h.right ? "text-right" : ""
                }`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={`row-${r.id ?? `idx-${idx}`}`} className="border-t">
              {headers.map((h, i) => (
                <td
                  key={`cell-${r.id ?? `idx-${idx}`}-${h.key}-${i}`}
                  className={`py-1 ${i === headers.length - 1 ? "pr-0" : "pr-2"} ${
                    h.right ? "text-right" : ""
                  } ${h.truncate ? "truncate" : ""}`}
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
}

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
        { key: "date", label: "Date", right: true, render: (v) => (v ? formatToManila(v) : "--") },
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
        { key: "latest_date", label: "Latest", right: true, render: (v) => (v ? formatToManila(v) : "--") },
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
      emptyText="No vans found"
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

// Credit Widget components
const CreditStatusPill = ({ status }) => {
  const st = String(status || "").toUpperCase();
  const base = "px-2 py-0.5 rounded text-[11px] font-semibold inline-flex";
  if (st === "PENDING") return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st === "PARTIAL") return <span className={`${base} bg-amber-100 text-amber-800`}>Partial</span>;
  if (st === "PAID") return <span className={`${base} bg-green-100 text-green-800`}>Paid</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "--"}</span>;
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
        emptyText="No credit records found"
      />
    </div>
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

/* -------------------- API helpers -------------------- */
const getCurrentWarehouseId = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  if ((user.role || "").toLowerCase() === "admin") {
    return selectedWarehouse?.id || user.warehouse_id;
  }
  // 🔧 For supervisors, warehouse_id might not exist, but warehouse name might
  // This function will return undefined for now, and the dashboard will handle warehouse matching by name
  return user.warehouse_id;
};
const apiCfgForWarehouse = (wid) => (wid ? { headers: { "X-Warehouse-ID": wid } } : {});

/* -------------------- Helper function to check data availability -------------------- */
const getDataAvailability = (lists) => {
  const hasData = (data) => {
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return Boolean(data);
  };

  return {
    stocks: hasData(lists.lowStockList),
    products: hasData(lists.productsList),
    receiving: hasData(lists.receivingsList),
    trading: hasData(lists.recentTransactions),
    'supplier-returns': hasData(lists.supplierReturnsList),
    'return-empties': hasData(lists.returnEmptiesList),
    credit: hasData(lists.creditList),
    users: hasData(lists.usersList),
    roles: hasData(lists.rolesList),
    vans: hasData(lists.vansList),
    suppliers: hasData(lists.suppliersList),
    warehouses: hasData(lists.warehousesList),
    invoice: false,
    salesreport: hasData(lists.salesPoints),
    inventoryreport: hasData(lists.productsList),
    settings: true,
  };
};

/* -------------------- 🔧 COMPLETELY FIXED: Enhanced fetchDashboard with SUPER STRICT CREDIT FILTERING + DEDUPLICATION -------------------- */
async function fetchDashboard(selectedWarehouseIds = [], period = "this-week", customStartDate = '', customEndDate = '') {
  console.log('🏢 Fetching dashboard for warehouses:', selectedWarehouseIds);
  console.log('📅 Filtering data for period:', period, customStartDate, customEndDate);
  
  const dateRange = getCustomPeriodRange(period, customStartDate, customEndDate);
  const { from: startDate, to: endDate } = dateRange;
  
  const isWithinDateRange = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date >= startDate && date <= endDate;
  };
  
  console.log('📊 Date range for filtering:', { startDate, endDate });
  
  const warehouseIds = selectedWarehouseIds.length > 0 ? selectedWarehouseIds : [getCurrentWarehouseId()];
  
  console.log('🎯 Strictly filtering for warehouse IDs:', warehouseIds);
  
  if (warehouseIds.length === 0 || warehouseIds.includes(null) || warehouseIds.includes(undefined)) {
    console.warn('⚠️ No valid warehouse IDs provided, returning empty data');
    return {
      metrics: {
        totalProducts: 0,
        totalStockPcs: 0,
        lowOrOutCount: 0,
        stockValueEstimate: 0,
        todaysSales: 0,
        todaysReturns: 0,
        todaysReturnsCount: 0,
      },
      lists: {
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
        profitPoints: [],
        miscPoints: [],
        totals: { revenue: 0, cogs: 0, discounts: 0, misc: 0, profit: 0 },
      },
      availableWarehouses: [],
    };
  }

  // Create parallel requests for each warehouse
  const warehouseRequests = warehouseIds.map(async (wid) => {
    if (!wid) return null;
    
    console.log(`🔄 Fetching data for warehouse ID: ${wid}`);
    
    const qsWid = `?warehouse=${wid}`;
    const qsWidId = `?warehouse_id=${wid}`;

    try {
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
      ] = await Promise.all([
        api.get(`/stocks/${qsWid}`),
        api.get(`/products/${qsWidId}`),
        api.get(`/receiving/`, apiCfgForWarehouse(wid)),
        api.get(`/merchandising-set/`, { params: { warehouse: wid } }),
        api.get(`/credits/`, apiCfgForWarehouse(wid)),
        api.get(`/supplier-return-form/${qsWidId}`),
        api.get(`/merchandisings/${qsWid}`),
        api.get(`/suppliers/${qsWid}`),
        api.get(`/users/`, apiCfgForWarehouse(wid)),
        api.get(`/roles/`),
        api.get(`/vans/${qsWid}`),
      ]);

      // 🔧 ENHANCED CREDIT DEBUG
      const creditsData = Array.isArray(creditsRes.data) ? creditsRes.data : creditsRes.data?.results || creditsRes.data?.data || [];
      console.log(`🏦 CREDITS DEBUG for warehouse ${wid}:`, {
        totalCredits: creditsData.length,
        apiUrl: `/credits/`,
        headers: apiCfgForWarehouse(wid),
        rawResponse: creditsRes.data,
        creditSample: creditsData.slice(0, 3).map(c => ({
          id: c.id,
          msp_no: c.msp_no,
          customer: c.customer_name,
          warehouse_id: c.warehouse_id,
          warehouse: c.warehouse,
          source_warehouse_id: c.source_warehouse_id,
          balance: c.balance,
          status: c.status
        }))
      });

      console.log(`✅ Successfully fetched data for warehouse ${wid}:`, {
        stocks: stocksRes.data?.length || stocksRes.data?.results?.length || 0,
        products: productsRes.data?.length || productsRes.data?.results?.length || 0,
        receivings: receivingsRes.data?.length || receivingsRes.data?.results?.length || 0,
        transactions: merchSetRes.data?.length || merchSetRes.data?.results?.length || 0,
        credits: creditsData.length,
      });

      return {
        warehouseId: wid,
        stocks: stocksRes.data,
        products: productsRes.data,
        receivings: receivingsRes.data,
        transactions: merchSetRes.data,
        credits: creditsRes.data,
        supplierReturns: supplierReturnsRes.data,
        merch: merchRes.data,
        suppliers: suppliersRes.data,
        users: usersRes.data,
        roles: rolesRes.data,
        vans: vansRes.data,
      };
    } catch (error) {
      console.error(`❌ Error fetching data for warehouse ${wid}:`, error);
      return {
        warehouseId: wid,
        stocks: [],
        products: [],
        receivings: [],
        transactions: [],
        credits: [],
        supplierReturns: [],
        merch: [],
        suppliers: [],
        users: [],
        roles: [],
        vans: [],
      };
    }
  });

  // Get warehouses list
  const warehousesRes = await api.get(`/warehouses/`);
  const warehousesData = warehousesRes.data;

  // Wait for all warehouse requests
  const warehouseResults = await Promise.all(warehouseRequests);

  // 🔧 CRITICAL FIX: Enhanced warehouse ID preservation with strict data integrity
  const combinedData = warehouseResults.reduce((acc, result) => {
    if (!result) return acc;

    const parseList = (data) =>
      Array.isArray(data) ? data : data?.results || data?.data || [];

    // 🔧 SUPER STRICT: Enhanced warehouse ID handling with data integrity checks
    const preserveWarehouseId = (items, requestedWarehouseId) => 
      items.map(item => {
        // Use the warehouse ID that's already in the item from the API response
        const originalWarehouseId = item.warehouse_id || item.warehouse || item.source_warehouse_id;
        
        // 🔧 CRITICAL FIX: Only use fallback if NO warehouse ID exists AND it makes sense to do so
        // For credits, if there's no warehouse ID, it's likely a data integrity issue
        let finalWarehouseId = originalWarehouseId;
        
        // Only use requestedWarehouseId as fallback for certain data types that should inherit it
        if (!originalWarehouseId) {
          // For credits, users, roles - don't use fallback, keep as null to filter out
          if (item.msp_no || item.customer_name || item.username || item.role) {
            console.log(`⚠️ DATA INTEGRITY ISSUE: Item has no warehouse ID, will be filtered out:`, {
              id: item.id,
              type: item.msp_no ? 'credit' : item.username ? 'user' : 'other',
              msp_no: item.msp_no,
              customer: item.customer_name,
              requestedWarehouse: requestedWarehouseId
            });
            finalWarehouseId = null; // This will cause it to be filtered out
          } else {
            // For other data types (stocks, products, etc.), use fallback
            finalWarehouseId = requestedWarehouseId;
          }
        }
        
        // Log cross-warehouse data (data that belongs to different warehouse than requested)
        if (originalWarehouseId && originalWarehouseId !== requestedWarehouseId) {
          console.log(`⚠️ CROSS-WAREHOUSE DATA: Item belongs to warehouse ${originalWarehouseId} but was fetched for warehouse ${requestedWarehouseId}:`, {
            id: item.id || item.msp_no || 'unknown',
            type: item.transaction_type_name || item.msp_no ? 'credit' : 'unknown type',
            msp_no: item.msp_no,
            customer: item.customer_name,
            actualWarehouse: originalWarehouseId,
            requestedWarehouse: requestedWarehouseId
          });
        }
        
        return { 
          ...item, 
          // Use the final warehouse ID (could be null for items with no warehouse ID)
          source_warehouse_id: finalWarehouseId,
          warehouse_id: finalWarehouseId,
          warehouse: finalWarehouseId
        };
      });

    acc.stocks = acc.stocks.concat(preserveWarehouseId(parseList(result.stocks), result.warehouseId));
    acc.products = acc.products.concat(preserveWarehouseId(parseList(result.products), result.warehouseId));
    acc.receivings = acc.receivings.concat(preserveWarehouseId(parseList(result.receivings), result.warehouseId));
    acc.transactions = acc.transactions.concat(preserveWarehouseId(parseList(result.transactions), result.warehouseId));
    acc.credits = acc.credits.concat(preserveWarehouseId(parseList(result.credits), result.warehouseId));
    acc.supplierReturns = acc.supplierReturns.concat(preserveWarehouseId(parseList(result.supplierReturns), result.warehouseId));
    acc.merch = acc.merch.concat(preserveWarehouseId(parseList(result.merch), result.warehouseId));
    acc.suppliers = acc.suppliers.concat(preserveWarehouseId(parseList(result.suppliers), result.warehouseId));
    acc.users = acc.users.concat(preserveWarehouseId(parseList(result.users), result.warehouseId));
    acc.roles = acc.roles.concat(preserveWarehouseId(parseList(result.roles), result.warehouseId));
    acc.vans = acc.vans.concat(preserveWarehouseId(parseList(result.vans), result.warehouseId));

    return acc;
  }, {
    stocks: [],
    products: [],
    receivings: [],
    transactions: [],
    credits: [],
    supplierReturns: [],
    merch: [],
    suppliers: [],
    users: [],
    roles: [],
    vans: [],
  });

  // 🔧 SUPER STRICT CREDIT FILTERING with detailed debugging AND DEDUPLICATION
  const superStrictCreditFiltering = (combinedCredits, warehouseIds) => {
    console.log('🏦 SUPER STRICT CREDIT FILTERING + DEDUPLICATION DEBUG:');
    console.log('📋 All credits before filtering:', combinedCredits.length);
    console.log('🎯 Target warehouse IDs:', warehouseIds);
    
    // 🔧 STEP 1: DEDUPLICATE by ID first
    const uniqueCreditsMap = new Map();
    
    combinedCredits.forEach(credit => {
      const creditId = credit.id;
      if (!uniqueCreditsMap.has(creditId)) {
        uniqueCreditsMap.set(creditId, credit);
      } else {
        // If duplicate found, log it for debugging
        console.log(`🔄 DUPLICATE CREDIT DETECTED - Keeping first occurrence:`, {
          id: creditId,
          msp_no: credit.msp_no,
          customer: credit.customer_name,
          balance: credit.balance,
          existing: uniqueCreditsMap.get(creditId)
        });
      }
    });
    
    const deduplicatedCredits = Array.from(uniqueCreditsMap.values());
    console.log(`🎯 DEDUPLICATION RESULT: ${deduplicatedCredits.length} unique credits from ${combinedCredits.length} total`);
    
    // 🔧 STEP 2: Apply warehouse filtering to deduplicated credits
    const filtered = deduplicatedCredits.filter(credit => {
      const creditWarehouseId = credit.source_warehouse_id || credit.warehouse_id || credit.warehouse;
      
      // 🔧 SUPER STRICT FILTERING: Reject items with null/undefined warehouse IDs
      if (creditWarehouseId === null || creditWarehouseId === undefined) {
        console.log(`🚫 FILTERING OUT CREDIT (NO WAREHOUSE ID):`, {
          id: credit.id,
          msp_no: credit.msp_no,
          customer: credit.customer_name,
          balance: credit.balance,
          reason: `Credit has no warehouse ID (${creditWarehouseId}) - likely data integrity issue`
        });
        return false;
      }
      
      const shouldInclude = warehouseIds.includes(creditWarehouseId);
      
      if (!shouldInclude) {
        console.log(`🚫 FILTERING OUT CREDIT (WRONG WAREHOUSE):`, {
          id: credit.id,
          msp_no: credit.msp_no,
          customer: credit.customer_name,
          balance: credit.balance,
          creditWarehouseId,
          selectedWarehouses: warehouseIds,
          reason: `Credit warehouse ${creditWarehouseId} not in selected warehouses [${warehouseIds.join(', ')}]`
        });
      } else {
        console.log(`✅ KEEPING CREDIT:`, {
          id: credit.id,
          msp_no: credit.msp_no,
          customer: credit.customer_name,
          balance: credit.balance,
          creditWarehouseId,
          reason: `Credit warehouse ${creditWarehouseId} matches selected warehouse`
        });
      }
      
      return shouldInclude;
    });
    
    console.log(`🏦 SUPER STRICT CREDIT FILTERING + DEDUPLICATION RESULT: ${filtered.length} unique, filtered credits from ${combinedCredits.length} total original credits`);
    return filtered;
  };

  // Apply filtering with enhanced debugging
  console.log('🔒 Applying strict warehouse filtering for IDs:', warehouseIds);
  console.log('📊 Raw data counts before filtering:', {
    stocks: combinedData.stocks.length,
    products: combinedData.products.length,
    receivings: combinedData.receivings.length,
    transactions: combinedData.transactions.length,
    credits: combinedData.credits.length,
    supplierReturns: combinedData.supplierReturns.length,
    merch: combinedData.merch.length
  });
  
  // Enhanced filtering function that strictly enforces warehouse boundaries
  const strictFilterByWarehouse = (items, warehouseIds, dataType = 'unknown') => {
    console.log(`🔍 Filtering ${items.length} ${dataType} items for warehouses:`, warehouseIds);
    
    const filtered = items.filter(item => {
      const itemWarehouseId = item.source_warehouse_id || item.warehouse_id || item.warehouse;
      
      // Also reject null/undefined warehouse IDs for strict data types
      if ((dataType === 'users' || dataType === 'credits') && (itemWarehouseId === null || itemWarehouseId === undefined)) {
        console.log(`🚫 FILTERED OUT ${dataType.toUpperCase()} (NO WAREHOUSE ID):`, {
          id: item.id || item.msp_no || 'unknown',
          type: dataType,
          warehouse: itemWarehouseId,
          reason: 'No warehouse ID - data integrity issue'
        });
        return false;
      }
      
      const isInSelectedWarehouses = warehouseIds.includes(itemWarehouseId);
      
      if (!isInSelectedWarehouses) {
        console.log(`🚫 FILTERED OUT ${dataType.toUpperCase()} - Item from warehouse ${itemWarehouseId} not in selected warehouses:`, {
          id: item.id || item.msp_no || 'unknown',
          type: item.transaction_type_name || dataType,
          warehouse: itemWarehouseId,
          selected: warehouseIds
        });
      }
      
      return isInSelectedWarehouses;
    });
    
    console.log(`📋 ${dataType.toUpperCase()} filtered result: ${filtered.length} items remaining from ${items.length} original`);
    return filtered;
  };
  
  const stocks = strictFilterByWarehouse(combinedData.stocks, warehouseIds, 'stocks');
  const products = strictFilterByWarehouse(combinedData.products, warehouseIds, 'products');
  const receivings = strictFilterByWarehouse(combinedData.receivings, warehouseIds, 'receivings');
  const transactions = strictFilterByWarehouse(combinedData.transactions, warehouseIds, 'transactions');
  
  // 🔧 USE SUPER STRICT CREDIT FILTERING WITH DEDUPLICATION
  const credits = superStrictCreditFiltering(combinedData.credits, warehouseIds);
  
  const supplierReturns = strictFilterByWarehouse(combinedData.supplierReturns, warehouseIds, 'supplierReturns');
  const merch = strictFilterByWarehouse(combinedData.merch, warehouseIds, 'merch');
  const suppliers = strictFilterByWarehouse(combinedData.suppliers, warehouseIds, 'suppliers');
  const users = strictFilterByWarehouse(combinedData.users, warehouseIds, 'users');
  const roles = combinedData.roles; // Roles are global, don't filter
  const vans = strictFilterByWarehouse(combinedData.vans, warehouseIds, 'vans');
  
  console.log('✅ FINAL filtered data counts after strict warehouse filtering + deduplication:', {
    stocks: stocks.length,
    products: products.length,
    receivings: receivings.length,
    transactions: transactions.length,
    credits: credits.length,
    supplierReturns: supplierReturns.length,
    merch: merch.length,
    suppliers: suppliers.length,
    users: users.length,
    vans: vans.length
  });

  const warehouses = Array.isArray(warehousesData) ? warehousesData : warehousesData?.results || warehousesData?.data || [];

  // Process other data...
  const warehousesList = [...warehouses]
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .slice(0, 5)
    .map((w) => ({
      id: w.id,
      name: w.name || "--",
      city: w.city || "--",
      province: w.province || "--",
      phone_number: w.phone_number || "--",
    }));

  const suppliersList = [...suppliers]
    .sort((a, b) => String(a.company_name || "").localeCompare(String(b.company_name || "")))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      registration_number: s.registration_number || "--",
      company_name: s.company_name || "--",
      contact_person: s.contact_person || "--",
      phone_number: s.phone_number || "--",
    }));

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

  /* -------- lists with DATE FILTERING -------- */
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
    system_code: p.system_code || "--",
    name: p.product_name || p.name || "Untitled",
    category: p.product_category?.name || "N/A",
  }));

  // 🔧 DATE FILTERING: Apply to receivings
  const receivingsList = [...receivings]
    .filter((r) => !r.date_time || isWithinDateRange(r.date_time))
    .sort((a, b) => new Date(b.date_time || 0) - new Date(a.date_time || 0))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      receive_no: r.receive_no || r.receiveNo || `#${r.id}`,
      supplier: r.supplier_name || r.supplier?.name || "--",
      date: r.date_time ? new Date(r.date_time) : null,
      net_amount: n(r.net_amount),
    }));

  // 🔧 DATE FILTERING: Apply to transactions
  const recentTransactions = [...transactions]
    .filter((t) => !t.date_time || isWithinDateRange(t.date_time))
    .sort((a, b) => new Date(b.date_time || 0) - new Date(a.date_time || 0))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      msp_no: t.msp_no || `#${t.id}`,
      date_time: t.date_time || null,
      transaction_type_name: t.transaction_type_name || t.transaction_type || "--",
      handled_by: t.handled_by_name || t.handled_by_username || t.handled_by || "--",
      status: t.status || "--",
      source_warehouse_id: t.source_warehouse_id,
    }));

  // 🔧 DATE FILTERING: Apply to supplier returns
  const supplierReturnsList = [...supplierReturns]
    .filter((sr) => !sr.date || isWithinDateRange(sr.date))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5)
    .map((sr) => ({
      id: sr.id,
      sup_no: sr.sup_no || `#${sr.id}`,
      supplier: sr.supplier_name || sr.supplier || "--",
      total_amount: n(sr.total_amount),
      date: sr.date || null,
    }));

  // 🔧 DATE FILTERING: Apply to supplier returns for today's calculation
  const todaysReturnsArray = supplierReturns.filter((sr) => sr.date && isWithinDateRange(sr.date) && isSameDayManila(sr.date));
  const todaysReturns = todaysReturnsArray.reduce((sum, sr) => sum + n(sr.total_amount), 0);
  const todaysReturnsCount = todaysReturnsArray.length;

  /* -------- Return Empties aggregation with DATE FILTERING -------- */
  const emptiesRaw = [];
  for (const m of merch) {
    // 🔧 DATE FILTERING: Check if transaction is within date range
    if (!isWithinDateRange(m.date_time || m.created_at || m.updated_at)) continue;
    
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

  /* -------- Users / Roles -------- */
  const usersList = users.slice(0, 5).map((u) => ({
    id: u.id,
    name:
      u.full_name ||
      u.name ||
      `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
      u.username ||
      "--",
    username: u.username || "--",
    role: u.role?.name || u.role || u.role_name || "--",
  }));

  const rolesList = roles.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name || r.role || "--",
    users_count: Number(r.users_count ?? r.user_count ?? 0),
  }));

  // 🔧 ENHANCED CREDIT PROCESSING with DEDUPLICATION ALREADY APPLIED
  console.log('🏦 PROCESSING ALREADY DEDUPLICATED & FILTERED CREDITS:', credits.length);
  
  const creditSummary = (() => {
    const filteredCredits = credits.filter((c) => !c.created_at || isWithinDateRange(c.created_at));
    console.log('💳 Credits after date filtering:', filteredCredits.length);
    
    const outstanding = filteredCredits.filter((c) => String(c.status || "").toUpperCase() !== "PAID" && Number(c.balance || 0) > 0);
    console.log('💰 Outstanding credits:', outstanding.length);
    
    const totalOutstandingBalance = outstanding.reduce((s, c) => s + Number(c.balance || 0), 0);
    return { countOutstanding: outstanding.length, totalOutstandingBalance };
  })();

  const creditList = [...credits]
    .filter((c) => !c.created_at || isWithinDateRange(c.created_at))
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      msp_no: c.msp_no || `#${c.id}`,
      customer: c.customer_name || "--",
      balance: Number(c.balance || 0),
      status: String(c.status || "").toUpperCase(),
      date_time: c.created_at || null,
      source_warehouse_id: c.source_warehouse_id,
    }));

  console.log('🏦 FINAL DEDUPLICATED & FILTERED CREDIT LIST:', creditList.length, 'unique credits to display');

  /* -------- Vans list -------- */
  const vansList = [...vans]
    .sort((a, b) => String(a.plate_number || "").localeCompare(String(b.plate_number || "")))
    .slice(0, 5)
    .map((v) => ({
      id: v.id,
      van_id: v.van_id || `#${v.id}`,
      plate_number: v.plate_number || "--",
    }));

  /* -------- Sales points for money chart with DATE FILTERING -------- */
  const salesPoints = merch
    .filter((m) => isWithinDateRange(m.date_time || m.created_at || m.updated_at))
    .map((m) => ({
      date: m.date_time || m.created_at || m.updated_at,
      amount: n(m.actual_sale || m.total_amount || m.payment_amount || m.cash_received || 0),
    }))
    .filter((p) => p.date && p.amount >= 0);

  /* -------- Profit + Misc calculations with DATE FILTERING -------- */
  const contentNoOf = (it, prod) =>
    Number(prod?.unit_type?.content_no ?? it.content_no ?? 1) || 1;

  const pieceQty = (it, prod) => {
    const explicitTotal =
      Number(it.total_pcs ?? it.sold_total_pcs ?? it.total_qty_pcs ?? 0) || 0;
    if (explicitTotal > 0) return explicitTotal;

    const pcs =
      Number(it.sold_pcs ?? it.pcs ?? it.qty ?? it.quantity ?? it.actual_qty ?? 0) || 0;
    if (pcs > 0) return pcs;

    const shells = Number(it.sold_shell ?? it.shell_qty ?? 0) || 0;
    if (shells > 0) return shells * Math.max(1, contentNoOf(it, prod));

    return 0;
  };

  const pricesOf = (it, prod) => {
    const price = prod?.price || {};
    const selling  = Number(it.selling_price ?? it.price ?? price.selling_price ?? 0) || 0;
    const purchase = Number(it.purchase_price ?? price.purchase_price ?? 0) || 0;
    return { selling, unitCost: purchase };
  };

  const discountOf = (it, selling, qty) => {
    const gross = selling * qty;
    const pct  = Number(it.discount_percent ?? 0);
    const amt  = Number(it.discount_amount  ?? 0);
    const pctVal = pct > 0 ? gross * (pct / 100) : 0;
    const raw = Math.max(pctVal, amt);
    return Math.min(raw, gross);
  };

  const totals = { revenue: 0, cogs: 0, discounts: 0, misc: 0, profit: 0 };
  const profitPoints = [];
  const miscPoints = [];

  for (const m of merch) {
    const txDate = m?.date_time || m?.created_at || m?.updated_at;
    // 🔧 DATE FILTERING: Apply to profit calculations
    if (!txDate || !Array.isArray(m.items) || !isWithinDateRange(txDate)) continue;
    let rev = 0, cogs = 0, disc = 0;

    for (const it of m.items) {
      const prod = productById.get(it.product);
      const qty = pieceQty(it, prod);
      if (qty <= 0) continue;
      const { selling, unitCost } = pricesOf(it, prod);
      rev  += selling * qty;
      cogs += unitCost * qty;
      disc += discountOf(it, selling, qty);
    }

    const misc =
      Number(m.misc_total ?? 0) ||
      (Array.isArray(m.misc_items)
        ? m.misc_items.reduce((s, x) => s + Number(x?.amount || 0), 0)
        : 0);

    const profit = rev - disc - misc - cogs;
    totals.revenue += rev;
    totals.cogs += cogs;
    totals.discounts += disc;
    totals.misc += misc;
    totals.profit += profit;

    profitPoints.push({ date: txDate, amount: profit });
    if (misc) miscPoints.push({ date: txDate, amount: misc });
  }

  /* -------- Products Sold count with DATE FILTERING -------- */
  let productsSold = 0;
  for (const m of merch) {
    const txDate = m?.date_time || m?.created_at || m?.updated_at;
    if (!txDate || !Array.isArray(m.items) || !isWithinDateRange(txDate)) continue;

    for (const it of m.items) {
      const prod = productById.get(it.product);
      const qty = pieceQty(it, prod);
      productsSold += qty;
    }
  }

  /* -------- Product Performance TIME SERIES with DATE FILTERING -------- */
  const ppSeriesByDate = new Map();
  const categoryMapObj = {};

  for (const m of merch) {
    const txDate = m?.date_time || m?.created_at || m?.updated_at;
    // 🔧 DATE FILTERING: Apply to product performance
    if (!txDate || !Array.isArray(m.items) || !isWithinDateRange(txDate)) continue;
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

      const qty = pieceQty(it, prod);
      const providedLine =
        n(it.line_total ?? it.total_amount ?? it.actual_amount ?? 0);
      const selling =
        n(it.selling_price ?? it.price ?? it.unit_price ?? it.actual_price ?? 0);
      const line = providedLine > 0 ? providedLine : qty * selling;

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

  console.log('📈 FINAL WAREHOUSE-FILTERED Results with SUPER STRICT + DEDUPLICATED CREDITS:', {
    selectedWarehouses: warehouseIds,
    period,
    dateRange: { startDate, endDate },
    receivings: receivingsList.length,
    transactions: recentTransactions.length,
    supplierReturns: supplierReturnsList.length,
    credits: creditList.length,
    salesPoints: salesPoints.length,
    profitPoints: profitPoints.length
  });

  return {
    metrics: {
      totalProducts,
      totalStockPcs,
      lowOrOutCount,
      stockValueEstimate: 0,
      todaysSales: 0,
      todaysReturns,
      todaysReturnsCount,
      productsSold, 
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
      productPerformance,
      productPerformanceSeries,
      categoryMap: categoryMapObj,
      profitPoints,
      miscPoints,
      totals,
    },
    availableWarehouses: warehouses.map(w => ({
      id: w.id,
      name: w.name || `Warehouse #${w.id}`,
      city: w.city,
      province: w.province,
    })),
  };
}

/* -------------------- Dashboard Component (Fixed initialization) -------------------- */
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
    profitPoints: [],
    miscPoints: [],
    totals: { revenue: 0, cogs: 0, discounts: 0, misc: 0, profit: 0 },
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);

  // Add this updateRevenueAndProfit function here
  const updateRevenueAndProfit = (totalRevenue, profit) => {
      setMetrics((prevMetrics) => ({
        ...prevMetrics,
        totalRevenue: prevMetrics.totalRevenue + totalRevenue, // Add the new total revenue
        profit: prevMetrics.profit + profit, // Update profit (set to 0 for now)
      }));
    };

  // Use this function where the sale is completed (this part is your business logic)
  const completeVanLoadSale = async (vanLoadData) => {
    const totalSaleAmount = vanLoadData.totalAmount; // Sale amount (revenue)
    const costs = vanLoadData.costs; // Costs (COGS)

    // Calculate profit: revenue - costs
    const profit = totalSaleAmount - costs;

    // Update revenue and profit in the dashboard
    updateRevenueAndProfit(totalSaleAmount, profit);
  };

  // Period states
  const [period, setPeriod] = useState("this-week");
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Warehouse selection state
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState([]);

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

  // Fetch the revenue from localStorage (or global state)
  useEffect(() => {
    const savedRevenue = localStorage.getItem('totalRevenue');
    setMetrics((prevMetrics) => ({
      ...prevMetrics,
      totalRevenue: savedRevenue ? parseFloat(savedRevenue) : 0,
    }));
  }, []);

  const visibleSelectedItems = useMemo(
    () => selectedIds.map((id) => CATALOG_MAP.get(id)).filter(Boolean),
    [selectedIds]
  );

  // 🔧 FIXED: loadData function with strict warehouse filtering
  const loadData = useCallback(
    async (warehouseIds, periodParam = period, customStart = customStartDate, customEnd = customEndDate) => {
      try {
        setLoading(true);
        
        console.log('🔄 Loading dashboard data for warehouses:', warehouseIds);
        console.log('📅 Using period:', periodParam, customStart, customEnd);
        
        const fresh = await fetchDashboard(warehouseIds, periodParam, customStart, customEnd);
        
        startTransition(() => {
          setMetrics(fresh.metrics);
          setLists(fresh.lists);
          setAvailableWarehouses(fresh.availableWarehouses || []);
          setLastUpdated(new Date());
        });
        
      } catch (e) {
        console.error("Dashboard load error:", e);
        startTransition(() => {
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
            profitPoints: [],
            miscPoints: [],
            totals: { revenue: 0, cogs: 0, discounts: 0, misc: 0, profit: 0 },
          });
          setLastUpdated(new Date());
        });
      } finally {
        setLoading(false);
      }
    },
    [period, customStartDate, customEndDate] // Include period dependencies
  );

  // 🔧 FIXED: Initial data load with warehouse loading
  useEffect(() => {
    const initializeDashboard = async () => {
      console.log('🚀 Initializing dashboard...');
      
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const headerSelectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      
      console.log('👤 User data:', userData);
      console.log('🏢 Header selected warehouse:', headerSelectedWarehouse);
      
      let warehouseIds = [];
      
      if (userData.role?.toLowerCase() === "admin" && headerSelectedWarehouse) {
        warehouseIds = [headerSelectedWarehouse.id];
        console.log('👑 Admin using header warehouse:', warehouseIds);
      } else if (userData.warehouse_id) {
        warehouseIds = [userData.warehouse_id];
        console.log('🏭 Using user warehouse_id:', warehouseIds);
      } else {
        // Load warehouses to find matching one
        console.log('🔍 Loading warehouses to find match...');
        try {
          const warehousesRes = await api.get("/warehouses/");
          const warehouses = warehousesRes.data;
          setAvailableWarehouses(warehouses);
          
          if (userData.warehouse) {
            // Find warehouse by name
            const matchingWarehouse = warehouses.find(w => 
              w.name === userData.warehouse || 
              w.name.toLowerCase() === userData.warehouse.toLowerCase()
            );
            
            if (matchingWarehouse) {
              warehouseIds = [matchingWarehouse.id];
              console.log('🎯 Found warehouse by name:', userData.warehouse, '→', warehouseIds);
            } else {
              warehouseIds = [warehouses[0]?.id].filter(Boolean);
              console.log('🔄 Using first warehouse as fallback:', warehouseIds);
            }
          } else {
            warehouseIds = [warehouses[0]?.id].filter(Boolean);
            console.log('🌐 No warehouse info, using first warehouse:', warehouseIds);
          }
        } catch (error) {
          console.error('❌ Error loading warehouses:', error);
        }
      }
      
      if (warehouseIds.length > 0) {
        console.log('✅ Setting warehouse IDs and loading data:', warehouseIds);
        setSelectedWarehouseIds(warehouseIds);
        loadData(warehouseIds);
      } else {
        console.log('⚠️ No warehouse IDs found');
      }
    };
    
    initializeDashboard();
  }, []); // Only run once on mount

  // 🔧 COMMENTED OUT: Old warehouse change event listener - kept for reference
  // useEffect(() => {
  //   const handleWarehouseChange = (event) => {
  //     const { warehouse, action, source } = event.detail || {};
      
  //     console.log('🏭 Warehouse change detected:', { warehouse, action, source });
      
  //     if (source === 'header') {
  //       if (action === 'select' && warehouse) {
  //         console.log('📍 Syncing dashboard to warehouse:', warehouse.name);
  //         const newIds = [warehouse.id];
  //         setSelectedWarehouseIds(newIds);
  //         loadData(newIds, period, customStartDate, customEndDate);
  //       } else if (action === 'reset') {
  //         console.log('🔄 Resetting to enrolled warehouse');
  //         const userData = JSON.parse(localStorage.getItem("user") || "{}");
  //         const userWarehouseId = userData.warehouse_id;
  //         if (userWarehouseId) {
  //           const newIds = [userWarehouseId];
  //           setSelectedWarehouseIds(newIds);
  //           loadData(newIds, period, customStartDate, customEndDate);
  //         }
  //       }
  //     }
  //   };
    
  //   window.addEventListener("warehouseChanged", handleWarehouseChange);
  //   return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  // }, [loadData, period, customStartDate, customEndDate]);

  // 🔧 NEW: Warehouse change event listener with better handling
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      const { warehouse, action, source } = event.detail || {};
      
      console.log('🏭 Warehouse change detected:', { warehouse, action, source });
      
      if (source === 'header') {
        if (action === 'select' && warehouse) {
          console.log('📍 Syncing dashboard to warehouse:', warehouse.name);
          const newIds = [warehouse.id];
          setSelectedWarehouseIds(newIds);
          loadData(newIds, period, customStartDate, customEndDate);
        } else if (action === 'reset') {
          console.log('🔄 Resetting to enrolled warehouse');
          const userData = JSON.parse(localStorage.getItem("user") || "{}");
          
          // Try to find warehouse by name if warehouse_id doesn't exist
          if (userData.warehouse && availableWarehouses.length > 0) {
            const matchingWarehouse = availableWarehouses.find(w => 
              w.name === userData.warehouse || 
              w.name.toLowerCase() === userData.warehouse.toLowerCase()
            );
            
            if (matchingWarehouse) {
              const newIds = [matchingWarehouse.id];
              setSelectedWarehouseIds(newIds);
              loadData(newIds, period, customStartDate, customEndDate);
            }
          } else if (userData.warehouse_id) {
            const newIds = [userData.warehouse_id];
            setSelectedWarehouseIds(newIds);
            loadData(newIds, period, customStartDate, customEndDate);
          }
        }
      }
    };
    
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [loadData, period, customStartDate, customEndDate, availableWarehouses]);

  // 🔧 COMMENTED OUT: Auto-populate available warehouses - no longer needed with new initialization
  // useEffect(() => {
  //   if (availableWarehouses.length > 0 && selectedWarehouseIds.length === 0) {
  //     const userData = JSON.parse(localStorage.getItem("user") || "{}");
  //     
  //     console.log('🏗️ Auto-populating warehouses:', { availableWarehouses, userData });
      
  //     if (userData.warehouse_id) {
  //       // User has numeric warehouse_id
  //       const newIds = [userData.warehouse_id];
  //       console.log('✅ Using userData.warehouse_id:', newIds);
  //       setSelectedWarehouseIds(newIds);
  //       loadData(newIds, period, customStartDate, customEndDate);
  //     } else if (userData.warehouse) {
  //       // 🔧 NEW: User has warehouse name, find matching ID
  //       const matchingWarehouse = availableWarehouses.find(w => 
  //         w.name === userData.warehouse || 
  //         w.name.toLowerCase() === userData.warehouse.toLowerCase()
  //       );
        
  //       if (matchingWarehouse) {
  //         const newIds = [matchingWarehouse.id];
  //         console.log('🎯 Found matching warehouse by name:', userData.warehouse, '→', newIds);
  //         setSelectedWarehouseIds(newIds);
  //         loadData(newIds, period, customStartDate, customEndDate);
  //       } else {
  //         console.log('❌ No warehouse found matching name:', userData.warehouse);
  //         // Fallback to first warehouse
  //         const fallbackIds = [availableWarehouses[0].id];
  //         console.log('🔄 Using fallback warehouse:', fallbackIds);
  //         setSelectedWarehouseIds(fallbackIds);
  //         loadData(fallbackIds, period, customStartDate, customEndDate);
  //       }
  //     } else {
  //       // No warehouse info, use all available
  //       const allIds = availableWarehouses.map(w => w.id);
  //       console.log('🌐 No warehouse info, using all warehouses:', allIds);
  //       setSelectedWarehouseIds(allIds);
  //       loadData(allIds, period, customStartDate, customEndDate);
  //     }
  //   }
  // }, [availableWarehouses, loadData, period, customStartDate, customEndDate]);

  const removeWidget = useCallback((id) => setSelectedIds((prev) => prev.filter((x) => x !== id)), []);

  // 🔧 FIXED: Period change handler with data reload
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      setCustomStartDate('');
      setCustomEndDate('');
      // Reload data immediately for non-custom periods
      if (selectedWarehouseIds.length > 0) {
        loadData(selectedWarehouseIds, newPeriod, '', '');
      }
    }
  };

  // 🔧 FIXED: Custom dates change handler with data reload
  const handleCustomDatesChange = (startDate, endDate) => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    
    // Reload data when custom dates change (if both dates are set)
    if (period === 'custom' && startDate && endDate && selectedWarehouseIds.length > 0) {
      loadData(selectedWarehouseIds, period, startDate, endDate);
    }
  };

  // 🔧 FIXED: Manual warehouse change handler
  const handleWarehouseChange = (warehouseIds) => {
    console.log('🏗️ Manual warehouse selection change:', warehouseIds);
    setSelectedWarehouseIds(warehouseIds);
    loadData(warehouseIds, period, customStartDate, customEndDate);
  };

  /* ---------- PERIOD-SYNCED SUMS FOR CARDS ---------- */
  const periodSums = useMemo(() => {
    const { from, to } = getCustomPeriodRange(period, customStartDate, customEndDate);
    const inRange = (iso) => {
      const d = new Date(iso);
      return d >= from && d <= to;
    };

    const revenue = (lists?.salesPoints || [])
      .filter((p) => p?.date && inRange(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const profit = (lists?.profitPoints || [])
      .filter((p) => p?.date && inRange(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const misc = (lists?.miscPoints || [])
      .filter((p) => p?.date && inRange(p.date))
      .reduce((s, p) => s + Number(p.amount || 0), lists?.miscPoints ? 0 : Number(lists?.totals?.misc || 0));

    return { revenue, profit, misc };
  }, [lists, period, customStartDate, customEndDate]);

  // Debug logging
  console.log('📊 Dashboard Debug:', {
    totalProducts: metrics?.totalProducts,
    creditList: lists.creditList,
    selectedWarehouses: selectedWarehouseIds,
    period,
    customStartDate,
    customEndDate,
    loading
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(99,102,241,0.10),transparent)]">
      {/* Loading overlay */}
      {/* {loading && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
            <span className="text-sm text-gray-600">Loading dashboard...</span>
          </div>
        </div>
      )} */}

      {/* Header */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl 
              bg-white text-gray-700 
              flex items-center justify-center 
              shadow-md shadow-gray-300/50 
              border border-gray-200 
              transition-all duration-300 hover:scale-105 hover:shadow-lg">
              <IconSales />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <IconWarehouse /> Viewing:
                </span>
                <span className="font-medium">
                  {selectedWarehouseIds.length === 0 
                    ? (warehouseMeta?.warehouse || warehouseMeta?.name || "Default Warehouse")
                    : selectedWarehouseIds.length === availableWarehouses.length
                    ? availableWarehouses.length === 2 ? "Both Warehouses" : "All Warehouses"
                    : selectedWarehouseIds.length === 1
                    ? availableWarehouses.find(w => w.id === selectedWarehouseIds[0])?.name || "Unknown"
                    : selectedWarehouseIds.length === 2
                    ? "Both Warehouses"
                    : `${selectedWarehouseIds.length} Warehouses`
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WarehouseDropdown
              selectedWarehouseIds={selectedWarehouseIds}
              onWarehouseChange={handleWarehouseChange}
              warehouses={availableWarehouses}
            />

            <PeriodDropdown
              period={period}
              onPeriodChange={handlePeriodChange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDatesChange={handleCustomDatesChange}
            />

            <button
              onClick={() => setPickerOpen(true)}
              className="btn btn-add"
            >
              + Add Widgets
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
              totalRevenue: periodSums.revenue ?? 0,
              productsSold: metrics?.productsSold ?? 0,   // ✅ fixed
              supplierReturnables: lists?.supplierReturnsList?.length ?? 0,
              miscCharges: periodSums.misc ?? 0,
              actualProfit: periodSums.profit ?? 0,
            }}
          />
        </div>

        {/* STATISTICS CHART */}
        <Statistics
          metrics={metrics}
          onRefresh={() => loadData(selectedWarehouseIds, period, customStartDate, customEndDate)}
          loading={loading || isPending}
          lastUpdated={lastUpdated}
          salesPoints={lists.salesPoints}
          profitPoints={lists.profitPoints}
          profitTotal={lists?.totals?.profit}
          revenue={periodSums.revenue}
          miscTotal={periodSums.misc}
          period={period}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
        />

        {/* PRODUCT PERFORMANCE */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2">
          <ProductPerformance
            title="Product Performance"
            data={lists.productPerformanceSeries}
            categoryMap={lists.categoryMap}
            period={period}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            height={300}
          />
        </div>

        {/* TOP SELLING PRODUCTS */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <TopSellingProductsWidget
            series={lists.productPerformanceSeries}
            period={period}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            topN={10}
          />
        </div>

        {/* Widgets */}
        {useMemo(
          () =>
            visibleSelectedItems.map((item, widgetIndex) => {
              const id = item.id;
              const route = item.route;
              const uniqueKey = `widget-${id}-${widgetIndex}`;

              if (id === "stocks") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <LowStockWidget items={lists.lowStockList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "products") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <ProductsWidget rows={lists.productsList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "receiving") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <ReceivingWidget rows={lists.receivingsList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "trading") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <TradingPreview rows={lists.recentTransactions} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "supplier-returns") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <SupplierReturnsWidget rows={lists.supplierReturnsList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "return-empties") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <ReturnEmptiesWidget rows={lists.returnEmptiesList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "credit") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <CreditWidget rows={lists.creditList} summary={lists.creditSummary} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "users") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <UsersWidget rows={lists.usersList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "roles") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <RolesWidget rows={lists.rolesList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "vans") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <VansWidget rows={lists.vansList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "suppliers") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <SuppliersWidget rows={lists.suppliersList} />
                  </GenericSidebarWidget>
                );
              }

              if (id === "warehouses") {
                return (
                  <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget}>
                    <WarehousesWidget rows={lists.warehousesList} />
                  </GenericSidebarWidget>
                );
              }

              return (
                <GenericSidebarWidget key={uniqueKey} id={id} title={item.name} route={route} onRemove={removeWidget} />
              );
            }),
          [visibleSelectedItems, removeWidget, lists]
        )}

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

      {/* Widget Picker Modal */}
      <WidgetPickerModal
        open={pickerOpen}
        selectedIds={selectedIds}
        onClose={() => setPickerOpen(false)}
        onSave={(ids) => {
          setSelectedIds(ids);
          setPickerOpen(false);
        }}
        dataAvailability={getDataAvailability(lists)}
        selectedWarehouses={selectedWarehouseIds.map(id => 
          availableWarehouses.find(w => w.id === id)?.name || 'Unknown'
        )}
      />
    </div>
  );
};

/* ---- Status components ---- */
const StatusPill = ({ status }) => {
  const st = (status || "").toLowerCase();
  const base = "px-2 py-0.5 rounded text-[11px] font-semibold inline-flex";
  if (st === "pending") return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st === "complete" || st === "completed") return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "--"}</span>;
};

const TradingPreview = memo(function TradingPreview({ rows }) {
  if (!rows) return <div className="text-xs text-slate-500">Loading…</div>;
  if (rows.length === 0) return <div className="text-xs text-slate-500">No recent transactions</div>;
  const latest = rows[0];
  return (
    <div className="text-sm text-slate-700">
      <div className="font-medium">
        Latest: {latest.msp_no} -- {latest.transaction_type_name || "--"}{" "}
        <span className="ml-1 align-middle"><StatusPill status={latest.status} /></span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        {rows.length} recent {rows.length === 1 ? "transaction" : "transactions"} ·{" "}
        {latest.date_time ? formatToManila(latest.date_time) : "--"}
      </div>
    </div>
  );
});

export default Dashboard;