import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaChartLine} from "react-icons/fa";
import "../styles/pages/merchandisinglist.scss";  // Import the custom styles

// Date formatting for Manila timezone
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

// YYYY-MM-DD in Asia/Manila (safe for comparisons)
const toYMD_PH = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);


// Status pill component (using global styles)
// const StatusPill = ({ status }) => {
//   const st = (status || "").toLowerCase();
//   const base = "px-2 py-1 rounded text-xs font-semibold";
//   if (st === "pending")
//     return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
//   if (st === "complete" || st === "completed")
//     return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
//   return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "—"}</span>;
// };

const StatusPill = ({ status }) => {
  const st = (status || "").toLowerCase().trim();
  const base = "px-2 py-1 rounded text-xs font-semibold";
  if (st === "pending" || st === "draft")
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
  if (st.startsWith("complete"))
    return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
  if (st === "in progress" || st === "in-progress" || st === "ongoing" || st === "on going")
    return <span className={`${base} bg-blue-100 text-blue-800`}>In Progress</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{status || "—"}</span>;
}; //Kath

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

  // Fetch list for current warehouse with proper filtering
  useEffect(() => {
    if (!currentWarehouse?.id) {
      console.log("❌ No warehouse selected, skipping fetch");
      setSales([]);
      return;
    }
    
    setLoading(true);
    console.log(`🏪 Fetching transactions for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);
    
    axios
      .get("http://localhost:8080/api/merchandisings/", {
        params: { warehouse: currentWarehouse.id },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
          'Content-Type': 'application/json',
        },
      })
      .then((res) => {
        const transactions = res.data || [];
        console.log(`✅ Loaded ${transactions.length} transactions for warehouse ${currentWarehouse.name}`);
        
        // Extra client-side filtering for safety
        const filteredTransactions = transactions.filter(transaction => {
          const warehouseMatch = 
            transaction.warehouse === currentWarehouse.id ||
            transaction.warehouse_id === currentWarehouse.id ||
            (transaction.warehouse && transaction.warehouse.id === currentWarehouse.id);
          
          if (!warehouseMatch) {
            console.warn(`⚠️ Transaction ${transaction.msp_no} doesn't belong to current warehouse, filtering out`);
          }
          return warehouseMatch;
        });
        
        console.log(`📋 After filtering: ${filteredTransactions.length} transactions for warehouse ${currentWarehouse.name}`);
        setSales(filteredTransactions);
      })
      .catch((err) => {
        console.error("❌ Error fetching sales:", err);
        setSales([]);
      })
      .finally(() => setLoading(false));
  }, [currentWarehouse]);

  // Sorting and grouping
  const timeSorted = useMemo(() => {
    return [...sales].sort((a, b) => {
      const at = a?.date_time ? new Date(a.date_time).getTime() : 0;
      const bt = b?.date_time ? new Date(b.date_time).getTime() : 0;
      return bt - at; // newest first
    });
  }, [sales]);

  const groupedWarehouseRows = useMemo(() => {
    const groups = new Map();
    for (const r of timeSorted) {
      const tname = (r.transaction_type_name || "").toLowerCase();
      if (tname !== "warehouse") continue;

      const day = asYmd(r.date_time);
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
          sortTime: ts,
        });
      }

      const g = groups.get(key);
      g.txn_count += 1;
      g.total_actual_sale += actualSale;
      if (ts > g.sortTime) g.sortTime = ts;
    }

    return Array.from(groups.values()).map(g => ({
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
  }, [timeSorted]);

  const nonWarehouseRows = useMemo(() => {
    return timeSorted
      .filter((r) => (r.transaction_type_name || "").toLowerCase() !== "warehouse")
      .map((r) => ({
        _kind: "normal",
        record: r,
        sortTime: r?.date_time ? new Date(r.date_time).getTime() : 0,
      }));
  }, [timeSorted]);

  const displayRows = useMemo(() => {
    const merged = [...groupedWarehouseRows, ...nonWarehouseRows];
    return merged.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
  }, [groupedWarehouseRows, nonWarehouseRows]);

  const handleCreateNew = () => navigate("/merchandising-sale");

  const handleAnyRowClick = (row) => {
    if (row._kind === "warehouse-group") {
      navigate(`/warehouse-details/${encodeURIComponent(row.msp_no)}`, {
        state: { warehouse: currentWarehouse }
      });
      return;
    }

    const sale = row.record ?? row;

    const norm = (v) => (v ?? "").toString().trim().toLowerCase();
    const collapse = (v) => norm(v).replace(/\s+/g, " ");

    const tnameRaw =
      sale.transaction_type_name ??
      sale.transaction_type?.name ??
      sale.transaction_type ??
      sale.transactionType ??
      "";

    const tname = collapse(tnameRaw);
    const isVanLoad =
      tname.includes("van load") ||
      tname.includes("van-load") ||
      tname.includes("vanload") ||
      (tname.includes("van") && tname.includes("load"));

    const s = collapse(sale.status);
    const isCompleted = s.startsWith("complete");
    const isPending =
      s === "pending" ||
      s === "draft" ||
      s === "in progress" ||
      s === "in-progress";

    if (isVanLoad && isCompleted) {
      navigate(`/van-load-product-details/${sale.id}`, { state: { sale } });
      return;
    }

    if (isVanLoad && isPending) {
      navigate(`/merchandising-sale/${sale.id}`, { state: { sale } });
      return;
    }

    navigate(`/merchandising-sale/${sale.id}`, {
      state: { data: sale, editMode: true },
    });
  };

  return (
    <div className="page p-3 min-h-screen">


      <div className="w-full">
        <div className="table-wrapper">
          
         <div className="flex items-center justify-between m-4">
            <h1 className="text-2xl flex items-center gap-2">
              <FaChartLine /> Trading
            </h1>

            <button
              onClick={handleCreateNew}
              className="btn btn-add"
            >
              + NEW SALE
            </button>
          </div>

         
          <table className="table table-hover ">
            <thead>
              <tr>
                <th className="p-2">MSP No.</th>
                <th className="p-2">Date & Time</th>
                <th className="p-2">Transaction Type</th>
                <th className="p-2">Handled By</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5" className="p-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="spinner"></div>
                      <span className="ml-2">Loading transactions...</span>
                    </div>
                  </td>
                </tr>
              )}
              
              {!loading && displayRows.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-gray-500">
                    No transactions found for {currentWarehouse?.name || "this warehouse"}
                  </td>
                </tr>
              )}

              {!loading && displayRows.map((row) => {
                if (row._kind === "warehouse-group") {
                const dayPH = toYMD_PH(new Date(row.sortTime));
                const todayPH = toYMD_PH(new Date());
                const status = dayPH === todayPH ? "In Progress" : "Completed";

                return (
                  <tr
                    key={`wa-${row.msp_no}-${row.dateYmd}`}
                    onClick={() => handleAnyRowClick(row)}
                    title="View warehouse products for this MSP (grouped)"
                  >
                    <td className="p-2 font-semibold">{row.msp_no}</td>
                    <td className="p-2">{row.date_display}</td>
                    <td className="p-2">Warehouse</td>
                    <td className="p-2">—</td>
                    <td className="p-2">
                      <StatusPill status={status} />
                    </td>
                  </tr>
                );
              }

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
                      {sale.handled_by_name || sale.handled_by_username || sale.handled_by || "--"}
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
    </div>
  );
};

export default MerchandisingList;