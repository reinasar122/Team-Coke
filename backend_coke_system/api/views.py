# api/views.py - CORRECTED VERSION WITH CONSISTENT WAREHOUSE FILTERING

from decimal import Decimal, InvalidOperation          # 👈 for to_decimal()
from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404  
from django.db.models.functions import Coalesce
from django.db.models import F, Case, When, Value, IntegerField, Sum, Count
from rest_framework import viewsets
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView
from api.models import Warehouse, RoleAccessibility
from .serializers import WarehouseSerializer
from .pos_auth import create_pos_session_token
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
from django.db.utils import OperationalError, ProgrammingError
from .models import *
from .serializers import *
from datetime import datetime
from django.utils import timezone
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


from math import floor, ceil
from datetime import date
from collections import defaultdict

from .models import Notification
from .models import Notification, NotificationPreference, ProcessedNotification, VanLoadEditApprovalRequest
from .serializers import (
    NotificationSerializer, NotificationCreateSerializer, NotificationUpdateSerializer,
    BulkNotificationUpdateSerializer, NotificationPreferenceSerializer,
    NotificationStatsSerializer, CreateNotificationRequestSerializer
)

@api_view(['GET', 'POST'])
def stock_settings(request):
    if request.method == 'GET':
        # Return default or saved settings
        defaults = {
            'low_threshold': 10,
            'moderate_threshold': 50,
            'high_threshold': 100,
        }
        return Response(defaults)
    
    elif request.method == 'POST':
        # Save settings (you can store in database or file)
        thresholds = request.data
        # Here you would save to database
        # For now, just return success
        return Response({'message': 'Settings saved successfully'})


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
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import User
import random
from django.core.cache import cache
from django.core.mail import send_mail  # You might need to switch to SMS service in production

class SendOTPAPIView(APIView):
    def post(self, request):
        phone_number = request.data.get('phone_number', '').strip()
        if not phone_number:
            return Response({"error": "Phone number is required"}, status=400)

        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        # Check if OTP already exists
        if user.otp and user.otp_required:
            # If OTP is already sent, clear it and generate a new one
            user.otp = None
            user.otp_required = True
            user.otp_expiry = None
            user.save(update_fields=["otp", "otp_required", "otp_expiry"])

        # Generate a new 6-digit OTP
        otp = str(random.randint(100000, 999999))
        user.otp = otp
        user.otp_required = True
        user.otp_expiry = timezone.now() + timedelta(minutes=5)
        user.save(update_fields=["otp", "otp_required", "otp_expiry"])

        # Send OTP to user via SMS (Simulated here)
        self.send_sms_otp(user.phone_number, otp)
        return Response({"message": "OTP sent to your phone number"}, status=200)

    def send_sms_otp(self, phone_number, otp):
        # Simulate sending OTP (replace with actual SMS service if needed)
        print(f"OTP for {phone_number} is: {otp}")  # Example debug message

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import User

class VerifyOTPAPIView(APIView):
    def post(self, request):
        phone_number = request.data.get('phone_number', '').strip()
        otp = request.data.get('otp', '').strip()
        mode = request.data.get('mode', 'signup')  # Add mode parameter

        if not phone_number or not otp:
            return Response({"error": "Phone number and OTP are required"}, status=400)

        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        if user.otp_expiry and timezone.now() > user.otp_expiry:
            user.otp = None
            user.otp_required = False
            user.otp_expiry = None
            user.save(update_fields=["otp", "otp_required", "otp_expiry"])
            return Response({"error": "OTP has expired. Please request a new OTP."}, status=400)

        if not user.otp or str(user.otp) != otp:
            return Response({"error": "Invalid OTP. Please try again."}, status=400)

        # Clear OTP
        user.otp = None
        user.otp_required = False
        user.otp_expiry = None

        if mode == "forgot":
            # Generate password reset token
            token = default_token_generator.make_token(user)
            encoded_uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            user.save(update_fields=["otp", "otp_required", "otp_expiry"])
            
            return Response({
                "message": "OTP verified. You can now reset your password.",
                "encoded_uid": encoded_uid,
                "token": token
            }, status=200)
        else:
            # Signup mode
            user.is_active = False
            user.is_approved = False
            user.status = "Pending Approval"
            user.save(update_fields=["otp", "otp_required", "otp_expiry", "is_active", "is_approved", "status"])            
            return Response({
                "message": "Phone verified. Your account is now pending admin approval.",
                "user": {
                    "id": user.id,
                    "phone_number": user.phone_number,
                    "email": user.email,
                    "status": user.status,
                }
            }, status=200)
        
class CancelPendingSignupAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone_number = request.data.get("phone_number", "").strip()
        if not phone_number:
            return Response({"error": "Phone number is required"}, status=400)

        user = User.objects.filter(phone_number=phone_number).first()
        if not user:
            return Response({"message": "No pending signup found."}, status=200)

        status_value = str(getattr(user, "status", "") or "").strip().lower()
        is_cancellable_pending_signup = (
            status_value == "pending"
            and not bool(getattr(user, "is_approved", False))
            and not bool(getattr(user, "is_active", False))
            and getattr(user, "role_id", None) is None
            and getattr(user, "warehouse_id", None) is None
        )

        if not is_cancellable_pending_signup:
            return Response(
                {"error": "This signup can no longer be cancelled."},
                status=400,
            )

        user.delete()
        return Response({"message": "Pending signup cancelled."}, status=200)        

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
    

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import User

