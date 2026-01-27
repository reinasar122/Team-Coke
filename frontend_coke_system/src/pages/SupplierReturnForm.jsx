// SupplierReturnForm.js - FIXED to only subtract returned quantities, not clear everything
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import api from "../api"; // ✅ correct

const SupplierReturnForm = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);

  // ✅ ADDED: Real-time datetime toggle (true by default)
  const [autoTime, setAutoTime] = useState(true);
  //updatedddddddddddddd

  // Returns local date & time in YYYY-MM-DDTHH:MM format
  const getLocalDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return `SUP-${code}`;
  };

  const [form, setForm] = useState({
    sup_no: generateRandomCode(),
    supplier: "",
    warehouse: "",
    date: getLocalDateTime(),
    total_amount: 0,
    items: [
      {
        product: "",
        product_name: "",
        content_no: 0,
        bottle_price: 0,
        shell_price: 0,
        qty_shell: "0",
        qty_pcs: "0",
        line_total: 0,
      },
    ],
  });

  // ✅ ADDED: Real-time Date & Time (updates every second until user edits)
  //upateddddddddd
  useEffect(() => {
    if (!autoTime) return;

    const tick = () => {
      setForm((prev) => ({
        ...prev,
        date: getLocalDateTime(),
      }));
    };

    tick(); // update immediately
    const id = setInterval(tick, 1000);

    return () => clearInterval(id);
  }, [autoTime]);
  //end of upatedddddddddd

  
  // Store ALL merchandising items that contributed to the supplier return
  const [merchandisingItemsToClean, setMerchandisingItemsToClean] = useState([]);

  // Get current user for notifications
  const getCurrentUser = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Function to get current warehouse
  const getCurrentWarehouse = useCallback(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    // For admin users, use selected warehouse or their enrolled warehouse
    if (userData.role?.toLowerCase() === "admin") {
      return selectedWarehouse || { id: userData.warehouse_id, name: userData.warehouse };
    }

    // For non-admin users, always use their enrolled warehouse
    return { id: userData.warehouse_id, name: userData.warehouse };
  }, []);

  // Function to fetch return empties for selected supplier FROM MERCHANDISING DATA
  // 🎉 FIXED: Now merges return empties for same products across ALL suppliers
  const fetchReturnEmpties = useCallback(
    async (supplierId) => {
      try {
        const warehouseParam = currentWarehouse?.id ? `?warehouse_id=${currentWarehouse.id}` : "";
        const response = await api.get(`/merchandising/${warehouseParam}`);

        let merchandisingData = response.data;
        if (merchandisingData.results) merchandisingData = merchandisingData.results;
        if (merchandisingData.data) merchandisingData = merchandisingData.data;

        // STEP 1: Find all products that belong to the selected supplier
        const selectedSupplierProducts = products.filter((p) => String(p.supplier) === String(supplierId));
        const selectedSupplierProductNames = selectedSupplierProducts.map((p) => p.product_name);

        const emptyReturns = [];
        const itemsToClean = [];

        if (Array.isArray(merchandisingData)) {
          merchandisingData.forEach((merchandising) => {
            const belongsToCurrentWarehouse =
              !currentWarehouse?.id ||
              String(merchandising.warehouse_id) === String(currentWarehouse.id) ||
              String(merchandising.warehouse) === String(currentWarehouse.id);

            if (
              (merchandising.status === "Complete" || merchandising.status === "COMPLETE") &&
              merchandising.items &&
              belongsToCurrentWarehouse
            ) {
              merchandising.items.forEach((item) => {
                const emptyShell = item.empty_return_shell || 0;
                const emptyPcs = item.empty_return_pcs || 0;

                if (emptyShell > 0 || emptyPcs > 0) {
                  const product = products.find((p) => p.id === item.product);

                  if (product && selectedSupplierProductNames.includes(product.product_name)) {
                    const productPricing = pricing.find((p) => p.id === item.product);
                    if (!productPricing) return;

                    const hasShellPrice = productPricing.shell_price && productPricing.shell_price > 0 && productPricing.shell_price !== null;
                    const hasBottlePrice =
                      productPricing.bottle_price && productPricing.bottle_price > 0 && productPricing.bottle_price !== null;

                    if (!hasShellPrice && !hasBottlePrice) return;

                    const selectedSupplierProduct = selectedSupplierProducts.find((p) => p.product_name === product.product_name);
                    const selectedSupplierPricing = pricing.find((p) => p.id === selectedSupplierProduct.id);

                    const returnItem = {
                      id: `${merchandising.id}-${item.id}`,
                      product_id: selectedSupplierProduct.id,
                      product_name: product.product_name,
                      empty_shell_qty: emptyShell,
                      empty_bottle_qty: emptyPcs,
                      qty_shell: emptyShell,
                      qty_pcs: emptyPcs,
                      supplier_id: supplierId,
                      merchandising_id: merchandising.id,
                      item_id: item.id,
                      msp_no: merchandising.msp_no,
                      warehouse_id: currentWarehouse?.id,
                      shell_price: selectedSupplierPricing?.shell_price || 0,
                      bottle_price: selectedSupplierPricing?.bottle_price || 0,
                    };

                    emptyReturns.push(returnItem);

                    itemsToClean.push({
                      merchandising_id: merchandising.id,
                      item_id: item.id,
                      product_id: item.product,
                      supplier_id: product.supplier,
                      empty_shell_qty: emptyShell,
                      empty_bottle_qty: emptyPcs,
                      msp_no: merchandising.msp_no,
                      original_empty_shell: emptyShell,
                      original_empty_pcs: emptyPcs,
                      product_name: product.product_name,
                    });
                  }
                }
              });
            }
          });
        }

        setMerchandisingItemsToClean(itemsToClean);
        return emptyReturns;
      } catch (err) {
        console.error("Error fetching return empties from merchandising for supplier:", supplierId, err);
        return [];
      }
    },
    [currentWarehouse, products, pricing]
  );

  const formatDecimal = (value) => Number(parseFloat(value || 0).toFixed(2));

  const populateTableWithReturnEmpties = useCallback(
    (returnEmptiesData) => {
      if (!returnEmptiesData || returnEmptiesData.length === 0) {
        setForm((prev) => ({
          ...prev,
          items: [
            {
              product: "",
              product_name: "",
              content_no: 0,
              bottle_price: 0,
              shell_price: 0,
              qty_shell: "0",
              qty_pcs: "0",
              line_total: 0,
            },
          ],
          total_amount: 0,
        }));
        setMerchandisingItemsToClean([]);
        return;
      }

      const productGroups = {};

      returnEmptiesData.forEach((empty) => {
        const product = products.find((p) => p.id === empty.product_id || p.id === empty.product);
        if (product) {
          const productName = product.product_name;
          const contentNo = product.unit_type?.content_no || 0;
          const bottlePrice = formatDecimal(empty.bottle_price || 0);
          const shellPrice = formatDecimal(empty.shell_price || 0);

          const qtyShell = parseInt(empty.empty_shell_qty || empty.qty_shell || 0, 10);
          const qtyPcs = parseInt(empty.empty_bottle_qty || qtyShell * contentNo, 10);

          if (productGroups[productName]) {
            productGroups[productName].qty_shell += qtyShell;
            productGroups[productName].qty_pcs += qtyPcs;
          } else {
            productGroups[productName] = {
              product: product.id,
              product_name: productName,
              content_no: contentNo,
              bottle_price: bottlePrice,
              shell_price: shellPrice,
              qty_shell: qtyShell,
              qty_pcs: qtyPcs,
            };
          }
        }
      });

      const newItems = Object.values(productGroups).map((group) => {
        const bottleTotal = group.qty_pcs * group.bottle_price;
        const shellTotal = group.qty_shell * group.shell_price;
        const lineTotal = formatDecimal(bottleTotal + shellTotal);

        return {
          product: group.product,
          product_name: group.product_name,
          content_no: group.content_no,
          bottle_price: group.bottle_price,
          shell_price: group.shell_price,
          qty_shell: String(group.qty_shell),
          qty_pcs: String(group.qty_pcs),
          line_total: lineTotal,
        };
      });

      const totalAmount = formatDecimal(newItems.reduce((sum, item) => sum + formatDecimal(item.line_total), 0));

      setForm((prev) => ({
        ...prev,
        items: newItems,
        total_amount: totalAmount,
      }));
    },
    [products]
  );

  const handleSupplierChange = useCallback(
    async (supplierId) => {
      setForm((prev) => ({ ...prev, supplier: supplierId }));

      if (supplierId) {
        const returnEmptiesData = await fetchReturnEmpties(supplierId);
        populateTableWithReturnEmpties(returnEmptiesData);
      } else {
        setForm((prev) => ({
          ...prev,
          items: [
            {
              product: "",
              product_name: "",
              content_no: 0,
              bottle_price: 0,
              shell_price: 0,
              qty_shell: "0",
              qty_pcs: "0",
              line_total: 0,
            },
          ],
          total_amount: 0,
        }));
        setMerchandisingItemsToClean([]);
      }
    },
    [fetchReturnEmpties, populateTableWithReturnEmpties]
  );

  useEffect(() => {
    const warehouse = getCurrentWarehouse();
    setCurrentWarehouse(warehouse);

    setForm((prev) => ({
      ...prev,
      warehouse: warehouse?.id || "",
    }));

    window.dispatchEvent(new Event("supplierReturnsPageVisited"));

    Promise.all([api.get("/suppliers/"), api.get("/pricing/"), api.get("/products/")])
      .then(([suppliersRes, pricingRes, productsRes]) => {
        setSuppliers(suppliersRes.data);
        setPricing(pricingRes.data);
        setProducts(productsRes.data);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      });
  }, [getCurrentWarehouse]);

  useEffect(() => {
    const handleWarehouseChange = (event) => {
      const newWarehouse = event.detail.warehouse || getCurrentWarehouse();
      setCurrentWarehouse(newWarehouse);
      setForm((prev) => ({
        ...prev,
        warehouse: newWarehouse?.id || "",
        supplier: "",
        items: [
          {
            product: "",
            product_name: "",
            content_no: 0,
            bottle_price: 0,
            shell_price: 0,
            qty_shell: "0",
            qty_pcs: "0",
            line_total: 0,
          },
        ],
        total_amount: 0,
      }));
      setMerchandisingItemsToClean([]);
    };

    window.addEventListener("warehouseChanged", handleWarehouseChange);
    return () => window.removeEventListener("warehouseChanged", handleWarehouseChange);
  }, [getCurrentWarehouse]);

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...form.items];
    updatedItems[index] = { ...updatedItems[index] };

    updatedItems[index][field] = value;

    if (field === "qty_shell" || field === "qty_pcs") {
      const item = updatedItems[index];

      if (item.product) {
        const contentNo = Number(item.content_no) || 0;
        const bottlePrice = formatDecimal(item.bottle_price);
        const shellPrice = formatDecimal(item.shell_price);

        let qtyShell, qtyPcs;

        if (field === "qty_shell") {
          qtyShell = parseInt(value, 10) || 0;
          qtyPcs = qtyShell * contentNo;
        } else {
          qtyPcs = parseInt(value, 10) || 0;
          qtyShell = parseInt(item.qty_shell, 10) || 0;
        }

        const bottleTotal = qtyPcs * bottlePrice;
        const shellTotal = qtyShell * shellPrice;
        const lineTotal = formatDecimal(bottleTotal + shellTotal);

        updatedItems[index] = {
          ...item,
          qty_shell: String(qtyShell),
          qty_pcs: String(qtyPcs),
          line_total: lineTotal,
        };
      }
    }

    let totalAmount = 0;
    updatedItems.forEach((item) => {
      totalAmount += formatDecimal(item.line_total);
    });
    totalAmount = formatDecimal(totalAmount);

    setForm((prev) => ({
      ...prev,
      items: updatedItems,
      total_amount: totalAmount,
    }));
  };

  const updateMerchandisingEmptyReturns = async (returnedItems) => {
    try {
      if (merchandisingItemsToClean.length === 0) {
        return { updated: 0, errors: 0 };
      }

      const returnedByProduct = {};
      returnedItems.forEach((item) => {
        const product = products.find((p) => p.id === item.product);
        if (product) {
          const productName = product.product_name;
          if (!returnedByProduct[productName]) {
            returnedByProduct[productName] = { shells: 0, pcs: 0 };
          }
          returnedByProduct[productName].shells += item.qty_shell;
          returnedByProduct[productName].pcs += item.qty_pcs;
        }
      });

      let updatedCount = 0;
      let errorCount = 0;

      for (const item of merchandisingItemsToClean) {
        try {
          const productName = item.product_name;
          const returned = returnedByProduct[productName];

          if (returned && (returned.shells > 0 || returned.pcs > 0)) {
            const currentShells = item.original_empty_shell || 0;
            const currentPcs = item.original_empty_pcs || 0;

            const shellsToSubtract = Math.min(returned.shells, currentShells);
            const pcsToSubtract = Math.min(returned.pcs, currentPcs);

            const newShellQty = Math.max(0, currentShells - shellsToSubtract);
            const newPcsQty = Math.max(0, currentPcs - pcsToSubtract);

            await api.patch(`/merchandising-items/${item.item_id}/`, {
              empty_return_shell: newShellQty,
              empty_return_pcs: newPcsQty,
            });

            returned.shells = Math.max(0, returned.shells - shellsToSubtract);
            returned.pcs = Math.max(0, returned.pcs - pcsToSubtract);

            updatedCount++;
          }
        } catch (error) {
          console.error(`Failed to update merchandising item ${item.item_id}:`, error);
          errorCount++;
        }
      }

      return { updated: updatedCount, errors: errorCount };
    } catch (error) {
      console.error("Error in merchandising update:", error);
      throw error;
    }
  };

  const removeReturnableStockEntries = async (returnedItems) => {
    try {
      if (!currentWarehouse?.id) {
        return { removed: 0, updated: 0, errors: 0 };
      }

      const warehouseParam = `?warehouse_id=${currentWarehouse.id}`;
      const response = await api.get(`/returnable-stocks/${warehouseParam}`);
      const returnableStocks = response.data;

      let removedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const returnedItem of returnedItems) {
        const matchingStocks = returnableStocks.filter((stock) => {
          const productMatch = stock.product_id === returnedItem.product || stock.product === returnedItem.product;
          const supplierMatch = String(stock.supplier_id) === String(form.supplier) || String(stock.supplier) === String(form.supplier);
          const warehouseMatch = String(stock.warehouse_id) === String(currentWarehouse.id);
          return productMatch && supplierMatch && warehouseMatch;
        });

        let remainingShellQty = returnedItem.qty_shell;
        let remainingPcsQty = returnedItem.qty_pcs;

        for (const stock of matchingStocks) {
          if (remainingShellQty <= 0 && remainingPcsQty <= 0) break;

          const currentShells = stock.empty_shell_qty || 0;
          const currentPcs = stock.empty_bottle_qty || 0;

          if (currentShells > 0 || currentPcs > 0) {
            const shellsToSubtract = Math.min(remainingShellQty, currentShells);
            const pcsToSubtract = Math.min(remainingPcsQty, currentPcs);

            const newShells = Math.max(0, currentShells - shellsToSubtract);
            const newPcs = Math.max(0, currentPcs - pcsToSubtract);

            try {
              if (newShells <= 0 && newPcs <= 0) {
                await api.delete(`/returnable-stocks/${stock.id}/`);
                removedCount++;
              } else {
                await api.patch(`/returnable-stocks/${stock.id}/`, {
                  empty_shell_qty: newShells,
                  empty_bottle_qty: newPcs,
                  last_updated: new Date().toISOString(),
                });
                updatedCount++;
              }

              remainingShellQty -= shellsToSubtract;
              remainingPcsQty -= pcsToSubtract;
            } catch (error) {
              console.error(`Failed to process returnable stock entry ${stock.id}:`, error);
              errorCount++;
            }
          }
        }
      }

      return { removed: removedCount, updated: updatedCount, errors: errorCount };
    } catch (error) {
      console.error("Critical error in returnable stock cleanup:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentWarehouse?.id) {
      showErrorModal("No warehouse selected. Please select a warehouse first.");
      return;
    }

    const validItems = form.items.filter((item) => item.product && (parseInt(item.qty_shell) > 0 || parseInt(item.qty_pcs) > 0));
    if (validItems.length === 0) {
      showErrorModal("No valid items to return. Please select a supplier with available return empties.");
      return;
    }

    const totalAmount = formatDecimal(form.items.reduce((sum, item) => sum + formatDecimal(item.line_total), 0));

    const filteredItems = form.items
      .filter((item) => item.product)
      .map(({ product, qty_shell, qty_pcs, bottle_price, shell_price, line_total }) => ({
        product,
        qty_shell: parseInt(qty_shell, 10) || 0,
        qty_pcs: parseInt(qty_pcs, 10) || 0,
        bottle_price: formatDecimal(bottle_price),
        shell_price: formatDecimal(shell_price),
        line_total: formatDecimal(line_total),
      }));

    try {
      const formattedDate = form.date ? new Date(form.date).toISOString() : new Date().toISOString();

      const response = await api.post("/supplier-return-form/", {
        sup_no: form.sup_no,
        supplier: form.supplier,
        warehouse: currentWarehouse.id,
        date: formattedDate,
        total_amount: totalAmount,
        items: filteredItems,
        auto_remove_empties: true,
      });

      const user = getCurrentUser();
      const selectedSupplier = suppliers.find((s) => s.id === parseInt(form.supplier));

      addNotification(
        "supplier_return_processed",
        {
          id: response.data.id || Date.now(),
          sup_no: form.sup_no,
          supplier_name: selectedSupplier?.company_name || "Unknown Supplier",
          company_name: selectedSupplier?.company_name,
          total_amount: totalAmount,
          items_count: filteredItems.length,
          warehouse_id: currentWarehouse.id,
          warehouse_name: currentWarehouse.name,
          date: formattedDate,
          created_at: formattedDate,
          supplier_id: form.supplier,
          items: filteredItems,
        },
        user.role
      );

      const merchandisingResult = await updateMerchandisingEmptyReturns(filteredItems);
      const returnableStockResult = await removeReturnableStockEntries(filteredItems);

      let message = `Supplier return saved successfully for ${currentWarehouse.name}!`;

      if (merchandisingResult.updated > 0) {
        message += ` ${merchandisingResult.updated} merchandising entries have been updated with remaining quantities.`;
      }
      if (returnableStockResult.removed > 0) {
        message += ` ${returnableStockResult.removed} returnable stock entries have been completely removed.`;
      }
      if (returnableStockResult.updated > 0) {
        message += ` ${returnableStockResult.updated} returnable stock entries have been updated with remaining quantities.`;
      }

      const totalErrors = (merchandisingResult.errors || 0) + (returnableStockResult.errors || 0);
      if (totalErrors > 0) {
        message += ` Note: ${totalErrors} items had errors during update.`;
      }

      message += " Remaining empty returns are preserved for future returns.";

      showSuccessModal(message);

      setTimeout(() => {
        window.dispatchEvent(new Event("supplierReturnsPageVisited"));
      }, 1000);
    } catch (err) {
      console.error("Save error:", err);
      showErrorModal("Failed to save supplier return.");
    }
  };

  const showSuccessModal = (message) => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.background = "rgba(0, 0, 0, 0.5)";
    modal.innerHTML = `
      <div class="modal">
        <div style="text-align: center; color: var(--add); margin-bottom: var(--sp-4);">
          <svg style="width: 48px; height: 48px; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <p style="color: var(--text); margin-bottom: var(--sp-6); text-align: center;">${message}</p>
        <div style="text-align: center;">
          <button id="success-ok-btn" class="btn btn-add">OK</button>
        </div>
      </div>
    `;

    const okButton = modal.querySelector("#success-ok-btn");
    okButton.onclick = () => {
      document.body.removeChild(modal);
      navigate("/supplier-returns");
    };

    document.body.appendChild(modal);
  };

  const showErrorModal = (message) => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.background = "rgba(0, 0, 0, 0.5)";
    modal.innerHTML = `
      <div class="modal">
        <div style="text-align: center; color: var(--danger); margin-bottom: var(--sp-4);">
          <svg style="width: 48px; height: 48px; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <p style="color: var(--text); margin-bottom: var(--sp-6); text-align: center;">${message}</p>
        <div style="text-align: center;">
          <button class="btn btn-danger" onclick="this.closest('.modal-overlay').remove()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "var(--sp-6)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          className="page-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-6)" }}
        >
          <h1 className="page-title">Supplier Return Form</h1>

          {/* Warehouse Display - Right side, Gray */}
          <div
            className="card"
            style={{
              padding: "var(--sp-2) var(--sp-3)",
              background: "var(--bg)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <span style={{ fontWeight: "500", fontSize: "0.9em" }}>{currentWarehouse?.name || "No Warehouse Selected"}</span>
          </div>
        </div>

        {/* Main Form Container */}
        <div
          className="card"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow)",
            padding: "var(--sp-6)",
          }}
        >
          <form onSubmit={handleSubmit}>
            {/* Form Fields Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "var(--sp-6)",
                marginBottom: "var(--sp-6)",
              }}
            >
              <div>
                <div className="mb-4">
                  <label style={{ display: "block", marginBottom: "var(--sp-1)", fontWeight: "600", color: "var(--text)" }}>Sup No.</label>
                  <input
                    type="text"
                    value={form.sup_no}
                    readOnly
                    className="input"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      cursor: "not-allowed",
                      padding: "var(--sp-3)",
                      borderRadius: "var(--r-sm)",
                    }}
                  />
                </div>

                <div className="mb-4">
                  <label style={{ display: "block", marginBottom: "var(--sp-1)", fontWeight: "600", color: "var(--text)" }}>Date & Time</label>

                  {/* ✅ UPDATED: stop realtime when user changes it *new updatedddddd*/}
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => {
                      setAutoTime(false); // ✅ ADDED
                      setForm({ ...form, date: e.target.value });
                    }}
                    //end of updatedddddd
                    className="input"
                    style={{ border: "1px solid var(--border)", padding: "var(--sp-3)", borderRadius: "var(--r-sm)" }}
                    required
                  />

                </div>
              </div>

              <div>
                <div className="mb-4">
                  <label style={{ display: "block", marginBottom: "var(--sp-1)", fontWeight: "600", color: "var(--text)" }}>Supplier</label>
                  <select
                    value={form.supplier}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="input"
                    style={{ border: "1px solid var(--border)", appearance: "none", padding: "var(--sp-3)", borderRadius: "var(--r-sm)" }}
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label style={{ display: "block", marginBottom: "var(--sp-1)", fontWeight: "600", color: "var(--text)" }}>Total Amount</label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "var(--sp-3)",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        zIndex: "10",
                      }}
                    >
                      ₱
                    </span>
                    <input
                      type="text"
                      value={formatDecimal(form.total_amount).toFixed(2)}
                      readOnly
                      className="input"
                      style={{
                        paddingLeft: "24px",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        cursor: "not-allowed",
                        padding: "var(--sp-3)",
                        borderRadius: "var(--r-sm)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Table with Design System */}
            <div className="table-wrapper" style={{ marginBottom: "var(--sp-6)" }}>
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th className="text-left">Product Name</th>
                    <th>Qty (Shell)</th>
                    <th>Qty (PC)</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={item.product_name}
                          readOnly
                          className="input"
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            cursor: "not-allowed",
                            textAlign: "left",
                            padding: "var(--sp-2)",
                            borderRadius: "var(--r-sm)",
                          }}
                          placeholder="Auto-populated when supplier is selected"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.qty_shell}
                          onFocus={(e) => e.target.value === "0" && handleItemChange(index, "qty_shell", "")}
                          onBlur={(e) => {
                            if (e.target.value === "") handleItemChange(index, "qty_shell", "0");
                          }}
                          onChange={(e) => handleItemChange(index, "qty_shell", e.target.value)}
                          className="input"
                          style={{ border: "1px solid var(--border)", padding: "var(--sp-2)", borderRadius: "var(--r-sm)" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.qty_pcs}
                          onFocus={(e) => e.target.value === "0" && handleItemChange(index, "qty_pcs", "")}
                          onBlur={(e) => {
                            if (e.target.value === "") handleItemChange(index, "qty_pcs", "0");
                          }}
                          onChange={(e) => handleItemChange(index, "qty_pcs", e.target.value)}
                          className="input"
                          style={{ border: "1px solid var(--border)", padding: "var(--sp-2)", borderRadius: "var(--r-sm)" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={`₱${formatDecimal(item.line_total).toFixed(2)}`}
                          readOnly
                          className="input"
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            cursor: "not-allowed",
                            padding: "var(--sp-2)",
                            borderRadius: "var(--r-sm)",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons with Design System */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-4)" }}>
              <button type="button" onClick={() => navigate("/supplier-returns")} className="btn btn-cancel">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierReturnForm;