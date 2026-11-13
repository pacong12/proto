# Guía de Trading y Swaps

Comprar y vender tokens en Goton está diseñado para ser rápido, ágil y seguro. Cada operación se ejecuta de forma no custodial a través de tu billetera personal.

---

## Cómo Comprar Tokens

1. **Selecciona un Token**: Navega la página **Explore** o haz clic en cualquier tarjeta de token para abrir su Trade View dedicada.
2. **Revisa el Gráfico y las Métricas**:
   - Observa las velas de precio en vivo y las tendencias de volumen de 24 horas.
   - Verifica si el token está actualmente **On Curve** (subiendo hacia la graduación) o **Graduated** (operando en el DEX Uniswap).
   - Revisa las métricas de comunidad, los principales holders y las insignias de estado del creador.
3. **Elige el Modo Compra**: En el panel de trading a la derecha, asegúrate de que la pestaña **Buy** esté activa.
4. **Ingresa la Cantidad**:
   - Escribe la cantidad que deseas gastar (ETH en Robinhood Chain, USDC en Arc), o usa los botones de selección rápida. También puedes ingresar la cantidad en USD.
   - El panel calcula automáticamente tus tokens estimados a recibir.
5. **Ajusta el Slippage (Opcional)**:
   - Haz clic en el ícono de engranaje para configurar tu tolerancia al slippage (presets 0.5%, 1%, 2.5% y 5%, un valor personalizado, o Auto).
   - La tolerancia al slippage asegura que tu orden se cancele automáticamente si el precio se mueve en tu contra más allá del umbral elegido.
6. **Confirma el Swap**: Haz clic en **Buy [Símbolo del Token]** y firma la transacción en tu billetera.

---

## Cómo Vender Tokens

1. Abre la trade view del token que posees.
2. Selecciona la pestaña **Sell** en el panel de trading.
3. Ingresa la cantidad de tokens que deseas vender, o usa los atajos de porcentaje (`25%`, `50%`, `75%`, `100% / Max`).
4. Revisa el pago estimado en ETH que recibirás.
5. Haz clic en **Sell [Símbolo del Token]**:
   - ¿Primera vez vendiendo? Tu billetera solicitará una aprobación inicial de un clic para permitir que el contrato inteligente procese tus tokens.
   - Confirma la transacción de venta para recibir ETH directamente en tu billetera.

---

## Entendiendo el Impacto de Precio y el Slippage

- **Impacto de Precio**: En el trading descentralizado, comprar un gran porcentaje de los tokens disponibles desplazará el precio hacia arriba. Para tokens de bonding curve, el precio cambia de forma predecible según la fórmula de la curva ($x \cdot y = k$).
- **Slippage**: Te protege del front-running. Si ocurren otras operaciones entre el momento en que haces clic en "Buy" y la confirmación del bloque, se garantiza que tu operación reciba al menos tus tokens mínimos esperados, o se cancelará de forma segura sin gastar tus fondos.

---

## Cómo Leer una Página de Token

- **Market cap** es el valor total del token ahora: precio × suministro total (1 mil millones). Se mueve con el precio incluso cuando nadie opera.
- **Volumen 24h** es el valor de cada compra y venta en las últimas 24 horas. Un token puede tener un market cap alto y ningún volumen: valioso, pero tranquilo.
- **Cambio 24h** compara el precio con el de hace 24 horas. Un token que no ha operado en esa ventana muestra 0%.
- **Presión de compra / venta** divide el volumen reciente en compras y ventas en 5 minutos, 1 hora, 6 horas o 24 horas.
- **Holders** lista los mayores saldos. La bonding curve (o el pool tras la graduación) se etiqueta como tal, no se muestra como un usuario.
- **Top traders** lista las compras, ventas, tenencia actual y ganancia de cada billetera.
- El **gráfico** muestra el precio o el market cap en velas de 1 segundo a 1 día. Las barras sin operaciones se dibujan en gris.
- En Explore, el pequeño **gráfico** junto a cada token es su precio desde el lanzamiento hasta ahora.

---

## Limit, Take-Profit y Stop-Loss

Para comprar o vender a un objetivo en vez del precio en vivo, usa las pestañas **Limit** y **TP / SL** del panel de trading. Consulta [Órdenes Limit, Take-Profit y Stop-Loss](/es/protocol/advanced-orders).
