import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ProductTable from "./ProductTable";
import ActionButtons from "./ActionButtons";
import VanLoadTable from "./VanLoadTable"; 
import PaymentModal from "../PaymentModal";

// Convert a Date to a value usable by <input type="datetime-local"> in LOCAL time
const toDatetimeLocalValue = (date = new Date()) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

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
  const [routes, setRoutes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [miscItems, setMiscItems] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const navigate = useNavigate();
  const [transactionDate, setTransactionDate] = useState(() => toDatetimeLocalValue());
  //Kath: const [transactionType, setTransactionType] = useState("");
  const location = useLocation();
  const [transactionType, setTransactionType] = useState(
      location.state?.transactionTypeId || "" // auto-set Warehouse if passed
    );
  const [selectedTransactionTypeName, setSelectedTransactionTypeName] = useState("");
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [mspNo, setMspNo] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [route, setRoute] = useState("");
  const [selectedVan, setSelectedVan] = useState("");
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [vans, setVans] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const [dispatchAdjustments, setDispatchAdjustments] = useState([]); // [{ product_id, delta: -pcs }]
  

  //Kath
  const [stocks, setStocks] = useState([]);


  // ✅ Custom alert function since alert() is not supported
  const showAlert = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    alertDiv.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text-gray-700 mb-4">${message}</p>
        <div class="flex justify-end">
          <button class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded" onclick="this.closest('.fixed').remove()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(alertDiv);
  };

  // ✅ IMPROVED: Complete form reset when reset state is passed
  useEffect(() => {
    if (location.state?.reset === true) {
      console.log("🔄 Resetting form to initial state...");
      
      // Reset all form state to initial values
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
      setMspNo("");
      setTransactionType("");
      setSelectedTransactionTypeName("");
      setSelectedUser(null);
      setSelectedCustomerId("");
      setRoute("");
      setSelectedVan("");
      setMiscItems([]);
      setTotalExpectedSale(0);
      setTotalActualSale(0);
      setEmptiesPriceTotal(0);
      setRefundablesTotal(0);
      setDiscrepancy(0);
      setTotalAmount(0);
      setIsAddingRoute(false);
      setIsAddingCustomer(false);
      setEditMode(false);
      
      // Reset date/time to current
      setTransactionDate(toDatetimeLocalValue());
      
      // Clear any localStorage data
      localStorage.removeItem("merchForm");
      
      // Clear the location state to prevent repeated resets
      window.history.replaceState({}, document.title);
      
      console.log("✅ Form reset completed");
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

  // //Kath: Fetch Stocks
  // const fetchStocks = useCallback(async () => {
  //   try {
  //     const warehouseId = getCurrentWarehouse();

  //     if (!warehouseId) {
  //       console.warn("No warehouse assigned to user");
  //       setStocks([]); // Set stocks state to an empty array if no warehouse is assigned
  //       return;
  //     }

  //     // Fetch stocks from the backend using the warehouse ID
  //     const res = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`);
  //     setStocks(res.data); // Assuming you're using `setStocks` to update the state with the stock data
  //   } catch (err) {
  //     console.error("Error fetching stocks:", err);
  //     setStocks([]); // Set stocks to empty array on error
  //   }
  // }, []);

  // const fetchProducts = useCallback(async () => {
  //   try {
  //     const warehouseId = getCurrentWarehouse();

  //     if (!warehouseId) {
  //       console.warn("No warehouse assigned to user");
  //       setProducts([]);
  //       return;
  //     }

  //     const res = await axios.get(`http://localhost:8080/api/products/?warehouse_id=${warehouseId}`);
  //     setProducts(res.data);
  //   } catch (err) {
  //     console.error("Error fetching products:", err);
  //     setProducts([]);
  //   }
  // }, []);

  // useEffect(() => {
  //   fetchProducts();
  //   const handleWarehouseChange = () => {
  //     fetchProducts();
  //   };
  //   window.addEventListener('warehouseChanged', handleWarehouseChange);
  //   return () => {
  //     window.removeEventListener('warehouseChanged', handleWarehouseChange);
  //   };
  // }, [fetchProducts]);

  // // Fetch Stocks
  // const fetchStocks = useCallback(async () => {
  //   try {
  //     const warehouseId = getCurrentWarehouse();

  //     if (!warehouseId) {
  //       console.warn("No warehouse assigned to user");
  //       setStocks([]);
  //       return;
  //     }

  //     const res = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`);
  //     setStocks(res.data);
  //   } catch (err) {
  //     console.error("Error fetching stocks:", err);
  //     setStocks([]);
  //   }
  // }, []);

  // // Fetch Products filtered by available stocks
  // const fetchProducts = useCallback(async () => {
  //   try {
  //     const warehouseId = getCurrentWarehouse();
  //     if (!warehouseId) {
  //       console.warn("No warehouse assigned to user");
  //       setProducts([]);
  //       return;
  //     }

  //     const res = await axios.get(`http://localhost:8080/api/products/?warehouse_id=${warehouseId}`);
  //     const allProducts = res.data;

  //     // Filter products based on stocks
  //     const availableProducts = allProducts.filter((product) => {
  //       const stock = stocks.find(
  //         (s) => s.product.id === product.id && s.warehouse === warehouseId
  //       );
  //       return stock && stock.quantity > 0; // Only show if stock exists and quantity > 0
  //     });

  //     setProducts(availableProducts);
  //   } catch (err) {
  //     console.error("Error fetching products:", err);
  //     setProducts([]);
  //   }
  // }, [stocks]);

  // Define it at the component level
  const loadStocksAndProducts = async () => {
  const warehouseId = getCurrentWarehouse();
  console.log("Current warehouse ID:", warehouseId);

  if (!warehouseId) return;

  try {
      const stockRes = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`);
      const stockData = stockRes.data;
      console.log("Stocks retrieved:", stockData);
      setStocks(stockData);

      const productRes = await axios.get(`http://localhost:8080/api/products/`);
      const allProducts = productRes.data;
      console.log("All products retrieved:", allProducts);

      const availableProducts = allProducts.filter((product) => {
        const stock = stockData.find(
          (s) => s.product === product.id && s.warehouse === warehouseId
        );
        return stock && stock.quantity_available > 0;
      });

      console.log("Available products (filtered by stock):", availableProducts);
      setProducts(availableProducts);
    } catch (err) {
      console.error("Error loading stocks/products:", err);
      setStocks([]);
      setProducts([]);
    }
  };

  useEffect(() => {
    loadStocksAndProducts();

    const handleWarehouseChange = () => {
      loadStocksAndProducts();
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, []);
  //Kath



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
  }, [selectedTransactionTypeName]);

  //kath
  useEffect(() => {
    if (transactionType) {
      const selected = transactionTypes.find(tt => tt.id === parseInt(transactionType, 10));
      setSelectedTransactionTypeName(selected?.name || "");

      // Debugging logs
      console.log("useEffect triggered for transactionType change:");
      console.log("transactionType:", transactionType);
      console.log("transactionTypes array:", transactionTypes);
      console.log("selected transaction type:", selected);
    }
  }, [transactionType, transactionTypes]);


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

    axios.get(`http://localhost:8080/api/routes/?warehouse=${warehouseId}`)
      .then(res => setRoutes(res.data))
      .catch(err => console.error("Failed to fetch routes:", err));
    
    axios.get(`http://localhost:8080/api/customers/?warehouse=${warehouseId}`)
      .then(res => {
        console.log("✅ Customers loaded:", res.data);
        setCustomers(res.data);
      })
      .catch(err => console.error("Failed to fetch customers:", err));
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
    const warehouseId = getCurrentWarehouse();
    if (!transactionType || !selectedTransactionTypeName || !warehouseId) return;

    axios.get("http://localhost:8080/api/merchandisings/msp-next/", {
      params: {
        transaction_type: transactionType,
        warehouse: warehouseId
      }
    })
    .then(res => {
      setMspNo(res.data.msp_no || "");
    })
    .catch(err => console.error("MSP preview error:", err));
  }, [transactionType, selectedTransactionTypeName, currentWarehouse?.id]);

  useEffect(() => {
    // optional: keep it synced to "now" when page opens
    setTransactionDate(toDatetimeLocalValue(new Date()));
  }, []);

  // ✅ Memoized customer calculation to prevent infinite re-renders
  const customerInfo = useMemo(() => {
    if (!selectedCustomerId) {
      return { id: null, name: "Walk-in" };
    }
    
    const customer = customers.find((c) => String(c.id) === String(selectedCustomerId));
    
    return {
      id: customer?.id || null,
      name: customer?.name || "Walk-in"
    };
  }, [selectedCustomerId, customers]);

  const customerName = customerInfo.name;

  // ✅ Simplified debug logging
  useEffect(() => {
    if (selectedCustomerId) {
      console.log("👤 Customer selected:", selectedCustomerId, "->", customerName);
    }
  }, [selectedCustomerId, customerName]);

  const calculateTotalExpenses = () => {
    return miscItems.reduce((total, item) => total + parseFloat(item.amount || 0), 0);
  };

  const handledByUser = users.find(u => String(u.id) === String(selectedUser));
  const handledBy = handledByUser ? `${handledByUser.first_name} ${handledByUser.last_name}`.trim() : "";

  // 🔧 FIXED: Two-step process - create transaction first, then payments separately
  const handleSubmit = async (paymentData = null) => {
    const warehouseId = currentWarehouse?.id;
    const isVanLoad = (selectedTransactionTypeName || "").trim().toLowerCase() === "van load";
    
    if (!warehouseId) { 
      showAlert("Warehouse is required."); 
      return false; 
    }
    
    if (isVanLoad) {
      if (!route) { 
        showAlert("Route is required for Van Load."); 
        return false; 
      }
      if (!selectedVan) { 
        showAlert("Van is required for Van Load."); 
        return false; 
      }
    }

    // // ✅ Add customer validation for Warehouse transactions
    // if (selectedTransactionTypeName === "Warehouse" && !selectedCustomerId) {
    //   showAlert("Please select a customer for Warehouse transactions.");
    //   return false;
    // }

    // ✅ Always include date_time for both transaction types
    const utcIso = new Date(transactionDate).toISOString();

    const nz = v => Math.max(0, parseInt(v) || 0);

    const handledByUser = users.find(
      u => String(u.id) === String(selectedUser)
    );

    const handledBy = handledByUser
      ? `${handledByUser.first_name} ${handledByUser.last_name}`.trim()
      : "";

    // 🔧 STEP 1: Create merchandising transaction WITHOUT payments
    // ✅ Validate required fields before creating payload
    if (!transactionType) {
      showAlert("Please select a transaction type.");
      return false;
    }
    
    if (!selectedUser) {
      showAlert("Please select who is handling this transaction.");
      return false;
    }

    // ✅ Filter valid items (must have productId)
    const validItems = rows.filter(r => r.productId && r.productId !== "");
    if (validItems.length === 0) {
      showAlert("Please add at least one product to the transaction.");
      return false;
    }

    const payload = {
      msp_no: mspNo || "",
      warehouse: Number(warehouseId),
      transaction_type: parseInt(transactionType),
      route: isVanLoad ? Number(route) : null,
      van: isVanLoad ? Number(selectedVan) : null,

      // ✅ FIXED: Include customer in payload
      customer: selectedCustomerId ? Number(selectedCustomerId) : null,

      handled_by: handledBy || "",
      date_time: utcIso, // ✅ Always include date_time
      date: utcIso.split('T')[0], // ✅ FIXED: Add required date field (YYYY-MM-DD format)

      expected_sale: Number(totalExpectedSale) || 0,
      actual_sale: Number(totalActualSale) || 0,
      miscellaneous: Number(calculateTotalExpenses()) || 0,

      // 🔧 REMOVED: payment_method since payments are handled separately

      invoice_no: "",
      status: (selectedTransactionTypeName === "Van Load") ? "Pending" : "Complete",
      remarks: "",

      items: validItems.map(row => {
        const base = {
          product: Number(row.productId),
          dispatched_pcs: nz(row.dispatchedPcs),
          dispatched_shell: nz(row.dispatchedShell),
          actual_return_pcs: nz(row.expectedReturnPcsNonempty),
          actual_return_shell: nz(row.expectedReturnShellNonempty),
          discrepancy_empties_pc: nz(row.discrepancyPcsEmpty),
          discrepancy_empties_shell: nz(row.discrepancyShellEmpty),
          discrepancy_full_pcs: nz(row.discrepancyPcsNonempty),
          discrepancy_full_shell: nz(row.discrepancyShellNonempty),
          discount_percent: Number(row.discount) || 0,
          expected_sale: Number(row.expectedSale) || 0,
          actual_sale: Number(row.actualSale) || 0,
        };
        if (!isVanLoad) {
          base.sold_pcs = nz(row.soldPcs);
          base.sold_shell = nz(row.soldShell);
          base.empty_return_pcs = nz(row.expectedReturnPcsEmpty);
          base.empty_return_shell = nz(row.expectedReturnShellEmpty); // ✅ FIXED: Add missing shell returns
        }
        return base;
      }),

      misc_items: (miscItems || []).map(item => ({
        description: item.description || "",
        amount: Number(item.amount) || 0,
      })),

      // 🔧 NO payments in initial payload - will be created separately
    };

    // ✅ Enhanced debugging - log payload structure
    console.log("🚀 Step 1: Creating merchandising transaction:");
    console.log("📋 Payload summary:", {
      msp_no: payload.msp_no,
      warehouse: payload.warehouse,
      transaction_type: payload.transaction_type,
      route: payload.route,
      van: payload.van,
      customer: payload.customer,
      handled_by: payload.handled_by,
      date_time: payload.date_time,
      date: payload.date, // ✅ Now includes the required date field
      items_count: payload.items.length,
      misc_items_count: payload.misc_items.length,
      status: payload.status
    });
    console.log("📦 Full payload:", payload);

    try {
      // STEP 1: Create the merchandising transaction
      const response = await axios.post("http://localhost:8080/api/merchandisings/", payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      const merchandising = response.data;
      console.log("✅ Step 1: Transaction created successfully:", merchandising);

      // 🔧 STEP 2: Create payment separately with correct field names
      if (paymentData && paymentData.paymentMethod !== "credit") {
        const paymentPayload = {
          method: paymentData.paymentMethod || "cash", // ✅ 'method' not 'payment_method'
          amount: Number(paymentData.cashReceived) || Number(paymentData.amount) || 0, // ✅ 'amount' not 'amount_received'
          merchandising: merchandising.id, // ✅ Reference to the created transaction
          payment_date: new Date().toISOString().split('T')[0],
          change_amount: Number(paymentData.change) || 0,
          payment_status: "completed",
        };

        console.log("🚀 Step 2: Creating payment:", paymentPayload);

        try {
          const paymentResponse = await axios.post("http://localhost:8080/api/payments/", paymentPayload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem("token")}`,
            },
          });
          console.log("✅ Step 2: Payment created successfully:", paymentResponse.data);
        } catch (paymentError) {
          console.error("❌ Payment creation failed:", paymentError.response?.data || paymentError.message);
          // Don't fail the whole transaction if payment fails
          console.warn("🔶 Transaction saved successfully, but payment recording failed. Payment can be added manually later.");
        }
      } else if (paymentData && paymentData.paymentMethod === "credit") {
        console.log("💳 Credit payment - no immediate payment record needed");
      }

      showAlert("Transaction saved successfully!");
      return true;

    } catch (error) {
      console.error("❌ Transaction creation failed:", error);
      
      // 🔧 Enhanced error handling with detailed debugging
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        console.error("🔍 Detailed 400 error:", errorData);
        
        // Handle different types of validation errors
        const errorMessages = [];
        
        if (errorData.payments) {
          errorMessages.push(`Payment errors: ${JSON.stringify(errorData.payments)}`);
        }
        if (errorData.items) {
          errorMessages.push(`Item errors: ${JSON.stringify(errorData.items)}`);
        }
        if (errorData.customer) {
          errorMessages.push(`Customer errors: ${JSON.stringify(errorData.customer)}`);
        }
        if (errorData.warehouse) {
          errorMessages.push(`Warehouse errors: ${JSON.stringify(errorData.warehouse)}`);
        }
        if (errorData.non_field_errors) {
          errorMessages.push(`General errors: ${errorData.non_field_errors.join(', ')}`);
        }
        
        // If no specific errors found, show the whole error object
        if (errorMessages.length === 0) {
          errorMessages.push(`Validation error: ${JSON.stringify(errorData)}`);
        }
        
        showAlert(errorMessages.join('\n'));
        
      } else if (error.response?.status === 401) {
        showAlert("Authentication failed. Please login again.");
        navigate("/login");
      } else if (error.response?.status === 403) {
        showAlert("You don't have permission to perform this action.");
      } else if (error.response?.status === 500) {
        console.error("🔥 500 Server Error Details:", error.response?.data);
        showAlert("Server error occurred. Please check the console for details and contact support.");
      } else {
        showAlert(`Failed to save transaction: ${error.message}`);
      }
      return false;
    }
  };
  const handleFinalizeSale = async () => {
    // 1) save the merchandising transaction using your existing handler
    const success = await handleSubmit();
    if (!success) return;

    // 2) compute the warehouse to deduct from
    const wid = currentWarehouse?.id;
    if (!wid) {
      showAlert("Warehouse not found for stock deduction.");
      return;
    }

    // 3) skip if nothing to deduct
    if (!dispatchAdjustments?.length) {
      // optional: still navigate, since the sale saved
      navigate("/trading");
      return;
    }

    try {
      // 4) bulk deduct in PCS (negative delta)
      await axios.post("http://localhost:8080/api/stocks/bulk-adjust/", {
        warehouse: Number(wid),
        items: dispatchAdjustments,             // [{ product_id, delta: -pcs }]
        reason: "van_load_dispatch",
      });

      // 5) refresh any listeners (stock widgets, other pages)
      window.dispatchEvent(new Event("stocksChanged"));

      navigate("/trading");
    } catch (err) {
      console.error("Stock deduction failed:", err?.response?.data || err.message);
      // decide: keep the sale but warn that deduction failed
      showAlert(err?.response?.data?.detail || "Transaction saved, but stock deduction failed.");
    }
  };


  const handlePay = () => {
    setIsPaymentModalOpen(true);
  };

  const handleClosePayment = () => {
    setIsPaymentModalOpen(false);
  };

  const handleConfirmPayment = (paymentData) => {
    console.log("💳 Payment confirmed (parent):", paymentData);
  };

  return (
    <div className="bg-sky-300 min-h-screen p-3 text-black">
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">
          {editMode ? "View/Edit Merchandising Sale" : "New Merchandising Sale"}
        </h1>

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
              {/* <select
                value={transactionType}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const selected = transactionTypes.find(tt => String(tt.id) === selectedId);
                  setTransactionType(selectedId);
                  setSelectedTransactionTypeName(selected?.name || "");
                }}
                className="w-full rounded-md px-2 py-1 text-sm"
              > */}
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
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black text-base"
                    placeholder="Enter new customer name"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const newCustomer = e.target.value.trim();
                        if (!newCustomer) return;

                        const exists = customers.some(
                          (c) => c.name?.toLowerCase() === newCustomer.toLowerCase()
                        );
                        if (exists) {
                          showAlert(`Customer "${newCustomer}" already exists.`);
                          setIsAddingCustomer(false);
                          return;
                        }

                        try {
                          const res = await axios.post("http://localhost:8080/api/customers/", {
                            name: newCustomer,
                            warehouse: currentWarehouse?.id,
                          });
                          console.log("✅ New customer created:", res.data);
                          setCustomers((prev) => [...prev, res.data]);
                          setSelectedCustomerId(res.data.id);
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
                    value={selectedCustomerId}
                    onChange={(e) => {
                      if (e.target.value === "add_new") {
                        setIsAddingCustomer(true);
                        setSelectedCustomerId("");
                      } else {
                        console.log("👤 Customer selected:", e.target.value);
                        setSelectedCustomerId(e.target.value);
                      }
                    }}
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black text-base"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="add_new">+ Add New Customer</option>
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
                    className="w-full rounded-md px-2 py-1 bg-gray-200 text-black text-base"
                  >
                    <option value="" disabled hidden>Select Van</option>
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
                      className="w-full rounded-md px-2 py-1 bg-gray-200 text-black text-base"
                      placeholder="Enter new route name"
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const newRouteName = e.target.value.trim();
                          if (!newRouteName) return;

                          const existing = routes.find(
                            (r) => r.route_name.toLowerCase() === newRouteName.toLowerCase()
                          );
                          if (existing) {
                            showAlert(`Route "${newRouteName}" already exists. Selected it for you.`);
                            setRoute(existing.id);
                            setIsAddingRoute(false);
                            return;
                          }

                          try {
                            const res = await axios.post("http://localhost:8080/api/routes/", {
                              route_name: newRouteName,
                              warehouse: currentWarehouse?.id, // ✅ Include warehouse ID
                            });

                            const newRoute = res.data;
                            setRoutes((prev) => [...prev, newRoute]);
                            setRoute(newRoute.id);
                            console.log("✅ New route created:", newRoute);
                          } catch (error) {
                            console.error("❌ Error saving new route:", error);
                            console.error("❌ Error details:", error.response?.data);
                            
                            // Show detailed error message
                            const errorMsg = error.response?.data?.detail || 
                                           error.response?.data?.route_name?.[0] || 
                                           error.response?.data?.warehouse?.[0] || 
                                           "Failed to save route. Please try again.";
                            showAlert(errorMsg);
                          }

                          setIsAddingRoute(false);
                        }
                        if (e.key === "Escape") {
                          setIsAddingRoute(false);
                          e.target.value = "";
                        }
                      }}
                      onBlur={(e) => {
                        setIsAddingRoute(false);
                        e.target.value = "";
                      }}
                      autoFocus
                    />
                  ) : (
                    <select
                      value={route}
                      onChange={(e) => {
                        if (e.target.value === "add_new") {
                          setIsAddingRoute(true);
                        } else {
                          setRoute(parseInt(e.target.value));
                        }
                      }}
                      className="w-full rounded-md px-2 py-1 bg-gray-200 text-black text-base"
                    >
                      <option value="" disabled hidden>Select Route</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.route_name}
                        </option>
                      ))}
                      <option value="add_new">+ Add New Route</option>
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
          onAdjustmentsChange={setDispatchAdjustments}
          
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
        finalizeDisabled={selectedTransactionTypeName === "Van Load" && !dispatchAdjustments.length}
      />

      <PaymentModal
        open={isPaymentModalOpen}
        onClose={handleClosePayment}
        onConfirm={handleConfirmPayment}
        rows={rows}
        products={products}
        amountDue={totalAmount}
        actualSales={totalActualSale}
        emptyReturns={refundablesTotal}
        emptiesPriceTotal={emptiesPriceTotal}
        emptyDiscrepancies={discrepancy}
        totalAdjustments
        mspNo={mspNo}
        customerName={customerName} // ✅ Calculated customer name
        customer={customerInfo} // ✅ Full customer object
        handledBy={handledBy}
        totalAmount={totalAmount}
        onSave={handleSubmit}
        transactionDate={transactionDate}
        transactionTypeName={selectedTransactionTypeName}
        transactionTypes={transactionTypes}//kath
      />
    </div>
  );
};

export default MerchandisingSale;