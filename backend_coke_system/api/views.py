# api/views.py - CORRECTED VERSION WITH CONSISTENT WAREHOUSE FILTERING

from decimal import Decimal, InvalidOperation          # 👈 for to_decimal()
from django.db import transaction
from django.shortcuts import get_object_or_404  
from django.db.models.functions import Coalesce
from django.db.models import F, Case, When, Value, IntegerField, Sum, Count
from rest_framework import viewsets
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView
from api.models import Warehouse, RoleAccessibility
from .serializers import WarehouseSerializer
from rest_framework import status  # Fix: Import generics and status
from rest_framework.response import Response  # Fix: Import Response
from django.db import connection
from django.db.models import F   
from .models import Supplier, User, Role, Van, Receiving, Stock, Route, TransactionType, Merchandising, MerchandisingItem, MiscellaneousItem, Payment, ReturnableStock, SupplierReturn, SupplierReturnItem, Customer

from .models import (
    Merchandising, MerchandisingItem,
    Stock, ReturnableStock, Product
)

from .serializers import SupplierSerializer, UserSerializer, RoleSerializer, ProductSerializer, ProductDetailSerializer,UnitTypeSerializer, PricingSerializer, ShellTypeSerializer, ContentTypeSerializer, VanSerializer, ReceivingSerializer, StockSerializer, RouteSerializer,  TransactionTypeSerializer, MerchandisingSerializer, MerchandisingItemSerializer, MiscellaneousItemSerializer, ReturnableStockSerializer, SupplierReturnSerializer, SupplierReturnItemSerializer, PaymentSerializer, CustomerSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from rest_framework.decorators import api_view, action
from rest_framework.response import Response

from django.db import connection
from .models import Product, UnitType, Pricing, ShellType, ContentType, ProductCategory
from .serializers import RoleAccessibilitySerializer, ProductSerializer, ProductCategorySerializer, ChangePasswordSerializer
from .serializers import MerchandisingSaleSerializer
from .models import MerchandisingSale

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny

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
# api/views.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions

from .models import CreditLedger
from .serializers import (
    CreditLedgerCreateSerializer,
    CreditLedgerListSerializer,
    CreditLedgerDetailSerializer,
    CreditPaymentCreateSerializer,
)

from .serializers import ForecastSerializer, HolidaySerializer

import pandas as pd
from prophet import Prophet

from .models import Forecast, Holiday
from django.db.models.functions import TruncDate
from datetime import timedelta



# ✅ HELPER FUNCTION: Get user warehouse filtering
def get_user_warehouse_filter(user, query_param_warehouse=None):
    """
    Helper function to determine warehouse filtering for a user.
    Returns warehouse_id to filter by, or None for no filtering.
    """
    # For non-admin users, always filter by their warehouse
    if hasattr(user, 'warehouse_id') and user.warehouse_id:
        if not (hasattr(user, 'role') and getattr(user.role, 'name', '').lower() == 'admin'):
            return user.warehouse_id
    
    # For admin users, use query parameter if provided
    if query_param_warehouse:
        try:
            return int(query_param_warehouse)
        except (ValueError, TypeError):
            # If admin provides invalid warehouse_id, fall back to their warehouse
            if hasattr(user, 'warehouse_id') and user.warehouse_id:
                return user.warehouse_id
    
    # For admin without query param, use their warehouse if available
    if hasattr(user, 'warehouse_id') and user.warehouse_id:
        return user.warehouse_id
    
    return None

class CreditLedgerListCreateAPIView(generics.ListCreateAPIView):
    def get_queryset(self):
        queryset = CreditLedger.objects.all()
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset

    def get_serializer_class(self):
        return CreditLedgerCreateSerializer if self.request.method == "POST" else CreditLedgerListSerializer

class CreditLedgerDetailAPIView(generics.RetrieveAPIView):
    def get_queryset(self):
        queryset = CreditLedger.objects.all()
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset
    
    serializer_class = CreditLedgerDetailSerializer

class CreditPaymentCreateAPIView(APIView):
    def post(self, request, pk):
        credit = get_object_or_404(CreditLedger, pk=pk)
        serializer = CreditPaymentCreateSerializer(data=request.data, context={"credit": credit})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        detail = CreditLedgerDetailSerializer(credit)
        return Response(detail.data, status=status.HTTP_201_CREATED)

