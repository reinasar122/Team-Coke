import React, { useEffect, useState, useCallback, useMemo, useRef} from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ProductTable from "./ProductTable";
import ActionButtons from "./ActionButtons";
import VanLoadTable from "./VanLoadTable"; 
import PaymentModal from "../PaymentModal";
import ExpensesSection from "./ExpensesSection"; // adjust path if it's elsewhere

import '../../styles/components/merchandisingSale.scss';


const API = "http://localhost:8080/api";
const authHeaders = {
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
};



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
  const [vanLoadDiscount, setVanLoadDiscount] = useState("");
  

  // at top of component
  const editingExistingRef = useRef(false);

  const [allProductsRaw, setAllProductsRaw] = useState([]);



  //Kath
  const [stocks, setStocks] = useState([]);
  const initTxTypeOnce = useRef(false); // guard

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


  useEffect(() => {
  // Fetch the logged-in user from localStorage
  const userData = JSON.parse(localStorage.getItem("user") || "{}");

  // Check if the user data exists, and set the selected user automatically
  if (userData && userData.id) {
    setSelectedUser(userData.id); // Automatically select the logged-in user
  }
}, []);




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
      //setMspNo(""); Commented By Kath || Do not reset MSP and Transaction Type 
      //setTransactionType(""); Commented By Kath
      //setSelectedTransactionTypeName(""); Commented By Kath
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

  // REPLACE your current loadStocksAndProducts with this
