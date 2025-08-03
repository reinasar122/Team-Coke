import React, { useState } from "react";
import InvoiceModal from "./InvoiceModal";




const PaymentModal = ({ open, onClose, onConfirm, amountDue, actualSales, products, emptyReturns, emptyDiscrepancies }) => {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const showChange = cashReceived !== "";
  const change = Math.max(parseFloat(cashReceived || 0) - amountDue, 0);
  const totalAdjustments = parseFloat(emptyReturns || 0) - parseFloat(emptyDiscrepancies || 0);
  const [invoiceData, setInvoiceData] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);



  if (!open) return null;


  

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-4xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="border-b pb-2 mb-4">
          <h2 className="text-xl font-bold">Payment Confirmation</h2>
        </div>

        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>MSP No.</strong>: WA-001</div>
          <div><strong>Date</strong>: 08/02/2025 09:13 PM</div>
          <div><strong>Customer</strong>: Walk-in</div>
          <div><strong>Handled By</strong>: Miyaku Kagura</div>
        </div>


        {/* Product Summary */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Products Summary</h3>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Qty Sold</th>
                <th className="p-2 text-left">Unit Price</th>
                <th className="p-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
                {products.map((item, index) => (
                    <tr key={index}>
                    <td className="p-2">{item.product_name}</td>
                    <td className="p-2">{item.quantity_description}</td>
                    <td className="p-2">₱{parseFloat(item.unit_price).toFixed(2)}</td>
                    <td className="p-2">₱{parseFloat(item.amount).toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Payment Breakdown */}
        <div className="mt-6 text-sm">
          <h3 className="font-semibold mb-2">Payment Breakdown</h3>
          <div className="border p-4 rounded space-y-2">
            <div><strong>Actual Sales:</strong> ₱{actualSales.toFixed(2)}</div>
            <div className="ml-4">- Empty Returns: ₱{emptyReturns.toFixed(2)}</div>
            <div className="ml-4">
                - Empty Discrepancies: ₱{parseFloat(emptyDiscrepancies || 0).toFixed(2)}
            </div>
            <div className="ml-4">- Total Adjustments: ₱{totalAdjustments.toFixed(2)}</div>

            <div className="text-blue-600 font-bold">
              Total Amount Due: ₱{amountDue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mt-6 text-sm">
          <h3 className="font-semibold mb-2">Payment Method</h3>
          <div className="flex gap-4 mb-4">
            {["cash", "credit", "bank"].map(method => (
              <button
                key={method}
                className={`px-4 py-2 rounded border ${
                  paymentMethod === method ? "bg-blue-500 text-white" : "bg-gray-100"
                }`}
                onClick={() => setPaymentMethod(method)}
              >
                {method === "cash" ? "Cash" : method === "credit" ? "Credit Card" : "Bank Transfer"}
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Cash Amount Received</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1">Amount Due</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={`₱${amountDue.toFixed(2)}`}
                  readOnly
                />
              </div>
              {showChange && (
                <div>
                  <label className="block mb-1">Change</label>
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={`₱${change.toFixed(2)}`}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}
        </div>

       {/* Footer Buttons */}
        <div className="mt-6 flex justify-between">
          <button className="border px-4 py-2 rounded" onClick={onClose}>
            Back to Sale
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => {
              const data = {
                products,
                paymentMethod,
                cashReceived,
                change,
                amountDue,
              };
              setInvoiceData(data);              // ✅ store invoice data
              setShowInvoiceModal(true);         // ✅ show the invoice modal
            }}
            disabled={cashReceived < amountDue} // Optional: prevent underpayment
          >
            Confirm Payment & Generate Invoice
          </button>
        </div>
      </div>

      {/* ✅ Render InvoiceModal */}
      {showInvoiceModal && (
        <InvoiceModal
          onClose={() => setShowInvoiceModal(false)}
          invoiceData={invoiceData}
        />
      )}
    </div>
  );
};

export default PaymentModal;
