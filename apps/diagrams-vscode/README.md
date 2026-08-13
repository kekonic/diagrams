# Kekonic Diagrams for VS Code

Author architecture diagrams as readable `.kdiagram` source with first-party language intelligence
and a live diagram preview.

## Features

- diagnostics, completion, hover, definitions, references, rename, symbols, folding, semantic
  tokens, formatting, and quick fixes through the bundled KDiagram language server
- KDiagram syntax highlighting, comments, bracket matching, and automatic closing pairs
- side-by-side preview that follows the active `.kdiagram` editor
- portable SVG export using the selected light or dark preview theme
- rendered `kdiagrams` fences in the built-in Markdown preview

Use **KDiagram: Open Preview to the Side** from the command palette or the editor title action. Use
**KDiagram: Export SVG** to save a self-contained diagram for documentation or presentations.

The extension bundles its language server and renderer. It does not require a global CLI install,
make network requests, or send telemetry.

## Compatible editors

The extension targets the standard VS Code extension API and is designed for VS Code and compatible
derivatives such as Cursor. Install it from your editor's extension registry or use the VSIX
attached to each KDiagram GitHub Release.

Read the complete [editor guide](https://diagrams.kekonic.com/start/vscode/) or report a problem
in the [KDiagram issue tracker](https://github.com/kekonic/diagrams/issues).
