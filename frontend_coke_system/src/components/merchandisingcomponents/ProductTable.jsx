import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

const ProductTable = ({
  rows,
  setRows,
  products,
  selectedTransactionTypeName,
  miscItems = [],
  warehouseId,
  setTotalExpectedSale,
  setTotalActualSale,
  setEmptiesPriceTotal,
  setRefundablesTotal,
  setDiscrepancy,
  setTotalAmount,
  miscCharges,

  // ✅ These are needed for the TOTAL ROW display
  emptiesPriceTotal,
  refundablesTotal,
  discrepancy,
  totalAmount,  // ✅ pass this
  


}) => {
  const [pricingMap, setPricingMap] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const [unitTypes, setUnitTypes] = useState([]);
  

  // Fetch unit types on mount
  useEffect(() => {
    const fetchUnitTypes = async () => {
      try {
        const response = await axios.get("http://localhost:8080/api/unit-types/");
        setUnitTypes(response.data);
      } catch (err) {
        console.error("Failed to fetch unit types:", err);
      }
    };
    fetchUnitTypes();
  }, []);

  // Create a map of unitType ID → content_no
  const unitTypeMap = useMemo(() => {
    const map = {};
    unitTypes.forEach(ut => {
      map[ut.id] = ut.content_no;
    });
    return map;
  }, [unitTypes]);

  // Fetch available stock for a product/warehouse combo
const fetchStockQuantity = async (productId) => {
  if (!productId || !warehouseId) {
    console.warn("Missing product or warehouse ID");
    return;
  }

  const productExists = products.some((p) => p.id === parseInt(productId));
  if (!productExists) {
    console.warn(`Skipping fetch: product ID ${productId} not found in products list`);
    return;
  }

  try {
    const response = await axios.get(
      `http://localhost:8080/api/stocks/?product_id=${productId}&warehouse_id=${warehouseId}`
    );
    const quantity = response.data.quantity_available;
    setAvailableStock((prev) => ({
      ...prev,
      [productId]: quantity ?? 0,
    }));
  } catch (err) {
    console.warn(`Product stock not found for ID: ${productId}`);
    setAvailableStock((prev) => ({
      ...prev,
      [productId]: null,
    }));
  }
};


  const [pricingData, setPricingData] = useState([]);

useEffect(() => {
  const fetchPricing = async () => {
    try {
      const response = await axios.get("http://localhost:8080/api/pricing/");
      setPricingData(response.data);
    } catch (err) {
      console.error("Failed to fetch pricing:", err);
    }
  };
  fetchPricing();
}, []);


const handleProductChange = (index, value) => {
  const updatedRows = [...rows];
  const productId = parseInt(value);
  const selectedProduct = products.find((p) => p.id === productId);

  if (selectedProduct) {
    const priceId = selectedProduct.price?.id || null;
    const fullPrice = pricingData.find((price) => price.id === priceId);

    updatedRows[index].productId = productId;
    updatedRows[index].productName = selectedProduct.product_name;
    updatedRows[index].priceId = priceId;
    updatedRows[index].contentNo = selectedProduct.unit_type?.content_no || "";

    // ✅ Add pricing info directly to the row
    if (fullPrice) {
      updatedRows[index].shellPrice = fullPrice.shell_price ?? "";
      updatedRows[index].bottlePrice = fullPrice.bottle_price ?? "";

      // Optionally cache to pricingMap
      setPricingMap((prev) => ({
        ...prev,
        [priceId]: {
          selling_price: fullPrice.selling_price,
          shell_price: fullPrice.shell_price,
          bottle_price: fullPrice.bottle_price,
        },
      }));
    } else {
      updatedRows[index].shellPrice = "";
      updatedRows[index].bottlePrice = "";
    }
  }

  setRows(updatedRows);
  fetchStockQuantity(productId);

  // Auto-add row only if valid and it's the last row
  if (index === rows.length - 1 && productId && selectedProduct) {
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
        shellPrice: "",     
        bottlePrice: "",    
      },
    ]);
  }
};

