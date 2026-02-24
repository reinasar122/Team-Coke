// src/pages/VanLoadUpdate.jsx - ENHANCED WITH VAN LOAD UPDATE NOTIFICATIONS - FIXED WAREHOUSE CONTEXT
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import ExpensesSection from '../components/merchandisingcomponents/ExpensesSection';
import PaymentModal from '../components/PaymentModal';
import { useNotifications } from '../contexts/NotificationContext';
import api from "../api";


/* --------------------------- tiny UI helpers --------------------------- */

const z = (v) =>
  v === undefined || v === null || v === '' || Number.isNaN(v) ? 0 : v;

const nullIfBlank = (v) => (v === '' || v === null || v === undefined ? null : v);

const peso = (n) =>
  `₱${(parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const ZeroInput = ({
  value,
  onValue,
  disabled = false,
  className = '',
  placeholder = '0',
}) => {
  const display =
    value === 0 || value === '0' || value === null || value === undefined
      ? ''
      : value;

  return (
    <input
      type="number"
      value={display}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      onFocus={(e) => {
        if (e.target.value === '0') e.target.value = '';
      }}
      onChange={(e) => onValue?.(e.target.value)}
      onBlur={(e) => {
        if (e.target.value === '') {
          e.target.value = 0;
          onValue?.(0);
        } else {
          onValue?.(e.target.value);
        }
      }}
    />
  );
};

/* ✅ Custom alert function since alert() is not supported */
const showAlert = (message) => {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  alertDiv.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
      <p class="text-gray-700 mb-4">${message}</p>
      <div class="flex justify-end">
        <button class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(alertDiv);
};

/* ✅ FIXED: Helper function to get correct warehouse context */
const getCurrentWarehouseId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    return user.role?.toLowerCase() === "admin" && selectedWarehouse 
      ? selectedWarehouse.id 
      : user.warehouse_id;
  } catch {
    return null;
  }
};

/* ---------- disable/edit rules (unchanged behaviour) ---------- */
const isSoldEqualDispatched = (row) =>
  Number(row.sold_shell || 0) === Number(row.dispatched_shell || 0) &&
  Number(row.sold_pcs || 0) === Number(row.dispatched_pcs || 0);

const hasEmptyPrice = (row) =>
  Number(row.empty_price_shell || 0) > 0 || Number(row.empty_price_pc || 0) > 0;

const isReturnedWithContentsField = (field) =>
  field === 'expected_return_shell_nonempty' ||
  field === 'expected_return_pcs_nonempty' ||
  field === 'actual_return_shell' ||
  field === 'actual_return_pcs';

const isReturnedEmptyField = (field) =>
  field === 'empty_return_shell' || field === 'empty_return_pcs';

const shouldDisableEditableField = (row, field) => {
  const soldEq = isSoldEqualDispatched(row);
  const hasEmpty = hasEmptyPrice(row);

  if (!hasEmpty) {
    if (soldEq) return true; // disable everything
    return isReturnedEmptyField(field); // disable returned-empty only
  }
  if (soldEq && isReturnedWithContentsField(field)) return true;
  return false;
};

//update remittance

const VanLoadUpdate = () => {

  // ✅ STRICT VALIDATION: Every product must have activity
const validateSoldBeforeRemit = () => {
  if (!Array.isArray(rows) || rows.length === 0) {
    showAlert("No products found.");
    return false;
  }

    // Find rows that have NO movement
  const invalidRows = rows.filter((r) => {
    const soldShell = Number(r?.sold_shell || 0);
    const soldPcs = Number(r?.sold_pcs || 0);

    const returnedShell = Number(r?.actual_return_shell || 0);
    const returnedPcs = Number(r?.actual_return_pcs || 0);

     // ❌ No sold AND no returned-with-content
    return (
      soldShell <= 0 &&
      soldPcs <= 0 &&
      returnedShell <= 0 &&
      returnedPcs <= 0
    );
  });

    if (invalidRows.length > 0) {
    showAlert(
      "Each product must have a Sold value or Returned (With Content/s). " 
      //"Please complete all rows before remittance."
    );
    return false;
  }

  return true;
};


//update of blocking remittance end
  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const saleId = location.state?.id;

  const [showPaymentModal, setShowPaymentModal] = useState(false);
//updated remittance blocking
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

  // Unit types
  useEffect(() => {
    const fetchUnitTypes = async () => {
      try {
        const res = await api.get('/unit-types/');
        setUnitTypes(res.data || []);
      } catch (err) {
        console.error('Failed to fetch unit types:', err);
      }
    };
    fetchUnitTypes();
  }, []);

  const unitTypeMap = useMemo(() => {
    const map = {};
    unitTypes.forEach((u) => (map[u.id] = u.content_no));
    return map;
  }, [unitTypes]);

  // Fetch sale
  useEffect(() => {
    if (!saleId) return;
    api
      .get(`/merchandising-set/${saleId}/`)
      .then((res) => setSale(res.data))
      .catch((err) => {
        console.error(err);
        showAlert('Failed to fetch sale data.');
      });
  }, [saleId]);

  // Build rows (DISPLAY discount only; no editing here)
  useEffect(() => {
    if (!sale || !unitTypes.length) return;
    if (sale.items && Array.isArray(sale.items)) {
      const processed = sale.items.map((item) => {
        const product = item.product_detail ?? item.product ?? {};
        const unitTypeId =
          product.unit_type?.id ?? product.unit_type_id ?? product.unit_type ?? null;
        const contentNo = unitTypeMap[unitTypeId] ?? 1;

        // dispatched
        const rawDispShell = nullIfBlank(item.dispatched_shell ?? item.dispatchedShell);
        const rawDispPcs = nullIfBlank(item.dispatched_pcs ?? item.dispatchedPcs);
        const dispatched_shell =
          rawDispShell !== null
            ? parseFloat(rawDispShell)
            : parseFloat(rawDispPcs || 0) / (contentNo || 1);
        const dispatched_pcs =
          rawDispPcs !== null
            ? Math.round(parseFloat(rawDispPcs))
            : Math.round((dispatched_shell || 0) * (contentNo || 1));

        // sold
        const rawSoldShell = item.sold_shell ?? item.soldShell ?? null;
        const rawSoldPcs = item.sold_pcs ?? item.soldPcs ?? null;
        const sold_shell =
          rawSoldShell != null
            ? parseFloat(rawSoldShell)
            : parseFloat(rawSoldPcs || 0) / (contentNo || 1);
        const sold_pcs =
          rawSoldPcs != null
            ? Math.round(parseFloat(rawSoldPcs))
            : Math.round((sold_shell || 0) * (contentNo || 1));

        // prices / discount (read from backend)
        const selling_price = parseFloat(item.selling_price ?? item.sellingPrice ?? 0);
        const empty_price_shell = parseFloat(item.empty_price_shell ?? item.emptyPriceShell ?? 0);
        const empty_price_pc = parseFloat(item.empty_price_pc ?? item.emptyPricePc ?? 0);
        const discount = parseFloat(item.discount_percent ?? item.discount ?? 0); // DISPLAY ONLY

        // expected (NET of discount, match VanLoadTable)
        const expected_sale = Number(
          (selling_price * dispatched_pcs * (1 - (discount || 0) / 100)).toFixed(2)
        );

        // actual (apply row discount to sold)
        const discountAmt = (selling_price * sold_pcs * (discount || 0)) / 100;
        const actual_sale = Number(((selling_price * sold_pcs) - discountAmt).toFixed(2));

        // empty returns defaults
        const expected_return_shell_empty = sold_shell;
        const expected_return_pcs_empty = sold_pcs;

        // non-empty expected = dispatched - sold (default)
        const autoNonEmptyShell = dispatched_shell - sold_shell;
        const autoNonEmptyPcs = dispatched_pcs - sold_pcs;
        const expected_return_shell_nonempty =
          item.expected_return_shell_nonempty != null
            ? parseFloat(item.expected_return_shell_nonempty)
            : autoNonEmptyShell;
        const expected_return_pcs_nonempty =
          item.expected_return_pcs_nonempty != null
            ? parseFloat(item.expected_return_pcs_nonempty)
            : autoNonEmptyPcs;

        // actual returns default to expected if not set
        const actual_return_shell =
          item.actual_return_shell != null
            ? parseFloat(item.actual_return_shell)
            : expected_return_shell_nonempty;
        const actual_return_pcs =
          item.actual_return_pcs != null
            ? parseFloat(item.actual_return_pcs)
            : expected_return_pcs_nonempty;

        // empties + discrepancies
        const empty_return_shell = parseFloat(item.empty_return_shell ?? 0);
        const empty_return_pcs =
          item.empty_return_pcs != null
            ? Math.round(parseFloat(item.empty_return_pcs))
            : Math.round(empty_return_shell * (contentNo || 1));
        const isNonReturnable = empty_price_shell === 0 && empty_price_pc === 0;

        const discrepancy_empties_shell = isNonReturnable ? 0 : (sold_shell - empty_return_shell);
        const discrepancy_empties_pc = isNonReturnable ? 0 : (sold_pcs - empty_return_pcs);

        const discrepancy_full_shell = expected_return_shell_nonempty - actual_return_shell;
        const discrepancy_full_pcs = expected_return_pcs_nonempty - actual_return_pcs;

        return {
          ...item,
          productId: product.id,
          productName: product.product_name ?? '',
          unitTypeId,
          contentNo,

          // dispatched
          dispatched_shell,
          dispatched_pcs,

          // sold
          sold_shell,
          sold_pcs,

          // prices/discount (discount is display-only here)
          selling_price,
          empty_price_shell,
          empty_price_pc,
          discount,

          // pesos
          expected_sale,
          actual_sale,

          // returns
          expected_return_shell_empty,
          expected_return_pcs_empty,

          expected_return_shell_nonempty,
          expected_return_pcs_nonempty,

          actual_return_shell,
          actual_return_pcs,

          empty_return_shell: isNonReturnable ? 0 : empty_return_shell,
          empty_return_pcs: isNonReturnable ? 0 : empty_return_pcs,

          // discrepancies
          discrepancy_empties_shell,
          discrepancy_empties_pc,
          discrepancy_full_shell,
          discrepancy_full_pcs,
        };
      });

      setRows(processed);
    }
  }, [sale, unitTypeMap, unitTypes.length]);

  // Row change (no discount editing here)
  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    const row = { ...updated[index] };

    // ---------- Helpers ----------
    const n = (v) => {
      const num = parseFloat(v);
      return Number.isFinite(num) ? num : 0;
    };
    const pcsInt = (v) => Math.max(0, Math.round(n(v)));
    const shellInt = (v) => Math.max(0, Math.floor(n(v)));

    // Resolve conversion/content_no
    const contentNo = n(unitTypeMap?.[row.unitTypeId]) || n(row.contentNo) || 1;

    // Write raw field (as numeric) first
    row[field] = n(value);

    // ---------- Pricing / returnable detection ----------
    const price = n(row.selling_price);
    const dPct = n(row.discount);
    const shellEmptyPrice = n(row.empty_price_shell);
    const pcEmptyPrice = n(row.empty_price_pc);
    const isNonReturnable = shellEmptyPrice === 0 && pcEmptyPrice === 0;

    // ---------- Dispatched / Sold ----------
    const dispatchedPcs = pcsInt(row.dispatched_pcs);
    const dispatchedShell = shellInt(row.dispatched_shell);

    // --- SOLD SYNC (guided by dispatched) ---
    if (field === "sold_shell") {
      row.sold_shell = shellInt(value);

    // Clamp sold_shell so it can’t exceed dispatched_shell
    if (row.sold_shell > row.dispatched_shell) {
        row.sold_shell = row.dispatched_shell;
    }


      // ✅ Calculate pcs based on contentNo
      row.sold_pcs = pcsInt(row.sold_shell * contentNo);

      // Clamp so it can’t exceed dispatched pcs
      if (row.sold_pcs > row.dispatched_pcs) {
        row.sold_pcs = row.dispatched_pcs;
      }
    }

    else if (field === "sold_pcs") {
      row.sold_pcs = pcsInt(value);

      // clamp PCS so it doesn’t exceed dispatched
      if (row.sold_pcs > row.dispatched_pcs) {
        row.sold_pcs = row.dispatched_pcs;
      }

      // ❌ Don’t auto-sync shell — allow pcs to be independent
      // row.sold_shell = shellInt(row.sold_pcs / contentNo);

    } else {
      row.sold_pcs   = pcsInt(row.sold_pcs);
      row.sold_shell = shellInt(row.sold_shell);
    }


    const soldPcs = row.sold_pcs;
    const soldShell = row.sold_shell;


    // ---------- RETURNED EMPTY (guided by SOLD) ----------
    if (field === "empty_return_shell") {
      row.empty_return_shell = shellInt(value);

      // ✅ Calculate pcs based on contentNo
      row.empty_return_pcs = pcsInt(row.empty_return_shell * contentNo);

      // Clamp so it can't exceed sold_shell
      if (row.empty_return_shell > row.sold_shell) {
        row.empty_return_shell = row.sold_shell;
      }



      // Clamp so it can’t exceed sold pcs
      if (row.empty_return_pcs > row.sold_pcs) {
        row.empty_return_pcs = row.sold_pcs;
      }
    }
 
    else if (field === "empty_return_pcs") {
      row.empty_return_pcs = pcsInt(value);

      // clamp PCS so it doesn’t exceed sold_pcs
      if (row.empty_return_pcs > row.sold_pcs) {
        row.empty_return_pcs = row.sold_pcs;
      }

      // ❌ Don’t auto-sync shell here — allow pcs to be independent
      // row.empty_return_shell = shellInt(row.empty_return_pcs / contentNo);

    } else {
      row.empty_return_pcs   = pcsInt(row.empty_return_pcs);
      row.empty_return_shell = shellInt(row.empty_return_shell);
    }



    const returnedEmptyPcs = row.empty_return_pcs;
    const returnedEmptyShell = row.empty_return_shell;

    if (isNonReturnable) {
      row.empty_return_shell = 0;
      row.empty_return_pcs = 0;
      row.discrepancy_empties_pc = 0;
      row.discrepancy_empties_shell = 0;
    } else {
      row.discrepancy_empties_pc = soldPcs - returnedEmptyPcs;
      row.discrepancy_empties_shell = soldShell - returnedEmptyShell;
    }

    // ---------- RETURNED WITH CONTENT (NON-EMPTY) ----------
    if (field === "expected_return_shell_nonempty") {
      row.expected_return_shell_nonempty = shellInt(value);
      row.expected_return_pcs_nonempty = pcsInt(row.expected_return_shell_nonempty * contentNo);
    } else if (field === "expected_return_pcs_nonempty") {
      row.expected_return_pcs_nonempty = pcsInt(value);
      row.expected_return_shell_nonempty = shellInt(row.expected_return_shell_nonempty);
    } else {
      if (field !== "expected_return_pcs_nonempty" && field !== "expected_return_shell_nonempty") {
        row.expected_return_pcs_nonempty = Math.max(0, dispatchedPcs - soldPcs);
        row.expected_return_shell_nonempty = Math.max(0, dispatchedShell - soldShell);
      } else {
        row.expected_return_pcs_nonempty = pcsInt(row.expected_return_pcs_nonempty);
        row.expected_return_shell_nonempty = shellInt(row.expected_return_shell_nonempty);
      }
    }

    // ---------- ACTUAL RETURN ----------
    if (field === "actual_return_shell") {
      row.actual_return_shell = shellInt(value);
      row.actual_return_pcs = pcsInt(row.actual_return_shell * contentNo);
    } else if (field === "actual_return_pcs") {
      row.actual_return_pcs = pcsInt(value);
      row.actual_return_shell = shellInt(row.actual_return_shell);
    } else {
      row.actual_return_pcs = pcsInt(row.actual_return_pcs);
      row.actual_return_shell = shellInt(row.actual_return_shell);
    }

    const expectedPcs = pcsInt(row.expected_return_pcs_nonempty);
    const expectedShell = shellInt(row.expected_return_shell_nonempty);
    const actualPcs = pcsInt(row.actual_return_pcs);
    const actualShell = shellInt(row.actual_return_shell);

    // Non-empty discrepancy = expected − actual
    row.discrepancy_full_pcs = expectedPcs - actualPcs;
    row.discrepancy_full_shell = expectedShell - actualShell;

    // ---------- Sales totals (Warehouse style) ----------
    row.expected_sale = Number((price * dispatchedPcs * (1 - dPct / 100)).toFixed(2));
    const discountAmt = (price * soldPcs * dPct) / 100;
    row.actual_sale = Number(((price * soldPcs) - discountAmt).toFixed(2));

    // ---------- Finalize ----------
    updated[index] = row;
    setRows(updated);
  };


  /* -------------------- Totals -------------------- */
  const emptiesPriceTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const shells = parseFloat(r.sold_shell || 0);
      const pcs = parseFloat(r.sold_pcs || 0);
      const sp = parseFloat(r.empty_price_shell || 0);
      const bp = parseFloat(r.empty_price_pc || 0);
      return sum + shells * sp + pcs * bp;
    }, 0);
  }, [rows]);

  useEffect(() => {
    const totalRefunds = rows.reduce((sum, r) => {
      const shellQty = parseFloat(r.empty_return_shell || 0);
      const pcsQty = parseFloat(r.empty_return_pcs || 0);
      const sp = parseFloat(r.empty_price_shell || 0);
      const bp = parseFloat(r.empty_price_pc || 0);
      return sum + shellQty * sp + pcsQty * bp;
    }, 0);
    setRefundablesTotal(Number(totalRefunds.toFixed(2)));
  }, [rows]);

  const totalDiscrepancyEmpty = useMemo(() => {
    return rows.reduce((sum, r) => {
      const pcsDisc = parseFloat(r.discrepancy_empties_pc || 0);
      const shellDisc = parseFloat(r.discrepancy_empties_shell || 0);
      const sp = parseFloat(r.empty_price_shell || 0);
      const bp = parseFloat(r.empty_price_pc || 0);
      return sum + shellDisc * sp + pcsDisc * bp;
    }, 0);
  }, [rows]);

  const totalDiscrepancyNonEmpty = useMemo(() => {
    return (rows || []).reduce((sum, r) => {
      // Retrieve the unit price and apply discount
      const unitPrice = Number(r?.unitPrice ?? r?.selling_price ?? r?.price ?? 0);
      const discount = parseFloat(r.discount ?? 0) / 100; // Get the discount as a decimal (e.g., 20% becomes 0.2)

      // Apply discount to unit price
      const discountedUnitPrice = unitPrice * (1 - discount);

      const contentNo =
        Number(r?.contentNo ?? (r?.unitTypeId != null ? unitTypeMap?.[r.unitTypeId] : undefined)) || 1;

      const hasPcs =
        r?.discrepancy_full_pcs !== undefined &&
        r.discrepancy_full_pcs !== null &&
        r.discrepancy_full_pcs !== '';
      const discPcs = hasPcs
        ? Number(r.discrepancy_full_pcs) || 0
        : (Number(r?.discrepancy_full_shell) || 0) * contentNo;

      // Calculate the discrepancy value using discounted price
      return sum + discPcs * discountedUnitPrice;
    }, 0);
  }, [rows, unitTypeMap]);
  

  const overallDiscrepancy = useMemo(
    () => totalDiscrepancyEmpty + totalDiscrepancyNonEmpty,
    [totalDiscrepancyEmpty, totalDiscrepancyNonEmpty]
  );

  const totalExpectedSale = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.expected_sale || 0)), 0),
    [rows]
  );
  const totalActualSale = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.actual_sale || 0)), 0),
    [rows]
  );
  const totalExpenses = useMemo(
    () => miscItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [miscItems]
  );

  const totalReturnedWithContent = useMemo(() => {
    return (rows || []).reduce((sum, row) => {
      // Retrieve the selling price, and apply discount
      const price = parseFloat(row.unitPrice ?? row.selling_price ?? row.price ?? 0);
      const discount = parseFloat(row.discount ?? 0) / 100;  // Get the discount as a decimal (e.g., 20% becomes 0.2)
      
      const contentNo =
        parseFloat(row.contentNo ?? '') ||
        parseFloat(row.unitTypeId != null ? unitTypeMap?.[row.unitTypeId] ?? '' : '') ||
        1;

      const hasPcs =
        row.actual_return_pcs !== undefined &&
        row.actual_return_pcs !== null &&
        row.actual_return_pcs !== '';
      const actualPcs = hasPcs
        ? parseFloat(row.actual_return_pcs) || 0
        : (parseFloat(row.actual_return_shell) || 0) * contentNo;

      // Apply discount to returned product value
      const discountedPrice = price * (1 - discount); // Apply discount to the product price

      // Calculate the total returned value (actual pcs * discounted price)
      return sum + actualPcs * discountedPrice;
    }, 0);
  }, [rows, unitTypeMap]);

  useEffect(() => {
    const isVanLoad = (sale?.transaction_type_name || '').toLowerCase() === 'van load';
    const next = isVanLoad
      ? (totalActualSale - totalExpenses + overallDiscrepancy)
      : (emptiesPriceTotal - refundablesTotal + totalActualSale);
    setOverallTotal(Number(next.toFixed(2)));
  }, [
    sale?.transaction_type_name,
    totalActualSale,
    totalExpenses,
    overallDiscrepancy,
    emptiesPriceTotal,
    refundablesTotal,
  ]);

  // ✅ ENHANCED: Van Load return submission with notification trigger
  const handleSubmit = () => {
    if ((sale?.transaction_type_name || '').toLowerCase() !== 'van load') {
      showAlert('This update is only applicable to Van Load transactions.');
      return;
    }

    const nz = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const iz = (v) => (Number.isFinite(Number(v)) ? parseInt(v, 10) : 0);

    const payload = {
      sale_id: saleId,
      total_expected_sale: nz(totalExpectedSale),
      actual_sale: nz(totalActualSale),
      products: rows.map((row) => ({
        productId: row.productId,
        sold_shell: iz(row.sold_shell),
        sold_pcs: iz(row.sold_pcs),
        discount: nz(row.discount),
        actual_sale: nz(row.actual_sale),
        empty_return_shell: iz(row.empty_return_shell),
        empty_return_pcs: iz(row.empty_return_pcs),
        discrepancy_empties_shell: iz(row.discrepancy_empties_shell),
        discrepancy_empties_pc: iz(row.discrepancy_empties_pc),
        expected_return_shell_nonempty: nz(row.expected_return_shell_nonempty),
        expected_return_pcs_nonempty: nz(row.expected_return_pcs_nonempty),
        actual_return_shell: iz(row.actual_return_shell),
        actual_return_pcs: iz(row.actual_return_pcs),
        discrepancy_full_shell: iz(row.discrepancy_full_shell),
        discrepancy_full_pcs: iz(row.discrepancy_full_pcs),
        empties_price_total: emptiesPriceTotal,
        empty_returns: refundablesTotal,
      })),
      remarks,
      discrepancy_empty_total: Number(totalDiscrepancyEmpty.toFixed(2)),
      discrepancy_non_empty_total: Number(totalDiscrepancyNonEmpty.toFixed(2)),
    };

    console.log('🚛 Submitting Van Load return...', payload);

    api
      .post('/van-load-return/', payload)
      .then((response) => {
        console.log('🚛 Van Load return submitted successfully:', response.data);
        showAlert('Van Load return successfully submitted.');
        
        // ✅ FIXED: Use same warehouse context as notification filtering
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const warehouseId = getCurrentWarehouseId();
        
        console.log('🚛 Creating notification with warehouse ID:', warehouseId, 'for user role:', user.role);
        
        addNotification('warehouse_msp_updated', {
          id: saleId,
          msp_no: sale.msp_no,
          transaction_type_name: 'Van Load',
          handled_by: sale.handled_by,
          expected_sale: nz(totalExpectedSale),
          actual_sale: nz(totalActualSale),
          status: 'Return Received',
          warehouse_id: warehouseId,
          updated_at: new Date().toISOString(),
          is_van_load: true,
          changes_summary: `Van Load return received - Actual Sale: ₱${nz(totalActualSale).toLocaleString()}, Expected: ₱${nz(totalExpectedSale).toLocaleString()}`,
          action_type: 'return_received'
        }, user.role);
        
        // ✅ Also trigger custom event for any other listeners
        const eventDetail = {
          saleId: saleId,
          mspNo: sale.msp_no,
          handledBy: sale.handled_by,
          action: 'return_received',
          changes: {
            status: 'Return Received',
            expected_sale: nz(totalExpectedSale),
            actual_sale: nz(totalActualSale),
            total_expenses: calculateTotalExpenses(),
            products_updated: rows.length,
            discrepancy_empty_total: Number(totalDiscrepancyEmpty.toFixed(2)),
            discrepancy_non_empty_total: Number(totalDiscrepancyNonEmpty.toFixed(2))
          },
          summary: `Van Load return received - Actual Sale: ₱${nz(totalActualSale).toLocaleString()}, Expected: ₱${nz(totalExpectedSale).toLocaleString()}`
        };
        
        console.log('🚛 Dispatching vanLoadUpdated event:', eventDetail);
        window.dispatchEvent(new CustomEvent('vanLoadUpdated', { detail: eventDetail }));
        
        // Small delay before navigation to ensure notification is visible
        setTimeout(() => {
          navigate('/merchandising-sale');
        }, 1000);
      })
      .catch((error) => {
        console.error('Submission failed:', error);
        showAlert('Failed to submit van load return.');
      });
  };

  // ✅ ENHANCED: Van Load payment success with notification trigger - FIXED
  const handleVanLoadPaymentSuccess = async (paymentData) => {
    try {
      const misc = (miscItems || [])
        .filter((i) => i && String(i.description || '').trim() !== '')
        .map((i) => ({
          description: String(i.description).trim(),
          amount: Number(i.amount) || 0,
        }));
      const miscTotal = misc.reduce((s, i) => s + i.amount, 0);

      const totalActualSaleLocal = rows.reduce(
        (s, r) => s + (parseFloat(r.actual_sale || 0)),
        0
      );

      const payload = {
        sale_id: saleId,
        total_expected_sale: totalExpectedSale,
        actual_sale: totalActualSaleLocal,
        expenses_total: miscTotal,
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
          actual_return_shell: row.actual_return_shell,
          actual_return_pcs: row.actual_return_pcs,
          
        })),
        misc_items: misc,
        discrepancy_empty_total: Number(totalDiscrepancyEmpty.toFixed(2)),
        discrepancy_non_empty_total: Number(totalDiscrepancyNonEmpty.toFixed(2)),

        returned_with_content: Number(totalReturnedWithContent.toFixed(2)),
         // Include empties price total and empty returns
        empties_price_total: emptiesPriceTotal,
        empty_returns: refundablesTotal,

      };

      console.log('🚛 Processing Van Load payment...', payload);

      await api.post('/van-load-return/', payload);

      // persist misc rows
      if (misc.length > 0) {
        await Promise.all(
          misc.map((item) =>
            api.post('/miscellaneous-items/', {
              merchandising: saleId,
              description: item.description,
              amount: item.amount,
            })
          )
        );
      }

      // patch merchandising header
      const patchResponse = await api.patch(
        `/merchandising-set/${saleId}/`,
        {
          status: 'Complete',
          miscellaneous: miscTotal,
          actual_sale: Number(totalActualSaleLocal.toFixed(2)),
        }
      );

      console.log('🚛 Van Load completed with payment:', patchResponse.data);

      // ✅ FIXED: Use same warehouse context as notification filtering
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const warehouseId = getCurrentWarehouseId();
      
      console.log('🚛 Creating payment completion notification with warehouse ID:', warehouseId, 'for user role:', user.role);
      
      addNotification('warehouse_msp_updated', {
        id: saleId,
        msp_no: sale.msp_no,
        transaction_type_name: 'Van Load',
        handled_by: sale.handled_by,
        expected_sale: Number(totalExpectedSale),
        actual_sale: Number(totalActualSaleLocal.toFixed(2)),
        status: 'Complete',
        warehouse_id: warehouseId,
        updated_at: new Date().toISOString(),
        is_van_load: true,
        changes_summary: `Van Load completed with ${paymentData.paymentMethod} payment - Final Total: ₱${overallTotal.toLocaleString()}`,
        action_type: 'completed_with_payment'
      }, user.role);

      // ✅ Also trigger custom event for any other listeners
      const eventDetail = {
        saleId: saleId,
        mspNo: sale.msp_no,
        handledBy: sale.handled_by,
        action: 'completed_with_payment',
        changes: {
          status: 'Complete',
          expected_sale: Number(totalExpectedSale),
          actual_sale: Number(totalActualSaleLocal.toFixed(2)),
          total_expenses: miscTotal,
          payment_method: paymentData.paymentMethod,
          payment_amount: paymentData.amount,
          products_updated: rows.length,
          overall_total: overallTotal
        },
        summary: `Van Load completed with ${paymentData.paymentMethod} payment - Final Total: ₱${overallTotal.toLocaleString()}`
      };

      console.log('🚛 Dispatching vanLoadCompleted event:', eventDetail);
      window.dispatchEvent(new CustomEvent('vanLoadUpdated', { detail: eventDetail }));

      // ✅ Show success message but don't navigate immediately - let PaymentModal show invoice first
      showAlert('Van Load completed successfully with payment!');
      
    } catch (err) {
      console.error('Failed to save Van Load payment:', err);
      showAlert('Saving payment failed. Please try again.');
      throw err;
    }
  };

  if (!sale) {
    return <div className="p-6 text-center text-gray-500">Loading sale data...</div>;
  }

  return (
    <div className="w-100 mx-auto p-6 mt-5">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">Van Load Return</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <label className="font-semibold">MSP No:</label>
          <div className="p-2 border rounded text-gray">{sale.msp_no}</div>
        </div>
        <div>
          <label className="font-semibold">Transaction Type:</label>
          <div className="p-2 border rounded text-gray">{sale.transaction_type_name}</div>
        </div>
        <div>
          <label className="font-semibold">Handled By:</label>
          <div className="p-2 border rounded text-gray">{sale.handled_by}</div>
        </div>
        <div>
          <label className="font-semibold">Date Created:</label>
          <div className="p-2 border rounded text-gray">
            {sale.date_time ? new Date(sale.date_time).toLocaleString() : '--'}
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2">Product Details</h3>

      <div className="table-wrapper">
        <table className="table">
          <thead className="bg-gray-100 text-sm text-gray-800">
            <tr className="text-xs font-semibold">
              <th className="border border-gray-300 py-2 px-1 text-sm">Product</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Dispatched</th>
              <th className="border border-gray-300 py-2 px-1 text-sm">Selling Price</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Sold</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Empty Price</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Returned (Empty)</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Discrepancy (Empty)</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Returned (With Content/s)</th>
              <th className="border border-gray-300 py-2 px-1 text-sm" colSpan={2}>Discrepancy (Non-empty)</th>
              <th className="border border-gray-300 py-2 px-1 text-sm">Discount (%)</th>
              <th className="border border-gray-300 py-2 px-1 text-sm">Expected Sale</th>
              <th className="border border-gray-300 py-2 px-1 text-sm">Actual Sale</th>
            </tr>
            <tr className="bg-slate-100">
              <td className="border border-gray-300 py-1"></td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Item Qty</td>
              <td className="border border-gray-300 py-1"></td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Item Qty</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Per Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Per Bottle</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Bottle</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Bottle</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Item Qty</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Shell</td>
              <td className="border border-gray-300 py-1 text-[11px] font-medium">Item Qty</td>
              <td className="border border-gray-300 py-1"></td>
              <td className="border border-gray-300 py-1"></td>
              <td className="border border-gray-300 py-1"></td>
            </tr>
          </thead>

          <tbody>
            {Array.isArray(rows) &&
              rows.map((row, index) => (
                <tr key={row.id ?? index} className="bg-white hover:bg-gray-50 transition duration-150">
                  <td className="border border-gray-200 py-1 px-1 ">
                    <div className="p-2 border rounded text-sm text-center">
                      {row.productName || row.product_detail?.product_name || `#${row.productId}`}
                    </div>
                  </td>

                  {/* DISPATCHED */}
                  <td className="border border-gray-200 py-1 px-1 ">
                    <div className="p-2 border rounded">{z(row.dispatched_shell)}</div>
                  </td>
                  <td className="border border-gray-200 py-1 px-1 ">
                    <div className="p-2 border rounded">{z(row.dispatched_pcs)}</div>
                  </td>

                  {/* PRICE */}
                  <td className="border border-gray-200 py-1 px-1">
                    <div className="p-2 border rounded text-sm text-center">
                      {Number(z(row.selling_price)).toFixed(2)}
                    </div>
                  </td>

                  {/* SOLD */}
                  <td className="border border-gray-200 py-1 px-1 ">
                    <ZeroInput
                      type="number"
                      value={row.sold_shell}
                      onValue={(v) => handleRowChange(index, 'sold_shell', v)}
                      className="input-always-spinner w-full p-1 text-sm text-center rounded bg-yellow-50"
                    />
                  </td>
                  <td className="border border-gray-200 py-1 px-1 ">
                    <ZeroInput
                      type="number"
                      value={row.sold_pcs}
                      onValue={(v) => handleRowChange(index, 'sold_pcs', v)}
                      className="input-always-spinner w-full p-1 text-sm text-center rounded bg-yellow-50"
                    />
                  </td>

                  {/* EMPTY PRICE (disabled) */}
                  <td className="border border-gray-200 py-1 px-1">
                    <input type="number" className="w-full p-1 text-sm text-center bg-gray-100" value={z(row.empty_price_shell)} disabled />
                  </td>
                  <td className="border border-gray-200 py-1 px-1">
                    <input type="number" className="w-full p-1 text-sm text-center bg-gray-100" value={z(row.empty_price_pc)} disabled />
                  </td>

                  {/* RETURNS / DISCREPANCIES */}
                  {[
                    ['empty_return_shell', true],
                    ['empty_return_pcs', true],
                    ['discrepancy_empties_shell', false],
                    ['discrepancy_empties_pc', false],
                    ['actual_return_shell', true],
                    ['actual_return_pcs', true],
                    ['discrepancy_full_shell', false],
                    ['discrepancy_full_pcs', false],
                  ].map(([field, editable], i) => {
                    const disableInput = editable ? shouldDisableEditableField(row, field) : true;
                    const value = z(row[field]);
                    return (
                      <td key={i} className="border border-gray-200 py-1 px-1">
                        {editable ? (
                          <ZeroInput
                            type="number"
                            value={row[field]}
                            onValue={(v) => handleRowChange(index, field, v)}
                            disabled={disableInput}
                            className={`input-always-spinner w-full p-1 text-sm text-center rounded
                              ${isReturnedWithContentsField(field) || isReturnedEmptyField(field) ? 'bg-yellow-50' : 'bg-gray-100'}
                              ${disableInput ? 'cursor-not-allowed opacity-70' : ''}
                            `}
                          />
                        ) : (
                          <input
                            type="number"
                            value={value}
                            disabled
                            className={`w-full p-1 text-sm text-center rounded
                              ${field.includes('discrepancy') && parseFloat(value || 0) !== 0
                                ? 'bg-red-100 text-red-700 font-semibold'
                                : 'bg-gray-100'}
                              cursor-not-allowed
                            `}
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* DISCOUNT -- DISPLAY ONLY */}
                  <td className="border border-gray-200 py-1 px-1">
                    <input
                      type="number"
                      value={z(row.discount)}
                      disabled
                      className="w-full p-1 text-sm text-center rounded bg-gray-100 cursor-not-allowed border"
                    />
                  </td>

                  {/* EXPECTED (gross) */}
                  <td className="border border-gray-200 py-1 px-1">
                    <div className="p-2 border rounded">
                      {Number(z(row.expected_sale)).toFixed(2)}
                    </div>
                  </td>

                  {/* ACTUAL (net) */}
                  <td className="border border-gray-200 py-1 px-1">
                    <input
                      className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium"
                      disabled
                      value={peso(row.actual_sale)}
                    />
                  </td>
                </tr>
              ))}

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
                {peso(emptiesPriceTotal)}
              </td>

              {/* RETURNED (Empty) */}
              <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
                {peso(refundablesTotal)}
              </td>

              {/* DISCREPANCY (Empty) */}
              <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
                {peso(totalDiscrepancyEmpty)}
              </td>

              {/* RETURNED (With Content/s) */}
              <td className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold" colSpan={2}>
                {peso(totalReturnedWithContent)}
              </td>

              {/* DISCREPANCY (Non-Empty) */}
              <td colSpan={2} className="py-2 px-1 bg-slate-100 text-gray-800 text-center font-semibold">
                {peso(totalDiscrepancyNonEmpty)}
              </td>

              {/* DISCOUNT spacer */}
              <td className="border border-gray-300 py-2 px-1 bg-slate-100"></td>

              {/* EXPECTED */}
              <td className="border border-gray-300 py-2 px-1 bg-slate-100 font-bold text-center">
                {peso(totalExpectedSale)}
              </td>

              {/* ACTUAL */}
              <td className="border border-gray-300 py-2 px-1 bg-slate-100 text-blue-700 font-bold text-center">
                {peso(totalActualSale)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
      <div className="flex justify-end gap-4 mt-6 mx-auto">
        <button 
          className='btn btn-back'
           onClick={() => navigate("/trading")}
          >
          Back
        </button>
      
        <button
  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
  onClick={() => {
    // ✅ HARD BLOCK before opening confirmation
    if (!validateSoldBeforeRemit()) return;

    setShowPaymentModal(true);
  }}
>
  Remittance
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
          totalReturnedWithContent={Number(totalReturnedWithContent) || 0}
          totalDiscrepancyNonEmpty={Number(totalDiscrepancyNonEmpty) || 0}
          expectedSale={Number(totalExpectedSale) || 0}
          totalAmount={Number(overallTotal) || 0}
          mspNo={sale.msp_no}
          transactionDate={sale.date_time}
          customerName={sale.customer?.name || 'Walk-in'}
          handledBy={sale.handled_by}
          transactionTypeName={sale.transaction_type_name}
          miscItems={miscItems}
          expensesTotal={calculateTotalExpenses()}
          remarks={remarks}
          onRemarksChange={setRemarks}
          onPaymentSuccess={handleVanLoadPaymentSuccess}
          warehouse={{ //reina
            name: sale.warehouse_name,
            address: sale.warehouse_address,
            phone: sale.warehouse_phone,
            city: sale.warehouse_city,
            region: sale.warehouse_region,
            email: sale.warehouse_email,
            fullAddress: sale.warehouse_full_address,
          }}
        />
      )}
    </div>
  );
}; 



export default VanLoadUpdate;