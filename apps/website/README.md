# Kekonic Diagrams website

Astro + Starlight documentation for KDiagram.

Canonical production URL: **https://diagrams.kekonic.com** (Cloudflare Pages). Deployment and
access configuration are documented in root [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and
[`infra/cloudflare/`](../../infra/cloudflare/).

```bash
vp install
vp run @kekonic/diagrams-website#dev
vp run @kekonic/diagrams-website#build
```

Uses published packages (`@kekonic/diagrams`, `@kekonic/diagrams-ui`,
`@kekonic/diagrams-element`) for embeds. Site-local Astro wrappers are private hosts — not a
public API.
