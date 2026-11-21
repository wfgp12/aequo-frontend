# Criterios de aceptación — 5. Tarjetas de crédito: detalle de la tarjeta con total del mes y proyección (paquete 5.3.3)

Estado: Aprobado

Cubre RF-30 (total estimado a pagar en el mes por tarjeta) y RF-31 (proyección de pagos de los meses siguientes y lo que queda por pagar) en el frontend. El criterio de la EDT es: "El usuario ve cuánto debe pagar este mes por tarjeta y cuánto le queda por pagar en los meses siguientes." El backend (5.3.1, ya mezclado) calcula todo en `GET /tarjetas/:tarjetaId/proyeccion` y no redondea; aquí solo se verifica qué ve el usuario, qué se pide y cómo se explican los errores (RNF-11: la pantalla no suma, no resta, no multiplica ni calcula porcentajes; solo redondea al peso al mostrar).

**Decisión ya tomada por el desarrollador y el backend: la pantalla se hace solo con lo que da el contrato.** Frente al Figma ("Detalle de tarjeta", sección 06, frame móvil de 360 px; solo con el texto leído):
- **No** hay "Cupo disponible" (el backend no guarda cupo).
- **No** hay "Próximo pago estimado $ 310.000 · 28 de octubre" ni "Vence 28 sep" en las filas (el backend no guarda día de pago): no hay fechas de vencimiento.
- **No** hay "Deuda total $ 1.200.000" (el backend no la entrega y el frontend no la calcula).
- **No** hay "Marcar como pagada" (es el paquete 5.3.2, RF-32).
- **No** hay la sección "CUOTAS PENDIENTES" con una fila por compra ("Mercado · cuota 2/6", "Tenis · cuota 1/3", "Gasolina · pago único"): el backend lo entregará como `detalle` en un paquete aparte (5.3.6 del backend); queda anotado como pendiente del Figma.
- **Sí** hay: el total a pagar del mes con su desglose (cuotas y cargos fijos), "lo que te queda por pagar" (`saldoPendiente`) y la lista de los meses siguientes (`proyeccion`) con su total, sus cuotas y sus cargos fijos por mes. Lo que el Figma sí dice y se conserva: el encabezado con "‹" y el nombre de la tarjeta, y un bloque de resumen con montos en pesos.

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- "Marcar como pagada" y los pagos de la tarjeta (5.3.2, RF-32).
- Las filas por compra de "Cuotas pendientes" (`detalle`, 5.3.6 del backend).
- Cupo disponible, fecha de vencimiento o de pago y "Deuda total": sin datos en la API.
- Registrar una compra o un avance desde el detalle: sigue entrando por "Registrar egreso" y por "Avance en efectivo" en "Mis tarjetas".
- La versión de escritorio (1280 px): el Figma no la tiene para tarjetas.
- Colores, tamaños, tipografía y el aspecto del selector de mes y de las filas, en modo claro y oscuro: **revisión visual contra Figma**, no se prueba con Jest.
- La comparación con "lo pagado" de meses anteriores (llega con 5.3.2).

**Fuentes:** Especificación de Requisitos (RF-30, RF-31), CLAUDE.md (cálculos en el backend, RNF-11; carga y arranque en frío de Render, RNF-02; lenguaje sencillo, RNF-04; accesibilidad, RNF-06; modo claro y oscuro), Figma sección 06 · Tarjetas de crédito, frame móvil "Detalle de tarjeta" (solo con el texto leído: encabezado "‹ Visa Bancolombia"; bloque "Resumen" con "Deuda total $ 1.200.000", "Cupo disponible $ 1.300.000" y "Próximo pago estimado $ 310.000 · 28 de octubre"; botón "Marcar como pagada"; sección "CUOTAS PENDIENTES"), contrato `coordinacion/contratos/proyeccion.md` (estado "propuesto": falta la conformidad del frontend; aprobar estos criterios la da), `coordinacion/contratos/tarjetas.md` (`GET /tarjetas/:id`), criterios del backend `CA-RF30-01..31` y `CA-RF31-01..16` (`aequo-backend/criterios/05-tarjetas.md`, paquete 5.3.1; solo para escenarios y mensajes de error) y los criterios del frontend ya aprobados (`05-tarjetas-pantallas.md`, `05-compra-con-tarjeta.md`, `04-ahorro-progreso.md`).

**Contrato del backend que importa aquí** (todas las rutas con sesión; el `401` lo resuelve el cliente HTTP compartido: cierra la sesión y la app vuelve al login):
- `GET /tarjetas/:tarjetaId/proyeccion?mes=YYYY-MM` → `200`:
  `{ tarjetaId, mes, cuotas, cargosFijos, total, saldoPendiente, proyeccion: [{ mes, cuotas, cargosFijos, total, saldoPendiente }] }`.
  - `cuotas` es la suma de las cuotas vigentes en `mes` (compras y avances); `cargosFijos`, la suma de los cargos fijos **activos**; `total` es `cuotas + cargosFijos` (el total estimado a pagar del mes, RF-30); `saldoPendiente`, la suma de las cuotas de los meses **posteriores** a `mes`, con intereses, sin cargos fijos y sin descontar pagos.
  - `proyeccion` son los meses siguientes, contiguos, hasta el último mes con cuotas (RF-31); los cargos fijos activos se repiten en cada uno, pero no alargan la lista: sin cuotas posteriores es `[]`. Sin tope ni paginación.
  - Los montos llegan **sin redondear** (por ejemplo `cuotas` 291270,05016469): el frontend redondea al peso al mostrar. Cualquier `mes` es válido (pasado, actual o futuro).
  - Una tarjeta sin compras ni cargos activos responde `200` con todo en cero y `proyeccion` `[]`.
  - `400` (`mes` con otro formato, parámetros de más, `tarjetaId` mal formado), `401`, `404` "Tarjeta no encontrada" (inexistente o de otro usuario; nunca `403`).
- `GET /tarjetas/:id` → `200` con la tarjeta (`{ id, nombre, tasaEA, cuotaUnicaSinInteres, creadaEn, actualizadaEn }`; `tasaEA` es una fracción de 0 a 1) o `404` "Tarjeta no encontrada". Ya existe en el backend (5.1.2) pero ninguna pantalla lo usaba hasta ahora.
- Las demás rutas de tarjetas (`PATCH`, `DELETE`, cargos fijos) son las de `05-tarjetas-pantallas.md` y no cambian.

