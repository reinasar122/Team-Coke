import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 * - products: [{ id, product_name, ... }]
 * - value: selected productId (number|string)
 * - onChange: (id:number) => void
 * - excludeIds?: Set<number> | number[]   // hide from suggestions (e.g., already picked)
 * - placeholder?: string
 * - disabled?: boolean
 * - maxItems?: number
 */
export default function ProductSearchSelect({
  products = [],
  value,
  onChange,
  excludeIds,
  placeholder = "Search product…",
  disabled = false,
  maxItems = 8,
}) {
  const excluded = useMemo(() => {
    if (!excludeIds) return new Set();
    return excludeIds instanceof Set ? excludeIds : new Set(excludeIds.map(Number));
  }, [excludeIds]);

  const selected = useMemo(
    () => products.find(p => Number(p.id) === Number(value)) || null,
    [products, value]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.product_name || "");
  const [hover, setHover] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (selected && query !== selected.product_name) setQuery(selected.product_name);
    if (!selected && !open) setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const list = products.filter(p => !excluded.has(Number(p.id)));
    if (!q) return list.slice(0, maxItems);

    const starts = [];
    const contains = [];
    for (const p of list) {
      const name = (p.product_name || "").toLowerCase();
      if (name.startsWith(q)) starts.push(p);
      else if (name.includes(q)) contains.push(p);
    }
    return [...starts, ...contains].slice(0, maxItems);
  }, [products, query, excluded, maxItems]);

  const commit = (prod) => {
    if (!prod) return;
    setQuery(prod.product_name || "");
    setOpen(false);
    setHover(0);
    onChange?.(Number(prod.id));
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHover(h => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHover(h => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); commit(filtered[hover]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        className="w-full p-1 text-sm text-center rounded bg-white border"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border bg-white shadow">
          {filtered.map((p, i) => (
            <li
              key={p.id}
              className={`px-2 py-1 text-sm cursor-pointer ${i===hover ? "bg-blue-50" : "hover:bg-slate-100"}`}
              onMouseEnter={() => setHover(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(p); }}
            >
              {p.product_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
