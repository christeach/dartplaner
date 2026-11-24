# Dartplaner – Design

Stand: 2026-11-24 · Status: Freigegeben am 2026-11-24

Markierung: **[Entscheidung Claude]** = vom Entwickler festgelegt, nicht vom Verein vorgegeben. Alles andere kommt vom Auftraggeber.

## 1. Zweck und Warum

Ein Dartverein will Turnierabende ohne Zettel/Excel planen und durchführen. Eine Person sitzt an einem Gerät (Laptop/Tablet), gibt Spieler ein, wählt einen Modus, das Tool erstellt Paarungen, verteilt Spiele auf die Boards, nimmt Leg-Ergebnisse entgegen, berechnet Tabellen und nächste Runden und exportiert am Ende Ergebnisse.

Der heute gespielte Modus („2 Ligen + K.O. + Platzierungsspiele“) muss exakt abgebildet werden. Andere gängige Modi sollen wählbar sein.

## 2. Ziele

- Turnier in wenigen Minuten anlegen: Name, Datum, Spielernamen, Modus, Legs, Boardanzahl.
- Paarungen, Tabellen und Folgerunden automatisch und fehlerfrei.
- Bedienung während des Abends über eine Board-Ansicht (Variante A, vom Verein gewählt).
- Export: PDF zum Aushängen, Excel mit allen Ergebnissen und Highlights.
- Komplett kostenlos (Tech, Hosting, Bibliotheken).

## 3. Nicht-Ziele

- Kein Scorer/Zähler für 501-Aufnahmen, kein Checkout-Rechner.
- Keine Benutzerkonten, kein Server, keine Datenbank, keine Mehrgeräte-Synchronisation.
- Keine dauerhafte Spielerdatenbank oder Jahreswertung im Tool (die Excel-Datei dient dafür).
- Keine Zeitplanung/Uhr.
- Schweizer System **[Entscheidung Claude]**: in Dart unüblich, nicht in Version 1.

## 4. Anti-Ziele (wäre ein Fehlschlag, auch wenn es „funktioniert“)

- Falsche Tabelle, falsche Kreuzpaarung oder falscher Turnierbaum.
- Datenverlust mitten im Turnier durch versehentliches Neuladen.
- Bedienung, die am Abend mehr Tippen erfordert als ein Zettel.
- Generisch wirkende „AI-Optik“ – UI wird mit `/unslop-anything` geprüft.

## 5. Rahmenbedingungen

- Kostenlos umsetzbar und hostbar.
- Daten nur für die Sitzung; Zwischenspeicherung im Browser erlaubt.
- Ein Gerät, eine bedienende Person.
- Boardanzahl variabel, Standard 4.
- Sprache der Oberfläche: Deutsch.
- UX-Erstellung mit Skill `/ui-ux-pro-max:design`, anschließende Prüfung mit `/unslop-anything` (Vorgabe Auftraggeber).

## 6. Ablauf

### 6.1 Turnier anlegen

1. Turniername, Datum (Standard: heute).
2. Spielernamen: einzeln oder mehrere zeilenweise einfügen. Leere und doppelte Namen (Groß/Klein ignoriert, Leerzeichen getrimmt) werden abgewiesen.
3. Modus wählen (Standard: „Gruppen + K.O.“ mit 2 Gruppen und Platzierungsspielen = Vereinsmodus).
4. Legs zum Sieg („first to N“) getrennt für: Gruppe/Liga, K.O.-Runden, Finale. **[Entscheidung Claude]** Standard 3 / 3 / 4. Platzierungsspiele nutzen den K.O.-Wert.
5. Anzahl Boards (Standard 4, min. 1).
6. Auslosen: Spieler werden zufällig verteilt (Gruppen bzw. K.O.-Baum). Bei ungerader Zahl bekommt eine Gruppe einen Spieler mehr (allgemein: Gruppengrößen unterscheiden sich um max. 1). **[Entscheidung Claude]** Vor dem Start: „Neu auslosen“ und manuelles Tauschen zweier Spieler möglich. Nach Start ist die Einteilung fest.

Mindestspielerzahl je Modus wird geprüft; ist sie unterschritten, Hinweis und Vorschlag „Jeder gegen jeden“.

### 6.2 Während des Turniers – Board-Ansicht (Hauptbildschirm)

