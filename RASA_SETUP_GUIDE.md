# Rasa NLP Setup Guide

This guide is for the optional Rasa sidecar in `coke_chatbot_rasa/`.

The most important point: Rasa is not the database layer. Rasa only detects the
customer's intent and entities. Django REST API still handles login, JWT,
assigned warehouse scoping, product lookup, cart, orders, and database access.

## Current Architecture

```text
Customer
  -> Mobile App
  -> Django REST API
  -> MySQL database

Optional:
  Django REST API -> Rasa NLU server
```

Correct defense line:

```text
The mobile app does not access the database directly. The app calls Django REST
API. Django authenticates the customer, checks the assigned warehouse, optionally
asks Rasa to classify the message, then Django queries the database.
```

## Python Version Warning

Your current backend Python is `3.14.2`. Do not install Rasa into that
environment.

Rasa Open Source 3.6.x needs Python 3.8 to 3.10. Use a separate Python 3.10
virtual environment for Rasa.

Check available Python versions:

```powershell
python --version
py -0p
```

If `py -3.10` does not work, install Python 3.10 for Windows first. During
installation, enable the Python launcher and add Python to PATH.

## 1. Install Rasa

```powershell
cd c:\Users\joshu\OneDrive\Desktop\c10\Team-Coke\coke_chatbot_rasa
py -3.10 -m venv .venv
.\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install rasa==3.6.21
```

Verify:

```powershell
rasa --version
```

## 2. Validate And Train

```powershell
cd c:\Users\joshu\OneDrive\Desktop\c10\Team-Coke\coke_chatbot_rasa
.\.venv\Scripts\activate
rasa data validate
rasa train
```

Expected result:

```text
Model trained and saved inside coke_chatbot_rasa\models\
```

## 3. Run Rasa Server

Keep this terminal open:

```powershell
cd c:\Users\joshu\OneDrive\Desktop\c10\Team-Coke\coke_chatbot_rasa
.\.venv\Scripts\activate
rasa run --enable-api --cors "*" -p 5005
```

Test Rasa directly:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5005/model/parse" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"text":"Do you have Coke available?"}'
```

Expected result:

```text
intent.name should be search_product
entities may include product_name = Coke
```

## 4. Enable Rasa In Django

Open a second terminal:

```powershell
cd c:\Users\joshu\OneDrive\Desktop\c10\Team-Coke\backend_coke_system
$env:CHATBOT_USE_RASA="1"
$env:RASA_NLU_ENDPOINT="http://127.0.0.1:5005"
python manage.py runserver
```

If Rasa is not running, Django falls back to the local NLP engine. This is
intentional so the demo still works.

## 5. Demo Flow With JWT

Open a third terminal:

```powershell
cd c:\Users\joshu\OneDrive\Desktop\c10\Team-Coke\backend_coke_system
python create_customer_15.py
```

Use the fresh customer ID printed by the script:

```powershell
cd c:\Users\joshu\OneDrive\Desktop\c10\Team-Coke
$env:CHATBOT_CUSTOMER_ID="PUT_NEW_CUSTOMER_ID_HERE"
python test_api_simple.py
```

The chat response should now include:

```text
nlp_engine: rasa
```

If it says `local`, Django is still working, but Rasa was not enabled or not
running.

## 6. What To Say To Sir

```text
Sir, Rasa is only used as the NLP classifier. It reads the message and returns
intent like search_product or track_order. It does not access MySQL.

The secure part is still Django REST API. The customer logs in, receives a JWT,
and every product/cart/order request must include that token.

When the customer asks "Do you have Coke?", Django sends the text to Rasa for
intent parsing. Then Django uses the authenticated customer account to check the
assigned warehouse and fetch stock from the database.

So the flow is:
Customer -> Mobile App -> Django REST API -> Rasa for NLP
Customer -> Mobile App -> Django REST API -> MySQL for data

The mobile app and Rasa never directly access the database.
```

## 7. Common Errors

`HTTP 403 Authentication credentials were not provided`

This is correct for protected endpoints. Login first and send the JWT token.

`HTTP 405 Method GET not allowed`

This is correct for register/login in the browser address bar. Those endpoints
are POST-only.

`No installed Pythons found` from `py -0p`

The Python launcher is missing or not configured. Install Python 3.10 and enable
the launcher.

`Could not find a version that satisfies rasa`

You are probably using Python 3.11+ or 3.14. Create the Python 3.10 virtual
environment and install Rasa there.
