from django.urls import path
from .views import (
    WarehouseListCreateView, WarehouseDetailView,
    SupplierListCreateView, SupplierRetrieveUpdateDestroyView,
    UserListCreateView, UserDetailView,
    RoleListCreateView, RoleDetailView  # ✅ Added Role views
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
]