# Criterios de aceptación — 4. Ahorro: tarjeta de progreso del mes (paquete 4.3.2)

Estado: Aprobado

Cubre RF-22 (ver el monto disponible descontando de los ingresos los egresos y la meta) en el frontend: la **tarjeta de progreso** que va arriba, en la pantalla `/meta-de-ahorro`, antes del formulario de la meta (4.1.3, ya mezclado). El criterio de la EDT es: "El componente refleja el porcentaje de avance calculado por el backend." El backend (4.3.1) calcula todo en `GET /ahorro/progreso` y no redondea; aquí solo se verifica qué ve el usuario, qué se pide y cómo se explican los errores (RNF-11: la tarjeta no suma, no resta, no divide ni convierte porcentajes en pesos; solo redondea al peso o al entero al mostrar).

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- El ahorro acumulado (RF-23, `GET /ahorro/acumulado`): el contrato dice que suma el `ahorroReal` guardado en cada meta y el formulario de la meta no lo envía, así que hoy el acumulado siempre sería 0. Se resuelve con el backend antes de construirlo.
- El recuadro "Referencia: Tu ahorro promedio de los últimos 3 meses fue de…": lo cubren las recomendaciones (paquetes 4.2).
- El seguimiento en el dashboard: es otro paquete. Esta tarjeta vive solo en la pantalla de la meta.
- Escritorio (1280 px) y el selector de mes: la tarjeta trabaja solo con el mes actual, igual que el formulario.
- Los ingresos, los egresos y el monto en pesos de la meta: la tarjeta no los muestra (el frame de Figma leído no los tiene). El backend los envía, pero no se usan.
- Colores, tamaños, tipografía y aspecto de la barra, en modo claro y oscuro: **revisión visual contra Figma**, no se prueba con Jest.
- No hay criterio de doble toque: la tarjeta no guarda ni elimina nada. Solo tiene un botón "Reintentar", que al tocarlo deja de verse (pasa a "cargando").

**Fuentes:** Especificación de Requisitos (RF-22), CLAUDE.md (cálculos en el backend, RNF-11; carga y arranque en frío de Render, RNF-02; lenguaje sencillo, RNF-04; accesibilidad, RNF-06), Figma sección 09 · Ahorro e ingresos recurrentes, frame móvil "Meta de ahorro" (360 px): tarjeta de progreso con el mes ("Septiembre 2026"), el monto ahorrado, "83%", una barra de avance y el texto "Te faltan $ 250.000 para tu meta" (lo demás del diseño no se conoce y no se afirma aquí), contrato `coordinacion/contratos/ahorro-progreso.md` (estado "propuesto": falta la conformidad del frontend), criterios del backend `CA-RF22-01..25` (`aequo-backend/criterios/04-ahorro.md`) y los criterios del paquete anterior (`criterios/04-ahorro-meta.md`, que dejó la tarjeta para este paquete).

**Contrato del backend que importa aquí** (`GET /ahorro/progreso`, con sesión):
- Query: `mes=YYYY-MM`. Respuesta `200`:
  `{ periodo, ingresoPropio, egresos, ahorroDelMes, meta: { id, tipoMeta, valorObjetivo, montoMeta } | null, disponible, porcentajeAvance: number | null }`.
- No redondea: llegan decimales (por ejemplo, `porcentajeAvance` 166,6667). No tiene tope: `porcentajeAvance` puede pasar de 100 o ser negativo.
- `ahorroDelMes` = ingresos propios − egresos del mes; puede ser negativo. `disponible` = `ahorroDelMes` − `montoMeta` (la tarjeta **no resta nada**: usa `disponible` tal cual). `disponible` negativo = todavía falta; cero o positivo = la meta se cumplió.
- `meta` es `null` si el mes no tiene meta; entonces `porcentajeAvance` es `null`. Con meta, `porcentajeAvance` es `null` solo si `montoMeta` es 0 (meta de porcentaje en un mes sin ingresos propios: CA-RF22-07 y 10).
- `400` (parámetros inválidos) y `401` (sin sesión); el `401` lo resuelve el cliente HTTP compartido (cierra la sesión y la app vuelve al login).

