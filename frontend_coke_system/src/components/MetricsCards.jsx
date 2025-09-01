// src/components/MetricsCards.jsx
import React from "react";

/* simple currency helper */
const peso = (x) =>
  `₱${Number(x || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

/* tiny inline icons, no external deps */
const Icon = {
  Dollar: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" className="text-white" {...p}>
      <path d="M12 1v22M17 5c0-1.657-2.239-3-5-3S7 3.343 7 5s2.239 3 5 3 5 1.343 5 3-2.239 3-5 3-5 1.343-5 3 2.239 3 5 3 5-1.343 5-3"
        fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Box: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" className="text-white" {...p}>
      <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Rotate: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" className="text-white" {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.708V2M6 2H2v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Card: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" className="text-white" {...p}>
      <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 9h20M6 14h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Trend: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" className="text-white" {...p}>
      <path d="M3 17l6-6 4 4 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

function MetricCard({ title, value, gradient, bgGradient, IconComp }) {
  return (
    <div
      className={`bg-gradient-to-br ${bgGradient} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">{title}</div>
        <div className={`p-2 rounded-lg bg-gradient-to-r ${gradient}`}>
          <IconComp />
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

/**
 * Props:
 *  data = {
 *    totalRevenue: number,
 *    productsSold: number,
 *    supplierReturnables: number,
 *    miscCharges: number,
 *    actualProfit: number,
 *  }
 */
export default function MetricsCards({ data = {} }) {
  const metrics = [
    {
      title: "Total Revenue",
      value: peso(data.totalRevenue),
      IconComp: Icon.Dollar,
      gradient: "from-green-500 to-emerald-600",
      bgGradient: "from-green-50 to-emerald-50",
    },
    {
      title: "Products Sold",
      value: Number(data.productsSold || 0).toLocaleString(),
      IconComp: Icon.Box,
      gradient: "from-blue-500 to-cyan-600",
      bgGradient: "from-blue-50 to-cyan-50",
    },
    {
      title: "Supplier Returnables",
      value: Number(data.supplierReturnables || 0).toLocaleString(),
      IconComp: Icon.Rotate,
      gradient: "from-orange-500 to-red-600",
      bgGradient: "from-orange-50 to-red-50",
    },
    {
      title: "Misc. Charges",
      value: peso(data.miscCharges),
      IconComp: Icon.Card,
      gradient: "from-purple-500 to-pink-600",
      bgGradient: "from-purple-50 to-pink-50",
    },
    {
      title: "Actual Profit",
      value: peso(data.actualProfit),
      IconComp: Icon.Trend,
      gradient: "from-indigo-500 to-blue-600",
      bgGradient: "from-indigo-50 to-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {metrics.map((m) => (
        <MetricCard
          key={m.title}
          title={m.title}
          value={m.value}
          gradient={m.gradient}
          bgGradient={m.bgGradient}
          IconComp={m.IconComp}
        />
      ))}
    </div>
  );
}