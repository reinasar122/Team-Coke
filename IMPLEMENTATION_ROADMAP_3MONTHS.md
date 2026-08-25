
# AI CHATBOT MOBILE APP - 3 MONTH IMPLEMENTATION ROADMAP
## For: 2 Developers | 50-100 Users | Zero Budget (Open-Source)

---

## 🚦 FINAL TECH STACK DECISION (April 2026)

**Backend:** Django REST API (shared with POS, single codebase)
**Frontend:** React Native (Expo)
**NLP/AI:** Rasa (open-source, trained locally; FastAPI used only for local ML training, NOT for production)
**Database:** PostgreSQL (shared)
**Hosting:** AWS Free Tier (months 1-3), DigitalOcean (₱1,300/mo after)

> ⚠️ **No FastAPI in production backend.** FastAPI is used only for local Rasa/ML training, not for the deployed chatbot app. All production APIs and business logic are in Django REST.

---

## 📋 PROJECT CONSTRAINTS & REALITY CHECK

| Constraint | Value | Impact |
|-----------|-------|--------|
| **Team** | 2 Developers | Focus on core features only |
| **Timeline** | 3 Months | MVP, not feature-complete product |
| **Budget** | Zero (no OpenAI) | Use only open-source tools |
| **Users** | 50-100 first year | No complex infrastructure needed |
| **Existing** | Django POS + React web | Leverage team knowledge |

---

## 🎯 MVP SCOPE (What's IN - What's OUT)

### ✅ **IN SCOPE - CORE FEATURES**
1. **User Registration & Authentication** (Simple social login)
2. **Product Browse & Search** (Real-time inventory check)
3. **Shopping Cart** (Session-based, no persistence)
4. **Place Order** (Integrated with existing Merchandising)
5. **Simple Chat Interface** (Bot + Fallback to FAQ)
6. **Order Tracking** (Basic status updates)
7. **Basic Payment Integration** (Link to existing Payment system)

### ❌ **OUT OF SCOPE (Phase 2)**
- Complex AI Recommendations
- Advanced Analytics Dashboard
- Human Agent Support (escalation only)
- Multi-language NLP (English only for MVP)
- Push Notifications (v1.1)
- Loyalty Points/Promotions (v1.1)
- Real-time Delivery Tracking (GPS, map)

---


## 📱 TECH STACK (Locked for MVP)

```
FINALIZED MVP STACK
├── Frontend: React Native (Expo) - 1 Developer
├── Backend: Django REST API (shared with POS) - 1 Developer
├── AI/NLP: Rasa (open-source, trained locally; FastAPI for training only)
├── Database: PostgreSQL (shared with POS)
├── Real-time: Django Channels (WebSocket, if needed)
├── Hosting: AWS Free Tier (months 1-3), DigitalOcean (₱1,300/mo after)
└── CI/CD: GitHub Actions (free)
```

### **Why This Stack?**
- ✅ 2 developers → single codebase, less maintenance
- ✅ 50-100 users → Django REST is more than enough
- ✅ 3 months → team already knows Django, React Native
- ✅ Zero budget → all open-source, no paid services
- ✅ FastAPI is used only for local Rasa/ML training, not for the deployed app

---

## 🗓️ **3-MONTH SPRINT BREAKDOWN**

### **MONTH 1: Foundation & Setup (Weeks 1-4)**

#### **Week 1-2: Backend Setup** (Dev 1: Backend)
- [ ] Create new Django app: `chatbot_app`
- [ ] Add new models:
  - ChatUser, ChatSession, ChatMessage
  - CartItem, ChatbotOrder, CustomerPreference
  - DeliveryAddress (4 models total)
- [ ] Create database migrations
- [ ] Create serializers (DRF)
- [ ] Setup WebSocket with Django Channels

**Time Estimate:** 8-10 hours

```python
# models.py (chatbot_app)
class ChatUser(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE)
    username = models.CharField(max_length=100, unique=True)
    password_hash = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.username

# ... Continue with other models
```

#### **Week 1-2: Frontend Setup** (Dev 2: Frontend)
- [ ] Initialize React Native + Expo project
- [ ] Setup project structure
  - `/screens` - Login, Browse, Cart, Order, Tracking
  - `/components` - ChatBubble, ProductCard, etc.
  - `/navigation` - Stack Navigator, Tab Navigator
  - `/redux` - Auth, Cart, Order state
