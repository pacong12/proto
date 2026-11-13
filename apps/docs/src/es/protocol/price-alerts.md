# Alertas de Precio y Market Cap

Configura una alerta en cualquier token y Goton te avisa cuando alcanza tu objetivo. Las alertas están ligadas a tu billetera y se verifican en el servidor, así que siguen vigilando aunque la pestaña esté cerrada y suenan la próxima vez que abres la app.

---

## Crear una Alerta

1. Abre la página de **trade** de un token.
2. Haz clic en la **campana de alerta** en el encabezado de trading para abrir el popover de alertas.
3. Elige:
   - **Qué vigilar** — **Market cap** o **Precio** (ambos en USD).
   - **Dirección** — **Por encima** o **Por debajo** de tu umbral.
   - **Umbral** — el valor en USD a cruzar.
4. Créala. La alerta necesita una billetera conectada, porque se almacena a nombre de tu billetera.

Puedes tener varias alertas en el mismo token — por ejemplo "precio por encima de $0.01" y "market cap por debajo de $50K" a la vez.

---

## Cómo Suenan las Alertas

- Goton verifica tus alertas abiertas **en el servidor**, continuamente, contra el precio y market cap más recientes de cada token — así que una alerta sigue vigilando incluso con tu pestaña cerrada.
- Una alerta suena cuando el valor cruza en su dirección: una alerta **por encima** en o sobre el umbral, una **por debajo** en o bajo él.
- Cuando abres la app, muestra una notificación por cada alerta recién activada, y el popover marca las activadas con un punto. Una alerta activada deja de vigilar — crea una nueva para volver a vigilar.

---

## Gestionar Alertas

- El popover lista tus alertas abiertas y activadas para el token.
- Elimina cualquier alerta de la lista en cualquier momento.
- Las alertas son por billetera: conecta la misma billetera para verlas de nuevo en otro dispositivo.

---

## Notas

- Los umbrales son valores en **USD**. Una alerta de market cap vigila el market cap USD (fully-diluted) del token; una de precio vigila su precio USD.
- Las alertas son solo una **notificación** — nunca realizan una operación. Para actuar automáticamente a un precio, usa las [órdenes Limit, Take-Profit y Stop-Loss](/es/protocol/advanced-orders).
