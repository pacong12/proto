# Guide de Trading et de Swaps

Acheter et vendre des tokens sur Goton est conçu pour être rapide, réactif et sûr. Chaque transaction est exécutée de façon non custodiale via votre portefeuille personnel.

---

## Comment Acheter des Tokens

1. **Sélectionnez un Token** : Parcourez la page **Explore** ou cliquez sur n'importe quelle carte de token pour ouvrir sa Trade View dédiée.
2. **Examinez le Graphique et les Métriques** :
   - Consultez les bougies de prix en direct et les tendances de volume sur 24 heures.
   - Vérifiez si le token est actuellement **On Curve** (en progression vers la graduation) ou **Graduated** (tradant sur le DEX Uniswap).
   - Examinez les métriques communautaires, les principaux holders et les badges de statut du créateur.
3. **Choisissez le Mode Achat** : Dans le panneau de trading à droite, assurez-vous que l'onglet **Buy** est actif.
4. **Saisissez le Montant** :
   - Tapez le montant que vous voulez dépenser (ETH sur Robinhood Chain, USDC sur Arc), ou utilisez les boutons de sélection rapide. Vous pouvez aussi saisir le montant en USD.
   - Le panneau calcule automatiquement vos tokens estimés reçus.
5. **Ajustez le Slippage (Optionnel)** :
   - Cliquez sur l'icône d'engrenage pour configurer votre tolérance au slippage (préréglages 0,5 %, 1 %, 2,5 % et 5 %, une valeur personnalisée, ou Auto).
   - La tolérance au slippage garantit que votre ordre s'annule automatiquement si le prix évolue contre vous au-delà du seuil choisi.
6. **Confirmez le Swap** : Cliquez sur **Buy [Symbole du Token]** et signez la transaction dans votre portefeuille.

---

## Comment Vendre des Tokens

1. Ouvrez la trade view du token que vous détenez.
2. Sélectionnez l'onglet **Sell** dans le panneau de trading.
3. Saisissez la quantité de tokens à vendre, ou utilisez les raccourcis de pourcentage (`25%`, `50%`, `75%`, `100% / Max`).
4. Examinez le paiement estimé en ETH que vous recevrez.
5. Cliquez sur **Sell [Symbole du Token]** :
   - Première vente ? Votre portefeuille demandera une approbation initiale en un clic pour permettre au contrat intelligent de traiter vos tokens.
   - Confirmez la transaction de vente pour recevoir de l'ETH directement dans votre portefeuille.

---

## Comprendre l'Impact de Prix et le Slippage

- **Impact de Prix** : Dans le trading décentralisé, acheter un grand pourcentage des tokens disponibles pousse le prix vers le haut. Pour les tokens de bonding curve, le prix évolue de façon prévisible selon la formule de la courbe ($x \cdot y = k$).
- **Slippage** : Vous protège du front-running. Si d'autres transactions ont lieu entre le moment où vous cliquez sur « Buy » et la confirmation du bloc, votre transaction a la garantie de recevoir au moins vos tokens minimaux attendus, ou elle s'annule en toute sécurité sans dépenser vos fonds.

---

## Lire une Page de Token

- **Market cap** est la valeur totale du token maintenant : prix × supply total (1 milliard). Il bouge avec le prix même quand personne ne trade.
- **Volume 24h** est la valeur de chaque achat et vente sur les dernières 24 heures. Un token peut avoir un market cap élevé et aucun volume : précieux, mais calme.
- **Variation 24h** compare le prix à celui d'il y a 24 heures. Un token qui n'a pas tradé sur cette fenêtre affiche 0 %.
- **Pression achat / vente** répartit le volume récent en achats et ventes sur 5 minutes, 1 heure, 6 heures ou 24 heures.
- **Holders** liste les plus gros soldes. La bonding curve (ou le pool après graduation) est étiquetée comme telle, pas affichée comme un utilisateur.
- **Top traders** liste les achats, ventes, détention actuelle et profit de chaque portefeuille.
- Le **graphique** montre le prix ou le market cap en bougies de 1 seconde à 1 jour. Les barres sans transaction sont dessinées en gris.
- Sur Explore, le petit **graphe** à côté de chaque token est son prix depuis le lancement jusqu'à maintenant.

---

## Limit, Take-Profit et Stop-Loss

Pour acheter ou vendre à une cible plutôt qu'au prix en direct, utilisez les onglets **Limit** et **TP / SL** du panneau de trading. Voir [Ordres Limit, Take-Profit et Stop-Loss](/fr/protocol/advanced-orders).
