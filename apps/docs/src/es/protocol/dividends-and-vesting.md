# Dividendos de Holders y Vesting

La pestaña **Dividends** de tu perfil es donde se cobran dos tipos de recompensas on-chain: **dividendos por reparto de tarifas a holders** de los tokens que posees, y **tokens en vesting** de asignaciones que se desbloquean con el tiempo. Ambos se reclaman directamente a tu billetera.

---

## Dividendos de Holders

Algunos tokens activan **Holder Fee Sharing** al lanzarse. Para esos tokens, una parte de las tarifas de trading se acumula **de forma prorrateada para todos los holders** — no solo el creador.

En la pestaña Dividends verás:

- **Total claimable** — tus recompensas acumuladas, listadas por moneda (ETH / WETH en Robinhood, USDC en Arc).
- **Entradas por token** — cada token que posees que comparte tarifas, con la cantidad que te espera.
- **Claim all** — cobra los dividendos de todos los tokens de una vez, o reclama un solo token desde su fila.

Las recompensas siguen acumulándose mientras el token opera; reclamar barre lo acumulado a tu billetera. Un token solo aparece aquí si su creador activó Holder Fee Sharing — consulta [Tarifas y Recompensas del Creador](/es/protocol/fees-and-burns) sobre cómo se configura el reparto de tarifas.

---

## Vesting

Cuando un token te otorga una asignación que se desbloquea con el tiempo (por ejemplo, una asignación de creador o contribuidor), su **calendario de vesting** aparece en la misma pestaña, por token:

| Campo                     | Significado                                     |
| :------------------------ | :---------------------------------------------- |
| **Total (aún bloqueado)** | Tokens que aún no se han desbloqueado           |
| **Claimed**               | Tokens que ya has liberado a tu billetera       |
| **Claimable**             | Tokens desbloqueados que puedes liberar ahora   |
| **Cliff ends**            | La fecha antes de la cual no se desbloquea nada |
| **Fully unlocked**        | La fecha en que toda la asignación ha vesteado  |

Un calendario tiene un **cliff** (nada se libera hasta esa fecha) y luego se desbloquea gradualmente hasta vestear por completo. Hay dos acciones en una posición de vesting:

- **Claim tokens** — libera a tu billetera los tokens desbloqueados que se pueden reclamar ahora.
- **Claim dividends** — cobra los dividendos por reparto de tarifas a holders ganados por esa posición de vesting.

---

## Notas

- Todo aquí es **on-chain**. Reclamar es una transacción de billetera; la lógica de vesting y de reparto de tarifas vive en los contratos del token, sin ningún admin que pueda redirigir tus recompensas.
- La pestaña muestra tus cantidades reclamables y tu vesting solo en **tu propio** perfil (conecta tu billetera). Las cantidades se actualizan a medida que los tokens operan y los desbloqueos pasan su cliff.
