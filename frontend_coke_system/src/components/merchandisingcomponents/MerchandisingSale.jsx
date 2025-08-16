<<<<<<< HEAD
// src/components/merchandisingcomponents/MerchandisingSale.jsx
import React, { useEffect, useState, useCallback } from "react";
=======
import React, { useEffect, useState, useCallback, useMemo } from "react";
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ProductTable from "./ProductTable";
import ExpensesSection from "./ExpensesSection"; // keep if you use it
import ActionButtons from "./ActionButtons";
import VanLoadTable from "./VanLoadTable";
import PaymentModal from "../PaymentModal";

// Convert a Date to a value usable by <input type="datetime-local"> in LOCAL time
const toDatetimeLocalValue = (date = new Date()) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
};
<<<<<<< HEAD

/** Build stock deductions from rows (in PCS). delta is NEGATIVE for deduction. */
const buildVanLoadStockAdjustments = (rows, products) => {
  const productMap = new Map((products || []).map(p => [Number(p.id), p]));
  const n = v => parseFloat(v) || 0;

  const items = [];
  for (const r of rows) {
    const pid = Number(r.productId);
    if (!pid) continue;

    const prod = productMap.get(pid);
    const conversion = n(prod?.unit_type?.content_no || r?.contentNo || 1);

    // Prefer explicit PCS; else derive from shell
    const pcs = Number.isFinite(n(r.dispatchedPcs)) && n(r.dispatchedPcs) > 0
      ? Math.round(n(r.dispatchedPcs))
      : Math.round(n(r.dispatchedShell) * conversion);

    if (pcs > 0) {
      items.push({ product_id: pid, delta: -pcs });
    }
  }
  return items;
};
=======
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26

const MerchandisingSale = () => {
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [totalExpectedSale, setTotalExpectedSale] = useState(0);
  const [totalActualSale, setTotalActualSale] = useState(0);
  const [emptiesPriceTotal, setEmptiesPriceTotal] = useState(0);
  const [refundablesTotal, setRefundablesTotal] = useState(0);
  const [discrepancy, setDiscrepancy] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [miscItems, setMiscItems] = useState([]);
  const [newDesc, setNewDesc] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const [activeTab, setActiveTab] = useState("Trading");
  const [editMode, setEditMode] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const [transactionDate, setTransactionDate] = useState(() => toDatetimeLocalValue());
  const [transactionType, setTransactionType] = useState("");
  const [selectedTransactionTypeName, setSelectedTransactionTypeName] = useState("");
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [mspNo, setMspNo] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  // ✅ keep the selection as a STRING to avoid type mismatches
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
<<<<<<< HEAD
  const [route, setRoute] = useState(""); // may be "" or number
=======

  const [route, setRoute] = useState("");
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  const [selectedVan, setSelectedVan] = useState("");
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [vans, setVans] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
<<<<<<< HEAD
  const [payments, setPayments] = useState([]);

  const location = useLocation();

  // helper: coerce a value to a positive numeric id or ""
  const asId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : "";
  };

=======
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null); // store invoice info
  const [payments, setPayments] = useState([]);

