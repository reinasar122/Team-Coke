// Expenses.jsx - INTEGRATED VERSION WITH API CENTRALIZATION AND WAREHOUSE UTILITIES
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import api from "../api"; // ✅ NEW: Added centralized API import
import { getCurrentWarehouse, findWarehouseByName } from '../utils/warehouseUtils'; // ✅ Keep warehouse utilities

/* ------------------ helpers ------------------ */
const peso = (n) =>
  `₱${(parseFloat(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const authHeaders = () => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

// ✅ Helper to get large expense threshold
const getLargeExpenseThreshold = () => {
  return Number(localStorage.getItem('largeExpenseThreshold')) || 10000;
};

const sanitizeCurrencyInput = (value) => {
  const stripped = (value || "").replace(/[^\d.]/g, "");
  if (!stripped) return "";

  const hasDot = stripped.includes(".");
  const [rawInt = "", ...rest] = stripped.split(".");
  const rawDec = rest.join("").slice(0, 2);

  let normalizedInt = rawInt.replace(/^0+(?=\d)/, "");
  if (!normalizedInt) normalizedInt = "0";

  return hasDot ? `${normalizedInt}.${rawDec}` : normalizedInt;
};

const formatCurrencyInput = (rawValue) => {
  if (rawValue === "") return "";

  const hasDot = rawValue.includes(".");
  const [intPart = "0", decPart = ""] = rawValue.split(".");
  const intNum = Number.parseInt(intPart, 10);
  const formattedInt = Number.isFinite(intNum)
    ? intNum.toLocaleString("en-PH")
    : "0";

  return hasDot
    ? `\u20B1${formattedInt}.${decPart}`
    : `\u20B1${formattedInt}`;
};

// ✅ Custom alert component
const showAlert = (message, type = 'info') => {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
      <div class="btn ${type === 'error' ? 'btn-danger' : type === 'success' ? 'btn-add' : 'btn-primary'}" style="border-radius: 50%; width: 40px; height: 40px; margin-right: 12px;">
        <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check' : 'fa-info'}"></i>
      </div>
      <h3 style="margin: 0; font-weight: 600;">
        ${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Information'}
      </h3>
    </div>
    <p style="margin-bottom: 1rem; color: var(--text-muted);">${message}</p>
    <div style="display: flex; justify-content: flex-end;">
      <button class="btn ${type === 'error' ? 'btn-danger' : type === 'success' ? 'btn-add' : 'btn-primary'}" onclick="this.closest('.modal-overlay').remove()">OK</button>
    </div>
  `;
  
  alertDiv.appendChild(modalContent);
  document.body.appendChild(alertDiv);
};

