# Frais et Récompenses du Créateur

Goton aligne le succès à long terme des créateurs de tokens avec leurs communautés en offrant l'une des structures de frais les plus favorables aux créateurs de tout l'écosystème blockchain.

---

## Distribution des Frais

L'origine des frais dépend de la chaîne :

- **Robinhood Chain** : tant qu'un token est sur sa bonding curve, chaque transaction sur la courbe paie des frais de 1 % au protocole. Après la graduation, le pool Uniswap v4 verrouillé prélève des frais LP de 1 %.
- **Arc Network** : le pool Uniswap v4 prélève des frais LP de 1 % dès le lancement, plus une taxe d'achat/vente optionnelle de 0 à 10 % que le créateur fixe au lancement.

Les frais du pool et les taxes sont répartis par le répartiteur de frais on-chain de chaque token :

- **Vers la trésorerie** du protocole : 30 % sur Robinhood Chain, 20 % sur Arc. Les contrats plafonnent la part du protocole à 30 % et les frais de lancement à 10 USDC sur Arc (0,01 ETH sur Robinhood Chain).
- **Le reste (70 % ou 80 %) est la part du créateur**, que le créateur peut répartir une fois, avant le début du trading public, entre :
  - **Créateur** : réclamable par le créateur (ou son destinataire redirigé).
  - **Holders** : diffusé aux holders du token au prorata sur 24 heures.
  - **Buyback & Burn** : racheté dans le propre pool du token par le contrat `GotonV4Buyback` et envoyé à l'adresse morte. Chaque rachat est plafonné au TWAP 30 minutes du pool ± 2 %, de sorte qu'un prix manipulé ne fait que suspendre le rachat jusqu'à normalisation.
  - **Liquidité** : envoyée au coffre de liquidité du protocole, actuellement la trésorerie du protocole. L'app goton.fun ne propose pas cette option, car elle n'ajoute pas de liquidité au propre pool du token.

Par défaut, toute la part du créateur va au créateur. La part du protocole n'est pas utilisée pour les rachats.

---

## Comment les Créateurs Réclament leurs Récompenses

1. Connectez le portefeuille qui a créé le token à l'origine.
2. Allez sur votre page **Profil** (`/profile`).
3. Dans la section **My Launches**, consultez vos récompenses accumulées non collectées en ETH et en tokens.
4. Cliquez sur **Claim Fees** pour retirer vos récompenses directement vers votre portefeuille en une seule transaction.

---

## Paiements d'Équipe

Un créateur peut partager sa part de frais avec une équipe. Sous **Advanced → Fee recipients** sur la page de création, ajoutez des portefeuilles d'équipe avec des pourcentages fixes (jusqu'à 10 portefeuilles, totalisant 100 %). L'app crée alors un `GotonTeamSplitter` pour l'équipe avant le lancement :

- **Robinhood Chain** : la taxe du token va à l'équipe dès le lancement. Après la graduation, redirigez les frais du pool vers la même équipe depuis votre profil (timelock de 48 heures).
- **Arc** : les frais et la taxe atteignent l'équipe une fois que la redirection de paiement proposée au lancement devient active, 48 heures plus tard. Jusque-là, ils vont au créateur.

Le contrat d'équipe n'a pas de propriétaire et ses membres et parts ne peuvent jamais changer. N'importe qui peut libérer les parts des membres depuis la page du token (**About → Team payouts**) ; chaque membre est toujours payé directement.

---

## Redirection des Frais (Community Takeovers)

Si un créateur souhaite récompenser sa communauté ou céder la direction du projet :

- Seul le créateur peut rediriger la part créateur des frais vers une trésorerie DAO, un multisig communautaire ou un contrat de récompenses. Une proposition peut être acceptée après un timelock de 48 heures, et le créateur peut l'annuler jusqu'à son acceptation.
- Le créateur peut ensuite verrouiller le destinataire de façon permanente. Le protocole ne peut jamais déplacer les frais d'un créateur.
- Cette fonctionnalité permet les community takeovers (CTO) en transformant les revenus du projet en financement détenu par la communauté. Voir [Community Takeovers](./community-takeovers.md).
