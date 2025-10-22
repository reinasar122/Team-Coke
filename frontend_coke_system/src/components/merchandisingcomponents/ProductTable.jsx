import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { FaTrash } from 'react-icons/fa';
import ProductSearchSelect from "../common/ProductSearchSelect"; // adjust path if needed



const ProductTable = ({
  rows,
  setRows,
  products,
  selectedTransactionTypeName,
  miscItems = [],
  warehouseId,

  // setters to parent
  setTotalExpectedSale,         // (you currently don’t use expected, but keeping for compatibility)
  setTotalActualSale,
  setEmptiesPriceTotal,
  setRefundablesTotal,
  setDiscrepancy,
  setTotalAmount,
  miscCharges,

  setDiscrepancyEmptyTotal,  

  // values for TOTAL row display
  emptiesPriceTotal,
  refundablesTotal,
  discrepancy,
  totalAmount,
}) => {
  // at top of ProductTable.jsx
  const dbg = (...args) => console.log("%c[MerchSale]", "color:#0aa;font-weight:700", ...args);

  const [pricingMap, setPricingMap] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const [unitTypes, setUnitTypes] = useState([]);
  const [pricingData, setPricingData] = useState([]);

  const n = (v) => parseFloat(v) || 0;

  // ⭐ helper: a blank row matching your schema everywhere else
  const makeBlankRow = () => ({
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
  });

  // ⭐ NEW: clear table on true browser refresh (won’t affect normal SPA navigations)
  useEffect(() => {
    try {
      const navEntry = performance.getEntriesByType?.("navigation")?.[0];
      const isReload = navEntry
        ? navEntry.type === "reload"
        : (window.performance && window.performance.navigation && window.performance.navigation.type === 1); // legacy fallback
      if (isReload) {
        setRows([makeBlankRow()]);
      }
    } catch {
      // If detection fails, do nothing (avoid affecting other flows)
    }
    // run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- Fetches --------------------
  useEffect(() => {
    const fetchUnitTypes = async () => {
      try {
        const response = await axios.get("http://localhost:8080/api/unit-types/");
        setUnitTypes(response.data || []);
      } catch (err) {
        console.error("Failed to fetch unit types:", err);
      }
    };
    fetchUnitTypes();
  }, []);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await axios.get("http://localhost:8080/api/pricing/");
        setPricingData(response.data || []);
      } catch (err) {
        console.error("Failed to fetch pricing:", err);
      }
    };
    fetchPricing();
  }, []);

  // unitTypeId -> content_no
  const unitTypeMap = useMemo(() => {
    const map = {};
    unitTypes.forEach((ut) => {
      map[ut.id] = ut.content_no;
    });
    return map;
  }, [unitTypes]);

  // product/warehouse stock (optional)
  const fetchStockQuantity = async (productId) => {
    if (!productId || !warehouseId) return;

    try {
      const response = await axios.get(
        `http://localhost:8080/api/stocks/${productId}/availability/`
      );

      const quantity = response.data.quantity_available ?? 0;
      setAvailableStock((prev) => ({ ...prev, [productId]: quantity }));
      console.log(`✅ Stock for product ${productId}:`, quantity);
    } catch (err) {
      console.error("❌ Error fetching stock:", err);
      setAvailableStock((prev) => ({ ...prev, [productId]: null }));
    }
  };


  // cache pricing by priceId for fast lookup
  useEffect(() => {
    const next = {};
    pricingData.forEach((p) => {
      next[p.id] = {
        selling_price: n(p.selling_price),
        shell_price: n(p.shell_price),
        bottle_price: n(p.bottle_price),
      };
    });
    setPricingMap(next);
  }, [pricingData]);

  // -------------------- Row ops --------------------
  const getSelectedProductIds = (currentIndex) =>
    rows
      .filter((_, i) => i !== currentIndex)
      .map((r) => r.productId)
      .filter(Boolean);

  const handleProductChange = (index, value) => {
    const updated = [...rows];
    const productId = parseInt(value, 10);
    const selectedProduct = products.find((p) => p.id === productId);

    if (selectedProduct) {
      const priceId = selectedProduct.price?.id || null;
      const priceRec = pricingData.find((price) => price.id === priceId);
      const contentNo = selectedProduct.unit_type?.content_no || 1;

      updated[index] = {
        ...updated[index],
        productId,
        productName: selectedProduct.product_name,
        priceId,
        contentNo,
        unitPrice: n(priceRec?.selling_price),
        shellPrice: n(priceRec?.shell_price) || "",
        bottlePrice: n(priceRec?.bottle_price) || "",
      };

      // Returnable check affects empties fields
      const shellP = n(priceRec?.shell_price);
      const bottleP = n(priceRec?.bottle_price);
      if (shellP === 0 && bottleP === 0) {
        updated[index].expectedReturnShellEmpty = 0;
        updated[index].expectedReturnPcsEmpty = 0;
        updated[index].discrepancyShellEmpty = 0;
        updated[index].discrepancyPcsEmpty = 0;
      }
    }

    setRows(updated);
    fetchStockQuantity(productId);

    // auto-add a blank row at the end if last became valid
    if (index === rows.length - 1 && selectedProduct) {
      setRows((prev) => [
        ...prev,
        makeBlankRow(),
      ]);
    }
  };

  //const isMissing = v => v == null || v === "";

  const handleRowChange = (index, field, value) => {
  const updated = [...rows];
  const row = { ...updated[index] };

  if (value === null) {
    row[field] = null;
    updated[index] = row;
    setRows(updated);
    return;
  }

  const n = (v) => parseFloat(v) || 0;
  row[field] = value;

  const productId = Number(row.productId);
  const product = products.find(p => p.id === productId);
  const conversion = n(product?.unit_type?.content_no || 1); // This is the content_no (how many PCS in one Shell)
  const price =
    n(row.unitPrice) ||
    n(product?.price?.selling_price) ||
    n(pricingMap[row.priceId]?.selling_price) ||
    0;


  row.unitPrice = price;
  row.conversion = conversion;

  const discountPercent = n(row.discount);
  const discountFactor = 1 - discountPercent / 100;

  const isReturnable =
    product?.returnable === true ||
    n(product?.price?.shell_price) > 0 ||
    n(product?.price?.bottle_price) > 0;

  // --- DISPATCHED / SOLD FIELDS ---
  if (["dispatchedPcs", "dispatchedShell"].includes(field)) {
    if (field === "dispatchedShell") {
      const shellQty = Math.floor(n(value));
      row.dispatchedShell = shellQty;
      row.dispatchedPcs = shellQty * conversion;
    } else if (field === "dispatchedPcs") {
      row.dispatchedPcs = n(value);
    }

    const stockQty = availableStock[productId];
    if (stockQty !== undefined && stockQty !== null && row.dispatchedPcs > stockQty) {
      alert(`Insufficient stock! Available: ${stockQty}, You entered: ${row.dispatchedPcs}`);
      row.dispatchedPcs = 0;
      row.dispatchedShell = 0;
      row.soldPcs = 0;
      row.soldShell = 0;
      row.expectedSale = 0;
      row.actualSale = 0;
      row.discrepancy = 0;
    } else {
      console.warn(`Stock not yet loaded for product ${productId}`);
    }


    // Sync sold fields with dispatched
    row.soldPcs = row.dispatchedPcs;
    row.soldShell = row.dispatchedShell;

  const dispatchedNow = n(row.dispatchedPcs);
  const soldNow = n(row.soldPcs);
  const discountNow = n(row.discount);

  const discountAmtNow = (price * soldNow * discountNow) / 100;

  row.expectedSale = Number((price * dispatchedNow).toFixed(2));
  row.actualSale = Number((price * soldNow - discountAmtNow).toFixed(2));
  row.discrepancy = Number((row.expectedSale - row.actualSale).toFixed(2));
}

  
// New changes Karen
    if (isReturnable) {
      const dispatchedShell = n(row.dispatchedShell);
      const dispatchedPcs = n(row.dispatchedPcs);
      if (field === "expectedReturnShellEmpty") {
        const shellQty = Math.floor(n(value));
        row.expectedReturnShellEmpty = Math.min(shellQty, dispatchedShell);
        if (dispatchedShell > 0) {
          const pcsPerShell = dispatchedPcs / dispatchedShell;
          row.expectedReturnPcsEmpty = Math.round(row.expectedReturnShellEmpty * pcsPerShell);
        } else {
          row.expectedReturnPcsEmpty = 0;
        }
      } else if (field === "expectedReturnPcsEmpty") {
        row.expectedReturnPcsEmpty = Math.min(n(value), dispatchedPcs);
      }
      row.discrepancyPcsEmpty = n(row.soldPcs) - n(row.expectedReturnPcsEmpty);
      row.discrepancyShellEmpty = n(row.soldShell) - n(row.expectedReturnShellEmpty);
    } else {
      row.expectedReturnPcsEmpty = 0;
      row.expectedReturnShellEmpty = 0;
      row.discrepancyPcsEmpty = 0;
      row.discrepancyShellEmpty = 0;
    }
  }

  // --- UNIVERSAL RECALCULATION (always run) ---
  const expectedSale = n(row.dispatchedPcs) * price;
  const actualSale = n(row.soldPcs) * price * discountFactor;

  row.expectedSale = expectedSale.toFixed(2);
  row.actualSale = actualSale.toFixed(2);
  row.discrepancy = (expectedSale - actualSale).toFixed(2);

  // ✅ NEW: Auto-calculate Discrepancy (Empty) even if Returned fields are still blank
