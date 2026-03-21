// src/components/Notification.jsx - COMPLETE FIXED VERSION WITH BACKEND INTEGRATION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  faClock,
  faDownload,
  faSync,
  faBellSlash
} from "@fortawesome/free-solid-svg-icons";
import api from '../api'; // Using centralized API instance
import { useNotifications } from '../contexts/NotificationContext';
import { getCurrentWarehouse, getWarehouseAxiosConfig, getWarehouseQueryParam, findWarehouseByName } from '../utils/warehouseUtils';
import { getStockThresholds, calculateStockStatus } from '../utils/stockThresholds';

// NEW: Backend notification API helper functions
const NotificationAPI = {
  async createNotification(notificationType, data, userRole, warehouseId, config) {
    try {
      const response = await api.post('/notifications/create/', {
        notification_type: notificationType,
        data: data,
        user_role: userRole,
        warehouse_id: warehouseId
      }, config);
      return response.data;
    } catch (error) {
      console.warn('Failed to create notification in backend:', error.message);
      return null;
    }
  },

  async loadNotifications(warehouseParam, config) {
    const response = await api.get(`/notifications/?warehouse=${warehouseParam}`, config);
    return Array.isArray(response.data) ? response.data : response.data?.results || [];
  },

  async markAsRead(notificationId, config) {
    await api.post(`/notifications/${notificationId}/mark_read/`, {}, config);
  },

  async markAllAsRead(warehouseId, config) {
    await api.post('/notifications/mark_all_read/', { warehouse_id: warehouseId }, config);
  },

  async clearAll(warehouseId, config) {
    await api.post('/notifications/clear_all/', { warehouse_id: warehouseId }, config);
  },

    async loadVanLoadEditRequests(warehouseId, adminId, config) {
    const response = await api.get('/van-load-edit-requests/pending/', {
      ...config,
      params: {
        warehouse_id: warehouseId,
        admin_id: adminId,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async decideVanLoadEditRequest(requestId, action, adminId, reviewNotes = '', config) {
    const response = await api.post(
      `/van-load-edit-requests/${requestId}/decision/`,
      {
        action,
        admin_id: adminId,
        review_notes: reviewNotes,
      },
      config
    );
    return response.data;
  }
};

const isVanLoadEditApprovalNotification = (notification) => {
  if (!notification) return false;
  const type = String(notification.type || '').toLowerCase();
  const flow = String(notification.data?.approval_flow || '').toLowerCase();
  return type === 'van_load_edit_request' && flow === 'van_load_edit';
};

const mapApprovalRequestToNotification = (requestItem, fallbackWarehouseId = null) => ({
  id: `van-load-edit-request-${requestItem.request_id}`,
  type: 'van_load_edit_request',
  category: 'warehouse',
  title: 'Van Load Edit Approval Request',
  message: `${requestItem.requested_by_name || 'Cashier'} requested edit access for ${requestItem.msp_no || `Sale #${requestItem.sale_id}`}.`,
  details: 'Approve or reject this request from the notification panel.',
  priority: 'high',
  timestamp: requestItem.requested_at || new Date().toISOString(),
  is_read: false,
  data: {
    approval_flow: 'van_load_edit',
    request_status: String(requestItem.status || 'pending').toLowerCase(),
    request_id: requestItem.request_id,
    sale_id: requestItem.sale_id,
    msp_no: requestItem.msp_no,
    warehouse_id: requestItem.warehouse_id ?? fallbackWarehouseId,
    requested_by_id: requestItem.requested_by_id,
    requested_by_name: requestItem.requested_by_name,
    requested_at: requestItem.requested_at,
    is_van_load: true,
  },
});

const buildStockAlertPayload = (stock, warehouseId) => {
  const parsedQty = Number.parseInt(stock?.quantity_available ?? 0, 10);
  const quantity = Number.isFinite(parsedQty) ? parsedQty : 0;
  const thresholds = getStockThresholds();
  const computedStatus = calculateStockStatus(quantity);

  return {
    quantity,
    computedStatus,
    payload: {
      ...stock,
      warehouse_id: warehouseId,
      product_name: stock?.product_name || `Product ${stock?.id ?? 'Unknown'}`,
      quantity_available: quantity,
      stock_status: computedStatus,
      minimum_stock: thresholds.low_threshold,
      stock_thresholds: thresholds,
    },
  };
};

const normalizeWarehouseId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isSameWarehouseId = (a, b) => {
  const normalizedA = normalizeWarehouseId(a);
  const normalizedB = normalizeWarehouseId(b);
  return normalizedA !== null && normalizedB !== null && normalizedA === normalizedB;
};

const resolveNotificationWarehouseId = (notification) => {
  if (!notification || typeof notification !== 'object') {
    return null;
  }
  return normalizeWarehouseId(
    notification?.data?.warehouse_id ??
    notification?.warehouse_id ??
    notification?.warehouseId
  );
};

const toManilaYmd = (value) => {
  if (!value) return '';

  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateValue);
};

const normalizeReservedDate = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return toManilaYmd(raw);
};

const Notification = ({ closeProfile }) => {
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
  
  // Force re-render when notifications change
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // State for notification detail modal
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [approvalActionRequestId, setApprovalActionRequestId] = useState(null);
  const [pendingVanLoadApprovalRequests, setPendingVanLoadApprovalRequests] = useState([]);
 
  // Dynamic expense threshold with real-time updates
  const [largeExpenseThreshold, setLargeExpenseThreshold] = useState(10000);
  
  const dropdownRef = useRef(null);
  const optionsRef = useRef(null);
  const detailModalBodyRef = useRef(null);
  const processedIdsRef = useRef(new Set(JSON.parse(localStorage.getItem('processedNotificationIds') || '[]')));
  const initializationRef = useRef(false);
  const notificationsRef = useRef(notifications);
  const currentWarehouseIdRef = useRef(currentWarehouseId);
  const loadCycleRef = useRef(0);

  // Force re-render when notifications change
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [notifications]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    currentWarehouseIdRef.current = currentWarehouseId;
  }, [currentWarehouseId]);

  // Dark mode detection (respect user override from Header darkMode toggle)
  useEffect(() => {
    const applyThemeClass = (isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };

    const savedTheme = localStorage.getItem('darkMode');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Only follow system theme when user has not explicitly chosen one.
    if (savedTheme === null) {
      applyThemeClass(mediaQuery.matches);
    }

    const handleChange = (event) => {
      if (localStorage.getItem('darkMode') === null) {
        applyThemeClass(event.matches);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Close notification when profile opens
  useEffect(() => {
    const handleProfileOpen = () => setIsOpen(false);
    window.addEventListener('profileOpened', handleProfileOpen);
    return () => window.removeEventListener('profileOpened', handleProfileOpen);
  }, []);

  // ENHANCED: Better user data getter with validation using warehouse utils
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

  const isAdminUser = useCallback(() => {
    const role = String(getCurrentUser()?.role || '').trim().toLowerCase();
    return ['admin', 'administrator', 'super admin'].includes(role) || role.includes('admin');
  }, [getCurrentUser]);

  const clearPersistedNotificationsForWarehouse = useCallback((warehouseId) => {
    const targetWarehouseId = normalizeWarehouseId(warehouseId);
    if (!targetWarehouseId) return;

    try {
      const role = String(getCurrentUser()?.role || '').trim().toLowerCase();
      const isAdminRole = ['admin', 'administrator', 'super admin'].includes(role) || role.includes('admin');

      if (isAdminRole) {
        const warehouseKey = `persistedNotifications_warehouse_${targetWarehouseId}`;
        localStorage.setItem(warehouseKey, JSON.stringify([]));

        const globalAdminNotifications = JSON.parse(localStorage.getItem('persistedNotifications_admin_all') || '[]');
        const filtered = Array.isArray(globalAdminNotifications)
          ? globalAdminNotifications.filter((notif) => !isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId))
          : [];
        localStorage.setItem('persistedNotifications_admin_all', JSON.stringify(filtered));
      } else {
        localStorage.setItem('persistedNotifications', JSON.stringify([]));
      }
    } catch (error) {
      console.warn('Failed to clear stale notification cache for warehouse:', targetWarehouseId, error);
    }
  }, [getCurrentUser]);

  // ENHANCED: Initialize warehouse using warehouse utils consistently
  const initializeWarehouse = useCallback(async () => {
    try {
      let warehouse = getCurrentWarehouse();
      
      console.log('Initializing warehouse in notification component:', warehouse);
      
      // If warehouse needs ID lookup, find it by name
      if (warehouse?.needsIdLookup && warehouse.name) {
        console.log('Finding warehouse by name for notifications:', warehouse.name);
        warehouse = await findWarehouseByName(warehouse.name);
        if (!warehouse) {
          console.warn('Could not find warehouse by name for notifications');
          return null;
        }
      }
      
      if (warehouse?.id) {
        const warehouseId = parseInt(warehouse.id);
        console.log('Warehouse initialized for notifications:', { id: warehouseId, name: warehouse.name });
        setCurrentWarehouse(warehouse);
        setCurrentWarehouseId(warehouseId);
        setUserDataReady(true);
        return { warehouse, warehouseId };
      }
      
      console.warn('No valid warehouse found for notifications');
      return null;
    } catch (error) {
      console.error('Error initializing warehouse for notifications:', error);
      return null;
    }
  }, []);

  // ENHANCED: Better user data validation with immediate availability check using warehouse utils
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
            console.log('Fetching user data from API for warehouse info in notifications...');
            const response = await api.get(`/users/${user.id}/`);
            if (response.data) {
              const userData = response.data;
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
          console.warn('API call failed in notifications, continuing with fallback logic');
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

  // ENHANCED: Initialize warehouse ID early and track changes
  useEffect(() => {
    const initializeComponent = async () => {
      if (!initializationRef.current) {
        initializationRef.current = true;
        
        console.log('Initializing notification component with warehouse utils...');
        const userData = await waitForUserData();
        if (userData) {
          console.log('Notification component initialized with warehouse data:', userData);
          
          // Trigger initial notification check after warehouse is set
          setTimeout(() => {
            if (!isLoaded) {
              setIsLoaded(true);
            }
          }, 500);
        } else {
          console.warn('Failed to initialize notification component with valid warehouse data');
        }
      }
    };

    initializeComponent();
  }, [waitForUserData, isLoaded]);

  // FIXED: Load notifications from backend API without overwriting local notifications
  const loadNotificationsFromAPI = useCallback(async () => {
    const targetWarehouseId = normalizeWarehouseId(currentWarehouseId);
    if (!userDataReady || !targetWarehouseId) {
      return false;
    }

    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      
      const backendNotifications = await NotificationAPI.loadNotifications(warehouseQueryParam, config);
      const visibleBackendNotifications = backendNotifications.filter(
        (notification) => !isVanLoadEditApprovalNotification(notification)
      );

      const formattedNotifications = visibleBackendNotifications
        .map((notification) => {
          const resolvedWarehouseId = resolveNotificationWarehouseId(notification);

          if (!resolvedWarehouseId) {
            return null;
          }

          return {
            id: notification.id,
            type: notification.type,
            category: notification.category,
            title: notification.title,
            message: notification.message,
            details: notification.details,
            priority: notification.priority,
            timestamp: notification.timestamp || notification.created_at,
            is_read: notification.is_read,
            data: {
              ...notification.data,
              warehouse_id: resolvedWarehouseId
            }
          };
        })
        .filter(Boolean)
        .filter((notif) => isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId));

      if (!isSameWarehouseId(currentWarehouseIdRef.current, targetWarehouseId)) {
        console.log(`⏭️ Skipping stale notification sync for warehouse ${targetWarehouseId}`);
        return false;
      }

      const existingNotifications = (notificationsRef.current || []).filter(
        (notification) => !isVanLoadEditApprovalNotification(notification)
      );
      const currentWarehouseNotifications = existingNotifications.filter((notif) =>
        isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId)
      );
      const otherWarehouseNotifications = existingNotifications.filter((notif) =>
        !isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId)
      );
      
      const backendIds = new Set(formattedNotifications.map((n) => String(n.id)));
      // Treat backend as source-of-truth for the current warehouse.
      // If backend is empty (e.g., fresh database), do not keep old local cache.
      const recentLocalNotifications = formattedNotifications.length > 0
        ? currentWarehouseNotifications.filter((localNotif) => !backendIds.has(String(localNotif.id)))
        : [];
      
      const mergedNotifications = [
        ...otherWarehouseNotifications,
        ...formattedNotifications,
        ...recentLocalNotifications
      ];
      
      dispatch({ type: 'SET_NOTIFICATIONS', payload: mergedNotifications });
      console.log(`Synced ${formattedNotifications.length} backend + ${recentLocalNotifications.length} local notifications for warehouse ${targetWarehouseId}`);

      if (formattedNotifications.length === 0) {
        clearPersistedNotificationsForWarehouse(targetWarehouseId);
      }
      return true;
    } catch (error) {
      console.warn('Failed to load notifications from backend:', error.message);
      return false;
    }
  }, [userDataReady, currentWarehouseId, currentWarehouse, dispatch, clearPersistedNotificationsForWarehouse]);

    const syncVanLoadEditRequestsForAdmin = useCallback(async () => {
    if (!userDataReady || !isAdminUser()) {
      setPendingVanLoadApprovalRequests([]);
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser?.id) {
      setPendingVanLoadApprovalRequests([]);
      return;
    }

    const approvalWarehouseId = Number(currentUser?.warehouse_id || currentWarehouseId || 0);
    if (!approvalWarehouseId) {
      setPendingVanLoadApprovalRequests([]);
      return;
    }

    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      const pendingRequests = await NotificationAPI.loadVanLoadEditRequests(
        approvalWarehouseId,
        currentUser.id,
        config
      );

      const normalized = pendingRequests.map((requestItem) => ({
        ...requestItem,
        request_id: requestItem.request_id,
        status: String(requestItem.status || 'pending').toLowerCase(),
        warehouse_id: requestItem.warehouse_id ?? approvalWarehouseId,
      }));
      setPendingVanLoadApprovalRequests(normalized);

      // Keep regular notification list clean: approval requests live in dedicated tab.
      const requestNotifications = (notificationsRef.current || []).filter(
        (notification) =>
          isVanLoadEditApprovalNotification(notification) &&
          Number(notification.data?.warehouse_id || 0) === approvalWarehouseId
      );
      requestNotifications.forEach((notification) => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
      });
    } catch (error) {
      console.warn('Failed to sync Van Load edit requests:', error?.response?.data || error.message);
      setPendingVanLoadApprovalRequests([]);
    }
  }, [userDataReady, currentWarehouseId, isAdminUser, getCurrentUser, currentWarehouse, dispatch]);

  // ENHANCED: Create notification with backend sync
  const createNotificationWithBackend = useCallback(async (notificationType, data, userRole) => {
    if (!userDataReady || !currentWarehouseId) return;

    const payload = data && typeof data === 'object' ? data : {};
    const payloadWarehouseId = normalizeWarehouseId(payload.warehouse_id);
    const currentWarehouseInt = normalizeWarehouseId(currentWarehouseId);
    const targetWarehouseId = payloadWarehouseId || currentWarehouseInt;

    if (!targetWarehouseId) {
      return;
    }

    if (payloadWarehouseId && !isSameWarehouseId(payloadWarehouseId, currentWarehouseInt)) {
      console.log(
        `BLOCKED: Notification ${notificationType} for warehouse ${payloadWarehouseId} while viewing ${currentWarehouseInt}`
      );
      return;
    }

    const normalizedPayload = {
      ...payload,
      warehouse_id: targetWarehouseId
    };

    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      
      // Create in backend
      await NotificationAPI.createNotification(notificationType, normalizedPayload, userRole, targetWarehouseId, config);
      
      // Also create locally for immediate display
      addNotification(notificationType, normalizedPayload, userRole);
      
    } catch (error) {
      console.warn('Failed to sync notification with backend:', error.message);
      // Still create locally if backend fails
      addNotification(notificationType, normalizedPayload, userRole);
    }
  }, [userDataReady, currentWarehouseId, currentWarehouse, addNotification]);

  // ENHANCED: Credit-specific notification helper
  const triggerCreditNotification = useCallback((creditData, action = 'created') => {
    if (!userDataReady || !currentWarehouseId) return;

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
        createNotificationWithBackend('credit_created', notificationData, userRole);
        break;
      case 'paid':
        createNotificationWithBackend('paid_credit', notificationData, userRole);
        break;
      case 'overdue':
        createNotificationWithBackend('credit_overdue', notificationData, userRole);
        break;
      case 'due_soon':
        createNotificationWithBackend('credit_overdue', {
          ...notificationData,
          days_overdue: -(notificationData.days_until_due || 0),
          early_warning: true
        }, userRole);
        break;
    }
    
    // Force update
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
  }, [userDataReady, currentWarehouseId, getCurrentUser, createNotificationWithBackend]);

  // ENHANCED: Batch notification processor for multiple credits
  const processBatchCreditNotifications = useCallback(async (credits, action) => {
    if (!Array.isArray(credits) || credits.length === 0) return;

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
        
        createNotificationWithBackend(`credit_${action}`, notificationData, userRole);
        notificationsCreated++;
      }
    });

    if (notificationsCreated > 0) {
      setTimeout(() => setForceUpdate(prev => prev + 1), 200);
      console.log(`Created ${notificationsCreated} batch credit notifications`);
    }
  }, [getCurrentUser, currentWarehouseId, createNotificationWithBackend]);

  // NEW: Credit due date checker with API integration
  const checkCreditDueDates = useCallback(async () => {
    if (!userDataReady || !currentWarehouseId) return;

    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      
      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      const response = await api.get(`/credits/?warehouse=${warehouseQueryParam}&status=PENDING`, config);

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
      console.warn('Credit due date check failed:', error.message);
    }
  }, [userDataReady, currentWarehouseId, currentWarehouse, triggerCreditNotification]);

  // ENHANCED: Notification cleanup for old notifications (disabled to keep all messages)
  const cleanupOldNotifications = useCallback(() => {
    // Keep all notifications - don't auto-remove old ones
    // const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // const validNotifications = notifications.filter(notif =>
    //   new Date(notif.timestamp) > sevenDaysAgo
    // );

    // if (validNotifications.length !== notifications.length) {
    //   dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });

    //   console.log(`Cleaned up ${notifications.length - validNotifications.length} old notifications`);
    // }
  }, [notifications, dispatch]);

  // NEW: Notification summary generator
  const generateNotificationSummary = useCallback(() => {
    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    
    const warehouseNotifications = notifications.filter(notif => 
      isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId) && !notif.is_read
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

  // ENHANCED: Export notifications data
  const exportNotifications = useCallback((format = 'json') => {
    const user = getCurrentUser();
    const warehouseNotifications = notifications.filter(notif => 
      isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId)
    );

    const exportData = {
      warehouse: getCurrentWarehouseName(),
      exported_by: user.username || user.name || 'Unknown',
      exported_at: new Date().toISOString(),
      total_notifications: warehouseNotifications.length,
      unread_count: warehouseNotifications.filter(n => !n.is_read).length,
      notifications: warehouseNotifications.map(notif => ({
        id: notif.id,
        type: notif.type,
        category: notif.category,
        title: notif.title,
        message: notif.message,
        details: notif.details,
        priority: notif.priority,
        timestamp: notif.timestamp,
        is_read: notif.is_read,
        data: notif.data
      }))
    };

    if (format === 'csv') {
      const csvContent = [
        'Type,Title,Message,Priority,Timestamp,Read Status',
        ...warehouseNotifications.map(notif =>
          `"${notif.type}","${notif.title}","${notif.message}","${notif.priority}","${notif.timestamp}","${notif.is_read ? 'Read' : 'Unread'}"`
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notifications_${getCurrentWarehouseName()}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notifications_${getCurrentWarehouseName()}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [notifications, currentWarehouseId, getCurrentUser]);

  // ENHANCED: Handle notification click with backend sync
  const handleNotificationClick = (notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      dispatch({ type: 'MARK_AS_READ', payload: notification.id });
      
      // Also mark as read in backend
      const shouldSyncReadToBackend = !String(notification.id || '').startsWith('van-load-edit-request-');
      if (shouldSyncReadToBackend) {
        const config = getWarehouseAxiosConfig(currentWarehouse);
        NotificationAPI.markAsRead(notification.id, config).catch(err =>
          console.warn('Failed to mark as read in backend:', err.message)
        );
      }
      
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

  useEffect(() => {
    if (!showDetailModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const resetTimer = window.setTimeout(() => {
      if (detailModalBodyRef.current) {
        detailModalBodyRef.current.scrollTop = 0;
      }
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [showDetailModal, selectedNotification?.id]);

   const isPendingVanLoadEditRequest = useCallback((notification) => {
    if (!notification) return false;
    const reqId = notification.data?.request_id;
    const reqStatus = String(notification.data?.request_status || '').toLowerCase();
    const isPendingStatus = !reqStatus || reqStatus === 'pending';
    return notification.type === 'van_load_edit_request' && Boolean(reqId) && isPendingStatus;
  }, []);

  const handleVanLoadEditDecision = useCallback(async (notification, action) => {
    if (!notification || !isPendingVanLoadEditRequest(notification)) return;

    const requestId = notification.data?.request_id;
    const currentUser = getCurrentUser();
    if (!requestId || !currentUser?.id || !isAdminUser()) return;

    setApprovalActionRequestId(requestId);
    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      await NotificationAPI.decideVanLoadEditRequest(
        requestId,
        action,
        currentUser.id,
        '',
        config
      );

      const requestIdKey = String(notification.data?.request_id || requestId);

      // Remove from dedicated admin section immediately after decision.
      setPendingVanLoadApprovalRequests((prev) =>
        prev.filter((requestItem) => String(requestItem.request_id) !== requestIdKey)
      );

      // Remove any mirrored request notification from regular store to keep tabs clean.
      const mirroredRequestNotifications = (notificationsRef.current || []).filter((item) => (
        isVanLoadEditApprovalNotification(item) &&
        String(item.data?.request_id || '') === requestIdKey
      ));
      mirroredRequestNotifications.forEach((item) => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: item.id });
      });
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });

      closeDetailModal();
      setTimeout(() => {
        syncVanLoadEditRequestsForAdmin();
        setForceUpdate((prev) => prev + 1);
      }, 200);
    } catch (error) {
      const data = error?.response?.data;
      const message = data?.error || data?.detail || 'Failed to process request.';
      window.alert(message);
    } finally {
      setApprovalActionRequestId(null);
    }
  }, [
    isPendingVanLoadEditRequest,
    getCurrentUser,
    isAdminUser,
    currentWarehouse,
    dispatch,
    syncVanLoadEditRequestsForAdmin,
    setPendingVanLoadApprovalRequests,
  ]);
 
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
        {
          const qty = Number.parseInt(data.quantity_available ?? 0, 10);
          const derivedStockStatus = calculateStockStatus(Number.isFinite(qty) ? qty : 0);
        details.push(
          { label: 'Product', value: safeToString(data.product_name || 'Unknown Product') },
          { label: 'Available Quantity', value: safeToString(data.quantity_available || 0) },
          { label: 'Stock Status', value: safeToString(data.stock_status || derivedStockStatus || 'Unknown') }
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
        }

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

      case 'van_load_edit_request':
        details.push(
          { label: 'MSP / Sale', value: safeToString(data.msp_no || `Sale #${data.sale_id || 'N/A'}`) },
          { label: 'Requested By', value: safeToString(data.requested_by_name || data.requested_by_id || 'Unknown') },
          { label: 'Request Status', value: safeToString(data.request_status || 'pending') }
        );
        break;

      case 'van_load_edit_decision':
        details.push(
          { label: 'MSP / Sale', value: safeToString(data.msp_no || `Sale #${data.sale_id || 'N/A'}`) },
          { label: 'Decision', value: safeToString(data.decision || data.request_status || 'N/A') },
          { label: 'Reviewed By', value: safeToString(data.reviewed_by_name || data.reviewed_by_id || 'N/A') }
        );
        if (data.review_notes) {
          details.push({ label: 'Admin Note', value: safeToString(data.review_notes) });
        }
        break;

      case 'expense_created':
      case 'large_expense':
        details.push(
          { label: 'Description', value: safeToString(data.description || 'No description') },
          { label: 'Amount', value: `\u20B1${(data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Category', value: safeToString(data.category || 'Miscellaneous') }
        );
        if (notification.type === 'large_expense' && data.threshold) {
          details.push({ label: 'Threshold', value: `\u20B1${data.threshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
        }
        if (data.created_by) {
          details.push({ label: 'Created By', value: safeToString(data.created_by) });
        }
        break;

      case 'expense_updated':
        details.push(
          { label: 'Description', value: safeToString(data.description || 'No description') },
          { label: 'Previous Amount', value: `\u20B1${(data.old_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'New Amount', value: `\u20B1${(data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Change Type', value: safeToString(data.change_type || 'Unknown') }
        );
        if (data.amount_difference) {
          details.push({ label: 'Amount Difference', value: `\u20B1${data.amount_difference.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
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
          { label: 'Expected Sale', value: `\u20B1${(data.expected_sale || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
        );
        if (data.actual_sale) {
          details.push({ label: 'Actual Sale', value: `\u20B1${data.actual_sale.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
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
          { label: 'Total Amount', value: `\u20B1${(data.total_amount || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Customer', value: safeToString(data.customer_name || 'Walk-in Customer') }
        );
        if (data.cashier_name) {
          details.push({ label: 'Cashier', value: safeToString(data.cashier_name) });
        }
        break;

      // NEW: Enhanced credit notification details
      case 'credit_created':
        details.push(
          { label: 'Credit ID', value: safeToString(data.id || 'Unknown') },
          { label: 'MSP Number', value: safeToString(data.msp_no || 'N/A') },
          { label: 'Customer', value: safeToString(data.customer_name || 'Unknown Customer') },
          { label: 'Credit Amount', value: `\u20B1${(data.balance || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
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
          { label: 'Outstanding Amount', value: `\u20B1${(data.balance || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Due Date', value: safeToString(data.due_date ? new Date(data.due_date).toLocaleDateString() : 'Not set') },
          { label: 'Days Overdue', value: `${data.days_overdue || 0} days` }
        );
        if (data.original_amount && data.original_amount !== data.balance) {
          details.push({ label: 'Original Amount', value: `\u20B1${data.original_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
        }
        break;

      case 'paid_credit':
        details.push(
          { label: 'Credit ID', value: safeToString(data.id || 'Unknown') },
          { label: 'MSP Number', value: safeToString(data.msp_no || 'N/A') },
          { label: 'Customer', value: safeToString(data.customer_name || 'Unknown Customer') },
          { label: 'Payment Amount', value: `\u20B1${(data.balance || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
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
          { label: 'Price', value: `\u20B1${(data.selling_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
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
          { label: 'Refund Amount', value: `\u20B1${(data.refund_amount || data.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
        );
        if (data.return_reason) {
          details.push({ label: 'Reason', value: safeToString(data.return_reason) });
        }
        break;

      case 'new_receiving':
        details.push(
          { label: 'Receiving No', value: safeToString(data.receiving_no || 'Unknown') },
          { label: 'Supplier', value: safeToString(data.supplier_name || 'Unknown Supplier') },
          { label: 'Total Amount', value: `\u20B1${(data.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
          { label: 'Items Count', value: safeToString(data.items_count || 0) },
          { label: 'Status', value: safeToString(data.status || 'Completed') }
        );
        if (data.created_by) {
          details.push({ label: 'Created By', value: safeToString(data.created_by) });
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

  // FIXED: Load persisted notifications with better deletion tracking
  const loadPersistedNotifications = useCallback(() => {
    try {
      const user = getCurrentUser();
      const userRole = user.role?.toLowerCase();
      const targetWarehouseId = normalizeWarehouseId(currentWarehouseId);
      
      // FIXED: More lenient deleted notification filtering
      const deletedNotificationIds = new Set(JSON.parse(localStorage.getItem('deletedNotificationIds') || '[]'));
      
      if (userRole === 'admin' && targetWarehouseId) {
        const existingOtherWarehouseNotifications = (notificationsRef.current || []).filter((notif) =>
          !isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId)
        );

        // Load warehouse-specific notifications for admin
        const warehouseKey = `persistedNotifications_warehouse_${targetWarehouseId}`;
        const savedWarehouseNotifications = localStorage.getItem(warehouseKey);
        
        if (savedWarehouseNotifications) {
          const parsedNotifications = JSON.parse(savedWarehouseNotifications);
          
          // FIXED: Only filter out explicitly deleted notifications, keep all messages
          const validNotifications = parsedNotifications.filter(notif => {
            const notDeleted = !deletedNotificationIds.has(notif.id);
            const isCurrentWarehouse = isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId);
            
            return notDeleted && isCurrentWarehouse;
          });
          
          const mergedNotifications = [...existingOtherWarehouseNotifications, ...validNotifications];
          dispatch({ type: 'SET_NOTIFICATIONS', payload: mergedNotifications });
          console.log(`Admin loaded ${validNotifications.length} persisted notifications for warehouse ${targetWarehouseId}`);
          
          // Update localStorage with only valid notifications
          localStorage.setItem(warehouseKey, JSON.stringify(validNotifications));
        } else {
          // Try loading from global admin notifications
          const globalAdminNotifications = localStorage.getItem('persistedNotifications_admin_all');
          if (globalAdminNotifications) {
            const allNotifications = JSON.parse(globalAdminNotifications);
            const warehouseNotifications = allNotifications.filter(notif =>
              isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId) &&
              !deletedNotificationIds.has(notif.id)
            );
            
            if (warehouseNotifications.length > 0) {
              const mergedNotifications = [...existingOtherWarehouseNotifications, ...warehouseNotifications];
              
              dispatch({ type: 'SET_NOTIFICATIONS', payload: mergedNotifications });
              localStorage.setItem(warehouseKey, JSON.stringify(warehouseNotifications));
              console.log(`Admin migrated ${warehouseNotifications.length} notifications to warehouse ${targetWarehouseId}`);
            } else {
              dispatch({ type: 'SET_NOTIFICATIONS', payload: existingOtherWarehouseNotifications });
            }
          } else {
            dispatch({ type: 'SET_NOTIFICATIONS', payload: existingOtherWarehouseNotifications });
          }
        }
      } else {
        // Regular notification loading for non-admin users
        const savedNotifications = localStorage.getItem('persistedNotifications');
        if (savedNotifications) {
          const parsedNotifications = JSON.parse(savedNotifications);
          
          // FIXED: Less aggressive filtering - keep all messages
          const validNotifications = parsedNotifications.filter(notif => {
            const notDeleted = !deletedNotificationIds.has(notif.id);
            const isCurrentWarehouse = isSameWarehouseId(resolveNotificationWarehouseId(notif), targetWarehouseId);
            
            return notDeleted && isCurrentWarehouse;
          });
          
          dispatch({ type: 'SET_NOTIFICATIONS', payload: validNotifications });
          
          // Update localStorage with only valid notifications
          localStorage.setItem('persistedNotifications', JSON.stringify(validNotifications));
        }
      }
    } catch (error) {
      console.warn('Error loading persisted notifications - corrupted data, resetting...');
      // FIXED: Don't clear all data, just reset for current warehouse
      const user = getCurrentUser();
      const userRole = user.role?.toLowerCase();
      
      if (userRole === 'admin' && currentWarehouseId) {
        localStorage.removeItem(`persistedNotifications_warehouse_${currentWarehouseId}`);
      } else {
        localStorage.removeItem('persistedNotifications');
      }
    }
  }, [dispatch, currentWarehouseId, getCurrentUser]);

  // NEW: Unified notification loading with priority
  const loadAllNotifications = useCallback(async () => {
    const targetWarehouseId = normalizeWarehouseId(currentWarehouseId);
    if (!isLoaded && userDataReady && targetWarehouseId) {
      const loadToken = ++loadCycleRef.current;
      console.log('Loading all notifications with priority system...');
      
      // 1. Try backend first. Use local cache only if backend load fails.
      setTimeout(async () => {
        if (loadCycleRef.current !== loadToken || !isSameWarehouseId(currentWarehouseIdRef.current, targetWarehouseId)) {
          return;
        }
        const backendLoaded = await loadNotificationsFromAPI();
        if (!backendLoaded) {
          loadPersistedNotifications();
        }
        if (loadCycleRef.current === loadToken && isSameWarehouseId(currentWarehouseIdRef.current, targetWarehouseId)) {
          setIsLoaded(true);
        }
      }, 300);
      
      // 2. Safety net: mark as loaded even if async sequence is delayed
      setTimeout(() => {
        if (loadCycleRef.current !== loadToken || !isSameWarehouseId(currentWarehouseIdRef.current, targetWarehouseId)) {
          return;
        }
        setIsLoaded(true);
      }, 1000);
    }
  }, [isLoaded, userDataReady, currentWarehouseId, loadNotificationsFromAPI, loadPersistedNotifications]);

  // FIXED: Better loading sequence with priority
  useEffect(() => {
    loadAllNotifications();
  }, [loadAllNotifications]);

    useEffect(() => {
    if (!userDataReady || !currentWarehouseId || !isAdminUser()) return;

    syncVanLoadEditRequestsForAdmin();
    if (!isOpen) return;

    const intervalId = setInterval(syncVanLoadEditRequestsForAdmin, 5000);
    return () => clearInterval(intervalId);
  }, [userDataReady, currentWarehouseId, isOpen, isAdminUser, syncVanLoadEditRequestsForAdmin]);

  useEffect(() => {
    if (activeTab === 'approval' && !isAdminUser()) {
      setActiveTab('all');
    }
  }, [activeTab, isAdminUser]);

  // ENHANCED: Persist notifications with warehouse awareness for admin
  useEffect(() => {
    const persistNotifications = (notifications) => {
      try {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin' && currentWarehouseId) {
          // Store notifications per warehouse for admin
          const warehouseKey = `persistedNotifications_warehouse_${currentWarehouseId}`;
          const warehouseNotifications = notifications.filter(notif => 
            isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId)
          );
          localStorage.setItem(warehouseKey, JSON.stringify(warehouseNotifications));
          
          // Also maintain global admin notifications for migration purposes
          localStorage.setItem('persistedNotifications_admin_all', JSON.stringify(notifications));
        } else {
          // Regular storage for non-admin users
          localStorage.setItem('persistedNotifications', JSON.stringify(notifications));
        }
      } catch (error) {
        console.warn('Error persisting notifications - storage may be full');
      }
    };

    if (isLoaded && notifications.length >= 0) {
      persistNotifications(notifications);
    }
  }, [notifications, isLoaded, currentWarehouseId, getCurrentUser]);

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
              message: `${notification.data.description} - \u20B1${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
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
              title: 'Large Expense Alert',
              priority: 'high',
              message: `High-value expense: ${notification.data.description} - \u20B1${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
              details: `Exceeds threshold of \u20B1${newThreshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
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

  // ENHANCED: Stock notifications with API integration
  const checkStockNotifications = useCallback(async () => {
    // Only proceed if user data is ready and warehouse is set
    if (!userDataReady || !currentWarehouseId) {
      return;
    }

    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = currentWarehouseId;
    const processedIds = processedIdsRef.current;
    let newNotifications = 0;
    let processedIdsUpdated = false;

    try {
      // Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 10000;

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('Checking stock notifications for warehouse:', warehouseQueryParam);
      
      const stockResponse = await api.get(`/stocks/?warehouse=${warehouseQueryParam}`, config);
      const stocks = Array.isArray(stockResponse.data) ? stockResponse.data : stockResponse.data?.results || [];

      // Get previous stock levels for comparison
      const previousStocksKey = `previousStocks_${warehouseId}`;
      const previousStocks = JSON.parse(localStorage.getItem(previousStocksKey) || '{}');
      const now = new Date().toISOString();

      stocks.forEach(stock => {
        const stockId = `stock-${stock.id}-${warehouseId}`;
        const { quantity: currentQuantity, computedStatus, payload: stockAlertPayload } = buildStockAlertPayload(stock, warehouseId);
        const previousQuantity = previousStocks[stock.id]?.quantity;
        const lastChecked = previousStocks[stock.id]?.timestamp;
        const outKey = stockId + "-out";
        const lowKey = stockId + "-low";

        // Re-arm stock alerts when item recovers, so future low/out events notify again
        if (computedStatus !== "Out of Stock") {
          if (processedIds.delete(outKey)) {
            processedIdsUpdated = true;
          }
        }
        if (computedStatus !== "Low") {
          if (processedIds.delete(lowKey)) {
            processedIdsUpdated = true;
          }
        }
        
        // CHECK FOR OUT OF STOCK
        if (computedStatus === "Out of Stock" && !processedIds.has(outKey)) {
          createNotificationWithBackend('out_of_stock', { 
            ...stockAlertPayload,
          }, userRole);
          processedIds.add(outKey);
          processedIdsUpdated = true;
          newNotifications++;
        }
        // CHECK FOR LOW STOCK (but not out of stock)
        else if (computedStatus === "Low" && currentQuantity > 0 && !processedIds.has(lowKey)) {
          createNotificationWithBackend('low_stock', { 
            ...stockAlertPayload,
          }, userRole);
          processedIds.add(lowKey);
          processedIdsUpdated = true;
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
              adjustmentTitle = 'Stock Depleted';
              adjustmentMessage = `${stock.product_name} stock reduced to 0 (was ${previousQuantity})`;
            } else if (changeType === 'increased') {
              adjustmentTitle = 'Stock Increased';
              adjustmentMessage = `${stock.product_name} stock increased by ${changeDiff}. Current: ${currentQuantity} units`;
            } else {
              adjustmentTitle = 'Stock Reduced';
              adjustmentMessage = `${stock.product_name} stock reduced by ${changeDiff}. Remaining: ${currentQuantity} units`;
            }
            
            // Notify for any quantity change
            createNotificationWithBackend('stock_adjustment', { 
              id: `${stock.id}_${Date.now()}`,
              warehouse_id: warehouseId,
              product_name: stock.product_name || `Product ${stock.id}`,
              old_quantity: previousQuantity,
              new_quantity: currentQuantity,
              remaining_quantity: currentQuantity,
              quantity_changed: changeDiff,
              change_type: changeType,
              reason: `Stock adjustment: ${previousQuantity} -> ${currentQuantity}`,
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
      if (newNotifications > 0 || processedIdsUpdated) {
        localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
        processedIdsRef.current = processedIds;
        
        // FORCE UPDATE after creating notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
        console.log(`Created ${newNotifications} stock notifications`);
      }

    } catch (error) {
      console.warn('Stock notifications check failed:', error.message);
    }
  }, [currentWarehouseId, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouse]);

  // ENHANCED: Login stock check with API integration
  const checkLowStockOnLogin = useCallback(async () => {
    // Only proceed if user data is ready and warehouse is set
    if (!userDataReady || !currentWarehouseId) {
      return;
    }

    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = currentWarehouseId;

    try {
      // Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 10000;

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('Login stock check for warehouse:', warehouseQueryParam);
      
      const stockResponse = await api.get(`/stocks/?warehouse=${warehouseQueryParam}`, config);
      const stocks = Array.isArray(stockResponse.data) ? stockResponse.data : stockResponse.data?.results || [];

      let loginNotifications = 0;
      const lowStockItems = [];
      const outOfStockItems = [];

      stocks.forEach(stock => {
        const { quantity: currentQuantity, computedStatus, payload: stockAlertPayload } = buildStockAlertPayload(stock, warehouseId);
        
        // Check for out of stock - always notify on login
        if (computedStatus === "Out of Stock") {
          outOfStockItems.push(stockAlertPayload.product_name);
          createNotificationWithBackend('out_of_stock', { 
            ...stockAlertPayload,
            login_check: true,
            id: `login-out-${stock.id}-${Date.now()}` // Unique ID for login check
          }, userRole);
          loginNotifications++;
        }
        // Check for low stock - always notify on login
        else if (computedStatus === "Low" && currentQuantity > 0) {
          lowStockItems.push(`${stockAlertPayload.product_name} (${currentQuantity} left)`);
          createNotificationWithBackend('low_stock', { 
            ...stockAlertPayload,
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
          
          createNotificationWithBackend('low_stock', {
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
        
        console.log(`Created ${loginNotifications} login stock notifications`);
      }

    } catch (error) {
      console.warn('Login stock check failed:', error.message);
    }
  }, [currentWarehouseId, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouse]);
  
  // ENHANCED: Expense notification checking with API integration
  const checkExpenseNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    try {
      // Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 5000;

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('Checking expense notifications for warehouse:', warehouseQueryParam);
      
      const expenseResponse = await api.get(`/miscellaneous-items/?warehouse=${warehouseQueryParam}`, config);
      
      const expenses = Array.isArray(expenseResponse.data) ? expenseResponse.data : expenseResponse.data?.results || [];

      if (expenses.length === 0) {
        return newNotifications;
      }

      // Get previous expenses for comparison (detect updates/deletions)
      const previousExpensesKey = `previousExpenses_${warehouseId}`;
      const previousExpenses = JSON.parse(localStorage.getItem(previousExpensesKey) || '{}');
      const now = new Date().toISOString();
      
      // Check if this is the first time checking expenses
      const isFirstTimeCheck = Object.keys(previousExpenses).length === 0;
      
      // Reduced time window to 5 minutes to avoid old expenses
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Get current user to avoid notifying about other users' expenses
      const currentUser = getCurrentUser();
      const currentUserId = currentUser.id;
      
      expenses.forEach(expense => {
        const expenseId = `expense-${expense.id}-${warehouseId}`;
        const expenseDate = new Date(expense.created_at || expense.updated_at || now);
        const expenseAmount = Number(expense.amount || 0);
        const previousExpense = previousExpenses[expense.id];
        
        // Skip if this is first time check and expense is older than 5 minutes
        if (isFirstTimeCheck && expenseDate <= fiveMinutesAgo) {
          // Store the expense but don't notify about old expenses on first load
          previousExpenses[expense.id] = {
            amount: expenseAmount,
            description: expense.description,
            updated_at: expense.updated_at || expense.created_at,
            timestamp: now,
            created_by: expense.created_by || expense.user_id
          };
          processedIds.add(expenseId); // Mark as processed to avoid future notifications
          return; // Skip notification for old expenses on first load
        }

        // Only notify about recent expenses AND check if already processed
        if (expenseDate > fiveMinutesAgo && !processedIds.has(expenseId)) {
          
          // Only notify if this user created the expense OR if it's a supervisor/admin monitoring all expenses
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
              createNotificationWithBackend('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                previous_amount: previousExpense.amount,
                update_type: 'updated_to_large',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else if (amountChanged && wasLarge && !isNowLarge) {
              // Updated to become a normal expense
              createNotificationWithBackend('expense_updated', { 
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
              createNotificationWithBackend('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                previous_amount: previousExpense.amount,
                update_type: 'large_expense_updated',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else {
              // Normal update
              createNotificationWithBackend('expense_updated', { 
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
              createNotificationWithBackend('large_expense', { 
                ...expense, 
                warehouse_id: warehouseId,
                threshold: largeExpenseThreshold,
                update_type: 'new_large_expense',
                created_by: expense.created_by || expense.user_id || 'Unknown'
              }, userRole);
            } else {
              createNotificationWithBackend('expense_created', { 
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

      // Only check for deleted expenses if not first time check
      if (!isFirstTimeCheck) {
        Object.keys(previousExpenses).forEach(expenseId => {
          const currentExpense = expenses.find(e => e.id.toString() === expenseId.toString());
          if (!currentExpense) {
            const deletedExpenseId = `expense-deleted-${expenseId}-${warehouseId}`;
            
            if (!processedIds.has(deletedExpenseId)) {
              const expenseData = previousExpenses[expenseId];
              const wasLarge = expenseData.amount >= largeExpenseThreshold;
              
              // Only notify about deleted expenses if user created them or is admin/supervisor
              const shouldNotifyDelete = (
                (expenseData.created_by === currentUserId) ||
                (userRole === 'admin' || userRole === 'supervisor')
              );
              
              if (shouldNotifyDelete) {
                createNotificationWithBackend('expense_deleted', { 
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
        console.log(`Created ${newNotifications} expense notifications`);
      } else if (isFirstTimeCheck) {
        console.log('First time expense check - stored existing expenses without notifications');
      }

    } catch (error) {
      console.warn('Expense notifications check failed:', error.message);
    }

    return newNotifications;
  }, [createNotificationWithBackend, largeExpenseThreshold, currentWarehouse, getCurrentUser]);

  // NEW: Comprehensive credit notification checking with API integration
  const checkCreditNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    try {
      // Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 5000;

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);
      console.log('Checking credit notifications for warehouse:', warehouseQueryParam);
      
      const creditResponse = await api.get(`/credits/?warehouse=${warehouseQueryParam}`, config);
      
      const credits = Array.isArray(creditResponse.data) ? creditResponse.data : creditResponse.data?.results || [];

      if (credits.length === 0) {
        return newNotifications;
      }

      // Get previous credits for comparison
      const previousCreditsKey = `previousCredits_${warehouseId}`;
      const previousCredits = JSON.parse(localStorage.getItem(previousCreditsKey) || '{}');
      const now = new Date().toISOString();
      const today = new Date();
      
      // Check if this is the first time checking credits
      const isFirstTimeCheck = Object.keys(previousCredits).length === 0;
      
      // Time windows for different notifications
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const currentUser = getCurrentUser();
      const currentUserId = currentUser.id;
      
      credits.forEach(credit => {
        const creditId = `credit-${credit.id}-${warehouseId}`;
        const creditDate = new Date(credit.created_at || credit.updated_at || now);
        const creditAmount = Number(credit.balance || credit.amount || 0);
        const previousCredit = previousCredits[credit.id];
        const creditStatus = (credit.status || '').toUpperCase();
        const dueDate = credit.due_date ? new Date(credit.due_date) : null;
        
        // Skip old credits on first load for creation notifications
        if (isFirstTimeCheck && creditDate <= fiveMinutesAgo) {
          // Store the credit but don't notify about old credits on first load
          previousCredits[credit.id] = {
            amount: creditAmount,
            status: creditStatus,
            balance: creditAmount,
            due_date: credit.due_date,
            customer_name: credit.customer_name,
            updated_at: credit.updated_at || credit.created_at,
            timestamp: now,
            created_by: credit.created_by || credit.user_id
          };
          processedIds.add(creditId);
          
          // Check for overdue credits even on first load (but not new creation)
          if (dueDate && today > dueDate && creditStatus !== 'PAID') {
            const overdueId = `credit-overdue-${credit.id}-${warehouseId}`;
            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            
            if (!processedIds.has(overdueId)) {
              // Only notify about overdue credits if user should see them
              const shouldNotifyOverdue = (
                (credit.created_by === currentUserId || credit.user_id === currentUserId) ||
                (userRole === 'admin' || userRole === 'supervisor')
              );
              
              if (shouldNotifyOverdue) {
                createNotificationWithBackend('credit_overdue', { 
                  ...credit, 
                  warehouse_id: warehouseId,
                  days_overdue: daysOverdue,
                  original_amount: credit.original_amount || creditAmount,
                  overdue_notification: true
                }, userRole);
                newNotifications++;
              }
              
              processedIds.add(overdueId);
            }
          }
          
          return; // Skip new creation notification for old credits
        }

        // Check for NEW CREDIT CREATED (recent credits only)
        if (creditDate > fiveMinutesAgo && !processedIds.has(creditId)) {
          
          // Only notify if this user created the credit OR if it's a supervisor/admin
          const shouldNotifyCreation = (
            (credit.created_by === currentUserId || credit.user_id === currentUserId) ||
            (userRole === 'admin' || userRole === 'supervisor')
          );
          
          if (shouldNotifyCreation && !previousCredit) {
            createNotificationWithBackend('credit_created', { 
              ...credit, 
              warehouse_id: warehouseId,
              credit_terms: credit.credit_terms || credit.terms || 30,
              created_by: credit.created_by || credit.user_id || 'Unknown'
            }, userRole);
            newNotifications++;
          }
          
          processedIds.add(creditId);
        }

        // Check for CREDIT STATUS CHANGES (PAID)
        if (previousCredit && previousCredit.status !== creditStatus) {
          const statusChangeId = `credit-status-${credit.id}-${warehouseId}-${creditStatus}`;
          
          if (!processedIds.has(statusChangeId)) {
            if (creditStatus === 'PAID' && previousCredit.status !== 'PAID') {
              // Credit was paid
              const shouldNotifyPayment = (
                (credit.created_by === currentUserId || credit.user_id === currentUserId) ||
                (userRole === 'admin' || userRole === 'supervisor')
              );
              
              if (shouldNotifyPayment) {
                createNotificationWithBackend('paid_credit', { 
                  ...credit, 
                  warehouse_id: warehouseId,
                  payment_date: credit.updated_at || now,
                  payment_method: credit.payment_method || 'Cash',
                  previous_balance: previousCredit.balance || previousCredit.amount
                }, userRole);
                newNotifications++;
              }
            }
            
            processedIds.add(statusChangeId);
          }
        }

        // Check for OVERDUE CREDITS (check all credits, not just recent ones)
        if (dueDate && today > dueDate && creditStatus !== 'PAID') {
          const overdueId = `credit-overdue-${credit.id}-${warehouseId}`;
          const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          
          // Only notify once per day about overdue credits
          const lastOverdueCheck = localStorage.getItem(`lastOverdueCheck_${credit.id}_${warehouseId}`);
          const shouldCheckOverdue = !lastOverdueCheck || 
            (new Date(lastOverdueCheck).toDateString() !== today.toDateString());
          
          if (shouldCheckOverdue && !processedIds.has(overdueId)) {
            const shouldNotifyOverdue = (
              (credit.created_by === currentUserId || credit.user_id === currentUserId) ||
              (userRole === 'admin' || userRole === 'supervisor')
            );
            
            if (shouldNotifyOverdue) {
              createNotificationWithBackend('credit_overdue', { 
                ...credit, 
                warehouse_id: warehouseId,
                days_overdue: daysOverdue,
                original_amount: credit.original_amount || creditAmount,
                overdue_notification: true
              }, userRole);
              newNotifications++;
              
              // Mark as checked today
              localStorage.setItem(`lastOverdueCheck_${credit.id}_${warehouseId}`, today.toISOString());
            }
            
            processedIds.add(overdueId);
          }
        }

        // Store current credit data for next comparison
        previousCredits[credit.id] = {
          amount: creditAmount,
          status: creditStatus,
          balance: creditAmount,
          due_date: credit.due_date,
          customer_name: credit.customer_name,
          updated_at: credit.updated_at || credit.created_at,
          timestamp: now,
          created_by: credit.created_by || credit.user_id
        };
      });

      // Save current credit state for next comparison
      localStorage.setItem(previousCreditsKey, JSON.stringify(previousCredits));

      if (newNotifications > 0) {
        // FORCE UPDATE after creating credit notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
        console.log(`Created ${newNotifications} credit notifications`);
      } else if (isFirstTimeCheck) {
        console.log('First time credit check - stored existing credits and checked for overdue');
      }

    } catch (error) {
      console.warn('Credit notifications check failed:', error.message);
    }

    return newNotifications;
  }, [createNotificationWithBackend, currentWarehouse, getCurrentUser]);

  // Check system and role accessibility notifications (Admin only) with API integration
  const checkSystemNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    // Only admin can see system notifications
    if (userRole !== 'admin') {
      return newNotifications;
    }

    try {
      const now = new Date().toISOString();

      console.log('Checking system notifications for admin');

      // 1. CHECK USER ROLE CHANGES with API integration
      try {
        const usersResponse = await api.get(`/users/`);
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
              createNotificationWithBackend('role_updated', { 
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
        console.warn('Users API not available for system notifications');
      }

      if (newNotifications > 0) {
        // FORCE UPDATE after creating system notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
        console.log(`Created ${newNotifications} system notifications`);
      }

    } catch (error) {
      console.warn('System notifications check failed:', error.message);
    }

    return newNotifications;
  }, [createNotificationWithBackend]);

  // ENHANCED: Supplier notifications with warehouse filtering and API integration - FIXED 500 ERROR HANDLING
  const checkSupplierNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    try {
      // Rate limiting: Only check suppliers every 5 minutes to avoid API spam
      const lastSupplierCheck = localStorage.getItem(`lastSupplierCheck_${warehouseId}`);
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      if (lastSupplierCheck && parseInt(lastSupplierCheck) > fiveMinutesAgo) {
        console.log('Skipping supplier check - rate limited');
        return newNotifications;
      }

      // Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 5000;

      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);

      console.log('Checking supplier and warehouse notifications for warehouse:', warehouseQueryParam);

      // CHECK SUPPLIERS WITH WAREHOUSE FILTERING and API integration - FIXED 500 ERROR HANDLING
      try {
        const supplierResponse = await api.get(`/suppliers/?warehouse=${warehouseQueryParam}`, config);
        const suppliers = Array.isArray(supplierResponse.data) ? supplierResponse.data : supplierResponse.data?.results || [];

        // Store successful check timestamp
        localStorage.setItem(`lastSupplierCheck_${warehouseId}`, now.toString());

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
              createNotificationWithBackend('supplier_updated', { 
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
              createNotificationWithBackend('supplier_added', { 
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
        
      } catch (supplierError) {
        // Enhanced error handling with rate limiting
        if (supplierError.response?.status === 500) {
          console.warn('Supplier API temporarily unavailable (500 error) - will retry in 5 minutes');
          
          // Set rate limit to prevent immediate retries
          localStorage.setItem(`lastSupplierCheck_${warehouseId}`, now.toString());
          return newNotifications;
        } else {
          throw supplierError;
        }
      }

      // CHECK SUPPLIER RETURNS WITH WAREHOUSE FILTERING and API integration
      try {
        const returnResponse = await api.get(`/supplier-returns/?warehouse=${warehouseQueryParam}`, config);
        const returns = Array.isArray(returnResponse.data) ? returnResponse.data : returnResponse.data?.results || [];

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        returns.forEach(returnItem => {
          const returnId = `supplier-return-${returnItem.id}-${warehouseId}`;
          const returnDate = new Date(returnItem.created_at || returnItem.processed_at || returnItem.date_processed || now);
          
          // Check if this is a recent return
          if (returnDate > thirtyMinutesAgo && !processedIds.has(returnId)) {
            createNotificationWithBackend('supplier_return_processed', { 
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
        console.warn('Supplier returns API not available');
      }

      // 3. CHECK WAREHOUSE MSP (MERCHANDISING) OPERATIONS WITH VAN LOAD SUPPORT and API integration
      try {
        // Using warehouse utils for consistent MSP configuration
        const mspConfig = getWarehouseAxiosConfig(currentWarehouse);
        mspConfig.timeout = 5000;

        console.log('Checking MSP/Van Load notifications for warehouse:', warehouseQueryParam);
        
        const mspResponse = await api.get(`/merchandisings/?warehouse=${warehouseQueryParam}`, mspConfig);
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
                changes.push(`Status: ${previousMSP.status} -> ${msp.status}`);
              }
              if (previousMSP.expected_sale !== msp.expected_sale) {
                changes.push(`Expected Sale: \u20B1${Number(previousMSP.expected_sale || 0).toLocaleString()} -> \u20B1${Number(msp.expected_sale || 0).toLocaleString()}`);
              }
              if (previousMSP.actual_sale !== msp.actual_sale) {
                changes.push(`Actual Sale: \u20B1${Number(previousMSP.actual_sale || 0).toLocaleString()} -> \u20B1${Number(msp.actual_sale || 0).toLocaleString()}`);
              }
              if (previousMSP.handled_by !== msp.handled_by) {
                changes.push(`Handler: ${previousMSP.handled_by || 'N/A'} -> ${msp.handled_by || 'N/A'}`);
              }
              if (isVanLoad) {
                if (previousMSP.route !== msp.route) {
                  changes.push(`Route changed`);
                }
                if (previousMSP.van !== msp.van) {
                  changes.push(`Van changed`);
                }
              }

              createNotificationWithBackend('warehouse_msp_updated', { 
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
              
              createNotificationWithBackend('warehouse_msp_created', { 
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
        console.warn('MSP/Merchandising API not available:', mspError.message);
      }

      if (newNotifications > 0) {
        // FORCE UPDATE after creating supplier/warehouse notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
        console.log(`Created ${newNotifications} supplier/warehouse notifications`);
      }

    } catch (error) {
      // FIXED: Better error handling for supplier API failures
      if (error.response?.status === 500) {
        console.warn('Supplier API temporarily unavailable - will retry later');
      } else {
        console.warn('Supplier notifications check failed:', error.message);
      }
    }

    return newNotifications;
  }, [createNotificationWithBackend, currentWarehouse]);

  // Check products and returns/refunds notifications with warehouse filtering and API integration
  const checkProductsAndReturnsNotifications = useCallback(async (warehouseId, userRole, processedIds) => {
    let newNotifications = 0;

    // Only admin can see product and returns notifications
    if (userRole !== 'admin') {
      return newNotifications;
    }

    try {
      // Using warehouse utils for consistent configuration
      const config = getWarehouseAxiosConfig(currentWarehouse);
      config.timeout = 5000;

      const now = new Date().toISOString();
      const warehouseQueryParam = getWarehouseQueryParam(currentWarehouse);

      console.log('Checking product and returns notifications for admin in warehouse:', warehouseQueryParam);

      // CHECK PRODUCTS WITH WAREHOUSE FILTERING and API integration
      try {
        const productsResponse = await api.get(`/products/?warehouse=${warehouseQueryParam}`, config);
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
              
              createNotificationWithBackend('product_updated', { 
                ...product, 
                warehouse_id: warehouseId,
                changes: changes,
                updated_by: 'Admin'
              }, userRole);
            } else if (!previousProduct) {
              // NEW PRODUCT CREATED
              createNotificationWithBackend('product_created', { 
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
        console.warn('Products API not available');
      }

      if (newNotifications > 0) {
        // FORCE UPDATE after creating products/returns notifications
        setTimeout(() => setForceUpdate(prev => prev + 1), 200);
        console.log(`Created ${newNotifications} product/returns notifications`);
      }

    } catch (error) {
      console.warn('Products/returns notifications check failed:', error.message);
    }

    return newNotifications;
  }, [createNotificationWithBackend, currentWarehouse]);

  const checkReservedPickupDueNotifications = useCallback(async (warehouseIdArg = null, userRoleArg = null, processedIdsArg = null) => {
    const warehouseId = normalizeWarehouseId(warehouseIdArg ?? currentWarehouseId);
    const userRole = String(userRoleArg || getCurrentUser()?.role || '').trim().toLowerCase();
    const processedIds = processedIdsArg || processedIdsRef.current;

    if (!userDataReady || !warehouseId || !userRole) {
      return 0;
    }

    try {
      const config = {
        ...getWarehouseAxiosConfig(currentWarehouse),
        params: { warehouse: warehouseId },
        timeout: 5000,
      };
      const response = await api.get('/merchandisings/', config);
      const sales = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const todayPH = toManilaYmd(new Date());
      let newNotifications = 0;

      for (const sale of sales) {
        const transactionTypeName = String(
          sale.transaction_type_name || sale.transaction_type?.name || sale.transaction_type || ''
        ).trim().toLowerCase();
        const statusName = String(sale.status || '').trim().toLowerCase();
        const reservedDate = normalizeReservedDate(sale.reserved_date);

        if (transactionTypeName !== 'warehouse' || statusName !== 'reserved' || reservedDate !== todayPH) {
          continue;
        }

        const notificationSourceId = `pickup-due-${sale.id || sale.msp_no}-${reservedDate}-${warehouseId}`;
        if (processedIds.has(notificationSourceId)) {
          continue;
        }

        await createNotificationWithBackend('reserved_pickup_due', {
          id: notificationSourceId,
          sale_id: sale.id,
          msp_no: sale.msp_no,
          customer_name:
            sale.customer_name ||
            sale.customer?.name ||
            sale.customer_display_name ||
            'Reserved customer',
          handled_by:
            sale.handled_by_name ||
            sale.handled_by_username ||
            sale.handled_by ||
            'Unknown',
          reserved_date: reservedDate,
          warehouse_id: warehouseId,
          date_time: sale.date_time,
        }, userRole);

        processedIds.add(notificationSourceId);
        newNotifications += 1;
      }

      if (newNotifications > 0) {
        localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
        processedIdsRef.current = processedIds;
        setTimeout(() => setForceUpdate(prev => prev + 1), 300);
      }

      return newNotifications;
    } catch (error) {
      console.warn('Reserved pickup due notification check failed:', error.message);
      return 0;
    }
  }, [userDataReady, currentWarehouseId, currentWarehouse, getCurrentUser, createNotificationWithBackend]);

  // ENHANCED: Check ALL notification types when user performs actions with warehouse utils and API integration
  const checkNotificationsOnAction = useCallback(async () => {
    // Only proceed if user data is ready and we have a warehouse
    if (!userDataReady || !currentWarehouseId) {
      return;
    }

    console.log('Checking all notifications for warehouse:', currentWarehouseId);

    // First try to load from backend
    await loadNotificationsFromAPI();

    // First, always check stock notifications
    await checkStockNotifications();

    // Then check other notification types
    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    const warehouseId = currentWarehouseId;
    
    if (!userRole || !warehouseId) return;

    // Using warehouse utils for consistent configuration for all API calls
    const config = getWarehouseAxiosConfig(currentWarehouse);
    config.timeout = 5000;

    try {
      const apiCalls = [];
      const processedIds = processedIdsRef.current;
      let newNotifications = 0;
      
      // Add other API calls (receiving, etc.) using centralized API
      apiCalls.push(
        api.get(`/receiving/`, config).then(res => ({ type: 'receiving', data: res })).catch(() => null)
      );

      const reservedPickupNotifications = await checkReservedPickupDueNotifications(warehouseId, userRole, processedIds);
      newNotifications += reservedPickupNotifications;

      // NEW: CREDITS (All users can see their own credits, admin/supervisor see all)
      const creditNotifications = await checkCreditNotifications(warehouseId, userRole, processedIds);
      newNotifications += creditNotifications;

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
                createNotificationWithBackend('new_receiving', { ...receiving, warehouse_id: warehouseId }, userRole);
                processedIds.add(receivingId);
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
        console.log(`Total new notifications created: ${newNotifications}`);
      }

    } catch (error) {
      console.warn('General notifications check failed:', error.message);
    }
  }, [userDataReady, currentWarehouseId, getCurrentUser, createNotificationWithBackend, checkStockNotifications, checkReservedPickupDueNotifications, checkCreditNotifications, checkExpenseNotifications, checkSupplierNotifications, checkSystemNotifications, checkProductsAndReturnsNotifications, currentWarehouse, loadNotificationsFromAPI]);

  // ENHANCED: Action handlers with backend sync
  const markAllAsRead = async () => {
    const currentWarehouseNotifications = notifications.filter(notif => {
      if (isVanLoadEditApprovalNotification(notif)) {
        return false;
      }
      return isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId);
    });

    currentWarehouseNotifications.forEach(notification => {
      if (!notification.is_read) {
        dispatch({ type: 'MARK_AS_READ', payload: notification.id });
      }
    });

    // Also mark as read in backend
    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      await NotificationAPI.markAllAsRead(currentWarehouseId, config);
    } catch (error) {
      console.warn('Failed to mark all as read in backend:', error.message);
    }

    // FORCE UPDATE after marking all as read
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    setShowOptionsMenu(false);
  };

  // ENHANCED: Clear all notifications with backend sync
  const clearAllNotifications = async () => {
    const currentWarehouseNotifications = notifications.filter(notif => {
      if (isVanLoadEditApprovalNotification(notif)) {
        return false;
      }
      return isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId);
    });

    // FIXED: Track deleted notification IDs permanently
    const deletedNotificationIds = new Set(JSON.parse(localStorage.getItem('deletedNotificationIds') || '[]'));

    currentWarehouseNotifications.forEach(notification => {
      // Add to deleted IDs to prevent reappearing
      deletedNotificationIds.add(notification.id);
      
      if (notification.data) {
        const processedId = `${notification.type}-${notification.data.id}-${notification.data.warehouse_id || currentWarehouseId}`;
        processedIdsRef.current.add(processedId);
      }
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
    });

    // Also clear in backend
    try {
      const config = getWarehouseAxiosConfig(currentWarehouse);
      await NotificationAPI.clearAll(currentWarehouseId, config);
    } catch (error) {
      console.warn('Failed to clear all in backend:', error.message);
    }

    // FIXED: Save deleted notification IDs
    localStorage.setItem('deletedNotificationIds', JSON.stringify([...deletedNotificationIds]));
    localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIdsRef.current]));
    
    // FIXED: Also remove from warehouse-specific storage for admin
    const user = getCurrentUser();
    const userRole = user.role?.toLowerCase();
    
    if (userRole === 'admin' && currentWarehouseId) {
      const warehouseKey = `persistedNotifications_warehouse_${currentWarehouseId}`;
      const remainingNotifications = notifications.filter(notif => 
        !currentWarehouseNotifications.some(deleted => deleted.id === notif.id)
      );
      localStorage.setItem(warehouseKey, JSON.stringify(remainingNotifications));
    }
    
    // FORCE UPDATE after clearing all notifications
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    setShowOptionsMenu(false);
  };

  // ENHANCED: Update the getNotificationIcon function to include credit icons
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
      // ENHANCED: Credit notification icons
      'credit_created': faCreditCard,
      'credit_overdue': faExclamationCircle,
      'paid_credit': faCheck,
      'supplier_added': faUserTie,
      'supplier_updated': faEdit,
      'supplier_return_processed': faUndo,  
      'supplier_return': faUndo,
      'reserved_pickup_due': faCalendarAlt,
      'warehouse_msp_created': faClipboardList,
      'warehouse_msp_updated': faEdit,
      'van_load_edit_request': faClipboardList,
      'van_load_edit_decision': faCheck,
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

  // FIXED: Better warehouse change handling
  useEffect(() => {
    const handleWarehouseChange = async () => {
      const user = getCurrentUser();
      const userRole = user.role?.toLowerCase();
      const newWarehouse = getCurrentWarehouse();
      const newWarehouseId = normalizeWarehouseId(newWarehouse?.id);
      
      if (newWarehouseId && !isSameWarehouseId(newWarehouseId, currentWarehouseId)) {
        console.log('Admin warehouse changed:', { 
          old: currentWarehouseId, 
          new: newWarehouseId
        });
        
        setIsTransitioning(true);
        
        // FIXED: Save current notifications before switching
        if (userRole === 'admin' && currentWarehouseId) {
          const currentWarehouseNotifications = notifications.filter(notif => 
            isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId)
          );
          
          if (currentWarehouseNotifications.length > 0) {
            try {
              const warehouseKey = `persistedNotifications_warehouse_${currentWarehouseId}`;
              // FIXED: Merge with existing saved notifications instead of overwriting
              const existingSaved = JSON.parse(localStorage.getItem(warehouseKey) || '[]');
              const existingIds = new Set(existingSaved.map(n => n.id));
              const newNotifications = currentWarehouseNotifications.filter(n => !existingIds.has(n.id));
              const mergedSaved = [...existingSaved, ...newNotifications];
              
              localStorage.setItem(warehouseKey, JSON.stringify(mergedSaved));
              console.log(`Saved ${mergedSaved.length} total notifications for warehouse ${currentWarehouseId}`);
            } catch (error) {
              console.warn('Failed to save warehouse notifications');
            }
          }
        }
        
        // Invalidate pending async loads from the previous warehouse immediately.
        loadCycleRef.current += 1;
        currentWarehouseIdRef.current = newWarehouseId;

        // Update current warehouse state
        setCurrentWarehouse(newWarehouse);
        setCurrentWarehouseId(newWarehouseId);
        setIsLoaded(false); // Reset loading state to trigger reload
        
        // Force update and reload
        setTimeout(() => {
          setForceUpdate(prev => prev + 1);
          setIsTransitioning(false);
        }, 300);
      }
    };

    window.addEventListener('warehouseChanged', handleWarehouseChange);
    return () => window.removeEventListener('warehouseChanged', handleWarehouseChange);
  }, [currentWarehouseId, notifications, getCurrentUser, getCurrentWarehouse]);

  // NEW: Load notifications from backend on mount and warehouse change
  useEffect(() => {
    if (isLoaded && userDataReady && currentWarehouseId) {
      loadNotificationsFromAPI();
    }
  }, [isLoaded, userDataReady, currentWarehouseId, loadNotificationsFromAPI]);

  // NEW: Periodic cleanup, credit due date checking, and reserved pickup due alerts
  useEffect(() => {
    if (!isLoaded || !userDataReady || !currentWarehouseId) return;

    // Cleanup old notifications every hour
    const cleanupInterval = setInterval(cleanupOldNotifications, 60 * 60 * 1000);
    
    // Check credit due dates every 30 minutes
    const creditCheckInterval = setInterval(checkCreditDueDates, 30 * 60 * 1000);
    const reservedPickupInterval = setInterval(checkReservedPickupDueNotifications, 30 * 60 * 1000);
    
    // Initial checks
    cleanupOldNotifications();
    checkCreditDueDates();
    checkReservedPickupDueNotifications();

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(creditCheckInterval);
      clearInterval(reservedPickupInterval);
    };
  }, [isLoaded, userDataReady, currentWarehouseId, cleanupOldNotifications, checkCreditDueDates, checkReservedPickupDueNotifications]);

  // ================================
  // CRITICAL MODIFICATION SECTION - PRODUCT EVENT LISTENER WITH WAREHOUSE ISOLATION
  // ================================
  
  // FIXED: Listen for product management events with WAREHOUSE ISOLATION
  useEffect(() => {
    const handleProductUpdate = (event) => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          const detail = event.detail;
          
          // CRITICAL: Only process if event is for CURRENT warehouse
          const productWarehouseId = parseInt(detail.warehouseId || detail.warehouse_id);
          const currentWarehouseInt = parseInt(currentWarehouseId);
          
          console.log(`PRODUCT EVENT:`, {
            productWarehouse: productWarehouseId,
            adminCurrentWarehouse: currentWarehouseInt,
            productName: detail.productName,
            shouldShow: productWarehouseId === currentWarehouseInt
          });
          
          // ABSOLUTE FILTER: Only show if warehouses match exactly
          if (!productWarehouseId || productWarehouseId !== currentWarehouseInt) {
            console.log(`BLOCKED: Product from warehouse ${productWarehouseId}, admin viewing ${currentWarehouseInt}`);
            return; // Don't create notification for other warehouses
          }
          
          // Additional check: Ignore if restrictToWarehouse is true but doesn't match
          if (detail.restrictToWarehouse && detail.targetWarehouse !== currentWarehouseInt) {
            console.log(`RESTRICTED: Event only for warehouse ${detail.targetWarehouse}`);
            return;
          }
          
          // Time-based filter: Ignore old events (prevent stale notifications)
          if (detail.metadata?.event_timestamp) {
            const eventAge = Date.now() - detail.metadata.event_timestamp;
            if (eventAge > 30000) { // 30 seconds max
              console.log(`⏰ IGNORED: Event too old (${eventAge}ms)`);
              return;
            }
          }
          
          console.log(`ALLOWED: Creating notification for warehouse ${currentWarehouseInt}`);
          
          const notificationData = {
            id: detail.productId,
            product_name: detail.productName,
            product_code: detail.productCode,
            category: detail.category,
            selling_price: detail.price,
            warehouse_id: currentWarehouseInt, // Force current warehouse
            created_at: new Date().toISOString(),
            changes: detail.changes,
            updated_by: detail.createdBy || user.username || user.name || 'Admin'
          };
          
          createNotificationWithBackend(detail.action === 'created' ? 'product_created' : 'product_updated', notificationData, userRole);
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    const handleSupplierUpdate = (event) => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (['admin', 'supervisor'].includes(userRole)) {
          const detail = event.detail;
          
          // SUPER STRICT: Only create notification if warehouse IDs match exactly
          const supplierWarehouseId = parseInt(detail.warehouseId || detail.warehouse_id);
          const currentWarehouse = parseInt(currentWarehouseId);
          
          if (!supplierWarehouseId || supplierWarehouseId !== currentWarehouse) {
            console.log(`ADMIN NOTIFICATION BLOCKED - Supplier warehouse: ${supplierWarehouseId}, Admin current warehouse: ${currentWarehouse}`);
            return; // Block notification for other warehouses
          }
          
          console.log(`ADMIN NOTIFICATION ALLOWED - Creating notification for warehouse: ${currentWarehouse}`);
          
          const notificationData = {
            id: detail.supplierId,
            name: detail.supplierName,
            company_name: detail.supplierName,
            contact_number: detail.contactNumber,
            address: detail.address,
            email: detail.email,
            warehouse_id: currentWarehouse, // Use current warehouse for filtering
            updated_at: new Date().toISOString(),
            changes: detail.changes,
            updated_by: detail.createdBy || user.username || user.name || 'Admin'
          };
          
          createNotificationWithBackend(detail.action === 'created' ? 'supplier_added' : 'supplier_updated', notificationData, userRole);
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    // Listen to multiple event types for better coverage
    window.addEventListener('productUpdated', handleProductUpdate);
    window.addEventListener('productCreated', handleProductUpdate);
    window.addEventListener('productAdded', handleProductUpdate);
    window.addEventListener('supplierUpdated', handleSupplierUpdate);
    window.addEventListener('supplierCreated', handleSupplierUpdate);
    window.addEventListener('supplierAdded', handleSupplierUpdate);
    
    return () => {
      window.removeEventListener('productUpdated', handleProductUpdate);
      window.removeEventListener('productCreated', handleProductUpdate);
      window.removeEventListener('productAdded', handleProductUpdate);
      window.removeEventListener('supplierUpdated', handleSupplierUpdate);
      window.removeEventListener('supplierCreated', handleSupplierUpdate);
      window.removeEventListener('supplierAdded', handleSupplierUpdate);
    };
  }, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId]);
  
  // ================================
  // END CRITICAL MODIFICATION SECTION
  // ================================

  // Listen for Van Load update events with immediate notification creation
  useEffect(() => {
    const handleVanLoadUpdate = (event) => {
      if (isLoaded && userDataReady) {
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
            warehouse_id: currentWarehouseId,
            updated_at: new Date().toISOString(),
            is_van_load: true,
            changes_summary: detail.summary || `Van Load ${detail.action}`,
            action_type: detail.action
          };
          
          // Add notification immediately with backend sync
          createNotificationWithBackend('warehouse_msp_updated', notificationData, userRole);
          
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
  }, [checkNotificationsOnAction, isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId]);

  // Listen for Van Load and Warehouse MSP creation events
  useEffect(() => {
    const handleVanLoadCreated = (event) => {
      if (isLoaded && userDataReady) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (['admin', 'supervisor'].includes(userRole)) {
          const detail = event.detail;
          
          // Create immediate notification for Van Load creation
          const notificationData = {
            id: detail.id,
            msp_no: detail.msp_no,
            transaction_type_name: 'Van Load',
            handled_by: detail.handled_by,
            route: detail.route,
            van: detail.van,
            expected_sale: detail.expected_sale || 0,
            warehouse_id: detail.warehouse_id,
            created_at: new Date().toISOString(),
            is_van_load: true,
            creation_type: 'Van Load',
            status: 'Pending'
          };
          
          // Add notification immediately with backend sync
          createNotificationWithBackend('warehouse_msp_created', notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    const handleWarehouseMspCreated = (event) => {
      if (isLoaded && userDataReady) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (['admin', 'supervisor'].includes(userRole)) {
          const detail = event.detail;
          
          // Create immediate notification for Warehouse MSP creation
          const notificationData = {
            id: detail.id,
            msp_no: detail.msp_no,
            transaction_type_name: detail.transaction_type_name,
            handled_by: detail.handled_by,
            customer: detail.customer,
            expected_sale: detail.expected_sale || 0,
            actual_sale: detail.actual_sale || 0,
            warehouse_id: detail.warehouse_id,
            created_at: new Date().toISOString(),
            is_van_load: false,
            creation_type: detail.transaction_type_name,
            status: 'Complete'
          };
          
          // Add notification immediately with backend sync
          createNotificationWithBackend('warehouse_msp_created', notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    window.addEventListener('vanLoadCreated', handleVanLoadCreated);
    window.addEventListener('warehouseMspCreated', handleWarehouseMspCreated);
    
    return () => {
      window.removeEventListener('vanLoadCreated', handleVanLoadCreated);
      window.removeEventListener('warehouseMspCreated', handleWarehouseMspCreated);
    };
  }, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId]);

  // NEW: Listen for credit-related events
  useEffect(() => {
    const handleCreditCreated = (event) => {
      if (isLoaded && userDataReady) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const detail = event.detail;
        
        // Create immediate notification for credit creation
        const notificationData = {
          id: detail.id,
          msp_no: detail.msp_no,
          customer_name: detail.customer_name,
          balance: detail.balance || detail.amount,
          due_date: detail.due_date,
          credit_terms: detail.credit_terms || 30,
          warehouse_id: detail.warehouse_id || currentWarehouseId,
          created_at: new Date().toISOString(),
          created_by: detail.created_by || user.id
        };
        
        // Add notification immediately with backend sync
        createNotificationWithBackend('credit_created', notificationData, userRole);
        
        // FORCE UPDATE after immediate notification
        setTimeout(() => setForceUpdate(prev => prev + 1), 100);
      }
    };

    const handleCreditPaid = (event) => {
      if (isLoaded && userDataReady) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        const detail = event.detail;
        
        // Create immediate notification for credit payment
        const notificationData = {
          id: detail.id,
          msp_no: detail.msp_no,
          customer_name: detail.customer_name,
          balance: detail.balance || detail.amount,
          payment_amount: detail.payment_amount || detail.balance,
          payment_method: detail.payment_method || 'Cash',
          warehouse_id: detail.warehouse_id || currentWarehouseId,
          updated_at: new Date().toISOString(),
          payment_date: new Date().toISOString()
        };
        
        // Add notification immediately with backend sync
        createNotificationWithBackend('paid_credit', notificationData, userRole);
        
        // FORCE UPDATE after immediate notification
        setTimeout(() => setForceUpdate(prev => prev + 1), 100);
      }
    };

    // ENHANCED: Listen for credit payment notifications from external events
    const handleCreditPaymentReceived = (event) => {
      if (isLoaded && userDataReady) {
        const detail = event.detail;
        
        triggerCreditNotification({
          id: detail.creditId,
          msp_no: detail.mspNo,
          customer_name: detail.customerName,
          balance: detail.paidAmount,
          payment_amount: detail.paidAmount,
          payment_method: detail.paymentMethod || 'Cash',
          payment_date: new Date().toISOString(),
          warehouse_id: detail.warehouseId || currentWarehouseId
        }, 'paid');
      }
    };

    window.addEventListener('creditCreated', handleCreditCreated);
    window.addEventListener('creditPaid', handleCreditPaid);
    window.addEventListener('creditPaymentReceived', handleCreditPaymentReceived);
    
    return () => {
      window.removeEventListener('creditCreated', handleCreditCreated);
      window.removeEventListener('creditPaid', handleCreditPaid);
      window.removeEventListener('creditPaymentReceived', handleCreditPaymentReceived);
    };
  }, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId, triggerCreditNotification]);

// ENHANCED: Listen for receiving save events with immediate notification creation AND persistence
useEffect(() => {
  const handleReceivingSaved = (event) => {
    if (isLoaded && userDataReady && currentWarehouseId) {
      const user = getCurrentUser();
      const userRole = user.role?.toLowerCase();
      const detail = event.detail;
      
      console.log('RECEIVING SAVED EVENT:', detail);
      
      // CRITICAL: Only process if event is for CURRENT warehouse
      const receivingWarehouseId = parseInt(detail.warehouse_id || detail.warehouseId);
      const currentWarehouseInt = parseInt(currentWarehouseId);
      
      if (!receivingWarehouseId || receivingWarehouseId !== currentWarehouseInt) {
        console.log(`BLOCKED: Receiving from warehouse ${receivingWarehouseId}, user viewing ${currentWarehouseInt}`);
        return;
      }
      
      console.log(`ALLOWED: Creating receiving notification for warehouse ${currentWarehouseInt}`);
      
      // Create immediate notification for receiving
      const notificationData = {
        id: detail.id || detail.receivingId,
        receiving_no: detail.receiving_no || detail.receivingNo,
        supplier_name: detail.supplier_name || detail.supplierName || 'Unknown Supplier',
        total_amount: detail.total_amount || detail.totalAmount || 0,
        items_count: detail.items_count || detail.itemsCount || 0,
        warehouse_id: currentWarehouseInt,
        date_time: detail.date_time || detail.dateTime || new Date().toISOString(),
        created_at: new Date().toISOString(),
        created_by: detail.created_by || detail.createdBy || user.username || user.name || 'Unknown',
        status: detail.status || 'Completed'
      };
      
      // Create notification with backend sync
      createNotificationWithBackend('new_receiving', notificationData, userRole);
      
      // FORCE PERSISTENCE: Also mark as processed to avoid duplicates
      setTimeout(() => {
        try {
          const processedIds = processedIdsRef.current;
          const processedId = `receiving-${notificationData.id}-${currentWarehouseInt}`;
          processedIds.add(processedId);
          localStorage.setItem('processedNotificationIds', JSON.stringify([...processedIds]));
          
        } catch (error) {
          console.warn('Failed to persist receiving notification:', error);
        }
        
        setForceUpdate(prev => prev + 1);
      }, 200);
    }
  };

  window.addEventListener('receivingSaved', handleReceivingSaved);
  window.addEventListener('receivingCreated', handleReceivingSaved);
  window.addEventListener('receivingCompleted', handleReceivingSaved);
  
  return () => {
    window.removeEventListener('receivingSaved', handleReceivingSaved);
    window.removeEventListener('receivingCreated', handleReceivingSaved);
    window.removeEventListener('receivingCompleted', handleReceivingSaved);
  };
}, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId]);

  // Listen for role permission updates with immediate notification creation
  useEffect(() => {
    const handleRolePermissionUpdate = (event) => {
      if (isLoaded && userDataReady) {
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
            warehouse_id: currentWarehouseId,
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
          
          // Add notification immediately with backend sync
          createNotificationWithBackend('role_updated', notificationData, userRole);
          
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
  }, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId, checkNotificationsOnAction]);

  // Listen for admin settings change events with immediate notification creation
  useEffect(() => {
    const handleAdminSettingsUpdate = (event) => {
      if (isLoaded && userDataReady) {
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
            warehouse_id: currentWarehouseId,
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
          
          // Add notification immediately with backend sync
          createNotificationWithBackend('admin_settings_changed', notificationData, userRole);
          
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
  }, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId, checkNotificationsOnAction]);

  // Listen for product management events
  useEffect(() => {
    const handleReturnUpdate = (event) => {
      if (isLoaded && userDataReady) {
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
            warehouse_id: currentWarehouseId,
            processed_at: new Date().toISOString(),
            refund_method: detail.method || 'Cash'
          };
          
          // Add notification immediately with backend sync
          const notificationType = detail.action === 'refund' ? 'refund_issued' : 
                                 detail.action === 'rejected' ? 'return_rejected' : 'return_processed';
          createNotificationWithBackend(notificationType, notificationData, userRole);
          
          // FORCE UPDATE after immediate notification
          setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
      }
    };

    window.addEventListener('returnProcessed', handleReturnUpdate);
    
    return () => {
      window.removeEventListener('returnProcessed', handleReturnUpdate);
    };
  }, [isLoaded, userDataReady, createNotificationWithBackend, getCurrentUser, currentWarehouseId]);

  // ENHANCED: Listen for user login events with warehouse utils integration
  useEffect(() => {
    const handleUserLogin = () => {
      // Set login time for tracking
      localStorage.setItem('loginTime', Date.now().toString());
      
      if (isLoaded && userDataReady && currentWarehouseId) {
        // Wait for user data to be properly established
        setTimeout(() => {
          checkLowStockOnLogin();
        }, 3000);
      } else {
        // If not ready yet, set a flag to check later
        localStorage.setItem('pendingLoginNotificationCheck', 'true');
      }
    };

    const handleSessionRestore = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        setTimeout(() => {
          checkLowStockOnLogin();
        }, 2000);
      } else {
        // If not ready yet, set a flag to check later
        localStorage.setItem('pendingLoginNotificationCheck', 'true');
      }
    };

    window.addEventListener('userLoggedIn', handleUserLogin);
    window.addEventListener('userSessionRestored', handleSessionRestore);
    
    return () => {
      window.removeEventListener('userLoggedIn', handleUserLogin);
      window.removeEventListener('userSessionRestored', handleSessionRestore);
    };
  }, [isLoaded, userDataReady, currentWarehouseId, checkLowStockOnLogin]);

  // ENHANCED: Check for login stock notifications when all dependencies are ready
  useEffect(() => {
    if (isLoaded && userDataReady && currentWarehouseId) {
      // Check if this is a fresh login session (within last 2 minutes) OR if there's a pending check
      const loginTime = localStorage.getItem('loginTime');
      const pendingCheck = localStorage.getItem('pendingLoginNotificationCheck');
      const now = Date.now();
      const isRecentLogin = loginTime && (now - parseInt(loginTime)) < 120000; // 2 minutes
      
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
  }, [isLoaded, userDataReady, currentWarehouseId, checkLowStockOnLogin]);

  // Listen for user activities that might trigger notifications
  useEffect(() => {
    const handleUserActivity = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        checkNotificationsOnAction();
      }
    };

    const events = ['click', 'focus', 'online'];

    // Handle visibility change separately
    const handleVisibilityChange = () => {
      if (!document.hidden && isLoaded && userDataReady && currentWarehouseId) {
        handleUserActivity();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check when notification dropdown is opened
    if (isOpen && isLoaded && userDataReady && currentWarehouseId) {
      checkNotificationsOnAction();
    }

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkNotificationsOnAction, isOpen, isLoaded, userDataReady, currentWarehouseId]);

  // NEW: Listen for credit page visits to check overdue credits
  useEffect(() => {
    const handleCreditsPageVisit = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        // All users can see their own credits, admin/supervisor see all
        checkCreditNotifications(currentWarehouseId, userRole, processedIdsRef.current);
      }
    };

    window.addEventListener('creditsPageVisited', handleCreditsPageVisit);
    
    return () => {
      window.removeEventListener('creditsPageVisited', handleCreditsPageVisit);
    };
  }, [checkCreditNotifications, isLoaded, userDataReady, currentWarehouseId, getCurrentUser]);

  // Listen for page-specific visits with warehouse awareness
  useEffect(() => {
    const handleStocksPageVisit = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        checkStockNotifications();
      }
    };

    const handleExpensesPageVisit = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (['admin', 'supervisor'].includes(userRole)) {
          checkExpenseNotifications(currentWarehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    const handleSuppliersPageVisit = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (['admin', 'supervisor'].includes(userRole)) {
          checkSupplierNotifications(currentWarehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    const handleAdminPageVisit = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          checkSystemNotifications(currentWarehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    const handleProductsPageVisit = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        if (userRole === 'admin') {
          checkProductsAndReturnsNotifications(currentWarehouseId, userRole, processedIdsRef.current);
        }
      }
    };

    // Add event listeners for page visits
    window.addEventListener('stocksPageVisited', handleStocksPageVisit);
    window.addEventListener('expensesPageVisited', handleExpensesPageVisit);
    window.addEventListener('suppliersPageVisited', handleSuppliersPageVisit);
    window.addEventListener('adminPageVisited', handleAdminPageVisit);
    window.addEventListener('settingsPageVisited', handleAdminPageVisit);
    window.addEventListener('userManagementPageVisited', handleAdminPageVisit);
    window.addEventListener('rolesPageVisited', handleAdminPageVisit);
    window.addEventListener('productsPageVisited', handleProductsPageVisit);
    window.addEventListener('returnsPageVisited', handleProductsPageVisit);
    
    return () => {
      window.removeEventListener('stocksPageVisited', handleStocksPageVisit);
      window.removeEventListener('expensesPageVisited', handleExpensesPageVisit);
      window.removeEventListener('suppliersPageVisited', handleSuppliersPageVisit);
      window.removeEventListener('adminPageVisited', handleAdminPageVisit);
      window.removeEventListener('settingsPageVisited', handleAdminPageVisit);
      window.removeEventListener('userManagementPageVisited', handleAdminPageVisit);
      window.removeEventListener('rolesPageVisited', handleAdminPageVisit);
      window.removeEventListener('productsPageVisited', handleProductsPageVisit);
      window.removeEventListener('returnsPageVisited', handleProductsPageVisit);
    };
  }, [checkStockNotifications, checkExpenseNotifications, checkSupplierNotifications, checkSystemNotifications, checkProductsAndReturnsNotifications, isLoaded, userDataReady, currentWarehouseId, getCurrentUser]);

  // Keep inventory alerts in sync with Stocks.jsx and transaction stock updates
  useEffect(() => {
    const handleNewStockNotification = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        setTimeout(() => {
          checkStockNotifications();
        }, 150);
      }
    };

    const handleStockThresholdsChanged = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        setTimeout(() => {
          checkStockNotifications();
        }, 200);
      }
    };

    const handleStocksChanged = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        setTimeout(() => {
          checkStockNotifications();
        }, 150);
      }
    };

    window.addEventListener('newStockNotification', handleNewStockNotification);
    window.addEventListener('stockThresholdsChanged', handleStockThresholdsChanged);
    window.addEventListener('stocksChanged', handleStocksChanged);

    return () => {
      window.removeEventListener('newStockNotification', handleNewStockNotification);
      window.removeEventListener('stockThresholdsChanged', handleStockThresholdsChanged);
      window.removeEventListener('stocksChanged', handleStocksChanged);
    };
  }, [checkStockNotifications, isLoaded, userDataReady, currentWarehouseId]);

  // Listen for page navigation/route changes
  useEffect(() => {
    const handlePageChange = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        setTimeout(() => checkNotificationsOnAction(), 2000);
      }
    };

    window.addEventListener('popstate', handlePageChange);
    
    // Initial check on mount (after all dependencies are ready)
    if (isLoaded && userDataReady && currentWarehouseId) {
      setTimeout(() => checkNotificationsOnAction(), 3000);
    }

    return () => {
      window.removeEventListener('popstate', handlePageChange);
    };
  }, [checkNotificationsOnAction, isLoaded, userDataReady, currentWarehouseId]);

  // NEW: Daily overdue credit check
  useEffect(() => {
    const checkOverdueCreditsDaily = () => {
      if (isLoaded && userDataReady && currentWarehouseId) {
        const user = getCurrentUser();
        const userRole = user.role?.toLowerCase();
        
        // Trigger credit notifications check for overdue credits
        checkCreditNotifications(currentWarehouseId, userRole, processedIdsRef.current);
      }
    };

    // Check overdue credits on mount and then every hour
    const checkOverdueInterval = setInterval(checkOverdueCreditsDaily, 60 * 60 * 1000); // Every hour

    // Initial check
    if (isLoaded && userDataReady && currentWarehouseId) {
      checkOverdueCreditsDaily();
    }

    return () => {
      clearInterval(checkOverdueInterval);
    };
  }, [isLoaded, userDataReady, currentWarehouseId, checkCreditNotifications, getCurrentUser]);

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

  // ENHANCED: Better warehouse name display with transition and admin handling
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

  // ENHANCED: Better notification count calculation for admin with warehouse context
  const currentWarehouseUnreadCount = React.useMemo(() => {
    const user = getCurrentUser();
    const userRole = String(user.role || '').toLowerCase();
    const isAdminRole = ['admin', 'administrator', 'super admin'].includes(userRole) || userRole.includes('admin');
    
    if (!currentWarehouseId) {
      return 0;
    }
    
    const count = notifications.filter(notif => {
      if (isVanLoadEditApprovalNotification(notif)) {
        return false;
      }

      const isUnread = !notif.is_read;
      if (!isUnread) return false;
      
      // Check warehouse filtering
      const isCurrentWarehouse = isSameWarehouseId(
        resolveNotificationWarehouseId(notif),
        currentWarehouseId
      );
      
      // ADMIN: Show notifications for current warehouse
      if (isAdminRole) {
        return isCurrentWarehouse;
      }
      
      // NON-ADMIN: Show only notifications for their assigned warehouse with permission check
      if (['supervisor', 'cashier', 'staff'].includes(userRole) && isCurrentWarehouse) {
        // Check if user has permission for this notification type
        const hasPermission = hasNotificationPermission?.(notif.type, userRole);
        
        // For credit notifications, also check if it's their own or if they can see all
        if (['credit_created', 'credit_overdue', 'paid_credit'].includes(notif.type)) {
          const isOwnCredit = (notif.data?.created_by === user.id || notif.data?.user_id === user.id);
          const canSeeAllCredits = isAdminRole || userRole === 'supervisor';
          
          return hasPermission && (isOwnCredit || canSeeAllCredits);
        }
        
        return hasPermission;
      }
      
      return false;
    }).length;
    
    return count;
  }, [notifications, currentWarehouseId, getCurrentUser, hasNotificationPermission]);

  const allNotificationsCount = React.useMemo(() => {
    if (!currentWarehouseId) return 0;
    return notifications.filter((notif) => {
      if (isVanLoadEditApprovalNotification(notif)) return false;
      return isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId);
    }).length;
  }, [notifications, currentWarehouseId]);

  const pendingApprovalRequestsForCurrentWarehouse = React.useMemo(() => {
    if (!isAdminUser() || !currentWarehouseId) return [];
    return pendingVanLoadApprovalRequests.filter((requestItem) => (
      Number(requestItem.warehouse_id || 0) === Number(currentWarehouseId) &&
      String(requestItem.status || '').toLowerCase() === 'pending'
    ));
  }, [pendingVanLoadApprovalRequests, currentWarehouseId, isAdminUser]);

  const approvalTabItems = React.useMemo(() => (
    pendingApprovalRequestsForCurrentWarehouse.map((requestItem) =>
      mapApprovalRequestToNotification(requestItem, currentWarehouseId)
    )
  ), [pendingApprovalRequestsForCurrentWarehouse, currentWarehouseId]);

  const filteredNotifications = React.useMemo(() => {
    if (activeTab === 'approval') {
      return [];
    }

    const baseList = activeTab === 'all'
      ? notifications
      : notifications.filter((notif) => !notif.is_read);

    return baseList.filter((notif) => {
      if (isVanLoadEditApprovalNotification(notif)) {
        return false;
      }

      return isSameWarehouseId(resolveNotificationWarehouseId(notif), currentWarehouseId);
    });

  }, [activeTab, notifications, currentWarehouseId]);

  const isApprovalTab = activeTab === 'approval';
  const activeTabNotifications = isApprovalTab ? approvalTabItems : filteredNotifications;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Icon with transition effect */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (closeProfile) closeProfile();
          }}
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
                  All ({allNotificationsCount})
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
                {isAdminUser() && (
                  <button
                    onClick={() => setActiveTab('approval')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      activeTab === 'approval'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Approval ({pendingApprovalRequestsForCurrentWarehouse.length})
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List - ENHANCED LOADING STATES */}
            <div className="max-h-96 overflow-y-auto">
              {!isLoaded || !userDataReady ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faBell} className="text-2xl text-gray-400 dark:text-gray-500 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {isTransitioning ? 'Switching Warehouse...' : 'Loading Notifications...'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                    {isTransitioning 
                      ? `Loading notifications for ${getCurrentWarehouseName()}...` 
                      : 'Setting up notification system with warehouse utils...'
                    }
                  </p>
                </div>
              ) : activeTabNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={activeTab === 'unread' ? faBellSlash : faBell}
                      className="text-2xl text-gray-400 dark:text-gray-500"
                    />
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {activeTab === 'approval'
                      ? 'No Pending Requests'
                      : activeTab === 'unread'
                        ? 'All Caught Up!'
                        : 'No Notifications Here'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeTab === 'approval'
                      ? 'No pending Van Load edit approvals for ' + getCurrentWarehouseName()
                      : activeTab === 'unread'
                        ? 'No unread notifications for ' + getCurrentWarehouseName()
                        : 'No notifications for ' + getCurrentWarehouseName() + ' right now.'}
                  </p>
                </div>
              ) : (
                activeTabNotifications.map((notification) => (
                  <div
                    key={`${notification.id}-${forceUpdate}`}
                    onClick={() => {
                      if (isApprovalTab) {
                        setSelectedNotification(notification);
                        setShowDetailModal(true);
                        return;
                      }
                      handleNotificationClick(notification);
                    }}
                    className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                      (isApprovalTab || !notification.is_read) ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
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
                                {notification.type === 'van_load_edit_request' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                                  APPROVAL
                                </span>
                              )}
                              {notification.type === 'van_load_edit_decision' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                                  DECISION
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
      {showDetailModal && selectedNotification && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center z-[9999] p-4 sm:p-6 overflow-y-auto">
          <div className="notification-detail-modal my-16 sm:my-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
                        {selectedNotification.type === 'van_load_edit_request' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                          Approval Request
                        </span>
                      )}
                      {selectedNotification.type === 'van_load_edit_decision' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                          Decision
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
            <div ref={detailModalBodyRef} className="p-6 flex-1 overflow-y-auto">
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

                {isAdminUser() && isPendingVanLoadEditRequest(selectedNotification) && (
                  <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-orange-900 dark:text-orange-200 mb-2">
                      Approval Action
                    </h3>
                    <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
                      Approve to unlock Van Load edit for cashier, or reject to keep access blocked.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white text-sm disabled:opacity-50"
                        onClick={() => handleVanLoadEditDecision(selectedNotification, 'reject')}
                        disabled={approvalActionRequestId === selectedNotification.data?.request_id}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
                        onClick={() => handleVanLoadEditDecision(selectedNotification, 'approve')}
                        disabled={approvalActionRequestId === selectedNotification.data?.request_id}
                      >
                        {approvalActionRequestId === selectedNotification.data?.request_id ? 'Processing...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Notification;


