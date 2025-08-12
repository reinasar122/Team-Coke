// src/pages/VanLoadUpdate.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import ExpensesSection from '../components/merchandisingcomponents/ExpensesSection';
import PaymentModal from '../components/PaymentModal';

const VanLoadUpdate = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const saleId = location.state?.id;

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [sale, setSale] = useState(null);
  const [rows, setRows] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [remarks, setRemarks] = useState('');

  // Expenses
  const [activeTab, setActiveTab] = useState('expenses');
  const [miscItems, setMiscItems] = useState([]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmt, setNewAmt] = useState('');

  // Totals
  const [refundablesTotal, setRefundablesTotal] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);

  const calculateTotalExpenses = () =>
    miscItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // Expected sale from API rows
  const totalExpectedSale = useMemo(() => {
    return rows.reduce((sum, row) => sum + (parseFloat(row.expected_sale) || 0), 0);
  }, [rows]);

  // 🔢 Page total of ACTUAL SALE (sum of each row.actual_sale)
  const totalActualSale = useMemo(() => {
    return rows.reduce((sum, row) => sum + (parseFloat(row.actual_sale) || 0), 0);
  }, [rows]);

  // Total expenses (from miscItems)
  const totalExpenses = useMemo(() => calculateTotalExpenses(), [miscItems]);

  // Fetch unit types
  useEffect(() => {
    const fetchUnitTypes = async () => {
      try {
        const res = await axios.get('http://localhost:8080/api/unit-types/');
        setUnitTypes(res.data || []);
      } catch (err) {
        console.error('Failed to fetch unit types:', err);
      }
    };
    fetchUnitTypes();
  }, []);

  // Build a unitType -> content_no map
  const unitTypeMap = useMemo(() => {
    const map = {};
    unitTypes.forEach((u) => (map[u.id] = u.content_no));
    return map;
  }, [unitTypes]);

  // Fetch sale set
  useEffect(() => {
    if (!saleId) return;
    axios
      .get(`http://localhost:8080/api/merchandising-set/${saleId}/`)
      .then((res) => setSale(res.data))
      .catch((err) => {
        console.error(err);
        alert('Failed to fetch sale data.');
      });
  }, [saleId]);

  // Process rows AFTER unit types are loaded and sale is ready
  useEffect(() => {
    if (!sale || !unitTypes.length) return;
    if (sale.items && Array.isArray(sale.items)) {
      const processed = sale.items.map((item) => {
        const product = item.product_detail ?? item.product ?? {};
        const unitTypeId = product.unit_type ?? null;
        const contentNo = unitTypeMap[unitTypeId] ?? 1;

        const dispatchedShell = parseFloat(item.dispatched_shell ?? 0);
        const dispatchedPcs = Math.round(dispatchedShell * contentNo);

        const soldShell = parseFloat(item.sold_shell ?? 0);
        const soldPcs = Math.round(soldShell * contentNo);

        const price = parseFloat(item.selling_price ?? 0);
        const discount = parseFloat(item.discount_percent ?? item.discount ?? 0);

        // If empties are priced when sold shells are sold
        const emptyShellPrice = parseFloat(item.empty_price_shell ?? 0);
        const grossPcs = soldPcs * price;
        const grossShells = soldShell * emptyShellPrice;

        // ✅ per-row actual sale: apply discount first, then round
        const rowActualSale = (grossPcs + grossShells) * (1 - discount / 100);

        const emptyReturnShell = parseFloat(item.empty_return_shell ?? 0);
        const emptyReturnPcs = Math.round(emptyReturnShell * contentNo);

        const discrepancyShell = dispatchedShell - soldShell;
        const discrepancyPcs = dispatchedPcs - soldPcs;

        const actualReturnShell =
          item.actual_return_shell != null
            ? parseFloat(item.actual_return_shell)
            : discrepancyShell;

        const actualReturnPcs =
          item.actual_return_pcs != null
            ? Math.round(parseFloat(item.actual_return_pcs))
            : discrepancyPcs;

        return {
          ...item,
          productId: product.id,
          productName: product.product_name ?? '',

          unitTypeId,
          contentNo,

          // dispatched
          dispatched_shell: dispatchedShell,
          dispatched_pcs: dispatchedPcs,

          // sold
          sold_shell: soldShell,
          sold_pcs: soldPcs,

          // pricing/discount
          selling_price: price,
          discount,
          actual_sale: parseFloat(rowActualSale.toFixed(2)),

          // empties prices
          empty_price_shell: emptyShellPrice,
          empty_price_pc: parseFloat(item.empty_price_pc ?? 0),

          // expected returns
          expected_sale: parseFloat(item.expected_sale ?? 0),
          expected_return_shell_empty: soldShell,
          expected_return_pcs_empty: soldPcs,

          expected_return_shell_nonempty: discrepancyShell,
          expected_return_pcs_nonempty: discrepancyPcs,

          // returned (empty)
          empty_return_shell: emptyReturnShell,
          empty_return_pcs: emptyReturnPcs,

          // returned (with content)
          actual_return_shell: actualReturnShell,
          actual_return_pcs: actualReturnPcs,

          // discrepancies
          discrepancy_empties_shell: soldShell - emptyReturnShell,
          discrepancy_empties_pc: soldPcs - emptyReturnPcs,

          discrepancy_full_shell: dispatchedShell - soldShell - actualReturnShell,
          discrepancy_full_pcs: dispatchedPcs - soldPcs - actualReturnPcs,
        };
      });

      setRows(processed);
    }
  }, [sale, unitTypeMap, unitTypes.length]);

  // Handle row edits (sync shell/pcs and recompute)
  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    const row = { ...updated[index] };

    const contentNo = parseFloat(unitTypeMap[row.unitTypeId]) || 1;
    const numericValue = parseFloat(value) || 0;
    row[field] = numericValue;

    // Sync SOLD pcs ↔ shell
    if (field === 'sold_shell') row.sold_pcs = Math.round(numericValue * contentNo);
    else if (field === 'sold_pcs') row.sold_shell = parseFloat((numericValue / contentNo).toFixed(2));

    // Sync empty returns pcs ↔ shell
    if (field === 'empty_return_shell') row.empty_return_pcs = Math.round(numericValue * contentNo);
    else if (field === 'empty_return_pcs') row.empty_return_shell = parseFloat((numericValue / contentNo).toFixed(2));

    // Sync actual returns pcs ↔ shell
    if (field === 'actual_return_shell') row.actual_return_pcs = Math.round(numericValue * contentNo);
    else if (field === 'actual_return_pcs') row.actual_return_shell = parseFloat((numericValue / contentNo).toFixed(2));

    // Recompute actual sale (same formula as mapping)
    const pcsPrice = parseFloat(row.selling_price || 0);
    const shellPrice = parseFloat(row.empty_price_shell || 0);
    const pcs = parseFloat(row.sold_pcs || 0);
    const shells = parseFloat(row.sold_shell || 0);
    const discount = parseFloat(row.discount || 0);

    const grossPcs = pcs * pcsPrice;
    const grossShells = shells * shellPrice;
    const rawTotal = grossPcs + grossShells;

    row.actual_sale = parseFloat((rawTotal * (1 - discount / 100)).toFixed(2));

    // Returned with content
    row.returned_with_content_pcs = (parseFloat(row.dispatched_pcs) || 0) - pcs;
    row.returned_with_content_shell = (parseFloat(row.dispatched_shell) || 0) - shells;

    // Discrepancy (empties)
    const returnedEmptyPcs = parseFloat(row.empty_return_pcs || 0);
    const returnedEmptyShell = parseFloat(row.empty_return_shell || 0);
    const hasEmptyPrice = shellPrice > 0;

    row.discrepancy_empties_pc = hasEmptyPrice ? pcs - returnedEmptyPcs : 0;
    row.discrepancy_empties_shell = hasEmptyPrice ? shells - returnedEmptyShell : 0;

    // Discrepancy (non-empty)
    const actualReturnPcs = parseFloat(row.actual_return_pcs || 0);
    const actualReturnShell = parseFloat(row.actual_return_shell || 0);

    row.discrepancy_full_pcs = row.returned_with_content_pcs - actualReturnPcs;
    row.discrepancy_full_shell = row.returned_with_content_shell - actualReturnShell;

    updated[index] = row;
    setRows(updated);
  };

  // Refundables (money returned for empties)
  useEffect(() => {
    const totalRefunds = rows.reduce((sum, row) => {
      const shellQty = parseFloat(row.empty_return_shell || 0);
      const pcsQty = parseFloat(row.empty_return_pcs || 0);
      const shellPrice = parseFloat(row.empty_price_shell || 0);
      const pcsPrice = parseFloat(row.empty_price_pc || 0);
      return sum + shellQty * shellPrice + pcsQty * pcsPrice;
    }, 0);
    setRefundablesTotal(Number(totalRefunds.toFixed(2)));
  }, [rows]);