**Interfaz pública** (queda aprobada con estos criterios):
- Pantalla nueva: ruta `/tarjetas/[id]`, protegida por sesión (`Stack.Protected` en `app/_layout.tsx`). Recibe `id` y, opcional, `nombre` por parámetros de la ruta, igual que la de cargos fijos. Se llega con `router.push({ pathname: '/tarjetas/[id]', params: { id, nombre } })`. Las pruebas aceptan que el archivo sea `app/tarjetas/[id].tsx` o `app/tarjetas/[id]/index.tsx` (en el layout se aceptan los nombres de pantalla `tarjetas/[id]` y `tarjetas/[id]/index`).
- Adaptador, en `lib/api/tarjetas.ts` (sobre `requestAutenticado`, como el resto del archivo):
  - tipos `MesProyectado` (`{ mes, cuotas, cargosFijos, total, saldoPendiente }`) y `ProyeccionTarjeta` (`{ tarjetaId, mes, cuotas, cargosFijos, total, saldoPendiente, proyeccion: MesProyectado[] }`);
  - `obtenerProyeccion(tarjetaId: string, mes: string): Promise<ProyeccionTarjeta>`: `GET /tarjetas/:tarjetaId/proyeccion?mes=<mes>`;
  - `obtenerTarjeta(id: string): Promise<Tarjeta>`: `GET /tarjetas/:id` (ver la decisión A3).
- "Mis tarjetas" vuelve a pedir su lista cada vez que la pantalla recupera el foco (`useFocusEffect` de `expo-router`); el detalle vuelve a pedir la proyección cada vez que recupera el foco (ver CA-RF30-F28 y F29).
- Se reutilizan `PantallaDeLista`/`EstadoDeLista` si le sirven al implementador (no se prueban por nombre), `HojaTarjeta` (la misma hoja de 5.1.3), `mesActual`, `mesEnLetras` y `restarMeses` (`lib/fechas.ts`), `formatearPesos` (`lib/dinero.ts`), `textoDeTasa` y `NOTA_DE_LA_CUOTA` (`lib/tarjetas.ts`), `useListaRemota` solo si sirve (el detalle no es una lista), `requestAutenticado`, `ApiError`, `NetworkError` y `ERROR_RED`.

**Sobre los IDs:** los `CA-RF30-nn` y `CA-RF31-nn` ya los usa el backend para su lado (otro repositorio). Para no confundirlos, estos llevan la letra F (`CA-RF30-F01`…), como hizo `05-tarjetas-pantallas.md`. Bajo `CA-RF30-F` va todo lo del **total del mes** (entrada, carga, selector de mes, resumen, acciones, errores, accesibilidad y el adaptador); bajo `CA-RF31-F`, la **proyección** (lo que queda por pagar y los meses siguientes).

**Convención de las pruebas:** hoy es el 19 de noviembre de 2026 (reloj simulado), así que el mes actual es `2026-11`. El backend se simula en el borde del adaptador (`jest.mock('@/lib/api/tarjetas')`) en las pruebas de las pantallas, y `fetch` en las del adaptador. `expo-router` se simula con `useRouter` (`back`, `push`), `useLocalSearchParams` (`id`, `nombre`) y `useFocusEffect` (ejecuta el efecto al montar la pantalla y permite volver a dispararlo para simular "volver a la pantalla"). Los ejemplos usan la tarjeta "Visa Bancolombia" (id `66a0b3c4d5e6f70012ab34cd`, tasa `0.2921`, `cuotaUnicaSinInteres` verdadera) y estas respuestas simuladas de `obtenerProyeccion` (las cifras son las del escenario base del backend, recortadas; **el frontend no verifica que cuadren**, solo muestra lo que llega):

| Caso | `mes` | `cuotas` | `cargosFijos` | `total` | `saldoPendiente` | `proyeccion` (mes → cuotas / cargos / total) |
|---|---|---|---|---|---|---|
| CON_CUOTAS | 2026-11 | 291270,05016469 | 55000 | 346270,05016469 | 1766528,890201 | 2026-12 → 209543,21823395 / 55000 / 264543,21823395; 2027-01 → 119802,13317188 / 55000 / 174802,13317188; 2027-02 → 119802,13317188 / 55000 / 174802,13317188 |
| ANTES_DEL_PRIMER_PAGO | 2026-11 | 0 | 0 | 0 | 1437625,598063 | 2026-12 → 119802,133172 / 0 / 119802,133172; 2027-01 → 119802,133172 / 0 / 119802,133172 |
| SOLO_CARGOS | 2026-11 | 0 | 55000 | 55000 | 0 | `[]` |
| VACIA | 2026-11 | 0 | 0 | 0 | 0 | `[]` |

Lo que se ve de CON_CUOTAS: total "$ 346.270", "Cuotas $ 291.270", "Cargos fijos $ 55.000", "$ 1.766.529" por pagar después, y las filas "diciembre 2026 · $ 264.543", "enero 2027 · $ 174.802" y "febrero 2027 · $ 174.802".

**Decisiones por aprobar, agrupadas por bloque** (cada "> Decisión" de abajo lleva su letra; se pueden aprobar por bloque):
- **A. Entrada y navegación** (A1 a A4): el detalle reemplaza al formulario como destino de la fila; "Editar tarjeta" y "Ver cargos fijos"; de dónde salen los datos para editar; qué pasa al volver y al eliminar.
- **B. Mes de referencia** (B1 a B3): selector sin tope, mes explícito, datos del mes anterior ocultos y respuestas viejas descartadas.
- **C. Qué se muestra y textos** (C1 a C5).
- **D. Estados** (D1 a D4).
- **E. Adaptador** (E1 a E2).
- **F. Accesibilidad** (F1).

---

# Total del mes (`CA-RF30-F`)

## Entrada y ruta

### CA-RF30-F01 — Tocar una fila de "Mis tarjetas" abre el detalle de esa tarjeta

- **Dado** la lista de "Mis tarjetas" con "Visa Bancolombia" y "Amex"
- **Cuando** el usuario toca la fila "Visa Bancolombia"
- **Entonces** la app navega con `router.push({ pathname: '/tarjetas/[id]', params: { id: '66a0b3c4d5e6f70012ab34cd', nombre: 'Visa Bancolombia' } })` una sola vez; no se abre la hoja "Editar tarjeta" y no se llama al backend en ese momento.
- **Y** "+ Agregar tarjeta" sigue abriendo la hoja "Nueva tarjeta" sobre la lista, como en CA-RF24-F12.

> Decisión (A1, del arquitecto): hasta 5.1.3, tocar la fila abría el formulario de editar (CA-RF24-F13, que decía "el detalle con deuda y cuotas lo reemplazará"). Ahora la fila abre el detalle; el formulario de editar se abre desde el botón "Editar tarjeta" del detalle (CA-RF30-F24). Sustituye CA-RF24-F13 (ver "Efecto en los criterios y las pruebas existentes").

### CA-RF30-F02 — Solo con sesión

- **Dado** que no hay sesión (o está cerrada)
- **Cuando** se arma la navegación de la app
- **Entonces** el detalle de la tarjeta no está disponible (la app lleva al login, como "Mis tarjetas" y los cargos fijos); con sesión activa, sí.

