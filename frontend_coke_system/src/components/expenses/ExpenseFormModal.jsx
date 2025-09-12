import React, { useEffect, useState } from "react";
import axios from "axios";

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const onlyNumeric = (v) => v.replace(/[^\d.]/g, "");

export default function ExpenseFormModal({ categories, editing, onClose, onSaved, apiBase }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "",
    description: "",
    receipt: null, // File
  });
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (editing) {
      setForm({
        date: (editing.date || editing.created_at || new Date().toISOString()).slice(0, 10),
        amount: String(editing.amount ?? ""),
        category: editing.category || "",
        description: editing.description || "",
        receipt: null,
      });
      setPreview(editing.receipt_url || "");
    }
  }, [editing]);

  const onFile = (f) => {
    setForm((s) => ({ ...s, receipt: f }));
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(String(e.target?.result || ""));
      reader.readAsDataURL(f);
    } else {
      setPreview("");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }
    if (!form.category) {
      alert("Please select a category.");
      return;
    }

    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("date", form.date);
      fd.append("amount", form.amount);
      fd.append("category", form.category);
      fd.append("description", form.description || "");
      if (form.receipt) fd.append("receipt", form.receipt); // map to your backend field

      const url = isEdit ? `${apiBase}/expenses/${editing.id}/` : `${apiBase}/expenses/`;
      const method = isEdit ? "patch" : "post";

      await axios[method](url, fd, {
        ...authHeaders(),
        headers: { ...authHeaders().headers, "Content-Type": "multipart/form-data" },
      });

      onSaved();
    } catch (err) {
      console.error(err);
      alert("Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? "Edit Expense" : "Add Expense"}</h3>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="grid">
            <div className="group">
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                required
              />
            </div>

            <div className="group">
              <label>Amount</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: onlyNumeric(e.target.value) }))}
                required
              />
            </div>

            <div className="group">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                required
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="group col-span-2">
              <label>Description</label>
              <textarea
                rows={3}
                placeholder="Optional notes…"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>

            <div className="group col-span-2">
              <label>Receipt (image)</label>
              <div className="upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
                {preview && <img className="preview" src={preview} alt="preview" />}
                {preview && (
                  <button type="button" className="btn sm" onClick={() => onFile(null)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
