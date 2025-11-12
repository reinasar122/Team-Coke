import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const ProductSearchSelect = ({
  products = [],
  value = "",  // The value is always the productId
  onChange,
  excludeIds = [],
  placeholder = "Search product…",
}) => {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || ""); // The query will always be a string (name)
  const [hover, setHover] = useState(-1);
  const [menuStyle, setMenuStyle] = useState({});

  const safeQuery = String(query || "").toLowerCase();  // Ensure it's always a string

  const filtered = useMemo(() => {
    const excludes = new Set(excludeIds);
    return products
      .filter((p) => !excludes.has(p.id))
      .filter((p) => (safeQuery ? p.product_name.toLowerCase().includes(safeQuery) : true))
      .slice(0, 100);
  }, [products, excludeIds, safeQuery]);

  const commit = useCallback(
    (p) => {
      onChange(p.id);  // Pass selected product's ID to the parent
      setQuery(p.product_name); // Set the selected product name to the input field
      setOpen(false);
    },
    [onChange]
  );

  const updateMenuPosition = () => {
  const inputEl = inputRef.current;
  if (!inputEl) return;

  const rect = inputEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  const dropdownHeight = Math.min(200, filtered.length * 32 + 8); // estimate height
  const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

  const top = shouldOpenUpward
    ? rect.top - dropdownHeight - 4 // open upward
    : rect.bottom + 4;              // open downward

  const left = rect.left;
  const width = rect.width;

  setMenuStyle({
    position: "fixed",
    top: Math.max(8, Math.round(top)),
    left: Math.round(left),
    width: Math.round(width),
    maxHeight: 240,
    overflowY: "auto",
    zIndex: 9999,
  });
};


  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handleScrollResize = () => updateMenuPosition();
    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (e) => {
      if (!inputRef.current || inputRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={query} // Display the product name (query is product name)
        onChange={(e) => {
          setQuery(e.target.value || ""); // Set the query (product name)
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHover(Math.min(filtered.length - 1, hover + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHover(Math.max(0, hover - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (hover >= 0 && filtered[hover]) commit(filtered[hover]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="form-input w-full"
      />

      {open && filtered.length > 0 &&
        createPortal(
          <ul
            style={menuStyle}
            className="mt-1 overflow-auto rounded border bg-white shadow-lg"
            role="listbox"
          >
            {filtered.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === hover}
                className={`px-2 py-1 text-sm cursor-pointer ${i === hover ? "bg-blue-50" : "hover:bg-slate-100"}`}
                onMouseEnter={() => setHover(i)}
                onMouseDown={(e) => { e.preventDefault(); commit(p); }}
              >
                {p.product_name} {/* Display the product name */}
              </li>
            ))}
          </ul>,
          document.body // Render dropdown to body (not inside the table)
        )}
    </>
  );
};

export default ProductSearchSelect;