### CA-RF30-F03 — Título con el nombre, la tasa y "Volver"

- **Dado** el detalle abierto con el nombre "Visa Bancolombia"
- **Cuando** el usuario lo ve
- **Entonces** ve el título "Visa Bancolombia" y un botón "Volver" (el mismo "‹" de las demás pantallas) que regresa a la pantalla anterior.
- **Y** cuando termina de cargar la tarjeta (CA-RF30-F04), debajo del título ve su tasa con el mismo texto de la lista ("Tasa 29,21 % E.A.").
- **Y** si la pantalla se abre sin `nombre` (por ejemplo, al recargar la página en la web), el título es "Tarjeta" hasta que llega la tarjeta, y entonces pasa a ser su nombre; si el nombre que llega del backend es distinto del que venía en la ruta, se ve el del backend.

> Decisión (A2): el Figma muestra "‹ Visa Bancolombia". El nombre llega como parámetro para verse al instante (igual que en los cargos fijos) y se corrige con lo que responde el backend. La tasa bajo el título no está en el Figma; se propone porque es el único dato de la tarjeta que se puede cambiar desde aquí y así se ve el resultado de editarla (CA-RF30-F25).

## Carga

### CA-RF30-F04 — Al entrar se piden la tarjeta y los pagos del mes de hoy, una sola vez

- **Dado** una sesión vigente y que hoy es el 19 de noviembre de 2026
- **Cuando** el usuario abre el detalle de "Visa Bancolombia"
- **Entonces** se llama a `obtenerProyeccion('66a0b3c4d5e6f70012ab34cd', '2026-11')` una sola vez (`GET …/proyeccion?mes=2026-11`) y a `obtenerTarjeta('66a0b3c4d5e6f70012ab34cd')` una sola vez; las dos consultas salen a la vez, sin que una espere a la otra, y no se piden otras cosas (ni la lista de tarjetas, ni los cargos, ni otros meses).

> Decisión (A3, del arquitecto, para aprobar): el detalle necesita los datos de la tarjeta (nombre, tasa y si la compra a 1 cuota va sin intereses) para dar el título y para abrir la hoja "Editar tarjeta", y la proyección no los trae ni la ruta los lleva completos (solo `id` y `nombre`). Se propone `GET /tarjetas/:id`, que ya está en el contrato y en el backend. Alternativa: pedir `listarTarjetas()` y buscar la tarjeta por su id (una consulta más pesada y sin ruta propia para el 404).
>
> Decisión (B2): la pantalla manda **siempre** el `mes` explícito (`YYYY-MM`, el mes del dispositivo); no depende del mes que el backend elegiría según la zona horaria.

### CA-RF30-F05 — Mientras carga, solo el indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** ve el título, "Volver", el selector de mes ("noviembre 2026") y un indicador de carga ("Cargando tu tarjeta"); no ve montos, ni "Este mes pagas", ni "Próximos meses", ni el aviso de tarjeta sin pagos, ni avisos de error, ni los botones "Editar tarjeta" y "Ver cargos fijos".

> Decisión (D1): sin saber qué debe la tarjeta, mostrar "$ 0" o el aviso de "sin pagos" daría una imagen falsa de la cuenta. Los botones de la tarjeta aparecen cuando llegan sus datos (CA-RF30-F30).

## Selector de mes

### CA-RF30-F06 — El selector empieza en el mes de hoy

- **Dado** el detalle abierto el 19 de noviembre de 2026
- **Cuando** el usuario ve el selector
- **Entonces** ve "noviembre 2026" entre dos botones, "Mes anterior" y "Mes siguiente", disponibles incluso mientras carga.

> Decisión (B1): el mes se escribe en minúscula con su año ("noviembre 2026"), como en el paso de cuotas del registro (`mesEnLetras`). El Figma muestra el encabezado sin selector; se agrega porque RF-31 pide ver los meses siguientes y el backend acepta cualquier mes.

### CA-RF30-F07 — "Mes anterior" pide el mes de antes

- **Dado** el detalle ya cargado en noviembre 2026
- **Cuando** el usuario toca "Mes anterior"
- **Entonces** el selector dice "octubre 2026" y se llama a `obtenerProyeccion('66a0b3c4d5e6f70012ab34cd', '2026-10')` una sola vez más; no se vuelve a pedir la tarjeta.

### CA-RF30-F08 — "Mes siguiente" no tiene tope y cruza el año

- **Dado** el detalle en diciembre 2026 (tras tocar "Mes siguiente" desde noviembre)
- **Cuando** el usuario toca "Mes siguiente"
- **Entonces** el selector dice "enero 2027" y se pide `'2027-01'`; el botón "Mes siguiente" sigue disponible (no se deshabilita en ningún mes, a diferencia de Reportes), y lo mismo pasa con "Mes anterior" hacia atrás, también al cruzar de enero a diciembre del año anterior.

> Decisión (B1): sin tope hacia adelante ni hacia atrás, como acepta el backend (CA-RF30-23 del backend: un mes muy pasado o muy futuro es válido). En Reportes el mes siguiente se bloquea porque no hay datos del futuro; aquí el futuro es justo lo que se quiere ver.

### CA-RF30-F09 — Al cambiar de mes se ocultan los datos del mes anterior y se ve el indicador

- **Dado** el detalle con las cifras de CON_CUOTAS y que el backend aún no responde al mes siguiente
- **Cuando** el usuario toca "Mes siguiente"
- **Entonces** el selector ya dice "diciembre 2026", se ve el indicador "Cargando tu tarjeta" y no se ve ninguna cifra del mes anterior (ni el total, ni lo que queda por pagar, ni las filas); cuando llega la respuesta se ven las cifras del nuevo mes.

> Decisión (B3): mostrar las cifras viejas bajo el nombre del mes nuevo sería un dato equivocado; por eso se ocultan mientras llegan las nuevas.

### CA-RF30-F10 — Una respuesta vieja no pisa a la última

- **Dado** que el usuario toca "Mes siguiente" (diciembre 2026) y enseguida otra vez "Mes siguiente" (enero 2027), y que la respuesta de diciembre llega **después** de la de enero
- **Cuando** llegan las dos respuestas
- **Entonces** la pantalla muestra las cifras de enero 2027 y la respuesta tardía de diciembre no las cambia; el selector sigue diciendo "enero 2027".

## Lo que se ve: el total del mes

### CA-RF30-F11 — "Este mes pagas" con su desglose

- **Dado** que el backend responde CON_CUOTAS para el mes actual
- **Cuando** termina de cargar
- **Entonces** ve "Este mes pagas" con "$ 346.270" (el `total`), debajo las líneas "Cuotas $ 291.270" y "Cargos fijos $ 55.000" (tal como los entrega el backend) y la nota "Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar."; no ve avisos de error.