const loadStocksAndProducts = async () => {
  const warehouseId = getCurrentWarehouse();
  console.log("Current warehouse ID:", warehouseId);
  if (!warehouseId) return;

  try {
    // 1) Load stocks (support both param styles)
    const stockRes = await axios.get(`${API}/stocks/`, { params: { warehouse: warehouseId } });
    let stockData = stockRes.data;

    // Some backends return a single object or {results: [...]}
    if (!Array.isArray(stockData)) {
      stockData = Array.isArray(stockData?.results) ? stockData.results : (stockData ? [stockData] : []);
    }
    setStocks(stockData);
    console.log("Stocks retrieved:", stockData);

    // 2) Load products
    const productRes = await axios.get(`${API}/products/`);
    const allProducts = Array.isArray(productRes.data) ? productRes.data : [];
    setAllProductsRaw(allProducts);
    console.log("All products retrieved:", allProducts);

    // 3) Helpers to normalize fields
    const getPidFromStock = (s) =>
      Number(
        s.product_id ??
        (typeof s.product === "object" ? s.product?.id : s.product)
      );

    const getWidFromStock = (s) =>
      Number(s.warehouse_id ?? s.warehouse);

    const getQtyFromStock = (s) =>
      Number(s.quantity_available ?? s.quantity ?? s.qty ?? 0);

    // 4) Build "available" list = products with qty > 0 in THIS warehouse
    const availableProducts = allProducts.filter((p) => {
      const pid = Number(p.id);
      // any stock row for this product in this warehouse with qty > 0
      return stockData.some((s) => {
        const wid = getWidFromStock(s);
        const spid = getPidFromStock(s);
        const q = getQtyFromStock(s);
        return wid === Number(warehouseId) && spid === pid && q > 0;
      });
    });

    // 5) If editing: keep already-used products even if out of stock now
    if (location.state?.editMode) {
      const usedIds = new Set(
        (location.state?.sale?.items || []).map((it) =>
          Number(it.product?.id ?? it.product)
        )
      );

      const usedButNotAvailable = allProducts.filter(
        (p) => usedIds.has(Number(p.id)) && !availableProducts.some((ap) => ap.id === p.id)
      );

      const union = [...availableProducts, ...usedButNotAvailable];
      console.log(`Products shown (edit): ${union.length}`, union);
      setProducts(union);
    } else {
      console.log(`Products shown (create): ${availableProducts.length}`, availableProducts);
      setProducts(availableProducts);
    }

    // (Optional) If zero available, you can let the user know:
    if (!location.state?.editMode && availableProducts.length === 0) {
      console.warn("No in-stock products found for this warehouse.");
      // showAlert("No in-stock products available for this warehouse.");
    }
  } catch (err) {
    console.error("Error loading stocks/products:", err?.response?.data || err.message);
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



   // After transactionTypes are fetched, pick the initial type
  useEffect(() => {
  if (initTxTypeOnce.current) return;
  if (!transactionTypes || transactionTypes.length === 0) return;

  // If we arrived from "Edit Van Load", keep Van Load
  if (location.state?.editMode) {
    const incomingSale = location.state.sale;

    const chosen =
      (incomingSale?.transaction_type &&
        transactionTypes.find(tt => tt.id === Number(incomingSale.transaction_type))) ||
      transactionTypes.find(tt => tt.name.toLowerCase() === "van load");

    if (chosen) {
      setTransactionType(String(chosen.id));
      setSelectedTransactionTypeName(chosen.name);
      initTxTypeOnce.current = true;
      console.log("🟡 Preserved Van Load because editMode is true:", chosen);
    }
    return; // important: don’t run the normal create flow below
  }

  // Normal CREATE flow (not editing)
  const fromStateId   = location.state?.transactionTypeId || location.state?.transactionType;
  const fromStateName = location.state?.transactionTypeName || location.state?.selectedTransactionTypeName;

  let chosen = null;
  if (fromStateId) {
    chosen = transactionTypes.find(tt => tt.id === Number(fromStateId));
  }
  if (!chosen && fromStateName) {
    chosen = transactionTypes.find(tt => tt.name.toLowerCase() === String(fromStateName).toLowerCase());
  }
  if (!chosen) {
    chosen = transactionTypes.find(tt => tt.name.toLowerCase() === "warehouse") || transactionTypes[0];
  }

  if (chosen) {
    setTransactionType(String(chosen.id));
    setSelectedTransactionTypeName(chosen.name);
    initTxTypeOnce.current = true;
    console.log("🔧 Initialized transaction type (create):", chosen);
  }
}, [transactionTypes, location.state]);



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


  // ✅ PREFILL "Handled By" when editing an existing Van Load
useEffect(() => {
  const sale = location.state?.sale;
  const isEdit = location.state?.editMode === true;
  if (!isEdit || !sale) return;

  // Prefer an explicit handled_by_user id if your API returns it
  if (sale.handled_by_user) {
    setSelectedUser(String(sale.handled_by_user));
    return;
  }

  // Fallback: match the "First Last" full name to a user in the fetched users list
  if (sale.handled_by && Array.isArray(users) && users.length) {
    const wanted = String(sale.handled_by).trim().toLowerCase();
    const match = users.find(
      u => `${u.first_name} ${u.last_name}`.trim().toLowerCase() === wanted
    );
    if (match) setSelectedUser(String(match.id));
  }
}, [location.state?.sale, location.state?.editMode, users]);




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

  // 👇 skip generating a new MSP No while editing an existing sale
  if (editMode || editingExistingRef.current) return;

  axios.get("http://localhost:8080/api/merchandisings/msp-next/", {
    params: { transaction_type: transactionType, warehouse: warehouseId }
  })
  .then(res => setMspNo(res.data.msp_no || ""))
  .catch(err => console.error("MSP preview error:", err));
}, [transactionType, selectedTransactionTypeName, currentWarehouse?.id, editMode]);


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


  useEffect(() => {
  console.log("🧮 miscItems state changed:", miscItems);
}, [miscItems]);
  // karen changes


  // ADD THIS EFFECT (near your other useEffects)
