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
  per stelling bewerken, **teams/secties beheren** (naam + kleur, net als de stellingen, met
  een standaard 16-secties-set), QR-codes voor deelnemers- en digibordlink, live
  deelnemerslijst, sessie besturen (volgende stelling, schakelaar "Toon codes op digibord" —
  live aan/uit te zetten, ook tijdens de sessie), en achteraf een overzicht: klik op een
  deelnemer om zijn/haar antwoorden per stelling te zien, of klik op een **team** om het
  teamgemiddelde per stelling te zien, plus CSV-export (inclusief teamkolom). Ook een "Eerdere
  sessies"-overzicht om oude sessies terug te openen. Met **"💾 Configuratie opslaan"** bewaar
  je de huidige stellingen/teams/middenwoord in `localStorage` van die browser, zodat je het
  scherm kunt inrichten zonder meteen een sessie aan te maken — bij een volgend bezoek (of na
  "← Nieuwe sessie") staat je eigen configuratie automatisch weer klaar in plaats van de
  standaardset. Puur lokaal aan die browser/dat apparaat gekoppeld, net als de auto-rejoin van
  deelnemers in `join.js`.
- **`display.html?s=CODE`** — digibord/beamer: een volledige cirkel (geen open stuk meer nodig)
  met een middencirkel met het instelbare woord, deelnemers als gekleurde bolletjes met hun
  docentencode. Deelnemers staan **geclusterd per team/sectie** op de boog, elk team in zijn
  eigen kleur, met een **legenda** rechtsonder in het zijpaneel (kleur ↔ sectienaam) — zo zie je
  in één oogopslag welke secties dichter naar het midden bewegen. Rechts verder een vast
  zijpaneel met de huidige stelling, een aftelbalk (springt naar 0 zodra iedereen heeft
  geantwoord) en, na sluiten, de tellingen (met een eigen groen ✓/rood ✕-icoon in plaats van
  emoji, zodat "mee eens" en "niet mee eens" er gegarandeerd hetzelfde uitzien) — zo blijft de
  cirkel zelf zo groot mogelijk in plaats van ruimte te delen met een paneel onderin. Open met
  `&admin=1` erbij om ook de "volgende stelling"-knop rechtstreeks op het digibord te krijgen
  (handig bij een aanraakscherm, zodat je niet steeds naar je laptop hoeft). De puntgrootte van
  de deelnemer-bolletjes schaalt automatisch mee met het aantal deelnemers (kleiner bij grote
  groepen) zodat ze bij grote groepen niet over elkaar heen gaan vallen — zie "Belasting/schaal"
  hieronder. De organisator kan live een schakelaar omzetten om de codes in de bolletjes
  helemaal te verbergen (`showCodes`) — handig bij zeer grote groepen waar zelfs de
  auto-verkleinde tekst niet meer prettig leesbaar is; de kleur/positie/clustering blijven dan
  gewoon zichtbaar.
