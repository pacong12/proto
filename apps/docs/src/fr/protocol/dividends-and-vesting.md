# Dividendes des Holders et Vesting

L'onglet **Dividends** de votre profil est l'endroit où deux types de récompenses on-chain sont collectés : les **dividendes de partage de frais pour les holders** des tokens que vous détenez, et les **tokens en vesting** d'allocations qui se débloquent avec le temps. Les deux se réclament directement vers votre portefeuille.

---

## Dividendes des Holders

Certains tokens activent le **Holder Fee Sharing** au lancement. Pour ces tokens, une part des frais de trading s'accumule **au prorata pour tous les holders** — pas seulement le créateur.

Dans l'onglet Dividends vous verrez :

- **Total claimable** — vos récompenses accumulées, listées par devise (ETH / WETH sur Robinhood, USDC sur Arc).
- **Entrées par token** — chaque token que vous détenez qui partage des frais, avec le montant qui vous attend.
- **Claim all** — collectez les dividendes de tous les tokens d'un coup, ou réclamez un seul token depuis sa ligne.

Les récompenses continuent de s'accumuler tant que le token trade ; réclamer balaie l'accumulé vers votre portefeuille. Un token n'apparaît ici que si son créateur a activé le Holder Fee Sharing — voir [Frais et Récompenses du Créateur](/fr/protocol/fees-and-burns) sur la façon dont le partage des frais est configuré.

---

## Vesting

Lorsqu'un token vous accorde une allocation qui se débloque avec le temps (par exemple une allocation de créateur ou de contributeur), son **calendrier de vesting** s'affiche dans le même onglet, par token :

| Champ                         | Signification                                          |
| :---------------------------- | :----------------------------------------------------- |
| **Total (encore verrouillé)** | Tokens pas encore débloqués                            |
| **Claimed**                   | Tokens que vous avez déjà libérés vers le portefeuille |
| **Claimable**                 | Tokens débloqués que vous pouvez libérer maintenant    |
| **Cliff ends**                | La date avant laquelle rien ne se débloque             |
| **Fully unlocked**            | La date où toute l'allocation a fini son vesting       |

Un calendrier a un **cliff** (rien ne se libère avant cette date) puis se débloque progressivement jusqu'au vesting complet. Deux actions sont disponibles sur une position de vesting :

- **Claim tokens** — libérez vers votre portefeuille les tokens débloqués réclamables maintenant.
- **Claim dividends** — collectez les dividendes de partage de frais des holders gagnés par cette position de vesting.

---

## Notes

- Tout ici est **on-chain**. Réclamer est une transaction de portefeuille ; la logique de vesting et de partage de frais vit dans les contrats du token, sans aucun admin capable de rediriger vos récompenses.
- L'onglet affiche vos montants réclamables et votre vesting uniquement sur **votre propre** profil (connectez votre portefeuille). Les montants se mettent à jour à mesure que les tokens tradent et que les déblocages passent leur cliff.
