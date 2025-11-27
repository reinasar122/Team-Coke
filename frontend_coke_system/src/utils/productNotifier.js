// utils/productNotifier.js - FIXED VERSION WITH PROPER WAREHOUSE CONTEXT
export const notifyProductChange = (productData) => {
  console.log('📦 Notifying product change:', productData);
  
  const event = new CustomEvent('productUpdated', {
    detail: {
      action: productData.action || 'updated', // 'created', 'updated', 'deleted'
      productId: productData.id,
      productName: productData.product_name || productData.name,
      productCode: productData.product_code || productData.code,
      category: productData.category,
      price: productData.selling_price || productData.price,
      changes: productData.changes, // Detailed change information
      // ✅ ENHANCED: Warehouse isolation fields - THESE ARE NEW/MODIFIED
      warehouseId: productData.warehouse_id || productData.warehouseId,
      warehouse_id: productData.warehouse_id || productData.warehouseId,
      targetWarehouse: productData.targetWarehouse,               // NEW: Target specific warehouse
      restrictToWarehouse: productData.restrictToWarehouse || false, // NEW: Enable warehouse restriction
      sourceWarehouse: productData.source_warehouse,
      metadata: productData.metadata,
      createdBy: productData.created_by || productData.createdBy,
      timestamp: new Date().toISOString(),
      summary: generateChangeSummary(productData.action, productData.changes, productData.product_name)
    }
  });
  
  // ✅ Enhanced logging for debugging - NEW LOGGING
  console.log('🔔 Event details:', {
    warehouse: event.detail.warehouseId,
    target: event.detail.targetWarehouse,
    restricted: event.detail.restrictToWarehouse,
    product: event.detail.productName
  });
  
  window.dispatchEvent(event);
};

// Helper function to generate human-readable change summary
const generateChangeSummary = (action, changes, productName) => {
  if (action === 'created') {
    return `New product "${productName}" added to inventory`;
  }
  
  if (action === 'deleted') {
    return `Product "${productName}" removed from inventory`;
  }
  
  if (action === 'updated' && changes) {
    const changeList = [];
    
    if (changes.name) {
      changeList.push(`name changed to "${changes.name.new}"`);
    }
    
    if (changes.price) {
      const oldPrice = Number(changes.price.old).toLocaleString();
      const newPrice = Number(changes.price.new).toLocaleString();
      changeList.push(`price updated from ₱${oldPrice} to ₱${newPrice}`);
    }
    
    if (changes.category) {
      changeList.push(`category changed to "${changes.category.new}"`);
    }
    
    if (changes.supplier_code) {
      changeList.push(`supplier code changed to "${changes.supplier_code.new}"`);
    }
    
    if (changes.returnable) {
      changeList.push(`returnable status changed to ${changes.returnable.new ? 'Yes' : 'No'}`);
    }
    
    if (changes.purchase_price) {
      const oldPP = Number(changes.purchase_price.old).toLocaleString();
      const newPP = Number(changes.purchase_price.new).toLocaleString();
      changeList.push(`purchase price: ₱${oldPP} → ₱${newPP}`);
    }
    
    if (changes.shell_price) {
      const oldSP = Number(changes.shell_price.old).toLocaleString();
      const newSP = Number(changes.shell_price.new).toLocaleString();
      changeList.push(`shell price: ₱${oldSP} → ₱${newSP}`);
    }
    
    if (changes.bottle_price) {
      const oldBP = Number(changes.bottle_price.old).toLocaleString();
      const newBP = Number(changes.bottle_price.new).toLocaleString();
      changeList.push(`bottle price: ₱${oldBP} → ₱${newBP}`);
    }
    
    if (changes.content_no) {
      changeList.push(`content number changed to "${changes.content_no.new}"`);
    }
    
    if (changes.image) {
      if (changes.image.new === 'removed') {
        changeList.push('image removed');
      } else if (changes.image.old === 'none') {
        changeList.push('image added');
      } else {
        changeList.push('image updated');
      }
    }
    
    return `Product "${productName}" updated: ${changeList.join(', ')}`;
  }
  
  return `Product "${productName}" was modified`;
};