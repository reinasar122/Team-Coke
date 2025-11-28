// src/components/forecasting/ForecastOverviewCards.jsx
import React from "react";

export const ForecastOverviewCards = ({
  totalPredictedSales,
  topSellingProduct,
  highestGrowthProduct,
}) => {
  const formatNumber = (n) =>
    n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <div className="grid lg:grid-cols-3 gap-4 mt-2">
      {/* Total Predicted Sales */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">
            Total Predicted Sales (Next 30 Days)
          </p>
          <p className="mt-3 text-3xl font-semibold text-red-500">
            {formatNumber(totalPredictedSales)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Units across all products
          </p>
        </div>
      </div>

      {/* Top Selling Product */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">
            Top Selling Product
          </p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">
            {topSellingProduct}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Highest forecasted volume
          </p>
        </div>
      </div>

      {/* Highest Growth Trend */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">
            Highest Growth Trend
          </p>
          <p className="mt-3 text-3xl font-semibold text-emerald-600">
            {highestGrowthProduct}
          </p>
          <p className="mt-1 text-xs text-gray-500">Rising demand pattern</p>
        </div>
      </div>
    </div>
  );
};