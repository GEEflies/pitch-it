# Pitch It

> Vzniklo na **Startup Weekend Žilina 2026** 🇸🇰

Tréning investorských stretnutí. Founder nahrá podklady startupu, vyberie investora a scenár a naživo sa rozpráva s AI investorom (hlas, voliteľne kamera). Po tréningu dostane rozbor obsahu, prednesu a neverbálnych signálov a cvičenia na slabé miesta.

```
Profil startupu → podklady → nastavenie tréningu → živý rozhovor → report → cvičenia → nový pokus → porovnanie
```

Stack: Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4, Motion, Upstash Redis (dáta, súbory) s vlastným prihlasovaním cez podpísanú cookie, Claude (Anthropic) a OpenAI Realtime za vymeniteľnými rozhraniami, MediaPipe vo Web Workeri.

Architektúra: [docs/architecture.md](docs/architecture.md). Rozhodnutia: [docs/decision-log.md](docs/decision-log.md). AI poskytovatelia: [docs/ai-providers.md](docs/ai-providers.md). Právo a súkromie: [docs/legal-privacy-checklist.md](docs/legal-privacy-checklist.md).

## Rýchly štart

```bash
npm install                 # postinstall pripraví súbory MediaPipe do public/mediapipe
cp .env.example .env.local  # doplň hodnoty
npm run dev                 # http://localhost:3000
```

Bez kľúčov aplikácia beží, ale povie, čo nefunguje. Nikdy nepredstiera výsledok:

| Chýba | Čo sa stane |
|---|---|
| Redis (`KV_REST_API_*`) | Lokálne sa dáta ukladajú do `.data/store.json`; v produkcii iba do pamäte (stratia sa) |
| `AUTH_SECRET` (produkcia) | Prihlásenie a registrácia ukážu „Účty momentálne nefungujú“, `/app` presmeruje na prihlásenie |
| `OPENAI_API_KEY` | Hlasový režim nie je dostupný, tréning ide textom (ak je Anthropic) |
| `ANTHROPIC_API_KEY` | Report obsahuje iba objektívne merania (stav „Iba merania“), podklady sa prečítajú bez AI návrhov faktov, textový režim a nápoveda nie sú dostupné |
| Stripe | Cenník funguje, tlačidlo platby oznámi, že platby nie sú zapnuté |

## Nastavenie úložiska a prihlasovania

1. **Vercel → Storage → Upstash Redis** (región EÚ, napríklad Frankfurt). Integrácia doplní `KV_REST_API_URL` a `KV_REST_API_TOKEN`.
2. Nastav `AUTH_SECRET` (`openssl rand -base64 32`). Podpisuje cookie relácie, odkazy na nové heslo a nahrávanie súborov.
3. Voliteľne `RESEND_API_KEY` a `EMAIL_FROM` pre e-mail s novým heslom. Bez nich sa odkaz vypíše do logu servera.
4. Voliteľne Google a LinkedIn (`GOOGLE_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`), redirect URI `<SITE_URL>/auth/callback/google` a `…/linkedin`.

Tabuľky, predvolené hodnoty, väzby a pravidlá prístupu sú v `src/lib/store/schema.ts`. Dotazy majú rovnaký tvar ako predtým (`from().select().eq()`), takže `src/lib/db/**` sa nemenil. Podklady sa ukladajú do Redisu po 2 MB kúskoch (limit požiadavky na Verceli je 4,5 MB).

## Nastavenie AI

- **Anthropic:** `ANTHROPIC_API_KEY`. Predvolený model je `claude-opus-5-5` so štruktúrovaným výstupom a server-side fallbackom pri odmietnutí (`fallbacks: "default"`).
- **OpenAI Realtime:** `OPENAI_API_KEY`. Predvolené sú `gpt-realtime-2.1`, prepis `gpt-4o-transcribe` a hlas podľa štýlu investora. Prehliadač dostane iba krátkodobý token `ek_…` (120 s) na nadviazanie WebRTC spojenia. API kľúč server neopustí.

Detaily, ceny a výmena poskytovateľa sú v [docs/ai-providers.md](docs/ai-providers.md).

## Platby (Stripe, voliteľné)

1. Vytvor produkt Pro s mesačnou cenou a ulož jej ID do `STRIPE_PRICE_ID_PRO`.
2. Webhook na `<SITE_URL>/api/billing/webhook` s udalosťami `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` a `customer.subscription.deleted`. Podpisové tajomstvo ulož do `STRIPE_WEBHOOK_SECRET`.
3. Zapni Customer Portal (správa a zrušenie predplatného).

Limity plánov sú v `src/lib/billing/plans.ts`. Cena Pro (29 €) je hypotéza na overenie, pozri decision log D8.

## Príkazy

| Príkaz | Čo robí |
|---|---|
| `npm run dev` | vývojový server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit testy vrátane úložiska a pravidiel prístupu (`node --test`) |
| `npm run build` | produkčný build |
| `npm run check` | všetko vyššie naraz |
| `npm run mediapipe` | znova pripraví WASM a modely MediaPipe do `public/mediapipe` |

