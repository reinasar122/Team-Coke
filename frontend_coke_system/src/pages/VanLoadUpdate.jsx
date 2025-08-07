
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState,useMemo } from 'react';
import axios from 'axios';

import ExpensesSection from '../components/merchandisingcomponents/ExpensesSection';


const VanLoadUpdate = () => {
  const [refundablesTotal, setRefundablesTotal] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const saleId = location.state?.id;
  const [sale, setSale] = useState(null);
  const [rows, setRows] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [overallTotal, setOverallTotal] = useState(0);

  // Expense-related states
  const [activeTab, setActiveTab] = useState('expenses');
  const [miscItems, setMiscItems] = useState([]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmt, setNewAmt] = useState('');

  const [products, setProducts] = useState([]);
  const [pricingData, setPricingData] = useState([]);

const calculateTotalExpenses = () => {
  return miscItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
};


// Total expected sale
const totalExpectedSale = useMemo(() => {
  return rows.reduce((sum, row) => sum + (parseFloat(row.expected_sale) || 0), 0);
}, [rows]);

// Total actual sale
const totalActualSale = useMemo(() => {
  return rows.reduce((sum, row) => sum + (parseFloat(row.actual_sale) || 0), 0);
}, [rows]);

// Total expenses
const totalExpenses = useMemo(() => {
  return miscItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
}, [miscItems]);

// Total refunds (from empty shells and pcs)
const totalRefunds = useMemo(() => {
  return rows.reduce((sum, row) => {
    const shellRefund = (parseFloat(row.empty_return_shell) || 0) * (parseFloat(row.empty_price_shell) || 0);
    const pcRefund = (parseFloat(row.empty_return_pcs) || 0) * (parseFloat(row.empty_price_pc) || 0);
    return sum + shellRefund + pcRefund;
  }, 0);
}, [rows]);

// Grand total: Actual Sale + Expenses - Refunds
const grandTotal = useMemo(() => {
  return totalActualSale + totalExpenses - totalRefunds;
}, [totalActualSale, totalExpenses, totalRefunds]);

 
// Fetch unit types first
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

// Create unitTypeMap once unitTypes are fetched
const unitTypeMap = useMemo(() => {
  const map = {};
  unitTypes.forEach(ut => {
    map[ut.id] = ut.content_no;
  });
  return map;
}, [unitTypes]);

// Fetch sale data
useEffect(() => {
  if (!saleId) return;

  axios.get(`http://localhost:8080/api/merchandising-set/${saleId}/`)
    .then((res) => {
      setSale(res.data); // just store the raw sale
    })
    .catch((err) => {
      console.error(err);
      alert("Failed to fetch sale data.");
    });
}, [saleId]);

// Process rows AFTER unitTypeMap is ready and sale is loaded
useEffect(() => {
  if (!sale || !unitTypes.length) return;

  if (sale.items && Array.isArray(sale.items)) {
    const processedRows = sale.items.map(item => {
      const product = item.product_detail ?? item.product ?? {};
      const unitTypeId = product.unit_type ?? null;
      const contentNo = unitTypeMap[unitTypeId] ?? 1;

      // (rest of your row mapping logic...)
      const dispatchedShell = parseFloat(item.dispatched_shell ?? 0);
      const dispatchedPcs = Math.round(dispatchedShell * contentNo);

      const soldShell = parseFloat(item.sold_shell ?? 0);
      const soldPcs = Math.round(soldShell * contentNo);

      const price = parseFloat(item.selling_price ?? 0);
      const discount = parseFloat(item.discount_percent ?? item.discount ?? 0);
      const actualSale = parseFloat((soldPcs * price * (1 - discount / 100)).toFixed(2));

      const emptyReturnShell = parseFloat(item.empty_return_shell ?? 0);
      const emptyReturnPcs = Math.round(emptyReturnShell * contentNo);

      const discrepancyShell = dispatchedShell - soldShell;
      const discrepancyPcs = dispatchedPcs - soldPcs;

      const actualReturnShell = item.actual_return_shell != null
        ? parseFloat(item.actual_return_shell)
        : discrepancyShell;

      const actualReturnPcs = item.actual_return_pcs != null
        ? Math.round(parseFloat(item.actual_return_pcs))
        : discrepancyPcs;

      return {
        ...item,
        productId: product.id,
        product_name: product.product_name ?? "",
        unit_type_id: unitTypeId,
        content_no: contentNo,

        dispatched_shell: dispatchedShell,
        dispatched_pcs: dispatchedPcs,

        sold_shell: soldShell,
        sold_pcs: soldPcs,
        selling_price: price,
        discount: discount,
        actual_sale: actualSale,

        empty_price_shell: parseFloat(item.empty_price_shell ?? 0),
        empty_price_pc: parseFloat(item.empty_price_pc ?? 0),

        expected_return_shell_empty: soldShell,
        expected_return_pcs_empty: soldPcs,

        expected_return_shell_nonempty: discrepancyShell,
        expected_return_pcs_nonempty: discrepancyPcs,

        empty_return_shell: emptyReturnShell,
        empty_return_pcs: emptyReturnPcs,
        actual_return_shell: actualReturnShell,
        actual_return_pcs: actualReturnPcs,

        discrepancy_empties_shell: soldShell - emptyReturnShell,
        discrepancy_empties_pc: soldPcs - emptyReturnPcs,

        discrepancy_full_shell: dispatchedShell - soldShell - actualReturnShell,
        discrepancy_full_pcs: dispatchedPcs - soldPcs - actualReturnPcs,
      };
    });

    setRows(processedRows);
  }
}, [sale, unitTypeMap]);





const handleRowChange = (index, field, value) => {
  const updatedRows = [...rows];
  const row = updatedRows[index];

  const contentNo = parseFloat(unitTypeMap[row.unit_type_id]) || 1;
  const numericValue = parseFloat(value) || 0;

  row[field] = numericValue;

  // 🔁 Shell ↔ PCS Sync
  if (field === "sold_shell") {
    row.sold_pcs = Math.round(numericValue * contentNo);
  } else if (field === "sold_pcs") {
    row.sold_shell = parseFloat((numericValue / contentNo).toFixed(2));
  }

  if (field === "empty_return_shell") {
    row.empty_return_pcs = Math.round(numericValue * contentNo);
  } else if (field === "empty_return_pcs") {
    row.empty_return_shell = parseFloat((numericValue / contentNo).toFixed(2));
  }

  if (field === "actual_return_shell") {
    row.actual_return_pcs = Math.round(numericValue * contentNo);
  } else if (field === "actual_return_pcs") {
    row.actual_return_shell = parseFloat((numericValue / contentNo).toFixed(2));
  }

 // 💰 Actual Sale Calculation (NOW includes shell/empty price!)
if (["sold_pcs", "sold_shell", "discount"].includes(field)) {
  const pcsPrice = parseFloat(row.selling_price) || 0;
  const shellPrice = parseFloat(row.empty_price_shell || 0);
  const pcs = parseFloat(row.sold_pcs) || 0;
  const shells = parseFloat(row.sold_shell) || 0;
  const discount = parseFloat(row.discount || row.discount_percent || 0);

  const contentValue = pcs * pcsPrice;
  const shellValue = shells * shellPrice;
  const rawTotal = contentValue + shellValue;

  row.actual_sale = parseFloat((rawTotal * (1 - discount / 100)).toFixed(2));
}


  // 📦 Returned With Content (dispatched - sold)
  row.returned_with_content_pcs = (parseFloat(row.dispatched_pcs) || 0) - (parseFloat(row.sold_pcs) || 0);
  row.returned_with_content_shell = (parseFloat(row.dispatched_shell) || 0) - (parseFloat(row.sold_shell) || 0);

  // 📉 Discrepancy (Empty)
  const hasEmptyPrice = parseFloat(row.empty_price_shell || 0) > 0;

if (hasEmptyPrice) {
  row.discrepancy_empties_pc = (parseFloat(row.sold_pcs) || 0) - (parseFloat(row.empty_return_pcs) || 0);
  row.discrepancy_empties_shell = (parseFloat(row.sold_shell) || 0) - (parseFloat(row.empty_return_shell) || 0);
} else {
  row.discrepancy_empties_pc = 0;
  row.discrepancy_empties_shell = 0;
}

    // ⚠️ Discrepancy (Non-Empty) = Returned with content - Actual returned (with content)
  row.discrepancy_full_pcs = row.returned_with_content_pcs - (parseFloat(row.actual_return_pcs) || 0);
  row.discrepancy_full_shell = row.returned_with_content_shell - (parseFloat(row.actual_return_shell) || 0);

  updatedRows[index] = row;
  setRows(updatedRows);
};

// Compute refundables total
useEffect(() => {
  const totalRefundables = rows.reduce((sum, row) => {
    const shellQty = parseFloat(row.empty_return_shell || 0);
    const pcsQty = parseFloat(row.empty_return_pcs || 0);
    const shellPrice = parseFloat(row.empty_price_shell || 0);
    const pcsPrice = parseFloat(row.empty_price_pc || 0);

    const shellTotal = shellQty * shellPrice;
    const pcsTotal = pcsQty * pcsPrice;

    return sum + (isNaN(shellTotal) ? 0 : shellTotal) + (isNaN(pcsTotal) ? 0 : pcsTotal);
  }, 0);

  setRefundablesTotal(totalRefundables.toFixed(2)); // Optional: round to 2 decimals
}, [rows]);

// Compute expected sale + misc - refundables
useEffect(() => {
  const actualSaleTotal = rows.reduce((sum, row) => {
    const val = parseFloat(row.actual_sale || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalExpenses = miscItems.reduce((sum, item) => {
    const val = parseFloat(item.amount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const refundables = parseFloat(refundablesTotal || 0);

  const finalTotal = actualSaleTotal - refundables - totalExpenses;
  setOverallTotal(finalTotal.toFixed(2));

}, [rows, miscItems, refundablesTotal]);

  if (!sale) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading sale data...
      </div>
    );
  }

  const handleSubmit = () => {
  if (!sale || sale.transaction_type_name !== "Van Load") {
    alert("This update is only applicable to Van Load transactions.");
    return;
  }

  const payload = {
    sale_id: saleId,
    total_expected_sale: totalExpectedSale,
    total_actual_sale: totalActualSale,
    products: rows.map(row => ({
      productId: row.productId,
      sold_shell: row.sold_shell,
      sold_pcs: row.sold_pcs,
      discount: row.discount,
      actual_sale: row.actual_sale,
      empty_return_shell: row.empty_return_shell,
      empty_return_pcs: row.empty_return_pcs,
      discrepancy_empties_shell: row.discrepancy_empties_shell,
      discrepancy_empties_pc: row.discrepancy_empties_pc,
      actual_return_shell: row.actual_return_shell,
      actual_return_pcs: row.actual_return_pcs,
      discrepancy_full_shell: row.discrepancy_full_shell,
      discrepancy_full_pcs: row.discrepancy_full_pcs
    })
  )};

  axios.post("http://localhost:8080/api/van-load-return/", payload)
    .then(() => {
      alert("Van Load return successfully submitted.");
      navigate("/merchandising-sale");
    })
    .catch((error) => {
      console.error("Submission failed:", error);
      alert("Failed to submit van load return.");
    });
};

  return (
    <div className="w-100 mx-auto p-6 bg-white shadow rounded-lg mt-4">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">Van Load Return</h2>

          <ExpensesSection
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                miscItems={miscItems}
                setMiscItems={setMiscItems}
                newDesc={newDesc}
                setNewDesc={setNewDesc}
                newAmt={newAmt}
                setNewAmt={setNewAmt}
                calculateTotalExpenses={calculateTotalExpenses}
            />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <label className="font-semibold">MSP No:</label>
          <div className="p-2 border rounded">{sale.msp_no}</div>
        </div>
        <div>
          <label className="font-semibold">Transaction Type:</label>
          <div className="p-2 border rounded">{sale.transaction_type_name}</div>
        </div>
        <div>
          <label className="font-semibold">Handled By:</label>
          <div className="p-2 border rounded">{sale.handled_by}</div>
        </div>
        <div>
          <label className="font-semibold">Date Created:</label>
          <div className="p-2 border rounded">{new Date(sale.date_time).toLocaleString()}</div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2">Product Details</h3>
      <table className="w-full text-sm text-center border border-gray-300 rounded shadow-sm mb-5">
        <thead className="bg-gray-100 text-gray-800">
          <tr className="text-xs font-semibold">
            <th className="border border-gray-300 py-2 px-1">PRODUCT</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISPATCHED</th>
            <th className="border border-gray-300 py-2 px-1">SELLING PRICE</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>SOLD</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>EMPTY PRICE</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (Empty)</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Empty)</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>RETURNED (With Content/s)</th>
            <th className="border border-gray-300 py-2 px-1" colSpan={2}>DISCREPANCY (Non-empty)</th>
            <th className="border border-gray-300 py-2 px-1">DISCOUNT (%)</th>
            <th className="border border-gray-300 py-2 px-1">EXPECTED SALE</th>
            <th className="border border-gray-300 py-2 px-1">ACTUAL SALE</th>
          </tr>
          <tr className="bg-gray-200">
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
            <td className="border border-gray-300 py-1 text-[11px] font-medium">PCS</td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1"></td>
            <td className="border border-gray-300 py-1"></td>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="bg-white hover:bg-gray-50 transition duration-150">
              <td className="border border-gray-200 py-1 px-1 w-[120px]">
                <div className="p-2 border rounded text-sm text-center">
                  {row.product_detail?.product_name || `Product #${row.product}`}
                </div>
              </td>

              <td className="border border-gray-200 py-1 px-1  w-[70px]">
                <div className="p-2 border rounded">{row.dispatched_shell}</div>
              </td>
              <td className="border border-gray-200 py-1 px-1  w-[70px]">
                <div className="p-2 border rounded">{row.dispatched_pcs}</div>
              </td>
             <td className="border border-gray-200 py-1 px-1  w-[70px]">
              <div className="p-2 border rounded text-sm text-center">
                {row.selling_price || "0.00"}
              </div>
            </td>


               <td className="border border-gray-200 py-1 px-1  w-[70px]">
                <input type="number" 
                className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                 value={row.sold_shell || ""} 
                onChange={(e) => handleRowChange(index, "sold_shell", e.target.value)} />
              </td>
              <td className="border border-gray-200 py-1 px-1  w-[70px]">
                <input type="number"
                 className="w-full p-1 text-sm text-center rounded bg-yellow-50" 
                 value={row.sold_pcs || ""} 
                 onChange={(e) => handleRowChange(index, "sold_pcs", e.target.value)} />
              </td>

              <td className="border border-gray-200 py-1 px-1  w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={row.empty_price_shell || ""}
                  disabled
                />
              </td>
              <td className="border border-gray-200 py-1 px-1  w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={row.empty_price_pc || ""}
                  disabled
                />
              </td>


             {[
              "empty_return_shell", 
              "empty_return_pcs",
              "discrepancy_empties_shell", 
              "discrepancy_empties_pc",
              "actual_return_shell", 
              "actual_return_pcs",
              "discrepancy_full_shell", 
              "discrepancy_full_pcs"
            ].map((field, i) => (
              <td key={i} className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  value={row[field] === 0 ? "" : row[field] || ""}
                  onChange={(e) => handleRowChange(index, field, e.target.value)}
                  disabled={field.includes("discrepancy")}
                  className={`w-full p-1 text-sm text-center rounded
                    ${field.includes("expectedReturn") ? "bg-yellow-50" : "bg-gray-100"}
                    ${field.includes("discrepancy") && parseInt(row[field]) !== 0 ? "bg-red-100 text-red-700 font-semibold" : ""}
                    ${field.includes("discrepancy") ? "cursor-not-allowed" : ""}
                  `}
                />
              </td>
            ))}


              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className={`w-full p-1 text-sm text-center rounded bg-white border ${row.sold_shell > 0 || row.sold_pcs > 0 ? "bg-yellow-50" : "bg-gray-200 cursor-not-allowed"}`}
                  value={row.discount === 0 ? "" : row.discount}
                  onChange={(e) => handleRowChange(index, "discount", e.target.value)}
                  disabled={!(row.sold_shell > 0 || row.sold_pcs > 0)}
                />
              </td>

              <td className="border border-gray-200 py-1 px-1">
                <div className="p-2 border rounded">{row.expected_sale}</div>
              </td>
              <td className="border border-gray-200 py-1 px-1">
                <input
                  className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                  disabled
                  value={row.actual_sale ? `₱${parseFloat(row.actual_sale).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}
                />
              </td>
            </tr>
          ))}

          <tr className="bg-gray-200 font-semibold text-[13px] text-right">
            <td className="border border-gray-300 py-2 px-1 text-center">TOTAL</td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            <td className="border border-gray-300 py-2 px-1 text-center"></td>
            {Array(10).fill(null).map((_, i) => (
              <td key={i} className="border border-gray-300 py-2 px-1"></td>
            ))}
            <td className="border border-gray-300 py-2 px-1"></td>
            <td className="border border-gray-300 py-2 px-1 text-green-700">
              ₱{totalExpectedSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>
            <td className="border border-gray-300 py-2 px-1 text-blue-700">
              ₱{totalActualSale.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>
          </tr>

        </tbody>
      </table>
   <div className="mt-4 space-y-2 text-right">
  <p>Expected Sale: <span className="font-medium">₱{totalExpectedSale.toFixed(2)}</span></p>
  <p>Actual Sale: <span className="font-medium">₱{totalActualSale.toFixed(2)}</span></p>
  <p className="text-red-600"> Expenses - ₱{totalExpenses.toFixed(2)}</p>
  <p className="text-red-600"> Refundables - ₱{totalRefunds.toFixed(2)}</p>
  <hr className="my-2 border-t border-gray-300" />
  <p className="font-bold text-lg">
    Net Sale (Overall Total): ₱{grandTotal.toFixed(2)}
  </p>
</div>



      <div className="md:col-span-2">
        <label className="font-semibold">Remarks:</label>
        <textarea
          className="w-full p-2 border rounded"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Enter remarks here..."
        />
      </div>

      
        <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
            <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
                onClick={handleSubmit}
                >
                Submit Van Load Return
            </button>
        </div>
    </div>
  );
};

export default VanLoadUpdate;
