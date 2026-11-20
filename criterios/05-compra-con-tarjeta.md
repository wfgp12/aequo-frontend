# Criterios de aceptación — 5. Tarjetas de crédito: compra con tarjeta y avance en efectivo (paquete 5.2.4)

Estado: Aprobado

Cubre RF-26 (registrar una compra con tarjeta, a cuotas), RF-27 (cuota estimada y mes del último pago antes de guardar) y RF-28 (avance en efectivo) en el frontend. El criterio de la EDT es: "El resumen previo a guardar muestra la cuota estimada y el mes del último pago." El desarrollador decidió que la pantalla del **avance en efectivo** entra dentro de este paquete. El backend ya tiene las rutas de compras y avances (5.2.3) y la vista previa de la cuota (5.2.6). Aquí solo se verifica qué ve el usuario, qué se envía y cómo se explican los errores. **Ningún cálculo se hace en el frontend (RNF-11):** la cuota y el mes del último pago salen solo de `GET /tarjetas/:tarjetaId/cuota` (y, ya guardada, de la respuesta del `POST`); la pantalla solo redondea la cuota al peso al mostrarla.

**Fuentes:** Especificación de Requisitos (RF-26, RF-27, RF-28), CLAUDE.md (paso a paso del registro; el flujo con tarjeta pide tarjeta, cuotas y mes del primer pago y muestra la cuota estimada en el resumen; "se guarda como compra con tarjeta, no como transacción"; RNF-02, RNF-04, RNF-06, RNF-11; modo claro y oscuro), contratos `compras.md` y `cuota-previa.md` (en `coordinacion/contratos/`), criterios del backend `05-tarjetas.md` (paquetes 5.2.3 y 5.2.6, solo para escenarios y mensajes de error), criterios del frontend ya aprobados (`02-registro*.md`, `05-tarjetas-pantallas.md`) y Figma sección 06 · Tarjetas de crédito, frames móviles (360 px), **solo con el texto leído**:
- "Registro — Tarjeta: elegir tarjeta": título "Tarjeta de crédito", pregunta "¿Con cuál tarjeta fue?", una opción por tarjeta con su nombre y debajo "Disponible $ 2.300.000", la opción "+ Agregar tarjeta" y, al pie, "Atrás".
- "Registro — Tarjeta: cuotas": título "Tarjeta de crédito", subtítulo "Visa Bancolombia · interés 24% E.A.", pregunta "¿Cuántas cuotas?" con 1, 3, 6, 12 y "Otra", el texto "1 cuota: pago único, sin interés. Se paga el próximo ciclo después del corte.", el bloque "Cuota estimada  $ 45.000 x 6" (solo con más de 1 cuota) con la nota "Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar.", y al pie "Atrás" y "Siguiente".
- "Registro — Avance en efectivo": "¿Con cuál tarjeta necesitas el avance?", "¿Cuántas cuotas?" con 1, 3, 6, 12 y "Otra", y "Atrás". No muestra desde dónde se entra ni dónde se pide el valor.
- Colores, tamaños y tipografía, en modo claro y oscuro: **revisión visual contra Figma**, no se prueba con Jest.

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- Listar, ver, editar y eliminar compras y avances (`GET`, `PATCH` y `DELETE` de `/tarjetas/:tarjetaId/compras`): están en el contrato, pero ninguna pantalla de este paquete los usa. Sin eso, la compra guardada **no se ve en ninguna lista** por ahora (ver dudas en el reporte).
- La lista de Movimientos "con cuotas": no hay endpoint que mezcle compras y movimientos; una compra con tarjeta no es un movimiento (ADR-014).
- El detalle de la tarjeta con cuotas pendientes y "Marcar como pagada", la proyección y el total del mes (paquetes 5.3.x).
- Los cargos fijos (ya están, paquete 5.1.3) y la versión de escritorio (1280 px): el registro con tarjeta es solo móvil, igual que el resto de este flujo.
- Mostrar cupo disponible, corte o pago de la tarjeta: el backend no los guarda (decisión ya tomada en 5.1.3).

**Contrato del backend que importa aquí** (todas las rutas con sesión; `401` cierra la sesión y la app vuelve al login):
- `POST /tarjetas/:tarjetaId/compras` `{ descripcion, categoriaId, valor, cuotas, primerPago, fecha? }` con `Idempotency-Key` → `201` con la compra. `descripcion` es **obligatoria** (1 a 200); `valor` > 0; `cuotas` entero de 1 a 60; `primerPago` `YYYY-MM`; `fecha` `YYYY-MM-DD`. `404` "Tarjeta no encontrada" o "Categoría no encontrada"; `400` (incluye una categoría de ingreso y campos de más); `409` (misma clave todavía en proceso); `422` (misma clave con otro cuerpo).
- `POST /tarjetas/:tarjetaId/avances` `{ valor, cuotas, primerPago, fecha?, descripcion? }` con `Idempotency-Key` → `201` con la compra de `tipo` `AVANCE`. **Sin categoría** (enviarla es `400`); `descripcion` opcional (el servidor usa "Avance en efectivo"). Crea además un movimiento de ingreso `DINERO_RECIBIDO` (efectivo, con la tarjeta) que **no** cuenta como ingreso propio y no se edita ni elimina desde `/transacciones` (`409`). Es todo o nada: si falla una parte responde `500` y no queda nada a medias; la misma clave se puede reintentar.
- Forma de la compra (también la del avance): `{ id, tarjetaId, categoriaId, tipo, descripcion, valor, cuotas, fecha, primerPago, mesUltimoPago, tasaEAAplicada, cuotaUnicaSinInteres, cuota, creadaEn, actualizadaEn }`; `cuota` viene **sin redondear**.
- `GET /tarjetas/:tarjetaId/cuota?valor&cuotas&primerPago` → `200 { cuota, mesUltimoPago, tasaEAAplicada, cuotaUnicaSinInteres }` (`cuota` sin redondear; `mesUltimoPago` `YYYY-MM`). Sin efectos, sin `Idempotency-Key`. `400`, `401`, `404` "Tarjeta no encontrada". Sirve para compras y avances. Con una cuota y `cuotaUnicaSinInteres` verdadera la cuota es el valor; con una cuota y la bandera falsa **lleva interés**.
- `DELETE /tarjetas/:id` con compras o avances → `409` (cambio que se refleja en CA-RF24-F44, ver la sección final).

**Interfaz pública** (queda aprobada con estos criterios):
- El registro sigue entrando por `/registrar?tipo=EGRESO` (los dos botones "Registrar ingreso" y "Registrar egreso" no cambian). "Tarjeta crédito" solo existe en el egreso.
- Pantalla nueva del avance: ruta `/avance-en-efectivo`, protegida por sesión (`Stack.Protected` en `app/_layout.tsx`). Se llega con un botón "Avance en efectivo" en "Mis tarjetas" (CA-RF28-F01).
- Adaptador, en `lib/api/tarjetas.ts` (sobre `requestAutenticado`): `registrarCompra(tarjetaId, datos, claveIdempotencia)`, `registrarAvance(tarjetaId, datos, claveIdempotencia)` y `obtenerCuotaPrevia(tarjetaId, { valor, cuotas, primerPago })`, con los tipos `CompraCredito`, `DatosCompra`, `DatosAvance`, `ConsultaCuota` y `CuotaPrevia` (ver "Contrato del adaptador").
- Se reutilizan: `useTarjetas`, `HojaTarjeta` ("Nueva tarjeta"), `textoDeTasa`, `PasoValor`/`PasoFecha`/`PasoDescripcion` del registro, `formatearPesos`, `nombreDelMes`, `ApiError`, `NetworkError` y `ERROR_RED`.