const handleRowChange = (index, field, value) => {
  const updatedRows = [...rows];
  const row = updatedRows[index];

  row[field] = value;

  // Handle product selection
  if (field === "productId") {
    const product = products.find((p) => p.id === parseInt(value));
    if (product) {
      const priceId = product.price?.id;
      const fullPrice = pricingData.find((price) => price.id === priceId);
      const conversion = parseFloat(product.unit_type?.content_no || 1);

      row.priceId = priceId;
      row.conversion = conversion;

      row.shellPrice = fullPrice?.shell_price ?? "";
      row.bottlePrice = fullPrice?.bottle_price ?? "";
    }
  }

  const product = products.find((p) => p.id === parseInt(row.productId));
  const conversion = parseFloat(product?.unit_type?.content_no || 1);
  const price =
    product?.price?.selling_price ||
    pricingData.find((p) => p.id === row.priceId)?.selling_price ||
    0;

  // Handle PCS ↔ Shell conversion
  if (field === "dispatchedShell") {
    row.dispatchedPcs = Math.round(parseFloat(value || 0) * conversion);
  } else if (field === "dispatchedPcs") {
    row.dispatchedShell = (parseFloat(value || 0) / conversion).toFixed(2);
  } else if (field === "soldShell") {
    row.soldPcs = Math.round(parseFloat(value || 0) * conversion);
  } else if (field === "soldPcs") {
    row.soldShell = (parseFloat(value || 0) / conversion).toFixed(2);
  } else if (field === "expectedReturnShellEmpty") {
    row.expectedReturnPcsEmpty = Math.round(parseFloat(value || 0) * conversion);
  } else if (field === "expectedReturnPcsEmpty") {
    row.expectedReturnShellEmpty = (parseFloat(value || 0) / conversion).toFixed(2);
  } else if (field === "expectedReturnShellNonempty") {
    row.expectedReturnPcsNonempty = Math.round(parseFloat(value || 0) * conversion);
  } else if (field === "expectedReturnPcsNonempty") {
    row.expectedReturnShellNonempty = (parseFloat(value || 0) / conversion).toFixed(2);
  }

  // Per-row calculations
const dispatchedPcs = parseFloat(row.dispatchedPcs || 0);
const soldPcs = parseFloat(row.soldPcs || 0);
const discountPercent = parseFloat(row.discount || 0);
const discount = (price * soldPcs * discountPercent) / 100;

row.expectedSale = parseFloat((price * dispatchedPcs).toFixed(2));
row.actualSale = parseFloat((price * soldPcs - discount).toFixed(2));
row.discrepancy = parseFloat((row.expectedSale - row.actualSale).toFixed(2));

// 🔢 DISCREPANCY CALCULATIONS (inserted here)
const dispatchedShell = parseFloat(row.dispatchedShell || 0);
const soldShell = parseFloat(row.soldShell || 0);
const returnedEmptyShell = parseFloat(row.expectedReturnShellEmpty || 0);
const returnedEmptyPcs = parseFloat(row.expectedReturnPcsEmpty || 0);

// Compute discrepancy for empties
row.discrepancyPcsEmpty = soldPcs - returnedEmptyPcs;
row.discrepancyShellEmpty = soldShell - returnedEmptyShell;

// Compute returned with content
// Compute returned with content (user can override)
let returnedWithContentPcs =
  field === "expectedReturnPcsNonempty"
    ? parseFloat(value || 0)
    : parseFloat(row.expectedReturnPcsNonempty || dispatchedPcs - soldPcs);

let returnedWithContentShell =
  field === "expectedReturnShellNonempty"
    ? parseFloat(value || 0)
    : parseFloat(row.expectedReturnShellNonempty || dispatchedShell - soldShell);


  // Update only if not user-typing
if (field !== "expectedReturnPcsNonempty") {
  row.expectedReturnPcsNonempty = dispatchedPcs - soldPcs;
}
if (field !== "expectedReturnShellNonempty") {
  row.expectedReturnShellNonempty = dispatchedShell - soldShell;
}


// ✅ Final discrepancy computation (non-empty)
row.discrepancyPcsNonempty = dispatchedPcs - soldPcs - returnedWithContentPcs;
row.discrepancyShellNonempty = dispatchedShell - soldShell - returnedWithContentShell;

setRows(updatedRows);


  // 🔢 Total Calculations

  // Empties and Refundables totals
  const totalEmpties = updatedRows.reduce((sum, r) => {
    const price = pricingData.find((p) => p.id === r.priceId) || {};
    const sp = parseFloat(price.shell_price) || 0;
    const bp = parseFloat(price.bottle_price) || 0;
    const shellQty = parseFloat(r.soldShell || 0);
    const pcsQty = parseFloat(r.soldPcs || 0);
    return sum + (shellQty * sp) + (pcsQty * bp);
  }, 0);

  const totalRefundables = updatedRows.reduce((sum, r) => {
    const price = pricingData.find((p) => p.id === r.priceId) || {};
    const sp = parseFloat(price.shell_price) || 0;
    const bp = parseFloat(price.bottle_price) || 0;
    const shellQty = parseFloat(r.expectedReturnShellEmpty || 0);
    const pcsQty = parseFloat(r.expectedReturnPcsEmpty || 0);
    return sum + (shellQty * sp) + (pcsQty * bp);
  }, 0);

  setEmptiesPriceTotal(totalEmpties);
  setRefundablesTotal(totalRefundables);
};



  // ✅ Top-level computed values (moved out of handleRowChange)
  const totalDiscrepancyEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const price = pricingMap[r.priceId] || {};
      const sp = parseFloat(price.shell_price) || 0;
      const bp = parseFloat(price.bottle_price) || 0;
      const shellDisc = parseFloat(r.discrepancyShellEmpty || 0);
      const pcsDisc = parseFloat(r.discrepancyPcsEmpty || 0);
      return sum + (shellDisc * sp) + (pcsDisc * bp);
    }, 0);
  }, [rows, pricingMap]);

  const totalDiscrepancyNonEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const price = pricingMap[r.priceId] || {};
      const sellingPrice = parseFloat(price.selling_price) || 0;
      const shellPrice = parseFloat(price.shell_price) || 0;

      const pcsDisc = parseFloat(r.discrepancyPcsNonempty || 0);
      const shellDisc = parseFloat(r.discrepancyShellNonempty || 0);

      const bottleValue = pcsDisc * sellingPrice;
      const shellValue = shellDisc * shellPrice;

      return sum + bottleValue + shellValue;
    }, 0);
  }, [rows, pricingMap]);

  const overallDiscrepancy = useMemo(() => {
    return totalDiscrepancyEmpty + totalDiscrepancyNonEmpty;
  }, [totalDiscrepancyEmpty, totalDiscrepancyNonEmpty]);

  useEffect(() => {
    setDiscrepancy(overallDiscrepancy.toFixed(2));
  }, [overallDiscrepancy]);
  