- Reiter: **Boards** · **Tabellen** · **K.O.** · **Export**.
- Pro Board eine Kachel: läuft (Spieler, Runde/Gruppe, Legs zum Sieg, Button „Ergebnis eintragen“) oder frei (Vorschlag nächstes Spiel, Button „Spiel starten“, Möglichkeit ein anderes offenes Spiel zu wählen).
- Unter den Kacheln: Liste der nächsten offenen Spiele.
- Vorschlagslogik **[Entscheidung Claude]**: nur Spiele, deren beide Spieler gerade an keinem Board stehen und deren Spiel spielbar ist (K.O.: beide Teilnehmer feststehend). Priorität: Spieler mit der längsten Pause (Zeitpunkt ihres letzten beendeten Spiels; noch nie gespielt = höchste Priorität), danach Rundenreihenfolge. In der K.O.-Phase Platzierungsspiele und Hauptrunde gemischt, frühere Runde zuerst.
- Spiele lassen sich auch ohne Board-Zuordnung eintragen (falls am Board etwas anderes passiert ist).
- Ein gestartetes Spiel lässt sich wieder abbrechen (zurück in die offenen Spiele).

### 6.3 Ergebnis eintragen

- Dialog: pro Spieler Tipp-Buttons 0…N (N = Legs zum Sieg). Gültig nur, wenn genau ein Spieler N Legs hat und der andere < N. Kein Unentschieden.
- Optional ausklappbar, pro Spieler: Anzahl 180er, Highscore (höchste Aufnahme, 1–180), Highfinish (höchstes Finish, 2–170), Shortleg (wenigste Darts für ein Leg, min. 9). Plausibilitätsprüfung der Wertebereiche.
- Speichern beendet das Spiel, gibt das Board frei, aktualisiert Tabellen/Baum.

### 6.4 Korrekturen **[Entscheidung Claude]**

- Gruppen-/Ligaspiel: Ergebnis jederzeit änderbar bis die K.O.-Phase gestartet ist; Tabelle wird neu berechnet.
- K.O.-Spiel: änderbar, solange kein Folgespiel, das von diesem Ergebnis abhängt, gestartet oder beendet ist.
- Highlights sind immer änderbar.

### 6.4a Spieler fällt aus

Vorgabe Verein: Wer nicht erscheint, wird nicht ausgelost. Wer früher geht, wird ab dem Zeitpunkt nicht mehr berücksichtigt. Umsetzung **[Entscheidung Claude]**:
- Aktion „Spieler abmelden“ (mit Rückfrage), jederzeit nach Start.
- Gruppenphase: bereits gespielte Ergebnisse bleiben in der Wertung (auch für die Gegner), offene Spiele des Spielers entfallen. Der Spieler kann sich nicht für die K.O.-Runde qualifizieren; er wird bei der Qualifikation übersprungen, der Nächste rückt nach. Er steht am Ende seiner Gruppe und bekommt keinen Platz in Platzierungsspielen (letzter Platz, bei mehreren geteilt).
- K.O.-Phase / Platzierungsspiele: sein offenes Spiel wird als kampflos für den Gegner gewertet (Freilos, kein Leg-Ergebnis, kein Board). Platz = der Platz, den er als Verlierer dieses Spiels bekommen hätte.
- Ergebnistyp im Datenmodell: Leg-Ergebnis oder „kampflos“. Im Export als „kampflos“ ausgewiesen.

### 6.5 Übergang Gruppen → K.O.

Wenn alle Gruppenspiele beendet sind: Abschlusstabellen anzeigen. Falls eine für das Weiterkommen oder die Platzierungsspiele relevante Gleichheit nach allen Kriterien besteht → „Stechen nötig“: Bedienperson wählt die Reihenfolge (z. B. nach Bull-Off am Board). Danach Bestätigen → K.O.-Baum und Platzierungsspiele werden erzeugt.

### 6.6 Ende

Wenn alle Spiele beendet sind: Endplatzierung anzeigen, Export anbieten. „Neues Turnier“ löscht den Stand (mit Rückfrage).

## 7. Wertung (Gruppen und „Jeder gegen jeden“) **[Entscheidung Claude, nach Ligaüblichkeit]**

Reihenfolge der Kriterien:
1. Punkte (Sieg 2, Niederlage 0)
2. Leg-Differenz
3. Mehr gewonnene Legs
4. Direkter Vergleich (nur zwischen den punktgleichen Spielern; bei 3+ Spielern Mini-Tabelle aus deren Spielen nach 1–3). Trennt die Mini-Tabelle nur einen Teil, wird sie für die verbleibenden Gleichen neu berechnet, bis nichts mehr trennt. **[Entscheidung Claude]**
5. Stechen (manuell, siehe 6.5)

