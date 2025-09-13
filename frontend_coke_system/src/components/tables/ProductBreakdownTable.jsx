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
  error = "",
}) {
  const headers = [
    { key: "product", label: "Product" },
    { key: "qty", label: "Qty Sold" },
    { key: "revenue", label: "Revenue" },
    { key: "profit", label: "Profit" },
    { key: "discount_rate", label: "Discount %" },
    { key: "return_rate", label: "Return Rate" },
  ];

  const isNumeric = (k) =>
    ["qty", "revenue", "profit", "discount_rate", "return_rate"].includes(k);

  // Totals
  const totals = {
    qty: rows.reduce((sum, r) => sum + (r.qty || 0), 0),
    revenue: rows.reduce((sum, r) => sum + (r.revenue || 0), 0),
    profit: rows.reduce((sum, r) => sum + (r.profit || 0), 0),
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <input
          className="border rounded-md px-3 py-2 text-sm w-52"
          placeholder="Search product…"
          value={query}
          onChange={(e) => onQuery?.(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={sortKey}
            onChange={(e) => onSort?.(e.target.value)}
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

      {/* Scrollable table container with sticky header */}
      <div className="overflow-auto rounded-lg border border-slate-200 max-h-[520px]">
        <table className="w-full text-sm table-fixed">
          {/* Product flexes; numeric columns have fixed px widths */}
          <colgroup>
            <col />                     {/* Product (flex) */}
            <col style={{ width: 88 }} />   {/* Qty */}
            <col style={{ width: 132 }} />  {/* Revenue */}
            <col style={{ width: 120 }} />  {/* Profit */}
            <col style={{ width: 110 }} />  {/* Discount % */}
            <col style={{ width: 120 }} />  {/* Return Rate */}
          </colgroup>

          <thead className="bg-slate-50 text-slate-600 sticky top-0 z-20 shadow-sm">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`px-3 py-2 border-b font-semibold whitespace-nowrap align-middle ${
                    isNumeric(h.key) ? "text-right" : "text-left"
                  }`}
                >
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
                  <Empty text={error || "No data for the selected filters."} />
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={`${r.product}-${i}`}
                  className="odd:bg-white even:bg-slate-50/50 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 border-b text-left whitespace-nowrap overflow-hidden text-ellipsis align-middle">
                    {r.product}
                  </td>
                  <td className="px-3 py-2 border-b text-right tabular-nums whitespace-nowrap align-middle">
                    {n(r.qty)}
                  </td>
                  <td className="px-3 py-2 border-b text-right tabular-nums whitespace-nowrap align-middle">
                    {peso(r.revenue)}
                  </td>
                  <td
                    className={`px-3 py-2 border-b text-right tabular-nums whitespace-nowrap align-middle ${
                      (r.profit || 0) < 0 ? "text-rose-600" : ""
                    }`}
                  >
                    {peso(r.profit)}
                  </td>
                  <td className="px-3 py-2 border-b text-right tabular-nums whitespace-nowrap align-middle">
                    {pct(r.discount_rate)}
                  </td>
                  <td className="px-3 py-2 border-b text-right tabular-nums whitespace-nowrap align-middle">
                    {pct(r.return_rate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Totals Row */}
          {!loading && rows.length > 0 && (
            <tfoot className="bg-slate-100 font-semibold">
              <tr>
                <td className="px-3 py-2 border-t text-left align-middle">Total</td>
                <td className="px-3 py-2 border-t text-right tabular-nums align-middle">
                  {n(totals.qty)}
                </td>
                <td className="px-3 py-2 border-t text-right tabular-nums align-middle">
                  {peso(totals.revenue)}
                </td>
                <td className="px-3 py-2 border-t text-right tabular-nums align-middle">
                  {peso(totals.profit)}
                </td>
                <td className="px-3 py-2 border-t text-right align-middle">—</td>
                <td className="px-3 py-2 border-t text-right align-middle">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}