if (isReturnable) {
  const dispatchedShell = n(row.dispatchedShell);
  const dispatchedPcs   = n(row.dispatchedPcs);
  const returnedShell   = n(row.expectedReturnShellEmpty);
  const returnedPcs     = n(row.expectedReturnPcsEmpty);

  // If no returned values yet, treat as 0 so discrepancy shows dispatched qty
  row.discrepancyShellEmpty = dispatchedShell - returnedShell;
  row.discrepancyPcsEmpty   = dispatchedPcs - returnedPcs;
} else {
  row.discrepancyShellEmpty = 0;
  row.discrepancyPcsEmpty = 0;
}

  updated[index] = row;
  setRows(updated);
};




  const handleRemoveRow = (rowIndex) => {
    const updatedRows = rows.filter((_, idx) => idx !== rowIndex);
    setRows(updatedRows);
  };

  // -------------------- Totals (memo + push up) --------------------

  // Empties (sold * empty prices)
  const emptiesPriceTotalCalc = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pm = pricingMap[r.priceId] || {};
      const sp = n(pm.shell_price);
      const bp = n(pm.bottle_price);
      const shellQty = n(r.soldShell);
      const pcsQty = n(r.soldPcs);
      return sum + shellQty * sp + pcsQty * bp;
    }, 0);
  }, [rows, pricingMap]);

  // Refundables (returned empty * empty prices)
  const refundablesTotalCalc = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pm = pricingMap[r.priceId] || {};
      const sp = n(pm.shell_price);
      const bp = n(pm.bottle_price);
      const shellQty = n(r.expectedReturnShellEmpty);
      const pcsQty = n(r.expectedReturnPcsEmpty);
      return sum + shellQty * sp + pcsQty * bp;
    }, 0);
  }, [rows, pricingMap]);

  // Discrepancy values (money)
  const totalDiscrepancyEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pm = pricingMap[r.priceId] || {};
      const sp = n(pm.shell_price);
      const bp = n(pm.bottle_price);
      const shellDisc = n(r.discrepancyShellEmpty);
      const pcsDisc = n(r.discrepancyPcsEmpty);
      return sum + shellDisc * sp + pcsDisc * bp;
    }, 0);
  }, [rows, pricingMap]);

  const totalDiscrepancyNonEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pm = pricingMap[r.priceId] || {};
      const sellingPrice = n(pm.selling_price);
      const shellPrice = n(pm.shell_price);
      const pcsDisc = n(r.discrepancyPcsNonempty);
      const shellDisc = n(r.discrepancyShellNonempty);
      return sum + pcsDisc * sellingPrice + shellDisc * shellPrice;
    }, 0);
  }, [rows, pricingMap]);

  const overallDiscrepancy = useMemo(
    () => totalDiscrepancyEmpty + totalDiscrepancyNonEmpty,
    [totalDiscrepancyEmpty, totalDiscrepancyNonEmpty]
  );

  // Push empties/refundables totals up whenever they change
  useEffect(() => {
    setEmptiesPriceTotal(emptiesPriceTotalCalc);
  }, [emptiesPriceTotalCalc, setEmptiesPriceTotal]);

  useEffect(() => {
    setRefundablesTotal(refundablesTotalCalc);
  }, [refundablesTotalCalc, setRefundablesTotal]);

  // Push discrepancy up
  useEffect(() => {
    setDiscrepancyEmptyTotal?.(Number(totalDiscrepancyEmpty.toFixed(2)));
  }, [totalDiscrepancyEmpty, setDiscrepancyEmptyTotal]);

  // Total actual sale (rows) + misc (your current behavior)
  const totalActualSale = useMemo(
    () => rows.reduce((sum, r) => sum + n(r.actualSale), 0),
    [rows]
  );

  useEffect(() => {
    const _misc = (miscItems || []).reduce((s, i) => s + n(i.amount), 0);
    setTotalExpectedSale?.(0); // keep API surface; not used here
    setTotalActualSale(totalActualSale + _misc);
  }, [rows, miscItems, totalActualSale, setTotalActualSale, setTotalExpectedSale]);

  // Compute totalAmount for display (keeps your original rules)
  useEffect(() => {
    const misc = n(miscCharges);
    let totalAmountValue;
    if (selectedTransactionTypeName === "Van Load") {
      totalAmountValue = totalActualSale - misc + overallDiscrepancy;
    } else {
      // Warehouse: (empties sold - empty returns) + product sales
      totalAmountValue = emptiesPriceTotalCalc - refundablesTotalCalc + totalActualSale;
    }
    setTotalAmount(totalAmountValue);
  }, [
    selectedTransactionTypeName,
    totalActualSale,
    overallDiscrepancy,
    miscCharges,
    emptiesPriceTotalCalc,
    refundablesTotalCalc,
    setTotalAmount,
  ]);

  // Kath: This facility is used to check console.logs in table area
  useEffect(() => {
    if (!products?.length) return;

    setRows((prev) => {
      let touched = false;
      const next = prev.map((r, i) => {
        if (!r.productId) return r;
        const prod = products.find((p) => p.id === Number(r.productId));
        if (!prod) return r;

        const needShell  = r.shellPrice  == null; // don't overwrite 0
        const needBottle = r.bottlePrice == null;

        if (!needShell && !needBottle) return r;

        const shellFromProd  = Number(prod?.price?.shell_price ?? 0);
        const bottleFromProd = Number(prod?.price?.bottle_price ?? 0);
        const isReturnable = prod?.returnable === true || shellFromProd > 0 || bottleFromProd > 0;

        const patched = {
          ...r,
          shellPrice:  needShell  ? (isReturnable ? shellFromProd  : 0) : r.shellPrice,
          bottlePrice: needBottle ? (isReturnable ? bottleFromProd : 0) : r.bottlePrice,
          ...(isReturnable
            ? {}
            : {
                expectedReturnShellEmpty: 0,
                expectedReturnPcsEmpty: 0,
                discrepancyShellEmpty: 0,
                discrepancyPcsEmpty: 0,
              }),
        };

        dbg("hydrate from products", {
          rowIndex: i,
          productId: r.productId,
          productName: prod?.product_name || prod?.name,
          shellFromProd,
          bottleFromProd,
          isReturnable,
          result: { shellPrice: patched.shellPrice, bottlePrice: patched.bottlePrice },
        });

        touched = true;
        return patched;
      });

      if (!touched) dbg("hydrate from products: nothing to patch");
      return next;
    });
  }, [products, setRows]);

  useEffect(() => {
    const table = rows.map((r, i) => {
      const prod = products.find(p => p.id === Number(r.productId));
      const fromRowShell   = r.shellPrice;
      const fromProdShell  = prod?.price?.shell_price ?? null;
      const displayShell   =
        (fromRowShell === "" || fromRowShell == null) ? (fromProdShell ?? 0) : fromRowShell;

      const fromRowBottle  = r.bottlePrice;
      const fromProdBottle = prod?.price?.bottle_price ?? null;
      const displayBottle  =
        (fromRowBottle === "" || fromRowBottle == null) ? (fromProdBottle ?? 0) : fromRowBottle;

      return {
        row: i,
        productId: r.productId ?? null,
        productName: prod?.product_name || prod?.name || null,
        rowShellPrice: fromRowShell,
        prodShellPrice: fromProdShell,
        displayShell,
        rowBottlePrice: fromRowBottle,
        prodBottlePrice: fromProdBottle,
        displayBottle,
        reasonShell: (fromRowShell === "" ? "rowShell is empty string" :
                      fromRowShell == null ? "rowShell is null/undefined" :
                      "rowShell used"),
      };
    });
    console.table(table);
  }, [rows, products]);
  // Kath: This facility is used to check console.logs in table area


  // 🩵 FIX: Recalculate actualSale when pricing data becomes available
