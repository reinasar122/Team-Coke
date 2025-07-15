import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const MerchandisingList = () => {
  const [sales, setSales] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
   axios.get('http://localhost:8080/api/merchandising-set/')
      .then(res => setSales(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleCreateNew = () => {
    navigate('/merchandising-sale'); // for creating new sales
  };

  const handleRowClick = (sale) => {
    navigate('/merchandising-sale', {
      state: {
        data: sale,
        editMode: true,
      },
    });
  };

  return (
    <div className="p-6 bg-sky-200 min-h-screen">
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
            <th className="p-2">CUSTOMER</th>
            <th className="p-2">HANDLED BY</th>
            <th className="p-2">TOTAL AMOUNT</th>
            <th className="p-2">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
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
                <td className="p-2">{sale.date_time}</td>
                <td className="p-2">{sale.transaction_type_name}</td>
                <td className="p-2">{sale.customer_name}</td>
                <td className="p-2">{sale.handled_by}</td>
                <td className="p-2">
                  ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2">{sale.status}</td>
              </tr>
            );
          })}
          {sales.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center py-4 text-gray-600">
                No sales data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MerchandisingList;
