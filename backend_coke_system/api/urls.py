from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .mobile_orders import MobileOrderConfirmView, MobileOrderDetailView, MobileOrderListView
from .mobile_van_loads import MobileVanLoadPrepareView, MobileVanLoadDispatchView, MobileVanLoadReturnView, MobileVanLoadDetailView
from .mobile_deliveries import MobileDeliveryAddressView, MobileDeliveryListCreateView
from .promotions import ActivePromotionListView, PromotionListCreateView
from .views import (
    WarehouseListCreateView, WarehouseDetailView,
    SupplierListCreateView, SupplierRetrieveUpdateDestroyView,
    UserListCreateView, UserDetailView,
    RoleListCreateView, RoleDetailView,  # Added Role views
    ShellTypeListCreateView,
    ContentTypeListCreateView,
    UnitTypeListCreateView,
    UnitTypeDetailView,
    PricingListCreateView,
    PricingDetailView,
    ProductListCreateView,
    ProductDetailView,
    VanListCreateView,
    VanRetrieveUpdateDestroyView,
    ProductCategoryListCreateView,
    ProductCategoryDetailView,
    next_product_code,  # Import views for next_product_code
    ReceivingListCreateView,
    ReceivingDetailView,
    StockListCreateView, 
    StockDetailView,
     RouteListCreateView, TransactionTypeListCreateView, TransactionTypeDetailView,
    MerchandisingListCreateView, MerchandisingDetailView,
    MerchandisingItemListCreateView, MerchandisingItemDetailView,
    MiscellaneousItemListCreateView, MiscellaneousItemDetailView,
    PaymentListCreateView, PaymentDetailView,
    ReturnableStockListCreateView, ReturnableStockDetailView,
    SupplierReturnListCreateView, SupplierReturnDetailView,
    SupplierReturnItemListCreateView, SupplierReturnItemDetailView, 
    NextMspNoView, StockAvailabilityView, UpdateStockView, MerchandisingListView,
    CustomerListCreateView, CustomerRetrieveUpdateDestroyView, restore_stock, LoginAPIView, RoleAccessibilityListView ,
    RoleAccessibilityDetailView, BulkRoleAccessibilityCreateView, BulkRoleAccessibilityUpsertView, ChangePasswordAPIView, SendOTPAPIView,
    VerifyOTPAPIView, MerchandisingViewSet,VanLoadReturnUpdateAPIView,  CreditLedgerListCreateAPIView,
    CreditLedgerDetailAPIView,
    CreditPaymentCreateAPIView,BulkAdjustStockView, StockUpdateAPIView, ConfirmUserCreation, RegisterView, MandatoryChangePasswordAPIView,
    CancelPendingSignupAPIView,
    VanLoadEditApprovalRequestCreateAPIView, VanLoadEditApprovalStatusAPIView,
    VanLoadEditApprovalPendingListAPIView, VanLoadEditApprovalDecisionAPIView


)
from .views import warehouse_groups_view, warehouse_details_view

from .views import (
    HolidayViewSet,
    ForecastViewSet, GenerateForecastAPIView
)

from .views import SupplierReturnFormListCreateView
from .views import SupplierReturnFormDetailView
from .views import ProcessEmptiesReturnView


#from .views_reports import RevenueSummaryView, SalesAndReturnables, SalesReportAPIView
from .views_reports import SalesReportAPIView, ProductBreakdownReport
from .views import (
    NotificationViewSet, NotificationPreferenceViewSet, 
    CreateNotificationAPIView, NotificationCleanupAPIView
)

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'notification-preferences', NotificationPreferenceViewSet, basename='notification-preference')


