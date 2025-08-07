import React, { useEffect, useState } from "react";
import axios from "axios";

const VanLoadTable = ({ rows, setRows, products, warehouseId,setTotalExpectedSale, }) => {
  const [pricingMap, setPricingMap] = useState({});
 const [availableStock, setAvailableStock] = useState({});

  // Load pricing per product (one-time)
  useEffect(() => {
    const fetchPrices = async () => {
      const prices = {};
      products.forEach((product) => {
        prices[product.id] = parseFloat(product.price);
      });
      setPricingMap(prices);
    };
    fetchPrices();
  }, [products]);

 const fetchStockQuantity = async (productId) => {
  if (!productId || !warehouseId) return;

  try {
    const response = await axios.get(
      `http://localhost:8080/api/stocks/?product_id=${productId}&warehouse_id=${warehouseId}`
    );
    
    const quantity = Array.isArray(response.data)
      ? response.data[0]?.quantity_available
      : response.data.quantity_available;

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
      updatedRows[index].sellingPrice = fullPrice.selling_price ?? "";

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
        expectedSale: "",
        contentNo: "",
        sellingPrice:"",
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
      const conversion = parseFloat(product.unit_type?.content_no || 1);

      row.priceId = priceId;
      row.conversion = conversion;
    }
  }

  const product = products.find((p) => p.id === parseInt(row.productId));
  const conversion = parseFloat(product?.unit_type?.content_no || 1);

  const fullPrice = pricingData.find((p) => p.id === row.priceId) || product?.price || {};
  const contentPrice = parseFloat(fullPrice.selling_price || 0);
  const emptyPrice = parseFloat(fullPrice.shell_price || 0);

  row.selling_price = contentPrice;

  // 🛑 Validate against available stock
  const available = availableStock[row.productId] ?? Infinity;
  if (field === "dispatchedPcs") {
    const pcsValue = parseFloat(value || 0);
    if (pcsValue > available) {
      alert("Dispatched PCS exceeds available stock!");
      return;
    }
  }

  // 🔁 PCS ↔ Shell conversion
  if (field === "dispatchedShell") {
    row.dispatchedPcs = Math.round(parseFloat(value || 0) * conversion);
  } else if (field === "dispatchedPcs") {
    row.dispatchedShell = (parseFloat(value || 0) / conversion).toFixed(2);
  }

  // 💰 Expected sale calculation (now excludes refundables)
  const dispatchedPcs = parseFloat(row.dispatchedPcs || 0);
  const dispatchedShell = parseFloat(row.dispatchedShell || 0);
  const returnedWithContentPcs = parseFloat(row.return_with_content_pcs || 0);
  const returnedWithContentShell = parseFloat(row.return_with_content_shell || 0);
  const refundablePcs = parseFloat(row.refundable_pcs || 0);
  const refundableShell = parseFloat(row.refundable_shell || 0);

  const returnPcsTotal = returnedWithContentPcs + (returnedWithContentShell * conversion);
  const refundableTotal = refundablePcs + (refundableShell * conversion);

  const netContentPcs = dispatchedPcs - returnPcsTotal - refundableTotal;
  const contentValue = netContentPcs * contentPrice;

  const netShells = dispatchedShell - returnedWithContentShell - refundableShell;
  const emptyValue = netShells * emptyPrice;

  row.expectedSale = parseFloat((contentValue + emptyValue).toFixed(2));


  setRows(updatedRows);

  const expectedTotal = updatedRows.reduce(
    (sum, r) => sum + (parseFloat(r.expectedSale) || 0),
    0
  );

  setTotalExpectedSale(expectedTotal);
};



  const addRow = () => {
    setRows([
      ...rows,
      {
        product: "",
        dispatched_pcs: 0,
        dispatched_shell: 0,
        expected_sale: 0,
      },
    ]);
  };

  const removeRow = (index) => {
    const updatedRows = [...rows];
    updatedRows.splice(index, 1);
    setRows(updatedRows);
  };

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
        const productId = row.productId;
        const price = pricingMap[productId] || { shell_price: 0, bottle_price: 0 };

        return (
          <tr key={index} className="bg-white border-t">
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

            {/* DISPATCHED Shell */}
            <td className="border border-gray-200 py-1 px-1">
              <input
                type="number"
                className="w-full p-1 text-sm text-center rounded bg-white"
                value={row.dispatchedShell ?? ""}
                onChange={(e) => handleRowChange(index, "dispatchedShell", e.target.value)}
              />
            </td>

            {/* DISPATCHED PCS */}
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
                      })}`
                    : ""
                }
              />
            </td>

            {/* AVAILABLE STOCK */}
            <td className="border border-gray-200 py-1 px-1 text-sm text-center">
              {availableStock[productId] !== undefined && availableStock[productId] !== null
                ? availableStock[productId]
                : "--"}
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
