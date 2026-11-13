# Holder-Dividenden und Vesting

Der **Dividends**-Tab in deinem Profil ist der Ort, an dem zwei Arten von On-Chain-Belohnungen eingesammelt werden: **Holder-Gebührenbeteiligungs-Dividenden** der Tokens, die du hältst, und **ge-vestete Tokens** aus Zuteilungen, die sich über die Zeit entsperren. Beide werden direkt in deine Wallet beansprucht.

---

## Holder-Dividenden

Manche Tokens aktivieren beim Launch **Holder Fee Sharing**. Für diese Tokens sammelt sich ein Teil der Handelsgebühren **anteilig für alle Holder** an — nicht nur für den Creator.

Im Dividends-Tab siehst du:

- **Total claimable** — deine angesammelten Belohnungen, nach Währung aufgelistet (ETH / WETH auf Robinhood, USDC auf Arc).
- **Einträge pro Token** — jeder Token, den du hältst und der Gebühren teilt, mit dem auf dich wartenden Betrag.
- **Claim all** — sammle die Dividenden aller Tokens auf einmal ein, oder beanspruche einen einzelnen Token aus seiner Zeile.

Belohnungen sammeln sich weiter an, solange der Token gehandelt wird; das Beanspruchen fegt das Angesammelte in deine Wallet. Ein Token erscheint hier nur, wenn sein Creator Holder Fee Sharing aktiviert hat — siehe [Creator-Gebühren und Belohnungen](/de/protocol/fees-and-burns), wie die Gebührenaufteilung konfiguriert wird.

---

## Vesting

Wenn dir ein Token eine Zuteilung gewährt, die sich über die Zeit entsperrt (etwa eine Creator- oder Beitragender-Zuteilung), erscheint sein **Vesting-Zeitplan** im selben Tab, pro Token:

| Feld                      | Bedeutung                                             |
| :------------------------ | :---------------------------------------------------- |
| **Total (noch gesperrt)** | Noch nicht entsperrte Tokens                          |
| **Claimed**               | Tokens, die du bereits in die Wallet freigegeben hast |
| **Claimable**             | Entsperrte Tokens, die du jetzt freigeben kannst      |
| **Cliff ends**            | Das Datum, vor dem nichts entsperrt wird              |
| **Fully unlocked**        | Das Datum, an dem die gesamte Zuteilung ge-vestet ist |

Ein Zeitplan hat einen **Cliff** (vor diesem Datum wird nichts freigegeben) und entsperrt sich dann schrittweise bis zur vollständigen Vesting. Bei einer Vesting-Position sind zwei Aktionen verfügbar:

- **Claim tokens** — gib die aktuell beanspruchbaren (entsperrten) Tokens in deine Wallet frei.
- **Claim dividends** — sammle die von dieser Vesting-Position verdienten Holder-Gebührenbeteiligungs-Dividenden ein.

---

## Hinweise

- Alles hier ist **on-chain**. Das Beanspruchen ist eine Wallet-Transaktion; die Vesting- und Gebührenbeteiligungslogik lebt in den Token-Verträgen, ohne dass ein Admin deine Belohnungen umleiten könnte.
- Der Tab zeigt deine beanspruchbaren Beträge und dein Vesting nur auf **deinem eigenen** Profil (verbinde deine Wallet). Die Beträge aktualisieren sich, während Tokens gehandelt werden und Entsperrungen ihren Cliff passieren.
