from rest_framework import viewsets
from rest_framework import generics
from rest_framework.views import APIView
from api.models import Warehouse, RoleAccessibility
from .serializers import WarehouseSerializer
from rest_framework import status  # Fix: Import generics and status
from rest_framework.response import Response  # Fix: Import Response
from django.db import connection
from .models import Supplier, User, Role, Van, Receiving, Stock, Route, TransactionType, Merchandising, MerchandisingItem, MiscellaneousItem, Payment, ReturnableStock, SupplierReturn, SupplierReturnItem, Customer


from .serializers import SupplierSerializer, UserSerializer, RoleSerializer, ProductSerializer,ProductDetailSerializer,UnitTypeSerializer, PricingSerializer, ShellTypeSerializer, ContentTypeSerializer, VanSerializer, ReceivingSerializer, StockSerializer, RouteSerializer,  TransactionTypeSerializer, MerchandisingSerializer, MerchandisingItemSerializer, MiscellaneousItemSerializer, ReturnableStockSerializer, SupplierReturnSerializer, SupplierReturnItemSerializer, PaymentSerializer, CustomerSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.db import connection
from .models import Product, UnitType, Pricing, ShellType, ContentType, ProductCategory
from .serializers import RoleAccessibilitySerializer, ProductSerializer, ProductCategorySerializer, ChangePasswordSerializer
from .serializers import MerchandisingSaleSerializer
from .models import MerchandisingSale

from rest_framework import parsers
from .serializers import LoginSerializer
from rest_framework.permissions import BasePermission
from .serializers import RoleAccessibilitySerializer
import random
from django.conf import settings
from django.core.mail import send_mail
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import User
from .serializers import ForgotPasswordRequestSerializer, OTPVerificationSerializer
from django.core.cache import cache
from .models import SupplierReturnForm
from .serializers import SupplierReturnFormSerializer
from django.core.exceptions import ValidationError
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from .models import Receiving, Warehouse, Stock, Product
from .serializers import ReceivingSerializer
import traceback  # Add this import
from django.db.models import Q
from .models import *
from .serializers import *
from datetime import datetime
# Temporary OTP store (for demo; use cache or DB for production)
# Temporary OTP storage (in production use cache like Redis or DB)
otp_storage = {}

class SendOTPAPIView(APIView):
    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        cache.set(f'otp_{email}', otp, timeout=300)  # Store for 5 minutes

        # Send the OTP to the email
        send_mail(
            subject='Your OTP Code',
            message=f'Your OTP code is: {otp}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False
        )

        return Response({"message": "OTP sent to your email"}, status=status.HTTP_200_OK)


class VerifyOTPAPIView(APIView):
    def post(self, request):
        print("📨 VERIFY OTP DATA:", request.data)

        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response({"error": "Email and OTP are required"}, status=status.HTTP_400_BAD_REQUEST)

        email = str(email).lower().strip()
        cached_otp = cache.get(f'otp_{email}')

        if str(cached_otp) == str(otp):
            try:
                user = User.objects.get(email=email)
                return Response({
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "username": user.username  # optional
                    }
                }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({"error": "Invalid OTP. Please try again."}, status=status.HTTP_400_BAD_REQUEST)



class MerchandisingViewSet(viewsets.ModelViewSet):
    queryset = Merchandising.objects.all().order_by('-id')
    serializer_class = MerchandisingSerializer



class HasAccessPermission(BasePermission):
    """
    Custom permission to check if the user's role has the required access for a submenu.
    """

    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        submenu_name = getattr(view, 'submenu_name', None)
        required_access = getattr(view, 'required_access', 'VIEW')  # Default to VIEW

        if not role or not submenu_name:
            return False

        # Get all access types for this role + submenu
        access_qs = RoleAccessibility.objects.filter(role=role, submenu=submenu_name)
        access_types = access_qs.values_list('access_type', flat=True)

        return required_access.upper() in access_types or 'FULL' in access_types

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

class RoleAccessibilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = RoleAccessibility.objects.all()
    serializer_class = RoleAccessibilitySerializer

