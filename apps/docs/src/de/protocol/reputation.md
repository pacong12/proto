# Creator-Reputation

Jedes Profil zeigt die **Launch-Historie** des Creators — eine schnelle, on-chain abgeleitete Zusammenfassung dessen, was er veröffentlicht hat. Sie hilft Tradern, einen neuen Token anhand der Historie der dahinterstehenden Wallet zu beurteilen.

---

## Was sie Zeigt

Die Reputationskarte im Profil eines Creators fasst jeden Token zusammen, den diese Wallet gelauncht hat:

| Metrik               | Bedeutung                                                                                     |
| :------------------- | :-------------------------------------------------------------------------------------------- |
| **Launches**         | Wie viele Tokens die Wallet erstellt hat                                                      |
| **Graduated**        | Wie viele davon ihre Bonding Curve abgeschlossen und in einen Uniswap-v4-Pool gewechselt sind |
| **Active**           | Wie viele noch live sind und gehandelt werden                                                 |
| **Graduation rate**  | Graduated ÷ Launches, als Prozentsatz                                                         |
| **Total market cap** | Die kombinierte USD-Market-Cap der Tokens des Creators                                        |
| **Top token**        | Der größte Token des Creators nach Market-Cap, mit Name, Symbol und Market-Cap                |

---

## Wie es Berechnet Wird

- Die Zahlen werden aus **On-Chain-Daten** gebildet — den Tokens, die die Wallet deployt hat, und ihrem aktuellen Marktzustand — nicht aus etwas, das der Creator eintippt.
- **Nichts hier ist selbst gemeldet.** Ein Creator kann diese Zahlen nicht bearbeiten; sie spiegeln die an die Adresse gebundenen Launches wider.
- Baust du etwas? Dieselben Zahlen sind über die [Public API](/integration/api) verfügbar.

---

## Als Trader Richtig Lesen

- Eine hohe **Graduation Rate** über mehrere Launches ist ein stärkeres Signal als ein einzelner graduierter Token.
- Eine Wallet mit vielen Launches, aber wenigen graduierten oder aktiven, hat eine Historie von Tokens, die ins Stocken gerieten — vor dem Kauf abwägen.
- Reputation ist ein Eingabewert, keine Garantie. Kombiniere sie stets mit der Liquidität, den Holdern und den Sicherheitshinweisen des Tokens selbst im [Trading-Leitfaden](/de/protocol/trading-guide).
