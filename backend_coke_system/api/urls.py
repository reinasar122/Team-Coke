from django.urls import path
from .views import WarehouseListCreateView, WarehouseDetailView
from .views import SupplierListCreateView, SupplierRetrieveUpdateDestroyView


urlpatterns = [
    path('warehouses/', WarehouseListCreateView.as_view(), name='warehouse-list-create'),
    path('warehouses/<int:pk>/', WarehouseDetailView.as_view(), name='warehouse-detail'),
    path('suppliers/', SupplierListCreateView.as_view(), name='supplier-list-create'),
    path('suppliers/<int:pk>/', SupplierRetrieveUpdateDestroyView.as_view(), name='supplier-detail'),
]