class RoleAccessibilityListView(APIView):
    def get(self, request):
        role_id = request.query_params.get('role_id')
        if not role_id:
            return Response({"error": "role_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        access_entries = RoleAccessibility.objects.filter(role_id=role_id)

        grouped_permissions = {}
        for entry in access_entries:
            grouped_permissions[entry.submenu] = {
                "full": entry.full,
                "view": entry.view,
                "create": entry.create,
                "edit": entry.edit,
                "delete": entry.delete,
            }

        return Response(grouped_permissions, status=status.HTTP_200_OK)
    
class BulkRoleAccessibilityCreateView(APIView):
    def post(self, request):
        data = request.data
        if not isinstance(data, list):
            return Response({"error": "Expected a list of permissions."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RoleAccessibilitySerializer(data=data, many=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class UserListCreateView(generics.ListCreateAPIView):
    """View to list all users or create a new one"""
    queryset = User.objects.all()
    serializer_class = UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """View to retrieve, update, or delete a user by ID"""
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()  # Retrieve the user instance
        serializer = self.get_serializer(instance, data=request.data, partial=True)  # Validate data

        # Ensure the incoming data is valid before saving
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Handle role and warehouse assignment separately
        role_id = request.data.get('role')  # Get the role ID from the incoming request
        warehouse_id = request.data.get('warehouse')  # Get the warehouse ID from the incoming request

        if role_id:
            try:
                # Ensure the role exists before assigning it
                instance.role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response({"error": "Role not found."}, status=status.HTTP_400_BAD_REQUEST)

        if warehouse_id:
            try:
                # Ensure the warehouse exists before assigning it
                instance.warehouse = Warehouse.objects.get(id=warehouse_id)
            except Warehouse.DoesNotExist:
                return Response({"error": "Warehouse not found."}, status=status.HTTP_400_BAD_REQUEST)

        # Perform the update on the instance using the validated data
        self.perform_update(serializer)

        # Manually update role_name and warehouse_name after update
        instance.role_name = instance.role.name if instance.role else None
        instance.warehouse_name = instance.warehouse.name if instance.warehouse else None

        # Return the updated user data with the related role and warehouse names
        return Response({
            **serializer.data,
            "role_name": instance.role_name,
            "warehouse_name": instance.warehouse_name
        })



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
    serializer_class = VanSerializer

    def get_queryset(self):
        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            return Van.objects.filter(warehouse_id=warehouse_id)
        return Van.objects.all()

    def perform_create(self, serializer):
        # The warehouse will be included in the request data
        serializer.save()

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
    serializer_class = ProductSerializer

    def get_queryset(self):
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            return Product.objects.filter(warehouse_id=warehouse_id)
        return Product.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ProductDetailSerializer
        return ProductSerializer

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    
    def get_queryset(self):
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            return Product.objects.filter(warehouse_id=warehouse_id)
        return Product.objects.all()
    
    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ProductDetailSerializer
        return ProductSerializer
    
    def perform_destroy(self, instance):
        unit = instance.unit_type
        price = instance.price
        super().perform_destroy(instance)
        if unit and not Product.objects.filter(unit_type=unit).exists():
            unit.delete()
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
    serializer_class = ReceivingSerializer

    def get_queryset(self):
        warehouse_id = self.request.headers.get('X-Warehouse-ID')
        if warehouse_id:
            return Receiving.objects.select_related('supplier', 'warehouse').prefetch_related('details').filter(warehouse_id=warehouse_id).order_by('-id')
        return Receiving.objects.select_related('supplier', 'warehouse').prefetch_related('details').order_by('-id')

    def perform_create(self, serializer):
        warehouse_id = self.request.headers.get('X-Warehouse-ID')
        print(f"Received warehouse_id: {warehouse_id}")  # Debug log
        
        if warehouse_id:
            try:
                warehouse = Warehouse.objects.get(id=warehouse_id)
                print(f"Found warehouse: {warehouse}")  # Debug log
                serializer.save(warehouse=warehouse)
            except Warehouse.DoesNotExist:
                print(f"Warehouse {warehouse_id} not found")  # Debug log
                # Save without warehouse for now
                serializer.save()
        else:
            print("No warehouse_id provided")  # Debug log
            serializer.save()

    def create(self, request, *args, **kwargs):
        try:
            print(f"Request data: {request.data}")  # Debug log
            print(f"Request headers: {dict(request.headers)}")  # Debug log
            return super().create(request, *args, **kwargs)
        except Exception as e:
            print(f"Error creating receiving: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return Response(
                {"detail": f"Error creating receiving: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
class ReceivingDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ReceivingSerializer
    
    def get_queryset(self):
        warehouse_id = self.request.headers.get('X-Warehouse-ID')
        if warehouse_id:
            return Receiving.objects.filter(warehouse_id=warehouse_id)
        return Receiving.objects.all()

# ===== STOCKS =====
class StockListCreateView(generics.ListCreateAPIView):
    serializer_class = StockSerializer

    def get_queryset(self):
        warehouse_id = self.request.query_params.get('warehouse', None)
        
        queryset = Stock.objects.select_related('product', 'warehouse').all()
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset.order_by('product__product_name')

    def perform_create(self, serializer):
        # Get warehouse from request data or user's warehouse
        warehouse_id = self.request.data.get('warehouse')
        
        # If no warehouse specified, use user's warehouse
        if not warehouse_id:
            warehouse_id = getattr(self.request.user, 'warehouse_id', None)
        
        serializer.save(warehouse_id=warehouse_id)
class StockDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer


class RouteListCreateView(generics.ListCreateAPIView):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer


# TransactionType Views
def get_user_warehouse(request):
    """Helper function to get current warehouse from request"""
    warehouse_id = request.query_params.get('warehouse')
    if warehouse_id:
        return warehouse_id
    
    # Fallback to user's enrolled warehouse
    user = request.user
    if hasattr(user, 'warehouse_id'):
        return user.warehouse_id
    return None

class TransactionTypeListCreateView(generics.ListCreateAPIView):
    queryset = TransactionType.objects.all()
    serializer_class = TransactionTypeSerializer

class TransactionTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = TransactionType.objects.all()
    serializer_class = TransactionTypeSerializer

class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            return Customer.objects.filter(warehouse=warehouse_id).order_by('name')
        return Customer.objects.all().order_by('name')

    def perform_create(self, serializer):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            serializer.save(warehouse_id=warehouse_id)
        else:
            serializer.save()

class CustomerRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer


# Merchandising Views
class MerchandisingSaleViewSet(viewsets.ModelViewSet):
    queryset = MerchandisingSale.objects.all()
    serializer_class = MerchandisingSaleSerializer

    def perform_create(self, serializer):
        # You can compute the totals here if needed
        data = self.request.data

        trading_total = data.get("total_trading_amount", 0)
        expenses_total = data.get("total_expenses_amount", 0)

        serializer.save(
            total_trading_amount=trading_total,
            total_expenses_amount=expenses_total
        )

    def perform_update(self, serializer):
        data = self.request.data

        trading_total = data.get("total_trading_amount", 0)
        expenses_total = data.get("total_expenses_amount", 0)

        serializer.save(
            total_trading_amount=trading_total,
            total_expenses_amount=expenses_total
        )

class MerchandisingListCreateView(generics.ListCreateAPIView):
    serializer_class = MerchandisingSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            return Merchandising.objects.filter(warehouse=warehouse_id)
        return Merchandising.objects.all()

    def perform_create(self, serializer):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            serializer.save(warehouse_id=warehouse_id)
        else:
            serializer.save()

class MerchandisingDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Merchandising.objects.all()
    serializer_class = MerchandisingSerializer

class MerchandisingListView(generics.ListAPIView):
    serializer_class = MerchandisingSerializer

@api_view(['GET'])
def merchandising_sales_list(request):
    sales = MerchandisingSale.objects.all().order_by('-created_at')  # type: ignore # Optional: filter by user or status
    serializer = MerchandisingSaleSerializer(sales, many=True)
    return Response(serializer.data)
    def get_queryset(self):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            return Merchandising.objects.filter(warehouse=warehouse_id)
        return Merchandising.objects.all()

class NextMspNoView(APIView):
    def get(self, request):
        transaction_type_id = request.query_params.get("transaction_type")

        if not transaction_type_id:
            return Response({"detail": "Transaction type is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            transaction_type = TransactionType.objects.get(id=transaction_type_id)
        except TransactionType.DoesNotExist:
            return Response({"detail": "Invalid transaction type ID."}, status=status.HTTP_400_BAD_REQUEST)

        # generate and return MSP number...
        msp_no = f"{transaction_type.name[:2].upper()}-001"
        return Response({"msp_no": msp_no})


class StockAvailabilityView(APIView):
    def get(self, request, product_id):
        warehouse_id = get_user_warehouse(request)
        
        try:
            if warehouse_id:
                stock = Stock.objects.get(product_id=product_id, warehouse=warehouse_id)
            else:
                stock = Stock.objects.get(product_id=product_id)
                
            return Response({
                "product_id": product_id,
                "quantity_available": stock.quantity_available
            })
        except Stock.DoesNotExist:
            return Response({"detail": "Product stock not found."}, status=status.HTTP_404_NOT_FOUND)


class UpdateStockView(APIView):
    def put(self, request, product_id):
        warehouse_id = get_user_warehouse(request)
        
        try:
            if warehouse_id:
                stock = Stock.objects.get(product_id=product_id, warehouse=warehouse_id)
            else:
                stock = Stock.objects.get(product_id=product_id)
                
            quantity_sold = request.data.get('quantity_available')
            stock.quantity_available -= quantity_sold
            stock.save()

            return Response({"message": "Stock updated successfully"}, status=status.HTTP_200_OK)

        except (ValueError, TypeError):
            return Response({"error": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

        except Stock.DoesNotExist:
            return Response({"detail": "Product stock not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(['PATCH'])
def restore_stock(request, pk):
    warehouse_id = get_user_warehouse(request)
    
    try:
        if warehouse_id:
            stock = Stock.objects.get(product_id=pk, warehouse=warehouse_id)
        else:
            stock = Stock.objects.get(product_id=pk)
            
        quantity = int(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({'error': 'Quantity must be greater than zero.'}, status=400)

        stock.quantity_available += quantity
        stock.save()
        return Response({'status': 'restored', 'new_quantity': stock.quantity_available})

    except (ValueError, TypeError):
        return Response({'error': 'Invalid quantity.'}, status=400)
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=404)




# MerchandisingItem Views
class MerchandisingItemListCreateView(generics.ListCreateAPIView):
    queryset = MerchandisingItem.objects.all()
    serializer_class = MerchandisingItemSerializer

class MerchandisingItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MerchandisingItem.objects.all()
    serializer_class = MerchandisingItemSerializer

class MiscellaneousItemListCreateView(generics.ListCreateAPIView):
    queryset = MiscellaneousItem.objects.all()
    serializer_class = MiscellaneousItemSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

class MiscellaneousItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MiscellaneousItem.objects.all()
    serializer_class = MiscellaneousItemSerializer

class PaymentListCreateView(generics.ListCreateAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

class ReturnableStockListCreateView(generics.ListCreateAPIView):
    serializer_class = ReturnableStockSerializer

    def get_queryset(self):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            return ReturnableStock.objects.filter(warehouse=warehouse_id)
        return ReturnableStock.objects.all()

class ReturnableStockDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ReturnableStock.objects.all()
    serializer_class = ReturnableStockSerializer

class SupplierReturnListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierReturnSerializer

    def get_queryset(self):
        warehouse_id = get_user_warehouse(self.request)
        if warehouse_id:
            return SupplierReturn.objects.filter(warehouse=warehouse_id)
        return SupplierReturn.objects.all()

class SupplierReturnDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SupplierReturn.objects.all()
    serializer_class = SupplierReturnSerializer

class SupplierReturnItemListCreateView(generics.ListCreateAPIView):
    queryset = SupplierReturnItem.objects.all()
    serializer_class = SupplierReturnItemSerializer

class SupplierReturnItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SupplierReturnItem.objects.all()
    serializer_class = SupplierReturnItemSerializer

class LoginAPIView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class ChangePasswordAPIView(APIView):
    def post(self, request):
        print("Request Data:", request.data)  # ✅ Add this

        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)
        print("Serializer errors:", serializer.errors)  # ✅ Add this
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SupplierReturnFormListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierReturnFormSerializer

    def get_queryset(self):
        queryset = SupplierReturnForm.objects.all().order_by('-date')
        
        # Filter by warehouse if warehouse_id is provided in query params
        warehouse_id = self.request.query_params.get('warehouse_id', None)
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset

class SupplierReturnFormDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SupplierReturnFormSerializer
    
    def get_queryset(self):
        queryset = SupplierReturnForm.objects.all()
        
        # Optional: Filter by warehouse for additional security
        warehouse_id = self.request.query_params.get('warehouse_id', None)
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset

class ProcessEmptiesReturnView(APIView):
    """
    API endpoint to process returned empties from merchandising and add them to ReturnableStock
    """
    
    def get(self, request):
        """
        GET method for testing - returns endpoint information
        """
        return Response({
            "message": "Process Empties Return API Endpoint",
            "method": "POST only",
            "description": "This endpoint processes returned empties from merchandising transactions",
            "required_fields": {
                "return_date": "ISO datetime string",
                "warehouse_id": "ID of the warehouse",
                "items": "Array of items with merchandising_id, item_id, product_id, etc."
            },
            "example_payload": {
                "return_date": "2025-01-26T15:05:13.000Z",
                "warehouse_id": 1,
                "items": [
                    {
                        "merchandising_id": 1,
                        "item_id": 1,
                        "product_id": 1,
                        "supplier_id": 1,
                        "product_name": "Coca Cola 1.5L",
                        "empty_return_shell": 2,
                        "empty_return_pcs": 24,
                        "warehouse_id": 1
                    }
                ]
            }
        }, status=status.HTTP_200_OK)
    
    def post(self, request):
        try:
            return_date = request.data.get('return_date')
            warehouse_id = request.data.get('warehouse_id')
            items = request.data.get('items', [])
            
            if not warehouse_id:
                return Response(
                    {"error": "Warehouse ID is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not items:
                return Response(
                    {"error": "No items provided"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify warehouse exists
            try:
                warehouse = Warehouse.objects.get(id=warehouse_id)
            except Warehouse.DoesNotExist:
                return Response(
                    {"error": "Invalid warehouse ID"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            processed_items = []
            errors = []
            
            # Process each returned empty item
            for item in items:
                merchandising_id = item.get('merchandising_id')
                item_id = item.get('item_id')
                product_id = item.get('product_id')
                supplier_id = item.get('supplier_id')
                empty_return_shell = int(item.get('empty_return_shell', 0))
                empty_return_pcs = int(item.get('empty_return_pcs', 0))
                item_warehouse_id = item.get('warehouse_id', warehouse_id)
                
                # Validate required fields
                if not all([merchandising_id, item_id, product_id]):
                    errors.append(f"Missing required fields for item {item_id}")
                    continue
                
                # Ensure item belongs to the specified warehouse
                if int(item_warehouse_id) != int(warehouse_id):
                    errors.append(f"Item {item_id} does not belong to warehouse {warehouse_id}")
                    continue
                
                try:
                    # Get the merchandising item and verify it belongs to the correct warehouse
                    merchandising_item = MerchandisingItem.objects.select_related('merchandising').get(
                        id=item_id,
                        merchandising_id=merchandising_id,
                        merchandising__warehouse_id=warehouse_id
                    )
                    
                    # Get the product and supplier
                    product = Product.objects.get(id=product_id)
                    supplier = None
                    if supplier_id:
                        try:
                            supplier = Supplier.objects.get(id=supplier_id)
                        except Supplier.DoesNotExist:
                            pass  # Continue without supplier if not found
                    
                    # Add to ReturnableStock or update existing (warehouse-specific)
                    if empty_return_shell > 0 or empty_return_pcs > 0:
                        returnable_stock, created = ReturnableStock.objects.get_or_create(
                            product=product,
                            source='customer',
                            supplier=supplier,
                            warehouse_id=warehouse_id,
                            defaults={
                                'empty_bottle_qty': empty_return_pcs,
                                'empty_shell_qty': empty_return_shell,
                                'created_date': datetime.now().date(),
                                'last_updated': datetime.now()
                            }
                        )
                        
                        if not created:
                            # Update existing returnable stock
                            returnable_stock.empty_bottle_qty += empty_return_pcs
                            returnable_stock.empty_shell_qty += empty_return_shell
                            returnable_stock.last_updated = datetime.now()
                            returnable_stock.save()
                    
                    # Clear the empty returns from merchandising item to mark as processed
                    merchandising_item.empty_return_pcs = 0
                    merchandising_item.empty_return_shell = 0
                    merchandising_item.save()
                    
                    processed_items.append({
                        'merchandising_id': merchandising_id,
                        'item_id': item_id,
                        'product_name': item.get('product_name'),
                        'empty_return_shell': empty_return_shell,
                        'empty_return_pcs': empty_return_pcs,
                        'warehouse_id': warehouse_id,
                        'warehouse_name': warehouse.name,
                        'status': 'processed'
                    })
                    
                except MerchandisingItem.DoesNotExist:
                    errors.append(f"Merchandising item {item_id} not found or does not belong to warehouse {warehouse_id}")
                except Product.DoesNotExist:
                    errors.append(f"Product {product_id} not found")
                except Exception as e:
                    errors.append(f"Error processing item {item_id}: {str(e)}")
                    continue
            
            response_data = {
                "message": f"Empties returned to stock successfully for {warehouse.name}",
                "warehouse_id": warehouse_id,
                "warehouse_name": warehouse.name,
                "return_date": return_date,
                "processed_items": processed_items,
                "total_processed": len(processed_items),
                "total_errors": len(errors)
            }
            
            if errors:
                response_data["errors"] = errors
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": f"Failed to process empties return: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )