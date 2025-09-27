// Expenses.jsx - USING YOUR GLOBAL.SCSS CLASSES
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";

/* ------------------ helpers ------------------ */
const peso = (n) =>
  `₱${(parseFloat(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const API = "http://localhost:8080/api";
const authHeaders = () => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

// ✅ Helper to get current warehouse ID
const getCurrentWarehouse = () => {
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  
  if (userData.role?.toLowerCase() === "admin") {
    return selectedWarehouse?.id || userData.warehouse_id;
  }
  return userData.warehouse_id;
};

// ✅ Helper to get large expense threshold
const getLargeExpenseThreshold = () => {
  return Number(localStorage.getItem('largeExpenseThreshold')) || 10000;
};

// ✅ Custom modal components using your design system
const showAlert = (message, type = 'info') => {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'modal-overlay';
  const btnClass = type === 'error' ? 'btn-danger' : type === 'success' ? 'btn-add' : 'btn-primary';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
      <div class="btn ${btnClass}" style="border-radius: 50%; width: 40px; height: 40px; margin-right: 12px;">
        <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check' : 'fa-info'}"></i>
      </div>
      <h3 style="margin: 0; font-weight: 600;">
        ${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Information'}
      </h3>
    </div>
    <p style="margin-bottom: 1rem; color: var(--text-muted);">${message}</p>
    <div style="display: flex; justify-content: flex-end;">
      <button class="btn ${btnClass}" onclick="this.closest('.modal-overlay').remove()">OK</button>
    </div>
  `;
  
  alertDiv.appendChild(modalContent);
  document.body.appendChild(alertDiv);
};

const showConfirmDialog = (message, onConfirm) => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  
  modalContent.innerHTML = `
    <p style="margin-bottom: 1rem; color: var(--text);">${message}</p>
    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button class="btn btn-cancel cancel-btn">Cancel</button>
      <button class="btn btn-danger confirm-btn">Delete</button>
    </div>
  `;
  
  // Add event listeners
  const cancelBtn = modalContent.querySelector('.cancel-btn');
  const confirmBtn = modalContent.querySelector('.confirm-btn');
  
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  confirmBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
    onConfirm();
  });
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
};

