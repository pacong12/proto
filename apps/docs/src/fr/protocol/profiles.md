# Profils et Identité

Chaque portefeuille sur Goton a un profil public et un **pseudonyme** intégré, donc les gens ont un nom et une page dès leur première transaction — sans inscription. Vous pouvez personnaliser votre profil dès que votre portefeuille est connecté.

---

## Votre Pseudonyme

Dès qu'un portefeuille apparaît, Goton lui attribue un nom d'utilisateur déterministe dérivé de son adresse — un adjectif, un matériau et un archétype, plus une courte étiquette issue de l'adresse, par exemple **AeroBrassGriffin#79c8**. Il en découle trois formes, toutes pointant vers le même portefeuille :

- **Nom affiché** — `AeroBrassGriffin#79c8`
- **Handle** — `@AeroBrassGriffin#79c8`
- **Slug** — `aerobrassgriffin-79c8` (la forme compatible URL)

Comme il est dérivé de l'adresse, votre pseudonyme **ne change jamais** et est le même partout dans l'app. C'est aussi ce qu'utilise votre [lien de parrainage](/fr/protocol/referrals).

---

## URLs de Profil

Un profil s'ouvre depuis plusieurs chemins équivalents, qui résolvent tous vers le même portefeuille :

- `/u/<adresse>`, `/profile/<adresse>`, `/user/<adresse>`, `/@<adresse>`
- `/<pseudo>` — le slug, ex. `/aerobrassgriffin-79c8`

Une URL avec adresse est réécrite vers la forme propre `/<pseudo>`. Un nom, slug ou handle saisi est résolu vers son adresse, donc partager un nom fonctionne aussi bien que partager une adresse.

---

## Modifier votre Profil

Sur **votre propre** profil (portefeuille connecté), **Edit Profile** vous permet de personnaliser votre identité publique de créateur :

| Champ               | Remarques                                                   |
| :------------------ | :---------------------------------------------------------- |
| **Bannière**        | Une image téléversée depuis votre appareil                  |
| **Photo de profil** | Un avatar téléversé depuis votre appareil                   |
| **Nom affiché**     | Jusqu'à 32 caractères ; remplace le pseudonyme publiquement |
| **Bio**             | Une courte description — stratégies, votre alpha, tout      |
| **X (Twitter)**     | Votre handle                                                |
| **Telegram**        | Votre handle                                                |

Les images téléversées sont stockées sur IPFS ; le reste du profil est enregistré pour votre portefeuille. Vous pouvez aussi **effacer** vos données sociales pour vider les champs personnalisés et revenir au pseudonyme.

---

## Ce qu'un Profil Affiche

Chaque profil — le vôtre ou celui de n'importe qui — rassemble l'activité de ce portefeuille en un seul endroit :

- **[Réputation du Créateur](/fr/protocol/reputation)** — son historique de lancements.
- **[Portefeuille](/fr/protocol/portfolio)** — performance et détentions actuelles.
- **Posts & Calls** — son activité dans le [feed](/fr/protocol/social).
- **Created Tokens** — les tokens que le portefeuille a lancés.
- **[Dividendes des Holders et Vesting](/fr/protocol/dividends-and-vesting)** — récompenses réclamables (profil personnel).
- **[Inviter des amis](/fr/protocol/referrals)** — son lien d'invitation (profil personnel).

---

## Notes

- Un profil est **public** et construit à partir de l'activité on-chain plus les champs optionnels que vous définissez. Il n'expose rien au-delà de ce que la chaîne et vos propres modifications fournissent.
- Il n'existe aucun compte, e-mail ou mot de passe — votre portefeuille _est_ votre identité.
