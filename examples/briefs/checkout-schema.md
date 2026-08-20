# Brief: Checkout schema

## Reader and question

**Audience:** Developers modeling checkout persistence.

**Question:** Which tables own checkout data, and how do keys and cardinality relate them?

**When appropriate:** ERD / persistence model for checkout entities.

## Facts

- Identity (customers, profiles, addresses), catalog (categories, products), and orders (items, payments) are separate bounded contexts.
- `customer_profiles` is identifying 1:1 (`customer_id` is the PK and FK).
- `order_items` uses a composite PK `(order_id, line_no)` that identifies lines under an order.
- An order has a required billing address and an optional shipping address — two FKs to `addresses`.
- This slice stores one captured payment per order (`order_id` unique).

## Assumptions

- PostgreSQL-ish types (`uuid`, `varchar(320)`, `numeric(10,2)`, `char(2)`, `timestamptz`).
- Categories may nest via optional `parent_id`.
- Outbox table omitted from this ERD.

## Intentional omissions

- Inventory stock ledger.
- Audit columns and secondary indexes.
- Refunds, shipments, and multi-capture payments.

## Layout / presentation policy

- LR compound groups for Identity / Catalog / Orders.
- Compact density; orthogonal + gaps; `groupAccent: false`.
