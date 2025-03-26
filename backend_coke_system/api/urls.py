from django.urls import path
from .views import WarehouseListCreateView, WarehouseDetailView

urlpatterns = [
    path('warehouses/', WarehouseListCreateView.as_view(), name='warehouse-list-create'),
    path('warehouses/<int:pk>/', WarehouseDetailView.as_view(), name='warehouse-detail'),
]