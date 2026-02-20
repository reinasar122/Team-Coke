// src/utils/warehouseUtils.js - Warehouse utility functions
import api from '../api'; // Import the API helper

export const getCurrentWarehouse = () => {
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
  
  console.log('🏭 Getting current warehouse:', { userData, selectedWarehouse });
  const assignedWarehouseId = userData?.warehouse_id ? parseInt(userData.warehouse_id) : null;
  // For admin users, use selected warehouse or their enrolled warehouse
  if (userData.role?.toLowerCase() === "admin") {
    if (selectedWarehouse && selectedWarehouse.id) {
      const selectedId = parseInt(selectedWarehouse.id);
      if (assignedWarehouseId && selectedId !== assignedWarehouseId) {
        const enforcedWarehouse = { id: assignedWarehouseId, name: userData.warehouse };
        localStorage.setItem("selectedWarehouse", JSON.stringify(enforcedWarehouse));
        console.log('👑 Admin selected warehouse mismatched assignment, enforcing assigned warehouse:', enforcedWarehouse);
        return enforcedWarehouse;
      }
      console.log('👑 Admin using selected warehouse:', selectedWarehouse);
      return selectedWarehouse;
    } else if (assignedWarehouseId) {
      console.log('👑 Admin using enrolled warehouse:', { id: userData.warehouse_id, name: userData.warehouse });
      const enrolledWarehouse = { id: assignedWarehouseId, name: userData.warehouse };
      localStorage.setItem("selectedWarehouse", JSON.stringify(enrolledWarehouse));
      return enrolledWarehouse;
    }
  }
  
  // For non-admin users, always use their enrolled warehouse
  if (assignedWarehouseId) {
    console.log('👤 Non-admin using enrolled warehouse:', { id: userData.warehouse_id, name: userData.warehouse });
    return { id: assignedWarehouseId, name: userData.warehouse };
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
    const response = await api.get("warehouses/"); // Use the api helper
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
