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
    ProductDetailView
)

urlpatterns = [
    # User URLs
    path('users/', UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),

    # ✅ New Role URLs
    path('roles/', RoleListCreateView.as_view(), name='role-list-create'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='role-detail'),

    path('warehouses/', WarehouseListCreateView.as_view(), name='warehouse-list-create'),
    path('warehouses/<int:pk>/', WarehouseDetailView.as_view(), name='warehouse-detail'),
    path('suppliers/', SupplierListCreateView.as_view(), name='supplier-list-create'),
    path('suppliers/<int:pk>/', SupplierRetrieveUpdateDestroyView.as_view(), name='supplier-detail'),

    path('shelltypes/', ShellTypeListCreateView.as_view()),
    path('contenttypes/', ContentTypeListCreateView.as_view()),
    path('unit-types/', UnitTypeListCreateView.as_view()),
    path('unit-types/<int:pk>/', UnitTypeDetailView.as_view()),
    path('pricing/', PricingListCreateView.as_view()),
    path('pricing/<int:pk>/', PricingDetailView.as_view()),
    path('products/', ProductListCreateView.as_view()),
    path('products/<int:pk>/', ProductDetailView.as_view()),
]