**Sobre los IDs:** los `CA-RF26-nn`, `CA-RF27-nn` y `CA-RF28-nn` ya los usa el backend para su lado (otro repositorio). Para no confundirlos, estos llevan la letra F, como hizo `05-tarjetas-pantallas.md`. Bajo `CA-RF26-F` va todo lo de **la compra en el registro** (incluido el adaptador de guardar); bajo `CA-RF27-F`, la **vista previa de la cuota** (el adaptador, el paso de cuotas y el resumen); bajo `CA-RF28-F`, el **avance en efectivo**.

**Convención de las pruebas:** el backend se simula en el borde del adaptador (`jest.mock('@/lib/api/tarjetas')`, `jest.mock('@/lib/api/categorias')` y `jest.mock('@/lib/api/transacciones')`, este último para comprobar que **no** se llama a `crearTransaccion`) en las pruebas de pantallas, y `fetch` en las del adaptador. La espera de 400 ms de la vista previa se prueba con relojes simulados de Jest y la fecha fija 2026-11-19. La clave de idempotencia nace en el flujo (UUID de `expo-crypto`), no en el adaptador, igual que en el registro de movimientos (CA-RF06-15 a CA-RF06-20) y en las tarjetas. Los ejemplos usan: la tarjeta "Amex" (`tasaEA` 0,2421, `cuotaUnicaSinInteres` verdadera) y la tarjeta "Visa Bancolombia" (`tasaEA` 0,2921, falsa), en ese orden; la categoría "Alimentación" (id `cat-1`) y una compra de $ 1.254.700.

**Decisiones por aprobar, agrupadas por bloque** (cada "> Decisión" de abajo lleva su letra; se pueden aprobar por bloque):
- **A. Pasos y encabezado** (A1 a A3).
- **B. Elegir la tarjeta** (B1 a B3).
- **C. Cuotas y mes del primer pago** (C1 a C4).
- **D. Vista previa de la cuota y resumen** (D1 a D5).
- **E. Guardar la compra** (E1 a E4).
- **F. Avance en efectivo** (F1 a F6).
- **G. Efecto en otras pantallas** (G1 a G3, en la sección final).

---

# Compra con tarjeta en el registro (`CA-RF26-F`)

Se llega desde "Registrar egreso", en el paso "¿Cómo pagaste?", al tocar "Tarjeta crédito". Los pasos nuevos son dos: elegir tarjeta y cuotas.

## Entrada y encabezado

### CA-RF26-F01 — "Tarjeta crédito" lleva a elegir la tarjeta, sin aviso

- **Dado** el registro de un egreso en el paso "¿Cómo pagaste?" (valor y categoría ya elegidos)
- **Cuando** el usuario toca "Tarjeta crédito"
- **Entonces** ve la pregunta "¿Con cuál tarjeta fue?" y ya no ve el aviso "…se podrán registrar muy pronto…" (ni ningún otro aviso); el paso de fecha todavía no aparece y no se llama a `crearTransaccion`.

> Decisión (A1): este paquete reemplaza el aviso `AVISO_TARJETA_DE_CREDITO` del registro. Sustituye los criterios y pruebas del aviso (ver la sección final).

### CA-RF26-F02 — Los dos pasos de tarjeta cuentan como el paso 3 de 5

- **Dado** el registro de un egreso con tarjeta
- **Cuando** el usuario está en "¿Con cuál tarjeta fue?" y en "¿Cuántas cuotas?"
- **Entonces** en ambos ve el título "Tarjeta de crédito" y "3 de 5"; en la fecha ve "Nuevo egreso" y "4 de 5"; en la nota y el resumen, "5 de 5".

> Decisión (A2): el diseño dibuja los pasos de tarjeta con el título "Tarjeta de crédito" (no "Nuevo egreso") y la barra de cinco tramos no cambia: tarjeta y cuotas son la continuación del método de pago, no pasos extra.

### CA-RF26-F03 — El orden es: valor, categoría, método, tarjeta, cuotas, fecha, nota y resumen

- **Dado** un egreso con valor y categoría elegidos y "Tarjeta crédito" como método
- **Cuando** el usuario avanza por el flujo
- **Entonces** pasa por: elegir tarjeta, cuotas y mes del primer pago, fecha ("¿Cuándo fue?"), nota opcional y resumen; no se le vuelve a preguntar el método.
- **Y** con otro método (efectivo, débito o transferencia) el registro sigue igual que antes: no se pide tarjeta ni cuotas, no se llama a `listarTarjetas` ni a `obtenerCuotaPrevia`, y al guardar se llama a `crearTransaccion` (no a `registrarCompra`).
- **Y** en un ingreso no existe "Tarjeta crédito".

> Decisión (A3): el orden es el que pidió el desarrollador. La fecha viene después de las cuotas; por eso el mes inicial del primer pago sale de hoy (CA-RF26-F14).

## Elegir la tarjeta

### CA-RF26-F04 — Al llegar se piden las tarjetas, una vez, y mientras tanto solo el indicador

