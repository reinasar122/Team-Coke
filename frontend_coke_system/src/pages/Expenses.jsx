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

export default function Expenses() {
  const [items, setItems] = useState([]); // miscellaneous items
  const [merch, setMerch] = useState([]); // merchandisings
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // modal state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    merchandising: "", // optional id
    description: "",
    amount: "",
  });
  const [formErr, setFormErr] = useState(""); // show backend validation

  const sortLatest = useCallback((arr) => {
    return [...(arr || [])].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
      if (tb !== ta) return tb - ta;          // newer first
      return (b.id ?? 0) - (a.id ?? 0);       // tie-breaker
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErr("");
        const [miscRes, merchRes] = await Promise.all([
          axios.get(`${API}/miscellaneous-items/`, authHeaders()),
          axios.get(`${API}/merchandisings/`, authHeaders()),
        ]);
        setItems(sortLatest(miscRes.data || []));
        setMerch(merchRes.data || []);
      } catch (e) {
        console.error(e);
        setErr("Failed to load expenses data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sortLatest]);

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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;

    try {
      setSaving(true);
      setFormErr("");

      // Build payload: OMIT 'merchandising' if empty to avoid null-validation errors
      const payload = {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
      };
      if (form.merchandising) {
        payload.merchandising = Number(form.merchandising);
      }

      const res = await axios.post(`${API}/miscellaneous-items/`, payload, authHeaders());

      // optimistic insert + keep sorted latest first
      setItems((prev) => sortLatest([res.data, ...prev]));
      setOpen(false);
      setForm({ merchandising: "", description: "", amount: "" });
    } catch (e) {
      console.error(e);
      const server = e?.response?.data;
      // Surface DRF validation details for fast debugging
      setFormErr(
        server
          ? typeof server === "string"
            ? server
            : JSON.stringify(server, null, 2)
          : "Failed to save expense."
      );
      alert("Failed to save expense.\n\n" + (server ? JSON.stringify(server) : e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header + Button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">All Expenses</h1>
        <button
          onClick={() => { setOpen(true); setFormErr(""); }}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          + Add Expense
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-500">{err}</div>}

      {!loading && !err && (
        <table className="w-full border border-gray-300 rounded-md overflow-hidden">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 border-b">Date &amp; Time</th>
              <th className="p-2 border-b">MSP No</th>
              <th className="p-2 border-b">Description</th>
              <th className="p-2 border-b text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-500">
                  No expenses found
                </td>
              </tr>
            )}
            {items.map((exp) => (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="p-2 border-b">
                  {dayjs(exp.created_at || exp.updated_at || exp.date).format("MMM DD, YYYY hh:mm A")}
                </td>
                <td className="p-2 border-b">{merchMap[exp.merchandising] || "—"}</td>
                <td className="p-2 border-b">{exp.description || "—"}</td>
                <td className="p-2 border-b text-right">{peso(exp.amount)}</td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan="3" className="p-2 border-t text-right">
                  Total
                </td>
                <td className="p-2 border-t text-right">{peso(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {/* -------- Modal -------- */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
          onClick={() => !saving && setOpen(false)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* dialog */}
          <div
            className="relative bg-white w-full max-w-lg rounded-lg shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Add Expense</h2>
              <button
                onClick={() => !saving && setOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Backend validation error (pretty-printed) */}
            {formErr && (
              <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2 whitespace-pre-wrap">
                {formErr}
              </pre>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Link to MSP (optional)
                </label>
                <select
                  name="merchandising"
                  value={form.merchandising}
                  onChange={onChange}
                  className="w-full border rounded-md p-2 text-sm"
                >
                  <option value="">— Select MSP —</option>
                  {merch.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.msp_no}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={onChange}
                  className="w-full border rounded-md p-2 text-sm"
                  placeholder="e.g., Toll fee, Parking, Snacks…"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  name="amount"
                  value={form.amount}
                  onChange={onChange}
                  className="w-full border rounded-md p-2 text-sm text-right"
                  placeholder="0.00"
                  inputMode="decimal"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Will be saved as {peso(form.amount || 0)}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && setOpen(false)}
                  className="px-4 py-2 rounded-md border text-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSave || saving}
                  className={`px-4 py-2 rounded-md text-white text-sm ${
                    canSave && !saving
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-300 cursor-not-allowed"
                  }`}
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
