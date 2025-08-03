import React from "react";

const InvoiceModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-4xl p-6 rounded-lg overflow-y-auto max-h-[90vh] shadow-lg relative">
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
            <p>Walk-in Customer<br />
              Customer Address<br />
              City, State</p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-4">
          <p><strong>Invoice Date:</strong> 8/4/2025, 4:47:12 AM</p>
          <p><strong>Transaction Date:</strong> 08/02/2025 09:13 PM</p>
          <p><strong>Payment Method:</strong> Cash</p>
          <p><strong>Handled By:</strong> Miyaku Kagura</p>
        </div>

        {/* Product Details */}
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Product Details</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 text-left">Product</th>
                <th className="border px-2 py-1 text-left">Dispatched</th>
                <th className="border px-2 py-1 text-left">Sold</th>
                <th className="border px-2 py-1 text-left">Unit Price</th>
                <th className="border px-2 py-1 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">Red Horse Strong Beer</td>
                <td className="border px-2 py-1">2 shells (24 pcs)</td>
                <td className="border px-2 py-1">2 shells (24 pcs)</td>
                <td className="border px-2 py-1">₱60.00</td>
                <td className="border px-2 py-1">₱1440.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Returns & Discrepancies */}
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Returns & Discrepancies</h4>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Product</th>
                <th className="border px-2 py-1">Empty Returns</th>
                <th className="border px-2 py-1">Empty Discrepancies</th>
                <th className="border px-2 py-1">Non-Empty Returns</th>
                <th className="border px-2 py-1">Non-Empty Discrepancies</th>
                <th className="border px-2 py-1">Empty Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">Red Horse Strong Beer</td>
                <td className="border px-2 py-1">1 shell (12 pcs)</td>
                <td className="border px-2 py-1">1 shell (12 pcs)</td>
                <td className="border px-2 py-1">0 shell (0 pcs)</td>
                <td className="border px-2 py-1">0 shell (0 pcs)</td>
                <td className="border px-2 py-1">Shell: ₱50<br />Bottle: ₱5</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Summary */}
        <div className="mt-6 text-sm">
          <h4 className="font-semibold mb-2">Payment Summary</h4>
          <p><strong>Actual Sales:</strong> ₱1440.00</p>
          <div className="pl-4 mt-2">
            <p className="font-medium">Adjustments & Credits:</p>
            <ul className="list-disc list-inside">
              <li>Empty Returns Credit: + ₱110.00</li>
              <li>Empty Discrepancies Credit: + ₱110.00</li>
            </ul>
            <p className="mt-1"><strong>Total Credits:</strong> ₱220.00</p>
          </div>
          <p className="mt-2 text-lg font-bold text-blue-600">
            Total Amount Paid: ₱1550.00
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
