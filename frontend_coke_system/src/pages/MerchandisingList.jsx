// MerchandisingList.jsx - FIXED WITH PROPER WAREHOUSE DETECTION
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { FaChartLine, FaWarehouse } from "react-icons/fa";
import {
  getCurrentWarehouse,
  findWarehouseByName,
  getWarehouseAxiosConfig,
} from "../utils/warehouseUtils";
import "../styles/pages/merchandisinglist.scss";

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
    hour12: true,
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

const normalizeReservedDate = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return toYMD_PH(parsed);
};

const StatusPill = ({ status, dueToday = false }) => {
  const st = (status || "").toLowerCase().trim();
  const base = "merch-status-pill";
  if (st === "pending" || st === "draft")
    return <span className={`${base} merch-status-pill--pending`}>Pending</span>;
  if (st === "reserved")
    return <span className={`${base} merch-status-pill--reserved${dueToday ? " merch-status-pill--due" : ""}`} title={dueToday ? "Pickup date is today" : undefined}>Reserved</span>;
  if (st === "cancelled" || st === "canceled")
    return <span className={`${base} merch-status-pill--cancelled`}>Cancelled</span>;
  if (st.startsWith("complete"))
    return <span className={`${base} merch-status-pill--completed`}>Completed</span>;
  if (st === "in progress" || st === "in-progress" || st === "ongoing" || st === "on going")
    return <span className={`${base} merch-status-pill--progress`}>In Progress</span>;
  return <span className={`${base} merch-status-pill--default`}>{status || "\u2014"}</span>;
};

