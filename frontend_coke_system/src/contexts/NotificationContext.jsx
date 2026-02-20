// src/contexts/NotificationContext.jsx - COMPLETE FIXED VERSION WITH CREDIT NOTIFICATIONS
import React, { createContext, useContext, useReducer } from 'react';

const NotificationContext = createContext();

const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      // Check for duplicates based on notification ID
      if (state.notifications.some(n => n.id === action.payload.id)) {
        return state;
      }
      
      const newState = {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 100), // Keep max 100 notifications
        unreadCount: state.unreadCount + 1
      };
      
      return newState;
      
    case 'MARK_AS_READ':
      const newNotifications = state.notifications.map(notif =>
        notif.id === action.payload ? { ...notif, is_read: true } : notif
      );
      
      const readState = {
        ...state,
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.is_read).length
      };
      return readState;
      
    case 'MARK_ALL_AS_READ':
      const allReadState = {
        ...state,
        notifications: state.notifications.map(notif => ({ ...notif, is_read: true })),
        unreadCount: 0
      };
      return allReadState;
      
    case 'REMOVE_NOTIFICATION':
      const removedNotification = state.notifications.find(n => n.id === action.payload);
      const removeState = {
        ...state,
        notifications: state.notifications.filter(notif => notif.id !== action.payload),
        unreadCount: removedNotification && !removedNotification.is_read ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
      return removeState;
      
    case 'CLEAR_ALL':
      const clearState = {
        ...state,
        notifications: [],
        unreadCount: 0
      };
      return clearState;
      
    case 'SET_NOTIFICATIONS':
      const unread = action.payload.filter(notif => !notif.is_read).length;
      const setState = {
        ...state,
        notifications: action.payload,
        unreadCount: unread
      };
      return setState;
      
    case 'UPDATE_NOTIFICATION':
      const updateState = {
        ...state,
        notifications: state.notifications.map(notif =>
          notif.id === action.payload.id ? { ...notif, ...action.payload.updates } : notif
        )
      };
      return updateState;
      
    case 'SET_PROCESSED_IDS':
      const processedState = {
        ...state,
        processedIds: action.payload
      };
      return processedState;
      
    default:
      return state;
  }
};

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: [],
    unreadCount: 0,
    processedIds: new Set(),
    lastChecked: new Date().toISOString()
  });

  // Notification factory for different types
  const createNotification = (type, data, userRole) => {
    const timestamp = new Date().toISOString();
    const baseId = `${type}-${data.id || Date.now()}`;
    
    // Check role permissions
    if (!hasNotificationPermission(type, userRole)) {
      return null;
    }

    let notification = null;

    switch (type) {
      case 'low_stock':
        notification = {
          id: baseId,
          type: 'low_stock',
          category: 'inventory',
          title: 'Low Stock Alert',
          message: `${data.product_name || 'Unknown Product'} is running low`,
          details: `Current quantity: ${data.quantity_available || 0} PCS - Threshold: ${data.reorder_level || data.minimum_stock || 'N/A'}`,
          timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'out_of_stock':
        notification = {
          id: baseId,
          type: 'out_of_stock',
          category: 'inventory',
          title: 'Out of Stock Alert',
          message: `${data.product_name || 'Unknown Product'} is out of stock`,
          details: `Immediate restocking required - Current quantity: 0 units`,
          timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'new_receiving':
        notification = {
          id: baseId,
          type: 'new_receiving',
          category: 'inventory',
          title: 'New Stock Received',
          message: `New inventory received: ${data.receive_no || `Receipt #${data.id}`}`,
          details: `Supplier: ${data.supplier_name || data.company_name || 'Unknown'} - Amount: ₱${Number(data.net_amount || 0).toLocaleString()}`,
          timestamp: data.date_time || data.created_at || timestamp,
          is_read: false,
          priority: 'low',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'stock_adjustment':
        // IMPROVED: Use custom title and message if provided, with better remaining quantity display
        const customTitle = data.custom_title || 'Stock Adjustment Made';
        const customMessage = data.custom_message || `Stock adjusted for ${data.product_name || 'Unknown Product'}`;
        
        let adjustmentDetails = '';
        
        if (data.old_quantity !== undefined && data.new_quantity !== undefined) {
          const oldQty = Number(data.old_quantity);
          const newQty = Number(data.new_quantity);
          const changeDiff = Math.abs(newQty - oldQty);
          const changeType = newQty > oldQty ? 'increased' : 'decreased';
          
          if (newQty === 0) {
            adjustmentDetails = `Stock depleted: ${oldQty} → 0 units (${changeDiff} units removed)`;
          } else if (changeType === 'increased') {
            adjustmentDetails = `Stock increased: ${oldQty} → ${newQty} units (+${changeDiff} units added)`;
          } else {
            adjustmentDetails = `Stock reduced: ${oldQty} → ${newQty} units (-${changeDiff} units removed) • Remaining: ${newQty} units`;
          }
          
          // Add reason if provided
          if (data.reason && !data.reason.includes('Stock adjustment:')) {
            adjustmentDetails += ` • Reason: ${data.reason}`;
          }
        } else if (data.quantity_adjusted || data.adjustment_summary) {
          adjustmentDetails = `Adjustment: ${data.adjustment_summary || `${data.quantity_adjusted || 0} units`}`;
          if (data.remaining_quantity !== undefined) {
            adjustmentDetails += ` • Remaining: ${data.remaining_quantity} units`;
          }
        } else {
          adjustmentDetails = data.reason || 'Manual stock adjustment detected';
        }

        notification = {
          id: baseId,
          type: 'stock_adjustment',
          category: 'inventory',
          title: customTitle,
          message: customMessage,
          details: adjustmentDetails,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: (data.new_quantity === 0 || data.remaining_quantity === 0) ? 'high' : 'medium',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'expense_created':
        notification = {
          id: baseId,
          type: 'expense_created',
          category: 'expenses',
          title: 'New Expense Created',
          message: `Expense: ${data.description || 'New expense recorded'}`,
          details: `Amount: ₱${Number(data.amount || 0).toLocaleString()} - Category: ${data.category || 'General'}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: Number(data.amount || 0) > 10000 ? 'high' : 'low',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'expense_updated':
        notification = {
          id: baseId,
          type: 'expense_updated',
          category: 'expenses',
          title: 'Expense Updated',
          message: `Expense modified: ${data.description || 'Expense updated'}`,
          details: `New Amount: ₱${Number(data.amount || 0).toLocaleString()}${data.old_amount ? ` (was ₱${Number(data.old_amount).toLocaleString()})` : ''}`,
          timestamp: data.updated_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'expense_deleted':
        notification = {
          id: baseId,
          type: 'expense_deleted',
          category: 'expenses',
          title: 'Expense Deleted',
          message: `Expense removed: ${data.description || 'Expense deleted'}`,
          details: `Amount: ₱${Number(data.amount || 0).toLocaleString()}`,
          timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'large_expense':
        notification = {
          id: baseId,
          type: 'large_expense',
          category: 'expenses',
          title: 'Large Expense Alert',
          message: `High-value expense flagged: ${data.description || 'Large expense'}`,
          details: `Amount: ₱${Number(data.amount || 0).toLocaleString()} - Exceeds threshold of ₱${Number(data.threshold || 0).toLocaleString()}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'supplier_added':
        notification = {
          id: baseId,
          type: 'supplier_added',
          category: 'suppliers',
          title: 'New Supplier Added',
          message: `New supplier: ${data.company_name || data.supplier_name || data.name || 'Unknown Supplier'}`,
          details: `Contact: ${data.phone_number || data.contact_number || data.phone || 'N/A'}${data.address ? ` - Address: ${data.address}` : ''}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'low',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'supplier_updated':
        notification = {
          id: baseId,
          type: 'supplier_updated',
          category: 'suppliers',
          title: 'Supplier Information Updated',
          message: `Supplier updated: ${data.company_name || data.supplier_name || data.name || 'Unknown Supplier'}`,
          details: `Changes made to supplier profile - Contact: ${data.contact_number || data.phone_number || 'N/A'}`,
          timestamp: data.updated_at || timestamp,
          is_read: false,
          priority: 'low',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'supplier_return_processed':
        notification = {
          id: baseId,
          type: 'supplier_return_processed',
          category: 'suppliers',
          title: 'Supplier Return Processed',
          message: `Return processed: ${data.sup_no || data.return_no || `Return #${data.id}`}`,
          details: `Supplier: ${data.supplier_name || data.company_name || 'Unknown Supplier'} - Amount: ₱${Number(data.total_amount || data.amount || 0).toLocaleString()}${data.quantity_returned ? ` - Qty: ${data.quantity_returned}` : ''}`,
          timestamp: data.created_at || data.date || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'supplier_return':
        notification = {
          id: baseId,
          type: 'supplier_return',
          category: 'suppliers',
          title: 'Supplier Return Processed',
          message: `Return processed for ${data.supplier_name || data.company_name || 'Unknown Supplier'}`,
          details: `Return No: ${data.return_no || data.id} - Amount: ₱${Number(data.amount || 0).toLocaleString()}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'warehouse_msp_created':
        // ✅ ENHANCED: Better expected sale calculation for warehouse transactions
        const warehouseExpectedSale = Number(data.expected_sale || data.total_amount || data.actual_sale || 0);
        const hasItems = Array.isArray(data.items) && data.items.length > 0;
        const calculatedFromItems = hasItems 
          ? data.items.reduce((sum, item) => sum + Number(item.expected_sale || item.actual_sale || 0), 0)
          : 0;
        
        // Use the higher of the two values (expected_sale from data or calculated from items)
        const finalExpectedSale = Math.max(warehouseExpectedSale, calculatedFromItems);
        const isVanLoadCreated = data.is_van_load || (data.transaction_type_name || '').toLowerCase().includes('van load');
        const creationType = isVanLoadCreated ? 'Van Load' : 'Warehouse MSP';
        
        notification = {
          id: baseId,
          type: 'warehouse_msp_created',
          category: 'warehouse',
          title: `New ${creationType} Created`,
          message: `${creationType} created: ${data.msp_no || data.msp_number || `MSP #${data.id}`}`,
          details: `Type: ${data.transaction_type_name || data.transaction_type || 'Unknown'} - Handler: ${data.handled_by || 'Unknown'} - Expected Sale: ₱${finalExpectedSale.toLocaleString()}${isVanLoadCreated && data.route ? ` - Route: ${typeof data.route === 'object' ? data.route.name : data.route}` : ''}`,
          timestamp: data.created_at || data.date_time || timestamp,
          is_read: false,
          priority: finalExpectedSale > 1000 ? 'medium' : 'low',
          data: {
            ...data,
            calculated_expected_sale: finalExpectedSale,
            original_expected_sale: warehouseExpectedSale,
            items_total: calculatedFromItems,
            is_van_load: isVanLoadCreated,
            creation_type: creationType
          },
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'warehouse_msp_updated':
        // ✅ ENHANCED: Better handling for Van Load vs Warehouse MSP updates
        const isVanLoadUpdate = data.is_van_load || (data.transaction_type_name || '').toLowerCase().includes('van load') || data.action_type?.includes('van_load');
        const updateTypeTitle = isVanLoadUpdate ? 'Van Load Updated' : 'MSP Updated';
        const updatePriority = isVanLoadUpdate && (data.status || '').toLowerCase() === 'complete' ? 'high' : 'medium';
        
        // ✅ Enhanced details with change summary
        let updateDetails = '';
        if (data.changes_summary) {
          updateDetails = data.changes_summary;
        } else {
          updateDetails = `Type: ${data.transaction_type_name || data.transaction_type || 'Unknown'} - Status: ${data.status || 'Unknown'} - Handler: ${data.handled_by || 'Unknown'}`;
        }
        
        // ✅ Add expected sale info if available
        if (data.expected_sale || data.actual_sale) {
          const expectedSale = Number(data.expected_sale || 0);
          const actualSale = Number(data.actual_sale || 0);
          if (expectedSale > 0) {
            updateDetails += ` - Expected Sale: ₱${expectedSale.toLocaleString()}`;
          }
          if (actualSale > 0 && actualSale !== expectedSale) {
            updateDetails += ` - Actual Sale: ₱${actualSale.toLocaleString()}`;
          }
        }

        notification = {
          id: baseId,
          type: 'warehouse_msp_updated',
          category: 'warehouse',
          title: updateTypeTitle,
          message: `${isVanLoadUpdate ? 'Van Load' : 'MSP'} updated: ${data.msp_no || data.msp_number || `MSP #${data.id}`}`,
          details: updateDetails,
          timestamp: data.updated_at || data.date_time || timestamp,
          is_read: false,
          priority: updatePriority,
          data: {
            ...data,
            update_type: isVanLoadUpdate ? 'van_load' : 'warehouse_msp'
          },
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      case 'warehouse_msp':
        notification = {
          id: baseId,
          type: 'warehouse_msp',
          category: 'warehouse',
          title: 'Warehouse MSP Updated',
          message: `MSP ${data.action || 'modified'}: ${data.msp_no || `MSP #${data.id}`}`,
          details: `Warehouse: ${data.warehouse_name || 'Unknown'} - Status: ${data.status || 'N/A'}`,
          timestamp: data.updated_at || data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin', 'supervisor']
        };
        break;

      // ✅ NEW: Credit Notification Types
      case 'credit_created':
        notification = {
          id: baseId,
          type: 'credit_created',
          category: 'payments',
          title: 'New Credit Sale Created',
          message: `Credit sale created for ${data.customer_name || 'Unknown Customer'}`,
          details: `MSP: ${data.msp_no || `Credit #${data.id}`} - Amount: ₱${Number(data.balance || data.amount || 0).toLocaleString()}${data.due_date ? ` - Due: ${new Date(data.due_date).toLocaleDateString()}` : ''}${data.credit_terms ? ` - Terms: ${data.credit_terms} days` : ''}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'credit_overdue':
        const daysOverdue = data.days_overdue || 0;
        notification = {
          id: baseId,
          type: 'credit_overdue',
          category: 'payments',
          title: 'Credit Payment Overdue',
          message: `Overdue payment: ${data.customer_name || 'Unknown Customer'} - ${daysOverdue} days late`,
          details: `MSP: ${data.msp_no || `Credit #${data.id}`} - Outstanding: ₱${Number(data.balance || data.amount || 0).toLocaleString()}${data.due_date ? ` - Due Date: ${new Date(data.due_date).toLocaleDateString()}` : ''}${data.original_amount ? ` - Original: ₱${Number(data.original_amount).toLocaleString()}` : ''}`,
          timestamp: data.updated_at || data.created_at || timestamp,
          is_read: false,
          priority: daysOverdue > 30 ? 'high' : 'medium',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'paid_credit':
        notification = {
          id: baseId,
          type: 'paid_credit',
          category: 'payments',
          title: 'Credit Payment Received',
          message: `Payment received for ${data.msp_no || `Credit #${data.id}`}`,
          details: `Customer: ${data.customer_name || 'Unknown'} - Amount: ₱${Number(data.balance || data.payment_amount || data.amount || 0).toLocaleString()}${data.payment_method ? ` - Method: ${data.payment_method}` : ''}${data.payment_date ? ` - Date: ${new Date(data.payment_date).toLocaleDateString()}` : ''}`,
          timestamp: data.updated_at || data.payment_date || data.created_at || timestamp,
          is_read: false,
          priority: 'low',
          data,
          allowedRoles: ['admin', 'supervisor', 'cashier']
        };
        break;

      case 'role_updated':
        notification = {
          id: baseId,
          type: 'role_updated',
          category: 'system',
          title: 'Role Permissions Updated',
          message: `Role permissions changed for ${data.user_name || data.role_name || 'user'}`,
          details: `New role: ${data.new_role || data.role_name || 'N/A'} - Updated by: ${data.updated_by || 'System'}${data.permissions_count ? ` - Permissions: ${data.permissions_count}` : ''}`,
          timestamp: data.updated_at || timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'menu_access_changed':
        notification = {
          id: baseId,
          type: 'menu_access_changed',
          category: 'system',
          title: 'Submenu Access Modified',
          message: `Submenu access updated for ${data.role_name || 'role'}`,
          details: `Menu: ${data.menu_name || 'N/A'} - Access: ${data.access_granted ? 'Granted' : 'Revoked'}`,
          timestamp: data.updated_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'admin_settings_changed':
        notification = {
          id: baseId,
          type: 'admin_settings_changed',
          category: 'system',
          title: 'Admin Settings Modified',
          message: `System settings updated: ${data.setting_name || 'Configuration changed'}`,
          details: `Changed by: ${data.changed_by || 'Admin'}${data.old_value ? ` - Previous: ${data.old_value}` : ''}${data.new_value ? ` - New: ${data.new_value}` : ''}`,
          timestamp: data.updated_at || timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'new_sale':
        notification = {
          id: baseId,
          type: 'new_sale',
          category: 'sales',
          title: 'New Sale Recorded',
          message: `Sale completed: ${data.transaction_no || `Sale #${data.id}`}`,
          details: `Amount: ₱${Number(data.total_amount || 0).toLocaleString()} - Customer: ${data.customer_name || 'Walk-in'}${data.cashier_name ? ` - Cashier: ${data.cashier_name}` : ''}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'low',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'sale_voided':
        notification = {
          id: baseId,
          type: 'sale_voided',
          category: 'sales',
          title: 'Sale Voided/Canceled',
          message: `Sale voided: ${data.transaction_no || `Sale #${data.id}`}`,
          details: `Amount: ₱${Number(data.total_amount || 0).toLocaleString()}${data.void_reason ? ` - Reason: ${data.void_reason}` : ''}`,
          timestamp: data.voided_at || timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'draft_transaction':
        notification = {
          id: baseId,
          type: 'draft_transaction',
          category: 'sales',
          title: 'Draft Transaction Saved',
          message: `Van Load pending: ${data.draft_no || `Draft #${data.id}`}`,
          details: `Items: ${data.item_count || 0} - Amount: ₱${Number(data.total_amount || 0).toLocaleString()}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'return_refund':
        notification = {
          id: baseId,
          type: 'return_refund',
          category: 'sales',
          title: 'Return/Refund Processed',
          message: `Return processed: ${data.return_no || `Return #${data.id}`}`,
          details: `Amount: ₱${Number(data.refund_amount || 0).toLocaleString()}${data.return_reason ? ` - Reason: ${data.return_reason}` : ''}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      // ✅ NEW: Product Management Notifications
      case 'product_created':
        notification = {
          id: baseId,
          type: 'product_created',
          category: 'products',
          title: 'New Product Added',
          message: `Product created: ${data.product_name || data.name || 'Unknown Product'}`,
          details: `Code: ${data.product_code || data.code || 'N/A'} - Category: ${data.category || 'General'} - Price: ₱${Number(data.selling_price || data.price || 0).toLocaleString()}`,
          timestamp: data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'product_updated':
        // Enhanced product update with change detection
        let productChanges = [];
        if (data.changes) {
          if (data.changes.name) productChanges.push(`Name: ${data.changes.name.old} → ${data.changes.name.new}`);
          if (data.changes.price) productChanges.push(`Price: ₱${Number(data.changes.price.old || 0).toLocaleString()} → ₱${Number(data.changes.price.new || 0).toLocaleString()}`);
          if (data.changes.category) productChanges.push(`Category: ${data.changes.category.old} → ${data.changes.category.new}`);
          if (data.changes.status) productChanges.push(`Status: ${data.changes.status.old} → ${data.changes.status.new}`);
        }
        
        notification = {
          id: baseId,
          type: 'product_updated',
          category: 'products',
          title: 'Product Information Updated',
          message: `Product modified: ${data.product_name || data.name || 'Unknown Product'}`,
          details: productChanges.length > 0 ? productChanges.join(' • ') : `Code: ${data.product_code || data.code || 'N/A'}${data.updated_by ? ` - Updated by: ${data.updated_by}` : ''}`,
          timestamp: data.updated_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'product_deleted':
        notification = {
          id: baseId,
          type: 'product_deleted',
          category: 'products',
          title: 'Product Removed',
          message: `Product deleted: ${data.product_name || data.name || 'Unknown Product'}`,
          details: `Code: ${data.product_code || data.code || 'N/A'}${data.deleted_by ? ` - Deleted by: ${data.deleted_by}` : ''}`,
          timestamp: data.deleted_at || timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin']
        };
        break;

      // ✅ NEW: Returns/Refunds Processing Notifications
      case 'return_processed':
        notification = {
          id: baseId,
          type: 'return_processed',
          category: 'returns',
          title: 'Customer Return Processed',
          message: `Return completed: ${data.return_no || data.transaction_no || `Return #${data.id}`}`,
          details: `Customer: ${data.customer_name || 'Walk-in'} - Amount: ₱${Number(data.refund_amount || data.total_amount || 0).toLocaleString()}${data.items_count || data.quantity ? ` - Items: ${data.items_count || data.quantity}` : ''}`,
          timestamp: data.processed_at || data.created_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'refund_issued':
        notification = {
          id: baseId,
          type: 'refund_issued',
          category: 'returns',
          title: 'Refund Processed',
          message: `Refund issued: ${data.refund_no || data.return_no || `Refund #${data.id}`}`,
          details: `Customer: ${data.customer_name || 'Unknown'} - Amount: ₱${Number(data.refund_amount || 0).toLocaleString()}${data.refund_method ? ` - Method: ${data.refund_method}` : ''}${data.return_reason ? ` - Reason: ${data.return_reason}` : ''}`,
          timestamp: data.refund_date || data.processed_at || timestamp,
          is_read: false,
          priority: 'high',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'return_rejected':
        notification = {
          id: baseId,
          type: 'return_rejected',
          category: 'returns',
          title: 'Return Request Rejected',
          message: `Return denied: ${data.return_no || `Return #${data.id}`}`,
          details: `Customer: ${data.customer_name || 'Unknown'}${data.rejection_reason ? ` - Reason: ${data.rejection_reason}` : ''}${data.items_count ? ` - Items: ${data.items_count}` : ''}`,
          timestamp: data.rejected_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      case 'exchange_processed':
        notification = {
          id: baseId,
          type: 'exchange_processed',
          category: 'returns',
          title: 'Product Exchange Completed',
          message: `Exchange processed: ${data.exchange_no || `Exchange #${data.id}`}`,
          details: `Customer: ${data.customer_name || 'Unknown'}${data.old_product_name ? ` - Old: ${data.old_product_name}` : ''}${data.new_product_name ? ` - New: ${data.new_product_name}` : ''}`,
          timestamp: data.exchanged_at || data.processed_at || timestamp,
          is_read: false,
          priority: 'medium',
          data,
          allowedRoles: ['admin']
        };
        break;

      default:
        console.warn(`Unknown notification type: ${type}`);
        return null;
    }

    return notification;
  };

  // ✅ ENHANCED: Check if user role has permission for notification type with credit support
  const hasNotificationPermission = (type, userRole) => {
    const rolePermissions = {
      'admin': ['inventory', 'expenses', 'suppliers', 'warehouse', 'system', 'sales', 'payments', 'products', 'returns'],
      'administrator': ['inventory', 'expenses', 'suppliers', 'warehouse', 'system', 'sales', 'payments', 'products', 'returns'],
      'super admin': ['inventory', 'expenses', 'suppliers', 'warehouse', 'system', 'sales', 'payments', 'products', 'returns'],
      'supervisor': ['inventory', 'expenses', 'suppliers', 'warehouse', 'payments'],
      'cashier': ['inventory', 'payments'],
      'staff': ['inventory', 'payments']
    };

    const notificationCategories = {
      'low_stock': 'inventory',
      'out_of_stock': 'inventory',
      'new_receiving': 'inventory',
      'stock_adjustment': 'inventory',
      'expense_created': 'expenses',
      'expense_updated': 'expenses',
      'expense_deleted': 'expenses',
      'large_expense': 'expenses',
      'supplier_added': 'suppliers',
      'supplier_updated': 'suppliers',
      'supplier_return': 'suppliers',
      'supplier_return_processed': 'suppliers',
      'warehouse_msp': 'warehouse',
      'warehouse_msp_created': 'warehouse',
      'warehouse_msp_updated': 'warehouse',
      'van_load_edit_request': 'inventory',
      'van_load_edit_decision': 'inventory',
      'role_updated': 'system',
      'menu_access_changed': 'system',
      'admin_settings_changed': 'system',
      'new_sale': 'sales',
      'sale_voided': 'sales',
      'draft_transaction': 'sales',
      'return_refund': 'sales',
      // ✅ Credit notifications - all users can see their own credits
      'credit_created': 'payments',
      'credit_overdue': 'payments',
      'paid_credit': 'payments',
      // ✅ Product and Returns categories
      'product_created': 'products',
      'product_updated': 'products',
      'product_deleted': 'products',
      'return_processed': 'returns',
      'refund_issued': 'returns',
      'return_rejected': 'returns',
      'exchange_processed': 'returns'
    };

    const category = notificationCategories[type];
    if (!category) {
      console.warn(`Unknown notification category for type: ${type}`);
      return false;
    }

    const allowedCategories = rolePermissions[userRole?.toLowerCase()] || [];
    
    return allowedCategories.includes(category);
  };

  const addNotification = (type, data, userRole) => {
    const notification = createNotification(type, data, userRole);
    
    if (notification) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
      
      // Show browser notification if permission granted (only for high priority notifications)
      if (Notification.permission === "granted" && notification.priority === 'high') {
        try {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: notification.id,
            requireInteraction: false
          });
        } catch (error) {
          console.warn('Browser notification failed:', error.message);
        }
      }
      
      return notification;
    }
    
    return null;
  };

  return (
    <NotificationContext.Provider value={{ 
      state, 
      dispatch, 
      addNotification,
      createNotification,
      hasNotificationPermission
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};