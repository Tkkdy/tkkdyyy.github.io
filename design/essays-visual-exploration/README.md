# VDVXDV Essays Visual Exploration

Phase 1–3 visual prototypes for `/essays/` and `/essays/[slug]/`.

These artifacts are intentionally isolated from Production. They do not modify `src/**`, the content schema, Homepage, Articles, Projects, Header, Footer, Search, RSS, Pagefind, or shared production styles.

Open [`comparison/index.html`](comparison/index.html) first.

## Page Intent

Essays is a slower, more personal long-form space for lived experience, observation, memory, and thoughts that do not need to arrive at a conclusion. It should feel more lived-in than Articles, not less designed.

## Direction A thesis — Editorial Gallery

A representative essay receives a strong editorial entrance, followed by a text-led feature and a quieter chronological archive.

- **Index:** A visible title-and-image opening, large no-cover typography, portrait contrast, then a low-volume archive.
- **Detail:** Cinematic wide lead media and a centered reading order. Images create large, deliberate pauses around a stable prose column.
- **Strongest point:** Strongest first impression and clearest continuation of Homepage's prominent Essay visual.
- **Tradeoff:** Requires careful curation so consecutive image-heavy essays do not make the page feel too formal or heavy.

## Direction B thesis — Quiet Journal

Text-only is the default rather than a fallback. Dates live in a precise gutter and optional images behave like small private glimpses.

- **Index:** A calm single chronological column with optional, deliberately modest media.
- **Detail:** The narrowest and most intimate reading system; images stay close to the text rather than becoming heroes.
- **Strongest point:** Most naturally handles no cover, no summary, and long archives.
- **Tradeoff:** Has less portfolio-like visual impact for visitors expecting photography to dominate.

## Direction C thesis — Staggered Canvas

Text and photography act as equal elements on an explicit twelve-column canvas. Staggering is determined by content state, never random Masonry.

- **Index:** Landscape, portrait, square, and no-cover entries occupy defined grid positions and different spans.
- **Detail:** An asymmetric split header, early two-image opening, offset figures, and side observations around a stable reading column.
- **Strongest point:** Most expressive handling of unpredictable mixtures of image-heavy and text-only essays.
- **Tradeoff:** Strict chronology is less immediately scannable than Direction B.

## How each differs from Articles

- **A** replaces the repeated archive rhythm with curated editorial scale and media-led pauses.
- **B** uses a personal journal cadence, minimal metadata, and intimate image insets instead of formal publication structure.
- **C** gives images and text independent positions while preserving a calm central reading column.

None of the three uses an Article TOC, Article metadata density, or the shared Production `.prose` implementation. Any future migration should introduce an Essay-specific prose extension rather than changing frozen Article behavior.

## Homepage DNA preserved

- Warm neutral paper and near-black ink.
- Serif-led titles with restrained mono dates.
- Photography or atmosphere as part of expression, not ecommerce thumbnails.
- Small irregularities and editorial proportion.
- Minimal motion and no card wall.

The Index pages do not repeat the Homepage Essay card. Homepage remains a curated entrance; these prototypes are durable content spaces.

## Prototype Fixture policy

All content outside the existing title, summary, and date is prototype-only. No fixture is written to `src/content/essays/**`.

Fixtures cover:

- Existing real title, summary, and date.
- Long Chinese title.
- Landscape, portrait, square, normal, and wide media.
- Cover and no-cover entries.
- Summary and no-summary entries.
- Tags and no-tags entries.
- Seven-entry archive rhythm.
- Image-rich and explicitly text-only detail pages.

The current Production Essay body is a Development Fixture and was not treated as evidence of the user's real writing structure.

## Cover / no-cover handling

- **A:** No-cover content receives typographic scale and spatial tension.
- **B:** No-cover is the natural default row anatomy.
- **C:** No-cover becomes an open typographic grid composition without a fake image or card container.

## Detail media behavior

Each `detail.html` demonstrates normal, wide, portrait, and two-image compositions with readable captions. Each `detail-text-only.html` verifies that the reading system remains complete without images.

The tonal blocks are composition studies, not suggestions for final photography or gray placeholders for missing covers.

## Mobile behavior

- Breakpoint: approximately 760–820px depending on direction.
- Tested target sizes: 430px and 390px, with 360px as an additional overflow check.
- A reorders the featured image after its title and reduces editorial asymmetry.
- B moves dates above titles and turns optional imagery into a small right-aligned glimpse.
- C collapses explicit grid positions into a single sequence while preserving different image ratios and alternating widths.

## Interaction behavior

- Real links are used for every Essay entry.
- Visible focus outlines are shared across links and controls.
- A quiet image scale and title underline provide optional hover/focus feedback.
- No information depends on hover.
- `prefers-reduced-motion` removes non-essential transitions.

No JavaScript is needed by the direction prototypes.

## Known limitations

- Tonal CSS media blocks test composition only; they are not final photography.
- System font fallbacks are used so prototypes have no external font or asset dependency. Exact Production font rendering may differ slightly.
- Header and Footer are simplified simulations of frozen Production components; their redesign is explicitly out of scope.
- Prototype copy beyond the existing Essay title/summary/date is fictional and must not migrate into Production automatically.

## Artifacts

```text
direction-a/  Editorial Gallery index + image-rich/text-only detail
direction-b/  Quiet Journal index + image-rich/text-only detail
direction-c/  Staggered Canvas index + image-rich/text-only detail
comparison/   Direction switchboard and summaries
gemini-source/ Gemini 3.1 Pro Extended Thinking + Canvas source captures
shared.css    Prototype-only shared baseline
```
