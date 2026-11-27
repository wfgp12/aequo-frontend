# Criterios de aceptación — 5. Tarjetas de crédito: registrar un pago y ver lo pagado frente a lo estimado (paquete 5.3.4)

Estado: **Aprobado** (2026-11-20). El desarrollador aprobó los 48 criterios y las decisiones D1 a D11 tal como se recomendaban (incluidos F08 y F41).

Cubre RF-32 (registrar los pagos de una tarjeta y compararlos con el total estimado del mes) en el frontend. El criterio de la EDT es: "El usuario registra un pago de su tarjeta y ve cuánto ha pagado frente a lo que debía pagar." El backend (5.3.2, ya mezclado en `develop`) guarda el pago como un egreso `PAGO_TARJETA` sin categoría y calcula la comparación; aquí solo se verifica qué ve el usuario, qué se envía y cómo se explican los errores (RNF-11: la pantalla no suma, no resta, no multiplica ni compara montos para obtener la diferencia; solo redondea al peso al mostrar).

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- Editar un pago: el contrato no lo permite (se elimina y se registra de nuevo).
- Abonos a deudas (módulo 6): solo se prevé que Movimientos los trate como de solo lectura (CA-RF32-F41, decisión D11).
- El `detalle` por compra de la proyección (5.3.6 del backend; cubierto después en `05-cuotas-pendientes.md`), cupo, fecha de vencimiento y "Deuda total": sin datos en la API (decidido en 5.1.3 y 5.3.3; sigue valiendo CA-RF30-F33).
- Ir desde Movimientos a la tarjeta de un pago: `GET /transacciones` no trae `tarjetaId` (el contrato lo deja para un paquete aparte).
- La versión de escritorio (1280 px): el Figma no la tiene para tarjetas.
- Colores, tamaños, tipografía, la posición exacta de los bloques y el aspecto de la hoja y del diálogo, en modo claro y oscuro: **revisión visual**, no se prueba con Jest.

**Fuentes:** Especificación de Requisitos (RF-32), CLAUDE.md (cálculos en el backend, RNF-11; carga y arranque en frío de Render, RNF-02; lenguaje sencillo, RNF-04; accesibilidad, RNF-06; eliminar siempre pide confirmación; modo claro y oscuro), Figma sección 06 · Tarjetas de crédito, frame móvil "Detalle de tarjeta" (37:160, solo con el texto leído: botón "Marcar como pagada", "Próximo pago estimado $ 310.000 · 28 de octubre", "Deuda total", "Cupo disponible"), contrato `coordinacion/contratos/pagos.md` (la conformidad del frontend queda dada con la aprobación de estos criterios, 2026-11-20; el backend ya corrigió `GET /tarjetas/:id/pagos` para responder `{ items: [...] }`, igual que aquí), el Swagger del backend (`backend/src/tarjetas/pagos.controller.ts` y `dto/crear-pago.dto.ts`) y los criterios del frontend ya aprobados (`05-detalle-de-tarjeta.md`, `05-tarjetas-pantallas.md`, `05-compra-con-tarjeta.md`).

**Lo que el Figma no tiene:** no existe frame para registrar un pago ni para la lista de pagos (hueco del diseño). Se adopta la solución mínima coherente con el resto: una **hoja** como las demás ("Nuevo cargo fijo", "Nueva tarjeta") y la lista de pagos **dentro del detalle de la tarjeta**. Si el desarrollador diseña esos frames, los textos y la posición se ajustan sin cambiar los comportamientos de abajo (decisión D2).

**Contrato del backend que importa aquí** (todas las rutas con sesión; el `401` lo resuelve el cliente HTTP compartido: cierra la sesión y la app vuelve al login):
- `POST /tarjetas/:tarjetaId/pagos` con `Idempotency-Key` y cuerpo `{ valor, fecha?, metodoPago?, descripcion? }` → `201` con `{ id, tarjetaId, valor, fecha, metodoPago, descripcion, creadaEn, comparacion: { mes, estimado, pagado, diferencia } }`.
  - `valor` > 0, máximo 2 decimales, tope 999.999.999.999. `fecha` `YYYY-MM-DD` (por defecto hoy según `X-Zona-Horaria`; puede ser pasada o futura). `metodoPago` `EFECTIVO` | `DEBITO` | `TRANSFERENCIA` (por defecto `TRANSFERENCIA`; `TARJETA_CREDITO` no se acepta). `descripcion` de 1 a 200 caracteres (por defecto "Pago de tarjeta").
  - `null` en `fecha`, `metodoPago` o `descripcion` es `400`: se omite el campo para usar el valor por defecto. Cualquier campo no declarado (`tarjetaId`, `tipo`, `monto`, `categoriaId`…) es `400`.
  - `comparacion` es del mes de la **fecha del pago**, ya con este pago incluido; `diferencia = pagado − estimado` (negativa: falta por pagar; positiva: se pagó de más). Los montos llegan sin redondear.
  - Misma `Idempotency-Key` y misma petición → la primera respuesta, sin crear otro pago. `409` si la primera sigue en proceso; `422` si la misma clave llega con otro cuerpo; `400`; `404` "Tarjeta no encontrada".
- `GET /tarjetas/:tarjetaId/pagos?mes=YYYY-MM` → `200` con **`{ items: [...] }`**, cada pago con la forma de arriba **sin** `comparacion`, el más reciente primero (por fecha y luego por creación); sin pagos, `{ items: [] }`. Sin `mes`, todos. Sin `Idempotency-Key`.
- `DELETE /tarjetas/:tarjetaId/pagos/:pagoId` → `204` sin cuerpo; `404` "Pago no encontrado" (no existe, ya se eliminó, es de otra tarjeta o no es un pago) o "Tarjeta no encontrada".
- `GET /tarjetas/:tarjetaId/proyeccion?mes=` suma `pagado` y `diferencia` al nivel superior (los mismos de `comparacion`, para el mes pedido); las filas de `proyeccion` no los traen y `saldoPendiente` no cambia: los pagos no lo descuentan.
- `GET /transacciones`: un pago llega con `clasificacionFlujo` `PAGO_TARJETA`, `tipo` `EGRESO` y `categoriaId` `null`; el enum completo es `ORDINARIO | DINERO_RECIBIDO | ABONO_DEUDA | PAGO_TARJETA`. `PATCH` y `DELETE` de ese movimiento dan `409` (se gestiona desde la tarjeta).

