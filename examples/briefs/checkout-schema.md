# Brief: Checkout schema

## Reader and question

**Audience:** Developers modeling checkout persistence.

**Question:** Which tables own checkout data and how do foreign keys relate them?

**When appropriate:** ERD / persistence model for checkout entities.

## Facts

- customers and products feed orders / order_items; payments and shipments hang off orders.

## Assumptions

- PostgreSQL UUID keys.
- Outbox table omitted from this ERD.

## Intentional omissions

- Inventory stock ledger.
- Audit columns.

## Layout / presentation policy

- LR flat tables (no compound stacks — FK routes must not punch through siblings).
- Compact density; orthogonal + gaps; `groupAccent: false`.
