import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Expenses from "../pages/Expenses";

// Currency formatter (PHP)
const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

// Axios instance (match Expenses.jsx)
const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8080/api";
const api = axios.create({
  baseURL: API_BASE,
  headers: localStorage.getItem("token")
    ? { Authorization: `Token ${localStorage.getItem("token")}` }
    : undefined,
});

// Reusable Modal
const Modal = ({ open, onClose, title = "", children, onSave, saving }) => {
  if (!open) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={handleBackdrop}
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm hover:bg-slate-100"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="btn btn-back">
            Close
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className={`btn btn-primary ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ExpensesList = () => {
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Items being edited inside modal
  const [miscItems, setMiscItems] = useState([]);

  // Table rows for saved expenses (persisted via backend)
  const [expenses, setExpenses] = useState([]);
  const expensesRef = useRef(null);

  const showAlert = (msg) => window.alert(msg);

  const handleCreateNew = () => {
    setOpenNew(true);
    setMiscItems([]); // reset draft items for a fresh form
  };
  const handleCloseModal = () => setOpenNew(false);

  const fetchSummary = async () => {
  try {
    setLoading(true);

    // scope to current warehouse if you store it on the user
    let params = { transaction_type: "WAREHOUSE", ordering: "-date_time" };
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      const wid = u?.warehouse?.id || u?.warehouse_id || null;
      if (wid) params.warehouse_id = wid;
    } catch {}

    const res = await api.get("/merchandising/", { params });

    // client-side filter to WA… MSP numbers if needed
    const rows = (Array.isArray(res.data) ? res.data : [])
      .filter(r => String(r.msp_no || "").startsWith("WA"))
      .map(r => ({
        id: r.id,
        msp_no: r.msp_no,
        date_time: r.date_time,
        handled_by: r.handled_by || "",
        customer: (r.customer_name || r.customer || "Walk-in Customer"),
        total: Number(r.miscellaneous || 0), // <- relies on signals keeping it in sync
      }));

    setExpenses(rows);
  } catch (err) {
    console.error("❌ Failed to load merchandising:", err?.response?.status, err?.response?.data);
    showAlert("Failed to load expenses.");
  } finally {
    setLoading(false);
  }
};


  const handleSave = async () => {
    try {
      const payload = expensesRef.current?.getPayload?.();
      if (!payload) {
        showAlert("Form is not ready.");
        return;
      }

      const { msp_no, items } = payload;

      if (!msp_no) {
        showAlert("MSP No is required.");
        return;
      }
      if (!items || !items.length) {
        showAlert("Add at least one expense item.");
        return;
      }

      setSaving(true);

      // 1) Find merchandising by msp_no
      const merchRes = await api.get(`/merchandising/`, { params: { msp_no, limit: 1 } });
      const merch = Array.isArray(merchRes.data) ? merchRes.data[0] : null;
      if (!merch?.id) {
        showAlert(`No merchandising transaction found for MSP No: ${msp_no}`);
        setSaving(false);
        return;
      }

      // 2) Create each MiscellaneousItem
      const itemPayloads = items.map((it) => ({
        merchandising: merch.id,
        description: it.description,
        amount: it.amount,
      }));
      await Promise.all(itemPayloads.map((p) => api.post(`/miscellaneous-items/`, p)));

      // 3) Refresh list from backend so it persists across refresh
      await fetchSummary();

      showAlert("✅ Expenses saved.");
      setMiscItems([]);
      setOpenNew(false);
    } catch (err) {
      console.error("Save error:", err);
      showAlert("❌ Failed to save expenses.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="expesestlist-container">
      <div className="m-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl">Expenses List</h1>

        <button onClick={handleCreateNew} className="btn btn-add">
          + NEW Expenses
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th className="text-center">MSP No.</th>
              <th className="text-center">Date &amp; Time</th>
              <th className="text-center">Handled By</th>
              <th className="text-center">Customer</th>
              <th className="text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="text-center py-6" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td className="text-center" colSpan={5}>
                  No expenses yet.
                </td>
              </tr>
            ) : (
              expenses.map((row) => (
                <tr key={row.id}>
                  <td className="text-center">{row.msp_no}</td>
                  <td className="text-center">
                    {/* If backend returns ISO string, keep it; otherwise format here */}
                    {String(row.date_time).replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="text-center">{row.handled_by || ""}</td>
                  <td className="text-center">{row.customer || "Walk-in Customer"}</td>
                  <td className="text-center">{peso.format(Number(row.total || 0))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal with Expenses form */}
      <Modal
        open={openNew}
        onClose={handleCloseModal}
        onSave={handleSave}
        saving={saving}
        title="New Expenses"
      >
        <Expenses ref={expensesRef} miscItems={miscItems} setMiscItems={setMiscItems} />
      </Modal>
    </div>
  );
};

export default ExpensesList;
