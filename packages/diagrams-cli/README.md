# @kekonic/diagrams-cli

Command-line tools for KDiagram diagrams.

## Install

```bash
pnpm add --save-dev @kekonic/diagrams-cli
pnpm kdiagrams --help
```

Keep the CLI local to the project so developers and CI use the same version. For a one-off
evaluation, run `pnpm dlx @kekonic/diagrams-cli --help`.

## Commands

```bash
# Render one portable diagram to SVG (stdout or file)
kdiagrams render diagram.kdiagram -o out.svg --theme light

# Discover and render a directory while preserving its structure
kdiagrams render diagrams/ --out-dir public/diagrams

# Validate files, directories, or quoted globs
kdiagrams check docs/ "examples/**/*.kdiagram"
kdiagrams check - --json # diagram source on stdin
git ls-files "*.kdiagram" | kdiagrams check --files-from -

# Dump AST or GraphModel as JSON
kdiagrams ast diagram.kdiagrams --pretty
kdiagrams graph diagram.kdiagrams --pretty

# Discover the supported surface and inspect rendered quality
kdiagrams capabilities --pretty
kdiagrams analyze diagrams/ --pretty

# Format source
kdiagrams format diagram.kdiagram -o formatted.kdiagram
kdiagrams format diagrams/ --check
kdiagrams format diagrams/ --write
kdiagrams doctor
kdiagrams completions zsh > ~/.zfunc/_kdiagrams
kdiagrams studio architecture.kdiagram
kdiagrams lsp --stdio
kdiagrams --version
```

Diagnostics print to stderr; rendered SVG or versioned JSON goes to stdout unless `-o` is set.
Unknown options are rejected with suggestions. Exit `0` means success, `1` means source diagnostics
or a format check failure, `2` means invalid CLI usage, and `3` means an operational failure.

## Input discovery

Every command accepts files, directories, and quoted glob patterns. Directory discovery is
recursive, stably ordered, limited to `.kdiagram` files, and deduplicated. Options may appear before
or after inputs.

Place Git-ignore-style patterns in `.kdiagramignore`, select another rules file with
`--ignore-file`, or repeat `--exclude` for command-specific exclusions. `-` means diagram source on
stdin; when a command has no input, piped stdin is read automatically. Use `--stdin-filename` to
give that source a meaningful path. `--files-from <file|->` instead reads one input path per line.

For batch rendering, use `--out-dir` and optionally `--output-template`. Templates support
`{path}`, `{dir}`, `{name}`, and `{ext}`. The default `{path}.svg` preserves source directories and
the command rejects output collisions before writing files.

## Agent and automation contracts

`kdiagrams capabilities` emits a deterministic, versioned description of the built-in language,
node kinds, shapes, icons, layout policies, presentation modes, and quality checks. Its
`registryScope` is `built-in`; runtime registrations belong to the embedding application and are
not inferred by the standalone CLI.

`kdiagrams analyze <inputs...>` runs the complete parse, compile, measure, layout, and route pipeline
without returning SVG. Its JSON envelope reports diagnostics and artifact dimensions for every
input. Source errors exit 1; quality warnings remain inspectable warnings so callers can apply a
project-specific delivery policy.

## Portable exports and project config

CLI SVG is a self-contained theme snapshot by default. Use `--live-theme` only when the SVG will be
inlined into a host that provides KDiagram CSS variables. `--background theme`, `--embed-fonts`, and
`--print-safe` make destination requirements explicit.

The CLI discovers `kekonic-diagrams.config.json` upward from the current directory. It can define named
themes and reusable profiles; command flags take precedence:

```json
{
  "$schema": "./node_modules/@kekonic/diagrams-cli/schema/kekonic-diagrams.config.schema.json",
  "version": 1,
  "defaultProfile": "paper",
  "profiles": {
    "paper": {
      "theme": "light",
      "background": "theme",
      "embedFonts": true,
      "printSafe": true
    }
  }
}
```

Select a profile with `--profile paper`, a config with `--config`, or a deterministic JSON token map
with `--theme-file`. PNG and PDF are reserved in the profile model but are not emitted by this CLI
version.

After stable releases begin, macOS users can install the same published CLI through
`brew install kekonic/tap/diagrams`.

## Local authoring studio

```bash
kdiagrams studio architecture.kdiagram
kdiagrams studio diagrams/ --no-open
kdiagrams studio architecture.kdiagrams --allow-write
```

Studio starts an offline browser authoring host with Monaco editing, live preview and diagnostics,
layout/theme controls, graph inspection, source/graph selection, and SVG export. It binds only to
`127.0.0.1`, generates an unguessable token for each session, and limits file access to resolved
inputs. Browser saves are disabled unless `--allow-write` is explicit. `--no-open` starts the server
without launching a browser; use `--port` only when another local tool needs a predictable port.

## Language server

`kdiagrams lsp --stdio` runs the Language Server Protocol for editor clients. It supports incremental
document synchronization, diagnostics, completion, hover, definition, references, rename, document
symbols, folding, semantic tokens, formatting, and code actions. Protocol messages are the only
stdout output. The server and Studio both use `@kekonic/diagrams-language-service`, so editor
semantics do not diverge from CLI validation and formatting.

## Example

```bash
kdiagrams render diagram.kdiagram -o out.svg
kdiagrams check diagram.kdiagram
```

See `@kekonic/diagrams` for programmatic API usage.

Publishing guides (CI, README SVGs, wiki exports): [diagrams.kekonic.com/publish](https://diagrams.kekonic.com/publish/).
