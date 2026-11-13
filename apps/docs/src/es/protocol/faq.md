# Preguntas Frecuentes (FAQ)

Encuentra respuestas a preguntas comunes sobre trading, lanzamiento y gestión de tokens en Goton.

---

## Preguntas Generales

### ¿Qué es Goton?

Goton es un launchpad cripto descentralizado y no custodial que soporta tanto **Robinhood Chain** (L2) como **Arc Network** (L1 de stablecoin de Circle). Permite a cualquiera lanzar tokens de suministro fijo, operar con gráficos en vivo y participar en lanzamientos justos con liquidez bloqueada de forma permanente.

### ¿Puede un desarrollador hacer rug pull o drenar la liquidez?

**No.** Las posiciones de liquidez creadas en Goton se mintean directamente en el contrato inteligente de código abierto `LiquidityLocker.sol` y quedan bloqueadas para siempre. No hay función de desbloqueo, puerta trasera ni clave de retiro de admin.

### ¿Qué billeteras son compatibles?

Goton soporta todas las billeteras Web3 estándar compatibles con Ethereum, incluyendo:

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- Billeteras móviles compatibles con WalletConnect / Reown

Goton solo conecta billeteras. No hay login por email ni social, así que la app nunca retiene una clave por ti.

---

## Trading y Swaps

### ¿Por qué falló mi operación?

Las operaciones suelen fallar por dos razones:

1. **Slippage Excedido**: Durante alta volatilidad, el precio cambió más que tu porcentaje de slippage configurado entre el momento del clic y la confirmación del bloque. Aumenta el slippage en los ajustes de trading (p. ej., de 1% a 2%).
2. **Saldo de Gas Insuficiente**: Mantén siempre un pequeño saldo del token de gas nativo (ETH en Robinhood o USDC en Arc) para pagar las tarifas de ejecución de la red.

### ¿Cuál es la diferencia entre On Curve y Graduated?

- **On Curve (v2)**: El token opera actualmente en la bonding curve matemática. El precio sube a medida que se compran tokens.
- **Graduated**: En Robinhood Chain, la curva alcanzó su objetivo de 4.2 ETH y el mercado pasó de forma permanente a un pool Uniswap v4 bloqueado. En Arc Network, los tokens operan en un pool Uniswap v4 desde el lanzamiento y se gradúan in-pool cuando el market cap supera ~$45,000.

### ¿Puedo comprar o vender a un precio objetivo?

Sí. Las pestañas **Limit** y **TP / SL** colocan una orden que se ejecuta automáticamente cuando el market cap alcanza tu objetivo, y puedes cancelarla en cualquier momento. Consulta [Órdenes Limit, Take-Profit y Stop-Loss](/es/protocol/advanced-orders).

### ¿Cuál es la diferencia entre Explore y Memestock?

Explore lista cada token. Memestock lista solo los lanzamientos con una tesis escrita cuyo creador compró y aún mantiene la mayor parte de su posición, ordenados por trading reciente. Consulta [Feed, Calls, Memestock y Seguir](/es/protocol/social).

### ¿Hay restricciones de venta?

**Nunca.** Los usuarios pueden vender sus tokens en cualquier momento. Goton nunca impone bloqueos, periodos de espera de venta ni congelaciones de transferencia a los holders.

---

## Creación de Tokens

### ¿Cuánto cuesta lanzar un token?

La tarifa de despliegue del protocolo es **0.0005 ETH** en Robinhood Chain o **Gratis (0 USDC)** en Arc Network (requiere una pre-compra inicial mínima de 4.50 USDC). Esto cubre el despliegue del contrato inteligente, el minteo del token y el bloqueo inicial de liquidez.

### ¿Se pueden mintear más tokens después?

**No.** Cada token creado en Goton tiene un suministro fijo e inmutable de exactamente **1.000.000.000 tokens** (1 mil millones). El contrato no tiene función de minteo.

### ¿Cómo ganan tarifas los creadores?

Las tarifas y el impuesto de cada token se reparten on-chain: **70% a la parte del creador en Robinhood Chain, 80% en Arc**, y el resto al protocolo. El creador puede dividir esa parte una vez, antes de que comience el trading público, entre sí mismo, los holders y buyback-and-burn. Consulta [Tarifas y Recompensas del Creador](/es/protocol/fees-and-burns). Reclama las tarifas acumuladas en tu página de **Perfil**.

---

## Red y Soporte

### ¿Qué red usa Goton?

Goton opera como un protocolo multi-cadena que soporta **Robinhood Chain** (Chain ID: `4663`) y **Arc Network** (Chain ID: `5042`).

### ¿Dónde puedo obtener ayuda?

Para asistencia de la comunidad, discusiones y actualizaciones, únete a nuestros canales oficiales o revisa nuestros [Contratos Inteligentes Verificados](/integration/contracts).
