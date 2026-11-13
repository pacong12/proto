# Lancer un Token

Créer votre propre token sur Goton prend moins de deux minutes et ne requiert aucune expérience en programmation ou en développement blockchain.

---

## Guide de Lancement Étape par Étape

### 1. Connectez votre Portefeuille

Allez sur [%APP_HOST%](%APP_URL%) et cliquez sur **Connect Wallet** dans la barre de navigation du haut. Assurez-vous que votre portefeuille est connecté à **Robinhood Chain** (Chain ID : 4663).

### 2. Allez sur la Page Create

Cliquez sur **Create** ou naviguez directement vers `/launchpad/create`.

### 3. Remplissez les Détails du Token

Saisissez les informations essentielles de votre token :

- **Nom du Token** : Le nom complet (ex. `Robin Gold`).
- **Symbole (Ticker)** : 3 à 6 lettres majuscules (ex. `GOLD`).
- **Description** : Une brève introduction décrivant votre token, son objectif ou la vision de la communauté.
- **Logo du Token** : Téléversez un fichier image (PNG, JPG, SVG ou WebP). Goton compresse automatiquement votre image et l'épingle en toute sécurité sur IPFS.

### 4. Ajoutez des Liens Communautaires (Optionnel)

Vous pouvez inclure des liens officiels pour que les traders vérifient et rejoignent votre projet :

- URL du site web
- Handle officiel X (Twitter)
- Lien Telegram de la communauté

### 5. Achat Initial (Optionnel)

Si vous souhaitez acheter une allocation initiale en tant que créateur au prix de lancement, saisissez le montant (ETH sur Robinhood Chain, USDC sur Arc). Un achat initial est aussi ce qui liste un lancement sur [Memestock](/fr/protocol/social#memestock), avec une description écrite.

### 6. Confirmez et Déployez

Cliquez sur **Launch Token** et confirmez la transaction dans votre portefeuille :

- **Frais de Lancement** : Fixés à `0.0005 ETH` sur Robinhood Chain, ou `0 USDC` sur Arc Network (lancement gratuit avec un minimum de 4,50 USDC de pré-achat).
- Une fois la transaction confirmée, votre token est actif, vérifiable et échangeable immédiatement !

---

## Qu'advient-il du Supply du Token ?

Chaque token créé sur Goton a un supply strictement fixe :

- **Supply Total** : Exactement **1 000 000 000 tokens** (1 milliard).
- **Décimales** : 18.
- **Pas de Minting** : Aucune fonction n'existe pour minter des tokens supplémentaires après le lancement.
- **Pas de Pause** : Le token ne peut être ni gelé ni blacklisté.

---

## Graduation

- **Robinhood Chain** : un token trade sur sa bonding curve jusqu'à ce que la courbe lève **4,2 ETH**. La courbe se ferme alors, et son ETH et ses tokens restants passent dans un pool Uniswap v4 dont la liquidité est verrouillée pour toujours. La graduation est permissionless : le keeper de Goton la déclenche en environ 30 secondes, et si quelqu'un trade d'abord, sa transaction la déclenche à la place.
- **Arc Network** : il n'y a pas de courbe. Un token trade dans son pool Uniswap v4 verrouillé dès le premier bloc.

Après la graduation, le token continue de trader sur la même page ; l'app route les transactions vers le pool.
