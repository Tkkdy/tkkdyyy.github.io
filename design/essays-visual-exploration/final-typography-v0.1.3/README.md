# Essays Typography v0.1.3

## ACTUAL CURRENT FONT

Windows Chrome platform-font inspection found the approved Index, Text Detail and Image Detail all render Chinese serif as `STSong` 400. The declared `Songti SC` is not the actual rendered system font. Mono metadata resolves mainly to Consolas, with NSimSun for Chinese glyph fallback.

## CANDIDATES

1. STSong 400 — current rendering; delicate but less controlled at 1080p.
2. Noto Serif SC 400 — installed and genuinely rendered; selected for long-form prose.
3. Noto Serif SC 500 — installed and genuinely rendered; selected for display titles and H2 only.

## SELECTED SYSTEM

`"Noto Serif CJK SC", "Noto Serif SC", "Songti SC", STSong, Georgia, serif`. It gives a more even modern Chinese texture on this Windows Chrome environment without making the reading colour pale.

## BODY / DISPLAY / MICRO UI

Body uses Noto 400 at the inherited 18px desktop / 17px mobile, adjusted only to 2.02–2.04 leading. Display titles and H2 use 500. Mono metadata, Star Map labels, Life Stage and Theme Index retain the existing mono/system strategy.

## WINDOWS 1080P / MOBILE

At 1920×1080 / 100%, Noto 400 shows cleaner edge continuity than STSong, while 500 makes large titles more stable. At 430px and 390px the body remains 17px with slightly more leading; no layout geometry changes are introduced.

## LICENSING

This prototype uses only fonts installed in the current environment. Future production should self-host an OFL-licensed Noto Serif CJK SC subset after recording exact weight files and payload; no font files were downloaded or copied.
