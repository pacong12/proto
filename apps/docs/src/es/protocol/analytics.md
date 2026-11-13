# Analíticas del Protocolo

La página **Analytics** ofrece una vista en vivo, de toda la red, de la actividad en Goton — cuánto se opera, cuántos tokens se lanzan y las tarifas que genera el protocolo — para la red en la que estés actualmente.

---

## El Gráfico Principal

Un único gráfico interactivo traza una métrica durante las **últimas 24 horas**, en segmentos. Cambia la métrica:

| Métrica      | Qué traza                                             |
| :----------- | :---------------------------------------------------- |
| **Volume**   | Volumen de trading a lo largo del tiempo              |
| **Launches** | Tokens lanzados a lo largo del tiempo                 |
| **Fees**     | Tarifas del protocolo generadas a lo largo del tiempo |

Alterna entre una vista de **área suave** y de **barras**. Todo está acotado a la **red activa** (Robinhood o Arc) — cambia de red desde el encabezado para ver las cifras de la otra cadena.

---

## Estadísticas Destacadas

Bajo el gráfico, las tarjetas de resumen muestran los totales de la red, incluyendo:

- **Volumen total de trading** — el volumen general en la red.
- **Total de tokens lanzados** — cuántos tokens se han creado.
- **Estimación de impuestos / tarifas** — una estimación de las tarifas generadas.
- **Buyback** — actividad de recompra del protocolo, cuando la hay.

Una lista de **tokens destacados** ordena los tokens por market cap, para que saltes directamente de la vista macro a la página de trade de un token concreto.

---

## Notas

- Las cifras se construyen a partir de **datos on-chain** y se actualizan a medida que se procesan nuevos bloques. ¿Quieres las mismas cifras para tu propia herramienta? Están en la [API Pública](/integration/api).
- Las analíticas son **por red**: la página siempre refleja la cadena mostrada en el encabezado, y lo indica en su nota de alcance.
- Las cifras se derivan del indexador y se actualizan a medida que se procesan nuevos bloques; la ventana de 24 horas es una vista móvil, no un día de calendario.
