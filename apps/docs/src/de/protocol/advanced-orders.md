# Limit-, Take-Profit- und Stop-Loss-Orders

Neben dem Kaufen und Verkaufen zum Live-Preis hat das Trading-Panel zwei weitere Tabs: **Limit** und **TP / SL**. Beide platzieren eine Order im `GotonLimitOrders`-Vertrag, der deine Mittel hält, bis die Order ausgeführt wird oder du sie stornierst.

---

## Die Drei Order-Typen

| Order           | Was du hinterlegst              | Wird ausgeführt, wenn                                                             |
| :-------------- | :------------------------------ | :-------------------------------------------------------------------------------- |
| **Limit buy**   | ETH (Robinhood) oder USDC (Arc) | Die Market-Cap auf dein Ziel fällt, du erhältst mindestens die zugesagten Tokens  |
| **Take profit** | Tokens                          | Die Market-Cap auf dein Ziel steigt, du erhältst mindestens den zugesagten Betrag |
| **Stop loss**   | Tokens                          | Die Market-Cap auf deinen Stop fällt, dann Verkauf mit deinem Slippage-Limit      |

Ziele werden als **Market-Cap in USD** eingegeben, die die App in den On-Chain-Preis und das Minimum, das du erhältst, umrechnet. Dieses Minimum berücksichtigt bereits die Pool- oder Curve-Gebühr, die Token-Steuer und die Executor-Gebühr von 0,1 %, sodass eine Order ausgeführt wird, wenn der Markt dein Ziel erreicht, nicht später.

Ein Take Profit und ein Stop Loss können sich eine Einzahlung teilen (**one-cancels-other**): Die erste ausgeführte Seite schließt die Order und die andere ist weg.

---

## Wie Orders Ausgeführt Werden

- **Jeder kann eine Order ausführen**, sobald ihre Bedingung erfüllt ist. Goton betreibt einen Keeper, der offene Orders alle 15 Sekunden prüft und ausführt, aber der Vertrag akzeptiert jeden Aufrufer.
- **Der Ausführende verdient 0,1 %** der Quote-Seite (die Executor-Gebühr). Der Keeper führt nur aus, wenn diese Gebühr sein Gas deckt, sodass sehr kleine Orders warten müssen, bis jemand anderes sie ausführt oder du stornierst.
- **Stop Losses nutzen einen manipulationsresistenten Preis.** Auf einer Bonding Curve löst der Stop nur aus, wenn sowohl der Spot-Preis der Curve als auch ihr TWAP (zeitgewichteter Durchschnitt über etwa 10 bis 20 Minuten) auf oder unter deinem Stop liegen. Bei einem Uniswap-v4-Pool funktioniert es genauso, mit dem Spot-Preis des Pools und seinem 30-Minuten-TWAP aus dem Goton-Hook. In beiden Fällen kann der Preis-Push eines einzelnen Blocks deinen Stop nicht auslösen, und ein Stop feuert nicht, sobald sich der Preis darüber erholt hat. Ein Stop wartet, bis der Preis genug Historie hat: etwa 10 Minuten bei einem neuen Token und 30 Minuten, nachdem ein Token in seinen Pool graduiert ist. Du kannst ihn vorher platzieren; er schärft sich selbst.
- **Jede Ausführung wird gegen deine Saldoänderung geprüft.** Der Vertrag misst, was tatsächlich in deiner Wallet ankam, nicht was ein Router meldet, und erstattet, was eine Teilausführung übrig lässt.

---

## Treuhand, Ablauf und Stornierung

- Deine Einzahlung bleibt im Vertrag, bis die Order ausgeführt wird oder du sie stornierst. Der Vertrag hat **keinen Eigentümer und keine Admin-Funktionen**: Treuhandmittel können nur deine Order zu deinen Bedingungen ausführen oder zu dir zurückkehren.
- Jede Order hat ein Ablaufdatum (1, 7 oder 30 Tage). Danach kann sie nicht mehr ausgeführt werden, aber **Stornieren funktioniert weiterhin**, jederzeit, und gibt die volle Einzahlung zurück.
- Storniere über die **Open orders**-Liste unter dem Trading-Panel.

---

## Order-Historie und Benachrichtigungen

- Das Panel unter dem Trading-Formular hat zwei Tabs: **Open** und **History**. Die Historie listet ausgeführte und stornierte Orders mit der ausgeführten Seite, dem Erhaltenen und einem Link zur Abschlusstransaktion.
- Solange deine Wallet verbunden ist, prüft die App deine Orders alle 20 Sekunden auf jeder Seite und zeigt eine Benachrichtigung, wenn eine ausgeführt wird.

---

## Wo Orders Verfügbar Sind

| Chain           | Bonding-Curve-Tokens         | Uniswap-v4-Pools             |
| :-------------- | :--------------------------- | :--------------------------- |
| Robinhood Chain | Tokens der aktuellen Factory | Graduierte Tokens            |
| Arc Network     | — (Arc hat keine Curves)     | Tokens der aktuellen Factory |

Die Tabs Limit und TP / SL erscheinen nur bei Tokens, bei denen eine Order ausgeführt werden kann. Tokens früherer Factories zeigen sie nicht.

Vertragsadressen sind in [Verifizierte Smart Contracts](/integration/contracts) aufgeführt.
