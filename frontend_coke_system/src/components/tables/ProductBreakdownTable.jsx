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
  totalCount = 0,
  isPreview = false,
  onOpenFull,
  variant = "card", // "card" | "modal"
}) {
  const headers = [
    { key: "product", label: "Product" },
    { key: "qty", label: "Dispatched Units" },
    { key: "revenue", label: "Net Revenue" },
    { key: "profit", label: "Product Profit" },
    { key: "cogs", label: "Cost of Sales" },
    { key: "discount_amount", label: "Discount ₱" },
  ];

  const isNumeric = (k) =>
    ["qty", "revenue", "profit", "cogs", "discount_amount"].includes(k);

  const isCentered = (k) => ["margin"].includes(k);

  const containerClass =
  variant === "modal"
    ? "h-full overflow-y-auto rounded-lg border border-slate-200 shadow-sm"
    : "max-h-[400px] overflow-y-auto rounded-lg border border-slate-200 shadow-sm";

  const theadClass =
    "bg-slate-50 border-b text-slate-600 " +
    (variant === "modal" ? "sticky top-0 z-10" : "");


  return (
    <div id="product-breakdown-section">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        {/* LEFT: Search + Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="border rounded-md px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-400"
            placeholder="Search product…"
            value={query}
            onChange={(e) => onQuery?.(e.target.value)}
          />
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Sort by:</span>
            <select
              className="border rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400"
              value={sortKey}
              onChange={(e) => onSort?.(e.target.value)}
            >
              <option value="revenue">Net Revenue</option>
              <option value="profit">Product Profit</option>
              <option value="qty">Qty</option>
            </select>
          </div>
        </div>

        {/* RIGHT: Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isPreview && totalCount > rows.length && (
            <button
              onClick={onOpenFull}
              className="border border-slate-300 text-slate-700 rounded-md px-3 py-1 text-xs hover:bg-slate-50 transition"
            >
              View full breakdown ({totalCount})
            </button>
          )}

          <button
            onClick={onExportCSV}
            className="bg-blue-600 text-white rounded-md px-3 py-1 text-xs hover:bg-blue-700 transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      {isPreview && totalCount > rows.length && (
        <p className="mb-2 text-xs text-slate-500">
          Showing top <span className="font-semibold">{rows.length}</span> of{" "}
          <span className="font-semibold">{totalCount}</span> products based on{" "}
          {sortKey === "profit"
            ? "Product Profit"
            : sortKey === "qty"
            ? "Qty Sold"
            : "Net Revenue"}
          .
        </p>
      )}
    

      {/* Table */}
      <div className={containerClass}>
        <table className="min-w-full text-sm border-collapse">
          <colgroup>
            <col className="w-[18%]" /> {/* Product */}
            <col className="w-[10%]" /> {/* Dispatched Units */}
            <col className="w-[16%]" /> {/* Net Revenue */}
            <col className="w-[16%]" /> {/* Product Profit */}
            <col className="w-[15%]" /> {/* COGS */}
            <col className="w-[15%]" /> {/* Discount ₱ */}
          </colgroup>

          <thead className={theadClass}>
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`px-4 py-2.5 text-sm font-semibold tracking-wide ${
                    isNumeric(h.key)
                      ? "text-right"
                      : isCentered(h.key)
                      ? "text-center"
                      : "text-left"
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
              rows.map((r, i) => {
                const revenue = r.revenue || 0;
                const profit = r.profit || 0;

                // Margin % = profit / revenue
                // const marginRatio = revenue > 0 ? profit / revenue : 0;

                // COGS ≈ revenue - profit
                const cogs = revenue - profit;

                // Discount amount (₱)
                let discountAmount =
                  typeof r.discount_amount === "number" ? r.discount_amount : 0;

                const discountRateRatio = (r.discount_rate ?? 0) / 100;

                // If backend didn't send discount_amount, estimate it
                if (!discountAmount && revenue > 0 && discountRateRatio > 0 && discountRateRatio < 1) {
                  const gross = revenue / (1 - discountRateRatio);
                  discountAmount = gross - revenue;
                }

                return (
                  <tr
                    key={`${r.product}-${i}`}
                    className={`transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    } hover:bg-slate-100`}
                  >
                    <td className="px-4 py-2 text-left font-medium text-slate-700 whitespace-nowrap">
                      {r.product}
                    </td>

                    <td className="px-4 py-2 text-right tabular-nums">
                      {n(r.qty)}
                    </td>

                    <td className="px-4 py-2 text-right tabular-nums">
                      {peso(revenue)}
                    </td>

                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        profit < 0 ? "text-rose-600" : ""
                      }`}
                    >
                      {peso(profit)}
                    </td>

                    {/*
                    <td className="px-4 py-2 text-center tabular-nums">
                      {pct(marginRatio)}
                    </td> */}

                    {/* COGS */}
                    <td className="px-4 py-2 text-right tabular-nums">
                      {peso(cogs)}
                    </td>

                    {/* Discount ₱ */}
                    <td className="px-4 py-2 text-right tabular-nums">
                      {peso(discountAmount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



/*export NODE_OPTIONS=--no-experimental-webstorage*/