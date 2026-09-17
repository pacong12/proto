# ¿Qué es Proto?

**Proto** es una plataforma descentralizada y no custodial de lanzamiento de tokens y exchange construida sobre **Robinhood Chain (Chain ID: 4663)** y **Arc Network (Chain ID: 5042)**.

Permite a cualquier persona crear, comerciar y descubrir tokens sin barreras financieras complejas, preventas ocultas ni riesgo de drenaje repentino de liquidez (_rug pulls_).

---

## ¿Por qué Elegir Proto?

1. **Sin Riesgo de Rug Pull**: Cada posición de liquidez se deposita directamente en el contrato de código abierto `LiquidityLocker.sol` y queda bloqueada de forma permanente. Nadie puede retirar la liquidez del pool.
2. **Protección Contra Bots**: Reglas estrictas en los bloques iniciales limitan el volumen máximo de compra por orden y por billetera, evitando que los bots agoten la liquidez inicial.
3. **Suministro Fijo Inmutable**: Suministro fijado en exactamente **1.000.000.000 tokens** (1 Mil Millones) acuñados transparentemente en la blockchain, sin funciones de emisión adicional.

---

## Dos Modelos de Lanzamiento

| Modelo               | Funcionamiento                                                                                                                                                             | Ideal Para                                                                             |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **v1 Direct Pool**   | Se lanza directamente a un pool de Uniswap V3 con el 100% del suministro no-creador bloqueado permanentemente.                                                             | Proyectos que buscan profundidad DEX completa desde el bloque inicial.                 |
| **v2 Bonding Curve** | Comienza en una curva de precios algorítmica ($x \cdot y = k$). Tras alcanzar el objetivo (4.2 ETH en Robinhood o 8,400 USDC en Arc), se gradúa a Uniswap automáticamente. | Tokens comunitarios, memes y experimentos que buscan descubrimiento de precio gradual. |
