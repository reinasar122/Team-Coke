import React, { useEffect, useMemo, useRef, useState } from "react";

/** Exported so Dashboard can reuse these (unchanged) */
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

/* -------------------- Icons -------------------- */
const IconSearch = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.57-4.23C15.99 6.01 13.48 3.5 10.5 3.5S5.01 6.01 5.01 9 7.52 14.5 10.5 14.5c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.25 4.25c.41.41 1.09.41 1.5 0 .41-.41.41-1.09 0-1.5L15.5 14Zm-5 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14Z"/>
  </svg>
);
const IconCheck = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
  </svg>
);
const IconClose = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M18.3 5.71 12 12.01l6.3 6.29-1.41 1.41L10.59 13.4l-6.3 6.3L2.89 18.3l6.3-6.3-6.3-6.29L4.3 4.3l6.29 6.3 6.29-6.3z"/>
  </svg>
);
const IconChevron = ({ open }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="text-slate-500">
    <path fill="currentColor" d={open ? "M7 14l5-5 5 5z" : "M7 10l5 5 5-5z"} />
  </svg>
);
const IconSparkle = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M12 2l1.7 4.5L18 8.2l-4.3 1.7L12 14 10.3 9.9 6 8.2l4.3-1.7L12 2zm7 10 1 2.5 2.5 1L20 17l-1 2.5L18 17l-2.5-1L17 14l1-2.5 1 2.5zM3 13l.8 2 2 .8-2 .8L3 19l-.8-2-.8-.8.8-.8.8-2z"/>
  </svg>
);

