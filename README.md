# Robin Hood – Die Legende von Sherwood

Ein klassisches Jump ’n’ Run im Mittelalter: Als Robin Hood streifst du mit Pfeil und Bogen
durch den Sherwood Forest, das Dorf Locksley und die Gassen von Nottingham – bis hinauf in die
Burg des Sheriffs. Unterwegs legst du dich mit seinen Häschern an, nimmst den Reichen das Gold ab
und gibst es den Armen.

Das Spiel läuft komplett im Browser (HTML5-Canvas, reines JavaScript), ohne Build-Schritt und ohne
externe Grafik- oder Audiodateien: Alle Pixelgrafiken, Hintergründe, Soundeffekte und die Musik
werden zur Laufzeit erzeugt.

## Spielen

- **Lokal:** `index.html` im Browser öffnen – fertig. (Für die Pixel-Schriften wird Internet
  benötigt, ohne fällt das Spiel auf Standardschriften zurück.)
- **Mit lokalem Server** (empfohlen, falls der Browser lokale Dateien einschränkt):
  ```bash
  python3 -m http.server 8000
  ```
  und dann <http://localhost:8000> öffnen.
- **GitHub Pages:** Im Repository unter *Settings → Pages* als Quelle „Deploy from a branch“,
  Branch `main`, Ordner `/ (root)` wählen. Das Spiel ist danach unter
  `https://<benutzer>.github.io/robinhood/` erreichbar.

## Steuerung

| Aktion                | Tastatur                         | Gamepad            |
|-----------------------|----------------------------------|--------------------|
| Laufen                | ← → oder A D                     | Stick / Steuerkreuz|
| Springen              | Leertaste, Z oder K (halten = höher) | A              |
| Schießen              | X oder J – halten für Kraftschuss | X / B / R         |
| Schräg nach oben zielen | ↑ oder W halten                | Stick nach oben    |
| Schräg nach unten zielen | ↓ halten (im Sprung)          | Stick nach unten   |
| Durch Äste fallen     | ↓ + Springen                     | ↓ + A              |
| Pause                 | Esc oder P                       | Start              |
| Ton an/aus · Vollbild | M · F                            | –                  |

Auf Smartphones und Tablets erscheinen Touch-Knöpfe am Bildschirmrand.

## Das Spiel

**Vier Kapitel**

1. **Sherwood Forest** – Einführung mit Hinweisschildern, Baumkronen, einem Fluss mit
   treibenden Flößen und einer Dornengrube.
2. **Das Dorf Locksley** – Strohdächer, Heuhaufen als Sprungfedern, morsche Stege über dem
   Mühlbach und Dorfbewohner, denen du dein Gold schenken kannst.
3. **Die Gassen von Nottingham** – Stadtmauern mit Armbrustschützen, Lastenaufzüge,
   Fallgitter, die sich nur per Treffer auf eine Zielscheibe öffnen – und am Burgtor
   **Sir Guy von Gisborne**.
4. **Burg Nottingham** – nächtliche Zinnen im Fackelschein, Abgründe, Ritter und zum Schluss
   **der Sheriff von Nottingham** persönlich.

**Robin kann …**
- laufen, springen (variable Sprunghöhe), durch Äste fallen
- Pfeile schießen – geradeaus, schräg nach oben oder im Sprung schräg nach unten
- den Bogen spannen: Ein **Kraftschuss** fliegt weiter, durchschlägt mehrere Gegner und
  bringt Ritter ins Taumeln
- Wachen auf den Helm springen (mit Kombo-Bonus)
- Kisten zerschießen und Bolzen in der Luft abfangen

**Die Häscher des Sheriffs:** Soldaten mit Schwert, Speerträger, Armbrustschützen,
Ritter mit Schild (blocken normale Pfeile von vorn) und Bluthunde.

**Gold & Ruhm:** Goldtaler und Goldsäcke einsammeln, an Dorfbewohner verschenken (bringt Ruhm
und heilt), jeder 50. Taler schenkt ein Extraleben. Banner sind Rastplätze, an denen du nach
einem Missgeschick weitermachst. Am Ende jedes Kapitels gibt’s eine Abrechnung mit Zeitbonus;
freigespielte Kapitel und der beste Ruhm werden im Browser gespeichert.

## Projektaufbau

```
index.html          Seite mit Canvas und Touch-Knöpfen
css/style.css       Layout, Touch-Steuerung
js/core.js          Konstanten, Eingabe (Tastatur/Gamepad/Touch), Speicherstand, Klang & Musik
js/levels.js        Die vier Level als ASCII-Karten (mit Legende)
js/world.js         Levelraster, Kachelkollision
js/art.js           Pixelkunst: Kacheln, Parallax-Hintergründe, Figuren, Requisiten
js/entities.js      Robin, Pfeile, Geschosse, Schätze, bewegliche Plattformen, Dorfbewohner
js/enemies.js       Gegner und die beiden Endgegner
js/game.js          Spielablauf, Menüs, Kamera, Licht, HUD
tools/check-levels.js  Prüft Kartenbreiten und Erreichbarkeit von Ziel, Bannern und Schätzen
```

## Eigene Level bauen

Die Level in `js/levels.js` bestehen aus Abschnitten, die nebeneinander gesetzt werden – jedes
Zeichen ist eine 16×16-Kachel (Legende oben in der Datei). Nach Änderungen prüft

```bash
node tools/check-levels.js --print
```

ob alle Zeilen gleich breit sind und Ziel und Banner mit Robins Sprungweite erreichbar bleiben.

Zum Testen lässt sich ein Kapitel direkt starten: `index.html?level=3&x=120`
(`level` = Kapitel 1–4, `x` = Spalte, `god=1` = unverwundbar, `debug=1` = Trefferboxen).

## Lizenz der Schriften

Die Schriften „Pixelify Sans“ und „Jacquarda Bastarda 9“ werden von Google Fonts geladen und
stehen unter der SIL Open Font License.
