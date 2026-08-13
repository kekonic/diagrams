# Supported extension surfaces

KDiagram keeps extension points only when a current consumer can state and test their contract.
The stable pipeline has one output target: SVG. Render policy controls SVG presentation but does
not select a renderer or rewrite measurement, layout, or routing.

## Retained public seams

- Shape and semantic-node registries let supported consumers add geometry and semantics without
  changing the parser or renderer core.
- Theme and icon registries let applications provide deterministic presentation assets.
- Authored shape synonyms such as `hex` and `cyl` remain part of source normalization. They are
  concise language vocabulary used by current examples, not migration shims.
- Published documentation redirects preserve inbound links from earlier documentation layouts.
  They do not create parallel APIs or duplicate content.

## Private host seams

Studio's repository save endpoint and Vite plugin are development-only behavior colocated with the
Studio package and excluded from its published files. CLI-launched Studio uses its own rooted,
authorized file protocol rather than reusing that development endpoint.

## Removed surfaces

The alternate renderer contribution/profile API, renderer selectors, private storage migrations,
and unused type and icon-option aliases had no supported consumer after the experimental package
was removed. They were deleted before stable 1.0 instead of becoming compatibility obligations.
