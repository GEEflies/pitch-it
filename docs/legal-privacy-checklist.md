# Právo a súkromie: čo treba skontrolovať pred spustením

Toto nie je právne stanovisko. Ide o zoznam miest, ktoré musí posúdiť právnik (GDPR, AI Act, spotrebiteľské právo).

## Implementované technické opatrenia

| Oblasť | Ako je to riešené | Kde |
|---|---|---|
| Minimalizácia | Audio a video sa neukladajú. Z kamery sa ukladajú iba agregované pomery. IP iba ako HMAC (24 h) | D5, D6, `aggregate.ts`, migrácie |
| Lokálne spracovanie videa | MediaPipe vo Web Workeri v prehliadači, WASM aj modely z vlastnej domény | `lib/analytics/vision/*`, `scripts/setup-mediapipe.mjs` |
| Súhlasy | Append-only log s verziou textu. Mikrofón a kamera pred prvým použitím, odvolanie v nastaveniach | `consents`, `consent-texts.ts` |
| Vek | Potvrdenie 18+ pri registrácii | `signUpSchema`, trigger `handle_new_user` |
| Prístup | RLS na všetkých tabuľkách, súkromný bucket, systémové údaje iba na čítanie | migrácia + `tests/db/rls.test.ts` |
| Právo na prístup a prenosnosť | Export JSON | `/api/account/export` |
| Právo na vymazanie | Zmazanie tréningov, projektu a celého účtu (súbory + kaskáda) | `privacy/account.ts` |
| Uchovávanie | Voľba 30/90/365 dní, `purge_expired_sessions()` | migrácia, README |
| Analytika | Interné udalosti bez obsahu, žiadne cookies tretích strán. Po zmazaní účtu anonymné | `product_events` |
| Bezpečnosť | Kľúče iba na serveri, krátkodobé tokeny, rate limity, validácia vstupov, kontrola súborov podľa obsahu, CSP `frame-ancestors`, Permissions-Policy | `server-env.ts`, `rate-limit.ts`, `file-check.ts`, `next.config.ts` |

## Otázky pre právnika

1. **Biometrické údaje (čl. 9 GDPR):** sú agregované signály z landmarkov tváre (natočenie hlavy, smer pohľadu) biometrickými údajmi, keď neslúžia na identifikáciu a neopúšťajú zariadenie? INFERENCE: nie, treba potvrdiť.
2. **EU AI Act:** produkt nerozpoznáva emócie (čl. 5 ods. 1 písm. f sa týka práce a vzdelávania). Je tréningový nástroj pre founderov „vzdelávanie“? Treba posúdiť transparenčné povinnosti pri hlasovom AI (používateľ vie, že hovorí s AI).
3. **Prenos mimo EÚ:** Anthropic a OpenAI. Treba overiť DPA, SCC a nastavenia uchovávania dát u poskytovateľov (zero data retention, ak je dostupné).
4. **Právny základ pre hlas:** súhlas vs. plnenie zmluvy. Dnes súhlas, s textovým režimom ako alternatívou.
5. **Dôverné informácie tretích strán v deckoch:** podmienky prenášajú zodpovednosť na používateľa. Je to dostatočné?
6. **Spotrebiteľ vs. podnikateľ:** founder môže byť spotrebiteľ. Treba posúdiť právo na odstúpenie pri digitálnej službe, informácie o cene a automatickom obnovení.
7. **Texty súhlasov a zásad:** pracovné návrhy (`LEGAL_VERSION`, `MEDIA_CONSENT_VERSION`). Pri zmene zvýšiť verziu.
8. **DPIA:** pravdepodobne potrebná (nové technológie, hlas, analýza správania). Pripraviť pred spustením.

## Prevádzkové úlohy

- DPA so všetkými sprostredkovateľmi a ich zoznam v zásadách (už uvedený).
- Postup pri incidente (kto, do 72 hodín, ÚOOÚ SR).
- Záznamy o spracovateľských činnostiach.
- Overenie, že žiadne logy neobsahujú obsah rozhovorov (aktuálne logujeme iba kódy chýb).
