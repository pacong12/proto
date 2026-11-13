# Profile und Identität

Jede Wallet auf Goton hat ein öffentliches Profil und ein eingebautes **Pseudonym**, sodass Menschen schon ab ihrem allerersten Trade einen Namen und eine Seite haben — ohne Registrierung. Du kannst dein Profil anpassen, sobald deine Wallet verbunden ist.

---

## Dein Pseudonym

Sobald eine Wallet erscheint, gibt Goton ihr einen deterministischen, aus ihrer Adresse abgeleiteten Benutzernamen — ein Adjektiv, ein Material und einen Archetyp, plus ein kurzes Kürzel aus der Adresse, zum Beispiel **AeroBrassGriffin#79c8**. Daraus ergeben sich drei Formen, die alle auf dieselbe Wallet zeigen:

- **Anzeigename** — `AeroBrassGriffin#79c8`
- **Handle** — `@AeroBrassGriffin#79c8`
- **Slug** — `aerobrassgriffin-79c8` (die URL-sichere Form)

Da es aus der Adresse abgeleitet ist, ändert sich dein Pseudonym **nie** und ist überall in der App gleich. Es ist auch das, was dein [Empfehlungslink](/de/protocol/referrals) verwendet.

---

## Profil-URLs

Ein Profil öffnet sich über mehrere gleichwertige Pfade, die alle auf dieselbe Wallet auflösen:

- `/u/<adresse>`, `/profile/<adresse>`, `/user/<adresse>`, `/@<adresse>`
- `/<benutzername>` — der Slug, z. B. `/aerobrassgriffin-79c8`

Eine Adress-URL wird in die saubere `/<benutzername>`-Form umgeschrieben. Ein eingegebener Name, Slug oder Handle wird auf seine Adresse aufgelöst, sodass das Teilen eines Namens genauso gut funktioniert wie das Teilen einer Adresse.

---

## Dein Profil Bearbeiten

Auf **deinem eigenen** Profil (mit verbundener Wallet) kannst du mit **Edit Profile** deine öffentliche Creator-Identität anpassen:

| Feld             | Hinweise                                                 |
| :--------------- | :------------------------------------------------------- |
| **Cover-Banner** | Ein von deinem Gerät hochgeladenes Bild                  |
| **Profilfoto**   | Ein von deinem Gerät hochgeladener Avatar                |
| **Anzeigename**  | Bis zu 32 Zeichen; überschreibt das Pseudonym öffentlich |
| **Bio**          | Eine kurze Beschreibung — Strategien, dein Alpha, alles  |
| **X (Twitter)**  | Dein Handle                                              |
| **Telegram**     | Dein Handle                                              |

Hochgeladene Bilder werden auf IPFS gespeichert; der Rest des Profils wird für deine Wallet gespeichert. Du kannst deine Social-Daten auch **löschen**, um die benutzerdefinierten Felder zu leeren und zum Pseudonym zurückzukehren.

---

## Was ein Profil Zeigt

Jedes Profil — deins oder das von irgendwem — bündelt die Aktivität dieser Wallet an einem Ort:

- **[Creator-Reputation](/de/protocol/reputation)** — ihre Launch-Historie.
- **[Portfolio](/de/protocol/portfolio)** — Performance und aktuelle Bestände.
- **Posts & Calls** — ihre [Feed](/de/protocol/social)-Aktivität.
- **Created Tokens** — die von der Wallet gelaunchten Tokens.
- **[Holder-Dividenden und Vesting](/de/protocol/dividends-and-vesting)** — beanspruchbare Belohnungen (eigenes Profil).
- **[Freunde einladen](/de/protocol/referrals)** — ihr Einladungslink (eigenes Profil).

---

## Hinweise

- Ein Profil ist **öffentlich** und wird aus der On-Chain-Aktivität plus den von dir gesetzten optionalen Feldern gebildet. Es legt nichts offen, was über das hinausgeht, was die Chain und deine eigenen Bearbeitungen bereitstellen.
- Es gibt kein Konto, keine E-Mail und kein Passwort — deine Wallet _ist_ deine Identität.
