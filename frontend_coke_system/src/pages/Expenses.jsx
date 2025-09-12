import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";
import ExpenseFormModal from "../components/expenses/ExpenseFormModal";
import ReceiptPreviewModal from "../components/expenses/ReceiptPreviewModal";
import "../styles/expenses.scss";

/* -------------------- Config -------------------- */
const API = process.env.REACT_APP_API_URL || "http://localhost:8080/api";
const authHeaders = () => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

/* -------------------- Helpers -------------------- */
const peso = (n) =>
  `₱${(parseFloat(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = [
  "Fuel",
  "Food",
  "Repairs",
  "Toll",
  "Parking",
  "Supplies",
  "Allowance",
  "Misc",
];

const categoryColor = (c) => {
  switch (c) {
    case "Fuel": return "#ef4444";
    case "Food": return "#22c55e";
    case "Repairs": return "#f59e0b";
    case "Toll": return "#3b82f6";
    case "Parking": return "#6366f1";
    case "Supplies": return "#10b981";
    case "Allowance": return "#e879f9";
    default: return "#94a3b8";
  }
};

/* -------------------- Period utils -------------------- */
const today = () => ({ start: dayjs().startOf("day"), end: dayjs().endOf("day") });
const thisWeek = () => ({ start: dayjs().startOf("week"), end: dayjs().endOf("week") });
const thisMonth = () => ({ start: dayjs().startOf("month"), end: dayjs().endOf("month") });

const periodOptions = [
  { value: "today", label: "Today", range: today },
  { value: "this_week", label: "This Week", range: thisWeek },
  { value: "this_month", label: "This Month", range: thisMonth },
  { value: "custom", label: "Custom", range: null },
];

export default function Expenses() {
  /* -------------------- State -------------------- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [filters, setFilters] = useState(() => {
    const { start, end } = thisMonth();
    return {
      period: "this_month",
      start: start.format("YYYY-MM-DD"),
      end: end.format("YYYY-MM-DD"),
      category: "all",
      q: "",
    };
  });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // row being edited
  const [receiptPreview, setReceiptPreview] = useState(null); // url

  /* -------------------- Fetch -------------------- */
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setErr("");

      const params = {
        start: filters.start || undefined,
        end: filters.end || undefined,
        category: filters.category !== "all" ? filters.category : undefined,
        q: filters.q || undefined,
      };

      // Adjust this path to your API list endpoint
      const res = await axios.get(`${API}/expenses/`, { ...authHeaders(), params });
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      setErr("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.start, filters.end, filters.category, filters.q]);

  /* -------------------- Derived -------------------- */
  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [rows]
  );

  const byCategory = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const k = r.category || "Uncategorized";
      map[k] = (map[k] || 0) + (parseFloat(r.amount) || 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [rows]);

  /* -------------------- Handlers -------------------- */
  const onChangePeriod = (val) => {
    if (val === "custom") {
      setFilters((f) => ({ ...f, period: val }));
      return;
    }
    const found = periodOptions.find((p) => p.value === val);
    const r = found?.range?.();
    setFilters((f) => ({
      ...f,
      period: val,
      start: r?.start?.format("YYYY-MM-DD") ?? f.start,
      end: r?.end?.format("YYYY-MM-DD") ?? f.end,
    }));
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await axios.delete(`${API}/expenses/${id}/`, authHeaders());
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete.");
    }
  };

  const onSaved = () => {
    setShowForm(false);
    setEditing(null);
    fetchExpenses();
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="expenses-page">
      <header className="expenses-header">
        <div>
          <h1>Expenses</h1>
          <p className="muted">Track operational spending with filters, receipts, and summaries.</p>
        </div>
        <button className="btn primary" onClick={() => setShowForm(true)}>+ Add Expense</button>
      </header>

      {/* Filters */}
      <section className="filters">
        <div className="filter-row">
          <div className="group">
            <label>Period</label>
            <select
              value={filters.period}
              onChange={(e) => onChangePeriod(e.target.value)}
            >
              {periodOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="group">
            <label>Start</label>
            <input
              type="date"
              value={filters.start || ""}
              onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
              disabled={filters.period !== "custom"}
            />
          </div>

          <div className="group">
            <label>End</label>
            <input
              type="date"
              value={filters.end || ""}
              onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
              disabled={filters.period !== "custom"}
            />
          </div>

          <div className="group">
            <label>Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="all">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="group grow">
            <label>Search</label>
            <input
              type="text"
              placeholder="description or amount…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="content">
        <div className="content-main">
          <div className="card table-card">
            {loading ? (
              <div className="empty">Loading…</div>
            ) : err ? (
              <div className="error">{err}</div>
            ) : rows.length === 0 ? (
              <div className="empty">No expenses found for the selected filters.</div>
            ) : (
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Date</th>
                    <th style={{ width: 140 }}>Category</th>
                    <th>Description</th>
                    <th style={{ width: 150, textAlign: "right" }}>Amount</th>
                    <th style={{ width: 120 }}>Receipt</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{dayjs(r.date || r.created_at).format("MMM DD, YYYY")}</td>
                      <td>
                        <span
                          className="pill"
                          style={{ backgroundColor: categoryColor(r.category), color: "white" }}
                        >
                          {r.category || "—"}
                        </span>
                      </td>
                      <td className="desc-cell">{r.description || "—"}</td>
                      <td className="amount">{peso(r.amount)}</td>
                      <td>
                        {r.receipt_url ? (
                          <img
                            src={r.receipt_url}
                            alt="receipt"
                            className="thumb"
                            onClick={() => setReceiptPreview(r.receipt_url)}
                          />
                        ) : (
                          <span className="muted">No file</span>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="btn sm"
                            onClick={() => { setEditing(r); setShowForm(true); }}
                          >
                            Edit
                          </button>
                          <button className="btn sm danger" onClick={() => onDelete(r.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="right bold">Total</td>
                    <td className="amount bold">{peso(total)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar Summary */}
        <aside className="content-side">
          <div className="card summary-card">
            <div className="summary-header">
              <h3>Total for Period</h3>
              <div className="total">{peso(total)}</div>
            </div>
            <div className="chart-wrap">
              {byCategory.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label
                    >
                      {byCategory.map((entry, idx) => (
                        <Cell key={`slice-${idx}`} fill={categoryColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => peso(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty small">No category breakdown.</div>
              )}
            </div>
            <ul className="legend">
              {byCategory.map((x) => (
                <li key={x.name}>
                  <span className="dot" style={{ backgroundColor: categoryColor(x.name) }} />
                  <span className="name">{x.name}</span>
                  <span className="val">{peso(x.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      {/* Modals */}
      {showForm && (
        <ExpenseFormModal
          categories={CATEGORIES}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={onSaved}
          apiBase={API}
        />
      )}

      {receiptPreview && (
        <ReceiptPreviewModal
          url={receiptPreview}
          onClose={() => setReceiptPreview(null)}
        />
      )}
    </div>
  );
}
