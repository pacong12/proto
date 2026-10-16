# ¿Qué es Goton?

**Goton** es una plataforma descentralizada y no custodial de lanzamiento de tokens y exchange construida sobre **Robinhood Chain (Chain ID: 4663)** y **Arc Network (Chain ID: 5042)**.

Permite a cualquier persona crear, comerciar y descubrir tokens sin barreras financieras complejas, preventas ocultas ni riesgo de drenaje repentino de liquidez (_rug pulls_).

---

## ¿Por qué Elegir Goton?

1. **Sin Riesgo de Rug Pull**: Cada posición de liquidez se deposita directamente en el contrato de código abierto `LiquidityLocker.sol` y queda bloqueada de forma permanente. Nadie puede retirar la liquidez del pool.
2. **Protección Contra Bots**: Reglas estrictas en los bloques iniciales limitan el volumen máximo de compra por orden y por billetera, evitando que los bots agoten la liquidez inicial.
3. **Suministro Fijo Inmutable**: Suministro fijado en exactamente **1.000.000.000 tokens** (1 Mil Millones) acuñados transparentemente en la blockchain, sin funciones de emisión adicional.

---

## Dos Modelos de Lanzamiento

| Modelo                                   | Funcionamiento                                                                                                                                                                                                                   | Ideal Para                                                                             |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Robinhood: Bonding Curve**             | Se negocia en una curva de precios ($x \cdot y = k$). Unos 714,3 M de tokens (71,43 %) se venden en la curva; al recaudar 4,2 ETH el mercado se gradúa a un pool bloqueado de Uniswap v4 con los ~285,7 M restantes.             | Tokens comunitarios, memes y experimentos que buscan descubrimiento de precio gradual. |
| **Arc: Uniswap v4 desde el lanzamiento** | Todo el suministro se coloca como liquidez de un solo lado en un pool de Uniswap v4 desde el primer bloque (valor inicial ≈ 2.480 $). El token se gradúa dentro del pool al superar ≈ 45.000 $ de capitalización, sin migración. | Tokens que deben negociarse en Uniswap desde el primer bloque.                         |
