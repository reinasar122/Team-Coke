// src/components/forecasting/ProductSelector.jsx
import React from "react";

export const ProductSelector = ({
  products,
  selectedProduct,
  onChange,
  onGenerate,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
      <select
        value={selectedProduct}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:border-red-500 bg-gray-50"
      >
        {products.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onGenerate}
        className="inline-flex items-center justify-center rounded-xl bg-red-500 text-white px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-red-600 transition"
      >
        ✨ Generate Forecast
      </button>
    </div>
  );
};