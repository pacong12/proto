# Trading- und Swap-Leitfaden

Das Kaufen und Verkaufen von Tokens auf Goton ist auf Schnelligkeit, Reaktionsfähigkeit und Sicherheit ausgelegt. Jeder Trade wird nicht-verwahrend über deine persönliche Wallet ausgeführt.

---

## Wie man Tokens Kauft

1. **Wähle einen Token**: Durchsuche die **Explore**-Seite oder klicke auf eine beliebige Token-Karte, um ihre eigene Trade View zu öffnen.
2. **Prüfe Chart und Metriken**:
   - Sieh dir die Live-Preiskerzen und die 24-Stunden-Volumentrends an.
   - Prüfe, ob der Token aktuell **On Curve** (auf dem Weg zur Graduation) oder **Graduated** (Handel auf der Uniswap-DEX) ist.
   - Prüfe Community-Metriken, Top-Holder und Creator-Status-Abzeichen.
3. **Wähle den Kaufmodus**: Stelle im Trading-Panel rechts sicher, dass der **Buy**-Tab aktiv ist.
4. **Gib den Betrag ein**:
   - Tippe den Betrag ein, den du ausgeben möchtest (ETH auf Robinhood Chain, USDC auf Arc), oder nutze die Schnellauswahl-Buttons. Du kannst den Betrag auch in USD eingeben.
   - Das Panel berechnet automatisch deine geschätzten erhaltenen Tokens.
5. **Passe den Slippage an (Optional)**:
   - Klicke auf das Zahnrad-Symbol, um deine Slippage-Toleranz zu konfigurieren (Voreinstellungen 0,5 %, 1 %, 2,5 % und 5 %, ein eigener Wert oder Auto).
   - Die Slippage-Toleranz sorgt dafür, dass deine Order automatisch storniert wird, wenn sich der Preis über deine gewählte Schwelle hinaus gegen dich bewegt.
6. **Bestätige den Swap**: Klicke auf **Buy [Token-Symbol]** und signiere die Transaktion in deiner Wallet.

---

## Wie man Tokens Verkauft

1. Öffne die Trade View des Tokens, den du hältst.
2. Wähle den **Sell**-Tab im Trading-Panel.
3. Gib die Menge der zu verkaufenden Tokens ein oder nutze die Prozent-Shortcuts (`25%`, `50%`, `75%`, `100% / Max`).
4. Prüfe die geschätzte ETH-Auszahlung, die du erhältst.
5. Klicke auf **Sell [Token-Symbol]**:
   - Erster Verkauf? Deine Wallet fordert eine einmalige Ein-Klick-Freigabe, damit der Smart Contract deine Tokens verarbeiten darf.
   - Bestätige die Verkaufstransaktion, um ETH direkt in deine Wallet zu erhalten.

---

## Preisauswirkung und Slippage Verstehen

- **Preisauswirkung**: Im dezentralen Handel verschiebt der Kauf eines großen Prozentsatzes der verfügbaren Tokens den Preis nach oben. Bei Bonding-Curve-Tokens ändert sich der Preis vorhersehbar nach der Curve-Formel ($x \cdot y = k$).
- **Slippage**: Schützt dich vor Front-Running. Wenn zwischen dem Klick auf „Buy“ und der Block-Bestätigung andere Trades stattfinden, erhält dein Trade garantiert mindestens deine erwarteten Minimal-Tokens, oder er wird sicher storniert, ohne deine Mittel auszugeben.

---

## Eine Token-Seite Lesen

- **Market-Cap** ist der aktuelle Gesamtwert des Tokens: Preis × Gesamt-Supply (1 Milliarde). Sie bewegt sich mit dem Preis, auch wenn niemand handelt.
- **24h-Volumen** ist der Wert jedes Kaufs und Verkaufs der letzten 24 Stunden. Ein Token kann eine hohe Market-Cap und kein Volumen haben: wertvoll, aber ruhig.
- **24h-Änderung** vergleicht den Preis mit dem von vor 24 Stunden. Ein Token, der in diesem Fenster nicht gehandelt wurde, zeigt 0 %.
- **Kauf-/Verkaufsdruck** teilt das jüngste Volumen in Käufe und Verkäufe über 5 Minuten, 1 Stunde, 6 Stunden oder 24 Stunden.
- **Holder** listet die größten Bestände. Die Bonding Curve (oder der Pool nach der Graduation) wird als solche gekennzeichnet, nicht als Nutzer angezeigt.
- **Top-Trader** listet Käufe, Verkäufe, aktuellen Bestand und Gewinn jeder Wallet.
- Der **Chart** zeigt Preis oder Market-Cap in Kerzen von 1 Sekunde bis 1 Tag. Balken ohne Trades werden grau gezeichnet.
- Auf Explore ist der kleine **Graph** neben jedem Token sein Preis vom Launch bis jetzt.

---

## Limit, Take-Profit und Stop-Loss

Um zu einem Ziel statt zum Live-Preis zu kaufen oder zu verkaufen, nutze die Tabs **Limit** und **TP / SL** im Trading-Panel. Siehe [Limit-, Take-Profit- und Stop-Loss-Orders](/de/protocol/advanced-orders).
