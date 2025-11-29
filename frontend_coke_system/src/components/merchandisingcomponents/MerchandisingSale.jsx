import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProductTable from "./ProductTable";
import ActionButtons from "./ActionButtons";
import VanLoadTable from "./VanLoadTable";
import PaymentModal from "../PaymentModal";
import ExpensesSection from "./ExpensesSection"; // adjust path if it's elsewhere
import "../../styles/components/merchandisingSale.scss";
import api from "../../api"; // ✅ centralized API instance

// ✅ NEW: Van Load notification helper
const notifyVanLoadCreated = (vanLoadData) => {
  console.log("🚛 Notifying van load creation:", vanLoadData);

  const event = new CustomEvent("vanLoadCreated", {
    detail: {
      action: "created",
      id: vanLoadData.id,
      msp_no: vanLoadData.msp_no,
      route: vanLoadData.route,
      van: vanLoadData.van,
      handled_by: vanLoadData.handled_by,
      expected_sale: vanLoadData.expected_sale,
      warehouse_id: vanLoadData.warehouse,
      createdBy: JSON.parse(localStorage.getItem("user") || "{}").username || "Unknown",
      timestamp: new Date().toISOString(),
      summary: `Van Load ${vanLoadData.msp_no} has been created`,
    },
  });

  window.dispatchEvent(event);
};

