# PitchIt – landing page (lokálne)

Lokálne spustiteľný export canvasu **PitchIt – Landing Page** (claude.ai Design,
`claude.ai/artifact/3x98z5q84WCB6ARWcGZkHs`, verzia 76 / `1791637466-8473`): landing
page a klikateľný prototyp (prihlásenie, registrácia, onboarding, nahrávanie,
pracovný priestor, feedback, mentor dashboard), každý v tmavom a svetlom variante.

Je to samostatný balík s vlastnými závislosťami: s Next.js aplikáciou v koreni
repa nesúvisí a jej build ani lint ho nezahŕňajú. Slúži ako referencia dizajnu
pri prenose obrazoviek do aplikácie (porovnanie 1:1 v prehliadači).

## Spustenie

Potrebuješ Node.js 18+.

```bash
cd landing
npm install
npm start
```

Otvor **http://localhost:4400/** (tmavý landing). Svetlý variant je na
`/MainLight.dc.html`. Ak je port obsadený, server skúsi ďalší a vypíše adresu.
Iný port: `PORT=5000 npm start`.

| Príkaz | Čo robí |
|---|---|
| `npm start` | build do `dist/` + server |
| `npm run build` | iba build (výstup `dist/` sa dá nasadiť na ľubovoľný statický hosting) |
| `npm run serve` | iba server nad existujúcim `dist/` |
| `npm test` | build + Playwright testy (desktop 1440 px a mobil 375 px, v Edge) |

## Ako to funguje

Canvas ukladá obrazovky vo formáte `.dc.html`, ktorý mimo claude.ai nebeží.
Súbory v `canvas/` ostávajú zdrojom pravdy a build ich iba pripraví na beh:

- `runtime/dc-runtime.js` je malý runtime nad Reactom 18. Vie `{{holes}}`,
  `<sc-if>`, `<sc-for>`, eventy (`onClick="{{fn}}"`) a logiku
  `class Component extends DCLogic` so stavom a životným cyklom.
- `scripts/build.mjs` presunie fonty a štýly z `<helmet>` do `<head>`, zabalí
  šablónu do `<script type="text/x-dc-template">`, nahradí `./support.js`
  Reactom a runtime a prepíše `/_blob/<id>` na `assets/<id>.jpg`.
- Odkaz na Google Fonts build nahradí lokálnymi fontmi z balíkov `@fontsource/*`
  (licencia OFL, iba sady latin a latin-ext). Stránka tak nerobí žiadne
  požiadavky mimo lokálny server a funguje aj offline.
- `scripts/serve.mjs` je statický server bez závislostí, predvolene počúva iba
  na `127.0.0.1`.

**Aktualizácia z canvasu:** stiahni nové `project/*.dc.html` do `canvas/`, nové
obrázky do `assets/` (pomenované podľa blob id) a spusti `npm start`. Build
zlyhá s jasnou hláškou, ak niektorý obrázok alebo font chýba. Nový font z
Google Fonts treba doinštalovať: `npm install @fontsource/<nazov-fontu>`.

## Zmeny oproti canvasu

Desktopový dizajn ostal bez zmeny. Opravené boli len chyby a rovnaké opravy
sú publikované aj v canvase (verzia 76), takže re-export ich neprepíše:

- **Tmavý landing, mobil (≤ 560 px):** navigácia sa lámala do vysokej kapsule
  cez hero (v navigácii teraz ostáva „Prihlásiť sa“, hlavné CTA je hneď pod
  nadpisom), nadpis 66 px orezával „sebavedomý“, karta „Pre organizátorov“ mala
  pre padding 64 px rozpadnutý mockup a dekoratívna žiara pretekala o 4 px.
- **Tmavý landing, ≤ 900 px:** chip „Reč tela“ prekrýval CTA tlačidlo. Mal byť
  skrytý cez `.hc`, ale inline `display:flex` to prebíjalo.
- **Tmavý landing, všetky šírky:** v mockupe dashboardu neboli vidieť názvy
  tímov, skóre ani nadpis (tmavý text `#141414` na tmavom pozadí).
- **Svetlý landing:** mockup dashboardu mal tmavý panel s tmavým textom,
  takže bol nečitateľný. Teraz je svetlý ako ostatné tokeny okolo neho. Na
  mobile sa orezávali nadpisy v hero a v sekcii „AI za PitchIt“.

## Čo je stále iba prototyp

Ide o klikateľný prototyp bez backendu. Toto zámerne nefunguje „naostro“:

- Prihlásenie a registrácia nič neoverujú ani neukladajú, tlačidlo iba
  pokračuje na onboarding. „Pokračovať cez Google/LinkedIn“ nerobí nič.
- Nahrávanie, kamera, analýza a feedback sú simulované (časovače a ukážkové
  dáta). Mikrofón ani kamera sa nespúšťajú.
- Formulár „Zdieľať s mentorom“ nič neodosiela. Mentor dashboard používa
  ukážkové dáta.
- Odkazy bez cieľa: „Zabudnuté heslo?“ (`#`), „O nás“ a „Kontakt“ (na začiatok
  stránky), „Ochrana súkromia · Podmienky“ sú iba text.
- Obsah sa vykresľuje v prehliadači (bez JavaScriptu je stránka prázdna).
  Produkčný landing je Next.js port v `src/components/landing/`.
