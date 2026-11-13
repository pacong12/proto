# Inviter des Amis et Parrainage

Chaque profil possède une carte **Inviter des amis** avec un lien d'invitation personnel. Lorsqu'une personne ouvre Goton via votre lien et connecte un portefeuille, ce portefeuille vous est crédité. L'attribution est **off-chain et au premier contact (first-touch)**, donc sans gas ni signature.

---

## Votre Lien d'Invitation

Ouvrez votre propre profil et trouvez la carte **Inviter des amis**. Elle affiche :

- **Votre lien d'invitation** — `https://goton.fun/?ref=<votre-pseudo>`, utilisant le nom d'utilisateur de votre portefeuille (ex. `aerobrassgriffin-79c8`). Une adresse de portefeuille fonctionne aussi ; le nom d'utilisateur est juste plus lisible et plus facile à partager.
- **Referred** — combien de portefeuilles vous avez parrainés jusqu'ici.
- **Copier le lien** — copie le lien dans votre presse-papiers.

Le même code `?ref=` s'ajoute automatiquement chaque fois que vous partagez depuis Goton — voir [Où voyage votre lien](#ou-voyage-votre-lien).

---

## Comment Fonctionne l'Attribution

- **Premier contact.** Le premier lien d'invitation qu'un visiteur ouvre est celui qui compte. Il est mémorisé dans son navigateur jusqu'à ce qu'il connecte un portefeuille, et un lien ultérieur ne l'**écrase pas**.
- **Un portefeuille, une fois.** Lorsque le visiteur connecte un portefeuille, celui-ci est attribué à votre lien une seule fois. Se reconnecter, ou ouvrir un autre lien ensuite, ne change rien.
- **Pas d'auto-parrainage.** Ouvrir votre propre lien et connecter votre propre portefeuille n'enregistre rien.
- **Nom d'utilisateur ou adresse.** Un `?ref=` qui est un nom d'utilisateur est résolu vers le portefeuille du parrain avant d'être enregistré ; un parrain qui n'a jamais tradé ni lancé peut ne pas être résolu par nom, auquel cas un lien avec adresse est la forme la plus fiable.

Comme l'attribution est au premier contact et off-chain, le pire qu'un abuseur puisse faire est de gonfler un compteur cosmétique. Le compteur est informatif aujourd'hui — il n'y a pas encore de récompenses on-chain associées.

---

## Où voyage votre lien

Votre code de parrainage est ajouté aux liens que vous partagez depuis l'app, donc partager votre activité fait aussi croître votre réseau :

| Action                                  | Ce qui est partagé                                                       |
| :-------------------------------------- | :----------------------------------------------------------------------- |
| **Partager le profil**                  | Un lien vers le profil, portant le `?ref` de votre portefeuille connecté |
| **Partager la carte PnL**               | Le lien de votre carte `/pnl/…` avec `?ref`                              |
| **Partager sur X** depuis token / trade | Le lien de la page du token avec `?ref`                                  |
| **Partager un call** ou une publication | Le lien `/post/…` avec `?ref`                                            |

Dans tous les cas, le code est celui du portefeuille **connecté** — la personne qui partage — donc partager le profil de quelqu'un d'autre vous crédite quand même.

---

## FAQ

**Est-ce que je gagne quelque chose avec le parrainage aujourd'hui ?** Pas encore. Le compteur est cosmétique pour l'instant. Quand des récompenses seront introduites, l'attribution devrait passer à un déclencheur on-chain signé (comme le premier lancement ou trade du filleul).

**Puis-je changer qui m'a parrainé ?** Non. Le premier contact est permanent dès qu'un portefeuille se connecte.

**Mon lien utilise mon nom d'utilisateur — est-il stable ?** Le nom d'utilisateur est dérivé de votre adresse de portefeuille, donc il ne change jamais.
