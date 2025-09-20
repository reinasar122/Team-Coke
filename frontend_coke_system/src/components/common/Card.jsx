// src/components/common/Card.jsx
export default function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className} min-h-[200px]`}>
      {title ? (
        <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-600">
          {title}
        </div>
      ) : null}
      <div className="p-4 flex-grow">{children}</div>
    </div>
  );
}