urlpatterns = [
    path('mobile-orders/van-load/', MobileVanLoadPrepareView.as_view(), name='mobile-van-load-prepare'),
    path('mobile-van-loads/<uuid:batch_id>/dispatch/', MobileVanLoadDispatchView.as_view(), name='mobile-van-load-dispatch'),
    path('mobile-van-loads/<uuid:batch_id>/return/', MobileVanLoadReturnView.as_view(), name='mobile-van-load-return'),
    path('mobile-van-loads/<uuid:batch_id>/', MobileVanLoadDetailView.as_view(), name='mobile-van-load-detail'),
    path('promotions/', PromotionListCreateView.as_view(), name='promotion-list-create'),
    path('promotions/active/', ActivePromotionListView.as_view(), name='active-promotions'),
    # User URLs
    path('register/', RegisterView.as_view(), name='register'),
    path('users/', UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='change-password'),

     # Forgot password (email or old flow)
    path('forgot-password/send-otp/', SendOTPAPIView.as_view(), name='send-otp'),
    path('forgot-password/verify-otp/', VerifyOTPAPIView.as_view(), name='verify-otp'),

     # Phone OTP for signup verification
    path('send-phone-otp/', SendOTPAPIView.as_view(), name='send-phone-otp'),
    path('verify-phone-otp/', VerifyOTPAPIView.as_view(), name='verify-phone-otp'),
    path('cancel-phone-signup/', CancelPendingSignupAPIView.as_view(), name='cancel-phone-signup'),
    # --- CREDIT LEDGER ---
    path("credits/", CreditLedgerListCreateAPIView.as_view(), name="credit-list-create"),  # GET list, POST create
    path("credits/<int:pk>/", CreditLedgerDetailAPIView.as_view(), name="credit-detail"),  # GET detail/receipt
    path("credits/<int:pk>/payments/", CreditPaymentCreateAPIView.as_view(), name="credit-add-payment"),  # POST payment


    # New Role URLs
    path('role-access/', RoleAccessibilityListView.as_view(), name='role-access-list'),
    path('role-access/<int:pk>/', RoleAccessibilityDetailView.as_view(), name='role-access-detail'),
    path('role-access/bulk-create/', BulkRoleAccessibilityCreateView.as_view(), name='bulk-role-access-create'),
    path('role-access/bulk-upsert/', BulkRoleAccessibilityUpsertView.as_view(), name='bulk-role-access-upsert'),

    path('roles/', RoleListCreateView.as_view(), name='role-list-create'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='role-detail'),


    # === WAREHOUSE MODULE ===
    path('warehouses/', WarehouseListCreateView.as_view(), name='warehouse-list-create'),
    path('warehouses/<int:pk>/', WarehouseDetailView.as_view(), name='warehouse-detail'),

    


    # === SUPPLIER MODULE ===
    path('suppliers/', SupplierListCreateView.as_view(), name='supplier-list-create'),
    path('suppliers/<int:pk>/', SupplierRetrieveUpdateDestroyView.as_view(), name='supplier-detail'),


    # === VAN MODULE ===
    path('vans/', VanListCreateView.as_view(), name='van-list-create'),
    path('vans/<int:pk>/', VanRetrieveUpdateDestroyView.as_view(), name='van-detail'),


    # === PRODUCT MODULE ===
    path('shelltypes/', ShellTypeListCreateView.as_view()),
    path('contenttypes/', ContentTypeListCreateView.as_view()),
    path('product-categories/', ProductCategoryListCreateView.as_view()),
    path('product-categories/<int:pk>/', ProductCategoryDetailView.as_view()),
    path('unit-types/', UnitTypeListCreateView.as_view()),
    path('unit-types/<int:pk>/', UnitTypeDetailView.as_view()),
    path('pricing/', PricingListCreateView.as_view()),
    path('pricing/<int:pk>/', PricingDetailView.as_view()),
    path('products/', ProductListCreateView.as_view()),
    path('products/<int:pk>/', ProductDetailView.as_view()),
    path('products/next-system-code/', next_product_code, name='next-product-code'),


        # === RECEIVING MODULE ===
    path('receiving/', ReceivingListCreateView.as_view(), name='receiving-list-create'),
    path('receiving/<int:pk>/', ReceivingDetailView.as_view(), name='receiving-detail'),
    path('stocks/', StockListCreateView.as_view(), name='stock-list'),
    path('stocks/<int:pk>/', StockDetailView.as_view(), name='stock-detail'),

    path('routes/', RouteListCreateView.as_view(), name='route-list-create'),


    path('transaction-types/', TransactionTypeListCreateView.as_view(), name='transaction-type-list'),
    path('transaction-types/<int:pk>/', TransactionTypeDetailView.as_view(), name='transaction-type-detail'),

    path('merchandisings/', MerchandisingListCreateView.as_view(), name='merchandising-list'),
    path('merchandisings/<int:pk>/', MerchandisingDetailView.as_view(), name='merchandising-detail'),
    path('merchandisings/msp-next/', NextMspNoView.as_view(), name='next-msp-no'),
   

    path('stocks/<int:product_id>/availability/', StockAvailabilityView.as_view(), name='stock-availability'),
    path('stocks/<int:product_id>/update/', UpdateStockView.as_view(), name='update-stock'),
    path('stocks/<int:pk>/', StockDetailView.as_view()),
    path('stocks/<int:pk>/restore/', restore_stock),
    path('stocks/update/', StockUpdateAPIView.as_view(), name='stock-update'),


    path('merchandising/', MerchandisingListView.as_view(), name='merchandising-list'),
    path('merchandising-items/', MerchandisingItemListCreateView.as_view(), name='merchandising-item-list'),
    path('merchandising-items/<int:pk>/', MerchandisingItemDetailView.as_view(), name='merchandising-item-detail'),

    path('warehouse-groups/', warehouse_groups_view, name='warehouse-groups'),
    path('warehouse-details/', warehouse_details_view, name='warehouse-details'),


    path('miscellaneous-items/', MiscellaneousItemListCreateView.as_view(), name='miscellaneous-item-list'),
    path('miscellaneous-items/<int:pk>/', MiscellaneousItemDetailView.as_view(), name='miscellaneous-item-detail'),

    path('payments/', PaymentListCreateView.as_view(), name='payment-list'),
    path('payments/<int:pk>/', PaymentDetailView.as_view(), name='payment-detail'),

    path('returnable-stocks/', ReturnableStockListCreateView.as_view(), name='returnable-stock-list'),
    path('returnable-stocks/<int:pk>/', ReturnableStockDetailView.as_view(), name='returnable-stock-detail'),

    path('supplier-returns/', SupplierReturnListCreateView.as_view(), name='supplier-return-list'),
    path('supplier-returns/<int:pk>/', SupplierReturnDetailView.as_view(), name='supplier-return-detail'),

    path('supplier-return-items/', SupplierReturnItemListCreateView.as_view(), name='supplier-return-item-list'),
    path('supplier-return-items/<int:pk>/', SupplierReturnItemDetailView.as_view(), name='supplier-return-item-detail'),

    path('customers/', CustomerListCreateView.as_view(), name='customer-list-create'),
    path('customers/<int:pk>/', CustomerRetrieveUpdateDestroyView.as_view(), name='customer-detail'),
    path('login/', LoginAPIView.as_view(), name='login'),
    path('mobile-orders/', MobileOrderListView.as_view(), name='mobile-order-list'),
    path('mobile-delivery-addresses/', MobileDeliveryAddressView.as_view(), name='mobile-delivery-addresses'),
    path('mobile-deliveries/', MobileDeliveryListCreateView.as_view(), name='mobile-deliveries'),
    path('mobile-orders/confirm/', MobileOrderConfirmView.as_view(), name='mobile-order-confirm'),
    path('mobile-orders/<str:order_number>/', MobileOrderDetailView.as_view(), name='mobile-order-detail'),

    # Supplier Return Form
    path('supplier-return-form/', SupplierReturnFormListCreateView.as_view(), name='supplier-return-form'),
    path('supplier-return-form/<int:pk>/', SupplierReturnFormDetailView.as_view(), name='supplier-return-form-detail'),

    # Process Empties Return
    path('process-empties-return/', ProcessEmptiesReturnView.as_view(), name='process-empties-return'),

    path("van-load-return/", VanLoadReturnUpdateAPIView.as_view(), name="van-load-return"),
    path('api/van-load-return/update/', VanLoadReturnUpdateAPIView.as_view(), name='van-load-return-update'),

    path('stocks/bulk-adjust/', BulkAdjustStockView.as_view(), name='bulk-adjust-stocks'),

    #Sales Report API
    path("reports/sales/", SalesReportAPIView.as_view(), name="reports-sales"),
    path("sales_report/", SalesReportAPIView.as_view(), name="sales-report-legacy"),
    #path("reports/revenue-summary/", RevenueSummaryView.as_view(), name="revenue-summary"), #kath
    path("reports/product_breakdown/", ProductBreakdownReport.as_view()),
    #path('reports/returns-and-discrepancies/', SalesAndReturnables.as_view(), name='sales-and-returnables'),

    path("forecasts/generate/", GenerateForecastAPIView.as_view(), name="generate-forecast"),

    path('', include(router.urls)),
    path('notifications/create/', CreateNotificationAPIView.as_view(), name='create-notification'),
    path('notifications/cleanup/', NotificationCleanupAPIView.as_view(), name='notification-cleanup'),

     # Admin approval for user
    path('admin/approve-user/<int:user_id>/', ConfirmUserCreation.as_view(), name='confirm-user-approval'),  # Admin confirms user creation
    
    #Mandatory change password of the admin
    path('mandatory-change-password/', MandatoryChangePasswordAPIView.as_view(), name='mandatory-change-password'),
    
    path('check-default-admin-password/', views.check_default_admin_password, name='check_default_admin_password'),

    # Van Load edit approval workflow (cashier -> admin decision)
    path('van-load-edit-requests/request/', VanLoadEditApprovalRequestCreateAPIView.as_view(), name='van-load-edit-request-create'),
    path('van-load-edit-requests/status/', VanLoadEditApprovalStatusAPIView.as_view(), name='van-load-edit-request-status'),
    path('van-load-edit-requests/pending/', VanLoadEditApprovalPendingListAPIView.as_view(), name='van-load-edit-request-pending'),
    path('van-load-edit-requests/<int:request_id>/decision/', VanLoadEditApprovalDecisionAPIView.as_view(), name='van-load-edit-request-decision'),

]

router = DefaultRouter()
router.register(r'merchandising-set', MerchandisingViewSet, basename='merchandising-set')
router.register(r"forecasts", ForecastViewSet)
router.register(r"holidays", HolidayViewSet)

urlpatterns += router.urls
