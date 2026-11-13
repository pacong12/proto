# Community Takeovers (CTO)

Que se passe-t-il si le développeur d'un token veut se retirer d'un projet ?

Sur Goton, un créateur peut céder son flux de frais à la communauté qui porte le projet. C'est toujours la décision propre du créateur. Personne d'autre, y compris le protocole, ne peut déplacer les frais d'un créateur.

---

## Qu'est-ce qu'un Community Takeover ?

Un Community Takeover survient lorsque des membres de la communauté adoptent un token, prennent en charge le marketing, mettent à jour les liens sociaux et maintiennent la croissance de la communauté.

Goton le permet via une redirection sur le répartiteur de frais du token :

1. **Proposer** : Le créateur propose un portefeuille communautaire, un multisig ou une adresse DAO depuis la page **Profil** (onglet **Created**, **Manage CTO**).
2. **Attendre 48 heures** : La proposition ne peut pas prendre effet pendant ce timelock, afin que tout le monde la voie venir. Le créateur peut l'annuler jusqu'à son acceptation. Une nouvelle proposition remplace l'ancienne et redémarre l'attente.
3. **Accepter** : Après le timelock, le créateur ou le destinataire proposé accepte. Dès lors, la part créateur des frais va au nouveau destinataire.
4. **Verrouiller (optionnel)** : Le créateur peut verrouiller le destinataire actuel de façon permanente. C'est irréversible et cela annule toute proposition en attente, donc acceptez le nouveau destinataire avant de verrouiller.

Tant que le destinataire n'est pas verrouillé, le créateur peut lancer une nouvelle redirection à tout moment, de nouveau avec le timelock de 48 heures.

Le montant redirigé dépend du token. Le créateur choisit comment la part créateur est répartie, donc la redirection ne couvre que la portion attribuée au **Créateur**. Les portions holders, buyback et liquidité conservent leurs destinations. Voir [Frais et Récompenses du Créateur](./fees-and-burns.md).

---

## Comment Demander un Takeover

1. **Organisez un destinataire** : Mettez en place un multisig ou une DAO contrôlé par la communauté, plutôt que le portefeuille personnel d'un membre.
2. **Demandez au créateur** : Contactez le créateur publiquement et partagez l'adresse du destinataire, pour que la demande puisse être vérifiée par tous.
3. **Surveillez la proposition** : Une fois que le créateur propose l'adresse, vérifiez que c'est exactement celle convenue.
4. **Acceptez après 48 heures** : Le destinataire peut accepter sans attendre le créateur.
5. **Demandez le verrouillage et vérifiez-le** : Sans le verrouillage, le créateur peut encore rediriger les frais plus tard.

Pour vérifier on-chain, ouvrez le répartiteur de frais du token dans l'explorateur de blocs et lisez ces valeurs :

- `creatorRecipient()` : l'adresse qui reçoit les frais maintenant.
- `creatorRecipientLocked()` : `true` signifie que cette adresse ne peut jamais changer.
- `pendingCreatorRecipient()` et `pendingCreatorRecipientValidAfter()` : toute proposition en attente de son timelock.

La page de trading du token affiche aussi un badge **Community** quand les frais vont à quelqu'un d'autre que le créateur, et son infobulle indique quand le destinataire est verrouillé.

Quelques limites à garder à l'esprit :

- **Pas de créateur, pas de redirection** : Si un créateur a disparu et n'a jamais proposé de redirection, le flux de frais reste avec lui. Une communauté peut toujours adopter le token socialement, mais ni elle ni Goton ne peuvent réclamer ces frais.
- **Les anciens répartiteurs n'ont pas de verrouillage** : Les répartiteurs de frais déployés avant l'existence du verrouillage peuvent rediriger mais pas verrouiller, donc le créateur peut toujours rediriger à nouveau. La page Profil indique quand le verrouillage n'est pas disponible.
- **Robinhood Chain** : Un token obtient son répartiteur de frais à la graduation, donc une redirection n'est possible qu'après.

---

## Garanties de Sécurité et de Protection

- **La Liquidité est Intouchable** : La liquidité reste verrouillée en permanence, dans le liquidity locker sur Robinhood Chain et dans la fabrique de lancement pour les pools Uniswap v4 d'Arc. Un Community Takeover ne peut pas retirer, migrer ni drainer la liquidité du pool.
- **Le Contrat du Token est Immuable** : Les règles du token, le supply total (1 milliard) et les paramètres de transfert ne peuvent être modifiés ni reconfigurés par quiconque.
- **La Part du Protocole est Séparée** : Une redirection ne change que qui reçoit la portion créateur. Elle ne peut toucher ni la part du protocole ni les autres portions de la répartition.
- **Transparence Non Custodiale** : Toutes les réclamations de frais et redirections sont enregistrées on-chain pour vérification publique.