**Interfaz pública** (aprobada con estos criterios):
- Pantalla: la misma `app/meta-de-ahorro.tsx` (ruta `/meta-de-ahorro`); la tarjeta se ve arriba del formulario. Las pruebas pasan por la pantalla; el nombre interno del componente lo elige el implementador.
- Adaptador nuevo en `lib/api/ahorro.ts` (sobre `requestAutenticado`, como las demás funciones del archivo):
  - tipo `ProgresoAhorro` (la forma del contrato; `meta` y `porcentajeAvance` pueden ser `null`);
  - `obtenerProgresoAhorro(mes: string): Promise<ProgresoAhorro>`: `GET /ahorro/progreso?mes=<mes>`.
- Se reutilizan `mesActual` y `nombreDelMes` (`lib/fechas.ts`), `formatearPesos` (`lib/dinero.ts`) y el mismo patrón de carga, error y reintento de las tarjetas de Reportes y de `useMetaDelMes`.

**Sobre los IDs:** los `CA-RF22-01..25` ya los usa el backend para su lado (otro repositorio). Para no confundirlos, estos llevan la letra F (`CA-RF22-F01`…), como hizo `04-ahorro-meta.md` con `CA-RF21-F`. Las notas "Decisión" recogen textos o comportamientos que el Figma, el RF y el contrato no definen y que el desarrollador debe aprobar (los textos propuestos quedan aprobados tal como están escritos).

**Convención de las pruebas:** igual que el paquete anterior: hoy es el 17 de septiembre de 2026 (reloj simulado), así que el mes actual es `2026-09`. El backend se simula en el borde del adaptador (`jest.mock('@/lib/api/ahorro')`) en las pruebas de la pantalla, y `fetch`/`requestAutenticado` en las del adaptador. Cifras de ejemplo que usan los criterios (no las calcula el frontend: las "responde" el backend simulado):

| Caso | `ahorroDelMes` | `disponible` | `porcentajeAvance` | `meta` |
|---|---|---|---|---|
| Faltan $ 250.000 (el del Figma) | 1250000 | -250000 | 83,3333 | monto fijo 1500000 |
| Cumplida exacta | 300000 | 0 | 100 | monto fijo 300000 |
| Excedida | 300000 | 100000 | 150 | monto fijo 200000 |
| Ahorro negativo | -250000 | -450000 | -125 | porcentaje 20 |
| Mes sin movimientos, monto fijo | 0 | -300000 | 0 | monto fijo 300000 |
| Mes sin movimientos, porcentaje | 0 | 0 | `null` | porcentaje 20, `montoMeta` 0 |
| Sin meta | 300000 | 300000 | `null` | `null` |

> Decisión (formato del dinero, para aprobar): la tarjeta escribe los pesos como en el Figma de esta pantalla ("$ 250.000", con espacio, igual que el campo "$ 1.500.000" del formulario de abajo), redondeados al peso con `formatearPesos`; los negativos llevan el signo delante ("-$ 250.000"). Ojo: Reportes usa otro formato, sin espacio ("$3.400.000", función `pesos` de las gráficas). Se prefiere el del Figma porque es el único dato directo de esta pantalla. Si se prefiere `pesos`, solo cambian los textos de las pruebas.

---

## Consulta del progreso

### CA-RF22-F01 — Al entrar se pide el progreso del mes actual, una sola vez, sin esperar a la meta

- **Dado** una sesión vigente y que hoy es el 17 de septiembre de 2026
- **Cuando** el usuario abre "Meta de ahorro"
- **Entonces** se llama a `obtenerProgresoAhorro('2026-09')` una sola vez (`GET /ahorro/progreso?mes=2026-09`) y también a `obtenerMetaDelMes('2026-09')` una sola vez; las dos consultas salen a la vez, sin que una espere a la otra; no se piden otros meses.

> Decisión (del arquitecto, para aprobar): el frontend manda siempre el mes explícito, el mismo mes del dispositivo que usa el formulario, y no depende del mes que el backend elegiría por su cuenta (según la zona horaria): así la tarjeta y el formulario siempre hablan del mismo mes. No se envía `X-Zona-Horaria`.

### CA-RF22-F02 — La tarjeta va arriba del formulario y muestra el mes

