# Perfiles e Identidad

Cada billetera en Goton tiene un perfil público y un **seudónimo** integrado, así que la gente tiene un nombre y una página desde su primera operación — sin registro. Puedes personalizar tu perfil cuando tu billetera esté conectada.

---

## Tu Seudónimo

En el momento en que aparece una billetera, Goton le da un nombre de usuario determinista derivado de su dirección — un adjetivo, un material y un arquetipo, más una etiqueta corta de la dirección, por ejemplo **AeroBrassGriffin#79c8**. De él surgen tres formas, todas apuntando a la misma billetera:

- **Nombre visible** — `AeroBrassGriffin#79c8`
- **Handle** — `@AeroBrassGriffin#79c8`
- **Slug** — `aerobrassgriffin-79c8` (la forma segura para URL)

Como se deriva de la dirección, tu seudónimo **nunca cambia** y es el mismo en toda la app. Es también lo que usa tu [enlace de referido](/es/protocol/referrals).

---

## URLs de Perfil

Un perfil se abre desde varias rutas equivalentes, todas resuelven a la misma billetera:

- `/u/<dirección>`, `/profile/<dirección>`, `/user/<dirección>`, `/@<dirección>`
- `/<usuario>` — el slug, p. ej. `/aerobrassgriffin-79c8`

Una URL con dirección se reescribe a la forma limpia `/<usuario>`. Un nombre, slug o handle escrito se resuelve de vuelta a su dirección, así que compartir un nombre funciona tan bien como compartir una dirección.

---

## Editar tu Perfil

En **tu propio** perfil (con tu billetera conectada), **Edit Profile** te permite personalizar tu identidad pública de creador:

| Campo                 | Notas                                                      |
| :-------------------- | :--------------------------------------------------------- |
| **Banner de portada** | Una imagen subida desde tu dispositivo                     |
| **Foto de perfil**    | Un avatar subido desde tu dispositivo                      |
| **Nombre visible**    | Hasta 32 caracteres; sobrescribe el seudónimo públicamente |
| **Bio**               | Una descripción corta — estrategias, tu alpha, lo que sea  |
| **X (Twitter)**       | Tu handle                                                  |
| **Telegram**          | Tu handle                                                  |

Las imágenes subidas se almacenan en IPFS; el resto del perfil se guarda para tu billetera. También puedes **borrar** tus datos sociales para vaciar los campos personalizados y volver al seudónimo.

---

## Qué Muestra un Perfil

Cada perfil — el tuyo o el de cualquiera — reúne la actividad de esa billetera en un solo lugar:

- **[Reputación del Creador](/es/protocol/reputation)** — su historial de lanzamientos.
- **[Portafolio](/es/protocol/portfolio)** — rendimiento y tenencias actuales.
- **Posts & Calls** — su actividad en el [feed](/es/protocol/social).
- **Created Tokens** — los tokens que la billetera lanzó.
- **[Dividendos de Holders y Vesting](/es/protocol/dividends-and-vesting)** — recompensas reclamables (perfil propio).
- **[Invita amigos](/es/protocol/referrals)** — su enlace de invitación (perfil propio).

---

## Notas

- Un perfil es **público** y se construye a partir de la actividad on-chain más los campos opcionales que configures. No expone nada más allá de lo que la cadena y tus propias ediciones proveen.
- No existe cuenta, email ni contraseña — tu billetera _es_ tu identidad.
