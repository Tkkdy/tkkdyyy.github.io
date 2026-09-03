# Essays — Universe Journal v1.1

## Scope

Prototype-only interaction and icon polish based on `final-universe-journal-candidate`. The overview composition and the archive geometry are inherited without visual redesign; Essay Details remain untouched.

## LIFE STAGE INTERACTION

`原点 / 探索 / 锚定 / 现在` are semantic buttons with `aria-pressed`. Hover/focus previews matching prototype map nodes. Click persists the state; clicking the active stage again restores the neutral map. The archive is intentionally not visually filtered.

## THEME ICON SYSTEM

Inline SVGs use one 0.9px, rounded outline language: sprout (生活), small light (思考), open page (记忆), blocks (城市), eye (观察), and pen (写作). They are decorative to assistive technology and only gain a subtle accent and 1px movement on hover, focus, or active state.

## MARGINAL MARKS

The Life Stage heading has a small compass/coordinate mark: time and orientation. Theme Index has an archival page/index mark: classification and connection. Both are decorative, `aria-hidden`, and are not extra controls.

## STAR MAP RESPONSE

Theme asks a thematic question; Life Stage asks a conceptual time-stage question. Hover is temporary; click persists; the last activated control is the single map state. Related nodes and connections become clearer; unrelated elements only recede and are never removed.

## DATA SAFETY

All stage mappings, theme mappings, star positions, and six additional entries are prototype concepts. They do not describe the author's real biography or dates. Only `初中时，我只是想看 YouTube` (2026-08-01) is currently grounded in a published Essay.

## Responsive and motion

The right marginalia remains touch-friendly on 430px and 390px, with full-width stage/theme buttons. `prefers-reduced-motion: reduce` collapses response transitions to near-instant changes.

## Gemini note

Gemini Canvas was asked to complete this fidelity pass using the previously uploaded approved blueprint, but its second-round Canvas update returned a connection retry state. The local implementation therefore follows the approved blueprint and current candidate directly; no engineering documents or source files were uploaded.