- **Dado** que el backend aún no responde a `listarTarjetas` (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario llega a "¿Con cuál tarjeta fue?"
- **Entonces** `listarTarjetas()` se llama una sola vez, ve el título "Tarjeta de crédito" y un indicador de carga ("Cargando tus tarjetas"; sin la lista, ni "+ Agregar tarjeta", ni avisos), y el botón "Atrás" sigue disponible.

### CA-RF26-F05 — Si no se pueden cargar, avisa y permite reintentar

- **Dado** que `listarTarjetas` falla
- **Cuando** termina la consulta
- **Entonces** con `500` ve "No pudimos cargar tus tarjetas. Inténtalo de nuevo en unos minutos."; sin conexión ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."; en ambos casos con un botón "Reintentar" (al tocarlo vuelve el indicador y se consulta de nuevo) y sin lista de tarjetas.
- **Y** con `401` la sesión se cierra y la app vuelve al inicio de sesión, sin aviso propio.

> Decisión (B1): mismos textos que en "Mis tarjetas" (CA-RF24-F06 y F07).

### CA-RF26-F06 — Sin tarjetas: invita a agregar la primera

- **Dado** que el backend responde `{ items: [] }`
- **Cuando** termina de cargar
- **Entonces** ve "Todavía no tienes tarjetas. Agrega la primera para continuar." y el botón "+ Agregar tarjeta"; no ve filas ni avisos de error.

> Decisión (B2): texto propuesto (RNF-04); el Figma solo trae el caso con tarjetas.

### CA-RF26-F07 — Con tarjetas: una opción por tarjeta, con su nombre y su tasa

- **Dado** que el backend responde con "Amex" (0,2421) y "Visa Bancolombia" (0,2921), en ese orden
- **Cuando** termina de cargar
- **Entonces** ve "¿Con cuál tarjeta fue?" y una opción por tarjeta, en el orden recibido: "Amex" con "Tasa 24,21 % E.A." y "Visa Bancolombia" con "Tasa 29,21 % E.A.", y al final "+ Agregar tarjeta" y el botón "Atrás".
- **Y** no ve "Disponible", ni cupo, corte ni pago.

> Decisión (B1, ya tomada en 5.1.3): el Figma muestra "Disponible $ 2.300.000" bajo cada tarjeta, pero el backend no guarda cupo; se muestra la tasa, igual que en "Mis tarjetas" (CA-RF24-F10). La pantalla no reordena.

### CA-RF26-F08 — Tocar una tarjeta avanza a las cuotas

- **Dado** la lista de tarjetas
- **Cuando** el usuario toca "Visa Bancolombia"
- **Entonces** avanza al paso de cuotas (CA-RF26-F11) con esa tarjeta elegida, sin pedir nada más al backend en ese momento (la vista previa es la de CA-RF27-F03).

### CA-RF26-F09 — "+ Agregar tarjeta" crea una tarjeta sin perder lo que lleva el registro

- **Dado** el paso de elegir tarjeta (con o sin tarjetas), con el valor y la categoría ya elegidos
- **Cuando** el usuario toca "+ Agregar tarjeta"
- **Entonces** se abre la misma hoja "Nueva tarjeta" de "Mis tarjetas" (con "Alias", "Tasa de interés E.A." y "Compras a 1 cuota sin intereses", CA-RF24-F12 y F14), sin salir del registro.
- **Y** al crearla, la hoja se cierra, se vuelve a pedir la lista y la tarjeta nueva aparece como una opción más; el usuario sigue en "¿Con cuál tarjeta fue?" (no avanza solo) y conserva el valor y la categoría.
- **Y** al tocar "Volver" en la hoja, se cierra sin crear nada y el paso queda igual.

> Decisión (B3): se reutiliza la hoja existente en lugar de ir a "Mis tarjetas" (que haría perder el registro en curso). Alternativa: llevar a `/tarjetas`. Tras crear, el usuario toca la tarjeta; no se elige sola.

### CA-RF26-F10 — "Atrás" vuelve al método de pago y conserva lo elegido

- **Dado** el paso de elegir tarjeta (o el de cuotas)
- **Cuando** el usuario toca "Atrás"
- **Entonces** vuelve al paso anterior ("¿Cómo pagaste?", o la tarjeta desde las cuotas) con el valor, la categoría y lo ya elegido conservados, y no se envía nada al backend.

## Cuotas y mes del primer pago

### CA-RF26-F11 — Qué contiene el paso de cuotas

- **Dado** que el usuario eligió "Visa Bancolombia"
- **Cuando** ve el paso de cuotas
- **Entonces** ve el título "Tarjeta de crédito", el subtítulo "Visa Bancolombia · Tasa 29,21 % E.A.", la pregunta "¿Cuántas cuotas?" con las opciones 1, 3, 6, 12 y "Otra" (con "1" ya elegida), la pregunta "¿En qué mes pagas la primera cuota?" con el mes elegido (CA-RF26-F14), y los botones "Atrás" y "Siguiente".

> Decisión (C1): "1" queda elegida al entrar, así "Siguiente" no queda inerte y coincide con el diseño, que explica la cuota única. El subtítulo usa "Tasa 29,21 % E.A." como la lista, no "interés 24% E.A." del Figma, para decir lo mismo en toda la app.

### CA-RF26-F12 — Elegir 3, 6 o 12 cuotas

- **Dado** el paso de cuotas con "1" elegida
- **Cuando** el usuario toca "6"
- **Entonces** "6" queda como la opción elegida (y "1" deja de estarlo); lo mismo con "3" y "12".

### CA-RF26-F13 — "Otra" pide un número de cuotas de 1 a 60

- **Dado** el paso de cuotas
- **Cuando** el usuario toca "Otra"
- **Entonces** "Otra" queda elegida, aparece un campo "Número de cuotas" vacío con el teclado numérico, y "Siguiente" queda deshabilitado mientras esté vacío; no se pide ninguna cuota estimada hasta que haya un número válido.
- **Y** el campo solo acepta dígitos (al escribir "2a4" queda "24") y como máximo dos; con "24" se pide la cuota de 24 cuotas.
- **Y** con "0", "61" o más ve el aviso "Las cuotas van de 1 a 60." y "Siguiente" queda deshabilitado; con "1" y con "60" son válidos.
- **Y** si toca de nuevo una de las opciones fijas (por ejemplo "12"), "12" queda elegida y el campo se oculta.

> Decisión (C2): el rango sale del contrato (`cuotas` de 1 a 60). El campo vacío no muestra aviso (solo deja "Siguiente" apagado). Se propone la etiqueta "Número de cuotas".

### CA-RF26-F14 — El mes del primer pago empieza en el mes de hoy y se mueve con ‹ y ›

- **Dado** el paso de cuotas, hoy 19 de noviembre de 2026
- **Cuando** el usuario lo abre
- **Entonces** el selector dice "noviembre 2026" (en minúscula, como el de Reportes); al tocar "Mes siguiente" dice "diciembre 2026" y al tocar "Mes anterior" vuelve a "noviembre 2026".
- **Y** puede ir hacia atrás y hacia adelante sin tope (el backend no lo limita), y cruza el año: desde "diciembre 2026", "Mes siguiente" dice "enero 2027".
- **Y** al elegir la fecha de la compra más adelante (por ejemplo, ayer o una fecha de otro mes) el mes elegido **no cambia solo**; al volver con "Atrás" encuentra el mismo mes.
- **Y** lo que se envía es el mes como texto `YYYY-MM` ("2026-12").

> Decisión (C3): el Figma de cuotas no trae selector de mes y el contrato exige `primerPago`. Se propone un selector como el de Reportes. Valor inicial: el mes de hoy (la fecha de la compra todavía no se eligió: se pregunta después, y por defecto es hoy). Alternativa: empezar en el mes siguiente (el Figma habla de "el próximo ciclo después del corte", pero el backend no guarda el corte).

## Fecha y nota

### CA-RF26-F15 — La fecha y la nota funcionan como en cualquier egreso

- **Dado** el paso de cuotas con una cuota estimada a la vista (CA-RF27-F16)
- **Cuando** el usuario toca "Siguiente"
- **Entonces** ve "¿Cuándo fue?" con "Hoy" elegida y las opciones "Ayer" y "Otra fecha" (el mismo paso de siempre) y, al seguir, la nota opcional con el resumen (CA-RF27-F17).
- **Y** "Atrás" en la fecha vuelve al paso de cuotas con las cuotas y el mes conservados.

## Guardar la compra

### CA-RF26-F16 — Guardar envía la compra con tarjeta, no un movimiento

- **Dado** el resumen de un egreso de $ 1.254.700 en "Alimentación", con "Visa Bancolombia" (`id` `66a0b3c4d5e6f70012ab34cd`), 12 cuotas, primer pago en diciembre 2026, fecha de hoy (2026-11-19) y la nota vacía
- **Cuando** el usuario toca "Guardar"
- **Entonces** se llama a `registrarCompra('66a0b3c4d5e6f70012ab34cd', { descripcion: 'Alimentación', categoriaId: 'cat-1', valor: 1254700, cuotas: 12, primerPago: '2026-12', fecha: '2026-11-19' }, clave)` una sola vez, con una `clave` en formato UUID.
- **Y** el cuerpo no lleva `tipo`, `tasaEAAplicada`, `cuotaUnicaSinInteres`, `cuota`, `mesUltimoPago` ni ningún otro campo; `valor` y `cuotas` son números; y **no** se llama a `crearTransaccion`.
- **Y** con otra fecha elegida (por ejemplo ayer), `fecha` lleva esa fecha en `YYYY-MM-DD`.

> Decisión (E2): `fecha` siempre va (como en `POST /transacciones`), aunque sea hoy.

### CA-RF26-F17 — Sin nota, la descripción es la categoría; con nota, la nota

- **Dado** el resumen de una compra en "Alimentación"
- **Cuando** el usuario guarda con la nota vacía (o solo con espacios)
- **Entonces** `descripcion` es "Alimentación".
- **Y** si escribió "  Nevera nueva  ", `descripcion` es "Nevera nueva" (sin los espacios de los extremos); la nota admite hasta 200 caracteres, como en un movimiento.

> Decisión (E1): el contrato exige `descripcion` (1 a 200) y la nota del registro es opcional; se propone usar el nombre de la categoría, igual que el título de un movimiento sin nota (CA-RF06-02). El resumen no muestra la descripción.

### CA-RF26-F18 — Al guardar, ve que quedó registrada y puede cerrar

- **Dado** que el backend responde `201` con la compra (12 cuotas, `cuota` 119802,1331718775)
- **Cuando** el usuario ve el resultado
- **Entonces** ve "¡Listo!" y "Registramos tu compra de $ 1.254.700 en Alimentación con Visa Bancolombia, a 12 cuotas de $ 119.802." (la cuota, redondeada al peso, es la de la **respuesta del guardado**, no la de la vista previa) y el botón "Listo", que cierra el registro.
- **Y** con 1 cuota dice "…, en 1 cuota de $ 80.000." (singular).
- **Y** no se llama a `crearTransaccion` ni se vuelve a llamar a `obtenerCuotaPrevia`.

> Decisión (E4): texto propuesto, calcado de la confirmación del registro. Ver duda sobre que la compra no se ve en ninguna lista todavía (E5).

### CA-RF26-F19 — Mientras guarda ve un indicador y no se puede tocar de nuevo

- **Dado** que el backend aún no responde al guardado (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario espera, o toca "Guardar" dos veces seguidas
- **Entonces** "Guardar" muestra un indicador de carga en lugar de su texto, "Guardar" y "Atrás" no se pueden tocar y `registrarCompra` se llama **una sola vez**, con una sola clave.

### CA-RF26-F20 — Sin conexión: avisa, conserva todo y reintenta con la misma clave

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." en el resumen, con todo lo elegido intacto y "Guardar" disponible.
- **Y** al volver a tocarlo sin cambiar nada, la nueva llamada a `registrarCompra` lleva **la misma clave** y el mismo cuerpo, y el aviso desaparece al lograr guardar.

### CA-RF26-F21 — Otro fallo (400, 422 o 500): mensaje general y la misma clave

- **Dado** que el backend responde `400`, `422` o `500` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar tu compra. Revisa los datos e inténtalo de nuevo.", sin términos técnicos ni los mensajes del backend, con el resumen intacto.
- **Y** al volver a tocar "Guardar" sin cambiar nada, la solicitud lleva la misma clave.

> Decisión (E3): textos propuestos (RNF-04), calcados de "No pudimos guardar tu movimiento…".

### CA-RF26-F22 — Si todavía se está procesando (409), espera y reintenta con la misma clave

- **Dado** que el backend responde `409` porque la primera solicitud con esa clave sigue en proceso
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Tu compra todavía se está guardando. Espera unos segundos e inténtalo de nuevo." (no el de datos incorrectos), "Guardar" vuelve a estar disponible y, al tocarlo, la solicitud lleva la misma clave.

### CA-RF26-F23 — La tarjeta o la categoría ya no existen (404)

- **Dado** que el backend responde `404` con "Tarjeta no encontrada"
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Esta tarjeta ya no existe. Vuelve atrás y elige otra." y el resumen sigue con lo elegido.
- **Y** con `404` "Categoría no encontrada" ve "Esta categoría ya no existe. Vuelve atrás y elige otra."; con cualquier otro `404` ve el mensaje general de CA-RF26-F21.

> Decisión (E3): se distingue por el mensaje fijo del backend (`Tarjeta no encontrada`, `Categoría no encontrada`, contrato de compras).

### CA-RF26-F24 — Cambiar algo tras un fallo es una acción nueva; una compra nueva, otra clave

- **Dado** que el primer "Guardar" falló
- **Cuando** el usuario vuelve atrás, cambia algo (otra tarjeta, las cuotas, el mes, la fecha, la categoría, el valor o la nota) y vuelve a guardar
- **Entonces** la nueva llamada a `registrarCompra` lleva una clave **distinta** y el cuerpo nuevo (el backend respondería `422` si se reutilizara la clave con otro cuerpo).
- **Y** si más tarde registra otra compra (después de guardar o de cerrar y volver a entrar), aunque los datos sean idénticos, la clave es distinta: dos compras iguales seguidas son legítimas.

### CA-RF26-F25 — Sesión vencida al guardar (401)

- **Dado** que el backend responde `401` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; el resumen no muestra un aviso de error propio.

### CA-RF26-F26 — Lenguaje cotidiano y accesibilidad (RNF-04, RNF-06)

- **Dado** los pasos de tarjeta, cuotas y resumen, y todos sus avisos
- **Cuando** el usuario los lee
- **Entonces** no contienen términos técnicos ni contables ("tasaEA", "cuotaUnicaSinInteres", "primerPago", "mesUltimoPago", "idempotencia", "payload", "409", "TARJETA_CREDITO", "amortización"); hablan de "tarjeta", "cuotas", "cuota estimada", "primer pago", "último pago", "internet" y "servidor". ("E.A." aparece solo porque lo usa el diseño.)
- **Y** cada opción de tarjeta se anuncia como un botón con su nombre y su tasa juntos ("Visa Bancolombia, Tasa 29,21 % E.A."); las opciones de cuotas se anuncian como "1 cuota", "3 cuotas", "6 cuotas", "12 cuotas" y "Otra", con su estado de elegida; el campo se anuncia como "Número de cuotas"; el selector del mes, con "Mes anterior" y "Mes siguiente"; los avisos de error, como alerta.

## Contrato del adaptador (`lib/api/tarjetas.ts`, guardar compras)

### CA-RF26-F27 — `registrarCompra` envía la petición según el contrato

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `registrarCompra('66a0…', { descripcion, categoriaId, valor, cuotas, primerPago, fecha }, clave)`
- **Entonces** se hace `POST /tarjetas/66a0…/compras` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo esos seis campos (la clave y el id de la tarjeta no van dentro) y la función entrega la compra que responde el `201` tal cual (con `cuota` sin redondear, `mesUltimoPago`, `tasaEAAplicada`, `cuotaUnicaSinInteres`, `tipo`).

### CA-RF26-F28 — El adaptador distingue los errores del backend (compras y avances)

- **Dado** que el backend responde con un error a `registrarCompra`, `registrarAvance` u `obtenerCuotaPrevia`
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `404` (por ejemplo "Tarjeta no encontrada") y un `409` llegan como `ApiError` con su código y el mensaje del backend, sin cerrar la sesión; un `422` o un `500` llegan como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

# Cuota estimada y mes del último pago antes de guardar (`CA-RF27-F`)

La cuota y el mes del último pago **no se calculan en el frontend**: se piden al backend con `obtenerCuotaPrevia` al estar en el paso de cuotas (compra o avance) y se muestran. Aquí se prueba qué se pide y cuándo, qué ve el usuario mientras tanto y si falla, y que el resumen muestre lo que el backend respondió. Estos criterios valen igual para la compra y para el avance (RF-28).

## Contrato del adaptador (`lib/api/tarjetas.ts`, vista previa)

### CA-RF27-F01 — `obtenerCuotaPrevia` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `obtenerCuotaPrevia('66a0…', { valor: 1254700, cuotas: 12, primerPago: '2026-12' })`
- **Entonces** se hace `GET /tarjetas/66a0…/cuota?valor=1254700&cuotas=12&primerPago=2026-12` con `Authorization: Bearer …`, sin cuerpo y **sin** `Idempotency-Key`; los tres parámetros van en la consulta (ninguno más) y la función entrega `{ cuota, mesUltimoPago, tasaEAAplicada, cuotaUnicaSinInteres }` tal como llegó: con `cuota` 119802,1331718775 sin redondear, `mesUltimoPago` "2027-11" y la tasa como fracción (0,2921).

### CA-RF27-F02 — Errores de `obtenerCuotaPrevia`

- **Dado** que el backend responde con un error
- **Cuando** se llama a `obtenerCuotaPrevia`
- **Entonces** llegan como en CA-RF26-F28: `400`, `404` ("Tarjeta no encontrada") y `500` como `ApiError` con su código; `401` cierra la sesión; sin respuesta, `NetworkError`.

## Cuándo se pide la cuota

### CA-RF27-F03 — Al llegar al paso de cuotas se pide una vez, y no antes

- **Dado** una tarjeta recién elegida, con el valor $ 1.254.700 y hoy en noviembre de 2026
- **Cuando** el usuario llega al paso de cuotas
- **Entonces** se llama una sola vez a `obtenerCuotaPrevia(<id de la tarjeta>, { valor: 1254700, cuotas: 1, primerPago: '2026-11' })`.
- **Y** antes de ese paso (método de pago, elegir tarjeta) no se llama nunca.

> Decisión (D1): se pide siempre, también con 1 cuota (aunque la tarjeta tenga "Compras a 1 cuota sin intereses"), para que el resumen muestre siempre el mes del último pago que calcula el backend; el frontend no lo deduce ni siquiera con una cuota. A la llegada se pide enseguida; solo los cambios esperan (CA-RF27-F07).

### CA-RF27-F04 — Mientras llega la respuesta, ve que se está calculando y no puede seguir

- **Dado** que el backend aún no responde a `obtenerCuotaPrevia` (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario espera en el paso de cuotas
- **Entonces** ve un indicador de carga ("Calculando tu cuota") en el lugar del bloque "Cuota estimada", y "Siguiente" está deshabilitado; "Atrás", las opciones de cuotas y el selector del mes siguen funcionando.

> Decisión (D3): sin una estimación vigente no se avanza. Es lo más seguro: el resumen siempre muestra la cuota y el mes del último pago (el criterio de la EDT). Alternativa: dejar avanzar y guardar sin estimación (el backend calcula igual al guardar), a costa de un resumen sin esos datos.

### CA-RF27-F05 — Con la respuesta ve la cuota redondeada al peso, tal como la dio el backend

- **Dado** que el backend responde `cuota` 45000,4 para 6 cuotas
- **Cuando** llega la respuesta
- **Entonces** ve el bloque "Cuota estimada" con "$ 45.000 x 6" y la nota "Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar."; con `cuota` 119802,1331718775 y 12 cuotas ve "$ 119.802 x 12"; con 45000,6 ve "$ 45.001 x 6".
- **Y** el valor mostrado es siempre el que respondió el backend, aunque no coincida con ninguna fórmula (con valor $ 100, 3 cuotas y `cuota` 12345,6, ve "$ 12.346 x 3"): la pantalla no calcula nada (RNF-11).

### CA-RF27-F06 — Con 1 cuota: sin interés se explica; con interés se muestra la cuota

- **Dado** el paso de cuotas con "1" elegida
- **Cuando** la tarjeta es "Amex" (`cuotaUnicaSinInteres` verdadera)
- **Entonces** ve "1 cuota: pago único, sin interés." y no ve el bloque "Cuota estimada".
- **Y** cuando la tarjeta es "Visa Bancolombia" (falsa) y el backend responde `cuota` 81726,8319 para $ 80.000, no ve esa frase y sí el bloque "Cuota estimada" con "$ 81.727 x 1" y su nota (con una cuota y sin la bandera hay interés, y solo el backend sabe cuánto).
- **Y** con 3, 6, 12 u otra cantidad de cuotas ve siempre el bloque "Cuota estimada" y no la frase de pago único.

> Decisión (C4): el Figma dice "1 cuota: pago único, sin interés. Se paga el próximo ciclo después del corte." Como el backend no guarda el corte, se quita la segunda frase y la primera solo aparece si la tarjeta tiene activada la cuota única sin interés. Con una cuota y esa bandera apagada, el mismo bloque de siempre muestra el valor, con "x 1".

### CA-RF27-F07 — Al cambiar las cuotas se espera 400 ms y se pide una sola vez

- **Dado** el paso de cuotas con la primera estimación ya mostrada
- **Cuando** el usuario toca "6" y, antes de 400 ms, toca "12" (o escribe "2" y luego "4" en "Otra")
- **Entonces** durante la espera deja de ver la estimación anterior (ve "Calculando tu cuota") y no se hace ninguna consulta; pasados 400 ms desde el último cambio se llama **una sola vez** a `obtenerCuotaPrevia` con las cuotas finales (12, o 24), el mismo valor y el mismo mes.

### CA-RF27-F08 — Al cambiar el mes del primer pago se vuelve a pedir

- **Dado** el paso de cuotas con 12 cuotas y la estimación a la vista
- **Cuando** el usuario toca "Mes siguiente" (de noviembre a diciembre de 2026) y esperan 400 ms
- **Entonces** se llama a `obtenerCuotaPrevia` con `primerPago: '2026-12'` y las mismas cuotas, y el bloque muestra la respuesta nueva.

### CA-RF27-F09 — Una respuesta tardía de un dato anterior no pisa la actual

- **Dado** que el usuario cambió las cuotas de 6 a 12 mientras todavía llegaba la respuesta de la consulta de 6
- **Cuando** esa respuesta atrasada llega (antes o después de la de 12)
- **Entonces** se descarta: el bloque solo muestra la cuota de las 12 cuotas y el resumen, la de las 12 cuotas.

### CA-RF27-F10 — La estimación solo vale para los datos con que se pidió

- **Dado** el paso de cuotas con una estimación a la vista y "Siguiente" disponible
- **Cuando** el usuario cambia las cuotas o el mes del primer pago
- **Entonces** de inmediato deja de ver la estimación anterior y "Siguiente" se deshabilita hasta que llegue la nueva (no se puede avanzar con una cuota que no corresponde a lo elegido).
- **Y** al volver con "Atrás" desde pasos posteriores, o al cambiar el valor en el primer paso y volver a pasar por las cuotas, se pide de nuevo con los datos actuales.

### CA-RF27-F11 — Con "Otra" sin un número válido no se pide nada

- **Dado** el paso de cuotas con "Otra" elegida
- **Cuando** el campo está vacío, o tiene "0" o "61"
- **Entonces** no se llama a `obtenerCuotaPrevia`, no se ve ningún bloque "Cuota estimada" ni "Calculando tu cuota", y "Siguiente" está deshabilitado.

## Si la vista previa falla

### CA-RF27-F12 — Error del servidor: avisa y permite reintentar

- **Dado** que `obtenerCuotaPrevia` responde `500` (o `400`/`422`)
- **Cuando** termina la consulta
- **Entonces** en lugar del bloque ve "No pudimos calcular tu cuota. Inténtalo de nuevo." con un botón "Reintentar", y "Siguiente" está deshabilitado.
- **Y** al tocar "Reintentar" vuelve a ver "Calculando tu cuota" y se consulta de nuevo con los mismos datos; si ahora responde bien, ve el bloque y "Siguiente" vuelve a estar disponible.
- **Y** si cambia las cuotas o el mes, el aviso se va y se pide de nuevo con los datos nuevos.

> Decisión (D4): textos propuestos (RNF-04); se reintenta a mano, sin reintentos automáticos.

### CA-RF27-F13 — Sin conexión

- **Dado** que `obtenerCuotaPrevia` falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar", y "Siguiente" está deshabilitado.

### CA-RF27-F14 — La tarjeta ya no existe (404)

- **Dado** que `obtenerCuotaPrevia` responde `404` ("Tarjeta no encontrada")
- **Cuando** termina la consulta
- **Entonces** ve "Esta tarjeta ya no existe. Vuelve atrás y elige otra." **sin** botón "Reintentar" (repetirlo no ayuda), "Siguiente" está deshabilitado y "Atrás" lleva a la lista de tarjetas.

### CA-RF27-F15 — Sesión vencida (401)

- **Dado** que `obtenerCuotaPrevia` responde `401`
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; el paso no muestra un aviso de error propio.

## Pasar al resumen

### CA-RF27-F16 — "Siguiente" solo con una estimación vigente

- **Dado** el paso de cuotas con la estimación a la vista (CA-RF27-F05)
- **Cuando** el usuario toca "Siguiente"
- **Entonces** avanza a la fecha (compra) o a la fecha del avance, y no se hace ninguna consulta nueva.
- **Y** mientras no haya estimación vigente (cargando, con error, con cuotas inválidas) "Siguiente" no hace nada y no avanza.

### CA-RF27-F17 — El resumen muestra la tarjeta, las cuotas, la cuota estimada y los meses del primer y el último pago

- **Dado** una compra de $ 1.254.700 en "Alimentación" con "Visa Bancolombia", 12 cuotas, primer pago en diciembre 2026, y que el backend respondió `cuota` 119802,1331718775 y `mesUltimoPago` "2027-11"
- **Cuando** el usuario llega al resumen (paso 5 de 5)
- **Entonces** ve, además del valor "$ 1.254.700", la categoría "Alimentación", el método "Tarjeta crédito" y la fecha: la tarjeta "Visa Bancolombia", las cuotas "12 cuotas", la cuota estimada "$ 119.802", el primer pago "diciembre 2026" y el último pago "noviembre 2027".
- **Y** el último pago se muestra tal como lo respondió el backend (`mesUltimoPago`, escrito como "noviembre 2027"); la pantalla no lo deduce sumando meses.
- **Y** ve la nota "Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar."

> Decisión (D5): el Figma no dibuja el resumen con tarjeta. Se proponen las filas "Tarjeta", "Cuotas", "Cuota estimada", "Primer pago" y "Último pago" (debajo del método) y repetir la nota del Figma, que es donde el usuario revisa antes de guardar. Con una cuota la fila dice "1 cuota".

### CA-RF27-F18 — Con una cuota el resumen también muestra la cuota y el último pago

- **Dado** una compra de $ 80.000 a 1 cuota con "Amex" (sin interés), primer pago en noviembre 2026, y que el backend respondió `cuota` 80000 y `mesUltimoPago` "2026-11"
- **Cuando** el usuario llega al resumen
- **Entonces** ve "1 cuota", cuota estimada "$ 80.000", primer pago "noviembre 2026" y último pago "noviembre 2026".

### CA-RF27-F19 — Si el usuario vuelve y cambia algo, el resumen muestra la estimación nueva

- **Dado** el resumen con la cuota de 12 cuotas
- **Cuando** el usuario toca "Atrás" hasta las cuotas, elige 6, espera y avanza hasta el resumen
- **Entonces** el resumen muestra "6 cuotas" con la cuota y el último pago de la respuesta nueva; no queda nada de la estimación de 12 cuotas.

---

# Avance en efectivo (`CA-RF28-F`)

Un avance es dinero en efectivo que la persona saca con su tarjeta y paga en cuotas. No lleva categoría ni método de pago. Entra como **dinero recibido** que no cuenta como ingreso propio (ADR-014).

## Entrada y ruta

### CA-RF28-F01 — Desde "Mis tarjetas" se llega al avance

- **Dado** la pantalla "Mis tarjetas" ya cargada con al menos una tarjeta
- **Cuando** el usuario ve la lista
- **Entonces** ve, debajo de "+ Agregar tarjeta", un botón "Avance en efectivo" que lleva a `/avance-en-efectivo`.
- **Y** mientras la lista carga, si falla o si no hay tarjetas, ese botón no se ve.

> Decisión (F1): el Figma no muestra desde dónde se entra. Se propone "Mis tarjetas" porque es lo que el módulo ya tiene y cambia lo mínimo; además respeta los dos botones separados del registro (no se agrega un tercero al inicio). Alternativa: un botón "Avance en efectivo" en la vista de inicio, junto a "Registrar ingreso" y "Registrar egreso".

### CA-RF28-F02 — Solo con sesión

- **Dado** que no hay sesión (o está cerrada)
- **Cuando** se arma la navegación de la app
- **Entonces** la pantalla del avance no está disponible (la app lleva al login); con sesión activa, sí.

> Decisión (F2): ruta `/avance-en-efectivo`.

## Los pasos

### CA-RF28-F03 — Empieza por el valor

- **Dado** la pantalla del avance
- **Cuando** el usuario la abre
- **Entonces** ve el título "Avance en efectivo", "1 de 5", la pregunta "¿Cuánto dinero necesitas?", el campo del monto (pesos, solo dígitos) y "Siguiente", que está deshabilitado mientras el valor sea cero o esté vacío.
- **Y** el botón "Cerrar" (✕) vuelve a la pantalla anterior sin enviar nada.

> Decisión (F3): el valor va primero porque la cuota estimada lo necesita (el Figma no dibuja este paso). El orden es: valor, tarjeta, cuotas, fecha, nota y resumen (5 pasos, "N de 5"); no hay categoría ni método de pago. Tarjeta y cuotas se separan en dos pasos (el Figma las dibuja juntas) para reutilizar los de la compra y porque la vista previa necesita la tarjeta elegida. Texto de la pregunta (F4): propuesto, RNF-04.

### CA-RF28-F04 — Elegir la tarjeta: lo mismo que en la compra, con su propia pregunta

- **Dado** el paso 2 del avance, con el valor ya escrito
- **Cuando** el usuario llega
- **Entonces** ve "¿Con cuál tarjeta necesitas el avance?" y se comporta como CA-RF26-F04 a F10: se llama a `listarTarjetas()` una vez, indicador de carga, error con "Reintentar", vacío ("Todavía no tienes tarjetas. Agrega la primera para continuar."), una opción por tarjeta con su nombre y su tasa, "+ Agregar tarjeta" con la hoja "Nueva tarjeta", y "Atrás" (vuelve al valor, conservado). Tocar una tarjeta avanza a las cuotas.

### CA-RF28-F05 — Cuotas, mes del primer pago y cuota estimada: lo mismo que en la compra

- **Dado** el paso 3 del avance, con $ 500.000 y "Visa Bancolombia"
- **Cuando** el usuario llega
- **Entonces** ve lo mismo que en CA-RF26-F11 a F14 (título "Avance en efectivo" en lugar de "Tarjeta de crédito"; "¿Cuántas cuotas?" con 1, 3, 6, 12 y "Otra"; el mes del primer pago desde hoy) y la vista previa se comporta como CA-RF27-F03 a F16: se llama a `obtenerCuotaPrevia(<id>, { valor: 500000, cuotas: 1, primerPago: '2026-11' })`, con la espera de 400 ms al cambiar y los mismos avisos si falla.
- **Y** con 6 cuotas y `cuota` 89741,0851 ve "$ 89.741 x 6".

### CA-RF28-F06 — La fecha es la de siempre

- **Dado** el paso 4 del avance
- **Cuando** el usuario lo ve
- **Entonces** ve "¿Cuándo fue?" con "Hoy" elegida, "Ayer" y "Otra fecha", "Atrás" y "Siguiente", igual que en el registro de un movimiento.

### CA-RF28-F07 — La nota opcional y el resumen, sin categoría ni método, con la aclaración del dinero recibido

- **Dado** un avance de $ 500.000 con "Visa Bancolombia", 6 cuotas, primer pago en diciembre 2026, que el backend respondió `cuota` 89741,0851 y `mesUltimoPago` "2027-05", fecha de hoy y la nota vacía
- **Cuando** el usuario llega al paso 5
- **Entonces** ve "¿Quieres agregar una nota?" (opcional) y el resumen con "Valor $ 500.000", "Tarjeta Visa Bancolombia", "Cuotas 6 cuotas", "Cuota estimada $ 89.741", "Primer pago diciembre 2026", "Último pago mayo 2027" y "Fecha Hoy"; la nota "Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar." y la aclaración "Este dinero entra como dinero recibido: no cuenta como ingreso propio."
- **Y** no ve "Categoría" ni "Método".

> Decisión (F6): la aclaración se propone para explicar ADR-014 en lenguaje cotidiano (RNF-04); el Figma no la trae.

## Guardar el avance

### CA-RF28-F08 — Guardar envía el avance, no una compra ni un movimiento

- **Dado** el resumen del avance de la CA-RF28-F07
- **Cuando** el usuario toca "Guardar"
- **Entonces** se llama a `registrarAvance('66a0b3c4d5e6f70012ab34cd', { valor: 500000, cuotas: 6, primerPago: '2026-12', fecha: '2026-11-19' }, clave)` una sola vez, con una `clave` en formato UUID.
- **Y** el cuerpo no lleva `categoriaId`, `tipo` ni ningún otro campo extra, y **no** se llama a `registrarCompra` ni a `crearTransaccion`.

### CA-RF28-F09 — La nota solo se envía si la escribió

- **Dado** el resumen del avance
- **Cuando** el usuario guarda con la nota vacía (o solo espacios)
- **Entonces** el cuerpo no lleva `descripcion` (el servidor usa "Avance en efectivo").
- **Y** si escribió "  Arreglo del carro  ", el cuerpo lleva `descripcion: 'Arreglo del carro'` (hasta 200 caracteres).

> Decisión (F5): a diferencia de la compra, la descripción del avance es opcional en el contrato; no se inventa ninguna.

### CA-RF28-F10 — Al guardar, ve que quedó registrado y qué significa

- **Dado** que el backend responde `201` con el avance (6 cuotas, `cuota` 89741,0851)
- **Cuando** el usuario ve el resultado
- **Entonces** ve "¡Listo!" y "Registramos tu avance de $ 500.000 con Visa Bancolombia, a 6 cuotas de $ 89.741. Este dinero entra como dinero recibido: no cuenta como ingreso propio." y el botón "Listo", que cierra la pantalla y vuelve a "Mis tarjetas".
- **Y** la cuota redondeada es la de la respuesta del guardado, no la de la vista previa.

> Decisión (F6): texto propuesto, calcado de la confirmación del registro.

### CA-RF28-F11 — Mientras guarda ve un indicador y el doble toque envía una sola solicitud

- **Dado** que el backend aún no responde al guardado
- **Cuando** el usuario espera, o toca "Guardar" dos veces seguidas
- **Entonces** "Guardar" muestra un indicador de carga, "Guardar" y "Atrás" no se pueden tocar y `registrarAvance` se llama **una sola vez**, con una sola clave.

### CA-RF28-F12 — Los errores se explican igual que en la compra y la clave se reutiliza

- **Dado** que `registrarAvance` falla
- **Cuando** el usuario ve el resultado
- **Entonces** sin conexión ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."; con `400`, `422` o `500` ve "No pudimos guardar tu avance. Revisa los datos e inténtalo de nuevo."; con `409` ve "Tu avance todavía se está guardando. Espera unos segundos e inténtalo de nuevo."; con `404` "Tarjeta no encontrada" ve "Esta tarjeta ya no existe. Vuelve atrás y elige otra."; con `401` la sesión se cierra, sin aviso propio.
- **Y** en cada caso el resumen queda intacto, "Guardar" vuelve a estar disponible y, al volver a tocarlo sin cambiar nada, `registrarAvance` lleva **la misma clave** y el mismo cuerpo (importante en el `500`: el avance es todo o nada y repetir con la misma clave no lo duplica).

### CA-RF28-F13 — Cambiar algo es una acción nueva; un avance nuevo, otra clave

- **Dado** que el primer "Guardar" falló
- **Cuando** el usuario vuelve atrás, cambia el valor, la tarjeta, las cuotas, el mes, la fecha o la nota y vuelve a guardar
- **Entonces** la nueva llamada lleva una clave **distinta** y el cuerpo nuevo.
- **Y** otro avance registrado más tarde, aunque sea idéntico, lleva otra clave.

## Contrato del adaptador (`lib/api/tarjetas.ts`, avance)

### CA-RF28-F14 — `registrarAvance` envía la petición según el contrato

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `registrarAvance('66a0…', { valor, cuotas, primerPago, fecha }, clave)` (y, otra vez, con `descripcion`)
- **Entonces** se hace `POST /tarjetas/66a0…/avances` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo los campos recibidos (sin `categoriaId`; `descripcion` solo si se la pasan) y la función entrega la compra de `tipo` `AVANCE` que responde el `201` tal cual (con `cuota` sin redondear).

## Cómo se ve el avance en Movimientos

### CA-RF28-F15 — El dinero del avance se ve como "dinero recibido" y no se edita desde ahí

- **Dado** que el backend lista en Movimientos un ingreso de $ 500.000 con descripción "Avance en efectivo", pagado en efectivo, sin categoría y con `clasificacionFlujo` `DINERO_RECIBIDO`
- **Cuando** el usuario abre Movimientos
- **Entonces** ve "Avance en efectivo", "+ $ 500.000" y, debajo, "Dinero recibido · Efectivo" (los movimientos ordinarios siguen mostrando solo "Categoría · Método").
- **Y** al tocar esa fila **no** se abre la hoja de edición.
- **Y** si otro movimiento llega con la misma clasificación pero sin descripción, el título sigue siendo "Sin categoría" (CA-RF06-06).

> Decisión (G3): hoy tocar una fila abre la hoja de edición, que exige elegir una categoría ("Elige una categoría…") y el avance no tiene: el usuario vería un aviso confuso en vez de la razón real. Se propone no abrir la hoja para los movimientos que no son ordinarios (los de tarjetas y, más adelante, deudas) y mostrar "Dinero recibido" en el detalle. Alternativa: dejar abrir la hoja y mostrar el `409` de CA-RF08-17. Resuelve el "Pendiente de decisión" sobre movimientos que no se pueden editar de `02-registro-edicion-eliminacion.md`.

### CA-RF28-F16 — Lenguaje cotidiano y accesibilidad del avance (RNF-04, RNF-06)

- **Dado** los pasos, avisos, resumen y confirmación del avance
- **Cuando** el usuario los lee
- **Entonces** no contienen términos técnicos ni contables ("AVANCE", "DINERO_RECIBIDO", "tasaEA", "idempotencia", "409", "payload", "amortización"); hablan de "avance", "dinero recibido", "tarjeta", "cuotas", "internet" y "servidor".
- **Y** las opciones, el campo de cuotas, el selector del mes y los avisos se anuncian como en CA-RF26-F26.

---

# Efecto en los criterios y las pruebas existentes (para aprobar)

Estos criterios cambian lo que los paquetes anteriores daban por cierto. Las pruebas deberán ajustarse **solo con aprobación del desarrollador**, en modo pruebas.

**Registro (paquete 2.2.4).** No hay un archivo de criterios con IDs para el paso "¿Cómo pagaste?" (los de `02-registro.md` son de la lista de movimientos); las pruebas de abajo no llevan ID. Quedan **sustituidas** por CA-RF26-F01 y F03:
- `__tests__/pasos-registro.test.tsx`, `PasoMetodoPago`: "para un egreso ofrece la tarjeta de crédito, pero no avanza y explica por qué" (hoy tocar "Tarjeta crédito" no avanza y muestra el aviso) y "el aviso desaparece al elegir un método válido" (ya no existe ese aviso).
- `__tests__/integracion-registro.test.tsx`: "la tarjeta de crédito no avanza y no se envía al backend" (hoy se queda en "3 de 5" con el aviso).
- Siguen valiendo: "para un ingreso no ofrece la tarjeta de crédito" y las que eligen efectivo, débito y transferencia.
- Con "Tarjeta crédito" el paso "¿Cómo pagaste?" ya no queda en "3 de 5" con aviso: sigue en "3 de 5", pero en "¿Con cuál tarjeta fue?" (CA-RF26-F01 y F02).

**Edición de movimientos (paquete 2.2.x, `02-registro-edicion-eliminacion.md`).** La hoja de editar sigue sin poder cambiar un movimiento a "Tarjeta crédito" (una compra con tarjeta no es un movimiento: habría que eliminarlo y registrarla de nuevo), pero el aviso ya no puede decir "se podrán registrar muy pronto".
- **CA-RF08-10**, última cláusula: el aviso deja de ser "el mismo que en el registro («…se podrán registrar muy pronto…»)". Pasa a ser "Las compras con tarjeta de crédito se registran desde «Registrar egreso». Aquí elige otro método." (el comportamiento no cambia: la tarjeta no se elige y se ve el aviso).
- **CA-RF08-27**: igual, solo cambia el texto del aviso; el comportamiento (el método no cambia, el aviso se va al cerrar la lista, guardar el resto funciona) queda igual.
- Pruebas afectadas, solo por el texto: `__tests__/movimientos-edicion.test.tsx`, "CA-RF08-10 el método de pago ofrece las opciones del registro y la tarjeta de crédito avisa" y "CA-RF08-27 tocar 'Tarjeta crédito' no impide guardar el resto…" (usan `/se podrán registrar muy pronto/`); la tercera, "CA-RF08-27 si solo tocó…", no cambia.
- El "Pendiente de decisión: movimientos que no se pueden editar" queda resuelto por CA-RF28-F15 (decisión G3). **CA-RF08-17 y CA-RF08-24** (el `409` al guardar o eliminar) siguen valiendo como respaldo.

> Decisión (G2): texto del aviso de la hoja de editar (RNF-04), propuesto.

**Tarjetas (paquete 5.1.3, `05-tarjetas-pantallas.md`).**
- **CA-RF24-F44** (eliminar una tarjeta con `409`): el backend ahora responde `409` también si la tarjeta tiene compras o avances ("No se puede eliminar una tarjeta que ya tiene compras registradas"). El texto del diálogo cambia de "Esta tarjeta ya tiene pagos registrados y no se puede eliminar." a "Esta tarjeta ya tiene compras o pagos registrados y no se puede eliminar." (la pantalla muestra el mismo texto sea cual sea el mensaje del backend). Siguen sin darse pasos para resolverlo: eliminar compras queda fuera de este paquete.
- También se actualiza la línea de contrato de ese archivo para `DELETE /tarjetas/:id` ("pagos" → "pagos o compras") y su "Fuera de este paquete" (la primera viñeta sobre el registro de compras con tarjeta deja de estar pendiente).
- Pruebas afectadas, solo por el texto: `__tests__/tarjetas-eliminar.test.tsx` (la constante `conPagos` y las pruebas "CA-RF24-F44 …" y la de la línea 251, que usan "…pagos registrados y no se puede eliminar.").
- **CA-RF24-F10** ("Con tarjetas"): al final de la lista ahora hay, además de "+ Agregar tarjeta", el botón "Avance en efectivo" (CA-RF28-F01). El resto no cambia; **CA-RF24-F09** (sin tarjetas) y las demás pruebas de la lista no se afectan, porque con la lista vacía, cargando o con error el botón no se ve.

> Decisión (G1): el texto del `409` al eliminar una tarjeta.

**Interfaces:** `app/_layout.tsx` registra la ruta protegida `/avance-en-efectivo` (CA-RF28-F02); el mock del adaptador `@/lib/api/tarjetas` en las pruebas de `__tests__/tarjetas-*.test.tsx` no necesita las funciones nuevas (esas pantallas no las usan), pero sí el de las pruebas nuevas.

---

# Resumen

- Criterios: 63. **Compra con tarjeta** (CA-RF26-F01 a F28): 28 — entrada y encabezado 3 (F01 a F03), elegir la tarjeta 7 (F04 a F10), cuotas y mes del primer pago 4 (F11 a F14), fecha y nota 1 (F15), guardar 10 (F16 a F25), lenguaje y accesibilidad 1 (F26), adaptador 2 (F27, F28). **Cuota estimada** (CA-RF27-F01 a F19): 19 — adaptador 2 (F01, F02), cuándo se pide y qué se ve 9 (F03 a F11), si falla 4 (F12 a F15), pasar al resumen y resumen 4 (F16 a F19). **Avance en efectivo** (CA-RF28-F01 a F16): 16 — entrada y ruta 2 (F01, F02), pasos 5 (F03 a F07), guardar 6 (F08 a F13), adaptador 1 (F14), Movimientos 1 (F15), lenguaje y accesibilidad 1 (F16).
- Decisiones por aprobar: A1 a A3 (aviso reemplazado, 3 de 5, orden), B1 a B3 (tarjeta sin "Disponible", vacío, "+ Agregar tarjeta" con la hoja), C1 a C4 (1 cuota por defecto, "Otra" 1 a 60, mes inicial = mes de hoy, texto de 1 cuota), D1 a D5 (se pide siempre, sin estimación no se avanza, textos de error, filas del resumen), E1 a E4 (nota vacía = categoría, `fecha` siempre, textos de error, confirmación con la cuota de la respuesta), F1 a F6 (entrada desde "Mis tarjetas", ruta, orden valor-primero, pregunta del valor, nota sin inventar, aclaración del dinero recibido), G1 a G3 (409 de eliminar tarjeta, aviso de la hoja de editar, filas de dinero recibido no editables).
- Código que piden: `registrarCompra`, `registrarAvance`, `obtenerCuotaPrevia` y sus tipos en `lib/api/tarjetas.ts`; los pasos de elegir tarjeta y de cuotas (con mes del primer pago y vista previa con espera de 400 ms) en el flujo del registro; el resumen con tarjeta y cuotas; la pantalla `/avance-en-efectivo` y su ruta protegida; el botón "Avance en efectivo" en "Mis tarjetas"; el cambio de texto del `409` de eliminar tarjeta y del aviso de la hoja de editar; "Dinero recibido" y fila no editable en Movimientos.