/* -------------------- Component -------------------- */
export function WidgetPickerModal({ open, selectedIds, onClose, onSave }) {
  const [expanded, setExpanded] = useState(() => new Set(SECTIONS.map((s) => s.id)));
  const [checked, setChecked] = useState(() => new Set(selectedIds));
  const [q, setQ] = useState("");
  const searchRef = useRef(null);

  useEffect(() => setChecked(new Set(selectedIds)), [selectedIds, open]);

  // Keyboard shortcuts: Esc, Ctrl/Cmd+F, Ctrl/Cmd+A, Ctrl/Cmd+Shift+A
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      } else if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (meta && e.key.toLowerCase() === "a" && !e.shiftKey) {
        e.preventDefault();
        selectAllVisible();
      } else if (meta && e.key.toLowerCase() === "a" && e.shiftKey) {
        e.preventDefault();
        clearAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, q, checked]);

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

  const filterMatch = (text) =>
    (text || "").toLowerCase().includes(q.trim().toLowerCase());

  const visibleBySection = useMemo(() => {
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => filterMatch(it.name + " " + it.id)),
    })).filter((s) => s.items.length > 0);
  }, [q]);

  const flatVisibleItems = useMemo(
    () => visibleBySection.flatMap((s) => s.items),
    [visibleBySection]
  );

  const total = useMemo(() => {
    const visibleCount = flatVisibleItems.length || SECTIONS.flatMap((s) => s.items).length;
    const selectedCount = flatVisibleItems.length
      ? flatVisibleItems.filter((it) => checked.has(it.id)).length
      : Array.from(checked).length;
    return { visibleCount, selectedCount };
  }, [flatVisibleItems, checked]);

  const selectAllVisible = () => {
    const all = flatVisibleItems.length
      ? flatVisibleItems.map((it) => it.id)
      : SECTIONS.flatMap((s) => s.items.map((it) => it.id));
    setChecked((prev) => new Set([...prev, ...all]));
  };

  const clearAll = () => setChecked(new Set());

  const toggleSectionAll = (sec) => {
    const visibleIds = sec.items.map((i) => i.id);
    const visibleCount = visibleIds.length;
    const selectedCount = visibleIds.filter((id) => checked.has(id)).length;
    const isAllSelected = visibleCount > 0 && selectedCount === visibleCount;
    setChecked((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(SECTIONS.map((s) => s.id)));
  const collapseAll = () => setExpanded(new Set());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Dashboard Widgets"
        className="absolute inset-x-0 top-8 mx-auto w-[95%] max-w-6xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/10"
      >
        {/* Fancy header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 opacity-90" />
          <div className="relative px-5 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/10 grid place-items-center ring-1 ring-white/20">
                <IconSparkle />
              </div>
              <div>
                <h3 className="text-base font-semibold leading-tight">Add Dashboard Widgets</h3>
                <p className="text-xs/5 text-white/80">
                  Selected {total.selectedCount} of {total.visibleCount}
                  {q ? " (filtered)" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <label className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/70" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search widgets… "
                  className="pl-8 pr-3 h-9 rounded-xl bg-white/10 text-white placeholder:text-white/70 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
                />
              </label>

              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="px-2.5 h-9 rounded-xl bg-white/10 text-white text-xs hover:bg-white/15 border border-white/20"
                  title="Expand all sections"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2.5 h-9 rounded-xl bg-white/10 text-white text-xs hover:bg-white/15 border border-white/20"
                  title="Collapse all sections"
                >
                  Collapse All
                </button>
              </div>

              <button
                onClick={selectAllVisible}
                className="px-2.5 h-9 rounded-xl bg-white text-brand-700 text-xs hover:shadow-sm text-black"
                title="Select all (filtered)"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="px-2.5 h-9 rounded-xl bg-white/10 text-white text-xs hover:bg-white/15 border border-white/20"
                title="Clear selection "
              >
                Clear
              </button>
              <button
                onClick={onClose}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-white/90 hover:bg-white/10 border border-white/20"
                aria-label="Close"
                title="Close (Esc)"
              >
                <IconClose />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full bg-white/20">
            <div
              className="h-full bg-white transition-[width] duration-300"
              style={{
                width: `${
                  total.visibleCount
                    ? Math.round((total.selectedCount / total.visibleCount) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Selection toolbar (appears only when selected) */}
        {checked.size > 0 && (
          <div className="bg-emerald-50/80 border-b border-emerald-200 px-5 py-2 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-200">
                {checked.size} selected
              </span>

            </div>
            <button
              onClick={clearAll}
              className="text-emerald-900 hover:underline"
              title="Clear all selected"
            >
              Clear
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-5 max-h-[68vh] overflow-y-auto bg-white custom-scroll">
          {visibleBySection.map((sec) => {
            const visibleCount = sec.items.length;
            const selectedCount = sec.items.filter((it) => checked.has(it.id)).length;
            const allSelected = visibleCount > 0 && selectedCount === visibleCount;
            const isOpen = expanded.has(sec.id);

            return (
              <div
                key={sec.id}
                className="mb-4 rounded-2xl border border-slate-200 overflow-hidden shadow-[0_1px_0_#eaeef2]"
              >
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70">
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <IconChevron open={isOpen} />
                    <div className="text-sm font-semibold text-slate-800">{sec.label}</div>
                    <div className="text-[11px] text-slate-500">
                      {selectedCount}/{visibleCount} selected
                    </div>
                    <div className="hidden md:flex gap-1 ml-2">
                      <span className="px-1.5 py-0.5 rounded bg-white text-[10px] border border-slate-200 text-slate-600">
                        {sec.items.length} items
                      </span>
                      {q && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-[10px] border border-slate-200 text-slate-600">
                          filtered
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => toggleSectionAll(sec)}
                    className={[
                      "px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors",
                      allSelected
                        ? "bg-brand-50 text-brand-700 border-brand-200"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100",
                    ].join(" ")}
                    title={allSelected ? "Unselect all in this section" : "Select all in this section"}
                  >
                    {allSelected ? "Unselect All" : "Select All"}
                  </button>
                </div>

                {/* Section content */}
                {isOpen && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sec.items.map((it) => {
                      const isChecked = checked.has(it.id);
                      return (
                        <label
                          key={it.id}
                          className={[
                            "group relative border rounded-xl p-3 text-xs cursor-pointer transition-all select-none",
                            "bg-white hover:shadow-md hover:-translate-y-[2px] focus-within:ring-2 focus-within:ring-brand-500/40",
                            isChecked
                              ? "border-brand-500 ring-1 ring-brand-500/30"
                              : "border-slate-200",
                          ].join(" ")}
                        >
                          {/* Selected badge */}
                          {isChecked && (
                            <span className="absolute right-2 top-2 inline-flex items-center gap-1 text-[10px] font-medium text-brand-800 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-md">
                              <IconCheck /> Selected
                            </span>
                          )}

                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-brand-600"
                              checked={isChecked}
                              onChange={() => toggleItem(it.id)}
                              aria-label={`Toggle ${it.name}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 grid place-items-center">
                                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="text-slate-500">
                                    <path fill="currentColor" d="M3 5h8v6H3V5Zm0 8h8v6H3v-6Zm10-8h8v10h-8V5Zm0 12h8v2h-8v-2Z"/>
                                  </svg>
                                </div>
                                <div className="font-medium text-slate-900 truncate">{it.name}</div>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Route: <span className="font-mono text-slate-700">{it.route}</span>
                              </div>

                              {/* Chips */}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-700 border border-slate-200">Widget</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-700 border border-slate-200">Dashboard</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-700 border border-slate-200">Preview</span>
                              </div>
                            </div>
                          </div>

                          {/* Hover gradient glow */}
                          <div
                            className={[
                              "pointer-events-none absolute inset-0 -z-10 rounded-xl transition-opacity",
                              "bg-gradient-to-br from-brand-500/0 via-brand-500/0 to-brand-500/0",
                              "group-hover:from-brand-500/[0.05] group-hover:via-brand-500/[0.02] group-hover:to-brand-500/[0.08]",
                            ].join(" ")}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {visibleBySection.length === 0 && (
            <div className="py-20 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
                <IconSearch className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No widgets match your search.</p>
              <p className="text-xs text-slate-500 mt-1">
                Try keywords like <span className="font-mono">sales</span>, <span className="font-mono">stocks</span>, or <span className="font-mono">users</span>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t px-5 py-4 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {Array.from(checked).length} selected total
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-800 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(Array.from(checked))}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-black text-xs shadow-sm hover:shadow"
            >
              <IconCheck />
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WidgetPickerModal;
