import React from "react";

const InvoiceModal = ({ onClose, invoiceData }) => {
  const {
    paymentMethod,
    cashReceived,
    change,
    amountDue,
    totalAmount,
    rows,
    actualSales,
    emptyReturns,
    emptyDiscrepancies,
    emptiesPriceTotal
  } = invoiceData;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      
      <div className="bg-white w-full max-w-4xl p-6 rounded-lg overflow-y-auto max-h-[90vh] shadow-lg relative">

        {/* Top Buttons */}
        <div className="flex justify-between items-center mb-4">
          <button className="bg-gray-100 text-black px-3 py-1 rounded hover:bg-gray-200">
            🏠 New Sale
          </button>

          <div className="space-x-2">
            <button className="bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-100">
              ⬇️ Download PDF
            </button>
            <button className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
              🖨️ Print Invoice
            </button>
          </div>
        </div>


        {/* Header */}
        <div className="bg-blue-500 text-white p-4 rounded-md flex justify-between items-center relative">
          <div>
            <h2 className="text-lg font-bold">INVOICE</h2>
            <p className="text-sm">Invoice No: WA-001</p>
          </div>
          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded absolute top-4 right-4">
            PAID
          </span>
        </div>

        {/* From and To */}
        <div className="flex justify-between mt-4 text-sm">
          <div>
            <h4 className="font-semibold">From:</h4>
            <p>Your Company Name<br />
              123 Business Street<br />
              City, State 12345<br />
              Phone: (555) 123-4567</p>
          </div>
          <div>
            <h4 className="font-semibold">To:</h4>
            <p>Walk-in Customer</p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-4">
          <p><strong>Invoice No:</strong> 2324</p>
          <p><strong>Transaction Date:</strong> 08/02/2025 09:13 PM</p>
          <p><strong>Payment Method:</strong> Cash</p>
          <p><strong>Handled By:</strong> Miyaku Kagura</p>
        </div>

        {/* SOLD PRODUCTS */}
        <div className="mt-6">
          <h4 className="font-bold mb-2 text-gray-700">SOLD PRODUCTS</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Dispatched</th>
                <th className="p-2 text-left">Sold</th>
                <th className="p-2 text-left">Unit Price</th>
                <th className="p-2 text-left">Discount</th>
                <th className="p-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(rows) && rows.map((row, index) => (
                <tr key={index}>
                  <td className="border px-2 py-1">{row.productName || row.product_name || "-"}</td>
                  <td className="border px-2 py-1">{`${row.soldShell || 0} shells (${row.soldPcs || 0} pcs)`}</td>
                  <td className="border px-2 py-1">{`${row.soldShell || 0} shells (${row.soldPcs || 0} pcs)`}</td>
                  <td className="border px-2 py-1">₱{(Number(row.unitPrice) || 0).toFixed(2)}</td>
                  <td className="border px-2 py-1">{(Number(row.discount) || 0).toFixed(2)}</td>
                  <td className="border px-2 py-1">₱{(Number(row.actualSale) || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱{(Number(actualSales) || 0).toFixed(2)}
          </p>
        </div>

        {/* EMPTY PRICE */}
        <div className="mt-6">
          <h4 className="font-bold mb-2 text-gray-700">EMPTY PRICE</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Shell Price</th>
                <th className="p-2 text-left">Bottle Price</th>
                <th className="p-2 text-left">Total Shells</th>
                <th className="p-2 text-left">Total Pieces</th>
                <th className="p-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(rows) && rows.map((row, index) => (
                <tr key={index}>
                  <td className="border px-2 py-1">{row.productName || row.product_name || "-"}</td>
                  <td className="border px-2 py-1">₱{(Number(row.shellPrice) || 0).toFixed(2)}</td>
                  <td className="border px-2 py-1">₱{(Number(row.bottlePrice) || 0).toFixed(2)}</td>
                  <td className="border px-2 py-1">{row.soldShell || 0}</td>
                  <td className="border px-2 py-1">{row.soldPcs || 0}</td>
                  <td className="border px-2 py-1">₱{(Number(emptiesPriceTotal) || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱{(Number(emptiesPriceTotal) || 0).toFixed(2)}
          </p>
        </div>

        {/* RETURNS */}
        <div className="mt-6">
          <h4 className="font-bold mb-2 text-gray-700">RETURNS</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Shell Price</th>
                <th className="p-2 text-left">Bottle Price</th>
                <th className="p-2 text-left">Returned Shells</th>
                <th className="p-2 text-left">Returned Pieces</th>
                <th className="p-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(rows) && rows.map((row, index) => {
                const shellPrice = Number(row.shellPrice) || 0;
                const bottlePrice = Number(row.bottlePrice) || 0;
                const returnedShells = Number(row.expectedReturnShellEmpty) || 0;
                const returnedPcs = Number(row.expectedReturnPcsEmpty) || 0;
                const totalValue = (returnedShells * shellPrice) + (returnedPcs * bottlePrice);

                return (
                  <tr key={index}>
                    <td className="border px-2 py-1">{row.productName || row.product_name || "-"}</td>
                    <td className="border px-2 py-1">₱{shellPrice.toFixed(2)}</td>
                    <td className="border px-2 py-1">₱{bottlePrice.toFixed(2)}</td>
                    <td className="border px-2 py-1">{returnedShells}</td>
                    <td className="border px-2 py-1">{returnedPcs}</td>
                    <td className="border px-2 py-1">₱{totalValue.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Subtotal for all returns */}
          <p className="text-right font-semibold mt-1">
            SUBTOTAL: ₱-{(Number(emptyReturns) || 0).toFixed(2)}
          </p>
        </div>

        {/* Payment Summary */}
        <div className="mt-6 text-sm">
    
            <p className="mt-2 text-lg font-bold text-green-600">
              Total Amount Due: ₱{parseFloat(totalAmount || 0).toFixed(2)}
            </p>

            <p className="mt-1 text-sm text-gray-700">
              <strong>Cash Received:</strong> ₱{(Number(cashReceived) || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              <strong>Change:</strong> ₱{(Number(change) || 0).toFixed(2)}
            </p>


        </div>

        {/* Close Button */}
        <div className="text-right mt-6">
          <button
            onClick={onClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
