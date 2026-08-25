# SIMPLIFIED TECH STACK FOR MVP
## 2 Developers | 3 Months | Zero Budget

---

## 🎯 DEVELOPER ASSIGNMENT

| Developer | Primary Role | Technologies |
|-----------|--------------|--------------|
| **Dev 1** | Backend + DevOps | Django, PostgreSQL, Rasa, Docker |
| **Dev 2** | Mobile Frontend | React Native, Expo, Redux |

---

## 📦 **FRONTEND STACK** (Dev 2)

### **Core Framework**
```javascript
React Native + Expo (NOT bare React Native!)

Why Expo?
✅ No android studio / Xcode setup needed
✅ Instant preview with Expo Go app
✅ Build APK directly from cloud (EAS)
✅ Perfect for 1 developer
```

### **Libraries to Install**
```bash
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install redux @reduxjs/toolkit react-redux
npm install axios
npm install socket.io-client
npm install @react-native-camera/camera
npm install react-native-image-picker
npm install react-native-gifted-chat (or native-base chat UI)
npm install react-native-flash-message
npm install @react-native-async-storage/async-storage
```

### **Project Structure**
```
chatbot-mobile-app/
├── screens/
│   ├── LoginScreen.js
│   ├── BrowseScreen.js
│   ├── CartScreen.js
│   ├── CheckoutScreen.js
│   ├── OrderTrackingScreen.js
│   ├── ChatScreen.js
│   ├── MyOrdersScreen.js
│   └── ProfileScreen.js
├── components/
│   ├── ChatBubble.js
│   ├── ProductCard.js
│   ├── OrderItem.js
│   ├── BottomTabBar.js
│   ├── Loading.js
│   └── ErrorBoundary.js
├── redux/
│   ├── authSlice.js
│   ├── cartSlice.js
│   ├── orderSlice.js
│   └── store.js
├── utils/
│   ├── api.js (Axios config)
│   ├── constants.js (API URLs, colors, etc)
│   └── validators.js
├── assets/
│   ├── images/
│   └── fonts/
├── App.js
└── package.json
```

### **Key Components to Build**

**LoginScreen.js:**
```javascript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useDispatch } from 'react-redux';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();

  const handleLogin = async () => {
    // Call API: POST /api/auth/login/
    // Save JWT token
    // Redirect to BrowseScreen
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity onPress={handleLogin}>
        <Text>Login</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 🖥️ **BACKEND STACK** (Dev 1)

### **Framework & Libraries**
```bash
Django 4.2+
djangorestframework  # DRF for APIs
django-cors-headers # Allow mobile app requests
django-channels     # WebSocket for real-time chat
python-dotenv       # Environment variables
celery              # Async tasks
redis               # Cache + Celery broker
rasa                # NLP chatbot engine
```

### **Project Structure**
```
backend_coke_system/
├── api/
│   ├── models.py (existing POS models)
│   ├── serializers.py (existing)
│   ├── views.py (existing)
│   └── urls.py (existing)
├── chatbot_app/
│   ├── models.py (NEW)
│   │   ├── ChatUser
│   │   ├── ChatSession
│   │   ├── ChatMessage
│   │   ├── CartItem
│   │   └── ChatbotOrder
│   ├── serializers.py (NEW)
│   ├── views.py (NEW - API endpoints)
│   ├── urls.py (NEW)
│   ├── consumers.py (WebSocket - NEW)
│   ├── rasa_integration.py (NEW - calls Rasa)
│   ├── migrations/ (NEW)
│   └── admin.py (NEW)
├── chatbot_rasa/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/
│   │   ├── nlu.yml (training)
│   │   ├── stories.yml (dialogue flow)
│   │   └── rules.yml (logic)
│   ├── config.yml (Rasa config)
│   └── domain.yml (intents, entities, actions)
├── settings.py (INSTALLED_APPS += 'chatbot_app', 'channels')
├── asgi.py (Configure channels)
└── manage.py
```

### **Key Models to Create**

**chatbot_app/models.py:**
```python
from django.db import models
from api.models import Customer, Product, Warehouse

class ChatUser(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE)
    username = models.CharField(max_length=100, unique=True)
    password_hash = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.username

