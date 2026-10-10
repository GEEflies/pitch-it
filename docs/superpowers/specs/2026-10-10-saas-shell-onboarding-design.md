# Unbranded SaaS shell + onboarding quiz (design)

Date: 2026-10-10. Status: approved in chat.

## Goal

Make the app feel like a complete, realistic SaaS product **without branding**. The brand identity, design system, typography and the VLM movement-tracking system arrive later from the team and must plug in at a few known places.

## 1. Neutral theme (brand swap point)

- `src/app/globals.css` `@theme` keeps the existing token names (`ink`, `panel`, `line`, `paper`, `mute`, `faint`, `signal`, `marker`, …) so no component changes are needed. Values become a neutral zinc palette with one placeholder accent (blue-500).
- System font stack (no Google fonts). `type-display` / `type-heading` / `type-investor` stay as semantic classes with neutral values.
- No decorative grain or glow. Hardcoded brand hex values (icons, OG image, field focus ring, button glow, marketing gradients) are neutralised.
- Product name and logo come only from `src/config/site.ts` and `src/components/wordmark.tsx` (a neutral initial-letter placeholder mark).

**Brand handoff:** design team edits `globals.css` tokens, `wordmark.tsx`, `site.ts`, `icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx`, the font import in `app/layout.tsx`.

## 2. App shell

- Sidebar: placeholder mark + name and plan badge; primary "Nový tréning" button; nav; plan/usage card with upgrade link (Free plan); account row (initials avatar, email, settings, sign out).
- Desktop top bar with breadcrumbs derived from the pathname.
- Focus layout (onboarding, live room) has no sidebar.

## 3. Onboarding quiz (`/app/vitaj`)

- Shown on the first visit to `/app` while `profiles.onboarding_completed_at` is null. Skippable ("Preskočiť" sets the timestamp).
- One question per screen, progress bar, tap to answer:
  1. Stage (maps to `STAGES`)
  2. Raise size (range)
  3. Next investor meeting (this week / this month / later / no date)
  4. Biggest worries (multi-select: tough questions, numbers, nerves, story, delivery)
  5. Pitching experience (never / a few times / regularly)
  6. Startup name (creates the first project with that stage; if the plan's project limit is already reached, the existing first project is reused)
- "Pripravujem plán" beat (~2.5 s) that lists what the plan is built from, then a personalised plan screen.
- Plan is a pure function `buildTrainingPlan(answers)` (`src/lib/onboarding/plan.ts`, unit-tested): number of sessions/exercises by meeting date, focus areas from worries, first session's investor / scenario / mode.
- Answers are saved in `profiles.onboarding_answers` (new jsonb column, migration). They also set `user_settings.default_mode` and `coach_focus`.
- Plan CTA: "Začať bezplatný tréning" → `/app/trening/novy?projekt=…&investor=…&scenar=…&rezim=…`. Secondary: upload the deck first. Pro is mentioned softly on the plan screen.

## 4. Dashboard "Začíname" checklist

Steps: profile (quiz), startup, deck, first session, first report. Hidden once all are done.

## 5. Pro upsell after the first report

On the report page, Free-plan users with exactly one completed session see an upgrade card.

## Out of scope (next specs)

- Device check as a separate step before the room.
- Settings split into tabs.
- VLM integration (seam stays `VisionAnalyzer` / `VisionSample`; see `docs/architecture.md`).