## Čo je kde

```
src/
  app/
    page.tsx, cennik/, podmienky/, ochrana-osobnych-udajov/   verejná časť
    (auth)/                                                    prihlásenie, registrácia, heslo
    auth/confirm/                                              potvrdenie odkazov z e-mailu
    app/(shell)/                                               dashboard, projekty, tréning, report, cvičenia, história, nastavenia
    app/(focus)/miestnost/[sessionId]                          živá tréningová miestnosť
    api/                                                       relácie, podklady, cvičenia, platby, export
  components/                                                  UI (session/, report/, projects/, charts/, …)
  lib/
    ai/llm, ai/realtime, ai/transcription                      poskytovatelia za rozhraniami
    investor/                                                  štýly, scenáre, inštrukcie, nápoveda, textový investor
    session/                                                   stavový automat, kontrolér, fronta ukladania, serverová logika
    analytics/speech, analytics/audio, analytics/vision        merania (čisté funkcie) + AudioWorklet + MediaPipe worker
    reports/                                                   merania, pravidlá prednesu, AI hodnotenie, generovanie
    documents/                                                 kontrola súboru, PDF/PPTX extrakcia, AI analýza
    exercises/, history/, billing/, privacy/, events/, db/, store/
public/worklets/voice-analyzer.js                              analýza hlasu v audio vlákne
tests/                                                         unit testy (tests/store.test.ts: úložisko a prístup)
```

## Testy

`npm test` spustí 94 testov:

- **Úložisko a práva:** predvolené hodnoty, filtre, unikátnosť, pravidlá prístupu, kaskádové mazanie, heslá a podpísané tokeny.
- **Logika:** merania reči a hlasu, stavový automat relácie vrátane výpadku a obnovy, normalizácia realtime udalostí, výpočet reportu a overovanie citácií, porovnanie tréningov, limity plánov, podpis Stripe webhooku, kontrola a extrakcia PPTX, inštrukcie investora (zdroje faktov, prompt injection), odporúčanie na dashboarde, upozornenia trénera, fronta ukladania, signály z kamery a validácia vstupov.

Čo testy nepokrývajú a treba overiť ručne so skutočnými kľúčmi je v časti Obmedzenia.

## Obmedzenia a známe medzery

- **Neoverené end-to-end so skutočnými službami.** Na vývojovom stroji nebol Redis ani API kľúče. Realtime hovor, upload do Redisu, e-maily a Stripe treba otestovať na staging projekte.
- **Kvalita slovenčiny** v realtime hlase a prepise nie je overená (UNKNOWN). Návrh testu je v decision logu D2.
- **AI prerušenie foundera** používa `input_audio_buffer.commit` a dočasné vypnutie `interrupt_response` cez WebRTC. Je to podľa dokumentácie, ale treba ho overiť v reálnom hovore.
- **Výplňové slová** sú dolný odhad: modely prepisu zaváhania často vynechávajú. Report to uvádza.
- **Kamera:** signály sú orientačné a závisia od kamery a svetla. Prahy (natočenie hlavy, vzdialenosť) sú ASSUMPTION a treba ich kalibrovať na dátach.
- **Prahy prednesu** (tempo 95 až 175 slov/min, nábeh 4 s, výplne 5/100 slov) sú ASSUMPTION, nie norma.
- **Tím:** databáza a pravidlá prístupu podporujú členov projektu (editor, viewer), UI na pozývanie zatiaľ nie je.
- **Angličtina:** štruktúra je pripravená (`profiles.locale`, jazyk v reláciách a promptoch, popisy v `src/lib/domain/labels.ts`), preklad UI nie je.
- **Nahrávky:** zámerne sa neukladajú (D6), report preto neponúka spätné vypočutie úsekov.
- **Rate limiting** v pamäti je per inštancia. Drahé operácie navyše chránia databázové limity (spotreba, počet pripojení).
- **`npm audit`:** 5 high v dev závislostiach (`eslint-config-next` → `fast-glob` → `braces`). Netýka sa runtime, oprava čaká na upstream.

## Pred spustením naostro

- [ ] Doplniť `CONTACT_EMAIL` a `LEGAL_ENTITY_*`.
- [ ] Právna kontrola podmienok, zásad ochrany údajov a súhlasov ([docs/legal-privacy-checklist.md](docs/legal-privacy-checklist.md)).
- [ ] DPA s Upstash, Anthropic, OpenAI, hostingom a Stripe. Overiť región EÚ a prenosy mimo EÚ.
- [ ] Staging test: registrácia → projekt → deck → hlasový tréning → report → cvičenie → porovnanie, na desktope aj mobile (Chrome, Safari).
- [ ] 10 testovacích rozhovorov v slovenčine s meraním kvality prepisu a reálnej ceny za minútu (`training_sessions.provider_usage`).
- [ ] Monitoring chýb (napríklad Sentry) a upozornenie na zlyhania reportov (`feedback_reports.status = 'failed'`).

## Tím

Tím zo Startup Weekend Žilina 2026. Príspevky sú vítané, otvor issue alebo PR.
