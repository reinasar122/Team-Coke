// src/components/common/Metric.jsx
export default function Metric({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
