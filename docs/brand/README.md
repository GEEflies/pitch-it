# PitchIt brand guidelines

Source: the design canvas "PitchIt – Landing Page" (claude.ai/artifact/3x98z5q84WCB6ARWcGZkHs, version `1791634982-365a`). It has 16 artboards: landing, sign in, sign up, onboarding, recording, recording with camera, feedback and mentor dashboard, each in dark and light ("Svetlý"). All values below come from those files. Ready-to-use variables are in [`tokens.css`](tokens.css).

**Dark is the primary theme.** Light is a full variant, not an afterthought.

---

## 1. Name and logo

- **Name:** `PitchIt`, one word, capital P and capital I. The wordmark splits it in colour: **Pitch** in text colour, **It** in accent.
- **Wordmark:** Outfit 700, 26 px, letter-spacing −0.03em.
  - Dark: `Pitch` #F5F5F7, `It` #AAFF00
  - Light: `Pitch` #15151A, `It` #3F8A00
- **Mark:** three shapes forming a stylised "P": a curved top bar, a stem and a small triangle. It sits left of the wordmark, 26×36 px, with a 10 px gap. Files: [`logo-mark-dark.svg`](logo-mark-dark.svg) and [`logo-mark-light.svg`](logo-mark-light.svg).

| Shape | On dark | On light |
|---|---|---|
| Top bar | #AAFF00 | #4C9A00 |
| Stem | #7AB800 | #3A7A00 |
| Triangle | #D2FF6B | #6BBF00 |

- **Tagline (landing title):** "PitchIt – AI kouč pitchu pre zakladateľov".
- Don't recolour the mark outside these two sets, put it on the lime gradient, or set the wordmark in any other font.

## 2. Colour

### Brand

| Token | Hex | Use |
|---|---|---|
| Lime | **#AAFF00** | The signature colour: primary buttons, eyebrows, active states, live dots, "It" |
| Lime light | #D2FF6B | Start of the primary gradient, highlights |
| Lime deep | #7AB800 | End of the primary gradient, logo stem |
| Violet | **#7D51FE** | Secondary accent, used mostly as background glow and in the mentor/AI context |
| Violet light | #B9A2FF | Violet text and icons on dark |

**Primary gradient:** `linear-gradient(135deg, #D2FF6B, #AAFF00 55%, #7AB800)`, always with dark text #141414.

### Dark theme (primary)

| Role | Hex |
|---|---|
| Background | #141414 |
| Card | gradient 160° #222228 → #1A1A1F |
| Input / flat surface | #1E1E22 |
| Sunken | #0B0B0E |
| Border | #333333 |
| Border strong (outline buttons, chips, inputs) | #4A4A52 |
| Text | #F5F5F7 |
| Text soft (chips) | #DEDEE6 |
| Text muted | #B4B4BE |
| Placeholder | #7A7A86 |

### Light theme ("Svetlý")

| Role | Hex |
|---|---|
| Background | #F5F5F1 (warm off-white) |
| Card | #FFFFFF |
| Sunken | #ECECE6 / #F0F0EA |
| Border | #DCDCD5 |
| Border strong | #8A8A82 |
| Text | #15151A |
| Text soft | #2E2E38 |
| Text muted | #54545E |
| Accent as text | **#2F6B00** (eyebrows, links); other greens #4C9A00, #3A7A00 |

**Rule:** lime #AAFF00 is never used as text on light backgrounds because it fails contrast. Use #2F6B00 instead. Lime fills (buttons, dots, bars) are fine.

### Status

| Meaning | Dark | Light |
|---|---|---|
| Warning, "zaváhanie" (hesitation) | #FFC94D | #8A5A00 (text), #C98A00 |
| Attention, filler words | #FF7A59 | #E5522B |
| Error / recording | #FF5C5C, #FF4D4D | #B4361A |
| Good, "v cieli" (on target) | Lime #AAFF00 | #2F6B00 on #EAF6D3 |

### Background glow

Every screen sits on the base colour with two soft radial glows: violet top-right and lime top-left.

```
dark:  radial-gradient(900px 600px at 90% 0, rgba(125,81,254,.38), transparent 60%),
       radial-gradient(700px 500px at 0 20%, rgba(170,255,0,.10), transparent 60%), #141414
light: same shapes at rgba(125,81,254,.13) and rgba(170,255,0,.22) over #F5F5F1
```

## 3. Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Headings, numbers, scores | **Bricolage Grotesque** | 700 (500 secondary) | letter-spacing −0.02em (large display −0.03em), line-height 1.04–1.1 |
| Body, UI, buttons, inputs | **DM Sans** | 400 / 500 / 700 | line-height 1.55 |
| Wordmark only | **Outfit** | 700 | Never for anything else |

Google Fonts URL used in the designs:
`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700&family=DM+Sans:wght@400;500;700&family=Outfit:wght@700&display=swap`

**Scale (px):** 48 / 44 (display), 36 / 30 / 26 / 24 (headings), 18 / 17 / 16 / 15 (body; 15 is the default UI size), 14 / 13 / 12 / 11 (small, labels, meta).