- **Dado** la pantalla de la meta con el progreso y la meta ya cargados
- **Cuando** el usuario la lee de arriba abajo
- **Entonces** ve el título "Meta de ahorro", luego la tarjeta con el mes "Septiembre 2026" y, más abajo, el formulario ("Meta mensual", "Guardar meta").

> Decisión: el mes se escribe como en el Figma ("Septiembre 2026", con mayúscula y sin "de"); la nota del formulario sigue diciendo "septiembre de 2026" (CA-RF21-F12).

---

## Con meta: lo que ve el usuario

Cuando la respuesta trae `meta` y `porcentajeAvance` con número.

### CA-RF22-F03 — Mes, ahorro del mes, porcentaje, barra y lo que falta

- **Dado** que el backend responde `ahorroDelMes` 1250000, `disponible` -250000 y `porcentajeAvance` 83,3333 con una meta de monto fijo
- **Cuando** termina de cargar
- **Entonces** la tarjeta muestra "Septiembre 2026", el texto "Ahorro de este mes" con "$ 1.250.000", el porcentaje "83%", la barra de avance (CA-RF22-F10) y el texto "Te faltan $ 250.000 para tu meta".
- **Y** no ve el aviso de meta cumplida ni avisos de error.

> Decisión: el Figma deja ver el monto ahorrado pero no su rótulo; se propone "Ahorro de este mes" (RNF-04). Si hay que usar otro, es un cambio de texto.

### CA-RF22-F04 — Se redondea solo al mostrar

- **Dado** que el backend responde con decimales (sin redondear)
- **Cuando** la tarjeta los muestra
- **Entonces** el porcentaje se redondea al entero ("83,5" → "84%"; "723,6138" → "724%"), el ahorro del mes al peso (`1134897,87` → "$ 1.134.898") y lo que falta al peso (`disponible` -249999,6 → "Te faltan $ 250.000 para tu meta"); nunca se ven decimales.

### CA-RF22-F05 — Meta cumplida exacta

- **Dado** que el backend responde `disponible` 0 y `porcentajeAvance` 100
- **Cuando** termina de cargar
- **Entonces** ve "100%", la barra llena, "Ahorro de este mes" con "$ 300.000" y el mensaje "¡Cumpliste tu meta de este mes!"; no ve "Te faltan…" ni el texto de lo que sobró.

> Decisión: la meta se da por cumplida cuando `disponible` es cero o positivo, o sea, cuando ya no falta nada (la tarjeta no calcula nada: lee `disponible`). Texto propuesto (RNF-04).

### CA-RF22-F06 — Meta excedida: el texto dice el porcentaje real y la barra se queda llena

- **Dado** que el backend responde `ahorroDelMes` 300000, `disponible` 100000 y `porcentajeAvance` 150
- **Cuando** termina de cargar
- **Entonces** ve "150%" (el valor real, sin tope), la barra llena, "¡Cumpliste tu meta de este mes!" y "Ahorraste $ 100.000 más de lo que querías."; no ve "Te faltan…".

> Decisión: el backend no pone tope; el texto del porcentaje es el real (por ejemplo "167%" con 166,6667), y solo la longitud de la barra se limita visualmente a 0–100 %. "Ahorraste $ X más de lo que querías." es el texto propuesto para lo que sobró (RNF-04); solo aparece cuando `disponible` redondeado al peso es 1 o más.

### CA-RF22-F07 — Ahorro negativo: porcentaje con signo, barra vacía y lo que falta

- **Dado** que el backend responde `ahorroDelMes` -250000, `disponible` -450000 y `porcentajeAvance` -125
- **Cuando** termina de cargar
- **Entonces** ve "-$ 250.000" como ahorro del mes, "-125%" (el valor real), la barra vacía y "Te faltan $ 450.000 para tu meta" (el valor absoluto de `disponible`, sin restar nada); no ve el aviso de meta cumplida.

### CA-RF22-F08 — Mes con meta de monto fijo y sin ahorro todavía

