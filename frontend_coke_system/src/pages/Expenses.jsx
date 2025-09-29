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

  const [warehouseMSP, setWarehouseMSP] = useState(null);

  // modal states
  const [openAddModal, setOpenAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ merchandising: "", description: "", amount: "" });
  const [formErr, setFormErr] = useState("");

  // NEW: view modal state
  const [selectedGroup, setSelectedGroup] = useState(null);

  const sortLatest = useCallback((arr) => {
    return [...(arr || [])].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
      if (tb !== ta) return tb - ta; // newer first
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, []);


  useEffect(() => {
    const fetchWarehouseMSP = async () => {
      try {
        const res = await axios.get(`${API}/merchandisings/?transaction_type=Warehouse`, authHeaders());
        if (res.data && res.data.length > 0) {
          const latest = [...res.data].sort((a, b) => {
            const ta = new Date(a.created_at || 0).getTime();
            const tb = new Date(b.created_at || 0).getTime();
            return tb - ta;
          })[0];
          setWarehouseMSP(latest);
        }
      } catch (e) {
        console.error("Failed to fetch Warehouse MSP:", e);
      }
    };
    fetchWarehouseMSP();
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


  // latest merchandising (by created_at or id)
  const latestMerch = useMemo(() => {
    if (!merch || merch.length === 0) return null;
    const sorted = [...merch].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    return sorted[0]; // newest merchandising
  }, [merch]);




  // merch id → msp_no map
  const merchMap = useMemo(() => {
    const map = {};
    merch.forEach((m) => (map[m.id] = m.msp_no));
    return map;
  }, [merch]);

  // group items by msp_no
  const groupedExpenses = useMemo(() => {
    const groups = {};
    items.forEach((exp) => {
      const mspNo = merchMap[exp.merchandising] || "—";
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
    () => groupedExpenses.reduce((sum, g) => sum + g.totalAmount, 0),
    [groupedExpenses]
  );

  // form handlers
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
    if (!openAddModal) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) setOpenAddModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAddModal, saving]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;

    try {
      setSaving(true);
      setFormErr("");
      const payload = {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        merchandising: warehouseMSP?.id, // always latest MSP
      };
      if (form.merchandising) payload.merchandising = Number(form.merchandising);

      const res = await axios.post(`${API}/miscellaneous-items/`, payload, authHeaders());
      setItems((prev) => sortLatest([res.data, ...prev]));
      setOpenAddModal(false);
      setForm({ merchandising: "", description: "", amount: "" });
    } catch (e) {
      console.error(e);
      const server = e?.response?.data;
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">All Expenses</h1>
        <button
          onClick={() => {
            setOpenAddModal(true);
            setFormErr("");
            setForm({
              merchandising: warehouseMSP?.id || "", // link to warehouse MSP
              description: "",
              amount: "",
            });
          }}
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
              <th className="p-2 border-b">MSP No</th>
              <th className="p-2 border-b">Items Count</th>
              <th className="p-2 border-b">Date</th>
              <th className="p-2 border-b text-right">Total Amount</th>
              <th className="p-2 border-b text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {groupedExpenses.length === 0 && (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">
                  No expenses found
                </td>
              </tr>
            )}
            {groupedExpenses.map((group) => (
              <tr key={group.mspNo} className="hover:bg-gray-50">
                <td className="p-2 border-b">{group.mspNo}</td>
                <td className="p-2 border-b">{group.itemCount} {group.itemCount > 1 ? "items" : "item"}</td>
                <td className="p-2 border-b">{dayjs(group.date).format("MMM DD, YYYY hh:mm A")}</td>
                <td className="p-2 border-b text-right">{peso(group.totalAmount)}</td>
                <td className="p-2 border-b text-center">
                  <button
                    onClick={() => setSelectedGroup(group)}
                    className="px-3 py-1 text-sm rounded-md border hover:bg-gray-100"
                  >
                    👁 View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {groupedExpenses.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan="3" className="p-2 border-t text-right">
                  Grand Total:
                </td>
                <td colSpan="2" className="p-2 border-t text-right text-blue-600">
                  {peso(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {/* -------- Add Expense Modal -------- */}
      {openAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
          onClick={() => !saving && setOpenAddModal(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-lg rounded-lg shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Add Expense</h2>
              <button
                onClick={() => !saving && setOpenAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {formErr && (
              <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2 whitespace-pre-wrap">
                {formErr}
              </pre>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Warehouse MSP (auto)</label>
                <input
                  type="text"
                  value={warehouseMSP?.msp_no || "—"}
                  className="w-full border rounded-md p-2 text-sm bg-gray-100 cursor-not-allowed"
                  readOnly
                />
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
                  onClick={() => !saving && setOpenAddModal(false)}
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

      {/* -------- View Expenses Modal -------- */}
      {selectedGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
          onClick={() => setSelectedGroup(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">
                Expenses for MSP {selectedGroup.mspNo}
              </h2>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <table className="w-full border border-gray-300 rounded-md overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border-b">Date & Time</th>
                  <th className="p-2 border-b">Description</th>
                  <th className="p-2 border-b text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedGroup.expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="p-2 border-b">
                      {dayjs(exp.created_at || exp.updated_at || exp.date).format("MMM DD, YYYY hh:mm A")}
                    </td>
                    <td className="p-2 border-b">{exp.description}</td>
                    <td className="p-2 border-b text-right">{peso(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan="2" className="p-2 border-t text-right">
                    Total for MSP {selectedGroup.mspNo}:
                  </td>
                  <td className="p-2 border-t text-right">
                    {peso(selectedGroup.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}