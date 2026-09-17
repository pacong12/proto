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

| Modèle               | Fonctionnement                                                                                                                               | Idéal pour                                        |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **v1 Direct Pool**   | Lancement instantané dans un pool Uniswap V3 avec liquidité verrouillée à 100%.                                                              | Projets recherchant une profondeur DEX immédiate. |
| **v2 Bonding Curve** | Débute sur une courbe de prix ($x \cdot y = k$) puis migre automatiquement vers Uniswap une fois l'objectif atteint (4.2 ETH ou 8 400 USDC). | Tokens communautaires et mèmes.                   |
