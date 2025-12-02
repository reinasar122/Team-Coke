// src/components/forecasting/InventoryRecommendations.jsx
import React from "react";

export const InventoryRecommendations = ({ data }) => {
  const format = (n) => Number(n || 0).toLocaleString();

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Recommended Inventory Levels
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Auto-calculated restocking recommendations based on forecast
      </p>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="max-h-96 overflow-y-auto"> {/* Make the table scrollable */}
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-3">Product</th>
                <th className="text-right font-medium px-4 py-3">
                  Forecasted 30-Day Sales
                </th>
                <th className="text-right font-medium px-4 py-3">
                  Current Stock
                </th>
                <th className="text-right font-medium px-4 py-3">
                  Recommended Restock
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.product}
                  className="border-t border-gray-100 hover:bg-gray-50/70"
                >
                  <td className="px-4 py-3 text-gray-800">{row.product}</td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {format(row.forecast30Day)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {format(row.currentStock)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.restock > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-3 py-1 text-[11px] font-medium border border-red-100">
                        ⛔ +{format(row.restock)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 text-[11px] font-medium border border-emerald-100">
                        ✅ No restock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};