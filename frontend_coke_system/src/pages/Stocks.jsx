// Stocks.jsx - INTEGRATED VERSION WITH API IMPROVEMENTS
import React, { useEffect, useState, useCallback } from "react";
import api from "../api"; // ✅ NEW: from new version (was: import axios from "axios")
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaMinusCircle,
  FaCubes,
  FaWarehouse, // eslint-disable-line no-unused-vars
  FaBell, // eslint-disable-line no-unused-vars
} from "react-icons/fa";
import { getCurrentWarehouse, findWarehouseByName } from '../utils/warehouseUtils'; // ✅ KEPT: from old version

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

// ✅ UPDATED: Utility function to check and store low stock notifications (use api.get)
const checkAndStoreNotifications = async (warehouseId) => {
  try {
    // ✅ NEW: Use api.get() instead of axios.get() (from new version)
    const response = await api.get(`/stocks/?warehouse=${warehouseId}`);
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

// ✅ KEPT: Export function to be called on login (from old version - better warehouse handling)
export const checkStockOnLogin = async () => {
  const warehouse = getCurrentWarehouse();
  
  if (warehouse?.id) {
    await checkAndStoreNotifications(warehouse.id);
  }
};

const Stocks = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWarehouse, setCurrentWarehouse] = useState(null); // ✅ KEPT: from old version

  // ✅ KEPT: Proper warehouse setup using utilities (from old version)
  const setupWarehouse = useCallback(async () => {
    console.log('🏭 Setting up warehouse for Stocks...');
    
    const warehouse = getCurrentWarehouse();
    
    if (!warehouse) {
      console.warn('⚠️ No warehouse found for user');
      setCurrentWarehouse(null);
      setLoading(false);
      return;
    }
    
    // If warehouse needs ID lookup, find it by name
    if (warehouse.needsIdLookup) {
      const foundWarehouse = await findWarehouseByName(warehouse.name);
      setCurrentWarehouse(foundWarehouse);
    } else {
      setCurrentWarehouse(warehouse);
    }
    
    setLoading(false);
  }, []);

  const fetchStocks = useCallback(async () => {
    if (!currentWarehouse?.id) {
      console.warn('❌ No warehouse ID available for fetching stocks');
      setStocks([]);
      return;
    }

    try {
      setLoading(true);
      console.log('📦 Fetching stocks for warehouse:', currentWarehouse);

      // ✅ NEW: Use api.get() instead of axios.get() (from new version)
      const response = await api.get(`/stocks/?warehouse=${currentWarehouse.id}`);
      const stockData = response.data;
      
      console.log(`✅ Loaded ${stockData.length} stock items for warehouse ${currentWarehouse.name}`);
      setStocks(stockData);

      // Check for notifications when stocks are loaded
      await checkAndStoreNotifications(currentWarehouse.id);
    } catch (err) {
      console.error("❌ Failed to load stocks:", err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [currentWarehouse]);

  // ✅ KEPT: Setup warehouse first, then fetch stocks (from old version)
  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchStocks();
    }
  }, [currentWarehouse, fetchStocks]);

  // ✅ KEPT: Listen for warehouse changes (from old version)
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log('🏭 Warehouse change detected in Stocks:', event.detail);
      setupWarehouse();
    };
    
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [setupWarehouse]);

  const sortedStocks = [...stocks].sort(
    (a, b) => statusOrder[a.stock_status] - statusOrder[b.stock_status]
  );

  // ✅ KEPT: Show loading state while setting up warehouse (from old version)
  if (loading && !currentWarehouse) {
    return (
      <div className="stocks-container">
        <div className="loading">
          <div className="spinner" />
          <span className="loading-text">Setting up warehouse...</span>
        </div>
      </div>
    );
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          🧾 Stocks Table
        </h2>
        
        {/* ✅ KEPT: Show current warehouse (from old version) */}
        {currentWarehouse && (
          <div style={{ 
            padding: '4px 8px', 
            background: '#f3f4f6', 
            borderRadius: '6px', 
            fontSize: '12px',
            color: '#6b7280'
          }}>
            📦 {currentWarehouse.name}
          </div>
        )}
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
                    ? `No stock data available for ${currentWarehouse.name}.`
                    : "No warehouse selected. Please select a warehouse to view stocks."}
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