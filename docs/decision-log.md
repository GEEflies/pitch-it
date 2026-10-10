# Decision log: Pitch It

Formát: Decision · Context · Options · Chosen · Why · Evidence · Trade-offs · Date

---

## D1: Nadviazať na existujúci projekt `pitch-it`

- **Context:** V repozitári už bola landing page (Next.js 16, Tailwind 4, Motion, Supabase) so zberom early access.
- **Options:** (a) nový projekt, (b) rozšíriť existujúci.
- **Chosen:** (b).
- **Why:** Rovnaký stack, aký zadanie odporúča. Dizajnový systém (ink/signal/marker, dva hlasy písma) už existuje a je dobrý.
- **Trade-offs:** Landing bola písaná pre „čoskoro“. Texty sa upravujú tak, aby sľubovali iba to, čo produkt reálne robí.
- **Date:** 2026-10-10

## D2: Realtime hlas cez OpenAI Realtime (WebRTC), analýza cez Claude

- **Context:** Jadrom produktu je živý hlasový rozhovor s prerušením a prepisom, najmä v slovenčine.
- **Options:** (a) OpenAI Realtime (WebRTC, `ek_` tokeny), (b) Gemini Live (WebSocket, ephemeral tokens), (c) vlastný reťazec STT → Claude → TTS, (d) hostovaná platforma (LiveKit, ElevenLabs Agents).
- **Chosen:** (a) pre hlas, Claude (`claude-opus-5-5`) pre deck, report, nápovedu, textový režim a cvičenia. Obe za rozhraniami.
- **Why:** WebRTC rieši echo cancellation, jitter aj prehrávanie v prehliadači. Server VAD/semantic VAD a prerušenie sú vstavané. Krátkodobé tokeny sú zdokumentované. Reťazec (c) znamená približne 600 až 800 ms latencie navyše a výrazne viac kódu.
- **Evidence:** FACT: dokumentácia OpenAI Realtime GA (`/v1/realtime/client_secrets`, `/v1/realtime/calls`, `expires_after` 10 až 7200 s), overené 2026-10-10. FACT: Anthropic realtime audio API neponúka, overené rovnako. EVIDENCE: Gemini Live uvádza slovenčinu v zozname 99 jazykov.
- **Trade-offs:** Dvaja AI dodávatelia, teda dve DPA. UNKNOWN: kvalita slovenčiny v hlase aj prepise. Overenie: 10 testovacích rozhovorov s rodenými hovorcami, hodnotiť WER prepisu a prirodzenosť. Ak neprejde, ďalší kandidát je Gemini Live: druhá implementácia `RealtimeProvider`.
- **Date:** 2026-10-10

## D3: Investorské štýly a scenáre v kóde, nie v databáze

- **Context:** Zadanie uvádza entitu „investor profiles a training scenarios“.
- **Options:** (a) tabuľky s admin rozhraním, (b) typovaný katalóg v kóde a snímka v relácii.
- **Chosen:** (b).
- **Why:** Ide o produktový obsah, ktorý potrebuje revíziu a verziu, nie CRUD. Admin rozhranie by bolo feature bloat bez používateľa. `training_sessions.config_snapshot` drží verziu štýlu a promptu.
- **Trade-offs:** Vlastné štýly používateľov nie sú možné. Ak to bude reálna požiadavka, pridá sa tabuľka `custom_investor_profiles`.
- **Date:** 2026-10-10

## D4: Žiadne celkové „skóre pripravenosti“

- **Context:** Konkurencia (VC Mirror, PitchLab) ukazuje jedno číslo „readiness“.
- **Options:** (a) jedno skóre, (b) hodnotenie po dimenziách s dôkazmi.
- **Chosen:** (b).
- **Why:** Jedno číslo pôsobí ako predikcia investičného rozhodnutia, no nie je empiricky validované. Dimenzie s citáciou odpovede ukazujú, čo zlepšiť.
- **Trade-offs:** Menej „zdieľateľné“ číslo. Ak budú dáta zo skutočných stretnutí, dá sa zvážiť validovaný ukazovateľ.
- **Date:** 2026-10-10

