# Réputation du Créateur

Chaque profil affiche l'**historique de lancements** du créateur — un résumé rapide, dérivé on-chain, de ce qu'il a lancé. Cela aide les traders à juger un nouveau token par l'historique du portefeuille qui le porte.

---

## Ce qu'elle Affiche

La carte de réputation sur le profil d'un créateur résume chaque token que ce portefeuille a lancé :

| Métrique             | Signification                                                                      |
| :------------------- | :--------------------------------------------------------------------------------- |
| **Launches**         | Combien de tokens le portefeuille a créés                                          |
| **Graduated**        | Combien d'entre eux ont achevé leur bonding curve et migré vers un pool Uniswap v4 |
| **Active**           | Combien sont encore actifs et tradent                                              |
| **Graduation rate**  | Graduated ÷ launches, en pourcentage                                               |
| **Total market cap** | Le market cap USD combiné des tokens du créateur                                   |
| **Top token**        | Le plus gros token du créateur par market cap, avec son nom, symbole et market cap |

---

## Comment c'est Calculé

- Les chiffres sont construits à partir de **données on-chain** — les tokens que le portefeuille a déployés et leur état de marché actuel — et non de quelque chose que le créateur saisit.
- **Rien ici n'est auto-déclaré.** Un créateur ne peut pas modifier ces chiffres ; ils reflètent les lancements liés à l'adresse.
- Vous développez quelque chose ? Les mêmes chiffres sont disponibles via l'[API Publique](/integration/api).

---

## Comment la Lire en tant que Trader

- Un **taux de graduation** élevé sur plusieurs lancements est un signal plus fort qu'un seul token gradué.
- Un portefeuille avec beaucoup de lancements mais peu de gradués ou actifs a un historique de tokens qui ont stagné — à peser avant d'acheter.
- La réputation est un indice, pas une garantie. Combinez-la toujours avec la liquidité, les holders et les notes de sécurité du token lui-même dans le [Guide de Trading](/fr/protocol/trading-guide).
