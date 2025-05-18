from rest_framework import generics
from rest_framework.views import APIView
from api.models import Warehouse
from .serializers import WarehouseSerializer
from rest_framework import status  # Fix: Import generics and status
from rest_framework.response import Response  # Fix: Import Response
from django.db import connection
from .models import Supplier, User, Role, Van, Receiving, Stock, Route, TransactionType, Merchandising, MerchandisingItem, MiscellaneousItem, Payment, ReturnableStock, SupplierReturn, SupplierReturnItem, Customer

from .serializers import SupplierSerializer, UserSerializer, RoleSerializer, ProductSerializer,ProductDetailSerializer,UnitTypeSerializer, PricingSerializer, ShellTypeSerializer, ContentTypeSerializer, VanSerializer, ReceivingSerializer, StockSerializer, RouteSerializer,  TransactionTypeSerializer, MerchandisingSerializer, MerchandisingItemSerializer, MiscellaneousItemSerializer, ReturnableStockSerializer, SupplierReturnSerializer, SupplierReturnItemSerializer, PaymentSerializer, CustomerSerializer


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


class RouteListCreateView(generics.ListCreateAPIView):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer


# TransactionType Views
class TransactionTypeListCreateView(generics.ListCreateAPIView):
    queryset = TransactionType.objects.all()
    serializer_class = TransactionTypeSerializer

class TransactionTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = TransactionType.objects.all()
    serializer_class = TransactionTypeSerializer

class CustomerListCreateView(generics.ListCreateAPIView):
    queryset = Customer.objects.all().order_by('name')
    serializer_class = CustomerSerializer

class CustomerRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer


# Merchandising Views
class MerchandisingListCreateView(generics.ListCreateAPIView):
    queryset = Merchandising.objects.all()
    serializer_class = MerchandisingSerializer

class MerchandisingDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Merchandising.objects.all()
    serializer_class = MerchandisingSerializer

class MerchandisingListView(generics.ListAPIView):
    queryset = Merchandising.objects.all()
    serializer_class = MerchandisingSerializer


class NextMspNoView(APIView):
    def get(self, request):
        # Get transaction type from query parameters
        transaction_type = request.query_params.get("transaction_type", "")
        print(f"Received transaction type: {transaction_type}")  # Debug print

        if not transaction_type:
            return Response({"detail": "Transaction type is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Try to fetch the transaction type from the database using case-insensitive matching
        try:
            transaction_type_instance = TransactionType.objects.get(name__iexact=transaction_type)  # Case-insensitive check
            print(f"Found transaction type: {transaction_type_instance.name}")  # Debug print
        except TransactionType.DoesNotExist:
            return Response({"detail": "Transaction type not found."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate the next MSP number based on the transaction type
        last = Merchandising.objects.filter(transaction_type=transaction_type_instance).order_by('-id').first()
        next_number = 1 if not last else int(last.msp_no.split('-')[-1]) + 1
        prefix = "W" if transaction_type_instance.name.lower() == "warehouse" else "V" if transaction_type_instance.name.lower() == "van load" else "X"
        msp_no = f"{prefix}-{next_number:04d}"

        return Response({"msp_no": msp_no})


class StockAvailabilityView(APIView):
    def get(self, request, product_id):
        try:
            # Check if the stock for the selected product exists
            stock = Stock.objects.get(product_id=product_id)
            return Response({
                "product_id": product_id,
                "quantity_available": stock.quantity_available
            })
        except Stock.DoesNotExist:
            return Response({"detail": "Product stock not found."}, status=status.HTTP_404_NOT_FOUND)


# views.py

class UpdateStockView(APIView):
    def put(self, request, product_id):
        try:
            # Fetch the product stock
            stock = Stock.objects.get(product_id=product_id)
            quantity_sold = request.data.get('quantity_available')
            
            # Update the stock quantity
            stock.quantity_available -= quantity_sold
            stock.save()

            return Response({"message": "Stock updated successfully"}, status=status.HTTP_200_OK)
        except Stock.DoesNotExist:
            return Response({"detail": "Product stock not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(['PATCH'])
def restore_stock(request, pk):
    try:
        stock = Stock.objects.get(product_id=pk)
        stock.quantity_available += int(request.data.get('quantity', 0))
        stock.save()
        return Response({'status': 'restored', 'new_quantity': stock.quantity_available})
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=404)




# MerchandisingItem Views
class MerchandisingItemListCreateView(generics.ListCreateAPIView):
    queryset = MerchandisingItem.objects.all()
    serializer_class = MerchandisingItemSerializer

class MerchandisingItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MerchandisingItem.objects.all()
    serializer_class = MerchandisingItemSerializer

# MiscellaneousItem Views
class MiscellaneousItemListCreateView(generics.ListCreateAPIView):
    queryset = MiscellaneousItem.objects.all()
    serializer_class = MiscellaneousItemSerializer

class MiscellaneousItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MiscellaneousItem.objects.all()
    serializer_class = MiscellaneousItemSerializer

# Payment Views
class PaymentListCreateView(generics.ListCreateAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

# ReturnableStock Views
class ReturnableStockListCreateView(generics.ListCreateAPIView):
    queryset = ReturnableStock.objects.all()
    serializer_class = ReturnableStockSerializer

class ReturnableStockDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ReturnableStock.objects.all()
    serializer_class = ReturnableStockSerializer

# SupplierReturn Views
class SupplierReturnListCreateView(generics.ListCreateAPIView):
    queryset = SupplierReturn.objects.all()
    serializer_class = SupplierReturnSerializer

class SupplierReturnDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SupplierReturn.objects.all()
    serializer_class = SupplierReturnSerializer

# SupplierReturnItem Views
class SupplierReturnItemListCreateView(generics.ListCreateAPIView):
    queryset = SupplierReturnItem.objects.all()
    serializer_class = SupplierReturnItemSerializer

class SupplierReturnItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SupplierReturnItem.objects.all()
    serializer_class = SupplierReturnItemSerializer