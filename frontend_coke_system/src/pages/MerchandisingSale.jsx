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
  const [cashReceived, setCashReceived] = useState("");
  const [userCashInput, setUserCashInput] = useState("");

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
        <table className="w-full text-center border border-gray-300 border-collapse">
          <thead className="bg-gray-300">
            <tr>
              <th className="border border-gray-400 p-1 align-bottom">PRODUCT</th>
              <th className="border border-gray-400 p-1" colSpan={2}>DISPATCHED</th>
              <th className="border border-gray-400 p-1" colSpan={2}>SOLD</th>
              <th className="border border-gray-400 p-1" colSpan={2}>RETURNED (Empty)</th>
              <th className="border border-gray-400 p-1" colSpan={2}>DISCREPANCY (Empty)</th>
              <th className="border border-gray-400 p-1" colSpan={2}>RETURNED (With Content/s)</th>
              <th className="border border-gray-400 p-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
              <th className="border border-gray-400 p-1 align-bottom">DISCOUNT (%)</th>
              <th className="border border-gray-400 p-1 align-bottom">EXPECTED SALE</th>
              <th className="border border-gray-400 p-1 align-bottom">ACTUAL SALE</th>
            </tr>
            <tr className="bg-gray-200">
              <td className="border border-gray-400 p-1"></td>
              {[...Array(6)].map((_, i) => (
                <React.Fragment key={i}>
                  <td className="border border-gray-400 p-1 text-xs">Shell</td>
                  <td className="border border-gray-400 p-1 text-xs">PCS</td>
                </React.Fragment>
              ))}
              <td className="border border-gray-400 p-1"></td>
              <td className="border border-gray-400 p-1"></td>
              <td className="border border-gray-400 p-1"></td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="bg-white">
                <td className="border border-gray-300 p-1 bg-gray-100">
                  <div className="w-full p-1 text-sm text-center">{row.productName}</div>
                </td>
                {["dispatchedShell", "dispatchedPcs",
                  "soldShell", "soldPcs",
                  "expectedReturnShellEmpty", "expectedReturnPcsEmpty",
                  "discrepancyShellEmpty", "discrepancyPcsEmpty",
                  "expectedReturnShellNonempty", "expectedReturnPcsNonempty",
                  "discrepancyShellNonempty", "discrepancyPcsNonempty"
                ].map((field, i) => (
                  <td key={i} className="border p-1 w-[72px]">
                    <input
                      type="number"
                      className={`w-full p-1 text-sm text-center ${
                        // Yellow if editable and related to return or sold
                        ["soldShell", "soldPcs", "expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field)
                          ? "bg-yellow-100"
                          : "bg-gray-100"
                      } ${
                        // Red for discrepancy with non-zero
                        field.includes("discrepancy") && parseInt(row[field]) !== 0
                          ? "bg-red-100 text-red-700 font-bold"
                          : ""
                      } ${
                        // Hide arrows for non-shell fields
                        !["soldShell", "soldPcs", "expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field)
                          ? "no-spinner"
                          : ""
                      }`}
                      value={row[field] === 0 ? "" : row[field]}
                      onChange={(e) => handleRowChange(index, field, e.target.value)}
                      disabled={[
                        "dispatchedShell", "dispatchedPcs",
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
                    className={`w-full p-1 text-center no-spinner ${row.soldShell > 0 || row.soldPcs > 0 ? "bg-yellow-100" : "bg-gray-200 cursor-not-allowed"}`}
                    style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "textfield" }}
                    value={row.discount === 0 ? "" : row.discount}
                    onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                    disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
                    title={row.soldShell > 0 || row.soldPcs > 0 ? "Enter discount percentage" : "Enter a sold quantity to enable discount"}
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    className="w-full p-1 bg-gray-100 text-center"
                    disabled
                    value={
                      row.expectedSale !== undefined && row.expectedSale !== null
                        ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : ""
                    }
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    className="w-full p-1 bg-gray-100 text-center"
                    disabled
                    value={
                      row.actualSale !== undefined && row.actualSale !== null
                        ? `₱${parseFloat(row.actualSale).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : ""
                    }
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

            <div className="w-full md:w-1/2 space-y-2">
              <div className="flex items-center gap-4">
                <label className="w-40 text-right">Expected Sale:</label>
                <input className="flex-1 p-1 rounded" value={expectedTotal.toFixed(2)} disabled />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-40 text-right">Actual Sale:</label>
                <input className="flex-1 p-1 rounded" value={actualTotal.toFixed(2)} disabled />
              </div>

              {/* === Misc Charges Section === */}
              <div className="flex items-start gap-4">
                <label className="w-40 text-right pt-2">Miscellaneous Charges:</label>
                <div className="flex-1">
                  <div className="flex gap-2 items-center">
                    <input
                      className="w-full p-1 rounded"
                      value={miscCharges}
                      onChange={(e) => setMiscCharges(e.target.value)}
                      disabled
                    />
                    <input
                      type="checkbox"
                      checked={showMiscDetails}
                      onChange={(e) => setShowMiscDetails(e.target.checked)}
                      className="scale-125"
                    />
                  </div>

                  {showMiscDetails && (
                    <div className="mt-3 space-y-2 bg-gray-100 p-3 rounded shadow">
                      {/* Description */}
                      <div>
                        <label className="block mb-1 text-sm font-medium">Description</label>
                        <input
                          type="text"
                          className="w-full p-2 rounded border"
                          value={miscDescription}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMiscDescription(value);
                            const parts = value
                              .split(",")
                              .map((item) => item.trim())
                              .filter((item) => item !== "");
                            setMiscItems(parts);
                            const updated = { ...miscAmounts };
                            parts.forEach((item) => {
                              if (!(item in updated)) {
                                updated[item] = "";
                              }
                            });
                            setMiscAmounts(updated);
                          }}
                          placeholder="E.g. toll fee, repair, snacks"
                        />
                      </div>

                      {/* Dynamic Inputs */}
                      {miscItems.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <label className="block text-sm font-medium mb-1">Amount per item:</label>
                          {miscItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="w-32 text-right text-sm">{item}:</span>
                              <input
                                type="number"
                                className="flex-1 p-1 rounded border"
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
                                placeholder="₱"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Multiple File Upload */}
                      <div className="mt-4">
                        <label className="block mb-1 text-sm font-medium">Attach Files (Photos/Receipts)</label>
                        <input
                          type="file"
                          className="w-full p-2 rounded border"
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
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {imagePreviewUrls.map((preview, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={preview.url}
                                  alt={`Preview ${index}`}
                                  className="h-24 border rounded cursor-zoom-in"
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
                                  className="absolute top-0 right-0 text-red-600 text-xl w-5 h-5 flex items-center justify-center rounded-full hover:text-red-800"
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
                <label className="w-40 text-right">Overall Discrepancies:</label>
                <input className="flex-1 p-1 rounded" value={discrepancy} disabled />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-40 text-right">Total Amount:</label>
                <input className="flex-1 p-1 rounded" value={actualTotal.toFixed(2)} disabled />
              </div>
              <div className="flex items-center gap-4">
                  <label className="w-40 text-right">Cash Received:</label>
                  <input
                    type="number"
                    className={`flex-1 p-1 rounded border ${
                      cashMismatch ? "bg-red-100 text-red-700 border-red-500 font-semibold" : ""
                    }`}
                    value={userCashInput}
                    onChange={(e) => setUserCashInput(e.target.value)}
                    placeholder="Enter cash amount"
                  />
                </div>



              <div className="flex items-center gap-4">
                <label className="w-40 text-right">Change:</label>
                <input className="flex-1 p-1 rounded" value={change} disabled />
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