const MerchandisingList = ({ view = "trading" }) => {
  const [sales, setSales] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isReservationView =
    String(view || "").trim().toLowerCase() === "reservation";
  const asYmd = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

  // Setup warehouse (same pattern as ProductList)
  const setupWarehouse = useCallback(async () => {
    console.log("Setting up warehouse for MerchandisingList...");

    const warehouse = getCurrentWarehouse();

    if (!warehouse) {
      console.warn("No warehouse found for user");
      setCurrentWarehouse(null);
      setLoading(false);
      return;
    }

    if (warehouse.needsIdLookup) {
      const foundWarehouse = await findWarehouseByName(warehouse.name);
      setCurrentWarehouse(foundWarehouse);
    } else {
      setCurrentWarehouse(warehouse);
    }

    setLoading(false);
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!currentWarehouse?.id) {
      console.warn("No warehouse ID available for fetching transactions");
      setSales([]);
      return;
    }

    try {
      setLoading(true);
      console.log(
        `Fetching transactions for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`
      );

      const config = {
        params: { warehouse: currentWarehouse.id },
        ...getWarehouseAxiosConfig(currentWarehouse), // adds X-Warehouse-ID header
      };

      const response = await api.get("merchandisings/", config);
      const transactions = response.data || [];
      console.log(
        `Loaded ${transactions.length} transactions for warehouse ${currentWarehouse.name}`
      );

      // Extra client-side filtering for safety
      const filteredTransactions = transactions.filter((transaction) => {
        const warehouseMatch =
          transaction.warehouse === currentWarehouse.id ||
          transaction.warehouse_id === currentWarehouse.id ||
          (transaction.warehouse && transaction.warehouse.id === currentWarehouse.id);

        if (!warehouseMatch) {
          console.warn(
            `Transaction ${transaction.msp_no} doesn't belong to current warehouse, filtering out`
          );
        }
        return warehouseMatch;
      });

      console.log(
        `After filtering: ${filteredTransactions.length} transactions for warehouse ${currentWarehouse.name}`
      );
      setSales(filteredTransactions);
    } catch (err) {
      console.error("Error fetching sales:", err);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [currentWarehouse]);

  // Setup warehouse first
  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  // Fetch transactions once warehouse is ready
  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchTransactions();
    }
  }, [currentWarehouse, fetchTransactions]);

  // React to warehouse change events
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log("Warehouse change detected in MerchandisingList:", event.detail);
      setupWarehouse();
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [setupWarehouse]);

  // Sorting and grouping
  const timeSorted = useMemo(() => {
    return [...sales].sort((a, b) => {
      const at = a?.date_time ? new Date(a.date_time).getTime() : 0;
      const bt = b?.date_time ? new Date(b.date_time).getTime() : 0;
      return bt - at;
    });
  }, [sales]);

  const groupedWarehouseRows = useMemo(() => {
    const groups = new Map();
    for (const r of timeSorted) {
      const tname = String(r.transaction_type_name ?? r.transaction_type?.name ?? "").toLowerCase();
      if (tname !== "warehouse") continue;

      const status = String(r.status || "").trim().toLowerCase();
      if (["reserved", "cancelled", "canceled"].includes(status)) continue;

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
          latestRecord: r,
        });
      }

      const g = groups.get(key);
      g.txn_count += 1;
      g.total_actual_sale += actualSale;
      if (ts >= g.sortTime) {
        g.sortTime = ts;
        g.latestRecord = r;
      }
    }

    return Array.from(groups.values()).map((g) => {
      const latestStatus = String(g.latestRecord?.status || "").trim().toLowerCase();
      let groupStatus = null;

      if (latestStatus === "cancelled" || latestStatus === "canceled") {
        groupStatus = "Cancelled";
      }

      return {
        ...g,
        openRecord: g.latestRecord,
        groupStatus,
        date_display: new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(g.sortTime)),
      };
    });
  }, [timeSorted]);

  const reservedWarehouseRows = useMemo(() => {
    return timeSorted
      .filter((r) => {
        const tname = String(
          r.transaction_type_name ?? r.transaction_type?.name ?? ""
        )
          .trim()
          .toLowerCase();
        const status = String(r.status || "").trim().toLowerCase();
        return tname === "warehouse" && ["reserved", "cancelled", "canceled"].includes(status);
      })
      .map((r) => ({
        _kind: "warehouse-reserved",
        record: r,
        sortTime: r?.date_time ? new Date(r.date_time).getTime() : 0,
        reservedDateYmd: normalizeReservedDate(r.reserved_date),
        isDueToday: normalizeReservedDate(r.reserved_date) === toYMD_PH(new Date()),
      }));
  }, [timeSorted]);

  const nonWarehouseRows = useMemo(() => {
    return timeSorted
      .filter((r) => String(r.transaction_type_name ?? r.transaction_type?.name ?? "").toLowerCase() !== "warehouse")
      .map((r) => ({
        _kind: "normal",
        record: r,
        sortTime: r?.date_time ? new Date(r.date_time).getTime() : 0,
      }));
  }, [timeSorted]);

  const displayRows = useMemo(() => {
    const merged = isReservationView
      ? [...reservedWarehouseRows]
      : [...groupedWarehouseRows, ...nonWarehouseRows];

    return merged.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
  }, [groupedWarehouseRows, reservedWarehouseRows, nonWarehouseRows, isReservationView]);

  const handleCreateNew = () =>
    navigate("/merchandising-sale", {
      state: isReservationView ? { reset: true, reservationMode: true } : { reset: true },
    });
  const handleOpenTrading = () => navigate("/trading");
  const handleOpenReservation = () => navigate("/reservationlist");

  const handleAnyRowClick = (row) => {
    if (row._kind === "warehouse-group") {
      navigate(`/warehouse-details/${encodeURIComponent(row.msp_no)}`, {
        state: { warehouse: currentWarehouse },
      });
      return;
    }

    if (row._kind === "warehouse-reserved") {
      navigate("/merchandising-sale", {
        state: {
          sale: row.record,
          editMode: true,
          reservationMode: true,
        },
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
      s === "reserved" ||
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

  const emptyStateMessage = currentWarehouse
    ? isReservationView
      ? `No reservations found for ${currentWarehouse.name}`
      : `No transactions found for ${currentWarehouse.name}`
    : "No warehouse selected. Please select a warehouse to view transactions.";

  if (loading && !currentWarehouse) {
    return (
      <div className="tradinglist-container">
        <div className="loading">
          <div className="spinner" />
          <span className="loading-text">Setting up warehouse...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tradinglist-container">
      <div
        className="page-header"
        style={{ flexWrap: "wrap", rowGap: 12, marginBottom: "1rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <h1 className="text-2xl flex items-center gap-2">
            <FaChartLine /> Trading
          </h1>

          {currentWarehouse && (
            <span className="page-warehouse-chip page-warehouse-chip--inline">
              <span className="page-warehouse-chip__icon" aria-hidden="true"><FaWarehouse /></span>
              <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="trading-view-toolbar">
        <div className="trading-view-tabs" role="tablist" aria-label="Trading views">
          <button
            type="button"
            className={`trading-view-tab${!isReservationView ? " trading-view-tab--active" : ""}`}
            onClick={handleOpenTrading}
            aria-pressed={!isReservationView}
          >
            TRADING
          </button>
          <button
            type="button"
            className={`trading-view-tab${isReservationView ? " trading-view-tab--active" : ""}`}
            onClick={handleOpenReservation}
            aria-pressed={isReservationView}
          >
            RESERVATION
          </button>
        </div>

        <button
          onClick={handleCreateNew}
          className="btn btn-add"
          disabled={!currentWarehouse?.id}
          style={{ alignSelf: "flex-start" }}
        >
          {isReservationView ? "+ NEW RESERVATION" : "+ NEW SALE"}
        </button>
      </div>

      <div className="table-wrapper">
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
                  {emptyStateMessage}
                </td>
              </tr>
            )}

            {!loading &&
              displayRows.map((row) => {
                if (row._kind === "warehouse-group") {
                  const dayPH = toYMD_PH(new Date(row.sortTime));
                  const todayPH = toYMD_PH(new Date());
                  const status = row.groupStatus || (dayPH === todayPH ? "In Progress" : "Completed");

                  return (
                    <tr
                      key={`wa-${row.msp_no}-${row.dateYmd}`}
                      onClick={() => handleAnyRowClick(row)}
                      title="View warehouse products for this MSP (grouped)"
                    >
                      <td className="p-2 font-semibold">{row.msp_no}</td>
                      <td className="p-2">{row.date_display}</td>
                      <td className="p-2">Warehouse</td>
                      <td className="p-2">{"\u2014"}</td>
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
                    <td className="p-2">{sale.transaction_type_name || sale.transaction_type?.name || sale.transaction_type || "—"}</td>
                    <td className="p-2">
                      {sale.handled_by_name ||
                        sale.handled_by_username ||
                        sale.handled_by ||
                        "\u2014"}
                    </td>
                    <td className="p-2">
                      <StatusPill status={sale.status} dueToday={Boolean(row.isDueToday)} />
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
