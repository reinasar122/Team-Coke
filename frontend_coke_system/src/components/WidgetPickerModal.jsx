import React, { useEffect, useState } from "react";

/** Exported so Dashboard can reuse these */
export const SECTIONS = [
  {
    id: "transactions",
    label: "Transactions",
    items: [
      { id: "receiving", name: "Receiving", route: "/receiving" },
      { id: "trading", name: "Trading", route: "/trading" },
      { id: "supplier-returns", name: "Supplier Return", route: "/supplier-returns" },
      { id: "invoice", name: "Invoice", route: "/invoice" },
      { id: "credit", name: "Credit", route: "/credit" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      { id: "stocks", name: "Stocks", route: "/stocks" },
      { id: "products", name: "Product", route: "/products" },
      { id: "return-empties", name: "Return Empties", route: "/return-empties" },
    ],
  },
  {
    id: "report",
    label: "Report",
    items: [
      { id: "salesreport", name: "Sales Report", route: "/salesreport" },
      { id: "inventoryreport", name: "Inventory Report", route: "/inventoryreport" },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [
      { id: "users", name: "Users", route: "/users" },
      { id: "roles", name: "Roles", route: "/roles" },
      { id: "warehouses", name: "Warehouses", route: "/warehouses" },
      { id: "suppliers", name: "Suppliers", route: "/suppliers" },
      { id: "vans", name: "Van", route: "/vans" },
    ],
  },
  { id: "settings", label: "Settings", items: [{ id: "settings", name: "Settings", route: "/settings" }] },
];

export const CATALOG_MAP = (() => {
  const m = new Map();
  SECTIONS.forEach((sec) => sec.items.forEach((it) => m.set(it.id, it)));
  return m;
})();

export function WidgetPickerModal({ open, selectedIds, onClose, onSave }) {
  const [expanded, setExpanded] = useState(() => new Set(SECTIONS.map((s) => s.id)));
  const [checked, setChecked] = useState(() => new Set(selectedIds));

  useEffect(() => setChecked(new Set(selectedIds)), [selectedIds, open]);

  const toggleSection = (sid) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  };

  const toggleItem = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const all = [];
    SECTIONS.forEach((sec) => sec.items.forEach((it) => all.push(it.id)));
    setChecked(new Set(all));
  };

  const clearAll = () => setChecked(new Set());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Dashboard Widgets"
        className="absolute inset-x-0 top-10 mx-auto w-[95%] max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-slate-900">Add Dashboard Widgets</h3>
          <div className="flex gap-2">
            <button onClick={selectAllVisible} className="px-2.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-500">
              Select All
            </button>
            <button onClick={clearAll} className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-800 hover:bg-slate-200">
              Clear
            </button>
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100" aria-label="Close" title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 py-3 max-h-[65vh] overflow-y-auto custom-scroll">
          {SECTIONS.map((sec) => (
            <div key={sec.id} className="mb-3 border rounded-xl">
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-t-xl"
              >
                <span className="font-medium text-xs text-slate-800">{sec.label}</span>
                <span className="text-[11px] text-slate-500">{expanded.has(sec.id) ? "▾" : "▸"}</span>
              </button>

              {expanded.has(sec.id) && (
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sec.items.map((it) => (
                    <label
                      key={it.id}
                      className={[
                        "border rounded-lg p-2 text-xs",
                        "hover:border-brand-400 cursor-pointer transition-colors",
                        "bg-white has-[:checked]:border-brand-600",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-brand-600"
                          checked={checked.has(it.id)}
                          onChange={() => toggleItem(it.id)}
                        />
                        <div>
                          <div className="font-medium text-slate-900">{it.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Preview</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-800 hover:bg-slate-200">
            Cancel
          </button>
          <button
            onClick={() => onSave(Array.from(checked))}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs shadow-sm hover:shadow"
          >
            Add Selected
          </button>
        </div>
      </div>
    </div>
  );
}

export default WidgetPickerModal;