export default function Expenses() {
  const [items, setItems] = useState([]); // miscellaneous items
  const [merch, setMerch] = useState([]); // merchandisings
  const [loading, setLoading] = useState(true); // ✅ Always start with loading
  const [err, setErr] = useState("");
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [threshold, setThreshold] = useState(getLargeExpenseThreshold());
  const [warehouseMSP, setWarehouseMSP] = useState(null); // ✅ Auto warehouse MSP (WA-* only)

  // ✅ Ensure FontAwesome is loaded
  useEffect(() => {
    if (!document.querySelector('link[href*="fontawesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }, []);

  // modal states
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    merchandising: "",
    description: "",
    amount: "",
  });
  const [formErr, setFormErr] = useState("");

  // view modal state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ✅ Listen for threshold updates
  useEffect(() => {
    const handleThresholdUpdate = (event) => {
      const newThreshold = event.detail?.newThreshold || getLargeExpenseThreshold();
      setThreshold(newThreshold);
    };

    window.addEventListener('thresholdUpdated', handleThresholdUpdate);
    return () => window.removeEventListener('thresholdUpdated', handleThresholdUpdate);
  }, []);

  // ✅ Keep warehouse setup using utilities
  const setupWarehouse = useCallback(async () => {
    console.log('🏭 Setting up warehouse for Expenses...');
    
    const warehouse = getCurrentWarehouse();
    
    if (!warehouse) {
      console.warn('⚠️ No warehouse found for user');
      setCurrentWarehouse(null);
      setLoading(false);
      return;
    }
    
    // If warehouse needs ID lookup, find it by name
    if (warehouse.needsIdLookup) {
      const foundWarehouse = await findWarehouseByName(warehouse.name);
      setCurrentWarehouse(foundWarehouse);
    } else {
      setCurrentWarehouse(warehouse);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    setupWarehouse();
  }, [setupWarehouse]);

  useEffect(() => {
    const handleWarehouseChange = (event) => {
      console.log('🏭 Warehouse change detected in Expenses:', event.detail);
      setupWarehouse();
    };
    
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, [setupWarehouse]);

  // ✅ Function to find latest warehouse MSP - FIXED to prevent infinite loops
  const findLatestWarehouseMSP = useCallback((merchData) => {
    if (!currentWarehouse?.id || !merchData?.length) {
      console.log("❌ No warehouse or merch data available for MSP detection");
      return null;
    }

    console.log(`🔄 Finding LATEST warehouse MSP for: ${currentWarehouse.name} from ${merchData.length} merchandisings`);

    // ✅ Filter warehouse MSPs - FIXED to handle both transaction_type formats
    const warehouseMSPs = merchData.filter(msp => {
      const isWarehouseType = msp.transaction_type === "Warehouse" || msp.transaction_type === 2;
      const hasWAPrefix = msp.msp_no && msp.msp_no.startsWith("WA-");
      const isValid = isWarehouseType || hasWAPrefix;
      
      return isValid;
    });

    console.log(`📊 Found ${warehouseMSPs.length} warehouse MSPs`);

    if (warehouseMSPs.length > 0) {
      // ✅ Sort by ID only since dates are unavailable - highest ID = newest
      const latest = [...warehouseMSPs].sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idB - idA; // Higher ID first (newest)
      })[0];
      
      console.log("✅ Selected LATEST warehouse MSP by ID:", {
        msp_no: latest.msp_no,
        id: latest.id,
        transaction_type: latest.transaction_type
      });
      return latest;
    } else {
      console.log("❌ No warehouse MSP found");
      return null;
    }
  }, [currentWarehouse]);

  // ✅ Trigger notifications
  useEffect(() => {
    const handleExpensesPageVisit = () => {
      console.log('💰 Triggering expenses page visit event for notifications');
      window.dispatchEvent(new Event('expensesPageVisited'));
    };

    handleExpensesPageVisit();
    const timeoutId = setTimeout(handleExpensesPageVisit, 1000);
    return () => clearTimeout(timeoutId);
  }, [items]);

  const triggerExpenseNotificationCheck = useCallback(() => {
    setTimeout(() => {
      window.dispatchEvent(new Event('expensesPageVisited'));
    }, 500);
  }, []);

  const sortLatest = useCallback((arr) => {
    return [...(arr || [])].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
      if (tb !== ta) return tb - ta;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, []);

  // ✅ UPDATED: Single useEffect with centralized API calls
  useEffect(() => {
    const fetchData = async () => {
      if (!currentWarehouse?.id) {
        console.log("❌ Skipping fetch - no warehouse ID");
        setWarehouseMSP(null);
        setItems([]);
        setMerch([]);
        return;
      }

      try {
        setLoading(true);
        setErr("");

        console.log(`🔄 Fetching expenses for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);

        // ✅ NEW: Use centralized API instead of direct axios calls
        const [miscRes, merchRes] = await Promise.allSettled([
          api.get(`/miscellaneous-items/?warehouse=${currentWarehouse.id}`, authHeaders()),
          api.get(`/merchandisings/?warehouse=${currentWarehouse.id}`, authHeaders()),
        ]);

        const miscData = miscRes.status === 'fulfilled' ? (miscRes.value?.data || []) : [];
        const merchData = merchRes.status === 'fulfilled' ? (merchRes.value?.data || []) : [];

        console.log(`✅ Loaded ${miscData.length} expenses and ${merchData.length} merchandisings for warehouse ${currentWarehouse.name}`);
        
        // ✅ Update items state
        setItems(sortLatest(miscData));
        
        // ✅ Update merch state
        setMerch(merchData);
        
        // ✅ Find and set warehouse MSP - ONLY ONCE here
        const latestWarehouseMSP = findLatestWarehouseMSP(merchData);
        setWarehouseMSP(latestWarehouseMSP);
        
      } catch (e) {
        console.error("❌ Error fetching data:", e);
        setErr("Failed to load data.");
        setWarehouseMSP(null);
        setItems([]);
        setMerch([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentWarehouse, findLatestWarehouseMSP, sortLatest]);

  // merch id → msp_no map
  const merchMap = useMemo(() => {
    const map = {};
    merch.forEach((m) => { map[m.id] = m.msp_no; });
    return map;
  }, [merch]);

  // group items by msp_no for view functionality
  const groupedExpenses = useMemo(() => {
    const groups = {};
    items.forEach((exp) => {
      const mspNo = merchMap[exp.merchandising] || "--";
      if (!groups[mspNo]) groups[mspNo] = [];
      groups[mspNo].push(exp);
    });
    return Object.entries(groups).map(([mspNo, exps]) => ({
      mspNo,
      expenses: exps,
      totalAmount: exps.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
      itemCount: exps.length,
      date: exps[0]?.created_at || exps[0]?.updated_at || exps[0]?.date,
    }));
  }, [items, merchMap]);

  const total = useMemo(
    () => items.reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0),
    [items]
  );

  // ---- modal helpers ----
  const onChange = (e) => {
    const { name, value } = e.target;
    setFormErr("");
    if (name === "amount") {
      const cleaned = sanitizeCurrencyInput(value);
      setForm((f) => ({ ...f, [name]: cleaned }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const canSave =
    form.description.trim().length > 0 &&
    form.amount !== "" &&
    !Number.isNaN(parseFloat(form.amount)) &&
    warehouseMSP?.id; // ✅ Must have a valid warehouse MSP

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  // ✅ UPDATED: Handle save with centralized API
  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;

    if (!currentWarehouse?.id) {
      setFormErr("No warehouse selected. Please select a warehouse first.");
      return;
    }

    if (!warehouseMSP?.id) {
      setFormErr("No warehouse MSP available. Please create a warehouse MSP first.");
      return;
    }

    try {
      setSaving(true);
      setFormErr("");

      console.log("💰 Creating expense for warehouse:", currentWarehouse.name);
      console.log("💰 Using Warehouse MSP (WA-*):", warehouseMSP.msp_no);

      const payload = {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        merchandising: warehouseMSP.id, // Always use warehouse MSP
      };

      // ✅ NEW: Use centralized API instead of direct axios
      const response = await api.post(`/miscellaneous-items/`, payload, authHeaders());

      setItems((prev) => sortLatest([response.data, ...prev]));
      setOpen(false);
      setForm({ merchandising: "", description: "", amount: "" });
      
      console.log("✅ Expense created successfully:", response.data);
      showAlert("Expense saved successfully!", "success");
      triggerExpenseNotificationCheck();
      
    } catch (e) {
      console.error("❌ Failed to save expense:", e);
      const server = e?.response?.data;
      let errorMessage = "Failed to save expense.";
      
      if (server) {
        errorMessage = typeof server === "string"
          ? server
          : JSON.stringify(server, null, 2);
      }
      
      setFormErr(errorMessage);
      showAlert("Failed to save expense: " + errorMessage, "error");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Delete group function
  const handleDeleteGroup = (group) => {
    setDeleteConfirm({
      type: 'group',
      data: group,
      message: `Are you sure you want to delete all ${group.itemCount} expense${group.itemCount > 1 ? 's' : ''} from MSP ${group.mspNo}?`
    });
  };

  // ✅ UPDATED: Confirm delete with centralized API
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      if (deleteConfirm.type === 'group') {
        const expenseIds = deleteConfirm.data.expenses.map(exp => exp.id);
        
        // ✅ NEW: Use centralized API instead of direct axios
        await Promise.all(
          expenseIds.map(id => 
            api.delete(`/miscellaneous-items/${id}/`, authHeaders())
          )
        );
        
        setItems(prev => prev.filter(item => !expenseIds.includes(item.id)));
        showAlert(`Successfully deleted ${expenseIds.length} expense${expenseIds.length > 1 ? 's' : ''}!`, "success");
      }
      
      triggerExpenseNotificationCheck();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete expenses:", error);
      showAlert("Failed to delete expenses", "error");
      setDeleteConfirm(null);
    }
  };

  // ✅ Keep sophisticated loading handling
  if (loading && !currentWarehouse) {
    return (
      <div className="expenseslist-container">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          Setting up warehouse...
        </div>
      </div>
    );
  }

  return (
    <div className="expenseslist-container">
      {/* Header - Clean with warehouse info */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="page-title">All Expenses</h1>
          
          {/* ✅ Show current warehouse */}
          {currentWarehouse && (
            <span className="page-warehouse-chip page-warehouse-chip--inline">
              <span className="page-warehouse-chip__icon" aria-hidden="true">💰</span>
              <span className="page-warehouse-chip__text">{currentWarehouse.name}</span>
            </span>
          )}
        </div>
        
        <button
          onClick={() => { 
            setOpen(true); 
            setFormErr(""); 
            // ✅ Auto-set the warehouse MSP (WA-* only)
            setForm({
              merchandising: warehouseMSP?.id || "",
              description: "",
              amount: "",
            });
          }}
          className={`btn app-page-create-btn ${currentWarehouse?.id && warehouseMSP ? 'btn-add' : 'btn-disabled'}`}
          disabled={!currentWarehouse?.id || !warehouseMSP}
        >
          + Add Expense
        </button>
      </div>

      {!currentWarehouse?.id && (
        <div style={{ 
          color: '#d97706', 
          background: '#fef3c7', 
          padding: 'var(--sp-4)', 
          borderRadius: 'var(--r-sm)', 
          marginBottom: 'var(--sp-4)',
          border: '1px solid #fde68a'
        }}>
          ⚠️ No warehouse selected. Please select a warehouse to view expenses.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          Loading expenses...
        </div>
      )}
      
      {err && (
        <div style={{ 
          color: 'var(--danger)', 
          background: '#fef2f2', 
          padding: 'var(--sp-4)', 
          borderRadius: 'var(--r-sm)', 
          marginBottom: 'var(--sp-4)',
          border: '1px solid #fecaca'
        }}>
          {err}
        </div>
      )}

      {!loading && !err && (
        <div className="expenseslist-container-wrapper">
          <div className="table-wrapper">
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '20%', textAlign: 'center' }}>MSP No</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Items Count</th>
                  <th style={{ width: '25%', textAlign: 'center' }}>Date</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Total Amount</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedExpenses.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ 
                      padding: '40px', 
                      textAlign: 'center', 
                      color: 'var(--text-muted)'
                    }}>
                      {currentWarehouse?.id 
                        ? "No expenses found for this warehouse" 
                        : "Select a warehouse to view expenses"
                      }
                    </td>
                  </tr>
                )}
                {groupedExpenses.map((group) => {
                  return (
                    <tr key={group.mspNo}>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          fontWeight: '500',
                          color: 'var(--text)'
                        }}>
                          {group.mspNo}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {group.itemCount} {group.itemCount > 1 ? "items" : "item"}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {dayjs(group.date).format("MMM DD, YYYY hh:mm A")}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          color: group.totalAmount >= threshold ? 'var(--danger)' : 'var(--text)',
                          fontWeight: '600'
                        }}>
                          {peso(group.totalAmount)}
                        </span>
                        {group.totalAmount >= threshold && (
                          <span style={{ marginLeft: '4px', fontSize: '12px', color: 'var(--danger)' }}>🚨</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => setSelectedGroup(group)}
                            className="icon-btn icon-btn-view"
                            title="View expenses"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group)}
                            className="icon-btn icon-btn-danger"
                            title="Delete all expenses"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {groupedExpenses.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--table-head)', fontWeight: '600' }}>
                    <td colSpan="4" style={{ textAlign: 'right' }}>
                      Grand Total:
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text)', fontWeight: '700' }}>
                      {peso(total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* -------- Add Expense Modal -------- */}
      {open && (
        <div className="modal-overlay" onClick={() => !saving && setOpen(false)}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '400px', 
              width: '90%',
              padding: '24px',
              borderRadius: '8px',
              background: 'var(--bg)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: '20px',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '12px'
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '18px', 
                fontWeight: '600', 
                color: 'var(--text)' 
              }}>
                Add Expense
              </h2>
              <button
                onClick={() => !saving && setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '6px',
                  color: 'var(--text)'
                }}>
                  Warehouse MSP (auto) 🏢
                </label>
                <input
                  type="text"
                  value={warehouseMSP?.msp_no || "No WA-* MSP available"}
                  style={{ 
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${warehouseMSP ? 'var(--success)' : 'var(--danger)'}`,
                    borderRadius: '4px',
                    backgroundColor: warehouseMSP ? '#f0f9ff' : '#fef2f2',
                    color: warehouseMSP ? 'var(--success)' : 'var(--danger)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'not-allowed'
                  }}
                  readOnly
                />
                <p style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)', 
                  marginTop: '4px',
                  marginBottom: 0
                }}>
                  {warehouseMSP 
                    ? `✅ Auto-selected LATEST WA-* MSP for ${currentWarehouse?.name}` 
                    : "❌ No Warehouse MSP found. Create a WA-* MSP first."
                  }
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '6px',
                  color: 'var(--text)'
                }}>
                  Description
                </label>
                <input
                  name="description"
                  value={form.description}
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '16px', // ✅ 16px to prevent zoom on mobile
                    background: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                  placeholder="e.g., Toll fee, Parking, Snacks..."
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '6px',
                  color: 'var(--text)'
                }}>
                  Amount
                </label>
                <input
                  name="amount"
                  value={formatCurrencyInput(form.amount)}
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '16px', // ✅ 16px to prevent zoom on mobile
                    background: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                  type="text"
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                />
                <p style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)', 
                  marginTop: '4px',
                  marginBottom: 0
                }}>
                  {/* Will be saved as {peso(form.amount || 0)} */}
                </p>
              </div>

              {formErr && (
                <div style={{ 
                  backgroundColor: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '4px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: 'var(--danger)'
                }}>
                  {formErr}
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '8px',
                marginTop: '24px'
              }}>
                <button
                  type="button"
                  onClick={() => !saving && setOpen(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSave || saving}
                  className={`btn ${canSave && !saving ? 'btn-add' : 'btn-disabled'}`}
                >
                  {saving ? "Saving…" : "Save Expense"}
                </button> 
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------- Delete Confirmation Modal -------- */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '400px', 
              width: '90%',
              padding: '20px',
              borderRadius: '8px',
              background: 'white',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}
          >
            <p style={{ 
              margin: '0 0 20px 0', 
              fontSize: '14px',
              color: '#374151',
              textAlign: 'center'
            }}>
              {deleteConfirm.message}
            </p>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '8px'
            }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#6b7280',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------- View Expenses Modal -------- */}
      {selectedGroup && (
        <div className="modal-overlay" onClick={() => setSelectedGroup(null)}>
          <div className="modal" style={{ maxWidth: '800px', minWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>
                Expenses for MSP {selectedGroup.mspNo}
              </h2>
              <button
                onClick={() => setSelectedGroup(null)}
                className="icon-btn"
                style={{ fontSize: '18px', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="text-left">Date & Time</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="text-left" style={{ color: 'var(--text)' }}>
                        {dayjs(exp.created_at || exp.updated_at || exp.date).format("MMM DD, YYYY hh:mm A")}
                      </td>
                      <td className="text-left" style={{ color: 'var(--text)' }}>{exp.description}</td>
                      <td className="text-right">
                        <span style={{ 
                          color: Number(exp.amount || 0) >= threshold ? 'var(--danger)' : 'var(--text)',
                          fontWeight: Number(exp.amount || 0) >= threshold ? '600' : '500'
                        }}>
                          {peso(exp.amount)}
                        </span>
                        {Number(exp.amount || 0) >= threshold && (
                          <span style={{ marginLeft: '4px', fontSize: '12px', color: 'var(--danger)' }}>🚨</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--table-head)', fontWeight: '600' }}>
                    <td colSpan="2" className="text-right" style={{ color: 'var(--text)' }}>
                      Total for MSP {selectedGroup.mspNo}:
                    </td>
                    <td className="text-right" style={{ fontWeight: '700', color: 'var(--text)' }}>
                      {peso(selectedGroup.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