> Decisión (C1): textos propuestos (RNF-04); el Figma tiene "Resumen" con otros datos. Cada línea del desglose es un solo texto ("Cuotas $ 291.270"). La nota es la misma de la cuota estimada del registro (`NOTA_DE_LA_CUOTA`): el total es una estimación, igual que ella (RF-30).

### CA-RF30-F12 — En otro mes, el rótulo dice el mes

- **Dado** el detalle en un mes que no es el de hoy (por ejemplo, diciembre 2026)
- **Cuando** el usuario ve el total
- **Entonces** el rótulo dice "Pagas en diciembre 2026" y no "Este mes pagas"; en el mes de hoy sigue diciendo "Este mes pagas".

> Decisión (C2): "Este mes" solo es cierto para el mes de hoy; en los demás se nombra el mes. Con un mes pasado el rótulo sigue siendo "Pagas en octubre 2026" (sin cambiar el tiempo del verbo): no se agrega aviso ni texto distinto para el pasado.

### CA-RF30-F13 — Se redondea al peso solo al mostrar

- **Dado** que el backend responde con decimales (sin redondear)
- **Cuando** la pantalla los muestra
- **Entonces** cada monto se ve en pesos enteros con puntos de miles: `346270,05016469` → "$ 346.270"; `291270,05016469` → "$ 291.270"; `45900,5` → "$ 45.901"; `0,4` → "$ 0"; nunca se ven decimales ni "NaN".

### CA-RF30-F14 — El frontend no calcula: muestra lo que responde el backend

- **Dado** que el backend responde cifras que no cuadran entre sí a propósito (por ejemplo `cuotas` 100000, `cargosFijos` 20000, `total` 150000 y `saldoPendiente` 999999)
- **Cuando** la pantalla las muestra
- **Entonces** ve exactamente "$ 150.000" como lo que pagas este mes, "Cuotas $ 100.000", "Cargos fijos $ 20.000" y "$ 999.999" por pagar (no "$ 120.000", que saldría de sumar en el frontend).

## Casos con ceros

### CA-RF30-F15 — Mes sin pagos pero con cuotas más adelante

- **Dado** que el backend responde ANTES_DEL_PRIMER_PAGO (`total` 0, y `saldoPendiente` y `proyeccion` con cuotas por pagar)
- **Cuando** termina de cargar
- **Entonces** ve "Este mes pagas" con "$ 0", "Cuotas $ 0" y "Cargos fijos $ 0", y, debajo, lo que queda por pagar y los meses siguientes (CA-RF31-F01 y F03); no ve el aviso de "sin pagos" de CA-RF30-F17.

### CA-RF30-F16 — Tarjeta con solo cargos fijos

- **Dado** que el backend responde SOLO_CARGOS (`cuotas` 0, `cargosFijos` 55000, `total` 55000, `saldoPendiente` 0 y `proyeccion` `[]`)
- **Cuando** termina de cargar
- **Entonces** ve "Este mes pagas" con "$ 55.000", "Cuotas $ 0" y "Cargos fijos $ 55.000"; el bloque de lo que queda por pagar dice "$ 0" (CA-RF31-F01) y no ve "Próximos meses" (CA-RF31-F06).

### CA-RF30-F17 — Tarjeta sin compras ni cargos: un texto amigable, sin tablas vacías

- **Dado** que el backend responde VACIA (todo en cero y `proyeccion` `[]`)
- **Cuando** termina de cargar
- **Entonces** ve "No tienes pagos pendientes con esta tarjeta. Cuando registres compras a cuotas o cargos fijos, los verás aquí." y el selector de mes; no ve "Este mes pagas", ni "$ 0", ni "Cuotas", ni "Cargos fijos" como líneas, ni "Te queda por pagar", ni "Próximos meses", ni avisos de error.
- **Y** los botones "Editar tarjeta" y "Ver cargos fijos" siguen disponibles.

> Decisión (C3): texto propuesto (RNF-04), neutral a propósito: el mismo caso ocurre con una tarjeta nueva, con un mes lejano sin cuotas y con cargos inactivos, así que no afirma que la tarjeta "no tenga compras". La pantalla lo decide porque el backend respondió `total`, `saldoPendiente` y `proyeccion` vacíos; no calcula nada.

## Errores

### CA-RF30-F18 — Si una consulta falla, avisa y permite reintentar