export default function Expenses() {
  const [items, setItems] = useState([]); // miscellaneous items
  const [merch, setMerch] = useState([]); // merchandisings
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [threshold, setThreshold] = useState(getLargeExpenseThreshold()); // ✅ Dynamic threshold

  // ✅ Ensure FontAwesome is loaded for delete icon
  useEffect(() => {
    if (!document.querySelector('link[href*="fontawesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }, []);

  // modal state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    merchandising: "", // optional id
    description: "",
    amount: "",
  });
  const [formErr, setFormErr] = useState(""); // show backend validation

  // ✅ Listen for threshold updates
  useEffect(() => {
    const handleThresholdUpdate = (event) => {
      const newThreshold = event.detail?.newThreshold || getLargeExpenseThreshold();
      setThreshold(newThreshold);
    };

    window.addEventListener('thresholdUpdated', handleThresholdUpdate);
    
    return () => {
      window.removeEventListener('thresholdUpdated', handleThresholdUpdate);
    };
  }, []);

  // ✅ Set up current warehouse on mount and listen for changes
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    if (user.role?.toLowerCase() === "admin") {
      setCurrentWarehouse(selectedWarehouse || { id: user.warehouse_id, name: user.warehouse });
    } else {
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }

    const handleWarehouseChange = (event) => {
      const { warehouse } = event.detail || {};
      if (warehouse) {
        setCurrentWarehouse(warehouse);
      } else {
        setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, []);

  // ✅ Trigger expenses page visit event for notifications
  useEffect(() => {
    const handleExpensesPageVisit = () => {
      console.log('💰 Triggering expenses page visit event for notifications');
      window.dispatchEvent(new Event('expensesPageVisited'));
    };

    // Trigger on mount and when expenses change
    handleExpensesPageVisit();
    
    // Also trigger when items change (when expenses are added/updated/deleted)
    const timeoutId = setTimeout(handleExpensesPageVisit, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [items]); // Trigger when items (expenses) change

  // ✅ Additional trigger for real-time notifications when user performs expense actions
  const triggerExpenseNotificationCheck = useCallback(() => {
    setTimeout(() => {
      window.dispatchEvent(new Event('expensesPageVisited'));
    }, 500);
  }, []);

  const sortLatest = useCallback((arr) => {
    return [...(arr || [])].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
      if (tb !== ta) return tb - ta;          // newer first
      return (b.id ?? 0) - (a.id ?? 0);       // tie-breaker
    });
  }, []);

  // ✅ Updated fetchData to filter by warehouse
  useEffect(() => {
    const fetchData = async () => {
      if (!currentWarehouse?.id) {
        console.log("❌ Skipping expenses fetch - no warehouse ID");
        return;
      }

      try {
        setLoading(true);
        setErr("");

        console.log(`🔄 Fetching expenses for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);

        const [miscRes, merchRes] = await Promise.allSettled([
          // ✅ Filter miscellaneous items by warehouse through merchandising relationship
          axios.get(`${API}/miscellaneous-items/?warehouse=${currentWarehouse.id}`, authHeaders()),
          // ✅ Filter merchandisings by warehouse
          axios.get(`${API}/merchandisings/?warehouse=${currentWarehouse.id}`, authHeaders()),
        ]);

        // Handle miscellaneous items response
        const miscData = miscRes.status === 'fulfilled' ? (miscRes.value?.data || []) : [];
        const merchData = merchRes.status === 'fulfilled' ? (merchRes.value?.data || []) : [];

        console.log(`✅ Loaded ${miscData.length} expenses for warehouse ${currentWarehouse.name}`);
        
        setItems(sortLatest(miscData));
        setMerch(merchData);
      } catch (e) {
        console.error("❌ Error fetching expenses:", e);
        setErr("Failed to load expenses data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sortLatest, currentWarehouse]);

  // merch id → msp_no
  const merchMap = useMemo(() => {
    const map = {};
    merch.forEach((m) => { map[m.id] = m.msp_no; });
    return map;
  }, [merch]);

  const total = useMemo(
    () => items.reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0),
    [items]
  );

  // ---- modal helpers ----
  const onChange = (e) => {
    const { name, value } = e.target;
    setFormErr("");
    if (name === "amount") {
      const cleaned = value.replace(/[^\d.]/g, "");
      setForm((f) => ({ ...f, [name]: cleaned }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const canSave =
    form.description.trim().length > 0 &&
    form.amount !== "" &&
    !Number.isNaN(parseFloat(form.amount));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  // ✅ ENHANCED: handleSave with multiple payload formats and better error handling
  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;

    if (!currentWarehouse?.id) {
      setFormErr("No warehouse selected. Please select a warehouse first.");
      return;
    }

    try {
      setSaving(true);
      setFormErr("");

      console.log("💰 Creating expense for warehouse:", currentWarehouse.name);
      console.log("💰 Form data:", form);
      console.log("💰 Current warehouse:", currentWarehouse);

      // ✅ Try multiple payload formats to find the correct one for your API
      const payloadVariations = [
        // Variation 1: Standard format
        {
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          warehouse: currentWarehouse.id,
          ...(form.merchandising && form.merchandising !== '' && {
            merchandising: Number(form.merchandising)
          })
        },
        // Variation 2: With _id suffix
        {
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          warehouse_id: currentWarehouse.id,
          ...(form.merchandising && form.merchandising !== '' && {
            merchandising_id: Number(form.merchandising)
          })
        },
        // Variation 3: Snake case format
        {
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          warehouse_id: currentWarehouse.id,
          ...(form.merchandising && form.merchandising !== '' && {
            merchandising: Number(form.merchandising)
          })
        },
        // Variation 4: Alternative format
        {
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          warehouse: currentWarehouse.id,
          ...(form.merchandising && form.merchandising !== '' && {
            merchandising_id: Number(form.merchandising)
          })
        },
        // Variation 5: Without merchandising (in case it's causing issues)
        {
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          warehouse: currentWarehouse.id
        },
        // Variation 6: Minimal format (just the essentials)
        {
          description: form.description.trim(),
          amount: parseFloat(form.amount)
        }
      ];

      let response;
      let lastError;

      // Try each payload variation
      for (let i = 0; i < payloadVariations.length; i++) {
        try {
          console.log(`💰 Attempt ${i + 1}: Trying payload format:`, payloadVariations[i]);
          response = await axios.post(`${API}/miscellaneous-items/`, payloadVariations[i], authHeaders());
          console.log(`✅ Success with payload variation ${i + 1}`);
          break;
        } catch (error) {
          console.log(`❌ Attempt ${i + 1} failed:`, error.response?.status, error.response?.data);
          lastError = error;
          
          // If it's a 400 error (bad request), try next variation
          if (error.response?.status === 400 && i < payloadVariations.length - 1) {
            continue;
          }
          
          // If it's a 500 error and we have more variations, try them
          if (error.response?.status === 500 && i < payloadVariations.length - 1) {
            continue;
          }
          
          // If this is the last variation, throw the error
          if (i === payloadVariations.length - 1) {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError;
      }

      // optimistic insert + keep sorted latest first
      setItems((prev) => sortLatest([response.data, ...prev]));
      setOpen(false);
      setForm({ merchandising: "", description: "", amount: "" });
      
      console.log("✅ Expense created successfully:", response.data);

      // Show success message
      showAlert("Expense saved successfully!", "success");

      // ✅ Trigger notification check after successful creation
      triggerExpenseNotificationCheck();
      
    } catch (e) {
      console.error("❌ Failed to save expense:", e);
      console.error("❌ Error details:", {
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        data: e?.response?.data,
        headers: e?.response?.headers,
        config: e?.config
      });

      const server = e?.response?.data;
      let errorMessage = "Failed to save expense.";
      
      if (e?.response?.status === 500) {
        errorMessage = "Server error (500). Please check your backend logs for details.";
        console.error("💰 500 Error - possible causes:");
        console.error("- Database connection issues");
        console.error("- Foreign key constraint violations");
        console.error("- Missing required fields in backend model");
        console.error("- Backend validation errors");
      } else if (e?.response?.status === 400) {
        errorMessage = server
          ? typeof server === "string"
            ? server
            : JSON.stringify(server, null, 2)
          : "Bad request (400). Please check your input data.";
      } else if (e?.response?.status === 401) {
        errorMessage = "Unauthorized (401). Please check your authentication.";
      } else if (e?.response?.status === 403) {
        errorMessage = "Forbidden (403). You don't have permission to create expenses.";
      } else if (e?.response?.status === 404) {
        errorMessage = "Not found (404). The API endpoint may not exist.";
      } else if (server) {
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

  // ✅ Delete expense function
  const handleDelete = async (expenseId) => {
    showConfirmDialog("Are you sure you want to delete this expense?", async () => {
      try {
        await axios.delete(`${API}/miscellaneous-items/${expenseId}/`, authHeaders());
        setItems(prev => prev.filter(item => item.id !== expenseId));
        showAlert("Expense deleted successfully!", "success");
        triggerExpenseNotificationCheck();
      } catch (error) {
        console.error("Failed to delete expense:", error);
        showAlert("Failed to delete expense", "error");
      }
    });
  };

  return (
    <div className="expenseslist-container">
      {/* ✅ Updated Header without settings button */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Expenses</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Showing expenses for: <span style={{ fontWeight: '600' }}>{currentWarehouse?.name || "No Warehouse Selected"}</span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span style={{ fontSize: '12px' }}>Alert threshold: {peso(threshold)}</span>
          </p>
        </div>
        <button
          onClick={() => { setOpen(true); setFormErr(""); }}
          className="btn btn-add"
          disabled={!currentWarehouse?.id}
        >
          + Add Expense
        </button>
      </div>

      {!currentWarehouse?.id && (
        <div style={{ color: '#d97706', background: '#fef3c7', padding: '16px', borderRadius: 'var(--r-md)', marginBottom: '16px' }}>
          ⚠️ No warehouse selected. Please select a warehouse to view expenses.
        </div>
      )}

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}

      {!loading && !err && (
        <div className="expenseslist-container-wrapper">
          <div className="table-wrapper">
            <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '35%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left" style={{ padding: '12px 16px' }}>Date &amp; Time</th>
                  <th className="text-left" style={{ padding: '12px 16px' }}>MSP No</th>
                  <th className="text-left" style={{ padding: '12px 16px' }}>Description</th>
                  <th className="text-right" style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {currentWarehouse?.id 
                        ? "No expenses found for this warehouse" 
                        : "Select a warehouse to view expenses"
                      }
                    </td>
                  </tr>
                )}
                {items.map((exp) => (
                  <tr key={exp.id}>
                    <td className="text-left" style={{ padding: '12px 16px' }}>
                      {dayjs(exp.created_at || exp.updated_at || exp.date).format("MMM DD, YYYY hh:mm A")}
                    </td>
                    <td className="text-left" style={{ padding: '12px 16px' }}>{merchMap[exp.merchandising] || "--"}</td>
                    <td className="text-left" style={{ padding: '12px 16px' }}>{exp.description || "--"}</td>
                    <td className="text-right" style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        color: Number(exp.amount || 0) >= threshold ? 'var(--danger)' : 'inherit',
                        fontWeight: Number(exp.amount || 0) >= threshold ? '700' : 'normal'
                      }}>
                        {peso(exp.amount)}
                      </span>
                      {Number(exp.amount || 0) >= threshold && (
                        <span style={{ marginLeft: '4px', fontSize: '12px', color: 'var(--danger)' }}>🚨</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="icon-btn icon-btn-danger"
                        title="Delete expense"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          transition: 'all 0.2s ease',
                          margin: '0 auto'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        <i className="fas fa-trash" style={{ fontSize: '16px' }}></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--table-head)', fontWeight: '600' }}>
                    <td colSpan="4" className="text-right" style={{ padding: '12px 16px' }}>
                      Total for {currentWarehouse?.name}
                    </td>
                    <td className="text-right" style={{ padding: '12px 16px' }}>{peso(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* -------- Modal -------- */}
      {open && (
        <div
          className="modal-overlay"
          aria-modal="true"
          role="dialog"
          onClick={() => !saving && setOpen(false)}
        >
          {/* dialog */}
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Add Expense - {currentWarehouse?.name}
              </h2>
              <button
                onClick={() => !saving && setOpen(false)}
                className="icon-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Backend validation error */}
            {formErr && (
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: 'var(--r-sm)', 
                padding: '12px', 
                marginBottom: '16px' 
              }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#991b1b', 
                  marginBottom: '8px' 
                }}>Error Details:</h4>
                <pre style={{ 
                  fontSize: '12px', 
                  color: '#dc2626', 
                  whiteSpace: 'pre-wrap', 
                  maxHeight: '128px', 
                  overflowY: 'auto',
                  margin: 0
                }}>
                  {formErr}
                </pre>
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                  Link to MSP (optional)
                </label>
                <select
                  name="merchandising"
                  value={form.merchandising}
                  onChange={onChange}
                  className="input"
                  style={{ textAlign: 'left' }}
                >
                  <option value="">-- Select MSP --</option>
                  {merch.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.msp_no}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Description</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={onChange}
                  className="input"
                  style={{ textAlign: 'left' }}
                  placeholder="e.g., Toll fee, Parking, Snacks…"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Amount</label>
                <input
                  name="amount"
                  value={form.amount}
                  onChange={onChange}
                  className="input"
                  placeholder="0.00"
                  inputMode="decimal"
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Will be saved as {peso(form.amount || 0)}
                  {Number(form.amount || 0) >= threshold && (
                    <span style={{ marginLeft: '8px', color: 'var(--danger)', fontWeight: '500' }}>⚠️ Large expense alert will be triggered</span>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => !saving && setOpen(false)}
                  className="btn btn-cancel"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSave || saving || !currentWarehouse?.id}
                  className={`btn ${canSave && !saving && currentWarehouse?.id ? "btn-primary" : "btn-disabled"}`}
                >
                  {saving ? "Saving…" : "Save Expense"}
                </button> 
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}