class ConfirmUserCreation(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            # Fetch user by ID
            user = User.objects.get(id=user_id, status="Pending Approval")
            user.status = "Active"
            user.is_active = True
            user.is_approved = True  # Set user as approved
            user.save()

            # Optionally, notify the user that they have been activated
            self.send_activation_email(user)

            return Response({"message": "User has been approved and activated."}, status=200)
        except User.DoesNotExist:
            return Response({"error": "User not found or already approved."}, status=404)

    def send_activation_email(self, user):
        subject = "Your account has been approved"
        message = f"Hello {user.first_name},\n\nYour account has been approved and is now active."
        send_mail(subject, message, 'no-reply@myapp.com', [user.email])


import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer

# Set up logger
logger = logging.getLogger(__name__)

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            print("Validated data:", serializer.validated_data)  # Debugging line
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            print("Errors:", serializer.errors)  # Debugging line
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import RoleAccessibility
class HasAccessPermission(BasePermission):
    """
    Check if the user's role has permission for a submenu,
    based on boolean fields: full, view, create, edit, delete.
    """

    def _resolve_user(self, request):
        # Preferred: authenticated user context
        user = request.user
        if getattr(user, "is_authenticated", False):
            return user

        # Compatibility fallback for this codebase (custom login, no token auth)
        header_user_id = request.headers.get("X-User-ID") or request.META.get("HTTP_X_USER_ID")
        if not header_user_id:
            return None

        try:
            return User.objects.select_related("role").get(pk=int(header_user_id))
        except (User.DoesNotExist, ValueError, TypeError):
            return None

    def has_permission(self, request, view):
        user = self._resolve_user(request)
        role = getattr(user, "role", None) if user else None
        submenu_name = getattr(view, "submenu_name", None)

        # Must resolve a user role + submenu name
        if not role or not submenu_name:
            return False

        # Always allow Admin role
        if getattr(role, "name", "").lower() == "admin":
            return True

        try:
            access = RoleAccessibility.objects.get(role=role, submenu=submenu_name)
        except RoleAccessibility.DoesNotExist:
            return False

        # Map HTTP method to boolean fields
        if request.method in SAFE_METHODS:         # GET, HEAD, OPTIONS
            return access.view or access.full
        if request.method == "POST":
            return access.create or access.full
        if request.method in ("PUT", "PATCH"):
            return access.edit or access.full
        if request.method == "DELETE":
            return access.delete or access.full

        return False

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
    
from rest_framework import generics, status
from rest_framework.response import Response
from .serializers import UserSerializer
from .models import User
from rest_framework.permissions import IsAuthenticated

from rest_framework.permissions import AllowAny  # already imported above

class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]  # ✅ allow your React app to call /users/

    # you can still use filters here later (by warehouse, etc.)


    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        self.send_admin_notification(user)

        return Response(
            {"message": "User created. Awaiting admin approval."},
            status=status.HTTP_201_CREATED
        )

    def send_admin_notification(self, user):
        subject = "New User Pending Approval"
        message = f"A new user has been created. Please approve the account for {user.username}."
        send_mail(subject, message, 'no-reply@myapp.com', ['admin@myapp.com'])


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
        #Supplier model currently has no warehouse FK, so ignore warehouse filter here.
        #Keep endpoint stable for frontend polling that sends ?warehouse=...
        return Supplier.objects.all()

class SupplierRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SupplierSerializer
    
    def get_queryset(self):
        #Supplier model currently has no warehouse FK.
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
        #Vans are shared accross warehouses; keep list global.
        return Van.objects.all()

    def perform_create(self, serializer):
        # The warehouse will be included in the request data
        serializer.save()

class VanRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VanSerializer
    
    def get_queryset(self):
        #vans are shared accross warehouses.
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
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
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

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)
    
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
        

