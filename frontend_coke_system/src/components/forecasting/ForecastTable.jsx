// src/components/forecasting/ForecastTable.jsx
import React from "react";

export const ForecastTable = ({ product, data, basis = "daily" }) => {
  const isMonthly = basis === "monthly";

  const handleExport = () => {
    const header = [isMonthly ? "Month" : "Date", "Forecast", "Lower", "Upper"];
    // Karen Changes: guard against undefined
    const rows = data.map((row) => [
      row.date,
      Math.round(Number(row.forecast || 0)),
      Math.round(Number(row.lower || 0)),
      Math.round(Number(row.upper || 0)),
    ]);


    const csv =
      [header, ...rows]
        .map((r) => r.map((v) => `"${v}"`).join(","))
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${product}_${basis}_forecast.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isMonthly ? "Monthly Forecast Details" : "Forecast Details"}
          </h2>
          <p className="text-xs text-gray-500">
            {isMonthly
              ? `Monthly predictions for ${product}`
              : `Daily predictions for ${product}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
        >
          ⬇️ Export CSV
        </button>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10">
              <tr>
                <th className="text-left font-medium px-4 py-3">
                  {isMonthly ? "Month" : "Date"}
                </th>
                <th className="text-right font-medium px-4 py-3">
                  Forecast
                </th>
                <th className="text-right font-medium px-4 py-3">Lower</th>
                <th className="text-right font-medium px-4 py-3">Upper</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.date}
                  className="border-t border-gray-100 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-3 text-gray-800">{row.date}</td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {Math.round(Number(row.forecast || 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {Math.round(Number(row.lower || 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {Math.round(Number(row.upper || 0))}
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
