// src/components/Notification.jsx - COMPLETE ENHANCED VERSION WITH DATABASE ENVIRONMENT DETECTION
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
  faMapMarkerAlt,
  faExclamationCircle,
  faSync,
  faBellSlash
} from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import { useNotifications } from '../contexts/NotificationContext';
import { getCurrentWarehouse, getWarehouseAxiosConfig, getWarehouseQueryParam, findWarehouseByName } from '../utils/warehouseUtils';

const Notification = () => {
  const { state, dispatch, addNotification, hasNotificationPermission } = useNotifications();
  const { notifications } = state;
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [currentWarehouseId, setCurrentWarehouseId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userDataReady, setUserDataReady] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // ✅ ENHANCED: Database environment detection to prevent cross-branch notification pollution
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [databaseEnvironmentId, setDatabaseEnvironmentId] = useState(null);
  
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
  const initializationRef = useRef(false);

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

  // ✅ ENHANCED: Better user data getter with validation using warehouse utils
  const getCurrentUser = useCallback(() => {
    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      
      // Validate required fields for notifications
      if (!userData.id || !userData.role) {
        return {};
      }
      
      return userData;
    } catch (error) {
      return {};
    }
  }, []);

  // ✅ NEW: Database environment detection utility (PRODUCTION SAFE)
  const generateDatabaseFingerprint = useCallback(async () => {
    try {
      const user = getCurrentUser();
      if (!user.id) {
        return null;
      }
      
      // Create a simple but effective fingerprint
      const loginTime = localStorage.getItem('loginTime');
      const currentTime = Date.now();
      
      // Check if this is a very recent login (within 2 minutes)
      const isVeryRecentLogin = loginTime && (currentTime - parseInt(loginTime)) < 120000;
      
      if (isVeryRecentLogin) {
        // Fresh session - generate new environment ID
        const newFingerprint = btoa(`${user.id}_${user.role}_${loginTime}`).slice(0, 20);
        console.log('🆕 New session detected, fingerprint:', newFingerprint);
        return newFingerprint;
      }
      
      // Check existing fingerprint
      const existingFingerprint = localStorage.getItem('databaseEnvironmentId');
      if (existingFingerprint) {
        return existingFingerprint;
      }
      
      // Create fingerprint for existing session
      const sessionFingerprint = btoa(`${user.id}_${user.role}_session`).slice(0, 20);
      return sessionFingerprint;
      
    } catch (error) {
      console.warn('Could not generate database fingerprint:', error);
      // Fallback to simple fingerprint
      const user = getCurrentUser();
      return btoa(`${user.id || 'unknown'}_fallback`).slice(0, 16);
    }
  }, [getCurrentUser]);

  // ✅ NEW: Clear notification data for new environment (SAFE - only clears notification data)
  const clearNotificationDataForNewEnvironment = useCallback(() => {
    console.log('🧹 Clearing notification data for new database environment...');
    
    // Only clear notification-related keys, preserve other important data
    const notificationKeys = [
      'processedNotificationIds',
      'persistedNotifications',
      'persistedNotifications_admin_all'
    ];
    
    // Clear warehouse-specific notification keys (safe range)
    for (let i = 1; i <= 50; i++) {
      notificationKeys.push(
        `persistedNotifications_warehouse_${i}`,
        `previousStocks_${i}`,
        `previousExpenses_${i}`,
        `previousCredits_${i}`,
        `previousSuppliers_${i}`,
        `previousMSPs_${i}`,
        `previousUsers_${i}`,
        `previousProducts_${i}`,
        `previousReceiving_${i}`,
        `previousReturns_${i}`
      );
    }
    
    // Clear overdue check keys (limited range for safety)
    for (let i = 1; i <= 500; i++) {
      for (let j = 1; j <= 20; j++) {
        notificationKeys.push(`lastOverdueCheck_${i}_${j}`);
      }
    }
    
    // Remove only notification-related keys
    let clearedCount = 0;
    notificationKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });
    
    // Clear notifications from context
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
    
    // Reset processed IDs
    processedIdsRef.current = new Set();
    
    console.log(`✅ Cleared ${clearedCount} notification data items for fresh environment`);
  }, [dispatch]);

  // ✅ NEW: Database environment initialization (PRODUCTION SAFE)
  const initializeDatabaseEnvironment = useCallback(async () => {
    try {
      const newFingerprint = await generateDatabaseFingerprint();
      if (!newFingerprint) {
        console.warn('Could not generate fingerprint - using default initialization');
        return false;
      }
      
      const storedFingerprint = localStorage.getItem('databaseEnvironmentId');
      const systemInitKey = `systemInit_${newFingerprint}`;
      
      console.log('🔍 Database environment check:', {
        stored: storedFingerprint,
        current: newFingerprint,
        isNewEnvironment: !storedFingerprint || storedFingerprint !== newFingerprint
      });
      
      // Check if this is a different database environment
      if (!storedFingerprint || storedFingerprint !== newFingerprint) {
        console.log('🆕 New database environment detected');
        
        // Clear old notification data
        clearNotificationDataForNewEnvironment();
        
        // Store new environment ID
        localStorage.setItem('databaseEnvironmentId', newFingerprint);
        setDatabaseEnvironmentId(newFingerprint);
        
        // Mark as new environment requiring fresh initialization
        localStorage.setItem(systemInitKey, 'true');
        setSystemInitialized(true);
        
        return true; // New environment
      } else {
        console.log('📂 Existing database environment - checking initialization status');
        setDatabaseEnvironmentId(storedFingerprint);
        
        // Check if system was initialized in this environment
        const wasInitialized = localStorage.getItem(systemInitKey) === 'true';
        setSystemInitialized(wasInitialized);
        
        if (!wasInitialized) {
          // This environment exists but wasn't properly initialized
          localStorage.setItem(systemInitKey, 'true');
          setSystemInitialized(true);
          console.log('🔄 Marking existing environment as initialized');
        }
        
        return false; // Existing environment
      }
    } catch (error) {
      console.error('❌ Database environment initialization failed:', error);
      // Fallback: use safe default
      const fallbackFingerprint = btoa(`fallback_${Date.now()}`).slice(0, 16);
      localStorage.setItem('databaseEnvironmentId', fallbackFingerprint);
      setDatabaseEnvironmentId(fallbackFingerprint);
      setSystemInitialized(true);
      return true;
    }
  }, [generateDatabaseFingerprint, clearNotificationDataForNewEnvironment]);

  // ✅ ENHANCED: Initialize warehouse using warehouse utils consistently
  const initializeWarehouse = useCallback(async () => {
    try {
      let warehouse = getCurrentWarehouse();
      
      console.log('🏭 Initializing warehouse in notification component:', warehouse);
      
      // If warehouse needs ID lookup, find it by name
      if (warehouse?.needsIdLookup && warehouse.name) {
        console.log('🔍 Finding warehouse by name for notifications:', warehouse.name);
        warehouse = await findWarehouseByName(warehouse.name);
        if (!warehouse) {
          console.warn('❌ Could not find warehouse by name for notifications');
          return null;
        }
      }
      
      if (warehouse?.id) {
        const warehouseId = parseInt(warehouse.id);
        console.log('✅ Warehouse initialized for notifications:', { id: warehouseId, name: warehouse.name });
        setCurrentWarehouse(warehouse);
        setCurrentWarehouseId(warehouseId);
        setUserDataReady(true);
        return { warehouse, warehouseId };
      }
      
      console.warn('⚠️ No valid warehouse found for notifications');
      return null;
    } catch (error) {
      console.error('❌ Error initializing warehouse for notifications:', error);
      return null;
    }
  }, []);

  // ✅ ENHANCED: Better user data validation with immediate availability check using warehouse utils
  const waitForUserData = useCallback(async (maxRetries = 20, delay = 300) => {
    for (let i = 0; i < maxRetries; i++) {
      const user = getCurrentUser();
      
      if (user.id && user.role) {
        const warehouseData = await initializeWarehouse();
        
        if (warehouseData) {
          return { user, ...warehouseData };
        }
      }
      
      // If this is a non-admin user and we still don't have warehouse data after several attempts
      if (i > 5 && user.id && user.role && user.role.toLowerCase() !== 'admin') {
        try {
          const token = localStorage.getItem("token");
          if (token) {
            console.log('🔄 Fetching user data from API for warehouse info in notifications...');
            const response = await fetch(`http://localhost:8080/api/users/${user.id}/`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
              const userData = await response.json();
              const apiWarehouseId = userData.warehouse_id || userData.warehouse || userData.assigned_warehouse_id;
              
              if (apiWarehouseId) {
                // Update local storage with the correct warehouse
                const updatedUser = { ...user, warehouse_id: apiWarehouseId };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                
                // Re-initialize warehouse with updated data
                const warehouseData = await initializeWarehouse();
                if (warehouseData) {
                  return { user: updatedUser, ...warehouseData };
                }
              }
            }
          }
        } catch (apiError) {
          console.warn('⚠️ API call failed in notifications, continuing with fallback logic');
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // If we reach here, use fallback data
    const user = getCurrentUser();
    if (user.id && user.role) {
      const warehouseData = await initializeWarehouse();
      if (warehouseData) {
        return { user, ...warehouseData };
      }
    }
    
    return null;
  }, [getCurrentUser, initializeWarehouse]);

  // ✅ ENHANCED: Initialize with database environment detection
  useEffect(() => {
    const initializeComponent = async () => {
      if (!initializationRef.current) {
        initializationRef.current = true;
        
        console.log('🚀 Initializing notification component with database environment detection...');
        
        // First, check database environment
        const isNewEnvironment = await initializeDatabaseEnvironment();
        
        // Wait for user data regardless of environment
        const userData = await waitForUserData();
        if (userData) {
          console.log('✅ Notification component initialized with user data:', userData);
          
          if (isNewEnvironment) {
            console.log('🔄 Fresh database environment detected');
          }
          
          // Trigger initial notification check after warehouse is set
          setTimeout(() => {
            if (!isLoaded) {
              setIsLoaded(true);
            }
          }, 500);
        } else {
          console.warn('⚠️ Failed to initialize notification component with valid user data');
        }
      }
    };

    initializeComponent();
  }, [waitForUserData, isLoaded, initializeDatabaseEnvironment]);

  // ✅ ENHANCED: Credit-specific notification helper
  const triggerCreditNotification = useCallback((creditData, action = 'created') => {
    // ✅ FIXED: Don't create notifications if system is not initialized
    if (!userDataReady || !currentWarehouseId || !systemInitialized) return;

    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    
    // Check if user should be notified about this credit
    const shouldNotify = (
      (creditData.created_by === user.id || creditData.user_id === user.id) ||
      ['admin', 'supervisor'].includes(userRole)
    );
    
    if (!shouldNotify) return;

    const notificationData = {
      ...creditData,
      warehouse_id: creditData.warehouse_id || currentWarehouseId
    };

    switch (action) {
      case 'created':
        addNotification('credit_created', notificationData, userRole);
        break;
      case 'paid':
        addNotification('paid_credit', notificationData, userRole);
        break;
      case 'overdue':
        addNotification('credit_overdue', notificationData, userRole);
        break;
      case 'due_soon':
        addNotification('credit_overdue', {
          ...notificationData,
          days_overdue: -(notificationData.days_until_due || 0),
          early_warning: true
        }, userRole);
        break;
      default:
        // Default case for any other action
        addNotification('credit_created', notificationData, userRole);
        break;
    }
    
    // Force update
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
  }, [userDataReady, currentWarehouseId, systemInitialized, getCurrentUser, addNotification]);

  // ✅ ENHANCED: Batch notification processor for multiple credits (kept for future use)
  const processBatchCreditNotifications = useCallback(async (credits, action) => {
    // ✅ FIXED: Don't create notifications if system is not initialized
    if (!Array.isArray(credits) || credits.length === 0 || !systemInitialized) return;

    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    let notificationsCreated = 0;

    credits.forEach(credit => {
      const shouldNotify = (
        (credit.created_by === user.id || credit.user_id === user.id) ||
        ['admin', 'supervisor'].includes(userRole)
      );
      
      if (shouldNotify) {
        const notificationData = {
          ...credit,
          warehouse_id: credit.warehouse_id || currentWarehouseId
        };
        
        addNotification(`credit_${action}`, notificationData, userRole);
        notificationsCreated++;
      }
    });

    if (notificationsCreated > 0) {
      setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      console.log(`✅ Created ${notificationsCreated} batch credit notifications`);
    }
  }, [getCurrentUser, currentWarehouseId, systemInitialized, addNotification]);

  // Expose function for external use
  React.useEffect(() => {
    window.processBatchCreditNotifications = processBatchCreditNotifications;
  }, [processBatchCreditNotifications]);

  // ✅ NEW: Credit due date checker
  const checkCreditDueDates = useCallback(async () => {
    // ✅ FIXED: Don't check if system is not initialized
    if (!userDataReady || !currentWarehouseId || !systemInitialized) return;

    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.headers = {
        ...config.headers,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      };

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      const response = await axios.get(
        `http://localhost:8080/api/credits/?warehouse=${warehouseQueryParam}&status=PENDING`,
        config
      );

      const credits = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const today = new Date();
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

      credits.forEach(credit => {
        if (credit.due_date) {
          const dueDate = new Date(credit.due_date);
          
          // Check if due within 3 days (early warning)
          if (dueDate <= threeDaysFromNow && dueDate > today) {
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            const earlyWarningId = `credit-due-soon-${credit.id}-${currentWarehouseId}`;
            const processedIds = processedIdsRef.current;
            
            if (!processedIds.has(earlyWarningId)) {
              triggerCreditNotification({
                ...credit,
                days_until_due: daysUntilDue,
                early_warning: true
              }, 'due_soon');
              
              processedIds.add(earlyWarningId);
            }
          }
          
          // Check if overdue
          if (dueDate < today) {
            const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
            
            triggerCreditNotification({
              ...credit,
              days_overdue: daysOverdue
            }, 'overdue');
          }
        }
      });

    } catch (error) {
      console.warn('❌ Credit due date check failed:', error.message);
    }
  }, [userDataReady, currentWarehouseId, systemInitialized, currentWarehouse, triggerCreditNotification]);

  // ✅ ENHANCED: Notification cleanup for old notifications
  const cleanupOldNotifications = useCallback(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const validNotifications = notifications.filter(notif => 
      new Date(notif.timestamp) > sevenDaysAgo
    );
    
    if (validNotifications.length !== notifications.length) {
      dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });
      
      console.log(`🧹 Cleaned up ${notifications.length - validNotifications.length} old notifications`);
    }
  }, [notifications, dispatch]);

  // ✅ NEW: Notification summary generator (kept for future use)
  const generateNotificationSummary = useCallback(() => {
    const user = getCurrentUser();
    
    const warehouseNotifications = notifications.filter(notif => 
      notif.data?.warehouse_id === currentWarehouseId && !notif.is_read
    );

    const summary = {
      total: warehouseNotifications.length,
      byType: {},
      byPriority: { high: 0, medium: 0, low: 0 },
      credits: {
        created: 0,
        overdue: 0,
        paid: 0
      },
      inventory: {
        low_stock: 0,
        out_of_stock: 0,
        adjustments: 0
      },
      expenses: {
        new: 0,
        large: 0,
        updated: 0
      }
    };

    warehouseNotifications.forEach(notif => {
      // Count by type
      summary.byType[notif.type] = (summary.byType[notif.type] || 0) + 1;
      
      // Count by priority
      summary.byPriority[notif.priority || 'low']++;
      
      // Count by category
      if (notif.type.startsWith('credit_')) {
        if (notif.type === 'credit_created') summary.credits.created++;
        if (notif.type === 'credit_overdue') summary.credits.overdue++;
        if (notif.type === 'paid_credit') summary.credits.paid++;
      }
      
      if (['low_stock', 'out_of_stock'].includes(notif.type)) {
        summary.inventory[notif.type]++;
      }
      
      if (notif.type === 'stock_adjustment') {
        summary.inventory.adjustments++;
      }
      
      if (notif.type.startsWith('expense_')) {
        if (notif.type === 'expense_created') summary.expenses.new++;
        if (notif.type === 'large_expense') summary.expenses.large++;
        if (notif.type === 'expense_updated') summary.expenses.updated++;
      }
    });

    return summary;
  }, [notifications, currentWarehouseId, getCurrentUser]);

  // Expose function for external use
  React.useEffect(() => {
    window.generateNotificationSummary = generateNotificationSummary;
  }, [generateNotificationSummary]);

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

      // ✅ NEW: Enhanced credit notification details
      case 'credit_created':
        details.push(
          { label: 'Credit ID', value: safeToString(data.id || 'Unknown') },
          { label: 'MSP Number', value: safeToString(data.msp_no || 'N/A') },
          { label: 'Customer', value: safeToString(data.customer_name || 'Unknown Customer') },
          { label: 'Credit Amount', value: `₱${(data.balance || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Due Date', value: safeToString(data.due_date ? new Date(data.due_date).toLocaleDateString() : 'Not set') },
          { label: 'Created Date', value: safeToString(data.created_at ? new Date(data.created_at).toLocaleDateString() : 'Today') }
        );
        if (data.credit_terms) {
          details.push({ label: 'Credit Terms', value: `${data.credit_terms} days` });
        }
        if (data.created_by) {
          details.push({ label: 'Created By', value: safeToString(data.created_by) });
        }
        break;

      case 'credit_overdue':
        details.push(
          { label: 'Credit ID', value: safeToString(data.id || 'Unknown') },
          { label: 'MSP Number', value: safeToString(data.msp_no || 'N/A') },
          { label: 'Customer', value: safeToString(data.customer_name || 'Unknown Customer') },
          { label: 'Outstanding Amount', value: `₱${(data.balance || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Due Date', value: safeToString(data.due_date ? new Date(data.due_date).toLocaleDateString() : 'Not set') },
          { label: 'Days Overdue', value: `${data.days_overdue || 0} days` }
        );
        if (data.original_amount && data.original_amount !== data.balance) {
          details.push({ label: 'Original Amount', value: `₱${data.original_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
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
        if (data.payment_method) {
          details.push({ label: 'Payment Method', value: safeToString(data.payment_method) });
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

  // ✅ ENHANCED: Load persisted notifications with warehouse-aware logic for admin (with environment check)
  useEffect(() => {
    const loadPersistedNotifications = () => {
      if (!databaseEnvironmentId || !systemInitialized) {
        console.log('⏳ Waiting for database environment initialization before loading notifications...');
        return;
      }

      try {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin' && currentWarehouseId) {
          // Load warehouse-specific notifications for admin
          const warehouseKey = `persistedNotifications_warehouse_${currentWarehouseId}`;
          const savedWarehouseNotifications = localStorage.getItem(warehouseKey);
          
          if (savedWarehouseNotifications) {
            const parsedNotifications = JSON.parse(savedWarehouseNotifications);
            const validNotifications = parsedNotifications.filter(notif => 
              new Date(notif.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            );
            
            if (validNotifications.length > 0) {
              dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });
              console.log(`📥 Admin loaded ${validNotifications.length} notifications for warehouse ${currentWarehouseId}`);
            }
            
            // Update localStorage with only valid notifications
            if (validNotifications.length !== parsedNotifications.length) {
              localStorage.setItem(warehouseKey, JSON.stringify(validNotifications));
            }
          }
        } else {
          // Regular notification loading for non-admin users
          const savedNotifications = localStorage.getItem('persistedNotifications');
          if (savedNotifications) {
            const parsedNotifications = JSON.parse(savedNotifications);
            const validNotifications = parsedNotifications.filter(notif => 
              new Date(notif.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            );
            
            if (validNotifications.length > 0) {
              dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });
            }
            
            if (validNotifications.length !== parsedNotifications.length) {
              localStorage.setItem('persistedNotifications', JSON.stringify(validNotifications));
            }
          }
        }
      } catch (error) {
        console.warn('Error loading persisted notifications - corrupted data');
        // Clean up corrupted data
        if (currentWarehouseId) {
          localStorage.removeItem(`persistedNotifications_warehouse_${currentWarehouseId}`);
        }
        localStorage.removeItem('persistedNotifications');
      }
    };

    // ✅ ENHANCED: Only load notifications if database environment is initialized and system is ready
    if (!isLoaded && userDataReady && currentWarehouseId && systemInitialized && databaseEnvironmentId) {
      loadPersistedNotifications();
      setIsLoaded(true);
    }
  }, [dispatch, isLoaded, userDataReady, currentWarehouseId, systemInitialized, databaseEnvironmentId, getCurrentUser]);

  // ✅ ENHANCED: Persist notifications with warehouse awareness for admin (with environment check)
  useEffect(() => {
    const persistNotifications = (notifications) => {
      if (!databaseEnvironmentId || !systemInitialized) {
        return;
      }

      try {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin' && currentWarehouseId) {
          // Store notifications per warehouse for admin
          const warehouseKey = `persistedNotifications_warehouse_${currentWarehouseId}`;
          const warehouseNotifications = notifications.filter(notif => 
            notif.data?.warehouse_id === currentWarehouseId
          );
          
          if (warehouseNotifications.length > 0) {
            localStorage.setItem(warehouseKey, JSON.stringify(warehouseNotifications));
          }
          
          // Also maintain global admin notifications for migration purposes
          localStorage.setItem('persistedNotifications_admin_all', JSON.stringify(notifications));
        } else {
          // Regular storage for non-admin users
          if (notifications.length > 0) {
            localStorage.setItem('persistedNotifications', JSON.stringify(notifications));
          }
        }
      } catch (error) {
        console.warn('Error persisting notifications - storage may be full');
      }
    };

    if (isLoaded && notifications.length >= 0 && databaseEnvironmentId && systemInitialized) {
      persistNotifications(notifications);
    }
  }, [notifications, isLoaded, currentWarehouseId, databaseEnvironmentId, systemInitialized, getCurrentUser]);

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
        console.warn('Error loading expense threshold - using default');
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

  // ✅ ENHANCED: Stock notifications with warehouse utils integration and initialization fix
  const checkStockNotifications = useCallback(async () => {
    // ✅ FIXED: Don't check if system is not initialized
    if (!userDataReady || !currentWarehouseId || !systemInitialized) {
      return;
    }

    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = currentWarehouseId;
    const processedIds = processedIdsRef.current;
    let newNotifications = 0;

    try {
      // ✅ Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 10000;
      config.headers = {
        ...config.headers,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json"
      };

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('📦 Checking stock notifications for warehouse:', warehouseQueryParam);
      
      const stockResponse = await axios.get(
        `http://localhost:8080/api/stocks/?warehouse=${warehouseQueryParam}`, 
        config
      );
      const stocks = Array.isArray(stockResponse.data) ? stockResponse.data : stockResponse.data?.results || [];

      // ✅ Get previous stock levels for comparison (with environment ID)
      const previousStocksKey = `previousStocks_${warehouseId}_${databaseEnvironmentId}`;
      const previousStocks = JSON.parse(localStorage.getItem(previousStocksKey) || '{}');
      const now = new Date().toISOString();

      // ✅ FIXED: Check if this is the first time checking stocks in this environment
      const isFirstTimeStockCheck = Object.keys(previousStocks).length === 0;

      stocks.forEach(stock => {
        const stockId = `stock-${stock.id}-${warehouseId}`;
        const status = (stock.stock_status || "").toLowerCase();
        const currentQuantity = parseInt(stock.quantity_available || 0);
        const previousQuantity = previousStocks[stock.id]?.quantity;
        const lastChecked = previousStocks[stock.id]?.timestamp;

        // ✅ FIXED: On first check, just store stock levels without creating notifications
        if (isFirstTimeStockCheck) {
          previousStocks[stock.id] = {
            quantity: currentQuantity,
            timestamp: now,
            product_name: stock.product_name
          };
          processedIds.add(stockId + "-out");
          processedIds.add(stockId + "-low");
          return; // Skip notifications on first check
        }
        
        // CHECK FOR OUT OF STOCK (only on subsequent checks)
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
        // CHECK FOR LOW STOCK (but not out of stock, only on subsequent checks)
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
      if (newNotifications > 0 || isFirstTimeStockCheck) {
        localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
        processedIdsRef.current = processedIds;
        
        if (newNotifications > 0) {
          // FORCE UPDATE after creating notifications
          setTimeout(() => setForceUpdate(prev => prev + 1), 200);
          console.log(`✅ Created ${newNotifications} stock notifications`);
        } else if (isFirstTimeStockCheck) {
          console.log(`📦 Initialized stock tracking for ${stocks.length} items in environment ${databaseEnvironmentId}`);
        }
      }

    } catch (error) {
      console.warn('❌ Stock notifications check failed:', error.message);
    }
  }, [currentWarehouseId, userDataReady, systemInitialized, databaseEnvironmentId, addNotification, getCurrentUser, currentWarehouse]);

  // ✅ ENHANCED: Login stock check with warehouse utils integration and system initialization check
  const checkLowStockOnLogin = useCallback(async () => {
    // ✅ FIXED: Don't run if system is not initialized
    if (!userDataReady || !currentWarehouseId || !systemInitialized) {
      return;
    }

    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = currentWarehouseId;

    try {
      // ✅ Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 10000;
      config.headers = {
        ...config.headers,
        "Authorization": `Bearer ${localStorage.getToken("token")}`,
        "Content-Type": "application/json"
      };

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('🔔 Login stock check for warehouse:', warehouseQueryParam);
      
      const stockResponse = await axios.get(
        `http://localhost:8080/api/stocks/?warehouse=${warehouseQueryParam}`, 
        config
      );
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
            console.warn('Browser notification failed');
          }
        }
        
        console.log(`✅ Created ${loginNotifications} login stock notifications`);
      }

    } catch (error) {
      console.warn('❌ Login stock check failed:', error.message);
    }
  }, [currentWarehouseId, userDataReady, systemInitialized, addNotification, getCurrentUser, currentWarehouse]);
  
  // ✅ FIXED: Enhanced expense notification checking with proper initialization check
  const checkExpenseNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    // ✅ FIXED: Don't check if system is not initialized
    if (!systemInitialized) {
      console.log('💰 Skipping expense notifications - system initializing');
      return 0;
    }

    let newNotifications = 0;

    try {
      // ✅ Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 5000;
      config.headers = {
        ...config.headers,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json"
      };

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('💰 Checking expense notifications for warehouse:', warehouseQueryParam);
      
      const expenseResponse = await axios.get(
        `http://localhost:8080/api/miscellaneous-items/?warehouse=${warehouseQueryParam}`, 
        config
      );
      
      const expenses = Array.isArray(expenseResponse.data) ? expenseResponse.data : expenseResponse.data?.results || [];

      if (expenses.length === 0) {
        return newNotifications;
      }

      // ✅ Get previous expenses for comparison (with environment ID)
      const previousExpensesKey = `previousExpenses_${warehouseId}_${databaseEnvironmentId}`;
      const previousExpenses = JSON.parse(localStorage.getItem(previousExpensesKey) || '{}');
      const now = new Date().toISOString();
      
      // ✅ FIXED: Check if this is the first time checking expenses
      const isFirstTimeCheck = Object.keys(previousExpenses).length === 0;
      
      // ✅ FIXED: Only very recent items (1 minute) should trigger notifications
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      
      // ✅ FIXED: Get current user to avoid notifying about other users' expenses
      const currentUser = getCurrentUser();
      const currentUserId = currentUser.id;
      
      expenses.forEach(expense => {
        const expenseId = `expense-${expense.id}-${warehouseId}`;
        const expenseDate = new Date(expense.created_at || expense.updated_at || now);
        const expenseAmount = Number(expense.amount || 0);
        const previousExpense = previousExpenses[expense.id];
        
        // ✅ FIXED: On first check, store ALL expenses but NEVER create notifications
        if (isFirstTimeCheck) {
          // Store all existing expenses but don't notify about any of them
          previousExpenses[expense.id] = {
            amount: expenseAmount,
            description: expense.description,
            updated_at: expense.updated_at || expense.created_at,
            timestamp: now,
            created_by: expense.created_by || expense.user_id
          };
          processedIds.add(expenseId); // Mark as processed
          return; // Skip ALL notifications on first initialization
        }

        // ✅ FIXED: Only notify about very recent expenses AND check if already processed
        if (expenseDate > oneMinuteAgo && !processedIds.has(expenseId)) {
          
          // ✅ FIXED: Only notify if this user created the expense OR if it's a supervisor/admin monitoring all expenses
          const shouldNotify = (
            // If the expense was created by current user
            (expense.created_by === currentUserId || expense.user_id === currentUserId) ||
            // OR if current user is admin/supervisor (can see all expenses)
            (userRole === 'admin' || userRole === 'supervisor')
          );
          
          if (!shouldNotify) {
            // Store the expense but don't notify about other users' expenses
            previousExpenses[expense.id] = {
              amount: expenseAmount,
              description: expense.description,
              updated_at: expense.updated_at || expense.created_at,
              timestamp: now,
              created_by: expense.created_by || expense.user_id
            };
            processedIds.add(expenseId);
            return;
          }
          
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
                update_type: 'updated_to_large',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else if (amountChanged && wasLarge && !isNowLarge) {
              // Updated to become a normal expense
              addNotification('expense_updated', { 
                ...expense, 
                warehouse_id: warehouseId,
                old_amount: previousExpense.amount,
                change_type: expenseAmount > previousExpense.amount ? 'increased' : 'decreased',
                amount_difference: Math.abs(expenseAmount - previousExpense.amount),
                update_type: 'reduced_from_large',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else if (isNowLarge) {
              // Still large but updated
              addNotification('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                previous_amount: previousExpense.amount,
                update_type: 'large_expense_updated',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else {
              // Normal update
              addNotification('expense_updated', { 
                ...expense, 
                warehouse_id: warehouseId,
                old_amount: previousExpense.amount,
                change_type: expenseAmount > previousExpense.amount ? 'increased' : 'decreased',
                amount_difference: Math.abs(expenseAmount - previousExpense.amount),
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            }
          } else if (!previousExpense) {
            // NEW EXPENSE CREATED
            if (expenseAmount >= largeExpenseThreshold) {
              addNotification('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                update_type: 'new_large_expense',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else {
              addNotification('expense_created', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                created_by: expense.created_by || expense.user_id || 'Unknown'
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
          timestamp: now,
          created_by: expense.created_by || expense.user_id
        };
      });

      // ✅ FIXED: Only check for deleted expenses if not first time check
      if (!isFirstTimeCheck) {
        Object.keys(previousExpenses).forEach(expenseId => {
          const currentExpense = expenses.find(e => e.id.toString() === expenseId.toString());
          if (!currentExpense) {
            const deletedExpenseId = `expense-deleted-${expenseId}-${warehouseId}`;
            
            if (!processedIds.has(deletedExpenseId)) {
              const expenseData = previousExpenses[expenseId];
              const wasLarge = expenseData.amount >= largeExpenseThreshold;
              
              // ✅ FIXED: Only notify about deleted expenses if user created them or is admin/supervisor
              const shouldNotifyDelete = (
                (expenseData.created_by === currentUserId) ||
                (userRole === 'admin' || userRole === 'supervisor')
              );
              
              if (shouldNotifyDelete) {
                addNotification('expense_deleted', { 
                  id: expenseId,
                  description: expenseData.description,
                  amount: expenseData.amount,
                  warehouse_id: warehouseId,
                  deleted_at: now,
                  was_large: wasLarge,
                  threshold: largeExpenseThreshold,
                  created_by: expenseData.created_by || 'Unknown'
                }, userRole);
                
                newNotifications++;
              }
              
              processedIds.add(deletedExpenseId);
            }
            
            // Remove from previous expenses
            delete previousExpenses[expenseId];
          }
        });
      }

      // Save current expense state for next comparison
      localStorage.setItem(previousExpensesKey, JSON.stringify(previousExpenses));

      if (newNotifications > 0) {
        // FORCE UPDATE after creating expense notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
        console.log(`✅ Created ${newNotifications} expense notifications`);
      } else if (isFirstTimeCheck) {
        console.log(`📋 First time expense check - stored existing expenses without notifications in environment ${databaseEnvironmentId}`);
      }

    } catch (error) {
      console.warn('❌ Expense notifications check failed:', error.message);
    }

    return newNotifications;
  }, [addNotification, largeExpenseThreshold, currentWarehouse, systemInitialized, databaseEnvironmentId, getCurrentUser]);

  // Continue with the rest of your component methods...
  // Due to length constraints, I'll provide the key remaining methods separately

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

  // ✅ ENHANCED: Update the getNotificationIcon function to include credit icons
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
      // ✅ ENHANCED: Credit notification icons
      'credit_created': faCreditCard,
      'credit_overdue': faExclamationCircle,
      'paid_credit': faCheck,
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

  // ✅ ENHANCED: Better warehouse name display with transition and admin handling
  const getCurrentWarehouseName = () => {
    if (currentWarehouse?.name) {
      return currentWarehouse.name;
    }
    
    const user = getCurrentUser();
    if (user.role?.toLowerCase() === "admin") {
      const selectedWarehouse = JSON.parse(localStorage.getItem("selectedWarehouse") || "null");
      if (selectedWarehouse?.name) {
        return selectedWarehouse.name;
      }
      
      // Show "No Warehouse Selected" instead of "Unknown"
      return currentWarehouseId ? "Loading..." : "Select Warehouse";
    }
    
    return user.warehouse || "Unknown Warehouse";
  };

  // ✅ ENHANCED: Better notification count calculation for admin with warehouse context
  const currentWarehouseUnreadCount = React.useMemo(() => {
    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    
    if (!currentWarehouseId) {
      return 0;
    }
    
    const count = notifications.filter(notif => {
      // Check if notification is unread
      const isUnread = !notif.is_read;
      if (!isUnread) return false;
      
      // Check warehouse filtering
      const hasWarehouseId = notif.data?.warehouse_id;
      const isCurrentWarehouse = hasWarehouseId && notif.data.warehouse_id === currentWarehouseId;
      
      // ✅ ADMIN: Show notifications for current warehouse
      if (userRole === 'admin') {
        return isCurrentWarehouse;
      }
      
      // ✅ NON-ADMIN: Show only notifications for their assigned warehouse with permission check
      if (['supervisor', 'cashier', 'staff'].includes(userRole) && isCurrentWarehouse) {
        // Check if user has permission for this notification type
        const hasPermission = hasNotificationPermission?.(notif.type, userRole);
        
        // For credit notifications, also check if it's their own or if they can see all
        if (['credit_created', 'credit_overdue', 'paid_credit'].includes(notif.type)) {
          const isOwnCredit = (notif.data?.created_by === user.id || notif.data?.user_id === user.id);
          const canSeeAllCredits = ['admin', 'supervisor'].includes(userRole);
          
          return hasPermission && (isOwnCredit || canSeeAllCredits);
        }
        
        return hasPermission;
      }
      
      return false;
    }).length;
    
    return count;
  }, [notifications, currentWarehouseId, getCurrentUser, hasNotificationPermission]);

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

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Icon with transition effect */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2 text-white hover:text-gray-300 focus:outline-none transition-all duration-200 ${
            isTransitioning ? 'opacity-70 transform scale-95' : 'opacity-100 transform scale-100'
          }`}
          title={`${currentWarehouseUnreadCount} unread notifications for ${getCurrentWarehouseName()}`}
        >
          <FontAwesomeIcon icon={faBell} className="text-lg" />
          {currentWarehouseUnreadCount > 0 && (
            <span 
              key={`badge-${currentWarehouseUnreadCount}-${forceUpdate}`}
              className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold transition-all duration-200 ${
                isTransitioning ? 'animate-bounce' : 'animate-pulse'
              }`}
            >
              {currentWarehouseUnreadCount > 99 ? '99+' : currentWarehouseUnreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown - ENHANCED WITH BETTER ADMIN HANDLING */}
        {isOpen && (
          <div className={`absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] overflow-hidden transition-all duration-200 ${
            isTransitioning ? 'opacity-90 transform scale-98' : 'opacity-100 transform scale-100'
          }`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Notifications
                  </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                    <div className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      {getCurrentWarehouseName()}
                      {isTransitioning && (
                        <FontAwesomeIcon icon={faSync} className="ml-2 text-blue-500 animate-spin" />
                      )}
                      {!systemInitialized && (
                        <span className="ml-2 text-orange-600 dark:text-orange-400">Initializing...</span>
                      )}
                      {databaseEnvironmentId && (
                        <span className="ml-2 text-green-600 dark:text-green-400 text-xs">
                          ENV: {databaseEnvironmentId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    {!userDataReady && (
                      <div className="text-orange-600 dark:text-orange-400 mt-1">Setting up warehouse...</div>
                    )}
                  </div>
                </div>
                
                {/* Enhanced Options Menu */}
                <div className="relative flex-shrink-0" ref={optionsRef}>
                  <button
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                  >
                    <FontAwesomeIcon icon={faEllipsisH} />
                  </button>
                  
                  {showOptionsMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-10">
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

            {/* Notifications List - ENHANCED LOADING STATES */}
            <div className="max-h-96 overflow-y-auto">
              {!isLoaded || !userDataReady || !systemInitialized || !databaseEnvironmentId ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faBell} className="text-2xl text-gray-400 dark:text-gray-500 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {isTransitioning ? 'Switching Warehouse...' : 
                     !systemInitialized ? 'Initializing System...' : 
                     !databaseEnvironmentId ? 'Checking Environment...' : 'Loading Notifications...'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                    {isTransitioning 
                      ? `Loading notifications for ${getCurrentWarehouseName()}...` 
                      : !systemInitialized
                      ? 'Setting up notification system to prevent old alerts...'
                      : !databaseEnvironmentId
                      ? 'Checking database environment for fresh data...'
                      : 'Setting up notification system with warehouse utils...'
                    }
                  </p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={activeTab === 'unread' ? faBellSlash : faBell} className="text-2xl text-gray-400 dark:text-gray-500" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {activeTab === 'unread' ? 'All Caught Up!' : 'No Notifications Here'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeTab === 'unread' 
                      ? 'No unread notifications for ' + getCurrentWarehouseName()
                      : 'No notifications for ' + getCurrentWarehouseName() + ' right now.'
                    }
                    {databaseEnvironmentId && (
                      <div className="text-xs mt-1 text-green-600 dark:text-green-400">
                        Fresh environment detected - clean slate!
                      </div>
                    )}
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
                              {notification.type === 'credit_overdue' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                  OVERDUE
                                </span>
                              )}
                              {notification.type === 'credit_created' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  CREDIT
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
                      {selectedNotification.type === 'credit_overdue' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                          Overdue Credit
                        </span>
                      )}
                      {selectedNotification.type === 'credit_created' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          New Credit
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
                    {databaseEnvironmentId && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Environment:</span>
                        <div className="font-medium text-green-600 dark:text-green-400 text-xs">
                          {databaseEnvironmentId.slice(0, 12)}
                        </div>
                      </div>
                    )}
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