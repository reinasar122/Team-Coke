// src/pages/InvoiceList.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import InvoiceModal from "../components/InvoiceModal"; // Reuse your existing InvoiceModal
import { FaEye } from "react-icons/fa";

const InvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get current warehouse info from localStorage
  const getCurrentWarehouse = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    if (user.role?.toLowerCase() === "admin") {
      return (
        selectedWarehouse || {
          id: user.warehouse_id,
          name: user.warehouse,
          warehouse: user.warehouse,
        }
      );
    } else {
      return {
        id: user.warehouse_id,
        name: user.warehouse,
        warehouse: user.warehouse,
      };
    }
  };

  // Fetch invoices filtered by warehouse
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const warehouse = getCurrentWarehouse();
      setCurrentWarehouse(warehouse);

      if (!warehouse?.id) {
        console.warn("No warehouse found for current user");
        setInvoices([]);
        return;
      }

      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Token ${token}` } : {};

      const response = await axios.get("http://localhost:8080/api/merchandisings/", {
        headers,
        params: {
          warehouse: warehouse.id
        }
      });

      // Filter by warehouse as backup (in case backend doesn't support warehouse filtering yet)
      const warehouseFilteredInvoices = response.data.filter(
        invoice => invoice.warehouse === warehouse.id
      );

      // ✅ sort newest first
      const sorted = [...warehouseFilteredInvoices].sort(
        (a, b) => new Date(b.date_time) - new Date(a.date_time)
      );
      
      setInvoices(sorted);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoices on page load and when warehouse changes
  useEffect(() => {
    fetchInvoices();
  }, []);

  // Listen for warehouse changes (for admin users)
  useEffect(() => {
    const handleStorageChange = () => {
      fetchInvoices();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('warehouseChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('warehouseChanged', handleStorageChange);
    };
  }, []);

  // Handle view action - fetch invoice details
  const handleView = async (id) => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Token ${token}` } : {};
      
      // ✅ Use the correct endpoint
      const res = await axios.get(
        `http://localhost:8080/api/merchandisings/${id}/`,
        { headers }
      );
      console.log("Invoice Data: ", res.data);
      
      // Verify this invoice belongs to current warehouse
      const warehouse = getCurrentWarehouse();
      if (res.data.warehouse !== warehouse.id) {
        alert("Access denied: This invoice belongs to a different warehouse.");
        return;
      }
      
      setSelectedInvoice(res.data);
      setShowModal(true);
    } catch (err) {
      console.error("Failed to fetch invoice details:", err);
      alert("Failed to load invoice details. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="invoicelist-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading invoices...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="invoicelist-container">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Invoice List</h2>
        {currentWarehouse && (
          <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
            Warehouse: {currentWarehouse.name || currentWarehouse.warehouse}
          </div>
        )}
      </div>
      
      {invoices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No invoices found for this warehouse.
        </div>
      ) : (
        <div className="table-wrapper">
          <div className="table">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Invoice #</th>
                  <th className="border p-2 text-left">MSP #</th>
                  <th className="border p-2 text-left">Transaction Type</th>
                  <th className="border p-2 text-left">Date</th>
                  <th className="border p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="border p-2">{inv.invoice_no || "—"}</td>
                    <td className="border p-2">{inv.msp_no}</td>
                    <td className="border p-2">{inv.transaction_type_name}</td>
                    <td className="border p-2">
                      {new Date(inv.date_time).toLocaleDateString()}
                    </td>
                    <td className="border p-2">
                      <button
                        onClick={() => handleView(inv.id)}
                        className="icon-btn icon-btn-view"
                        title="View Invoice"
                      >
                        <FaEye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reuse InvoiceModal */}
      {showModal && selectedInvoice && (
        <InvoiceModal
          onClose={() => setShowModal(false)} // Close modal on button click
          invoiceData={{
            ...selectedInvoice,
            rows: selectedInvoice.items || [],
            miscItems: selectedInvoice.misc_items || [],
            handledBy: selectedInvoice.handled_by_name || "",
            transactionTypeName: selectedInvoice.transaction_type_name || "",
            transactionDate: selectedInvoice.date_time || "",
            subtotal: selectedInvoice.total_trading_amount || 0,
            totalAmount: selectedInvoice.total_amount || 0,
            actualSales: selectedInvoice.actual_sale || 0,
            emptiesPriceTotal: selectedInvoice.empties_price_total || 0,
            emptyReturns: selectedInvoice.empty_returns || 0,
            expensesTotal: selectedInvoice.total_expenses_amount || 0,
            paymentMethod: selectedInvoice.payment_method || "",
            invoice_no: selectedInvoice.invoice_no || "", // ✅ ensure invoice_no is passed
            currentWarehouse: getCurrentWarehouse(), // Pass current warehouse info
          }}
          hidePaymentBreakdown={true}
          isViewOnly={true}
        />
      )}
    </div>
  );
};

export default InvoiceList;