## D5: Videoanalytika iba lokálne a iba agregáty

- **Context:** Kamera je citlivá. Odvodzovanie emócií alebo dôveryhodnosti z tváre je vedecky slabé a právne rizikové (EU AI Act zakazuje rozpoznávanie emócií v práci a vzdelávaní; FACT, čl. 5 ods. 1 písm. f, platí od 2. 2. 2025).
- **Chosen:** MediaPipe Face/Pose Landmarker vo Web Workeri v prehliadači. Ukladajú sa iba agregované pomery (tvár v zábere, orientácia hlavy, stabilita, viditeľná gestikulácia). Žiadne snímky, žiadne landmarky, žiadne emócie.
- **Trade-offs:** Menej „wow“ metrík. Pohľad do kamery je iba orientačný.
- **Next:** Právna kontrola, či agregované signály z landmarkov nie sú biometrické údaje podľa čl. 9 GDPR. INFERENCE: nie sú, keďže neslúžia na jedinečnú identifikáciu, no potvrdiť musí právnik.
- **Date:** 2026-10-10

## D6: Nahrávky sa štandardne neukladajú

- **Chosen:** Audio aj video zostávajú v prehliadači. Ukladá sa prepis a merania. Funkcia „vypočuť si úsek“ preto v prvej verzii neexistuje, report ukazuje textové úseky s časom.
- **Why:** Minimalizácia dát, nižšie náklady na úložisko, jednoduchšia DPA. Zadanie dovoľuje ukladanie iba po samostatnom súhlase.
- **Trade-offs:** Chýba spätné vypočutie. Ak to používatelia budú chcieť, pridá sa voliteľné lokálne nahrávanie (MediaRecorder do pamäte prehliadača, bez uploadu).
- **Date:** 2026-10-10

## D7: Testy bez Dockeru

- **Context:** Na vývojovom stroji nie je Docker, takže lokálny Supabase nefunguje.
- **Chosen:** Čisté funkcie testované cez `node --test`. RLS politiky na PGlite so simulovanou `auth` a `storage` schémou. UI cez Playwright na verejných a auth stránkach.
- **Trade-offs:** PGlite simuluje Supabase iba čiastočne (bez PostgREST a GoTrue). Pred spustením otestovať na staging projekte Supabase.
- **Date:** 2026-10-10

## D8: Limity plánov podľa ceny realtime minút

- **Evidence:** ESTIMATE: `gpt-realtime-2.1` má cenu 32 $ / 1M audio input a 64 $ / 1M audio output tokenov (OpenAI pricing, snapshot 07/2026). Odhad tretích strán je 0,06 až 0,11 $ za minútu s cache, bez cache až 0,46 $/min.
- **Chosen:** Free: 20 min realtime a 3 reporty mesačne. Pro: 180 min a 40 reportov mesačne. Cena Pro je HYPOTÉZA (29 €/mes.) a overí ju pricing test, nie je to fakt. Limity sú v `src/lib/billing/plans.ts`.
- **Unit economics (ESTIMATE):** Pro pri plnom čerpaní stojí 180 × 0,11 $ ≈ 20 $ za hlas a 40 × ~0,2 $ ≈ 8 $ za reporty, spolu ≈ 28 $ (~26 €). Pri 29 € a plnom čerpaní je marža takmer nulová. Vychádza iba pri priemernom čerpaní pod ~50 %. Pri 300 min by cena **nevychádzala**. Páky: `gpt-realtime-2.1-mini` pre tréningový režim (približne 3× lacnejší), cache inštrukcií, kratšie odpovede investora. Treba zmerať reálnu spotrebu tokenov na minútu z `usage` v `response.done`.
- **Free plán (ESTIMATE):** 20 × 0,11 $ + 3 × 0,2 $ ≈ 2,8 $ na aktívneho free používateľa mesačne. Kill/kontrola: ak konverzia free → Pro < 3 %, free plán skrátiť alebo zaviesť pozvánky (`SIGNUP_MODE=waitlist`).
- **Date:** 2026-10-10