useEffect(() => {
  let expectedTotal = 0;
  let actualTotal = 0;

  rows.forEach((row) => {
    expectedTotal += parseFloat(row.expectedSale || 0);
    actualTotal += parseFloat(row.actualSale || 0);
  });

  const miscCharges = miscItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  expectedTotal += miscCharges;
  actualTotal += miscCharges;

  setTotalExpectedSale(expectedTotal);
  setTotalActualSale(actualTotal);
}, [rows, miscItems]); // ✅ recalculate when rows or misc items change

// Totals
  const totalExpectedSale = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.expectedSale || 0), 0),
    [rows]
  );

  const totalActualSale = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.actualSale || 0), 0),
    [rows]
  );


  

useEffect(() => {
  const misc = parseFloat(miscCharges) || 0;

  let totalAmountValue;
  if (selectedTransactionTypeName === "Van Load") {
    totalAmountValue = (totalActualSale - misc) + overallDiscrepancy;
  } else {
    totalAmountValue = emptiesPriceTotal - refundablesTotal + totalActualSale;
  }

  console.log("🧮 COMPUTED totalAmountValue:", totalAmountValue);
  console.log({
    emptiesPriceTotal,
    refundablesTotal,
    totalActualSale,
    overallDiscrepancy,
    misc
  });



  setTotalAmount(totalAmountValue);
}, [
  totalActualSale,
  miscCharges,
  selectedTransactionTypeName,
  emptiesPriceTotal,
  refundablesTotal,
  overallDiscrepancy
]);



  




