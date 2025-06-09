import React from "react";

const Invoice = () => {
  return (
    <div className="invoice-container">
      {/* Header */}
      <header className="header-container">
        <h1 className="header-title">A. Brothers Distributor</h1>
        <div className="header-description-container">
          <p className="header-description">
            Ponong, Samboan, Cebu
          </p>
          <p className="header-description">
            Contact: 430-1038
          </p>
        </div>
      </header>

      {/* Invoice Info */}
      <section className="content-info-wrapper">
        <div className="content-info-container">
          <div className="content-info-left">
            <p><strong>Customer:</strong> ____________</p>
            <p><strong>Invoice Type:</strong> Cash</p>
            <p><strong>Terms:</strong> C.O.D.</p>
          </div>
          <div className="content-info-right text-right">
            <p><strong>Invoice #:</strong> ____________</p>
            <p><strong>REF No.:</strong> ____________</p>
            <p><strong>Date:</strong> 05/24/2025</p>
          </div>
        </div>
      </section>

      {/* Sold Items */}
      <section className="sold-content-wrapper">
        <h2 className="sold-title">Sold Items</h2>
        <table className="sold-table-container">
          <thead className="sold-table-header">
            <tr>
              <th className="border px-2 py-1 text-left">Item</th>
              <th className="border px-2 py-1 text-left">Shell Qty</th>
              <th className="border px-2 py-1 text-right">PC Qty</th>
              <th className="border px-2 py-1 text-right">Discount</th>
              <th className="border px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            
          </tbody>
        </table>
         <div className="container-subtotal">
          <div className="Item-info-left text-left">
            <p><strong>No. of Item :</strong> ____________</p>
          </div>
          <div className="Item-info-right text-right">
              <p><strong>Sub-total :</strong> ____________</p>
          </div>
        </div> 
      </section>
      <section className="empty-content-wrapper">
        <h2 className="empty-title">Empty Price</h2>
        <table className="empty-table-container">
          <thead className="empty-table-header">
            <tr>
              <th className="border px-2 py-1 text-left">Shell Price</th>
              <th className="border px-2 py-1 text-left">PC Price</th>
              <th className="border px-2 py-1 text-left">Shell Qty</th>
              <th className="border px-2 py-1 text-right">PC Qty</th>
              <th className="border px-2 py-1 text-right">Shell Total</th>
              <th className="border px-2 py-1 text-right">PC Total</th>
            </tr>
          </thead>
          <tbody>
            
          </tbody>
        </table>
        <div className="container-subtotal">
          <div className="Item-info-left text-left">
            <p><strong>No. of Item :</strong> ____________</p>
          </div>
          <div className="Item-info-right text-right">
              <p><strong>Sub-total :</strong> ____________</p>
          </div>
        </div> 
      </section>

      {/* Refundables */}
      <section className="mb-4">
        <h2 className="font-semibold mb-2">Refundables</h2>
        <table className="w-full border border-gray-300 text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">Shell Price</th>
              <th className="border px-2 py-1 text-left">PC Price</th>
              <th className="border px-2 py-1 text-left">Shell Qty</th>
              <th className="border px-2 py-1 text-right">PC Qty</th>
              <th className="border px-2 py-1 text-right">Shell Total</th>
              <th className="border px-2 py-1 text-right">PC Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
            </tr>
          </tbody>
        </table>
        <div className="container-subtotal">
          <div className="Item-info-left text-left">
            <p><strong>No. of Item :</strong> ____________</p>
          </div>
          <div className="Item-info-right text-right">
              <p><strong>Sub-total :</strong> ____________</p>
          </div>
        </div> 
      </section>

      {/* Totals */}
      <section className="text-sm border-t pt-2">
        <div className="flex justify-between">
          <span className="font-semibold">Sold Sub-Total:</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Refund Sub-Total:</span>
        </div>
        <div className="flex justify-between border-t mt-1 pt-2 text-lg font-bold">
          <span>Grand Total:</span>
        </div>
      </section>

      {/* Footer */}
      <section className="mt-6 text-xs">
        <p>Printed on: </p>
        <p>Cashier Name: </p>
      </section>

      {/* Print Button */}
      <div className="mt-6 text-center print:hidden">
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Print Invoice
        </button>
      </div>
    </div>
  );
};

export default Invoice;
