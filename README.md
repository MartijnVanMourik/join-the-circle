# Stap in de cirkel — digitale werkvorm

Digitale versie van de werkvorm "stap in de cirkel": deelnemers stemmen via hun telefoon/laptop
op een reeks stellingen, en op het digibord zie je live hoe iedereen "naar binnen stapt"
naarmate ze het vaker eens zijn. Gemaakt voor een bijeenkomst met docenten om AI-geletterdheid
en huidig AI-gebruik in de klas bespreekbaar te maken.

**Live:** https://martijnvanmourik.github.io/join-the-circle/

Geen build-tooling — puur HTML/CSS/JS, met Firebase Realtime Database als backend.
Bewust dezelfde, eenvoudige aanpak als bij de kamelenrace (geen npm, geen bundler, geen
Firebase Auth) in plaats van een zwaardere Vite/Firestore/Auth-opzet: dit is een
laagdrempelige interne workshoptool met een fysiek aanwezige organisator, en beveiliging
is bewust geen prioriteit.

## Drie schermen

- **`index.html`** — organisator (eigen laptop): sessie aanmaken, stellingen + tijdslimiet
  per stelling bewerken, QR-codes voor deelnemers- en digibordlink, live deelnemerslijst,
  sessie besturen (volgende stelling), en achteraf een overzicht: klik op een deelnemer om
  zijn/haar antwoorden per stelling te zien, plus CSV-export. Ook een "Eerdere sessies"-
  overzicht om oude sessies terug te openen.
- **`display.html?s=CODE`** — digibord/beamer: bijna volledige cirkel (300°-boog, 60° open
  onderin) met een middencirkel met het instelbare woord, deelnemers als gekleurde bolletjes
  met hun docentencode. Onderin de huidige stelling met een aftelbalk (springt naar 0 zodra
  iedereen heeft geantwoord) en, na sluiten, de tellingen. Open met `&admin=1` erbij om ook
  de "volgende stelling"-knop rechtstreeks op het digibord te krijgen (handig bij een
  aanraakscherm, zodat je niet steeds naar je laptop hoeft).
- **`join.html?s=CODE`** — deelnemer (telefoon/laptop): sessiecode (voorgevuld via de link/QR),
  naam en **eigen bestaande docentencode** invullen (geen automatisch gegenereerde code —
  docenten kennen hun eigen code al), daarna per stelling Mee eens / Niet mee eens met dezelfde
  aftelbalk.

## Hoe de positie op het digibord wordt berekend

- Elke deelnemer krijgt bij binnenkomst een vaste hoek op de boog (bevroren zodra de eerste
  stelling live gaat, zodat bolletjes niet blijven springen; laatkomers worden toegevoegd
  zonder de rest te herschikken) en een kleur uit een vaste palet, beide afgeleid uit de
  volgorde van deelnemers — er wordt niets van dien aard apart opgeslagen.
- De radius (afstand tot het midden) is een interpolatie tussen buitenrand en middencirkel,
  op basis van *som van antwoordwaarden ÷ totaal aantal stellingen*. Alleen "mee eens" (waarde 1)
  telt mee; "niet mee eens" (waarde 0) houdt de positie gelijk.
- Antwoorden op de **actief openstaande** stelling tellen pas mee zodra die stelling is
  gesloten (tijd om, of iedereen heeft geantwoord) — dit voorkomt dat je tijdens het stemmen al
  ziet hoe de groep beweegt (kuddegedrag). Zie `getClosedStatementThreshold` /
  `computeParticipantVisibleScore` in `js/shared.js`.
- Alles hierboven is **afgeleid**, niet apart in de database bijgehouden — dat maakt het
  robuust bij reconnects en voorkomt dat losse velden uit sync raken.

## Datamodel (Firebase Realtime Database)

```
sessions/{sessionId}
  name, centerWord, status: "lobby" | "active" | "finished"
  currentStatementIndex (-1 vóór start), statementOpenedAt (server-timestamp)
  statements: [{ text, durationSec }]
  createdAt

sessions/{sessionId}/participants/{participantId}
  name, code (docentencode), joinedAt

sessions/{sessionId}/responses/{statementIndex}/{participantId}
  value: 0 | 1, ts
```

`sessionId` is tevens de 4-letter sessiecode die deelnemers intypen/scannen. Sessies worden
nooit verwijderd, dus ze blijven bruikbaar als geschiedenis (zie "Eerdere sessies" in de
organisator-app).

