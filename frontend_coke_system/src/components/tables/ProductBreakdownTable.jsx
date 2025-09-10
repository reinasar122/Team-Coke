// src/components/tables/ProductBreakdownTable.jsx
import Empty from "../common/Empty";
import { n, peso, pct } from "../../utils/formatters";

export default function ProductBreakdownTable({
  loading = false,
  rows = [],
  query = "",
  sortKey = "revenue",
  onQuery,
  onSort,
  onExportCSV,
}) {
  const headers = [
    { key: "product", label: "Product" },
    { key: "qty", label: "Qty Sold" },
    { key: "revenue", label: "Revenue" },
    { key: "profit", label: "Profit" },
    { key: "discount_rate", label: "Discount %" },
    { key: "return_rate", label: "Return Rate" },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <input
          className="border rounded-md px-3 py-2 text-sm w-52"
          placeholder="Search product…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={sortKey}
            onChange={(e) => onSort(e.target.value)}
          >
            <option value="revenue">Revenue</option>
            <option value="profit">Profit</option>
            <option value="qty">Qty</option>
            <option value="discount_rate">Discount %</option>
            <option value="return_rate">Return Rate</option>
          </select>
          <button onClick={onExportCSV} className="btn btn-primary !py-1 !px-2 text-xs">
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {headers.map((h) => (
                <th key={h.key} className="text-left font-semibold px-3 py-2 border-b">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8">
                  <Empty text="Loading…" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8">
                  <Empty />
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.product}-${i}`} className="odd:bg-white even:bg-slate-50/50">
                  <td className="px-3 py-2 border-b">{r.product}</td>
                  <td className="px-3 py-2 border-b">{n(r.qty)}</td>
                  <td className="px-3 py-2 border-b">{peso(r.revenue)}</td>
                  <td className="px-3 py-2 border-b">{peso(r.profit)}</td>
                  <td className="px-3 py-2 border-b">{pct(r.discount_rate)}</td>
                  <td className="px-3 py-2 border-b">{pct(r.return_rate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
