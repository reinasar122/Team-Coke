from rest_framework import generics
from api.models import Warehouse
from .serializers import WarehouseSerializer


# List all warehouses or create a new one
class WarehouseListCreateView(generics.ListCreateAPIView):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

# Retrieve, update, or delete a specific warehouse
class WarehouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer