// src/components/forecasting/ProductSelector.jsx

import React, { useState } from "react";

export const ProductSelector = ({
  products,
  selectedProduct,
  onChange,
  onGenerate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasProducts = Array.isArray(products) && products.length > 0;

  const handleSelect = (name) => {
    onChange(name);
    setIsOpen(false);
    // Auto-generate forecast when product is selected
    if (onGenerate) {
      onGenerate(30);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
      {/* Product dropdown selector */}
      <div className="relative flex-1">
        <button
          type="button"
          disabled={!hasProducts}
          onClick={() => hasProducts && setIsOpen(!isOpen)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-red-500 bg-gray-50 text-left flex items-center justify-between hover:border-gray-300 transition-colors disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:border-gray-200"
        >
          <span className={hasProducts ? "text-gray-900" : "text-gray-400"}>
            {selectedProduct || (hasProducts ? "Select Product" : "No products available")}
          </span>
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 10l5 5 5-5H7z"
            />
          </svg>
        </button>

        {isOpen && hasProducts && (
          <div className="absolute mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-sm z-20">
            {products.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelect(p)}
                className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors ${
                  selectedProduct === p ? "bg-red-50 text-red-600 font-medium" : ""
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Close dropdown when clicking outside */}
        {isOpen && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