useEffect(() => {
  const sale = location.state?.sale;
  const isEdit = location.state?.editMode === true;
  if (!sale || !isEdit) return;

  // mark the page as editing an existing record
  editingExistingRef.current = true;
  setEditMode(true);

  // show the Van Load UI
  setSelectedTransactionTypeName("Van Load");
  const vanTypeId =
    sale.transaction_type ??
    transactionTypes.find(tt => tt.name?.toLowerCase() === "van load")?.id;
  if (vanTypeId) setTransactionType(String(vanTypeId));

  // ✅ keep the original MSP no. (avoid getting a new one)
  if (sale.msp_no) setMspNo(sale.msp_no);

  // ✅ prefill van/route if your API returns them (object or id)
  if (sale.van) {
    const id = typeof sale.van === "object" ? sale.van.id : sale.van;
    setSelectedVan(id);
  }
  if (sale.route) {
    const id = typeof sale.route === "object" ? sale.route.id : sale.route;
    setRoute(id);
  }

  // optionally reflect the original timestamp
  if (sale.date_time) {
    setTransactionDate(toDatetimeLocalValue(new Date(sale.date_time)));
  }

  // wait until products are in memory so we can map item.product -> product info
  if (!products?.length) return;

  (async () => {
    // Try plural, then singular, to match whichever endpoint you actually have
    const urls = [
      `http://localhost:8080/api/merchandisings/${sale.id}/`,
      `http://localhost:8080/api/merchandising/${sale.id}/`,
    ];

    let data = null;
    for (const url of urls) {
      try {
        const res = await axios.get(url);
        data = res.data;
        break;
      } catch {}
    }
    if (!data) {
      console.error("❌ Could not load merchandising detail (both URLs failed).");
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];

const mapped = items.map((it, idx) => {
  const prodId = typeof it.product === "object" ? it.product?.id : it.product;
  const prod = products.find(p => Number(p.id) === Number(prodId));
  const contentNo = prod?.unit_type?.content_no || 1;
  const pcs = Math.max(0, Math.round(Number(it.dispatched_pcs ?? it.dispatchedPcs ?? 0)));
  const price = prod?.price;

  return {
    id: `${sale.id}-${idx}`,
    dbItemId: it.id,                 // ✅ keep the line item id
    productId: prodId,
    priceId: price?.id ?? null,
    contentNo,
    dispatchedPcs: pcs,
    dispatchedShell: (pcs / contentNo).toFixed(2),
    sellingPrice: price?.selling_price ?? "",
    shellPrice:   price?.shell_price   ?? "",
    bottlePrice:  price?.bottle_price  ?? "",
    expectedSale: Number(((price?.selling_price || 0) * pcs).toFixed(2)),
  };
});


    // keep one blank row at the end
    mapped.push({
      id: Date.now(),
      productId: "",
      priceId: null,
      dispatchedShell: "",
      dispatchedPcs: "",
      expectedSale: "",
      contentNo: "",
      sellingPrice: "",
      shellPrice: "",
      bottlePrice: "",
    });

    setRows(mapped);
    setTotalExpectedSale(mapped.reduce((s, r) => s + (Number(r.expectedSale) || 0), 0));
  })();
}, [
  location.state?.sale?.id,
  location.state?.editMode,
  products?.length,              // wait for products
  transactionTypes?.length
]);


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

    // karen changes
    // Use the modal’s copy if it sent one (so we save the exact rows the user confirmed)
    const sourceMiscItems =
      paymentData && Array.isArray(paymentData.miscItems)
        ? paymentData.miscItems
        : miscItems;



    const payload = {
      msp_no: mspNo || "",
      warehouse: Number(warehouseId),
      transaction_type: parseInt(transactionType),
      route: isVanLoad ? Number(route) : null,
      van: isVanLoad ? Number(selectedVan) : null,

      // ✅ FIXED: Include customer in payload
      customer: selectedCustomerId ? Number(selectedCustomerId) : null,

      handled_by: String(selectedUser) || null,  // ✅ send id, not name
      date_time: utcIso, // ✅ Always include date_time
      //date: utcIso.split('T')[0], // ✅ FIXED: Add required date field (YYYY-MM-DD format)

      expected_sale: Number(totalExpectedSale) || 0,
      actual_sale: Number(totalActualSale) || 0,
      //miscellaneous: Number(calculateTotalExpenses()) || 0,  (karen changes)

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

      // expenses to save
      misc_items: (sourceMiscItems || []).map(item => ({
        description: item.description || "",
        amount: Number(item.amount) || 0,
      })),
      miscellaneous: Number(
        (sourceMiscItems || []).reduce((s, i) => s + Number(i.amount || 0), 0)
      ),
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

    console.log("🧾 misc_items about to POST:", payload.misc_items);


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
      return merchandising;

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



  // ADD THIS FUNCTION near your other handlers
// ADD/REPLACE THIS FUNCTION
const handleSaveVanLoadEdit = async () => {
  const incomingSale = location.state?.sale;
  if (!incomingSale?.id) {
    showAlert("Sale not found.");
    return;
  }

  // Build the handler values from the dropdown
  const handler = users.find(u => String(u.id) === String(selectedUser));
  const handled_by = handler
    ? `${handler.first_name} ${handler.last_name}`.trim()
    : (incomingSale.handled_by || ""); // keep previous value if none picked
  const handled_by_user = handler ? Number(handler.id) : undefined;

  // Build the rows to PATCH
  const items = rows
    .filter(r => Number(r.productId))
    .map(r => {
      const pcs = Math.max(0, parseInt(r.dispatchedPcs) || 0);
      const perShell = Number(r.contentNo) || 1;
      const shells = perShell ? +(pcs / perShell).toFixed(2) : 0;

      return {
        id: r.dbItemId || undefined,
        product: Number(r.productId),
        dispatched_pcs: pcs,
        dispatched_shell: shells,
      };
    });

  const payload = {
    // ✅ include handler changes so backend saves them
    handled_by,
    ...(handled_by_user ? { handled_by_user } : {}),

    items,
    expected_sale: Number(totalExpectedSale) || 0,
    status: "Pending",
  };

  try {
    await axios.patch(
      `${API}/merchandisings/${incomingSale.id}/`,
      payload,
      authHeaders
    );

    showAlert("Van Load updated.");

    // Option A: just go back
    // navigate(-1);

    // Option B: re-open the same page with fresh sale in state (keeps UX tight)
    navigate(`/merchandising-sale/${incomingSale.id}`, {
      state: {
        sale: { ...incomingSale, handled_by, handled_by_user },
        editMode: true,
      },
    });
  } catch (e) {
    console.error("Failed to save Van Load edits:", e?.response?.data || e.message);
    showAlert("Failed to save changes.");
  }
};






  return (
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
                className="border w-full rounded-md px-2 py-1 text-sm"
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
                className="border w-full rounded-md px-2 py-1 text-sm"
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
              <label className="text-sm mb-1 block">Handled By</label>
              <input
                type="text"
                value={
                  users.find((u) => u.id === selectedUser)
                    ? `${users.find((u) => u.id === selectedUser).first_name || ""} ${
                        users.find((u) => u.id === selectedUser).last_name || ""
                      }`.trim() ||
                      users.find((u) => u.id === selectedUser).username ||
                      `User #${selectedUser}`
                    : ""
                }
                readOnly
                className="border w-full rounded-md px-2 py-1 text-black text-base bg-white cursor-default"
              />
              {/* Hidden input to still pass the ID */}
              <input type="hidden" name="handled_by" value={selectedUser} />
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
                    className=" border w-full rounded-md px-2 py-1 text-black text-base"
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
                    className="border w-full rounded-md px-2 py-1 text-black text-base"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="add_new">+ New Customer</option>
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
                    className="border w-full rounded-md px-2 py-1 text-black text-base"
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
                      className="border w-full rounded-md px-2 py-1  text-black text-base"
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
                      className="border w-full rounded-md px-2 py-1 text-black text-base"
                    >
                      <option value="" disabled hidden>Select Route</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.route_name}
                        </option>
                      ))}
                      <option value="add_new">+ New Route</option>
                    </select>
                  )}
                </div>
              </>
            )}
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
          defaultDiscount={vanLoadDiscount}
          
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



      {editMode && selectedTransactionTypeName === "Van Load" ? (
      // 👉 EDIT MODE for a Pending Van Load: show Save/Cancel
      <div className="flex justify-end gap-4 mt-6 max-w-7xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveVanLoadEdit}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded"
        >
          Save Changes
        </button>
      </div>
    ) : (
      // 👉 NORMAL MODE: keep your existing ActionButtons
      <ActionButtons
        transactionType={selectedTransactionTypeName}
        onBack={() => navigate(-1)}
        onFinalize={handleFinalizeSale}
        onPay={handlePay}
        finalizeDisabled={
          selectedTransactionTypeName === "Van Load" && !dispatchAdjustments.length
        }
      />
    )}

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
        expensesTotal={miscItems.reduce((s, i) => s + Number(i.amount || 0), 0)}  //karen changes
        miscItems={miscItems}
      />
    </div>
  );
};

export default MerchandisingSale;