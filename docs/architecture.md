# Pitch It: architektúra

Stav: 2026-10-10. Dokument opisuje, ako je produkt postavený a prečo. Rozhodnutia s alternatívami sú v [decision-log.md](decision-log.md).

## Produktový cyklus

```
Profil startupu → podklady (deck) → príprava stretnutia → živý rozhovor → report → cvičenia → nový pokus → porovnanie
```

Každý krok zapisuje dáta, z ktorých vychádza ďalší. Report nečíta nič, čo by nevzniklo z reálneho rozhovoru alebo z údajov používateľa.

## Moduly

| Vrstva | Kde | Zodpovednosť |
|---|---|---|
| Verejná časť | `src/app/(marketing)`, `src/components/sections` | landing, cenník, FAQ, právne texty |
| Autentifikácia | `src/app/(auth)`, `src/lib/auth` | registrácia, prihlásenie, reset hesla, súhlasy pri registrácii |
| Aplikácia | `src/app/app/**` | dashboard, projekty, podklady, tréning, reporty, cvičenia, história, nastavenia |
| Dátový prístup | `src/lib/db/**` | jediné miesto, kde sa číta a zapisuje do úložiska; overuje vlastníctvo |
| Úložisko | `src/lib/store/**` | Redis (Upstash) s dotazmi v tvare `from().select()`; klient používateľa (pravidlá prístupu) a admin klient (iba server, systémové zápisy) |
| LLM provider | `src/lib/ai/llm/**` | rozhranie `LlmProvider`, implementácia Anthropic (Claude) |
| Realtime provider | `src/lib/ai/realtime/**` | serverové vydanie krátkodobého tokenu + klientsky adaptér spojenia (OpenAI Realtime cez WebRTC) |
| Investor | `src/lib/investor/**` | investorské štýly s metodikou, scenáre, skladanie inštrukcií z podkladov |
| Dokumenty | `src/lib/documents/**` | kontrola súboru, extrakcia PDF/PPTX po slidoch, AI analýza tvrdení |
| Merania reči | `src/lib/analytics/speech/**` | čisté funkcie: tempo, pauzy, výplňové slová, latencia, dĺžka odpovedí |
| Audio v prehliadači | `src/lib/analytics/audio/**` | hlasitosť, pauzy a orientačná výška hlasu z mikrofónu (AudioWorklet), nič sa neodosiela |
| Videoanalytika | `src/lib/analytics/vision/**` | MediaPipe vo Web Workeri, agregácia signálov, žiadne snímky ani landmarky sa neukladajú |
| Reporty | `src/lib/reports/**` | objektívne merania + AI hodnotenie so štruktúrovaným výstupom a dôkazmi |
| Cvičenia | `src/lib/exercises/**` | katalóg, generovanie zo slabín, vyhodnotenie pokusu |
| Platby a limity | `src/lib/billing/**` | plány, oprávnenia pred reláciou, Stripe (iba ak sú kľúče) |
| Súkromie | `src/lib/privacy/**` | súhlasy, uchovávanie, vymazanie dát a účtu |
| Produktová analytika | `src/lib/events/**` | interné udalosti v databáze, bez tretích strán |
| Realtime UI | `src/components/session/**` | tréningová miestnosť, stavový automat relácie |

## Tok živého rozhovoru

```
Prehliadač                          Server (Next.js)                     OpenAI Realtime
──────────                          ────────────────                     ───────────────
1. Nastavenie tréningu  ─────────▶  createSession (server action)
                                    · vlastníctvo projektu
                                    · oprávnenie (plán, minúty)
                                    · snímka konfigurácie investora
2. Súhlas s mikrofónom (kamerou)
3. „Začať“  ─────────────────────▶  POST /api/sessions/:id/connect
                                    · auth + stav relácie
                                    · limit pokusov
                                    · inštrukcie z faktov a decku
                                    · POST /v1/realtime/client_secrets ─▶ ek_… (60 s)
            ◀──────────────────────  { clientSecret, model, maxSeconds }
4. WebRTC: mikrofón + dátový kanál ───────────────────────────────────▶  SDP /v1/realtime/calls
            ◀─────────── hlas investora, prepisy, VAD udalosti ─────────
5. Dokončené ťahy + merania  ────▶  POST /api/sessions/:id/turns (idempotentné podľa seq)
6. Koniec  ──────────────────────▶  POST /api/sessions/:id/finish
                                    · minúty do usage_events
                                    · after(): report (Claude, štruktúrovaný výstup)
7. Report stránka (polling stavu)
```

API kľúč OpenAI ani Anthropic nikdy neopustí server. Prehliadač dostane iba krátkodobý `ek_` token, platný na nadviazanie jedného spojenia.

Výpadok spojenia: klient prejde do stavu `reconnecting`, požiada server o nový token s `resume=true`. Server vloží do inštrukcií doterajší priebeh rozhovoru z databázy, takže investor nadviaže bez opakovania. Po troch neúspešných pokusoch ponúkne textový režim.

