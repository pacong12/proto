# Creator-Gebühren und Belohnungen

Goton bringt den langfristigen Erfolg von Token-Creatorn mit ihren Communities in Einklang, indem es eine der creatorfreundlichsten Gebührenstrukturen im gesamten Blockchain-Ökosystem bietet.

---

## Gebührenverteilung

Woher die Gebühren kommen, hängt von der Chain ab:

- **Robinhood Chain**: Solange ein Token auf seiner Bonding Curve ist, zahlt jeder Trade auf der Curve 1 % Gebühr an das Protokoll. Nach der Graduation erhebt der gesperrte Uniswap-v4-Pool eine LP-Gebühr von 1 %.
- **Arc Network**: Der Uniswap-v4-Pool erhebt ab dem Launch eine LP-Gebühr von 1 %, plus eine optionale Kauf-/Verkaufssteuer von 0–10 %, die der Creator beim Launch festlegt.

Pool-Gebühren und Steuern werden durch den On-Chain-Fee-Splitter jedes Tokens aufgeteilt:

- **An die Treasury** des Protokolls: 30 % auf Robinhood Chain, 20 % auf Arc. Die Verträge begrenzen den Protokollanteil auf 30 % und die Launch-Gebühr auf 10 USDC auf Arc (0,01 ETH auf Robinhood Chain).
- **Der Rest (70 % oder 80 %) ist der Anteil des Creators**, den der Creator einmal, vor Beginn des öffentlichen Handels, aufteilen kann zwischen:
  - **Creator**: vom Creator (oder seinem umgeleiteten Empfänger) beanspruchbar.
  - **Holder**: anteilig über 24 Stunden an die Token-Holder gestreamt.
  - **Buyback & Burn**: im eigenen Pool des Tokens vom `GotonV4Buyback`-Vertrag zurückgekauft und an die Dead-Adresse gesendet. Jeder Rückkauf ist auf den 30-Minuten-TWAP des Pools ± 2 % begrenzt, sodass ein manipulierter Preis den Rückkauf nur pausiert, bis er sich normalisiert.
  - **Liquidität**: an den Liquiditäts-Vault des Protokolls gesendet, der derzeit die Protokoll-Treasury ist. Die goton.fun-App bietet diese Option nicht an, da sie dem eigenen Pool des Tokens keine Liquidität hinzufügt.

Standardmäßig geht der gesamte Creator-Anteil an den Creator. Der Protokollanteil wird nicht für Rückkäufe verwendet.

---

## Wie Creator Belohnungen Beanspruchen

1. Verbinde die Wallet, die den Token ursprünglich erstellt hat.
2. Gehe zu deiner **Profil**-Seite (`/profile`).
3. Sieh unter **My Launches** deine angesammelten, nicht abgeholten ETH- und Token-Belohnungen.
4. Klicke auf **Claim Fees**, um deine Belohnungen in einer einzigen Transaktion direkt in deine Wallet abzuheben.

---

## Team-Auszahlungen

Ein Creator kann seinen Gebührenanteil mit einem Team teilen. Füge unter **Advanced → Fee recipients** auf der Erstellungsseite Team-Wallets mit festen Prozentsätzen hinzu (bis zu 10 Wallets, in Summe 100 %). Die App erstellt dann vor dem Launch einen `GotonTeamSplitter` für das Team:

- **Robinhood Chain**: Die Token-Steuer geht ab dem Launch an das Team. Nach der Graduation leite die Pool-Gebühren aus deinem Profil an dasselbe Team um (48-Stunden-Timelock).
- **Arc**: Gebühren und Steuer erreichen das Team, sobald die beim Launch vorgeschlagene Auszahlungsumleitung aktiv wird, 48 Stunden später. Bis dahin gehen sie an den Creator.

Der Team-Vertrag hat keinen Eigentümer, und seine Mitglieder und Anteile können sich nie ändern. Jeder kann die Anteile der Mitglieder über die Token-Seite freigeben (**About → Team payouts**); jedes Mitglied wird immer direkt bezahlt.

---

## Gebührenumleitung (Community Takeovers)

Wenn ein Creator seine Community belohnen oder die Projektleitung übergeben möchte:

- Nur der Creator kann den Creator-Anteil der Gebühren an eine DAO-Treasury, ein Community-Multisig oder einen Belohnungsvertrag umleiten. Ein Vorschlag kann nach einem 48-Stunden-Timelock angenommen werden, und der Creator kann ihn bis zur Annahme stornieren.
- Der Creator kann den Empfänger dann dauerhaft sperren. Das Protokoll kann die Gebühren eines Creators niemals bewegen.
- Diese Funktion stärkt Community Takeovers (CTO), indem sie Projekteinnahmen in community-eigene Finanzierung verwandelt. Siehe [Community Takeovers](./community-takeovers.md).