- [ ] Setup Redux for state management
- [ ] Configure Axios for API calls
- [ ] Setup navigation structure

**Time Estimate:** 6-8 hours

```javascript
// Project structure
/chatbot-mobile-app
├── /screens
│   ├── LoginScreen.js
│   ├── BrowseScreen.js
│   ├── CartScreen.js
│   ├── CheckoutScreen.js
│   └── TrackingScreen.js
├── /components
│   ├── ChatBubble.js
│   ├── ProductCard.js
│   ├── OrderItem.js
│   └── HeaderBar.js
├── /redux
│   ├── authSlice.js
│   ├── cartSlice.js
│   └── orderSlice.js
├── /utils
│   ├── api.js
│   └── constants.js
└── App.js
```


#### **Week 3-4: Rasa Setup & Training** (Both Developers)
- [ ] Install Rasa locally (on dev machine)
- [ ] Create basic training data (intents, entities, stories)
- [ ] Train initial model with ~500 examples (use FastAPI or Rasa CLI for local training only)
- [ ] Run Rasa server locally (Docker container or CLI)
- [ ] Test NLU extraction (intent + entities)

**Time Estimate:** 12 hours (shared)

```yaml
# data/nlu.yml (Rasa training data)
version: "3.1"

nlu:
- intent: greet
  examples: |
    - Hey
    - Hello
    - Hi
    
- intent: order_product
  examples: |
    - I want to order 10 Coke
    - Can I buy 5 bottles of Sprite
    - I need Coke 1L x 3
  entities:
    - product
    - quantity
    
- intent: check_stock
  examples: |
    - Do you have Coke?
    - Stock status of Sprite
    - Is Coke available?
```

**Deliverables by End of Month 1:**
- ✅ Django models created & migrated
- ✅ DRF API endpoints (basic CRUD)
- ✅ React Native project initialized
- ✅ Redux state management working
- ✅ Rasa model trained & running (local, not deployed)
- ✅ API ↔ Rasa communication tested (Django calls local Rasa server)

---

### **MONTH 2: Core Features Implementation (Weeks 5-8)**

#### **Week 5: Authentication & Registration** (Both)
Backend:
- [ ] Create login/registration endpoints
- [ ] JWT token generation
- [ ] Link ChatUser to existing Customer
- [ ] Middleware for token validation

Frontend:
- [ ] Login screen UI
- [ ] Registration screen UI
- [ ] Store JWT token in local storage
- [ ] Auto-login on app launch
- [ ] Logout functionality

**Time Estimate:** 10 hours (5+5)

#### **Week 6: Browse & Cart** (Both)
Backend:
- [ ] GET `/api/products/` - list all products
- [ ] GET `/api/products/{id}/` - product details with stock
- [ ] POST `/api/cart/` - add to cart
- [ ] GET `/api/cart/` - get current cart
- [ ] DELETE `/api/cart/{item_id}/` - remove from cart

Frontend:
- [ ] Product listing screen with search
- [ ] Product detail screen with images
- [ ] Add to cart button
- [ ] Shopping cart screen
- [ ] Update quantities, delete items
- [ ] Real-time stock check

**Time Estimate:** 14 hours (7+7)


#### **Week 7: Chat & Rasa Integration** (Both)
Backend:
- [ ] `POST /api/chat/message/` - send message
- [ ] `GET /api/chat/history/` - get conversation
- [ ] Django calls local Rasa server (via HTTP) for intent/entity extraction
- [ ] Parse Rasa response for intent & execute action
- [ ] Store messages in ChatMessage table

Frontend:
- [ ] Chat screen with message bubbles
- [ ] Message input with send button
- [ ] Bot responses (typing indicator)
- [ ] Chat history display
- [ ] Integration with product browsing

**Time Estimate:** 12 hours (6+6)

**Sample Chat Flow:**
```
User: "I want 10 Coke"
  ↓
Rasa NLU: {intent: "order_product", entities: {product: "Coke", quantity: "10"}}
  ↓
Django: Extract intent → trigger "order_product" action → Query Stock
  ↓
Check if 10 pieces available → Yes ✅
  ↓
Create CartItem (product_id, quantity=10)
  ↓
Bot: "Added 10 Coke to your cart! Total: ₱500"
```

