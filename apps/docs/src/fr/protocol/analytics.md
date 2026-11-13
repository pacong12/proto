# Analyses du Protocole

La page **Analytics** offre une vue en direct, à l'échelle du réseau, de l'activité sur Goton — combien se trade, combien de tokens se lancent, et les frais que le protocole génère — pour le réseau sur lequel vous êtes actuellement.

---

## Le Graphique Principal

Un seul graphique interactif trace une métrique sur les **dernières 24 heures**, par tranches. Changez la métrique :

| Métrique     | Ce qu'elle trace                           |
| :----------- | :----------------------------------------- |
| **Volume**   | Volume de trading au fil du temps          |
| **Launches** | Tokens lancés au fil du temps              |
| **Fees**     | Frais du protocole générés au fil du temps |

Basculez entre une vue en **aire lissée** et en **barres**. Tout est limité au **réseau actif** (Robinhood ou Arc) — changez de réseau depuis l'en-tête pour voir les chiffres de l'autre chaîne.

---

## Statistiques Clés

Sous le graphique, des cartes de résumé affichent les totaux du réseau, dont :

- **Volume total de trading** — le volume global sur le réseau.
- **Total de tokens lancés** — combien de tokens ont été créés.
- **Estimation des taxes / frais** — une estimation des frais générés.
- **Buyback** — l'activité de rachat du protocole, lorsqu'elle existe.

Une liste de **tokens en vedette** classe les tokens par market cap, pour passer directement de la vue macro à la page de trade d'un token précis.

---

## Notes

- Les chiffres sont construits à partir de **données on-chain** et se mettent à jour à mesure que de nouveaux blocs sont traités. Vous voulez les mêmes chiffres pour votre propre outil ? Ils sont dans l'[API Publique](/integration/api).
- Les analyses sont **par réseau** : la page reflète toujours la chaîne affichée dans l'en-tête, et l'indique dans sa note de portée.
- Les chiffres sont dérivés de l'indexeur et se mettent à jour à mesure que de nouveaux blocs sont traités ; la fenêtre de 24 heures est une vue glissante, pas un jour calendaire.
