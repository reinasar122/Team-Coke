import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VanLoadTable from "../components/merchandisingcomponents/VanLoadTable";
import api from "../api"; // ✅ correct


//const API = "http://localhost:8080/api";

// format to <input type="datetime-local">
const toDatetimeLocalValue = (date = new Date()) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};


// Show UTC date in Manila time
const formatToManila = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d)) return "";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(d);
};



const peso = (x) =>
  `₱${Number(x || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function MerchandisingSaleDetailPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const sale = state?.sale;

  // ⬅️ ADDED: normalize handled_by to a string id
  const toUserIdString = (hb, usersList = []) => {
    if (hb === null || hb === undefined) return "";

    // If backend returned a user object
    if (typeof hb === "object" && hb.id != null) return String(hb.id);

    // If backend returned a name string, map it to an id from users
    if (typeof hb === "string" && isNaN(Number(hb))) {
      const match = usersList.find(
        u =>
          `${u.first_name} ${u.last_name}`.trim() === hb.trim() ||
          (u.username && u.username.trim() === hb.trim())
      );
      return match ? String(match.id) : "";
    }

    // Otherwise assume it's already an id
    return String(hb);
  };

  const [currentWarehouse, setCurrentWarehouse] = useState(null);


  // view / modals
  const [showHandlerDetails, setShowHandlerDetails] = useState(false);
  const [showProductStock, setShowProductStock] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // inline edit
  const [editMode, setEditMode] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalExpectedSale, setTotalExpectedSale] = useState(0);
  const [transactionDate, setTransactionDate] = useState(() =>
    toDatetimeLocalValue()
  );
  const [selectedVan, setSelectedVan] = useState("");
  const [route, setRoute] = useState("");
  const [vans, setVans] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [originalRows, setOriginalRows] = useState([]); 

  // data for table
  const [products, setProducts] = useState([]);
  const [saleItems, setSaleItems] = useState([]); // merchandising.items normalized
  const [availableStock, setAvailableStock] = useState({}); // productId -> pcs

  const [users, setUsers] = useState([]);

  // ⬅️ CHANGED: initialize from sale?.handled_by using the helper
  const [selectedUser, setSelectedUser] = useState(() =>
    toUserIdString(sale?.handled_by)
  );


  const [saleDetail, setSaleDetail] = useState(sale);

 const [totalExpectedSaleWithoutDiscount, setTotalExpectedSaleWithoutDiscount] = useState(0);

  // Callback function to receive updated rows and calculate the total expectedSaleWithoutDiscount
  const handleTotalExpectedSaleWithoutDiscount = (rows) => {
    const total = rows.reduce((sum, row) => sum + row.expectedSaleWithoutDiscount, 0);
    setTotalExpectedSaleWithoutDiscount(total);
  };

    
  const handlerName = useMemo(() => {
    const hb = saleDetail?.handled_by ?? sale?.handled_by;
    if (!hb) return "";

    // If backend returns a user object
    if (typeof hb === "object") {
      const { first_name = "", last_name = "" } = hb;
      return `${first_name} ${last_name}`.trim();
    }

    // If backend returns an ID
    const match = users.find(u => Number(u.id) === Number(hb));
    if (match) return `${match.first_name} ${match.last_name}`.trim();

    // If backend returns a plain name string, just show it
    return String(hb);
  }, [saleDetail?.handled_by, sale?.handled_by, users]);



  // Only show: (in-stock in this warehouse) ∪ (already used in current rows)
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) return [];

    // products that have > 0 available in this warehouse
    const inStockIds = new Set(
      Object.entries(availableStock)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([pid]) => Number(pid))
    );

    // products already present on the ticket (keep even if out of stock now)
    const usedIds = new Set(
      (rows || [])
        .map(r => Number(r.productId))
        .filter(Boolean)
    );

    const keepIds = new Set([...inStockIds, ...usedIds]);
    return products.filter(p => keepIds.has(Number(p.id)));
  }, [products, availableStock, rows]);




  const isVanLoad = (sale?.transaction_type_name || "").toLowerCase() === "van load";
  const isComplete = (sale?.status || "").toLowerCase() === "complete";

  const showAlert = (message) => {
    const alertDiv = document.createElement("div");
    alertDiv.className =
      "fixed inset-0 bg-black/50 flex items-center justify-center z-50";
    alertDiv.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <p class="text-gray-700 mb-4">${message}</p>
        <div class="flex justify-end">
          <button class="btn btn-primary" onclick="this.closest('.fixed').remove()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(alertDiv);
  };


  // === normalize sale route/van and compute display strings ===
  const saleRouteId = typeof sale?.route === "object" ? sale.route?.id : sale?.route;
  const saleVanId   = typeof sale?.van   === "object" ? sale.van?.id   : sale?.van;

  const routeDisplay = useMemo(() => {
    if (sale?.route?.route_name) return sale.route.route_name;
    if (sale?.route_name) return sale.route_name;
    const id = Number(route || saleRouteId);
    const found = routes.find(r => Number(r.id) === id);
    return found?.route_name || "";
  }, [sale?.route, sale?.route_name, routes, route, saleRouteId]);

  const vanDisplay = useMemo(() => {
    if (sale?.van?.van_id) {
      return `${sale.van.van_id} - ${sale.van.plate_number || ""}`.trim();
    }
    if (sale?.van_name || sale?.van_plate) {
      return `${sale.van_name || ""} - ${sale.van_plate || ""}`.trim();
    }
    const id = Number(selectedVan || saleVanId);
    const found = vans.find(v => Number(v.id) === id);
    return found ? `${found.van_id} - ${found.plate_number}` : "";
  }, [sale?.van, sale?.van_name, sale?.van_plate, vans, selectedVan, saleVanId]);




  /* ---------------------------------------
     Load current warehouse (keep your logic)
  ----------------------------------------*/
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(
      localStorage.getItem("selectedWarehouse") || "null"
    );

    if ((user.role || "").toLowerCase() === "admin") {
      setCurrentWarehouse(
        selectedWarehouse || { id: user.warehouse_id, name: user.warehouse }
      );
    } else {
      setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
    }

    const handleWarehouseChange = (event) => {
      const { warehouse } = event.detail || {};
      if (warehouse) {
        setCurrentWarehouse(warehouse);
      } else {
        setCurrentWarehouse({ id: user.warehouse_id, name: user.warehouse });
      }
    };
    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () =>
      window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, []);



  useEffect(() => {
    if (saleItems.length > 0 && rows.length === 0) {
      // Only initialize rows and originalRows if rows haven't been modified by the user
      const initializedRows = saleItems.map((item) => ({
        ...item, // spread all fields
        sellingPrice: item.sellingPricePc, // Ensure selling price is included
      }));
      setRows(initializedRows);
      setOriginalRows(initializedRows);
    }
  }, [saleItems, rows]); // Add rows to the dependency array to ensure it's only set if empty

  // Ensure that originalRows are reset properly when canceling the edit
  const handleCancelEdit = () => {
    setRows(originalRows); // Revert to original data, which includes sellingPrice
    setEditMode(false);
  };



  /* -------------------------
     Load products + pricing
  --------------------------*/
  const loadProducts = useCallback(async () => {
  try {
    const res = await api.get(`/products/`);
    const list = Array.isArray(res.data) ? res.data : [];
    setProducts(list);
    return list;                     // <-- add this
  } catch (e) {
    console.error("Failed to load products:", e);
    setProducts([]);
    return [];                       // <-- add this
  }
}, []);


  /* -----------------------------------
     Load merchandising detail (items)
  ------------------------------------*/
const loadMerchandisingDetail = useCallback(
  async (id, prodListParam) => {
    if (!id) return;
    const urls = [`/merchandisings/${id}/`, `/merchandising/${id}/`];
    let data = null;
    for (const url of urls) {
      try {
        const r = await api.get(url);
        data = r.data;
        break;
      } catch {}
    }
    if (!data) {
      showAlert("Could not load merchandising detail.");
      return;
    }

    // Update saleDetail
    setSaleDetail(data);

    const prodList = Array.isArray(prodListParam) && prodListParam.length
      ? prodListParam
      : products;

    const items = Array.isArray(data.items) ? data.items : [];

    const mapped = items.map((it) => {
      const productId = typeof it.product === "object" ? it.product?.id : it.product;
      const productObj =
        (typeof it.product === "object" && it.product) ||
        prodList.find((p) => Number(p.id) === Number(productId));

      const price = productObj?.price || {};
      const contentNo = productObj?.unit_type?.content_no ?? it.product?.unit_type?.content_no ?? 1;

      const dispatchedPcs = Number(it.dispatched_pcs || it.dispatchedPcs || 0);
      const dispatchedShell =
        it.dispatched_shell !== undefined && it.dispatched_shell !== null
          ? Number(it.dispatched_shell)
          : contentNo > 0 ? Math.floor(dispatchedPcs / contentNo) : 0;

      const expectedSaleWithoutDiscount = Number(
        (Number(price.selling_price || 0) * dispatchedPcs).toFixed(2)
      );

      const expectedSale = Number(
        (Number(price.selling_price || 0) * dispatchedPcs * (1 - Number(it.discount_percent || 0) / 100)).toFixed(2)
      );

      return {
        id: it.id,
        productId,
        productName: productObj?.product_name || "",
        contentNo,
        sellingPricePc: Number(price.selling_price || 0),
        shellPrice: Number(price.shell_price || 0),
        bottlePrice: Number(price.bottle_price || 0),
        dispatchedPcs,
        dispatchedShell,
        discount: Number(it.discount_percent || 0),
        expectedSaleWithoutDiscount,  // This is where it's calculated
        expectedSale,
      };
    });

    setSaleItems(mapped);

    const editRows = [
      ...mapped.map((m, i) => ({
        id: `${id}-${i}`,
        dbItemId: m.id,
        productId: m.productId,
        productName: m.productName,
        priceId: prodList.find((p) => Number(p.id) === Number(m.productId))?.price?.id ?? null,
        contentNo: m.contentNo,
        dispatchedPcs: m.dispatchedPcs,
        dispatchedShell: m.dispatchedShell,
        sellingPrice: m.sellingPricePc,
        shellPrice: m.shellPrice,
        bottlePrice: m.bottlePrice,
        discount: m.discount || 0,
        expectedSale: m.expectedSale,
        expectedSaleWithoutDiscount: m.expectedSaleWithoutDiscount, // add expectedSaleWithoutDiscount here
      })),
      {
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
      },
    ];
    setRows(editRows);

    // Calculate total expected sale
    setTotalExpectedSale(
      editRows.reduce((s, r) => s + (Number(r.expectedSale) || 0), 0)
    );

    // Pass total expectedSaleWithoutDiscount to parent (for the callback)
    const totalWithoutDiscount = editRows.reduce((sum, row) => sum + row.expectedSaleWithoutDiscount, 0);
    setTotalExpectedSaleWithoutDiscount(totalWithoutDiscount);
  },
  [products]
);



  // load availability for all products in the warehouse (one shot)
  const loadAvailableStock = useCallback(
    async (warehouseId) => {
      if (!warehouseId) return setAvailableStock({});
      try {
        const { data } = await api.get(`/stocks/`, {
          params: { warehouse: warehouseId },
        });
        const map = {};
        (Array.isArray(data) ? data : [data]).forEach((row) => {
          const pid = Number(row.product_id ?? row.product);
          if (pid) map[pid] = Number(row.quantity_available) || 0;
        });
        setAvailableStock(map);
      } catch (e) {
        console.error("Failed to load stocks:", e);
        setAvailableStock({});
      }
    },
    []
  );

  useEffect(() => {
    api.get(`/users/`)
      .then(res => setUsers(res.data))
      .catch(err => console.error("Error fetching users:", err));
  }, []);

  // ⬅️ ADDED: keep selectedUser in sync when users and data are available
  useEffect(() => {
    const source = saleDetail?.handled_by ?? sale?.handled_by;
    const idStr = toUserIdString(source, users);
    setSelectedUser(idStr);
  }, [saleDetail?.handled_by, sale?.handled_by, users]);




  // vans & routes for edit header
  useEffect(() => {
    if (!isVanLoad || !currentWarehouse?.id) return;
    api
      .get(`/vans/`)
      .then((res) => setVans(res.data || []))
      .catch(() => setVans([]));

    api
      .get(`/routes/`, { params: { warehouse: currentWarehouse.id } })
      .then((res) => setRoutes(res.data || []))
      .catch(() => setRoutes([]));
  }, [isVanLoad, currentWarehouse?.id]);

  // initial loads
  useEffect(() => {
    (async () => {
      const prodList = await loadProducts();             // get fresh list
      await loadMerchandisingDetail(sale?.id, prodList); // pass it here
      await loadAvailableStock(currentWarehouse?.id);
      if (sale?.date_time) setTransactionDate(toDatetimeLocalValue(new Date(sale.date_time)));
      setSelectedVan(typeof sale?.van === "object" ? sale?.van?.id : sale?.van || "");
      setRoute(typeof sale?.route === "object" ? sale?.route?.id : sale?.route || "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id, currentWarehouse?.id, loadProducts]);


  const handleSaveVanLoadEdit = async () => {
  if (!sale?.id) return showAlert("Sale not found.");

  const items = rows
    .filter((r) => Number(r.productId))
    .map((r) => {
      const pcs = Math.max(0, parseInt(r.dispatchedPcs) || 0);
      return {
        id: r.dbItemId || undefined,
        product: Number(r.productId),
        dispatched_pcs: pcs,
        dispatched_shell: Number.isFinite(Number(r.dispatchedShell)) ? Number(r.dispatchedShell) : 0,
        discount_percent: Number(r.discount) || 0,
      };
    });

  const payload = {
    route: route ? Number(route) : null,
    van: selectedVan ? Number(selectedVan) : null,
    handled_by: selectedUser ? Number(selectedUser) : null,
    date_time: new Date(transactionDate).toISOString(),
    items,
    expected_sale: Number(totalExpectedSale) || 0,
    status: "Pending",
  };

  // Check stock availability before making the request
  try {
    for (const item of items) {
      const availableQty = availableStock[item.product];
      if (availableQty == null || availableQty < item.dispatched_pcs) {
        return showAlert(`Not enough stock for product ${item.product}`);
      }
    }

    // Save the Van Load data
    await api.patch(`/merchandisings/${sale.id}/`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    // After saving the Van Load, adjust the available stock
    items.forEach(async (item) => {
      const availableQty = availableStock[item.product];
      const prevDispatched = saleItems.find((si) => si.productId === item.product)?.dispatchedPcs || 0;

      // Calculate the delta (change in dispatched pcs)
      const delta = item.dispatched_pcs - prevDispatched; // Positive for addition, negative for deduction
      console.log(`Delta for product ${item.product}: ${delta}`);

      if (availableQty != null) {
        // Handle stock deduction if delta is positive (we added more dispatches)
        if (delta > 0) {
          const pcsToDeduct = delta; // Deduct stock for added dispatch
          if (availableQty >= pcsToDeduct) {
            await api.patch('/stocks/update/', {
              product_id: item.product,
              quantity: pcsToDeduct,
              warehouse_id: currentWarehouse?.id,
              action_type: "subtract",  // Deduct stock
            })
              .then(response => {
                console.log("Stock deducted successfully:", response.data);
                // Update local state after successful deduction
                setAvailableStock(prev => ({ ...prev, [item.product]: prev[item.product] - pcsToDeduct }));
              })
              .catch(error => {
                console.error("Error deducting stock:", error?.response?.data);
              });
          } else {
            showAlert(`Not enough stock to deduct for product ${item.product}`);
          }
        }
        // Handle stock addition if delta is negative (we reduced the dispatch quantity)
        else if (delta < 0) {
          const pcsToAdd = Math.abs(delta); // Add stock for reduced dispatch
          await api.patch('/stocks/update/', {
            product_id: item.product,
            quantity: pcsToAdd,
            warehouse_id: currentWarehouse?.id,
            action_type: "add",  // Add stock back
          })
            .then(response => {
              console.log("Stock added successfully:", response.data);
              // Update local state after successful addition
              setAvailableStock(prev => ({ ...prev, [item.product]: prev[item.product] + pcsToAdd }));
            })
            .catch(error => {
              console.error("Error adding stock:", error?.response?.data);
            });
        }
      }
    });

    showAlert("Van Load updated.");
    setEditMode(false);
    await loadMerchandisingDetail(sale.id);

  } catch (e) {
    console.error("Failed to save Van Load edits:", e?.response?.data || e.message);
    showAlert("Failed to save changes.");
  }
};






  /* -----------------------
     Simple supporting modals
  ------------------------*/
  const handlerInfo = useMemo(
    () => ({
      user_name: sale?.handled_by,
      warehouse_name: sale?.warehouse_name || currentWarehouse?.name,
      user_role: "Staff",
      date_handled: sale?.date_time,
      contact: "N/A",
    }),
    [sale, currentWarehouse?.name]
  );

  if (!sale) {
    return <div className="p-6 text-red-600">No sale data available.</div>;
  }

  // ---------- READ-ONLY Van-Load-style table for the detail page ----------
  function ReadOnlyVanLoadTable({ items, availableStock }) {
    const pesoLocal = (x) =>
      `₱${Number(x || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    return (
      <div className="table-wrapper overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="border px-2 py-2 text-left">Product</th>
               <th className="border px-2 py-2 text-center">Available</th>
              <th className="border px-2 py-2 text-center" colSpan={2}>Dispatched</th>
              <th className="border px-2 py-2 text-center">Selling Price</th>
              <th className="border px-2 py-2 text-center" colSpan={2}>Empty Price</th>
              <th className="border px-2 py-2 text-center">Discount (%)</th> 
              {/* Always render the Expected Sale column */}
              <th className="border">
                Expected Sale without Discount
              </th>

              {/* Always render Expected Sale with Discount header */}
              <th className="border">Expected Sale with Discount</th>
             
            </tr>
            <tr className="bg-slate-100">
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1 text-center">PCS</td>
              <td className="border px-2 py-1 text-center">Shell</td>
              <td className="border px-2 py-1 text-center">PCS</td>
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1 text-center">Shell</td>
              <td className="border px-2 py-1 text-center">PCS</td>
              <td className="border px-2 py-1 text-center">%</td> {/* ✅ clearer indicator */}
              <td className="border px-2 py-1 text-center">PCS</td>
              <td className="border px-2 py-1 text-center">PCS</td>
              
            </tr>
          </thead>

          <tbody className="bg-white">
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text" colSpan={8}>
                  No products.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const avail = availableStock[Number(it.productId)];
                const showAvail =
                  typeof avail === "number" || avail === 0 ? avail : "--";

                return (
                  <tr key={it.id} className="hover:bg-gray-50 transition">
                    {/* PRODUCT */}
                    <td className="border border-gray-200 py-1 px-1 w-[240px]">
                      <input
                        readOnly
                        className="w-full text-md text-left rounded py-1 px-2 bg-white border"
                        value={it.productName || ""}
                      />
                    </td>
                    
                     {/* AVAILABLE (PCS) */}
                    <td className="border border-gray-200 py-1 px-1 text-sm text-center">
                      {showAvail}
                    </td>

                                {/* DISPATCHED - SHELL */}
                  <td className="border border-gray-200 py-1 px-1">
                    <input
                      readOnly
                      className="input-always-spinner input text-center bg-yellow-50 w-full"
                      value={it.dispatchedShell !== undefined && it.dispatchedShell !== null
                        ? (Number(it.dispatchedShell) % 1 === 0
                            ? parseInt(it.dispatchedShell)
                            : Number(it.dispatchedShell).toFixed(2))
                        : ""}

                    />
                  </td>

                  {/* DISPATCHED - PCS */}
                  <td className="border border-gray-200 py-1 px-1">
                    <input
                      readOnly
                      className="input-always-spinner input text-center bg-yellow-50 w-full"
                      value={it.dispatchedPcs 
                        ? (parseFloat(it.dispatchedPcs) === 0 
                            ? '0' 
                            : (parseFloat(it.dispatchedPcs) % 1 === 0 ? parseInt(it.dispatchedPcs) : parseFloat(it.dispatchedPcs).toFixed(2))) 
                        : ""}
                    />
                  </td>



                    {/* SELLING PRICE (PCS) */}
                    <td className="border border-gray-200 py-1 px-1">
                      <input
                        readOnly
                        className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                        value={it.sellingPricePc !== "" && it.sellingPricePc != null
                          ? `₱${Number(it.sellingPricePc).toFixed(2)}`
                          : ""}
                      />
                    </td>

                    {/* EMPTY PRICE - SHELL */}
                    <td className="border border-gray-200 py-1 px-1">
                      <input
                        readOnly
                        className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                        value={it.shellPrice !== "" && it.shellPrice != null
                          ? `₱${Number(it.shellPrice).toFixed(2)}`
                          : ""}
                      />
                    </td>

                    {/* EMPTY PRICE - PCS */}
                    <td className="border border-gray-200 py-1 px-1">
                      <input
                        readOnly
                        className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                        value={it.bottlePrice !== "" && it.bottlePrice != null
                          ? `₱${Number(it.bottlePrice).toFixed(2)}`
                          : ""}
                      />
                    </td>


                    {/* DISCOUNT (%) */}
                    <td className="border border-gray-200 py-1 px-1">
                      <input
                        readOnly
                        className="w-full p-1 text-sm text-center bg-gray-100 border rounded"
                        value={
                          it.discount !== undefined && it.discount !== null
                            ? `${parseFloat(it.discount).toFixed(2)}%`
                            : ""
                        }
                      />
                    </td>

                  {/* Expected Sale without Discount */}
                    <td className="border border-gray-200 py-1 px-1">
                      <input
                        readOnly
                        className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium border rounded"
                        value={
                          // Use it.expectedSaleWithoutDiscount to reference the value directly
                          Number.isFinite(Number(it.expectedSaleWithoutDiscount))
                            ? pesoLocal(it.expectedSaleWithoutDiscount)  // Format it properly
                            : ""
                        }
                      />
                    </td>


                  {/* EXPECTED SALE WITH DISCOUNT */}
                    {it.discount > 0 ? (
                      <td className="border border-gray-200 py-1 px-1">
                        <input
                          readOnly
                          className="w-full p-1 text-center bg-gray-50 text-gray-800 font-medium border rounded"
                          value={Number.isFinite(Number(it.expectedSale)) ? pesoLocal(it.expectedSale) : ""}
                        />
                      </td>
                    ) : (
                      <td className="border border-gray-200 py-1 px-1"></td> // Empty cell if no discount
                    )}


                   
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // ==== UI ====
  const topBar = (
    <div className=" mb-6">
       {!editMode && isVanLoad && !isComplete && (
        <div className="flex gap-3 justify-end">
          <button
            className="btn btn-edit"
            onClick={() => setEditMode(true)}
          >
            Edit Van Load
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              navigate("/van-load-update", {
                state: { id: sale.id, warehouse: currentWarehouse, mode: "receive" },
              })
            }
          >
            Receive Return
          </button>
        </div>
      )}

      {editMode && (
        <div className="flex gap-3 justify-end">
          <button
            className="btn btn-cancel"
            onClick={handleCancelEdit} // Ensure this resets rows to original data
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveVanLoadEdit} // Trigger save logic
          >
            Save Changes
          </button>
        </div>
      )}

      <div>
        <span className="text">Current Warehouse: </span>
        <span className="font-bold text-lg">
          {currentWarehouse?.name || "No Warehouse Selected"}
        </span>
      </div>   
    </div>
  );

  const InfoField = ({ label, value }) => (
    <div className="flex flex-col gap-1">
      <label className="text">{label}</label>
      <input
        value={value ?? ""}
        readOnly
        className="w-full bg-gray-100 text rounded px-3 py-2"
      />
    </div>
  );

  const headerCard = (
    <div className="border-none p-6">
      <div className=" p-1">
         <h2 className="text-2xl font-bold mb-6">Van Load Details</h2>
      </div>
     
      {/* view mode header grid */}
      {!editMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <InfoField label="MSP No" value={sale.msp_no} />
          <InfoField label="Date Time" value={formatToManila(sale.date_time)} />
          {/*<InfoField
            label="Warehouse"
            value={sale.warehouse_name || currentWarehouse?.name || "N/A"}
          />*/}
          <InfoField label="Transaction Type" value={sale.transaction_type_name} />
          <InfoField label="Route" value={routeDisplay} />
          <InfoField label="Van"   value={vanDisplay} />

          <div className="flex flex-col gap-1">
            <label className="text-sm text">Handled By</label>
            <div className="w-full rounded px-3 py-2 bg-gray-100 text">
              {handlerName}
            </div>
          </div>

        </div>
      )}

    
      {/* edit header controls to match your flow (date/handled/route/van) */}
      {editMode && isVanLoad && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left column */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text">Date Time</label>
              <input
                type="datetime-local"
                className="w-full rounded px-3 py-2 border"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text">Handled By</label>
              <select
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded px-3 py-2 border"
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

          {/* Right column */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text">Route</label>
              <select
                className="w-full rounded px-3 py-2 border"
                value={route || ""}
                onChange={(e) => setRoute(e.target.value)}
              >
                <option value="">Select Route</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.route_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text">Van</label>
              <select
                className="w-full rounded px-3 py-2 border"
                value={selectedVan || ""}
                onChange={(e) => setSelectedVan(e.target.value)}
              >
                <option value="">Select Van</option>
                {vans.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.van_id} - {v.plate_number}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}


      {/* Products */}
      {!editMode && (
        <>
          <h3 className="mt-8 mb-3 text-lg font-semibold">Products</h3>
          <ReadOnlyVanLoadTable items={saleItems} availableStock={availableStock} />
        </>
      )}

      {/* Inline editor */}
      {editMode && isVanLoad && (
        <div className="mt-6">
          <VanLoadTable
            rows={rows}
            setRows={setRows}
            products={filteredProducts}
            warehouseId={currentWarehouse?.id}
            setTotalExpectedSale={setTotalExpectedSale}
            onAdjustmentsChange={handleTotalExpectedSaleWithoutDiscount}  // Add callback here
            defaultDiscount={0}
          />
        </div>
          
      )}
    </div>
  );

  return (
    <div className="p-6">
      {topBar}
      {headerCard}

      {/* Handler details (simple inline panel to keep page lightweight) */}
      {/* {showHandlerDetails && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-start">
            <h4 className="text-lg font-semibold text mb-3">Handler Details</h4>
            <button
              onClick={() => setShowHandlerDetails(false)}
              className="text-blue-600 hover:text-blue-800 text-xl"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="font-medium text">User Name:</span>
              <p className="text">{handlerInfo.user_name}</p>
            </div>
            <div>
              <span className="font-medium text">Warehouse:</span>
              <p className="text">{handlerInfo.warehouse_name}</p>
            </div>
            <div>
              <span className="font-medium text">Role:</span>
              <p className="text">{handlerInfo.user_role}</p>
            </div>
            <div>
              <span className="font-medium text">Date Handled:</span>
              <p className="text">{handlerInfo.date_handled}</p>
            </div>
            <div>
              <span className="font-medium text-blue-700">Contact:</span>
              <p className="text-blue-900">{handlerInfo.contact}</p>
            </div>
          </div>
        </div>
      )} */}

      {/* Back */}
      <div className="flex justify-end mt-6">
        <button
          className="btn btn-back"
          onClick={() => navigate("/trading")}
        >
          BACK
        </button>
      </div>
    </div>
  );
}