#### **Week 8: Order Creation & Tracking** (Both)
Backend:
- [ ] `POST /api/orders/` - create order from cart
- [ ] Create Merchandising record (links to existing POS)
- [ ] Create ChatbotOrder record
- [ ] `GET /api/orders/{id}/` - get order details
- [ ] `GET /api/orders/` - list user's orders
- [ ] Setup order status tracking

Frontend:
- [ ] Checkout screen (review items, address, payment method)
- [ ] Place order button
- [ ] Order confirmation screen
- [ ] My Orders screen (list + detail)
- [ ] Track order button → shows status

**Time Estimate:** 12 hours (6+6)

**Deliverables by End of Month 2:**
- ✅ Full authentication flow working
- ✅ Browse & cart functional
- ✅ Chat interface with Rasa integrated
- ✅ Orders created successfully
- ✅ Users can view order history
- ✅ Basic order tracking setup

---

### **MONTH 3: Polish, Testing & Deployment (Weeks 9-12)**

#### **Week 9: Payment Integration** (Dev 1: Backend)
- [ ] Link to existing Payment model
- [ ] Handle payment methods (Cash, Card, E-wallet)
- [ ] Update order status after payment
- [ ] Create Payment record
- [ ] API endpoint: `POST /api/pay/`

Frontend:
- [ ] Payment method selection
- [ ] Payment confirmation flow
- [ ] Success/error messages

**Time Estimate:** 8 hours

#### **Week 10: Delivery Address & Improvement** (Dev 2: Frontend)
Frontend:
- [ ] Delivery address selection/entry
- [ ] Multiple saved addresses
- [ ] Validate address against warehouse coverage

Backend:
- [ ] Refine Rasa training data (add more examples)
- [ ] Fix bugs from Month 2 testing
- [ ] Optimize API response time

**Time Estimate:** 10 hours

#### **Week 11: Testing & Bug Fixes** (Both)
- [ ] End-to-end testing of all features
- [ ] UI/UX improvements
- [ ] Fix performance issues
- [ ] Security review (token validation, SQL injection, etc.)
- [ ] Test with real data (100 sample users)

**Time Estimate:** 16 hours (8+8)