>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  useEffect(() => {
    if (location.state?.reset === true) {
      setRows([
        {
          id: 1,
          productId: "",
          priceId: null,
          dispatched: 0,
          sold: 0,
          expected_sale: 0,
          actual_sale: 0,
          discrepancy: 0,
        },
      ]);
      setSelectedUser(null);
      setSelectedCustomerId("");
      setRoute("");
      setSelectedVan("");
      setPayments([]);
    }
  }, [location.state]);

  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if (userData.role?.toLowerCase() === "admin") {
      return Array.isArray(selectedWarehouse?.id)
        ? selectedWarehouse.id[0]
        : selectedWarehouse?.id || userData.warehouse_id;
    }
    return userData.warehouse_id;
  };

  // Set currentWarehouse on mount
  useEffect(() => {
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const warehouseId = getCurrentWarehouse();

    if (warehouseId) {
      const name = selectedWarehouse?.name || user?.warehouse_name || "Warehouse";
      setCurrentWarehouse({ id: warehouseId, name });
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const warehouseId = getCurrentWarehouse();

      if (!warehouseId) {
        console.warn("No warehouse assigned to user");
        setProducts([]);
        return;
      }

      const res = await axios.get(
        `http://localhost:8080/api/products/?warehouse_id=${warehouseId}`
      );
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    const handleWarehouseChange = () => {
      fetchProducts();
    };
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => {
      window.removeEventListener("warehouseChanged", handleWarehouseChange);
    };
  }, [fetchProducts]);

<<<<<<< HEAD
  // Fetch users for dropdown
  const fetchUsers = useCallback(() => {
    if (!currentWarehouse?.id) {
      return;
    }
=======
  // ✅ Fetch users for current warehouse
  const fetchUsers = useCallback(() => {
    if (!currentWarehouse?.id) return;
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
    const config = {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    };
    axios
      .get("http://localhost:8080/api/users/", config)
      .then((res) => setUsers(res.data))
<<<<<<< HEAD
      .catch((err) => console.error("Error fetching users:", err));
  }, [currentWarehouse]);

  useEffect(() => {
    if (selectedTransactionTypeName === "Van Load") {
      axios
        .get("http://localhost:8080/api/vans/")
        .then((res) => setVans(res.data))
        .catch((err) => console.error("Failed to fetch vans:", err));
    }
  }, [transactionType, selectedTransactionTypeName]);

=======
      .catch((err) => console.error("❌ Error fetching users:", err));
  }, [currentWarehouse]);

>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  useEffect(() => {
    if (selectedTransactionTypeName === "Van Load") {
      axios
        .get("http://localhost:8080/api/vans/")
        .then((res) => setVans(res.data))
        .catch((err) => console.error("Failed to fetch vans:", err));
    }
  }, [transactionType, selectedTransactionTypeName]);

  useEffect(() => {
    if (currentWarehouse?.id) fetchUsers();
  }, [currentWarehouse, fetchUsers]);

  const [rows, setRows] = useState([
    {
      id: 1,
      productId: "",
      priceId: null,
      dispatched: 0,
      sold: 0,
      expected_sale: 0,
      actual_sale: 0,
      discrepancy: 0,
    },
  ]);

<<<<<<< HEAD
  // Fetch routes & customers scoped to current warehouse
=======
  // ✅ Only fetch routes and customers here (not users/products)
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  useEffect(() => {
    if (!currentWarehouse?.id) return;
    const warehouseId = currentWarehouse.id;

    axios
<<<<<<< HEAD
      .get("http://localhost:8080/api/routes/", { params: { warehouse: warehouseId } })
      .then((res) => setRoutes(res.data))
      .catch((err) => {
        console.error("Failed to fetch routes:", err);
        setRoutes([]);
      });

    axios
      .get("http://localhost:8080/api/customers/", { params: { warehouse: warehouseId } })
      .then((res) => setCustomers(res.data))
      .catch((err) => {
        console.error("Failed to fetch customers:", err);
        setCustomers([]);
      });
=======
      .get(`http://localhost:8080/api/routes/?warehouse=${warehouseId}`)
      .then((res) => setRoutes(res.data));
    axios
      .get(`http://localhost:8080/api/customers/?warehouse=${warehouseId}`)
      .then((res) => setCustomers(res.data));
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  }, [currentWarehouse]);

  // Transaction types
  useEffect(() => {
    axios
      .get("http://localhost:8080/api/transaction-types/")
      .then((res) => setTransactionTypes(res.data))
      .catch((err) => console.error("Failed to fetch transaction types:", err));
  }, []);

<<<<<<< HEAD
  // MSP preview
=======
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  useEffect(() => {
    const warehouseId = getCurrentWarehouse();
    if (!transactionType || !selectedTransactionTypeName || !warehouseId) return;

    axios
      .get("http://localhost:8080/api/merchandisings/msp-next/", {
<<<<<<< HEAD
        params: {
          transaction_type: transactionType,
          warehouse: warehouseId,
        },
      })
      .then((res) => {
        setMspNo(res.data.msp_no || "");
      })
=======
        params: { transaction_type: transactionType, warehouse: warehouseId },
      })
      .then((res) => setMspNo(res.data.msp_no || ""))
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
      .catch((err) => console.error("MSP preview error:", err));
  }, [transactionType, selectedTransactionTypeName, currentWarehouse?.id]);

  useEffect(() => {
    setTransactionDate(toDatetimeLocalValue(new Date()));
  }, []);

  const calculateTotalExpenses = () => {
    return miscItems.reduce((total, item) => total + parseFloat(item.amount || 0), 0);
  };

  const handleBack = () => {
    navigate("/merchandising-list");
  };

