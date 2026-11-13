# Protokoll-Analytics

Die **Analytics**-Seite bietet eine Live-Übersicht über die Aktivität auf Goton im gesamten Netzwerk — wie viel gehandelt wird, wie viele Tokens gelauncht werden und welche Gebühren das Protokoll erzeugt — für das Netzwerk, auf dem du dich gerade befindest.

---

## Das Hauptdiagramm

Ein einziges interaktives Diagramm zeichnet eine Metrik über die **letzten 24 Stunden**, in Abschnitten. Wechsle die Metrik:

| Metrik       | Was gezeichnet wird                       |
| :----------- | :---------------------------------------- |
| **Volume**   | Handelsvolumen im Zeitverlauf             |
| **Launches** | Gelaunchte Tokens im Zeitverlauf          |
| **Fees**     | Erzeugte Protokollgebühren im Zeitverlauf |

Wechsle zwischen einer **geglätteten Flächen**- und einer **Balken**-Ansicht. Alles ist auf das **aktive Netzwerk** (Robinhood oder Arc) beschränkt — wechsle das Netzwerk über die Kopfzeile, um die Zahlen der anderen Chain zu sehen.

---

## Kennzahlen

Unter dem Diagramm zeigen Übersichtskarten die Gesamtzahlen des Netzwerks, darunter:

- **Gesamtes Handelsvolumen** — das Gesamtvolumen im Netzwerk.
- **Gesamtzahl gelaunchter Tokens** — wie viele Tokens erstellt wurden.
- **Steuer-/Gebührenschätzung** — eine Schätzung der erzeugten Gebühren.
- **Buyback** — Rückkaufaktivität des Protokolls, sofern vorhanden.

Eine Liste **Top-Tokens** sortiert Tokens nach Market-Cap, damit du direkt von der Makro-Ansicht zur Trade-Seite eines bestimmten Tokens springen kannst.

---

## Hinweise

- Die Zahlen werden aus **On-Chain-Daten** gebildet und aktualisieren sich, während neue Blöcke verarbeitet werden. Willst du dieselben Zahlen für dein eigenes Tool? Sie stehen in der [Public API](/integration/api).
- Analytics sind **pro Netzwerk**: Die Seite spiegelt stets die in der Kopfzeile gezeigte Chain wider und weist darauf in ihrem Geltungsbereich-Hinweis hin.
- Die Zahlen stammen vom Indexer und aktualisieren sich, während neue Blöcke verarbeitet werden; das 24-Stunden-Fenster ist eine gleitende Ansicht, kein Kalendertag.