Die Kriterien hat der Verein ausdrücklich dem Entwickler überlassen („Entscheide du“).

Gleichstand in der Endwertung außerhalb des Übergangs Gruppe → K.O. **[Entscheidung Claude]**: Bei „Jeder gegen jeden“ ohne Finale wird Gleichheit um Platz 1 per Stechen entschieden, alle anderen Gleichheiten ergeben einen geteilten Platz.

Tabellenspalten: Platz, Name, Spiele, Siege, Niederlagen, Legs (gewonnen:verloren), Leg-Differenz, Punkte.

## 8. Modi

### 8.1 Gruppen + K.O. (inkl. Vereinsmodus)

Parameter: Anzahl Gruppen (2–8), Platzierungsspiele an/aus, Spiel um Platz 3 an/aus (Standard an).

In jeder Gruppe: jeder gegen jeden, einfach.

**Vereinsmodus (2 Gruppen „Liga A“/„Liga B“) – exakt so umsetzen:**
- Hat **jede** Liga ≥ 6 Spieler: die ersten 4 jeder Liga ins Viertelfinale, über Kreuz:
  - VF1: A1 – B4
  - VF2: B2 – A3
  - VF3: B1 – A4
  - VF4: A2 – B3
  - HF1: Sieger VF1 – Sieger VF2; HF2: Sieger VF3 – Sieger VF4 (so treffen A1 und B1 erst im Finale aufeinander).
  - Finale, Spiel um Platz 3.
  - VF-Verlierer spielen Platz 5–8 aus: Verlierer VF1 – Verlierer VF2 und Verlierer VF3 – Verlierer VF4; deren Sieger spielen um Platz 5, Verlierer um Platz 7. **[Entscheidung Claude]**
- Sonst (eine Liga < 6 Spieler): die ersten 2 jeder Liga ins Halbfinale: A1 – B2, B1 – A2, dann Finale und Spiel um Platz 3.
- Restplätze (Platzierungsspiele, wenn aktiviert): ab dem ersten nicht qualifizierten Platz über Kreuz, jeweils ein Spiel: A5 – B5 um Platz 9, A6 – B6 um Platz 11, … (bzw. bei Halbfinal-Variante A3 – B3 um Platz 5, A4 – B4 um Platz 7, …). Verlierer bekommt den folgenden Platz. Wer in der größeren Liga bei den Platzierungsspielen kein Gegenüber hat (z. B. A7 bei 7:6 Spielern), bekommt ohne Spiel den letzten Platz (vom Verein bestätigt). In der Liga selbst spielt trotzdem jeder gegen jeden; bei ungerader Gruppengröße hat jeweils ein Spieler Pause, das regelt die Board-Vorschlagslogik.
- Mindestens 4 Spieler gesamt (2 pro Liga).
- Schalter „Platzierungsspiele aus“ **[Entscheidung Claude]**: betrifft alle Platzierungsspiele, auch Platz 5–8. Dann gibt es nur Hauptrunde plus (optional) Spiel um Platz 3; VF-Verlierer teilen Platz 5–8, nicht Qualifizierte teilen Plätze nach Ligarang (A5/B5 = geteilter Platz 9 usw.).

**Mehr als 2 Gruppen [Entscheidung Claude, üblicher Standard]:**
- K.O.-Feld = 4, 8 oder 16 Spieler. Obergrenze pro Gruppe: insgesamt (direkt Qualifizierte **und** Auffüller) höchstens die Hälfte der kleinsten Gruppe, aufgerundet. Das Tool wählt das größte Feld, das sich damit füllen lässt; Bedienperson kann ein kleineres wählen. Beispiel 3 Gruppen à 4: max. 2 pro Gruppe = 6 < 8 → Feld 4 (3 Gruppensieger + bester Zweiter). Beispiel 4 Gruppen à 5: max. 3 pro Gruppe → Feld 8 (je 2 direkt). **[Entscheidung Claude]**
- Qualifikation: pro Gruppe die ersten k; fehlende Plätze werden durch die besten Nächstplatzierten aller Gruppen aufgefüllt (z. B. „beste Gruppendritte“), verglichen nach Punkten, dann Leg-Differenz, dann gewonnenen Legs, jeweils pro Spiel normiert, wenn Gruppengrößen ungleich sind; Restgleichheit → Stechen.
- Setzung: Gruppensieger gegen Zweite anderer Gruppen (bzw. Auffüller), gespiegelt, sodass Spieler derselben Gruppe sich frühestmöglich erst im Finale treffen bzw. so spät wie möglich. Exakter Algorithmus bleibt dem Entwickler, muss diese Eigenschaft erfüllen und getestet sein.
- Platzierungsspiele bei > 2 Gruppen: nur für die K.O.-Verlierer (5–8 wie oben, analog für 9–16); nicht Qualifizierte teilen sich Plätze nach Gruppenrang (alle Gruppendritten nicht qualifiziert = gleicher Platzbereich, sortiert nach den Kriterien oben).