<<<<<<< HEAD
  const customer = customers.find((c) => String(c.id) === String(selectedCustomerId));
  const customerName = customer ? customer.name : "Walk-in";

  const handledByUser = users.find((u) => String(u.id) === String(selectedUser));
  const handledBy = handledByUser ? `${handledByUser.first_name} ${handledByUser.last_name}`.trim() : "";
=======
  // ✅ ROBUST customer name with fallback (handles type mismatch and blanks)
  const customerName = useMemo(() => {
    const idStr = String(selectedCustomerId || "");
    const hit = customers.find((c) => String(c.id) === idStr);
    const name = (hit?.name || "").trim();
    return name || "Walk-in";
  }, [customers, selectedCustomerId]);

  // handled by (display string; OK if left empty)
  const handledByUser = users.find((u) => String(u.id) === String(selectedUser));
  const handledBy = handledByUser
    ? `${handledByUser.first_name} ${handledByUser.last_name}`.trim()
    : "";
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26

  const handleSubmit = async (paymentData = null) => {
    const warehouseId = currentWarehouse?.id;
    const isVanLoad = (selectedTransactionTypeName || "").trim().toLowerCase() === "van load";
    if (!warehouseId) {
      alert("Warehouse is required.");
      return false;
    }
    if (isVanLoad) {
<<<<<<< HEAD
      if (!Number.isFinite(Number(route)) || Number(route) <= 0) {
        alert("Route is required for Van Load.");
        return false;
      }
      if (!Number.isFinite(Number(selectedVan)) || Number(selectedVan) <= 0) {
=======
      if (!route) {
        alert("Route is required for Van Load.");
        return false;
      }
      if (!selectedVan) {
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
        alert("Van is required for Van Load.");
        return false;
      }
    }

<<<<<<< HEAD
    // date handling
    let utcIso;
    if ((selectedTransactionTypeName || "").toLowerCase() === "warehouse") {
      utcIso = null; // backend decides
=======
    let utcIso;
    if ((selectedTransactionTypeName || "").toLowerCase() === "warehouse") {
      // Let backend set/override; skip sending date_time
      utcIso = null;
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
    } else {
      utcIso = new Date(transactionDate).toISOString();
    }

<<<<<<< HEAD
    // payments payload
=======
    // Build payments from the freshly-confirmed modal data if present
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
    const paymentsPayload = paymentData
      ? [
          {
            payment_method: paymentData.paymentMethod || "cash",
            amount: Number(paymentData.amount) || 0,
            change: Number(paymentData.change) || 0,
          },
        ]
      : (payments || []).map((p) => ({
          payment_method: p.paymentMethod || p.payment_method || p.method || "cash",
          amount: Number(p.amount || p.cashReceived || 0) || 0,
          change: Number(p.change || 0) || 0,
        }));

<<<<<<< HEAD
    const paymentMethodForHeader = (paymentsPayload[0] && paymentsPayload[0].payment_method) || "cash";

    // helper: non-negative int
=======
    const paymentMethodForHeader =
      (paymentsPayload[0] && paymentsPayload[0].payment_method) || "cash";

    // helper to avoid negatives if your serializer forbids them
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
    const nz = (v) => Math.max(0, parseInt(v) || 0);

    const payload = {
      msp_no: mspNo,
      warehouse: Number(warehouseId),
<<<<<<< HEAD
      transaction_type: parseInt(transactionType),
=======
      transaction_type: parseInt(transactionType, 10),
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
      route: isVanLoad ? Number(route) : null,
      van: isVanLoad ? Number(selectedVan) : null,

      handled_by: handledBy || "",
      ...(utcIso ? { date_time: utcIso } : {}),

      expected_sale: Number(totalExpectedSale) || 0,
      actual_sale: Number(totalActualSale) || 0,
      miscellaneous: Number(calculateTotalExpenses()) || 0,

<<<<<<< HEAD
=======
      // make sure this isn't blank when status is Complete
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
      payment_method: paymentMethodForHeader,

      invoice_no: "",
      status: selectedTransactionTypeName === "Van Load" ? "Pending" : "Complete",
      remarks: "",

      items: rows
        .filter((r) => r.productId)
        .map((row) => {
          const base = {
            product: Number(row.productId),
            dispatched_pcs: nz(row.dispatchedPcs),
            dispatched_shell: nz(row.dispatchedShell),
<<<<<<< HEAD

            // non-empty (full) returns
            actual_return_pcs: nz(row.expectedReturnPcsNonempty),
            actual_return_shell: nz(row.expectedReturnShellNonempty),

            // empty returns (discrepancy buckets)
            discrepancy_empties_pc: nz(row.discrepancyPcsEmpty),
            discrepancy_empties_shell: nz(row.discrepancyShellEmpty),

            // full discrepancies
=======
            actual_return_pcs: nz(row.expectedReturnPcsNonempty),
            actual_return_shell: nz(row.expectedReturnShellNonempty),
            discrepancy_empties_pc: nz(row.discrepancyPcsEmpty),
            discrepancy_empties_shell: nz(row.discrepancyShellEmpty),

            // clamp potential negatives
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
            discrepancy_full_pcs: nz(row.discrepancyPcsNonempty),
            discrepancy_full_shell: nz(row.discrepancyShellNonempty),

            discount_percent: Number(row.discount) || 0,
            expected_sale: Number(row.expectedSale) || 0,
            actual_sale: Number(row.actualSale) || 0,
          };
<<<<<<< HEAD

=======
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
          if (!isVanLoad) {
            base.sold_pcs = nz(row.soldPcs);
            base.sold_shell = nz(row.soldShell);
            base.empty_return_pcs = nz(row.expectedReturnPcsEmpty);
<<<<<<< HEAD
            base.empty_return_shell = nz(row.expectedReturnShellEmpty);
          }

          return base;
        }),

=======
          }
          return base;
        }),

      // omit file blobs in JSON
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
      misc_items: (miscItems || []).map((item) => ({
        description: item.description,
        amount: Number(item.amount) || 0,
      })),

      payments: paymentsPayload,
    };

