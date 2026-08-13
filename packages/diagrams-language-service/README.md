# `@kekonic/diagrams-language-service`

Browser-compatible KDiagram language intelligence shared by Monaco and LSP hosts. The package owns
document snapshots, diagnostics, completion, hover, navigation, rename, symbols, folding, semantic
tokens, formatting, code actions, and the versioned custom-semantics extension protocol.

```ts
import { KDiagramLanguageService } from "@kekonic/diagrams-language-service";

const service = new KDiagramLanguageService();
service.updateDocument("file:///architecture.kdiagram", source, 1);
const diagnostics = service.diagnostics("file:///architecture.kdiagram");
```

Hosts supply transport and editor-specific conversions. Node processes should use
`kdiagrams lsp --stdio`; browser editors can call this package directly.
