
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const ProductTable = ({ rows, setRows, products, selectedTransactionTypeName, miscItems = [] }) => {
  const isVanLoad = selectedTransactionTypeName === "Van Load";
  const [pricingMap, setPricingMap] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const totalExpectedSale = useMemo(() => rows.reduce((sum, row) => sum + Number(row.expectedSale || 0), 0), [rows]);
  const totalActualSale = useMemo(() => rows.reduce((sum, row) => sum + Number(row.actualSale || 0), 0), [rows]);
  
  const handleProductChange = (index, productId) => {
  const updatedRows = [...rows];
  updatedRows[index].productId = productId;

  const fetchStockQuantity = async (productId) => {
  try {
    const response = await axios.get(`http://localhost:8080/api/stocks/${productId}/`);
    setAvailableStock((prev) => ({
      ...prev,
      [productId]: response.data.quantity_available,
    }));
  } catch (err) {
    console.error("Error fetching stock:", err);
  }
};

  const selectedProduct = products.find((p) => p.id === parseInt(productId));
  if (selectedProduct) {
    updatedRows[index].productName = selectedProduct.product_name;
    updatedRows[index].priceId = selectedProduct.price.id;
    updatedRows[index].contentNo = selectedProduct.unit_type.content_no;

    // ✅ Fetch stock for selected product
    fetchStockQuantity(productId);
  }
   setRows(updatedRows);

  // ✅ Automatically add a new row if current is last and selected
  if (index === rows.length - 1 && productId) {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: "",
        productName: "",
        priceId: "",
        dispatchedShell: "",
        dispatchedPcs: "",
        soldShell: "",
        soldPcs: "",
        expectedReturnShellEmpty: "",
        expectedReturnPcsEmpty: "",
        expectedReturnShellNonempty: "",
        expectedReturnPcsNonempty: "",
        discrepancyShellEmpty: "",
        discrepancyPcsEmpty: "",
        discrepancyShellNonempty: "",
        discrepancyPcsNonempty: "",
        discount: "",
        expectedSale: "",
        actualSale: "",
        contentNo: "",
      },
    ]);
  }
};

  const handleRowChange = (index, field, value) => {
    const updatedRows = [...rows];
    updatedRows[index][field] = value;

    const product = products.find(p => p.id === parseInt(updatedRows[index].product_id));
    const price = product ? parseFloat(product.price_per_case || 0) : 0;
    const sold = parseInt(updatedRows[index].sold || 0);

    updatedRows[index].expected_sale = price * parseInt(updatedRows[index].dispatched || 0);
    updatedRows[index].actual_sale = price * sold;
    updatedRows[index].discrepancy = updatedRows[index].expected_sale - updatedRows[index].actual_sale;

    setRows(updatedRows);
  };

  const expectedSale = rows.reduce((sum, row) => {
    const product = products.find(p => p.id === parseInt(row.product_id));
    const price = product?.price_per_case || 0;
    return sum + price * (parseInt(row.dispatched || 0));
  }, 0);

  const actualSale = rows.reduce((sum, row) => {
    const product = products.find(p => p.id === parseInt(row.product_id));
    const price = product?.price_per_case || 0;
    return sum + price * (parseInt(row.sold || 0));
  }, 0);

  