<<<<<<< HEAD
    try {
      // 1) Save merchandising record
      const txRes = await axios.post("http://localhost:8080/api/merchandisings/", payload);

      // 2) If Van Load → deduct dispatched from stocks in one atomic call
      if (isVanLoad) {
        const adjustments = buildVanLoadStockAdjustments(rows, products);
        if (adjustments.length) {
          await axios.post("http://localhost:8080/api/stocks/bulk-adjust/", {
            warehouse: Number(warehouseId),
            items: adjustments, // [{ product_id, delta: -PCS }]
            reason: "van_load_dispatch",
            reference: txRes?.data?.msp_no || "",
          });

          // Notify tables to refresh "Available" instantly
          window.dispatchEvent(new Event("stocksChanged"));
        }
      }

      alert("Transaction saved successfully!");
      return true;
    } catch (error) {
      console.error("Save error:", error?.response?.data || error.message);
      alert(error?.response?.data?.detail || "Failed to save transaction.");
=======
    console.log("Submitting payload:", payload);

    try {
      await axios.post("http://localhost:8080/api/merchandisings/", payload);
      alert("Transaction saved successfully!");
      return true;
    } catch (error) {
      console.error("Save error:", error.response?.data || error.message);
      alert("Failed to save transaction.");
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
      return false;
    }
  };

  const handleFinalizeSale = async () => {
    const success = await handleSubmit();
    if (success) {
      navigate("/trading");
    }
<<<<<<< HEAD
  };

  const handlePay = () => {
    setIsPaymentModalOpen(true);
  };

  const handleClosePayment = () => {
    setIsPaymentModalOpen(false);
  };

