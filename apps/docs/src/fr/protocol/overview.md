# Qu’est-ce que Proto ?

**Proto** est un protocole décentralisé et non-dépositaire de lancement et d’échange de tokens sur **Robinhood Chain (Chain ID : 4663)** et **Arc Network (Chain ID : 5042)**.

Il offre un cadre sécurisé et transparent permettant à chacun de créer, échanger et découvrir des actifs numériques sans risques de retrait unilatéral de liquidité (_rug pull_).

---

## Pourquoi choisir Proto ?

1. **Aucun Risque de Rug Pull** : Toutes les positions de liquidité sont verrouillées de façon permanente dans le smart contract `LiquidityLocker.sol`.
2. **Protection Anti-Sniper** : Des règles strictes limitent le montant d’achat maximal durant les premiers blocs pour contrer les bots.
3. **Offre Fixe et Immuable** : Exactement **1 000 000 000 de tokens** (1 milliard), sans possibilité de frappe ultérieure.

---

## Deux modèles de lancement

| Modèle                                | Fonctionnement                                                                                                                                                                                                                 | Idéal pour                                                       |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **Robinhood : Bonding Curve**         | Négociation sur une courbe de prix ($x \cdot y = k$). Environ 714,3 M de tokens (71,43 %) sont vendus sur la courbe ; à 4,2 ETH levés, le marché est migré vers un pool Uniswap v4 verrouillé contenant les ~285,7 M restants. | Tokens communautaires et mèmes.                                  |
| **Arc : Uniswap v4 dès le lancement** | Toute l'offre est placée en liquidité unilatérale dans un pool Uniswap v4 dès le premier bloc (valeur d'ouverture ≈ 2 480 $). Le token est gradué dans le pool au-delà de ≈ 45 000 $ de capitalisation, sans migration.        | Tokens destinés à être échangés sur Uniswap dès le premier bloc. |
