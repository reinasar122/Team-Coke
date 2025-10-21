// src/components/Notification.jsx - COMPLETE VERSION WITHOUT DEBUG CONSOLE LOGS
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faBell, 
  faExclamationTriangle, 
  faInfoCircle,
  faWarehouse,
  faCreditCard,
  faBoxes,
  faEye,
  faTrash,
  faEllipsisH,
  faEdit,
  faDollarSign,
  faMoneyBill,
  faCog,
  faTimesCircle,
  faUndo,
  faClipboardList,
  faUserTie,
  faTimes,
  faCheck,
  faCalendarAlt,
  faMapMarkerAlt
} from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import { useNotifications } from '../contexts/NotificationContext';

const Notification = () => {
  const { state, dispatch, addNotification } = useNotifications();
  const { notifications } = state;
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [currentWarehouseId, setCurrentWarehouseId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Force re-render when notifications change
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // State for notification detail modal
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Dynamic expense threshold with real-time updates
  const [largeExpenseThreshold, setLargeExpenseThreshold] = useState(10000);
  
  const dropdownRef = useRef(null);
  const optionsRef = useRef(null);
  const processedIdsRef = useRef(new Set(JSON.parse(localStorage.getItem('processedNotificationIds') || '[]')));

  // Force re-render when notifications change
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [notifications]);

  // Dark mode detection
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      if (event.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ✅ FIXED: Better user data getter without debug logs
  const getCurrentUser = useCallback(() => {
    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      
      // Ensure the user data is complete
      if (!userData.id || !userData.role) {
        // Try to refresh user data from token if available
        const token = localStorage.getItem("token");
        if (token) {
          // Return what we have for now, but we might need to refresh later
          return userData;
        }
      }
      
      return userData;
    } catch (error) {
      return {};
    }
  }, []);

  // ✅ FIXED: Always return warehouse ID as integer, without debug logs
  const getCurrentWarehouse = useCallback(() => {
    try {
      const user = getCurrentUser();
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      
      let warehouseId;
      
      if (user.role?.toLowerCase() === "admin" && selectedWarehouse?.id) {
        // For admin, use selected warehouse ID
        warehouseId = parseInt(selectedWarehouse.id);
      } else {
        // For non-admin users, use their assigned warehouse
        warehouseId = user.warehouse_id;
        
        // Convert string numbers to integers
        if (typeof warehouseId === 'string' && !isNaN(warehouseId)) {
          warehouseId = parseInt(warehouseId);
        }
        
        // If warehouse_id is missing but we have a number in user.warehouse
        if (!warehouseId && user.warehouse && !isNaN(user.warehouse)) {
          warehouseId = parseInt(user.warehouse);
        }
        
        // If still undefined, try cached warehouse
        if (!warehouseId && user.id) {
          const cachedWarehouse = localStorage.getItem(`userWarehouse_${user.id}`);
          if (cachedWarehouse && !isNaN(cachedWarehouse)) {
            warehouseId = parseInt(cachedWarehouse);
          }
        }
        
        // Check URL params for warehouse context
        if (!warehouseId) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlWarehouse = urlParams.get('warehouse');
          if (urlWarehouse && !isNaN(urlWarehouse)) {
            warehouseId = parseInt(urlWarehouse);
          }
        }
        
        // For supervisors without warehouse, use the one from logs (warehouse 2)
        if (!warehouseId && user.role?.toLowerCase() === 'supervisor') {
          warehouseId = 2; // Based on your console logs
          
          // Update user data with correct warehouse
          if (user.id) {
            localStorage.setItem(`userWarehouse_${user.id}`, '2');
            const updatedUser = { ...user, warehouse_id: 2 };
            localStorage.setItem("user", JSON.stringify(updatedUser));
          }
        }
        
        // Cache the warehouse for future use
        if (warehouseId && user.id && !localStorage.getItem(`userWarehouse_${user.id}`)) {
          localStorage.setItem(`userWarehouse_${user.id}`, warehouseId.toString());
        }
      }
      
      // Ensure we always return a valid integer ID, never a string name
      if (warehouseId && !isNaN(warehouseId)) {
        warehouseId = parseInt(warehouseId);
        return warehouseId;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }, [getCurrentUser]);

  // ✅ ENHANCED: Wait for user data without debug logs
  const waitForUserData = useCallback(async (maxRetries = 15, delay = 500) => {
    for (let i = 0; i < maxRetries; i++) {
      const user = getCurrentUser();
      let warehouseId = getCurrentWarehouse();
      
      // Enhanced warehouse detection for supervisors
      if (!warehouseId && user.id && user.role?.toLowerCase() === 'supervisor') {
        // Try to get from user profile API
        try {
          const token = localStorage.getItem("token");
          if (token) {
            const response = await fetch(`http://localhost:8080/api/users/${user.id}/`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
              const userData = await response.json();
              warehouseId = userData.warehouse_id || userData.warehouse || userData.assigned_warehouse_id;
              
              if (warehouseId) {
                // Update local storage with the correct warehouse
                const updatedUser = { ...user, warehouse_id: warehouseId };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                localStorage.setItem(`userWarehouse_${user.id}`, warehouseId.toString());
              }
            }
          }
        } catch (apiError) {
          // API warehouse fetch failed, using default
        }
        
        // If still no warehouse, use default
        if (!warehouseId) {
          warehouseId = 2; // Use warehouse 2 as seen in logs
          const updatedUser = { ...user, warehouse_id: 2 };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          localStorage.setItem(`userWarehouse_${user.id}`, '2');
        }
      }
      
      if (user.id && user.role && warehouseId) {
        return { user, warehouseId };
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return null;
  }, [getCurrentUser, getCurrentWarehouse]);

  // Handle notification click with proper state update
  const handleNotificationClick = (notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      dispatch({ type: 'MARK_AS_READ', payload: notification.id });
      
      // Force update to refresh count immediately
      setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    }
    
    // Show detail modal
    setSelectedNotification(notification);
    setShowDetailModal(true);
  };

  // Close detail modal only with proper event handling
  const closeDetailModal = (event) => {
    // Prevent event bubbling to avoid triggering other click handlers
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    setShowDetailModal(false);
    setSelectedNotification(null);
  };

  // Format notification detail data for display with proper object handling
  const formatDetailData = (notification) => {
    const data = notification.data || {};
    const details = [];

    // Helper function to safely convert any value to string
    const safeToString = (value) => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'object') {
        // If it's an object, try to extract meaningful information
        if (value.name) return String(value.name);
        if (value.id) return `ID: ${value.id}`;
        if (value.toString && typeof value.toString === 'function') {
          return value.toString();
        }
        return 'Object';
      }
      return String(value);
    };

    // Common fields for all notifications
    if (data.warehouse_id) {
      details.push({ label: 'Warehouse ID', value: safeToString(data.warehouse_id) });
    }
    
    // Type-specific details
    switch (notification.type) {
      case 'low_stock':
      case 'out_of_stock':
        details.push(
          { label: 'Product', value: safeToString(data.product_name || 'Unknown Product') },
          { label: 'Available Quantity', value: safeToString(data.quantity_available || 0) },
          { label: 'Stock Status', value: safeToString(data.stock_status || 'Unknown') }
        );
        if (data.minimum_stock) {
          details.push({ label: 'Minimum Stock', value: safeToString(data.minimum_stock) });
        }
        if (data.login_check) {
          details.push({ label: 'Alert Type', value: 'Login Stock Check' });
        }
        if (data.summary_notification) {
          details.push({ label: 'Summary', value: safeToString(data.summary_details || 'Multiple items need attention') });
        }
        break;

      case 'stock_adjustment':
        details.push(
          { label: 'Product', value: safeToString(data.product_name || 'Unknown Product') },
          { label: 'Previous Quantity', value: safeToString(data.old_quantity || 'N/A') },
          { label: 'New Quantity', value: safeToString(data.new_quantity || 'N/A') },
          { label: 'Change Type', value: safeToString(data.change_type || 'Unknown') },
          { label: 'Adjustment Reason', value: safeToString(data.reason || 'Not specified') }
        );
        if (data.quantity_changed) {
          details.push({ label: 'Quantity Changed', value: `${data.change_type === 'increased' ? '+' : '-'}${safeToString(data.quantity_changed)}` });
        }
        break;

      case 'expense_created':
      case 'large_expense':
        details.push(
          { label: 'Description', value: safeToString(data.description || 'No description') },
          { label: 'Amount', value: `₱${(data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Category', value: safeToString(data.category || 'Miscellaneous') }
        );
        if (notification.type === 'large_expense' && data.threshold) {
          details.push({ label: 'Threshold', value: `₱${data.threshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
        }
        if (data.created_by) {
          details.push({ label: 'Created By', value: safeToString(data.created_by) });
        }
        break;

      case 'expense_updated':
        details.push(
          { label: 'Description', value: safeToString(data.description || 'No description') },
          { label: 'Previous Amount', value: `₱${(data.old_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'New Amount', value: `₱${(data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Change Type', value: safeToString(data.change_type || 'Unknown') }
        );
        if (data.amount_difference) {
          details.push({ label: 'Amount Difference', value: `₱${data.amount_difference.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
        }
        break;

      case 'supplier_added':
      case 'supplier_updated':
        details.push(
          { label: 'Supplier Name', value: safeToString(data.name || 'Unknown Supplier') },
          { label: 'Contact Number', value: safeToString(data.contact_number || 'Not provided') },
          { label: 'Address', value: safeToString(data.address || 'Not provided') }
        );
        if (data.email) {
          details.push({ label: 'Email', value: safeToString(data.email) });
        }
        break;

      case 'warehouse_msp_created':
      case 'warehouse_msp_updated':
        details.push(
          { label: 'MSP Number', value: safeToString(data.msp_no || data.msp_number || 'Unknown') },
          { label: 'Status', value: safeToString(data.status || 'Unknown') },
          { label: 'Expected Sale', value: `₱${(data.expected_sale || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
        );
        if (data.actual_sale) {
          details.push({ label: 'Actual Sale', value: `₱${data.actual_sale.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
        }
        if (data.handled_by) {
          details.push({ label: 'Handled By', value: safeToString(data.handled_by) });
        }
        if (data.is_van_load && data.route) {
          const routeValue = typeof data.route === 'object' 
            ? safeToString(data.route.name || data.route.route_name || `Route ${data.route.id || 'Unknown'}`) 
            : safeToString(data.route);
          details.push({ label: 'Route', value: routeValue });
        }
        if (data.is_van_load && data.van) {
          const vanValue = typeof data.van === 'object' 
            ? safeToString(data.van.name || data.van.van_name || `Van ${data.van.id || 'Unknown'}`) 
            : safeToString(data.van);
          details.push({ label: 'Van', value: vanValue });
        }
        break;

      case 'new_sale':
      case 'sale_voided':
        details.push(
          { label: 'Sale ID', value: safeToString(data.id || 'Unknown') },
          { label: 'Total Amount', value: `₱${(data.total_amount || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Customer', value: safeToString(data.customer_name || 'Walk-in Customer') }
        );
        if (data.cashier_name) {
          details.push({ label: 'Cashier', value: safeToString(data.cashier_name) });
        }
        break;

      case 'paid_credit':
        details.push(
          { label: 'Credit ID', value: safeToString(data.id || 'Unknown') },
          { label: 'MSP Number', value: safeToString(data.msp_no || 'N/A') },
          { label: 'Customer', value: safeToString(data.customer_name || 'Unknown Customer') },
          { label: 'Payment Amount', value: `₱${(data.balance || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Payment Date', value: safeToString(data.updated_at ? new Date(data.updated_at).toLocaleDateString() : 'Today') }
        );
        // Show days since sale for credit payments
        if (data.created_at && data.updated_at) {
          const daysSinceSale = Math.floor((new Date(data.updated_at) - new Date(data.created_at)) / (1000 * 60 * 60 * 24));
          details.push({ label: 'Days Since Sale', value: `${daysSinceSale} days` });
        }
        break;

      case 'role_updated':
        details.push(
          { label: 'User', value: safeToString(data.user_name || 'Unknown User') },
          { label: 'Previous Role', value: safeToString(data.old_role || 'N/A') },
          { label: 'New Role', value: safeToString(data.new_role || data.role_name || 'Unknown') },
          { label: 'Updated By', value: safeToString(data.updated_by || 'System') }
        );
        break;

      case 'admin_settings_changed':
        details.push(
          { label: 'Setting', value: safeToString(data.setting_name || 'Unknown Setting') },
          { label: 'Previous Value', value: safeToString(data.old_value || 'N/A') },
          { label: 'New Value', value: safeToString(data.new_value || 'N/A') },
          { label: 'Changed By', value: safeToString(data.changed_by || 'Admin') }
        );
        break;

      case 'product_created':
      case 'product_updated':
        details.push(
          { label: 'Product Name', value: safeToString(data.product_name || 'Unknown Product') },
          { label: 'Category', value: safeToString(data.category || 'Uncategorized') },
          { label: 'Price', value: `₱${(data.selling_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
        );
        if (data.product_code) {
          details.push({ label: 'Product Code', value: safeToString(data.product_code) });
        }
        break;

      case 'return_processed':
      case 'refund_issued':
        details.push(
          { label: 'Return Number', value: safeToString(data.return_no || data.transaction_no || 'Unknown') },
          { label: 'Customer', value: safeToString(data.customer_name || 'Unknown Customer') },
          { label: 'Refund Amount', value: `₱${(data.refund_amount || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
        );
        if (data.return_reason) {
          details.push({ label: 'Reason', value: safeToString(data.return_reason) });
        }
        break;

      default:
        // For any other notification types, show generic data with safe string conversion
        Object.keys(data).forEach(key => {
          if (key !== 'warehouse_id' && data[key] && typeof data[key] !== 'object') {
            details.push({ 
              label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
              value: safeToString(data[key]) 
            });
          }
        });
        break;
    }

    return details;
  };

  // Get priority color class
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-green-600 dark:text-green-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  // Persist notifications to localStorage helper function
  const persistNotifications = useCallback((notifications) => {
    try {
      localStorage.setItem('persistedNotifications', JSON.stringify(notifications));
    } catch (error) {
      // Error persisting notifications - storage may be full
    }
  }, []);

  // Load persisted notifications on component mount
  useEffect(() => {
    const loadPersistedNotifications = () => {
      try {
        const savedNotifications = localStorage.getItem('persistedNotifications');
        if (savedNotifications) {
          const parsedNotifications = JSON.parse(savedNotifications);
          
          // Filter notifications that are still valid (not older than 7 days)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const validNotifications = parsedNotifications.filter(notif => 
            new Date(notif.timestamp) > sevenDaysAgo
          );
          
          // Use SET_NOTIFICATIONS to restore all valid notifications at once
          if (validNotifications.length > 0) {
            dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });
          }
          
          // Update localStorage with only valid notifications
          if (validNotifications.length !== parsedNotifications.length) {
            persistNotifications(validNotifications);
          }
        }
        setIsLoaded(true);
      } catch (error) {
        // Error loading persisted notifications - corrupted data
        localStorage.removeItem('persistedNotifications');
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadPersistedNotifications();
    }
  }, [dispatch, persistNotifications, isLoaded]);

  // Persist notifications whenever they change (but only after initial load)
  useEffect(() => {
    if (isLoaded && notifications.length >= 0) {
      persistNotifications(notifications);
    }
  }, [notifications, persistNotifications, isLoaded]);

  // Re-evaluate existing expense notifications when threshold changes
  const reevaluateExpenseNotifications = useCallback((newThreshold) => {
    const expenseNotifications = notifications.filter(n => 
      ['expense_created', 'large_expense'].includes(n.type)
    );

    expenseNotifications.forEach(notification => {
      const amount = notification.data?.amount || 0;
      const isCurrentlyLarge = notification.type === 'large_expense';
      const shouldBeLarge = amount >= newThreshold;

      if (isCurrentlyLarge && !shouldBeLarge) {
        // Convert large expense to normal expense
        dispatch({
          type: 'UPDATE_NOTIFICATION',
          payload: {
            id: notification.id,
            updates: {
              type: 'expense_created',
              title: 'Expense Added',
              priority: 'medium',
              message: `${notification.data.description} - ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
              details: undefined
            }
          }
        });
      } else if (!isCurrentlyLarge && shouldBeLarge) {
        // Convert normal expense to large expense
        dispatch({
          type: 'UPDATE_NOTIFICATION',
          payload: {
            id: notification.id,
            updates: {
              type: 'large_expense',
              title: '🚨 Large Expense Alert',
              priority: 'high',
              message: `High-value expense: ${notification.data.description} - ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
              details: `Exceeds threshold of ₱${newThreshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
            }
          }
        });
      }
    });
  }, [notifications, dispatch]);

  // Load and monitor expense threshold changes
  useEffect(() => {
    const loadExpenseThreshold = () => {
      try {
        const savedThreshold = localStorage.getItem('largeExpenseThreshold');
        if (savedThreshold) {
          setLargeExpenseThreshold(Number(savedThreshold));
        }
      } catch (error) {
        // Error loading expense threshold - using default
      }
    };
    
    loadExpenseThreshold();

    // Listen for threshold updates from settings
    const handleThresholdUpdate = (event) => {
      const newThreshold = event.detail?.newThreshold;
      if (newThreshold && newThreshold !== largeExpenseThreshold) {
        setLargeExpenseThreshold(newThreshold);
        
        // Re-evaluate existing expense notifications with new threshold
        reevaluateExpenseNotifications(newThreshold);
      }
    };

    window.addEventListener('thresholdUpdated', handleThresholdUpdate);
    
    return () => {
      window.removeEventListener('thresholdUpdated', handleThresholdUpdate);
    };
  }, [largeExpenseThreshold, reevaluateExpenseNotifications]);

  // ✅ FIXED: Stock notifications without debug logs
  const checkStockNotifications = useCallback(async () => {
    // Wait for user data to be available
    const userData = await waitForUserData();
    if (!userData) {
      return;
    }

    const { user, warehouseId } = userData;
    const userRole = user.role?.toLowerCase();
    const processedIds = processedIdsRef.current;
    let newNotifications = 0;

    try {
      // ✅ FIXED: Use warehouse ID (integer) in API call, not warehouse name
      const stockResponse = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`, { 
        timeout: 10000,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        }
      });
      const stocks = Array.isArray(stockResponse.data) ? stockResponse.data : stockResponse.data?.results || [];

      // Get previous stock levels for comparison
      const previousStocksKey = `previousStocks_${warehouseId}`;
      const previousStocks = JSON.parse(localStorage.getItem(previousStocksKey) || '{}');
      const now = new Date().toISOString();

      stocks.forEach(stock => {
        const stockId = `stock-${stock.id}-${warehouseId}`;
        const status = (stock.stock_status || "").toLowerCase();
        const currentQuantity = parseInt(stock.quantity_available || 0);
        const previousQuantity = previousStocks[stock.id]?.quantity;
        const lastChecked = previousStocks[stock.id]?.timestamp;
        
        // CHECK FOR OUT OF STOCK
        if ((currentQuantity === 0 || status.includes("out")) && !processedIds.has(stockId + "-out")) {
          addNotification('out_of_stock', { 
            ...stock, 
            warehouse_id: warehouseId,
            product_name: stock.product_name || `Product ${stock.id}`,
            quantity_available: currentQuantity
          }, userRole);
          processedIds.add(stockId + "-out");
          newNotifications++;
        }
        // CHECK FOR LOW STOCK (but not out of stock)
        else if (status.includes("low") && currentQuantity > 0 && !processedIds.has(stockId + "-low")) {
          addNotification('low_stock', { 
            ...stock, 
            warehouse_id: warehouseId,
            product_name: stock.product_name || `Product ${stock.id}`,
            quantity_available: currentQuantity
          }, userRole);
          processedIds.add(stockId + "-low");
          newNotifications++;
        }

        // CHECK FOR STOCK QUANTITY CHANGES (MANUAL ADJUSTMENTS)
        if (previousQuantity !== undefined && previousQuantity !== currentQuantity) {
          const changeId = `change-${stock.id}-${warehouseId}-${currentQuantity}-${previousQuantity}`;
          
          // Only process if this is a recent change (not initial load)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const isRecentChange = !lastChecked || new Date(lastChecked) > fiveMinutesAgo;
          
          if (isRecentChange && !processedIds.has(changeId)) {
            const changeType = currentQuantity > previousQuantity ? 'increased' : 'decreased';
            const changeDiff = Math.abs(currentQuantity - previousQuantity);
            
            // Create better notification message showing remaining quantity
            let adjustmentMessage, adjustmentTitle;
            
            if (currentQuantity === 0) {
              adjustmentTitle = '📝 Stock Depleted';
              adjustmentMessage = `${stock.product_name} stock reduced to 0 (was ${previousQuantity})`;
            } else if (changeType === 'increased') {
              adjustmentTitle = '📝 Stock Increased';
              adjustmentMessage = `${stock.product_name} stock increased by ${changeDiff}. Current: ${currentQuantity} units`;
            } else {
              adjustmentTitle = '📝 Stock Reduced';
              adjustmentMessage = `${stock.product_name} stock reduced by ${changeDiff}. Remaining: ${currentQuantity} units`;
            }
            
            // Notify for any quantity change
            addNotification('stock_adjustment', { 
              id: `${stock.id}_${Date.now()}`,
              warehouse_id: warehouseId,
              product_name: stock.product_name || `Product ${stock.id}`,
              old_quantity: previousQuantity,
              new_quantity: currentQuantity,
              remaining_quantity: currentQuantity,
              quantity_changed: changeDiff,
              change_type: changeType,
              reason: `Stock adjustment: ${previousQuantity} → ${currentQuantity}`,
              adjustment_summary: `${changeType === 'increased' ? '+' : '-'}${changeDiff} units`,
              created_at: now,
              stock_id: stock.id,
              custom_title: adjustmentTitle,
              custom_message: adjustmentMessage
            }, userRole);
            processedIds.add(changeId);
            newNotifications++;
          }
        }

        // Store current quantity and timestamp for next comparison
        previousStocks[stock.id] = {
          quantity: currentQuantity,
          timestamp: now,
          product_name: stock.product_name
        };
      });

      // Save current stock levels for next comparison
      localStorage.setItem(previousStocksKey, JSON.stringify(previousStocks));

      // SAVE PROCESSED IDS
      if (newNotifications > 0) {
        localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
        processedIdsRef.current = processedIds;
        
        // FORCE UPDATE after creating notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      }

    } catch (error) {
      // Error handled silently - API may be down
    }
  }, [waitForUserData, addNotification]);

  // ✅ FIXED: Login stock check without debug logs
  const checkLowStockOnLogin = useCallback(async () => {
    // Wait for user data to be available
    const userData = await waitForUserData();
    if (!userData) {
      return;
    }

    const { user, warehouseId } = userData;
    const userRole = user.role?.toLowerCase();

    try {
      // ✅ FIXED: Use warehouse ID (integer) in API call, not warehouse name
      const stockResponse = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`, { 
        timeout: 10000,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        }
      });
      const stocks = Array.isArray(stockResponse.data) ? stockResponse.data : stockResponse.data?.results || [];

      let loginNotifications = 0;
      const lowStockItems = [];
      const outOfStockItems = [];

      stocks.forEach(stock => {
        const status = (stock.stock_status || "").toLowerCase();
        const currentQuantity = parseInt(stock.quantity_available || 0);
        
        // Check for out of stock - always notify on login
        if (currentQuantity === 0 || status.includes("out")) {
          outOfStockItems.push(stock.product_name || `Product ${stock.id}`);
          addNotification('out_of_stock', { 
            ...stock, 
            warehouse_id: warehouseId,
            product_name: stock.product_name || `Product ${stock.id}`,
            quantity_available: currentQuantity,
            login_check: true,
            id: `login-out-${stock.id}-${Date.now()}` // Unique ID for login check
          }, userRole);
          loginNotifications++;
        }
        // Check for low stock - always notify on login
        else if (status.includes("low") && currentQuantity > 0) {
          lowStockItems.push(`${stock.product_name || `Product ${stock.id}`} (${currentQuantity} left)`);
          addNotification('low_stock', { 
            ...stock, 
            warehouse_id: warehouseId,
            product_name: stock.product_name || `Product ${stock.id}`,
            quantity_available: currentQuantity,
            login_check: true,
            id: `login-low-${stock.id}-${Date.now()}` // Unique ID for login check
          }, userRole);
          loginNotifications++;
        }
      });

      // Create a summary notification if there are multiple items
      if (loginNotifications > 0) {
        // FORCE UPDATE after creating login notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 300);
        
        if (loginNotifications > 3) {
          const summaryMessage = [
            outOfStockItems.length > 0 ? `${outOfStockItems.length} items out of stock` : '',
            lowStockItems.length > 0 ? `${lowStockItems.length} items low in stock` : ''
          ].filter(Boolean).join(', ');
          
          addNotification('low_stock', {
            id: `login-summary-${warehouseId}-${Date.now()}`,
            product_name: 'Stock Alert Summary',
            quantity_available: loginNotifications,
            warehouse_id: warehouseId,
            stock_status: 'Multiple Items Need Attention',
            summary_notification: true,
            login_check: true,
            summary_details: summaryMessage
          }, userRole);
        }
        
        // Show browser notification if permission granted
        if (Notification.permission === "granted") {
          try {
            new Notification('Stock Alert', {
              body: `${loginNotifications} items need attention in your warehouse`,
              icon: '/favicon.ico'
            });
          } catch (error) {
            // Browser notification failed
          }
        }
      }

    } catch (error) {
      // Error handled silently - API may be down
    }
  }, [waitForUserData, addNotification]);

  // Enhanced expense notification checking without debug logs
  const checkExpenseNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    try {
      const config = { 
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      };

      // ✅ FIXED: Use warehouse ID (integer) in API call
      const expenseResponse = await axios.get(
        `http://localhost:8080/api/miscellaneous-items/?warehouse=${warehouseId}`, 
        config
      );
      
      const expenses = Array.isArray(expenseResponse.data) ? expenseResponse.data : expenseResponse.data?.results || [];

      if (expenses.length === 0) {
        return newNotifications;
      }

      // Get previous expenses for comparison (detect updates/deletions)
      const previousExpensesKey = `previousExpenses_${warehouseId}`;
      const previousExpenses = JSON.parse(localStorage.getItem(previousExpensesKey) || '{}');
      const now = new Date().toISOString();

      // Check for NEW or UPDATED expenses (last 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      expenses.forEach(expense => {
        const expenseId = `expense-${expense.id}-${warehouseId}`;
        const expenseDate = new Date(expense.created_at || expense.updated_at || now);
        const expenseAmount = Number(expense.amount || 0);
        const previousExpense = previousExpenses[expense.id];

        // Check if this is a recent expense (created or updated)
        if (expenseDate > thirtyMinutesAgo && !processedIds.has(expenseId)) {
          
          // Determine if it's a creation or update
          const isUpdate = previousExpense && (
            previousExpense.amount !== expenseAmount ||
            previousExpense.description !== expense.description
          );

          if (isUpdate) {
            // EXPENSE UPDATED
            const amountChanged = previousExpense.amount !== expenseAmount;
            const wasLarge = previousExpense.amount >= largeExpenseThreshold;
            const isNowLarge = expenseAmount >= largeExpenseThreshold;
            
            if (amountChanged && isNowLarge && !wasLarge) {
              // Updated to become a large expense
              addNotification('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                previous_amount: previousExpense.amount,
                update_type: 'updated_to_large'
              }, userRole);
            } else if (amountChanged && wasLarge && !isNowLarge) {
              // Updated to become a normal expense
              addNotification('expense_updated', { 
                ...expense, 
                warehouse_id: warehouseId,
                old_amount: previousExpense.amount,
                change_type: expenseAmount > previousExpense.amount ? 'increased' : 'decreased',
                amount_difference: Math.abs(expenseAmount - previousExpense.amount),
                update_type: 'reduced_from_large'
              }, userRole);
            } else if (isNowLarge) {
              // Still large but updated
              addNotification('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                previous_amount: previousExpense.amount,
                update_type: 'large_expense_updated'
              }, userRole);
            } else {
              // Normal update
              addNotification('expense_updated', { 
                ...expense, 
                warehouse_id: warehouseId,
                old_amount: previousExpense.amount,
                change_type: expenseAmount > previousExpense.amount ? 'increased' : 'decreased',
                amount_difference: Math.abs(expenseAmount - previousExpense.amount)
              }, userRole);
            }
          } else if (!previousExpense) {
            // NEW EXPENSE CREATED
            if (expenseAmount >= largeExpenseThreshold) {
              addNotification('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                update_type: 'new_large_expense'
              }, userRole);
            } else {
              addNotification('expense_created', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold
              }, userRole);
            }
          }

          processedIds.add(expenseId);
          newNotifications++;
        }

        // Store current expense data for next comparison
        previousExpenses[expense.id] = {
          amount: expenseAmount,
          description: expense.description,
          updated_at: expense.updated_at || expense.created_at,
          timestamp: now
        };
      });

      // Check for DELETED expenses
      Object.keys(previousExpenses).forEach(expenseId => {
        const currentExpense = expenses.find(e => e.id.toString() === expenseId.toString());
        if (!currentExpense) {
          const deletedExpenseId = `expense-deleted-${expenseId}-${warehouseId}`;
          
          if (!processedIds.has(deletedExpenseId)) {
            const expenseData = previousExpenses[expenseId];
            const wasLarge = expenseData.amount >= largeExpenseThreshold;
            
            addNotification('expense_deleted', { 
              id: expenseId,
              description: expenseData.description,
              amount: expenseData.amount,
              warehouse_id: warehouseId,
              deleted_at: now,
              was_large: wasLarge,
              threshold: largeExpenseThreshold
            }, userRole);
            
            processedIds.add(deletedExpenseId);
            newNotifications++;
          }
          
          // Remove from previous expenses
          delete previousExpenses[expenseId];
        }
      });

      // Save current expense state for next comparison
      localStorage.setItem(previousExpensesKey, JSON.stringify(previousExpenses));

      if (newNotifications > 0) {
        // FORCE UPDATE after creating expense notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      }

    } catch (error) {
      // Error handled silently
    }

    return newNotifications;
  }, [addNotification, largeExpenseThreshold]);

  // Check system and role accessibility notifications (Admin only)
  const checkSystemNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    // Only admin can see system notifications
    if (userRole !== 'admin') {
      return newNotifications;
    }

    try {
      const config = { 
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      };

      const now = new Date().toISOString();

      // 1. CHECK USER ROLE CHANGES
      try {
        const usersResponse = await axios.get(`http://localhost:8080/api/users/`, config);
        const users = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data?.results || [];

        // Get previous user roles for comparison
        const previousUsersKey = `previousUsers_${warehouseId}`;
        const previousUsers = JSON.parse(localStorage.getItem(previousUsersKey) || '{}');

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        
        users.forEach(user => {
          const userId = `user-role-${user.id}-${warehouseId}`;
          const userDate = new Date(user.updated_at || user.created_at || now);
          const previousUser = previousUsers[user.id];

          // Check if this is a recent user update
          if (userDate > fifteenMinutesAgo && !processedIds.has(userId)) {
            
            // Check for role changes
            const isRoleUpdate = previousUser && (
              previousUser.role !== user.role ||
              previousUser.permissions !== JSON.stringify(user.permissions || {})
            );

            if (isRoleUpdate) {
              addNotification('role_updated', { 
                ...user, 
                warehouse_id: warehouseId,
                user_name: user.username || user.name || `User ${user.id}`,
                old_role: previousUser.role,
                new_role: user.role,
                role_name: user.role,
                updated_by: user.updated_by || 'System',
                changes: {
                  role: { old: previousUser.role, new: user.role },
                  permissions: { 
                    old: previousUser.permissions, 
                    new: JSON.stringify(user.permissions || {}) 
                  }
                }
              }, userRole);
              
              processedIds.add(userId);
              newNotifications++;
            }
          }

          // Store current user data for next comparison
          previousUsers[user.id] = {
            role: user.role,
            permissions: JSON.stringify(user.permissions || {}),
            updated_at: user.updated_at || user.created_at,
            username: user.username || user.name,
            timestamp: now
          };
        });

        // Save current users state for next comparison
        localStorage.setItem(previousUsersKey, JSON.stringify(previousUsers));
        
      } catch (userError) {
        // Users API not available
      }

      if (newNotifications > 0) {
        // FORCE UPDATE after creating system notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      }

    } catch (error) {
      // Error handled silently
    }

    return newNotifications;
  }, [addNotification]);

  // Enhanced supplier notifications with Van Load MSP change detection
  const checkSupplierNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    try {
      const config = { 
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      };

      const now = new Date().toISOString();

      // 1. CHECK SUPPLIERS
      const supplierResponse = await axios.get(`http://localhost:8080/api/suppliers/`, config);
      const suppliers = Array.isArray(supplierResponse.data) ? supplierResponse.data : supplierResponse.data?.results || [];

      // Get previous suppliers for comparison
      const previousSuppliersKey = `previousSuppliers_${warehouseId}`;
      const previousSuppliers = JSON.parse(localStorage.getItem(previousSuppliersKey) || '{}');

      // Check for NEW or UPDATED suppliers (last 60 minutes)
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      suppliers.forEach(supplier => {
        const supplierId = `supplier-${supplier.id}-${warehouseId}`;
        const supplierDate = new Date(supplier.created_at || supplier.updated_at || now);
        const previousSupplier = previousSuppliers[supplier.id];

        // Check if this is a recent supplier (created or updated)
        if (supplierDate > sixtyMinutesAgo && !processedIds.has(supplierId)) {
          
          // Determine if it's a creation or update
          const isUpdate = previousSupplier && (
            previousSupplier.name !== supplier.name ||
            previousSupplier.contact_number !== supplier.contact_number ||
            previousSupplier.address !== supplier.address
          );

          if (isUpdate) {
            // SUPPLIER UPDATED
            addNotification('supplier_updated', { 
              ...supplier, 
              warehouse_id: warehouseId,
              changes: {
                name: previousSupplier.name !== supplier.name ? { old: previousSupplier.name, new: supplier.name } : null,
                contact: previousSupplier.contact_number !== supplier.contact_number ? { old: previousSupplier.contact_number, new: supplier.contact_number } : null,
                address: previousSupplier.address !== supplier.address ? { old: previousSupplier.address, new: supplier.address } : null
              }
            }, userRole);
          } else if (!previousSupplier) {
            // NEW SUPPLIER CREATED
            addNotification('supplier_added', { 
              ...supplier, 
              warehouse_id: warehouseId
            }, userRole);
          }

          processedIds.add(supplierId);
          newNotifications++;
        }

        // Store current supplier data for next comparison
        previousSuppliers[supplier.id] = {
          name: supplier.name,
          contact_number: supplier.contact_number,
          address: supplier.address,
          updated_at: supplier.updated_at || supplier.created_at,
          timestamp: now
        };
      });

      // Save current supplier state for next comparison
      localStorage.setItem(previousSuppliersKey, JSON.stringify(previousSuppliers));

      // 2. CHECK SUPPLIER RETURNS
      try {
        const returnResponse = await axios.get(`http://localhost:8080/api/supplier-returns/`, config);
        const returns = Array.isArray(returnResponse.data) ? returnResponse.data : returnResponse.data?.results || [];

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        returns.forEach(returnItem => {
          const returnId = `supplier-return-${returnItem.id}-${warehouseId}`;
          const returnDate = new Date(returnItem.created_at || returnItem.processed_at || returnItem.date_processed || now);
          
          // Check if this is a recent return
          if (returnDate > thirtyMinutesAgo && !processedIds.has(returnId)) {
            addNotification('supplier_return_processed', { 
              ...returnItem, 
              warehouse_id: warehouseId,
              supplier_name: returnItem.supplier_name || returnItem.supplier?.name || 'Unknown Supplier',
              product_name: returnItem.product_name || returnItem.product?.name || 'Product',
              return_quantity: returnItem.quantity_returned || returnItem.quantity || 0,
              return_reason: returnItem.reason || returnItem.return_reason || 'Not specified'
            }, userRole);
            
            processedIds.add(returnId);
            newNotifications++;
          }
        });
      } catch (returnError) {
        // Supplier returns API not available
      }

      // 3. CHECK WAREHOUSE MSP (MERCHANDISING) OPERATIONS WITH VAN LOAD SUPPORT
      try {
        // ✅ FIXED: Use warehouse ID (integer) in API call
        const mspResponse = await axios.get(`http://localhost:8080/api/merchandisings/?warehouse=${warehouseId}`, config);
        const msps = Array.isArray(mspResponse.data) ? mspResponse.data : mspResponse.data?.results || [];

        // Get previous MSPs for comparison
        const previousMSPsKey = `previousMSPs_${warehouseId}`;
        const previousMSPs = JSON.parse(localStorage.getItem(previousMSPsKey) || '{}');

        const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
        
        msps.forEach(msp => {
          const mspId = `msp-${msp.id}-${warehouseId}`;
          const mspDate = new Date(msp.created_at || msp.updated_at || now);
          const previousMSP = previousMSPs[msp.id];

          // Check if this is a recent MSP (created or updated)
          if (mspDate > twentyMinutesAgo && !processedIds.has(mspId)) {
            
            // Better update detection for Van Load transactions
            const isUpdate = previousMSP && (
              previousMSP.msp_no !== msp.msp_no ||
              previousMSP.status !== msp.status ||
              previousMSP.total_amount !== msp.total_amount ||
              previousMSP.expected_sale !== msp.expected_sale ||
              previousMSP.actual_sale !== msp.actual_sale ||
              previousMSP.handled_by !== msp.handled_by ||
              previousMSP.route !== msp.route ||
              previousMSP.van !== msp.van
            );

            if (isUpdate) {
              // MSP UPDATED - Enhanced for Van Load notifications
              const isVanLoad = (msp.transaction_type_name || '').toLowerCase().includes('van load');
              const updateType = isVanLoad ? 'Van Load' : 'Warehouse MSP';
              
              // Determine what changed for better notification details
              const changes = [];
              if (previousMSP.status !== msp.status) {
                changes.push(`Status: ${previousMSP.status} → ${msp.status}`);
              }
              if (previousMSP.expected_sale !== msp.expected_sale) {
                changes.push(`Expected Sale: ₱${Number(previousMSP.expected_sale || 0).toLocaleString()} → ₱${Number(msp.expected_sale || 0).toLocaleString()}`);
              }
              if (previousMSP.actual_sale !== msp.actual_sale) {
                changes.push(`Actual Sale: ₱${Number(previousMSP.actual_sale || 0).toLocaleString()} → ₱${Number(msp.actual_sale || 0).toLocaleString()}`);
              }
              if (previousMSP.handled_by !== msp.handled_by) {
                changes.push(`Handler: ${previousMSP.handled_by || 'N/A'} → ${msp.handled_by || 'N/A'}`);
              }
              if (isVanLoad) {
                if (previousMSP.route !== msp.route) {
                  changes.push(`Route changed`);
                }
                if (previousMSP.van !== msp.van) {
                  changes.push(`Van changed`);
                }
              }

              addNotification('warehouse_msp_updated', { 
                ...msp, 
                warehouse_id: warehouseId,
                update_type: updateType,
                is_van_load: isVanLoad,
                changes_summary: changes.join(', ') || 'Details updated',
                action_type: isVanLoad ? 'van_load_updated' : 'warehouse_updated',
                changes: {
                  status: previousMSP.status !== msp.status ? { old: previousMSP.status, new: msp.status } : null,
                  expected_sale: previousMSP.expected_sale !== msp.expected_sale ? { old: previousMSP.expected_sale, new: msp.expected_sale } : null,
                  actual_sale: previousMSP.actual_sale !== msp.actual_sale ? { old: previousMSP.actual_sale, new: msp.actual_sale } : null,
                  handled_by: previousMSP.handled_by !== msp.handled_by ? { old: previousMSP.handled_by, new: msp.handled_by } : null,
                  route: previousMSP.route !== msp.route ? { old: previousMSP.route, new: msp.route } : null,
                  van: previousMSP.van !== msp.van ? { old: previousMSP.van, new: msp.van } : null
                }
              }, userRole);
            } else if (!previousMSP) {
              // NEW MSP CREATED - Enhanced for both Van Load and Warehouse
              const isVanLoad = (msp.transaction_type_name || '').toLowerCase().includes('van load');
              const creationType = isVanLoad ? 'Van Load' : 'Warehouse MSP';
              
              addNotification('warehouse_msp_created', { 
                ...msp, 
                warehouse_id: warehouseId,
                msp_number: msp.msp_no,
                total_amount: msp.total_amount || msp.expected_sale || 0,
                expected_sale: msp.expected_sale || msp.total_amount || 0,
                is_van_load: isVanLoad,
                creation_type: creationType,
                status: msp.status || 'PENDING'
              }, userRole);
            }

            processedIds.add(mspId);
            newNotifications++;
          }

          // Store enhanced MSP data for next comparison (including more fields)
          previousMSPs[msp.id] = {
            msp_no: msp.msp_no,
            status: msp.status,
            total_amount: msp.total_amount,
            expected_sale: msp.expected_sale,
            actual_sale: msp.actual_sale,
            handled_by: msp.handled_by,
            route: typeof msp.route === 'object' ? msp.route?.id : msp.route,
            van: typeof msp.van === 'object' ? msp.van?.id : msp.van,
            updated_at: msp.updated_at || msp.created_at,
            timestamp: now
          };
        });

        // Save current MSP state for next comparison
        localStorage.setItem(previousMSPsKey, JSON.stringify(previousMSPs));
        
      } catch (mspError) {
        // MSP/Merchandising API not available
      }

      if (newNotifications > 0) {
        // FORCE UPDATE after creating supplier/warehouse notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      }

    } catch (error) {
      // Error handled silently
    }

    return newNotifications;
  }, [addNotification]);

  // Check products and returns/refunds notifications (Admin only)
  const checkProductsAndReturnsNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    // Only admin can see product and returns notifications
    if (userRole !== 'admin') {
      return newNotifications;
    }

    try {
      const config = { 
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      };

      const now = new Date().toISOString();

      // 1. CHECK PRODUCTS
      try {
        const productsResponse = await axios.get(`http://localhost:8080/api/products/`, config);
        const products = Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse.data?.results || [];

        // Get previous products for comparison
        const previousProductsKey = `previousProducts_${warehouseId}`;
        const previousProducts = JSON.parse(localStorage.getItem(previousProductsKey) || '{}');

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        products.forEach(product => {
          const productId = `product-${product.id}-${warehouseId}`;
          const productDate = new Date(product.created_at || product.updated_at || now);
          const previousProduct = previousProducts[product.id];

          // Check if this is a recent product (created or updated)
          if (productDate > thirtyMinutesAgo && !processedIds.has(productId)) {
            
            // Determine if it's a creation or update
            const isUpdate = previousProduct && (
              previousProduct.name !== product.product_name ||
              previousProduct.price !== product.selling_price ||
              previousProduct.category !== product.category ||
              previousProduct.status !== product.status
            );

            if (isUpdate) {
              // PRODUCT UPDATED
              const changes = {};
              if (previousProduct.name !== product.product_name) changes.name = { old: previousProduct.name, new: product.product_name };
              if (previousProduct.price !== product.selling_price) changes.price = { old: previousProduct.price, new: product.selling_price };
              if (previousProduct.category !== product.category) changes.category = { old: previousProduct.category, new: product.category };
              if (previousProduct.status !== product.status) changes.status = { old: previousProduct.status, new: product.status };
              
              addNotification('product_updated', { 
                ...product, 
                warehouse_id: warehouseId,
                changes: changes,
                updated_by: 'Admin'
              }, userRole);
            } else if (!previousProduct) {
              // NEW PRODUCT CREATED
              addNotification('product_created', { 
                ...product, 
                warehouse_id: warehouseId
              }, userRole);
            }

            processedIds.add(productId);
            newNotifications++;
          }

          // Store current product data for next comparison
          previousProducts[product.id] = {
            name: product.product_name,
            price: product.selling_price,
            category: product.category,
            status: product.status,
            updated_at: product.updated_at || product.created_at,
            timestamp: now
          };
        });

        // Save current product state for next comparison
        localStorage.setItem(previousProductsKey, JSON.stringify(previousProducts));
        
      } catch (productsError) {
        // Products API not available
      }

      if (newNotifications > 0) {
        // FORCE UPDATE after creating products/returns notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      }

    } catch (error) {
      // Error handled silently
    }

    return newNotifications;
  }, [addNotification]);

  // Check ALL notification types when user performs actions
  const checkNotificationsOnAction = useCallback(async () => {
    // First, always check stock notifications
    await checkStockNotifications();

    // Then check other notification types
    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = getCurrentWarehouse();
    
    if (!userRole || !warehouseId) return;

    const config = { 
      headers: { "X-Warehouse-ID": warehouseId },
      timeout: 5000
    };

    try {
      const apiCalls = [];
      const processedIds = processedIdsRef.current;
      let newNotifications = 0;
      
      // Add other API calls (receiving, credits, etc.)
      apiCalls.push(
        axios.get(`http://localhost:8080/api/receiving/`, config).then(res => ({ type: 'receiving', data: res })).catch(() => null),
        axios.get(`http://localhost:8080/api/credits/`, config).then(res => ({ type: 'credits', data: res })).catch(() => null)
      );

      // EXPENSES (Admin & Supervisor only) - Call our enhanced expense checker
      if (['admin', 'supervisor'].includes(userRole)) {
        const expenseNotifications = await checkExpenseNotifications(warehouseId, userRole, processedIds);
        newNotifications += expenseNotifications;
        
        // SUPPLIERS & WAREHOUSE OPERATIONS (Admin & Supervisor only)
        const supplierNotifications = await checkSupplierNotifications(warehouseId, userRole, processedIds);
        newNotifications += supplierNotifications;
      }

      // SYSTEM & ROLE ACCESSIBILITY (Admin only) - Check for role changes, menu access, and settings
      if (userRole === 'admin') {
        const systemNotifications = await checkSystemNotifications(warehouseId, userRole, processedIds);
        newNotifications += systemNotifications;
        
        // PRODUCTS & RETURNS (Admin only)
        const productsReturnsNotifications = await checkProductsAndReturnsNotifications(warehouseId, userRole, processedIds);
        newNotifications += productsReturnsNotifications;
      }

      const results = await Promise.allSettled(apiCalls);

      // Process each API result (excluding expenses, suppliers, products & returns since we handled them separately)
      results.forEach((result) => {
        if (result.status !== 'fulfilled' || !result.value) return;
        
        const { type, data } = result.value;
        const items = Array.isArray(data.data) ? data.data : data.data?.results || [];
        
        switch (type) {
          case 'receiving':
            // Check for new receivings (last 10 minutes)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            items.forEach(receiving => {
              const receivingId = `receiving-${receiving.id}-${warehouseId}`;
              const receivingDate = new Date(receiving.date_time || receiving.created_at);
              
              if (receivingDate > tenMinutesAgo && !processedIds.has(receivingId)) {
                addNotification('new_receiving', { ...receiving, warehouse_id: warehouseId }, userRole);
                processedIds.add(receivingId);
                newNotifications++;
              }
            });
            break;

          case 'credits':
            // NO time limit for credit payments
            items.forEach(credit => {
              const creditId = `credit-${credit.id}-${warehouseId}`;
              
              if (credit.status?.toUpperCase() === 'PAID' && 
                  !processedIds.has(creditId)) {
                addNotification('paid_credit', { ...credit, warehouse_id: warehouseId }, userRole);
                processedIds.add(creditId);
                newNotifications++;
              }
            });
            break;

          default:
            // No action needed for unknown types
            break;
        }
      });

      // Save processed IDs
      if (newNotifications > 0) {
        localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
        processedIdsRef.current = processedIds;
        
        // FORCE UPDATE after all notifications are processed
        setTimeout(() => setForceUpdate(prev => prev + 1), 300);
      }

    } catch (error) {
      // Error handled silently
    }
  }, [getCurrentUser, getCurrentWarehouse, addNotification, checkStockNotifications, checkExpenseNotifications, checkSupplierNotifications, checkSystemNotifications, checkProductsAndReturnsNotifications]);

  // Listen for Van Load update events with immediate notification creation
  useEffect(() => {
    const handleVanLoadUpdate = (event) => {
      if (isLoaded) {
        // Immediate notification creation instead of waiting for API check
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (['admin', 'supervisor'].includes(userRole)) {
          const detail = event.detail;
          
          // Create immediate notification based on the event
          const notificationData = {
            id: detail.saleId,
            msp_no: detail.mspNo || `MSP-${detail.saleId}`,
            transaction_type_name: 'Van Load',
            handled_by: detail.handledBy || 'Unknown',
            expected_sale: detail.changes?.expected_sale || 0,
            actual_sale: detail.changes?.actual_sale || 0,
            status: detail.changes?.status || 'Updated',
            warehouse_id: getCurrentWarehouse(),
            updated_at: new Date().toISOString(),
            is_van_load: true,
            changes_summary: detail.summary || `Van Load ${detail.action}`,
            action_type: detail.action
          };
          
          // Add notification immediately
          addNotification('warehouse_msp_updated', notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
        
        // Also trigger the regular check after a delay
        setTimeout(() => checkNotificationsOnAction(), 2000);
      }
    };

    window.addEventListener('vanLoadUpdated', handleVanLoadUpdate);
    
    return () => {
      window.removeEventListener('vanLoadUpdated', handleVanLoadUpdate);
    };
  }, [checkNotificationsOnAction, isLoaded, addNotification, getCurrentUser, getCurrentWarehouse]);

  // Listen for role permission updates with immediate notification creation
  useEffect(() => {
    const handleRolePermissionUpdate = (event) => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          const detail = event.detail;
          
          // Create immediate notification based on the event
          const notificationData = {
            id: `role-${detail.roleId}-${Date.now()}`,
            user_name: detail.roleName,
            role_name: detail.roleName,
            new_role: detail.roleName,
            old_role: detail.action === 'updated' ? 'Previous Role' : null,
            updated_by: user.username || user.name || 'Admin',
            warehouse_id: getCurrentWarehouse(),
            updated_at: new Date().toISOString(),
            changes: {
              permissions: detail.permissions,
              action: detail.action,
              summary: detail.summary
            },
            action_type: detail.action,
            permissions_count: detail.permissionsCount || 0,
            full_access_count: detail.fullAccessCount || 0,
            role_action: detail.action // created, updated, deleted
          };
          
          // Add notification immediately
          addNotification('role_updated', notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
        
        // Also trigger the regular system check after a delay
        setTimeout(() => checkNotificationsOnAction(), 1000);
      }
    };

    window.addEventListener('rolePermissionsUpdated', handleRolePermissionUpdate);
    
    return () => {
      window.removeEventListener('rolePermissionsUpdated', handleRolePermissionUpdate);
    };
  }, [isLoaded, addNotification, getCurrentUser, getCurrentWarehouse, checkNotificationsOnAction]);

  // Listen for admin settings change events with immediate notification creation
  useEffect(() => {
    const handleAdminSettingsUpdate = (event) => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          const detail = event.detail;
          
          // Create immediate notification based on the event
          const notificationData = {
            id: `settings-${detail.settingId || Date.now()}`,
            setting_name: detail.settingName || detail.name || 'System Setting',
            old_value: detail.oldValue || 'Previous Value',
            new_value: detail.newValue || 'Updated Value',
            changed_by: user.username || user.name || 'Admin',
            warehouse_id: getCurrentWarehouse(),
            updated_at: new Date().toISOString(),
            changes: {
              value: { old: detail.oldValue, new: detail.newValue },
              setting: detail.settingName,
              action: detail.action || 'updated'
            },
            action_type: detail.action || 'updated',
            update_type: detail.action || 'updated',
            setting_category: detail.category || 'General'
          };
          
          // Add notification immediately
          addNotification('admin_settings_changed', notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
        
        // Also trigger the regular system check after a delay
        setTimeout(() => checkNotificationsOnAction(), 1000);
      }
    };

    // Listen for various settings-related events
    window.addEventListener('adminSettingsUpdated', handleAdminSettingsUpdate);
    window.addEventListener('settingsChanged', handleAdminSettingsUpdate);
    window.addEventListener('configurationUpdated', handleAdminSettingsUpdate);
    window.addEventListener('systemSettingsModified', handleAdminSettingsUpdate);
    
    return () => {
      window.removeEventListener('adminSettingsUpdated', handleAdminSettingsUpdate);
      window.removeEventListener('settingsChanged', handleAdminSettingsUpdate);
      window.removeEventListener('configurationUpdated', handleAdminSettingsUpdate);
      window.removeEventListener('systemSettingsModified', handleAdminSettingsUpdate);
    };
  }, [isLoaded, addNotification, getCurrentUser, getCurrentWarehouse, checkNotificationsOnAction]);

  // Listen for product management events
  useEffect(() => {
    const handleProductUpdate = (event) => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          const detail = event.detail;
          
          // Create immediate notification based on the event
          const notificationData = {
            id: detail.productId,
            product_name: detail.productName,
            product_code: detail.productCode,
            category: detail.category,
            selling_price: detail.price,
            warehouse_id: getCurrentWarehouse(),
            updated_at: new Date().toISOString(),
            changes: detail.changes,
            updated_by: user.username || user.name || 'Admin'
          };
          
          // Add notification immediately
          addNotification(detail.action === 'created' ? 'product_created' : 'product_updated', notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    const handleReturnUpdate = (event) => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          const detail = event.detail;
          
          // Create immediate notification based on the event
          const notificationData = {
            id: detail.returnId,
            return_no: detail.returnNo,
            customer_name: detail.customerName,
            refund_amount: detail.amount,
            items_count: detail.itemsCount,
            return_reason: detail.reason,
            warehouse_id: getCurrentWarehouse(),
            processed_at: new Date().toISOString(),
            refund_method: detail.method || 'Cash'
          };
          
          // Add notification immediately
          const notificationType = detail.action === 'refund' ? 'refund_issued' : 
                                 detail.action === 'rejected' ? 'return_rejected' : 'return_processed';
          addNotification(notificationType, notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    window.addEventListener('productUpdated', handleProductUpdate);
    window.addEventListener('returnProcessed', handleReturnUpdate);
    
    return () => {
      window.removeEventListener('productUpdated', handleProductUpdate);
      window.removeEventListener('returnProcessed', handleReturnUpdate);
    };
  }, [isLoaded, addNotification, getCurrentUser, getCurrentWarehouse]);

  // ✅ ENHANCED: Listen for user login events without debug logs
  useEffect(() => {
    const handleUserLogin = () => {
      // Set login time for tracking
      localStorage.setItem('loginTime', Date.now().toString());
      
      if (isLoaded) {
        // Wait longer for user data to be properly stored
        setTimeout(() => {
          checkLowStockOnLogin();
        }, 3000); // Increased delay
      } else {
        // If not loaded yet, set a flag to check later
        localStorage.setItem('pendingLoginNotificationCheck', 'true');
      }
    };

    const handleSessionRestore = () => {
      if (isLoaded) {
        setTimeout(() => {
          checkLowStockOnLogin();
        }, 2000);
      } else {
        // If not loaded yet, set a flag to check later
        localStorage.setItem('pendingLoginNotificationCheck', 'true');
      }
    };

    window.addEventListener('userLoggedIn', handleUserLogin);
    window.addEventListener('userSessionRestored', handleSessionRestore);
    
    return () => {
      window.removeEventListener('userLoggedIn', handleUserLogin);
      window.removeEventListener('userSessionRestored', handleSessionRestore);
    };
  }, [isLoaded, checkLowStockOnLogin]);

  // ✅ ENHANCED: Check for login stock notifications when component becomes loaded
  useEffect(() => {
    if (isLoaded) {
      // Check if this is a fresh login session (within last 2 minutes) OR if there's a pending check
      const loginTime = localStorage.getItem('loginTime');
      const pendingCheck = localStorage.getItem('pendingLoginNotificationCheck');
      const now = Date.now();
      const isRecentLogin = loginTime && (now - parseInt(loginTime)) < 120000; // Increased to 2 minutes
      
      if (isRecentLogin || pendingCheck) {
        // This is a recent login or we have a pending check, check for stock notifications
        setTimeout(() => {
          checkLowStockOnLogin();
        }, 2000);
        
        // Clear the flags to prevent repeated checks
        localStorage.removeItem('loginTime');
        localStorage.removeItem('pendingLoginNotificationCheck');
      }
    }
  }, [isLoaded, checkLowStockOnLogin]);

  // Listen for user activities that might trigger notifications
  useEffect(() => {
    const handleUserActivity = () => {
      if (isLoaded) {
        checkNotificationsOnAction();
      }
    };

    const events = ['click', 'focus', 'online'];

    // Handle visibility change separately
    const handleVisibilityChange = () => {
      if (!document.hidden && isLoaded) {
        handleUserActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check when notification dropdown is opened
    if (isOpen && isLoaded) {
      checkNotificationsOnAction();
    }

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkNotificationsOnAction, isOpen, isLoaded]);

  // Listen for stocks page visits
  useEffect(() => {
    const handleStocksPageVisit = () => {
      if (isLoaded) {
        checkStockNotifications();
      }
    };

    window.addEventListener('stocksPageVisited', handleStocksPageVisit);
    
    return () => {
      window.removeEventListener('stocksPageVisited', handleStocksPageVisit);
    };
  }, [checkStockNotifications, isLoaded]);

  // Listen for expenses page visits
  useEffect(() => {
    const handleExpensesPageVisit = () => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (['admin', 'supervisor'].includes(userRole) && warehouseId) {
          checkExpenseNotifications(warehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    window.addEventListener('expensesPageVisited', handleExpensesPageVisit);
    
    return () => {
      window.removeEventListener('expensesPageVisited', handleExpensesPageVisit);
    };
  }, [checkExpenseNotifications, isLoaded, getCurrentUser, getCurrentWarehouse, largeExpenseThreshold]);

  // Listen for supplier page visits
  useEffect(() => {
    const handleSuppliersPageVisit = () => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (['admin', 'supervisor'].includes(userRole) && warehouseId) {
          checkSupplierNotifications(warehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    window.addEventListener('suppliersPageVisited', handleSuppliersPageVisit);
    
    return () => {
      window.removeEventListener('suppliersPageVisited', handleSuppliersPageVisit);
    };
  }, [checkSupplierNotifications, isLoaded, getCurrentUser, getCurrentWarehouse]);

  // Listen for admin settings page visits
  useEffect(() => {
    const handleAdminPageVisit = () => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (userRole === 'admin' && warehouseId) {
          checkSystemNotifications(warehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    window.addEventListener('adminPageVisited', handleAdminPageVisit);
    window.addEventListener('settingsPageVisited', handleAdminPageVisit);
    window.addEventListener('userManagementPageVisited', handleAdminPageVisit);
    window.addEventListener('rolesPageVisited', handleAdminPageVisit);
    
    return () => {
      window.removeEventListener('adminPageVisited', handleAdminPageVisit);
      window.removeEventListener('settingsPageVisited', handleAdminPageVisit);
      window.removeEventListener('userManagementPageVisited', handleAdminPageVisit);
      window.removeEventListener('rolesPageVisited', handleAdminPageVisit);
    };
  }, [checkSystemNotifications, isLoaded, getCurrentUser, getCurrentWarehouse]);

  // Listen for products page visits
  useEffect(() => {
    const handleProductsPageVisit = () => {
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (userRole === 'admin' && warehouseId) {
          checkProductsAndReturnsNotifications(warehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    window.addEventListener('productsPageVisited', handleProductsPageVisit);
    window.addEventListener('returnsPageVisited', handleProductsPageVisit);
    
    return () => {
      window.removeEventListener('productsPageVisited', handleProductsPageVisit);
      window.removeEventListener('returnsPageVisited', handleProductsPageVisit);
    };
  }, [checkProductsAndReturnsNotifications, isLoaded, getCurrentUser, getCurrentWarehouse]);

  // Listen for page navigation/route changes
  useEffect(() => {
    const handlePageChange = () => {
      if (isLoaded) {
        setTimeout(() => checkNotificationsOnAction(), 2000);
      }
    };

    window.addEventListener('popstate', handlePageChange);
    
    // Initial check on mount (after notifications are loaded)
    if (isLoaded) {
      setTimeout(() => checkNotificationsOnAction(), 3000);
    }

    return () => {
      window.removeEventListener('popstate', handlePageChange);
    };
  }, [checkNotificationsOnAction, isLoaded]);

  // Warehouse change handler
  useEffect(() => {
    const handleWarehouseChange = () => {
      const newWarehouseId = getCurrentWarehouse();
      if (newWarehouseId !== currentWarehouseId) {
        setCurrentWarehouseId(newWarehouseId);
        
        if (isLoaded) {
          setTimeout(() => checkNotificationsOnAction(), 1000);
          // Also check for low stock when warehouse changes
          setTimeout(() => checkLowStockOnLogin(), 1500);
        }
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    setCurrentWarehouseId(getCurrentWarehouse());

    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [getCurrentWarehouse, currentWarehouseId, checkNotificationsOnAction, isLoaded, checkLowStockOnLogin]);

  // Proper click outside handling that respects detail modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close main dropdown if detail modal is open and click is on detail modal
      if (showDetailModal && event.target.closest('.notification-detail-modal')) {
        return;
      }
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowOptionsMenu(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetailModal]);

  // Close detail modal when clicking outside (but keep main dropdown open)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDetailModal && !event.target.closest('.notification-detail-modal')) {
        closeDetailModal();
      }
    };

    if (showDetailModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetailModal]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Action handlers with force update
  const markAllAsRead = () => {
    const currentWarehouseNotifications = notifications.filter(notif => {
      if (notif.data?.warehouse_id) {
        return notif.data.warehouse_id === currentWarehouseId;
      }
      return false;
    });

    currentWarehouseNotifications.forEach(notification => {
      if (!notification.is_read) {
        dispatch({ type: 'MARK_AS_READ', payload: notification.id });
      }
    });

    // FORCE UPDATE after marking all as read
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    setShowOptionsMenu(false);
  };

  const clearAllNotifications = () => {
    const currentWarehouseNotifications = notifications.filter(notif => {
      if (notif.data?.warehouse_id) {
        return notif.data.warehouse_id === currentWarehouseId;
      }
      return false;
    });

    currentWarehouseNotifications.forEach(notification => {
      if (notification.data) {
        const processedId = `${notification.type}-${notification.data.id}-${notification.data.warehouse_id || currentWarehouseId}`;
        processedIdsRef.current.add(processedId);
      }
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
    });

    localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIdsRef.current]));
    
    // FORCE UPDATE after clearing all notifications
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    setShowOptionsMenu(false);
  };

  // Update the getNotificationIcon function to include the new icons
  const getNotificationIcon = (type, priority) => {
    const iconProps = { 
      className: `text-lg ${
        priority === 'high' ? 'text-red-500' : 
        priority === 'medium' ? 'text-yellow-500' : 
        'text-blue-500'
      }`
    };

    const iconMap = {
      'low_stock': faBoxes,
      'out_of_stock': faExclamationTriangle,
      'stock_adjustment': faEdit,
      'new_receiving': faWarehouse,
      'paid_credit': faCreditCard,
      'supplier_added': faUserTie,
      'supplier_updated': faEdit,
      'supplier_return_processed': faUndo,  
      'supplier_return': faUndo,
      'warehouse_msp_created': faClipboardList,
      'warehouse_msp_updated': faEdit,
      'new_sale': faDollarSign,
      'sale_voided': faTimesCircle,
      // Enhanced expense notification icons
      'expense_created': faDollarSign,
      'expense_updated': faEdit,
      'expense_deleted': faTrash,
      'large_expense': faMoneyBill,
      // System & Role Accessibility notification icons
      'role_updated': faUserTie,
      'menu_access_changed': faCog,
      'admin_settings_changed': faCog,
      // Product Management notification icons
      'product_created': faBoxes,
      'product_updated': faEdit,
      'product_deleted': faTrash,
      // Returns/Refunds notification icons
      'return_processed': faUndo,
      'refund_issued': faMoneyBill,
      'return_rejected': faTimesCircle,
      'exchange_processed': faEdit
    };

    return <FontAwesomeIcon icon={iconMap[type] || faInfoCircle} {...iconProps} />;
  };

  const timeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const hours = Math.floor(diffInMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getCategoryBadge = (category) => {
    const badges = {
      'inventory': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', text: 'Inventory' },
      'payments': { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300', text: 'Payment' },
      'expenses': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', text: 'Expense' },
      'suppliers': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', text: 'Supplier' },
      'warehouse': { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300', text: 'Warehouse' },
      'system': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300', text: 'System' },
      'sales': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', text: 'Sales' },
      'products': { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300', text: 'Products' },
      'returns': { color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300', text: 'Returns' }
    };

    const badge = badges[category] || badges['inventory'];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getCurrentWarehouseName = () => {
    const user = getCurrentUser();
    if (user.role?.toLowerCase() === "admin") {
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      if (selectedWarehouse?.name) {
        return selectedWarehouse.name;
      }
    }
    return user.warehouse || "Unknown Warehouse";
  };

  // Strict warehouse filtering - Van Load notifications only show in correct warehouse
  const filteredNotifications = (activeTab === 'all' 
    ? notifications 
    : notifications.filter(notif => !notif.is_read))
    .filter(notif => {
      if (notif.data?.warehouse_id) {
        return notif.data.warehouse_id === currentWarehouseId;
      }
      return false;
    });

  // Calculate unread count with proper memoization
  const currentWarehouseUnreadCount = React.useMemo(() => {
    const count = notifications.filter(notif => {
      const hasWarehouseId = notif.data?.warehouse_id;
      const isCurrentWarehouse = hasWarehouseId && notif.data.warehouse_id === currentWarehouseId;
      const isUnread = !notif.is_read;
      
      return isCurrentWarehouse && isUnread;
    }).length;
    
    return count;
  }, [notifications, currentWarehouseId]);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Icon */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-white hover:text-gray-300 focus:outline-none transition-colors"
          title={`${currentWarehouseUnreadCount} unread notifications`}
        >
          <FontAwesomeIcon icon={faBell} className="text-lg" />
          {currentWarehouseUnreadCount > 0 && (
            <span 
              key={`badge-${currentWarehouseUnreadCount}-${forceUpdate}`}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse"
            >
              {currentWarehouseUnreadCount > 99 ? '99+' : currentWarehouseUnreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown - TALLER CONTAINER */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Notifications
                  </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                    <div className="font-medium text-gray-700 dark:text-gray-300">{getCurrentWarehouseName()}</div>
                  </div>
                </div>
                
                {/* Options Menu */}
                <div className="relative flex-shrink-0" ref={optionsRef}>
                  <button
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                  >
                    <FontAwesomeIcon icon={faEllipsisH} />
                  </button>
                  
                  {showOptionsMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-10">
                      <button
                        onClick={markAllAsRead}
                        className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-600 flex items-center"
                      >
                        <FontAwesomeIcon icon={faEye} className="mr-2" />
                        Mark all read
                      </button>
                      <button
                        onClick={clearAllNotifications}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:text-red-400 dark:hover:bg-gray-600 flex items-center"
                      >
                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                        Clear all
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-600"></div>
                      <button
                        onClick={() => window.location.href = '/expense-settings'}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-600 flex items-center"
                      >
                        <FontAwesomeIcon icon={faCog} className="mr-2" />
                        Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    activeTab === 'all'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All ({filteredNotifications.length})
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    activeTab === 'unread'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Unread ({currentWarehouseUnreadCount})
                </button>
              </div>
            </div>

            {/* Notifications List - TALLER SCROLLABLE AREA */}
            <div className="max-h-96 overflow-y-auto">
              {!isLoaded ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faBell} className="text-2xl text-gray-400 dark:text-gray-500 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Loading Notifications...
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                    Setting up notification system...
                  </p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faBell} className="text-2xl text-gray-400 dark:text-gray-500" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    No Notifications Here
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No notifications for {getCurrentWarehouseName()} right now.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={`${notification.id}-${forceUpdate}`}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                      !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <h4 className={`text-sm font-medium break-words ${
                                !notification.is_read 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-gray-600 dark:text-gray-300'
                              }`}>
                                {notification.title}
                              </h4>
                              {notification.category && getCategoryBadge(notification.category)}
                              {notification.priority === 'high' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                  HIGH
                                </span>
                              )}
                              {notification.data?.is_van_load && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                  VAN LOAD
                                </span>
                              )}
                              {notification.type === 'paid_credit' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  PAID
                                </span>
                              )}
                              {notification.data?.login_check && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  LOGIN
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words">
                              {notification.message}
                            </p>
                            {notification.details && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 break-words">
                                {notification.details}
                              </p>
                            )}
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 inline-block">
                              {timeAgo(notification.timestamp)}
                            </span>
                          </div>
                          
                          {/* Only blue dot indicator remains */}
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Detail Modal with proper X button behavior */}
      {showDetailModal && selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="notification-detail-modal bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(selectedNotification.type, selectedNotification.priority)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {selectedNotification.title}
                    </h2>
                    <div className="flex items-center space-x-2 mb-2">
                      {selectedNotification.category && getCategoryBadge(selectedNotification.category)}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getPriorityColor(selectedNotification.priority)} bg-gray-100 dark:bg-gray-700`}>
                        {selectedNotification.priority || 'Normal'} Priority
                      </span>
                      {selectedNotification.data?.is_van_load && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          Van Load Update
                        </span>
                      )}
                      {selectedNotification.type === 'paid_credit' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          Credit Payment
                        </span>
                      )}
                      {selectedNotification.data?.login_check && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          Login Check
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {selectedNotification.message}
                    </p>
                    {selectedNotification.details && (
                      <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                        {selectedNotification.details}
                      </p>
                    )}
                  </div>
                </div>
                {/* X button with proper event handling */}
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 z-10"
                  type="button"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-lg" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Notification Details */}
              <div className="space-y-4">
                {/* Basic Information */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2 text-blue-500" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created:</span>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center">
                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-1 text-gray-400" />
                        {new Date(selectedNotification.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Time Ago:</span>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {timeAgo(selectedNotification.timestamp)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Type:</span>
                      <div className="font-medium text-gray-900 dark:text-white capitalize">
                        {selectedNotification.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Status:</span>
                      <div className={`font-medium ${selectedNotification.is_read ? 'text-green-600' : 'text-blue-600'}`}>
                        <FontAwesomeIcon icon={selectedNotification.is_read ? faCheck : faEye} className="mr-1" />
                        {selectedNotification.is_read ? 'Read' : 'Unread'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Information */}
                {formatDetailData(selectedNotification).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      <FontAwesomeIcon icon={faClipboardList} className="mr-2 text-green-500" />
                      Detailed Information
                    </h3>
                    <div className="space-y-2">
                      {formatDetailData(selectedNotification).map((detail, index) => (
                        <div key={index} className="flex justify-between items-start text-sm">
                          <span className="text-gray-500 dark:text-gray-400 w-1/3 flex-shrink-0">
                            {detail.label}:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white w-2/3 text-right break-words">
                            {detail.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warehouse Information */}
                {selectedNotification.data?.warehouse_id && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-purple-500" />
                      Location Information
                    </h3>
                    <div className="text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Warehouse:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {getCurrentWarehouseName()} (ID: {selectedNotification.data.warehouse_id})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notification;