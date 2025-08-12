import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const MerchandisingList = () => {
  const [sales, setSales] = useState([]);
  const navigate = useNavigate();
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  const formatToManila = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  };

  // Get current warehouse from localStorage or user data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const selectedWarehouse = JSON.parse(localStorage.getItem('selectedWarehouse') || 'null');

    if ((user.role || '').toLowerCase() === 'admin') {
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

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, []);

  // Fetch sales data filtered by warehouse
  useEffect(() => {
    if (!currentWarehouse?.id) return;

    axios
      .get('http://localhost:8080/api/merchandising-set/', {
        params: { warehouse: currentWarehouse.id },
      })
      .then((res) => setSales(res.data || []))
      .catch((err) => console.error('Error fetching sales:', err));
  }, [currentWarehouse]);

  // 🔽 Sort by most recent first (falls back gracefully if date is missing)
  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => {
      const ad = a?.date_time ? new Date(a.date_time).getTime() : 0;
      const bd = b?.date_time ? new Date(b.date_time).getTime() : 0;
      // If equal timestamps, tie-break by id desc so newest created still on top
      if (bd === ad) return (b.id || 0) - (a.id || 0);
      return bd - ad; // recent first
    });
  }, [sales]);

  const handleCreateNew = () => {
    navigate('/merchandising-sale');
  };

  const handleRowClick = (sale) => {
    navigate(`/merchandising-sale/${sale.id}`, {
      state: { data: sale, editMode: true },
    });
  };

  return (
    <div className="p-6 bg-sky-200 min-h-screen">
      {/* Warehouse Display */}
      <div className="mb-4 p-4 bg-blue-600 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-blue-100">Current Warehouse:</span>
            <span className="ml-2 text-white font-bold text-lg">
              {currentWarehouse?.name || 'No Warehouse Selected'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center mb-6">
        <button
          onClick={handleCreateNew}
          className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-500 text-sm"
        >
          + CREATE NEW SALE
        </button>
      </div>

      <table className="w-full bg-white rounded shadow text-sm">
        <thead>
          <tr className="bg-gray-200 text-center">
            <th className="p-2">MSP NO.</th>
            <th className="p-2">DATE & TIME</th>
            <th className="p-2">TRANSACTION TYPE</th>
            <th className="p-2">HANDLED BY</th>
            <th className="p-2">TOTAL AMOUNT</th>
            <th className="p-2">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {sortedSales.map((sale) => {
            const totalAmount =
              (parseFloat(sale.total_trading_amount) || 0) +
              (parseFloat(sale.total_expenses_amount) || 0);

            return (
              <tr
                key={sale.id}
                className="text-center border-t bg-gray-100 hover:bg-blue-100 cursor-pointer"
                onClick={() => handleRowClick(sale)}
              >
                <td className="p-2">{sale.msp_no}</td>
                <td className="p-2">{formatToManila(sale.date_time)}</td>
                <td className="p-2">{sale.transaction_type_name}</td>
                <td className="p-2">{sale.handled_by}</td>
                <td className="p-2">
                  ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2">{sale.status}</td>
              </tr>
            );
          })}
          {sortedSales.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center py-4 text-gray-600">
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
