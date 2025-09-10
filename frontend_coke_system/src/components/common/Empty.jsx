// src/components/common/Empty.jsx
export default function Empty({ text = "No data for the selected filters." }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
      {text}
    </div>
  );
}
