# Direction C Fidelity Ledger

| Comparison point | Original C evidence | Candidate evidence | Resolution |
| --- | --- | --- | --- |
| Primary hierarchy | Morning Radar spans all 12 columns | Morning Radar still spans all 12 columns with index, serif title and description rails | Preserved |
| First asymmetric pair | Atlas uses 7 columns; Context uses 4 columns with a skipped gutter | Candidate keeps `1 / 8` and `9 / 13` | Preserved |
| Pair boundary | Two projects could visually merge | Atlas receives a faint neutral field; Context retains a local left rule | Intentionally improved |
| Quiet Relay anchor | Near-black 5-column visual beside text | Near-black rectangle and one ruby point retained | Preserved after first-pass correction |
| Lower rhythm | Local Index 5 columns, Cabinet 6 columns; different anatomy | Local Index is one compact flip artifact; Cabinet remains an open static ledger | Slightly adjusted without equalizing |
| Technology density | One major dark visual plus tiny graph/code | Same: one dark field, one tiny graph, code as content | Preserved and restrained |
| Intro | Short English line plus Chinese explanation | Adds one `▲` marker while preserving two-line structure | Intentionally adjusted |
| Ending | Original deferred-detail footer | Spacious serif “Build slowly. Leave meaningful traces.” | Intentionally changed per brief |
| Palette | Warm off-white `#F6F4EE` | Humane neutral off-white `#F7F7F6` | Intentionally cooled |
| Motion | Static project surfaces | Exactly one local flip, 540ms; static featured and editorial projects | Intentionally added |

## Above-the-fold copy diff

Original visible copy remains: navigation labels, “Digital artifacts.”, the Chinese intro, `01`, `Python, LLM`, Morning Radar name/tagline/description/status. The only addition is the requested `▲` editorial marker. No marketing copy, CTA, new project or detail-page promise was introduced.

## QA summary

- 1440 × 1000: six projects, one flip module, no overflow, C hierarchy intact.
- 430 × 932: brand/search navigation, single-column editorial rhythm, two-tap flip.
- 390 × 844 (375 CSS-pixel client area): no overflow; long title and flip remain inside the container.
- Keyboard: visible 2px focus, Enter and Space both toggle `aria-pressed`.
- Reduced motion: transform remains `none`; front/back opacity changes from `1/0` to `0/1`.
- Console: 0 errors, 0 warnings on the local candidate.
- Network: only local HTML, CSS and JavaScript.

The accepted Canvas source and local implementation were inspected at native 1440px width using browser screenshots plus `view_image`. No material visual mismatch remains after the mechanical split and accessibility adjustments.
