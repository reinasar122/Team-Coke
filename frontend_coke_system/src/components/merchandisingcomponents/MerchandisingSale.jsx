import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ProductTable from "./ProductTable";
import ExpensesSection from "./ExpensesSection";
import ActionButtons from "./ActionButtons";

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

  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse?.id || userData.warehouse_id;
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

  const handleFinalizeSale = () => {
    console.log("Finalizing Van Load Sale...");
  };

  const handlePay = () => {
    console.log("Processing Payment...");
  };

  return (
    <div className="bg-sky-300 min-h-screen p-3 text-black">
      {selectedTransactionTypeName === "Warehouse" && (
        <ExpensesSection
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          miscItems={miscItems}
          setMiscItems={setMiscItems}
          newDesc={newDesc}
          setNewDesc={setNewDesc}
          newAmt={newAmt}
          setNewAmt={setNewAmt}
          calculateTotalExpenses={calculateTotalExpenses}
        />
      )}

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

            {transactionType === "Warehouse" && (
              <div>
                <label className="text-sm">Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-md px-2 py-1 text-sm"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.customer_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {transactionType === "Van Load" && (
              <>
                <div>
                  <label className="text-sm">Van</label>
                  <input
                    type="text"
                    value={selectedVan}
                    onChange={(e) => setSelectedVan(e.target.value)}
                    className="w-full rounded-md px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm">Route</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      className="w-full rounded-md px-2 py-1 text-sm"
                    >
                      <option value="">-- Select Route --</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsAddingRoute(true)}
                      className="bg-gray-700 text-white px-2 py-1 rounded text-xs"
                    >
                      Add
                    </button>
                  </div>
                  {isAddingRoute && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="New Route"
                        value={newRoute}
                        onChange={(e) => setNewRoute(e.target.value)}
                        className="w-full rounded-md px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => {
                          setIsAddingRoute(false);
                          setNewRoute("");
                        }}
                        className="text-xs text-red-600 mt-1"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Subcomponents below original layout */}
     <ProductTable
        rows={rows}
        setRows={setRows}
        products={products}
        selectedTransactionTypeName={selectedTransactionTypeName}
        miscItems={miscItems} // ✅ needed for refund/discrepancy
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

      <ActionButtons
        transactionType={selectedTransactionTypeName}
        onBack={() => navigate(-1)}
        onFinalize={handleFinalizeSale}
        onPay={handlePay}
      />

    </div>
  );
};

export default MerchandisingSale;
