import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { FaTrash } from 'react-icons/fa';
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ProductSearchSelect from "../common/ProductSearchSelect"; // adjust path if needed
import api from "../../api";



const ProductTable = ({
  rows,
  setRows,
  products,
  selectedTransactionTypeName,
  isReservedTransaction = false,
  miscItems = [],
  warehouseId,

  // setters to parent
  setTotalExpectedSale,         // (you currently donÃ¢â‚¬â„¢t use expected, but keeping for compatibility)
  setTotalActualSale,
  setEmptiesPriceTotal,
  setRefundablesTotal,
  setDiscrepancy,
  setTotalAmount,
  miscCharges,
  defaultDiscount,

  setDiscrepancyEmptyTotal,  

  // values for TOTAL row display
  emptiesPriceTotal,
  refundablesTotal,
  discrepancy,
  totalAmount,
}) => {
  // at top of ProductTable.jsx
  const dbg = (...args) => console.log("%c[MerchSale]", "color:#0aa;font-weight:700", ...args);
  const saleAmountLabel = isReservedTransaction ? "Expected Sale" : "Actual Sale";
  const [pricingMap, setPricingMap] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const [unitTypes, setUnitTypes] = useState([]);
  const [pricingData, setPricingData] = useState([]);

  const n = (v) => parseFloat(v) || 0;
  const formatPeso = (value) => `\u20B1${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const recalculateRowTotals = (row, price) => {
    const dispatchedNow = n(row.dispatchedPcs);
    const soldNow = n(row.soldPcs);
    const discountNow = n(row.discount);
    const discountAmtNow = (price * soldNow * discountNow) / 100;

    row.expectedSale = Number((price * dispatchedNow).toFixed(2));
    row.actualSale = Number((price * soldNow - discountAmtNow).toFixed(2));
    row.discrepancy = Number((row.expectedSale - row.actualSale).toFixed(2));
  };

  // Ã¢Â­Â helper: a blank row matching your schema everywhere else
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

  // Ã¢Â­Â NEW: clear table on true browser refresh (wonÃ¢â‚¬â„¢t affect normal SPA navigations)
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
      const response = await api.get("/unit-types/"); // Use api instance
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
      const response = await api.get("/pricing/"); // Use api instance
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
      const response = await api.get(`/stocks/${productId}/availability/`); // Use api instance
      const quantity = response.data.quantity_available ?? 0;
      setAvailableStock((prev) => ({ ...prev, [productId]: quantity }));
      console.log(`Ã¢Å“â€¦ Stock for product ${productId}:`, quantity);
    } catch (err) {
      console.error("Ã¢ÂÅ’ Error fetching stock:", err);
      setAvailableStock((prev) => ({ ...prev, [productId]: null }));
    }
  };


  useEffect(() => {
    localStorage.setItem("rows", JSON.stringify(rows));
  }, [rows]);



  useEffect(() => {
    if (!pricingData.length || !rows.length) return;

    setRows(prevRows =>
      prevRows.map(r => {
        if (!r.priceId || (r.unitPrice && r.unitPrice !== "")) return r;
        const p = pricingData.find(p => p.id === r.priceId);
        if (!p) return r;

        return {
          ...r,
          unitPrice: p.selling_price ?? r.unitPrice,
          shellPrice: p.shell_price ?? r.shellPrice,
          bottlePrice: p.bottle_price ?? r.bottlePrice,
        };
      })
    );
  }, [pricingData, rows.length]);



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
      // Fetch pricing details from pricingData (if exists)
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
        shellPrice: n(priceRec?.shell_price) || "",  // Store shell price
        bottlePrice: n(priceRec?.bottle_price) || "", // Store bottle price
      };

      // If shell and bottle prices are zero, handle returnable check
      const shellP = n(priceRec?.shell_price);
      const bottleP = n(priceRec?.bottle_price);
      if (shellP === 0 && bottleP === 0) {
        updated[index].expectedReturnShellEmpty = 0;
        updated[index].expectedReturnPcsEmpty = 0;
        updated[index].discrepancyShellEmpty = 0;
        updated[index].discrepancyPcsEmpty = 0;
      }
    }

    // Update rows with new data
    setRows(updated);
    fetchStockQuantity(productId); // Fetch stock quantity for the selected product

    // Auto-add a blank row at the end if last row becomes valid (only for valid products)
    if (index === rows.length - 1 && selectedProduct) {
      setRows((prev) => [
        ...prev,
        {
          id: Date.now(),
          productId: "",
          productName: "",
          priceId: "",
          dispatchedShell: "",
          dispatchedPcs: "",
          expectedSale: "",
          contentNo: "",
          sellingPrice: "",
          shellPrice: "",
          bottlePrice: "",
          discount: defaultDiscount ?? "",  // Add default discount if necessary
        },
      ]);
    }
  };


  //const isMissing = v => v == null || v === "";

  const handleRowChange = (index, field, value) => {
  const updated = [...rows];
  const row = { ...updated[index] };


  //changes for product require

  // fields that must not be filled without a product
  const qtyFields = [
    "dispatchedShell",
    "dispatchedPcs",
    "soldShell",
    "soldPcs",
    "expectedReturnShellEmpty",
    "expectedReturnPcsEmpty",
    "expectedReturnShellNonempty",
    "expectedReturnPcsNonempty",
    "discount",
  ];

  // If no product selected and user tries to enter a value
  if (
    !row.productId &&
    qtyFields.includes(field) &&
    value !== null &&
    value !== "" &&
    Number(value) > 0
  ) {
    alert("Product required");
    return;
  }



  if (value === null) {
    row[field] = null;
    updated[index] = row;
    setRows(updated);
    return;   // Ã¢Â¬â€¦Ã¯Â¸Â stops before doing any math
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
  const discountAmt = (price * row.soldPcs * discountPercent) / 100;

  const isReturnable =
    product?.returnable === true ||
    n(product?.price?.shell_price) > 0 ||
    n(product?.price?.bottle_price) > 0;

  // --- DISPATCHED / SOLD FIELDS ---
  if (["dispatchedPcs", "dispatchedShell"].includes(field)) {
    if (field === "dispatchedShell") {
      // Ã¢Å“â€¦ When user changes Shell, auto-fill PCS (for convenience)
      const shellQty = Math.floor(n(value));
      row.dispatchedShell = shellQty;
      row.dispatchedPcs = shellQty * conversion;
    } 
    else if (field === "dispatchedPcs") {
      // Ã¢Å“â€¦ When user changes PCS, do NOT auto-change Shell anymore
      row.dispatchedPcs = n(value);
      // Keep whatever Shell was manually entered earlier
    }

      

    // Ã¢Å“â€¦ Stock availability check (only if stock is loaded)
    const stockQty = availableStock[productId];
    if (stockQty !== undefined && stockQty !== null) {
      if (row.dispatchedPcs > stockQty) {
        alert(`Insufficient stock! Available: ${stockQty}, You entered: ${row.dispatchedPcs}`);
        // Reset back to 0 instead of clamping
        row.dispatchedPcs = 0;
        row.dispatchedShell = 0;
        row.soldPcs = 0;
        row.soldShell = 0;
        row.expectedSale = 0;
        row.actualSale = 0;
        row.discrepancy = 0;
      }

    } else {
      console.warn(`Stock not yet loaded for product ${productId}`);
    }
    if (n(row.soldPcs) > n(row.dispatchedPcs)) {
      row.soldPcs = n(row.dispatchedPcs);
    }
    if (n(row.soldShell) > n(row.dispatchedShell)) {
      row.soldShell = Math.floor(n(row.dispatchedShell));
    }

    if (n(row.expectedReturnPcsEmpty) > n(row.soldPcs)) {
      row.expectedReturnPcsEmpty = n(row.soldPcs);
    }
    if (n(row.expectedReturnShellEmpty) > n(row.soldShell)) {
      row.expectedReturnShellEmpty = Math.floor(n(row.soldShell));
    }

    recalculateRowTotals(row, price);
}

  if (["soldPcs", "soldShell"].includes(field)) {
    const maxSoldShell = Math.floor(n(row.dispatchedShell));
    const maxSoldPcs = n(row.dispatchedPcs);

    if (field === "soldShell") {
      const shellQty = Math.floor(n(value));
      row.soldShell = Math.min(shellQty, maxSoldShell);
      row.soldPcs = Math.min(row.soldShell * conversion, maxSoldPcs);
    } else if (field === "soldPcs") {
      row.soldPcs = Math.min(n(value), maxSoldPcs);
      if (n(row.soldShell) > maxSoldShell) {
        row.soldShell = maxSoldShell;
      }
      if (n(row.soldPcs) === 0) {
        row.soldShell = 0;
      }
    }

    if (n(row.expectedReturnPcsEmpty) > n(row.soldPcs)) {
      row.expectedReturnPcsEmpty = n(row.soldPcs);
    }
    if (n(row.expectedReturnShellEmpty) > n(row.soldShell)) {
      row.expectedReturnShellEmpty = Math.floor(n(row.soldShell));
    }

    row.discrepancyPcsEmpty = n(row.soldPcs) - n(row.expectedReturnPcsEmpty);
    row.discrepancyShellEmpty = n(row.soldShell) - n(row.expectedReturnShellEmpty);

    recalculateRowTotals(row, price);
  }

  
// New changes Karen
  if (isReturnable) {
    const soldShell = n(row.soldShell);
    const soldPcs   = n(row.soldPcs);
    const returnedShell = n(row.expectedReturnShellEmpty);
    const returnedPcs = n(row.expectedReturnPcsEmpty);

    row.discrepancyPcsEmpty = soldPcs - returnedPcs;
    row.discrepancyShellEmpty = soldShell - returnedShell;
  } else {
    row.discrepancyPcsEmpty = 0;
    row.discrepancyShellEmpty = 0;
  }
//.......


// --- DISCOUNT FIELD CHANGE ---
if (field === "discount") {
  const price = n(row.unitPrice);  // Selling price
  const soldPcs = n(row.soldPcs);  // Number of sold pieces
  const discountPercent = n(row.discount);  // Discount percentage

  // Store the actual sale before the discount
  const totalAmount = price * soldPcs;
  const previousActualSale = row.actualSale;

  // Calculate the discount amount
  const discountAmt = (totalAmount * discountPercent) / 100;

  // **Validation for discount exceeding actual sale**
  if (discountAmt > totalAmount) {
    toast.error("Discount cannot exceed the total amount of the product.", {
    autoClose: 3000, // Close after 3 seconds
    hideProgressBar: true,
    className: 'toast-error',  // Custom class for styling
  });

    // Reset the discount to 0
    row.discount = 0;

    // Manually reset the actualSale to the original value (before discount)
    row.actualSale = totalAmount;

    // Recalculate discrepancy based on the original actualSale
    row.discrepancy = Number((row.expectedSale - row.actualSale).toFixed(2));
  } else {
    // Valid discount: Update actual sale and discrepancy as usual
    row.actualSale = Number((totalAmount - discountAmt).toFixed(2));  // Update actual sale based on discount
    row.discrepancy = Number((row.expectedSale - row.actualSale).toFixed(2));  // Recalculate discrepancy
  }
}



  // --- RETURNED EMPTY FIELDS (dependent on DISPATCHED) ---
if (["expectedReturnPcsEmpty", "expectedReturnShellEmpty"].includes(field)) {
  if (isReturnable) {
    const soldShell = n(row.soldShell);
    const soldPcs   = n(row.soldPcs);

    if (field === "expectedReturnShellEmpty") {
      const shellQty = Math.floor(n(value));

      // Clamp to sold Shell so reserve rows can stay unsold.
      row.expectedReturnShellEmpty = Math.min(shellQty, soldShell);

      if (soldShell > 0) {
        const pcsPerShell = soldPcs / soldShell;
        row.expectedReturnPcsEmpty = Math.round(row.expectedReturnShellEmpty * pcsPerShell);
      } else {
        row.expectedReturnPcsEmpty = 0;
      }
    }

    else if (field === "expectedReturnPcsEmpty") {
      const pcsQty = n(value);
      row.expectedReturnPcsEmpty = Math.min(pcsQty, soldPcs);
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

  const miscItemsTotal = useMemo(
    () => (miscItems || []).reduce((sum, item) => sum + n(item.amount), 0),
    [miscItems]
  );

  const totalExpectedSaleCalc = useMemo(
    () => rows.reduce((sum, r) => sum + n(r.expectedSale), 0),
    [rows]
  );

  const totalActualSaleCalc = useMemo(
    () => rows.reduce((sum, r) => sum + n(r.actualSale), 0),
    [rows]
  );

  const displayedSaleTotal = isReservedTransaction
    ? totalExpectedSaleCalc + miscItemsTotal
    : totalActualSaleCalc + miscItemsTotal;

  useEffect(() => {
    setTotalExpectedSale?.(totalExpectedSaleCalc + miscItemsTotal);
    setTotalActualSale(totalActualSaleCalc + miscItemsTotal);
  }, [
    miscItemsTotal,
    totalActualSaleCalc,
    totalExpectedSaleCalc,
    setTotalActualSale,
    setTotalExpectedSale,
  ]);

  // Compute totalAmount for display (keeps your original rules)
  useEffect(() => {
    const misc = n(miscCharges);
    let totalAmountValue;
    if (selectedTransactionTypeName === "Van Load") {
      totalAmountValue = totalActualSaleCalc + miscItemsTotal - misc + overallDiscrepancy;
    } else if (isReservedTransaction) {
      totalAmountValue = totalExpectedSaleCalc + miscItemsTotal;
    } else {
      // Warehouse: (empties sold - empty returns) + product sales
      totalAmountValue =
        emptiesPriceTotalCalc - refundablesTotalCalc + totalActualSaleCalc + miscItemsTotal;
    }
    setTotalAmount(totalAmountValue);
  }, [
    selectedTransactionTypeName,
    isReservedTransaction,
    totalActualSaleCalc,
    totalExpectedSaleCalc,
    miscItemsTotal,
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


  // Ã°Å¸Â©Âµ FIX: Recalculate actualSale when pricing data becomes available
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
            <th className="border" colSpan={2}>Empty Price</th>
            <th className="border" colSpan={2}>Returned (Empty)</th>
            <th className="border" colSpan={2}>Discrepancy (Empty)</th>
            <th className="border">Discount (%)</th>
            <th className="border">{saleAmountLabel}</th>
            <th className="border">Action</th>
          </tr>

          <tr className="bg-slate-100">
            <td className="border"></td>
            <td >Shell</td>
            <td className="border" >Item Qty</td>
            <td className="border"></td>
            <td >Shell</td>
            <td className="border" >Item Qty</td>
            <td >Per Shell</td>
            <td className="border">Per Bottle</td>
            {Array(3).fill(null).map((_, i) => (
              <td key={i} >
                {i % 2 === 0 ? "Shell" : "Item Qty"}
              </td>
            ))}
            <td className="border">Item Qty</td>
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
            const isMissing = (value) => value == null || value === "";


            const shellFromProd = product?.price?.shell_price ?? 0;
                const bottleFromProd = product?.price?.bottle_price ?? 0;

                const isReturnable =
                  !!product &&
                  (
                    product.returnable === true ||
                    Number(shellFromProd) > 0 ||
                    Number(bottleFromProd) > 0
                  );

            return (
              <tr key={row.id ?? index} className="bg-white hover:bg-slate-100 transition duration-150">
                {/* PRODUCT SELECT */}
                <td className="border border-gray-200 py-1 px-1 w-[180px] relative">
                  <ProductSearchSelect
                    products={products}
                    value={row.productName ?? ""}
                    onChange={(id) => handleProductChange(index, String(id))}
                    excludeIds={getSelectedProductIds(index)}
                    placeholder="Search product..."
                  />
                </td>

                {/* DISPATCHED */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    placeholder="0"
                    className={`input-always-spinner input text-center ${!hasProduct ? "bg-gray-200 cursor-not-allowed" : "bg-yellow-50"}`}
                    value={row.dispatchedShell === null || row.dispatchedShell === undefined ? "" : row.dispatchedShell}
                    onChange={(e) =>
                      handleRowChange(index, "dispatchedShell", e.target.value === "" ? null : e.target.value)
                    }
                    disabled={!hasProduct} // Disabled if no product is selected
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    placeholder="0"
                    className={`input-always-spinner input text-center ${!hasProduct ? "bg-gray-200 cursor-not-allowed" : "bg-yellow-50"}`}
                    value={row.dispatchedPcs === null || row.dispatchedPcs === undefined ? "" : row.dispatchedPcs}
                    onChange={(e) =>
                      handleRowChange(index, "dispatchedPcs", e.target.value === "" ? null : e.target.value)
                    }
                    disabled={!hasProduct} // Disabled if no product is selected
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
                        ? formatPeso(sellingPrice)
                        : "";
                    })()}
                  />
                </td>

                {/* SOLD */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    className={`input-always-spinner w-full p-1 text-sm text-center rounded ${hasProduct && n(row.dispatchedPcs) > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"}`}
                    value={row.soldShell ?? ""}
                    onChange={(e) =>
                      handleRowChange(index, "soldShell", e.target.value === "" ? null : e.target.value)
                    }
                    disabled={!hasProduct || n(row.dispatchedPcs) <= 0}
                  />
                </td>
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    className={`input-always-spinner w-full p-1 text-sm text-center rounded ${hasProduct && n(row.dispatchedPcs) > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"}`}
                    value={row.soldPcs ?? ""}
                    onChange={(e) =>
                      handleRowChange(index, "soldPcs", e.target.value === "" ? null : e.target.value)
                    }
                    disabled={!hasProduct || n(row.dispatchedPcs) <= 0}
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
                            return formatPeso(shellPrice);
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
                            return formatPeso(bottlePrice);
                          })()
                    }
                    disabled
                  />
                </td>

                {/* RETURNED EMPTY */}
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
                        ${
                          // Style returned empty + discrepancy empty the same
                          ["expectedReturnShellEmpty","expectedReturnPcsEmpty","discrepancyShellEmpty","discrepancyPcsEmpty"].includes(field)
                            ? isReturnable
                              ? // Returnable Ã¢â€ â€™ show yellow input for returned fields but gray readonly for discrepancy
                                (field.includes("expectedReturn") ? "input-always-spinner bg-yellow-50" : "bg-gray-100")
                              : // NON-returnable Ã¢â€ â€™ ALL these fields disabled and gray
                                "bg-gray-200 cursor-not-allowed"
                            : "bg-gray-100"
                        }
                        ${
                          field.includes("discrepancy") && parseFloat(row[field]) !== 0
                            ? "bg-red-100 text-red-700 font-semibold"
                            : ""
                        }
                      `}
                      value={
                        row[field] === "" || row[field] === "0" || row[field] === null
                          ? ""
                          : row[field]
                      }
                      onChange={(e) =>
                        handleRowChange(
                          index,
                          field,
                          e.target.value === "" ? null : e.target.value
                        )
                      }
                      readOnly={field.includes("discrepancy")}
                      disabled={
                        !hasProduct ||
                        n(row.soldPcs) <= 0 ||
                        (
                          !isReturnable &&
                          (
                            ["expectedReturnShellEmpty","expectedReturnPcsEmpty","discrepancyShellEmpty","discrepancyPcsEmpty"]
                              .includes(field)
                          )
                        )
                      }
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
                      Number.isFinite(
                        parseFloat(isReservedTransaction ? row.expectedSale : row.actualSale)
                      )
                        ? formatPeso(
                            parseFloat(
                              isReservedTransaction ? row.expectedSale : row.actualSale
                            )
                          )
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
            );
          })}

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
              {formatPeso(parseFloat(emptiesPriceTotal || 0))}
            </td>

            {/* RETURNED (Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
              {formatPeso(parseFloat(-refundablesTotal || 0))}
            </td>

            {/* DISCREPANCY (Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
              {formatPeso(parseFloat(totalDiscrepancyEmpty || 0))}
            </td>

            {/* DISCOUNT spacer */}
            <td className="border border-gray-300 py-2 px-1 bg-slate-100"></td>

            {/* ACTUAL SALE total */}
            <td className="border border-gray-300 py-2 px-1 bg-slate-100 text-blue-700 font-bold text-center">
              {isNaN(displayedSaleTotal) ? formatPeso(0) : formatPeso(displayedSaleTotal)}
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
            {formatPeso(parseFloat(totalAmount) || 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductTable;
