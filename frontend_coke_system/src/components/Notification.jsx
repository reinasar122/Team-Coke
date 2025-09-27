// src/components/Notification.jsx - COMPLETE UPDATED VERSION WITH WARNINGS FIXED
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
  faUserTie
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
  
  // ✅ ENHANCED: Dynamic expense threshold with real-time updates
  const [largeExpenseThreshold, setLargeExpenseThreshold] = useState(10000);
  
  const dropdownRef = useRef(null);
  const optionsRef = useRef(null);
  const processedIdsRef = useRef(new Set(JSON.parse(localStorage.getItem('processedNotificationIds') || '[]')));

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

  // Persist notifications to localStorage helper function
  const persistNotifications = useCallback((notifications) => {
    try {
      console.log('🔧 Persisting notifications to localStorage:', notifications.length);
      localStorage.setItem('persistedNotifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('🔧 Error persisting notifications:', error);
    }
  }, []);

  // Load persisted notifications on component mount
  useEffect(() => {
    const loadPersistedNotifications = () => {
      try {
        console.log('🔧 Loading persisted notifications from localStorage...');
        const savedNotifications = localStorage.getItem('persistedNotifications');
        if (savedNotifications) {
          const parsedNotifications = JSON.parse(savedNotifications);
          console.log('🔧 Found saved notifications:', parsedNotifications.length);
          
          // Filter notifications that are still valid (not older than 7 days)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const validNotifications = parsedNotifications.filter(notif => 
            new Date(notif.timestamp) > sevenDaysAgo
          );
          
          console.log('🔧 Valid notifications after cleanup:', validNotifications.length);
          
          // Use SET_NOTIFICATIONS to restore all valid notifications at once
          if (validNotifications.length > 0) {
            dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });
            console.log('🔧 Notifications restored to state');
          }
          
          // Update localStorage with only valid notifications
          if (validNotifications.length !== parsedNotifications.length) {
            persistNotifications(validNotifications);
            console.log('🔧 Cleaned up expired notifications in localStorage');
          }
        } else {
          console.log('🔧 No saved notifications found in localStorage');
        }
        setIsLoaded(true);
      } catch (error) {
        console.error('🔧 Error loading persisted notifications:', error);
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

  // ✅ NEW: Re-evaluate existing expense notifications when threshold changes
  const reevaluateExpenseNotifications = useCallback((newThreshold) => {
    console.log('💰 Re-evaluating expense notifications with new threshold:', newThreshold);
    
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

  // ✅ ENHANCED: Load and monitor expense threshold changes
  useEffect(() => {
    const loadExpenseThreshold = () => {
      try {
        const savedThreshold = localStorage.getItem('largeExpenseThreshold');
        if (savedThreshold) {
          setLargeExpenseThreshold(Number(savedThreshold));
          console.log('💰 Loaded expense threshold:', Number(savedThreshold));
        }
      } catch (error) {
        console.error('💰 Error loading expense threshold:', error);
      }
    };
    
    loadExpenseThreshold();

    // ✅ Listen for threshold updates from settings
    const handleThresholdUpdate = (event) => {
      const newThreshold = event.detail?.newThreshold;
      if (newThreshold && newThreshold !== largeExpenseThreshold) {
        console.log('💰 Threshold updated from settings:', newThreshold);
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

  const getCurrentUser = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const getCurrentWarehouse = useCallback(() => {
    try {
      const user = getCurrentUser();
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      return user.role?.toLowerCase() === "admin" && selectedWarehouse 
        ? selectedWarehouse.id 
        : user.warehouse_id;
    } catch {
      return null;
    }
  }, [getCurrentUser]);

  // ENHANCED: Complete stock and adjustment notification checking with change detection
  const checkStockNotifications = useCallback(async () => {
    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = getCurrentWarehouse();
    
    if (!userRole || !warehouseId) {
      console.log('❌ No user role or warehouse ID found for stock checking');
      return;
    }

    console.log(`🔔 CHECKING STOCK NOTIFICATIONS for ${userRole} in warehouse ${warehouseId}`);
    const processedIds = processedIdsRef.current;
    let newNotifications = 0;

    try {
      // 1. CHECK CURRENT STOCK LEVELS
      console.log('📊 Fetching current stock levels...');
      const stockResponse = await axios.get(`http://localhost:8080/api/stocks/?warehouse=${warehouseId}`, { timeout: 5000 });
      const stocks = Array.isArray(stockResponse.data) ? stockResponse.data : stockResponse.data?.results || [];
      
      console.log(`📊 Found ${stocks.length} stock items to check`);

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
          console.log(`🚨 OUT OF STOCK notification: ${stock.product_name} (Qty: ${currentQuantity})`);
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
          console.log(`⚠️ LOW STOCK notification: ${stock.product_name} (Qty: ${currentQuantity})`);
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
            console.log(`📝 STOCK ADJUSTMENT notification: ${stock.product_name} (${previousQuantity} → ${currentQuantity}) - Remaining: ${currentQuantity}`);
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

      // 2. TRY TO CHECK STOCK ADJUSTMENTS API (if available)
      try {
        const config = { 
          headers: { "X-Warehouse-ID": warehouseId },
          timeout: 3000
        };

        const adjustmentResponse = await axios.get(`http://localhost:8080/api/stock-adjustments/`, config);
        const adjustments = Array.isArray(adjustmentResponse.data) ? adjustmentResponse.data : adjustmentResponse.data?.results || [];
        
        if (adjustments.length > 0) {
          console.log(`📝 Found ${adjustments.length} API stock adjustments`);

          // Check for recent adjustments (last 15 minutes)
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
          
          adjustments.forEach(adjustment => {
            const adjustmentId = `api-adj-${adjustment.id}-${warehouseId}`;
            const adjustmentDate = new Date(adjustment.created_at || adjustment.date_time || adjustment.updated_at);
            
            if (adjustmentDate > fifteenMinutesAgo && !processedIds.has(adjustmentId)) {
              const oldQty = adjustment.old_quantity || adjustment.previous_quantity || 'Unknown';
              const newQty = adjustment.new_quantity || adjustment.current_quantity || 'Unknown';
              
              // Create better API adjustment message
              let apiTitle, apiMessage;
              if (newQty === 0) {
                apiTitle = '📝 Stock Depleted (API)';
                apiMessage = `${adjustment.product_name} stock depleted via system`;
              } else if (newQty > oldQty) {
                apiTitle = '📝 Stock Increased (API)';
                apiMessage = `${adjustment.product_name} stock increased. Current: ${newQty} units`;
              } else {
                apiTitle = '📝 Stock Reduced (API)';
                apiMessage = `${adjustment.product_name} stock reduced. Remaining: ${newQty} units`;
              }
              
              addNotification('stock_adjustment', { 
                ...adjustment, 
                warehouse_id: warehouseId,
                product_name: adjustment.product_name || `Product ${adjustment.product_id}`,
                old_quantity: oldQty,
                new_quantity: newQty,
                remaining_quantity: newQty,
                reason: adjustment.reason || adjustment.adjustment_reason || 'Official stock adjustment',
                custom_title: apiTitle,
                custom_message: apiMessage
              }, userRole);
              processedIds.add(adjustmentId);
              newNotifications++;
              console.log(`📝 API ADJUSTMENT notification: ${adjustment.product_name} - Remaining: ${newQty}`);
            }
          });
        }
      } catch (apiError) {
        console.log('📝 Stock adjustments API not available, using change detection method');
      }

      // 3. SAVE PROCESSED IDS
      if (newNotifications > 0) {
        localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
        processedIdsRef.current = processedIds;
        console.log(`✅ ${newNotifications} NEW STOCK NOTIFICATIONS CREATED!`);
      } else {
        console.log(`ℹ️ No new stock notifications needed`);
      }

    } catch (error) {
      console.error("❌ Stock notification check failed:", error.message);
    }
  }, [getCurrentUser, getCurrentWarehouse, addNotification]);

  // ✅ ENHANCED: Advanced expense notification checking with improved detection
  const checkExpenseNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    console.log(`💰 CHECKING EXPENSE NOTIFICATIONS for ${userRole} in warehouse ${warehouseId} with threshold ₱${largeExpenseThreshold.toLocaleString()}`);
    let newNotifications = 0;

    try {
      const config = { 
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      };

      // Use the correct API endpoint for expenses (miscellaneous items)
      const expenseResponse = await axios.get(
        `http://localhost:8080/api/miscellaneous-items/?warehouse=${warehouseId}`, 
        config
      );
      
      const expenses = Array.isArray(expenseResponse.data) ? expenseResponse.data : expenseResponse.data?.results || [];
      console.log(`💰 Found ${expenses.length} expenses to check against threshold ₱${largeExpenseThreshold.toLocaleString()}`);

      if (expenses.length === 0) {
        console.log('💰 No expenses found for this warehouse');
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
            
            console.log(`💰 EXPENSE UPDATED: ${expense.description} - Amount: ₱${expenseAmount.toLocaleString()} (was ₱${previousExpense.amount.toLocaleString()})`);
            
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
              console.log(`💰 LARGE EXPENSE CREATED: ${expense.description} - Amount: ₱${expenseAmount.toLocaleString()} (≥ ₱${largeExpenseThreshold.toLocaleString()})`);
              addNotification('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                update_type: 'new_large_expense'
              }, userRole);
            } else {
              console.log(`💰 EXPENSE CREATED: ${expense.description} - Amount: ₱${expenseAmount.toLocaleString()} (< ₱${largeExpenseThreshold.toLocaleString()})`);
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
            
            console.log(`💰 EXPENSE DELETED: ${expenseData.description} - Amount: ₱${expenseData.amount.toLocaleString()} ${wasLarge ? '(was large)' : ''}`);
            
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
        console.log(`💰 ${newNotifications} EXPENSE NOTIFICATIONS CREATED!`);
      } else {
        console.log('💰 No new expense notifications needed');
      }

    } catch (error) {
      console.error("💰 Expense notification check failed:", error.message);
      if (error.response?.status === 404) {
        console.log("💰 Expense API endpoint not found - skipping expense notifications");
      } else if (error.response?.status === 401) {
        console.log("💰 Unauthorized access to expense API - checking authentication");
      }
    }

    return newNotifications;
  }, [addNotification, largeExpenseThreshold]);

  // ✅ NEW: Check system and role accessibility notifications (Admin only)
  const checkSystemNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    console.log(`🔐 CHECKING SYSTEM NOTIFICATIONS for ${userRole} in warehouse ${warehouseId}`);
    let newNotifications = 0;

    // Only admin can see system notifications
    if (userRole !== 'admin') {
      console.log('🔐 Skipping system notifications - Only admin can see these');
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

      const now = new Date().toISOString(); // ✅ FIXED: Define 'now' variable

      // 1. CHECK USER ROLE CHANGES
      try {
        const usersResponse = await axios.get(`http://localhost:8080/api/users/`, config);
        const users = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data?.results || [];
        console.log(`🔐 Found ${users.length} users to check for role changes`);

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
              console.log(`🔐 USER ROLE UPDATED: ${user.username || user.name} - Role: ${previousUser.role} → ${user.role}`);
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
        console.log('🔐 Users API not available, skipping role change notifications');
      }

      // 2. CHECK MENU ACCESS CHANGES
      try {
        const menuResponse = await axios.get(`http://localhost:8080/api/menu-permissions/`, config);
        const menuPermissions = Array.isArray(menuResponse.data) ? menuResponse.data : menuResponse.data?.results || [];
        console.log(`🔐 Found ${menuPermissions.length} menu permissions to check`);

        // Get previous menu permissions for comparison
        const previousMenuKey = `previousMenuPermissions_${warehouseId}`;
        const previousMenuPermissions = JSON.parse(localStorage.getItem(previousMenuKey) || '{}');

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        menuPermissions.forEach(menuPerm => {
          const menuId = `menu-access-${menuPerm.id}-${warehouseId}`;
          const menuDate = new Date(menuPerm.updated_at || menuPerm.created_at || now);
          const previousMenuPerm = previousMenuPermissions[menuPerm.id];

          // Check if this is a recent menu permission update
          if (menuDate > tenMinutesAgo && !processedIds.has(menuId)) {
            
            // Check for access changes
            const isAccessUpdate = previousMenuPerm && (
              previousMenuPerm.can_access !== menuPerm.can_access ||
              previousMenuPerm.role_id !== menuPerm.role_id
            );

            if (isAccessUpdate) {
              console.log(`🔐 MENU ACCESS CHANGED: ${menuPerm.menu_name || 'Menu'} - Access: ${previousMenuPerm.can_access} → ${menuPerm.can_access}`);
              addNotification('menu_access_changed', { 
                ...menuPerm, 
                warehouse_id: warehouseId,
                menu_name: menuPerm.menu_name || menuPerm.name || 'Menu Item',
                role_name: menuPerm.role_name || 'Role',
                access_granted: menuPerm.can_access,
                previous_access: previousMenuPerm.can_access,
                updated_by: menuPerm.updated_by || 'Admin',
                changes: {
                  access: { old: previousMenuPerm.can_access, new: menuPerm.can_access },
                  role: { old: previousMenuPerm.role_id, new: menuPerm.role_id }
                }
              }, userRole);
              
              processedIds.add(menuId);
              newNotifications++;
            }
          }

          // Store current menu permission data for next comparison
          previousMenuPermissions[menuPerm.id] = {
            can_access: menuPerm.can_access,
            role_id: menuPerm.role_id,
            menu_name: menuPerm.menu_name || menuPerm.name,
            role_name: menuPerm.role_name,
            updated_at: menuPerm.updated_at || menuPerm.created_at,
            timestamp: now
          };
        });

        // Save current menu permissions state for next comparison
        localStorage.setItem(previousMenuKey, JSON.stringify(previousMenuPermissions));
        
      } catch (menuError) {
        console.log('🔐 Menu permissions API not available, skipping menu access notifications');
      }

      // 3. CHECK ADMIN SETTINGS CHANGES
      try {
        const settingsResponse = await axios.get(`http://localhost:8080/api/settings/`, config);
        const settings = Array.isArray(settingsResponse.data) ? settingsResponse.data : settingsResponse.data?.results || [];
        console.log(`🔐 Found ${settings.length} settings to check`);

        // Get previous settings for comparison
        const previousSettingsKey = `previousSettings_${warehouseId}`;
        const previousSettings = JSON.parse(localStorage.getItem(previousSettingsKey) || '{}');

        const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
        
        settings.forEach(setting => {
          const settingId = `admin-setting-${setting.id}-${warehouseId}`;
          const settingDate = new Date(setting.updated_at || setting.created_at || now);
          const previousSetting = previousSettings[setting.id];

          // Check if this is a recent setting update
          if (settingDate > twentyMinutesAgo && !processedIds.has(settingId)) {
            
            // Check for setting changes
            const isSettingUpdate = previousSetting && (
              previousSetting.value !== setting.value ||
              previousSetting.configuration !== JSON.stringify(setting.configuration || {})
            );

            if (isSettingUpdate || !previousSetting) {
              const updateType = isSettingUpdate ? 'updated' : 'created';
              console.log(`🔐 ADMIN SETTING ${updateType.toUpperCase()}: ${setting.name || setting.setting_name} - Value: ${previousSetting?.value || 'N/A'} → ${setting.value}`);
              
              addNotification('admin_settings_changed', { 
                ...setting, 
                warehouse_id: warehouseId,
                setting_name: setting.name || setting.setting_name || `Setting ${setting.id}`,
                old_value: previousSetting?.value || 'N/A',
                new_value: setting.value,
                changed_by: setting.changed_by || setting.updated_by || 'Admin',
                update_type: updateType,
                changes: {
                  value: { old: previousSetting?.value, new: setting.value },
                  configuration: { 
                    old: previousSetting?.configuration, 
                    new: JSON.stringify(setting.configuration || {}) 
                  }
                }
              }, userRole);
              
              processedIds.add(settingId);
              newNotifications++;
            }
          }

          // Store current setting data for next comparison
          previousSettings[setting.id] = {
            value: setting.value,
            configuration: JSON.stringify(setting.configuration || {}),
            name: setting.name || setting.setting_name,
            updated_at: setting.updated_at || setting.created_at,
            timestamp: now
          };
        });

        // Save current settings state for next comparison
        localStorage.setItem(previousSettingsKey, JSON.stringify(previousSettings));
        
      } catch (settingsError) {
        console.log('🔐 Admin settings API not available, skipping settings notifications');
      }

      if (newNotifications > 0) {
        console.log(`🔐 ${newNotifications} SYSTEM NOTIFICATIONS CREATED!`);
      } else {
        console.log('🔐 No new system notifications needed');
      }

    } catch (error) {
      console.error("🔐 System notification check failed:", error.message);
    }

    return newNotifications;
  }, [addNotification]);

  // ✅ ENHANCED: Enhanced supplier notifications with Van Load MSP change detection
  const checkSupplierNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    console.log(`🏢 CHECKING SUPPLIER NOTIFICATIONS for ${userRole} in warehouse ${warehouseId}`);
    let newNotifications = 0;

    try {
      const config = { 
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      };

      const now = new Date().toISOString(); // ✅ FIXED: Define 'now' variable

      // 1. CHECK SUPPLIERS
      const supplierResponse = await axios.get(`http://localhost:8080/api/suppliers/`, config);
      const suppliers = Array.isArray(supplierResponse.data) ? supplierResponse.data : supplierResponse.data?.results || [];
      console.log(`🏢 Found ${suppliers.length} suppliers to check`);

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
            console.log(`🏢 SUPPLIER UPDATED: ${supplier.name}`);
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
            console.log(`🏢 NEW SUPPLIER ADDED: ${supplier.name}`);
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
        console.log(`🔄 Found ${returns.length} supplier returns to check`);

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        returns.forEach(returnItem => {
          const returnId = `supplier-return-${returnItem.id}-${warehouseId}`;
          const returnDate = new Date(returnItem.created_at || returnItem.processed_at || returnItem.date_processed || now);
          
          // Check if this is a recent return
          if (returnDate > thirtyMinutesAgo && !processedIds.has(returnId)) {
            console.log(`🔄 SUPPLIER RETURN PROCESSED: ${returnItem.supplier_name || 'Unknown Supplier'} - ${returnItem.product_name || 'Product'}`);
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
        console.log('🔄 Supplier returns API not available, skipping return notifications');
      }

      // 3. ✅ ENHANCED: CHECK WAREHOUSE MSP (MERCHANDISING) OPERATIONS WITH VAN LOAD SUPPORT
      try {
        const mspResponse = await axios.get(`http://localhost:8080/api/merchandisings/?warehouse=${warehouseId}`, config);
        const msps = Array.isArray(mspResponse.data) ? mspResponse.data : mspResponse.data?.results || [];
        console.log(`📋 Found ${msps.length} MSPs to check`);

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
            
            // ✅ ENHANCED: Better update detection for Van Load transactions
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
              // ✅ MSP UPDATED - Enhanced for Van Load notifications
              const isVanLoad = (msp.transaction_type_name || '').toLowerCase().includes('van load');
              const updateType = isVanLoad ? 'Van Load' : 'Warehouse MSP';
              
              console.log(`📋 ${updateType.toUpperCase()} UPDATED: ${msp.msp_no} - Status: ${msp.status}`);
              
              // ✅ Determine what changed for better notification details
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
              // ✅ NEW MSP CREATED - Enhanced for both Van Load and Warehouse
              const isVanLoad = (msp.transaction_type_name || '').toLowerCase().includes('van load');
              const creationType = isVanLoad ? 'Van Load' : 'Warehouse MSP';
              
              console.log(`📋 ${creationType.toUpperCase()} CREATED: ${msp.msp_no} - Expected Sale: ₱${(msp.expected_sale || 0).toLocaleString()}`);
              
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

          // ✅ Store enhanced MSP data for next comparison (including more fields)
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
        console.log('📋 MSP/Merchandising API not available, skipping MSP notifications');
      }

      if (newNotifications > 0) {
        console.log(`🏢 ${newNotifications} SUPPLIER/WAREHOUSE NOTIFICATIONS CREATED!`);
      } else {
        console.log('🏢 No new supplier/warehouse notifications needed');
      }

    } catch (error) {
      console.error("🏢 Supplier notification check failed:", error.message);
    }

    return newNotifications;
  }, [addNotification]);

  // ✅ NEW: Check products and returns/refunds notifications (Admin only)
  const checkProductsAndReturnsNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    console.log(`📦 CHECKING PRODUCTS & RETURNS NOTIFICATIONS for ${userRole} in warehouse ${warehouseId}`);
    let newNotifications = 0;

    // Only admin can see product and returns notifications
    if (userRole !== 'admin') {
      console.log('📦 Skipping products & returns notifications - Only admin can see these');
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
        console.log(`📦 Found ${products.length} products to check`);

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
              console.log(`📦 PRODUCT UPDATED: ${product.product_name}`);
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
              console.log(`📦 NEW PRODUCT CREATED: ${product.product_name}`);
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
        console.log('📦 Products API not available, skipping product notifications');
      }

      // 2. CHECK RETURNS/REFUNDS
      try {
        const returnsResponse = await axios.get(`http://localhost:8080/api/returns/`, config);
        const returns = Array.isArray(returnsResponse.data) ? returnsResponse.data : returnsResponse.data?.results || [];
        console.log(`🔄 Found ${returns.length} returns to check`);

        const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
        
        returns.forEach(returnItem => {
          const returnId = `return-${returnItem.id}-${warehouseId}`;
          const returnDate = new Date(returnItem.created_at || returnItem.processed_at || now);
          
          // Check if this is a recent return
          if (returnDate > twentyMinutesAgo && !processedIds.has(returnId)) {
            const returnStatus = (returnItem.status || '').toLowerCase();
            
            if (returnStatus === 'processed' || returnStatus === 'completed') {
              console.log(`🔄 RETURN PROCESSED: ${returnItem.return_no || returnItem.transaction_no}`);
              addNotification('return_processed', { 
                ...returnItem, 
                warehouse_id: warehouseId
              }, userRole);
            } else if (returnStatus === 'rejected' || returnStatus === 'denied') {
              console.log(`❌ RETURN REJECTED: ${returnItem.return_no || returnItem.transaction_no}`);
              addNotification('return_rejected', { 
                ...returnItem, 
                warehouse_id: warehouseId
              }, userRole);
            }
            
            processedIds.add(returnId);
            newNotifications++;
          }
        });
      } catch (returnsError) {
        console.log('🔄 Returns API not available, skipping returns notifications');
      }

      // 3. CHECK REFUNDS
      try {
        const refundsResponse = await axios.get(`http://localhost:8080/api/refunds/`, config);
        const refunds = Array.isArray(refundsResponse.data) ? refundsResponse.data : refundsResponse.data?.results || [];
        console.log(`💰 Found ${refunds.length} refunds to check`);

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        
        refunds.forEach(refund => {
          const refundId = `refund-${refund.id}-${warehouseId}`;
          const refundDate = new Date(refund.refund_date || refund.processed_at || refund.created_at || now);
          
          // Check if this is a recent refund
          if (refundDate > fifteenMinutesAgo && !processedIds.has(refundId)) {
            console.log(`💰 REFUND ISSUED: ${refund.refund_no || refund.return_no}`);
            addNotification('refund_issued', { 
              ...refund, 
              warehouse_id: warehouseId
            }, userRole);
            
            processedIds.add(refundId);
            newNotifications++;
          }
        });
      } catch (refundsError) {
        console.log('💰 Refunds API not available, skipping refund notifications');
      }

      if (newNotifications > 0) {
        console.log(`📦 ${newNotifications} PRODUCTS & RETURNS NOTIFICATIONS CREATED!`);
      } else {
        console.log('📦 No new products & returns notifications needed');
      }

    } catch (error) {
      console.error("📦 Products & Returns notification check failed:", error.message);
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

    console.log(`🔔 Checking additional notifications for ${userRole} in warehouse ${warehouseId}`);

    try {
      const apiCalls = [];
      const processedIds = processedIdsRef.current;
      let newNotifications = 0;
      
      // Add other API calls (receiving, credits, etc.)
      apiCalls.push(
        axios.get(`http://localhost:8080/api/receiving/`, config).then(res => ({ type: 'receiving', data: res })).catch(() => null),
        axios.get(`http://localhost:8080/api/credits/`, config).then(res => ({ type: 'credits', data: res })).catch(() => null)
      );

      // ✅ EXPENSES (Admin & Supervisor only) - Call our enhanced expense checker
      if (['admin', 'supervisor'].includes(userRole)) {
        const expenseNotifications = await checkExpenseNotifications(warehouseId, userRole, processedIds);
        newNotifications += expenseNotifications;
        
        // ✅ SUPPLIERS & WAREHOUSE OPERATIONS (Admin & Supervisor only)
        const supplierNotifications = await checkSupplierNotifications(warehouseId, userRole, processedIds);
        newNotifications += supplierNotifications;
      }

      // ✅ SYSTEM & ROLE ACCESSIBILITY (Admin only) - Check for role changes, menu access, and settings
      if (userRole === 'admin') {
        const systemNotifications = await checkSystemNotifications(warehouseId, userRole, processedIds);
        newNotifications += systemNotifications;
        
        // ✅ NEW: PRODUCTS & RETURNS (Admin only)
        const productsReturnsNotifications = await checkProductsAndReturnsNotifications(warehouseId, userRole, processedIds);
        newNotifications += productsReturnsNotifications;
      }

      // SALES (Admin only)
      if (userRole === 'admin') {
        apiCalls.push(
          axios.get(`http://localhost:8080/api/sales/`, config).then(res => ({ type: 'sales', data: res })).catch(() => null),
          axios.get(`http://localhost:8080/api/transactions/`, config).then(res => ({ type: 'transactions', data: res })).catch(() => null)
        );
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
            // Check for new paid credits (last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            items.forEach(credit => {
              const creditId = `credit-${credit.id}-${warehouseId}`;
              const updatedDate = new Date(credit.updated_at || credit.created_at);
              
              if (credit.status?.toUpperCase() === 'PAID' && 
                  updatedDate > fiveMinutesAgo && 
                  !processedIds.has(creditId)) {
                addNotification('paid_credit', { ...credit, warehouse_id: warehouseId }, userRole);
                processedIds.add(creditId);
                newNotifications++;
              }
            });
            break;

          case 'sales':
            // Check for recent sales (last 20 minutes)
            const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
            items.forEach(sale => {
              const saleId = `sale-${sale.id}-${warehouseId}`;
              const saleDate = new Date(sale.created_at);
              
              if (saleDate > twentyMinutesAgo && !processedIds.has(saleId)) {
                if (sale.status?.toLowerCase() === 'voided' || sale.is_voided) {
                  addNotification('sale_voided', { ...sale, warehouse_id: warehouseId }, userRole);
                } else {
                  addNotification('new_sale', { ...sale, warehouse_id: warehouseId }, userRole);
                }
                processedIds.add(saleId);
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
        console.log(`🔔 ${newNotifications} additional notifications detected!`);
      }

    } catch (error) {
      console.log("Additional notification check failed:", error.message);
    }
  }, [getCurrentUser, getCurrentWarehouse, addNotification, checkStockNotifications, checkExpenseNotifications, checkSupplierNotifications, checkSystemNotifications, checkProductsAndReturnsNotifications]);

  // ✅ ENHANCED: Listen for Van Load update events with immediate notification creation
  useEffect(() => {
    const handleVanLoadUpdate = (event) => {
      console.log('🚛 Van Load updated - immediate notification check...', event.detail);
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

          console.log('🚛 Creating immediate Van Load notification:', notificationData);
          
          // Add notification immediately
          addNotification('warehouse_msp_updated', notificationData, userRole);
        }
        
        // Also trigger the regular check after a delay
        setTimeout(() => checkNotificationsOnAction(), 2000);
      }
    };

    // ✅ Debug listener to see what's happening
    const debugVanLoadEvents = (event) => {
      console.log('🐛 DEBUG: vanLoadUpdated event received!', event.detail);
      console.log('🐛 DEBUG: Current user role:', getCurrentUser().role);
      console.log('🐛 DEBUG: Is loaded:', isLoaded);
      console.log('🐛 DEBUG: Current warehouse:', getCurrentWarehouse());
    };

    window.addEventListener('vanLoadUpdated', handleVanLoadUpdate);
    window.addEventListener('vanLoadUpdated', debugVanLoadEvents);
    
    return () => {
      window.removeEventListener('vanLoadUpdated', handleVanLoadUpdate);
      window.removeEventListener('vanLoadUpdated', debugVanLoadEvents);
    };
  }, [checkNotificationsOnAction, isLoaded, addNotification, getCurrentUser, getCurrentWarehouse]);

  // ✅ NEW: Listen for role permission updates with immediate notification creation
  useEffect(() => {
    const handleRolePermissionUpdate = (event) => {
      console.log('🔐 Role permissions updated - immediate notification check...', event.detail);
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

          console.log('🔐 Creating immediate role permission notification:', notificationData);
          
          // Add notification immediately
          addNotification('role_updated', notificationData, userRole);
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

  // ✅ NEW: Listen for admin settings change events with immediate notification creation
  useEffect(() => {
    const handleAdminSettingsUpdate = (event) => {
      console.log('⚙️ Admin settings updated - immediate notification check...', event.detail);
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

          console.log('⚙️ Creating immediate admin settings notification:', notificationData);
          
          // Add notification immediately
          addNotification('admin_settings_changed', notificationData, userRole);
        }
        
        // Also trigger the regular system check after a delay
        setTimeout(() => checkNotificationsOnAction(), 1000);
      }
    };

    // ✅ Listen for various settings-related events
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

  // ✅ NEW: Listen for product management events
  useEffect(() => {
    const handleProductUpdate = (event) => {
      console.log('📦 Product updated - immediate notification check...', event.detail);
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

          console.log('📦 Creating immediate product notification:', notificationData);
          
          // Add notification immediately
          addNotification(detail.action === 'created' ? 'product_created' : 'product_updated', notificationData, userRole);
        }
      }
    };

    const handleReturnUpdate = (event) => {
      console.log('🔄 Return/refund updated - immediate notification check...', event.detail);
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

          console.log('🔄 Creating immediate return/refund notification:', notificationData);
          
          // Add notification immediately
          const notificationType = detail.action === 'refund' ? 'refund_issued' : 
                                 detail.action === 'rejected' ? 'return_rejected' : 'return_processed';
          addNotification(notificationType, notificationData, userRole);
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
      console.log('📊 Stocks page visited - checking stock notifications...');
      if (isLoaded) {
        checkStockNotifications();
      }
    };

    window.addEventListener('stocksPageVisited', handleStocksPageVisit);
    
    return () => {
      window.removeEventListener('stocksPageVisited', handleStocksPageVisit);
    };
  }, [checkStockNotifications, isLoaded]);

  // ✅ ENHANCED: Listen for expenses page visits with better logging
  useEffect(() => {
    const handleExpensesPageVisit = () => {
      console.log(`💰 Expenses page visited - checking expense notifications with threshold ₱${largeExpenseThreshold.toLocaleString()}...`);
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (['admin', 'supervisor'].includes(userRole) && warehouseId) {
          checkExpenseNotifications(warehouseId, userRole, processedIdsRef.current);
        } else {
          console.log(`💰 Skipping expense check - Role: ${userRole}, Warehouse: ${warehouseId}`);
        }
      }
    };

    window.addEventListener('expensesPageVisited', handleExpensesPageVisit);
    
    return () => {
      window.removeEventListener('expensesPageVisited', handleExpensesPageVisit);
    };
  }, [checkExpenseNotifications, isLoaded, getCurrentUser, getCurrentWarehouse, largeExpenseThreshold]);

  // ✅ NEW: Listen for supplier page visits
  useEffect(() => {
    const handleSuppliersPageVisit = () => {
      console.log('🏢 Suppliers page visited - checking supplier notifications...');
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (['admin', 'supervisor'].includes(userRole) && warehouseId) {
          checkSupplierNotifications(warehouseId, userRole, processedIdsRef.current);
        } else {
          console.log(`🏢 Skipping supplier check - Role: ${userRole}, Warehouse: ${warehouseId}`);
        }
      }
    };

    window.addEventListener('suppliersPageVisited', handleSuppliersPageVisit);
    
    return () => {
      window.removeEventListener('suppliersPageVisited', handleSuppliersPageVisit);
    };
  }, [checkSupplierNotifications, isLoaded, getCurrentUser, getCurrentWarehouse]);

  // ✅ NEW: Listen for admin settings page visits
  useEffect(() => {
    const handleAdminPageVisit = () => {
      console.log('🔐 Admin settings page visited - checking system notifications...');
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (userRole === 'admin' && warehouseId) {
          checkSystemNotifications(warehouseId, userRole, processedIdsRef.current);
        } else {
          console.log(`🔐 Skipping system check - Role: ${userRole}, Warehouse: ${warehouseId}`);
        }
      }
    };

    window.addEventListener('adminPageVisited', handleAdminPageVisit);
    window.addEventListener('settingsPageVisited', handleAdminPageVisit);
    window.addEventListener('userManagementPageVisited', handleAdminPageVisit);
    window.addEventListener('rolesPageVisited', handleAdminPageVisit); // ✅ NEW: Also listen for roles page
    
    return () => {
      window.removeEventListener('adminPageVisited', handleAdminPageVisit);
      window.removeEventListener('settingsPageVisited', handleAdminPageVisit);
      window.removeEventListener('userManagementPageVisited', handleAdminPageVisit);
      window.removeEventListener('rolesPageVisited', handleAdminPageVisit);
    };
  }, [checkSystemNotifications, isLoaded, getCurrentUser, getCurrentWarehouse]);

  // ✅ NEW: Listen for products page visits
  useEffect(() => {
    const handleProductsPageVisit = () => {
      console.log('📦 Products page visited - checking product notifications...');
      if (isLoaded) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const warehouseId = getCurrentWarehouse();
        
        if (userRole === 'admin' && warehouseId) {
          checkProductsAndReturnsNotifications(warehouseId, userRole, processedIdsRef.current);
        } else {
          console.log(`📦 Skipping products check - Role: ${userRole}, Warehouse: ${warehouseId}`);
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
        console.log(`🏢 Warehouse changed from ${currentWarehouseId} to ${newWarehouseId}`);
        setCurrentWarehouseId(newWarehouseId);
        
        if (isLoaded) {
          setTimeout(() => checkNotificationsOnAction(), 1000);
        }
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    setCurrentWarehouseId(getCurrentWarehouse());

    return () => {
      window.removeEventListener('warehouseChanged', handleWarehouseChange);
    };
  }, [getCurrentWarehouse, currentWarehouseId, checkNotificationsOnAction, isLoaded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
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
  }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Action handlers
  const markAllAsRead = () => {
    const currentWarehouseNotifications = notifications.filter(notif => {
      if (notif.data?.warehouse_id) {
        return notif.data.warehouse_id === currentWarehouseId;
      }
      return true;
    });

    currentWarehouseNotifications.forEach(notification => {
      if (!notification.is_read) {
        dispatch({ type: 'MARK_AS_READ', payload: notification.id });
      }
    });

    setShowOptionsMenu(false);
  };

  const clearAllNotifications = () => {
    const currentWarehouseNotifications = notifications.filter(notif => {
      if (notif.data?.warehouse_id) {
        return notif.data.warehouse_id === currentWarehouseId;
      }
      return true;
    });

    currentWarehouseNotifications.forEach(notification => {
      if (notification.data) {
        const processedId = `${notification.type}-${notification.data.id}-${notification.data.warehouse_id || currentWarehouseId}`;
        processedIdsRef.current.add(processedId);
      }
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
    });

    localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIdsRef.current]));
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
      // ✅ System & Role Accessibility notification icons
      'role_updated': faUserTie,
      'menu_access_changed': faCog,
      'admin_settings_changed': faCog,
      // ✅ NEW: Product Management notification icons
      'product_created': faBoxes,
      'product_updated': faEdit,
      'product_deleted': faTrash,
      // ✅ NEW: Returns/Refunds notification icons
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

  // Filter notifications by current warehouse and calculate unread count properly
  const filteredNotifications = (activeTab === 'all' 
    ? notifications 
    : notifications.filter(notif => !notif.is_read))
    .filter(notif => {
      if (notif.data?.warehouse_id) {
        return notif.data.warehouse_id === currentWarehouseId;
      }
      return true;
    });

  // Calculate unread count for current warehouse only
  const currentWarehouseUnreadCount = notifications.filter(notif => {
    if (notif.data?.warehouse_id) {
      return notif.data.warehouse_id === currentWarehouseId && !notif.is_read;
    }
    return !notif.is_read;
  }).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white hover:text-gray-300 focus:outline-none transition-colors"
        title={`${currentWarehouseUnreadCount} unread notifications`}
      >
        <FontAwesomeIcon icon={faBell} className="text-lg" />
        {currentWarehouseUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
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
                  <div className="mt-1 break-words">
                    Stock • Expenses (₱{largeExpenseThreshold.toLocaleString()}) • Suppliers
                  </div>
                  <div className="break-words">
                    Van Load • Products • Returns • System • {isLoaded ? 'Active' : 'Loading...'}
                  </div>
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
                  Please wait while we check for stock alerts, expenses (₱{largeExpenseThreshold.toLocaleString()}+ flagged), suppliers, Van Load operations, products, returns, and system & role changes.
                </p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faBell} className="text-2xl text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                  No Notification Here
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  There is no notification to show right now.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
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
                        
                        {/* ✅ CLEANED: Only blue dot indicator remains */}
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
  );
};

export default Notification;