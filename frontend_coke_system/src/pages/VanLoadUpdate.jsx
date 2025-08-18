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
        const dispatchedPcs   = Math.round(dispatchedShell * contentNo);

        const soldShell = parseFloat(item.sold_shell ?? 0);
        const soldPcs   = Math.round(soldShell * contentNo);

        const price = parseFloat(item.selling_price ?? 0);
        const dPct  = parseFloat(item.discount_percent ?? item.discount ?? 0);

        // ProductTable-style ACTUAL SALE (no empties revenue here)
        const discountAmt  = (price * soldPcs * dPct) / 100;
        const rowActualSale = (price * soldPcs) - discountAmt;

        const emptyShellPrice = parseFloat(item.empty_price_shell ?? 0);
        const emptyPcPrice    = parseFloat(item.empty_price_pc ?? 0);

        // Expected non-empty auto = dispatched - sold
        const autoNonEmptyShell = dispatchedShell - soldShell;
        const autoNonEmptyPcs   = dispatchedPcs   - soldPcs;

        const expectedNonEmptyShell =
          item.expected_return_shell_nonempty != null
            ? parseFloat(item.expected_return_shell_nonempty)
            : autoNonEmptyShell;

        const expectedNonEmptyPcs =
          item.expected_return_pcs_nonempty != null
            ? parseFloat(item.expected_return_pcs_nonempty)
            : autoNonEmptyPcs;

        // Returned (empty) initial
        const emptyReturnShell = parseFloat(item.empty_return_shell ?? 0);
        const emptyReturnPcs   = Math.round(emptyReturnShell * contentNo);

        // Empties discrepancy (respect non-returnable)
        const isNonReturnable = emptyShellPrice === 0 && emptyPcPrice === 0;
        const discrepancyEmptiesShell = isNonReturnable ? 0 : (soldShell - emptyReturnShell);
        const discrepancyEmptiesPc    = isNonReturnable ? 0 : (soldPcs   - emptyReturnPcs);

        // Non-empty discrepancy
        const discrepancyFullShell = (dispatchedShell - soldShell) - expectedNonEmptyShell;
        const discrepancyFullPcs   = (dispatchedPcs   - soldPcs)   - expectedNonEmptyPcs;

        return {
          ...item,
          productId: product.id,
          productName: product.product_name ?? '',
          unitTypeId,
          contentNo,

          // dispatched (read-only)
          dispatched_shell: dispatchedShell,
          dispatched_pcs: dispatchedPcs,

          // sold (editable)
          sold_shell: soldShell,
          sold_pcs: soldPcs,

          // prices
          selling_price: price,
          empty_price_shell: emptyShellPrice,
          empty_price_pc: emptyPcPrice,

          // discount (%)
          discount: dPct,

          // expected/actual
          expected_sale: Number((price * dispatchedPcs).toFixed(2)),
          actual_sale:  Number(rowActualSale.toFixed(2)),

          // expected empty return defaults to SOLD
          expected_return_shell_empty: soldShell,
          expected_return_pcs_empty:   soldPcs,

          // expected non-empty (editable)
          expected_return_shell_nonempty: expectedNonEmptyShell,
          expected_return_pcs_nonempty:   expectedNonEmptyPcs,

          // returned (empty)
          empty_return_shell: isNonReturnable ? 0 : emptyReturnShell,
          empty_return_pcs:   isNonReturnable ? 0 : emptyReturnPcs,

          // discrepancies
          discrepancy_empties_shell: discrepancyEmptiesShell,
          discrepancy_empties_pc:    discrepancyEmptiesPc,
          discrepancy_full_shell:    discrepancyFullShell,
          discrepancy_full_pcs:      discrepancyFullPcs,
        };
      });

      setRows(processed);
    }
  }, [sale, unitTypeMap, unitTypes.length]);

  // Handle row edits (sync shell/pcs and recompute, including expected non-empty logic)
  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    const row = { ...updated[index] };

    const contentNo = parseFloat(unitTypeMap[row.unitTypeId]) || parseFloat(row.contentNo || 0) || 1;
    const v = parseFloat(value) || 0;
    row[field] = v;

    // SOLD sync
    if (field === 'sold_shell') row.sold_pcs = Math.round(v * contentNo);
    else if (field === 'sold_pcs') row.sold_shell = parseFloat((v / contentNo).toFixed(2));

    // EMPTY returns sync
    if (field === 'empty_return_shell') row.empty_return_pcs = Math.round(v * contentNo);
    else if (field === 'empty_return_pcs') row.empty_return_shell = parseFloat((v / contentNo).toFixed(2));

    // EXPECTED NON-EMPTY sync (editable)
    if (field === 'expected_return_shell_nonempty') row.expected_return_pcs_nonempty = Math.round(v * contentNo);
    else if (field === 'expected_return_pcs_nonempty') row.expected_return_shell_nonempty = parseFloat((v / contentNo).toFixed(2));

    // Pricing / discount
    const price           = parseFloat(row.selling_price || 0);
    const shellEmptyPrice = parseFloat(row.empty_price_shell || 0);
    const pcEmptyPrice    = parseFloat(row.empty_price_pc || 0);
    const dPct            = parseFloat(row.discount || 0);

    const dispatchedPcs   = parseFloat(row.dispatched_pcs   || 0);
    const dispatchedShell = parseFloat(row.dispatched_shell || 0);
    const soldPcs         = parseFloat(row.sold_pcs         || 0);
    const soldShell       = parseFloat(row.sold_shell       || 0);

    // ProductTable-style expected/actual
    row.expected_sale = Number((price * dispatchedPcs).toFixed(2));
    const discountAmt = (price * soldPcs * dPct) / 100;
    row.actual_sale   = Number(((price * soldPcs) - discountAmt).toFixed(2));

    // Auto expected non-empty = dispatched - sold (unless user is editing that field)
    if (field !== 'expected_return_pcs_nonempty') {
      row.expected_return_pcs_nonempty = dispatchedPcs - soldPcs;
    }
    if (field !== 'expected_return_shell_nonempty') {
      row.expected_return_shell_nonempty = dispatchedShell - soldShell;
    }

    // Empties discrepancy (respect non-returnable)
    const returnedEmptyPcs   = parseFloat(row.empty_return_pcs || 0);
    const returnedEmptyShell = parseFloat(row.empty_return_shell || 0);
    const isNonReturnable    = shellEmptyPrice === 0 && pcEmptyPrice === 0;

    if (isNonReturnable) {
      row.empty_return_shell = 0;
      row.empty_return_pcs   = 0;
      row.discrepancy_empties_pc    = 0;
      row.discrepancy_empties_shell = 0;
    } else {
      row.discrepancy_empties_pc    = soldPcs   - returnedEmptyPcs;
      row.discrepancy_empties_shell = soldShell - returnedEmptyShell;
    }

    // Non-empty discrepancy
    const expectedPcs   = parseFloat(row.expected_return_pcs_nonempty   || 0);
    const expectedShell = parseFloat(row.expected_return_shell_nonempty || 0);
    row.discrepancy_full_pcs   = (dispatchedPcs   - soldPcs)   - expectedPcs;
    row.discrepancy_full_shell = (dispatchedShell - soldShell) - expectedShell;

    updated[index] = row;
    setRows(updated);
  };

  // -------------------- Totals (single source of truth) --------------------

  // Empties revenue on SOLD (shell+pcs)
  const emptiesPriceTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const shells = parseFloat(r.sold_shell || 0);
      const pcs    = parseFloat(r.sold_pcs   || 0);
      const sp     = parseFloat(r.empty_price_shell || 0);
      const bp     = parseFloat(r.empty_price_pc    || 0);
      return sum + shells * sp + pcs * bp;
    }, 0);
  }, [rows]);

  // Refundables = money returned for empties
  useEffect(() => {
    const totalRefunds = rows.reduce((sum, r) => {
      const shellQty = parseFloat(r.empty_return_shell || 0);
      const pcsQty   = parseFloat(r.empty_return_pcs   || 0);
      const sp       = parseFloat(r.empty_price_shell  || 0);
      const bp       = parseFloat(r.empty_price_pc     || 0);
      return sum + shellQty * sp + pcsQty * bp;
    }, 0);
    setRefundablesTotal(Number(totalRefunds.toFixed(2)));
  }, [rows]);

  // Discrepancy (Empty)
  const totalDiscrepancyEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pcsDisc   = parseFloat(r.discrepancy_empties_pc    || 0);
      const shellDisc = parseFloat(r.discrepancy_empties_shell || 0);
      const sp        = parseFloat(r.empty_price_shell || 0);
      const bp        = parseFloat(r.empty_price_pc    || 0);
      return sum + shellDisc * sp + pcsDisc * bp;
    }, 0);
  }, [rows]);

  // Discrepancy (Non-Empty)
  const totalDiscrepancyNonEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pcsDisc   = parseFloat(r.discrepancy_full_pcs   || 0);
      const shellDisc = parseFloat(r.discrepancy_full_shell || 0);
      const selling   = parseFloat(r.selling_price || 0);
      const shellP    = parseFloat(r.empty_price_shell || 0); // mirror ProductTable logic
      return sum + pcsDisc * selling + shellDisc * shellP;
    }, 0);
  }, [rows]);

  const overallDiscrepancy = useMemo(
    () => totalDiscrepancyEmpty + totalDiscrepancyNonEmpty,
    [totalDiscrepancyEmpty, totalDiscrepancyNonEmpty]
  );

  // Page totals (single declarations)
  const totalExpectedSale = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.expected_sale || 0)), 0),
    [rows]
  );
  const totalActualSale = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.actual_sale  || 0)), 0),
    [rows]
  );
  const totalExpenses = useMemo(
    () => miscItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [miscItems]
  );

  // Total Returned (With Content/s) — peso value using expected non‑empty returns
  // Total Returned (With Content) — peso value from PCS only
  const totalReturnedWithContent = useMemo(() => {
    return rows.reduce((sum, row) => {
      const price = parseFloat(row.selling_price || 0);
      const dispatchedPcs = parseFloat(row.dispatched_pcs || 0);
      const soldPcs = parseFloat(row.sold_pcs || 0);

      // if the field is null/undefined, auto = dispatched - sold
      const expectedPcs = 
        row.expected_return_pcs_nonempty != null
          ? parseFloat(row.expected_return_pcs_nonempty)
          : (dispatchedPcs - soldPcs);

      // optional: prevent negatives if ever over-edited
      const pcs = Math.max(expectedPcs, 0);

      return sum + pcs * price;
    }, 0);
  }, [rows]);


  // ✅ Van Load overall total identical to ProductTable:
  // Van Load total = totalActualSale - misc + overallDiscrepancy
  useEffect(() => {
    const isVanLoad = (sale?.transaction_type_name || '').toLowerCase() === 'van load';
    const next = isVanLoad
      ? (totalActualSale - totalExpenses + overallDiscrepancy)
      : (emptiesPriceTotal - refundablesTotal + totalActualSale); // Warehouse style if ever reused
    setOverallTotal(Number(next.toFixed(2)));
  }, [
    sale?.transaction_type_name,
    totalActualSale,
    totalExpenses,
    overallDiscrepancy,
    emptiesPriceTotal,
    refundablesTotal
  ]);

  // (Optional) Submit to backend to finalize van-load returns
  const handleSubmit = () => {
    if (!sale || sale.transaction_type_name !== 'Van Load') {
      alert('This update is only applicable to Van Load transactions.');
      return;
    }
    const payload = {
      sale_id: saleId,
      total_expected_sale: totalExpectedSale,
      actual_sale: totalActualSale, // page total
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
        // using expected non-empty as "returned with contents" figure
        expected_return_shell_nonempty: row.expected_return_shell_nonempty,
        expected_return_pcs_nonempty: row.expected_return_pcs_nonempty,
        discrepancy_full_shell: row.discrepancy_full_shell,
        discrepancy_full_pcs: row.discrepancy_full_pcs,
        // keep actual_* if your API expects it
        actual_return_shell: row.actual_return_shell,
        actual_return_pcs: row.actual_return_pcs,
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
          expected_return_shell_nonempty: row.expected_return_shell_nonempty,
          expected_return_pcs_nonempty: row.expected_return_pcs_nonempty,
          discrepancy_full_shell: row.discrepancy_full_shell,
          discrepancy_full_pcs: row.discrepancy_full_pcs,
          // keep actual_* if stored
          actual_return_shell: row.actual_return_shell,
          actual_return_pcs: row.actual_return_pcs,
        })),
      };

      await axios.post('http://localhost:8080/api/van-load-return/', payload);
      await axios.patch(`http://localhost:8080/api/merchandising-set/${saleId}/`, {
        status: 'Complete',
      });
    } catch (err) {
      console.error('Failed to save Van Load payment:', err);
      alert('Saving payment failed. Please try again.');
      throw err;
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
                  value={row.sold_shell === 0 ? '' : row.sold_shell ?? ''}
                  onChange={(e) => handleRowChange(index, 'sold_shell', e.target.value)}
                />
              </td>
              <td className="border border-gray-200 py-1 px-1 w-[70px]">
                <input
                  type="number"
                  className="w-full p-1 text-sm text-center rounded bg-yellow-50"
                  value={row.sold_pcs === 0 ? '' : row.sold_pcs ?? ''}
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
                'expected_return_shell_nonempty',   // edited by user
                'expected_return_pcs_nonempty',     // edited by user
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
                      ${field.includes('expected_return') ? 'bg-yellow-50' : 'bg-gray-100'}
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

            {/* RETURNED (With Content/s) — peso total */}
            <td
              className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold"
              colSpan={2}
            >
              ₱{parseFloat(totalReturnedWithContent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            {/* DISCREPANCY (Non-Empty) */}
            <td colSpan={2} className="py-2 px-1 bg-blue-100 text-gray-800 text-center font-semibold">
              ₱{parseFloat(totalDiscrepancyNonEmpty || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </td>

            {/* DISCOUNT spacer */}
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

      {/* Overall total */}
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
          totalReturnedWithContent={Number(totalReturnedWithContent) || 0} //kath
          totalDiscrepancyNonEmpty={Number(totalDiscrepancyNonEmpty) || 0} //Kath
          expectedSale={Number(totalExpectedSale) || 0} //Kath
          totalAmount={Number(overallTotal) || 0}
          mspNo={sale.msp_no}
          transactionDate={sale.date_time}
          customerName={sale.customer?.name || 'Walk-in'}
          handledBy={sale.handled_by}
          transactionTypeName={sale.transaction_type_name}
          expensesTotal={calculateTotalExpenses()}
          remarks={remarks}
          onRemarksChange={setRemarks}
          onPaymentSuccess={handleVanLoadPaymentSuccess}
        />
      )}
    </div>
  );
};

export default VanLoadUpdate;
