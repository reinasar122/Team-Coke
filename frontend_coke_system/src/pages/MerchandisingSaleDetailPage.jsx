import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

const MerchandisingSaleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const sale = location.state?.data;

  if (!sale) {
    return <div className="p-4 text-red-600">No sale data available.</div>;
  }

  const totalAmount =
    (parseFloat(sale.total_trading_amount) || 0) +
    (parseFloat(sale.total_expenses_amount) || 0);

  return (
    <div className="p-6">
      {/* ✅ Top bar with Receive Return button */}
      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
        {sale.transaction_type_name === "Van Load" && (
          <button
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition"
            onClick={() => navigate('/van-load-update', { state: { id: sale.id } })}

          >
            Receive Return
          </button>
        )}
      </div>

      {/* ✅ Sale detail contents */}
      <h2 className="text-2xl font-bold mb-4">Sale Details (ID: {id})</h2>

      <table className="min-w-full border border-collapse bg-white shadow">
        <tbody>
          <tr>
            <td className="border px-4 py-2 font-semibold">MSP No</td>
            <td className="border px-4 py-2">{sale.msp_no}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Date Time</td>
            <td className="border px-4 py-2">{sale.date_time}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Transaction Type</td>
            <td className="border px-4 py-2">{sale.transaction_type_name}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Customer Name</td>
            <td className="border px-4 py-2">{sale.customer_name}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Handled By</td>
            <td className="border px-4 py-2">{sale.handled_by}</td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">
              {sale.transaction_type_name === "Van Load"
                ? "Expected Sale"
                : "Total Amount"}
            </td>
            <td className="border px-4 py-2">
              ₱
              {(
                sale.transaction_type_name === "Van Load"
                  ? parseFloat(sale.expected_sale) || 0
                  : totalAmount
              ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td className="border px-4 py-2 font-semibold">Status</td>
            <td className="border px-4 py-2">{sale.status}</td>
          </tr>
        </tbody>
      </table>

      {/* ✅ Back button */}
      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
        <button
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition"
          onClick={() => {
            const confirmBack = window.confirm(
              "Are you sure you want to go back? Unsaved changes will be lost."
            );
            if (confirmBack) navigate("/trading");
          }}
        >
          BACK
        </button>
      </div>
    </div>
  );
};

export default MerchandisingSaleDetailPage;
