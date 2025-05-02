import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

const MerchandisingSale = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const transactionType = state.transactionType || "";
  const selectedRoute = state.selectedRoute || "";
  const selectedUser = state.selectedUser || "";
  const dateTime = state.dateTime || "";
  const customer = state.customer || "";

  const [pricingMap, setPricingMap] = useState({});
  const [rows, setRows] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [miscCharges, setMiscCharges] = useState("");
  const [expectedTotal, setExpectedTotal] = useState(0);
  const actualTotal = 0;
  const [discrepancy, setDiscrepancy] = useState(0);

  useEffect(() => {
    axios.get("http://localhost:8080/api/pricing/")
      .then(res => {
        const map = {};
        res.data.forEach(price => {
          map[price.id] = {
            selling_price: price.selling_price,
            content_no: price.content_no || 0
          };
        });
        setPricingMap(map);
      })
      .catch(err => {
        console.error("Failed to fetch pricing:", err);
      });

    if (state.products) {
      const initialRows = state.products.map((product) => ({
        id: Date.now() + Math.random(),
        productId: product.productId,
        productName: product.productName,
        priceId: product.priceId,
        contentNo: product.contentNo || 0,
        dispatchedShell: product.dispatchedShell || 0,
        dispatchedPcs: product.dispatchedPcs || 0,
        soldShell: 0,
        soldPcs: 0,
        expectedReturnShellEmpty: 0,
        expectedReturnPcsEmpty: 0,
        expectedReturnShellNonempty: 0,
        expectedReturnPcsNonempty: 0,
        discrepancyShellEmpty: 0,
        discrepancyPcsEmpty: 0,
        discrepancyShellNonempty: 0,
        discrepancyPcsNonempty: 0,
        discount: 0,
        expectedSale: 0,
        actualSale: 0,
        manuallyEditedNonemptyReturn: false,
      }));
      setRows(initialRows);
    }
  }, [state.products]);

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
  
    const contentNo = parseInt(updated[index].contentNo) || 0;
    const dispatchedShell = parseInt(updated[index].dispatchedShell) || 0;
    const dispatchedPcs = parseInt(updated[index].dispatchedPcs) || 0;
    let soldShell = parseInt(updated[index].soldShell) || 0;
    let soldPcs = parseInt(updated[index].soldPcs) || 0;
  
    if (field === "soldShell") {
      soldPcs = soldShell * contentNo;
      updated[index].soldPcs = soldPcs;
  
      updated[index].expectedReturnShellEmpty = soldShell;
      updated[index].expectedReturnPcsEmpty = soldShell * contentNo;
    }
  
    // ✅ Predict non-empty return if untouched
    if (!updated[index].manuallyEditedNonemptyReturn) {
      updated[index].expectedReturnShellNonempty = dispatchedShell - soldShell;
      updated[index].expectedReturnPcsNonempty = dispatchedPcs - soldPcs;
    }
  
    // 🔁 Mark as manually edited if user types into non-empty return fields
    if (
      field === "expectedReturnShellNonempty" ||
      field === "expectedReturnPcsNonempty"
    ) {
      updated[index].manuallyEditedNonemptyReturn = true;
    }
  
    // 🟡 Auto-calculate PCS when expected return shell (non-empty) is edited
    if (field === "expectedReturnShellNonempty") {
      const shellVal = parseInt(value) || 0;
      updated[index].expectedReturnPcsNonempty = shellVal * contentNo;
    }
  
    // 🟡 Auto-calculate PCS for expected return (empty)
    if (field === "expectedReturnShellEmpty") {
      const expectedShell = parseInt(value) || 0;
      updated[index].expectedReturnPcsEmpty = expectedShell * contentNo;
    }
  
    // 🔴 Discrepancy (Empty)
    const returnShellEmpty = parseInt(updated[index].expectedReturnShellEmpty) || 0;
    const returnPcsEmpty = parseInt(updated[index].expectedReturnPcsEmpty) || 0;
    updated[index].discrepancyShellEmpty = soldShell - returnShellEmpty;
    updated[index].discrepancyPcsEmpty = soldPcs - returnPcsEmpty;
  
    // 🔴 Discrepancy (Non-empty)
    const returnShellNonempty = parseInt(updated[index].expectedReturnShellNonempty) || 0;
    const returnPcsNonempty = parseInt(updated[index].expectedReturnPcsNonempty) || 0;
    updated[index].discrepancyShellNonempty = dispatchedShell - soldShell - returnShellNonempty;
    updated[index].discrepancyPcsNonempty = dispatchedPcs - soldPcs - returnPcsNonempty;
  
    // 💰 Expected Sale with discount
    const price = parseFloat(pricingMap[updated[index].priceId]?.selling_price) || 0;
    const discount = parseFloat(updated[index].discount) || 0;
    updated[index].expectedSale = (soldPcs * price * (1 - discount / 100)).toFixed(2);
  
    setRows(updated);
  
    const totalExpected = updated.reduce((sum, r) => sum + parseFloat(r.expectedSale || 0), 0);
    setExpectedTotal(totalExpected);
  
    const misc = parseFloat(miscCharges) || 0;
    setDiscrepancy((totalExpected - actualTotal + misc).toFixed(2));
  };
  

  return (
    <div className="bg-sky-200 min-h-screen p-6 text-black">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div><label className="block mb-1">MSP NO.</label><input className="w-64 p-2 rounded bg-gray-300" value="" disabled /></div>
          <div><label className="block mb-1">Transaction Type</label><input className="w-64 p-2 rounded bg-gray-300" value={transactionType} disabled /></div>
          <div><label className="block mb-1">Handled By</label><input className="w-64 p-2 rounded bg-gray-300" value={selectedUser} disabled /></div>
          <div><label className="block mb-1">Customer</label><input className="w-64 p-2 rounded bg-gray-300" value={customer} disabled /></div>
        </div>
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div><label className="block mb-1">Date and Time</label><input type="datetime-local" className="w-64 p-2 rounded bg-gray-300" value={dateTime} disabled /></div>
          {transactionType === "Van Load" && (
            <div><label className="block mb-1">Route</label><input className="w-64 p-2 rounded bg-gray-300" value={selectedRoute || ""} disabled /></div>
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
              <th className="border p-1" colSpan={2}>EXPECTED RETURN (Empty)</th>
              <th className="border p-1" colSpan={2}>DISCREPANCY (Empty)</th>
              <th className="border p-1" colSpan={2}>EXPECTED RETURN (Non-empty)</th>
              <th className="border p-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
              <th className="border p-1 align-bottom">DISCOUNT (%)</th>
              <th className="border p-1 align-bottom">EXPECTED SALE</th>
              <th className="border p-1 align-bottom">ACTUAL SALE</th>
            </tr>
            <tr className="bg-gray-200">
              <td className="border p-1"></td>
              {[...Array(6)].map((_, i) => (
                <React.Fragment key={i}>
                  <td className="border p-1 text-xs">Shell</td>
                  <td className="border p-1 text-xs">PCS</td>
                </React.Fragment>
              ))}
              <td className="border p-1"></td><td className="border p-1"></td><td className="border p-1"></td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="bg-white">
                <td className="border p-1 bg-gray-100"><div className="w-full p-1 text-sm text-center">{row.productName}</div></td>
                {[
                  "dispatchedShell", "dispatchedPcs",
                  "soldShell", "soldPcs",
                  "expectedReturnShellEmpty", "expectedReturnPcsEmpty",
                  "discrepancyShellEmpty", "discrepancyPcsEmpty",
                  "expectedReturnShellNonempty", "expectedReturnPcsNonempty",
                  "discrepancyShellNonempty", "discrepancyPcsNonempty"
                ].map((field, i) => (
                  <td key={i} className="border p-1 w-[72px]">
                    <input
                      type="number"
                      className={`w-full p-1 text-sm text-center
                        ${["soldShell","expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field) ? "bg-yellow-100" : "bg-gray-100"}
                        ${field.includes("discrepancy") && parseInt(row[field]) !== 0 ? "bg-red-100 text-red-700 font-bold" : ""}
                      `}
                      value={row[field]}
                      onChange={(e) => handleRowChange(index, field, e.target.value)}
                      disabled={[
                        "dispatchedShell", "dispatchedPcs",
                        "soldPcs",
                        "discrepancyShellEmpty", "discrepancyPcsEmpty",
                        "discrepancyShellNonempty", "discrepancyPcsNonempty"
                      ].includes(field)}
                    />
                  </td>
                ))}
                <td className="border p-1 w-[96px]">
                <input
  type="number"
  inputMode="decimal"
  className={`w-full p-1 text-center appearance-none focus:outline-none ${
    row.soldShell > 0 || row.soldPcs > 0 ? "bg-yellow-100" : "bg-gray-200 cursor-not-allowed"
  }`}
  style={{
    MozAppearance: "textfield",        // Firefox
    WebkitAppearance: "none",          // Chrome/Safari
  }}
  value={row.discount}
  onChange={(e) => handleRowChange(index, "discount", e.target.value)}
  disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
  title={row.soldShell > 0 || row.soldPcs > 0 ? "Enter discount percentage" : "Enter a sold quantity to enable discount"}
/>


                </td>
                <td className="border p-1"><input className="w-full p-1 bg-gray-100 text-center" disabled value={row.expectedSale} /></td>
                <td className="border p-1"><input type="number" className="w-full p-1 bg-gray-100 text-center"
                  value={row.actualSale}
                  onChange={(e) => handleRowChange(index, "actualSale", e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary & Buttons */}
      <div className="mt-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-16">
        <div className="w-full md:w-1/2">
          <label className="block mb-1">Remarks:</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full h-28 p-2 rounded"></textarea>
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
        <button className="bg-gray-500 text-white px-6 py-2 rounded"
          onClick={() => {
            const confirmBack = window.confirm("Are you sure you want to go back? Unsaved changes will be lost.");
            if (confirmBack) {
              navigate("/merchandising");
            }
          }}
        >BACK</button>
        <button className="bg-blue-600 text-white px-6 py-2 rounded">FINALIZE SALE</button>
      </div>
    </div>
  );
};

export default MerchandisingSale;