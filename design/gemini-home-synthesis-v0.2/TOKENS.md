# VDVXDV Home Synthesis v0.2 — Prototype Tokens

These values are extracted from the downloaded Gemini Canvas. They document the prototype and are not yet a production token contract.

## Color

| Token | Value | Intended use |
| --- | --- | --- |
| `canvas` | `#F6F4EE` | warm ivory page background |
| `surface-sand` | `#EBE7DE` | oatmeal sandstone and Photography surface |
| `surface-taupe` | `#E5E0D8` | Essays and Fragments block |
| `surface-charcoal` | `#33302B` | warm-charcoal Projects band |
| `surface-project` | `#1C1B19` | deeper warm technology-black Projects band in v0.2.6 |
| `ink` | `#1C1B1A` | primary warm ink |
| `ink-soft` | `#4A4844` | body copy |
| `ink-muted` | `#7A766F` | metadata and micro-labels |
| `ink-inverse` | `#F8F6F0` | text on warm charcoal |
| `accent` | `#7A3F46` | restrained burgundy interaction accent |
| `border` | `rgba(28, 27, 26, 0.12)` | standard hairline |
| `border-strong` | `rgba(28, 27, 26, 0.28)` | stronger divider |

## Typography

| Role | Stack | Weights seen |
| --- | --- | --- |
| Sans | `Inter`, `SF Pro Display`, `system-ui`, `sans-serif` | 400, 450, 500 |
| Chinese/editorial serif | `Noto Serif SC`, `Source Han Serif SC`, `serif` | 400, 500, 700 |
| Mono/meta | `JetBrains Mono`, `monospace` | 400, 500 |

- Hero: `2.25rem` mobile, `3rem` from the medium breakpoint; serif, medium weight, tight leading.
- Featured title: `1.5rem`; serif, medium weight.
- Project title: `1.875rem` mobile, `2.25rem` from the medium breakpoint.
- Body copy: mostly `15px–16px` with relaxed line-height.
- Micro-labels and metadata: `11px–13px`, often mono with restrained tracking.

## Layout

| Token | Value |
| --- | --- |
| Page maximum | `1440px` |
| Content maximum | `1120px` |
| Mobile side padding | `24px` |
| Small-screen side padding | `32px` |
| Main desktop grid | 12 columns |
| Hero split | 5 / 7 columns at `lg` |

The prototype uses Tailwind's default responsive thresholds: `sm 640px`, `md 768px`, and `lg 1024px`.

## Navigation / Liquid Glass

| Property | Value |
| --- | --- |
| Background | `rgba(246, 244, 238, 0.65)` |
| Backdrop | `blur(24px) saturate(180%)` |
| Border | `1px solid rgba(255, 255, 255, 0.60)` |
| Inner highlight | `inset 0 1px 1px rgba(255, 255, 255, 0.90)` |
| Outer shadows | `0 8px 32px -4px rgba(28,27,26,.08)`, `0 4px 12px -4px rgba(28,27,26,.04)` |
| Shape | compact content-width pill (`rounded-full`, `max-w-fit`) |
| Position | fixed, horizontally centered, `20px` from top |
| Inner spacing | `20px` horizontal, `10px` vertical |

On mobile, the navigation intentionally collapses to the VDVXDV wordmark and search action so the glass area stays small.

## Surface and image behavior

- Placeholders use neutral CSS surfaces rather than network images.
- Light placeholder: `rgba(28, 27, 26, 0.04)` with a `0.08` alpha solid border.
- Dark placeholder: `rgba(248, 246, 240, 0.03)` with a `0.10` alpha solid border.
- Photography supports mixed `4:3`, `3:4`, and `1:1` aspect ratios.
- Hover motion uses `500ms ease` on placeholder surfaces.

## Section identity and fragments

- First viewport / Featured Article: open 5/7-column editorial composition on the base canvas, restoring the v0.2.1 intro-left / featured-right hierarchy.
- Projects: full-width `surface-project` band using one dominant real project and two compact inactive structural rows.
- Essays / Fragments: square-edged `surface-taupe` band; the Fragments column keeps its offset, left boundary and top displacement on desktop.
- Photography: independent `surface-sand` visual-flow container and the only rounded content section, using `1rem` (`rounded-2xl`) corners.
- Fragment stack: one real item followed by two visibly inactive structural slots; indentation progresses through `0`, `2rem–4rem`, and `0.75rem–1.5rem`, with separate vertical rules and declining opacity.
- Mobile preserves the section surfaces and turns the content into a deliberate vertical sequence rather than a scaled desktop grid.

## Corner policy

- Navigation: `rounded-full` because it is a compact Liquid Glass control.
- Photography section: `1rem`; the sole rounded content block.
- Media placeholders: approximately `2px` (`rounded-sm`), visually near-square.
- Featured, Projects, Essays / Fragments and their large containers: square edges.
- Status and technology labels: square outlines or plain text; no pill badges.

## Rhythm

- Major section vertical padding: `96px` mobile and `128px` from `md`.
- Hero top padding: `160px` mobile and `192px` from `md`.
- Section headers use a thin top divider, mono uppercase label, and generous space below.
- The project band uses a full-width dark color block to break the editorial rhythm without introducing a card grid.

## Project hierarchy

- `Morning Radar` is the only dominant project: desktop uses a large near-square interface placeholder beside the information column; mobile stacks the visual above the information.
- The main project occupies the clear majority of the section. Two `Project Slot Pending` structures share a compact secondary area below it and carry no invented content.
- Authorized project metadata is shown as `Developing / 开发中`, `Python` and `LLM`.
- Project CTA default: transparent background, `ink-inverse` text and `rgba(248, 246, 240, 0.30)` border.
- Project CTA active state: `accent` (`#7A3F46`) background and border with `ink-inverse` text.
- Project surfaces retain near-square edges; the hierarchy is expressed through area, contrast and spacing rather than rounded cards.

## Microinteractions

| Interaction | Default | Active state | Timing |
| --- | --- | --- | --- |
| Essays visual tilt | `rotate(-1.5deg)` | `rotate(0)` on hover / focus-within | `500ms cubic-bezier(0.25, 1, 0.5, 1)` |
| Photography square tilt | `rotate(1deg)` | `rotate(0)` on hover / focus-within | `500ms cubic-bezier(0.25, 1, 0.5, 1)` |
| Featured and Photography inner zoom | `scale(1)` | `scale(1.04)` on hover / focus-within | `650ms cubic-bezier(0.25, 1, 0.5, 1)` |
| Project CTA | light `canvas` / dark text | `surface-charcoal` / `ink-inverse` | `200ms` color transition |

- Decorative tilt is limited to `(hover: hover) and (pointer: fine)`, so touch-first devices retain a stable, upright layout.
- Zoom is applied to an inner layer inside a fixed-size `overflow: hidden` frame; it must not affect layout dimensions.
- The project CTA keeps near-square `2px` corners and supports `focus-visible` as well as hover.
- Under `prefers-reduced-motion: reduce`, transforms return to their neutral state and decorative transitions are disabled.
