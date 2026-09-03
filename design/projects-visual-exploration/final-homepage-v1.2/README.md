# VDVXDV Projects — Final Homepage v1.2 Layout Tune

This folder contains the layout-tuned iteration of Final Homepage v1. Open `index.html` through a local HTTP server; no build step or external dependency is required. v1.2 changes layout parameters only: masthead width, major visual ratios, supporting-text hierarchy, internal spacing, and responsive corrections.

## Design thesis

**Signal Archive / Structured Field:** the Candidate's real content and different project anatomy are preserved, while row density, metadata alignment, cold-white/carbon contrast, rectangular evidence frames, and the 60/40 Small Works ending are tightened using Reference B as visual grammar rather than copied content.

## Real asset ledger

| Visual | Label | Source / honesty note |
| --- | --- | --- |
| `assets/morning-radar-2026-08-15.png` | **CAPTURED** | Playwright viewport capture of the real local `site/briefs/2026-08-15.html`; browser/account chrome excluded. |
| `assets/desktop-pet-idle.png` | **REAL** | Actual Windows pet idle asset. |
| `assets/desktop-pet-blink-half.png` | **REAL** | Actual half-blink asset. |
| `assets/desktop-pet-blink-closed.png` | **REAL** | Actual closed-blink asset. |
| `assets/desktop-pet-pat-hand.png` | **REAL** | Actual pat hand overlay. |
| `assets/desktop-pet-pat-heart.png` | **REAL** | Actual pat feedback overlay. |
| `assets/desktop-pet-blink-process.png` | **REAL** | Actual blink compositing/debug comparison; retained as evidence, not currently placed in the page. |
| `assets/mini-her-contact-sheet.png` | **REAL** | Final QA contact sheet: nine states, 57 used frames. |
| `assets/mini-her-idle.gif` | **REAL** | Final QA idle preview; retained as evidence, not required for the static-first page. |
| `assets/vdvxdv-home-desktop.png` | **CAPTURED** | Existing 1440×900 local/standalone homepage capture. It is presented as process evidence, not proof of deployment. |
| `assets/vdvxdv-home-mobile.png` | **CAPTURED** | Existing 390×844 local/standalone homepage capture. It is presented as process evidence, not proof of deployment. |
| Tetris terminal reconstruction in `index.html` | **PROTOTYPE-ONLY** | Reconstructed from the verified README feature set. It is visibly labelled and is not presented as a runtime screenshot. |
| ESP32 source trace in `index.html` | **REAL** | Transcribed from the three real sketches: GPIO 25 blink, serial state output, and `analogWrite` breathing loop. No hardware image is implied. |
| Codex Fix decision trace | **PROTOTYPE-ONLY** | A sanitized information design derived from the real safety workflow. It contains no environment values or invented runtime logs. |
| CLI ending | **PROTOTYPE-ONLY** | Interface proposal for the Projects index ending; not a terminal emulator. |

## Gemini / Canvas provenance

No Gemini or Canvas call was made for v1.2. The notes below describe inherited v1 provenance only.

Gemini 3.1 Pro Extended Thinking + Canvas was used as the visual synthesis partner. The marked Reference B PNG and its clean companion, both current Candidate screenshots, current HTML/CSS/JS, and the Real Project Archetype & Asset Map were uploaded as actual files. Gemini's generated layout passed the factual-boundary review; its structural decisions were synthesized locally without replacing the Candidate's richer real-content anatomy. See `gemini-source/GENERATION_NOTES.md`.

## Interaction

- Desktop Pet: click/tap the stage, or use the three controls. `Enter` and `Space` work when the stage has focus.
- VDVXDV Website: switch between desktop and mobile evidence.
- Codex Fix: the only 180° flip. Click/tap or use `Enter` / `Space`.
- `prefers-reduced-motion: reduce` removes transitions and cursor blinking while preserving direct state changes.

## QA targets

- 1920×1080
- 1440px desktop
- 430px mobile
- 390px mobile

Production files are outside this folder and must remain unchanged.

## Fidelity ledger

Accepted visual grammar reference: `../74ff4f04-547d-40b9-b146-75e68d698935.png` (Reference B, marked board).

| Locked reference point | Final treatment |
| --- | --- |
| Quiet cold-white editorial field | Preserved with a cooler gray paper surface and graphite rules. |
| Floating VDVXDV pill navigation | Preserved on desktop; reduced to brand + location on mobile rather than hidden. |
| Serif project titles plus mono evidence metadata | Preserved and strengthened with vertical stage indices and provenance labels. |
| Asymmetric archive rhythm | Preserved, but every real project now receives its own evidence anatomy instead of repeated article rows. |
| Morning Radar as the dominant current-work story | Preserved and upgraded from a placeholder text block to the real captured brief. |
| Thin rules and rectangular surfaces | Preserved; rounded containers are limited to the inherited global navigation. |
| Restrained interaction | Three content-specific interactions only: pet state, site viewport, and one Codex flip. |
| Quiet terminal-like ending | Preserved as one thin in-flow carbon strip, without terminal emulator chrome. |

Above-fold copy intentionally differs from Direction B: the generic archive description was replaced by an evidence-specific thesis, while `Work in progress.` remains the shared anchor.

## QA result

Browser-plugin capability was not available, so the documented Playwright MCP fallback was used against `http://127.0.0.1:8793/`.

| Check | Result |
| --- | --- |
| 1920×1080 first viewport | PASS — no horizontal overflow; `qa/final-1920x1080-first.png`. |
| 1440 desktop first/full page | PASS — no horizontal overflow; `qa/final-1440-first.png`, `qa/final-1440-full.png`. |
| 430×932 first/full page | PASS — mobile anatomy reorders metadata → visual → trace; `qa/final-430-first.png`, `qa/final-430-full.png`. |
| 390×844 first/full page | PASS — no horizontal overflow; `qa/final-390-first.png`, `qa/final-390-full.png`. |
| Real image loading | PASS — all nine placed image requests returned successfully and reported non-zero native width. |
| Console / network | PASS — zero console errors/warnings after clean reload; only local candidate resources requested. |
| Desktop interaction | PASS — Pet reached `PAT`, website reached `mobile`, Codex flip toggled; `Space` toggled the focused flip back. |
| Mobile interaction | PASS — all three interactions worked at 390px; no overflow after state changes. |
| Flip count | PASS — exactly one `.flip-shell`, used only by Codex Fix. |
| Reduced motion | PASS by implementation audit — the media query disables all animation/transition and leaves direct state switching available. |
