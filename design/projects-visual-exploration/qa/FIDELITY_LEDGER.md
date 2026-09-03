# Concept-to-local fidelity ledger

This ledger records the comparison between each revised Gemini Canvas concept and its local static prototype. The local implementation preserves the approved visual direction; it does not introduce a fourth direction or Production behavior.

## Direction A — Editorial Project Archive

- Preserved: floating glass pill header, `Projects.` intro, numbered chronological archive, two-column desktop rhythm, warm ivory/charcoal/ruby palette, serif display type, mono metadata, six-project copy and five exact `PROTOTYPE ONLY` labels.
- Responsive translation: the archive collapses to one column at mobile widths while keeping number/date/status above the project copy.
- Local-only adjustments: embedded CSS was split into `styles.css`; viewport restrictions were removed; a data-URI favicon avoids a false 404 during local QA.
- Material drift: none observed in the 1440 and 430 visual comparisons.

## Direction B — Living Workshop

- Preserved: floating glass pill header, `Work in progress.` framing, Morning Radar as `CURRENT WORKSHOP`, process marginalia, open `NOTES & ARCHIVES`, alternating desktop placement, exact fixture labels and metadata.
- Responsive translation: workshop metadata moves below the featured copy and archive notes become a single readable column.
- Local-only adjustments: embedded CSS was split into `styles.css`; the inert search control is a semantic anchor; viewport restrictions were removed; a data-URI favicon avoids a false 404.
- Material drift: none observed in the 1440 and 430 visual comparisons.

## Direction C — Digital Artifacts

- Preserved: floating glass pill header, `Digital artifacts.` framing, Morning Radar as the dominant artifact, unequal compositions, partial rules, CSS-only abstract identities, full copy/metadata/link states and five exact `PROTOTYPE ONLY` labels.
- Responsive translation: artifact anatomies stack without turning into a uniform card grid; the black field, code trace and status table remain distinct.
- Local-only adjustments: embedded CSS was split into `styles.css`; viewport restrictions were removed; a data-URI favicon avoids a false 404.
- Material drift: none observed in the 1440, 430 and 390 visual comparisons.

## QA evidence

- Tested viewports: 1440 × 1000, 430 × 932, 390 × 844.
- All three directions: no horizontal overflow; all six project names present; five exact `PROTOTYPE ONLY` labels; navigation and long-title bounds remain inside the viewport.
- Local console: 0 errors, 0 warnings on every tested direction and breakpoint.
- Links: Comparison Hub routes to A/B/C; prototype project links resolve to the local `#detail-deferred` target; no external asset requests are used.
- Keyboard: the first tab stop is visible with a 2px ruby outline.
