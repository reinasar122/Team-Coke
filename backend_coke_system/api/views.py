from rest_framework import generics, filters
from api.models import Warehouse
from .serializers import WarehouseSerializer
from rest_framework import status  # Fix: Import generics and status
from rest_framework.response import Response  # Fix: Import Response
from django.db import connection
from .models import Supplier, User, Role, Van, Receiving, Stock

from .serializers import SupplierSerializer, UserSerializer, RoleSerializer, ProductSerializer,ProductDetailSerializer,UnitTypeSerializer, PricingSerializer, ShellTypeSerializer, ContentTypeSerializer, VanSerializer, ReceivingSerializer, StockSerializer


from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.db import connection
from .models import Product, UnitType, Pricing, ShellType, ContentType, ProductCategory
from .serializers import ProductSerializer, ProductCategorySerializer


class RoleListCreateView(generics.ListCreateAPIView):
    """View to list all roles or create a new one"""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer


class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """View to retrieve, update, or delete a role by ID"""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)  # Delete the role

        # Reset Auto Increment
        with connection.cursor() as cursor:
            cursor.execute("ALTER TABLE api_role AUTO_INCREMENT = 1")

        return Response({"message": "Role deleted successfully and IDs reset"}, status=status.HTTP_204_NO_CONTENT)


class UserListCreateView(generics.ListCreateAPIView):
    """View to list all users or create a new one"""
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def perform_create(self, serializer):
        """Override to manually handle password hashing before user creation"""
        password = self.request.data.get('password')
        if password:
            serializer.save(password=password)  # Pass password directly for hashing


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """View to retrieve, update, or delete a user by ID"""
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def update(self, request, *args, **kwargs):
        print("Incoming Data:", request.data)  # Log incoming data for debugging
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)

        if not serializer.is_valid():
            print("Errors:", serializer.errors)  # Log serializer errors
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(serializer.data)



# List all warehouses or create a new one
class WarehouseListCreateView(generics.ListCreateAPIView):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

# Retrieve, update, or delete a specific warehouse
class WarehouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    

class SupplierListCreateView(generics.ListCreateAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

class SupplierRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class VanListCreateView(generics.ListCreateAPIView):
    queryset = Van.objects.all()
    serializer_class = VanSerializer

class VanRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Van.objects.all()
    serializer_class = VanSerializer


#Products

class ShellTypeListCreateView(generics.ListCreateAPIView):
    queryset = ShellType.objects.all()
    serializer_class = ShellTypeSerializer

class ContentTypeListCreateView(generics.ListCreateAPIView):
    queryset = ContentType.objects.all()
    serializer_class = ContentTypeSerializer

class ProductCategoryListCreateView(generics.ListCreateAPIView):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

class ProductCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer

class UnitTypeListCreateView(generics.ListCreateAPIView):
    queryset = UnitType.objects.all()
    serializer_class = UnitTypeSerializer

class UnitTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = UnitType.objects.all()
    serializer_class = UnitTypeSerializer

class PricingListCreateView(generics.ListCreateAPIView):
    queryset = Pricing.objects.all()
    serializer_class = PricingSerializer

class PricingDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Pricing.objects.all()
    serializer_class = PricingSerializer


class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ProductDetailSerializer  # ✅ return full nested data on GET
        return ProductSerializer  # ✅ for POST

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductDetailSerializer

    def perform_destroy(self, instance):
        unit = instance.unit_type
        price = instance.price

        # Delete the product first
        super().perform_destroy(instance)

        # 🧹 Delete unit_type if not used by any other product
        if unit and not Product.objects.filter(unit_type=unit).exists():
            unit.delete()

        # 🧹 Delete pricing if not used by any other product
        if price and not Product.objects.filter(price=price).exists():
            price.delete()

@api_view(['GET'])
def next_product_code(request):
    last = Product.objects.order_by('-id').first()
    next_id = last.id + 1 if last else 1
    next_code = f"PRD-{next_id:04d}"
    return Response({"system_code": next_code})



# ===== RECEIVING MODULE =====
class ReceivingListCreateView(generics.ListCreateAPIView):
    queryset = Receiving.objects.select_related('supplier').prefetch_related('details').order_by('-id')
    serializer_class = ReceivingSerializer

class ReceivingDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Receiving.objects.all()
    serializer_class = ReceivingSerializer


# ===== STOCKS =====
class StockListCreateView(generics.ListCreateAPIView):
    queryset = Stock.objects.select_related('product').all().order_by('product__product_name')
    serializer_class = StockSerializer

class StockDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer
