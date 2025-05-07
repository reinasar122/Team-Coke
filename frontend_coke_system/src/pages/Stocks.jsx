import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaMinusCircle,
  FaCubes,
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

  useEffect(() => {
    axios
      .get("http://localhost:8080/api/stocks/")
      .then((res) => setStocks(res.data))
      .catch((err) => console.error("Failed to load stocks:", err));
  }, []);

  const sortedStocks = [...stocks].sort(
    (a, b) => statusOrder[a.stock_status] - statusOrder[b.stock_status]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">🧾 Stocks Table</h2>
        <p className="text-sm text-gray-500">Overview of all inventory stock levels</p>
      </div>

      <div className="overflow-x-auto border border-gray-200 shadow-md rounded-xl bg-white">
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
                <td colSpan="4" className="text-center text-gray-500 py-12">
                  No stock data available.
                </td>
              </tr>
            ) : (
              sortedStocks.map((item, index) => {
                const status = statusStyles[item.stock_status] || {};
                return (
                  <tr
                    key={item.id}
                    className={`transition duration-150 ${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-gray-100`}
                  >
                    <td className="px-6 py-4 text-left font-medium text-gray-800 whitespace-nowrap">
                      {item.product_name}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-700">
                      {item.quantity_available}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500 whitespace-nowrap">
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
 