class ChatSession(models.Model):
    SESSION_STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
    ]
    
    session_id = models.CharField(max_length=100, unique=True, primary_key=True)
    chat_user = models.ForeignKey(ChatUser, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    session_status = models.CharField(max_length=20, choices=SESSION_STATUS_CHOICES)
    current_intent = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"{self.chat_user.username} - {self.created_at}"

class ChatMessage(models.Model):
    SENDER_CHOICES = [
        ('customer', 'Customer'),
        ('bot', 'Bot'),
        ('human_agent', 'Human Agent'),
    ]
    
    message_id = models.CharField(max_length=100, unique=True, primary_key=True)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE)
    sender_type = models.CharField(max_length=20, choices=SENDER_CHOICES)
    content = models.TextField()
    sentiment = models.CharField(max_length=20, blank=True)  # positive, negative, neutral
    timestamp = models.DateTimeField(auto_now_add=True)
    confidence_score = models.IntegerField(default=0)  # 0-100 for AI
    
    class Meta:
        ordering = ['timestamp']

class CartItem(models.Model):
    cart_id = models.CharField(max_length=100, unique=True)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    added_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()  # Session timeout
    
    def __str__(self):
        return f"{self.product.product_name} x{self.quantity}"

class ChatbotOrder(models.Model):
    chatbot_order_id = models.CharField(max_length=100, unique=True, primary_key=True)
    session = models.ForeignKey(ChatSession, on_delete=models.SET_NULL, null=True)
    msp_no = models.CharField(max_length=20, unique=True)  # Links to Merchandising
    order_source = models.CharField(max_length=50, default='chatbot')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    fulfillment_status = models.CharField(max_length=50, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Order {self.msp_no}"
```

### **Key API Endpoints**

```python
# chatbot_app/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        # Authenticate, generate JWT token
        return Response({'token': jwt_token, 'user_id': user_id})

class BrowseProductsView(APIView):
    def get(self, request):
        products = Product.objects.filter(is_active=True)
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

class CartView(APIView):
    def post(self, request):
        # Add item to cart
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity')
        session_id = request.data.get('session_id')
        
        product = Product.objects.get(id=product_id)
        cart_item = CartItem.objects.create(
            session_id=session_id,
            product=product,
            quantity=quantity,
            unit_price=product.price.selling_price
        )
        return Response({'status': 'added'})
    
    def get(self, request):
        # Get cart items
        session_id = request.query_params.get('session_id')
        items = CartItem.objects.filter(session_id=session_id)
        serializer = CartItemSerializer(items, many=True)
        return Response(serializer.data)

class ChatMessageView(APIView):
    def post(self, request):
        # Receive message from mobile app
        session_id = request.data.get('session_id')
        message = request.data.get('message')
        
        # Save customer message
        ChatMessage.objects.create(
            session_id=session_id,
            sender_type='customer',
            content=message
        )
        
        # Send to Rasa NLU
        rasa_response = call_rasa_nlu(message)
        intent = rasa_response['intent']
        entities = rasa_response['entities']
        
        # Execute action based on intent
        bot_response = handle_intent(intent, entities)
        
        # Save bot response
        ChatMessage.objects.create(
            session_id=session_id,
            sender_type='bot',
            content=bot_response
        )
        
        return Response({'bot_message': bot_response})

class OrderView(APIView):
    def post(self, request):
        # Create order from cart
        session_id = request.data.get('session_id')
        cart_items = CartItem.objects.filter(session_id=session_id)
        
        # Create Merchandising (POS order)
        merchandising = Merchandising.objects.create(
            customer=chat_user.customer,
            warehouse=session.warehouse,
            actual_sale=sum([item.quantity * item.unit_price for item in cart_items]),
            payment_method=request.data.get('payment_method')
        )
        
        # Create ChatbotOrder
        ChatbotOrder.objects.create(
            session=session,
            msp_no=merchandising.msp_no,
            total_amount=merchandising.actual_sale
        )
        
        # Clear cart
        cart_items.delete()
        
        return Response({'order_id': merchandising.msp_no})
```

---

## 🤖 **RASA CONFIGURATION** (NLP Chatbot)

### **Install Rasa**
```bash
pip install rasa==3.4.1
pip install rasa[tensors]

# Create Rasa project
rasa init --no-prompt
```

### **Training Data** (chatbot_rasa/data/nlu.yml)
```yaml
version: "3.1"

nlu:
- intent: greet
  examples: |
    - Hey
    - Hello
    - Hi there
    - Good morning
    - What's up

- intent: order_product
  examples: |
    - I want 10 Coke 1L
    - Can I order 5 Sprite
    - I need 3 bottles of Coke
    - Add 10 pcs Coke 1L to my cart
    - Order 5 Sprite bottles
    - I want to buy Coca Cola
  entities:
    - product
    - quantity

- intent: check_stock
  examples: |
    - Do you have Coke?
    - What's the stock of Sprite?
    - Is Coke available?
    - How many bottles of Sprite?
    - Stock status
  entities:
    - product

- intent: track_order
  examples: |
    - Where is my order?
    - Track my order
    - What's the status?
    - Can you check my order?

- intent: help
  examples: |
    - Help me
    - I need help
    - Can you help?
    - What can you do?
```

### **Dialogue Stories** (chatbot_rasa/data/stories.yml)
```yaml
version: "3.1"

stories:
- story: happy path order
  steps:
    - intent: greet
    - action: utter_greet
    - intent: order_product
    - action: action_add_to_cart
    - action: utter_order_confirmed

- story: check stock
  steps:
    - intent: check_stock
    - action: action_check_stock
    - action: utter_stock_info

- story: track order
  steps:
    - intent: track_order
    - action: action_track_order
    - action: utter_order_status
```

### **Domain** (chatbot_rasa/domain.yml)
```yaml
version: "3.1"

intents:
  - greet
  - order_product
  - check_stock
  - track_order
  - help
  - goodbye

entities:
  - product
  - quantity

slots:
  cart_items:
    type: list
    mappings:
      - type: from_entity
        entity: product

responses:
  utter_greet:
    - text: "Hi! How can I help you today?"
  
  utter_order_confirmed:
    - text: "Great! I've added the items to your cart. Would you like to proceed to checkout?"
  
  utter_stock_info:
    - text: "Let me check the stock for you..."
  
  utter_help:
    - text: "I can help you with:\n1. Browse products\n2. Order items\n3. Track deliveries\n4. Check stock"

actions:
  - action_add_to_cart
  - action_check_stock
  - action_track_order
```

### **Config** (chatbot_rasa/config.yml)
```yaml
recipe: default.v1

language: en
pipeline:
  - name: WhitespaceTokenizer
  - name: RegexFeaturizer
  - name: LexicalSyntacticFeaturizer
  - name: CountVectorsFeaturizer
  - name: CountVectorsFeaturizer
    analyzer: "char_wb"
    min_ngram: 1
    max_ngram: 4
  - name: DIETClassifier
    epochs: 100
    constrain_similarities: true
  - name: EntitySynonymMapper
  - name: ResponseSelector
    epochs: 100
    constrain_similarities: true

policies:
  - name: MemoizationPolicy
  - name: TEDPolicy
    max_history: 5
    epochs: 100
    constrain_similarities: true
  - name: FallbackPolicy
    nlu_threshold: 0.4
    core_threshold: 0.3
    fallback_action_name: "action_default_fallback"
  - name: RulePolicy
```

---

## 🐳 **DOCKER SETUP** (For Rasa)

### **Dockerfile (chatbot_rasa/Dockerfile)**
```dockerfile
FROM rasa/rasa:3.4.1-full

WORKDIR /app

COPY . /app

RUN rasa train

CMD ["rasa", "run", "--enable-api", "--cors", "*"]
```

### **Docker Compose (optional)**
```yaml
version: '3.8'

services:
  django:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=false
      - DATABASE_URL=postgresql://user:pass@db:5432/chatbot
    depends_on:
      - db
      - redis
  
  rasa:
    build: ./chatbot_rasa
    ports:
      - "5005:5005"
    environment:
      - RASA_NLU_SERVER=http://rasa:5005
  
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
  
  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=chatbot
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 🚀 **DEPLOYMENT STACK** (Dev 1)

### **Server Options** (Choose ONE)
```
OPTION 1: AWS Free Tier (First 12 Months) ⭐ RECOMMENDED FOR MVP
- t2.micro instance (free)
- RDS PostgreSQL db.t3.micro (750 hours/month free)
- Cost: ~₱0 for Months 1-12
- CATCH: After 12 months = ₱1,500-2,500/month
- Best for: MVP development + launch

OPTION 2: DigitalOcean (Best Long-Term Value) ⭐ RECOMMENDED FOR PRODUCTION
- 1GB RAM Droplet: ₱280/month
- Managed PostgreSQL: ₱840/month
- Total: ₱1,120-1,300/month
- Consistent pricing (no surprises)
- Best for: After MVP, when you have paying users

OPTION 3: Linode (Alternative)
- 1GB RAM: ₱850-1,000/month
- PostgreSQL included
- Total: ₱1,000-1,200/month
- Similar to DigitalOcean

OPTION 4: You Already Have? (Home Server)
- NOT RECOMMENDED for MVP
- Service interruptions when your internet goes down
- Electricity + cooling costs add up
- No professional support
```

### **Realistic 12-Month Budget**
```
MVP Phase (Months 1-3): AWS Free Tier
├─ Server cost: ₱0
├─ Domain: ₱500-1,000
└─ Total: ₱500-1,000

Production Phase (Months 4-12): DigitalOcean
├─ Server: ₱1,300/month
├─ Domain renewal: ₱500
└─ Total: ₱12,200 (9 months)

ONE-TIME:
├─ Google Play Store: ₱850
└─ SSL Certificate: ₱0 (free)

YEAR 1 TOTAL: ~₱13,500-14,000
```

### **Server Setup**
```bash
# Connect to server
ssh ubuntu@your_server_ip

# Install dependencies
sudo apt update
sudo apt install python3-pip python3-venv postgresql postgresql-contrib nginx docker.io

# Clone repo
git clone your-repo-url
cd backend_coke_system

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create database
createdb chatbot_db

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Run Gunicorn + Nginx
gunicorn -w 4 -b 0.0.0.0:8000 backend_coke_system.wsgi
```

### **Nginx Configuration** (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📝 **ENVIRONMENT VARIABLES**

### **.env (Backend)**
```env
DEBUG=False
SECRET_KEY=your_django_secret_key_here
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:pass@localhost:5432/chatbot
REDIS_URL=redis://localhost:6379/0
RASA_URL=http://localhost:5005
JWT_SECRET=your_jwt_secret
```

### **.env (React Native)**
```javascript
// utils/constants.js
export const API_BASE_URL = 'https://yourdomain.com/api';
export const RASA_URL = 'https://yourdomain.com/rasa';
export const WS_URL = 'wss://yourdomain.com/ws';
```

---

## 🎯 **QUICK START CHECKLIST**

### **Day 1: Setup**
- [ ] Create GitHub repo
- [ ] Setup Django project structure (Dev 1)
- [ ] Initialize React Native + Expo (Dev 2)
- [ ] Create README with dev instructions

### **Day 2-5: Models & Database**
- [ ] Create ChatUser, ChatSession, ChatMessage models
- [ ] Create migrations
- [ ] Test model relationships

### **Week 1: APIs & Frontend Setup**
- [ ] Build authentication API
- [ ] Build product listing API
- [ ] Setup React Native navigation
- [ ] Build login screen

### **Week 2: Chat & Rasa**
- [ ] Setup Rasa locally
- [ ] Train Rasa model
- [ ] Create chat API endpoint
- [ ] Build chat screen

### **Week 3-4: Orders**
- [ ] Build cart system
- [ ] Create order API
- [ ] Build checkout screen

### **Week 5-12: Testing, Polish, Deploy**
- [ ] Fix bugs
- [ ] Optimize performance
- [ ] Deploy to server
- [ ] Launch MVP!

---

**Ready to code? Let's go! 🚀**

**Document Version:** 1.0  
**For:** Team-Coke 2-Developer MVP  
**Last Updated:** April 17, 2026
