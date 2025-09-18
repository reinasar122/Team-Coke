// src/components/common/Empty.jsx
export default function Empty({ text = "No data for the selected filters.", action }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
      <div>
        <div>{text}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
