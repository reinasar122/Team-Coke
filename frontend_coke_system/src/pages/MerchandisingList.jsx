import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const formatToManila = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

const StatusPill = ({ status }) => {
  const st = (status || "").toLowerCase();
  const base = "px-2 py-1 rounded text-xs font-semibold";
  if (st === "pending")
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st === "complete" || st === "completed")
    return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "—"}</span>;
};



const MerchandisingList = () => {
  const [sales, setSales] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const asYmd = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");


  // Load current warehouse (admin can switch)
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    if ((user.role || "").toLowerCase() === "admin") {
      setCurrentWarehouse(selectedWarehouse || { id: user.warehouse_id, name: user.warehouse });
    } else {
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }

    const handleWarehouseChange = (event) => {
      const { warehouse } = event.detail || {};
      if (warehouse) {
        setCurrentWarehouse(warehouse);
      } else {
        setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
      }
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, []);

  // Fetch list for current warehouse
  useEffect(() => {
    if (!currentWarehouse?.id) return;
    setLoading(true);
    axios
      .get("http://localhost:8080/api/merchandising-set/", {
        params: { warehouse: currentWarehouse.id },
      })
      .then((res) => setSales(res.data || []))
      .catch((err) => console.error("Error fetching sales:", err))
      .finally(() => setLoading(false));
  }, [currentWarehouse]);

  // 1) If you still want to keep a pre-sort, make it a simple newest-first by date_time
const timeSorted = useMemo(() => {
  return [...sales].sort((a, b) => {
    const at = a?.date_time ? new Date(a.date_time).getTime() : 0;
    const bt = b?.date_time ? new Date(b.date_time).getTime() : 0;
    return bt - at; // newest first
  });
}, [sales]);

// 2) Group warehouse rows by msp_no + day, but keep a precise max timestamp for sorting
const groupedWarehouseRows = useMemo(() => {
  const groups = new Map();
  for (const r of timeSorted) {
    const tname = (r.transaction_type_name || "").toLowerCase();
    if (tname !== "warehouse") continue;

    const day = asYmd(r.date_time); // same-day grouping
    const key = `${r.msp_no}__${day}`;
    const ts = r?.date_time ? new Date(r.date_time).getTime() : 0;
    const actualSale = Number(r.actual_sale || 0);

    if (!groups.has(key)) {
      groups.set(key, {
        _kind: "warehouse-group",
        msp_no: r.msp_no,
        dateYmd: day,
        txn_count: 0,
        total_actual_sale: 0,
        sortTime: ts,                 // track max date_time among the group
      });
    }

    const g = groups.get(key);
    g.txn_count += 1;
    g.total_actual_sale += actualSale;
    if (ts > g.sortTime) g.sortTime = ts; // keep the latest timestamp in group
  }

  // Optional: keep a human display for the group’s latest time
  const arr = Array.from(groups.values()).map(g => ({
    ...g,
    date_display: new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(g.sortTime)),
  }));

  return arr;
}, [timeSorted]);

// 3) Non-warehouse rows, with their own sortTime
const nonWarehouseRows = useMemo(() => {
  return timeSorted
    .filter((r) => (r.transaction_type_name || "").toLowerCase() !== "warehouse")
    .map((r) => ({
      _kind: "normal",
      record: r,
      sortTime: r?.date_time ? new Date(r.date_time).getTime() : 0,
    }));
}, [timeSorted]);

// 4) Merge everything and do ONE final sort by sortTime desc
const displayRows = useMemo(() => {
  const merged = [
    ...groupedWarehouseRows,   // each has sortTime
    ...nonWarehouseRows,       // each has sortTime
  ];
  return merged.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
}, [groupedWarehouseRows, nonWarehouseRows]);

 

  const handleCreateNew = () => navigate("/merchandising-sale");

  // REPLACE: handle click for both grouped + normal rows
  const handleAnyRowClick = (row) => {
    if (row._kind === "warehouse-group") {
      navigate(`/warehouse-details/${encodeURIComponent(row.msp_no)}`);
    } else {
      const sale = row.record;
      navigate(`/merchandising-sale/${sale.id}`, {
        state: { data: sale, editMode: true },
      });
    }
  };


  return (
    <div className="p-6 bg-sky-200 min-h-screen">
      {/* Warehouse Display */}
      <div className="mb-4 p-4 bg-blue-600 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-blue-100">Current Warehouse:</span>
            <span className="ml-2 text-white font-bold text-lg">
              {currentWarehouse?.name || "No Warehouse Selected"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center mb-6">
        <button
          onClick={handleCreateNew}
          className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-500 text-sm"
        >
          + CREATE NEW SALE
        </button>
      </div>

      <div className="w-full bg-white rounded shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-200 text-center">
              <th className="p-2">MSP NO.</th>
              <th className="p-2">DATE & TIME</th>
              <th className="p-2">TRANSACTION TYPE</th>
              <th className="p-2">HANDLED BY</th>
              <th className="p-2">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && displayRows.map((row) => {
              if (row._kind === "warehouse-group") {
                return (
                  <tr
                    key={`wa-${row.msp_no}-${row.dateYmd}`}
                    className="text-center border-t bg-gray-100 hover:bg-blue-100 cursor-pointer"
                    onClick={() => handleAnyRowClick(row)}
                    title="View warehouse products for this MSP (grouped)"
                  >
                    <td className="p-2 font-semibold">{row.msp_no}</td>
                    <td className="p-2">{row.date_display}</td> {/* precise latest time */}
                    <td className="p-2">Warehouse</td>
                    <td className="p-2">—</td>
                    <td className="p-2">
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {row.txn_count} txn • ₱{row.total_actual_sale.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              }

              // normal row
              const sale = row.record;
              return (
                <tr
                  key={sale.id}
                  className="text-center border-t bg-white hover:bg-blue-100 cursor-pointer"
                  onClick={() => handleAnyRowClick(row)}
                >
                  <td className="p-2">{sale.msp_no}</td>
                  <td className="p-2">{formatToManila(sale.date_time)}</td>
                  <td className="p-2">{sale.transaction_type_name}</td>
                  <td className="p-2">
                    {sale.handled_by_name || sale.handled_by_username || sale.handled_by || "—"}
                  </td>
                  <td className="p-2">
                    <StatusPill status={sale.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>

        </table>
      </div>
    </div>
  );
};

export default MerchandisingList;