### 8.2 Jeder gegen jeden

Eine Tabelle, alle gegen alle einfach. Sieger = Tabellenerster. Option „Finale der ersten 2“ (Standard aus). Mindestens 3 Spieler.

### 8.3 K.O. (einfach)

Zufällige Auslosung. Feldgröße = nächste Zweierpotenz; Freilose so verteilt, dass in Runde 1 kein Spiel aus zwei Freilosen besteht (Freilose gleichmäßig auf beide Baumhälften). Freilos = automatisches Weiterkommen, kein Board. Spiel um Platz 3 optional (Standard an). Übrige Plätze geteilt nach Ausscheiderunde (z. B. „5.–8.“). Mindestens 3 Spieler.

### 8.4 Doppel-K.O.

Gewinnerrunde wie 8.3. Verlierer fallen in die Verliererrunde (Standard-Doppel-K.O.-Struktur). Zweite Niederlage = Aus. Finale: Sieger Gewinnerrunde gegen Sieger Verliererrunde, **ein** Spiel ohne Reset. Plätze: 1, 2, 3 (Verlierer Finale Verliererrunde), danach geteilt nach Ausscheiderunde. Freilose wie 8.3. Mindestens 4 Spieler.

## 9. Export

- **PDF**: über Druckansicht des Browsers („Als PDF speichern“/Drucken), eigenes Druck-Layout A4: Turniername, Datum, Endplatzierung (groß), K.O.-Baum, Gruppen-Abschlusstabellen, Highlights (meiste 180er, höchster Highscore, höchstes Finish, kürzestes Leg, jeweils mit Spieler).
- **Excel (.xlsx)**, Blätter:
  - „Spiele“: Phase/Runde, Gruppe, Board, Spieler 1, Spieler 2, Legs 1, Legs 2, Sieger, plus Highlight-Spalten je Spieler.
  - „Tabellen“: je Gruppe die Abschlusstabelle (Spalten wie Kap. 7).
  - „Platzierung“: Platz, Name.
  - „Highlights“: pro Spieler Summe 180er, bester Highscore, bestes Highfinish, bestes Shortleg.
- Dateiname: `<Turniername>_<JJJJ-MM-TT>.xlsx`.

## 10. Technik **[Entscheidung Claude]**

- React + TypeScript, Build mit Vite, reine Single-Page-App ohne Backend.
- Hosting kostenlos als statische Seite (GitHub Pages oder Netlify).
- Zustand im Speicher, gespiegelt in `localStorage` (bei jeder Änderung schreiben, beim Start lesen; Lesefehler → leerer Start mit Hinweis). Ein Turnier zur Zeit.
- Excel: SheetJS (`xlsx`), PDF: CSS-Druck-Layout (`@media print`), keine PDF-Bibliothek.
- Turnierlogik (Auslosung, Paarungen, Wertung, Baum, Vorschläge) als reine Funktionen ohne UI-Abhängigkeit, mit Vitest getestet. Zufall injizierbar (Seed) für Tests.
- Optimiert für Laptop und Tablet (Querformat); auf dem Handy benutzbar, aber nicht Hauptziel.

## 11. Dem Entwickler überlassen

- Projektstruktur, State-Management innerhalb von React, Komponentenaufteilung.
- Exakter Setzungsalgorithmus bei > 2 Gruppen und Doppel-K.O.-Verliererbaum-Zuordnung (Eigenschaften oben müssen erfüllt sein).
- Visuelles Design (über `/ui-ux-pro-max:design`, geprüft mit `/unslop-anything`).
- Darstellung des K.O.-Baums.
