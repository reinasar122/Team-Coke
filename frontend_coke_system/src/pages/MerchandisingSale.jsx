import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

const MerchandisingSale = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const mspNo = state.mspNo || "";
  const transactionType = state.transactionType || "";
  const selectedRoute = state.selectedRoute || "";
  const selectedUser = state.selectedUser || "";
  const dateTime = state.dateTime || "";
  const customer = state.customer || "";

  const [remarks, setRemarks] = useState("");
  const [miscCharges, setMiscCharges] = useState("");
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [actualTotal, setActualTotal] = useState(0);
  const [discrepancy, setDiscrepancy] = useState(0);
  const [change, setChange] = useState("");
  const [showMiscDetails, setShowMiscDetails] = useState(false);
  const [miscDescription, setMiscDescription] = useState("");
  const [miscFiles, setMiscFiles] = useState([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  const [zoomed, setZoomed] = useState(null);
  const [miscItems, setMiscItems] = useState([]);
  const [miscAmounts, setMiscAmounts] = useState({});
  const [rows, setRows] = useState([]);
  const [pricingMap, setPricingMap] = useState({});
  const [cashMismatch, setCashMismatch] = useState(false);
  const [userCashInput, setUserCashInput] = useState("");
  const [cashReceived, setCashReceived] = useState("");

  useEffect(() => {
  const userCash = parseFloat(userCashInput) || 0;
  const misc = parseFloat(miscCharges) || 0;
  const totalCash = userCash + misc;
  const total = parseFloat(actualTotal) || 0;

  setCashReceived(totalCash.toFixed(2));
  setChange(!isNaN(totalCash - total) ? (totalCash - total).toFixed(2) : "");
  setCashMismatch(totalCash.toFixed(2) !== total.toFixed(2));
}, [userCashInput, miscCharges, actualTotal]);

  useEffect(() => {
    axios.get("http://localhost:8080/api/pricing/")
      .then(res => {
        const map = {};
        res.data.forEach(price => {
          map[price.id] = {
            selling_price: price.selling_price,
            shell_price: price.shell_price,
            bottle_price: price.bottle_price,
            content_no: price.content_no || 0
          };
        });
        setPricingMap(map);

        if (state.products) {
          const initialRows = state.products.map((product) => {
            const priceId = product.price?.id || product.priceId || product.price_id || null;
            const soldShell = transactionType === "Warehouse" ? product.dispatchedShell : 0;
            const soldPcs = transactionType === "Warehouse" ? product.dispatchedPcs : 0;
            return {
              id: Date.now() + Math.random(),
              productId: product.productId,
              productName: product.productName,
              priceId: priceId,
              contentNo: product.contentNo || 0,
              dispatchedShell: product.dispatchedShell || 0,
              dispatchedPcs: product.dispatchedPcs || 0,
              soldShell: soldShell,
              soldPcs: soldPcs,
              expectedReturnShellEmpty: soldShell,
              expectedReturnPcsEmpty: soldShell * (product.contentNo || 0),
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
            };
          });

          const recalculated = initialRows.map((row) => {
            const pricing = map[row.priceId];
            if (!pricing) return row;
            const sellingPrice = parseFloat(pricing.selling_price) || 0;
            const shellPrice = parseFloat(pricing.shell_price) || 0;
            const discount = parseFloat(row.discount) || 0;

            const expectedSale = (row.dispatchedPcs * sellingPrice) + (row.dispatchedShell * shellPrice);
            row.expectedSale = parseFloat((expectedSale * (1 - discount / 100)).toFixed(2));
            return row;
          });

          setRows(recalculated);
        }
      })
      .catch(err => {
        console.error("Failed to fetch pricing:", err);
      });
  }, [state.products, transactionType]);

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value === "" ? "" : parseFloat(value);

    const contentNo = parseFloat(updated[index].contentNo) || 0;
    const dispatchedShell = parseFloat(updated[index].dispatchedShell) || 0;
    const dispatchedPcs = parseFloat(updated[index].dispatchedPcs) || 0;
    let soldShell = parseFloat(updated[index].soldShell) || 0;
    let soldPcs = parseFloat(updated[index].soldPcs) || 0;

    if (field === "soldShell") {
      soldPcs = soldShell * contentNo;
      updated[index].soldPcs = soldPcs;
      updated[index].expectedReturnShellEmpty = soldShell;
      updated[index].expectedReturnPcsEmpty = soldShell * contentNo;
    }
    if (field === "soldPcs") {
      soldShell = Math.floor(soldPcs / contentNo);
      updated[index].soldShell = soldShell;
      updated[index].expectedReturnShellEmpty = soldShell;
      updated[index].expectedReturnPcsEmpty = soldPcs;
    }

    if (!updated[index].manuallyEditedNonemptyReturn) {
      updated[index].expectedReturnShellNonempty = dispatchedShell - soldShell;
      updated[index].expectedReturnPcsNonempty = dispatchedPcs - soldPcs;
    }

    if (
      field === "expectedReturnShellNonempty" ||
      field === "expectedReturnPcsNonempty"
    ) {
      updated[index].manuallyEditedNonemptyReturn = true;
    }

    if (field === "expectedReturnShellNonempty") {
      const shellVal = parseFloat(value) || 0;
      updated[index].expectedReturnPcsNonempty = shellVal * contentNo;
    }

    if (field === "expectedReturnShellEmpty") {
      const expectedShell = parseFloat(value) || 0;
      updated[index].expectedReturnPcsEmpty = expectedShell * contentNo;
    }

    const returnShellEmpty = parseFloat(updated[index].expectedReturnShellEmpty) || 0;
    const returnPcsEmpty = parseFloat(updated[index].expectedReturnPcsEmpty) || 0;
    updated[index].discrepancyShellEmpty = soldShell - returnShellEmpty;
    updated[index].discrepancyPcsEmpty = soldPcs - returnPcsEmpty;

    const returnShellNonempty = parseFloat(updated[index].expectedReturnShellNonempty) || 0;
    const returnPcsNonempty = parseFloat(updated[index].expectedReturnPcsNonempty) || 0;
    updated[index].discrepancyShellNonempty = dispatchedShell - soldShell - returnShellNonempty;
    updated[index].discrepancyPcsNonempty = dispatchedPcs - soldPcs - returnPcsNonempty;

    const priceId = updated[index].priceId;
    const pricing = pricingMap[priceId];

    if (!pricing) {
      console.warn(`No pricing found for priceId: ${priceId}`);
      updated[index].expectedSale = 0;
      setRows(updated);
      return;
    }

    const sellingPrice = parseFloat(pricing.selling_price) || 0;
    const shellPrice = parseFloat(pricing.shell_price) || 0;
    const bottlePrice = parseFloat(pricing.bottle_price) || 0;
    const discount = parseFloat(updated[index].discount) || 0;

    const expectedSale = (dispatchedPcs * sellingPrice) + (dispatchedShell * shellPrice);
    updated[index].expectedSale = parseFloat((expectedSale * (1 - discount / 100)).toFixed(2));

    const discrepancyShellEmpty = updated[index].discrepancyShellEmpty;
    const discrepancyPcsEmpty = updated[index].discrepancyPcsEmpty;

    const actualSaleRaw = (soldPcs * sellingPrice)
      + (discrepancyShellEmpty * shellPrice)
      + (discrepancyPcsEmpty * bottlePrice);
    const discountAmount = actualSaleRaw * (discount / 100);
    const finalActualSale = actualSaleRaw - discountAmount;

    updated[index].actualSale = parseFloat(finalActualSale.toFixed(2));

    setRows(updated);

    const totalExpected = updated.reduce((sum, r) => sum + parseFloat(r.expectedSale || 0), 0);
    const totalActual = updated.reduce((sum, r) => sum + parseFloat(r.actualSale || 0), 0);

    setExpectedTotal(totalExpected);
    setActualTotal(totalActual);

    const misc = parseFloat(miscCharges) || 0;
    setDiscrepancy((totalExpected - totalActual + misc).toFixed(2));
  };


  return (
    <div className="bg-sky-200 min-h-screen p-6 text-black">
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
           <label className="block mb-1">MSP NO.</label>
            <input
              className="w-64 p-2 rounded bg-gray-300"
              value={mspNo}
              disabled
            />
          </div>
          <div><label className="block mb-1">Transaction Type</label><input className="w-64 p-2 rounded bg-gray-300" value={transactionType} disabled /></div>
          <div><label className="block mb-1">Handled By</label><input className="w-64 p-2 rounded bg-gray-300" value={selectedUser} disabled /></div>
        </div>
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div><label className="block mb-1">Date and Time</label><input type="datetime-local" className="w-64 p-2 rounded bg-gray-300" value={dateTime} disabled /></div>
          {transactionType === "Warehouse" && (
            <div>
              <label className="block mb-1">Customer</label>
              <input className="w-64 p-2 rounded bg-gray-300" value={customer} disabled />
            </div>
          )}
          {transactionType === "Van Load" && (
            <div><label className="block mb-1">Route</label><input className="w-64 p-2 rounded bg-gray-300" value={selectedRoute || ""} disabled /></div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto mt-6">
  <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm">
    <thead className="bg-gray-100 text-gray-800">
      <tr className="text-xs font-semibold">
        <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
        <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
        <th className="border border-gray-300 py-2 px-1" colSpan={2}>SOLD</th>
        <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (Empty)</th>
        <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Empty)</th>
        <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (With Content/s)</th>
        <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
        <th className="border border-gray-300 py-2 px-1">DISCOUNT (%)</th>
        <th className="border border-gray-300 py-2 px-1">EXPECTED SALE</th>
        <th className="border border-gray-300 py-2 px-1">ACTUAL SALE</th>
      </tr>
      <tr className="bg-gray-200">
        <td className="border border-gray-300 py-1"></td>
        {[...Array(6)].map((_, i) => (
          <React.Fragment key={i}>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          </React.Fragment>
        ))}
        <td className="border border-gray-300 py-1"></td>
        <td className="border border-gray-300 py-1"></td>
        <td className="border border-gray-300 py-1"></td>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        <tr key={row.id} className="bg-white hover:bg-gray-50 transition duration-150">
          <td className="border border-gray-200 py-1 px-2 bg-gray-50 font-medium text-left">{row.productName}</td>
          {["dispatchedShell", "dispatchedPcs", "soldShell", "soldPcs", "expectedReturnShellEmpty", "expectedReturnPcsEmpty", "discrepancyShellEmpty", "discrepancyPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty", "discrepancyShellNonempty", "discrepancyPcsNonempty"].map((field, i) => (
            <td key={i} className="border border-gray-200 py-1 px-1 w-[72px]">
              <input
                type="number"
                className={`w-full p-1 text-sm text-center rounded focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all duration-100 ${["soldShell", "soldPcs", "expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field) ? "bg-yellow-50" : "bg-gray-100"} ${field.includes("discrepancy") && parseInt(row[field]) !== 0 ? "bg-red-100 text-red-700 font-semibold" : ""}`}
                value={row[field] === 0 ? "" : row[field]}
                onChange={(e) => handleRowChange(index, field, e.target.value)}
                disabled={["dispatchedShell", "dispatchedPcs", "discrepancyShellEmpty", "discrepancyPcsEmpty", "discrepancyShellNonempty", "discrepancyPcsNonempty"].includes(field)}
              />
            </td>
          ))}
          <td className="border border-gray-200 py-1 px-1">
            <input
              type="number"
              inputMode="decimal"
              className={`w-full p-1 text-center rounded bg-white border ${row.soldShell > 0 || row.soldPcs > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"}`}
              value={row.discount === 0 ? "" : row.discount}
              onChange={(e) => handleRowChange(index, "discount", e.target.value)}
              disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
              title={row.soldShell > 0 || row.soldPcs > 0 ? "Enter discount percentage" : "Enter a sold quantity to enable discount"}
            />
          </td>
          <td className="border border-gray-200 py-1 px-1">
            <input
              className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
              disabled
              value={row.expectedSale ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
            />
          </td>
          <td className="border border-gray-200 py-1 px-1">
            <input
              className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
              disabled
              value={row.actualSale ? `₱${parseFloat(row.actualSale).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
            />
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
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full h-28 p-2 rounded"
              />
            </div>

            <div className="w-full md:w-1/2 space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-40 text-right text-sm font-medium text-gray-700">Expected Sale:</label>
                <input
                  className="flex-1 p-2 rounded border border-gray-300 bg-gray-100 text-right font-semibold text-gray-800 shadow-sm"
                  value={`₱${expectedTotal.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  disabled
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-40 text-right text-sm font-medium text-gray-700">Actual Sale:</label>
                <input
                  className="flex-1 p-2 rounded border border-gray-300 bg-gray-100 text-right font-semibold text-gray-800 shadow-sm"
                  value={`₱${actualTotal.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  disabled
                />
              </div>

              {/* === Misc Charges Section === */}
              <div className="flex items-start gap-4">
                <label className="w-40 text-right pt-2 font-medium text-gray-700">Miscellaneous Charges:</label>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      className="w-full p-2 border rounded shadow-sm bg-gray-100 text-right font-semibold text-gray-700"
                      value={miscCharges}
                      onChange={(e) => setMiscCharges(e.target.value)}
                      disabled
                    />
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                      <input
                        type="checkbox"
                        checked={showMiscDetails}
                        onChange={(e) => setShowMiscDetails(e.target.checked)}
                        className="scale-125 accent-blue-600"
                      />
                      <span>Details</span>
                    </label>
                  </div>

                  {showMiscDetails && (
                    <div className="bg-white border rounded-lg shadow p-4 space-y-4">
                      {/* Description Input */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Descriptions (comma separated)</label>
                        <input
                          type="text"
                          className="w-full p-2 border rounded shadow-sm"
                          value={miscDescription}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMiscDescription(value);
                            const parts = value.split(",").map((item) => item.trim()).filter((item) => item !== "");
                            setMiscItems(parts);
                            const updated = { ...miscAmounts };
                            parts.forEach((item) => {
                              if (!(item in updated)) updated[item] = "";
                            });
                            setMiscAmounts(updated);
                          }}
                          placeholder="E.g. toll fee, repair, snacks"
                        />
                      </div>

                      {/* Amount per Item */}
                      {miscItems.length > 0 && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Amount per Item</label>
                          <div className="space-y-2">
                            {miscItems.map((item, index) => (
                              <div key={index} className="flex items-center gap-3">
                                <span className="w-32 text-right text-sm text-gray-600">{item}:</span>
                                <input
                                  type="number"
                                  className="flex-1 p-2 border rounded shadow-sm text-right"
                                  placeholder="₱"
                                  value={miscAmounts[item] || ""}
                                  onChange={(e) => {
                                    const updated = { ...miscAmounts };
                                    updated[item] = e.target.value;
                                    setMiscAmounts(updated);
                                    const total = Object.values(updated)
                                      .map((val) => parseFloat(val) || 0)
                                      .reduce((sum, val) => sum + val, 0);
                                    setMiscCharges(total.toFixed(2));
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* File Upload Section */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Attach Files (Photos/Receipts)</label>
                        <input
                          type="file"
                          className="w-full p-2 border rounded"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            const previews = files.map((file) => ({
                              file,
                              url: URL.createObjectURL(file),
                            }));
                            setMiscFiles((prev) => [...prev, ...files]);
                            setImagePreviewUrls((prev) => [...prev, ...previews]);
                          }}
                        />
                        {imagePreviewUrls.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {imagePreviewUrls.map((preview, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={preview.url}
                                  alt={`Preview ${index}`}
                                  className="h-24 w-24 object-cover border rounded shadow cursor-zoom-in"
                                  onClick={() => setZoomed(preview.url)}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedPreviews = [...imagePreviewUrls];
                                    const updatedFiles = [...miscFiles];
                                    updatedPreviews.splice(index, 1);
                                    updatedFiles.splice(index, 1);
                                    setImagePreviewUrls(updatedPreviews);
                                    setMiscFiles(updatedFiles);
                                  }}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* Totals */}
              <div className="flex items-center gap-4">
                <label className="w-40 text-right font-medium text-gray-700">Overall Discrepancy:</label>
                <div className="flex-1 text-right pr-2 text-lg font-semibold bg-gray-50 border border-gray-300 rounded py-2 px-3 shadow-sm">
                  ₱{parseFloat(discrepancy || 0).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-40 text-right font-medium">Total Amount:</label>
                <input
                  className="flex-1 p-2 border rounded bg-gray-50 text-right"
                  value={`₱${parseFloat(actualTotal || 0).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  disabled
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-40 text-right font-medium">User Cash:</label>
                <input
                  type="number"
                  className="flex-1 p-2 rounded border"
                  value={userCashInput}
                  onChange={(e) => setUserCashInput(e.target.value)}
                  placeholder="Enter user cash"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-40 text-right font-medium">Cash Received (with Misc):</label>
                <div className="flex-1 text-right pr-2 font-semibold text-lg">
                  <span className={cashMismatch ? "text-red-600" : "text-green-700"}>
                    ₱{parseFloat(cashReceived || 0).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>



              <div className="flex items-center gap-4">
                <label className="w-40 text-right font-medium">Change:</label>
                <input
                  className="flex-1 p-2 border rounded bg-gray-50 text-right"
                  value={`₱${parseFloat(change || 0).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  disabled
                />
              </div>
            </div>
          </div>


            {/* Buttons */}
            <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
              <button
                className="bg-gray-500 text-white px-6 py-2 rounded"
                onClick={() => {
                  const confirmBack = window.confirm("Are you sure you want to go back? Unsaved changes will be lost.");
                  if (confirmBack) {
                    navigate("/merchandising", {
                      state: {
                        mspNo,
                        transactionType,
                        selectedUser,
                        selectedRoute,
                        selectedVan: state.selectedVan || "",
                        dateTime,
                        customer: customer,
                        customerId: state.customerId || "",
                        products: rows.map((row) => ({
                          productId: row.productId,
                          productName: row.productName,
                          dispatchedShell: row.dispatchedShell,
                          dispatchedPcs: row.dispatchedPcs,
                          contentNo: row.contentNo,
                          priceId: row.priceId,
                        })),
                      },
                    });
                  }
                }}
              >
                BACK
              </button>
              <button className="bg-blue-600 text-white px-6 py-2 rounded">FINALIZE SALE</button>
            </div>

            {/* 🔍 Image Zoom Overlay */}
            {zoomed && (
              <div
                className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
                onClick={() => setZoomed(null)}
              >
                <img
                  src={zoomed}
                  alt="Zoomed"
                  className="max-w-[90%] max-h-[90%] rounded shadow-lg"
                />
              </div>
            )}
          </div>
        );
      };

export default MerchandisingSale;