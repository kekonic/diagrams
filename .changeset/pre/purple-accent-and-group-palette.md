---
"@kekonic/diagrams": minor
"@kekonic/diagrams-render-svg": minor
"@kekonic/diagrams-theme": minor
"@kekonic/diagrams-ui": minor
---

Move the default theme accent to purple and retune the group accent palette.

The brand sits at OKLCH hue 288 (between indigo and Tailwind violet). Past ~300
the hue runs into purple → fuchsia → pink, so raising chroma there turns the
brand pink; at 288 more chroma reads as richer violet. Link accents are
`oklch(72% 0.14 288)` dark / `oklch(48% 0.21 288)` light. Filled brand surfaces
use a separate theme-independent `--accent-strong` (`oklch(52% 0.24 288)`) with
`--on-accent-strong` near-white labels (~5.8:1), so primary buttons stay
legible in both modes instead of washing out as pale lavender. A related
`--accent-contrast` token tracks the accent seed for text placed on `--accent`
fills.

Group washes render at ~12% alpha, where amber, orange, and red desaturated into
olive, brown, and maroon over a dark panel. The palette now holds a consistent
lightness across cool and magenta hues so multi-group diagrams stay legible on
both dark and light backgrounds.
