# Brief: Storefront system context

## Reader and question

**Audience:** Developers joining the commerce platform; C4 practitioners reviewing context.

**Question:** Who uses the storefront platform, and which software systems sit outside it?

**When appropriate:** C4 system context. People and software systems only. Do not show containers, components, topics, or databases.

## Facts (established)

- A customer uses the commerce platform to place orders.
- The software system of interest is the commerce platform, owned by Commerce Co.
- Stripe authorizes card payments (external software system).
- A warehouse system receives pick-and-pack work (external software system).
- An email provider sends transactional mail (external software system).
- The event bus, outbox, and internal services are inside the platform — not this view.

## Assumptions

- The platform is one software system at context level; containers live in `storefront-containers`.
- “Warehouse” and “Email provider” are external products, not named vendors.
- Stripe is the only named payment vendor.
- “Commerce Co.” is the fictional enterprise that owns the platform.

## Intentional omissions

- Internal applications, workers, databases, topics.
- Mobile app (not established for this corpus).
- Partner portals, admin tools, support agents.
- Deployment, regions, and trust zones.
- C4 code-level (classes) — Kekonic Diagrams does not claim that view.

## Layout / presentation policy

- Direction: TD stack — Customer → enterprise boundary → row of external systems.
- `boundary` for the enterprise; people and external systems stay outside it.
- Density: `spacious` so descriptions fit.
- Kinds: `person`, `system`, `external`. Kind subtitles on.
- Descriptions on every element. Relationship labels state intent and optional technology.
- No vendor logos; the type line and description carry meaning.