useEffect(() => {
  if (!pricingMap || !Object.keys(pricingMap).length) return;

  setRows(prev => {
    const next = prev.map(r => {
      if (!r.productId || !r.dispatchedPcs) return r;

      const pm = pricingMap[r.priceId];
      if (!pm) return r;

      const price = n(pm.selling_price);
      const discountPercent = n(r.discount);
      const discountAmt = (price * n(r.soldPcs) * discountPercent) / 100;

      const expectedSale = price * n(r.dispatchedPcs);
      const actualSale = price * n(r.soldPcs) - discountAmt;
      const discrepancy = expectedSale - actualSale;

      return {
        ...r,
        unitPrice: price,
        expectedSale: Number(expectedSale.toFixed(2)),
        actualSale: Number(actualSale.toFixed(2)),
        discrepancy: Number(discrepancy.toFixed(2)),
      };
    });
    return next;
  });
}, [pricingMap]);


  
  // -------------------- Render --------------------
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead >
          <tr>
            <th className="border">Product</th>
            <th className="border" colSpan={2}>Dispatched</th>
            <th className="border">Selling Price</th>
            <th className="border" colSpan={2}>Sold</th>
            <th className="border" colSpan={2}>Empty Price (Shell/Bottle)</th>
            <th className="border" colSpan={2}>Returned (Empty)</th>
            <th className="border" colSpan={2}>Discrepancy (Empty)</th>
            <th className="border">Discount (%)</th>
            <th className="border">Actual Sale</th>
            <th className="border">Action</th>
          </tr>

          <tr className="bg-slate-100">
            <td className="border"></td>
            <td >Shell</td>
            <td className="border" >PCS</td>
            <td className="border"></td>
            <td >Shell</td>
            <td className="border" >PCS</td>
            <td >Shell</td>
            <td className="border">Bottle</td>
            {Array(3).fill(null).map((_, i) => (
              <td key={i} >
                {i % 2 === 0 ? "Shell" : "PCS"}
              </td>
            ))}
            <td className="border"></td>
            <td className="border"></td>
            <td className="border"></td>
            <td className="border"></td>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const productId = Number(row.productId);
            const product = products.find(p => p.id === productId);
            const hasProduct = !!product;
            const isMissing = (v) => v == null || v === "";
            
            return (
            <tr key={row.id ?? index} className="bg-white hover:bg-slate-100 transition duration-150">
              {/* PRODUCT SELECT */}
              <td className="border border-gray-200 py-1 px-1 w-[180px] relative">
                <ProductSearchSelect
                  products={products}
                  value={row.productName ?? ""}
                  onChange={(id) => handleProductChange(index, String(id))}
                  excludeIds={getSelectedProductIds(index)}
                  placeholder="Search product…"
                />
              </td>

              {/* DISPATCHED */}
             <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  placeholder="0"
                  className="input-always-spinner input text-center bg-yellow-50"
                  value={row.dispatchedShell === null || row.dispatchedShell === undefined ? "" : row.dispatchedShell}
                  onChange={(e) =>
                    handleRowChange(index, "dispatchedShell", e.target.value === "" ? null : e.target.value)
                  }
                />
              </td>
              <td className="border border-gray-200 py-1 px-1">
               <input
                  type="number"
                  placeholder="0"
                  className="input-always-spinner input text-center bg-yellow-50"
                  value={row.dispatchedPcs === null || row.dispatchedPcs === undefined ? "" : row.dispatchedPcs}
                  onChange={(e) =>
                    handleRowChange(index, "dispatchedPcs", e.target.value === "" ? null : e.target.value)
                  }
                />
              </td>

              {/* SELLING PRICE */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="text"
                  disabled
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={(() => {
                    const sellingPrice =
                      pricingMap[row.priceId]?.selling_price ??
                      products.find((p) => p.id === parseInt(row.productId, 10))?.price?.selling_price ??
                      "";

                    return sellingPrice !== "" && sellingPrice != null
                      ? `₱${Number(sellingPrice).toFixed(2)}`
                      : "";
                  })()}
                />
              </td>



              {/* SOLD */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  disabled
                  className="w-full p-1 text-sm text-center rounded "
                  value={row.soldShell ?? ""}
                />
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  disabled
                  className="w-full p-1 text-sm text-center rounded "
                  value={row.soldPcs ?? ""}
                />
              </td>

              {/* EMPTY PRICES */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="text"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={
                    !hasProduct
                      ? ""
                      : (() => {
                          const shellPrice = isMissing(row.shellPrice)
                            ? product?.price?.shell_price ?? 0
                            : row.shellPrice;
                          return `₱${Number(shellPrice).toFixed(2)}`;
                        })()
                  }
                  disabled
                />
              </td>

              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="text"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={
                    !hasProduct
                      ? ""
                      : (() => {
                          const bottlePrice = isMissing(row.bottlePrice)
                            ? product?.price?.bottle_price ?? 0
                            : row.bottlePrice;
                          return `₱${Number(bottlePrice).toFixed(2)}`;
                        })()
                  }
                  disabled
                />
              </td>


              {/* RETURN & DISCREPANCY FIELDS */}
              {[
                "expectedReturnShellEmpty",
                "expectedReturnPcsEmpty",
                "discrepancyShellEmpty",
                "discrepancyPcsEmpty",
              ].map((field, i) => (
                <td key={i} className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    placeholder="0"
                    className={`w-full p-1 text-sm text-center rounded
                      ${["expectedReturnShellEmpty", "expectedReturnPcsEmpty"].includes(field)
                        ? "input-always-spinner bg-yellow-50"
                        : "bg-gray-100"}
                      ${field.includes("discrepancy") && parseFloat(row[field]) !== 0
                        ? "bg-red-100 text-red-700 font-semibold"
                        : ""}
                    `}
                    value={
                      row[field] === "" || row[field] === "0" || row[field] === null
                        ? ""
                        : row[field]
                    } // Handle empty and "0"
                    onChange={(e) =>
                      handleRowChange(
                        index,
                        field,
                        e.target.value === "" ? null : e.target.value
                      )
                    }
                    readOnly={["discrepancyShellEmpty", "discrepancyPcsEmpty"].includes(field)} // ⬅️ Make discrepancy fields non-editable
                  />
                </td>
              ))}





              {/* DISCOUNT (%) */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className={`input-always-spinner w-full p-1 text-sm text-center rounded border ${
                    row.soldShell > 0 || row.soldPcs > 0
                      ? "bg-yellow-50"
                      : "bg-gray-200 cursor-not-allowed"
                  }`}
                  value={row.discount ?? ""}
                  onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                  disabled={!(row.soldShell > 0 || row.soldPcs > 0)}
                />
              </td>

              {/* ACTUAL SALE */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                  disabled
                  value={
                    Number.isFinite(parseFloat(row.actualSale))
                      ? `₱${parseFloat(row.actualSale).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                      : ""
                  }
                />
              </td>

              {/* Action */}
              <td className="icon-btn-danger">
                {row.productId && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(index)}
                    className="trash-btn"
                  >
                    <FaTrash />
                  </button>
                )}
              </td>
            </tr>
          )})}

          {/* TOTAL ROW */}
          <tr className="bg-slate-100 font-semibold text-[13px] text-right">
            <td className="py-2 px-1 text-center text-black">TOTAL</td>
            <td className="border-none py-2 px-1 bg-slate-100"></td>
            <td className="border-none py-2 px-1 bg-slate-100"></td>
            <td className="border-none py-2 px-1 bg-slate-100"></td>
            <td className="border-none py-2 px-1 bg-slate-100"></td>
            <td className="border-none py-2 px-1 bg-slate-100"></td>

            {/* EMPTY PRICE (Shell + Bottle) */}
            <td colSpan={2} className="py-2 px-1 bg-slate-100 text-black text-center font-semibold">
              ₱{parseFloat(emptiesPriceTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>

            {/* RETURNED (Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(-refundablesTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>

            {/* DISCREPANCY (Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(totalDiscrepancyEmpty || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>

            {/* DISCOUNT spacer */}
            <td className="border border-gray-300 py-2 px-1 bg-slate-100"></td>

            {/* ACTUAL SALE total */}
            <td className="border border-gray-300 py-2 px-1 bg-slate-100 text-blue-700 font-bold text-center">
              ₱{isNaN(totalActualSale) ? "0.00" : totalActualSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>

            {/* Action spacer */}
            <td className="border border-gray-300 py-2 px-1 bg-slate-100"></td>
          </tr>
        </tbody>
      </table>

      {/* Overall total */}
      <div className="flex justify-end mt-2 mb-2 pr-4">
        <div className="flex items-center gap-2 bg-gray-200 px-4 py-2 rounded shadow text-right">
          <span className="font-semibold text-gray-700 text-sm">Overall Total:</span>
          <span className="text-sm font-bold text-blue-800">
            ₱{(parseFloat(totalAmount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductTable;