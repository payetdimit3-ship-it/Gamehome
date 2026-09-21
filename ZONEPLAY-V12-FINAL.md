# LIFEISGAMETZ — ZonePlay V12

Complete visual rebuild/normalization pass based on the supplied all-pages ZonePlay reference.

## Scope
- All 41 HTML pages use the same master visual system.
- One sidebar, one topbar, one content frame and one mobile bottom navigation.
- Legacy page chrome is suppressed after the shared shell is mounted.
- Profile, authentication, catalog, cart/checkout, account, information and community pages all use the same surface, spacing, typography and controls.
- Catalog grids are normalized to the dense ZonePlay reference proportions.
- Mobile pages use the same visual language with a drawer sidebar and bottom navigation.

## QA
- HTML pages: 41
- V12 stylesheet loaded: 41/41
- Inline legacy sidebar rules are overridden by the master layer.
- Existing page JavaScript and API calls are preserved.
