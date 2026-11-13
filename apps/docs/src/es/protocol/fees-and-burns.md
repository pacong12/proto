# Tarifas y Recompensas del Creador

Goton alinea el éxito a largo plazo de los creadores de tokens con sus comunidades, ofreciendo una de las estructuras de tarifas más favorables para creadores de todo el ecosistema blockchain.

---

## Distribución de Tarifas

De dónde provienen las tarifas depende de la cadena:

- **Robinhood Chain**: mientras un token está en su bonding curve, cada operación en la curva paga una tarifa del 1% al protocolo. Tras la graduación, el pool Uniswap v4 bloqueado cobra una tarifa LP del 1%.
- **Arc Network**: el pool Uniswap v4 cobra una tarifa LP del 1% desde el lanzamiento, más un impuesto opcional de compra/venta del 0–10% que el creador fija al lanzar.

Las tarifas del pool y los impuestos se reparten mediante el divisor de tarifas on-chain de cada token:

- **Al tesoro** del protocolo: 30% en Robinhood Chain, 20% en Arc. Los contratos limitan la parte del protocolo al 30% y la tarifa de lanzamiento a 10 USDC en Arc (0.01 ETH en Robinhood Chain).
- **El resto (70% u 80%) es la parte del creador**, que el creador puede dividir una vez, antes de que comience el trading público, entre:
  - **Creador**: reclamable por el creador (o su destinatario redirigido).
  - **Holders**: transmitido a los holders del token de forma prorrateada durante 24 horas.
  - **Buyback & Burn**: recomprado en el propio pool del token por el contrato `GotonV4Buyback` y enviado a la dirección muerta. Cada recompra se limita al TWAP de 30 minutos del pool ± 2%, de modo que un precio manipulado solo pausa la recompra hasta que se normaliza.
  - **Liquidez**: enviada a la bóveda de liquidez del protocolo, que actualmente es el tesoro del protocolo. La app goton.fun no ofrece esta opción, porque no añade liquidez al propio pool del token.

Por defecto, toda la parte del creador va al creador. La parte del protocolo no se usa para recompras.

---

## Cómo Reclaman Recompensas los Creadores

1. Conecta la billetera que creó originalmente el token.
2. Ve a tu página de **Perfil** (`/profile`).
3. En la sección **My Launches**, consulta tus recompensas acumuladas no cobradas en ETH y tokens.
4. Haz clic en **Claim Fees** para retirar tus recompensas directamente a tu billetera en una sola transacción.

---

## Pagos al Equipo

Un creador puede compartir su parte de las tarifas con un equipo. En **Advanced → Fee recipients** de la página de creación, añade billeteras del equipo con porcentajes fijos (hasta 10 billeteras, sumando 100%). La app crea entonces un `GotonTeamSplitter` para el equipo antes del lanzamiento:

- **Robinhood Chain**: el impuesto del token va al equipo desde el lanzamiento. Tras la graduación, redirige las tarifas del pool al mismo equipo desde tu perfil (timelock de 48 horas).
- **Arc**: las tarifas y el impuesto llegan al equipo una vez que la redirección de pagos propuesta al lanzar se activa, 48 horas después. Hasta entonces van al creador.

El contrato del equipo no tiene propietario y sus miembros y porcentajes nunca pueden cambiar. Cualquiera puede liberar las partes de los miembros desde la página del token (**About → Team payouts**); cada miembro siempre cobra directamente.

---

## Redirección de Tarifas (Community Takeovers)

Si un creador desea recompensar a su comunidad o ceder el liderazgo del proyecto:

- Solo el creador puede redirigir la porción del creador de las tarifas a un tesoro DAO, multisig comunitario o contrato de recompensas. Una propuesta puede aceptarse tras un timelock de 48 horas, y el creador puede cancelarla hasta que se acepte.
- El creador puede luego bloquear el destinatario de forma permanente. El protocolo nunca puede mover las tarifas de un creador.
- Esta función potencia los community takeovers (CTO) al convertir los ingresos del proyecto en financiación de propiedad comunitaria. Consulta [Community Takeovers](./community-takeovers.md).