Textový fallback: rovnaké inštrukcie investora, odpovede generuje `LlmProvider` (Claude) cez `POST /api/sessions/:id/text-turn`. Používa sa, ak realtime nie je nakonfigurovaný, zlyhá, alebo ho používateľ zvolí.

## Dátový model

Schéma: `src/lib/store/schema.ts`. Hlavné entity:

```
auth.users ─┬─ profiles, user_settings, consents, subscriptions, usage_events
            ├─ projects ─┬─ project_members
            │            ├─ startup_facts        (zdroj: user | document | ai_inference; stav: confirmed | needs_review | rejected)
            │            ├─ project_issues       (missing | conflict | unsupported_claim | unclear)
            │            └─ documents ── document_extractions (po slidoch)
            ├─ training_sessions ─┬─ conversation_turns
            │                     ├─ audio_delivery_metrics (po ťahoch foundera)
            │                     ├─ visual_analytics (iba agregáty)
            │                     └─ feedback_reports
            ├─ exercises ── exercise_attempts
            └─ product_events (user_id sa pri zmazaní účtu nastaví na NULL)
```

Investorské štýly a scenáre sú v kóde (`src/lib/investor/catalog.ts`), nie v databáze: sú to produktové dáta s verziou v gite a s revíziou. Každá relácia si ukladá `config_snapshot` s verziou štýlu a promptu, takže starý report zostane interpretovateľný aj po zmene katalógu.

### Pravidlá prístupu

- Každá tabuľka má v `src/lib/store/schema.ts` pravidlá `read`, `insert`, `update`, `remove`. Chýbajúce pravidlo znamená zákaz. Bez prihlásenia nie je prístup k ničomu.
- Obsah používateľa (projekty, fakty, podklady, prepisy počas živej relácie, pokusy v cvičeniach) zapisuje server klientom používateľa (`getUserDb`), takže pravidlá platia aj pre server.
- Systémové údaje (stav a fakturácia relácie, merania, reporty, limity, predplatné, udalosti) môže používateľ iba čítať. Zapisuje ich server cez admin klienta (`getAdminDb`) po overení vlastníctva v `src/lib/db`.
- Prístup k projektu: vlastník alebo člen (`editor`, `viewer`).
- Súbory: v Redise po kúskoch pod `{project_id}/{document_id}`, nahrávanie cez podpísaný token.

Pravidlá testuje `tests/store.test.ts`.

## AI vrstva

| Úloha | Model | Prečo |
|---|---|---|
| Živý hlasový rozhovor | OpenAI `gpt-realtime-2.1` (env `OPENAI_REALTIME_MODEL`) | natívny speech-to-speech, WebRTC, prerušenie, prepisy. Anthropic realtime audio API neponúka (overené 2026-10-10). |
| Prepis foundera | `gpt-4o-transcribe`, jazyk `sk` (env) | prepis vstupu počas relácie |
| Analýza decku, report, nápoveda, textový investor, hodnotenie cvičení | Claude `claude-opus-5-5` (env `ANTHROPIC_MODEL`) | štruktúrovaný výstup, práca s dlhým kontextom a dôkazmi |

Každé AI volanie ide cez rozhranie (`LlmProvider`, `RealtimeProvider`). Výmena poskytovateľa znamená novú implementáciu rozhrania, nie prepis aplikácie.

Ak kľúč chýba, funkcia vráti stav `not_configured` a UI to povie. Nikdy nevraciame vymyslený výsledok.

## Merania: čo je meranie a čo úsudok

| Typ | Príklady | Ako vzniká | V UI |
|---|---|---|---|
| Meranie | slová za minútu, dĺžka odpovede, latencia, pauzy, počet výplňových slov | čisté funkcie nad prepisom a časovaním | „Namerané“ |
| Orientačné meranie | variabilita hlasitosti a výšky hlasu, orientácia hlavy, smer pohľadu | signálové spracovanie a MediaPipe v prehliadači | „Orientačné“ + vysvetlenie limitov |
| AI úsudok | relevantnosť, konkrétnosť, konzistentnosť s podkladmi | Claude so štruktúrovaným výstupom, vždy s citáciou odpovede | „Hodnotenie AI“ + dôvod + citácia |

Report nikdy nepredpovedá rozhodnutie investora a nehodnotí osobu (vzhľad, vek, prízvuk, emócie).

## Spoľahlivosť

- Mikrofón: kontrola povolenia, výber zariadenia, meter úrovne pred začatím. Bez mikrofónu je k dispozícii textový režim.
- Kamera: vždy voliteľná. Zlyhanie kamery ani modelu MediaPipe nezastaví hlasovú reláciu.
- Sieť: stav spojenia v UI, automatické opätovné pripojenie s nadviazaním kontextu, idempotentné ukladanie ťahov (fronta s opakovaním).
- Limity: oprávnenie sa kontroluje pred vydaním tokenu, tvrdý časový limit relácie na klientovi aj pri účtovaní na serveri. Rate limit pre token, nápovedu a textové ťahy.
- Opustené relácie: relácia bez signálu dlhšie ako 2 minúty sa pri ďalšom kontakte uzavrie ako `abandoned` a účtuje sa do posledného signálu.
