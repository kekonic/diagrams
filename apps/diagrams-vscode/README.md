# Kekonic Diagrams for VS Code

Author architecture diagrams as readable `.kdiagram` source with first-party language intelligence
and a live interactive diagram preview.

## Features

- diagnostics, completion, hover, definitions, references, rename, symbols, folding, semantic
  tokens, formatting, and quick fixes through the bundled Kekonic Diagrams language server
- `.kdiagram` syntax highlighting, comments, bracket matching, and automatic closing pairs
- side-by-side interactive preview (`<k-diagram>` pan/zoom/view/animation controls) that follows the
  active `.kdiagram` editor and the editor color theme (accent / neutrals)
- portable SVG export using the selected light or dark preview theme (`diagrams.preview.theme`)
- rendered `kdiagram` fences in the built-in Markdown preview

Opening a `.kdiagram` file auto-opens the preview beside the editor (`diagrams.preview.autoOpen`,
default on). You can also use **Kekonic Diagrams: Open Preview to the Side** from the command
palette, the editor context menu, the title-bar preview action, or **Ctrl+Shift+V** /
**Cmd+Shift+V**. Use **Kekonic Diagrams: Export SVG** to save a self-contained diagram.

If the title-bar preview icon is hidden in Cursor or another VS Code derivative, enable it from the
editor title overflow checkmark menu, or use the keybinding / auto-open instead — that chrome is
controlled by the host editor.

The extension bundles its language server, interactive renderer, and Iconify icon collections. It
does not require a global CLI install, make network requests, or send telemetry.

## Compatible editors

The extension targets the standard VS Code extension API and is designed for VS Code and compatible
derivatives such as Cursor. Install it from your editor's extension registry or use the VSIX
attached to each GitHub Release.

Read the complete [editor guide](https://diagrams.kekonic.com/start/vscode/) or report a problem
in the [issue tracker](https://github.com/kekonic/diagrams/issues).
