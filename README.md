# Stap in de cirkel — digitale werkvorm

Digitale versie van de werkvorm "stap in de cirkel": deelnemers stemmen via hun telefoon/laptop
op een reeks stellingen, en op het digibord zie je live hoe iedereen "naar binnen stapt"
naarmate ze het vaker eens zijn.

Geen build-tooling — puur HTML/CSS/JS, met Firebase Realtime Database als backend
(zelfde aanpak als bij de kamelenrace).

## Drie schermen

- `index.html` — organisator: sessie aanmaken, stellingen beheren, QR-codes tonen, sessie besturen, achteraf antwoorden per deelnemer bekijken + CSV-export.
- `display.html?s=CODE` — digibord/beamer: de cirkel met deelnemers, huidige stelling, aftelbalk. Open met `&admin=1` erbij om ook de "volgende stelling"-knop op het digibord te krijgen.
- `join.html?s=CODE` — deelnemer: naam + eigen docentencode invullen, per stelling mee eens/niet mee eens.

## Firebase instellen (eenmalig)

1. Maak een Firebase-project (of hergebruik een bestaand project) en voeg een **Realtime Database** toe (Build → Realtime Database → Database aanmaken).
2. Kopieer de SDK-config (Project instellingen → Algemeen → "Uw apps" → SDK-config) naar `js/firebase-config.js`.
3. Plak de inhoud van [`database.rules.json`](database.rules.json) in Realtime Database → Rules, en publiceer.
   - Er is bewust **geen** Firebase Auth: iedereen kan (net als bij de kamelenrace) naar een sessie schrijven. De rules valideren alleen de vorm van de data (bv. dat een antwoord 0 of 1 is), niet wie er schrijft. Voor een interne workshoptool met een fysiek aanwezige organisator is dat een bewust geaccepteerd risico.

## Lokaal testen

Geen npm/build nodig — start gewoon een lokale static server in deze map, bijvoorbeeld:

```bash
python3 -m http.server 8080
```

en open `http://localhost:8080/`.

## Deployen (GitHub Pages)

1. Push deze map naar een GitHub-repo.
2. Zet Settings → Pages → Source op "Deploy from a branch", branch `main`, map `/ (root)`.
3. Voeg het `github.io`-domein toe aan Firebase → Authentication → Settings → Authorized domains (nodig zodra er ooit auth bijkomt; voor nu niet strikt vereist omdat er geen Auth gebruikt wordt, maar geen kwaad).

## Bestanden

- `data/statements.json` — standaard stellingenset (bewerkbaar in de organisator-app zelf, dit bestand is alleen de standaardinvulling).
- `js/shared.js` — afgeleide logica (resterende tijd, of een stelling gesloten is, score-berekening) die door alle drie de schermen wordt gebruikt.
- `database.rules.json` — Realtime Database rules, handmatig te plakken in de Firebase Console.
