# VS Code extension release

The `kekonic.diagrams` extension is built once as a self-contained VSIX and attached to the
matching GitHub Release. Marketplace publishing (Open VSX and the VS Marketplace) is **deferred**
until the extension is ready — CI must not run `ovsx` or `vsce publish` yet. The extension bundles
its language server and renderer; users do not install Node packages or a global `kdiagrams` CLI.

## Release contract

`vp run diagrams#package` builds `artifacts/diagrams-<version>.vsix` and checks its
identity, runtime entrypoints, required registry files, maximum size, and absence of source,
source maps, general dependency trees, lockfiles, and environment files. Copied runtime package
material is limited to the bundled Inter font (plus its resolution metadata) and the default
`@iconify-json/*` collections used for offline preview icons. The Markdown preview script and the
interactive side-preview webview script (`preview-webview.js`, hosting `<k-diagram>`) must each
ship as a single file (no code-split sibling chunks). CI attaches that exact artifact to the GitHub
Release rather than rebuilding independently for each registry.

The normal Changesets release workflow:

1. publishes the fixed Kekonic Diagrams package version;
2. packages and validates the VSIX;
3. creates the matching `v<version>` GitHub Release with notes and the VSIX asset in the same
   `gh release create` (GitHub Releases here are immutable, so CI must not upload assets after the
   release exists);
4. does **not** publish to Open VSX or the VS Marketplace (deferred).

If delivery fails after npm publication, manually dispatch the **Release** workflow with the
existing version. Recovery verifies the npm release, reuses the VSIX from the corresponding GitHub
Release when possible, rebuilds from a matching ref when it is not attached, skips GitHub release
create when `v<version>` already exists, and retries the remaining delivery steps without asking
Changesets to publish again. VSIX package or attach trouble must not skip Homebrew or docs deploy.

## One-time identity setup (when marketplace publish is enabled later)

- create or claim the `kekonic` publisher/namespace on Open VSX and the VS Marketplace;
- store publishing tokens in the Kekonic Diagrams production Infisical environment;
- keep the public identity `kekonic.diagrams`.

## Manual verification

Before the first public release, download the GitHub VSIX and install it into stable VS Code and a
VS Code derivative:

```bash
code --install-extension diagrams-<version>.vsix
```

Verify `.kdiagram` activation, diagnostics, completion, formatting, interactive side preview (pan /
zoom controls), SVG export, auto-open / keybinding discoverability, and a `kdiagram` fence in
Markdown preview. The GitHub Release artifact should show the PNG icon, README, license, support
link, repository, and the extension identifier `kekonic.diagrams`.
