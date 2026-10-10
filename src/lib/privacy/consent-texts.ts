/*
  Texty súhlasov pre mikrofón a kameru. Verzia sa ukladá so súhlasom;
  pri zmene textu zvýš verziu, aby sa súhlas vyžiadal znova.
*/

export const MEDIA_CONSENT_VERSION = "2026-10-10";

export const MICROPHONE_CONSENT = {
  title: "Mikrofón a hlasový rozhovor",
  points: [
    "Tvoj hlas sa počas tréningu posiela poskytovateľovi AI (OpenAI), ktorý z neho vytvára prepis a hlas investora.",
    "Ukladáme iba prepis rozhovoru a merania (tempo, pauzy, dĺžka odpovedí). Zvukovú nahrávku neukladáme.",
    "Hlasitosť a výšku hlasu meriame priamo v tvojom prehliadači, posielame iba výsledné čísla.",
    "Prepis aj merania môžeš kedykoľvek zmazať v histórii alebo v nastaveniach.",
  ],
} as const;

export const CAMERA_CONSENT = {
  title: "Kamera a neverbálne signály",
  points: [
    "Video spracúva model priamo v tvojom prehliadači. Obraz sa nikam neposiela ani neukladá.",
    "Sledujeme iba polohu v zábere, natočenie hlavy, orientačný smer pohľadu a viditeľnú gestikuláciu.",
    "Nerozpoznávame identitu ani emócie a nič neodvodzujeme z tvojho vzhľadu.",
    "Ukladáme iba súhrnné pomery za tréning (napríklad „tvár v zábere 92 % času“).",
  ],
} as const;
