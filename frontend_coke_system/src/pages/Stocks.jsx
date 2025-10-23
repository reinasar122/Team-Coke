import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaMinusCircle,
  FaCubes,
  FaWarehouse, // eslint-disable-line no-unused-vars
  FaBell, // eslint-disable-line no-unused-vars
} from "react-icons/fa";

import "../styles/pages/stocks.scss";
import api from "../api"; // ✅ correct

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
    case "Out of Stock": return "badge badge--outofstock";
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

// Utility function to check and store low stock notifications
const checkAndStoreNotifications = async (warehouseId) => {
  try {
    const response = await api.get(`/api/stocks/?warehouse=${warehouseId}`);
    const stocks = response.data;
    
    const criticalStocks = stocks.filter(item => 
      item.stock_status === "Low" || item.stock_status === "Out of Stock"
    );
    
    if (criticalStocks.length > 0) {
      // Store in localStorage for notifications
      const existingNotifications = JSON.parse(localStorage.getItem("stockNotifications") || "[]");
      const newNotifications = criticalStocks.map(item => ({
        id: `stock-${item.id}-${Date.now()}`,
        type: "stock",
        productName: item.product_name,
        status: item.stock_status,
        quantity: item.quantity_available,
        timestamp: new Date().toISOString(),
        read: false
      }));
      
      // Avoid duplicate notifications
      const uniqueNotifications = newNotifications.filter(newNotif => 
        !existingNotifications.some(existing => 
          existing.productName === newNotif.productName && 
          existing.status === newNotif.status &&
          !existing.read
        )
      );
      
      if (uniqueNotifications.length > 0) {
        localStorage.setItem("stockNotifications", JSON.stringify([
          ...existingNotifications,
          ...uniqueNotifications
        ]));
        
        // Dispatch event for notification system
        window.dispatchEvent(new CustomEvent('newStockNotification', { 
          detail: { notifications: uniqueNotifications }
        }));
      }
    }
  } catch (error) {
    console.error("Error checking stock notifications:", error);
  }
};

// Export function to be called after transactions
export const checkStockAfterTransaction = async (warehouseId) => {
  await checkAndStoreNotifications(warehouseId);
};

// Export function to be called on login
export const checkStockOnLogin = async () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  
  let warehouseId;
  if ((user.role || "").toLowerCase() === "admin") {
    warehouseId = selectedWarehouse?.id || user.warehouse_id;
  } else {
    warehouseId = user.warehouse_id;
  }
  
  if (warehouseId) {
    await checkAndStoreNotifications(warehouseId);
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

      const response = await api.get(`/stocks/?warehouse=${warehouseId}`);
      const stockData = response.data;
      setStocks(stockData);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

      if ((user.role || "").toLowerCase() === "admin" && selectedWarehouse) {
        setCurrentWarehouse(selectedWarehouse.name);
      } else {
        setCurrentWarehouse(user.warehouse || "Unknown Warehouse");
      }

      // Check for notifications when stocks are loaded
      await checkAndStoreNotifications(warehouseId);
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
      <div>
        <h2 className="page-title mb-5" style={{ marginRight: 'auto' }}>
          🧾 Stocks Table
        </h2>
      </div>
    
      <div className="table-wrapper">
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
                <tr 
                  key={item.id}
                  className={
                    item.stock_status === "Out of Stock" ? "row--critical" :
                    item.stock_status === "Low" ? "row--warning" : ""
                  }
                >
                  <td className="cell-left nowrap">
                    {item.product_name}
                  </td>
                  <td className="text-center">
                    <span className={item.quantity_available === 0 ? "quantity--zero" : ""}>
                      {item.quantity_available}
                    </span>
                  </td>
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