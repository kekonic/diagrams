# Brief: Storefront system context

## Reader and question

**Audience:** Developers joining the commerce platform.

**Question:** Who talks to the storefront platform, and which outside systems does it depend on?

**When appropriate:** C4-style context views. Do not show internal services, topics, or databases.

## Facts (established)

- A customer uses a browser storefront to place orders.
- The subject system is the commerce storefront platform.
- Stripe authorizes card payments (outside the platform).
- A warehouse system receives pick-and-pack work (outside the platform).
- An email provider sends transactional mail (outside the platform).
- The event bus is internal infrastructure, not an outside actor at this level.

## Assumptions

- The platform is one logical system at context level; container detail lives in `order-fulfillment`.
- “Warehouse” and “Email provider” are external products, not named vendors.
- Stripe is the only named payment vendor.

## Intentional omissions

- Internal services, gateways, databases, topics, workers.
- Mobile app (not established for this corpus).
- Partner portals, admin tools, support agents.
- Deployment, regions, and trust zones.

## Layout / presentation policy

- Direction: TD stack — Customer → subject system → row of externals.
- Compact density; `groupAccent: false`.
- Kinds: `person`, `system`, `external`.
- Edge ops: `->` with short verbs.
