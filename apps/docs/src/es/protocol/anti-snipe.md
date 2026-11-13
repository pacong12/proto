# Protecciones Anti-Snipe y Lanzamiento Justo

Una de las mayores frustraciones en el trading de criptomonedas es perder oportunidades tempranas frente a bots sniper automatizados que acaparan la liquidez del pool en milisegundos.

Goton incorpora reglas de contrato inteligente integradas y codificadas de forma fija durante los primeros bloques de un lanzamiento, para asegurar que los miembros cotidianos de la comunidad tengan una oportunidad justa de participar.

---

## Cómo Funciona

Goton emplea una **tarifa sniper decreciente y dinámica** en su arquitectura de bonding curve:

- En el segundo exacto del lanzamiento ($t=0$), se aplica un impuesto automático del 99% a cualquier bot depredador que intente una ejecución instantánea.
- La tarifa decae rápidamente en los siguientes 3 segundos ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- En cuestión de segundos, el trading estándar sin impuestos se reanuda con normalidad para los traders humanos.

---

## Garantías de Transparencia y Seguridad

- **Sin Listas Blancas ni Guardianes**: Cualquiera con una billetera Web3 puede participar una vez que se abre la ventana de lanzamiento justo.
- **Sin Interruptores de Admin**: Los límites anti-snipe están matemáticamente codificados en el contrato y expiran sin intervención humana.
- **Venta Siempre Habilitada**: No hay bloqueos artificiales ni periodos de espera para retirar los tokens comprados por los usuarios.
