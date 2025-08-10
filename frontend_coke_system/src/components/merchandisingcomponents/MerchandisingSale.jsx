import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ProductTable from "./ProductTable";
import ExpensesSection from "./ExpensesSection";
import ActionButtons from "./ActionButtons";
import VanLoadTable from "./VanLoadTable"; 
import PaymentModal from "../PaymentModal";
import InvoiceModal from "../InvoiceModal";


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
  const [transactionDate, setTransactionDate] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [selectedTransactionTypeName, setSelectedTransactionTypeName] = useState("");
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [mspNo, setMspNo] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [route, setRoute] = useState("");
  const [selectedVan, setSelectedVan] = useState("");
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRoute, setNewRoute] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [vans, setVans] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null); // store invoice info
  
  const [payments, setPayments] = useState([]);
 




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

  // ✅ Set currentWarehouse on mount
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

      const res = await axios.get(`http://localhost:8080/api/products/?warehouse_id=${warehouseId}`);
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
    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [fetchProducts]);

  // ✅ Fixed fetchUsers with axios config and correct dependencies
  const fetchUsers = useCallback(() => {
    if (!currentWarehouse?.id) {
      console.log("❌ Skipping users fetch - no warehouse ID");
      return;
    }

    console.log(`🔄 Fetching users for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);

    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    };

    axios.get("http://localhost:8080/api/users/", config)
      .then((res) => {
        console.log(`✅ Loaded ${res.data.length} users`);
        setUsers(res.data);
      })
      .catch((err) => console.error("❌ Error fetching users:", err));
  }, [currentWarehouse]);

    useEffect(() => {
  if (selectedTransactionTypeName === "Van Load") {
    axios.get("http://localhost:8080/api/vans/")
      .then(res => setVans(res.data))
      .catch(err => console.error("Failed to fetch vans:", err));
  }
}, [transactionType])

  // ✅ Fetch users when currentWarehouse is set
  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchUsers();
    }
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




  // ✅ Only fetch routes and customers here (not users/products)
  useEffect(() => {
    if (!currentWarehouse?.id) return;

    const warehouseId = currentWarehouse.id;

    axios.get(`http://localhost:8080/api/routes/?warehouse=${warehouseId}`).then(res => setRoutes(res.data));
    axios.get(`http://localhost:8080/api/customers/?warehouse=${warehouseId}`).then(res => setCustomers(res.data));
  }, [currentWarehouse]);

  useEffect(() => {
    axios.get("http://localhost:8080/api/transaction-types/")
      .then(res => {
        console.log("Transaction Types:", res.data);
        setTransactionTypes(res.data);
      })
      .catch(err => console.error("Failed to fetch transaction types:", err));
  }, []);

  useEffect(() => {
    if (transactionType && selectedTransactionTypeName) {
      axios.get("http://localhost:8080/api/merchandisings/msp-next/", {
        params: { transaction_type: transactionType }
      }).then(res => {
        console.log("✅ MSP Prefix check:", selectedTransactionTypeName, res.data.msp_no);
        setMspNo(res.data.msp_no);
      });
    }
  }, [transactionType, selectedTransactionTypeName]);

  const [dateTime, setDateTime] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });

    useEffect(() => {
    const now = new Date();
    const formatted = now.toISOString().slice(0, 16); // Format: "YYYY-MM-DDTHH:MM"
    setTransactionDate(formatted);
  }, []);

  const calculateTotalExpenses = () => {
    return miscItems.reduce((total, item) => total + parseFloat(item.amount || 0), 0);
  };

  const handleBack = () => {
    navigate("/merchandising-list");
  };


  const customer = customers.find((c) => c.id === selectedCustomerId);
  const customerName = customer ? customer.name : "Walk-in";

  const handledByUser = users.find((user) => user.id === selectedUser);
  const handledBy = handledByUser ? handledByUser.name : "";




