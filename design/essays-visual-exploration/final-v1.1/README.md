# VDVXDV Essays Final v1.1 Polish

This prototype is a constrained polish of `final-v1`. It changes only Index page identity and shared Essay body typography. Layout anatomy, content fixtures, media composition, Header, Footer, and Production remain frozen.

## Header Differentiation

The Index now groups `ESSAYS`, `随笔`, and the description into one `index-identity` composition aligned with the archive copy rail. The page title uses a distinct 56px display scale and restrained tracking; the description has its own wider literary measure. `07 ENTRIES` remains tiny archive metadata on the far edge. A more deliberate full-width threshold rule, 42px post-rule pause, and 46px first-row inset separate page introduction from archive content without a hero, background box, or heavy line.

## Typography

- Direction: modern, light Chinese serif with near-black ink.
- Stack: `"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif`.
- Desktop body: `300`, `17.5px`, `2.05` line-height, `0.02em` letter-spacing.
- Opening paragraph: `19px / 300 / 2.05`.
- Section heading: `26px / 400 / 1.55`.
- Reading width remains the approved `680px`.
- Paragraph spacing increases slightly to `2.15em`.

Lightness comes from the face and variable-font weight. Body ink stays `#1c1b19`; opacity is not reduced.

## Windows Rendering

The current Windows environment contains `NotoSerifSC-VF.ttf`. Chrome QA verifies the declared `Noto Serif SC` family and variable weights through `document.fonts.check()` and rendered glyph-width comparison against a fallback-only control. Production self-hosting, subsetting, and loading strategy remain out of scope.

## Mobile Adjustment

At 430px and 390px the Page Identity Zone becomes a natural single column. `07 ENTRIES` remains independently anchored at the top edge. Body text uses `17.2px / 350 / 2.05`; section headings use weight `450`. The modest weight increase prevents Light rendering from becoming fragile on small Windows Chrome viewports.

## Known Limitations

- `styles.css` imports the frozen `final-v1/styles.css` and contains only the v1.1 visual delta. This makes the polish easy to audit but means the prototype directories should remain adjacent.
- No font file is copied, downloaded, or committed. A machine without Noto Serif SC uses the documented fallback stack.
- Tonal media blocks remain composition studies rather than final photography.
- No Production migration, font loading strategy, schema decision, or Article prose change is included.
