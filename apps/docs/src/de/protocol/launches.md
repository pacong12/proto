# Einen Token Launchen

Das Erstellen deines eigenen Tokens auf Goton dauert weniger als zwei Minuten und erfordert keinerlei Programmier- oder Blockchain-Entwicklungserfahrung.

---

## Schritt-für-Schritt-Launch-Anleitung

### 1. Verbinde deine Wallet

Gehe zu [%APP_HOST%](%APP_URL%) und klicke oben in der Navigationsleiste auf **Connect Wallet**. Stelle sicher, dass deine Wallet mit **Robinhood Chain** (Chain ID: 4663) verbunden ist.

### 2. Gehe zur Create-Seite

Klicke auf **Create** oder navigiere direkt zu `/launchpad/create`.

### 3. Fülle die Token-Details aus

Gib die wesentlichen Informationen für deinen Token ein:

- **Token-Name**: Der vollständige Name (z. B. `Robin Gold`).
- **Ticker-Symbol**: 3 bis 6 Großbuchstaben (z. B. `GOLD`).
- **Beschreibung**: Eine kurze Einführung, die deinen Token, seinen Zweck oder die Community-Vision beschreibt.
- **Token-Logo**: Lade eine Bilddatei hoch (PNG, JPG, SVG oder WebP). Goton komprimiert dein Bild automatisch und pinnt es sicher auf IPFS.

### 4. Füge Community-Links Hinzu (Optional)

Du kannst offizielle Links einfügen, damit Trader dein Projekt verifizieren und beitreten können:

- Website-URL
- Offizieller X-(Twitter)-Handle
- Community-Telegram-Link

### 5. Initial-Kauf (Optional)

Wenn du als Creator eine anfängliche Zuteilung zum Launch-Preis kaufen möchtest, gib den Betrag ein (ETH auf Robinhood Chain, USDC auf Arc). Ein Initial-Kauf ist auch das, was einen Launch auf [Memestock](/de/protocol/social#memestock) listet, zusammen mit einer geschriebenen Beschreibung.

### 6. Bestätigen und Deployen

Klicke auf **Launch Token** und bestätige die Transaktion in deiner Wallet:

- **Launch-Gebühr**: Fest bei `0.0005 ETH` auf Robinhood Chain, oder `0 USDC` auf Arc Network (kostenloser Launch mit mindestens 4,50 USDC Vorkauf).
- Sobald die Transaktion bestätigt ist, ist dein Token live, verifizierbar und sofort handelbar!

---

## Was Passiert mit dem Token-Supply?

Jeder auf Goton erstellte Token hat einen streng festen Supply:

- **Gesamt-Supply**: Genau **1.000.000.000 Tokens** (1 Milliarde).
- **Dezimalstellen**: 18.
- **Kein Minting**: Es existiert keine Funktion, um nach dem Launch zusätzliche Tokens zu minten.
- **Kein Pausieren**: Der Token kann nicht eingefroren oder auf eine Blacklist gesetzt werden.

---

## Graduation

- **Robinhood Chain**: Ein Token handelt auf seiner Bonding Curve, bis die Curve **4,2 ETH** aufbringt. Die Curve schließt dann, und ihr ETH und die verbleibenden Tokens wandern in einen Uniswap-v4-Pool, dessen Liquidität für immer gesperrt ist. Die Graduation ist permissionless: Gotons Keeper löst sie in etwa 30 Sekunden aus, und wenn jemand zuerst handelt, löst seine Transaktion sie stattdessen aus.
- **Arc Network**: Es gibt keine Curve. Ein Token handelt ab dem ersten Block in seinem gesperrten Uniswap-v4-Pool.

Nach der Graduation handelt der Token weiter auf derselben Seite; die App leitet Trades an den Pool.
