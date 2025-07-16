import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaMinusCircle,
  FaCubes,
  FaWarehouse,
} from "react-icons/fa";

const statusStyles = {
  "Out of Stock": {
    bg: "bg-red-600",
    icon: <FaMinusCircle className="mr-1" />,
  },
  Low: {
    bg: "bg-yellow-500",
    icon: <FaExclamationTriangle className="mr-1" />,
  },
  Moderate: {
    bg: "bg-blue-500",
    icon: <FaCubes className="mr-1" />,
  },
  High: {
    bg: "bg-green-500",
    icon: <FaCheckCircle className="mr-1" />,
  },
};

const statusOrder = {
  "Out of Stock": 0,
  Low: 1,
  Moderate: 2,
  High: 3,
};

const Stocks = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // Function to get current warehouse ID
  const getCurrentWarehouseId = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    // For admin users, use selected warehouse or fall back to their enrolled warehouse
    if (user.role?.toLowerCase() === "admin") {
      return selectedWarehouse?.id || user.warehouse_id;
    }
    
    // For non-admin users, always use their enrolled warehouse
    return user.warehouse_id;
  };

  // Function to fetch stocks for current warehouse
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
      
      // Update current warehouse display name
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      
      if (user.role?.toLowerCase() === "admin" && selectedWarehouse) {
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
    
    // Listen for warehouse changes (from Header component)
    const handleWarehouseChange = () => {
      fetchStocks();
    };
    
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [fetchStocks]);

  const sortedStocks = [...stocks].sort(
    (a, b) => statusOrder[a.stock_status] - statusOrder[b.stock_status]
  );

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Loading stocks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">🧾 Stocks Table</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Overview of all inventory stock levels</p>
          </div>
          {currentWarehouse && (
            <div className="flex items-center bg-primary/10 px-4 py-2 rounded-lg">
              <FaWarehouse className="text-primary mr-2" />
              <span className="text-primary font-medium">{currentWarehouse}</span>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 shadow-md rounded-xl bg-white dark:bg-gray-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[#0b1120] text-white text-xs uppercase tracking-wider rounded-t-xl">
              <th className="px-6 py-4 text-left rounded-tl-xl">Product</th>
              <th className="px-6 py-4 text-center">Quantity</th>
              <th className="px-6 py-4 text-center">Last Updated</th>
              <th className="px-6 py-4 text-center rounded-tr-xl">Status</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center text-gray-500 dark:text-gray-400 py-12">
                  {currentWarehouse ? 
                    `No stock data available for ${currentWarehouse}.` : 
                    "No warehouse assigned or no stock data available."
                  }
                </td>
              </tr>
            ) : (
              sortedStocks.map((item, index) => {
                const status = statusStyles[item.stock_status] || {};
                return (
                  <tr
                    key={item.id}
                    className={`transition duration-150 ${
                      index % 2 === 0 ? "bg-gray-50 dark:bg-gray-700" : "bg-white dark:bg-gray-800"
                    } hover:bg-gray-100 dark:hover:bg-gray-600`}
                  >
                    <td className="px-6 py-4 text-left font-medium text-gray-800 dark:text-white whitespace-nowrap">
                      {item.product_name}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-700 dark:text-gray-300">
                      {item.quantity_available}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(item.last_updated).toLocaleString("en-US", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-white text-xs font-semibold shadow ${status.bg}`}
                      >
                        {status.icon}
                        {item.stock_status}
                      </span>
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
};

export default Stocks;