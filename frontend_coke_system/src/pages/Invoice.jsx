import React, { useEffect, useState } from "react";
import axios from "axios";
import InvoiceModal from "../components/InvoiceModal"; // Reuse your existing InvoiceModal
import { FaEye } from "react-icons/fa";

const InvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch invoices on page load
  useEffect(() => {
    axios
      .get("http://localhost:8080/api/merchandising/")
      .then((res) => setInvoices(res.data))
      .catch((err) => console.error("Error fetching invoices:", err));
  }, []);

  // Handle view action - fetch invoice details
  const handleView = async (id) => {
    try {
      const res = await axios.get(`http://localhost:8080/api/merchandising-set/${id}/`);
      console.log("Invoice Data: ", res.data);  // Log the data here
      setSelectedInvoice(res.data);
      setShowModal(true);
    } catch (err) {
      console.error("Failed to fetch invoice details:", err);
    }
  };

  return (
    <div className="invoicelist-container,">
      <h2 className="text-2xl font-bold mb-4">Invoice List</h2>
      <div className="table-wrapper">
        <div className="table">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border">Invoice #</th>
                <th className="border">MSP #</th>
                <th className="border">Transaction Type</th>
                <th className="border">Date</th>
                <th className="border">Actions</th>
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
      

      {/* Reuse InvoiceModal */}
      {showModal && selectedInvoice && (
        <InvoiceModal
          onClose={() => setShowModal(false)}  // Close modal on button click
          invoiceData={{
            ...selectedInvoice,
            rows: selectedInvoice.items || [], // map items → rows for InvoiceModal
            miscItems: selectedInvoice.misc_items || [],  // Ensure miscItems is passed
            handledBy: selectedInvoice.handled_by_name || "",  // Ensure handledBy is passed
            transactionTypeName: selectedInvoice.transaction_type_name || "", // Ensure transactionTypeName is passed
            transactionDate: selectedInvoice.date_time || "",  // Ensure transactionDate is passed
            // Additional necessary data can be calculated or added here:
            subtotal: selectedInvoice.total_trading_amount || 0,  // Add subtotal if needed
            totalAmount: selectedInvoice.total_amount || 0,  // Add totalAmount if needed
            actualSales: selectedInvoice.actual_sale || 0,  // Pass actualSales if available
            emptiesPriceTotal: selectedInvoice.empties_price_total || 0,  // ✅ correct
            emptyReturns: selectedInvoice.empty_returns || 0,  
            expensesTotal: selectedInvoice.total_expenses_amount || 0, // Pass expensesTotal if available
            paymentMethod: selectedInvoice.payment_method || "",
          }}
          hidePaymentBreakdown={true} 
          isViewOnly={true}
        />
      )}
    </div>
  );
};

export default InvoiceList;