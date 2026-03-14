// src/components/forecasting/ProductSelector.jsx
// Karen Changes: make selector searchable

import React, { useState, useEffect } from "react";

export const ProductSelector = ({
  products,
  selectedProduct,
  onChange,
  onGenerate,
}) => {
  // Karen Changes: local state for search text and dropdown open state
  const [searchTerm, setSearchTerm] = useState(selectedProduct || "");
  const [isOpen, setIsOpen] = useState(false);

  // Karen Changes: keep input in sync when parent changes selected product
  useEffect(() => {
    setSearchTerm(selectedProduct || "");
  }, [selectedProduct]);

  // Karen Changes: filter products by search term
  const filteredProducts = (products || []).filter((p) =>
    String(p).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (name) => {
    setSearchTerm(name);
    onChange(name);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        handleSelect(filteredProducts[0]);
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
      {/* Karen Changes: searchable combo instead of <select> */}
      <div className="relative flex-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-red-500 bg-gray-50"
          placeholder="Search product..."
        />

        {isOpen && (
          <div className="absolute mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-sm z-20">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // Karen Changes: prevent input blur before click
                  onClick={() => handleSelect(p)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                >
                  {p}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-400">
                No products found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};