Met het oog op een latere uitbreiding naar een schaal (bv. 5-punts Likert i.p.v.
mee eens/niet mee eens) is `value` al numeriek in plaats van een boolean — een schaal kan er
later bij zonder het datamodel of de radius-berekening te herschrijven, alleen de
`/join`-knoppen en een `scaleMax` per stelling hoeven dan toegevoegd te worden.

## Firebase-project

Eigen, apart Firebase-project (bewust niet hergebruikt met de kamelenrace, zodat de data
gescheiden blijft): **`join-the-circle-307e8`**, Realtime Database in `europe-west1`.
De config staat al ingevuld in `js/firebase-config.js` (een Firebase-client-config is geen
geheim — de SDK-key beperkt niets, de rules doen dat).

**Rules** (`database.rules.json`, geplakt in Firebase Console → Realtime Database → Rules):
geen Auth — iedereen kan naar een sessie schrijven, net als bij de kamelenrace. Er is wel
lichte vorm-validatie toegevoegd die niets aan de toegang verandert, alleen de vorm van de
data bewaakt:
- een `participants`-entry moet een `name` en `code` (strings) bevatten;
- een `responses`-entry moet een `value` van precies `0` of `1` bevatten.

## Lokaal testen

Geen npm/build nodig:

```bash
python3 -m http.server 8123
```

en open `http://localhost:8123/`. Er staat ook een `.claude/launch.json` voor wie met
Claude Code werkt.

## Deployen (GitHub Pages)

Al ingericht: repo [MartijnVanMourik/join-the-circle](https://github.com/MartijnVanMourik/join-the-circle),
Settings → Pages → Deploy from branch `main`, map `/ (root)`. Een `git push` naar `main` is
genoeg — GitHub Pages bouwt niets, het serveert de bestanden direct (geen Actions-workflow
nodig omdat er geen build-stap is). De QR/join-links werken automatisch onder het
`/join-the-circle/`-subpad, dat wordt niet hardcoded maar afgeleid van `location.href`
(`baseUrl()` in `js/admin.js`).

## Bestandenoverzicht

```
index.html / css/admin.css   / js/admin.js     — organisator
display.html / css/display.css / js/display.js — digibord
join.html / css/join.css     / js/join.js      — deelnemer
js/firebase-config.js                          — Firebase SDK-config (ingevuld)
js/shared.js                                   — afgeleide logica, gedeeld door alle 3 schermen
                                                  (resterende tijd, gesloten-status, score)
data/statements.json                           — standaard stellingenset ("Digitale
                                                  geletterdheid"), bewerkbaar in de app zelf
database.rules.json                            — Realtime Database rules (handmatig geplakt
                                                  in de Firebase Console, niet automatisch
                                                  gedeployed)
```

## Standaard stellingenset

Thema "Digitale geletterdheid", 10 stellingen die kennis, huidige lespraktijk, schoolbeleid,
didactische vaardigheid, houding/zorgen en zelfvertrouwen rond AI meten — zie
`data/statements.json`. Volledig bewerkbaar (tekst, tijdslimiet, aantal) in het
organisatorscherm vóór het aanmaken van een sessie.

## Wat al getest is

Volledige end-to-end flow getest tegen het echte Firebase-project, zowel lokaal als op de
live GitHub Pages-URL: sessie aanmaken → QR/links met correct subpad → deelnemer meldt zich
aan en verschijnt meteen op het digibord → stelling met aftelbalk → balk springt naar 0
zodra alle deelnemers hebben geantwoord → tellingen verschijnen pas na sluiten → volgende
stelling verschuift de bolletjes zichtbaar. Nog niet getest: meerdere gelijktijdige
deelnemers op één sessie, en het "Eerdere sessies"-overzicht in de praktijk.

## Bekende keuzes / beperkingen

- **Geen Firebase Auth, open database-rules** — bewuste keuze, zie hierboven. Niet geschikt
  voor gevoelige data of een omgeving waar misbruik een reëel risico is.
- **Docentencode niet gevalideerd tegen een externe lijst** — alleen gecontroleerd op
  uniekheid binnen de sessie, niet op geldigheid.
- **Geen automatische build/deploy-pipeline** — een `git push` naar `main` is de hele
  "deploy"; er is bewust geen GitHub Actions-workflow omdat er niets te bouwen valt.