**Eyebrow:** 13 px, DM Sans 700, uppercase, letter-spacing 0.12em, accent colour (lime on dark, #2F6B00 on light). Example: "Nacvič · Získaj feedback · Zlepši sa".

Headings end with a full stop: "Vytvor si účet.", "Tri kroky k lepšiemu pitchu.", "Tvoj feedback je hotový."

## 4. Shape, spacing, depth

- **Radii:** pills 999 px (all buttons, chips, segmented controls) · cards 20 px · inputs 12 px · large panels 14–16 px · hero and device frames 28 px · progress bars and score bars 2–4 px · avatars and dots 50%.
- **Spacing:** 4 px base. Common gaps: 8, 10, 12, 16, 20, 32, 64. Content width 1200 px with 24 px side padding. Section padding 88 px vertically on the landing page.
- **Shadows (dark):** card `0 22px 50px rgba(0,0,0,.5)`; hero `0 40px 100px rgba(0,0,0,.6)`; violet glow `0 30px 90px rgba(125,81,254,.22)`; live dot `0 0 12px #AAFF00`.
- **Shadows (light):** soft blue-grey `0 18px 40px rgba(30,30,70,.14)` and `0 30px 80px rgba(30,30,70,.14)`.
- **Focus ring:** `0 0 0 3px rgba(170,255,0,.18)` on inputs.

## 5. Components

- **Primary button:** pill, min-height 46 px, padding 13×22, DM Sans 700 15 px, primary gradient, text #141414, 1 px border #AAFF00 (light: #5E9E00). Hover: lifts 2 px and brightens (`brightness(1.08)`).
- **Secondary button:** same shape, transparent, 1 px border #4A4A52 (light #8A8A82), text colour. Hover: lifts 2 px.
- **Card:** 20 px radius, 24 px padding, 1 px border #333333, gradient 160° #222228 → #1A1A1F (light: white with border #DCDCD5).
- **Chip:** pill, padding 7×14, 13 px, 1 px border #4A4A52, text #DEDEE6.
- **Input:** min-height 46 px, padding 13×16, 12 px radius, background #1E1E22, border #4A4A52, label 14 px 700 above with 8 px gap. Focus: lime ring.
- **Score bar:** 8 px high, 4 px radius, track #333333, fill in the status colour.
- **Live/recording dot:** lime with a pulsing glow (`0 0 0 7px` fading ring).
- **Decorative glyph:** "✦" is used as a separator in the scrolling marquee (Tempo ✦ Pauzy ✦ Vypĺňacie slová ✦ Obsah ✦ Reč tela ✦ Sebavedomie).
- **Icons:** simple stroke icons, inline SVG, no emoji.

## 6. Motion

- **Easing:** `cubic-bezier(.2,.7,.2,1)` for everything that enters or lifts.
- **Enter:** fade-up 0.9 s from 24 px below, staggered by 0.12 s.
- **Hover:** buttons lift 2 px; cards lift 8 px and their border brightens to #4A4A52.
- **Ambient:** slow bob (7 s, 10 px), breathing glow (8 s), pulsing live dots (2.4–3 s), marquee (38 s, pauses on hover), scroll-linked reveals where supported.
- **Always** switch these off under `prefers-reduced-motion: reduce`. The designs do this everywhere.

## 7. Voice and copy

- **Language:** Slovak, informal "ty", warm and coaching, never scolding.
- **Short imperatives:** "Nacvič. Získaj feedback. Zlepši sa.", "Začať trénovať →", "Skús znova", "Pošli mentorovi".
- **Headlines are short statements with a full stop:** "Zmeň svoje nápady na sebavedomý pitch."
- **Feedback explains and reassures:** "Dlhá pauza nemusí byť chyba. Rozhoduje, kde je." / "Tempo máš v cieľovom okne. Pri čísle o trhu spomaľ, aby ho investor stihol zachytiť."
- **Concrete metrics with units:** "slabiky za sekundu", "pauzy nad 1 sekundu, najdlhšia 2,4 s", "za 60 sekúnd".
- **Placeholders for unknown numbers:** `[X]`. Never invent statistics.
- **Privacy said plainly:** "Moje nahrávky sa nikdy nezdieľajú bez môjho súhlasu."

---

## Differences from the current codebase

Things the team should decide before the brand goes into the app:

1. **Name:** the design uses `PitchIt`; the code uses `Pitch It` (`src/config/site.ts` and copy in `src/content`, legal pages and the marketing sections).
2. **Product shape:** the designs show a recorded-pitch coach (record 30 s to 3 min → analysis of tempo, pauses, filler words, content and body language → feedback, plus a mentor dashboard and an organiser role). The current app is a live voice conversation with a simulated investor, followed by a report. The design's onboarding has 3 questions (who you pitch to, length, what to show first) plus optional pitch notes; ours has 6.
3. **Applying it:** values map onto the existing token names in `src/app/globals.css` (`ink` → #141414, `panel` → card colours, `line` → #333333, `paper` → #F5F5F7, `mute` → #B4B4BE, `signal` → #AAFF00 with dark text, `marker` → #FFC94D, `coral` → #FF7A59). Fonts go in `src/app/layout.tsx`, the logo in `src/components/wordmark.tsx`, and buttons become pills in `src/components/ui/button.ts`.