- **Dado** una meta de monto fijo de 300000 y un mes sin movimientos: el backend responde `ahorroDelMes` 0, `disponible` -300000 y `porcentajeAvance` 0
- **Cuando** termina de cargar
- **Entonces** ve "$ 0" como ahorro del mes, "0%", la barra vacía y "Te faltan $ 300.000 para tu meta", sin avisos de error.

### CA-RF22-F09 — Los redondeos no dejan textos raros

- **Dado** que el backend responde un faltante menor a medio peso (`disponible` -0,3, `porcentajeAvance` 99,99), un sobrante menor a medio peso (`disponible` 0,3) o un ahorro del mes de -0,3
- **Cuando** la tarjeta los muestra
- **Entonces** nunca ve "Te faltan $ 0 para tu meta", ni "-0%", ni "-$ 0", ni "Ahorraste $ 0 más de lo que querías.": un faltante que se redondea a cero se trata como meta cumplida ("¡Cumpliste tu meta de este mes!"), un sobrante que se redondea a cero no agrega la línea de lo que sobró, y el ahorro y el porcentaje que quedan en cero se escriben "$ 0" y "0%", sin signo.

> Decisión: el criterio es lo que el usuario ve, al peso: si se muestra "$ 0" de faltante, la meta está cumplida. Es posible ver "100%" junto a "Te faltan $ 1…" cuando el porcentaje se redondea hacia arriba pero falta más de medio peso (por ejemplo 99,6 % de una meta grande): es coherente con redondear cada cifra por separado.

### CA-RF22-F10 — La barra refleja el porcentaje, limitado de 0 a 100

- **Dado** la tarjeta con meta
- **Cuando** el usuario (o un lector de pantalla) mira la barra
- **Entonces** la barra se anuncia como barra de progreso con el nombre "Avance de tu meta de ahorro" y un valor de 0 a 100 que es el porcentaje redondeado y **limitado a ese rango**: 83,3333 → 83; 150 → 100; 166,6667 → 100; -125 → 0; 0 → 0; 100 → 100.
- **Y** el texto del porcentaje (CA-RF22-F03, F06 y F07) sigue mostrando el valor real, sin límite.

> Decisión: la longitud visual de la barra no se puede probar con Jest sin atarse al estilo; se prueba el valor accesible de la barra (`accessibilityValue`). La revisión visual contra Figma completa el criterio.

### CA-RF22-F11 — El frontend no calcula: muestra lo que responde el backend

- **Dado** que el backend responde cifras que no cuadran entre sí a propósito (por ejemplo `ahorroDelMes` 300000, `porcentajeAvance` 37 y `disponible` -111000, con `montoMeta` 600000)
- **Cuando** la tarjeta las muestra
- **Entonces** ve exactamente "37%" y "Te faltan $ 111.000 para tu meta" (no "50%" ni "$ 300.000", que saldrían de dividir o restar en el frontend), y no ve el monto de la meta, los ingresos ni los egresos.

---

## Sin meta y meta sin porcentaje

### CA-RF22-F12 — Sin meta del mes: mes, ahorro del mes e invitación a fijarla

- **Dado** que el backend responde `meta` `null` y `porcentajeAvance` `null`, con `ahorroDelMes` 300000
- **Cuando** termina de cargar
- **Entonces** la tarjeta muestra "Septiembre 2026", "Ahorro de este mes" con "$ 300.000" y el texto "Todavía no fijaste tu meta de este mes. Hazlo más abajo y verás tu avance aquí."
- **Y** no ve porcentaje, ni barra, ni "Te faltan…", ni aviso de meta cumplida, ni avisos de error, y la tarjeta no tiene botón propio (el formulario está justo debajo); con `ahorroDelMes` negativo ve el ahorro con signo ("-$ 100.000").

> Decisión: la invitación es solo un texto (sin botón ni enlace) porque el formulario ya está en la misma pantalla. Texto propuesto (RNF-04). El `disponible` sin meta es igual al ahorro del mes, así que no se muestra por separado.

### CA-RF22-F13 — Meta sin ingresos del mes (`porcentajeAvance` `null` con meta): no hay porcentaje ni barra

