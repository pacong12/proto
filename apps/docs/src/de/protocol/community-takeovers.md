# Community Takeovers (CTO)

Was passiert, wenn ein Token-Entwickler sich aus einem Projekt zurückziehen möchte?

Auf Goton kann ein Creator seinen Gebührenstrom an die Community übergeben, die das Projekt weiterträgt. Das ist immer die eigene Entscheidung des Creators. Niemand sonst, auch nicht das Protokoll, kann die Gebühren eines Creators bewegen.

---

## Was ist ein Community Takeover?

Ein Community Takeover geschieht, wenn Community-Mitglieder einen Token übernehmen, das Marketing fortführen, Social-Links aktualisieren und das Community-Wachstum aufrechterhalten.

Goton unterstützt dies über eine Umleitung im Fee-Splitter des Tokens:

1. **Vorschlagen**: Der Creator schlägt eine Community-Wallet, ein Multisig oder eine DAO-Adresse auf der **Profil**-Seite vor (Tab **Created**, **Manage CTO**).
2. **48 Stunden warten**: Der Vorschlag kann während dieses Timelocks nicht wirksam werden, damit ihn alle kommen sehen. Der Creator kann ihn bis zur Annahme stornieren. Ein neuer Vorschlag ersetzt den alten und startet die Wartezeit neu.
3. **Annehmen**: Nach dem Timelock nimmt der Creator oder der vorgeschlagene Empfänger an. Von da an geht der Creator-Anteil der Gebühren an den neuen Empfänger.
4. **Sperren (optional)**: Der Creator kann den aktuellen Empfänger dauerhaft sperren. Dies ist unumkehrbar und verwirft jeden ausstehenden Vorschlag, also nimm den neuen Empfänger an, bevor du sperrst.

Bis der Empfänger gesperrt ist, kann der Creator jederzeit eine neue Umleitung starten, wieder mit dem 48-Stunden-Timelock.

Der umgeleitete Betrag hängt vom Token ab. Der Creator wählt, wie der Creator-Anteil aufgeteilt wird, daher deckt die Umleitung nur den dem **Creator** zugewiesenen Teil ab. Holder-, Buyback- und Liquiditätsanteile behalten ihre Ziele. Siehe [Creator-Gebühren und Belohnungen](./fees-and-burns.md).

---

## Wie man einen Takeover Beantragt

1. **Organisiere einen Empfänger**: Richte ein von der Community kontrolliertes Multisig oder eine DAO ein, statt der persönlichen Wallet eines Mitglieds.
2. **Frage den Creator**: Kontaktiere den Creator öffentlich und teile die Empfängeradresse, damit die Anfrage von allen geprüft werden kann.
3. **Beobachte den Vorschlag**: Sobald der Creator die Adresse vorschlägt, prüfe, dass es genau die vereinbarte ist.
4. **Nach 48 Stunden annehmen**: Der Empfänger kann annehmen, ohne auf den Creator zu warten.
5. **Fordere die Sperre und verifiziere sie**: Ohne die Sperre kann der Creator die Gebühren später erneut umleiten.

Um on-chain zu verifizieren, öffne den Fee-Splitter des Tokens im Block-Explorer und lies diese Werte:

- `creatorRecipient()`: die Adresse, die die Gebühren jetzt erhält.
- `creatorRecipientLocked()`: `true` bedeutet, diese Adresse kann sich nie ändern.
- `pendingCreatorRecipient()` und `pendingCreatorRecipientValidAfter()`: jeder Vorschlag, der auf seinen Timelock wartet.

Die Trading-Seite des Tokens zeigt außerdem ein **Community**-Abzeichen, wenn die Gebühren an jemand anderen als den Creator gehen, und sein Tooltip gibt an, wann der Empfänger gesperrt ist.

Einige Grenzen zu beachten:

- **Kein Creator, keine Umleitung**: Ist ein Creator verschwunden und hat nie eine Umleitung vorgeschlagen, bleibt der Gebührenstrom bei ihm. Eine Community kann den Token sozial weiterhin übernehmen, aber weder sie noch Goton können diese Gebühren beanspruchen.
- **Ältere Splitter haben keine Sperre**: Fee-Splitter, die vor der Existenz der Sperre deployt wurden, können umleiten, aber nicht sperren, sodass der Creator immer erneut umleiten kann. Die Profil-Seite zeigt, wenn die Sperre nicht verfügbar ist.
- **Robinhood Chain**: Ein Token erhält seinen Fee-Splitter bei der Graduation, daher ist eine Umleitung erst danach möglich.

---

## Sicherheits- und Schutzgarantien

- **Liquidität ist Unberührbar**: Die Liquidität bleibt dauerhaft gesperrt, im Liquidity Locker auf Robinhood Chain und in der Launch-Factory für Arcs Uniswap-v4-Pools. Ein Community Takeover kann die Pool-Liquidität nicht abheben, migrieren oder abziehen.
- **Der Token-Vertrag ist Unveränderlich**: Token-Regeln, Gesamt-Supply (1 Milliarde) und Transferparameter können von niemandem geändert oder neu konfiguriert werden.
- **Der Protokollanteil ist Getrennt**: Eine Umleitung ändert nur, wer den Creator-Anteil erhält. Sie kann weder den Protokollanteil noch die anderen Anteile der Aufteilung berühren.
- **Nicht-verwahrende Transparenz**: Alle Gebührenforderungen und Umleitungen werden on-chain zur öffentlichen Verifizierung aufgezeichnet.
