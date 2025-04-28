import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";


const MerchandisingSale = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const transactionType = state.transactionType || "";
  const selectedRoute = state.selectedRoute || "";
  const selectedUser = state.selectedUser || "";
  const dateTime = state.dateTime || "";

  const initialRows = (state.products || []).map((product) => ({
    id: Date.now() + Math.random(), // ensure unique id
    productId: product.productId,
    productName: product.productName,
    dispatchedShell: product.dispatchedShell || "",
    dispatchedPcs: product.dispatchedPcs || "",
    soldShell: "",
    soldPcs: "",
    expectedReturnShell: "",
    expectedReturnPcs: "",
    actualReturnShell: "",
    actualReturnPcs: "",
    discrepancyShell: "",
    discrepancyPcs: "",
    sellingPrice: "",
    discount: "",
    expectedSale: "",
    actualSale: ""
  }));

  const [rows, setRows] = useState(initialRows.length > 0 ? initialRows : [
    {
      id: Date.now(),
      productId: "",
      productName: "",
      dispatchedShell: "",
      dispatchedPcs: "",
      soldShell: "",
      soldPcs: "",
      expectedReturnShell: "",
      expectedReturnPcs: "",
      actualReturnShell: "",
      actualReturnPcs: "",
      discrepancyShell: "",
      discrepancyPcs: "",
      sellingPrice: "",
      discount: "",
      expectedSale: "",
      actualSale: ""
    }
  ]);

  const [remarks, setRemarks] = useState("");
  const [miscCharges, setMiscCharges] = useState("");
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [actualTotal, setActualTotal] = useState(0);
  const [discrepancy, setDiscrepancy] = useState(0);

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;

    if (field === "soldShell" || field === "dispatchedShell") {
      updated[index].expectedReturnShell =
        (parseInt(updated[index].dispatchedShell) || 0) -
        (parseInt(updated[index].soldShell) || 0);
    }

    if (field === "soldPcs" || field === "dispatchedPcs") {
      updated[index].expectedReturnPcs =
        (parseInt(updated[index].dispatchedPcs) || 0) -
        (parseInt(updated[index].soldPcs) || 0);
    }

    const pcs = parseInt(updated[index].soldPcs) || 0;
    const price = 100;
    const discount = parseFloat(updated[index].discount) || 0;
    const sale = pcs * price * (1 - discount / 100);
    updated[index].expectedSale = sale.toFixed(2);

    setRows(updated);

    const totalExpected = updated.reduce(
      (sum, r) => sum + parseFloat(r.expectedSale || 0),
      0
    );
    const totalActual = updated.reduce(
      (sum, r) => sum + parseFloat(r.actualSale || 0),
      0
    );
    setExpectedTotal(totalExpected);
    setActualTotal(totalActual);
    const misc = parseFloat(miscCharges) || 0;
    setDiscrepancy((totalExpected - totalActual + misc).toFixed(2));
  };

  return (
    <div className="bg-sky-200 min-h-screen p-6 text-black">
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
        {/* Left column: MSP NO, Transaction Type, Handled By */}
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="block mb-1">MSP NO.</label>
            <input className="w-64 p-2 rounded bg-gray-300" value="" disabled />
          </div>
          <div>
            <label className="block mb-1">Transaction Type</label>
            <input
              className="w-64 p-2 rounded bg-gray-300"
              value={transactionType}
              disabled
            />
          </div>
          <div>
            <label className="block mb-1">Handled By</label>
            <input
              className="w-64 p-2 rounded bg-gray-300"
              value={selectedUser}
              disabled
            />
          </div>
        </div>

        {/* Right column: Date and Time, Route (if Van Load) */}
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="block mb-1">Date and Time</label>
            <input
              type="datetime-local"
              className="w-64 p-2 rounded bg-gray-300"
              value={dateTime}
              disabled
            />
          </div>
          {transactionType === "Van Load" && (
            <div>
              <label className="block mb-1">Route</label>
              <input
                className="w-64 p-2 rounded bg-gray-300"
                value={selectedRoute || ""}
                disabled
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-6">
        <table className="w-full text-center border border-gray-400">
          <thead className="bg-gray-300">
            <tr>
              <th className="border p-1 align-bottom">PRODUCT</th>
              <th className="border p-1" colSpan={2}>DISPATCHED</th>
              <th className="border p-1" colSpan={2}>SOLD</th>
              <th className="border p-1" colSpan={2}>EXPECTED RETURNABLE</th>
              <th className="border p-1" colSpan={2}>ACTUAL RETURNED</th>
              <th className="border p-1" colSpan={2}>DISCREPANCY</th>
              <th className="border p-1 align-bottom">SELLING PRICE</th>
              <th className="border p-1 align-bottom">DISCOUNT (%)</th>
              <th className="border p-1 align-bottom">EXPECTED SALE</th>
              <th className="border p-1 align-bottom">ACTUAL SALE</th>
            </tr>
            <tr className="bg-gray-200">
              <td className="border p-1"></td>
              {[...Array(5)].map((_, i) => (
                <React.Fragment key={i}>
                  <td className="border p-1 text-xs">Shell</td>
                  <td className="border p-1 text-xs">PCS</td>
                </React.Fragment>
              ))}
              <td className="border p-1"></td>
              <td className="border p-1"></td>
              <td className="border p-1"></td>
              <td className="border p-1"></td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="bg-white">
                <td className="border p-1 bg-gray-100">
                  <div className="w-full p-1 text-sm text-center">
                    {row.productName}
                  </div>
                </td>
                {[
                  "dispatchedShell", "dispatchedPcs", "soldShell", "soldPcs",
                  "expectedReturnShell", "expectedReturnPcs",
                  "actualReturnShell", "actualReturnPcs",
                  "discrepancyShell", "discrepancyPcs"
                ].map((field, i) => (
                  <td key={i} className="border p-1 w-[72px]">
                    <input
                      type="number"
                      className="w-full p-1 text-sm bg-gray-100 text-center"
                      value={row[field]}
                      onChange={(e) => handleRowChange(index, field, e.target.value)}
                      disabled={["dispatchedShell", "dispatchedPcs", "expectedReturnShell", "expectedReturnPcs"].includes(field)}
                    />
                  </td>
                ))}
                <td className="border p-1">
                  <input
                    type="number"
                    className="w-full p-1 text-sm bg-gray-100 text-center"
                    value={row.sellingPrice}
                    onChange={(e) => handleRowChange(index, "sellingPrice", e.target.value)}
                  />
                </td>
                <td className="border p-1 w-[96px]">
                  <input
                    type="number"
                    className="w-full p-1 bg-gray-100 text-center"
                    value={row.discount}
                    onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                  />
                </td>
                <td className="border p-1">
                  <input
                    className="w-full p-1 bg-gray-100 text-center"
                    disabled
                    value={row.expectedSale}
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    className="w-full p-1 text-sm bg-gray-100 text-center"
                    value={row.actualSale}
                    onChange={(e) => handleRowChange(index, "actualSale", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary and Remarks */}
      <div className="mt-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-16">
        <div className="w-full md:w-1/2">
          <label className="block mb-1">Remarks:</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full h-28 p-2 rounded"
          ></textarea>
        </div>
        <div className="w-full md:w-1/2 grid grid-cols-2 gap-6">
          <div className="text-right space-y-2">
            <div>Expected Sale:</div>
            <div>Actual Sale:</div>
            <div>Miscellaneous Charges:</div>
            <div>Overall Discrepancies:</div>
          </div>
          <div className="space-y-2">
            <input className="w-full p-1 rounded" value={expectedTotal.toFixed(2)} disabled />
            <input className="w-full p-1 rounded" value={actualTotal.toFixed(2)} disabled />
            <input
              className="w-full p-1 rounded"
              value={miscCharges}
              onChange={(e) => {
                setMiscCharges(e.target.value);
                setDiscrepancy((expectedTotal - actualTotal + parseFloat(e.target.value || 0)).toFixed(2));
              }}
            />
            <input className="w-full p-1 rounded" value={discrepancy} disabled />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
      <button
        className="bg-gray-500 text-white px-6 py-2 rounded"
        onClick={() => {
          const confirmBack = window.confirm("Are you sure you want to go back? Unsaved changes will be lost.");
          if (confirmBack) {
            navigate("/trading");
          }
        }}
      >
        BACK
      </button>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">FINALIZE SALE</button>
      </div>
    </div>
  );
};

export default MerchandisingSale;