const handleSubmit = async () => {
  const isVanLoad = parseInt(transactionType) === 1;
  const warehouseId = currentWarehouse?.id;

  // ✅ VALIDATION BEFORE SUBMIT
  if (!warehouseId) {
    alert("Warehouse is required.");
    return false;
  }

  if (isVanLoad) {
    if (!route) {
      alert("Route is required for Van Load.");
      return false;
    }
    if (!selectedVan) {
      alert("Van is required for Van Load.");
      return false;
    }
  }

  const payload = {
    msp_no: mspNo,
    warehouse: Number(warehouseId) || null,
    transaction_type: parseInt(transactionType),
    route: route ? parseInt(route) : null,
    van: selectedVan ? parseInt(selectedVan) : null,
    handled_by: parseInt(selectedUser),
    date_time: new Date().toISOString(),
    expected_sale: parseFloat(totalExpectedSale) || 0,
    actual_sale: parseFloat(totalActualSale) || 0,
    miscellaneous: calculateTotalExpenses(),
    payment_method: "",
    invoice_no: "",
    status: isVanLoad ? "Pending" : "Complete",
    remarks: "",
    total_trading_amount: parseFloat(totalAmount) || 0,
    total_expenses_amount: calculateTotalExpenses(),
    items: rows
      .filter((r) =>
        isVanLoad
          ? r.productId && !isNaN(parseFloat(r.expectedSale))
          : r.productId
      )
      .map((row) => {
        const item = {
          product: row.productId ? parseInt(row.productId) : null,
          dispatched_pcs: parseInt(row.dispatchedPcs) || 0,
          dispatched_shell: parseInt(row.dispatchedShell) || 0,
          actual_return_pcs: parseInt(row.expectedReturnPcsNonempty) || 0,
          actual_return_shell: parseInt(row.expectedReturnShellNonempty) || 0,
          discrepancy_empties_pc: parseInt(row.discrepancyPcsEmpty) || 0,
          discrepancy_empties_shell: parseInt(row.discrepancyShellEmpty) || 0,
          discrepancy_full_pcs: parseInt(row.discrepancyPcsNonempty) || 0,
          discrepancy_full_shell: parseInt(row.discrepancyShellNonempty) || 0,
          discount_percent: parseFloat(row.discount) || 0,
          expected_sale: parseFloat(row.expectedSale) || 0,
          actual_sale: parseFloat(row.actualSale) || 0,
        };

        if (!isVanLoad) {
          item.sold_pcs = parseInt(row.soldPcs) || 0;
          item.sold_shell = parseInt(row.soldShell) || 0;
          item.empty_return_pcs = parseInt(row.expectedReturnPcsEmpty) || 0;
        }

        return item;
      }),
    misc_items: miscItems.map((item) => ({
      description: item.description,
      amount: parseFloat(item.amount) || 0,
      // DO NOT include actual File objects in JSON. See note below.
      receipt_file: item.file ?? null,
    })),

    // include payments created/confirmed by PaymentModal and stored in parent
    payments: payments.map((p) => ({
      payment_method: p.paymentMethod || p.payment_method || p.method || "cash",
      amount: parseFloat(p.amount || p.cashReceived || 0) || 0,
      change: parseFloat(p.change || 0) || 0,
      // add extra fields as needed (notes, credit_terms, etc.)
    })),
   
  };

  console.log("Submitting payload:", payload);

  try {
    await axios.post("http://localhost:8080/api/merchandisings/", payload);
    alert("Transaction saved successfully!");
    return true;
  } catch (error) {
    console.error("Save error:", error.response?.data || error.message);
    alert("Failed to save transaction.");
    return false;
  }
};



