import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePDF } from "./PDFInvoice";
import { printReceipt } from "./receiptPrint.jsx";
import "react-toastify/dist/ReactToastify.css";
import api from "../../api"; // Importing API helper for requests

const InvoiceModal = ({
  onClose,
  invoiceData = {},
  hidePaymentBreakdown = false,
  isViewOnly = false,
}) => {
  const navigate = useNavigate();
  const saleId = invoiceData?.id || null; // id of Merchandising record

  const showAlert = (msg) => showCustomAlert ? showCustomAlert(msg) : alert(msg);

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

  const currentWarehouse = getCurrentWarehouse();

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const time = Date.now().toString().slice(-4);
    return `INV-${year}${month}${day}-${time}`;
  };

  const [invoiceNumber] = useState(() => invoiceData?.invoice_no || generateInvoiceNumber());

  const handleClose = async () => {
    if (isViewOnly) {
      onClose?.();
      navigate("/trading", { replace: true });
      return;
    }

    if (!saleId) {
      console.warn("⚠️ InvoiceModal: no saleId provided.");
      onClose?.();
      navigate("/trading", { replace: true });
      return;
    }

    if (!invoiceNumber) {
      showAlert("Cannot save invoice: invoice number is empty.");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
      };

      console.log("📤 Saving invoice for merchandising ID:", saleId, "Invoice No:", invoiceNumber);

      // Use the api helper for making requests
      const res = await api.post(
        `/merchandising-set/${saleId}/set_invoice_no/`,
        {
          invoice_no: invoiceNumber,
          empties_price_total: invoiceData.emptiesPriceTotal,
          empty_returns: invoiceData.emptyReturns,
          payment_method: invoiceData.paymentMethod,
        },
        { headers }
      );

      if (res.status !== 200) {
        console.error("❌ Save invoice failed:", res.status, res.data);
        showAlert(res.data?.detail || JSON.stringify(res.data) || "Failed to save invoice number.");
        return;
      }

      console.log("✅ Invoice saved:", res.data);

      const isWarehouse = /warehouse/i.test(String(invoiceData.transactionTypeName || ""));

      if (isWarehouse) {
        const warehouseType = Array.isArray(invoiceData.transactionTypes)
          ? invoiceData.transactionTypes.find(tt => tt.name === "Warehouse")
          : null;

        navigate("/merchandising-sale", {
          replace: true,
          state: {
            reset: true,
            transactionTypeId: warehouseType?.id || "",
          },
        });
      } else {
        navigate("/trading", { replace: true, state: { reset: true } });
      }

      onClose?.();
    } catch (err) {
      console.error("🔥 Network error saving invoice:", err);
      showAlert("Network error while saving invoice. Check console.");
    }
  };

  // Additional functions (PDF generation, table rendering, etc.) remain unchanged

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl p-6 rounded-lg overflow-y-auto max-h-[90vh] shadow-lg relative">
        {/* Top Buttons */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handleNewSale}
            className="bg-gray-100 text-black px-3 py-1 rounded hover:bg-gray-200"
          >
            🏠 New Sale
          </button>
          <div className="space-x-2">
            {/* Paper & Orientation Controls */}
            <button
              onClick={handleDownloadPDF}
              className="bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-100"
            >
              ⬇️ Download PDF
            </button>
            <button
              onClick={handlePrintInvoice}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            >
              🖨️ Print Invoice
            </button>
          </div>
        </div>

        {/* From / To / Meta */}
        <div className="mt-4 text-sm">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <strong>Invoice No:</strong> {invoiceNumber}
            </div>
            <div>
              <strong>Date:</strong> {invoiceData.transactionDate || "--"}
            </div>
            <div>
              <strong>Payment Method:</strong> {invoiceData.paymentMethod || "--"}
            </div>
            <div>
              <strong>Handled By:</strong> {invoiceData.handledBy || "--"}
            </div>
          </div>
        </div>

        {/* Products, Empty Price, Returns, and Expenses */}
        {/* Assuming these tables have been set up as in your original example */}

        <div className="mt-6 mb-6">
          <h3 className="font-semibold mb-2">Expenses Summary</h3>
          <table className="w-full mt-2 border">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-right">Amount (₱)</th>
              </tr>
            </thead>
            <tbody>
              {(invoiceData.miscItems || []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-2 text-center text-gray-500">
                    No expenses added
                  </td>
                </tr>
              ) : (
                invoiceData.miscItems.map((exp, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2 text-left">{exp.description}</td>
                    <td className="p-2 text-right">₱{Number(exp.amount || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="text-right font-semibold mt-1">
            Total: ₱{(invoiceData.miscItems || []).reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2)}
          </p>
        </div>

        {/* Payment Breakdown */}
        {!hidePaymentBreakdown && (
          <div className="mt-2 text-sm">
            <strong>Payment Breakdown</strong>
            {/* Add your payment breakdown code here */}
          </div>
        )}

        {/* Close Button */}
        <div className="text-right mt-6">
          <button
            onClick={handleClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {isViewOnly ? "Close" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