# kerkmodify this part  otp
# Temporary OTP storage (in production use cache like Redis or DB)
class SendOTPAPIView(APIView):
    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate OTP
        otp = str(random.randint(100000, 999999))
        cache.set(f'otp_{email}', otp, timeout=300)  # valid for 5 mins

        try:
            send_mail(
                subject="Your OTP Code",
                message=f"Your OTP code is: {otp}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )
        except Exception as e:
            print("❌ Email sending failed:", str(e))
            return Response({"error": "Failed to send email."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        print(f"📩 OTP for {email}: {otp} (valid 5 mins)")
        return Response({"message": "OTP sent to your email"}, status=status.HTTP_200_OK)

class VerifyOTPAPIView(APIView):
    def post(self, request):
        print("📨 VERIFY OTP DATA:", request.data)

        email = str(request.data.get("email", "")).lower().strip()
        otp = str(request.data.get("otp", "")).strip()

        if not email or not otp:
            return Response({"error": "Email and OTP are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get cached OTP
        cached_otp = cache.get(f'otp_{email}')

        if cached_otp is None:
            return Response({"error": "OTP expired or not found. Please request again."},
                            status=status.HTTP_400_BAD_REQUEST)

        if str(cached_otp) != otp:
            return Response({"error": "Invalid OTP. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

        # OTP is valid ✅
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Invalidate OTP after successful use
        cache.delete(f'otp_{email}')

        # Generate token for password reset/change
        token = default_token_generator.make_token(user)

        return Response({
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "token": token,
            }
        }, status=status.HTTP_200_OK)

class MerchandisingViewSet(viewsets.ModelViewSet):
    queryset = Merchandising.objects.all()
    serializer_class = MerchandisingSerializer

    def get_queryset(self):
        """
        Filter merchandising records by warehouse for multi-warehouse support
        """
        queryset = super().get_queryset()
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse', None)
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset.select_related('transaction_type', 'warehouse', 'customer', 'route', 'van')

    @action(detail=True, methods=["post"])
    def set_invoice_no(self, request, pk=None):
        merchandising = self.get_object()
        
        # Verify user has access to this warehouse's data
        user = request.user
        if hasattr(user, 'warehouse_id') and user.warehouse_id:
            if not (hasattr(user, 'role') and user.role.lower() == 'admin'):
                if merchandising.warehouse_id != user.warehouse_id:
                    return Response(
                        {"detail": "Access denied: You can only modify invoices from your warehouse."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
        
        invoice_no = request.data.get("invoice_no")
        empties_price_total = request.data.get("empties_price_total")
        empty_returns = request.data.get("empty_returns")
        payment_method = request.data.get("payment_method") 

        if not invoice_no:
            return Response(
                {"detail": "Invoice number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # track which fields to update
        update_fields = []

        # required invoice_no
        merchandising.invoice_no = invoice_no
        update_fields.append("invoice_no")

        # optional fields
        if empties_price_total is not None:
            merchandising.empties_price_total = empties_price_total
            update_fields.append("empties_price_total")

        if empty_returns is not None:
            merchandising.empty_returns = empty_returns
            update_fields.append("empty_returns")

        if payment_method is not None:
            merchandising.payment_method = str(payment_method)
            update_fields.append("payment_method")

        merchandising.save(update_fields=update_fields)
        return Response(self.get_serializer(merchandising).data, status=status.HTTP_200_OK)

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

class BulkRoleAccessibilityUpsertView(APIView):
    """
    Upsert a list of role access rows by (role, submenu).
    Body: [{role, submenu, full, view, create, edit, delete}, ...]
    """
    def put(self, request):
        data = request.data
        if not isinstance(data, list):
            return Response({"error": "Expected a list."}, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        for item in data:
            role_id = item.get("role")
            submenu = item.get("submenu")
            if not role_id or not submenu:
                return Response({"error": "Each item must include role and submenu."},
                                status=status.HTTP_400_BAD_REQUEST)

            obj, _created = RoleAccessibility.objects.update_or_create(
                role_id=role_id,
                submenu=submenu,
                defaults={
                    "full": bool(item.get("full", False)),
                    "view": bool(item.get("view", False)),
                    "create": bool(item.get("create", False)),
                    "edit": bool(item.get("edit", False)),
                    "delete": bool(item.get("delete", False)),
                },
            )
            updated.append({
                "id": obj.id,
                "role": obj.role_id,
                "submenu": obj.submenu,
                "full": obj.full,
                "view": obj.view,
                "create": obj.create,
                "edit": obj.edit,
                "delete": obj.delete,
            })

        return Response(updated, status=status.HTTP_200_OK)
    
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
    serializer_class = SupplierSerializer
    
    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Supplier.objects.filter(warehouse_id=warehouse_id)
        return Supplier.objects.all()

class SupplierRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SupplierSerializer
    
    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Supplier.objects.filter(warehouse_id=warehouse_id)
        return Supplier.objects.all()

    def destroy(self, request, *args, **kwargs):
        supplier = self.get_object()

        # ✅ Safely check if related records exist
        has_receivings = getattr(supplier, "receiving_set", None)
        has_returns = getattr(supplier, "supplierreturn_set", None)

        if (has_receivings and has_receivings.exists()) or (has_returns and has_returns.exists()):
            return Response(
                {"detail": "Supplier cannot be deleted because it has linked transactions."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ If no dependencies, proceed with deletion
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Supplier cannot be deleted because it is linked to other records."},
                status=status.HTTP_400_BAD_REQUEST,
            )

class VanListCreateView(generics.ListCreateAPIView):
    serializer_class = VanSerializer

    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Van.objects.filter(warehouse_id=warehouse_id)
        return Van.objects.all()

    def perform_create(self, serializer):
        # The warehouse will be included in the request data
        serializer.save()

class VanRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VanSerializer
    
    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Van.objects.filter(warehouse_id=warehouse_id)
        return Van.objects.all()

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
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse_id')  # Keep warehouse_id for compatibility
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
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
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse_id')  # Keep warehouse_id for compatibility
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
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
        # ✅ FIXED: Support both header and query param methods
        warehouse_id = self.request.headers.get('X-Warehouse-ID')
        if not warehouse_id:
            warehouse_param = self.request.query_params.get('warehouse')
            warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Receiving.objects.select_related('supplier', 'warehouse').prefetch_related('details').filter(warehouse_id=warehouse_id).order_by('-id')
        return Receiving.objects.select_related('supplier', 'warehouse').prefetch_related('details').order_by('-id')

    def perform_create(self, serializer):
        warehouse_id = self.request.headers.get('X-Warehouse-ID')
        if not warehouse_id:
            warehouse_param = self.request.query_params.get('warehouse')
            warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        print(f"Received warehouse_id: {warehouse_id}")  # Debug log

        if warehouse_id:
            try:
                warehouse = Warehouse.objects.get(id=warehouse_id)
                print(f"Found warehouse: {warehouse}")  # Debug log
                receiving = serializer.save(warehouse=warehouse)
            except Warehouse.DoesNotExist:
                print(f"Warehouse {warehouse_id} not found")  # Debug log
                receiving = serializer.save()
        else:
            print("No warehouse_id provided")  # Debug log
            receiving = serializer.save()

        # Stock update is handled in ReceivingSerializer.create() method
        print(f"Receiving {receiving.receive_no} created successfully")

    def create(self, request, *args, **kwargs):
        try:
            print(f"Request data: {request.data}")  # Optional debug
            print(f"Request headers: {dict(request.headers)}")  # Optional debug
            return super().create(request, *args, **kwargs)
        except Exception as e:
            print("Error creating receiving:")
            import traceback
            print(traceback.format_exc())
            return Response({"detail": f"Error creating receiving: {str(e)}"}, status=500)

class ReceivingDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ReceivingSerializer
    
    def get_queryset(self):
        # ✅ FIXED: Support both header and query param methods
        warehouse_id = self.request.headers.get('X-Warehouse-ID')
        if not warehouse_id:
            warehouse_param = self.request.query_params.get('warehouse')
            warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Receiving.objects.filter(warehouse_id=warehouse_id)
        return Receiving.objects.all()

# ===== STOCKS =====
class StockListCreateView(generics.ListCreateAPIView):
    serializer_class = StockSerializer

    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse', None)
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
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

class StockDetailView(APIView):
    def get(self, request):
        product_id = request.query_params.get("product_id")
        warehouse_param = request.query_params.get("warehouse")

        if not product_id:
            return Response({"detail": "Product ID is required."}, status=400)

        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        filters = {'product_id': product_id}
        if warehouse_id:
            filters['warehouse_id'] = warehouse_id

        try:
            stock = Stock.objects.get(**filters)
            return Response({"quantity_available": stock.quantity_available})
        except Stock.DoesNotExist:
            return Response({"quantity_available": 0})  # ← Instead of NotFound

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

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Transaction types are managed by the system."},
            status=status.HTTP_403_FORBIDDEN
        )

class TransactionTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = TransactionType.objects.all()
    serializer_class = TransactionTypeSerializer

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "Transaction types cannot be updated."},
            status=status.HTTP_403_FORBIDDEN
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Transaction types cannot be deleted."},
            status=status.HTTP_403_FORBIDDEN
        )

class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Customer.objects.filter(warehouse=warehouse_id).order_by('name')
        return Customer.objects.all().order_by('name')

    def perform_create(self, serializer):
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            serializer.save(warehouse_id=warehouse_id)
        else:
            serializer.save()

class CustomerRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerSerializer
    
    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return Customer.objects.filter(warehouse=warehouse_id)
        return Customer.objects.all()

# ------------------------------------------------------------
# MerchandisingSale (summary list) – simple list/create/update
# ------------------------------------------------------------
class MerchandisingSaleViewSet(viewsets.ModelViewSet):
    queryset = MerchandisingSale.objects.all().order_by("-id")
    serializer_class = MerchandisingSaleSerializer

    # Totals are better computed on the backend that creates this record,
    # but if you want to accept client-provided numbers, keep perform_*.
    def perform_create(self, serializer):
        data = self.request.data
        serializer.save(
            total_trading_amount=data.get("total_trading_amount", 0) or 0,
            total_expenses_amount=data.get("total_expenses_amount", 0) or 0
        )

    def perform_update(self, serializer):
        data = self.request.data
        serializer.save(
            total_trading_amount=data.get("total_trading_amount", 0) or 0,
            total_expenses_amount=data.get("total_expenses_amount", 0) or 0
        )

# ------------------------------------------------------------
# Merchandising CRUD (nested create handled by serializer)
# ------------------------------------------------------------
class MerchandisingListCreateView(generics.ListCreateAPIView):
    serializer_class = MerchandisingSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        qs = (
            Merchandising.objects
            .select_related("transaction_type", "route", "van", "warehouse")
            .prefetch_related("items", "misc_items", "payments")   # <-- ensure related_name='misc_items' on model
            .order_by("-id")
        )
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        
        return qs

    def create(self, request, *args, **kwargs):
        # ---- Raw payload check (did FE send misc_items?) ----
        print(">>> VIEWS.create raw keys:", list(request.data.keys()))
        print(">>> VIEWS.create raw misc_items:", request.data.get("misc_items"))

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # ---- Validated payload check (did DRF keep misc_items?) ----
        vd = serializer.validated_data
        print(">>> VIEWS.perform_create validated keys:", list(vd.keys()))
        print(">>> VIEWS.perform_create validated misc_items len:", len(vd.get("misc_items", [])))

        # Always attach warehouse from logged-in user (if present)
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)

        # Save and log the created object id
        if warehouse_id:
            obj = serializer.save(warehouse_id=warehouse_id)
        else:
            obj = serializer.save()

        print(">>> VIEWS.perform_create created Merchandising id:", obj.id)

class MerchandisingDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MerchandisingSerializer
    
    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        queryset = Merchandising.objects.select_related(
            "transaction_type", "route", "van", "warehouse"
        ).prefetch_related("items", "misc_items", "payments")
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset

class MerchandisingListView(generics.ListAPIView):
    serializer_class = MerchandisingSerializer

    def get_queryset(self):
        qs = Merchandising.objects.select_related(
            "transaction_type", "route", "van", "warehouse"
        ).prefetch_related("items", "misc_items", "payments").order_by("-id")
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        
        return qs

@api_view(['GET'])
def merchandising_sales_list(request):
    sales = MerchandisingSale.objects.all().order_by('-id')
    serializer = MerchandisingSaleSerializer(sales, many=True)
    return Response(serializer.data)

# ------------------------------------------------------------
# Next MSP number preview (mirrors model save() logic)
# ------------------------------------------------------------
class NextMspNoView(APIView):
    """
    Query params:
      - transaction_type: int (required)
      - warehouse: int (required for correct scoping)
    """
    def get(self, request):
        tt_id = request.query_params.get("transaction_type")
        warehouse_param = request.query_params.get("warehouse")

        if not tt_id:
            return Response({"detail": "Transaction type is required."},
                            status=status.HTTP_400_BAD_REQUEST)

        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if not warehouse_id:
            return Response({"detail": "Warehouse is required."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            tt = TransactionType.objects.get(id=tt_id)
        except TransactionType.DoesNotExist:
            return Response({"detail": "Invalid transaction type ID."},
                            status=status.HTTP_400_BAD_REQUEST)

        tt_name = (tt.name or "").strip().lower()
        today = timezone.localdate()

        # Prefix helper (kept inline to avoid import loops)
        prefix = "WA" if tt_name == "warehouse" else ("VA" if tt_name == "van load" else "XX")

        if tt_name == "warehouse":
            today = timezone.localdate()

            # If today's sequence exists → reuse its number
            seq = MSPSequence.objects.filter(
                date=today, warehouse_id=warehouse_id, transaction_type=tt
            ).first()

            if seq and seq.last_number:
                msp_no = f"{prefix}-{seq.last_number:04d}"
                return Response({"msp_no": msp_no})

            # Else, preview the number that will be set for today on first save
            last_rec = (
                Merchandising.objects
                .filter(warehouse_id=warehouse_id, transaction_type=tt)
                .exclude(msp_no__isnull=True)
                .order_by('-id')
                .first()
            )
            if last_rec and '-' in last_rec.msp_no:
                try:
                    prev_num = int(last_rec.msp_no.split('-')[1])
                except ValueError:
                    prev_num = 0
            else:
                prev_num = 0

            msp_no = f"{prefix}-{(prev_num + 1):04d}"
            return Response({"msp_no": msp_no})

        # api/views.py, in NextMspNoView.get()
        if tt_name == "van load":
            seq = MSPSequence.objects.filter(
                date__isnull=True,                # ← filter the timeless row
                warehouse_id=warehouse_id,
                transaction_type=tt
            ).first()
            next_num = (seq.last_number + 1) if seq else 1
            msp_no = f"{prefix}-{next_num:04d}"
            return Response({"msp_no": msp_no})

        # Fallback
        return Response({"msp_no": f"{prefix}-0001"})

# ------------------------------------------------------------
# Stock endpoints (warehouse-scoped, safe math)
# ------------------------------------------------------------
class StockAvailabilityView(APIView):
    def get(self, request, product_id):
        warehouse_param = request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        try:
            if warehouse_id:
                stock = Stock.objects.get(product_id=product_id, warehouse_id=warehouse_id)
            else:
                stock = Stock.objects.filter(product_id=product_id).order_by("-id").first()
                if not stock:
                    raise Stock.DoesNotExist
            return Response({
                "product_id": product_id,
                "quantity_available": int(stock.quantity_available or 0)
            })
        except Stock.DoesNotExist:
            return Response({"detail": "Product stock not found."}, status=status.HTTP_404_NOT_FOUND)

class UpdateStockView(APIView):
    def put(self, request, product_id):
        warehouse_param = request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        try:
            if warehouse_id:
                stock = Stock.objects.get(product_id=product_id, warehouse_id=warehouse_id)
            else:
                stock = Stock.objects.filter(product_id=product_id).order_by("-id").first()
                if not stock:
                    raise Stock.DoesNotExist

            try:
                delta = int(request.data.get('quantity_available', 0))
            except (TypeError, ValueError):
                return Response({"error": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

            new_qty = int(stock.quantity_available or 0) - max(delta, 0)
            if new_qty < 0:
                return Response({"error": "Insufficient stock."}, status=status.HTTP_400_BAD_REQUEST)

            stock.quantity_available = new_qty
            stock.save(update_fields=["quantity_available"])
            return Response({"message": "Stock updated", "new_quantity": new_qty}, status=status.HTTP_200_OK)

        except Stock.DoesNotExist:
            return Response({"detail": "Product stock not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PATCH'])
def restore_stock(request, pk):
    warehouse_param = request.query_params.get('warehouse')
    warehouse_id = get_user_warehouse_filter(request.user, warehouse_param)
    
    try:
        if warehouse_id:
            stock = Stock.objects.get(product_id=pk, warehouse_id=warehouse_id)
        else:
            stock = Stock.objects.filter(product_id=pk).order_by("-id").first()
            if not stock:
                raise Stock.DoesNotExist

        try:
            qty = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid quantity.'}, status=400)

        if qty <= 0:
            return Response({'error': 'Quantity must be greater than zero.'}, status=400)

        stock.quantity_available = int(stock.quantity_available or 0) + qty
        stock.save(update_fields=["quantity_available"])
        return Response({'status': 'restored', 'new_quantity': stock.quantity_available})

    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=404)

# ------------------------------------------------------------
# MerchandisingItem (optional simple endpoints)
# ------------------------------------------------------------
class MerchandisingItemListCreateView(generics.ListCreateAPIView):
    queryset = MerchandisingItem.objects.select_related("merchandising", "product").all()
    serializer_class = MerchandisingItemSerializer

class MerchandisingItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MerchandisingItem.objects.select_related("merchandising", "product").all()
    serializer_class = MerchandisingItemSerializer

@api_view(["GET"])
@permission_classes([AllowAny])
def warehouse_groups_view(request):
    """
    Query params (optional):
      - warehouse: int (defaults to logged-in user's warehouse if available)
      - date: YYYY-MM-DD  (optional; if not provided, returns recent groups)
    """
    warehouse_param = request.query_params.get("warehouse")
    warehouse_id = get_user_warehouse_filter(request.user, warehouse_param)
    
    day = request.query_params.get("date")

    # Only 'Warehouse' transactions, scoped by warehouse
    qs = (Merchandising.objects
          .select_related("transaction_type", "warehouse")
          .filter(transaction_type__name__iexact="warehouse"))

    if warehouse_id:
        qs = qs.filter(warehouse_id=warehouse_id)
    if day:
        qs = qs.filter(date_time__date=day)

    # Group by MSP + calendar day (avoid accidental cross-day merges)
    groups = (qs
        .values("msp_no", "date_time__date")
        .annotate(
            txn_count=Count("id"),
            total_actual_sale=Sum("actual_sale"),
            last_id=Max("id"),  # for stable sort
        )
        .order_by("-date_time__date", "-last_id"))

    data = [{
        "msp_no": g["msp_no"],
        "date": str(g["date_time__date"]),
        "txn_count": g["txn_count"],
        "total_actual_sale": float(g["total_actual_sale"] or 0),
    } for g in groups]

    return Response(data)

# --- NEW: Details per Warehouse MSP (aggregate items by product) ---
from django.db.models import Sum, Max

@api_view(["GET"])
@permission_classes([AllowAny])
def warehouse_details_view(request):
    """
    Query params:
      - msp_no: str (required)
      - warehouse: int (defaults to logged-in user's warehouse if available)
      - date: YYYY-MM-DD (optional but recommended to ensure same-day scope)
    """
    msp_no = request.query_params.get("msp_no")
    if not msp_no:
        return Response({"detail": "msp_no is required."}, status=400)

    warehouse_param = request.query_params.get("warehouse")
    warehouse_id = get_user_warehouse_filter(request.user, warehouse_param)
    
    day = request.query_params.get("date")

    header_qs = Merchandising.objects.filter(
        transaction_type__name__iexact="warehouse",
        msp_no=msp_no,
    )
    if warehouse_id:
        header_qs = header_qs.filter(warehouse_id=warehouse_id)
    if day:
        header_qs = header_qs.filter(date_time__date=day)

    if not header_qs.exists():
        return Response({"detail": "No records found for that MSP No."}, status=404)

    item_qs = MerchandisingItem.objects.filter(merchandising__in=header_qs)

    agg = (item_qs
        .values("product", "product__product_name")
        .annotate(
            sold_shell_sum=Sum("sold_shell"),
            sold_pcs_sum=Sum("sold_pcs"),
            ret_shell_sum=Sum("empty_return_shell"),
            ret_pcs_sum=Sum("empty_return_pcs"),
            actual_sale_sum=Sum("actual_sale"),
        )
        .order_by("product__product_name"))

    items = [{
        "product": r["product"],
        "product_name": r["product__product_name"],
        "sold_shell": int(r["sold_shell_sum"] or 0),
        "sold_pcs": int(r["sold_pcs_sum"] or 0),
        "returned_empty_shell": int(r["ret_shell_sum"] or 0),
        "returned_empty_pcs": int(r["ret_pcs_sum"] or 0),
        "actual_sale": float(r["actual_sale_sum"] or 0),
    } for r in agg]

    overall_total = sum(i["actual_sale"] for i in items)

    # Use the most recent header's timestamp for display
    latest_dt = header_qs.aggregate(dt=Max("date_time"))["dt"]

    return Response({
        "msp_no": msp_no,
        "date": latest_dt.date().isoformat() if latest_dt else day,
        "items": items,
        "overall_total": overall_total,
    })

class VanLoadReturnView(APIView):
    # keep auth if the rest of your API uses it
    # permission_classes = [IsAuthenticated]

    def post(self, request):
        sale_id  = request.data.get("sale_id")
        items    = request.data.get("products", [])

        if not sale_id or not isinstance(items, list):
            return Response({"detail": "sale_id and products[] are required."}, status=400)

        # Find the sale to get the warehouse
        try:
            sale = (Merchandising.objects
                    .select_related("warehouse")
                    .get(pk=sale_id))
        except Merchandising.DoesNotExist:
            return Response({"detail": "Sale not found."}, status=404)

        # idempotency guard (don't double-add)
        if getattr(sale, "full_returns_applied", False):
            return Response({"detail": "Returns already applied for this sale."}, status=409)

        with transaction.atomic():
            for it in items:
                product_id = it.get("productId") or it.get("product")
                if not product_id:
                    continue

                # Prefer PCS; if missing, compute from shell × content_no
                pcs = it.get("expected_return_pcs_nonempty")
                if pcs is None:
                    shell = float(it.get("expected_return_shell_nonempty") or 0)
                    try:
                        prod = Product.objects.select_related("unit_type").get(pk=product_id)
                        content_no = int(getattr(prod.unit_type, "content_no", 1) or 1)
                    except Product.DoesNotExist:
                        continue
                    pcs = int(round(shell * content_no))
                else:
                    pcs = int(float(pcs))

                if pcs <= 0:
                    continue

                # Upsert + lock the stock row for this (product, warehouse)
                wh_id = sale.warehouse_id
                stk = (Stock.objects
                           .select_for_update()
                           .filter(product_id=product_id, warehouse_id=wh_id)
                           .first())
                if stk is None:
                    stk = Stock(product_id=product_id, warehouse_id=wh_id, quantity_available=0)

                stk.quantity_available = int(stk.quantity_available or 0) + pcs
                stk.save()

            # mark so we can't apply twice
            if hasattr(sale, "full_returns_applied"):
                sale.full_returns_applied = True
                sale.save(update_fields=["full_returns_applied"])

        return Response({"ok": True}, status=200)

class MiscellaneousItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MiscellaneousItem.objects.all()
    serializer_class = MiscellaneousItemSerializer

class MiscellaneousItemListCreateView(generics.ListCreateAPIView):
    serializer_class = MiscellaneousItemSerializer
    
    def get_queryset(self):
        queryset = MiscellaneousItem.objects.all()
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            # Filter by warehouse through merchandising relationship
            queryset = queryset.filter(
                merchandising__warehouse=warehouse_id
            ).select_related('merchandising')
        
        return queryset.order_by('-id')  # Order by ID instead of created_at
    
    def perform_create(self, serializer):
        # Get warehouse from request data
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        # Save the serializer with the warehouse if provided
        if warehouse_id:
            serializer.save(warehouse_id=warehouse_id)
        else:
            serializer.save()

class PaymentListCreateView(generics.ListCreateAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

class ReturnableStockListCreateView(generics.ListCreateAPIView):
    serializer_class = ReturnableStockSerializer

    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            return ReturnableStock.objects.filter(warehouse=warehouse_id)
        return ReturnableStock.objects.all()

class ReturnableStockDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ReturnableStock.objects.all()
    serializer_class = ReturnableStockSerializer

class SupplierReturnListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierReturnSerializer

    def get_queryset(self):
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse')
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
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
    
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from .models import User
from django.contrib.auth import get_user_model

class ChangePasswordAPIView(APIView):
    def post(self, request):
        # Retrieve data from the request
        uidb64 = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        # Check for missing data
        if not uidb64 or not token or not new_password:
            return Response({"error": "Missing data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Decode uidb64 to get the user ID
            uid = urlsafe_base64_decode(uidb64).decode()
            user = get_user_model().objects.get(pk=int(uid))  # Ensure integer for user ID
        except (TypeError, ValueError, OverflowError, get_user_model().DoesNotExist):
            # Handle the case where the user is not found or the ID is invalid
            return Response({"error": "Invalid UID or User does not exist"}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the token is valid for the user
        if not default_token_generator.check_token(user, token):
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

        # Set the new password and save the user
        user.set_password(new_password)

        # Optionally, handle the must_change_password flag (if applicable to your app)
        user.must_change_password = False
        user.save()

        # Return success response
        return Response({"success": "Password changed successfully"}, status=status.HTTP_200_OK)

class SupplierReturnFormListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierReturnFormSerializer

    def get_queryset(self):
        queryset = SupplierReturnForm.objects.all().order_by('-date')
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse_id', None)  # Keep warehouse_id for compatibility
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset

class SupplierReturnFormDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SupplierReturnFormSerializer
    
    def get_queryset(self):
        queryset = SupplierReturnForm.objects.all()
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse_id', None)  # Keep warehouse_id for compatibility
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
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
            warehouse_param = request.data.get('warehouse_id')
            warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
            
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
                    
                    print("Looking for product with ID:", item['product'])

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
        
def to_decimal(v, default="0"):
    try:
        if v in (None, ""):
            return Decimal(default)
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)

def to_int(v, default=0):
    try:
        if v in (None, ""):
            return int(default)
        return int(Decimal(str(v)))
    except Exception:
        return int(default)

class VanLoadReturnAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]  # adjust if needed

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        sale_id = request.data.get('sale_id')
        if not sale_id:
            return Response({'detail': 'sale_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        merch = get_object_or_404(
            Merchandising.objects.select_related('transaction_type'),
            pk=sale_id
        )

        # Only allow Van Load transactions
        if merch.transaction_type and merch.transaction_type.name.lower() != 'van load':
            return Response({'detail': 'Only Van Load transactions can be updated here.'},
                            status=status.HTTP_400_BAD_REQUEST)

        products = request.data.get('products', [])
        if not isinstance(products, list):
            return Response({'detail': 'products must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        # -------- helpers --------
        def iz(v):
            try:
                return int(v or 0)
            except Exception:
                return 0

        def dz(v):
            try:
                return Decimal(str(v if v is not None else 0))
            except Exception:
                return Decimal('0')

        updated_ids = []

        # ---- per-item updates (unchanged logic, trust FE numbers) ----
        for p in products:
            product_id = p.get('productId')
            if not product_id:
                return Response({'detail': 'Each product row must have productId.'},
                                status=status.HTTP_400_BAD_REQUEST)

            # Lock the row for safe concurrent updates
            item = get_object_or_404(
                MerchandisingItem.objects.select_for_update(),
                merchandising=merch,
                product_id=product_id
            )

            # EMPTY returns
            item.empty_return_shell = iz(p.get('empty_return_shell'))
            item.empty_return_pcs   = iz(p.get('empty_return_pcs'))

            # WITH-CONTENTS returns
            item.actual_return_shell = iz(p.get('actual_return_shell'))
            item.actual_return_pcs   = iz(p.get('actual_return_pcs'))

            # DISCREPANCIES (trust FE)
            item.discrepancy_full_shell = iz(p.get('discrepancy_full_shell'))
            item.discrepancy_full_pcs   = iz(p.get('discrepancy_full_pcs'))

            # (Optional) accept FE actual_sale if you send it
            # item.actual_sale = dz(p.get('actual_sale'))

            item.save(update_fields=[
                'empty_return_shell', 'empty_return_pcs',
                'actual_return_shell', 'actual_return_pcs',
                'discrepancy_full_shell', 'discrepancy_full_pcs',
                # 'actual_sale',
            ])
            updated_ids.append(item.id)

        # ---- header-level updates (expected/actual/remarks) ----
        fields_to_update = []
        total_expected_sale = request.data.get('total_expected_sale')
        actual_sale_total   = request.data.get('actual_sale')
        remarks             = request.data.get('remarks')

        if total_expected_sale is not None:
            merch.expected_sale = dz(total_expected_sale)
            fields_to_update.append('expected_sale')

        if actual_sale_total is not None:
            merch.actual_sale = dz(actual_sale_total)
            fields_to_update.append('actual_sale')

        if remarks is not None:
            merch.remarks = remarks
            fields_to_update.append('remarks')

        # ---- NEW: save FE-computed discrepancy totals on the header ----
        # Expect these keys in the payload (sent from VanLoadUpdate.jsx):
        #   discrepancy_empty_total
        #   discrepancy_non_empty_total
        de  = request.data.get('discrepancy_empty_total', None)
        dne = request.data.get('discrepancy_non_empty_total', None)
        print(">>> DEBUG de/dne from FE:", de, dne)

        # also log the route view is really used:
        print(">>> DEBUG using VanLoadReturnAPIView for sale_id:", sale_id)

        # and log the update_fields about to be saved:
        print(">>> DEBUG will update:", fields_to_update)

        if de is not None:
            merch.discrepancy_empty = dz(de)
            fields_to_update.append('discrepancy_empty')
            print(f"Updating discrepancy_empty: {de}")

        if dne is not None:
            merch.discrepancy_non_empty = dz(dne)
            fields_to_update.append('discrepancy_non_empty')
            print(f"Updating discrepancy_non_empty: {dne}")

            # ✅ NEW: Capture Returned with Content total
            returned_with_content = request.data.get('returned_with_content', 0)
            merch.returned_with_content = dz(returned_with_content)
            fields_to_update.append('returned_with_content')
            print(f"Updating returned_with_content: {returned_with_content}")

        # Log the fields to update
        print(">>> Fields to update:", fields_to_update)

        # (Optional) mark that the return math has been applied once
        if not merch.full_returns_applied:
            merch.full_returns_applied = True
            fields_to_update.append('full_returns_applied')

        if fields_to_update:
            merch.save(update_fields=fields_to_update)

        return Response({
            'detail': 'Van load returns saved.',
            'updated_item_ids': updated_ids,
            # return the stored totals for confirmation
            'discrepancy_empty': str(merch.discrepancy_empty),
            'discrepancy_non_empty': str(merch.discrepancy_non_empty),
            "returned_with_content": str(merch.returned_with_content),

        }, status=status.HTTP_200_OK)
    
# --- BULK stock adjustments (add/deduct in PCS) -----------------------
class BulkAdjustStockView(APIView):
    # permission_classes = [IsAuthenticated]  # ← enable if you require auth

    def post(self, request):
        data = request.data or {}
        warehouse_param = data.get("warehouse")
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)

        try:
            warehouse_id = int(warehouse_id) if warehouse_id else None
        except (TypeError, ValueError):
            return Response({"detail": "warehouse must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        if not warehouse_id:
            return Response({"detail": "warehouse is required"}, status=status.HTTP_400_BAD_REQUEST)

        items = data.get("items") or []
        if not isinstance(items, list) or not items:
            return Response({"detail": "`items` must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure warehouse exists
        try:
            Warehouse.objects.only("id").get(id=warehouse_id)
        except Warehouse.DoesNotExist:
            return Response({"detail": f"warehouse {warehouse_id} not found"}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        try:
            with transaction.atomic():
                for it in items:
                    pid = it.get("product_id")
                    try:
                        pid = int(pid)
                    except (TypeError, ValueError):
                        return Response({"detail": f"invalid product_id: {pid}"}, status=status.HTTP_400_BAD_REQUEST)

                    try:
                        delta = int(it.get("delta", 0))
                    except (TypeError, ValueError):
                        return Response({"detail": f"invalid delta for product {pid}"}, status=status.HTTP_400_BAD_REQUEST)

                    if delta == 0:
                        continue  # no-op

                    # Ensure product exists
                    try:
                        Product.objects.only("id").get(id=pid)
                    except Product.DoesNotExist:
                        return Response({"detail": f"product {pid} not found"}, status=status.HTTP_400_BAD_REQUEST)

                    # Lock row to avoid race conditions; create if missing
                    stock = (Stock.objects
                             .select_for_update()
                             .filter(product_id=pid, warehouse_id=warehouse_id)
                             .first())
                    if stock is None:
                        stock = Stock(product_id=pid, warehouse_id=warehouse_id, quantity_available=0)

                    old_qty = int(stock.quantity_available or 0)
                    new_qty = old_qty + delta
                    if new_qty < 0:
                        return Response(
                            {"detail": f"Insufficient stock for product {pid}. "
                                       f"Available={old_qty}, requested change={delta}"},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    stock.quantity_available = new_qty
                    stock.save(update_fields=["quantity_available"]) if stock.pk else stock.save()

                    results.append({
                        "product_id": pid,
                        "old_qty": old_qty,
                        "applied_delta": delta,
                        "new_qty": int(stock.quantity_available),
                    })

            return Response({"warehouse": warehouse_id, "results": results}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"bulk-adjust failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VanLoadReturnUpdateAPIView(APIView):
    def post(self, request, *args, **kwargs):
        sale_id = request.data.get("sale_id")
        items = request.data.get("products", [])

        if not sale_id:
            return Response({"error": "Missing sale_id"}, status=status.HTTP_400_BAD_REQUEST)

        sale = get_object_or_404(Merchandising, id=sale_id)

        if not sale.warehouse_id:
            return Response({"error": "Sale has no warehouse set"}, status=status.HTTP_400_BAD_REQUEST)

        updated_items = []

        # -------- helpers --------
        def to_int(v):
            try:
                return int(v or 0)
            except Exception:
                return 0

        def to_decimal(v):
            try:
                return Decimal(str(v if v is not None else 0))
            except Exception:
                return Decimal('0')

        try:
            with transaction.atomic():
                # ---- per-item updates (unchanged logic, trust FE numbers) ----
                for data in items:
                    product_id = data.get("productId")
                    if not product_id:
                        continue

                    # Lock the row for safe concurrent updates
                    mi = MerchandisingItem.objects.filter(
                        merchandising=sale, product_id=product_id
                    ).first()
                    if not mi:
                        continue

                    # Int fields
                    for f in [
                        "sold_shell", "sold_pcs",
                        "empty_return_shell", "empty_return_pcs",
                        "discrepancy_empties_shell", "discrepancy_empties_pc",
                        "actual_return_shell", "actual_return_pcs",
                        "discrepancy_full_shell", "discrepancy_full_pcs",
                    ]:
                        if f in data:
                            setattr(mi, f, to_int(data.get(f)))

                    # Decimal fields
                    if "discount" in data or "discount_percent" in data:
                        mi.discount_percent = to_decimal(
                            data.get("discount", data.get("discount_percent"))
                        )
                    if "actual_sale" in data:
                        mi.actual_sale = to_decimal(data.get("actual_sale"))
                    if "expected_sale" in data:
                        mi.expected_sale = to_decimal(data.get("expected_sale"))

                    mi.save()
                    updated_items.append(MerchandisingItemSerializer(mi).data)

                # ---- header-level updates (expected/actual/remarks) ----
                fields_to_update = []
                total_expected_sale = request.data.get('total_expected_sale')
                actual_sale_total = request.data.get('actual_sale')
                remarks = request.data.get('remarks')

                if total_expected_sale is not None:
                    sale.expected_sale = to_decimal(total_expected_sale)
                    fields_to_update.append('expected_sale')

                if actual_sale_total is not None:
                    sale.actual_sale = to_decimal(actual_sale_total)
                    fields_to_update.append('actual_sale')

                if remarks is not None:
                    sale.remarks = remarks
                    fields_to_update.append('remarks')

                # ---- NEW: save FE-computed discrepancy totals on the header ----
                de = request.data.get('discrepancy_empty_total', None)
                dne = request.data.get('discrepancy_non_empty_total', None)
                print(">>> DEBUG de/dne from FE:", de, dne)

                if de is not None:
                    sale.discrepancy_empty = to_decimal(de)
                    fields_to_update.append('discrepancy_empty')
                    print(f"Updating discrepancy_empty: {de}")

                if dne is not None:
                    sale.discrepancy_non_empty = to_decimal(dne)
                    fields_to_update.append('discrepancy_non_empty')
                    print(f"Updating discrepancy_non_empty: {dne}")

                # Capture the empties price total and empty returns from FE
                empties_price_total = request.data.get('empties_price_total', 0)
                empty_returns = request.data.get('empty_returns', 0)

                # Add these new fields to the fields_to_update list
                sale.empties_price_total = to_decimal(empties_price_total)  # Store the total empties price
                sale.empty_returns = to_decimal(empty_returns)  # Store the total empty returns
                fields_to_update.append('empties_price_total')
                fields_to_update.append('empty_returns')

                # ✅ NEW: Capture Returned with Content total
                returned_with_content = request.data.get('returned_with_content', 0)
                sale.returned_with_content = to_decimal(returned_with_content)
                fields_to_update.append('returned_with_content')
                print(f"Updating returned_with_content: {returned_with_content}")

                # Log the fields to update
                print(">>> DEBUG Fields to update:", fields_to_update)

                # (Optional) mark that the return math has been applied once
                if not sale.full_returns_applied:
                    sale.full_returns_applied = True
                    fields_to_update.append('full_returns_applied')

                # Save updated fields
                if fields_to_update:
                    sale.save(update_fields=fields_to_update)

                # ---- CORRECTED Stock movements for Van Load completion ----
                for data in items:
                    product_id = data.get("productId")
                    if not product_id:
                        continue

                    # Handle unsold returns
                    actual_return_pcs = to_int(data.get("actual_return_pcs"))
                    if actual_return_pcs > 0:
                        stock_obj, _ = Stock.objects.get_or_create(
                            product_id=product_id, warehouse_id=sale.warehouse_id,
                            defaults={"quantity_available": 0}
                        )
                        
                        # Add back unsold returns to stock
                        old_qty = stock_obj.quantity_available or 0
                        Stock.objects.filter(pk=stock_obj.pk).update(
                            quantity_available=F("quantity_available") + actual_return_pcs
                        )
                        
                        stock_obj.refresh_from_db()
                        print(
                            f"[STOCK DEBUG] Unsold return added | MSP: {sale.msp_no} "
                            f"| Product: {Product.objects.get(id=product_id).product_name} "
                            f"| Returned: {actual_return_pcs} "
                            f"| Before: {old_qty} | After: {stock_obj.quantity_available}"
                        )

                    # Handle empty returns (shells/bottles) to ReturnableStock
                    empty_shells = to_int(data.get("empty_return_shell"))
                    empty_pcs = to_int(data.get("empty_return_pcs"))
                    if empty_shells or empty_pcs:
                        qs = ReturnableStock.objects.select_for_update().filter(
                            product_id=product_id,
                            warehouse_id=sale.warehouse_id,
                            source="customer",
                        )

                        obj = qs.filter(supplier__isnull=True).order_by("id").first() or qs.order_by("id").first()

                        if not obj:
                            obj = ReturnableStock.objects.create(
                                product_id=product_id,
                                warehouse_id=sale.warehouse_id,
                                source="customer",
                                supplier=None,
                                empty_shell_qty=0,
                                empty_bottle_qty=0,
                            )

                        ReturnableStock.objects.filter(pk=obj.pk).update(
                            empty_shell_qty=F("empty_shell_qty") + empty_shells,
                            empty_bottle_qty=F("empty_bottle_qty") + empty_pcs,
                        )

            # Debug final saved values
            sale.refresh_from_db()
            print(f"Saved Sale: {sale.empties_price_total}, {sale.empty_returns}")

            return Response(
                {
                    "message": "Van load return updated successfully",
                    "sale_id": sale.id,
                    "updated_items": updated_items,
                    "status": sale.status,
                    "discrepancy_empty": str(sale.discrepancy_empty),
                    "discrepancy_non_empty": str(sale.discrepancy_non_empty),
                    "empties_price_total": str(sale.empties_price_total),  # Include the stored value
                    "empty_returns": str(sale.empty_returns),  # Include the stored value
                    "returned_with_content": str(sale.returned_with_content),

                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            import traceback; traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

# ----------------------
# Holiday ViewSet
# ----------------------
class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [AllowAny]  # allow testing


# ----------------------
# Forecast ViewSet
# ----------------------
class ForecastViewSet(viewsets.ModelViewSet):
    queryset = Forecast.objects.select_related("product").all()
    serializer_class = ForecastSerializer
    permission_classes = [AllowAny]  # allow testing

    def get_queryset(self):
        queryset = self.queryset
        product_id = self.request.query_params.get("product_id")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if start_date and end_date:
            queryset = queryset.filter(date__range=[start_date, end_date])

        return queryset.order_by("date")


# ----------------------
# Generate Forecast API
# ----------------------
class GenerateForecastAPIView(APIView):
    permission_classes = [AllowAny]   # TEMP for testing

    def post(self, request, *args, **kwargs):
        product_id = request.data.get("product")
        days = int(request.data.get("days", 30))

        if not product_id:
            return Response({"detail": "product is required"}, status=400)

        # ------------------------------------------
        # 1) Fetch historical sales grouped by DATE
        # ------------------------------------------
        qs = (
            MerchandisingItem.objects
            .filter(product_id=product_id)
            .annotate(sale_date=TruncDate("merchandising__date_time"))
            .values("sale_date")
            .annotate(y=Sum("sold_pcs"))
            .order_by("sale_date")
        )

        rows = list(qs)

        # 🔥 FIX: Remove rows where sale_date is None
        rows = [r for r in rows if r["sale_date"] is not None]

        # ------------------------------------------
        # Padding logic
        # ------------------------------------------
        if len(rows) == 0:
            today = timezone.now().date()
            rows = [
                {"sale_date": today - timedelta(days=1), "y": 10},
                {"sale_date": today, "y": 12},
            ]

        elif len(rows) == 1:
            only = rows[0]
            d = only["sale_date"]
            rows = [
                {"sale_date": d - timedelta(days=1), "y": only["y"]},
                {"sale_date": d, "y": only["y"]},
            ]

        # ------------------------------------------
        # 3) Build DataFrame for Prophet
        # ------------------------------------------
        df = pd.DataFrame(rows)
        df.rename(columns={"sale_date": "ds"}, inplace=True)
        df["ds"] = pd.to_datetime(df["ds"]).dt.tz_localize(None)  # REMOVE TZ
        df = df[["ds", "y"]]

        # ------------------------------------------
        # 4) Prepare Holidays (optional)
        # ------------------------------------------
        holidays_qs = Holiday.objects.all().values("name", "date")
        holidays = [{"ds": pd.to_datetime(h["date"]), "holiday": h["name"]} for h in holidays_qs]
        holidays_df = pd.DataFrame(holidays) if holidays else None

        # ------------------------------------------
        # 5) Fit Prophet
        # ------------------------------------------
        try:
            m = Prophet(holidays=holidays_df)
            m.fit(df)
        except Exception as e:
            return Response({"detail": f"Prophet fitting failed: {str(e)}"}, status=500)

        # ------------------------------------------
        # 6) Forecast future
        # ------------------------------------------
        future = m.make_future_dataframe(periods=days)
        forecast = m.predict(future)

        # ------------------------------------------
        # 7) Save forecast into DB
        # ------------------------------------------
        created = []
        last_hist_date = df["ds"].max().date()

        for _, row in forecast.iterrows():
            ds = pd.to_datetime(row["ds"]).date()
            if ds < last_hist_date:
                continue

            f = Forecast.objects.update_or_create(
                product_id=product_id,
                date=ds,
                defaults={
                    "forecast": int(max(0, round(row["yhat"]))),
                    "lower": int(max(0, round(row["yhat_lower"]))),
                    "upper": int(max(0, round(row["yhat_upper"]))),
                },
            )[0]

            created.append(f)

        serializer = ForecastSerializer(created, many=True)
        return Response(serializer.data, status=201)        