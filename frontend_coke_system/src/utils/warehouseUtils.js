// src/utils/warehouseUtils.js - Warehouse utility functions
import api from "../api";

export const getCurrentWarehouse = () => {
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");

  console.log("Warehouse utils: current context", { userData, selectedWarehouse });

  const assignedWarehouseId = userData?.warehouse_id ? parseInt(userData.warehouse_id, 10) : null;
  const normalizedRole = String(userData?.role || "").toLowerCase();
  const isAdmin = normalizedRole.includes("admin");

  // Admin users can switch warehouse from the header. Respect selectedWarehouse if present.
  if (isAdmin) {
    if (selectedWarehouse && selectedWarehouse.id) {
      console.log("Admin using selected warehouse:", selectedWarehouse);
      return selectedWarehouse;
    }

    if (assignedWarehouseId) {
      const enrolledWarehouse = { id: assignedWarehouseId, name: userData.warehouse };
      localStorage.setItem("selectedWarehouse", JSON.stringify(enrolledWarehouse));
      console.log("Admin fallback to enrolled warehouse:", enrolledWarehouse);
      return enrolledWarehouse;
    }
  }

  // Non-admin users are locked to their enrolled warehouse.
  if (assignedWarehouseId) {
    const enrolledWarehouse = { id: assignedWarehouseId, name: userData.warehouse };
    console.log("Non-admin using enrolled warehouse:", enrolledWarehouse);
    return enrolledWarehouse;
  }

  // Fallback - try to find by warehouse name if warehouse_id doesn't exist
  if (userData.warehouse && !userData.warehouse_id) {
    console.log("Warehouse ID missing, resolving by name:", userData.warehouse);
    return { name: userData.warehouse, needsIdLookup: true };
  }

  console.warn("No warehouse found for user");
  return null;
};

export const getWarehouseAxiosConfig = (warehouse) => {
  const config = {};

  if (warehouse?.id) {
    // Use X-Warehouse-ID header (like ReceivingList)
    config.headers = { "X-Warehouse-ID": warehouse.id };
    console.log("Using warehouse header:", warehouse.id);
  }

  return config;
};

export const getWarehouseQueryParam = (warehouse) => {
  if (warehouse?.id) {
    console.log("Using warehouse query param:", warehouse.id);
    return warehouse.id;
  }
  return null;
};

// Function to find warehouse by name (for users who don't have warehouse_id)
export const findWarehouseByName = async (warehouseName) => {
  try {
    console.log("Looking up warehouse by name:", warehouseName);
    const response = await api.get("warehouses/");
    const warehouses = response.data;

    const found = warehouses.find(
      (w) => w.name === warehouseName || w.name.toLowerCase() === String(warehouseName).toLowerCase()
    );

    if (found) {
      console.log("Found warehouse by name:", found);
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      userData.warehouse_id = found.id;
      localStorage.setItem("user", JSON.stringify(userData));
      return found;
    }

    console.warn("Warehouse not found by name:", warehouseName);
    return null;
  } catch (error) {
    console.error("Error finding warehouse by name:", error);
    return null;
  }
};
