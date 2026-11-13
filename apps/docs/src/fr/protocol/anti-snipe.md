# Protections Anti-Snipe et Lancement Équitable

L'une des plus grandes frustrations du trading crypto est de perdre les premières opportunités au profit de bots sniper automatisés qui raflent la liquidité du pool en quelques millisecondes.

Goton intègre des règles de contrat intelligent codées en dur durant les premiers blocs d'un lancement, afin que les membres ordinaires de la communauté aient une chance équitable de participer.

---

## Comment Ça Marche

Goton emploie des **frais sniper dégressifs et dynamiques** sur son architecture de bonding curve :

- À la seconde exacte du lancement ($t=0$), une taxe automatique de 99 % s'applique à tout bot prédateur tentant une exécution instantanée.
- Les frais décroissent rapidement sur les 3 secondes suivantes ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- En quelques secondes, le trading standard sans taxe reprend normalement pour les traders humains.

---

## Garanties de Transparence et de Sécurité

- **Pas de Whitelists ni de Gardiens** : Toute personne avec un portefeuille Web3 peut participer dès que la fenêtre de lancement équitable s'ouvre.
- **Pas d'Interrupteurs d'Admin** : Les limites anti-snipe sont codées mathématiquement dans le contrat et expirent sans intervention humaine.
- **Vente Toujours Possible** : Il n'y a aucun blocage artificiel ni délai de retrait sur les tokens achetés par les utilisateurs.
