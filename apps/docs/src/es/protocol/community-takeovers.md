# Community Takeovers (CTO)

¿Qué pasa si el desarrollador de un token quiere apartarse de un proyecto?

En Goton, un creador puede ceder su flujo de tarifas a la comunidad que lleva el proyecto adelante. Esta es siempre la decisión propia del creador. Nadie más, incluido el protocolo, puede mover las tarifas de un creador.

---

## ¿Qué es un Community Takeover?

Un Community Takeover ocurre cuando los miembros de la comunidad adoptan un token, asumen el marketing, actualizan los enlaces sociales y mantienen el crecimiento de la comunidad.

Goton lo permite mediante una redirección en el divisor de tarifas del token:

1. **Proponer**: El creador propone una billetera comunitaria, multisig o dirección DAO desde la página de **Perfil** (pestaña **Created**, **Manage CTO**).
2. **Esperar 48 horas**: La propuesta no puede tener efecto durante este timelock, para que todos la vean venir. El creador puede cancelarla hasta que se acepte. Una nueva propuesta reemplaza a la anterior y reinicia la espera.
3. **Aceptar**: Tras el timelock, el creador o el destinatario propuesto acepta. A partir de entonces, la porción del creador de las tarifas va al nuevo destinatario.
4. **Bloquear (opcional)**: El creador puede bloquear el destinatario actual de forma permanente. Esto no se puede deshacer, y descarta cualquier propuesta pendiente, así que acepta el nuevo destinatario antes de bloquear.

Hasta que el destinatario esté bloqueado, el creador puede iniciar una nueva redirección en cualquier momento, nuevamente con el timelock de 48 horas.

La cantidad redirigida depende del token. El creador elige cómo se divide la parte del creador, así que la redirección cubre solo la parte asignada al **Creador**. Las porciones de holders, buyback y liquidez mantienen sus destinos. Consulta [Tarifas y Recompensas del Creador](./fees-and-burns.md).

---

## Cómo Pedir un Takeover

1. **Organiza un destinatario**: Configura un multisig o DAO controlado por la comunidad, en lugar de la billetera personal de un miembro.
2. **Pídeselo al creador**: Contacta al creador públicamente y comparte la dirección del destinatario, para que todos puedan verificar la solicitud.
3. **Vigila la propuesta**: Una vez que el creador proponga la dirección, verifica que sea exactamente la que acordaron.
4. **Acepta tras 48 horas**: El destinatario puede aceptar sin esperar al creador.
5. **Pide el bloqueo y verifícalo**: Sin el bloqueo, el creador aún puede redirigir las tarifas más adelante.

Para verificar on-chain, abre el divisor de tarifas del token en el explorador de bloques y lee estos valores:

- `creatorRecipient()`: la dirección que recibe las tarifas ahora.
- `creatorRecipientLocked()`: `true` significa que esta dirección nunca puede cambiar.
- `pendingCreatorRecipient()` y `pendingCreatorRecipientValidAfter()`: cualquier propuesta esperando su timelock.

La página de trading del token también muestra una insignia **Community** cuando las tarifas van a alguien distinto del creador, y su tooltip indica cuándo el destinatario está bloqueado.

Algunos límites a tener en cuenta:

- **Sin creador, sin redirección**: Si un creador ha desaparecido y nunca propuso una redirección, el flujo de tarifas se queda con él. Una comunidad aún puede adoptar el token socialmente, pero ni ella ni Goton pueden reclamar esas tarifas.
- **Los divisores antiguos no tienen bloqueo**: Los divisores de tarifas desplegados antes de que existiera el bloqueo pueden redirigir pero no bloquearse, así que el creador siempre puede redirigir de nuevo. La página de Perfil muestra cuándo el bloqueo no está disponible.
- **Robinhood Chain**: Un token obtiene su divisor de tarifas en la graduación, así que una redirección solo es posible después de eso.

---

## Garantías de Seguridad y Protección

- **La Liquidez es Intocable**: La liquidez permanece bloqueada de forma permanente, en el liquidity locker de Robinhood Chain y en la fábrica de lanzamiento para los pools Uniswap v4 de Arc. Un Community Takeover no puede retirar, migrar ni drenar la liquidez del pool.
- **El Contrato del Token es Inmutable**: Las reglas del token, el suministro total (1 mil millones) y los parámetros de transferencia no pueden ser modificados ni reconfigurados por nadie.
- **La Parte del Protocolo es Separada**: Una redirección cambia solo quién recibe la porción del creador. No puede tocar la parte del protocolo ni las otras porciones del reparto.
- **Transparencia No Custodial**: Todas las reclamaciones de tarifas y redirecciones se registran on-chain para verificación pública.
