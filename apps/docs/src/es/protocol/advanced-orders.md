# Órdenes Limit, Take-Profit y Stop-Loss

Además de comprar y vender al precio en vivo, el panel de trading tiene dos pestañas más: **Limit** y **TP / SL**. Ambas colocan una orden en el contrato `GotonLimitOrders`, que retiene tus fondos hasta que la orden se ejecuta o la cancelas.

---

## Los Tres Tipos de Orden

| Orden           | Lo que depositas             | Se ejecuta cuando                                                                 |
| :-------------- | :--------------------------- | :-------------------------------------------------------------------------------- |
| **Limit buy**   | ETH (Robinhood) o USDC (Arc) | El market cap baja a tu objetivo, recibiendo al menos los tokens que te cotizaron |
| **Take profit** | Tokens                       | El market cap sube a tu objetivo, recibiendo al menos la cantidad cotizada        |
| **Stop loss**   | Tokens                       | El market cap baja a tu stop, y vende con tu límite de slippage                   |

Los objetivos se ingresan como un **market cap en USD**, que la app convierte al precio on-chain y al mínimo que recibirás. Ese mínimo ya considera la tarifa del pool o la curva, el impuesto del token y la tarifa de ejecutor del 0.1%, así que una orden se ejecuta cuando el mercado alcanza tu objetivo, no después.

Un take profit y un stop loss pueden compartir un depósito (**one-cancels-other**): la primera parte que se ejecuta cierra la orden y la otra desaparece.

---

## Cómo se Ejecutan las Órdenes

- **Cualquiera puede ejecutar una orden** una vez que se cumple su condición. Goton opera un keeper que revisa las órdenes abiertas cada 15 segundos y las ejecuta, pero el contrato acepta a cualquier ejecutor.
- **El ejecutor gana 0.1%** del lado de cotización (la tarifa de ejecutor). El keeper solo ejecuta cuando esa tarifa cubre su gas, así que las órdenes muy pequeñas pueden esperar a que otro las ejecute, o a que las canceles.
- **Los stop loss usan un precio resistente a la manipulación.** En una bonding curve, el stop se activa solo cuando tanto el precio spot de la curva como su TWAP (promedio ponderado en el tiempo de unos 10 a 20 minutos) están en o por debajo de tu stop. En un pool Uniswap v4 funciona igual, con el precio spot del pool y su TWAP de 30 minutos del hook de Goton. En ambos casos, el empuje de precio de un solo bloque no puede activar tu stop, y un stop no se dispara una vez que el precio se recupera por encima de él. Un stop espera hasta que el precio tenga suficiente historial: unos 10 minutos en un token nuevo, y 30 minutos tras graduarse a su pool. Puedes colocarlo antes; se arma solo.
- **Cada ejecución se verifica contra tu cambio de saldo.** El contrato mide lo que realmente llegó a tu billetera, no lo que un router reporta, y reembolsa lo que sobra de una ejecución parcial.

---

## Custodia, Vencimiento y Cancelación

- Tu depósito permanece en el contrato hasta que la orden se ejecuta o la cancelas. El contrato **no tiene propietario ni funciones de admin**: los fondos en custodia solo pueden ejecutar tu orden en tus términos o devolverse a ti.
- Cada orden tiene un vencimiento (1, 7 o 30 días). Después de eso ya no puede ejecutarse, pero **cancelar sigue funcionando**, en cualquier momento, y devuelve el depósito completo.
- Cancela desde la lista **Open orders** bajo el panel de trading.

---

## Historial de Órdenes y Notificaciones

- El panel bajo el formulario de trading tiene dos pestañas: **Open** e **History**. History lista las órdenes ejecutadas y canceladas con la parte que se ejecutó, lo que recibiste y un enlace a la transacción de cierre.
- Mientras tu billetera está conectada, la app revisa tus órdenes cada 20 segundos en cualquier página y muestra una notificación cuando una se ejecuta.

---

## Dónde Están Disponibles las Órdenes

| Cadena          | Tokens en bonding curve     | Pools Uniswap v4            |
| :-------------- | :-------------------------- | :-------------------------- |
| Robinhood Chain | Tokens de la fábrica actual | Tokens graduados            |
| Arc Network     | — (Arc no tiene curvas)     | Tokens de la fábrica actual |

Las pestañas Limit y TP / SL solo aparecen en tokens donde una orden puede ejecutarse. Los tokens de fábricas anteriores no las muestran.

Las direcciones de contrato se listan en [Contratos Inteligentes Verificados](/integration/contracts).