- **Dado** que el backend responde con una meta de porcentaje de 20 y `porcentajeAvance` `null` (el mes no tiene ingresos propios, entonces el monto de la meta es 0), con `ahorroDelMes` 0, o con `ahorroDelMes` -100000 y `disponible` -100000
- **Cuando** termina de cargar
- **Entonces** la tarjeta muestra "Septiembre 2026", "Ahorro de este mes" con su monto y el texto "Todavía no hay ingresos este mes para medir tu meta. Cuando registres uno, verás tu avance."
- **Y** no ve porcentaje, ni barra, ni "Te faltan…" (aunque `disponible` sea negativo), ni aviso de meta cumplida, ni "NaN", "Infinity" ni "null".

> Decisión: con `porcentajeAvance` `null` el frontend no divide ni inventa nada; la tarjeta decide por ese campo, no por `disponible`. Texto propuesto (RNF-04).

### CA-RF22-F14 — Mes sin movimientos: sin avisos de error

- **Dado** que el backend responde todo en cero (`ingresoPropio`, `egresos`, `ahorroDelMes`, `disponible` en 0)
- **Cuando** termina de cargar
- **Entonces** con `meta` `null` ve "$ 0" y la invitación de CA-RF22-F12; con una meta de monto fijo, lo de CA-RF22-F08; con una meta de porcentaje, lo de CA-RF22-F13. En ningún caso ve un aviso de error, ni un mensaje aparte de "sin movimientos", ni la tarjeta desaparece.

---

## Estados: cargando y errores

### CA-RF22-F15 — Mientras carga, solo el indicador

