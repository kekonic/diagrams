<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Kekonic Diagrams agent notes

Before changing files, read and follow
[`.agents/rules/kekonic-diagrams-repo-conventions.md`](.agents/rules/kekonic-diagrams-repo-conventions.md)
and [`.agents/rules/kekonic-diagrams-naming.md`](.agents/rules/kekonic-diagrams-naming.md).
The product is **Kekonic Diagrams**; never **KDiagram** or **KDiagrams** as a product name. **`.kdiagram`** is the file format only.
More specific rules live in [`packages/AGENTS.md`](packages/AGENTS.md) and
[`apps/AGENTS.md`](apps/AGENTS.md); Codex applies them automatically when working in those trees.

- **Contributing:** Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) — Conventional Commits, Changesets, PR template, docs boundaries.
- **Versions:** Prefer `pnpm changeset` over editing package versions by hand. Workspace versioning policy lives in `.changeset/config.json`; release history and prerelease state live in `CHANGELOG.md` and `.changeset/pre.json`.
- **Do not commit/push** unless the human explicitly says **ship it**.
- **Public API surface:** `@kekonic/diagrams`, `-cli`, `-element`, `-ui` (+ lower-level packages). Never teach `apps/website` private Astro hosts as user docs.
- **Direction:** [`ROADMAP.md`](ROADMAP.md) owns product priority. Code, tests, focused architecture decisions, and public reference docs own current behavior.
- **API evolution:** Prefer one coherent current API over unnecessary aliases, shims, or parallel old/new paths. When a breaking change is authorized, update every in-repo consumer, test, example, document, and Changeset atomically.
- **Behavior:** Keep parsing, model construction, layout, routing, and rendering deterministic. Represent expected source/user failures with structured diagnostics, preserve source locations, and never silently swallow errors.
- **Security:** Treat diagram text, URLs, icons, theme values, and imported SVG as untrusted input at every HTML/SVG boundary. Do not add arbitrary HTML or script execution.
- **Worktree:** Preserve unrelated and pre-existing changes. Do not hand-edit generated output, lockfiles, changelogs, or package versions unless the task specifically requires their owning workflow.
- **Validation:** Prefer `vp run ready` before claiming a change is done.
