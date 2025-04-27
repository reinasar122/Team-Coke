from django.urls import path
from .views import (
    WarehouseListCreateView, WarehouseDetailView,
    SupplierListCreateView, SupplierRetrieveUpdateDestroyView,
    UserListCreateView, UserDetailView,
    RoleListCreateView, RoleDetailView,  # ✅ Added Role views
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
    StockDetailView


)

urlpatterns = [
    # User URLs
    path('users/', UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),

    # ✅ New Role URLs
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
]