# Invita Amigos y Referidos

Cada perfil tiene una tarjeta **Invita amigos** con un enlace de invitación personal. Cuando alguien abre Goton a través de tu enlace y conecta una billetera, esa billetera se te acredita. La atribución es **off-chain y de primer contacto (first-touch)**, así que no cuesta gas ni requiere firma.

---

## Tu Enlace de Invitación

Abre tu propio perfil y busca la tarjeta **Invita amigos**. Muestra:

- **Tu enlace de invitación** — `https://goton.fun/?ref=<tu-usuario>`, usando el nombre de usuario de tu billetera (p. ej., `aerobrassgriffin-79c8`). Una dirección de billetera también funciona; el nombre de usuario solo es más fácil de leer y compartir.
- **Referred** — cuántas billeteras has referido hasta ahora.
- **Copiar enlace** — copia el enlace a tu portapapeles.

El mismo código `?ref=` se añade automáticamente cada vez que compartes desde Goton — consulta [A dónde viaja tu enlace](#a-donde-viaja-tu-enlace).

---

## Cómo Funciona la Atribución

- **Primer contacto.** El primer enlace de invitación que abre un visitante es el que cuenta. Se recuerda en su navegador hasta que conecta una billetera, y un enlace posterior **no** lo sobrescribe.
- **Una billetera, una vez.** Cuando el visitante conecta una billetera, esa billetera se atribuye a tu enlace una sola vez. Volver a conectar, o abrir otro enlace después, no cambia nada.
- **Sin auto-referidos.** Abrir tu propio enlace y conectar tu propia billetera no registra nada.
- **Nombre de usuario o dirección.** Un `?ref=` que es un nombre de usuario se resuelve de vuelta a la billetera del referidor antes de registrarse; un referidor que nunca ha operado ni lanzado puede no resolverse por nombre, en cuyo caso un enlace con dirección es la forma más fiable.

Como la atribución es de primer contacto y off-chain, lo peor que puede hacer un abusador es inflar un recuento cosmético. El recuento es informativo hoy — aún no hay recompensas on-chain asociadas.

---

## A dónde viaja tu enlace

Tu código de referido se añade a los enlaces que compartes desde la app, así que compartir tu actividad también hace crecer tu red:

| Acción                                 | Lo que se comparte                                                |
| :------------------------------------- | :---------------------------------------------------------------- |
| **Compartir perfil**                   | Un enlace al perfil, llevando el `?ref` de tu billetera conectada |
| **Compartir tarjeta PnL**              | El enlace de tu tarjeta `/pnl/…` con `?ref`                       |
| **Compartir en X** desde token / trade | El enlace de la página del token con `?ref`                       |
| **Compartir un call** o publicación    | El enlace `/post/…` con `?ref`                                    |

En todos los casos, el código es el de la billetera **conectada** — la persona que comparte — así que compartir el perfil de otra persona igual te acredita a ti.

---

## FAQ

**¿Gano algo por los referidos hoy?** Todavía no. El recuento es cosmético por ahora. Cuando se introduzcan recompensas, se espera que la atribución pase a un disparador on-chain firmado (como el primer lanzamiento o trade del referido).

**¿Puedo cambiar quién me refirió?** No. El primer contacto es permanente una vez que una billetera se conecta.

**Mi enlace usa mi nombre de usuario — ¿es estable?** El nombre de usuario se deriva de tu dirección de billetera, así que nunca cambia.
