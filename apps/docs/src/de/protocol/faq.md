# Häufig Gestellte Fragen (FAQ)

Finde Antworten auf häufige Fragen zum Trading, Launchen und Verwalten von Tokens auf Goton.

---

## Allgemeine Fragen

### Was ist Goton?

Goton ist ein dezentraler, nicht-verwahrender Krypto-Launchpad, der sowohl **Robinhood Chain** (L2) als auch **Arc Network** (Circle-Stablecoin-L1) unterstützt. Er ermöglicht es jedem, Tokens mit festem Supply zu launchen, mit Live-Charts zu handeln und an Fair Launches mit dauerhaft gesperrter Liquidität teilzunehmen.

### Kann ein Entwickler einen Rug Pull machen oder Liquidität abziehen?

**Nein.** Auf Goton erstellte Liquiditätspool-Positionen werden direkt in den Open-Source-Smart-Contract `LiquidityLocker.sol` gemintet und für immer dauerhaft gesperrt. Es gibt keine Entsperrfunktion, keine Hintertür und keinen Admin-Abhebeschlüssel.

### Welche Wallets werden unterstützt?

Goton unterstützt alle gängigen Ethereum-kompatiblen Web3-Wallets, darunter:

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- WalletConnect-/Reown-kompatible Mobile-Wallets

Goton verbindet nur Wallets. Es gibt keinen E-Mail- oder Social-Login, daher hält die App niemals einen Schlüssel für dich.

---

## Trading und Swaps

### Warum ist mein Trade fehlgeschlagen?

Trades scheitern meist aus zwei Gründen:

1. **Slippage überschritten**: Bei hoher Volatilität änderte sich der Preis zwischen Klick und Block-Bestätigung stärker als dein konfigurierter Slippage-Prozentsatz. Erhöhe den Slippage in den Trading-Einstellungen (z. B. von 1 % auf 2 %).
2. **Unzureichendes Gas-Guthaben**: Halte immer ein kleines Guthaben des nativen Gas-Tokens (ETH auf Robinhood oder USDC auf Arc) bereit, um die Netzwerk-Ausführungsgebühren zu zahlen.

### Was ist der Unterschied zwischen On Curve und Graduated?

- **On Curve (v2)**: Der Token handelt derzeit auf der mathematischen Bonding Curve. Der Preis steigt, während Tokens gekauft werden.
- **Graduated**: Auf Robinhood Chain hat die Curve ihr 4,2-ETH-Ziel erreicht und der Markt ist dauerhaft in einen gesperrten Uniswap-v4-Pool gewandert. Auf Arc Network handeln Tokens ab dem Launch in einem Uniswap-v4-Pool und graduieren in-pool, sobald die Market-Cap etwa 45.000 $ übersteigt.

### Kann ich zu einem Zielpreis kaufen oder verkaufen?

Ja. Die Tabs **Limit** und **TP / SL** platzieren eine Order, die automatisch ausgeführt wird, wenn die Market-Cap dein Ziel erreicht, und du kannst sie jederzeit stornieren. Siehe [Limit-, Take-Profit- und Stop-Loss-Orders](/de/protocol/advanced-orders).

### Was ist der Unterschied zwischen Explore und Memestock?

Explore listet jeden Token. Memestock listet nur Launches mit einer geschriebenen These, deren Creator den Großteil seiner Position gekauft hat und noch hält, sortiert nach jüngstem Handel. Siehe [Feed, Calls, Memestock und Folgen](/de/protocol/social).

### Gibt es Verkaufsbeschränkungen?

**Niemals.** Nutzer können ihre Tokens jederzeit verkaufen. Goton erlegt Holdern niemals Sperren, Verkaufs-Wartezeiten oder Transfer-Einfrierungen auf.

---

## Token-Erstellung

### Wie viel kostet das Launchen eines Tokens?

Die Protokoll-Deploy-Gebühr beträgt **0.0005 ETH** auf Robinhood Chain oder **Kostenlos (0 USDC)** auf Arc Network (erfordert einen anfänglichen Vorkauf von mindestens 4,50 USDC). Dies deckt das Deployment des Smart Contracts, das Token-Minting und das initiale Sperren der Liquidität ab.

### Können später mehr Tokens gemintet werden?

**Nein.** Jeder auf Goton erstellte Token hat einen unveränderlichen, festen Supply von genau **1.000.000.000 Tokens** (1 Milliarde). Der Vertrag hat keine Mint-Funktion.

### Wie verdienen Creator Gebühren?

Die Gebühren und Steuern jedes Tokens werden on-chain aufgeteilt: **70 % für den Creator-Anteil auf Robinhood Chain, 80 % auf Arc**, und der Rest an das Protokoll. Der Creator kann diesen Anteil einmal, vor Beginn des öffentlichen Handels, zwischen sich selbst, Holdern und Buyback-and-Burn aufteilen. Siehe [Creator-Gebühren und Belohnungen](/de/protocol/fees-and-burns). Beanspruche angesammelte Gebühren auf deiner **Profil**-Seite.

---

## Netzwerk und Support

### Welches Netzwerk nutzt Goton?

Goton arbeitet als Multi-Chain-Protokoll, das **Robinhood Chain** (Chain ID: `4663`) und **Arc Network** (Chain ID: `5042`) unterstützt.

### Wo bekomme ich Hilfe?

Für Community-Unterstützung, Diskussionen und Updates tritt unseren offiziellen Kanälen bei oder sieh dir unsere [Verifizierten Smart Contracts](/integration/contracts) an.
