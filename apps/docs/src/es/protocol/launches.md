# Lanzar un Token

Crear tu propio token en Goton toma menos de dos minutos y no requiere ninguna experiencia en programación ni en desarrollo blockchain.

---

## Guía de Lanzamiento Paso a Paso

### 1. Conecta tu Billetera

Ve a [%APP_HOST%](%APP_URL%) y haz clic en **Connect Wallet** en la barra de navegación superior. Asegúrate de que tu billetera esté conectada a **Robinhood Chain** (Chain ID: 4663).

### 2. Ve a la Página Create

Haz clic en **Create** o navega directamente a `/launchpad/create`.

### 3. Completa los Detalles del Token

Ingresa la información esencial de tu token:

- **Nombre del Token**: El nombre completo (p. ej., `Robin Gold`).
- **Símbolo (Ticker)**: De 3 a 6 letras mayúsculas (p. ej., `GOLD`).
- **Descripción**: Una breve introducción que describa tu token, su propósito o la visión de la comunidad.
- **Logo del Token**: Sube un archivo de imagen (PNG, JPG, SVG o WebP). Goton comprime automáticamente tu imagen y la fija de forma segura en IPFS.

### 4. Añade Enlaces de Comunidad (Opcional)

Puedes incluir enlaces oficiales para que los traders verifiquen y se unan a tu proyecto:

- URL del sitio web
- Handle oficial de X (Twitter)
- Enlace de Telegram de la comunidad

### 5. Compra Inicial (Opcional)

Si deseas comprar una asignación inicial como creador al precio de lanzamiento, ingresa la cantidad (ETH en Robinhood Chain, USDC en Arc). Una compra inicial es también lo que lista un lanzamiento en [Memestock](/es/protocol/social#memestock), junto con una descripción escrita.

### 6. Confirma y Despliega

Haz clic en **Launch Token** y confirma la transacción en tu billetera:

- **Tarifa de Lanzamiento**: Fija en `0.0005 ETH` en Robinhood Chain, o `0 USDC` en Arc Network (lanzamiento gratis con un mínimo de 4.50 USDC de pre-compra).
- ¡Una vez que la transacción se confirma, tu token está activo, verificable y operable de inmediato!

---

## ¿Qué Pasa con el Suministro del Token?

Cada token creado en Goton tiene un suministro estrictamente fijo:

- **Suministro Total**: Exactamente **1.000.000.000 tokens** (1 mil millones).
- **Decimales**: 18.
- **Sin Minteo**: No existe función para mintear tokens adicionales tras el lanzamiento.
- **Sin Pausa**: El token no puede ser congelado ni incluido en listas negras.

---

## Graduación

- **Robinhood Chain**: un token opera en su bonding curve hasta que la curva recauda **4.2 ETH**. La curva se cierra entonces, y su ETH y tokens restantes pasan a un pool Uniswap v4 cuya liquidez queda bloqueada para siempre. La graduación es permissionless: el keeper de Goton la activa en unos 30 segundos, y si alguien opera primero, su transacción la activa.
- **Arc Network**: no hay curva. Un token opera en su pool Uniswap v4 bloqueado desde el primer bloque.

Tras la graduación, el token sigue operando en la misma página; la app enruta las operaciones al pool.
