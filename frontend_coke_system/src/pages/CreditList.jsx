// src/pages/CreditList.jsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaEye } from "react-icons/fa";
import api from "../api"; // ✅ correct

export default function CreditList() {
  const [rows, setRows] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Get current warehouse information
  const getCurrentWarehouse = useCallback(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse || { id: userData.warehouse_id, name: userData.warehouse };
    }
    
    if (userData.warehouse_id && userData.warehouse) {
      return { id: userData.warehouse_id, name: userData.warehouse };
    }
    
    return null;
  }, []);

  useEffect(() => {
    const updateWarehouse = () => {
      const warehouse = getCurrentWarehouse();
      setCurrentWarehouse(warehouse);
    };
    
    updateWarehouse();
    
    const handleWarehouseChange = () => {
      updateWarehouse();
    };
    
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [getCurrentWarehouse]);

  useEffect(() => {
    const loadCredits = async () => {
      if (!currentWarehouse) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const { data } = await api.get(`/credits/?warehouse=${currentWarehouse.id}`);
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load credits.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadCredits();
  }, [currentWarehouse]);

  // ✅ NEW: Trigger credits page visit for notifications
  useEffect(() => {
    if (currentWarehouse) {
      console.log('🔔 Credits page visited, triggering notification check');
      
      // Dispatch event to notify system that credits page was visited
      window.dispatchEvent(new CustomEvent('creditsPageVisited', {
        detail: {
          timestamp: new Date().toISOString(),
          warehouseId: currentWarehouse.id,
          warehouseName: currentWarehouse.name,
          creditsCount: rows.length
        }
      }));
    }
  }, [currentWarehouse, rows.length]);

  // ✅ NEW: Check for overdue credits and trigger notifications
  useEffect(() => {
    if (rows.length > 0 && currentWarehouse) {
      const today = new Date();
      const overdueCredits = rows.filter(credit => {
        if (credit.status === 'PAID') return false;
        if (!credit.due_date) return false;
        
        const dueDate = new Date(credit.due_date);
        return today > dueDate;
      });

      // Trigger overdue notifications for each overdue credit
      overdueCredits.forEach(credit => {
        const dueDate = new Date(credit.due_date);
        const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
        
        console.log('🔔 Overdue credit found in list:', {
          id: credit.id,
          msp_no: credit.msp_no,
          days_overdue: daysOverdue
        });

        // Throttle notifications - only trigger once per hour for each credit
        const lastNotified = localStorage.getItem(`lastOverdueNotification_${credit.id}`);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        if (!lastNotified || (now - parseInt(lastNotified)) > oneHour) {
          window.dispatchEvent(new CustomEvent('creditOverdueDetected', {
            detail: {
              id: credit.id,
              msp_no: credit.msp_no,
              customer_name: credit.customer_name,
              balance: credit.balance,
              due_date: credit.due_date,
              days_overdue: daysOverdue,
              warehouse_id: currentWarehouse.id,
              detected_in_list: true
            }
          }));
          
          // Mark as notified
          localStorage.setItem(`lastOverdueNotification_${credit.id}`, now.toString());
        }
      });
    }
  }, [rows, currentWarehouse]);

  const fmt = (v) => Number(v || 0).toFixed(2);
  const dt = (v) => (v ? new Date(v).toLocaleString() : "--");

  // --- helpers for status normalization ---
  const norm = (s) => String(s || "").trim().toUpperCase();
  const isPaid = (s) => {
    const x = norm(s);
    return x === "PAID" || x === "FULLY PAID" || x === "SETTLED";
  };
  const isPending = (s) => norm(s) === "PENDING";
  const isPartial = (s) => ["PARTIAL", "PARTIALLY PAID"].includes(norm(s));

  const statusLabel = (s) => {
    if (isPending(s)) return "Unpaid";
    if (isPartial(s)) return "Partially Paid";
    if (isPaid(s)) return "Fully Paid";
    return String(s || "").toString();
  };

  const getStatusStyle = (s) => {
    if (isPending(s)) {
      return { 
       background: '#fee2e2',  // 🔴 light red background
        color: '#b91c1c',  
        padding: '4px 8px', 
        borderRadius: '6px', 
        fontSize: '0.875rem',
        fontWeight: 500
      };
    }
    if (isPartial(s)) {
      return { 
        background: '#fef3c7', 
        color: '#d97706', 
        padding: '4px 8px', 
        borderRadius: '6px', 
        fontSize: '0.875rem',
        fontWeight: 500
      };
    }
    if (isPaid(s)) {
      return { 
        background: '#dcfce7', 
        color: '#16a34a', 
        padding: '4px 8px', 
        borderRadius: '6px', 
        fontSize: '0.875rem',
        fontWeight: 500
      };
    }
    return { 
      background: '#fef3c7', 
      color: '#d97706', 
      padding: '4px 8px', 
      borderRadius: '6px', 
      fontSize: '0.875rem',
      fontWeight: 500
    };
  };

  // --- sort: Unpaid first, then Partially Paid, then Fully Paid; each group by latest date ---
const sortedRows = [...rows].sort((a, b) => {
  const order = (status) => {
    const s = norm(status);
    if (isPending(s)) return 0;              // 🔴 Unpaid first
    if (isPartial(s)) return 1;              // 🟡 Partially Paid second
    if (isPaid(s)) return 2;                 // 🟢 Fully Paid last
    return 3;                                // Others (if any)
  };

  const aOrder = order(a.status);
  const bOrder = order(b.status);
  if (aOrder !== bOrder) return aOrder - bOrder;

  // within same status → latest first
  const at = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bt - at;
});

  if (!currentWarehouse) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--danger)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Warehouse Selected</h2>
          <p>Please select a warehouse to view credits.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading credits...</div>
      </div>
    );
  }

  return (
    <div className="creditlist-container">
      <h1 className="text-xl font-bold mb-4">Credit List</h1>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th className="text-center">MSP No.</th>
              <th className="text-center">Date &amp; Time</th>
              <th className="text-center">Handled By</th>
              <th className="text-center">Customer</th>
              <th className="text-center">Total</th>
              <th className="text-center">Paid</th>
              <th className="text-center">Balance</th>
              <th className="text-center">Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>

            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ textAlign: 'center' }}>{r.msp_no}</td>
                  <td style={{ textAlign: 'center' }}>{dt(r.created_at)}</td>
                  <td style={{ textAlign: 'center' }}>{r.handled_by || "--"}</td>
                  <td style={{ textAlign: 'center' }}>{r.customer_name || "--"}</td>
                  <td style={{ textAlign: 'center' }}>₱{fmt(r.total_amount)}</td>
                  <td style={{ textAlign: 'center' }}>₱{fmt(r.amount_paid)}</td>
                  <td style={{ textAlign: 'center' }}>₱{fmt(r.balance)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={getStatusStyle(r.status)}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="icon-btn icon-btn-view"
                      onClick={() => navigate(`/credits/${r.id}?warehouse=${currentWarehouse.id}`)}
                      title="View details"
                    >
                      <FaEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {!sortedRows.length && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {currentWarehouse ? 
                      `No credit records found for ${currentWarehouse.name}.` : 
                      'No credit records.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}