**Interfaz pública** (queda aprobada con estos criterios):
- Adaptador, en `lib/api/tarjetas.ts` (sobre `requestAutenticado`, como el resto del archivo):
  - tipos `PagoTarjeta` (`{ id, tarjetaId, valor, fecha, metodoPago, descripcion, creadaEn }`), `ComparacionDePagos` (`{ mes, estimado, pagado, diferencia }`), `PagoRegistrado` (`PagoTarjeta & { comparacion }`) y `DatosPago` (`{ valor, fecha?, metodoPago?, descripcion? }`); `ProyeccionTarjeta` suma `pagado` y `diferencia`;
  - `registrarPago(tarjetaId, datos: DatosPago, claveIdempotencia): Promise<PagoRegistrado>`: `POST /tarjetas/:tarjetaId/pagos`;
  - `listarPagos(tarjetaId, mes?): Promise<PagoTarjeta[]>`: `GET /tarjetas/:tarjetaId/pagos[?mes=]`, entrega el contenido de `items`;
  - `eliminarPago(tarjetaId, pagoId): Promise<void>`: `DELETE /tarjetas/:tarjetaId/pagos/:pagoId`.
- En `lib/api/transacciones.ts`, `Transaccion.clasificacionFlujo` pasa a `'ORDINARIO' | 'DINERO_RECIBIDO' | 'ABONO_DEUDA' | 'PAGO_TARJETA'` (tipo; lo comprueba `tsc`).
- Sin pantalla nueva: todo ocurre en el detalle (`/tarjetas/[id]`), en una hoja y un diálogo, y en Movimientos.

**Sobre los IDs:** los `CA-RF32-nn` ya los usa el backend para su lado (otro repositorio). Para no confundirlos, estos llevan la letra F (`CA-RF32-F01`…).

**Aviso sobre las palabras:** en `05-detalle-de-tarjeta.md`, "los pagos del mes" (CA-RF30-F04, F28) significa lo que la tarjeta cobra ese mes (la proyección). En este documento, "pago" es solo lo que el usuario registra, y "lo que pagas" sigue siendo el total estimado.

**Convención de las pruebas:** hoy es el 19 de noviembre de 2026 (reloj simulado), así que el mes actual es `2026-11`. El backend se simula en el borde del adaptador (`jest.mock('@/lib/api/tarjetas')`) en las pruebas de pantallas, y `fetch` en las del adaptador; `expo-router` como en las pruebas del detalle. Se usa la tarjeta "Visa Bancolombia" (id `66a0b3c4d5e6f70012ab34cd`) y estas respuestas simuladas de `obtenerProyeccion` para el mes `2026-11` (se suman a las de `05-detalle-de-tarjeta.md`, que ahora también llevan `pagado` y `diferencia`; **el frontend no verifica que cuadren**, solo muestra lo que llega):

| Caso | `total` | `pagado` | `diferencia` | Lo que se ve de la diferencia |
|---|---|---|---|---|
| SIN_PAGOS | 346270,05016469 | 0 | −346270,05016469 | "Te falta pagar $ 346.270" |
| PAGO_PARCIAL | 346270,05016469 | 100000 | −246270,05016469 | "Te falta pagar $ 246.270" |
| PAGO_EXACTO | 346270,05016469 | 346270,05016469 | 0 | "Pagaste justo lo estimado" |
| PAGO_DE_MAS | 346270,05016469 | 400000 | 53729,94983531 | "Pagaste de más $ 53.730" |
| PAGO_SIN_DEUDA | 0 (con `cuotas`, `cargosFijos` y `saldoPendiente` en 0 y `proyeccion` `[]`) | 50000 | 50000 | "Pagaste de más $ 50.000" |

Y esta respuesta simulada de `listarPagos('66a0…', '2026-11')` (`items`): `pago-3` = `{ valor: 100000, fecha: '2026-11-15', metodoPago: 'TRANSFERENCIA', descripcion: 'Pago de tarjeta' }` y `pago-2` = `{ valor: 50000, fecha: '2026-11-10', metodoPago: 'EFECTIVO', descripcion: 'Abono de la quincena' }`, en ese orden.

**Decisiones resueltas** (aprobadas el 2026-11-20, todas según la recomendación; cada "> Decisión aprobada" de abajo lleva su letra):
- **D1.** Rótulo del botón: "Registrar un pago" (el Figma dice "Marcar como pagada").
- **D2.** Hueco del diseño: hoja "Nuevo pago" y lista de pagos dentro del detalle.
- **D3.** El valor se escribe en pesos enteros.
- **D4.** El valor empieza con el total estimado del mes de hoy, si lo hay.
- **D5.** Qué campos se envían siempre y cuáles solo si el usuario los llena.
- **D6.** Cómo se muestra el resultado y de qué mes es la comparación.
- **D7.** Cuándo se dice "Pagaste justo lo estimado".
- **D8.** Cuándo se oculta el bloque de lo pagado y qué pasa con el aviso de "sin pagos pendientes".
- **D9.** Lista de pagos: sin sección si está vacía; si falla, el mismo aviso del detalle.
- **D10.** Eliminar: un botón por fila, diálogo de confirmación y el `404` como "ya eliminado".
- **D11.** Movimientos: los pagos (y los abonos a deudas) son de solo lectura.

---

# Registrar un pago (`CA-RF32-F`)

## Entrada y hoja

### CA-RF32-F01 — "Registrar un pago" está en el detalle cuando llegan los datos de la tarjeta

- **Dado** el detalle de "Visa Bancolombia" con sesión vigente
- **Cuando** `obtenerTarjeta` responde bien (con las cifras del mes cargadas, cargando otro mes o con la proyección fallida)
- **Entonces** ve el botón "Registrar un pago" junto a "Editar tarjeta" y "Ver cargos fijos".
- **Y** no lo ve mientras `obtenerTarjeta` no responde, si falló, ni en el estado "Esta tarjeta ya no existe." (la misma regla de CA-RF30-F30).

> Decisión aprobada (D1): el Figma dice "Marcar como pagada", que suena a un interruptor de "pagada / no pagada". El contrato es otra cosa: un pago por un valor libre, que puede ser menor, igual o mayor al estimado, y que se puede repetir varias veces en el mes. Se aprobó "Registrar un pago": dice lo que pasa y es el mismo verbo de "Registrar ingreso/egreso". "Marcar como pagada" queda descartado (CA-RF30-F33 sigue prohibiéndolo).

### CA-RF32-F02 — Tocarlo abre la hoja "Nuevo pago" con sus campos y sin llamar al backend

