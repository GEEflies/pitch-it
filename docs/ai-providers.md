# AI poskytovatelia

Stav k 2026-10-10. Ceny a modely sa menia, pred rozpočtom over aktuálne cenníky.

## Rozdelenie úloh

| Úloha | Kde v kóde | Poskytovateľ a model | Effort | Výstup |
|---|---|---|---|---|
| Živý hlasový rozhovor | `lib/ai/realtime/*`, `lib/session/controller.ts` | OpenAI `gpt-realtime-2.1` cez WebRTC | – | hlas + prepisy + udalosti |
| Prepis foundera počas rozhovoru | konfigurácia realtime relácie | OpenAI `gpt-4o-transcribe` (`language: sk`, logprobs) | – | text + istota |
| Prepis odpovede v cvičení | `lib/ai/transcription.ts` | OpenAI Audio API, rovnaký model | – | text |
| Analýza podkladu | `lib/documents/*` | Claude `claude-opus-5-5`, PDF ako dokument | high | štruktúrované fakty a problémy |
| Report po tréningu | `lib/reports/*` | Claude `claude-opus-5-5` | high | štruktúrované hodnotenie s citáciami |
| Textový investor | `lib/investor/text-investor.ts` | Claude | low | replika + príznak konca |
| Nápoveda | `lib/investor/hints.ts` | Claude | low | štruktúra odpovede a vlastné fakty |
| Vyhodnotenie cvičenia | `lib/exercises/evaluation.ts` | Claude | medium | kritériá a ukážka |

FACT (overené 2026-10-10): Anthropic neponúka realtime speech-to-speech API pre vývojárov, preto je hlas u OpenAI.

## Bezpečnosť kľúčov

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` a `AUTH_SECRET` sa čítajú iba na serveri (`server-only`).
- Prehliadač dostane iba krátkodobý `ek_…` token (`expires_after` 120 s) z `/v1/realtime/client_secrets`. Token vydá server po overení vlastníctva relácie, limitu minút a rate limitu.
- Poskytovateľovi sa posiela pseudonymný `OpenAI-Safety-Identifier` (HMAC ID používateľa), nikdy e-mail.
- Text z podkladov sa vkladá do ohraničených blokov (`<startup_data>`). Značky v ňom sa odstránia a prompt výslovne hovorí, že ide o dáta, nie inštrukcie.

## Spoľahlivosť

- Claude: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) pri odmietnutí z bezpečnostných dôvodov, kontrola `stop_reason` (`refusal`, `max_tokens`), typované chyby SDK → zrozumiteľné stavy v UI.
- Report: citácie a čísla ťahov z výstupu modelu sa overia voči prepisu. Neplatné sa zahodia (`validateAssessmentEvidence`).
- Realtime: výpadok → až 3 pokusy o obnovu s doterajším prepisom v inštrukciách → ponuka textového režimu.
- Bez kľúča: stav `not_configured`, nikdy vymyslený výsledok.

## Náklady (ESTIMATE)

| Položka | Odhad | Zdroj |
|---|---|---|
| Realtime hlas | 0,06 až 0,11 $/min s cache, bez cache až ~0,46 $/min | OpenAI pricing (audio 32 $/64 $ za 1M tokenov), odhady tretích strán 07/2026 |
| Report (Claude) | ~0,1 až 0,3 $ | ~10 až 25k vstupných a ~4k výstupných tokenov pri 4 $/20 $ za 1M |
| Analýza decku | ~0,1 až 0,4 $ | podľa veľkosti PDF |

Reálnu spotrebu meria `training_sessions.provider_usage` (súčty `usage` z `response.done`). Tieto dáta použi na overenie D8 v decision logu.

## Výmena poskytovateľa

- **Hlas:** implementuj `RealtimeProvider` (server: vydanie oprávnenia) a `RealtimeConnection` (klient: spojenie + preklad udalostí na `RealtimeEvent`). Kandidát je Gemini Live (ephemeral tokens, WebSocket, slovenčina v zozname jazykov). Stavový automat, merania a UI sa nemenia.
- **LLM:** implementuj `LlmProvider.generateStructured`. Schémy sú v zod a prompty sú nezávislé od poskytovateľa.

## Evaluácia (ďalší krok)

Každý AI systém potrebuje eval set. Odporúčané minimum pred spustením:

1. **Report:** 20 anonymizovaných prepisov s ručným hodnotením dimenzií. Merať zhodu ratingu, podiel zahodených citácií a halucinácie čísel v `improved_example`.
2. **Analýza decku:** 10 deckov s ručne označenými faktami. Merať precision a recall faktov a správnosť `stated` vs `inferred`.
3. **Investor:** 30 simulovaných odpovedí (vyhýbavá, s rozporom, bez čísla). Merať, či investor dopytuje podľa metodiky štýlu.
