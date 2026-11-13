# Alertes de Prix et de Market Cap

Définissez une alerte sur n'importe quel token et Goton vous prévient lorsqu'il atteint votre cible. Les alertes sont liées à votre portefeuille et vérifiées sur le serveur, donc elles continuent de surveiller même si l'onglet est fermé et se déclenchent à votre prochaine ouverture de l'app.

---

## Créer une Alerte

1. Ouvrez la page **trade** d'un token.
2. Cliquez sur la **cloche d'alerte** dans l'en-tête de trading pour ouvrir le popover d'alertes.
3. Choisissez :
   - **Quoi surveiller** — **Market cap** ou **Prix** (tous deux en USD).
   - **Direction** — **Au-dessus** ou **En dessous** de votre seuil.
   - **Seuil** — la valeur en USD à franchir.
4. Créez-la. L'alerte nécessite un portefeuille connecté, car elle est stockée au nom de votre portefeuille.

Vous pouvez conserver plusieurs alertes sur le même token — par exemple « prix au-dessus de 0,01 $ » et « market cap en dessous de 50 K$ » en même temps.

---

## Comment les Alertes se Déclenchent

- Goton vérifie vos alertes ouvertes **sur le serveur**, en continu, par rapport au prix et au market cap les plus récents de chaque token — donc une alerte continue de surveiller même avec votre onglet fermé.
- Une alerte se déclenche quand la valeur franchit dans sa direction : une alerte **au-dessus** à son seuil ou au-dessus, une **en dessous** à son seuil ou en dessous.
- Quand vous ouvrez l'app, elle affiche une notification pour chaque alerte nouvellement déclenchée, et le popover marque les alertes déclenchées d'un point. Une alerte déclenchée cesse de surveiller — créez-en une nouvelle pour surveiller à nouveau.

---

## Gérer les Alertes

- Le popover liste vos alertes ouvertes et déclenchées pour le token.
- Supprimez n'importe quelle alerte de la liste à tout moment.
- Les alertes sont par portefeuille : connectez le même portefeuille pour les revoir sur un autre appareil.

---

## Notes

- Les seuils sont des valeurs en **USD**. Une alerte de market cap surveille le market cap USD (fully-diluted) du token ; une alerte de prix surveille son prix USD.
- Les alertes ne sont qu'une **notification** — elles ne passent jamais d'ordre. Pour agir automatiquement à un prix, utilisez les [ordres Limit, Take-Profit et Stop-Loss](/fr/protocol/advanced-orders).
