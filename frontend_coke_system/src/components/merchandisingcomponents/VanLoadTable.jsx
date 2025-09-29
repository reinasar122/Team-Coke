// src/components/merchandisingcomponents/VanLoadTable.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { FaTrash } from 'react-icons/fa';
import '../../styles/global.scss';
import ProductSearchSelect from "../common/ProductSearchSelect"; // adjust path

/**
 * Props:
 * - rows, setRows
 * - products
 * - warehouseId (number OR object with {id})
 * - setTotalExpectedSale
 * - onAdjustmentsChange?: function([{ product_id, delta }])   // negative delta to deduct
 * - defaultDiscount?: number|string  // optional global default (%) to seed new rows
 */
const VanLoadTable = ({
  rows,
  setRows,
  products,
  warehouseId,
  setTotalExpectedSale,
  onAdjustmentsChange,
  defaultDiscount, // ✅ optional
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

  const getSortedProductsForRow = useCallback(
    (currentId) => {
      const sorted = [...(products || [])];
      sorted.sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        const aPickedElse = pickedIds.has(aId) && aId !== Number(currentId);
        const bPickedElse = pickedIds.has(bId) && bId !== Number(currentId);
        if (aPickedElse !== bPickedElse) return aPickedElse ? 1 : -1;
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

      const nextRow = {
        ...(updated[index] || {}),
        productId,
        productName: selectedProduct.product_name,
        priceId,
        contentNo: selectedProduct.unit_type?.content_no || 1,
        shellPrice: fullPrice?.shell_price ?? "",
        bottlePrice: fullPrice?.bottle_price ?? "",
        sellingPrice: fullPrice?.selling_price ?? "",
        // Seed discount
        discount:
          (updated[index]?.discount !== undefined && updated[index]?.discount !== null)
            ? updated[index].discount
            : (defaultDiscount ?? ""),
      };

      // compute expectedSale right away (uses current dispatchedPcs & discount)
      const price = n(nextRow.sellingPrice);
      const dPct = n(nextRow.discount);
      const dispatchedPcs = n(nextRow.dispatchedPcs);
      nextRow.expectedSale = Number((price * dispatchedPcs * (1 - dPct / 100)).toFixed(2));

      updated[index] = nextRow;
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
        discount: updated[index]?.discount ?? (defaultDiscount ?? ""),
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
          discount: defaultDiscount ?? "",
        },
      ]);
    }
  };

  const handleRowChange = (index, field, value) => {
  const updated = [...rows];
  const row = { ...updated[index] };

  const n = (v) => parseFloat(v) || 0;

  if (value === null) {
    row[field] = null;
    updated[index] = row;
    setRows(updated);
    return;
  }

  row[field] = value;

  // Get product & conversion
  const productId = Number(row.productId);
  const product = products.find(p => p.id === productId);
  const conversion = n(product?.unit_type?.content_no || 1);
  const price = n(row.unitPrice || product?.price?.selling_price);

  row.unitPrice = price;
  row.conversion = conversion;

  const discountPercent = n(row.discount); // Discount in %

  // --- Update dispatched quantities ---
  if (["dispatchedPcs", "dispatchedShell"].includes(field)) {
    if (field === "dispatchedShell") {
      const shellQty = Math.floor(n(value));
      row.dispatchedShell = shellQty;
      row.dispatchedPcs = shellQty * conversion;
    } else if (field === "dispatchedPcs") {
      const pcsQty = n(value);
      row.dispatchedPcs = pcsQty;
      if (pcsQty >= conversion) row.dispatchedShell = Math.floor(pcsQty / conversion);
    }
  }

  // --- Calculate expectedSale with discount ---
  const baseSale = price * row.dispatchedPcs;
  row.expectedSale = Number((baseSale * (1 - discountPercent / 100)).toFixed(2));

  updated[index] = row;
  setRows(updated);

  const totalExpected = updated.reduce((sum, r) => sum + n(r.expectedSale), 0);
  setTotalExpectedSale(totalExpected);
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
    <div className="table-wrapper">
      <table className="table">
        <thead className="bg-gray-200 text-gray-700">
          <tr>
            <th className="border">Product</th>
            <th className="border" colSpan={2}>Dispatched</th>
            <th className="border">Selling Price</th>
            <th colSpan={2}>Empty Price</th>
            <th className="border">Discount (%)</th>
            <th className="border">Expected Sale</th>
            <th className="border p-2">Available</th>
            <th className="border p-2">Actions</th>
          </tr>
          <tr className="bg-slate-100">
            <td className="border"></td>
            <td className="border">Shell</td>
            <td className="border">PCS</td>
            <td className="border"></td>
            <td className="border">Shell</td>
            <td className="border">PCS</td>
            <td className="border"></td>
            <td className="border"></td>
            <td className="border">PCS</td>
            <td className="border"></td>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const productId = Number(row.productId);
            const avail = availableStock[productId];
            const showAvail = (avail === 0 || typeof avail === "number") ? avail : "--";

            return (
              <tr key={row.id ?? index} className="bg-white hover:bg-gray-50 transition duration-150">
                {/* PRODUCT SELECT */}
                <td className="border border-gray-200 py-1 px-1 w-[200px]">
                  <ProductSearchSelect
                    products={getSortedProductsForRow(row.productId)}
                    value={row.productName ?? ""}
                    onChange={(id) => handleProductChange(index, String(id))}
                    excludeIds={Array.from(pickedIds).filter(id => id !== Number(row.productId))}
                    placeholder="Search product…"
                  />
                </td>

                {/* DISPATCHED Shell */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="input-always-spinner input text-center bg-yellow-50"
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
                    placeholder="0"
                    className="input-always-spinner input text-center bg-yellow-50"
                    value={row.dispatchedPcs ?? ""}
                    onChange={(e) => handleRowChange(index, "dispatchedPcs", e.target.value)}
                  />
                </td>

                {/* SELLING PRICE */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="text"
                    disabled
                    className="w-full p-1 text-sm text-center bg-gray-100"
                    value={
                      row.sellingPrice !== "" && row.sellingPrice != null
                        ? `₱${Number(row.sellingPrice).toFixed(2)}`
                        : ""
                    }
                  />
                </td>

                {/* EMPTY PRICE - Shell */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="text"
                    disabled
                    className="w-full p-1 text-sm text-center bg-gray-100"
                    value={
                      row.shellPrice !== "" && row.shellPrice != null
                        ? `₱${Number(row.shellPrice).toFixed(2)}`
                        : ""
                    }
                  />
                </td>

                {/* EMPTY PRICE - PCS */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="text"
                    disabled
                    className="w-full p-1 text-sm text-center bg-gray-100"
                    value={
                      row.bottlePrice !== "" && row.bottlePrice != null
                        ? `₱${Number(row.bottlePrice).toFixed(2)}`
                        : ""
                    }
                  />
                </td>


                {/* DISCOUNT (%) — editable */}
                <td className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    className="input-always-spinner input text-center bg-yellow-50"
                    value={row.discount ?? ""}
                    onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                  />
                </td>

                {/* EXPECTED SALE (net of discount) */}
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
                <td className="icon-btn-danger">
                  {row.productId && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="trash-btn"
                    >
                      <FaTrash />
                    </button>
                  )}
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
