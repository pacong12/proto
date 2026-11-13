# Foire Aux Questions (FAQ)

Trouvez des réponses aux questions courantes sur le trading, le lancement et la gestion de tokens sur Goton.

---

## Questions Générales

### Qu'est-ce que Goton ?

Goton est un launchpad crypto décentralisé et non custodial prenant en charge à la fois **Robinhood Chain** (L2) et **Arc Network** (L1 stablecoin de Circle). Il permet à quiconque de lancer des tokens à supply fixe, de trader avec des graphiques en direct et de participer à des lancements équitables avec une liquidité verrouillée en permanence.

### Un développeur peut-il faire un rug pull ou drainer la liquidité ?

**Non.** Les positions de pool de liquidité créées sur Goton sont mintées directement dans le contrat intelligent open-source `LiquidityLocker.sol` et verrouillées pour toujours. Il n'y a pas de fonction de déverrouillage, de porte dérobée ni de clé de retrait admin.

### Quels portefeuilles sont pris en charge ?

Goton prend en charge tous les portefeuilles Web3 standard compatibles Ethereum, dont :

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- Portefeuilles mobiles compatibles WalletConnect / Reown

Goton connecte uniquement des portefeuilles. Il n'y a pas de connexion par e-mail ou réseau social, donc l'app ne détient jamais de clé pour vous.

---

## Trading et Swaps

### Pourquoi ma transaction a-t-elle échoué ?

Les transactions échouent généralement pour deux raisons :

1. **Slippage Dépassé** : Lors d'une forte volatilité, le prix a changé davantage que votre pourcentage de slippage configuré entre le clic et la confirmation du bloc. Augmentez le slippage dans les paramètres de trading (ex. de 1 % à 2 %).
2. **Solde de Gas Insuffisant** : Gardez toujours un petit solde du token de gas natif (ETH sur Robinhood ou USDC sur Arc) pour payer les frais d'exécution du réseau.

### Quelle est la différence entre On Curve et Graduated ?

- **On Curve (v2)** : Le token trade actuellement sur la bonding curve mathématique. Le prix augmente à mesure que des tokens sont achetés.
- **Graduated** : Sur Robinhood Chain, la courbe a atteint sa cible de 4,2 ETH et le marché est passé de façon permanente dans un pool Uniswap v4 verrouillé. Sur Arc Network, les tokens tradent dans un pool Uniswap v4 dès le lancement et graduent in-pool une fois que le market cap dépasse ~45 000 $.

### Puis-je acheter ou vendre à un prix cible ?

Oui. Les onglets **Limit** et **TP / SL** placent un ordre qui s'exécute automatiquement quand le market cap atteint votre cible, et vous pouvez l'annuler à tout moment. Voir [Ordres Limit, Take-Profit et Stop-Loss](/fr/protocol/advanced-orders).

### Quelle est la différence entre Explore et Memestock ?

Explore liste chaque token. Memestock ne liste que les lancements avec une thèse écrite dont le créateur a acheté et détient encore la majeure partie de sa position, classés par trading récent. Voir [Feed, Calls, Memestock et Suivi](/fr/protocol/social).

### Y a-t-il des restrictions de vente ?

**Jamais.** Les utilisateurs peuvent vendre leurs tokens à tout moment. Goton n'impose jamais de blocages, de délais de vente ni de gels de transfert aux holders.

---

## Création de Tokens

### Combien coûte le lancement d'un token ?

Les frais de déploiement du protocole sont de **0.0005 ETH** sur Robinhood Chain ou **Gratuit (0 USDC)** sur Arc Network (nécessite un pré-achat initial minimal de 4,50 USDC). Cela couvre le déploiement du contrat intelligent, le minting du token et le verrouillage initial de la liquidité.

### Peut-on minter plus de tokens plus tard ?

**Non.** Chaque token créé sur Goton a un supply immuable et fixe d'exactement **1 000 000 000 tokens** (1 milliard). Le contrat n'a pas de fonction de minting.

### Comment les créateurs gagnent-ils des frais ?

Les frais et la taxe de chaque token sont répartis on-chain : **70 % pour la part du créateur sur Robinhood Chain, 80 % sur Arc**, et le reste pour le protocole. Le créateur peut répartir cette part une fois, avant le début du trading public, entre lui-même, les holders et le buyback-and-burn. Voir [Frais et Récompenses du Créateur](/fr/protocol/fees-and-burns). Réclamez les frais accumulés sur votre page **Profil**.

---

## Réseau et Support

### Quel réseau Goton utilise-t-il ?

Goton opère comme un protocole multi-chaîne prenant en charge **Robinhood Chain** (Chain ID : `4663`) et **Arc Network** (Chain ID : `5042`).

### Où puis-je obtenir de l'aide ?

Pour l'assistance communautaire, les discussions et les mises à jour, rejoignez nos canaux officiels ou consultez nos [Contrats Intelligents Vérifiés](/integration/contracts).