- **Dado** que el backend aún no responde al progreso (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** en el lugar de la tarjeta ve un indicador de carga ("Cargando tu progreso de ahorro"); no ve cifras, porcentaje, barra, ni la invitación a fijar la meta, ni avisos de error.

### CA-RF22-F16 — Las dos cargas son independientes

- **Dado** que el progreso y la meta del mes se piden a la vez
- **Cuando** una responde antes que la otra
- **Entonces** el indicador de cada una ("Cargando tu progreso de ahorro" y "Cargando tu meta de ahorro") desaparece cuando llega su propia respuesta: si el progreso llega primero, ve la tarjeta con datos y el formulario todavía cargando, y al revés.

### CA-RF22-F17 — Si el progreso falla, avisa y permite reintentar

- **Dado** que el backend responde `500` o `400` (u otro error que no sea de red ni `401`)
- **Cuando** termina la consulta
- **Entonces** en la tarjeta ve "No pudimos cargar tu progreso de ahorro. Inténtalo de nuevo en unos minutos." con un botón "Reintentar", y no ve cifras, porcentaje ni barra.

> Decisión: texto calcado de "No pudimos cargar tu meta de ahorro…" y de las tarjetas de Reportes (RNF-04). El botón se ve como "Reintentar" pero se anuncia como "Reintentar progreso de ahorro", para que no se confunda con el "Reintentar" del formulario si los dos fallan a la vez.

### CA-RF22-F18 — Sin conexión

- **Dado** que la consulta del progreso falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar", y el título "Meta de ahorro" y "Volver" siguen visibles.

### CA-RF22-F19 — "Reintentar" vuelve a pedir el mismo mes

- **Dado** la tarjeta con un aviso de error
- **Cuando** el usuario toca "Reintentar"
- **Entonces** vuelve a ver el indicador de carga y se llama de nuevo a `obtenerProgresoAhorro('2026-09')` (una sola vez más, y no a `obtenerMetaDelMes`); si ahora responde bien, ve la tarjeta; si falla otra vez, ve de nuevo el aviso.

### CA-RF22-F20 — Sesión vencida (401)

- **Dado** que el backend responde `401` al progreso
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión (lo resuelve el cliente HTTP compartido); la tarjeta no muestra un aviso de error propio.

### CA-RF22-F21 — Un error del progreso no bloquea el formulario

- **Dado** que el progreso falla (`500`) y la meta del mes cargó bien
- **Cuando** el usuario usa el formulario
- **Entonces** el formulario se ve completo (tipo, campo de monto, "Guardar meta", y "Quitar meta" si hay meta) y funciona: al escribir un monto y tocar "Guardar meta" se llama a `crearMeta` (o `actualizarMeta`) y ve "Meta guardada.".

### CA-RF22-F22 — Un error de la meta del mes no esconde la tarjeta

- **Dado** que la meta del mes falla (`500`) y el progreso cargó bien
- **Cuando** el usuario ve la pantalla
- **Entonces** ve la tarjeta con sus datos y, debajo, el aviso "No pudimos cargar tu meta de ahorro. Inténtalo de nuevo en unos minutos." con su "Reintentar" (CA-RF21-F06); tocar un "Reintentar" no vuelve a cargar lo otro.

---

## Refresco después de guardar, cambiar o quitar la meta

> Decisión (del arquitecto, para aprobar): después de que la meta del mes cambia en la pantalla (guardarla, cambiarla o quitarla), la tarjeta vuelve a pedir el progreso (`obtenerProgresoAhorro('2026-09')`) y se actualiza sin salir de la pantalla. **Solo se vuelve a pedir el progreso:** no se vuelve a pedir la meta (CA-RF21-F22 y F37 se mantienen). Los criterios de esta sección se escriben por lo que ve el usuario y cuántas veces se llama; no dependen de cómo lo hace la pantalla por dentro.

### CA-RF22-F23 — Al crear la meta, la tarjeta pasa de la invitación al avance

- **Dado** el formulario sin meta (la tarjeta muestra la invitación de CA-RF22-F12; el progreso se pidió una vez) y que, después de guardar, el backend responde un progreso con meta (`porcentajeAvance` 50, `disponible` -300000, `ahorroDelMes` 300000)
- **Cuando** el usuario escribe un monto y toca "Guardar meta" y el backend responde `201`
- **Entonces** `obtenerProgresoAhorro('2026-09')` se llama una vez más (2 llamadas en total) y la tarjeta pasa a mostrar "50%", "$ 300.000" y "Te faltan $ 300.000 para tu meta"; la invitación desaparece; el aviso "Meta guardada." sigue visible y `obtenerMetaDelMes` sigue con una sola llamada.

### CA-RF22-F24 — Al cambiar la meta, la tarjeta muestra el nuevo avance

- **Dado** el formulario con una meta (la tarjeta muestra "50%" y "Te faltan $ 300.000 para tu meta") y que, después de guardar, el backend responde un progreso nuevo (`porcentajeAvance` 150, `disponible` 100000)
- **Cuando** el usuario cambia el monto y toca "Guardar meta" y el backend responde `200`
- **Entonces** `obtenerProgresoAhorro('2026-09')` se llama una vez más y la tarjeta muestra "150%" y "¡Cumpliste tu meta de este mes!", sin "Te faltan…"; el formulario conserva "Meta guardada.".
- **Y** si el usuario toca "Guardar meta" sin haber cambiado nada, también se actualiza la tarjeta (una llamada más; lo guardado se repite sin daño, CA-RF21-F24).

### CA-RF22-F25 — Al quitar la meta, la tarjeta vuelve a la invitación

- **Dado** el formulario con una meta (la tarjeta muestra su avance) y que, después de quitarla, el backend responde un progreso sin meta (`meta` `null`)
- **Cuando** el usuario toca "Quitar meta" y confirma con "Quitar", y el backend responde `204`
- **Entonces** `obtenerProgresoAhorro('2026-09')` se llama una vez más y la tarjeta pasa a mostrar la invitación de CA-RF22-F12, sin porcentaje ni barra; ve "Meta quitada." y `obtenerMetaDelMes` sigue con una sola llamada.

### CA-RF22-F26 — También se actualiza cuando el formulario descubre que la meta del servidor es otra

- **Dado** el formulario sin meta y el backend responde `409` a `crearMeta` (CA-RF21-F29), o el formulario con una meta y el backend responde `404` a `actualizarMeta` (CA-RF21-F30), o responde `404` a `eliminarMeta` (CA-RF21-F40)
- **Cuando** el usuario ve el resultado
- **Entonces** además de lo que ya hace el formulario en cada caso, `obtenerProgresoAhorro('2026-09')` se llama una vez más y la tarjeta muestra lo que responda.

> Decisión: en estos tres casos la meta del servidor no es la que la tarjeta tenía a la vista, así que se actualiza aunque el usuario no haya "guardado" nada.

### CA-RF22-F27 — Si la meta no cambió, la tarjeta no se vuelve a pedir

- **Dado** la pantalla con el progreso ya cargado
- **Cuando** el usuario toca "Guardar meta" con un valor que no pasa la validación (CA-RF21-F17 a F19), o el guardado falla (sin conexión, `400`, `422` o `500`), o el usuario toca "Cancelar" en la confirmación de quitar, o quitar falla (`409` con ahorro, sin conexión, `500`), o el backend responde `401`
- **Entonces** `obtenerProgresoAhorro` no vuelve a llamarse (sigue en una sola llamada).

### CA-RF22-F28 — Mientras se actualiza, la tarjeta carga y el formulario no espera

- **Dado** que el usuario guardó la meta con éxito y el progreso nuevo aún no responde
- **Cuando** el usuario espera
- **Entonces** la tarjeta vuelve a mostrar el indicador de carga ("Cargando tu progreso de ahorro", sin las cifras viejas) y, a la vez, el formulario ya muestra "Meta guardada." y se puede seguir usando; cuando llega el progreso nuevo, la tarjeta lo muestra.
- **Y** un doble toque en "Guardar meta" produce una sola actualización de la tarjeta (el doble toque ya envía una sola solicitud, CA-RF21-F27 y F28).

> Decisión: igual que el "Reintentar" de las demás tarjetas, mientras actualiza la tarjeta muestra el indicador en vez de dejar las cifras viejas, para que nunca se vean números que ya no corresponden a la meta. La alternativa (mantener las cifras viejas hasta que lleguen las nuevas, sin parpadeo) es posible pero pide más lógica; si se prefiere, se cambia este criterio.

### CA-RF22-F29 — Si la actualización falla, la tarjeta avisa y el formulario queda intacto

- **Dado** que el usuario guardó la meta con éxito y el progreso nuevo falla (`500` o sin conexión)
- **Cuando** el usuario ve el resultado
- **Entonces** la tarjeta muestra su aviso con "Reintentar" (CA-RF22-F17 y F18); el formulario sigue con la meta guardada y "Meta guardada.", sin avisos de error; al tocar "Reintentar" de la tarjeta, vuelve a pedir el progreso y, si responde bien, la muestra actualizada.

### CA-RF22-F30 — Si dos actualizaciones se cruzan, queda la última

- **Dado** que el usuario guardó la meta (la actualización 1 todavía no responde) y enseguida la quita (actualización 2)
- **Cuando** la actualización 2 responde primero (sin meta) y la 1 responde después (con meta)
- **Entonces** la tarjeta muestra lo de la actualización 2 (la invitación, sin porcentaje) y la respuesta tardía de la 1 no la pisa.

---

## Accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)

### CA-RF22-F31 — Se puede usar con lector de pantalla

- **Dado** la tarjeta de progreso
- **Cuando** un lector de pantalla la recorre
- **Entonces** el indicador de carga se anuncia como "Cargando tu progreso de ahorro"; la barra, como barra de progreso "Avance de tu meta de ahorro" con su valor de 0 a 100 (CA-RF22-F10); el aviso de error, como alerta; y el botón, como "Reintentar progreso de ahorro". El mes, el ahorro, el porcentaje y los mensajes son texto legible y no se transmiten solo con el color de la barra.

> Decisión: no se agrega un rótulo separado a cada cifra (los textos "Ahorro de este mes", "83%" y "Te faltan…" ya se leen en ese orden). El contraste y el tamaño del texto se revisan contra Figma (RNF-06).

### CA-RF22-F32 — Todos los textos son cotidianos y sin datos crudos

- **Dado** cualquier estado de la tarjeta (con meta, cumplida, excedida, sin meta, sin porcentaje, cargando, con error)
- **Cuando** el usuario lee su texto
- **Entonces** no contiene términos técnicos ni contables ("disponible", "ingresoPropio", "egresos", "periodo", "porcentajeAvance", "montoMeta", "null", "undefined", "NaN", "Infinity", "400", "401", "500"): habla de "ahorro", "meta", "mes", "internet" y "servidor", y nunca muestra los mensajes del backend.

---

## Contrato del adaptador (`lib/api/ahorro.ts`)

### CA-RF22-F33 — `obtenerProgresoAhorro` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `obtenerProgresoAhorro('2026-09')`
- **Entonces** se hace `GET /ahorro/progreso?mes=2026-09` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key` (es una lectura), y sin otros parámetros en la URL.

### CA-RF22-F34 — Entrega la respuesta tal cual, sin redondear ni calcular

- **Dado** que el backend responde `200`
- **Cuando** la función termina
- **Entonces** entrega el cuerpo igual que llegó: con meta (`periodo`, `ingresoPropio`, `egresos`, `ahorroDelMes`, `meta` con `id`, `tipoMeta`, `valorObjetivo` y `montoMeta`, `disponible`, `porcentajeAvance`), con los decimales intactos (por ejemplo `porcentajeAvance` 723,6138 y `egresos` 119802,13), y sin meta (`meta` `null`, `porcentajeAvance` `null`) sin cambiar nada; no agrega, quita ni recalcula campos.

### CA-RF22-F35 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `500` llega como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

## Efecto en los criterios y las pruebas del paquete anterior (para aprobar)

Estos criterios cambian lo que el paquete 4.1.3 daba por cierto; las pruebas de `__tests__/meta-de-ahorro-pantalla.test.tsx` deberán ajustarse (solo con aprobación del desarrollador, y en modo pruebas):

- **CA-RF21-F12** dice, en su última cláusula, que la pantalla **no** ve la tarjeta de progreso ("83%", "Septiembre 2026", "Te faltan…"). Con este paquete la tarjeta sí aparece: esa cláusula queda sustituida por CA-RF22-F02 y F03. Siguen sin verse el recuadro "Referencia", "Ingresos recurrentes", la frase "El cambio aplica desde este mes en adelante…" y "próximamente".
- **El mock del adaptador** de esa prueba (`jest.mock('@/lib/api/ahorro', () => ({...}))`) no tiene `obtenerProgresoAhorro`: sin agregarlo, todas las pruebas de la pantalla fallarían por una función que no existe.
- **CA-RF21-F05 y F04** (solo indicador mientras carga la meta; una sola llamada a `obtenerMetaDelMes`) siguen valiendo, pero la pantalla tendrá un segundo indicador (el de la tarjeta, CA-RF22-F15): la prueba no debe asumir que hay uno solo.

---

## Resumen

- Criterios: 35 (CA-RF22-F01 a F35): consulta 2 (F01 a F02), con meta 9 (F03 a F11), sin meta o sin porcentaje 3 (F12 a F14), estados (cargando y errores) 8 (F15 a F22), refresco después de guardar, cambiar o quitar 8 (F23 a F30), accesibilidad y lenguaje 2 (F31 a F32), adaptador 3 (F33 a F35).
- Código nuevo que piden: `obtenerProgresoAhorro` y el tipo `ProgresoAhorro` en `lib/api/ahorro.ts`; la tarjeta de progreso y su carga de datos (con carga, error, reintento y actualización); `app/meta-de-ahorro.tsx` la muestra arriba del formulario y le avisa cuando la meta cambia (el formulario de 4.1.3 hoy no avisa nada hacia afuera). Se reutilizan `mesActual`, `nombreDelMes`, `formatearPesos`, `requestAutenticado`, `ApiError` y `NetworkError`.
- Decisiones por aprobar: formato del dinero "$ 250.000" (con espacio, como el Figma) frente a `pesos` de Reportes; mes explícito en la petición (F01); rótulo "Ahorro de este mes" (F03); textos de meta cumplida y de lo que sobró (F05, F06); redondeo y casos de "casi cero" (F04, F09); barra con valor accesible 0–100 y texto con el valor real (F06, F10); texto sin meta, sin botón extra (F12); comportamiento con `porcentajeAvance` `null` y meta (F13); sin aviso especial para mes sin movimientos (F14); botón "Reintentar progreso de ahorro" (F17); refresco solo del progreso y también en 409/404 (F23 a F26); la tarjeta carga de nuevo en vez de dejar cifras viejas (F28); la respuesta tardía no pisa a la última (F30); ajuste de la prueba y los criterios del paquete anterior.
