# Was ist Proto?

**Proto** ist ein dezentrales, nicht-verwahrendes Token-Launchpad und Handelsprotokoll auf **Robinhood Chain (Chain ID: 4663)** und **Arc Network (Chain ID: 5042)**.

Es bietet eine sichere und transparente Plattform, auf der jeder digitale Vermögenswerte ohne komplexe Hürden oder Rug-Pull-Risiken erstellen und handeln kann.

---

## Warum Proto?

1. **Kein Rug-Pull-Risiko**: Alle Liquiditätspositionen werden dauerhaft im Open-Source-Vertrag `LiquidityLocker.sol` gesperrt.
2. **Anti-Snipe-Schutz**: In den ersten Blöcken nach dem Start gelten strenge Kauf- und Wallet-Limits gegen Bots.
3. **Festes Angebot**: Exakt **1.000.000.000 Token** (1 Milliarde) ohne nachträgliche Mint-Funktion.

---

## Zwei einfache Startmodelle

| Modell                       | Funktionsweise                                                                                                                                                                                                          | Ideal für                                                  |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **Robinhood: Bonding Curve** | Handel auf einer Preiskurve ($x \cdot y = k$). Rund 714,3 Mio. Token (71,43 %) werden auf der Kurve verkauft; bei 4,2 ETH graduiert der Markt in einen gesperrten Uniswap-v4-Pool mit den restlichen ~285,7 Mio. Token. | Community- und Meme-Token mit schrittweiser Preisfindung.  |
| **Arc: Uniswap v4 ab Start** | Das gesamte Angebot liegt ab dem ersten Block als einseitige Liquidität in einem Uniswap-v4-Pool (Startwert ≈ 2.480 $). Ab ≈ 45.000 $ Marktkapitalisierung graduiert der Token im Pool – ohne Migration.                | Token, die ab dem ersten Block auf Uniswap handeln sollen. |
