// src/components/forecasting/ProductSelector.jsx

import React from "react";

export const ProductSelector = ({
  products,
  selectedProduct,
  onChange,
  isGenerating = false,
}) => {
  const options = products || [];
  const hasProducts = options.length > 0 && options[0] !== "No products";

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
      <div className="relative flex-1">
        <select
          value={selectedProduct || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={!hasProducts || isGenerating}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-red-500 bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        >
          {!hasProducts ? (
            <option value="">No products</option>
          ) : (
            options.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
};