- **Dado** el detalle ya cargado (mes de hoy, sin lo que se sugiere en CA-RF32-F08)
- **Cuando** el usuario toca "Registrar un pago"
- **Entonces** se abre la hoja "Nuevo pago" con: "Valor del pago" vacío (se ve "$ 0"), "Fecha del pago" con "Hoy" elegida y debajo la fecha de hoy en letras ("jueves, 19 de noviembre de 2026"), "Cómo pagaste" con "Transferencia" elegida, "Nota (opcional)" vacía y el botón "Guardar pago".
- **Y** no se llama a ningún adaptador y el detalle de atrás queda como estaba.

> Decisión aprobada (D2): no hay frame en el Figma para esta hoja. Se adopta la misma estructura de las otras hojas de tarjetas (título al centro, "‹ Volver", campos, "Guardar …"), con 720 px de alto máximo. Los textos ("Nuevo pago", "Valor del pago", "Fecha del pago", "Cómo pagaste", "Nota (opcional)", "Guardar pago") son los aprobados, en lenguaje cotidiano (RNF-04); "Hoy / Ayer / Otra fecha" son los del paso de fecha del registro y "Efectivo / Tarjeta débito / Transferencia" los de la lista de Movimientos.

### CA-RF32-F03 — "Volver" cierra la hoja sin guardar y al reabrirla está limpia

- **Dado** la hoja "Nuevo pago" con un valor y una nota escritos
- **Cuando** el usuario toca "Volver"
- **Entonces** la hoja se cierra, no se llama a `registrarPago` ni a otro adaptador, y el detalle queda como estaba.
- **Y** al volver a tocar "Registrar un pago" el formulario está como en CA-RF32-F02 (sin lo escrito antes).

### CA-RF32-F04 — El valor se escribe en pesos, con puntos de miles

- **Dado** la hoja "Nuevo pago"
- **Cuando** el usuario escribe "346270" en "Valor del pago"
- **Entonces** el campo muestra "$ 346.270" y se anuncia como "Monto en pesos" (el mismo campo del resto de la app: solo dígitos, sin ceros a la izquierda, hasta 12 dígitos; no se pueden escribir letras ni signos ni decimales).

> Decisión aprobada (D3): el backend acepta hasta 2 decimales, pero todos los montos que el usuario escribe en Aequo son pesos enteros y los montos que se le muestran se redondean al peso. Se aprobó pesos enteros (reutiliza el campo de monto). Con esto, un pago de $ 346.270,50 no se puede registrar desde la app; si se necesita, se cambia el campo (decisión de interfaz, no del backend).

### CA-RF32-F05 — La fecha: hoy, ayer u otra con calendario

- **Dado** la hoja "Nuevo pago" abierta el 19 de noviembre de 2026
- **Cuando** el usuario toca "Ayer"
- **Entonces** "Ayer" queda elegida (se anuncia como seleccionada) y la fecha en letras dice "miércoles, 18 de noviembre de 2026".
- **Y** al tocar "Otra fecha" ve el calendario y, al tocar un día (por ejemplo el 5 de noviembre), la fecha en letras pasa a ser esa; al tocar "Hoy" vuelve a la de hoy.
- **Y** el calendario no restringe días pasados ni futuros (el backend acepta cualquiera).

### CA-RF32-F06 — El método: efectivo, tarjeta débito o transferencia

- **Dado** la hoja "Nuevo pago" con "Transferencia" elegida
- **Cuando** el usuario toca "Efectivo"
- **Entonces** "Efectivo" queda elegida y "Transferencia" deja de estarlo (se anuncian como seleccionada y no seleccionada); lo mismo con "Tarjeta débito".
- **Y** no hay una opción de tarjeta de crédito (no se paga una tarjeta con otra tarjeta).

### CA-RF32-F07 — La nota es opcional y admite hasta 200 caracteres

- **Dado** la hoja "Nuevo pago"
- **Cuando** el usuario escribe una nota de más de 200 caracteres
- **Entonces** el campo "Nota" solo conserva los primeros 200 (como la nota del registro).

### CA-RF32-F08 — El valor puede empezar con el total estimado del mes de hoy

- **Dado** el detalle en el mes de hoy (noviembre 2026) con `total` 346270,05016469
- **Cuando** el usuario toca "Registrar un pago"
- **Entonces** "Valor del pago" ya trae "$ 346.270" (el `total` que entregó el backend, redondeado al peso al mostrarlo) y el usuario puede cambiarlo o borrarlo.
- **Y** el valor que viaja al guardar sin tocarlo es `346270` (lo que se ve), no `346270,05016469`.
- **Y** si el detalle está en otro mes (por ejemplo diciembre 2026), o el `total` es 0, o aún no hay cifras (cargando o con error), el valor empieza vacío.

> Decisión aprobada (D4): el Swagger del backend sugiere que el cliente "propone el estimado redondeado y el usuario lo confirma o lo ajusta", y es lo más cercano al "Marcar como pagada" del Figma (un toque, el pago completo). Solo se sugiere con el mes de hoy porque la fecha por defecto es hoy: sugerir el total de otro mes junto a la fecha de hoy llevaría a registrar el pago en un mes distinto del que se ve. Alternativa descartada: dejarlo siempre vacío (el usuario escribe lo que de verdad pagó). Se aprobó la sugerencia.

## Validación antes de llamar al backend

### CA-RF32-F09 — Valor vacío o en cero: no se envía

- **Dado** la hoja "Nuevo pago" con "Valor del pago" vacío (o "0", que el campo deja vacío)
- **Cuando** el usuario toca "Guardar pago"
- **Entonces** ve "Escribe un valor mayor que cero." (anunciado como alerta) y no se llama a `registrarPago`.
- **Y** el aviso desaparece al cambiar cualquier campo de la hoja.

## Guardar

### CA-RF32-F10 — Guardar envía el pago con una clave y solo lo necesario

- **Dado** la hoja "Nuevo pago" de "Visa Bancolombia" (`66a0b3c4d5e6f70012ab34cd`) abierta el 19 de noviembre de 2026, con 100000 en el valor, sin cambiar la fecha ni el método y con la nota vacía
- **Cuando** el usuario toca "Guardar pago"
- **Entonces** se llama a `registrarPago('66a0b3c4d5e6f70012ab34cd', { valor: 100000, fecha: '2026-11-19', metodoPago: 'TRANSFERENCIA' }, clave)` una sola vez, con una `clave` en formato UUID; `valor` es un número y el cuerpo no lleva `descripcion` (el backend pone "Pago de tarjeta"), `tarjetaId`, `tipo`, `monto` ni `categoriaId`.

