# `@kekonic/diagrams-unplugin`

Import standalone `.kdiagram` files through Vite, Rollup, Rolldown, Webpack, Rspack, or esbuild.

```ts
import kdiagram from "@kekonic/diagrams-unplugin/vite";

export default { plugins: [kdiagram()] };
```

Imports are explicit so applications choose static output or a live runtime deliberately:

```ts
import svg from "./system.kdiagram?svg";
import url from "./system.kdiagram?url";
import source from "./system.kdiagram?source";
import Diagram from "./system.kdiagram?react";
import DiagramElement from "./system.kdiagram?element";
```

- `?svg` exports portable SVG markup.
- `?url` exports a self-contained SVG data URL that works consistently across supported bundlers.
- `?source` exports the original DSL.
- `?react` exports a live component backed by `@kekonic/diagrams-ui`.
- `?element` exports an unregistered `KDiagram` subclass. Register it under an application-owned
  tag with `customElements.define("system-diagram", DiagramElement)`.

Add `@kekonic/diagrams-unplugin/client` to `compilerOptions.types` for TypeScript import
declarations. React and element dependencies are optional unless their corresponding queries are
used. Bare `.kdiagram` imports intentionally fail with a list of supported queries.
