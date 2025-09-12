import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "axios";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8080/api";

// Reuse one axios instance with optional auth token
const createApi = () => {
  const token = localStorage.getItem("token");
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Token ${token}` } : undefined,
  });
};
const api = createApi();

/* ---------- Helpers (defined BEFORE use) ---------- */
function loadUserFromStorage() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCurrentWarehouse() {
  const u = loadUserFromStorage();
  if (!u) return null;
  if (u?.warehouse?.id) return u.warehouse;           // { id, name, ... }
  if (u?.warehouse_id) return { id: u.warehouse_id }; // fallback shape
  return null;
}

const Expenses = forwardRef(({ miscItems = [], setMiscItems }, ref) => {
  // ==== Header fields ====
  const [mspNo, setMspNo] = useState("");
  const [handledBy, setHandledBy] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;
  });

  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // derive current warehouse AFTER helpers are available
  const currentWarehouse = useMemo(() => getCurrentWarehouse(), []);

  // ==== Items state (existing logic) ====
  const [newDesc, setNewDesc] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const descRef = useRef(null);
  const amtRef = useRef(null);

  const isValidAmount = (val) => {
    if (val === "" || val === null || val === undefined) return false;
    const n = Number(val);
    return Number.isFinite(n) && n >= 0;
  };

  const showAlert = (msg) => window.alert(msg);

  const total = useMemo(
    () =>
      miscItems.reduce((sum, item) => {
        const n = Number(item.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [miscItems]
  );

  const handleAdd = () => {
    if (!newDesc.trim() || !isValidAmount(newAmt)) {
      if (!newDesc.trim()) descRef.current?.focus();
      else amtRef.current?.focus();
      return;
    }
    const clean = { description: newDesc.trim(), amount: Number(newAmt).toFixed(2) };
    setMiscItems([...(miscItems || []), clean]);
    setNewDesc("");
    setNewAmt("");
    descRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const updateItem = (index, field, value) => {
    const next = [...miscItems];
    if (field === "amount") {
      if (value === "") next[index][field] = "";
      else next[index][field] = Math.max(0, Number(value)).toString();
    } else {
      next[index][field] = value;
    }
    setMiscItems(next);
  };

  const removeItem = (index) => {
    const next = miscItems.filter((_, i) => i !== index);
    setMiscItems(next);
  };

  const formatPreview = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? peso.format(n) : "₱0.00";
  };

  // ---- API fetchers ----
  const fetchCustomers = async () => {
    const { data } = await api.get(`/customers/`);
    return Array.isArray(data) ? data : [];
  };

  // Only from latest WAREHOUSE transaction (optionally scoped by current warehouse)
  const fetchLatestWarehouseMspNo = async () => {
    const { data } = await api.get(`/merchandising/`, {
      params: {
        transaction_type: "WAREHOUSE",
        ordering: "-date_time",
        limit: 1,
        ...(currentWarehouse?.id ? { warehouse_id: currentWarehouse.id } : {}),
      },
    });
    if (Array.isArray(data) && data.length > 0 && data[0]?.msp_no) {
      return data[0].msp_no;
    }
    return "";
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // MSP No (warehouse only)
        const msp = await fetchLatestWarehouseMspNo();

        // Current user (handled by)
        const storedUser = loadUserFromStorage();
        const handled =
          storedUser?.full_name || storedUser?.username || storedUser?.name || "";

        // Customers
        const custs = await fetchCustomers();

        if (!mounted) return;
        setMspNo(msp);
        setHandledBy(handled);
        setCustomers(custs);
      } catch (e) {
        console.error("Failed to init expenses data:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Expose data to parent (ExpensesList) ---------- */
  useImperativeHandle(ref, () => ({
    getPayload: () => ({
      msp_no: mspNo,
      handled_by: handledBy,
      date_time: transactionDate,
      customer: customerId || null, 
      customer_name:
      customers.find((c) => String(c.id) === String(customerId))?.name ||
      customers.find((c) => String(c.id) === String(customerId))?.customer_name ||
      (customerId ? `Customer #${customerId}` : "Walk-in Customer"),
      items: miscItems,                   
      total,                            
      warehouse: currentWarehouse?.id || null,
    }),
  }));

  return (
    <div className="w-full p-4 rounded-md shadow mt-5">
      {/* Header / Meta */}
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
        {/* LEFT */}
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="text-sm">MSP No.</label>
            <input
              type="text"
              value={mspNo}
              className="border w-full rounded-md px-2 py-1 text-sm bg-gray-100"
              readOnly
            />
          </div>

          <div>
            <label className="text-sm">Handled By</label>
            <input
              type="text"
              value={handledBy || ""}
              readOnly
              className="border w-full rounded-md px-2 py-1 text-sm bg-gray-100"
              placeholder="Current user"
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="text-sm">Date/Time</label>
            <input
              type="datetime-local"
              className="w-full rounded-md px-2 py-1 text-sm"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm mb-1 block">Customer</label>
            {isAddingCustomer ? (
              <input
                type="text"
                className="border w-full rounded-md px-2 py-1 text-black text-base"
                placeholder="Enter new customer name"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const newCustomer = e.target.value.trim();
                    if (!newCustomer) return;

                    // prevent duplicates (case-insensitive)
                    const exists = customers.some(
                      (c) =>
                        (c.name || c.customer_name || "").toLowerCase() ===
                        newCustomer.toLowerCase()
                    );
                    if (exists) {
                      showAlert(`Customer "${newCustomer}" already exists.`);
                      setIsAddingCustomer(false);
                      return;
                    }

                    try {
                      // use shared axios instance
                      const res = await api.post(`/customers/`, {
                        name: newCustomer,
                        warehouse: currentWarehouse?.id || null,
                      });
                      setCustomers((prev) => [...prev, res.data]);
                      setCustomerId(res.data.id);
                    } catch (error) {
                      console.error("❌ Error saving new customer:", error);
                      showAlert("Failed to save customer. Please try again.");
                    }
                    setIsAddingCustomer(false);
                  }
                  if (e.key === "Escape") {
                    setIsAddingCustomer(false);
                  }
                }}
                onBlur={() => setIsAddingCustomer(false)}
                autoFocus
              />
            ) : (
              <select
                value={customerId}
                onChange={(e) => {
                  if (e.target.value === "add_new") {
                    setIsAddingCustomer(true);
                    setCustomerId("");
                  } else {
                    setCustomerId(e.target.value);
                  }
                }}
                className="border w-full rounded-md px-2 py-1 text-black text-base"
                disabled={loading}
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.customer_name || `Customer #${c.id}`}
                  </option>
                ))}
                <option value="add_new">+ New Customer</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base md:text-lg font-semibold text-gray-700">Expenses</h2>
      </div>

      <div className="rounded border bg-white border-gray-200 overflow-hidden">
        <div className="max-h-[48vh] overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2 text-center w-14">No.</th>
                <th className="border-b border-gray-200 px-3 py-2">Description</th>
                <th className="border-b border-gray-200 px-3 py-2 text-right w-44">Amount (₱)</th>
                <th className="border-b border-gray-200 px-3 py-2 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {miscItems.map((item, index) => (
                <tr key={index} className="even:bg-white odd:bg-gray-50 hover:bg-gray-100/60">
                  <td className="px-3 py-2 text-center align-middle">{index + 1}</td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Fuel, Parking, Snack"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.amount}
                      onChange={(e) => updateItem(index, "amount", e.target.value)}
                      onBlur={(e) =>
                        updateItem(
                          index,
                          "amount",
                          isValidAmount(e.target.value) ? Number(e.target.value).toFixed(2) : "0.00"
                        )
                      }
                      className="w-full text-right px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                      aria-label={`Remove expense row ${index + 1}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {/* Draft Row */}
              <tr className="bg-white">
                <td className="px-3 py-2 text-center align-middle">+</td>
                <td className="px-3 py-2 align-middle">
                  <input
                    ref={descRef}
                    type="text"
                    placeholder="New description"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 text-right align-middle">
                  <input
                    ref={amtRef}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newAmt}
                    onChange={(e) => setNewAmt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={(e) => {
                      if (e.target.value !== "" && !isValidAmount(e.target.value)) {
                        setNewAmt("0.00");
                      }
                    }}
                    className="w-full text-right px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {newAmt !== "" && (
                    <div className="mt-1 text-xs text-gray-500">
                      Preview: <span className="font-medium">{formatPreview(newAmt)}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center align-middle">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!newDesc.trim() || !isValidAmount(newAmt)}
                    className={`px-3 py-1 rounded font-medium transition ${
                      !newDesc.trim() || !isValidAmount(newAmt)
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                    aria-label="Add expense"
                    title="Add expense"
                  >
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer total */}
        <div className="flex items-center justify-end gap-3 px-3 py-2 bg-gray-50 border-t border-gray-200">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-lg font-semibold">{peso.format(total)}</span>
        </div>
      </div>

      <p className="mt-2 text-xs text-blue-700">
        Tip: Press <span className="font-semibold">Enter</span> to add the expense when both fields
        are filled.
      </p>
    </div>
  );
});

export default Expenses;