const handleFinalizeSale = async () => {
  const success = await handleSubmit();
  if (success) {
    navigate("/trading");
  }
};


  const handlePay = () => {
    setIsPaymentModalOpen(true);
  };

  const handleClosePayment = () => {
    setIsPaymentModalOpen(false);
  };


  // Parent receives payment from PaymentModal and stores it
  const handleConfirmPayment = (paymentData) => {
    console.log("Payment confirmed (parent):", paymentData);

    // Add to payments array kept in parent state
    setPayments((prev) => [...prev, paymentData]);

    // Do NOT forcibly close the modal here if PaymentModal itself shows the InvoiceModal.
    // PaymentModal can call onClose when it wants to finish; if you prefer parent to
    // close it immediately, uncomment the next line:
    // setIsPaymentModalOpen(false);
  };






  return (
    <div className="bg-sky-300 min-h-screen p-3 text-black">

      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">
          {editMode ? "View/Edit Merchandising Sale" : "New Merchandising Sale"}
        </h1>

        {/* ✅ Original form layout block */}
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
                  const selected = transactionTypes.find(tt => String(tt.id) === selectedId);
                  setTransactionType(selectedId);
                  setSelectedTransactionTypeName(selected?.name || "");
                }}
                className="w-full rounded-md px-2 py-1 text-sm"
              >
                <option value="">-- Select Transaction Type --</option>
                {transactionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
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
                  <option key={user.id} value={user.id}>
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

            {/* Warehouse: CUSTOMER FIELD WITH ADD OPTION */}
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
                          (c) => c.name?.toLowerCase() === newCustomer.toLowerCase()
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
                          setSelectedCustomerId(res.data.id);
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
                        setSelectedCustomerId(e.target.value);
                      }
                    }}
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                  >
                    <option value="" disabled hidden>Select a customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="add_new">+ Add a customer</option>
                  </select>
                )}
              </div>
            )}

            {/* Van Load: VAN + ROUTE FIELD WITH ADD OPTION */}
            {selectedTransactionTypeName === "Van Load" && (
              <>
                <div>
                  <label className="text-sm mb-1 block">Van</label>
                  <select
                    value={selectedVan}
                    onChange={(e) => setSelectedVan(e.target.value)}
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                  >
                    <option value="" disabled hidden>Select</option>
                    {vans.map((van) => (
                      <option key={van.id} value={van.id}>
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
                        const newRouteName = route.trim();
                        if (!newRouteName) return;

                        // Check if the route already exists
                        const existing = routes.find(
                          (r) => r.route_name.toLowerCase() === newRouteName.toLowerCase()
                        );
                        if (existing) {
                          alert(`Route "${newRouteName}" already exists. Selected it for you.`);
                          setRoute(existing.id); // ✅ Use the existing route's ID
                          setIsAddingRoute(false);
                          return;
                        }

                        // Add new route
                        try {
                          const res = await axios.post("http://localhost:8080/api/routes/", {
                            route_name: newRouteName,
                          });

                          const newRoute = res.data;
                          setRoutes((prev) => [...prev, newRoute]);
                          setRoute(newRoute.id); // ✅ Use new route ID
                        } catch (error) {
                          console.error("Error saving new route:", error);
                        }

                        setIsAddingRoute(false);
                      }
                    }}
                  />
                ) : (
                  <select
                    value={route}
                    onChange={(e) => {
                      if (e.target.value === "add_new") {
                        setIsAddingRoute(true);
                        setRoute("");
                      } else {
                        setRoute(parseInt(e.target.value)); // ✅ ensure it's a number
                      }
                    }}
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black"
                  >
                    <option value="" disabled hidden>Select a route</option>
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
        warehouseId={currentWarehouse}
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
        onConfirm={(paymentData) => {
    // store payment in parent
    setPayments((prev) => [...prev, paymentData]);
  }}
        rows={rows}  // ✅ pass sold items
        products={products} // optional
        amountDue={totalAmount}
        actualSales={totalActualSale}
        emptyReturns={refundablesTotal}
        emptiesPriceTotal={emptiesPriceTotal}
        emptyDiscrepancies={discrepancy}
        totalAdjustments
        mspNo={mspNo}
        customerName={customerName}
        handledBy={handledBy}
        totalAmount={totalAmount}
        onSave={handleSubmit}
      />

    </div>
  );
};

export default MerchandisingSale;
