# Team-Coke ERD Draft

This draft is based on the current backend domain model and is trimmed to the core business flow.

Use this as the working ERD for:
- warehouse and van load operations
- agent mobile app planning
- Figma screen planning
- backend API refinement later

## Recommended files

I prepared two DBML files for `dbdiagram.io`:
- `ERD_DBML_PANEL.dbml`
  Use this first for panel, thesis, adviser, and client presentation.
- `ERD_DBML_CORE.dbml`
  Use this when you want something closer to the current backend structure.

If you only choose one for presentation, use `ERD_DBML_PANEL.dbml`.

## Core idea

`Merchandising` is the main transaction header.

It supports both:
- `Warehouse` transactions
- `Van Load` transactions

`MerchandisingItem` stores the per-product movement inside each transaction.

## Recommended core ERD

```mermaid
erDiagram
    WAREHOUSE ||--o{ USER : assigns
    ROLE ||--o{ USER : grants
    WAREHOUSE ||--o{ VAN : owns
    WAREHOUSE ||--o{ ROUTE : serves
    WAREHOUSE ||--o{ PRODUCT : stocks_for
    WAREHOUSE ||--o{ STOCK : contains
    WAREHOUSE ||--o{ CUSTOMER : serves
    WAREHOUSE ||--o{ RECEIVING : receives
    WAREHOUSE ||--o{ MERCHANDISING : records
    WAREHOUSE ||--o{ RETURNABLE_STOCK : stores
    WAREHOUSE ||--o{ CREDIT_LEDGER : tracks

    SUPPLIER ||--o{ PRODUCT : supplies
    SUPPLIER ||--o{ RECEIVING : source_of

    PRODUCT_CATEGORY ||--o{ PRODUCT : classifies
    UNIT_TYPE ||--o{ PRODUCT : packages
    PRICING ||--o{ PRODUCT : prices

    PRODUCT ||--o{ STOCK : has
    PRODUCT ||--o{ RECEIVING_ITEM : received_as
    PRODUCT ||--o{ MERCHANDISING_ITEM : transacted_as
    PRODUCT ||--o{ RETURNABLE_STOCK : returnable_as

    RECEIVING ||--|{ RECEIVING_ITEM : contains

    TRANSACTION_TYPE ||--o{ MERCHANDISING : defines
    VAN ||--o{ MERCHANDISING : used_in
    ROUTE ||--o{ MERCHANDISING : follows
    CUSTOMER ||--o{ MERCHANDISING : buys_from

    MERCHANDISING ||--|{ MERCHANDISING_ITEM : contains
    MERCHANDISING ||--o{ MISCELLANEOUS_ITEM : adds
    MERCHANDISING ||--o{ PAYMENT : paid_by
    MERCHANDISING ||--o| CREDIT_LEDGER : may_create

    CREDIT_LEDGER ||--o{ CREDIT_PAYMENT : settled_by

    WAREHOUSE {
      int id PK
      string name
      string region
      string city
      string street_address
      string phone_number
      string email
    }

    ROLE {
      int id PK
      string name
    }

    USER {
      int id PK
      int role_id FK
      int warehouse_id FK
      string first_name
      string last_name
      string phone_number
      string email
      string password
      boolean is_active
      boolean is_approved
    }

    SUPPLIER {
      int id PK
      string company_name
      string registration_number
      string contact_person
      string email
      string phone_number
    }

    VAN {
      int id PK
      int warehouse_id FK
      string van_id
      string plate_number
    }

    ROUTE {
      int id PK
      int warehouse_id FK
      string route_name
    }

    PRODUCT_CATEGORY {
      int id PK
      string name
    }

    UNIT_TYPE {
      int id PK
      int content_no
      boolean returnable
      boolean content_returnable
    }

    PRICING {
      int id PK
      float purchase_price
      float selling_price
      float shell_price
      float bottle_price
    }

    PRODUCT {
      int id PK
      int supplier_id FK
      int product_category_id FK
      int unit_type_id FK
      int price_id FK
      int warehouse_id FK
      string system_code
      string supplier_code
      string product_name
      string image
    }

    STOCK {
      int id PK
      int product_id FK
      int warehouse_id FK
      int quantity_available
      datetime last_updated
    }

    CUSTOMER {
      int id PK
      int warehouse_id FK
      string name
      string address
      string phone
    }

    RECEIVING {
      int id PK
      int supplier_id FK
      int warehouse_id FK
      string receive_no
      datetime date_time
      string invoice_no
      decimal net_amount
      string received_by
    }

    RECEIVING_ITEM {
      int id PK
      int receiving_id FK
      int product_id FK
      int pcs_qty
      int shell_qty
      int bottle_qty
      int bad_order_pcs
      decimal unit_cost
      decimal total
    }

    TRANSACTION_TYPE {
      int id PK
      string name
    }

    MERCHANDISING {
      int id PK
      int transaction_type_id FK
      int warehouse_id FK
      int route_id FK
      int van_id FK
      int customer_id FK
      string msp_no
      string handled_by
      datetime date_time
      decimal expected_sale
      decimal actual_sale
      decimal discrepancy_non_empty
      decimal discrepancy_empty
      decimal miscellaneous
      decimal empties_price_total
      decimal empty_returns
      decimal returned_with_content
      string payment_method
      string invoice_no
      string status
      text remarks
    }

    MERCHANDISING_ITEM {
      int id PK
      int merchandising_id FK
      int product_id FK
      int dispatched_pcs
      int dispatched_shell
      int sold_pcs
      int sold_shell
      int empty_return_pcs
      int empty_return_shell
      int actual_return_pcs
      int actual_return_shell
      int discrepancy_empties_pc
      int discrepancy_empties_shell
      int discrepancy_full_pcs
      int discrepancy_full_shell
      decimal discount_percent
      decimal expected_sale
      decimal actual_sale
    }

    MISCELLANEOUS_ITEM {
      int id PK
      int merchandising_id FK
      string description
      decimal amount
      string notes
    }

    PAYMENT {
      int id PK
      int merchandising_id FK
      decimal amount
      string method
      datetime date_paid
      string reference_no
    }

    RETURNABLE_STOCK {
      int id PK
      int product_id FK
      int warehouse_id FK
      int supplier_id FK
      int empty_bottle_qty
      int empty_shell_qty
      string source
    }

    CREDIT_LEDGER {
      int id PK
      int merchandising_id FK
      int warehouse_id FK
      string msp_no
      string customer_name
      decimal total_amount
      decimal amount_paid
      date due_date
      string status
    }

    CREDIT_PAYMENT {
      int id PK
      int credit_id FK
      decimal amount
      string method
      datetime created_at
      string recorded_by
    }
```

## Mobile agent app scope

For the phone app, you do not need every table on day one.

Focus on these:
- `User`
- `Warehouse`
- `Van`
- `Route`
- `Product`
- `Stock`
- `Merchandising`
- `MerchandisingItem`
- `MiscellaneousItem`
- `Payment`
- `ReturnableStock`

## Suggested business modules

For ERD presentation, divide the system into these modules:

1. Master Data
- Warehouse
- User
- Role
- Supplier
- Van
- Route
- Product Category
- Unit Type
- Pricing
- Product
- Customer

2. Inventory Inbound
- Receiving
- Receiving Item
- Stock

3. Sales and Van Load
- Transaction Type
- Merchandising
- Merchandising Item
- Miscellaneous Item
- Payment

4. Returnables and Credit
- Returnable Stock
- Credit Ledger
- Credit Payment

## Recommended simplification for presentation

When you present the ERD to your client or adviser, do not start with all tables.

Start with this short story:
- Warehouse prepares stock
- Van load is released to agent
- Agent sells products on route
- Agent records sold items, returns, discrepancies, expenses, and payment
- Agent syncs back to warehouse
- System updates stock, returnables, sales, and remittance

That story matches the tables above and is much easier to explain in Figma and panel discussions.
