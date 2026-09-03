# VDVXDV Essays Final v0.1.2 Candidate

This directory is a narrow structural revision of the frozen `final-v1` prototype. It does not reopen visual exploration and does not modify Production.

## Baseline

- Index remains Direction B: quiet chronological archive, left date rail, optional small media, no card wall.
- Text-only Detail remains Direction A: large title, centered restraint, narrow prose, no images.
- Image-rich Detail remains Direction C: asymmetric media, varied ratios, and image-led pauses.

`styles.css` imports the adjacent frozen `final-v1/styles.css` and contains only the v0.1.2 structural delta.

## Index Page Identity

The page introduction is now one left-aligned identity composition rather than the same three-column anatomy as an Essay row. The title is slightly larger and heavier, while `07 entries` becomes a distinct two-part archive counter. A stronger lower rule and deliberate pause separate the explanation of the section from the chronological archive.

## Text-only Editorial Emphasis

One semantic `blockquote` restores the earlier Direction A emphasis sentence. It uses only a restrained left rule, modest scale change, and extra vertical breathing room. There is no quote card, background panel, oversized punctuation, or repeated emphasis pattern.

## Image-rich Opening Rhythm

The single Essay article now begins with two prose paragraphs before the portrait-and-landscape opening composition. The first image group therefore acts as the first narrative pause instead of an immediate gallery-like display.

## Image-rich Reading Width

Only Image-rich prose widens from the Final v1 reading measure to `740px`. Text-only prose keeps the frozen narrow measure. Existing normal, wide, portrait, and two-image offsets remain unchanged so the revision does not become a new visual direction.

## Mobile Recomposition

At 430px and 390px, Page Identity stacks naturally while the counter stays independently anchored. The pull quote reduces its inset and scale. Image-rich pages retain the order `title → introductory prose → portrait → landscape → body`, with the existing single-column media rhythm and no horizontal overflow.

## Typography Deferred

Chinese body font selection, global type scale, Windows 1080p rendering, antialiasing, and broader typography system changes are explicitly deferred to v0.1.3. This candidate changes only the Index page-title size/weight needed for structural hierarchy.

## Browser QA

Playwright dedicated Chrome verified Index, Text-only Detail, and Image-rich Detail at `1440`, `430`, and `390` CSS pixels. All nine states have no horizontal overflow, no console errors or warnings, and no failed requests. Keyboard focus, reduced-motion behavior, semantic blockquote anatomy, link navigation, and the Image Detail DOM order were also checked.

## Prototype Boundary

All archive entries, body copy, captions, and tonal media blocks remain prototype-only fixtures. Nothing in this directory should migrate automatically into `src/content/essays/**` or shared Article prose.
