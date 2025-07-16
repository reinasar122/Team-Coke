import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEye, FaPrint } from 'react-icons/fa';

const MerchandisingList = () => {
  const [sales, setSales] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // Get current warehouse
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    if (user.role?.toLowerCase() === "admin") {
      setCurrentWarehouse(selectedWarehouse || { id: user.warehouse_id, name: user.warehouse });
    } else {
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }

    // Listen for warehouse changes
    const handleWarehouseChange = (event) => {
      const { warehouse } = event.detail;
      if (warehouse) {
        setCurrentWarehouse(warehouse);
      } else {
        setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, []);

  useEffect(() => {
    if (currentWarehouse?.id) {
      axios.get(`http://localhost:8080/api/merchandising/?warehouse=${currentWarehouse.id}`)
        .then(res => setSales(res.data))
        .catch(err => console.error(err));
    }
  }, [currentWarehouse]);

  const handleView = (sale) => {
    console.log('View sale:', sale);
  };

  const handlePrint = (sale) => {
    console.log('Print sale:', sale);
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
        <Link
          to="/merchandising-sale"
          className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-500 text-sm"
        >
          + CREATE NEW SALE
        </Link>
      </div>

      <table className="w-full bg-white rounded shadow text-sm">
        <thead>
          <tr className="bg-gray-200 text-center">
            <th className="p-2">MSP NO.</th>
            <th className="p-2">DATE & TIME</th>
            <th className="p-2">TRANSACTION TYPE</th>
            <th className="p-2">CUSTOMER</th>
            <th className="p-2">HANDLED BY</th>
            <th className="p-2">TOTAL AMOUNT</th>
            <th className="p-2">STATUS</th>
            <th className="p-2">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="text-center border-t bg-gray-100">
              <td className="p-2">{sale.msp_no}</td>
              <td className="p-2">{sale.date_time}</td>
              <td className="p-2">{sale.transaction_type_name}</td>
              <td className="p-2">{sale.customer_name}</td>
              <td className="p-2">{sale.handled_by}</td>
              <td className="p-2">₱{parseFloat(sale.total_amount).toLocaleString()}</td>
              <td className="p-2">{sale.status}</td>
              <td className="p-2">
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => handleView(sale)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="View Details"
                  >
                    <FaEye />
                  </button>
                  <button
                    onClick={() => handlePrint(sale)}
                    className="text-gray-600 hover:text-gray-800 p-1"
                    title="Print"
                  >
                    <FaPrint />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr>
              <td colSpan="8" className="text-center py-4 text-gray-600">
                No sales data found for this warehouse.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MerchandisingList;