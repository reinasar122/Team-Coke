// src/components/merchandisingcomponents/VanLoadTable.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";

/**
 * Props:
 * - rows, setRows
 * - products
 * - warehouseId (number OR object with {id})
 * - setTotalExpectedSale
 * - onAdjustmentsChange?: function([{ product_id, delta }])   // negative delta to deduct
 */
const VanLoadTable = ({
  rows,
  setRows,
  products,
  warehouseId,
  setTotalExpectedSale,
  onAdjustmentsChange,
}) => {
  const [availableStock, setAvailableStock] = useState({});
  const [pricingData, setPricingData] = useState([]);

  const n = (v) => parseFloat(v) || 0;

  const toWid = (val) => {
    if (val == null) return null;
    if (typeof val === "number" || typeof val === "string") return Number(val);
    if (typeof val === "object") return Number(val.id ?? val.warehouse_id ?? val.value ?? null);
    return null;
  };

  const getCurrentWarehouseId = () => {
    const fromProp = toWid(warehouseId);
    if (fromProp) return fromProp;

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    const fromSelected = toWid(selectedWarehouse);
    if ((user.role || "").toLowerCase() === "admin" && fromSelected) return fromSelected;
    return toWid(user.warehouse_id ?? user.warehouse ?? null);
  };

  // ---------- Stocks ----------
  const fetchAllStocks = useCallback(async () => {
    try {
      const wid = getCurrentWarehouseId();
      if (!wid || Number.isNaN(wid)) {
        setAvailableStock({});
        return;
      }

      const nameToId = new Map(
        (products || []).map((p) => [(p.product_name || "").trim().toLowerCase(), Number(p.id)])
      );

      const { data } = await axios.get(
        `http://localhost:8080/api/stocks/?warehouse=${encodeURIComponent(wid)}`
      );

      const map = {};
      const list = Array.isArray(data) ? data : [data];
      for (const row of list.filter(Boolean)) {
        const pidDirect = row.product_id ?? row.product;
        let pid = pidDirect != null ? Number(pidDirect) : undefined;
        if (!pid) {
          const pname = (row.product_name || "").trim().toLowerCase();
          pid = nameToId.get(pname);
        }
        if (pid) map[pid] = Number(row.quantity_available) || 0;
      }
      setAvailableStock(map);
    } catch (e) {
      console.error("Failed to load stocks:", e);
      setAvailableStock({});
    }
  }, [warehouseId, products]);

  useEffect(() => {
    fetchAllStocks();
    const onWhChange = () => fetchAllStocks();
    const onStocksChanged = () => fetchAllStocks();
    window.addEventListener("warehouseChanged", onWhChange);
    window.addEventListener("stocksChanged", onStocksChanged);
    return () => {
      window.removeEventListener("warehouseChanged", onWhChange);
      window.removeEventListener("stocksChanged", onStocksChanged);
    };
  }, [fetchAllStocks]);

  // ---------- Pricing ----------
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("http://localhost:8080/api/pricing/");
        setPricingData(data || []);
      } catch (err) {
        console.error("Failed to fetch pricing:", err);
      }
    })();
  }, []);

  // ---------- Prevent duplicate product selections ----------
  const pickedIds = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      const id = Number(r?.productId);
      if (id) s.add(id);
    }
    return s;
  }, [rows]);

  // Per-row sorter: unpicked products (for other rows) first, picked-elsewhere to bottom
  const getSortedProductsForRow = useCallback(
    (currentId) => {
      const sorted = [...(products || [])];
      sorted.sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        const aPickedElse = pickedIds.has(aId) && aId !== Number(currentId);
        const bPickedElse = pickedIds.has(bId) && bId !== Number(currentId);

        // Unpicked first, picked-elsewhere last
        if (aPickedElse !== bPickedElse) return aPickedElse ? 1 : -1;

        // Secondary: alphabetical by name
        return (a.product_name || "").localeCompare(b.product_name || "");
      });
      return sorted;
    },
    [products, pickedIds]
  );

  // ---------- Build adjustments for Finalize (deduct => negative delta) ----------
  const adjustments = useMemo(() => {
    const byProduct = new Map(); // product_id -> total PCS
    const prodMap = new Map((products || []).map((p) => [Number(p.id), p]));

    for (const r of rows) {
      const pid = Number(r.productId);
      if (!pid) continue;

      const prod = prodMap.get(pid);
      const conv = n(prod?.unit_type?.content_no || r?.contentNo || 1);

      const pcs =
        Number.isFinite(n(r.dispatchedPcs)) && n(r.dispatchedPcs) > 0
          ? Math.round(n(r.dispatchedPcs))
          : Math.round(n(r.dispatchedShell) * conv);

      if (pcs > 0) byProduct.set(pid, (byProduct.get(pid) || 0) + pcs);
    }

    return [...byProduct.entries()].map(([product_id, pcs]) => ({
      product_id,
      delta: -Math.max(0, pcs),
    }));
  }, [rows, products]);

  useEffect(() => {
    if (typeof onAdjustmentsChange === "function") onAdjustmentsChange(adjustments);
  }, [adjustments, onAdjustmentsChange]);

  // ---------- Handlers ----------
  const handleProductChange = (index, value) => {
    const updated = [...rows];
    const productId = parseInt(value, 10) || null;

    // 🚫 Prevent duplicates (allow keeping the same value on this row)
    const usedElsewhere = rows.some((r, i) => i !== index && Number(r.productId) === productId);
    if (productId && usedElsewhere) {
      alert("That product is already selected in another row.");
      return;
    }

    const selectedProduct = products.find((p) => p.id === productId);

    if (selectedProduct) {
      const priceId = selectedProduct.price?.id || null;
      const fullPrice = pricingData.find((price) => price.id === priceId);

      updated[index] = {
        ...(updated[index] || {}),
        productId,
        productName: selectedProduct.product_name,
        priceId,
        contentNo: selectedProduct.unit_type?.content_no || 1,
        shellPrice: fullPrice?.shell_price ?? "",
        bottlePrice: fullPrice?.bottle_price ?? "",
        sellingPrice: fullPrice?.selling_price ?? "",
      };
    } else {
      updated[index] = {
        ...(updated[index] || {}),
        productId: "",
        productName: "",
        priceId: "",
        contentNo: 1,
        shellPrice: "",
        bottlePrice: "",
        sellingPrice: "",
        dispatchedShell: "",
        dispatchedPcs: "",
        expectedSale: "",
      };
    }

    setRows(updated);

    // Auto-add a blank row when the last row picks a valid product
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
          expectedSale: "",
          contentNo: "",
          sellingPrice: "",
          shellPrice: "",
          bottlePrice: "",
        },
      ]);
    }
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    const row = { ...updated[index] };

    row[field] = value;

    const product = products.find((p) => p.id === parseInt(row.productId, 10));
    const conversion = n(product?.unit_type?.content_no || row.contentNo || 1);
    row.contentNo = conversion;

    const fullPrice = pricingData.find((p) => p.id === row.priceId) || product?.price || {};
    row.sellingPrice = n(fullPrice.selling_price);

    const availablePcs = availableStock[Number(row.productId)];
    const hasAvail = typeof availablePcs === "number";
    const cap = hasAvail ? availablePcs : Infinity;

    if (field === "dispatchedShell") {
      const pcsCalc = Math.round(n(value) * conversion);
      if (pcsCalc > cap) {
        if (hasAvail) alert(`Dispatched PCS (${pcsCalc}) exceeds available stock (${availablePcs}).`);
        row.dispatchedPcs = hasAvail ? cap : pcsCalc;
        row.dispatchedShell = ((hasAvail ? cap : pcsCalc) / conversion).toFixed(2);
      } else {
        row.dispatchedPcs = pcsCalc;
      }
    } else if (field === "dispatchedPcs") {
      const pcsVal = Math.max(0, Math.round(n(value)));
      if (pcsVal > cap) {
        if (hasAvail) alert(`Dispatched PCS (${pcsVal}) exceeds available stock (${availablePcs}).`);
        row.dispatchedPcs = hasAvail ? cap : pcsVal;
        row.dispatchedShell = ((hasAvail ? cap : pcsVal) / conversion).toFixed(2);
      } else {
        row.dispatchedPcs = pcsVal;
        row.dispatchedShell = (pcsVal / conversion).toFixed(2);
      }
    }

    const dispatchedPcs = n(row.dispatchedPcs);
    row.expectedSale = Number((n(row.sellingPrice) * dispatchedPcs).toFixed(2));

    updated[index] = row;
    setRows(updated);

    const expectedTotal = updated.reduce((sum, r) => sum + n(r.expectedSale), 0);
    setTotalExpectedSale(expectedTotal);
  };

  const removeRow = (index) => {
    const updated = [...rows];
    updated.splice(index, 1);
    setRows(updated);

    const expectedTotal = updated.reduce((sum, r) => sum + n(r.expectedSale), 0);
    setTotalExpectedSale(expectedTotal);
  };

  // ---------- Render ----------
  return (
    <div className="overflow-x-auto border rounded-md mt-4">
      <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm">
        <thead className="bg-gray-200 text-gray-700">
          <tr>
            <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
            <th className="border border-gray-300 py-2 px-1">SELLING PRICE</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>Empty Price</th>
            <th className="border border-gray-300 py-2 px-1">Expected Sale</th>
            <th className="border border-gray-300 py-2 px-1">Available</th>
            <th className="border border-gray-300 py-2 px-1">Actions</th>
          </tr>
          <tr className="bg-gray-200">
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const productId = Number(row.productId);
            const avail = availableStock[productId];
            const showAvail = (avail === 0 || typeof avail === "number") ? avail : "--";
            const sortedOptions = getSortedProductsForRow(productId);

            return (
              <tr key={row.id ?? index} className="bg-white border-t">
                {/* PRODUCT SELECT with duplicate prevention & bottom-sorted disabled options */}
                <td className="border border-gray-200 py-1 px-1 w-[220px]">
                  <select
                    className="w-full p-1 text-sm text-center rounded bg-white border"
                    value={row.productId ?? ""}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                  >
                    <option value="">Select Product</option>
                    {sortedOptions.map((product) => {
                      const id = Number(product.id);
                      const isPickedElsewhere = pickedIds.has(id) && id !== Number(row.productId);
                      return (
                        <option key={id} value={id} disabled={isPickedElsewhere}>
                          {product.product_name}
                          {isPickedElsewhere ? " (selected)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </td>

                {/* DISPATCHED Shell */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full p-1 text-sm text-center rounded bg-white"
                    value={row.dispatchedShell ?? ""}
                    onChange={(e) => handleRowChange(index, "dispatchedShell", e.target.value)}
                  />
                </td>

                {/* DISPATCHED PCS */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
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
                    value={row.sellingPrice ?? ""}
                  />
                </td>

                {/* EMPTY PRICE - Shell */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    disabled
                    className="w-full p-1 text-sm text-center bg-gray-100"
                    value={row.shellPrice ?? ""}
                  />
                </td>

                {/* EMPTY PRICE - PCS */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    disabled
                    className="w-full p-1 text-sm text-center bg-gray-100"
                    value={row.bottlePrice ?? ""}
                  />
                </td>

                {/* EXPECTED SALE */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                    disabled
                    value={
                      Number.isFinite(parseFloat(row.expectedSale))
                        ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : ""
                    }
                  />
                </td>

                {/* AVAILABLE (PCS) */}
                <td className="border border-gray-200 py-1 px-1 text-sm text-center">
                  {showAvail}
                </td>

                {/* ACTIONS */}
                <td className="p-1 border w-[80px]">
                  <button
                    onClick={() => removeRow(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default VanLoadTable;