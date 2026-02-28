// Stocks.jsx - UPDATED WITHOUT SUPPLIER PRODUCT CODE COLUMN
import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import {
  FaWarehouse, // eslint-disable-line no-unused-vars
  FaBell, // eslint-disable-line no-unused-vars
} from "react-icons/fa";
import { getCurrentWarehouse, findWarehouseByName } from '../utils/warehouseUtils';
import { getStockThresholds, calculateStockStatus } from '../utils/stockThresholds';

import "../styles/pages/stocks.scss";

const statusOrder = {
  "Out of Stock": 0,
  Low: 1,
  Moderate: 2,
  High: 3,
};

// Map status -> Trading-style status pill classes
const getBadgeClass = (s) => {
  switch (s) {
    case "High":
      return "app-status-pill app-status-pill--stock-high";
    case "Moderate":
      return "app-status-pill app-status-pill--stock-moderate";
    case "Low":
      return "app-status-pill app-status-pill--stock-low";
    case "Out of Stock":
      return "app-status-pill app-status-pill--stock-out";
    default:
      return "app-status-pill app-status-pill--default";
  }
};

// Function to process stocks with dynamic threshold calculation
const processStocksWithThresholds = (stocksData) => {
  return stocksData.map(item => ({
    ...item,
    stock_status: calculateStockStatus(item.quantity_available)
  }));
};

// Utility function to check and store low stock notifications with dynamic thresholds
const checkAndStoreNotifications = async (warehouseId) => {
  try {
    const response = await api.get(`/stocks/?warehouse=${warehouseId}`);
    const rawStocks = response.data;
    
    // Process stocks with current thresholds
    const stocks = processStocksWithThresholds(rawStocks);
    
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
  const warehouse = getCurrentWarehouse();
  
  if (warehouse?.id) {
    await checkAndStoreNotifications(warehouse.id);
  }
};

const Stocks = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // Proper warehouse setup using utilities
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

      const response = await api.get(`/stocks/?warehouse=${currentWarehouse.id}`);
      const rawStockData = response.data;
      
      // Process stocks with current thresholds
      const processedStocks = processStocksWithThresholds(rawStockData);
      
      console.log(`✅ Loaded ${processedStocks.length} stock items for warehouse ${currentWarehouse.name}`);
      setStocks(processedStocks);

      // Check for notifications when stocks are loaded
      await checkAndStoreNotifications(currentWarehouse.id);
    } catch (err) {
      console.error("❌ Failed to load stocks:", err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [currentWarehouse]);

  // Function to refresh stock statuses when thresholds change
  const refreshStockStatuses = useCallback(() => {
    if (stocks.length > 0) {
      console.log('🔄 Refreshing stock statuses with new thresholds');
      
      const updatedStocks = stocks.map(item => ({
        ...item,
        stock_status: calculateStockStatus(item.quantity_available)
      }));
      
      setStocks(updatedStocks);
      
      // Check for new notifications with updated statuses
      if (currentWarehouse?.id) {
        checkAndStoreNotifications(currentWarehouse.id);
      }
    }
  }, [stocks, currentWarehouse]);

  // Setup warehouse first, then fetch stocks
  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchStocks();
    }
  }, [currentWarehouse, fetchStocks]);

  // Listen for warehouse changes
  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log('🏭 Warehouse change detected in Stocks:', event.detail);
      setupWarehouse();
    };
    
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [setupWarehouse]);

  // Listen for threshold changes
  useEffect(() => {
    const handleThresholdChange = (event) => {
      console.log('⚙️ Stock thresholds changed:', event.detail);
      refreshStockStatuses();
    };
    
    window.addEventListener("stockThresholdsChanged", handleThresholdChange);
    return () => window.removeEventListener("stockThresholdsChanged", handleThresholdChange);
  }, [refreshStockStatuses]);

  const sortedStocks = [...stocks].sort(
    (a, b) => statusOrder[a.stock_status] - statusOrder[b.stock_status]
  );

  // Group stocks by product NAME to combine quantities with the same product name // en
  const groupedStocks = Object.values(
    stocks.reduce((acc, stock) => {
      const key = stock.product_name; // Group by product name
      if (!acc[key]) {
        acc[key] = {
          ...stock,
          quantity_available: 0,
          grouped_count: 0, // Track how many stocks were combined
          system_codes: [] // Collect all system product codes
        };
      }
      acc[key].quantity_available += stock.quantity_available;
      acc[key].grouped_count += 1;
      if (stock.system_product_code && !acc[key].system_codes.includes(stock.system_product_code)) {
        acc[key].system_codes.push(stock.system_product_code);
      }
      // Update status based on combined quantity
      acc[key].stock_status = calculateStockStatus(acc[key].quantity_available);
      return acc;
    }, {})
  ).sort((a, b) => statusOrder[a.stock_status] - statusOrder[b.stock_status]);

  // Show loading state while setting up warehouse
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
        
        {/* Show current warehouse */}
        {currentWarehouse && (
          <span className="page-warehouse-chip page-warehouse-chip--inline">
            <span className="page-warehouse-chip__icon" aria-hidden="true">📦</span>
            <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
          </span>
        )}
      </div>
    
      <div className="table-wrapper">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Product</th>
              <th>System Product Code</th>
              <th className="text-center">Quantity</th>
              <th className="text-center">Last Updated</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>

          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty">
                  {currentWarehouse
                    ? `No stock data available for ${currentWarehouse.name}.`
                    : "No warehouse selected. Please select a warehouse to view stocks."}
                </td>
              </tr>
            ) : (
              groupedStocks.map((item, idx) => (
                <tr 
                  key={`${item.product_name}-${idx}`}
                  className={
                    item.stock_status === "Out of Stock" ? "row--critical" :
                    item.stock_status === "Low" ? "row--warning" : ""
                  }
                >
                  <td className="cell-left nowrap">
                    {item.product_name}
                  </td>
                  <td className="cell-left nowrap">
                    {item.system_codes.length > 0 ? item.system_codes.join(", ") : 'N/A'}
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
