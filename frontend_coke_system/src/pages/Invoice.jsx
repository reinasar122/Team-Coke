import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const InvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:8080/api/merchandising/")
      .then(res => setInvoices(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Invoice List</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Invoice #</th>
            <th className="border p-2">MSP #</th>
            <th className="border p-2">Transaction Type</th>
            <th className="border p-2">Handled By</th>
            <th className="border p-2">Date</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="border p-2">{inv.invoice_no || "—"}</td>
              <td className="border p-2">{inv.msp_no}</td>
              <td className="border p-2">{inv.transaction_type_name}</td>
              <td className="border p-2">{inv.handled_by_name || "—"}</td>
              <td className="border p-2">{new Date(inv.date_time).toLocaleDateString()}</td>
              <td className="border p-2">
                <button
                  onClick={() => navigate(`/invoice/${inv.id}`)}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceList;