> Decisión aprobada (D5): el contrato permite omitir `fecha` y `metodoPago` (el backend usa hoy y `TRANSFERENCIA`). Se aprobó enviar **siempre** los dos, igual que la compra con tarjeta (CA-RF26-F16) y los movimientos: así lo que el usuario ve en la hoja es exactamente lo que se guarda y no depende de que la zona horaria del dispositivo y la del header coincidan. `descripcion` solo se envía si el usuario escribió algo (con `null` el backend da `400`).

### CA-RF32-F11 — Con otras opciones y una nota, se envía lo elegido

- **Dado** la hoja con "Ayer", "Efectivo" y la nota "  Cuota de noviembre  "
- **Cuando** el usuario toca "Guardar pago"
- **Entonces** `registrarPago` recibe `{ valor, fecha: '2026-11-18', metodoPago: 'EFECTIVO', descripcion: 'Cuota de noviembre' }` (la nota sin los espacios de los extremos).
- **Y** con "Tarjeta débito" el método es `DEBITO`; con otra fecha elegida en el calendario (el 5 de noviembre), `fecha` es `'2026-11-05'`.
- **Y** con una nota de solo espacios no se envía `descripcion`.

### CA-RF32-F12 — Mientras guarda ve un indicador y el doble toque no repite

- **Dado** que el backend aún no responde al guardado (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario espera, o toca "Guardar pago" dos veces seguidas
- **Entonces** el botón muestra un indicador de carga en lugar de su texto y no se puede tocar de nuevo, `registrarPago` se llama **una sola vez**, con una sola clave, y la hoja sigue abierta con lo escrito.

## Lo que se ve al guardar

### CA-RF32-F13 — Confirmación: "¡Listo!" con el pago y un botón para cerrar

- **Dado** que el backend responde `201` con el pago (`valor` 100000, `fecha` `2026-11-19`) para "Visa Bancolombia"
- **Cuando** el usuario ve el resultado
- **Entonces** la hoja deja de mostrar el formulario y ve "¡Listo!", "Registramos tu pago de $ 100.000 a Visa Bancolombia." (el valor sale de la respuesta del guardado) y el botón "Listo"; no ve "Guardar pago" ni los campos.
- **Y** no se llama a `registrarPago` otra vez ni a otro adaptador hasta que cierra (CA-RF32-F17).

> Decisión aprobada (D6): texto aprobado, calcado de la confirmación de la compra (CA-RF26-F18). Es el único lugar donde se ve la comparación **del mes del pago** (puede no ser el mes que está viendo en el detalle). Alternativa descartada: cerrar la hoja al guardar y mostrar solo el bloque del detalle (CA-RF32-F25).

### CA-RF32-F14 — La confirmación muestra la comparación del mes del pago, tal como llega

- **Dado** que el backend responde `201` con `comparacion` `{ mes: '2026-11', estimado: 346270,05016469, pagado: 100000, diferencia: -246270,05016469 }`
- **Cuando** el usuario ve la confirmación
- **Entonces** ve "Estimado de noviembre 2026: $ 346.270", "Pagado en noviembre 2026: $ 100.000" y "Te falta pagar $ 246.270".
- **Y** el mes se nombra siempre con su nombre ("noviembre 2026"), nunca "este mes", porque el pago puede ser de otro mes.

### CA-RF32-F15 — La diferencia se dice con palabras cotidianas

- **Dado** una comparación (en la confirmación) o un mes del detalle (CA-RF32-F25) con una `diferencia` del backend
- **Cuando** el usuario la lee
- **Entonces** ve, según su signo: negativa → "Te falta pagar $ X" con X = el valor absoluto de la `diferencia`, redondeado al peso (`-246270,05016469` → "Te falta pagar $ 246.270"); positiva → "Pagaste de más $ X" (`53729,94983531` → "Pagaste de más $ 53.730"); cero → "Pagaste justo lo estimado".
- **Y** nunca ve el signo "−" ni la palabra "diferencia", ni decimales, ni "NaN".

### CA-RF32-F16 — Una diferencia menor a medio peso cuenta como "justo"

- **Dado** que el backend responde `diferencia` `-0,05016469` (o `0,4`), que redondeada al peso es 0
- **Cuando** el usuario la lee
- **Entonces** ve "Pagaste justo lo estimado", no "Te falta pagar $ 0" ni "Pagaste de más $ 0"; con `-0,6` ve "Te falta pagar $ 1".

> Decisión aprobada (D7): el estimado llega con decimales (346270,05) y el usuario paga pesos enteros: sin esta regla, pagar exactamente $ 346.270 daría "Te falta pagar $ 0". Es decidir qué texto mostrar según el valor ya redondeado que se va a ver; el signo y el monto los da el backend (no se calcula nada). El contrato advierte que el redondeo del estimado está "pendiente de confirmar con la hoja del promotor"; si cambia, cambia este criterio.

### CA-RF32-F17 — Al cerrar, el detalle vuelve a pedir lo del mes que estaba viendo

- **Dado** la confirmación abierta, con el detalle de atrás en noviembre 2026 (o en otro mes)
- **Cuando** el usuario toca "Listo" (o "Volver")
- **Entonces** la hoja se cierra y se vuelve a pedir `obtenerProyeccion` y `listarPagos` del mes que se estaba viendo, una vez cada una; cuando llegan, el detalle muestra las cifras y la lista nuevas (CA-RF32-F25 y F31).
- **Y** el selector sigue en el mismo mes aunque el pago sea de otro (por ejemplo, un pago del 28 de octubre desde el detalle de noviembre deja el selector en "noviembre 2026").
- **Y** mientras llegan las respuestas se siguen viendo las cifras que ya estaban (sin indicador), como en CA-RF30-F28.

### CA-RF32-F18 — El frontend no calcula: muestra lo que responde el backend

- **Dado** que el backend responde cifras que no cuadran a propósito: `estimado` 346270, `pagado` 100000 y `diferencia` 5 (y en el detalle, `total` 150000, `pagado` 100000, `diferencia` 5 y `saldoPendiente` 999999)
- **Cuando** la pantalla las muestra
- **Entonces** ve "Pagaste de más $ 5" (no "Te falta pagar $ 246.270", que saldría de restar en el frontend), "Pagado … $ 100.000" y, en el detalle, "$ 999.999" por pagar después: los pagos no descuentan "Te queda por pagar después de este mes".

## Errores al guardar

### CA-RF32-F19 — Sin conexión: avisa, conserva todo y reintenta con la misma clave

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." dentro de la hoja (anunciado como alerta), con lo escrito intacto y "Guardar pago" disponible.
- **Y** al volver a tocarlo sin cambiar nada, la nueva llamada a `registrarPago` lleva **la misma clave** y el mismo cuerpo, y el aviso desaparece al lograr guardar.

### CA-RF32-F20 — Otro fallo (400, 422 o 500): mensaje general y la misma clave

- **Dado** que el backend responde `400`, `422` o `500` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar tu pago. Revisa los datos e inténtalo de nuevo.", sin términos técnicos ni los mensajes del backend, con la hoja abierta y lo escrito intacto.
- **Y** al volver a tocar "Guardar pago" sin cambiar nada, la solicitud lleva la misma clave.

### CA-RF32-F21 — Si todavía se está procesando (409), espera y reintenta con la misma clave

- **Dado** que el backend responde `409` porque la primera solicitud con esa clave sigue en proceso
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Tu pago todavía se está guardando. Espera unos segundos e inténtalo de nuevo." (no el de datos incorrectos), "Guardar pago" vuelve a estar disponible y, al tocarlo, la solicitud lleva la misma clave.

### CA-RF32-F22 — La tarjeta ya no existe (404)

- **Dado** que el backend responde `404` ("Tarjeta no encontrada") al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Esta tarjeta ya no existe." dentro de la hoja (el mensaje del backend no se muestra), que sigue abierta con lo escrito.
- **Y** al cerrarla con "Volver", el detalle vuelve a pedir sus datos y muestra "Esta tarjeta ya no existe." (CA-RF30-F22).

## Clave de idempotencia y sesión

### CA-RF32-F23 — Cambiar algo tras un fallo es una acción nueva; un pago nuevo, otra clave

- **Dado** que el primer "Guardar pago" falló
- **Cuando** el usuario cambia el valor, la fecha, el método o la nota y vuelve a guardar
- **Entonces** la nueva llamada a `registrarPago` lleva una clave **distinta** y el cuerpo nuevo (el backend respondería `422` si se reutilizara la clave con otro cuerpo).
- **Y** si más tarde registra otro pago (después de guardar, o cerrando la hoja y abriéndola de nuevo), aunque los datos sean idénticos, la clave es distinta: dos pagos iguales seguidos son legítimos.

### CA-RF32-F24 — Sesión vencida al guardar (401)

- **Dado** que el backend responde `401` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; la hoja no muestra un aviso de error propio.

---

# Lo pagado frente a lo estimado en el detalle (`CA-RF32-F`)

### CA-RF32-F25 — El detalle muestra lo que lleva pagado y la diferencia del mes

- **Dado** que el backend responde PAGO_PARCIAL para el mes de hoy (`total` 346270,05016469, `pagado` 100000, `diferencia` -246270,05016469)
- **Cuando** termina de cargar
- **Entonces** ve, además de "Este mes pagas $ 346.270" y lo demás de CA-RF30-F11, un bloque con "Este mes has pagado" y "$ 100.000", y debajo "Te falta pagar $ 246.270"; la nota y "Te queda por pagar después de este mes" siguen como antes.
- **Y** con SIN_PAGOS ve "Este mes has pagado" con "$ 0" y "Te falta pagar $ 346.270"; con PAGO_EXACTO, "$ 346.270" y "Pagaste justo lo estimado"; con PAGO_DE_MAS, "$ 400.000" y "Pagaste de más $ 53.730" (textos de CA-RF32-F15).

> Decisión aprobada (D8): textos y bloque aprobados (RNF-04); el Figma no tiene este bloque. El orden y la posición exactos se revisan contra el diseño que se haga (D2).

### CA-RF32-F26 — En otro mes, el rótulo dice el mes

- **Dado** el detalle en un mes que no es el de hoy (por ejemplo, diciembre 2026) con `pagado` 150000 y `diferencia` -114543,21823395
- **Cuando** el usuario ve el bloque
- **Entonces** el rótulo dice "Has pagado en diciembre 2026" con "$ 150.000" y debajo "Te falta pagar $ 114.543"; en el mes de hoy sigue diciendo "Este mes has pagado".

### CA-RF32-F27 — Un mes sin deuda pero con pagos sí se muestra

- **Dado** que el backend responde PAGO_SIN_DEUDA (todo en cero salvo `pagado` 50000 y `diferencia` 50000)
- **Cuando** termina de cargar
- **Entonces** ve "Este mes pagas $ 0", "Este mes has pagado" con "$ 50.000" y "Pagaste de más $ 50.000"; no ve el aviso "No tienes pagos pendientes con esta tarjeta…".

> Decisión aprobada (D8): hoy (CA-RF30-F17) el aviso de "sin pagos pendientes" sale cuando `total`, `saldoPendiente` y `proyeccion` están vacíos; con pagos registrados eso escondería dinero que el usuario sí pagó. Cambia F17: el aviso solo sale si, además, `pagado` es 0.

### CA-RF32-F28 — Sin deuda ni pagos, no se muestra el bloque

- **Dado** que el backend responde `total` 0, `pagado` 0 y `diferencia` 0, con cuotas por pagar más adelante (ANTES_DEL_PRIMER_PAGO), o todo en cero (VACIA)
- **Cuando** termina de cargar
- **Entonces** no ve "has pagado", ni "Te falta pagar", ni "Pagaste justo lo estimado"; en ANTES_DEL_PRIMER_PAGO ve lo de CA-RF30-F15 y en VACIA el aviso de CA-RF30-F17.

> Decisión aprobada (D8): "Pagaste justo lo estimado" en un mes sin nada que pagar sería ruido, y con el aviso de "sin pagos pendientes" ya se explica. Se aprobó ocultar el bloque cuando `total` y `pagado` son 0.

### CA-RF32-F29 — Al cambiar de mes, lo pagado y la lista se ocultan y se vuelven a pedir

- **Dado** el detalle con PAGO_PARCIAL y la lista de pagos de noviembre
- **Cuando** el usuario toca "Mes siguiente" y el backend aún no responde
- **Entonces** ve el indicador "Cargando tu tarjeta" y no ve ni lo pagado, ni "Te falta pagar…", ni la lista de pagos del mes anterior (lo mismo que CA-RF30-F09); cuando llega la respuesta ve lo del mes nuevo. Una respuesta tardía de un mes viejo no pisa la del último (CA-RF30-F10), también en la lista de pagos.

---

# Pagos del mes en el detalle (`CA-RF32-F`)

## La lista

### CA-RF32-F30 — Al entrar y al cambiar de mes se piden los pagos registrados del mes

- **Dado** una sesión vigente y que hoy es el 19 de noviembre de 2026
- **Cuando** el usuario abre el detalle de "Visa Bancolombia"
- **Entonces** además de lo de CA-RF30-F04 se llama a `listarPagos('66a0b3c4d5e6f70012ab34cd', '2026-11')` una sola vez, a la vez que las otras consultas; al tocar "Mes anterior" se llama a `listarPagos(…, '2026-10')` una vez más, y al recuperar el foco (volver de otra pantalla) se vuelve a pedir con el mes que se estaba viendo (CA-RF30-F28). No se pide `listarPagos` sin mes.

> Decisión aprobada (D9): la lista vive en el detalle (no en una pantalla aparte) y es parte de la carga del mes. Esto cambia lo que decía CA-RF30-F04 ("no se piden otras cosas"); ver "Efecto en los criterios y las pruebas existentes".

### CA-RF32-F31 — Con pagos: "Tus pagos de este mes" con una fila por pago, en el orden del backend

- **Dado** que `listarPagos` responde `pago-3` y `pago-2` (en ese orden)
- **Cuando** termina de cargar
- **Entonces** ve el encabezado "Tus pagos de este mes" y dos filas: "Pago de tarjeta", "$ 100.000" y "15 de noviembre de 2026 · Transferencia"; y "Abono de la quincena", "$ 50.000" y "10 de noviembre de 2026 · Efectivo". Con un pago de hoy la fecha dice "Hoy"; con uno de ayer, "Ayer".
- **Y** en otro mes el encabezado dice "Tus pagos de diciembre 2026"; la pantalla no reordena ni agrupa.
- **Y** tocar una fila no abre nada: los pagos no se editan.
- **Y** cada monto se redondea al peso (`100000,5` → "$ 100.001"), sin decimales ni "NaN".

### CA-RF32-F32 — Sin pagos en el mes, no hay sección

- **Dado** que `listarPagos` responde `{ items: [] }`
- **Cuando** termina de cargar
- **Entonces** no ve el encabezado "Tus pagos de este mes", ni filas, ni un aviso de "sin pagos"; lo demás del detalle sigue igual.

> Decisión aprobada (D9): mismo criterio que "Próximos meses" sin filas (CA-RF31-F06): sin sección vacía. Lo que falta pagar ya lo dice el bloque de CA-RF32-F25.

### CA-RF32-F33 — Si la lista no carga, el detalle avisa igual que cuando falla otra consulta

- **Dado** que `listarPagos` responde `500` o sin conexión (o `404`)
- **Cuando** termina la consulta
- **Entonces** ve el mismo aviso de CA-RF30-F18 / F19 ("No pudimos cargar tu tarjeta. Inténtalo de nuevo en unos minutos." o "No hay conexión con el servidor…") con "Reintentar", sin montos ni lista; con `404`, "Esta tarjeta ya no existe." (CA-RF30-F22).
- **Y** "Reintentar" vuelve a pedir solo lo que falló, una vez aunque se toque dos veces (CA-RF30-F20).

> Decisión aprobada (D9): una sola carga del mes, un solo aviso. Alternativa descartada: que la lista falle por separado con su propio "Reintentar", dejando visibles las cifras (más pantallas y más estados).

## Eliminar un pago

### CA-RF32-F34 — Cada pago tiene su botón de eliminar y pide confirmación

- **Dado** la lista con `pago-3` ($ 100.000, 15 de noviembre de 2026)
- **Cuando** el usuario toca el botón "Eliminar el pago de $ 100.000, 15 de noviembre de 2026" de esa fila
- **Entonces** ve el diálogo "¿Eliminar este pago?" con "Pago de tarjeta · $ 100.000 · 15 de noviembre de 2026. Esta acción no se puede deshacer." y los botones "Cancelar" y "Eliminar"; todavía no se llama a `eliminarPago`.
- **Y** "Cancelar" cierra el diálogo sin llamar a nada y el pago sigue ahí.

> Decisión aprobada (D10): el nombre accesible incluye el valor y la fecha porque varias filas pueden decir igual ("Pago de tarjeta"). Es el mismo diálogo de "¿Eliminar esta tarjeta?" / "¿Eliminar este cargo fijo?", con el texto en lenguaje cotidiano.

### CA-RF32-F35 — Confirmar elimina el pago y actualiza el detalle

- **Dado** el diálogo de eliminar `pago-3` y que el backend responde `204`
- **Cuando** el usuario toca "Eliminar"
- **Entonces** se llama a `eliminarPago('66a0b3c4d5e6f70012ab34cd', 'pago-3')` una sola vez, el diálogo se cierra, se vuelve a pedir `obtenerProyeccion` y `listarPagos` del mes que se está viendo y, con lo que respondan, la fila ya no está y lo pagado y la diferencia muestran las cifras nuevas (sin aviso de "eliminado").
- **Y** si era el último pago del mes, la sección "Tus pagos de este mes" desaparece (CA-RF32-F32).

### CA-RF32-F36 — Mientras elimina ve un indicador y el doble toque no repite

- **Dado** que el backend aún no responde a la eliminación
- **Cuando** el usuario espera, o toca "Eliminar" dos veces seguidas
- **Entonces** el botón muestra un indicador y no se puede tocar de nuevo, y `eliminarPago` se llama **una sola vez**.

### CA-RF32-F37 — Si ya no existe (404), se da por eliminado

- **Dado** que el backend responde `404` ("Pago no encontrado") a `eliminarPago` (se eliminó desde otro dispositivo)
- **Cuando** el usuario toca "Eliminar"
- **Entonces** el diálogo se cierra, la lista y las cifras se vuelven a pedir, y no ve ningún aviso de error ni el mensaje del backend.

> Decisión aprobada (D10): es lo que hacen hoy los demás diálogos de eliminar (lo que el usuario quería, que el pago no esté, ya se cumplió).

### CA-RF32-F38 — Si eliminar falla, avisa dentro del diálogo y el pago sigue

- **Dado** que `eliminarPago` falla por falta de conexión o con otro error (`500`, `400`)
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo (que sigue abierto, anunciado como alerta), "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." o "No pudimos eliminar el pago. Inténtalo de nuevo en unos minutos."; el pago sigue en la lista y puede volver a tocar "Eliminar".
- **Y** con `401` la sesión se cierra y la app vuelve al inicio de sesión, sin aviso propio.

---

# Cómo se ve el pago en Movimientos (`CA-RF32-F`)

### CA-RF32-F39 — El pago se ve como un egreso con su descripción

- **Dado** que Movimientos lista un egreso de $ 100.000, con descripción "Pago de tarjeta", pagado por transferencia, sin categoría (`categoria` `null`) y con `clasificacionFlujo` `PAGO_TARJETA`
- **Cuando** el usuario abre Movimientos
- **Entonces** ve "Pago de tarjeta", "− $ 100.000" y, debajo, "Pago de tarjeta · Transferencia" (los movimientos ordinarios siguen mostrando "Categoría · Método" y el dinero recibido "Dinero recibido · Método").
- **Y** si el usuario le puso una nota ("Cuota de noviembre"), el título es la nota y el subtítulo sigue "Pago de tarjeta · Transferencia".
- **Y** si llegara sin descripción, el título es "Pago de tarjeta" (nunca "Sin categoría").

### CA-RF32-F40 — Al tocarlo no se abre la edición ni se ofrece eliminar

- **Dado** esa fila en Movimientos
- **Cuando** el usuario la toca
- **Entonces** no se abre la hoja "Editar movimiento" ni se envía nada al backend; desde Movimientos no hay forma de eliminar el pago (`PATCH` y `DELETE` darían `409`).
- **Y** los movimientos ordinarios se siguen abriendo al tocarlos (CA-RF28-F15).

> Decisión aprobada (D11): mismo criterio que el dinero recibido (CA-RF28-F15, decisión G3). Sin `tarjetaId` en `GET /transacciones` no se puede llevar al usuario a la tarjeta; se gestiona desde el detalle de la tarjeta (CA-RF32-F34).

### CA-RF32-F41 — Los abonos a deudas también son de solo lectura

- **Dado** que Movimientos lista un egreso de $ 80.000 con `clasificacionFlujo` `ABONO_DEUDA`, descripción "Abono a Juan", pagado en efectivo
- **Cuando** el usuario lo ve y lo toca
- **Entonces** ve "Abono a Juan", "− $ 80.000" y "Abono a una deuda · Efectivo", y al tocarlo no se abre la edición.

> Decisión aprobada (D11): el abono a deudas es del módulo 6 y todavía nadie lo crea, pero el enum ya lo trae y `esDineroRecibido` es hoy la única protección. Se aprobó una sola regla: solo `ORDINARIO` se edita; cualquier otra clasificación es de solo lectura. El texto "Abono a una deuda" es el aprobado (se anticipa el módulo 6 solo en esto: la regla de solo lectura y ese texto).

---

# Accesibilidad y lenguaje (RNF-04, RNF-06)

### CA-RF32-F42 — Se puede usar con lector de pantalla

- **Dado** el detalle con pagos, la hoja "Nuevo pago", la confirmación y el diálogo de eliminar
- **Cuando** un lector de pantalla los recorre
- **Entonces** "Registrar un pago", "Guardar pago", "Listo", "Volver", "Cancelar", "Eliminar" y cada "Eliminar el pago de $ X, fecha" se anuncian como botones; "Hoy", "Ayer", "Otra fecha", "Efectivo", "Tarjeta débito" y "Transferencia" se anuncian como botones con su estado de elegida; el campo del valor se anuncia como "Monto en pesos" y el de la nota como "Nota"; los avisos de error, como alerta.
- **Y** lo pagado se anuncia en una sola frase con su cifra ("Este mes has pagado, $ 100.000"), y cada fila de pago como una frase ("Pago de tarjeta, $ 100.000, 15 de noviembre de 2026, Transferencia").

### CA-RF32-F43 — Los textos son cotidianos y sin datos crudos

- **Dado** cualquier estado de lo nuevo (hoja, confirmación, avisos, bloque de lo pagado, lista, diálogo y Movimientos)
- **Cuando** el usuario lee su texto
- **Entonces** no contiene términos técnicos ni contables ("PAGO_TARJETA", "ABONO_DEUDA", "clasificacionFlujo", "comparacion", "diferencia", "metodoPago", "EFECTIVO", "DEBITO", "TRANSFERENCIA", "idempotencia", "payload", "409", "422", "404", "NaN", "undefined", "null"): habla de "pago", "has pagado", "te falta pagar", "pagaste de más", "estimado", "internet" y "servidor", y nunca muestra los mensajes del backend ("Pago no encontrado", "Tarjeta no encontrada").
- **Y** no muestra "Marcar como pagada", "Próximo pago", "Vence", "Cupo disponible" ni "Deuda total" (CA-RF30-F33 sigue vigente).

---

# Contrato del adaptador (`lib/api/tarjetas.ts`, pagos)

### CA-RF32-F44 — `registrarPago` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `registrarPago('66a0b3c4d5e6f70012ab34cd', { valor: 100000, fecha: '2026-11-19', metodoPago: 'EFECTIVO', descripcion: 'Cuota' }, clave)`
- **Entonces** se hace `POST /tarjetas/66a0b3c4d5e6f70012ab34cd/pagos` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo esos cuatro campos (la clave y el id de la tarjeta no van dentro) y no pone `X-Zona-Horaria` a mano (solo viaja la que ya envía el cliente compartido).
- **Y** con solo `{ valor: 100000 }` el cuerpo lleva solo `valor` (los demás campos no se envían ni como `null`).
- **Y** entrega el pago que responde el `201` tal cual: `id`, `tarjetaId`, `valor`, `fecha`, `metodoPago`, `descripcion`, `creadaEn` y `comparacion` (`mes`, `estimado`, `pagado`, `diferencia`) con los decimales intactos.

### CA-RF32-F45 — `listarPagos` pide los pagos de un mes y entrega la lista

- **Dado** una sesión vigente
- **Cuando** se llama a `listarPagos('66a0b3c4d5e6f70012ab34cd', '2026-11')` y a `listarPagos('66a0b3c4d5e6f70012ab34cd')`
- **Entonces** se hace `GET /tarjetas/66a0…/pagos?mes=2026-11` y `GET /tarjetas/66a0…/pagos` (sin parámetros), con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key`.
- **Y** entrega el arreglo que viene en `items`, con cada pago y el orden recibidos y sin `comparacion`; con `{ items: [] }` entrega `[]`.

### CA-RF32-F46 — `eliminarPago` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `eliminarPago('66a0b3c4d5e6f70012ab34cd', 'pago-3')`
- **Entonces** se hace `DELETE /tarjetas/66a0b3c4d5e6f70012ab34cd/pagos/pago-3` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key`, y con el `204` la función termina sin devolver nada.

### CA-RF32-F47 — `obtenerProyeccion` entrega también `pagado` y `diferencia`

- **Dado** que el backend responde `200` con la proyección y, en el nivel superior, `pagado` 100000 y `diferencia` -246270,05016469
- **Cuando** `obtenerProyeccion` termina
- **Entonces** entrega esos dos campos tal como llegaron (sin redondear ni recalcular) junto con todos los de CA-RF30-F35; las filas de `proyeccion` no los traen y no se les agrega nada.

### CA-RF32-F48 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error a `registrarPago`, `listarPagos` o `eliminarPago`
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `404` llega como `ApiError` con su código y el mensaje del backend ("Tarjeta no encontrada" o "Pago no encontrado"), sin cerrar la sesión; un `409`, un `422` y un `500` llegan como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

# Efecto en los criterios y las pruebas existentes (aprobado)

Estos criterios agregan cosas a lo que ya estaba aprobado. Las pruebas afectadas están en `__tests__/detalle-tarjeta-*.test.tsx`, `__tests__/movimientos-dinero-recibido.test.tsx` y `__tests__/api-proyeccion-tarjeta.test.ts`, y las ayudas en `__tests__/ayudas/detalle-tarjeta.tsx`; deberán ajustarse en modo pruebas, con aprobación del desarrollador y antes del commit `test:` de este paquete.

**Criterios que cambian:**
- **CA-RF30-F04** ("no se piden otras cosas"): ahora también se pide `listarPagos` del mes (CA-RF32-F30). Pruebas: `detalle-tarjeta-pantalla.test.tsx` (los cuatro `it` de F04, en especial el segundo, que comprueba que no se pide nada más).
- **CA-RF30-F07, F20 y F28** (cambiar de mes, reintentar, volver a la pantalla): `listarPagos` se pide también en esos casos, con el mismo mes. Pruebas: `detalle-tarjeta-meses.test.tsx`, `detalle-tarjeta-estados.test.tsx`.
- **CA-RF30-F17** (el aviso de "sin pagos pendientes"): solo sale si `pagado` es 0 (CA-RF32-F27). Pruebas: `detalle-tarjeta-estados.test.tsx` (los dos `it` de F17 siguen valiendo con `pagado` 0).
- **CA-RF30-F35** (el adaptador entrega la proyección tal cual): ahora con `pagado` y `diferencia` (CA-RF32-F47). Prueba: `api-proyeccion-tarjeta.test.ts`.
- **CA-RF28-F15** (dinero recibido de solo lectura): la regla se amplía a toda clasificación distinta de `ORDINARIO` (CA-RF32-F40 y F41). Pruebas: `movimientos-dinero-recibido.test.tsx` siguen valiendo sin cambios.

**Ayudas y mocks:** las respuestas simuladas de `obtenerProyeccion` deben llevar `pagado` y `diferencia` (en cero y `-total` si el caso no habla de pagos), y los `jest.mock('@/lib/api/tarjetas')` del detalle deben incluir `listarPagos` (que entrega un arreglo, `[]` si no hay pagos), `registrarPago` y `eliminarPago`; si no, las pruebas actuales del detalle fallarían por una función que el mock no tiene.

**Ajustes hechos en las pruebas existentes (modo pruebas en rojo, 5.3.4):**
- Los `jest.mock('@/lib/api/tarjetas')` de los diez archivos que dibujan el detalle (`detalle-tarjeta-*`, `tarjetas-eliminar`, `tarjetas-formulario`, `tarjetas-guardar`, `tarjetas-lista`) suman `listarPagos`, `registrarPago` y `eliminarPago`; la ayuda `servirDetalle` deja `listarPagos` entregando `[]` y `proyeccionDe` agrega `pagado` y `diferencia` (en 0 y `pagado - total` si el caso no habla de pagos).
- CA-RF30-F04, F07, F20 y F28: las pruebas suman `listarPagos` con el mismo mes; en F20, "Reintentar" repite solo lo que falló, así que `listarPagos` no se vuelve a pedir si lo que falló fue la proyección o la tarjeta (CA-RF32-F33).
- CA-RF30-F13 (`detalle-tarjeta-resumen`, el total 0,4): con "$ 0" como total, "Este mes has pagado" también dice "$ 0", así que la prueba acepta las dos apariciones.
- CA-RF30-F35 (`api-proyeccion-tarjeta`): la respuesta simulada lleva `pagado` y `diferencia` y se suma CA-RF32-F47. Esa prueba ya pasa hoy: el adaptador entrega la respuesta tal cual; lo que falta es el tipo.

**Sin cambio:** CA-RF30-F01 a F03, F05, F06, F08 a F16, F18, F19, F21 a F27, F29 a F32 y F34 a F37 (el botón nuevo se suma a F30 sin cambiarla), y todo `05-tarjetas-pantallas.md` y `05-compra-con-tarjeta.md`. Eliminar una tarjeta con pagos sigue dando `409` (ya lo explica "Esta tarjeta ya tiene compras o pagos registrados y no se puede eliminar."): para poder eliminarla, el usuario elimina primero sus pagos desde el detalle.

---

## Resumen

- Criterios: 48 (`CA-RF32-F01` a `F48`). **Registrar un pago** 24: entrada y hoja 8 (F01 a F08), validación 1 (F09), guardar 3 (F10 a F12), lo que se ve al guardar 6 (F13 a F18), errores al guardar 4 (F19 a F22), clave nueva y sesión 2 (F23, F24). **Lo pagado frente a lo estimado en el detalle** 5 (F25 a F29). **Pagos del mes en el detalle** 9: lista 4 (F30 a F33), eliminar 5 (F34 a F38). **Movimientos** 3 (F39 a F41). **Accesibilidad y lenguaje** 2 (F42, F43). **Adaptador** 5 (F44 a F48).
- Código nuevo que piden: `registrarPago`, `listarPagos`, `eliminarPago` y los tipos de pago en `lib/api/tarjetas.ts`; `pagado` y `diferencia` en `ProyeccionTarjeta`; `clasificacionFlujo` ampliado en `lib/api/transacciones.ts`; en el detalle de la tarjeta, el botón "Registrar un pago", la hoja "Nuevo pago" con su confirmación, el bloque de lo pagado, la lista de pagos con su diálogo de eliminar; en Movimientos, el subtítulo "Pago de tarjeta · Método" y la regla de solo lectura para toda clasificación distinta de `ORDINARIO`.
- Decisiones: D1 a D11, resueltas y aprobadas el 2026-11-20 (ver la lista de arriba).
