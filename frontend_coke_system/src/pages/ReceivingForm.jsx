// Updated ReceivingForm.jsx - Fixed warehouse filtering logic + single return refactor + receipt number validation + removed unused users state + fixed mouse wheel scroll issue + ADD PRODUCT IN DROPDOWN + RETURN NAVIGATION + AUTO-SELECT NEW PRODUCT + FORM STATE PRESERVATION + FIXED AUTO-SELECTION
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api"; // ✅ correct

import "../styles/global.scss";
import "../styles/pages/receivingform.scss";

const ReceivingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [receiveNo, setReceiveNo] = useState("");
  const [supplierReturns, setSupplierReturns] = useState([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [error, setError] = useState("");
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [isLoadingWarehouse, setIsLoadingWarehouse] = useState(true);
  const [notice, setNotice] = useState({
    open: false,
    type: "success",
    text: "",
  });

  // NEW: State to track the selected warehouse from localStorage
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [receivedByName, setReceivedByName] = useState("");

  // Use ref to track if we've already fetched for this supplier
  const lastFetchedSupplier = useRef(null);
  
  // NEW: Refs for focusing on input fields
  const shellQtyRefs = useRef([]);

  // NEW: State to prevent form reset during auto-selection
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);

  const [form, setForm] = useState({
    supplier: "",
    invoice_no: "",
    return_total_amount: 0,
    net_amount: 0,
    received_by: "",
    remarks: "",
    details: [
      {
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_cost: 0,
        total: 0,
      },
    ],
  });

  const formatAmount = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Show notice function
  const showNotice = (text, type = "success") => {
    setNotice({ open: true, type, text });
    setTimeout(() => {
      setNotice({ open: false, type: "success", text: "" });
    }, 3000);
  };

  // NEW: Handle return from product form and refresh products + auto-select new product + restore form state
  useEffect(() => {
    if (location.state?.message && location.state?.refreshProducts && currentWarehouse?.id) {
      // Show success message from product form
      showNotice(location.state.message, "success");
      
      // Reload products to include the newly added product
      const config = getAxiosConfig();
      api.get("/products/", config)
        .then((res) => {
          console.log(`🔄 Reloaded ${res.data.length} products after adding new product`);
          setProducts(res.data);
          
          // Restore previous form state if it exists
          if (location.state?.savedFormState) {
            console.log('🔄 Restoring previous form state...');
            const savedState = location.state.savedFormState;
            
            setForm(savedState);
            setReceiveNo(savedState.receive_no);
            setSupplierReturns(savedState.supplier_returns || []);
            setReceivedByName(savedState.received_by_name || "");
            
            console.log('✅ Form state restored successfully');
            
            // NEW: Auto-select the newly created product AFTER form state is restored
            if (location.state?.newProduct) {
              const newProductId = location.state.newProduct.id;
              const newProductName = location.state.newProduct.name;
              
              console.log(`🎯 Auto-selecting new product: ${newProductName} (ID: ${newProductId})`);
              
              // Set flag to prevent form reset during auto-selection
              setIsAutoSelecting(true);
              
              // Wait a bit for form state and filtered products to settle
              setTimeout(() => {
                setForm(prev => {
                  const newForm = { ...prev };
                  const firstEmptyRowIndex = newForm.details.findIndex(row => !row.product_id || row.product_id === "");
                  
                  if (firstEmptyRowIndex !== -1) {
                    // Set the product in the first empty row
                    newForm.details[firstEmptyRowIndex].product_id = newProductId;
                    
                    // Calculate costs for the new product
                    const product = res.data.find(p => p.id === newProductId);
                    if (product?.price) {
                      const { purchase_price = 0, shell_price = 0, bottle_price = 0 } = product.price;
                      const content_no = product?.unit_type?.content_no || 1;
                      const unit_cost = purchase_price + bottle_price + (shell_price / content_no);
                      newForm.details[firstEmptyRowIndex].unit_cost = unit_cost.toFixed(2);
                    }
                    
                    console.log(`✅ Auto-selected product "${newProductName}" in row ${firstEmptyRowIndex + 1}`);
                    
                    // Focus on the shell quantity field after a short delay
                    setTimeout(() => {
                      if (shellQtyRefs.current[firstEmptyRowIndex]) {
                        shellQtyRefs.current[firstEmptyRowIndex].focus();
                        console.log(`🎯 Focused on shell quantity field for row ${firstEmptyRowIndex + 1}`);
                      }
                      // Clear the auto-selecting flag
                      setIsAutoSelecting(false);
                    }, 300);
                  } else {
                    console.log('⚠️ No empty rows found for auto-selection');
                    setIsAutoSelecting(false);
                  }
                  
                  return newForm;
                });
              }, 500); // Wait longer for everything to settle
            }
          }
        })
        .catch((err) => {
          console.error("❌ Error reloading products:", err);
          setIsAutoSelecting(false);
        });
      
      // Clear the message from state to prevent showing it again
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.message, location.state?.refreshProducts, location.state?.newProduct, location.state?.savedFormState, currentWarehouse?.id, navigate]);

  // NEW: Reset form when warehouse changes
  const resetForm = useCallback(() => {
    console.log("🔄 Resetting form data...");
    setForm({
      supplier: "",
      invoice_no: "",
      return_total_amount: 0,
      net_amount: 0,
      received_by: "",
      remarks: "",
      details: [
        {
          product_id: "",
          pcs_qty: 0,
          shell_qty: 0,
          bottle_qty: 0,
          bad_order_pcs: 0,
          unit_cost: 0,
          total: 0,
        },
      ],
    });
    setSuppliers([]);
    setProducts([]);
    setSupplierReturns([]);
    setFilteredProducts([]);
    lastFetchedSupplier.current = null;
  }, []);

  // ENHANCED: Monitor localStorage for warehouse AND user changes
  useEffect(() => {
    const checkChanges = () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      const newWarehouseId = selectedWarehouse?.id || null;
      const newUserId = user?.id || null;

      console.log("🔍 Checking changes - Warehouse:", selectedWarehouseId, "->", newWarehouseId, "User:", currentUserId, "->", newUserId);

      // Check for user change first (this forces a complete reset)
      if (newUserId !== currentUserId) {
        console.log("🚨 USER CHANGE DETECTED:", currentUserId, "->", newUserId);
        setCurrentUserId(newUserId);
        setSelectedWarehouseId(null); // Reset to trigger warehouse re-detection
        resetForm();
        return;
      }

      // Check for warehouse change
      if (newWarehouseId !== selectedWarehouseId) {
        console.log("🚨 WAREHOUSE CHANGE DETECTED:", selectedWarehouseId, "->", newWarehouseId);
        setSelectedWarehouseId(newWarehouseId);
      }
    };

    // Check immediately
    checkChanges();

    // Check every 300ms for changes
    const interval = setInterval(checkChanges, 300);

    return () => clearInterval(interval);
  }, [selectedWarehouseId, currentUserId, resetForm]);

  // FIXED: Enhanced warehouse detection - triggers when selectedWarehouseId OR currentUserId changes
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

    console.log("🔍 Debug - Full user data:", user);
    console.log("🔍 Debug - Selected warehouse:", selectedWarehouse);
    console.log("🔍 Debug - Trigger warehouse ID:", selectedWarehouseId);
    console.log("🔍 Debug - Current user ID:", currentUserId);

    // Function to fetch warehouse ID by name
    const fetchWarehouseByName = async (warehouseName) => {
      try {
        const response = await api.get("/warehouses/");
        const warehouse = response.data.find((w) => w.name === warehouseName);
        return warehouse || null;
      } catch (error) {
        console.error("❌ Error fetching warehouses:", error);
        return null;
      }
    };

    const setupWarehouse = async () => {
      console.log("🏗️ Setting up warehouse...");
      setIsLoadingWarehouse(true);
      let warehouse = null;
      let debugMsg = "";

      if (user.role?.toLowerCase() === "admin") {
        // For admin: use selected warehouse OR their enrolled warehouse
        if (selectedWarehouse && selectedWarehouse.id) {
          warehouse = selectedWarehouse;
          debugMsg = `Admin using selected warehouse: ${warehouse.name} (ID: ${warehouse.id})`;
        } else if (user.warehouse_id) {
          warehouse = { name: user.warehouse, id: user.warehouse_id };
          debugMsg = `Admin using enrolled warehouse: ${warehouse.name} (ID: ${warehouse.id})`;
        } else if (user.warehouse) {
          // Try to get warehouse ID from name
          const foundWarehouse = await fetchWarehouseByName(user.warehouse);
          if (foundWarehouse) {
            warehouse = { name: foundWarehouse.name, id: foundWarehouse.id };
            debugMsg = `Admin warehouse mapped: ${warehouse.name} (ID: ${warehouse.id})`;
          } else {
            debugMsg = `⚠️ Admin warehouse "${user.warehouse}" not found in database`;
          }
        } else {
          debugMsg = "⚠️ Admin has no warehouse assigned";
        }
      } else {
        // For non-admin: ALWAYS use their enrolled warehouse, ignore selectedWarehouse
        if (user.warehouse_id) {
          warehouse = { name: user.warehouse, id: user.warehouse_id };
          debugMsg = `User using enrolled warehouse: ${warehouse.name} (ID: ${warehouse.id})`;
        } else if (user.warehouse) {
          console.log(`🔄 Looking up warehouse ID for: "${user.warehouse}"`);
          const foundWarehouse = await fetchWarehouseByName(user.warehouse);
          if (foundWarehouse) {
            warehouse = { name: foundWarehouse.name, id: foundWarehouse.id };
            debugMsg = `✅ User warehouse mapped: ${warehouse.name} (ID: ${warehouse.id})`;

            // IMPORTANT: Update localStorage to include warehouse_id for future use
            const updatedUser = { ...user, warehouse_id: foundWarehouse.id };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            console.log("💾 Updated user data with warehouse_id:", updatedUser);
          } else {
            debugMsg = `❌ User warehouse "${user.warehouse}" not found in database`;
          }
        } else {
          debugMsg = "❌ User has no warehouse assigned";
        }
      }

      console.log("🔍 Final result:", debugMsg);
      setDebugInfo(debugMsg);

      // Always update warehouse info (don't check for changes)
      console.log("🔄 Setting warehouse and resetting form...");
      setCurrentWarehouse(warehouse);

      // Clear any previous errors if we found a warehouse
      if (warehouse?.id) {
        setError("");
      } else {
        setError(`User warehouse not found. ${debugMsg}`);
      }

      setIsLoadingWarehouse(false);
    };

    // Only run if we have user data
    if (user.id) {
      setupWarehouse();
    }
  }, [selectedWarehouseId, currentUserId]); // Removed currentWarehouse to avoid circular dependency

  // Create axios instance with warehouse header and debugging
  const getAxiosConfig = useCallback(() => {
    const config = {};
    if (currentWarehouse?.id) {
      config.headers = {
        "X-Warehouse-ID": currentWarehouse.id,
      };
      console.log(`📡 Making API call with warehouse header: ${currentWarehouse.id}`);
    } else {
      console.log("⚠️ No warehouse ID for API call!");
    }
    return config;
  }, [currentWarehouse?.id]);

  // Load data when warehouse changes
  useEffect(() => {
    if (!currentWarehouse?.id || isLoadingWarehouse) {
      console.log("❌ Skipping API calls - no warehouse ID or still loading");
      return;
    }

    const config = getAxiosConfig();
    console.log(`🔄 Loading data for warehouse: ${currentWarehouse.name} (ID: ${currentWarehouse.id})`);

    // Load suppliers for this warehouse
    api
      .get("/suppliers/", config)
      .then((res) => {
        console.log(`✅ Loaded ${res.data.length} suppliers for warehouse ${currentWarehouse.id}`);
        console.log("🔍 Sample suppliers:", res.data.slice(0, 3).map((s) => ({ id: s.id, name: s.company_name })));
        setSuppliers(res.data);
      })
      .catch((err) => console.error("❌ Error loading suppliers:", err));

    // Load products for this warehouse
    api
      .get("/products/", config)
      .then((res) => {
        console.log(`✅ Loaded ${res.data.length} products for warehouse ${currentWarehouse.id}`);
        console.log(
          "🔍 Sample products:",
          res.data.slice(0, 3).map((p) => ({
            id: p.id,
            name: p.product_name,
            supplier_id: p.supplier_id,
            supplier_name: p.supplier_name,
            warehouse: p.warehouse,
            warehouse_id: p.warehouse_id,
          }))
        );
        setProducts(res.data);
      })
      .catch((err) => console.error("❌ Error loading products:", err));

    const generateJumbledCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return `RCV-${Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")}`;
    };

    setReceiveNo(generateJumbledCode());
  }, [currentWarehouse?.id, currentWarehouse?.name, getAxiosConfig, isLoadingWarehouse]);

  // FIXED: Filter products by supplier AND ensure they're available in current warehouse
  useEffect(() => {
    if (form.supplier && products.length > 0 && suppliers.length > 0 && currentWarehouse?.id) {
      console.log("🔍 Filtering products for supplier:", form.supplier, "in warehouse:", currentWarehouse.name);
      console.log("🔍 Total products loaded:", products.length);
      console.log("🔍 Total suppliers loaded:", suppliers.length);

      // Find supplier details - FIXED: Use strict equality
      const selectedSupplier = suppliers.find((s) => s.id === Number(form.supplier));
      console.log("🔍 Selected supplier details:", selectedSupplier);

      // Step 1: Filter products that belong to the selected supplier
      const supplierProducts = products.filter((product) => {
        const supplierMatch =
          String(product.supplier_id) === String(form.supplier) ||
          String(product.supplier) === String(form.supplier) ||
          (product.supplier_name && selectedSupplier?.company_name === product.supplier_name);

        if (supplierMatch) {
          console.log(`✅ Product "${product.product_name}" matches supplier ${form.supplier}`, {
            product_supplier_id: product.supplier_id,
            product_supplier: product.supplier,
            product_supplier_name: product.supplier_name,
            selected_supplier_id: form.supplier,
            selected_supplier_name: selectedSupplier?.company_name,
          });
        }

        return supplierMatch;
      });

      console.log(
        `📦 Found ${supplierProducts.length} products from supplier "${selectedSupplier?.company_name}" (ID: ${form.supplier})`
      );

      if (supplierProducts.length === 0) {
        console.log("⚠️ No products found for this supplier. Debugging...");

        const uniqueSupplierIds = [...new Set(products.map((p) => p.supplier_id).filter(Boolean))];
        console.log("🔍 Available supplier IDs in products:", uniqueSupplierIds);

        const uniqueSupplierNames = [...new Set(products.map((p) => p.supplier_name).filter(Boolean))];
        console.log("🔍 Available supplier names in products:", uniqueSupplierNames);

        console.log("🔍 Looking for supplier ID:", form.supplier);
        console.log("🔍 Looking for supplier name:", selectedSupplier?.company_name);
      }

      // Step 2: FIXED - Proper warehouse filtering logic
      const warehouseFilteredProducts = supplierProducts.filter((product) => {
        if (product.warehouse_id) {
          const warehouseMatch = String(product.warehouse_id) === String(currentWarehouse.id);
          if (!warehouseMatch) {
            console.log(
              `❌ Product "${product.product_name}" warehouse ID ${product.warehouse_id} doesn't match current warehouse ID ${currentWarehouse.id}`
            );
          }
          return warehouseMatch;
        }

        if (product.warehouse) {
          if (/^\d+$/.test(String(product.warehouse))) {
            const warehouseMatch = String(product.warehouse) === String(currentWarehouse.id);
            if (!warehouseMatch) {
              console.log(
                `❌ Product "${product.product_name}" warehouse ID "${product.warehouse}" doesn't match current warehouse ID "${currentWarehouse.id}"`
              );
            }
            return warehouseMatch;
          } else {
            const warehouseMatch =
              String(product.warehouse).toLowerCase() === String(currentWarehouse.name).toLowerCase();
            if (!warehouseMatch) {
              console.log(
                `❌ Product "${product.product_name}" warehouse name "${product.warehouse}" doesn't match current warehouse name "${currentWarehouse.name}"`
              );
            }
            return warehouseMatch;
          }
        }

        console.log(`✅ Product "${product.product_name}" has no warehouse field - assuming available from API filtering`);
        return true;
      });

      console.log(
        `🏪 Final result: ${warehouseFilteredProducts.length} products available from supplier "${selectedSupplier?.company_name}" in warehouse "${currentWarehouse.name}"`
      );

      if (warehouseFilteredProducts.length > 0) {
        console.log(
          "🎯 Filtered products:",
          warehouseFilteredProducts.map((p) => ({
            id: p.id,
            name: p.product_name,
            supplier_id: p.supplier_id,
            supplier_name: p.supplier_name,
            warehouse: p.warehouse,
            warehouse_id: p.warehouse_id,
          }))
        );
      }

      setFilteredProducts(warehouseFilteredProducts);

      // UPDATED: Only reset product details when NOT auto-selecting
      if (!isAutoSelecting) {
        setForm((prev) => ({
          ...prev,
          details: [
            {
              product_id: "",
              pcs_qty: 0,
              shell_qty: 0,
              bottle_qty: 0,
              bad_order_pcs: 0,
              unit_cost: 0,
              total: 0,
            },
          ],
        }));
      }
    } else {
      setFilteredProducts([]);
      if (!form.supplier) {
        console.log("🔍 No supplier selected");
      } else if (products.length === 0) {
        console.log("🔍 No products loaded yet");
      } else if (suppliers.length === 0) {
        console.log("🔍 No suppliers loaded yet");
      } else if (!currentWarehouse?.id) {
        console.log("🔍 No warehouse selected");
      }
    }
  }, [form.supplier, products, suppliers, currentWarehouse?.id, currentWarehouse?.name, isAutoSelecting]);

  // Function to update form with return amount calculation
  const updateFormWithReturnAmount = useCallback((returnAmount) => {
    setForm((prev) => {
      const total = prev.details.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);
      const netAmount = Math.max(0, total - returnAmount);

      return {
        ...prev,
        return_total_amount: returnAmount,
        net_amount: netAmount.toFixed(2),
      };
    });
  }, []);

  // FIXED: Fetch supplier returns from API (filtered by warehouse AND supplier)
  const fetchSupplierReturns = useCallback(
    async (supplierId) => {
      if (!currentWarehouse?.id || !supplierId) return;

      if (lastFetchedSupplier.current === supplierId) return;
      lastFetchedSupplier.current = supplierId;

      setIsLoadingReturns(true);
      setError("");

      try {
        console.log(
          "🔄 Fetching returns for supplier:",
          supplierId,
          "in warehouse:",
          currentWarehouse.name,
          "ID:",
          currentWarehouse.id
        );

        const config = getAxiosConfig();
        const response = await api.get("/supplier-return-form/", config);
        console.log("📊 All supplier returns received:", response.data);

        // FIXED: Filter by BOTH supplier AND warehouse
        const filteredReturns = response.data.filter((returnItem) => {
          const supplierMatch = String(returnItem.supplier) === String(supplierId);
          const warehouseMatch = String(returnItem.warehouse || returnItem.warehouse_id) === String(currentWarehouse.id);

          console.log(
            `🔍 Checking return ${returnItem.sup_no}: Supplier match: ${supplierMatch} (${returnItem.supplier} === ${supplierId}), Warehouse match: ${warehouseMatch} (${returnItem.warehouse || returnItem.warehouse_id} === ${currentWarehouse.id})`
          );

          return supplierMatch && warehouseMatch;
        });

        console.log(
          "🎯 Filtered returns for supplier",
          supplierId,
          "in warehouse",
          currentWarehouse.name,
          ":",
          filteredReturns
        );

        if (filteredReturns.length > 0) {
          setSupplierReturns(filteredReturns);

          const totalReturnAmount = filteredReturns.reduce(
            (sum, returnItem) => sum + parseFloat(returnItem.total_amount || 0),
            0
          );

          console.log("💰 Total return amount calculated:", totalReturnAmount);
          updateFormWithReturnAmount(totalReturnAmount);
        } else {
          console.log("ℹ️ No supplier returns found for supplier", supplierId, "in warehouse", currentWarehouse.name);
          setSupplierReturns([]);
          updateFormWithReturnAmount(0);
        }
      } catch (error) {
        console.error("❌ Error fetching supplier returns:", error);
        console.error("❌ Error details:", error.response?.data || error.message);
        setSupplierReturns([]);
        updateFormWithReturnAmount(0);
        setError("Failed to fetch supplier return data. Please try again.");
      } finally {
        setIsLoadingReturns(false);
      }
    },
    [currentWarehouse, getAxiosConfig, updateFormWithReturnAmount]
  );

  // FIXED: Fetch supplier return items whenever supplier changes
  useEffect(() => {
    lastFetchedSupplier.current = null;

    if (form.supplier && currentWarehouse?.id) {
      fetchSupplierReturns(form.supplier);
    } else {
      setSupplierReturns([]);
      updateFormWithReturnAmount(0);
    }
  }, [form.supplier, currentWarehouse?.id, fetchSupplierReturns, updateFormWithReturnAmount]);

  // FIXED: Function to remove supplier returns after receiving is processed
  const removeProcessedSupplierReturns = useCallback(
    async (supplierId) => {
      if (!currentWarehouse?.id) return 0;

      try {
        console.log(
          "🧹 Removing processed supplier returns for supplier:",
          supplierId,
          "in warehouse:",
          currentWarehouse.name
        );

        const config = getAxiosConfig();
        const response = await api.get("/supplier-return-form/", config);

        // FIXED: Filter by BOTH supplier AND warehouse before removing
        const supplierReturns = response.data.filter((returnItem) => {
          const supplierMatch = String(returnItem.supplier) === String(supplierId);
          const warehouseMatch =
            String(returnItem.warehouse || returnItem.warehouse_id) === String(currentWarehouse.id);

          console.log(
            `🔍 Return to process: ${returnItem.sup_no}, Supplier match: ${supplierMatch}, Warehouse match: ${warehouseMatch}`
          );

          return supplierMatch && warehouseMatch;
        });

        console.log("📋 Found supplier returns to process for current warehouse:", supplierReturns);

        let deletedCount = 0;

        for (const returnItem of supplierReturns) {
          try {
            console.log(
              `🗑️ Removing processed supplier return: ${returnItem.sup_no} (ID: ${returnItem.id}) from warehouse ${currentWarehouse.name}`
            );
            await api.delete(`/supplier-return-form/${returnItem.id}/`, config);
            console.log(`✅ Successfully removed return: ${returnItem.sup_no}`);
            deletedCount++;
          } catch (error) {
            console.error(`❌ Error removing return ${returnItem.id}:`, error);
          }
        }

        console.log(
          `🏁 Finished removing processed supplier returns from ${currentWarehouse.name}. Removed ${deletedCount} returns.`
        );

        return deletedCount;
      } catch (error) {
        console.error("❌ Error removing processed supplier returns:", error);
        return 0;
      }
    },
    [currentWarehouse, getAxiosConfig]
  );

  const handleSupplierChange = (supplierId) => {
    lastFetchedSupplier.current = null;

    setForm((prev) => ({
      ...prev,
      supplier: supplierId,
      details: [
        {
          product_id: "",
          pcs_qty: 0,
          shell_qty: 0,
          bottle_qty: 0,
          bad_order_pcs: 0,
          unit_cost: 0,
          total: 0,
        },
      ],
    }));
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user?.id) {
      setForm((prev) => ({
        ...prev,
        received_by: user.id,
      }));

      if (user.first_name || user.last_name) {
        // already in localStorage
        setReceivedByName(`${user.first_name || ""} ${user.last_name || ""}`.trim());
      } else {
        // fetch from API
        api.get(`/users/${user.id}/`)
          .then((res) => {
            setReceivedByName(`${res.data.first_name || ""} ${res.data.last_name || ""}`.trim() || res.data.username);
          })
          .catch(() => {
            setReceivedByName(user.username || "Unknown User");
          });
      }
    }
  }, []);

  const handleRowChange = (index, field, value) => {
    const newRows = [...form.details];
    const row = newRows[index];

    row[field] = value === "" ? "" : Number(value);

    const product = filteredProducts.find((p) => p.id === Number(row.product_id));
    const content_no = product?.unit_type?.content_no || 1;

    const shell_qty = row.shell_qty === "" || isNaN(row.shell_qty) ? 0 : Number(row.shell_qty);
    const bad_order_pcs = row.bad_order_pcs === "" || isNaN(row.bad_order_pcs) ? 0 : Number(row.bad_order_pcs);

    const raw_pcs = shell_qty * content_no;
    const adjusted_pcs = Math.max(0, raw_pcs - bad_order_pcs);

    if (field === "shell_qty" || field === "bad_order_pcs") {
      row.pcs_qty = adjusted_pcs;
      row.bottle_qty = adjusted_pcs;
    }

    if (product?.price) {
      const { purchase_price = 0, shell_price = 0, bottle_price = 0 } = product.price;
      const unit_cost = purchase_price + bottle_price + (shell_price / content_no);
      row.unit_cost = unit_cost.toFixed(2);
      row.total = (adjusted_pcs * unit_cost).toFixed(2);
    }

    const total = newRows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const returnAmount = parseFloat(form.return_total_amount) || 0;
    const net = Math.max(0, total - returnAmount);

    const isLastRow = index === newRows.length - 1;
    const rowFilled = row.product_id && row.shell_qty;

    if (isLastRow && rowFilled) {
      newRows.push({
        product_id: "",
        pcs_qty: 0,
        shell_qty: 0,
        bottle_qty: 0,
        bad_order_pcs: 0,
        unit_cost: 0,
        total: 0,
      });
    }

    setForm({ ...form, details: newRows, net_amount: net.toFixed(2) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentWarehouse?.id) {
      showNotice("❌ No warehouse selected. Please contact your administrator. Debug: " + debugInfo, "error");
      return;
    }

    const filteredRows = form.details.filter((row) => row.product_id && (row.shell_qty !== "" && row.shell_qty !== 0));

    if (filteredRows.length === 0) {
      showNotice("❌ Please add at least one product to the receiving form.", "error");
      return;
    }

    if (!form.supplier) {
      showNotice("❌ Please select a supplier.", "error");
      return;
    }

    if (!form.received_by) {
      showNotice("❌ Please select who received the items.", "error");
      return;
    }

    // FIXED: Add validation for receipt number (invoice_no)
    if (!form.invoice_no || form.invoice_no.trim() === "") {
      showNotice("❌ Please enter the receipt number.", "error");
      return;
    }

    const dataToSubmit = {
      ...form,
      receive_no: receiveNo,
      details: filteredRows,
    };

    try {
      console.log("💾 Saving receiving for warehouse:", currentWarehouse.name, "ID:", currentWarehouse.id);
      console.log("💾 Data to submit:", dataToSubmit);

      const config = getAxiosConfig();
      console.log("💾 Config headers:", config.headers);

      const response = await api.post("/receiving/", dataToSubmit, config);
      console.log("✅ Receiving saved successfully", response.data);

      console.log("🧹 Starting removal of processed supplier returns...");
      const deletedCount = await removeProcessedSupplierReturns(form.supplier);

      let message = `✅ Receiving saved successfully in ${currentWarehouse.name}!`;
      if (deletedCount > 0) {
        message += ` ${deletedCount} supplier return(s) have been processed and removed.`;
      }

      showNotice(message, "success");
      setTimeout(() => {
        navigate("/receiving");
      }, 1500);
    } catch (error) {
      console.error("❌ Save failed:", error);
      console.error("❌ Error details:", error.response?.data);

      let errorMessage = "❌ Save failed! ";
      if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.response?.data) {
        errorMessage += JSON.stringify(error.response.data);
      } else {
        errorMessage += "Please check console for details.";
      }

      showNotice(errorMessage, "error");
    }
  };

  const totalReceiving = form.details.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);

  // Function to save and navigate to product form
  const navigateToAddProduct = () => {
    const selectedSupplier = suppliers.find(s => s.id === Number(form.supplier));
    
    // Save current form state before navigating
    const currentFormState = {
      ...form,
      receive_no: receiveNo,
      supplier_returns: supplierReturns,
      received_by_name: receivedByName
    };
    
    // Navigate to product form with supplier context and saved form state
    navigate('/products/new', { 
      state: { 
        preSelectedSupplier: {
          id: form.supplier,
          name: selectedSupplier?.company_name
        },
        returnTo: '/receiving/new',
        message: `Adding products for ${selectedSupplier?.company_name}`,
        savedFormState: currentFormState
      }
    });
  };

  // ---------- Single return: pick what to render ----------
  let content;

  if (isLoadingWarehouse) {
    content = (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted">Loading warehouse information...</p>
          <p className="text-sm text-muted mt-2">Mapping warehouse data...</p>
        </div>
      </div>
    );
  } else if (!currentWarehouse) {
    content = (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Warehouse Setup Required</h2>
          <p className="text-muted mb-4">{debugInfo}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} className="mt-10 receiving-form">
        {error && (
          <div className="error-box">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Basic Info - UPDATED: Both fields on same row, Supplier receiving no. left, Receipt No. right */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="form-label">Supplier Receiving No.:</label>
            <input type="text" value={receiveNo} readOnly className="form-input" style={{width: '60%' , color: 'gray'}} />
          </div>
          
          <div>
            <label className="form-label">Receipt No: <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.invoice_no}
              onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
              className="form-input"
              style={{width: '60%'}}
              placeholder="Enter receipt number"
              required
            />
          </div>
        </div>

        <div>
            <label className="form-label">Supplier:</label>
            <select
              value={form.supplier}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="form-input"
              style={{width: '30%'}}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
            {isLoadingReturns && <p className="text-primary text-sm mt-1">Loading supplier returns...</p>}
            {form.supplier && filteredProducts.length > 0 && (
              <p className="text-add text-sm mt-1">
                {filteredProducts.length} products available from this supplier in {currentWarehouse.name}
              </p>
            )}
            {form.supplier && suppliers.length > 0 && filteredProducts.length === 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-yellow-700 text-sm mb-2">
                  No products found for this supplier in {currentWarehouse.name}
                </p>
                <button
                  type="button"
                  onClick={navigateToAddProduct}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Products for this Supplier
                </button>
              </div>
            )}
        </div>

        {/* Supplier Returns */}
        {supplierReturns.length > 0 && (
          <div className="supplier-returns">
            <h3>Supplier Return Details (Will be processed)</h3>
            <div className="overflow-x-auto mt-2">
              <table className="table">
                <thead>
                  <tr>
                    <th>Return Reference</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierReturns.map((r, i) => (
                    <tr key={i}>
                      <td>{r.sup_no || "N/A"}</td>
                      <td>{r.date ? new Date(r.date).toLocaleDateString() : "N/A"}</td>
                      <td className="text-danger font-semibold">₱{formatAmount(r.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2" className="text-right font-bold">
                      Total Return Amount:
                    </td>
                    <td className="text-right font-bold text-danger">
                      ₱{formatAmount(form.return_total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Receiving Table */}
        <div className="card">
          <div className="table-wrapper">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Shell</th>
                  <th>PCS</th>
                  <th>Bad Orders (PCS)</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {form.details.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <select
                        value={row.product_id || ""}
                        onChange={(e) => {
                          if (e.target.value === "ADD_NEW_PRODUCT") {
                            navigateToAddProduct();
                          } else {
                            handleRowChange(index, "product_id", e.target.value);
                          }
                        }}
                        className="form-input"
                        disabled={!form.supplier}
                      >
                        <option value="">
                          {!form.supplier
                            ? "Select Supplier First"
                            : filteredProducts.length === 0
                            ? `No products from this supplier in ${currentWarehouse.name}`
                            : `Select Product (${filteredProducts.length} available)` }
                        </option>

                        {filteredProducts
                          .filter(
                            (p) =>
                              // Hide if already selected in another row
                              !(form.details || []).some(
                                (item, i) => i !== index && String(item.product_id) === String(p.id)
                              )
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.product_name}
                            </option>
                          ))}

                        {/* Add new product option - only show if supplier is selected */}
                        {form.supplier && (
                          <option value="ADD_NEW_PRODUCT" style={{ fontStyle: 'italic', color: '#059669', borderTop: '1px solid #e5e7eb' }}>
                            ➕ Add new product for this supplier...
                          </option>
                        )}
                      </select>
                    </td>
                    <td>
                      <input
                        ref={(el) => (shellQtyRefs.current[index] = el)}
                        type="number"
                        disabled={!row.product_id}
                        value={
                          row.shell_qty === "" || row.shell_qty === 0
                            ? ""                         // empty so placeholder shows
                            : row.shell_qty              // show the actual number
                        }
                        placeholder={row.shell_qty ? String(row.shell_qty) : "0"}
                        onChange={(e) => handleRowChange(index, "shell_qty", e.target.value)}
                        onWheel={(e) => e.target.blur()} // Prevent scroll wheel changes
                        className="form-input text-center"
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={row.pcs_qty || 0}
                        readOnly
                        disabled
                        className="form-input text-center"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={!row.product_id}
                        value={
                          row.bad_order_pcs === "" || row.bad_order_pcs === 0
                            ? ""                       // show placeholder when empty or zero
                            : row.bad_order_pcs
                        }
                        placeholder={row.bad_order_pcs ? String(row.bad_order_pcs) : "0"}
                        onChange={(e) => handleRowChange(index, "bad_order_pcs", e.target.value)}
                        onWheel={(e) => e.target.blur()} // Prevent scroll wheel changes
                        className="form-input text-center"
                        min="0"
                      />
                    </td>

                    <td className="text-center">₱{formatAmount(row.unit_cost)}</td>
                    <td className="text-center font-bold">₱{formatAmount(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Financial Summary - UPDATED: Changed terminology */}
        <div className="financial-summary">
          <h3>Financial Summary</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="form-label">Total Payable:</label>
              <div className="relative">
                <span className="currency">₱</span>
                <input
                  type="text"
                  value={formatAmount(totalReceiving)}
                  readOnly
                  className="form-input with-currency font-semibold"
                />
              </div>
            </div>
            <div>
              <label className="form-label">
                Less Returnable Value:
                {supplierReturns.length > 0 && (
                  <span className="ml-2 text-sm text-primary">({supplierReturns.length} returns)</span>
                )}
              </label>
              <div className="relative">
                <span className="currency">₱</span>
                <input
                  type="text"
                  value={formatAmount(form.return_total_amount)}
                  readOnly
                  className={`form-input with-currency font-semibold ${
                    parseFloat(form.return_total_amount) > 0 ? "text-danger" : "text"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Net Payable:</label>
              <div className="relative">
                <span className="currency">₱</span>
                <input
                  type="text"
                  value={formatAmount(form.net_amount)}
                  readOnly
                  className="form-input with-currency font-semibold"
                />
              </div>
            </div>
          </div>
          <div>
            <div className="card formula-explanation mt-5 text-blue-700" style={{ width: '30%' }} >
            <p><strong>Note:</strong>
              This is the formula used in calculating the Total:</p>
            <p><strong>Total = Unit Cost * (Pcs - Bo/Pcs)</strong></p>
            <p>Where:</p>
            <p><strong>Unit Cost = Purchase Price + Bottle Price + (Shell Price / Content No)</strong></p>
          </div>
          </div>
        </div>
        {/* Footer */}
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          <div>
            <label className="form-label">Received By:</label>
            <input
              type="text"
              value={receivedByName}
              readOnly
              className="form-input font-semibold bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="form-label">Remarks:</label>
            <textarea
              rows="3"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-actions mt-10">
          <button type="button" onClick={() => navigate("/receiving")} className="btn btn-back">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary font-semibold">
            Save to {currentWarehouse.name}
          </button>
        </div>

        {/* Notice Modal - Consistent with ProductForm INCLUDING BLUR */}
        {notice.open && (
          <div 
            className="modal-overlay" 
            style={{ 
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
            }}
          >
            <div 
              className={`modal ${notice.type === "success" ? "modal--success" : "modal--error"}`}
              style={{
                minWidth: '320px',
                maxWidth: '450px',
                padding: '24px 20px',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                border: notice.type === "success" ? '2px solid #10b981' : '2px solid #ef4444'
              }}
            >
              <div className="modal-body">
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '32px',
                    marginBottom: '12px'
                  }}>
                    {notice.type === "success" ? "✅" : "❌"}
                  </div>
                  <p 
                    className="pf-modal-text" 
                    style={{
                      fontSize: '16px',
                      lineHeight: '1.5',
                      margin: '0',
                      color: notice.type === "success" ? '#065f46' : '#991b1b',
                      fontWeight: '500'
                    }}
                  >
                    {notice.text}
                  </p>
                  {notice.type === "success" && (
                    <div style={{
                      fontSize: '13px',
                      color: '#059669',
                      marginTop: '12px',
                      fontStyle: 'italic'
                    }}>
                    
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    );
  }

  return content;
};

export default ReceivingForm;