// Overall total = total of actual_sale (no deductions)
useEffect(() => {
  setOverallTotal(Number(totalActualSale.toFixed(2)));
}, [totalActualSale]);

  // Empties price total (sold shells * empty shell price)
  const emptiesPriceTotal = useMemo(() => {
    return rows.reduce((sum, row) => {
      const shells = parseFloat(row.sold_shell || 0);
      const shellPrice = parseFloat(row.empty_price_shell || 0);
      return sum + shells * shellPrice;
    }, 0);
  }, [rows]);

  // Discrepancy (Empty) value
  const totalDiscrepancyEmpty = useMemo(() => {
    return rows.reduce((sum, row) => {
      const pcs = parseFloat(row.discrepancy_empties_pc || 0);
      const shells = parseFloat(row.discrepancy_empties_shell || 0);
      const shellPrice = parseFloat(row.empty_price_shell || 0);
      const conversion = parseFloat(row.contentNo || 1);
      return sum + (pcs + shells * conversion) * shellPrice;
    }, 0);
  }, [rows]);

  // Discrepancy (Non-Empty) value
  const totalDiscrepancyNonEmpty = useMemo(() => {
    return rows.reduce((sum, row) => {
      const pcs = parseFloat(row.discrepancy_full_pcs || 0);
      const shells = parseFloat(row.discrepancy_full_shell || 0);
      const contentPrice = parseFloat(row.selling_price || 0);
      const conversion = parseFloat(row.contentNo || 1);
      return sum + (pcs + shells * conversion) * contentPrice;
    }, 0);
  }, [rows]);

  // (Optional) Submit to backend to finalize van-load returns
  const handleSubmit = () => {
    if (!sale || sale.transaction_type_name !== 'Van Load') {
      alert('This update is only applicable to Van Load transactions.');
      return;
    }
    const payload = {
      sale_id: saleId,
      total_expected_sale: totalExpectedSale,
      actual_sale: totalActualSale, // ✅ use the page total here
      products: rows.map((row) => ({
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
        discrepancy_full_pcs: row.discrepancy_full_pcs,
      })),
      remarks,
    };

    axios
      .post('http://localhost:8080/api/van-load-return/', payload)
      .then(() => {
        alert('Van Load return successfully submitted.');
        navigate('/merchandising-sale');
      })
      .catch((error) => {
        console.error('Submission failed:', error);
        alert('Failed to submit van load return.');
      });
  };

  if (!sale) {
    return <div className="p-6 text-center text-gray-500">Loading sale data...</div>;
  }


// ✅ Called only when PaymentModal reports a successful payment for Van Load
const handleVanLoadPaymentSuccess = async (paymentData) => {
  try {
    // 1) Save the van-load return details
    const payload = {
      sale_id: saleId,
      total_expected_sale: totalExpectedSale,
      actual_sale: rows.reduce((s, r) => s + (parseFloat(r.actual_sale || 0)), 0),
      expenses_total: miscItems.reduce((s, i) => s + (parseFloat(i.amount || 0)), 0),
      remarks,
      payment: {
        method: paymentData.paymentMethod,
        amount: paymentData.amount,
        cash_received: paymentData.cashReceived,
        change: paymentData.change,
      },
      products: rows.map((row) => ({
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
        discrepancy_full_pcs: row.discrepancy_full_pcs,
      })),
    };

   axios.post('http://localhost:8080/api/van-load-return/', payload)
    // 2) Mark the merchandising sale as COMPLETE
    //    (adjust field/endpoint to your API; PATCH is common for DRF)
    await axios.patch(
      `http://localhost:8080/api/merchandising-set/${saleId}/`,
      { status: "Complete" }
    );

    // Optional: toast/snackbar here
  } catch (err) {
    console.error("Failed to save Van Load payment:", err);
    alert("Saving payment failed. Please try again.");
    throw err; // rethrow so modal can decide what to do
  }
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
          <div className="p-2 border rounded">
            {sale.date_time ? new Date(sale.date_time).toLocaleString() : '—'}
          </div>
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
          {Array.isArray(rows) && rows.map((row, index) => (
            <tr key={row.id ?? index} className="bg-white hover:bg-gray-50 transition duration-150">
              <td className="border border-gray-200 py-1 px-1 w-[160px]">
                <div className="p-2 border rounded text-sm text-center">
                  {row.productName || row.product_detail?.product_name || `#${row.productId}`}
                </div>
              </td>

              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <div className="p-2 border rounded">{row.dispatched_shell}</div>
              </td>
              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <div className="p-2 border rounded">{row.dispatched_pcs}</div>
              </td>

              <td className="border border-gray-200 py-1 px-1 w-[80px]">
                <div className="p-2 border rounded text-sm text-center">
                  {Number(row.selling_price || 0).toFixed(2)}
                </div>
              </td>

              {/* SOLD */}
              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                  value={row.sold_shell === 0 ? "" : row.sold_shell ?? ""}
                  onChange={(e) => handleRowChange(index, 'sold_shell', e.target.value)}
                />
              </td>
              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                  value={row.sold_pcs === 0 ? "" : row.sold_pcs ?? ""}
                  onChange={(e) => handleRowChange(index, 'sold_pcs', e.target.value)}
                />
              </td>

              {/* EMPTY PRICE */}
              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={row.empty_price_shell ?? ''}
                  disabled
                />
              </td>
              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center bg-gray-100"
                  value={row.empty_price_pc ?? ''}
                  disabled
                />
              </td>

              {/* RETURNED / DISCREPANCIES */}
              {[
                'empty_return_shell',
                'empty_return_pcs',
                'discrepancy_empties_shell',
                'discrepancy_empties_pc',
                'actual_return_shell',
                'actual_return_pcs',
                'discrepancy_full_shell',
                'discrepancy_full_pcs',
              ].map((field, i) => (
                <td key={i} className="border border-gray-200 py-1 px-1">
                  <input
                    type="number"
                    value={row[field] === 0 ? '' : row[field] ?? ''}
                    onChange={(e) => handleRowChange(index, field, e.target.value)}
                    disabled={field.includes('discrepancy')}
                    className={`w-full p-1 text-sm text-center rounded
                      ${field.includes('expectedReturn') ? 'bg-yellow-50' : 'bg-gray-100'}
                      ${field.includes('discrepancy') && parseFloat(row[field] || 0) !== 0 ? 'bg-red-100 text-red-700 font-semibold' : ''}
                      ${field.includes('discrepancy') ? 'cursor-not-allowed' : ''}
                    `}
                  />
                </td>
              ))}

              {/* DISCOUNT */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  type="number"
                  className={`w-full p-1 text-sm text-center rounded bg-white border ${
                    row.sold_shell > 0 || row.sold_pcs > 0 ? 'bg-yellow-50' : 'bg-gray-200 cursor-not-allowed'
                  }`}
                  value={row.discount === 0 ? '' : row.discount}
                  onChange={(e) => handleRowChange(index, 'discount', e.target.value)}
                  disabled={!(row.sold_shell > 0 || row.sold_pcs > 0)}
                />
              </td>

              {/* EXPECTED SALE */}
              <td className="border border-gray-200 py-1 px-1">
                <div className="p-2 border rounded">{Number(row.expected_sale || 0).toFixed(2)}</div>
              </td>

              {/* ACTUAL SALE (per row, read-only) */}
              <td className="border border-gray-200 py-1 px-1">
                <input
                  className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                  disabled
                  value={
                    row.actual_sale
                      ? `₱${parseFloat(row.actual_sale).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                      : ''
                  }
                />
              </td>
            </tr>
          ))}

          {/* TOTAL ROW */}
          <tr className="bg-blue-100 font-semibold text-[13px] text-right">
            <td className="py-2 px-1 text-center text-black">TOTAL</td>
            <td className="border-none py-2 px-1 bg-blue-100"></td>
            <td className="border-none py-2 px-1 bg-blue-100"></td>
            <td className="border-none py-2 px-1 bg-blue-100"></td>
            <td className="border-none py-2 px-1 bg-blue-100"></td>
            <td className="border-none py-2 px-1 bg-blue-100"></td>

            {/* EMPTY PRICE (Shell + Bottle) */}
            <td colSpan={2} className="py-2 px-1 bg-gray-300 text-black text-center font-semibold">
              ₱{parseFloat(emptiesPriceTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            {/* RETURNED (Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(refundablesTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            {/* DISCREPANCY (Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(totalDiscrepancyEmpty || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            <td className="py-2 px-1 bg-blue-100"></td>
            <td className="py-2 px-1 bg-blue-100"></td>

            {/* DISCREPANCY (Non-Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(totalDiscrepancyNonEmpty || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            <td className="border border-gray-300 py-2 px-1 bg-blue-100"></td>

            {/* EXPECTED SALE */}
            <td className="border border-gray-300 py-2 px-1 bg-green-100 text-green-700 font-bold text-center">
              ₱{isNaN(totalExpectedSale) ? '0.00' : totalExpectedSale.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            {/* ACTUAL SALE (page total) */}
            <td className="border border-gray-300 py-2 px-1 bg-gray-200 text-blue-700 font-bold text-center">
              ₱{isNaN(totalActualSale) ? '0.00' : totalActualSale.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Overall total (actual only) */}
      <div className="flex justify-end mt-2 pr-4">
        <div className="flex items-center gap-2 bg-blue-100 px-4 py-2 rounded shadow text-right">
          <span className="font-semibold text-gray-700 text-sm">Overall Total:</span>
          <span className="text-lg font-bold text-blue-800">
            ₱{(parseFloat(overallTotal) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Remarks */}
      <div className="md:col-span-2 mt-4">
        <label className="font-semibold">Remarks:</label>
        <textarea
          className="w-full p-2 border rounded"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Enter remarks here..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          onClick={() => setShowPaymentModal(true)}
        >
          Payment
        </button>
      </div>

      {showPaymentModal && (
        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          rows={rows}
          actualSales={totalActualSale}
          amountDue={Number(overallTotal) || 0}
          emptiesPriceTotal={Number(emptiesPriceTotal) || 0}
          emptyReturns={Number(refundablesTotal) || 0}
          emptyDiscrepancies={Number(totalDiscrepancyEmpty) || 0}
          totalAmount={Number(overallTotal) || 0}
          mspNo={sale.msp_no}
          transactionDate={sale.date_time}
          customerName={sale.customer?.name || "Walk-in"}
          handledBy={sale.handled_by}
          transactionTypeName={sale.transaction_type_name}
          expensesTotal={calculateTotalExpenses()}
          remarks={remarks}
          onRemarksChange={setRemarks}
          // 👉 NEW:
          onPaymentSuccess={handleVanLoadPaymentSuccess}
        />

      )}
    </div>
  );
};

export default VanLoadUpdate;