// ✅ NEW: Warehouse MSP notification helper
const notifyWarehouseMspCreated = (mspData) => {
  console.log("🏭 Notifying warehouse MSP creation:", mspData);

  const event = new CustomEvent("warehouseMspCreated", {
    detail: {
      action: "created",
      id: mspData.id,
      msp_no: mspData.msp_no,
      transaction_type_name: mspData.transaction_type_name || "Warehouse",
      handled_by: mspData.handled_by,
      customer: mspData.customer,
      expected_sale: mspData.expected_sale,
      actual_sale: mspData.actual_sale,
      warehouse_id: mspData.warehouse,
      createdBy: JSON.parse(localStorage.getItem("user") || "{}").username || "Unknown",
      timestamp: new Date().toISOString(),
      summary: `Warehouse MSP ${mspData.msp_no} has been created`,
    },
  });

  window.dispatchEvent(event);
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
  const location = useLocation();
  const [transactionType, setTransactionType] = useState(
    location.state?.transactionTypeId || ""
  );

  const isResetSession = location.state?.reset === true;
  if (isResetSession) {
    localStorage.removeItem("merchForm");
    localStorage.removeItem("rows");
    sessionStorage.clear();
    console.log("🧹 Cleared localStorage/sessionStorage before component hydration");
  }

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

  const [dispatchAdjustments, setDispatchAdjustments] = useState([]);
  const [vanLoadDiscount, setVanLoadDiscount] = useState("");

  const [discrepancyEmptyTotal, setDiscrepancyEmptyTotal] = useState(0);

  const editingExistingRef = useRef(false);
  const [allProductsRaw, setAllProductsRaw] = useState([]);

  const toUtcValue = (date) => new Date(date).toISOString();

  const [stocks, setStocks] = useState([]);
  const initTxTypeOnce = useRef(false);

  const showAlert = (message) => {
    const alertDiv = document.createElement("div");
    alertDiv.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
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
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    if (userData && userData.id) {
      setSelectedUser(userData.id);
    }
  }, [location.key]);

  useEffect(() => {
    if (location.state?.reset === true) {
      console.log("🔄 Resetting form to initial state...");

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
      setTransactionDate(toDatetimeLocalValue());

      localStorage.removeItem("merchForm");
      localStorage.removeItem("rows");
      sessionStorage.clear();

      delete location.state.sale;
      delete location.state.editMode;

      window.history.replaceState({}, document.title);

      console.log("✅ Form reset completed — everything cleared");
    }
  }, [location.state]);

  const getCurrentWarehouse = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(
      localStorage.getItem("selectedWarehouse") || "null"
    );
    if (userData.role?.toLowerCase() === "admin") {
      return Array.isArray(selectedWarehouse?.id)
        ? selectedWarehouse.id[0]
        : selectedWarehouse?.id || userData.warehouse_id;
    }
    return userData.warehouse_id;
  };

  useEffect(() => {
    const selectedWarehouse = JSON.parse(
      localStorage.getItem("selectedWarehouse") || "null"
    );
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const warehouseId = getCurrentWarehouse();

    if (warehouseId) {
      const name = selectedWarehouse?.name || user?.warehouse_name || "Warehouse";
      setCurrentWarehouse({ id: warehouseId, name });
    }
  }, []);

  // ✅ Load stocks + products using centralized api
  const loadStocksAndProducts = async () => {
    const warehouseId = getCurrentWarehouse();
    console.log("Current warehouse ID:", warehouseId);
    if (!warehouseId) return;

    try {
      // 1) Load stocks
      const stockRes = await api.get("/stocks/", {
        params: { warehouse: warehouseId },
      });
      let stockData = stockRes.data;

      if (!Array.isArray(stockData)) {
        stockData = Array.isArray(stockData?.results)
          ? stockData.results
          : stockData
          ? [stockData]
          : [];
      }
      setStocks(stockData);
      console.log("Stocks retrieved:", stockData);

      // 2) Load products
      const productRes = await api.get("/products/");
      const allProducts = Array.isArray(productRes.data) ? productRes.data : [];
      setAllProductsRaw(allProducts);
      console.log("All products retrieved:", allProducts);

      const getPidFromStock = (s) =>
        Number(
          s.product_id ??
            (typeof s.product === "object" ? s.product?.id : s.product)
        );

      const getWidFromStock = (s) => Number(s.warehouse_id ?? s.warehouse);

      const getQtyFromStock = (s) =>
        Number(s.quantity_available ?? s.quantity ?? s.qty ?? 0);

      const availableProducts = allProducts.filter((p) => {
        const pid = Number(p.id);
        return stockData.some((s) => {
          const wid = getWidFromStock(s);
          const spid = getPidFromStock(s);
          const q = getQtyFromStock(s);
          return wid === Number(warehouseId) && spid === pid && q > 0;
        });
      });

      if (location.state?.editMode) {
        const usedIds = new Set(
          (location.state?.sale?.items || []).map((it) =>
            Number(it.product?.id ?? it.product)
          )
        );

        const usedButNotAvailable = allProducts.filter(
          (p) =>
            usedIds.has(Number(p.id)) &&
            !availableProducts.some((ap) => ap.id === p.id)
        );

        const union = [...availableProducts, ...usedButNotAvailable];
        console.log(`Products shown (edit): ${union.length}`, union);
        setProducts(union);
      } else {
        console.log(
          `Products shown (create): ${availableProducts.length}`,
          availableProducts
        );
        setProducts(availableProducts);
      }

      if (!location.state?.editMode && availableProducts.length === 0) {
        console.warn("No in-stock products found for this warehouse.");
      }
    } catch (err) {
      console.error(
        "Error loading stocks/products:",
        err?.response?.data || err.message
      );
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
    return () =>
      window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, []);

  const fetchUsers = useCallback(() => {
    if (!currentWarehouse?.id) {
      console.log("❌ Skipping users fetch - no warehouse ID");
      return;
    }

    console.log(
      `🔄 Fetching users for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`
    );

    api
      .get("/users/")
      .then((res) => {
        console.log(`✅ Loaded ${res.data.length} users`);
        setUsers(res.data);
      })
      .catch((err) => console.error("❌ Error fetching users:", err));
  }, [currentWarehouse]);

  useEffect(() => {
    if (selectedTransactionTypeName === "Van Load") {
      api
        .get("/vans/")
        .then((res) => setVans(res.data))
        .catch((err) => console.error("Failed to fetch vans:", err));
    }
  }, [selectedTransactionTypeName]);

  useEffect(() => {
    if (transactionType) {
      const selected = transactionTypes.find(
        (tt) => tt.id === parseInt(transactionType, 10)
      );
      setSelectedTransactionTypeName(selected?.name || "");

      console.log("useEffect triggered for transactionType change:");
      console.log("transactionType:", transactionType);
      console.log("transactionTypes array:", transactionTypes);
      console.log("selected transaction type:", selected);
    }
  }, [transactionType, transactionTypes]);

  useEffect(() => {
    if (initTxTypeOnce.current) return;
    if (!transactionTypes || transactionTypes.length === 0) return;

    if (location.state?.editMode) {
      const incomingSale = location.state.sale;

      const chosen =
        (incomingSale?.transaction_type &&
          transactionTypes.find(
            (tt) => tt.id === Number(incomingSale.transaction_type)
          )) ||
        transactionTypes.find(
          (tt) => tt.name.toLowerCase() === "van load"
        );

      if (chosen) {
        setTransactionType(String(chosen.id));
        setSelectedTransactionTypeName(chosen.name);
        initTxTypeOnce.current = true;
        console.log("🟡 Preserved Van Load because editMode is true:", chosen);
      }
      return;
    }

    const fromStateId =
      location.state?.transactionTypeId || location.state?.transactionType;
    const fromStateName =
      location.state?.transactionTypeName ||
      location.state?.selectedTransactionTypeName;

    let chosen = null;
    if (fromStateId) {
      chosen = transactionTypes.find(
        (tt) => tt.id === Number(fromStateId)
      );
    }
    if (!chosen && fromStateName) {
      chosen = transactionTypes.find(
        (tt) =>
          tt.name.toLowerCase() ===
          String(fromStateName).toLowerCase()
      );
    }
    if (!chosen) {
      chosen =
        transactionTypes.find(
          (tt) => tt.name.toLowerCase() === "warehouse"
        ) || transactionTypes[0];
    }

    if (chosen) {
      setTransactionType(String(chosen.id));
      setSelectedTransactionTypeName(chosen.name);
      initTxTypeOnce.current = true;
      console.log("🔧 Initialized transaction type (create):", chosen);
    }
  }, [transactionTypes, location.state]);

  useEffect(() => {
    if (currentWarehouse?.id) {
      fetchUsers();
    }
  }, [currentWarehouse, fetchUsers]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");

    if (!selectedUser && userData?.id && users.length > 0) {
      const exists = users.some(
        (u) => String(u.id) === String(userData.id)
      );
      if (exists) {
        setSelectedUser(userData.id);
        console.log("✅ Handled By auto-filled:", userData.id);
      }
    }
  }, [users, selectedUser]);

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

  useEffect(() => {
    const sale = location.state?.sale;
    const isEdit = location.state?.editMode === true;
    if (!isEdit || !sale) return;

    if (sale.handled_by_user) {
      setSelectedUser(String(sale.handled_by_user));
      return;
    }

    if (sale.handled_by && Array.isArray(users) && users.length) {
      const wanted = String(sale.handled_by).trim().toLowerCase();
      const match = users.find(
        (u) =>
          `${u.first_name} ${u.last_name}`
            .trim()
            .toLowerCase() === wanted
      );
      if (match) setSelectedUser(String(match.id));
    }
  }, [location.state?.sale, location.state?.editMode, users]);

  useEffect(() => {
    if (!currentWarehouse?.id) return;

    const warehouseId = currentWarehouse.id;

    api
      .get(`/routes/?warehouse=${warehouseId}`)
      .then((res) => setRoutes(res.data))
      .catch((err) => console.error("Failed to fetch routes:", err));

    api
      .get(`/customers/?warehouse=${warehouseId}`)
      .then((res) => {
        console.log("✅ Customers loaded:", res.data);
        setCustomers(res.data);
      })
      .catch((err) => console.error("Failed to fetch customers:", err));
  }, [currentWarehouse]);

  useEffect(() => {
    api
      .get("/transaction-types/")
      .then((res) => {
        console.log("Transaction Types:", res.data);
        setTransactionTypes(res.data);
      })
      .catch((err) => console.error("Failed to fetch transaction types:", err));
  }, []);

  useEffect(() => {
    const warehouseId = getCurrentWarehouse();
    if (!transactionType || !selectedTransactionTypeName || !warehouseId)
      return;

    if (editMode || editingExistingRef.current) return;

    api
      .get("/merchandisings/msp-next/", {
        params: { transaction_type: transactionType, warehouse: warehouseId },
      })
      .then((res) => setMspNo(res.data.msp_no || ""))
      .catch((err) => console.error("MSP preview error:", err));
  }, [
    transactionType,
    selectedTransactionTypeName,
    currentWarehouse?.id,
    editMode,
  ]);

  useEffect(() => {
    setTransactionDate(toDatetimeLocalValue(new Date()));
  }, []);

  const customerInfo = useMemo(() => {
    if (!selectedCustomerId) {
      return { id: null, name: "Walk-in" };
    }

    const customer = customers.find(
      (c) => String(c.id) === String(selectedCustomerId)
    );

    return {
      id: customer?.id || null,
      name: customer?.name || "Walk-in",
    };
  }, [selectedCustomerId, customers]);

  const customerName = customerInfo.name;

  useEffect(() => {
    if (selectedCustomerId) {
      console.log(
        "👤 Customer selected:",
        selectedCustomerId,
        "->",
        customerName
      );
    }
  }, [selectedCustomerId, customerName]);

  const calculateTotalExpenses = () =>
    miscItems.reduce(
      (total, item) => total + parseFloat(item.amount || 0),
      0
    );

  const handledByUser = users.find(
    (u) => String(u.id) === String(selectedUser)
  );
  const handledBy = handledByUser
    ? `${handledByUser.first_name} ${handledByUser.last_name}`.trim()
    : "";

  useEffect(() => {
    console.log("🧮 miscItems state changed:", miscItems);
  }, [miscItems]);

  useEffect(() => {
    const sale = location.state?.sale;
    const isEdit = location.state?.editMode === true;
    if (!sale || !isEdit) return;

    editingExistingRef.current = true;
    setEditMode(true);

    setSelectedTransactionTypeName("Van Load");
    const vanTypeId =
      sale.transaction_type ??
      transactionTypes.find(
        (tt) => tt.name?.toLowerCase() === "van load"
      )?.id;
    if (vanTypeId) setTransactionType(String(vanTypeId));

    if (sale.msp_no) setMspNo(sale.msp_no);

    if (sale.van) {
      const id =
        typeof sale.van === "object" ? sale.van.id : sale.van;
      setSelectedVan(id);
    }
    if (sale.route) {
      const id =
        typeof sale.route === "object" ? sale.route.id : sale.route;
      setRoute(id);
    }

    if (sale.date_time) {
      setTransactionDate(toDatetimeLocalValue(new Date(sale.date_time)));
    }

    if (!products?.length) return;

    (async () => {
      const urls = [
        `/merchandisings/${sale.id}/`,
        `/merchandising/${sale.id}/`,
      ];

      let data = null;
      for (const url of urls) {
        try {
          const res = await api.get(url);
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
        const prodId =
          typeof it.product === "object" ? it.product?.id : it.product;
        const prod = products.find(
          (p) => Number(p.id) === Number(prodId)
        );
        const contentNo = prod?.unit_type?.content_no || 1;
        const pcs = Math.max(
          0,
          Math.round(
            Number(it.dispatched_pcs ?? it.dispatchedPcs ?? 0)
          )
        );
        const price = prod?.price;

        return {
          id: `${sale.id}-${idx}`,
          dbItemId: it.id,
          productId: prodId,
          priceId: price?.id ?? null,
          contentNo,
          dispatchedPcs: pcs,
          dispatchedShell: (pcs / contentNo).toFixed(2),
          sellingPrice: price?.selling_price ?? "",
          shellPrice: price?.shell_price ?? "",
          bottlePrice: price?.bottle_price ?? "",
          expectedSale: Number(
            ((price?.selling_price || 0) * pcs).toFixed(2)
          ),
        };
      });

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
      setTotalExpectedSale(
        mapped.reduce(
          (s, r) => s + (Number(r.expectedSale) || 0),
          0
        )
      );
    })();
  }, [
    location.state?.sale?.id,
    location.state?.editMode,
    products?.length,
    transactionTypes?.length,
  ]);

  const handleSubmit = async (paymentData = null) => {
    const warehouseId = currentWarehouse?.id;
    const isVanLoad =
      (selectedTransactionTypeName || "")
        .trim()
        .toLowerCase() === "van load";

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

    const utcIso = toUtcValue(transactionDate);
    const nz = (v) => Math.max(0, parseInt(v) || 0);

    const handledByUser = users.find(
      (u) => String(u.id) === String(selectedUser)
    );

    const handledBy = handledByUser
      ? `${handledByUser.first_name} ${handledByUser.last_name}`.trim()
      : "";

    if (!transactionType) {
      showAlert("Please select a transaction type.");
      return false;
    }

    if (!selectedUser) {
      showAlert("Please select who is handling this transaction.");
      return false;
    }

    const validItems = rows.filter(
      (r) => r.productId && r.productId !== ""
    );
    if (validItems.length === 0) {
      showAlert("Please add at least one product to the transaction.");
      return false;
    }

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
      customer: selectedCustomerId ? Number(selectedCustomerId) : null,
      handled_by: String(selectedUser) || null,
      date_time: utcIso,
      expected_sale: Number(totalExpectedSale) || 0,
      actual_sale: Number(totalActualSale) || 0,
      discrepancy_empty:
        selectedTransactionTypeName === "Warehouse"
          ? Number(discrepancyEmptyTotal || 0)
          : 0,
      empties_price_total:
        selectedTransactionTypeName === "Warehouse"
          ? Number(emptiesPriceTotal || 0)
          : 0,
      empty_returns:
        selectedTransactionTypeName === "Warehouse"
          ? Number(refundablesTotal || 0)
          : 0,
      invoice_no: "",
      status:
        selectedTransactionTypeName === "Van Load"
          ? "Pending"
          : "Complete",
      remarks: "",
      items: validItems.map((row) => {
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
          base.empty_return_shell = nz(row.expectedReturnShellEmpty);
        }
        return base;
      }),
      misc_items: (sourceMiscItems || []).map((item) => ({
        description: item.description || "",
        amount: Number(item.amount) || 0,
      })),
      miscellaneous: Number(
        (sourceMiscItems || []).reduce(
          (s, i) => s + Number(i.amount || 0),
          0
        )
      ),
    };

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
      items_count: payload.items.length,
      misc_items_count: payload.misc_items.length,
      status: payload.status,
    });
    console.log("📦 Full payload:", payload);
    console.log("🧾 misc_items about to POST:", payload.misc_items);

    try {
      const response = await api.post("/merchandisings/", payload);
      const merchandising = response.data;
      console.log(
        "✅ Step 1: Transaction created successfully:",
        merchandising
      );

      if (isVanLoad) {
        notifyVanLoadCreated(merchandising);
        console.log(
          `🚛 Van Load creation notification sent for: ${merchandising.msp_no}`
        );
      } else if (selectedTransactionTypeName === "Warehouse") {
        notifyWarehouseMspCreated(merchandising);
        console.log(
          `🏭 Warehouse MSP creation notification sent for: ${merchandising.msp_no}`
        );
      }

      if (paymentData && paymentData.paymentMethod !== "credit") {
        const paymentPayload = {
          method: paymentData.paymentMethod || "cash",
          amount:
            Number(paymentData.cashReceived) ||
            Number(paymentData.amount) ||
            0,
          merchandising: merchandising.id,
          payment_date: new Date().toISOString().split("T")[0],
          change_amount: Number(paymentData.change) || 0,
          payment_status: "completed",
        };

        console.log("🚀 Step 2: Creating payment:", paymentPayload);

        try {
          const paymentResponse = await api.post(
            "/payments/",
            paymentPayload
          );
          console.log(
            "✅ Step 2: Payment created successfully:",
            paymentResponse.data
          );
        } catch (paymentError) {
          console.error(
            "❌ Payment creation failed:",
            paymentError.response?.data || paymentError.message
          );
          console.warn(
            "🔶 Transaction saved successfully, but payment recording failed. Payment can be added manually later."
          );
        }
      } else if (paymentData && paymentData.paymentMethod === "credit") {
        console.log("💳 Credit payment - no immediate payment record needed");
      }

      showAlert("Transaction saved successfully!");
      return merchandising;
    } catch (error) {
      console.error("❌ Transaction creation failed:", error);

      if (error.response?.status === 400) {
        const errorData = error.response.data;
        console.error("🔍 Detailed 400 error:", errorData);

        const errorMessages = [];

        if (errorData.payments) {
          errorMessages.push(
            `Payment errors: ${JSON.stringify(errorData.payments)}`
          );
        }
        if (errorData.items) {
          errorMessages.push(
            `Item errors: ${JSON.stringify(errorData.items)}`
          );
        }
        if (errorData.customer) {
          errorMessages.push(
            `Customer errors: ${JSON.stringify(errorData.customer)}`
          );
        }
        if (errorData.warehouse) {
          errorMessages.push(
            `Warehouse errors: ${JSON.stringify(errorData.warehouse)}`
          );
        }
        if (errorData.non_field_errors) {
          errorMessages.push(
            `General errors: ${errorData.non_field_errors.join(", ")}`
          );
        }

        if (errorMessages.length === 0) {
          errorMessages.push(
            `Validation error: ${JSON.stringify(errorData)}`
          );
        }

        showAlert(errorMessages.join("\n"));
      } else if (error.response?.status === 401) {
        showAlert("Authentication failed. Please login again.");
        navigate("/login");
      } else if (error.response?.status === 403) {
        showAlert("You don't have permission to perform this action.");
      } else if (error.response?.status === 500) {
        console.error(
          "🔥 500 Server Error Details:",
          error.response?.data
        );
        showAlert(
          "Server error occurred. Please check the console for details and contact support."
        );
      } else {
        showAlert(`Failed to save transaction: ${error.message}`);
      }
      return false;
    }
  };

  const handleFinalizeSale = async () => {
    const success = await handleSubmit();
    if (!success) return;

    const wid = currentWarehouse?.id;
    if (!wid) {
      showAlert("Warehouse not found for stock deduction.");
      return;
    }

    if (!dispatchAdjustments?.length) {
      navigate("/trading");
      return;
    }

    try {
      await api.post("/stocks/bulk-adjust/", {
        warehouse: Number(wid),
        items: dispatchAdjustments,
        reason: "van_load_dispatch",
      });

      window.dispatchEvent(new Event("stocksChanged"));

      navigate("/trading");
    } catch (err) {
      console.error(
        "Stock deduction failed:",
        err?.response?.data || err.message
      );
      showAlert(
        err?.response?.data?.detail ||
          "Transaction saved, but stock deduction failed."
      );
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

  const handleSaveVanLoadEdit = async () => {
    const incomingSale = location.state?.sale;
    if (!incomingSale?.id) {
      showAlert("Sale not found.");
      return;
    }

    const handler = users.find(
      (u) => String(u.id) === String(selectedUser)
    );
    const handled_by = handler
      ? `${handler.first_name} ${handler.last_name}`.trim()
      : incomingSale.handled_by || "";
    const handled_by_user = handler ? Number(handler.id) : undefined;

    const items = rows
      .filter((r) => Number(r.productId))
      .map((r) => {
        const pcs = Math.max(
          0,
          parseInt(r.dispatchedPcs) || 0
        );
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
      handled_by,
      ...(handled_by_user ? { handled_by_user } : {}),
      items,
      expected_sale: Number(totalExpectedSale) || 0,
      status: "Pending",
    };

    try {
      await api.patch(
        `/merchandisings/${incomingSale.id}/`,
        payload
      );

      showAlert("Van Load updated.");

      navigate(`/merchandising-sale/${incomingSale.id}`, {
        state: {
          sale: { ...incomingSale, handled_by, handled_by_user },
          editMode: true,
        },
      });
    } catch (e) {
      console.error(
        "Failed to save Van Load edits:",
        e?.response?.data || e.message
      );
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
                const selected = transactionTypes.find(
                  (tt) => String(tt.id) === selectedId
                );
                setTransactionType(selectedId);
                setSelectedTransactionTypeName(selected?.name || "");
              }}
              className="border w-full rounded-md px-2 py-1 text-sm"
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
            <label className="text-sm mb-1 block">Handled By</label>
            <input
              type="text"
              value={
                users.find((u) => u.id === selectedUser)
                  ? `${users.find((u) => u.id === selectedUser)
                      .first_name || ""} ${
                      users.find((u) => u.id === selectedUser)
                        .last_name || ""
                    }`.trim() ||
                    users.find((u) => u.id === selectedUser).username ||
                    `User #${selectedUser}`
                  : ""
              }
              readOnly
              className="border w-full rounded-md px-2 py-1 text-black text-base bg-white cursor-default"
            />
            <input type="hidden" name="handled_by" value={selectedUser} />
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col space-y-4 w-full md:w-1/2">
          <div>
            <label className="text-sm">Date/Time</label>
            <input
              type="datetime-local"
              className="w-full rounded-md px-2 py-1 text-sm no-picker"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              readOnly
            />
          </div>

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
                        (c) =>
                          c.name?.toLowerCase() ===
                          newCustomer.toLowerCase()
                      );
                      if (exists) {
                        showAlert(
                          `Customer "${newCustomer}" already exists.`
                        );
                        setIsAddingCustomer(false);
                        return;
                      }

                      try {
                        const res = await api.post("/customers/", {
                          name: newCustomer,
                          warehouse: currentWarehouse?.id,
                        });
                        console.log("✅ New customer created:", res.data);
                        setCustomers((prev) => [...prev, res.data]);
                        setSelectedCustomerId(res.data.id);
                      } catch (error) {
                        console.error(
                          "❌ Error saving new customer:",
                          error
                        );
                        showAlert(
                          "Failed to save customer. Please try again."
                        );
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

          {selectedTransactionTypeName === "Van Load" && (
            <>
              <div>
                <label className="text-sm mb-1 block">Van</label>
                <select
                  value={selectedVan}
                  onChange={(e) => setSelectedVan(e.target.value)}
                  className="border w-full rounded-md px-2 py-1 text-black text-base"
                >
                  <option value="" disabled hidden>
                    Select Van
                  </option>
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
                          (r) =>
                            r.route_name.toLowerCase() ===
                            newRouteName.toLowerCase()
                        );
                        if (existing) {
                          showAlert(
                            `Route "${newRouteName}" already exists. Selected it for you.`
                          );
                          setRoute(existing.id);
                          setIsAddingRoute(false);
                          return;
                        }

                        try {
                          const res = await api.post("/routes/", {
                            route_name: newRouteName,
                            warehouse: currentWarehouse?.id,
                          });

                          const newRoute = res.data;
                          setRoutes((prev) => [...prev, newRoute]);
                          setRoute(newRoute.id);
                          console.log("✅ New route created:", newRoute);
                        } catch (error) {
                          console.error(
                            "❌ Error saving new route:",
                            error
                          );
                          console.error(
                            "❌ Error details:",
                            error.response?.data
                          );

                          const errorMsg =
                            error.response?.data?.detail ||
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
                    <option value="" disabled hidden>
                      Select Route
                    </option>
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
          setDiscrepancyEmptyTotal={setDiscrepancyEmptyTotal}
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
        <ActionButtons
          transactionType={selectedTransactionTypeName}
          onBack={() => navigate(-1)}
          onFinalize={handleFinalizeSale}
          onPay={handlePay}
          finalizeDisabled={
            selectedTransactionTypeName === "Van Load" &&
            !dispatchAdjustments.length
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
        emptyDiscrepancies={
          selectedTransactionTypeName === "Warehouse"
            ? discrepancyEmptyTotal
            : discrepancy
        }
        totalAdjustments
        mspNo={mspNo}
        customerName={customerName}
        customer={customerInfo}
        handledBy={handledBy}
        totalAmount={totalAmount}
        onSave={handleSubmit}
        transactionDate={transactionDate}
        transactionTypeName={selectedTransactionTypeName}
        transactionTypes={transactionTypes}
        expensesTotal={miscItems.reduce(
          (s, i) => s + Number(i.amount || 0),
          0
        )}
        miscItems={miscItems}
      />
    </div>
  );
};

export default MerchandisingSale;
