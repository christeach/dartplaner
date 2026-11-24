# Dartplaner

Turnierplaner für den Dartverein: Spieler eintragen, auslosen, Spiele auf die Boards verteilen, Ergebnisse eintragen, Tabellen und K.O.-Baum ansehen, am Ende als PDF drucken oder als Excel-Datei exportieren.

Die App läuft komplett im Browser, ohne Server und ohne Konto. Der Turnierstand wird im Browser gespeichert (localStorage) und übersteht ein Neuladen der Seite. Ist die Seite einmal geöffnet, braucht sie kein Internet mehr: Sie nutzt nur Systemschriften und lädt nichts von fremden Servern nach.

Modi: 2 Ligen + K.O. (Vereinsmodus), Gruppen + K.O., Jeder gegen jeden, K.O., Doppel-K.O.

## Entwickeln

Voraussetzung: Node.js 18 oder neuer.

```sh
npm install
npm run dev
```

`npm run dev` startet einen lokalen Server; die Adresse steht in der Ausgabe (meist http://localhost:5173).

Falls `npm install` wegen eines kaputten npm-Caches mit Berechtigungsfehlern abbricht, mit einem anderen Cache-Ordner installieren, z. B. `npm_config_cache=/tmp/npm-cache npm install`.

Tests und Prüfungen:

```sh
npm test
npm run lint
```

## Bauen

```sh
npm run build
```

Das Ergebnis liegt in `dist/`: eine `index.html` und der Ordner `assets/`. Die Pfade sind relativ, die App läuft also in jedem Unterordner.

Lokal ansehen: `npm run preview`.

## Veröffentlichen

**Netlify Drop:** https://app.netlify.com/drop öffnen und den Ordner `dist/` in das Browserfenster ziehen. Netlify gibt eine Adresse zurück, unter der die App erreichbar ist.

**GitHub Pages:** den Inhalt von `dist/` in einen eigenen Branch (z. B. `gh-pages`) legen und in den Repository-Einstellungen unter „Pages“ diesen Branch als Quelle auswählen.

Die gespeicherten Turniere liegen im Browser des Geräts, nicht auf dem Server. Wer das Gerät wechselt, sollte vorher unter „Export“ sichern.
