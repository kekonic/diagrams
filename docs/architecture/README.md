# Kekonic Diagrams architecture

These notes document durable boundaries and invariants. They do not track milestones, release
status, or speculative features.

- [Pipeline contracts](pipeline.md) — phase ownership, package dependencies, option precedence,
  determinism, and trust boundaries.
- [Supported extension surfaces](supported-extension-surfaces.md) — retained registries, authored
  synonyms, redirects, and development-only Studio boundaries.
- Package READMEs — installation, exports, and package-specific behavior.
- [Public reference documentation](https://diagrams.kekonic.com/reference/api/) — supported user
  APIs and behavior.
- [Roadmap](../../ROADMAP.md) — product priorities and time-bound plans.

When behavior changes, update the owning code and tests first, then update the smallest document
that describes the affected contract. Keep proposals and sequencing in the roadmap rather than
turning architecture notes into a product plan.
