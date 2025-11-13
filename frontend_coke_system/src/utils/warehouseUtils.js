// src/utils/warehouseUtils.js - Warehouse utility functions
import axios from 'axios';

export const getCurrentWarehouse = () => {
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  
  console.log('🏭 Getting current warehouse:', { userData, selectedWarehouse });
  
  // For admin users, use selected warehouse or their enrolled warehouse
  if (userData.role?.toLowerCase() === "admin") {
    if (selectedWarehouse && selectedWarehouse.id) {
      console.log('👑 Admin using selected warehouse:', selectedWarehouse);
      return selectedWarehouse;
    } else if (userData.warehouse_id) {
      console.log('👑 Admin using enrolled warehouse:', { id: userData.warehouse_id, name: userData.warehouse });
      return { id: userData.warehouse_id, name: userData.warehouse };
    }
  }
  
  // For non-admin users, always use their enrolled warehouse
  if (userData.warehouse_id) {
    console.log('👤 Non-admin using enrolled warehouse:', { id: userData.warehouse_id, name: userData.warehouse });
    return { id: userData.warehouse_id, name: userData.warehouse };
  }
  
  // Fallback - try to find by warehouse name if warehouse_id doesn't exist
  if (userData.warehouse && !userData.warehouse_id) {
    console.log('🔍 Need to find warehouse by name:', userData.warehouse);
    return { name: userData.warehouse, needsIdLookup: true };
  }
  
  console.warn('⚠️ No warehouse found for user');
  return null;
};

export const getWarehouseAxiosConfig = (warehouse) => {
  const config = {};
  
  if (warehouse?.id) {
    // Use X-Warehouse-ID header (like ReceivingList)
    config.headers = { "X-Warehouse-ID": warehouse.id };
    console.log('📡 Using warehouse header:', warehouse.id);
  }
  
  return config;
};

export const getWarehouseQueryParam = (warehouse) => {
  if (warehouse?.id) {
    console.log('📋 Using warehouse query param:', warehouse.id);
    return warehouse.id;
  }
  return null;
};

// Function to find warehouse by name (for users who don't have warehouse_id)
export const findWarehouseByName = async (warehouseName) => {
  try {
    console.log('🔍 Looking up warehouse by name:', warehouseName);
    const response = await axios.get("http://localhost:8080/api/warehouses/");
    const warehouses = response.data;
    
    const found = warehouses.find(w => 
      w.name === warehouseName || 
      w.name.toLowerCase() === warehouseName.toLowerCase()
    );
    
    if (found) {
      console.log('✅ Found warehouse by name:', found);
      // Update user object with warehouse_id
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      userData.warehouse_id = found.id;
      localStorage.setItem("user", JSON.stringify(userData));
      return found;
    }
    
    console.warn('❌ Warehouse not found by name:', warehouseName);
    return null;
  } catch (error) {
    console.error('❌ Error finding warehouse by name:', error);
    return null;
  }
};