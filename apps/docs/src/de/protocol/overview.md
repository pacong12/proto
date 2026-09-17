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

| Modell               | Funktionsweise                                                                                                                                          | Ideal für                                                 |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------- |
| **v1 Direct Pool**   | Direkter Start in einen Uniswap V3-Pool mit 100% dauerhaft gesperrter Liquidität.                                                                       | Projekte, die sofort volle DEX-Tiefe benötigen.           |
| **v2 Bonding Curve** | Startet auf einer dynamischen Preiskurve ($x \cdot y = k$) und migriert automatisch zu Uniswap, sobald das Ziel (4.2 ETH oder 8.400 USDC) erreicht ist. | Community- und Meme-Token mit schrittweiser Preisfindung. |
