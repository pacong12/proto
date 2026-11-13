# Ordres Limit, Take-Profit et Stop-Loss

En plus d'acheter et vendre au prix en direct, le panneau de trading a deux onglets supplémentaires : **Limit** et **TP / SL**. Les deux placent un ordre dans le contrat `GotonLimitOrders`, qui conserve vos fonds jusqu'à ce que l'ordre s'exécute ou que vous l'annuliez.

---

## Les Trois Types d'Ordre

| Ordre           | Ce que vous déposez           | S'exécute quand                                                             |
| :-------------- | :---------------------------- | :-------------------------------------------------------------------------- |
| **Limit buy**   | ETH (Robinhood) ou USDC (Arc) | Le market cap descend à votre cible, vous recevez au moins les tokens cotés |
| **Take profit** | Tokens                        | Le market cap monte à votre cible, vous recevez au moins le montant coté    |
| **Stop loss**   | Tokens                        | Le market cap descend à votre stop, puis vend avec votre limite de slippage |

Les cibles sont saisies comme un **market cap en USD**, que l'app convertit au prix on-chain et au minimum que vous recevrez. Ce minimum tient déjà compte des frais du pool ou de la courbe, de la taxe du token et des frais d'exécuteur de 0,1 %, donc un ordre s'exécute quand le marché atteint votre cible, pas plus tard.

Un take profit et un stop loss peuvent partager un dépôt (**one-cancels-other**) : la première branche exécutée ferme l'ordre et l'autre disparaît.

---

## Comment les Ordres s'Exécutent

- **N'importe qui peut exécuter un ordre** une fois sa condition remplie. Goton fait tourner un keeper qui vérifie les ordres ouverts toutes les 15 secondes et les exécute, mais le contrat accepte tout exécuteur.
- **L'exécuteur gagne 0,1 %** du côté coté (les frais d'exécuteur). Le keeper n'exécute que lorsque ces frais couvrent son gas, donc les très petits ordres peuvent attendre qu'un autre les exécute, ou que vous annuliez.
- **Les stop loss utilisent un prix résistant à la manipulation.** Sur une bonding curve, le stop se déclenche uniquement lorsque le prix spot de la courbe et son TWAP (moyenne pondérée dans le temps sur environ 10 à 20 minutes) sont à votre stop ou en dessous. Sur un pool Uniswap v4, cela fonctionne pareil, avec le prix spot du pool et son TWAP 30 minutes du hook Goton. Dans les deux cas, la poussée de prix d'un seul bloc ne peut pas déclencher votre stop, et un stop ne se déclenche pas une fois que le prix est remonté au-dessus. Un stop attend que le prix ait assez d'historique : environ 10 minutes sur un token neuf, et 30 minutes après qu'un token a gradué vers son pool. Vous pouvez le placer avant ; il s'arme tout seul.
- **Chaque exécution est vérifiée par rapport à la variation de votre solde.** Le contrat mesure ce qui est réellement arrivé dans votre portefeuille, pas ce qu'un routeur rapporte, et rembourse ce qu'une exécution partielle laisse.

---

## Séquestre, Expiration et Annulation

- Votre dépôt reste dans le contrat jusqu'à ce que l'ordre s'exécute ou que vous l'annuliez. Le contrat **n'a ni propriétaire ni fonctions d'admin** : les fonds sous séquestre ne peuvent qu'exécuter votre ordre selon vos termes ou vous être rendus.
- Chaque ordre a une expiration (1, 7 ou 30 jours). Après cela, il ne peut plus s'exécuter, mais **l'annulation fonctionne toujours**, à tout moment, et rend le dépôt complet.
- Annulez depuis la liste **Open orders** sous le panneau de trading.

---

## Historique des Ordres et Notifications

- Le panneau sous le formulaire de trading a deux onglets : **Open** et **History**. L'historique liste les ordres exécutés et annulés avec la branche exécutée, ce que vous avez reçu et un lien vers la transaction de clôture.
- Tant que votre portefeuille est connecté, l'app vérifie vos ordres toutes les 20 secondes sur n'importe quelle page et affiche une notification quand l'un s'exécute.

---

## Où les Ordres Sont Disponibles

| Chaîne          | Tokens en bonding curve        | Pools Uniswap v4               |
| :-------------- | :----------------------------- | :----------------------------- |
| Robinhood Chain | Tokens de la fabrique actuelle | Tokens gradués                 |
| Arc Network     | — (Arc n'a pas de courbes)     | Tokens de la fabrique actuelle |

Les onglets Limit et TP / SL n'apparaissent que sur les tokens où un ordre peut s'exécuter. Les tokens de fabriques antérieures ne les montrent pas.

Les adresses de contrat sont listées dans [Contrats Intelligents Vérifiés](/integration/contracts).
