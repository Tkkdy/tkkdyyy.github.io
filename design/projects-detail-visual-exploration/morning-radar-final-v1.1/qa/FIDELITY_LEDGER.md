# Morning Radar v1.1 — QA / Fidelity Ledger

## Before / After at 1920 × 1080

| Measure | Final v1 | Final v1.1 |
| --- | ---: | ---: |
| Main field | 1760px | 1560px |
| Approx. outer gutter | 73px | 180px |
| Document height | 1379px | 2426px |
| Daily Brief | 874px | 1035px |
| Tech Stack | 283px narrow column | 509px supporting module |
| Pipeline | 874px | 1560px full row |

The content now unfolds vertically. Evidence and readable project information lead; technical labels remain compact.

## Layout Verification

- `1920 × 1080`: 1560px field, clear outer air, six-row archive sequence, no forced one-screen compression.
- `1440 × 1000`: 1310px field with ~58px gutters; 868/426 main/support split remains readable.
- `430 × 932`: 394px modules, 4147px document, no horizontal overflow.
- `390 × 844`: 339px modules, 4126px document, no horizontal overflow or overflowing descendants.

## Interaction / Runtime

- Evidence trigger opens the native dialog.
- Close control receives focus when opened.
- `Escape` closes the dialog and restores focus to the Evidence trigger.
- Fresh-page console: 0 errors, 0 warnings.
- Page, CSS, JS, image and font requests: all successful.

## Scope Guard

- Existing content, project facts, module set and JavaScript interaction are preserved.
- Final v1 remains the immutable Before reference.
- Production `src/**` is unchanged.
- Browser plugin was unavailable; QA used the configured Playwright fallback.