- **Dado** que `obtenerProyeccion` (o `obtenerTarjeta`) responde `500` o `400` (u otro error que no sea de red, `401` ni `404`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar tu tarjeta. Inténtalo de nuevo en unos minutos." con un botón "Reintentar", y no ve montos, ni "Este mes pagas", ni "Próximos meses", ni el aviso de tarjeta sin pagos; el título, "Volver" y el selector de mes siguen visibles.
- **Y** si el que falló es `obtenerTarjeta`, tampoco ve "Editar tarjeta" ni "Ver cargos fijos" (CA-RF30-F30).
- **Y** el mensaje del backend nunca se muestra.

> Decisión (D2): un solo texto para todos los fallos que no son de red (el `400` de un mes mal formado no puede ocurrir porque la pantalla arma el mes; si ocurriera, se explica igual). Calcado de "No pudimos cargar tus tarjetas…" y de los demás (RNF-04).

### CA-RF30-F19 — Sin conexión

- **Dado** que la consulta falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar", y el título, "Volver" y el selector siguen visibles.

### CA-RF30-F20 — "Reintentar" vuelve a pedir lo que falló; un doble toque no repite

- **Dado** el detalle con un aviso de error
- **Cuando** el usuario toca "Reintentar" (una o dos veces seguidas)
- **Entonces** vuelve a ver el indicador de carga y se vuelve a pedir lo que falló (la proyección del mes que se estaba viendo, o la tarjeta, o las dos) una sola vez más, sin repetir lo que sí había cargado; si ahora responde bien, ve las cifras; si falla otra vez, ve de nuevo el aviso.

### CA-RF30-F21 — Con un error, cambiar de mes lo intenta de nuevo

- **Dado** el detalle con un aviso de error de la proyección
- **Cuando** el usuario toca "Mes anterior" o "Mes siguiente"
- **Entonces** el aviso desaparece, se ve el indicador y se pide el mes nuevo; si responde bien, ve sus cifras.

### CA-RF30-F22 — La tarjeta ya no existe (404)

- **Dado** que el backend responde `404` ("Tarjeta no encontrada") a `obtenerProyeccion` o a `obtenerTarjeta` (otro dispositivo la eliminó)
- **Cuando** termina la consulta
- **Entonces** ve "Esta tarjeta ya no existe." (sin "Reintentar", sin selector de mes, sin cifras y sin los botones "Editar tarjeta" y "Ver cargos fijos", sin importar cuál de las dos consultas respondió `404`) y "Volver" sigue disponible y regresa a "Mis tarjetas".
- **Y** el mensaje del backend ("Tarjeta no encontrada") no se muestra.

> Decisión (D3): el texto es el mismo de los cargos fijos (CA-RF29-F07). Reintentar no ayuda si la tarjeta no existe; "Volver" lleva a la lista, que se vuelve a pedir al recuperar el foco (CA-RF30-F29) y ya no la muestra.

### CA-RF30-F23 — Sesión vencida (401)

- **Dado** que el backend responde `401` a cualquiera de las dos consultas
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión (lo resuelve el cliente HTTP compartido); la pantalla no muestra un aviso de error propio.

## Acciones sobre la tarjeta

### CA-RF30-F24 — "Editar tarjeta" abre la misma hoja de 5.1.3 con los datos de la tarjeta

- **Dado** el detalle de "Visa Bancolombia" ya cargado
- **Cuando** el usuario toca "Editar tarjeta"
- **Entonces** se abre la hoja "Editar tarjeta" con "Alias" en "Visa Bancolombia", "Tasa de interés E.A." en "29,21" y el interruptor "Compras a 1 cuota sin intereses" encendido, con sus botones "Guardar tarjeta", "Cargos fijos" y "Eliminar tarjeta" y la nota de la tasa (todo igual que en CA-RF24-F14); no se llama al backend (los datos salen de `obtenerTarjeta`).
- **Y** "Volver" de la hoja la cierra sin guardar y deja el detalle como estaba (CA-RF24-F15).

> Decisión (A1): es la misma hoja de 5.1.3, sin cambios: lo que dicen CA-RF24-F14 a F47 sobre la hoja siguen valiendo; solo cambia cómo se llega a ella y lo que se ve detrás.

### CA-RF30-F25 — Al guardar los cambios, el detalle muestra el nombre y la tasa nuevos

- **Dado** la hoja "Editar tarjeta" abierta desde el detalle y que el backend responde `200` al guardar un nuevo alias "Visa Oro" y una nueva tasa "31,5"
- **Cuando** el usuario toca "Guardar tarjeta"
- **Entonces** la hoja se cierra, `obtenerTarjeta('66a0b3c4d5e6f70012ab34cd')` se llama una vez más y el detalle muestra el título "Visa Oro" y "Tasa 31,5 % E.A."; no queda el nombre anterior en pantalla.
- **Y** si el usuario vuelve a abrir "Editar tarjeta", la hoja muestra los datos guardados ("Visa Oro", "31,5").

> Decisión (A4): al guardar solo se vuelve a pedir la tarjeta: cambiar el alias o la tasa no cambia lo que se debe este mes (el backend aplica a cada compra la tasa con que se registró). Qué se pide aparte al volver de otras pantallas: CA-RF30-F28.

### CA-RF30-F26 — Eliminar la tarjeta desde el detalle vuelve a "Mis tarjetas"

- **Dado** el diálogo "¿Eliminar esta tarjeta?" abierto desde la hoja "Editar tarjeta" del detalle (CA-RF24-F40)
- **Cuando** el usuario toca "Eliminar" y el backend responde `204` (o `404`, porque ya estaba eliminada)
- **Entonces** el diálogo y la hoja se cierran, la app regresa a la pantalla anterior (`router.back()` una sola vez; es "Mis tarjetas") y el detalle **no** vuelve a pedir nada al backend ni muestra "Esta tarjeta ya no existe." ni ningún aviso de error antes de irse.
- **Y** con `409`, sin conexión u otro fallo, sigue lo de CA-RF24-F44 y F46: el aviso se ve dentro del diálogo, que sigue abierto, y la tarjeta sigue ahí.

> Decisión (A4): si el detalle se quedara abierto de una tarjeta que ya no existe, la recarga mostraría el aviso de CA-RF30-F22 en vez de llevar al usuario a donde esperaba. Que la lista ya no muestre la tarjeta: CA-RF30-F29.

### CA-RF30-F27 — "Ver cargos fijos" lleva a los cargos de la tarjeta

- **Dado** el detalle de "Visa Bancolombia" ya cargado
- **Cuando** el usuario toca "Ver cargos fijos"
- **Entonces** la app navega con `router.push({ pathname: '/tarjetas/[id]/cargos', params: { id: '66a0b3c4d5e6f70012ab34cd', nombre: 'Visa Bancolombia' } })` una sola vez, sin enviar nada al backend; el detalle no cambia.
- **Y** el botón "Cargos fijos" de la hoja de editar sigue llevando a lo mismo, como en CA-RF24-F48.

> Decisión (A1): el botón se llama "Ver cargos fijos" (y no "Cargos fijos") para que no se confunda con el de la hoja de editar cuando las dos están a la vez en pantalla. Es un acceso directo: así el usuario llega a los cargos, que son la parte fija del total del mes, sin pasar por la edición.

### CA-RF30-F28 — Al volver de otra pantalla, los pagos del mes se piden de nuevo

- **Dado** el detalle ya cargado en el mes de hoy y que el usuario fue a "Cargos fijos" (por ejemplo, desactivó uno) y vuelve (la pantalla recupera el foco)
- **Cuando** vuelve al detalle
- **Entonces** `obtenerProyeccion('66a0b3c4d5e6f70012ab34cd', '2026-11')` se llama otra vez (con el mismo mes que estaba viendo, no con el de hoy si había cambiado) y, cuando llega la respuesta, el detalle muestra las cifras nuevas (por ejemplo, un total menor porque el cargo se desactivó).
- **Y** si el usuario estaba en otro mes (por ejemplo, enero 2027), la consulta es de `'2027-01'` y el selector sigue diciendo "enero 2027".

> Decisión (A4): los cargos fijos activos cuentan en el total de cada mes (RF-29 y RF-30), así que cambiarlos desde "Cargos fijos" cambia lo que se ve aquí; la pantalla lo vuelve a pedir en vez de mostrar una cifra vieja. Mientras llega la respuesta nueva se siguen viendo las cifras que ya estaban (sin parpadeo); si la nueva falla, se ve el aviso de CA-RF30-F18. A diferencia de cambiar de mes (CA-RF30-F09), el mes es el mismo, así que las cifras viejas no son un dato equivocado.

### CA-RF30-F29 — Al volver a "Mis tarjetas", la lista se vuelve a pedir

- **Dado** "Mis tarjetas" ya cargada con "Visa Bancolombia" y "Amex", y que el usuario fue a un detalle y cambió algo (renombró, cambió la tasa o eliminó la tarjeta)
- **Cuando** vuelve a "Mis tarjetas" (la pantalla recupera el foco)
- **Entonces** `listarTarjetas()` se llama otra vez y la lista muestra lo que responda: la fila con el nombre y la tasa nuevos ("Visa Oro", "Tasa 31,5 % E.A.") sin duplicarse, o sin la tarjeta eliminada; si era la última, ve el aviso de vacío de CA-RF24-F09.
- **Y** al entrar por primera vez, `listarTarjetas()` se llama una sola vez (CA-RF24-F04 no cambia).

> Decisión (A4): la lista vive en la pantalla de abajo del detalle y no se desmonta al abrirlo; sin esto mostraría datos viejos. Se propone `useFocusEffect` de `expo-router` (ver "Interfaz pública"). Mientras se vuelve a pedir se siguen viendo las filas que ya estaban (el comportamiento de `recargar` de CA-RF24-F26).

### CA-RF30-F30 — Los botones de la tarjeta aparecen cuando llegan sus datos

- **Dado** el detalle abierto
- **Cuando** `obtenerTarjeta` todavía no responde, o falló, o la pantalla está en el estado "Esta tarjeta ya no existe." (CA-RF30-F22)
- **Entonces** no se ven "Editar tarjeta" ni "Ver cargos fijos" (la proyección puede haber llegado o no); cuando `obtenerTarjeta` responde bien, se ven los dos, también mientras se carga otro mes y aunque la proyección haya fallado.

> Decisión (A3): "Editar tarjeta" necesita los datos de la tarjeta, y "Ver cargos fijos" lleva el nombre real; mostrarlos antes daría botones que no pueden hacer su trabajo.

## Accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)

### CA-RF30-F31 — Se puede usar con lector de pantalla

- **Dado** el detalle con cifras
- **Cuando** un lector de pantalla lo recorre
- **Entonces** "Volver", "Mes anterior", "Mes siguiente", "Editar tarjeta", "Ver cargos fijos" y "Reintentar" se anuncian como botones; el mes del selector es texto legible ("noviembre 2026"); el indicador se anuncia como "Cargando tu tarjeta"; los avisos de error, como alerta; y el resumen se anuncia en una sola frase con su cifra: "Este mes pagas, $ 346.270" y "Te queda por pagar después de este mes, $ 1.766.529" (CA-RF31-F01).

> Decisión (F1): la cifra y su rótulo se leen juntos, y la información no depende solo del color (RNF-06). El contraste y el tamaño del texto se revisan contra Figma.

### CA-RF30-F32 — Todos los textos son cotidianos y sin datos crudos

- **Dado** cualquier estado del detalle (cargando, con cifras, sin pagos, con error, tarjeta que ya no existe)
- **Cuando** el usuario lee su texto
- **Entonces** no contiene términos técnicos ni contables ("saldoPendiente", "saldo pendiente", "proyección", "cargosFijos", "tarjetaId", "mes de referencia", "null", "undefined", "NaN", "Infinity", "400", "404", "500"): habla de "pagas", "te queda por pagar", "cuotas", "cargos fijos", "próximos meses", "internet" y "servidor", y nunca muestra los mensajes del backend.

### CA-RF30-F33 — No muestra lo que la API no da

- **Dado** el detalle con cualquier respuesta del backend
- **Cuando** el usuario lo ve
- **Entonces** no hay "Cupo disponible", "Deuda total", "Próximo pago estimado", "Vence", "CUOTAS PENDIENTES" ni "Marcar como pagada", ni fechas de día y mes ("28 de octubre").

> Decisión (ya tomada por el desarrollador y el backend): desviación del Figma; ver el encabezado de este documento.

## Contrato del adaptador (`lib/api/tarjetas.ts`, proyección y tarjeta)

### CA-RF30-F34 — `obtenerProyeccion` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `obtenerProyeccion('66a0b3c4d5e6f70012ab34cd', '2026-12')`
- **Entonces** se hace `GET /tarjetas/66a0b3c4d5e6f70012ab34cd/proyeccion?mes=2026-12` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key` (es una lectura), y sin otros parámetros en la URL; la función no agrega por su cuenta ninguna cabecera (no pone `X-Zona-Horaria` a mano: solo viaja la que ya envía el cliente compartido en todas las peticiones).
- **Y** con `'2027-01'` la URL lleva `?mes=2027-01` (el mes va tal cual, sin cambiarlo).

> Decisión (E1): la función no valida el formato del mes (lo hace el backend, que responde `400`); recibe el `YYYY-MM` que arma la pantalla.

### CA-RF30-F35 — Entrega la respuesta tal cual, sin redondear ni calcular

- **Dado** que el backend responde `200` con CON_CUOTAS
- **Cuando** la función termina
- **Entonces** entrega el cuerpo igual que llegó: `tarjetaId`, `mes`, `cuotas` 291270,05016469, `cargosFijos`, `total`, `saldoPendiente` y `proyeccion` con cada mes (`mes`, `cuotas`, `cargosFijos`, `total`, `saldoPendiente`) en el orden recibido, con los decimales intactos; con `proyeccion` `[]` entrega `[]`. No agrega, quita ni recalcula campos.

### CA-RF30-F36 — `obtenerTarjeta` pide una tarjeta y la entrega tal cual

- **Dado** una sesión vigente
- **Cuando** se llama a `obtenerTarjeta('66a0b3c4d5e6f70012ab34cd')`
- **Entonces** se hace `GET /tarjetas/66a0b3c4d5e6f70012ab34cd` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key`, y entrega la tarjeta que responde el `200` (`id`, `nombre`, `tasaEA` como fracción, `cuotaUnicaSinInteres`, `creadaEn`, `actualizadaEn`) sin cambiar nada.

> Decisión (E2): ver A3. Si se prefiere la alternativa de buscar en `listarTarjetas()`, este criterio y el de A3 se sustituyen y no cambia nada más.

### CA-RF30-F37 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error a `obtenerProyeccion` o a `obtenerTarjeta`
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `404` llega como `ApiError` con su código y el mensaje del backend ("Tarjeta no encontrada"), sin cerrar la sesión; un `500` llega como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

# Proyección: lo que queda por pagar y los meses siguientes (`CA-RF31-F`)

## Lo que queda por pagar

### CA-RF31-F01 — "Te queda por pagar después de este mes"

- **Dado** que el backend responde CON_CUOTAS para el mes actual (`saldoPendiente` 1766528,890201)
- **Cuando** termina de cargar
- **Entonces** ve "Te queda por pagar después de este mes" con "$ 1.766.529" y la nota "Suma las cuotas que faltan, con sus intereses. No incluye los cargos fijos."
- **Y** con `saldoPendiente` 0 (SOLO_CARGOS) ve el mismo bloque con "$ 0".
- **Y** con `saldoPendiente` 1437625,598063 en el mes antes del primer pago (ANTES_DEL_PRIMER_PAGO) ve "$ 1.437.626".

> Decisión (C4): `saldoPendiente` es, por contrato, la suma de las cuotas de los meses posteriores con intereses, sin cargos fijos ni pagos. El texto lo dice en palabras cotidianas y evita "saldo" y "proyección" (RNF-04); la nota existe para que no se espere que sume los cargos que sí aparecen en cada mes de abajo. No se muestran las cifras por mes del `saldoPendiente` de cada elemento de `proyeccion` (el backend las entrega, pero no se piden en este paquete).

### CA-RF31-F02 — En otro mes, el rótulo dice el mes

- **Dado** el detalle en un mes que no es el de hoy (por ejemplo, diciembre 2026)
- **Cuando** el usuario ve lo que queda por pagar
- **Entonces** el rótulo dice "Te queda por pagar después de diciembre 2026"; en el mes de hoy dice "…después de este mes".

## Los meses siguientes

### CA-RF31-F03 — "Próximos meses": una fila por mes, en el orden del backend

- **Dado** que el backend responde CON_CUOTAS (`proyeccion` con diciembre 2026, enero 2027 y febrero 2027)
- **Cuando** termina de cargar
- **Entonces** ve el encabezado "Próximos meses" y tres filas, en el mismo orden en que llegaron: "diciembre 2026" con "$ 264.543" y la línea "Cuotas $ 209.543 · Cargos fijos $ 55.000"; "enero 2027" con "$ 174.802" y "Cuotas $ 119.802 · Cargos fijos $ 55.000"; y "febrero 2027" con "$ 174.802" y "Cuotas $ 119.802 · Cargos fijos $ 55.000".
- **Y** no ve una fila del mes de referencia (noviembre 2026: ya está arriba, en "Este mes pagas"), ni un total de todos los meses, ni "Vence".

> Decisión (C5): textos propuestos (RNF-04). El mes se escribe como en el selector ("diciembre 2026"); la fila muestra el `total` del mes en grande y el desglose en una sola línea de texto. Las filas no se tocan (no son botones): el detalle de cada mes sería otro paquete. La pantalla no reordena ni agrupa.

### CA-RF31-F04 — Cada fila se redondea al peso y no calcula nada

- **Dado** una fila con `cuotas` 209543,21823395, `cargosFijos` 55000 y `total` 264543,21823395; y otra con cifras que no cuadran a propósito (`cuotas` 100000, `cargosFijos` 20000, `total` 150000)
- **Cuando** la pantalla las muestra
- **Entonces** ve "$ 264.543" y "Cuotas $ 209.543 · Cargos fijos $ 55.000" en la primera, y exactamente "$ 150.000" con "Cuotas $ 100.000 · Cargos fijos $ 20.000" en la segunda (no "$ 120.000"); nunca decimales ni "NaN".

### CA-RF31-F05 — Un mes sin cuotas entre medias no se omite

- **Dado** que el backend responde `proyeccion` con "2027-01" (`cuotas` 0, `cargosFijos` 55000, `total` 55000) seguido de "2027-02" (`cuotas` 83478,247168, `total` 138478,247168)
- **Cuando** termina de cargar
- **Entonces** ve las dos filas, en ese orden; la primera dice "enero 2027" con "$ 55.000" y "Cuotas $ 0 · Cargos fijos $ 55.000"; y, si un mes llega todo en cero, su fila dice "$ 0" con "Cuotas $ 0 · Cargos fijos $ 0" (la pantalla no la quita ni la une con otra).

### CA-RF31-F06 — Sin meses siguientes no hay sección ni tabla vacía

- **Dado** que el backend responde `proyeccion` `[]` (SOLO_CARGOS)
- **Cuando** termina de cargar
- **Entonces** no ve el encabezado "Próximos meses" ni filas ni un aviso de "sin meses"; lo demás (el total del mes y "Te queda por pagar… $ 0") sigue visible.

### CA-RF31-F07 — Una lista larga se ve completa, sin paginar

- **Dado** que el backend responde `proyeccion` con 60 meses (de "2026-12" a "2031-11")
- **Cuando** termina de cargar
- **Entonces** hay 60 filas, la primera "diciembre 2026" y la última "noviembre 2031" (el año cambia cada enero), sin "Ver más", sin paginación y sin recortar la lista.

> Decisión (D4): el backend no tiene tope ni pagina (D9 del backend: la lista es larga solo con un primer pago muy lejano o con un mes muy pasado). La pantalla se desplaza.

### CA-RF31-F08 — Al cambiar de mes se ven los meses siguientes de ese mes

- **Dado** el detalle en noviembre 2026 con CON_CUOTAS (filas de diciembre 2026 a febrero 2027) y que, para diciembre 2026, el backend responde `proyeccion` con enero 2027 y febrero 2027 (y `saldoPendiente` 599010,665859)
- **Cuando** el usuario toca "Mes siguiente"
- **Entonces** ve el rótulo "Pagas en diciembre 2026", lo que responde el backend para ese mes, "Te queda por pagar después de diciembre 2026" con "$ 599.011" y solo las filas de enero y febrero 2027; ya no ve la fila de "diciembre 2026" de la lista anterior.

### CA-RF31-F09 — Cada fila se anuncia con su mes y su total

- **Dado** la lista de "Próximos meses" con cifras
- **Cuando** un lector de pantalla la recorre
- **Entonces** cada fila se anuncia como una sola frase: "diciembre 2026, total $ 264.543", "enero 2027, total $ 174.802", y así cada una, en el orden de la lista; el encabezado "Próximos meses" es texto legible.

---

# Efecto en los criterios y las pruebas existentes (para aprobar)

Estos criterios cambian lo que 5.1.3 (`05-tarjetas-pantallas.md`) daba por cierto. Las pruebas afectadas están en `__tests__/tarjetas-*.test.tsx` y `__tests__/layout.test.tsx`; deberán ajustarse (solo con aprobación del desarrollador, en modo pruebas y antes del commit `test:` de este paquete). Ningún criterio de la hoja de editar cambia en lo que dice: cambia cómo se llega a ella.

**Criterios que se reemplazan o se corrigen:**
- **CA-RF24-F13** ("tocar una fila abre el formulario de editar con los datos de esa tarjeta"): se reemplaza por CA-RF30-F01 (la fila abre el detalle) y CA-RF30-F24 (los datos de la hoja se ven desde el detalle). Su nota "el detalle (5.3.3) lo reemplazará" queda cumplida. Pruebas: los dos `it('CA-RF24-F13 …')` de `tarjetas-lista.test.tsx` (las líneas 245 y 260) pasan a comprobar `router.push` con la ruta `/tarjetas/[id]`; los datos de la hoja se prueban sobre el detalle.
- **CA-RF24-F15** ("Volver" cierra la hoja y "la lista queda igual"): ahora es el detalle el que queda igual. Prueba: `tarjetas-formulario.test.tsx` (`it` de CA-RF24-F15, línea 125).
- **CA-RF24-F30** (al cambiar la tasa "la fila de la lista dice la nueva"): ahora la ve el detalle ("Tasa 31,5 % E.A." bajo el título, CA-RF30-F25) y la lista la muestra al volver (CA-RF30-F29). Prueba: `tarjetas-guardar.test.tsx` (línea 223).
- **CA-RF24-F32** (al editar "se vuelve a pedir la lista y muestra el nombre nuevo sin duplicar"): ahora se vuelve a pedir la tarjeta y el título dice "Visa Oro" (CA-RF30-F25); la lista sin duplicados queda en CA-RF30-F29. Prueba: `tarjetas-guardar.test.tsx` (línea 249).
- **CA-RF24-F35** (404 al editar: "al cerrar la hoja, la lista ya no la muestra"): ahora, al cerrar la hoja, el detalle dice "Esta tarjeta ya no existe." (CA-RF30-F22). Prueba: `tarjetas-guardar.test.tsx` (línea 318).
- **CA-RF24-F42** (confirmar elimina y "la lista deja de mostrarla"; si era la última, aviso de vacío) y **CA-RF24-F45** (404 al eliminar: "deja de mostrarla"): ahora, al terminar, la app regresa (`router.back()`, CA-RF30-F26) y la lista ya sin la tarjeta (o con el aviso de vacío) se prueba como CA-RF30-F29. Pruebas: `tarjetas-eliminar.test.tsx` (líneas 108, 122 y 175).
- **CA-RF24-F51** ("la lista y los formularios no calculan ni muestran ningún monto en pesos"): el detalle sí muestra montos que da el backend (CA-RF30-F11). El criterio se limita a "la lista y la hoja del formulario" (la prueba de la hoja debe abrirla desde el detalle y comprobar solo la hoja). Prueba: `tarjetas-lista.test.tsx` (línea 366): además de abrir por otro camino, su verificación `queryByText(/deuda|cuota estimada|total/i)` ya no puede mirar la pantalla del detalle.
- **CA-RF24-F48** ("Cargos fijos" de la hoja navega a los cargos): sigue igual, pero la hoja se abre desde el detalle; el segundo `it` ("al volver a abrir la tarjeta se ve el alias guardado") vuelve a abrir la hoja con "Editar tarjeta" del detalle, no tocando la fila. Pruebas: `tarjetas-lista.test.tsx` (líneas 273 y 290).
- **El encabezado de `05-tarjetas-pantallas.md`** dice que el "Detalle de tarjeta … por ahora tocar una fila abre el formulario de editar": queda obsoleto con este paquete.

**Criterios cuyo texto no cambia, pero cuyas pruebas deben abrir la hoja desde el detalle** (los ayudantes `abrirEdicion` / `abrirDialogo` de cada archivo dejan de tocar la fila de la lista): CA-RF24-F14 (la de editar), F16 a F24 (campos, validación, tasa), F29, F31, F33, F34 a F39, F40 a F44 y F46 y F47, F49 (hoja de editar) y F50. Archivos: `tarjetas-lista.test.tsx` (`abrirEdicion`, línea 62), `tarjetas-formulario.test.tsx` (`abrirEdicion`, línea 56), `tarjetas-guardar.test.tsx` (`abrirEdicion`, línea 70) y `tarjetas-eliminar.test.tsx` (`abrirDialogo`, línea 51). Lo que cambia en esos ayudantes: renderizan el detalle (con `useLocalSearchParams` → `id` y `nombre`), con `obtenerTarjeta` y `obtenerProyeccion` en el mock de `@/lib/api/tarjetas`, y tocan "Editar tarjeta".

**Un detalle para esas pruebas:** el título de la hoja y el botón del detalle dicen igual ("Editar tarjeta"); las comprobaciones de "la hoja se cerró" que hoy usan `queryByText('Editar tarjeta')` deben usar un elemento que solo tiene la hoja ("Guardar tarjeta" o el campo "Alias").

**Mocks de `expo-router` de las pruebas de "Mis tarjetas"** (`tarjetas-lista`, `tarjetas-formulario`, `tarjetas-guardar`, `tarjetas-eliminar` y `tarjetas-avance-boton`): como la lista pide sus datos al recuperar el foco, el mock debe incluir `useFocusEffect` (ejecutándolo al montar), o la pantalla fallaría por una función que el mock no tiene. Los criterios CA-RF24-F04 y F26 (cuántas veces se llama a `listarTarjetas`) siguen valiendo.

**`layout.test.tsx` (CA-RF24-F02):** debe comprobar también que, con sesión, la pantalla `tarjetas/[id]` (o `tarjetas/[id]/index`) está disponible y, sin sesión, no (CA-RF30-F02). El patrón de `queryByText(/^pantalla tarjetas/)` del caso sin sesión ya la cubre.

**Sin cambio:** CA-RF24-F01 a F12 (entrada, carga y lista), F25 a F28 (crear), F36 a F38 en lo que toca a "Nueva tarjeta", F52 a F56 (adaptador) y todo `CA-RF29-F` (cargos fijos).

---

## Resumen

- Criterios: 46. **Total del mes** (CA-RF30-F01 a F37): 37 — entrada y ruta 3 (F01 a F03), carga 2 (F04, F05), selector de mes 5 (F06 a F10), lo que se ve 4 (F11 a F14), casos con ceros 3 (F15 a F17), errores 6 (F18 a F23), acciones sobre la tarjeta 7 (F24 a F30), accesibilidad y lenguaje 3 (F31 a F33), adaptador 4 (F34 a F37). **Proyección** (CA-RF31-F01 a F09): 9 — lo que queda por pagar 2 (F01, F02), los meses siguientes 7 (F03 a F09).
- Código nuevo que piden: `obtenerProyeccion`, `obtenerTarjeta` y los tipos `ProyeccionTarjeta` y `MesProyectado` en `lib/api/tarjetas.ts`; la pantalla `/tarjetas/[id]` (con selector de mes, resumen, "Próximos meses", estados de carga, error, 404 y vacío, y los botones "Editar tarjeta" y "Ver cargos fijos", que abre la hoja `HojaTarjeta` ya existente); la ruta protegida en `app/_layout.tsx`; `app/tarjetas.tsx` navega al detalle al tocar una fila y vuelve a pedir su lista al recuperar el foco.
- Decisiones por aprobar: A1 a A4 (el detalle como destino de la fila, "Editar tarjeta" y "Ver cargos fijos", `obtenerTarjeta` para los datos de la hoja, refresco al guardar, al volver y al eliminar), B1 a B3 (selector sin tope, mes explícito, cifras viejas ocultas y respuestas viejas descartadas), C1 a C5 (textos, rótulo por mes, texto de tarjeta sin pagos, nota del saldo, filas de los meses), D1 a D4 (qué se ve cargando, un solo texto de error, 404 sin reintento, lista larga), E1 y E2 (adaptador), F1 (accesibilidad), más las desviaciones del Figma ya tomadas (sin cupo, sin fechas, sin deuda total, sin "Marcar como pagada", sin "Cuotas pendientes").