#### **Week 12: Deployment & Go-Live** (Both)
Backend:
- [ ] Deploy Django to server (AWS EC2 / DigitalOcean)
- [ ] Setup PostgreSQL on server
- [ ] Configure environment variables
- [ ] SSL certificate (Let's Encrypt)
- [ ] Backup strategy

Frontend:
- [ ] Build APK for Android (via Expo EAS)
- [ ] Submit to Google Play Store (or beta testing)
- [ ] Create release notes

**Time Estimate:** 10 hours

**Deliverables by End of Month 3:**
- ✅ Full working MVP deployed
- ✅ Payment system integrated
- ✅ 100+ test cases passed
- ✅ Mobile app in store (or distributable)
- ✅ Backend running on production server
- ✅ Documentation created

---

## 📊 **TIMELINE GANTT CHART**

```
MONTH 1: FOUNDATION
Week 1-2: Backend + Frontend Setup, Rasa Init
  Backend      [████████]
  Frontend     [████████]
  Rasa         [████████░░░░]
Week 3-4: Rasa Training
  Rasa         [████████████████]

MONTH 2: CORE FEATURES
Week 5: Auth
  Auth         [████████]
Week 6: Browse & Cart
  Browse       [████████████]
Week 7: Chat Integration
  Chat         [████████████]
Week 8: Orders & Tracking
  Orders       [████████████]

MONTH 3: POLISH & DEPLOY
Week 9: Payment
  Payment      [████████]
Week 10: Addresses & Improvements
  Delivery     [████████]
Week 11: Testing
  Testing      [████████████████]
Week 12: Deploy to Production
  Deploy       [████████████]
```

---


## 💾 **DATABASE TABLES FOR MVP ONLY**

### **Minimal Schema (Skip Complex Tables)**
```
EXISTING TABLES (Already in POS):
- Customer
- Product
- Stock
- Warehouse
- Merchandising
- MerchandisingItem
- Payment
- CreditLedger

NEW CHATBOT TABLES (MVP):
- ChatUser
- ChatSession
- ChatMessage
- CartItem
- ChatbotOrder (links to Merchandising)
- CustomerPreference (optional)
```

**Tables NOT needed for MVP:**
- ~~DeliveryAddress~~ (use Customer.address for now)
- ~~SavedItem~~ (wishlist - phase 2)
- ~~ChatContext~~ (NLP context)
- ~~ChatInteractionLog~~ (analytics)
- ~~Notification~~ (push notifications)
- ~~OrderFulfillment~~ (detailed tracking - use status field)

---

## 💰 **COST BREAKDOWN (3 Months - HONEST)**

| Item | Cost | Notes |
|------|------|-------|
| **Development** | ₱0 | 2 Developers (yourselves!) |
| **Server (Month 1-3)** | ₱0 | AWS Free Tier (expires after 12 months) |
| **Domain** | ₱500-1,000 | One-time or annual |
| **Database** | ₱0 | Included in AWS free tier |
| **Tools** | ₱0 | GitHub (free), Expo (free), Rasa (free) |
| **Google Play Store** | ₱850 | One-time ($25 USD) |
| **Total 3 Months (MVP)** | **~₱1,350-1,850** | Very lean! |
| | | |
| **MONTH 4+: Production Costs** | | **Budget accordingly** |
| **Server (DigitalOcean)** | ₱1,300/month | Much cheaper than AWS after free tier |
| **Database (PostgreSQL)** | Included | In DigitalOcean |
| **Total/Month (Year 1)** | **₱1,300/month** | Predictable costs |

---

## ⚠️ **CRITICAL SUCCESS FACTORS**

### **DO THIS:**
✅ Use existing Django codebase (don't reinvent)  
✅ Keep Rasa training simple (500-1000 examples is enough)  
✅ Focus on happy path flows (skip edge cases first)  
✅ Use Expo for React Native (much faster than bare React Native)  
✅ Self-host or use AWS free tier first  
✅ Deploy often (weekly at least)  

### **DON'T DO THIS:**
❌ Build microservices (too complex for 2 devs)  
❌ Use GraphQL (stick with REST)  
❌ Setup complex CI/CD (GitHub Actions basic is fine)  
❌ Support 5 languages in MVP (English only)  
❌ Use complex state management (Redux is enough)  
❌ Go live with 0 testing (test with real data!)  

---

## 📋 **DAILY STANDUP TOPICS (3 Months)**

```
Every morning (15 minutes):
1. What did you finish yesterday?
2. What will you finish today?
3. Any blockers?
4. Sync code changes

Example:
Dev 1: "Finished ChatUser model, started CartItem. No blockers."
Dev 2: "Built ProductCard component, testing tomorrow. Need API response format?"
Both: "Let's sync on API contract at lunch"
```

---

## 🎯 **GO-LIVE CHECKLIST**

- [ ] All features from MVP tested
- [ ] Performance tested (response time < 2 sec)
- [ ] Security review done
- [ ] SSL certificate installed
- [ ] Database backup tested
- [ ] Error logging configured
- [ ] User documentation written
- [ ] Deployment runbook created
- [ ] Rollback plan documented
- [ ] First 10 users onboarded
- [ ] Support channel setup (email/chat)
- [ ] Celebrate! 🎉

---

## 📈 **POST-LAUNCH ROADMAP (Phase 2+)**

After 3 months MVP, for next phases:
1. **Month 4:** Analytics dashboard, push notifications
2. **Month 5:** Advanced recommendations (based on order history)
3. **Month 6:** Human agent support integration
4. **Month 7+:** Multi-language support, AI improvements

---

**Start Date:** Week 1, Day 1  
**Target Launch:** End of Month 3, Week 12  
**Expected MVP Users:** 50-100 internal testers + beta users

**LET'S BUILD THIS! 🚀**

---

**Document Version:** 1.1  
**Last Updated:** April 19, 2026  
**For:** Team-Coke AI Chatbot Project
**Note:** Updated to reflect FINAL TECH STACK DECISION (Django REST API backend, FastAPI for local ML training only)