return (
  <div className="overflow-x-auto mt-6">
    <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm">
      <thead className="bg-gray-100 text-gray-800">
        <tr className="text-xs font-semibold">
          <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
          <th className="border border-gray-300 py-2 px-1">SELLING PRICE</th>
          {!isVanLoad && (
            <>
              <th className="border border-gray-300 py-2 px-1" colSpan={2}>SOLD</th>
            </>
          )}
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>PRICE (Shell/Bottle)</th>
          {!isVanLoad && (
            <>
              <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (Empty)</th>
              <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Empty)</th>
              <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (With Content/s)</th>
              <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
              <th className="border border-gray-300 py-2 px-1">DISCOUNT (%)</th>
            </>
          )}
          <th className="border border-gray-300 py-2 px-1">EXPECTED SALE</th>
          {!isVanLoad && (
            <th className="border border-gray-300 py-2 px-1">ACTUAL SALE</th>
          )}
        </tr>
        {/* Subheaders */}
        <tr className="bg-gray-200">
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1"></td>
          {!isVanLoad && (
            <>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            </>
          )}
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Bottle</td>
          {!isVanLoad && (
            <>
              {Array(8).fill(null).map((_, i) => (
                <td key={i} className="border border-gray-300 py-1 text-[11px] font-medium">
                  {i % 2 === 0 ? "Shell" : "PCS"}
                </td>
              ))}
              <td className="border border-gray-300 py-1"></td>
            </>
          )}
          <td className="border border-gray-300 py-1"></td>
          {!isVanLoad && <td className="border border-gray-300 py-1"></td>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} className="bg-white hover:bg-gray-50 transition duration-150">
            {/* PRODUCT SELECT */}
            <td className="border border-gray-200 py-1 px-1 w-[120px]">
              <select
                className="w-full p-1 text-sm text-center rounded bg-white border"
                value={row.productId}
                onChange={(e) => handleProductChange(index, e.target.value)}
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name}
                  </option>
                ))}
              </select>
            </td>
            {/* DISPATCHED */}
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                className="w-full p-1 text-sm text-center rounded bg-white"
                value={row.dispatchedShell || ""}
                onChange={(e) => handleRowChange(index, "dispatchedShell", e.target.value)}
              />
            </td>
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                className="w-full p-1 text-sm text-center rounded bg-white"
                value={row.dispatchedPcs || ""}
                onChange={(e) => handleRowChange(index, "dispatchedPcs", e.target.value)}
              />
            </td>
            {/* SELLING PRICE */}
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                disabled
                className="w-full p-1 text-sm text-center bg-gray-100"
                value={pricingMap[row.priceId]?.selling_price || ""}
              />
            </td>
            {!isVanLoad && (
              <>
                {/* SOLD */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                    value={row.soldShell || ""}
                    onChange={(e) => handleRowChange(index, "soldShell", e.target.value)}
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                    value={row.soldPcs || ""}
                    onChange={(e) => handleRowChange(index, "soldPcs", e.target.value)}
                  />
                </td>
              </>
            )}
            {/* EMPTY PRICES */}
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                className="w-full p-1 text-sm text-center bg-gray-100"
                value={pricingMap[row.priceId]?.shell_price || ""}
                disabled
              />
            </td>
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                className="w-full p-1 text-sm text-center bg-gray-100"
                value={pricingMap[row.priceId]?.bottle_price || ""}
                disabled
              />
            </td>
            {!isVanLoad && (
              <>
                {/* RETURN & DISCREPANCY FIELDS */}
                {[
                  "expectedReturnShellEmpty", "expectedReturnPcsEmpty",
                  "discrepancyShellEmpty", "discrepancyPcsEmpty",
                  "expectedReturnShellNonempty", "expectedReturnPcsNonempty",
                  "discrepancyShellNonempty", "discrepancyPcsNonempty"
                ].map((field, i) => (
                  <td key={i} className="border border-gray-200 py-1 px-1">
                    <input
                      type="number"
                      value={row[field] === 0 ? "" : row[field]}
                      onChange={(e) => handleRowChange(index, field, e.target.value)}
                      disabled={["discrepancyShellEmpty", "discrepancyPcsEmpty", "discrepancyShellNonempty", "discrepancyPcsNonempty"].includes(field)}
                      className={`w-full p-1 text-sm text-center rounded
                        ${["expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field) ? "bg-yellow-50" : "bg-gray-100"}
                        ${field.includes("discrepancy") && parseInt(row[field]) !== 0 ? "bg-red-100 text-red-700 font-semibold" : ""}`}
                    />
                  </td>
                ))}
              </>
            )}
            {/* DISCOUNT */}
            {!isVanLoad && (
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className={`w-full p-1 text-sm text-center rounded border ${
                    row.soldShell > 0 || row.soldPcs > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"
                  }`}
                  value={row.discount === 0 ? "" : row.discount}
                  onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                  disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
                />
              </td>
            )}
            {/* EXPECTED SALE */}
            <td className="border border-gray-200 py-1 px-1">
              <input
                className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                disabled
                value={
                  row.expectedSale
                    ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", {
                        minimumFractionDigits: 2
                      })}`
                    : ""
                }
              />
            </td>
            {/* ACTUAL SALE */}
            {!isVanLoad && (
              <td className="border border-gray-200 py-1 px-1">
                <input
                  className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                  disabled
                  value={
                    row.actualSale
                      ? `₱${parseFloat(row.actualSale).toLocaleString("en-PH", {
                          minimumFractionDigits: 2
                        })}`
                      : ""
                  }
                />
              </td>
            )}
          </tr>
        ))}
        <tr className="bg-gray-200 font-semibold text-[13px] text-right">
          <td className="border border-gray-300 py-2 px-1 text-center">TOTAL</td>
          <td className="border border-gray-300 py-2 px-1"></td> {/* Dispatched Shell */}
          <td className="border border-gray-300 py-2 px-1"></td> {/* Dispatched PCS */}
          <td className="border border-gray-300 py-2 px-1"></td> {/* Selling Price */}
          {!isVanLoad && (
            <>
              <td className="border border-gray-300 py-2 px-1"></td> {/* Sold Shell */}
              <td className="border border-gray-300 py-2 px-1"></td> {/* Sold PCS */}
            </>
          )}
          <td className="border border-gray-300 py-2 px-1"></td> {/* Shell Price */}
          <td className="border border-gray-300 py-2 px-1"></td> {/* Bottle Price */}
          {!isVanLoad && (
            <>
              {/* 4 pairs (Shell + PCS) = 8 cells */}
              {Array(8).fill(null).map((_, i) => (
                <td key={`tot-${i}`} className="border border-gray-300 py-2 px-1"></td>
              ))}
              <td className="border border-gray-300 py-2 px-1"></td> {/* Discount */}
            </>
          )}
          <td className="border border-gray-300 py-2 px-1 text-green-700">
            ₱{totalExpectedSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </td>
          {!isVanLoad && (
            <td className="border border-gray-300 py-2 px-1 text-blue-700">
              ₱{totalActualSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>
          )}
        </tr>
        </tbody>
      </table>
  </div>
  );
};

export default ProductTable;
