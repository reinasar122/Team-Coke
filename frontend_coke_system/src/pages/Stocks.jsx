import React, { useEffect, useState } from "react";
import axios from "axios";

const statusColors = {
  "Out of Stock": "bg-red-500",
  Low: "bg-yellow-500",
  Moderate: "bg-blue-400",
  High: "bg-green-500",
};

const Stocks = () => {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:8080/api/stocks/")
      .then((res) => setStocks(res.data))
      .catch((err) => console.error("Failed to load stocks:", err));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <table className="w-full border text-center">
        <thead>
          <tr className="bg-purple-200 text-gray-700">
            <th className="p-2">Product</th>
            <th className="p-2">Quantity (PCS)</th>
            <th className="p-2">Last Updated</th>
            <th className="p-2">Stock Status</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2 font-medium">{item.product_name}</td>
              <td className="p-2">{item.quantity_available}</td>
              <td className="p-2">
                {new Date(item.last_updated).toLocaleString("en-US", {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="p-2">
                <span
                  className={`inline-block w-24 px-2 py-1 text-white rounded ${statusColors[item.stock_status]}`}
                >
                  {item.stock_status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Stocks;   