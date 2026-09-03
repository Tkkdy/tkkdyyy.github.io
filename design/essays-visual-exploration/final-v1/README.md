# VDVXDV Essays Final v1

Prototype-only synthesis for `/essays/` and two content-driven `/essays/[slug]/` states. This directory is isolated from Production.

## Final Thesis

Essays are quiet at the archive level and adaptive at the reading level. The Index behaves like a wide, calm journal; individual Essays then let text or photography determine their natural anatomy without changing the VDVXDV identity.

## Index — why B

Direction B remains the absolute base: chronological single-column order, a date gutter, serif titles, restrained metadata, fine rules, optional small visuals, and no featured card or gallery behavior. Text-only is the normal state rather than a fallback.

## Index Width Changes

At desktop widths the Index uses a `1240px` maximum rail. The intro rule, archive rules, date gutter, copy rail, and optional-media rail share that boundary. Rows use a `156px / flexible copy / 180px` anatomy with `42px` gaps. Typography stays close to Direction B; the composition—not font size or padding—does the widening.

## Text-led Detail — why A

The text-only page keeps Direction A's large title, strong opening whitespace, centered controlled composition, quiet metadata, narrow reading width, and loose section rhythm. It contains no image, media placeholder, decorative geometry, or reserved image slot.

## Image-led Detail — why C

The image-rich page keeps Direction C's split title/meta opening, portrait–landscape contrast, wide breakout, offset figures, unequal media proportions, and image-led pauses. Prose repeatedly returns to the same stable reading column so the page remains an Essay rather than a gallery.

## Shared Visual Language

Both Detail states share the same warm paper, near-black ink, serif/sans/mono stacks, paragraph measure, metadata, rules, captions, Header, Footer, focus treatment, and spacing scale. The difference is media presence, not branding.

## Mobile Recomposition

At `820px` and below, the widened Index becomes one column while dates remain above titles and optional media stays modest and right aligned. Text Detail becomes left aligned with `17px` body copy. Image Detail removes desktop offsets, then preserves rhythm through a narrow portrait, a wider landscape, a near-full-bleed pause, and unequal stacked media widths.

## Content-state Logic

This prototype proves two semantic wrappers: text-led and image-led. It does not propose a Production schema field or layout engine. A future mapping should infer or deliberately select anatomy only after visual approval.

## Interaction

All navigation and Essay entries are real links. Hover/focus gently underlines titles and straightens/scales optional media. Visible focus never depends on hover, and reduced-motion preferences shorten all transitions.

## Prototype Fixtures

Only the existing Essay title, summary, and date are treated as real content signals. All other archive entries, body copy, media captions, and tonal composition-study blocks are prototype-only and must not migrate into `src/content/essays/**` automatically.

## Known Limitations

- Tonal CSS media blocks validate placement and ratio, not final photography.
- System font stacks avoid external dependencies; exact Production rendering may differ.
- Header and Footer are frozen simulations, not redesign proposals.
- No Production schema, Astro layout, shared prose, Homepage, Article, Project, Search, RSS, or content file is changed.