class StockUpdateAPIView(APIView):
    def patch(self, request, *args, **kwargs):
        product_id = request.data.get("product_id")
        quantity = request.data.get("quantity")
        warehouse_id = request.data.get("warehouse_id")
        action_type = request.data.get("action_type")  # 'add' or 'subtract'

        if not product_id or quantity is None or action_type not in ["add", "subtract"]:
            return Response({"error": "Missing product_id, quantity or action_type"}, status=status.HTTP_400_BAD_REQUEST)

        stock = Stock.objects.filter(product_id=product_id, warehouse_id=warehouse_id)

        if not stock.exists():
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        for s in stock:
            if action_type == "subtract":
                if s.quantity_available < quantity:
                    return Response({"error": f"Insufficient stock for product {s.product_id}"}, status=status.HTTP_400_BAD_REQUEST)
                s.quantity_available -= quantity
            elif action_type == "add":
                s.quantity_available += quantity
            s.save()

        return Response({"message": "Stock updated successfully"}, status=status.HTTP_200_OK)



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
            # pass the FK id using the field name "warehouse"
            serializer.save(warehouse=warehouse_id)
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

    def _get_user_role_name(self, user):
        raw_role = getattr(user, "role", None)
        if isinstance(raw_role, str):
            return raw_role.strip().lower()
        if raw_role is None:
            return ""
        return (getattr(raw_role, "name", "") or "").strip().lower()

    def _is_cashier(self, user):
        return self._get_user_role_name(user) == "cashier"

    def _is_van_load(self, merchandising_obj):
        transaction_type = getattr(merchandising_obj, "transaction_type", None)
        transaction_name = (getattr(transaction_type, "name", "") or "").strip().lower()
        return transaction_name == "van load"

    def _resolve_requester_id(self, request):
        raw_requester_id = request.data.get("requester_id")
        if raw_requester_id is None:
            raw_requester_id = getattr(request.user, "id", None)
        try:
            requester_id = int(raw_requester_id)
        except (TypeError, ValueError):
            return None
        return requester_id if requester_id > 0 else None

    def _is_cashier_actor(self, requester_id, request_user):
        if requester_id is not None:
            requester = User.objects.select_related("role").filter(id=requester_id).first()
            if requester and self._is_cashier(requester):
                return True
        return self._is_cashier(request_user)

    def _get_request_queryset(self, merchandising_obj, requester_id=None):
        queryset = VanLoadEditApprovalRequest.objects.filter(
            sale_id=merchandising_obj.id,
        )
        if requester_id is not None:
            queryset = queryset.filter(requested_by_id=requester_id)
        warehouse_id = getattr(merchandising_obj, "warehouse_id", None)
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        return queryset

    def _get_latest_request(self, merchandising_obj, requester_id=None):
        return (
            self._get_request_queryset(merchandising_obj, requester_id)
            .order_by("-requested_at", "-id")
            .first()
        )

    def _get_latest_approved_request(self, merchandising_obj, requester_id=None):
        latest_request = self._get_latest_request(merchandising_obj, requester_id)
        if not latest_request:
            return None
        if str(latest_request.status or "").strip().lower() != VanLoadEditApprovalRequest.STATUS_APPROVED:
            return None
        return latest_request

    def _get_approved_request_by_id(self, merchandising_obj, request_id, requester_id=None):
        try:
            request_id_int = int(request_id)
        except (TypeError, ValueError):
            return None

        return (
            self._get_request_queryset(merchandising_obj, requester_id)
            .filter(
                id=request_id_int,
                status=VanLoadEditApprovalRequest.STATUS_APPROVED,
            )
            .order_by("-reviewed_at", "-requested_at", "-id")
            .first()
        )

    def _consume_approval_request(self, approval_request, user=None, consumed_by_id=None):
        if not approval_request:
            return

        consumed_at = timezone.now()
        approval_request.status = "used"
        approval_request.save(update_fields=["status", "updated_at"])

        resolved_consumer_id = consumed_by_id
        if resolved_consumer_id is None and user is not None:
            resolved_consumer_id = getattr(user, "id", None)

        request_notification = (
            Notification.objects
            .filter(
                source_id=f"van_load_edit_request:{approval_request.id}",
                source_type="van_load_edit_request",
            )
            .order_by("-created_at")
            .first()
        )
        if request_notification:
            request_data = request_notification.data or {}
            request_data.update({
                "request_status": "used",
                "consumed_by_id": resolved_consumer_id,
                "consumed_at": consumed_at.isoformat(),
                "consumed_reason": "cashier_saved_van_load_edit",
            })
            request_notification.data = request_data
            request_notification.is_read = True
            request_notification.read_at = consumed_at
            request_notification.save(update_fields=["data", "is_read", "read_at", "updated_at"])

    def patch(self, request, *args, **kwargs):
        merchandising_obj = self.get_object()
        requester_id = self._resolve_requester_id(request)
        is_cashier_actor = self._is_cashier_actor(requester_id, request.user)
        approval_request = self._get_approved_request_by_id(
            merchandising_obj,
            request.data.get("van_load_edit_request_id"),
            requester_id,
        )

        if is_cashier_actor and self._is_van_load(merchandising_obj):
            if not approval_request:
                approval_request = self._get_latest_approved_request(merchandising_obj, requester_id)
            if not approval_request:
                return Response(
                    {
                        "error": "Admin approval is required before editing Van Load.",
                        "code": "van_load_edit_approval_required",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        response = super().patch(request, *args, **kwargs)

        if (
            is_cashier_actor
            and
            approval_request
            and response.status_code >= 200
            and response.status_code < 300
        ):
            self._consume_approval_request(
                approval_request,
                request.user,
                consumed_by_id=requester_id,
            )

        return response

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
            dispatched_shell_sum=Sum("dispatched_shell"),
            dispatched_pcs_sum=Sum("dispatched_pcs"),
            sold_shell_sum=Sum("sold_shell"),
            sold_pcs_sum=Sum("sold_pcs"),
            ret_shell_sum=Sum("empty_return_shell"),
            ret_pcs_sum=Sum("empty_return_pcs"),
            actual_sale_sum=Sum("actual_sale"),
        )
        .order_by("product__product_name"))

    latest_header = header_qs.order_by("-date_time", "-id").first()
    latest_status = str(latest_header.status or "").strip().lower() if latest_header else ""
    is_reserved = latest_status == "reserved"

    items = [{
        "product": r["product"],
        "product_name": r["product__product_name"],
        "reserved_shell": int(r["dispatched_shell_sum"] or 0),
        "reserved_pcs": int(r["dispatched_pcs_sum"] or 0),
        "sold_shell": int(r["sold_shell_sum"] or 0),
        "sold_pcs": int(r["sold_pcs_sum"] or 0),
        "returned_empty_shell": int(r["ret_shell_sum"] or 0),
        "returned_empty_pcs": int(r["ret_pcs_sum"] or 0),
        "display_shell": int((r["dispatched_shell_sum"] if is_reserved else r["sold_shell_sum"]) or 0),
        "display_pcs": int((r["dispatched_pcs_sum"] if is_reserved else r["sold_pcs_sum"]) or 0),
        "actual_sale": float(r["actual_sale_sum"] or 0),
    } for r in agg]

    overall_total = sum(i["actual_sale"] for i in items)

    latest_dt = latest_header.date_time if latest_header else None

    return Response({
        "msp_no": msp_no,
        "date": latest_dt.date().isoformat() if latest_dt else day,
        "status": latest_header.status if latest_header else None,
        "reserved_date": latest_header.reserved_date.isoformat() if getattr(latest_header, "reserved_date", None) else None,
        "actual_pickup_date": latest_header.actual_pickup_date.isoformat() if getattr(latest_header, "actual_pickup_date", None) else None,
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

from django.core.exceptions import ObjectDoesNotExist
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

class LoginAPIView(APIView):
    def post(self, request):
        try:
            serializer = LoginSerializer(data=request.data)
            if serializer.is_valid():
                return Response(serializer.validated_data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except ObjectDoesNotExist as e:
            print(f"ObjectDoesNotExist Error: {str(e)}")
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            # Log the exception with more details for debugging
            print(f"Unexpected Error in LoginAPIView: {str(e)}")
            print(f"Request data: {request.data}")
            import traceback
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    otp = serializers.CharField(min_length=6, max_length=6, required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        phone_number = data.get('phone_number')
        password = data.get('password')

        try:
            # Get user
            user = User.objects.filter(phone_number=phone_number).first()
            if not user:
                raise serializers.ValidationError("User not found.")

            # Check password
            if not user.check_password(password):
                raise serializers.ValidationError("Incorrect username or password.")

            # Check if user is active
            if not user.is_active:
                raise serializers.ValidationError("Account is inactive.")

            # Check if user has a role assigned
            if not user.role:
                raise serializers.ValidationError("User role not assigned.")

            # Safely check if user is admin
            is_admin = False
            try:
                if user.role and user.role.name:
                    is_admin = user.role.name.lower() in ['admin', 'administrator', 'super admin']
            except AttributeError as e:
                print(f"Error checking admin role: {str(e)}")
                is_admin = False
            
            # Check approval status (skip for admins)
            if not is_admin and not user.is_approved:
                raise serializers.ValidationError("Account pending approval.")
            
            # Check warehouse assignment (you might want to make this optional for some users)
            if not user.warehouse:
                raise serializers.ValidationError("User warehouse not assigned.")

            # Safely get access list
            access_list = []
            try:
                if user.role:
                    access_list = RoleAccessibility.objects.filter(role=user.role).values(
                        'submenu', 'full', 'view', 'create', 'edit', 'delete'
                    )
                    access_list = list(access_list)  # Convert to list here
            except Exception as e:
                print(f"Error fetching access list: {str(e)}")
                access_list = []

            # Safely build return data
            return {
                "id": user.id,
                "phone_number": user.phone_number,
                "role": user.role.name if (user.role and hasattr(user.role, 'name')) else None,
                "warehouse": user.warehouse.name if (user.warehouse and hasattr(user.warehouse, 'name')) else None,
                "warehouse_id": user.warehouse.id if (user.warehouse and hasattr(user.warehouse, 'id')) else None,
                "must_change_password": getattr(user, 'must_change_password', False),
                "accessibilities": access_list,
                "token": create_pos_session_token(user),
            }
            
        except serializers.ValidationError:
            # Re-raise validation errors as they should be returned as 400 Bad Request
            raise
        except Exception as e:
            # Log unexpected errors and raise a generic validation error
            print(f"Unexpected error in LoginSerializer.validate: {str(e)}")
            import traceback
            traceback.print_exc()
            raise serializers.ValidationError("An unexpected error occurred during login validation.")

from django.core.exceptions import ObjectDoesNotExist 
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import User

class ChangePasswordAPIView(APIView):
    def post(self, request):
        uidb64 = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not uidb64 or not token or not new_password:
            return Response({"error": "Missing data"}, status=400)

        try:
            # Decode UID
            uid = force_str(urlsafe_base64_decode(uidb64))
            # Debug: you can temporarily print this
            # print("Decoded UID:", uid)
            user = User.objects.get(pk=uid)
        except User.DoesNotExist:
            return Response({"error": "Invalid UID: user not found"}, status=400)
        except Exception:
            return Response({"error": "Invalid UID"}, status=400)

        # Check token
        if not default_token_generator.check_token(user, token):
            return Response({"error": "Invalid or expired token"}, status=400)

        # Set new password
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        return Response({"success": "Password changed successfully"})


class SupplierReturnFormListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierReturnFormSerializer

    def get_queryset(self):
        queryset = SupplierReturnForm.objects.all().order_by('-date')
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse_id', None)
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset

class SupplierReturnFormDetailView(generics.RetrieveUpdateDestroyAPIView):  # CHANGED: Added UpdateAPIView
    serializer_class = SupplierReturnFormSerializer
    
    def get_queryset(self):
        queryset = SupplierReturnForm.objects.all()
        
        # ✅ FIXED: Apply consistent warehouse filtering
        warehouse_param = self.request.query_params.get('warehouse_id', None)
        warehouse_id = get_user_warehouse_filter(self.request.user, warehouse_param)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        return queryset
    
    # ADD THIS METHOD to handle partial updates (PATCH)
    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

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
        if hasattr(sale, "mobile_van_load_batch"):
            return Response({"detail": "Use this mobile van load's return declaration endpoint."}, status=status.HTTP_409_CONFLICT)

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

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        warehouse_id = request.query_params.get("warehouse_id")

        # 1) Build actual sales map in Python (not using TruncDate)
        items = (
            MerchandisingItem.objects
            .select_related("merchandising")
            .values("product_id", "merchandising__date_time", "sold_pcs")
        )
        if warehouse_id:
            items = items.filter(merchandising__warehouse_id=warehouse_id)

        actual_map = defaultdict(int)  # key = (product_id, date) -> total sold_pcs

        for row in items:
            dt = row["merchandising__date_time"]
            if dt is None:
                continue

            d = timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()
            key = (row["product_id"], d)
            actual_map[key] += row["sold_pcs"] or 0

        # 2) Attach "actual" to each forecast row
        for item in data:
            d = date.fromisoformat(item["date"])  # "2025-08-19" -> date
            key = (item["product"], d)
            item["actual"] = actual_map.get(key)

        return Response(data)



    def get_queryset(self):
        queryset = self.queryset
        product_id = self.request.query_params.get("product_id")
        warehouse_id = self.request.query_params.get("warehouse_id")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if warehouse_id:
            queryset = queryset.filter(product__warehouse_id=warehouse_id)
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
        warehouse_id = request.data.get("warehouse_id")
        days = int(request.data.get("days", 30))
        target_date = request.data.get("target_date")

        if not product_id:
            return Response({"detail": "product is required"}, status=400)

        # ------------------------------------------
        # 1) Fetch historical sales grouped by DATE
        # ------------------------------------------
        items_qs = (
            MerchandisingItem.objects
            .filter(product_id=product_id)
            .select_related("merchandising")
            .values("merchandising__date_time", "sold_pcs")
        )
        if warehouse_id:
            items_qs = items_qs.filter(merchandising__warehouse_id=warehouse_id)

        daily_sales = defaultdict(int)
        for row in items_qs:
            dt = row["merchandising__date_time"]
            if dt is None:
                continue

            sale_date = timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()
            daily_sales[sale_date] += row["sold_pcs"] or 0

        rows = [
            {"sale_date": sale_date, "y": qty}
            for sale_date, qty in sorted(daily_sales.items())
            if qty > 0
        ]

        # ------------------------------------------
        # Padding logic
        # ------------------------------------------
        if len(rows) == 0:
            return Response([], status=200)

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

        last_hist_date = df["ds"].max().date()
        if target_date:
            try:
                target = date.fromisoformat(str(target_date))
                days = max(days, (target - last_hist_date).days)
            except ValueError:
                return Response({"detail": "target_date must be YYYY-MM-DD"}, status=400)
        days = max(days, 30)

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


        for _, row in forecast.iterrows():
            ds = pd.to_datetime(row["ds"]).date()

            f = Forecast.objects.update_or_create(
                product_id=product_id,
                date=ds,
                defaults = {
                    "forecast": int(max(0, round(row["yhat"]))),
                    "lower": int(max(0, floor(row["yhat_lower"]))),
                    "upper": int(max(0, ceil(row["yhat_upper"]))),
                    },
            )[0]

            created.append(f)

        serializer = ForecastSerializer(created, many=True)
        return Response(serializer.data, status=201)        
    

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter notifications based on user role and warehouse"""
        user = self.request.user
        queryset = Notification.objects.filter(is_deleted=False)
        
        # Get user role and warehouse
        raw_role = getattr(user, 'role', None)
        user_role = raw_role
        if isinstance(user_role, str):
            user_role = user_role.strip().lower()
        elif raw_role is not None:
            user_role = (getattr(raw_role, 'name', '') or '').strip().lower()
        else:
            user_role = 'staff'
        warehouse_id = (
            self.request.query_params.get('warehouse')
            or self.request.headers.get('X-Warehouse-ID')
        )
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        # Filter based on user role and targeting
        is_admin_role = (
            user_role in {'admin', 'administrator', 'super admin'}
            or ('admin' in user_role if user_role else False)
        )
        if is_admin_role:
            # Admin can see all notifications in their warehouse context
            admin_warehouse_id = getattr(user, 'warehouse_id', None)
            if admin_warehouse_id and not warehouse_id:
                queryset = queryset.filter(warehouse_id=admin_warehouse_id)
        else:
            # Other roles see notifications targeted to them or their role
            queryset = queryset.filter(
                Q(user=user) | Q(target_roles__contains=[user_role])
            )
        
        # Apply additional filters
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(type=notification_type)
        
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
        
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return NotificationCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return NotificationUpdateSerializer
        return NotificationSerializer
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read(request.user)
        return Response({'status': 'marked as read'})
    
    @action(detail=True, methods=['post'])
    def mark_unread(self, request, pk=None):
        """Mark a notification as unread"""
        notification = self.get_object()
        notification.is_read = False
        notification.read_at = None
        notification.save(update_fields=['is_read', 'read_at'])
        return Response({'status': 'marked as unread'})
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update notifications"""
        serializer = BulkNotificationUpdateSerializer(data=request.data)
        if serializer.is_valid():
            notification_ids = serializer.validated_data['notification_ids']
            action = serializer.validated_data['action']
            
            queryset = self.get_queryset().filter(id__in=notification_ids)
            
            if action == 'mark_read':
                queryset.update(
                    is_read=True,
                    read_at=timezone.now()
                )
            elif action == 'mark_unread':
                queryset.update(
                    is_read=False,
                    read_at=None
                )
            elif action == 'delete':
                queryset.update(
                    is_deleted=True,
                    deleted_at=timezone.now()
                )
            
            return Response({'status': f'{action} completed for {queryset.count()} notifications'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all user's notifications as read"""
        warehouse_id = request.data.get('warehouse_id')
        queryset = self.get_queryset().filter(is_read=False)
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        count = queryset.update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({'status': f'marked {count} notifications as read'})
    
    @action(detail=False, methods=['post'])
    def clear_all(self, request):
        """Clear all user's notifications"""
        warehouse_id = request.data.get('warehouse_id')
        queryset = self.get_queryset()
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        count = queryset.update(
            is_deleted=True,
            deleted_at=timezone.now()
        )
        
        return Response({'status': f'cleared {count} notifications'})
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get notification statistics"""
        queryset = self.get_queryset()
        warehouse_id = request.query_params.get('warehouse')
        
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        
        total = queryset.count()
        unread = queryset.filter(is_read=False).count()
        
        # Group by type
        by_type = dict(
            queryset.values('type')
            .annotate(count=Count('type'))
            .values_list('type', 'count')
        )
        
        # Group by priority
        by_priority = dict(
            queryset.values('priority')
            .annotate(count=Count('priority'))
            .values_list('priority', 'count')
        )
        
        # Group by category
        by_category = dict(
            queryset.values('category')
            .annotate(count=Count('category'))
            .values_list('category', 'count')
        )
        
        stats_data = {
            'total': total,
            'unread': unread,
            'by_type': by_type,
            'by_priority': by_priority,
            'by_category': by_category
        }
        
        serializer = NotificationStatsSerializer(data=stats_data)
        if serializer.is_valid():
            return Response(serializer.data)
        
        return Response(stats_data)
    
    @action(detail=False, methods=['delete'])
    def cleanup_old(self, request):
        """Clean up old notifications (7+ days)"""
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        cutoff_date = timezone.now() - timedelta(days=7)
        
        # Only delete read notifications or low priority notifications
        count = Notification.objects.filter(
            Q(created_at__lt=cutoff_date) & 
            (Q(is_read=True) | Q(priority='low'))
        ).update(
            is_deleted=True,
            deleted_at=timezone.now()
        )
        
        return Response({'status': f'cleaned up {count} old notifications'})

class CreateNotificationAPIView(APIView):
    """API endpoint for creating notifications from frontend events"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = CreateNotificationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        notification_type = serializer.validated_data['notification_type']
        data = serializer.validated_data['data']
        user_role = serializer.validated_data['user_role']
        warehouse_id = serializer.validated_data.get('warehouse_id')
        target_user_id = serializer.validated_data.get('target_user_id')
        
        # Create notification using the factory method
        notification = self.create_notification(
            notification_type, data, user_role, warehouse_id, target_user_id
        )
        
        if notification:
            serializer = NotificationSerializer(notification)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response({'error': 'Failed to create notification'}, status=status.HTTP_400_BAD_REQUEST)
    
    def create_notification(self, notification_type, data, user_role, warehouse_id=None, target_user_id=None):
        """Factory method to create notifications based on type"""
        
        # Check if this notification was already processed
        source_id = data.get('id', str(timezone.now().timestamp()))
        identifier = f"{notification_type}-{source_id}-{warehouse_id}"
        
        if ProcessedNotification.objects.filter(identifier=identifier).exists():
            return None
        
        # Determine target roles based on notification type and user role
        target_roles = self.get_target_roles(notification_type, user_role)
        
        # Get notification configuration
        config = self.get_notification_config(notification_type, data)
        if not config:
            return None
        
        # Create the notification
        notification_data = {
            'type': notification_type,
            'category': config['category'],
            'title': config['title'],
            'message': config['message'],
            'details': config.get('details'),
            'priority': config.get('priority', 'medium'),
            'target_roles': target_roles,
            'warehouse_id': warehouse_id,
            'data': data,
            'source_id': source_id,
            'source_type': config.get('source_type'),
        }
        
        if target_user_id:
            try:
                notification_data['user'] = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                pass
        
        notification = Notification.objects.create(**notification_data)
        
        # Mark as processed
        ProcessedNotification.objects.create(
            identifier=identifier,
            notification_type=notification_type,
            warehouse_id=warehouse_id,
            source_id=source_id
        )
        
        return notification
    
    def get_target_roles(self, notification_type, user_role):
        """Determine which roles should see this notification"""
        role_permissions = {
            'admin': ['inventory', 'expenses', 'suppliers', 'warehouse', 'system', 'sales', 'payments', 'products', 'returns'],
            'supervisor': ['inventory', 'expenses', 'suppliers', 'warehouse', 'payments'],
            'cashier': ['inventory', 'payments'],
            'staff': ['inventory', 'payments']
        }
        
        notification_categories = {
            'low_stock': 'inventory',
            'out_of_stock': 'inventory',
            'stock_adjustment': 'inventory',
            'new_receiving': 'inventory',
            'reserved_pickup_due': 'inventory',
            'expense_created': 'expenses',
            'expense_updated': 'expenses',
            'expense_deleted': 'expenses',
            'large_expense': 'expenses',
            'credit_created': 'payments',
            'credit_overdue': 'payments',
            'paid_credit': 'payments',
            'supplier_added': 'suppliers',
            'supplier_updated': 'suppliers',
            'supplier_return_processed': 'suppliers',
            'warehouse_msp_created': 'warehouse',
            'warehouse_msp_updated': 'warehouse',
            'role_updated': 'system',
            'admin_settings_changed': 'system',
            'product_created': 'products',
            'product_updated': 'products',
            'product_deleted': 'products',
            'return_processed': 'returns',
            'refund_issued': 'returns',
        }
        
        category = notification_categories.get(notification_type, 'inventory')
        target_roles = []
        
        for role, permissions in role_permissions.items():
            if category in permissions:
                target_roles.append(role)
        
        return target_roles
    
    def get_notification_config(self, notification_type, data):
        """Get notification configuration based on type"""
        configs = {
            'low_stock': {
                'category': 'inventory',
                'title': 'Low Stock Alert',
                'message': f"{data.get('product_name', 'Unknown Product')} is running low",
                'details': f"Current quantity: {data.get('quantity_available', 0)} PCS",
                'priority': 'high',
                'source_type': 'stock'
            },
            'out_of_stock': {
                'category': 'inventory',
                'title': 'Out of Stock Alert',
                'message': f"{data.get('product_name', 'Unknown Product')} is out of stock",
                'details': "Immediate restocking required - Current quantity: 0 units",
                'priority': 'high',
                'source_type': 'stock'
            },
            'stock_adjustment': {
                'category': 'inventory',
                'title': data.get('custom_title', 'Stock Adjustment Made'),
                'message': data.get('custom_message', f"Stock adjusted for {data.get('product_name', 'Unknown Product')}"),
                'details': self.format_stock_adjustment_details(data),
                'priority': 'high' if data.get('new_quantity') == 0 else 'medium',
                'source_type': 'stock'
            },
            'reserved_pickup_due': {
                'category': 'inventory',
                'title': 'Reserved Pickup Due Today',
                'message': f"{data.get('customer_name', 'Reserved customer')} has a pickup scheduled today",
                'details': f"MSP: {data.get('msp_no', data.get('sale_id', 'Unknown'))} - Pick Up Date: {data.get('reserved_date', 'Today')}",
                'priority': 'high',
                'source_type': 'merchandising'
            },
            'credit_created': {
                'category': 'payments',
                'title': 'New Credit Sale Created',
                'message': f"Credit sale created for {data.get('customer_name', 'Unknown Customer')}",
                'details': self.format_credit_details(data, 'created'),
                'priority': 'medium',
                'source_type': 'credit'
            },
            'credit_overdue': {
                'category': 'payments',
                'title': 'Credit Payment Overdue',
                'message': f"Overdue payment: {data.get('customer_name', 'Unknown Customer')} - {data.get('days_overdue', 0)} days late",
                'details': self.format_credit_details(data, 'overdue'),
                'priority': 'high' if data.get('days_overdue', 0) > 30 else 'medium',
                'source_type': 'credit'
            },
            'paid_credit': {
                'category': 'payments',
                'title': 'Credit Payment Received',
                'message': self.format_credit_payment_message(data),
                'details': self.format_credit_details(data, 'paid'),
                'priority': 'low',
                'source_type': 'credit'
            },
            'expense_created': {
                'category': 'expenses',
                'title': 'New Expense Created',
                'message': f"Expense: {data.get('description', 'New expense recorded')}",
                'details': self.format_expense_details(data),
                'priority': 'high' if float(data.get('amount', 0)) > 10000 else 'low',
                'source_type': 'expense'
            },
            'large_expense': {
                'category': 'expenses',
                'title': 'Large Expense Alert',
                'message': f"High-value expense flagged: {data.get('description', 'Large expense')}",
                'details': f"Amount: ₱{float(data.get('amount', 0)):,.2f} - Exceeds threshold",
                'priority': 'high',
                'source_type': 'expense'
            }
        }
        
        return configs.get(notification_type)
    
    def format_stock_adjustment_details(self, data):
        """Format stock adjustment details"""
        old_qty = data.get('old_quantity')
        new_qty = data.get('new_quantity')
        
        if old_qty is not None and new_qty is not None:
            old_qty = int(old_qty)
            new_qty = int(new_qty)
            change_diff = abs(new_qty - old_qty)
            change_type = 'increased' if new_qty > old_qty else 'decreased'
            
            if new_qty == 0:
                return f"Stock depleted: {old_qty} → 0 units ({change_diff} units removed)"
            elif change_type == 'increased':
                return f"Stock increased: {old_qty} → {new_qty} units (+{change_diff} units added)"
            else:
                return f"Stock reduced: {old_qty} → {new_qty} units (-{change_diff} units removed)"
        
        return data.get('reason', 'Manual stock adjustment detected')
    
    def format_credit_details(self, data, action):
        """Format credit notification details"""
        msp_no = data.get('msp_no') or f"Credit #{data.get('id')}"
        balance = float(data.get('balance', 0))
        
        if action == 'created':
            return f"MSP: {msp_no} - Amount: ₱{balance:,.2f}"
        elif action == 'overdue':
            return f"Outstanding: ₱{balance:,.2f}"
        elif action == 'paid':
            customer = data.get('customer_name', 'Unknown')
            return f"Customer: {customer} - Amount: ₱{balance:,.2f}"
        
        return f"MSP: {msp_no}"
    
    def format_credit_payment_message(self, data):
        """Format credit payment message"""
        msp_no = data.get('msp_no')
        credit_id = data.get('id')
        
        if msp_no:
            return f"Payment received for {msp_no}"
        elif credit_id:
            return f"Payment received for Credit #{credit_id}"
        else:
            return "Credit payment received"
    
    def format_expense_details(self, data):
        """Format expense details"""
        amount = float(data.get('amount', 0))
        category = data.get('category', 'General')
        return f"Amount: ₱{amount:,.2f} - Category: {category}"
    
ADMIN_ROLE_NAMES = {'admin', 'administrator', 'super admin'}


def _get_role_name(user):
    role = getattr(user, 'role', None)
    if role is None:
        return ''
    return (getattr(role, 'name', '') or '').strip().lower()


def _is_admin_account(user):
    role_name = _get_role_name(user)
    return role_name in ADMIN_ROLE_NAMES or ('admin' in role_name if role_name else False)


def _display_user_name(user):
    full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    if full_name:
        return full_name
    if getattr(user, 'email', None):
        return user.email
    return f"User #{user.id}"


class VanLoadEditApprovalRequestCreateAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            sale_id = request.data.get('sale_id')
            requester_id = request.data.get('requester_id')
            warehouse_id = request.data.get('warehouse_id')
            msp_no = (request.data.get('msp_no') or '').strip() or None

            try:
                sale_id = int(sale_id)
                requester_id = int(requester_id)
                warehouse_id = int(warehouse_id) if warehouse_id is not None else None
            except (TypeError, ValueError):
                return Response(
                    {'error': 'sale_id, requester_id and warehouse_id must be valid integers.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            requester = User.objects.filter(id=requester_id).first()
            if not requester:
                return Response({'error': 'Requester not found.'}, status=status.HTTP_404_NOT_FOUND)

            if _get_role_name(requester) != 'cashier':
                return Response(
                    {'error': 'Only cashier users can request Van Load edit approval.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            requester_warehouse_id = getattr(requester, 'warehouse_id', None)
            if requester_warehouse_id is not None and warehouse_id is not None and requester_warehouse_id != warehouse_id:
                return Response(
                    {'error': 'Cashier can only request approval for their assigned warehouse.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            effective_warehouse_id = requester_warehouse_id if requester_warehouse_id is not None else warehouse_id
            if effective_warehouse_id is None:
                return Response(
                    {'error': 'Cashier warehouse is required before sending approval request.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            latest_request = (
                VanLoadEditApprovalRequest.objects
                .filter(
                    sale_id=sale_id,
                    requested_by_id=requester_id,
                    warehouse_id=effective_warehouse_id,
                )
                .order_by('-requested_at', '-id')
                .first()
            )
            latest_status = str(getattr(latest_request, "status", "") or "").strip().lower()
            if latest_status == VanLoadEditApprovalRequest.STATUS_PENDING:
                return Response({
                    'request_id': latest_request.id,
                    'status': latest_request.status,
                    'message': 'Approval request is already pending.',
                    'already_requested': True,
                }, status=status.HTTP_200_OK)
            if latest_status == VanLoadEditApprovalRequest.STATUS_APPROVED:
                return Response({
                    'request_id': latest_request.id,
                    'status': latest_request.status,
                    'message': 'Approval already granted.',
                    'already_requested': True,
                }, status=status.HTTP_200_OK)

            approval_request = VanLoadEditApprovalRequest.objects.create(
                sale_id=sale_id,
                msp_no=msp_no,
                warehouse_id=effective_warehouse_id,
                requested_by=requester,
                status=VanLoadEditApprovalRequest.STATUS_PENDING,
            )

            requester_name = _display_user_name(requester)
            reference_label = msp_no or f"Sale #{sale_id}"

            Notification.objects.create(
                type='van_load_edit_request',
                category='warehouse',
                title='Van Load Edit Approval Request',
                message=f'{requester_name} requested to edit {reference_label}.',
                details='Open this request and choose Approve or Reject.',
                priority='high',
                target_roles=['admin', 'administrator', 'super admin'],
                warehouse_id=effective_warehouse_id,
                data={
                    'approval_flow': 'van_load_edit',
                    'request_status': 'pending',
                    'request_id': approval_request.id,
                    'sale_id': sale_id,
                    'msp_no': msp_no,
                    'warehouse_id': effective_warehouse_id,
                    'requested_by_id': requester.id,
                    'requested_by_name': requester_name,
                    'requested_at': approval_request.requested_at.isoformat(),
                    'is_van_load': True,
                },
                source_id=f'van_load_edit_request:{approval_request.id}',
                source_type='van_load_edit_request',
            )

            return Response({
                'request_id': approval_request.id,
                'status': approval_request.status,
                'message': 'Approval request sent to admin.',
                'requested_at': approval_request.requested_at,
                'already_requested': False,
            }, status=status.HTTP_201_CREATED)
        except (OperationalError, ProgrammingError):
            return Response(
                {'error': 'Approval request setup is incomplete. Run database migration and restart backend.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VanLoadEditApprovalStatusAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        sale_id = request.query_params.get('sale_id')
        requester_id = request.query_params.get('requester_id')
        warehouse_id = request.query_params.get('warehouse_id')

        try:
            sale_id = int(sale_id)
            requester_id = int(requester_id)
            warehouse_id = int(warehouse_id) if warehouse_id is not None else None
        except (TypeError, ValueError):
            return Response(
                {'error': 'sale_id and requester_id are required and must be integers. warehouse_id must be an integer when provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        requester = User.objects.filter(id=requester_id).only('id', 'warehouse_id').first()
        if not requester:
            return Response({'error': 'Requester not found.'}, status=status.HTTP_404_NOT_FOUND)

        effective_warehouse_id = warehouse_id if warehouse_id is not None else getattr(requester, 'warehouse_id', None)
        queryset = (
            VanLoadEditApprovalRequest.objects
            .filter(sale_id=sale_id, requested_by_id=requester_id)
        )
        if effective_warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=effective_warehouse_id)

        latest_request = queryset.order_by('-requested_at', '-id').first()
        if not latest_request:
            return Response({'status': 'none'}, status=status.HTTP_200_OK)

        normalized_status = str(latest_request.status or '').strip().lower()
        if normalized_status not in {
            VanLoadEditApprovalRequest.STATUS_PENDING,
            VanLoadEditApprovalRequest.STATUS_APPROVED,
            VanLoadEditApprovalRequest.STATUS_REJECTED,
        }:
            return Response({
                'status': 'none',
                'last_status': normalized_status,
            }, status=status.HTTP_200_OK)

        return Response({
            'request_id': latest_request.id,
            'status': latest_request.status,
            'sale_id': latest_request.sale_id,
            'msp_no': latest_request.msp_no,
            'warehouse_id': latest_request.warehouse_id,
            'review_notes': latest_request.review_notes,
            'requested_at': latest_request.requested_at,
            'reviewed_at': latest_request.reviewed_at,
        }, status=status.HTTP_200_OK)


class VanLoadEditApprovalPendingListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        admin_id = request.query_params.get('admin_id')
        warehouse_id = request.query_params.get('warehouse_id')

        try:
            admin_id = int(admin_id)
            warehouse_id = int(warehouse_id) if warehouse_id is not None else None
        except (TypeError, ValueError):
            return Response(
                {'error': 'admin_id must be an integer. warehouse_id must be an integer when provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_user = User.objects.filter(id=admin_id).first()
        if not admin_user:
            return Response({'error': 'Admin user not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _is_admin_account(admin_user):
            return Response({'error': 'Only admin users can view pending requests.'}, status=status.HTTP_403_FORBIDDEN)
        if not getattr(admin_user, 'warehouse_id', None):
            return Response({'error': 'Admin must be assigned to a warehouse before reviewing requests.'}, status=status.HTTP_403_FORBIDDEN)

        admin_warehouse_id = int(admin_user.warehouse_id)
        if warehouse_id is not None and warehouse_id != admin_warehouse_id:
            return Response(
                {'error': 'You can only view requests for your assigned warehouse.'},
                status=status.HTTP_403_FORBIDDEN
            )

        queryset = (
            VanLoadEditApprovalRequest.objects
            .filter(
                status=VanLoadEditApprovalRequest.STATUS_PENDING,
                warehouse_id=admin_warehouse_id
            )
            .select_related('requested_by')
            .order_by('-requested_at')
        )

        payload = []
        for item in queryset:
            payload.append({
                'request_id': item.id,
                'sale_id': item.sale_id,
                'msp_no': item.msp_no,
                'warehouse_id': item.warehouse_id,
                'status': item.status,
                'requested_by_id': item.requested_by_id,
                'requested_by_name': _display_user_name(item.requested_by),
                'requested_at': item.requested_at,
            })

        return Response(payload, status=status.HTTP_200_OK)


class VanLoadEditApprovalDecisionAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, request_id):
        action = (request.data.get('action') or '').strip().lower()
        admin_id = request.data.get('admin_id')
        review_notes = (request.data.get('review_notes') or '').strip() or None

        if action not in {'approve', 'reject'}:
            return Response({'error': "action must be either 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            admin_id = int(admin_id)
            request_id = int(request_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'request_id and admin_id must be valid integers.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_user = User.objects.filter(id=admin_id).first()
        if not admin_user:
            return Response({'error': 'Admin user not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not _is_admin_account(admin_user):
            return Response({'error': 'Only admin users can approve or reject requests.'}, status=status.HTTP_403_FORBIDDEN)
        if not getattr(admin_user, 'warehouse_id', None):
            return Response({'error': 'Admin must be assigned to a warehouse before reviewing requests.'}, status=status.HTTP_403_FORBIDDEN)

        approval_request = (
            VanLoadEditApprovalRequest.objects
            .select_related('requested_by')
            .filter(id=request_id)
            .first()
        )
        if not approval_request:
            return Response({'error': 'Approval request not found.'}, status=status.HTTP_404_NOT_FOUND)
        if int(approval_request.warehouse_id or 0) != int(admin_user.warehouse_id):
            return Response(
                {'error': 'You can only approve/reject requests from your assigned warehouse.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if approval_request.status != VanLoadEditApprovalRequest.STATUS_PENDING:
            return Response(
                {'error': f"Request is already {approval_request.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = (
            VanLoadEditApprovalRequest.STATUS_APPROVED
            if action == 'approve'
            else VanLoadEditApprovalRequest.STATUS_REJECTED
        )

        approval_request.status = new_status
        approval_request.reviewed_by = admin_user
        approval_request.review_notes = review_notes
        approval_request.reviewed_at = timezone.now()
        approval_request.save(update_fields=['status', 'reviewed_by', 'review_notes', 'reviewed_at', 'updated_at'])

        admin_name = _display_user_name(admin_user)
        request_reference = approval_request.msp_no or f"Sale #{approval_request.sale_id}"

        request_notification = (
            Notification.objects
            .filter(
                source_id=f'van_load_edit_request:{approval_request.id}',
                source_type='van_load_edit_request'
            )
            .order_by('-created_at')
            .first()
        )
        if request_notification:
            request_data = request_notification.data or {}
            request_data.update({
                'request_status': new_status,
                'reviewed_by_id': admin_user.id,
                'reviewed_by_name': admin_name,
                'reviewed_at': approval_request.reviewed_at.isoformat(),
                'review_notes': approval_request.review_notes,
            })
            request_notification.data = request_data
            request_notification.is_read = True
            request_notification.read_at = timezone.now()
            request_notification.save(update_fields=['data', 'is_read', 'read_at', 'updated_at'])

        decision_word = 'approved' if new_status == VanLoadEditApprovalRequest.STATUS_APPROVED else 'rejected'
        Notification.objects.create(
            type='van_load_edit_decision',
            category='inventory',
            title=f'Van Load Edit {decision_word.capitalize()}',
            message=f'Your request to edit {request_reference} was {decision_word} by {admin_name}.',
            details=(
                approval_request.review_notes
                if approval_request.review_notes
                else f'Admin {decision_word} your request.'
            ),
            priority='medium' if decision_word == 'approved' else 'high',
            user=approval_request.requested_by,
            target_roles=['cashier'],
            warehouse_id=approval_request.warehouse_id,
            data={
                'approval_flow': 'van_load_edit',
                'request_status': new_status,
                'decision': decision_word,
                'request_id': approval_request.id,
                'sale_id': approval_request.sale_id,
                'msp_no': approval_request.msp_no,
                'warehouse_id': approval_request.warehouse_id,
                'reviewed_by_id': admin_user.id,
                'reviewed_by_name': admin_name,
                'reviewed_at': approval_request.reviewed_at.isoformat() if approval_request.reviewed_at else None,
                'review_notes': approval_request.review_notes,
                'is_van_load': True,
            },
            source_id=f'van_load_edit_decision:{approval_request.id}',
            source_type='van_load_edit_decision',
        )

        return Response({
            'request_id': approval_request.id,
            'status': approval_request.status,
            'decision': decision_word,
            'reviewed_at': approval_request.reviewed_at,
            'review_notes': approval_request.review_notes,
        }, status=status.HTTP_200_OK)
   
class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class NotificationCleanupAPIView(APIView):
    """API for cleaning up old processed notifications"""
    permission_classes = [permissions.IsAdminUser]
    
    def post(self, request):
        days = request.data.get('days', 30)
        cutoff_date = timezone.now() - timedelta(days=days)
        
        # Delete old processed notifications
        deleted_count = ProcessedNotification.objects.filter(
            processed_at__lt=cutoff_date
        ).delete()[0]
        
        return Response({
            'message': f'Cleaned up {deleted_count} old processed notifications',
            'cutoff_date': cutoff_date
        })
class MandatoryChangePasswordAPIView(APIView):
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            new_password = request.data.get('new_password')
            
            if not user_id or not new_password:
                return Response(
                    {"error": "User ID and new password are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user = User.objects.get(id=user_id)
            user.set_password(new_password)
            user.must_change_password = False
            user.save()
            
            return Response(
                {"message": "Password updated successfully."},
                status=status.HTTP_200_OK
            )
            
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": "An unexpected error occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['POST'])
@permission_classes([IsAuthenticated])  # Optional: you can remove this if you want it accessible without authentication
def check_default_admin_password(request):
    """
    Check if the default admin user still has the default password 'admin123'
    Returns: {"password_changed": true/false}
    """
    try:
        # Find the default admin user by username and phone number
        default_admin = User.objects.get(
            username="admin",
            phone_number="09179902969"
        )
        
        # Check if the current password is still the default 'admin123'
        has_default_password = check_password('admin123', default_admin.password)
        
        # If has_default_password is True, then password_changed is False
        password_changed = not has_default_password
        
        return Response({
            "password_changed": password_changed
        }, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        # Default admin doesn't exist - assume password was changed
        return Response({
            "password_changed": True
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        # In case of any error, assume password was changed (safe default)
        return Response({
            "password_changed": True,
            "error": str(e)
        }, status=status.HTTP_200_OK)