- **`join.html?s=CODE`** — deelnemer (telefoon/laptop): sessiecode (voorgevuld via de link/QR
  en **alleen-lezen** in dat geval, zodat 'm niemand per ongeluk verandert), naam en **eigen
  bestaande docentencode** invullen (geen automatisch gegenereerde code — docenten kennen hun
  eigen code al), daarna een **sectie/team** kiezen uit een dropdown die verschijnt zodra een
  geldige (4-tekens) sessiecode is ingetypt (zelfde patroon als de teamkeuze in de
  kamelenrace), en per stelling Mee eens / Niet mee eens met dezelfde aftelbalk. Na het
  antwoorden ziet de deelnemer een persoonlijke terugkoppeling: met hoeveel van de tot nu toe
  beantwoorde stellingen die het eens was, plus een mini-visualisatie (een klein bolletje dat
  richting het midden van een cirkeltje schuift) die dezelfde berekening gebruikt als de
  posities op het digibord (`js/display.js`) — puur eigen feedback, dus geen kuddegedrag-risico
  zoals bij het digibord, en werkt daarom ook al vóórdat een stelling is gesloten. Het
  wachtscherm toont "Jouw code op het scherm" alleen als de organisator "Toon codes op
  digibord" aan heeft staan.

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
  teams: [{ name, color }]
  showCodes: boolean (live aan/uit te zetten tijdens de sessie)
  createdAt

sessions/{sessionId}/participants/{participantId}
  name, code (docentencode), teamId (index in teams[]), joinedAt

sessions/{sessionId}/responses/{statementIndex}/{participantId}
  value: 0 | 1, ts
```

`teamId` verwijst naar de index in de `teams`-array van de sessie — zelfde principe als
`statementIndex`, geen aparte id-generatie nodig. Op het digibord worden deelnemers eerst
gegroepeerd per team (in de ingestelde teamvolgorde) en dan pas bevroren zodra de sessie
start (`groupByTeam()` in `js/display.js`) — laatkomers worden achteraan de bevroren
volgorde toegevoegd en staan dus mogelijk niet naast hun sectiegenoten; dat is een bewuste
afweging om het "geen herschikking na bevriezen"-principe niet te doorbreken.

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

**Cache-busting:** alle lokale `<script>`/`<link>`-tags hebben een `?v=N` achter de bestandsnaam.
Browsers (en GitHub Pages) cachen js/css anders hardnekkig, waardoor een teruggekeerde
digibord-laptop een oude versie kan blijven tonen na een update. Hoog het nummer op in alle
drie de HTML-bestanden wanneer je een `.js`- of `.css`-bestand wijzigt. `js/shared.js` leest
dat nummer van zijn eigen `<script src="...?v=N">` (als `CACHE_VERSION`) en plakt het ook
achter de `fetch()`-aanroepen naar `data/statements.json` en `data/teams.json` in
`js/admin.js` — zonder die tweede stap bleef een update aan die JSON-bestanden zelf
hardnekkig hangen op een oude gecachete versie, ook al klopte het versienummer op de
HTML-tags al.

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
data/teams.json                                — standaard teams/secties (16, met kleur),
                                                  bewerkbaar in de app zelf
database.rules.json                            — Realtime Database rules (handmatig geplakt
                                                  in de Firebase Console, niet automatisch
                                                  gedeployed)
```

## Standaard stellingenset

Thema "AI-geletterd" (standaard middenwoord), 13 stellingen (20 sec. per stelling) die kennis, huidige
praktijk, vaardigheid, team-/schoolcontext, houding en lef rond AI meten — zie
`data/statements.json`. Opgesteld en aangescherpt door de werkgroep, met twee dingen bewust
verwerkt:
- **Inclusief voor OOP** (onderwijsondersteunend personeel, die geen leerlingen in de klas
  hebben): stellingen die anders puur les-/leerlinggericht zouden zijn, zijn verbreed naar
  "leerlingen/ collega's" of "in mijn werk" i.p.v. alleen "in mijn les".
- **"Mee eens" betekent consistent een stap richting het midden** — elke stelling is zo
  geformuleerd dat instemming altijd meer AI-betrokkenheid/-vertrouwen uitdrukt, nooit het
  omgekeerde (een eerdere conceptversie had hier nog een stelling die averechts scoorde).

Volledig bewerkbaar (tekst, tijdslimiet, aantal) in het organisatorscherm vóór het aanmaken
van een sessie, en op te slaan als eigen configuratie via "💾 Configuratie opslaan" (zie
hieronder) zodat latere aanpassingen aan dit bestand een al opgeslagen configuratie niet
overschrijven.

## Wat al getest is

Volledige end-to-end flow getest tegen het echte Firebase-project, zowel lokaal als op de
live GitHub Pages-URL: sessie aanmaken → QR/links met correct subpad → deelnemer meldt zich
aan en verschijnt meteen op het digibord → stelling met aftelbalk → balk springt naar 0
zodra alle deelnemers hebben geantwoord → tellingen verschijnen pas na sluiten → volgende
stelling verschuift de bolletjes zichtbaar → overzicht + CSV-export na afloop.

**Belasting/schaal:** apart getest met 60 en 100 gesimuleerde deelnemers (Firebase REST API
+ Playwright), met wisselend mee eens/niet mee eens per stelling. Geen performance-problemen
(pagina laadt + rendert in ~1,5s inclusief Firebase-verbinding, CSV-export van 60 deelnemers ×
10 stellingen kost ~80ms). Dit leverde wel een echte layout-bug op — bij een vaste puntgrootte
overlapten de deelnemer-bolletjes bij zulke aantallen fors — opgelost door de puntgrootte
automatisch te laten meeschalen met het aantal deelnemers, én door het stelling-paneel naast
(i.p.v. onder) de cirkel te zetten zodat de cirkel zelf groter kan zijn. Ook een bug gevonden
en opgelost waarbij het heropenen van een nog actieve lobby-sessie via "Eerdere sessies" niet
naar het lobby-scherm schakelde.

Nog niet getest: meerdere *gelijktijdige, echte* deelnemers (dit is met gesimuleerde/geïnjecteerde
data getest, niet met 60 losse browsersessies tegelijk), en het "Eerdere sessies"-overzicht met
veel sessies in de lijst.

**Echte mobiele bug gevonden en opgelost:** tijdens live gebruik op een telefoon bleek de
sectiekeuze soms "Onbekende sessiecode" te tonen ondanks een geldige code. Oorzaak: de
sessiecode-opzoekactie draaide bij elke toetsaanslag zodra er 3+ tekens stonden, en bij een
via QR voorgevulde (of snel getypte) code konden een vroege, terecht foute 3-tekens-opzoeking
en de latere juiste 4-tekens-opzoeking in de verkeerde volgorde binnenkomen — de oudere, foute
reactie overschreef dan de juiste. Opgelost door pas vanaf exact 4 tekens (de vaste lengte van
een sessiecode) te zoeken, plus een volgnummer dat een verlate/oude reactie altijd negeert.

**Tweede echte bug gevonden en opgelost:** er is eerst geëxperimenteerd met een aparte
sessie-instelling ("Docentencode gebruiken") die zowel bepaalde of het invoerveld verplicht
was als de digibord-weergave overstemde. Bij live gebruik bleek dat laatste een bug: als die
instelling bij het aanmaken "uit" stond, deed de live schakelaar "Toon codes op digibord"
niets meer — hij kon nooit meer codes tonen, hoe je 'm ook zette. Opgelost door terug te gaan
naar de eenvoudigere, oorspronkelijke opzet: docentencode is altijd verplicht bij aanmelden,
en "Toon codes op digibord" is de enige (en dus altijd betrouwbaar werkende) schakelaar voor
de digibord-weergave, in beide richtingen getest tijdens een actieve sessie.

**Teams/secties:** herhaald getest met 100 gesimuleerde deelnemers verdeeld over de 16
standaardsecties, elk met een eigen "basis-instemming" zodat er echte verschillen tussen
secties ontstaan. Clustering per team, teamkleuren, de legenda (16 items, 2 kolommen) en de
"Toon codes"-schakelaar werkten allemaal meteen goed. Het teamgemiddelde in het
overzichtsscherm is handmatig gecontroleerd tegen de sectie met de hoogste ingestelde
instemming (Oop, 80-100% "mee eens" per stelling) — kwam overeen met wie op het digibord het
dichtst bij het midden stond.

## Bekende keuzes / beperkingen

- **Geen Firebase Auth, open database-rules** — bewuste keuze, zie hierboven. Niet geschikt
  voor gevoelige data of een omgeving waar misbruik een reëel risico is.
- **Docentencode niet gevalideerd tegen een externe lijst** — alleen gecontroleerd op
  uniekheid binnen de sessie, niet op geldigheid.
- **Geen automatische build/deploy-pipeline** — een `git push` naar `main` is de hele
  "deploy"; er is bewust geen GitHub Actions-workflow omdat er niets te bouwen valt.
