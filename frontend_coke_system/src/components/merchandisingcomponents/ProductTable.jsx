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

    const productExists = products.some((p) => p.id === parseInt(productId, 10));
    if (!productExists) return;

    try {
      const response = await axios.get(
        `http://localhost:8080/api/stocks/?product_id=${productId}&warehouse_id=${warehouseId}`
      );
      const quantity = response.data.quantity_available;
      setAvailableStock((prev) => ({ ...prev, [productId]: quantity ?? 0 }));
    } catch {
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
    return;   // ⬅️ stops before doing any math
  }

  const n = (v) => parseFloat(v) || 0;
  row[field] = value;

  const productId = Number(row.productId);
  const product = products.find(p => p.id === productId);
  const conversion = n(product?.unit_type?.content_no || 1); // This is the content_no (how many PCS in one Shell)
  const price = n(row.unitPrice || product?.price?.selling_price);

  row.unitPrice = price;
  row.conversion = conversion;

  const discountPercent = n(row.discount);
  const discountAmt = (price * row.soldPcs * discountPercent) / 100;

  const isReturnable =
    product?.returnable === true ||
    n(product?.price?.shell_price) > 0 ||
    n(product?.price?.bottle_price) > 0;

  // --- DISPATCHED / SOLD FIELDS ---
  if (["dispatchedPcs", "dispatchedShell"].includes(field)) {
    // When Shell is changed, calculate PCS based on contentNo
    if (field === "dispatchedShell") {
      const shellQty = Math.floor(n(value));  // Round Shell down
      row.dispatchedShell = shellQty;  // Store the Shell value
      row.dispatchedPcs = shellQty * conversion;  // PCS based on content_no (conversion)
    }
    // When PCS is changed, calculate Shell based on contentNo
    else if (field === "dispatchedPcs") {
      const pcs = n(value);
      row.dispatchedPcs = pcs;  // Keep the PCS as the user typed
      // Calculate Shell based on PCS, but only if the PCS is valid (PCS >= conversion)
      if (pcs >= conversion) {
        row.dispatchedShell = Math.floor(pcs / conversion); // Shell based on PCS (PCS / content_no)
      }
    }

    // Sync sold fields with dispatched
    row.soldPcs = row.dispatchedPcs;
    row.soldShell = row.dispatchedShell;

    // Recalculate expected/actual sales
    row.expectedSale = Number((price * row.dispatchedPcs).toFixed(2));  // Expected sale based on dispatched PCS
    row.actualSale = Number((price * row.soldPcs - discountAmt).toFixed(2));  // Actual sale based on sold PCS
    row.discrepancy = Number((row.expectedSale - row.actualSale).toFixed(2));  // Discrepancy between expected and actual
  }

  // --- DISCOUNT FIELD CHANGE ---
  if (field === "discount") {
    const discountAmt = (price * row.soldPcs * discountPercent) / 100;
    row.actualSale = Number((price * row.soldPcs - discountAmt).toFixed(2));  // Update actual sale based on discount
    row.discrepancy = Number((row.expectedSale - row.actualSale).toFixed(2));  // Recalculate discrepancy
  }

  // --- RETURNED EMPTY FIELDS ---
  if (["expectedReturnPcsEmpty", "expectedReturnShellEmpty"].includes(field)) {
    if (isReturnable) {
      if (field === "expectedReturnShellEmpty") {
        const shellQty = Math.floor(n(value));
        row.expectedReturnShellEmpty = shellQty;
        row.expectedReturnPcsEmpty = shellQty * conversion; // PCS based on shell
      } else if (field === "expectedReturnPcsEmpty") {
        row.expectedReturnPcsEmpty = n(value); // PCS manually typed, Shell stays
      }

      // Always recalc discrepancy for EMPTY
      row.discrepancyPcsEmpty = n(row.soldPcs) - n(row.expectedReturnPcsEmpty);
      row.discrepancyShellEmpty = n(row.soldShell) - n(row.expectedReturnShellEmpty);
    } else {
      // Non-returnable products → reset to 0
      row.expectedReturnPcsEmpty = 0;
      row.expectedReturnShellEmpty = 0;
      row.discrepancyPcsEmpty = 0;
      row.discrepancyShellEmpty = 0;
    }
  }

  // --- RETURNED NON-EMPTY FIELDS ---
  if (["expectedReturnPcsNonempty", "expectedReturnShellNonempty"].includes(field)) {
    if (field === "expectedReturnShellNonempty") {
      const shellQty = Math.floor(n(value));
      row.expectedReturnShellNonempty = shellQty;
      row.expectedReturnPcsNonempty = shellQty * conversion;
    } else if (field === "expectedReturnPcsNonempty") {
      row.expectedReturnPcsNonempty = n(value); // PCS manually typed
    }

    // Update discrepancy for NON-EMPTY
    row.discrepancyPcsNonempty = n(row.soldPcs) - n(row.expectedReturnPcsNonempty);
    row.discrepancyShellNonempty = n(row.soldShell) - n(row.expectedReturnShellNonempty);
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
                  type="number"
                  disabled
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={
                    pricingMap[row.priceId]?.selling_price ??
                    products.find((p) => p.id === parseInt(row.productId, 10))?.price?.selling_price ??
                    ""
                  }
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
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={
                    !hasProduct
                      ? ""
                      : (isMissing(row.shellPrice) ? (product?.price?.shell_price ?? 0) : row.shellPrice)
                  }
                  disabled
                />
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={
                    !hasProduct
                      ? ""
                      : (isMissing(row.bottlePrice) ? (product?.price?.bottle_price ?? 0) : row.bottlePrice)
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
                    className={`w-full p-1 text-sm text-center rounded
                      ${
                        ["expectedReturnShellEmpty", "expectedReturnPcsEmpty"].includes(field)
                          ? "input-always-spinner bg-yellow-50"
                          : "bg-gray-100"
                      }
                      ${
                        field.includes("discrepancy") && parseFloat(row[field]) !== 0
                          ? "bg-red-100 text-red-700 font-semibold"
                          : ""
                      }`}
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
              ₱{parseFloat(refundablesTotal || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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