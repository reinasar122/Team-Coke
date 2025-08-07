import React, { useState } from "react";
import InvoiceModal from "./InvoiceModal";




const PaymentModal = ({ open, onClose, onConfirm, emptiesPriceTotal, totalAmount, amountDue, actualSales, products, emptyReturns, emptyDiscrepancies, rows }) => {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const showChange = cashReceived !== "";
  const change = Math.max(parseFloat(cashReceived || 0) - amountDue, 0);
  
  const [invoiceData, setInvoiceData] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const [paymentTerms, setPaymentTerms] = useState("30 Days");
  const [creditNotes, setCreditNotes] = useState("");

  const getDaysFromTerm = (term) => {
  const num = parseInt(term);
  return isNaN(num) ? 30 : num;
};

  const days = getDaysFromTerm(paymentTerms);
  const paymentDueDate = new Date();
  paymentDueDate.setDate(paymentDueDate.getDate() + days);
  const formattedDueDate = paymentDueDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

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
          <table className="w-full mt-4 border">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Sold Qty (Shell)</th>
                <th className="p-2 text-left">Sold Qty (PC)</th>
                <th className="p-2 text-left">Unit Price</th>
                <th className="p-2 text-left">Discount</th>
                <th className="p-2 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">{row.productName || row.product_name}</td>
                  <td className="p-2">{row.soldShell || 0}</td>
                  <td className="p-2">{row.soldPcs || 0}</td>
                  <td className="p-2">₱{Number(row.unitPrice || 0).toFixed(2)}</td>
                  <td className="p-2">{(Number(row.discount) || 0).toFixed(2)}</td>
                  <td className="p-2">₱{Number(row.actualSale || 0).toFixed(2)}</td>
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
            <div className="ml-4">- Empties Price Total: ₱{Number(emptiesPriceTotal || 0).toFixed(2)}</div>
            <div className="ml-4">- Empty Returns: ₱-{emptyReturns.toFixed(2)}</div>
            <div className="ml-4">
                - Empty Discrepancies: ₱{parseFloat(emptyDiscrepancies || 0).toFixed(2)}
            </div>
            

            <div className="text-blue-600 font-bold">
              Total Amount Due: ₱{totalAmount.toFixed(2)}
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
                {method === "cash" ? "Cash" : method === "credit" ? "Credit" : "E-wallet"}
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

          {/* ✅ CREDIT UI block */}
          {paymentMethod === "credit" && (
            <div className="border p-4 rounded space-y-4">
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">📅 Credit Terms</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1">Payment Terms (Days)</label>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    >
                      <option>7 Days</option>
                      <option>15 Days</option>
                      <option>30 Days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Payment Due Date</label>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1"
                      value={formattedDueDate}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block mb-1">Credit Notes (Optional)</label>
                <textarea
                  rows="3"
                  className="w-full border rounded px-2 py-1"
                  placeholder="Add any special arrangements or notes for this credit transaction..."
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                />
              </div>

              <div className="bg-blue-100 border border-blue-300 p-4 rounded">
                <div className="font-semibold text-blue-700">Credit Amount:</div>
                <div className="flex justify-between items-center mt-1 text-sm">
                  <div>
                    <div><strong>Customer:</strong> Walk-in</div>
                    <div><strong>Due:</strong> {formattedDueDate}</div>
                  </div>
                  <div className="text-2xl font-bold text-blue-800">₱{totalAmount.toFixed(2)}</div>
                </div>
              </div>
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
                rows,                    // ✅ pass product summary
                emptyReturns,
                emptyDiscrepancies,
                actualSales,
                emptiesPriceTotal,
                totalAmount
                
              };
              setInvoiceData(data);              // ✅ store invoice data
              setShowInvoiceModal(true);         // ✅ show the invoice modal
            }}
            disabled={paymentMethod === "cash" && parseFloat(cashReceived) < amountDue} // Optional: prevent underpayment
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
