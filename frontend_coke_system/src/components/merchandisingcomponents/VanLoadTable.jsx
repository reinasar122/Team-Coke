import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const VanLoadTable = ({ rows, setRows, products, warehouseId, setTotalExpectedSale }) => {
  const [availableStock, setAvailableStock] = useState({});
  const [pricingData, setPricingData] = useState([]);

  // ---------------- helpers ----------------
  const n = (v) => parseFloat(v) || 0;

  // Normalize various shapes to a number id
  const toWid = (val) => {
    if (val == null) return null;
    if (typeof val === "number" || typeof val === "string") return Number(val);
    if (typeof val === "object") return Number(val.id ?? val.warehouse_id ?? val.value ?? null);
    return null;
  };

  // Resolve current warehouse id (always returns a number or null)
  const getCurrentWarehouseId = () => {
    const fromProp = toWid(warehouseId);
    if (fromProp) return fromProp;

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    // Admin: prefer selectedWarehouse, else their enrolled
    const fromSelected = toWid(selectedWarehouse);
    if ((user.role || "").toLowerCase() === "admin" && fromSelected) return fromSelected;

    // Non-admin or no selected: use their enrolled warehouse
    return toWid(user.warehouse_id ?? user.warehouse ?? null);
  };

  // ---------------- fetch stocks (by warehouse, once + when signaled) ----------------
  const fetchAllStocks = useCallback(async () => {
    try {
      const wid = getCurrentWarehouseId();
      if (!wid || Number.isNaN(wid)) {
        console.warn("No valid warehouse id resolved for stocks fetch:", wid);
        setAvailableStock({});
        return;
      }

      // Map product names -> ids for payloads that only include names
      const nameToId = new Map(
        (products || []).map((p) => [(p.product_name || "").trim().toLowerCase(), Number(p.id)])
      );

      const { data } = await axios.get(
        `http://localhost:8080/api/stocks/?warehouse=${encodeURIComponent(wid)}`
      );

      const map = {};
      const list = Array.isArray(data) ? data : [data];
      for (const row of list.filter(Boolean)) {
        // prefer numeric id from payload; else fallback to name
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
      console.error("Failed to load warehouse stocks for VanLoadTable:", e);
      setAvailableStock({});
    }
  }, [warehouseId, products]);

  useEffect(() => {
    fetchAllStocks();
    const onWhChange = () => fetchAllStocks();
    const onStocksChanged = () => fetchAllStocks(); // refresh after deductions
    window.addEventListener("warehouseChanged", onWhChange);
    window.addEventListener("stocksChanged", onStocksChanged);
    return () => {
      window.removeEventListener("warehouseChanged", onWhChange);
      window.removeEventListener("stocksChanged", onStocksChanged);
    };
  }, [fetchAllStocks]);

  // ---------------- pricing catalog (fill row prices) ----------------
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

  // ---------------- row handlers ----------------
  const handleProductChange = (index, value) => {
    const updatedRows = [...rows];
    const productId = parseInt(value, 10);
    const selectedProduct = products.find((p) => p.id === productId);

    if (selectedProduct) {
      const priceId = selectedProduct.price?.id || null;
      const fullPrice = pricingData.find((price) => price.id === priceId);

      updatedRows[index] = {
        ...(updatedRows[index] || {}),
        productId,
        productName: selectedProduct.product_name,
        priceId,
        contentNo: selectedProduct.unit_type?.content_no || 1,
        shellPrice: fullPrice?.shell_price ?? "",
        bottlePrice: fullPrice?.bottle_price ?? "",
        sellingPrice: fullPrice?.selling_price ?? "",
      };
    } else {
      updatedRows[index] = {
        ...(updatedRows[index] || {}),
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

    setRows(updatedRows);

    // Auto-add a new blank row only if valid product chosen and this is the last row
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
    const updatedRows = [...rows];
    const row = { ...updatedRows[index] };

    row[field] = value;

    // Resolve product & conversion
    const product = products.find((p) => p.id === parseInt(row.productId, 10));
    const conversion = n(product?.unit_type?.content_no || row.contentNo || 1);
    row.contentNo = conversion;

    // Resolve prices (prefer pricingData by priceId)
    const fullPrice = pricingData.find((p) => p.id === row.priceId) || product?.price || {};
    const sellingPrice = n(fullPrice.selling_price);
    row.sellingPrice = sellingPrice;

    // Available stock for this product (PCS)
    const availablePcs = availableStock[Number(row.productId)];
    const hasAvail = typeof availablePcs === "number";
    const cap = hasAvail ? availablePcs : Infinity;

    // PCS ↔ Shell conversions with validation vs available
    if (field === "dispatchedShell") {
      const pcsCalc = Math.round(n(value) * conversion);
      if (pcsCalc > cap) {
        if (hasAvail) alert(`Dispatched PCS (${pcsCalc}) exceeds available stock (${availablePcs}).`);
        row.dispatchedPcs = hasAvail ? cap : pcsCalc;
        row.dispatchedShell = ( (hasAvail ? cap : pcsCalc) / conversion ).toFixed(2);
      } else {
        row.dispatchedPcs = pcsCalc;
      }
    } else if (field === "dispatchedPcs") {
      const pcsVal = Math.max(0, Math.round(n(value))); // avoid negatives / decimals
      if (pcsVal > cap) {
        if (hasAvail) alert(`Dispatched PCS (${pcsVal}) exceeds available stock (${availablePcs}).`);
        row.dispatchedPcs = hasAvail ? cap : pcsVal;
        row.dispatchedShell = ( (hasAvail ? cap : pcsVal) / conversion ).toFixed(2);
      } else {
        row.dispatchedPcs = pcsVal;
        row.dispatchedShell = (pcsVal / conversion).toFixed(2);
      }
    }

    // Expected sale (content price × dispatched PCS)
    const dispatchedPcs = n(row.dispatchedPcs);
    row.expectedSale = Number((n(row.sellingPrice) * dispatchedPcs).toFixed(2));

    updatedRows[index] = row;
    setRows(updatedRows);

    // Update parent total expected sale
    const expectedTotal = updatedRows.reduce((sum, r) => sum + n(r.expectedSale), 0);
    setTotalExpectedSale(expectedTotal);
  };

  const removeRow = (index) => {
    const updatedRows = [...rows];
    updatedRows.splice(index, 1);
    setRows(updatedRows);

    const expectedTotal = updatedRows.reduce((sum, r) => sum + n(r.expectedSale), 0);
    setTotalExpectedSale(expectedTotal);
  };

  // ---------------- render ----------------
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

            return (
              <tr key={row.id ?? index} className="bg-white border-t">
                {/* PRODUCT SELECT */}
                <td className="border border-gray-200 py-1 px-1 w-[160px]">
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
                      row.expectedSale !== undefined && row.expectedSale !== null
                        ? `₱${parseFloat(row.expectedSale).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : ""
                    }
                  />
                </td>

                {/* AVAILABLE STOCK (PCS) */}
                <td className="border border-gray-200 py-1 px-1 text-sm text-center">
                  {showAvail}
                </td>

                {/* ACTION BUTTONS */}
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