=======
  };

  const handlePay = () => setIsPaymentModalOpen(true);
  const handleClosePayment = () => setIsPaymentModalOpen(false);

  // Parent receives payment from PaymentModal and stores it
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
  const handleConfirmPayment = (paymentData) => {
    setPayments((prev) => [...prev, paymentData]);
  };

  return (
    <div className="bg-sky-300 min-h-screen p-3 text-black">
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">
          {editMode ? "View/Edit Merchandising Sale" : "New Merchandising Sale"}
        </h1>

<<<<<<< HEAD
        {/* Header form */}
=======
        {/* Original form layout block */}
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
        <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
          {/* LEFT */}
          <div className="flex flex-col space-y-4 w-full md:w-1/2">
            <div>
              <label className="text-sm">MSP No.</label>
              <input
                type="text"
                value={mspNo}
                onChange={(e) => setMspNo(e.target.value)}
                className="w-full rounded-md px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="text-sm">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const selected = transactionTypes.find((tt) => String(tt.id) === selectedId);
                  setTransactionType(selectedId);
                  setSelectedTransactionTypeName(selected?.name || "");
                }}
                className="w-full rounded-md px-2 py-1 text-sm"
              >
                <option value="">-- Select Transaction Type --</option>
                {transactionTypes.map((type) => (
                  <option key={type.id} value={String(type.id)}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Handled By</label>
              <select
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-md px-2 py-1 text-sm"
              >
                <option value="">-- Select Handler --</option>
                {users.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
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

            {/* Warehouse: Customer field + add */}
            {selectedTransactionTypeName === "Warehouse" && (
              <div>
                <label className="text-sm mb-1 block">Customer</label>
                {isAddingCustomer ? (
                  <input
                    type="text"
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                    placeholder="Enter new customer"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const newCustomer = e.target.value.trim();
                        if (!newCustomer) return;

                        const exists = customers.some(
                          (c) => (c.name || "").toLowerCase() === newCustomer.toLowerCase()
                        );
                        if (exists) {
                          alert(`Customer "${newCustomer}" already exists.`);
                          setIsAddingCustomer(false);
                          return;
                        }

                        try {
                          const res = await axios.post("http://localhost:8080/api/customers/", {
                            name: newCustomer,
                            warehouse: currentWarehouse?.id,
                          });
                          setCustomers((prev) => [...prev, res.data]);
                          setSelectedCustomerId(String(res.data.id)); // ✅ keep as string
                        } catch (error) {
                          console.error("Error saving new customer:", error);
                        }
                        setIsAddingCustomer(false);
                      }
                    }}
                  />
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      if (e.target.value === "add_new") {
                        setIsAddingCustomer(true);
                        setSelectedCustomerId("");
                      } else {
                        setSelectedCustomerId(e.target.value); // ✅ keep as string
                      }
                    }}
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                  >
                    <option value="" disabled hidden>
                      Select a customer
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                    <option value="add_new">+ Add a customer</option>
                  </select>
                )}
              </div>
            )}

            {/* Van Load: Van + Route */}
            {selectedTransactionTypeName === "Van Load" && (
              <>
                <div>
                  <label className="text-sm mb-1 block">Van</label>
                  <select
                    value={selectedVan}
                    onChange={(e) => setSelectedVan(e.target.value)}
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                  >
                    <option value="" disabled hidden>
                      Select
                    </option>
                    {vans.map((van) => (
                      <option key={van.id} value={String(van.id)}>
                        {van.van_id} - {van.plate_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm mb-1 block">Route</label>
                  {isAddingRoute ? (
                    <input
                      type="text"
                      className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                      placeholder="Enter new route"
                      value={typeof route === "string" ? route : ""}
                      onChange={(e) => setRoute(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
<<<<<<< HEAD
                          const newRouteName = String(route || "").trim();
                          if (!newRouteName) return;

                          const existing = routes.find(
                            (r) => (r.route_name || "").toLowerCase() === newRouteName.toLowerCase()
                          );
                          if (existing) {
                            alert(`Route "${newRouteName}" already exists. Selected it for you.`);
                            setRoute(existing.id);
=======
                          const newRouteName = (route || "").trim();
                          if (!newRouteName) return;

                          // Check if the route already exists
                          const existing = routes.find(
                            (r) =>
                              (r.route_name || "").toLowerCase() === newRouteName.toLowerCase()
                          );
                          if (existing) {
                            alert(
                              `Route "${newRouteName}" already exists. Selected it for you.`
                            );
                            setRoute(existing.id); // ✅ existing route's ID
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
                            setIsAddingRoute(false);
                            return;
                          }

<<<<<<< HEAD
                          try {
                            // include warehouse so backend attaches correctly
                            const res = await axios.post("http://localhost:8080/api/routes/", {
                              route_name: newRouteName,
                              warehouse: currentWarehouse?.id,
                            });

                            const newRoute = res.data;
                            setRoutes((prev) => [...prev, newRoute]);
                            setRoute(newRoute.id);
=======
                          // Add new route
                          try {
                            const res = await axios.post(
                              "http://localhost:8080/api/routes/",
                              { route_name: newRouteName }
                            );

                            const newR = res.data;
                            setRoutes((prev) => [...prev, newR]);
                            setRoute(newR.id); // ✅ new route ID
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
                          } catch (error) {
                            console.error("Error saving new route:", error);
                          }

                          setIsAddingRoute(false);
                        }
                      }}
                    />
                  ) : (
                    <select
<<<<<<< HEAD
                      value={route === "" ? "" : Number(route)}
=======
                      value={route}
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
                      onChange={(e) => {
                        if (e.target.value === "add_new") {
                          setIsAddingRoute(true);
                          setRoute("");
                        } else {
<<<<<<< HEAD
                          setRoute(asId(e.target.value)); // numeric id or ""
=======
                          setRoute(parseInt(e.target.value, 10)); // ensure number
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
                        }
                      }}
                      className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                    >
                      <option value="" disabled hidden>
                        Select a route
                      </option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.route_name}
                        </option>
                      ))}
                      <option value="add_new">+ Add a new route</option>
                    </select>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedTransactionTypeName === "Van Load" ? (
        <VanLoadTable
          rows={rows}
          setRows={setRows}
          products={products}
<<<<<<< HEAD
          warehouseId={currentWarehouse?.id} // pass just the ID
=======
          warehouseId={currentWarehouse}
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
          setTotalExpectedSale={setTotalExpectedSale}
        />
      ) : (
        <ProductTable
          rows={rows}
          setRows={setRows}
          products={products}
          selectedTransactionTypeName={selectedTransactionTypeName}
          miscItems={miscItems}
          warehouseId={currentWarehouse?.id}
          setTotalExpectedSale={setTotalExpectedSale}
          setTotalActualSale={setTotalActualSale}
          setEmptiesPriceTotal={setEmptiesPriceTotal}
          setRefundablesTotal={setRefundablesTotal}
          setDiscrepancy={setDiscrepancy}
          setTotalAmount={setTotalAmount}
          totalAmount={totalAmount}
          emptiesPriceTotal={emptiesPriceTotal}
          refundablesTotal={refundablesTotal}
          discrepancy={discrepancy}
          totalExpectedSale={totalExpectedSale}
          totalActualSale={totalActualSale}
        />
      )}

      <ActionButtons
        transactionType={selectedTransactionTypeName}
        onBack={() => navigate(-1)}
        onFinalize={handleFinalizeSale}
        onPay={handlePay}
      />

      <PaymentModal
        open={isPaymentModalOpen}
        onClose={handleClosePayment}
<<<<<<< HEAD
        onConfirm={handleConfirmPayment}
        rows={rows}
        products={products}
=======
        onConfirm={(paymentData) => setPayments((prev) => [...prev, paymentData])}
        rows={rows} // sold items
        products={products} // optional
>>>>>>> 182b5a2cbcc44c5c39d2b605a5ec4b8961d0dd26
        amountDue={totalAmount}
        actualSales={totalActualSale}
        emptyReturns={refundablesTotal}
        emptiesPriceTotal={emptiesPriceTotal}
        emptyDiscrepancies={discrepancy}
        mspNo={mspNo}
        customerName={customerName}  // ✅ always the real name OR "Walk-in"
        handledBy={handledBy}
        totalAmount={totalAmount}
        onSave={handleSubmit}
        transactionDate={transactionDate}
        transactionTypeName={selectedTransactionTypeName}
      />
    </div>
  );
};

export default MerchandisingSale;
