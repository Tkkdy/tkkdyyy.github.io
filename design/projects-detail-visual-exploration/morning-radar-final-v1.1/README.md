# Morning Radar Project Detail — Layout & Readability Polish v1.1

## V1.1 SCOPE

This iteration preserves the accepted v1 visual language, content, module set and interactions. It only tunes layout and reading rhythm:

- narrows the desktop content field from `1760px` to `1560px` and increases useful outer gutters;
- turns the module field into a longer, editorial reading sequence instead of a compressed wide dashboard;
- gives Evidence, Architecture, Pipeline and Activity enough width while moving supporting modules into balanced side columns;
- raises real explanatory copy to a readable supporting-text tier while keeping labels and technical metadata restrained;
- uses content-driven module heights, tighter internal grouping and consistent inter-module spacing;
- preserves the existing mobile single-column order and improves compact-screen rhythm.

No project facts, navigation, screenshot-dialog behavior or Production files are changed.

## REFERENCE

Primary visual reference:

`C:\Users\PsyDuck\Desktop\个人网站gpt-for-codex\design\projects-visual-exploration\ChatGPT Image 2026年8月17日 18_05_13.png`

The reference is used for composition, module hierarchy, typography rhythm, border treatment and blue-accent density. Its generated project facts are not reused.

## DESIGN THESIS

Direction C provides the modular Project Archive / Dashboard structure. Selected Direction A ideas add real pipeline, operating principles, notes and activity evidence. The result is one project's technical archive, not a SaaS analytics dashboard.

Design system extracted from the accepted reference:

- cold white `#f7f8fa` page and white modules;
- near-black `#11151b` text, cool gray secondary text;
- electric blue `#315efb` used only for state, links and signal identity;
- zero-radius rectangular modules with one-pixel cool borders;
- CJK Serif for project identity, Sans for reading copy, Mono for system metadata;
- 12-column desktop field with unequal module spans and content-driven heights.

## REFERENCE VISUAL → REAL CONTENT

| Reference role | Real Morning Radar content |
| --- | --- |
| Identity | README and `pyproject.toml` |
| Metadata | clean Git worktree, `pyproject.toml` version `0.1.0`, latest commit `2026-08-17`, confirmed public GitHub remote |
| Daily Brief | real 2026-08-15 static output capture |
| Insight Note | `docs/PRODUCT.md` product principles |
| Architecture | `docs/ARCHITECTURE.md`, package modules and GitHub workflow |
| Tech Stack | `pyproject.toml`, README and workflows |
| Pipeline | `docs/ARCHITECTURE.md` and `src/morning_radar/pipeline.py` responsibilities |
| Current Status | README capabilities, workflow behavior and latest real commit scope |
| Operating Principles | `docs/PRODUCT.md` |
| Related Notes | real repository docs/config paths |
| Recent Activity | local Git log commit date, subject and short hash |

## REAL DATA SOURCES

- `C:\Users\PsyDuck\Documents\Morning Radar v0.1\README.md`
- `C:\Users\PsyDuck\Documents\Morning Radar v0.1\docs\PRODUCT.md`
- `C:\Users\PsyDuck\Documents\Morning Radar v0.1\docs\ARCHITECTURE.md`
- `C:\Users\PsyDuck\Documents\Morning Radar v0.1\docs\SOURCE_GUIDE.md`
- `C:\Users\PsyDuck\Documents\Morning Radar v0.1\pyproject.toml`
- `C:\Users\PsyDuck\Documents\Morning Radar v0.1\.github\workflows\daily-brief.yml`
- Local clean Git history through commit `7e9137c` on `2026-08-17`
- Real brief output and capture for `2026-08-15`

## PROTOTYPE-ONLY

- The signal field is explicitly decorative and `aria-hidden`.
- Static navigation reproduces the current VDVXDV header DNA but does not implement Production Pagefind search.
- The screenshot dialog is a prototype-only inspection aid.
- Disabled header destinations are visual-only; working project navigation never points to a missing detail route.

## KNOWN GAPS

- Public GitHub Pages health and a stable Live URL were not independently verified, so no Live/Demo link is shown.
- The latest committed brief capture remains `2026-08-15`; newer engineering commits are represented only in Recent Activity.
- The prototype does not migrate into `src/**` and does not redesign the current Production detail route.

## QA TARGETS

- Desktop: `1920 × 1080` and `1440px` wide
- Mobile: `430px` and `390px` wide
- Interaction: evidence dialog open, Escape close and trigger-focus return
- Regression: console, failed requests, v1 tree and Production `src/**` tree
