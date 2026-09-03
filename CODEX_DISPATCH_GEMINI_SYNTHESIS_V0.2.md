# Codex Task — Dispatch VDVXDV Homepage Synthesis v0.2 to Gemini

## Goal

Create ONE new Gemini Canvas design branch:

`VDVXDV Home — Synthesis v0.2`

Do not modify or overwrite Prototype / A / B / C.

This is a convergence task, not another open-ended exploration.

## 1. Inputs

Use the latest available:
- `PRODUCT.md`
- `CONTENT_MODEL.md`
- `DESIGN.md`
- `VDVXDV_HOMEPAGE_SYNTHESIS_V0.2.md`
- the same original reference screenshots used in previous rounds.

Existing Prototype / A / B / C may be used only as comparison references.

Do not expose real name or unrelated account data.

## 2. Preserve previous branches

Before creating the new branch, confirm Prototype / A / B / C remain accessible.

Do not overwrite their Canvas code or screenshots.

If possible, record their Canvas names and share links in notes.

## 3. Send this task to Gemini

Open a NEW Gemini conversation / Canvas and use Gemini Pro with extended thinking if already available.

Upload the current project documents and synthesis brief.

Then send:

---

You are creating `VDVXDV Home — Synthesis v0.2`.

This is NOT another independent style experiment. The exploration phase is finished.

Read:
- PRODUCT.md
- CONTENT_MODEL.md
- DESIGN.md
- VDVXDV_HOMEPAGE_SYNTHESIS_V0.2.md

Treat the synthesis brief as the primary visual convergence document for this round.

### Design hierarchy

Use:
- C as the main layout and section-rhythm foundation;
- B for color-block separation, English typography direction and the preferred compact Liquid Glass navigation;
- the original prototype for thin section divider lines and small editorial section labels;
- A only for specifically useful local composition ideas.

Do NOT simply copy components between versions. Re-design so the final page feels like one system.

### Critical requirements

The homepage must:
- feel calm, clean and relaxing;
- use different compositions for different content sections;
- avoid repeating identical card layouts;
- preserve strong whitespace;
- remain serious but warm;
- feel technical without becoming a SaaS landing page;
- feel authored rather than AI-generated;
- preserve article visual priority;
- preserve project navigation priority.

### Navigation

Use the B direction.

It should:
- be smaller and more compact than earlier versions;
- use restrained Apple-inspired Liquid Glass;
- not dominate the page;
- not extend glass styling into the main body;
- use typography that is slightly technical but still warm.

Avoid extremely thin or heavy text.

### Section structure

Use thin divider lines and small section labels where useful, inspired by the original prototype.

Examples:
- FEATURED / 精选
- PROJECTS / 项目
- PHOTOGRAPHY / 影像

Do not overuse separators.

Use B-style restrained color blocks to distinguish major chapters.

Use C-style varied layout composition inside those chapters.

### Photography

Do not force all photography into one aspect ratio.

Demonstrate a system supporting:
- landscape;
- portrait;
- square;
- mixed aspect ratios.

Do not create a dense masonry feed.

Use few images and generous whitespace.

### Typography

Preserve B's English typography qualities.

Improve Chinese typography.

Do not use tiny gray Chinese text as a shortcut to “premium”.

Do not create a generic huge-brand-name + serif-subtitle + two-pill-button hero.

### Color

Do not retain muted green as the main accent.

Explore a refined palette based on:
- warm ivory / warm white;
- near black;
- soft neutral surfaces;
- one restrained accent such as dark wine, muted copper, deep blue-gray or reddish brown.

Avoid neon, blue-purple AI gradients, high saturation and large glowing surfaces.

### Cards

Reduce card dependency.

Use:
- typography;
- whitespace;
- thin rules;
- large background sections;
- image composition.

Cards should only exist when functionally useful.

### Motion

No signature animation in this version.

Only minimal usability feedback.

No parallax, scroll reveal, Liquid Glass morphing, particles, mouse tracking or 3D.

### Deliverables

Generate:
1. complete desktop homepage;
2. complete mobile homepage;
3. actual Design Tokens used;
4. typography scale;
5. color palette;
6. grid / spacing explanation;
7. navigation specification;
8. photography layout rules;
9. short explanation of how this synthesizes C + B + Prototype + A;
10. short explanation of how AI-template patterns were reduced.

Do not generate other site pages.

---

## 4. Save output

Create:

```text
design/
└── gemini-home-synthesis-v0.2/
    ├── desktop.png
    ├── mobile.png
    ├── source/
    ├── GEMINI_NOTES.md
    ├── TOKENS.md
    └── SYNTHESIS_REVIEW_TEMPLATE.md
```

If an artifact cannot be exported, record that fact instead of fabricating it.

`GEMINI_NOTES.md` should include:
- Gemini model;
- extended thinking status;
- uploaded files;
- Canvas name;
- share link if available;
- whether Prototype / A / B / C remain accessible;
- any Gemini deviations from the brief.

## 5. Create the review template

`SYNTHESIS_REVIEW_TEMPLATE.md`:

```markdown
# VDVXDV Home Synthesis v0.2 — Visual Review

## Overall
- [ ] feels less AI-generated
- [ ] feels coherent rather than collaged
- [ ] serious but warm
- [ ] calm / relaxing
- [ ] personal identity is stronger

## Layout
- [ ] C-style varied section rhythm works
- [ ] no repetitive three-card pattern
- [ ] whitespace feels intentional
- [ ] desktop hierarchy is clear
- [ ] mobile layout is re-composed, not merely shrunk

## Color
- [ ] more refined than v0.1
- [ ] no dull green-dominant palette
- [ ] color blocks improve section rhythm
- [ ] accent color remains restrained

## Navigation
- [ ] B-inspired navigation works
- [ ] Liquid Glass area remains small
- [ ] typography feels technical but approachable
- [ ] navigation does not dominate the page

## Editorial system
- [ ] thin dividers are used well
- [ ] section micro-labels feel refined
- [ ] section labels are not overused

## Typography
- [ ] English typography feels strong
- [ ] Chinese typography feels natural
- [ ] font sizes and weights feel authored
- [ ] no tiny-gray-text premium cliché

## Photography
- [ ] mixed aspect ratios are supported
- [ ] photos are not forced into uniform cards
- [ ] layout remains spacious
- [ ] not a dense masonry gallery

## Next decision
- [ ] approximately 80% visually approved
- [ ] ready to stop broad design exploration
- [ ] remaining issues can be refined after the real site runs
```

## 6. Stop condition

After Synthesis v0.2 is generated and saved:

STOP.

Do not:
- create an Astro project;
- install dependencies;
- deploy;
- create more style variants;
- generate full article or project pages;
- start architecture research automatically.

Report the output locations and wait for visual review.

If the user approves approximately 80% of Synthesis v0.2, the NEXT phase is:

`Production architecture and dependency research before Codex begins formal implementation.`
