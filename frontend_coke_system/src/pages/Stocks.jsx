import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaMinusCircle,
  FaCubes,
  FaWarehouse,
} from "react-icons/fa";

import "../styles/pages/stocks.scss";

const statusOrder = {
  "Out of Stock": 0,
  Low: 1,
  Moderate: 2,
  High: 3,
};

// Map status -> SCSS badge class
const getBadgeClass = (s) => {
  switch (s) {
    case "High": return "badge badge--high";
    case "Moderate": return "badge badge--moderate";
    case "Low": return "badge badge--low";
    case "Out of Stock": return "badge bade--outofstock";
    default: return "badge";
  }
};

// Map status -> icon (gap handled by .badge)
const getStatusIcon = (s) => {
  switch (s) {
    case "High": return <FaCheckCircle />;
    case "Moderate": return <FaCubes />;
    case "Low": return <FaExclamationTriangle />;
    case "Out of Stock": return <FaMinusCircle />;
    default: return null;
  }
};

const Stocks = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  const getCurrentWarehouseId = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if ((user.role || "").toLowerCase() === "admin") {
      return selectedWarehouse?.id || user.warehouse_id;
    }
    return user.warehouse_id;
  };

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const warehouseId = getCurrentWarehouseId();
      if (!warehouseId) {
        console.error("No warehouse ID found");
        setStocks([]);
        return;
      }

      const response = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`);
      setStocks(response.data);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

      if ((user.role || "").toLowerCase() === "admin" && selectedWarehouse) {
        setCurrentWarehouse(selectedWarehouse.name);
      } else {
        setCurrentWarehouse(user.warehouse || "Unknown Warehouse");
      }
    } catch (err) {
      console.error("Failed to load stocks:", err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
    const handleWarehouseChange = () => fetchStocks();
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [fetchStocks]);

  const sortedStocks = [...stocks].sort(
    (a, b) => statusOrder[a.stock_status] - statusOrder[b.stock_status]
  );

  if (loading) {
    return (
      <div className="stocks-container">
        <div className="loading">
          <div className="spinner" />
          <span className="loading-text">Loading stocks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stocks-container">
      {/* <div className="stocks-title-header">
      <h2 className="page-title" style={{ marginRight: 'auto' }}>Product List</h2>
        <div>
          <h2>🧾 Stocks Table</h2>
          <p className="muted">Overview of all inventory stock levels</p>
        </div>

        {currentWarehouse && (
          <div className="warehouse-chip">
            <FaWarehouse />
            <span>{currentWarehouse}</span>
          </div>
        )}
      </div> */}
      <h2 className="page-title mt-5 mb-5" style={{ marginRight: 'auto' }}>🧾 Stocks Table</h2>

      <div className="card">{/* light by default (#f4f4f4) */}
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-center">Quantity</th>
              <th className="text-center">Last Updated</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>

          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty">
                  {currentWarehouse
                    ? `No stock data available for ${currentWarehouse}.`
                    : "No warehouse assigned or no stock data available."}
                </td>
              </tr>
            ) : (
              sortedStocks.map((item) => (
                <tr key={item.id}>
                  <td className="cell-left nowrap">{item.product_name}</td>
                  <td className="text-center">{item.quantity_available}</td>
                  <td className="text-center nowrap">
                    {new Date(item.last_updated).toLocaleString("en-US", {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="text-center">
                    <span className={getBadgeClass(item.stock_status)}>
                      {getStatusIcon(item.stock_status)}
                      {item.stock_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Stocks;
