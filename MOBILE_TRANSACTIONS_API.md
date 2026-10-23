# Mobile transaction processing API

These POS endpoints process existing orders in the mobile application's database.
Order creation remains in the mobile backend. Confirming a pending mobile order
deducts its product quantities, in pieces, from POS inventory exactly once. The
existing AIVA POS reservation is reused; confirmation does not create a second
sale, mark payment received, or send customer notifications/emails.

Use `http://localhost:8003/api` for local development. All requests require
`Authorization: Bearer <token>` using the token returned by POS `/api/login/`.
Reading requires Trading `view` or `full`; processing requires Trading `edit` or
`full`. Non-admin users can access only their assigned warehouse. Admins select
a warehouse with `?warehouse=<POS warehouse ID>` or `X-Warehouse-ID`.
Warehouses in the two databases are matched by name.

List and detail responses include `order_address`, the delivery address selected
at mobile checkout. It is read from the order's saved AIVA receipt remarks
(`Deliver to: ...; Delivery slot: ...`), so later changes to My Addresses or its
default do not change an existing order. Legacy orders without that snapshot
fall back to `customer_address`; if neither exists, `order_address` is empty.
The cards, details, pick list, address filter, and available address options use
this order address. The `address` filter accepts up to 1,000 characters.
`customer_address` remains the profile address, and `delivery_address` remains
the separately assigned POS delivery-group destination. These endpoints keep
the existing POS login, Trading permissions, and warehouse restrictions.
Delivery group responses keep source references in `order_numbers` for
processing and also provide public `mobile_order_numbers` (for example,
`MO-0001`) for display.
Mobile order list and detail responses include `delivery_fee`. For completed
mobile Van Loads, the configured one-time route fee is split evenly across the
batch's orders, with remaining cents assigned in source-order order. Each order
detail can show its products subtotal, shipping share, and total; the printable
per-order receipt becomes available after that order is marked `DELIVERED`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/mobile-orders/` | List orders, with `limit` and `offset` pagination; `processed=true` lists confirmed and later fulfillment states |
| GET | `/mobile-orders/<order_number>/` | Read one order and its products |
| POST | `/mobile-orders/confirm/` | Confirm 1–100 selected orders together |
| PATCH | `/mobile-orders/<order_number>/` | Update one order's fulfillment status |

Bulk confirmation body:

```json
{
  "order_numbers": ["MSP-20261005-001", "MSP-20261005-002"],
  "notes": "Accepted by warehouse staff"
}
```

Status update body:

```json
{
  "status": "PROCESSING",
  "expected_status": "CONFIRMED",
  "notes": "Preparing for delivery"
}
```

`expected_status` is optional. Include the last known status to reject stale
updates. Notes are optional and limited to 500 characters.

Allowed transitions:

- `NEW` or `PENDING` → `CONFIRMED` or `CANCELLED`
- `CONFIRMED` → `PROCESSING`, `OUT_FOR_DELIVERY`, or `CANCELLED`
- `PROCESSING` → `OUT_FOR_DELIVERY` or `CANCELLED`
- `OUT_FOR_DELIVERY` → `DELIVERED`
- `DELIVERED` and `CANCELLED` are terminal.

Repeating the current status succeeds without another history entry. A stale
`expected_status` still returns a conflict. Legacy statuses are normalized:
`ORDER_CONFIRMED` → `CONFIRMED`, `IN_PROGRESS` → `PROCESSING`,
`SHIPPED` → `OUT_FOR_DELIVERY`, `COMPLETED`/`PICKED_UP` → `DELIVERED`,
and `CANCELED` → `CANCELLED`.

Processing response:

```json
{
  "updated_count": 1,
  "results": [
    {
      "order_number": "MSP-20261005-001",
      "previous_status": "CONFIRMED",
      "status": "PROCESSING",
      "changed": true
    }
  ]
}
```

The API updates `merchandising.status`, the linked
`chatbot_order.fulfillment_status`, and appends an `order_fulfillment` entry with
the POS user ID and notes. Delivery sets `chatbot_order.completed_at` to UTC.
Orders without a linked chatbot order still receive the merchandising status
update. Any missing order, invalid transition, mismatched reservation, or
insufficient stock rejects confirmation. POS stock changes for a batch commit
together. MySQL row locks serialize processing calls. Cancellation before
dispatch restores the committed inventory once; later fulfillment transitions
and retries do not deduct it again.

The two databases have independent transactions. A durable POS inventory
receipt (`mobile_order_stock_commitment`) is saved with the stock deduction.
If the mobile database fails after that POS commit, the API returns an error;
retry the same confirmation to finish source synchronization without another
stock deduction. Do not create another order. Source history is committed only
with the source status update. Legacy mobile-only orders match POS products by
system code and warehouse, never by an assumed shared numeric product ID.

Errors: `400` invalid input, `401` missing/expired login, `403` permission or
warehouse denied, `404` order absent from the selected warehouse, `409` stale or
invalid transition, and `503` source database unavailable or write failed.

## Database configuration

Use the existing `MOBILE_ORDERS_DB_*` environment variables. The account needs
`SELECT` on `warehouse`, `merchandising`, `customer`, `merchandising_item`,
`product`, and `chatbot_order`; `UPDATE` on `merchandising` and `chatbot_order`;
and `INSERT` on `order_fulfillment`. A SELECT-only account can list orders but
cannot process them. The source must contain the mobile backend's existing
tables and use transactional tables (InnoDB). POS never migrates that database.

Run POS migrations, including `0039_mobile_order_stock_commitment`, before
enabling confirmation. POS never migrates the mobile database.

The Mobile Purchases page polls every 15 seconds. Clicking an eligible card
selects it and reveals the checkboxes. Details remain available using the
Details button. Select one or more orders and choose **Confirm Orders → Van Load**.
The status table has its own paginated query, independent of the address filter.

## Mobile orders to Van Load

Run POS migration `0041_mobile_van_load_batch` before enabling this workflow.

- `POST /api/mobile-orders/van-load/` accepts `order_numbers` (1–100 source
  references). It returns a read-only preview (`status: DRAFT`, `id: null`), with
  POS product IDs and quantities summed across the selection. Opening or leaving
  this form creates no batch, inventory receipt, stock deduction, or status/history
  change. Public `MO-*` numbers remain display labels.
- The response opens Trading Sale with Van Load selected and the aggregated
  products prefilled. Choose the route and van, then use **For Delivery**.
- `POST /api/mobile-orders/van-load/dispatch/` accepts the selected `order_numbers`
  together with the van-load payload. Saving **For Delivery** revalidates the
  exact products, quantities, warehouse, route and van, commits inventory once,
  and creates one Pending van load with zero sold/returned quantities. Only then
  do source orders change to `OUT_FOR_DELIVERY` (displayed as **For Delivery**).
  Validation or source-history failures roll back the save and stock changes.
  Repeating the same selection returns the existing load. The frontend skips the
  ordinary bulk stock deduction because the server applies it during this save.
  `POST /api/mobile-van-loads/<batch_id>/dispatch/` remains available for existing
  durable batches. Existing AIVA reservations become `Transferred to Van Load`
  and cannot subsequently be completed as separate sales.
- Reconfirming the exact same selection resumes its batch. Partial selections
  cannot split an existing batch. `GET /api/mobile-van-loads/<batch_id>/` returns
  the linked orders, public labels and per-order product quantities.
- When the van returns, choose **Accepted** or **Returned** for each order and
  declare sold pieces, full returns and empty bottles using Van Load Remittance.
  `POST /api/mobile-van-loads/<batch_id>/return/` requires `order_outcomes`, mapping
  each source reference to `DELIVERED` or `RETURNED`, together with the normal
  `products` declaration. Sold and full-return quantities must match those
  outcomes. Customer-refused orders become Returned and their full products
  return to stock; accepted orders become Delivered. Empty bottles are recorded
  separately. The van load can be completed only after this declaration.
- Durable return receipts make retries safe if source status/history writes fail.
  An identical retry only finishes synchronization; a changed declaration is
  rejected for review. Linked-order mutations must go through this workflow.

These endpoints require a POS token, Trading edit/full permission and the
selected warehouse scope. POS never applies migrations to the mobile database.

Run isolated API tests from `backend_coke_system`:

```powershell
python manage.py test api.test_mobile_orders --settings=backend_coke_system.test_settings
```
