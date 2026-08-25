# Kekonic Diagrams naming

The product is **Kekonic Diagrams**. Never call it **KDiagrams**. Never use **KDiagram** as a
product or brand name on the docs homepage, splash pages, or other marketing copy.

- User-facing homepage and splash copy: **Kekonic Diagrams**.
- **`.kdiagram`** is the source file extension and Markdown fence language (`checkout.kdiagram`,
  ` ```kdiagram `). It is not the product name.
- Existing deep language-reference docs that already say **KDiagram** may stay. Do not introduce
  **KDiagram** as a product name on new marketing or homepage surfaces.
- Keep real identifiers unchanged: the `kdiagrams` CLI (`kdiagrams check`), packages such as
  `@kekonic/diagrams`, `@kekonic/diagrams-agents`, CSS classes such as `kd-*`, code identifiers, and
  the skill `design-kekonic-diagrams`.

```text
✅ Kekonic Diagrams renders architecture from text.
✅ Kekonic Diagrams handles layout.
✅ Save this as checkout.kdiagram.
✅ kdiagrams render checkout.kdiagram
❌ KDiagrams renders architecture from text.
❌ KDiagram handles layout.          # not a product/brand name
❌ Open the kdiagrams file.         # file format is .kdiagram, not the product
```