return (
  <div className="overflow-x-auto mt-6">
    <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm">
      <thead className="bg-gray-100 text-gray-800">
        <tr className="text-xs font-semibold">
          <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
          <th className="border border-gray-300 py-2 px-1">SELLING PRICE</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>SOLD</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>EMPTY PRICE (Shell/Bottle)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (Empty)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Empty)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (With Content/s)</th>
          <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
          <th className="border border-gray-300 py-2 px-1">DISCOUNT (%)</th>
          <th className="border border-gray-300 py-2 px-1">EXPECTED SALE</th>
          <th className="border border-gray-300 py-2 px-1">ACTUAL SALE</th>
        </tr>
        {/* Subheaders */}
        <tr className="bg-gray-200">
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
          <td className="border border-gray-300 py-1 text-[11px] font-medium">Bottle</td>
              {Array(8).fill(null).map((_, i) => (
                <td key={i} className="border border-gray-300 py-1 text-[11px] font-medium">
                  {i % 2 === 0 ? "Shell" : "PCS"}
                </td>
              ))}
              <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1"></td>
          <td className="border border-gray-300 py-1"></td>
        </tr>
      </thead>
      <tbody>
     {rows.map((row, index) => (
        <tr key={row.id} className="bg-white hover:bg-gray-50 transition duration-150">
          {/* PRODUCT SELECT */}
          <td className="border border-gray-200 py-1 px-1 w-[120px]">
            <select
              className="w-full p-1 text-sm text-center rounded bg-white border"
              value={row.productId ?? ""}
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
              value={row.dispatchedShell ?? ""}
              onChange={(e) => handleRowChange(index, "dispatchedShell", e.target.value)}
            />
          </td>
          <td className="border border-gray-200 py-1 px-1">
            <input
              type="number"
              className="w-full p-1 text-sm text-center rounded bg-white"
              value={row.dispatchedPcs ?? ""}
              onChange={(e) => handleRowChange(index, "dispatchedPcs", e.target.value)}
            />
          </td>

          {/* SELLING PRICE */}
          <td className="border border-gray-200 py-1 px-1">
            <input
              type="number"
              disabled
              className="w-full p-1 text-sm text-center bg-gray-100"
              value={
                pricingMap[row.priceId]?.selling_price ??
                products.find((p) => p.id === parseInt(row.productId))?.price?.selling_price ??
                ""
              }
            />
          </td>
            {/* SOLD */}
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                disabled={!row.productId}
                className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                value={row.soldShell ?? ""}
                onChange={(e) => handleRowChange(index, "soldShell", e.target.value)}
              />
            </td>
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                disabled={!row.productId}
                className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                value={row.soldPcs ?? ""}
                onChange={(e) => handleRowChange(index, "soldPcs", e.target.value)}
              />
            </td>

    {/* EMPTY PRICES */}
    <td className="border border-gray-200 py-1 px-1">
      <input
        type="number"
        className="w-full p-1 text-sm text-center bg-gray-100"
        value={row.shellPrice ?? ""}
        disabled
      />
    </td>
    <td className="border border-gray-200 py-1 px-1">
      <input
        type="number"
        className="w-full p-1 text-sm text-center bg-gray-100"
        value={row.bottlePrice ?? ""}
        disabled
      />
    </td>

   
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
              value={
                row[field] === undefined || row[field] === null
                  ? ""
                  : row[field] === "" || row[field] === "0"
                  ? ""
                  : row[field]
              }

              onChange={(e) => handleRowChange(index, field, e.target.value)}
              onFocus={() => {
                if (row[field] === 0 || row[field] === "0") {
                  handleRowChange(index, field, "");
                }
              }}

              className={`w-full p-1 text-sm text-center rounded
                ${["expectedReturnShellEmpty", "expectedReturnPcsEmpty", "expectedReturnShellNonempty", "expectedReturnPcsNonempty"].includes(field)
                  ? "bg-yellow-50"
                  : "bg-gray-100"}
                ${field.includes("discrepancy") && parseFloat(row[field]) !== 0
                  ? "bg-red-100 text-red-700 font-semibold"
                  : ""}`}
            />
          </td>
        ))}

    {/* DISCOUNT */}
   
      <td className="border border-gray-200 py-1 px-1">
        <input
          type="number"
          className={`w-full p-1 text-sm text-center rounded border ${
            row.soldShell > 0 || row.soldPcs > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"
          }`}
          value={row.discount ?? ""}
          onChange={(e) => handleRowChange(index, "discount", e.target.value)}
          disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
        />
      </td>

        {/* EXPECTED SALE */}
        <td className="border border-gray-200 py-1 px-1">
          <input
            className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
            disabled
            value={
              row.expectedSale !== undefined && row.expectedSale !== null
                ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}`
                : ""
            }
          />
        </td>

        {/* ACTUAL SALE */}
          <td className="border border-gray-200 py-1 px-1">
            <input
              className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
              disabled
              value={
                row.actualSale !== undefined && row.actualSale !== null
                  ? `₱${parseFloat(row.actualSale).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}`
                  : ""
              }
            />
          </td>
      </tr>
    ))}

        <tr className="bg-blue-100 font-semibold text-[13px] text-right">
          <td className="py-2 px-1 text-center text-black">TOTAL</td>

          {/* DISPATCHED */}
          <td className="border-none py-2 px-1 bg-blue-100"></td>
          <td className="border-none py-2 px-1 bg-blue-100"></td>

          {/* SELLING PRICE */}
          <td className="border-none py-2 px-1 bg-blue-100"></td>

          {/* SOLD */}
              <td className="border-none py-2 px-1 bg-blue-100"></td>
              <td className="border-none py-2 px-1 bg-blue-100"></td>
          

          {/* EMPTY PRICE (Shell + Bottle) */}
          <td colSpan={2} className="py-2 px-1 bg-gray-300 text-black text-center font-semibold">
          ₱{parseFloat(emptiesPriceTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </td>


              {/* RETURNED (Empty) */}
              <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(refundablesTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>



              {/* DISCREPANCY (Empty) */}
              <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(totalDiscrepancyEmpty || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>


              {/* RETURNED (Non-Empty) */}
              <td className="py-2 px-1 bg-blue-100"></td>
              <td className="py-2 px-1 bg-blue-100"></td>


              {/* DISCREPANCY (Non-Empty) */}
              <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(totalDiscrepancyNonEmpty || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>



              {/* DISCOUNT */}
              <td className="border border-gray-300 py-2 px-1 bg-blue-100"></td>

          {/* EXPECTED SALE */}
          <td className="border border-gray-300 py-2 px-1 bg-green-100 text-green-700 font-bold text-center">
            ₱{isNaN(totalExpectedSale) ? "0.00" : totalExpectedSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </td>

            <td className="border border-gray-300 py-2 px-1 bg-gray-200 text-blue-700 font-bold text-center">
              ₱{isNaN(totalActualSale) ? "0.00" : totalActualSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>
        </tr>


        </tbody>
      </table>


      <div className="flex justify-end mt-2 pr-4">
        <div className="flex items-center gap-2 bg-blue-100 px-4 py-2 rounded shadow text-right">
          <span className="font-semibold text-gray-700 text-sm">Overall Total:</span>
          <span className="text-lg font-bold text-blue-800">
           ₱{(parseFloat(totalAmount) || 0).toLocaleString("en-PH", {minimumFractionDigits: 2,})}
          </span>
        </div>
      </div>


  </div>
  );
};

export default ProductTable;