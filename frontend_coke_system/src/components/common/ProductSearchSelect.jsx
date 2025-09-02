import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const ProductSearchSelect = ({
  products = [],
  value,
  onChange,
  excludeIds = [],
  placeholder = "Search product…",
}) => {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || ""); // Ensure query is always a string
  const [hover, setHover] = useState(-1);
  const [menuStyle, setMenuStyle] = useState({});

  // Filter the products based on the query value
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();  // Make sure query is treated as a string
    const excludes = new Set(excludeIds);
    return products
      .filter((p) => !excludes.has(p.id))
      .filter((p) => (q ? p.product_name.toLowerCase().includes(q) : true))
      .slice(0, 100);
  }, [products, query, excludeIds]);

  const commit = useCallback(
    (p) => {
      onChange(p.id);
      setQuery(p.product_name); // Update the query state to the selected product name
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

    const isAbove = spaceBelow < 160 && spaceAbove > spaceBelow;

    const top = isAbove ? Math.max(8, rect.top - 200) : rect.bottom + 4;
    const left = Math.max(8, rect.left);
    const width = Math.max(200, rect.width);
    const maxHeight = Math.min(240, spaceBelow - 16);

    setMenuStyle({
      position: "fixed",
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(width),
      maxHeight: Math.round(maxHeight),
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
        value={query} // Always bind query (which is a string) to the input field
        onChange={(e) => {
          setQuery(e.target.value); // Update query on user input
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
                {p.product_name}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
};

export default ProductSearchSelect;
