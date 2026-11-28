# Criterios de aceptación — 6. Deudas: préstamos recibidos (paquete 6.2.2, solo la parte de préstamos)

Estado: Aprobado (2026-11-28)

Cubre RF-34 (registrar un préstamo recibido), RF-35 (sumar un monto a una deuda con la misma persona) y RF-36 (sin interés o con interés) en el frontend: registrar, ver la lista, ver el detalle y eliminar un monto prestado.

**Fuera de este paquete:** abonos, saldo, intereses calculados, "Debes en total", valor total, barra de progreso e historial de abonos (el backend aún no los entrega); editar un préstamo (se elimina y se registra de nuevo); "Eliminar préstamo" completo; número de cuotas y cuota estimada; versiones de escritorio; mostrar `dineroDisponible` en reportes. Colores, tamaños y modo claro y oscuro: revisión visual.

**Fuentes:** RF-34 a RF-36, contratos `coordinacion/contratos/deudas.md` (implementado) y `errores.md`, criterios del backend (paquete 6.1.2), Figma sección 07 (capturas móviles "Mis préstamos", "Detalle sin interés" y "Registro — Préstamo recibido") y los criterios ya aprobados de la app.

**Decisiones ya tomadas (2026-11-27):** interés mensual simple o interés total en pesos (nada de "E.A."); sin cuotas; el título es a quién se le debe y cada monto muestra su descripción; se elimina monto por monto. El cliente no suma ni calcula montos (RNF-11).

**Interfaz pública:**
- Adaptador nuevo `lib/api/deudas.ts` (sobre `requestAutenticado`):
  - tipos `TipoInteres` (`'SIN_INTERES' | 'TASA' | 'MONTO_FIJO'`), `Prestamo` (`{ id, monto, fecha, descripcion, creadaEn }`), `Deuda` (`{ id, acreedor, tipoInteres, valorInteres, saldada, creadaEn }`), `DeudaConPrestamos` (`Deuda & { prestamos: Prestamo[] }`), `DatosPrestamo` (`{ acreedor, monto, fecha, descripcion?, tipoInteres?, valorInteres? }`) y `PrestamoRegistrado` (`{ deudaCreada, deuda, prestamo }`);
  - `listarDeudas(): Promise<DeudaConPrestamos[]>`;
  - `registrarPrestamo(datos, claveIdempotencia): Promise<PrestamoRegistrado>`;
  - `eliminarPrestamo(deudaId, prestamoId): Promise<void>`.
- Rutas con sesión: `/prestamos` (lista), `/prestamos/[id]` (detalle, con los parámetros `id` y `nombre`) y `/registrar-prestamo`.

**Cómo se dice el interés** (en el resumen, la lista y el detalle):

| `tipoInteres` y `valorInteres` | Texto |
|---|---|
| `SIN_INTERES`, 0 | "Sin interés" |
| `TASA`, 0.02 | "Interés: 2 % al mes" (con 0.015: "Interés: 1,5 % al mes") |
| `MONTO_FIJO`, 50000 | "Interés total: $ 50.000" |

**Sobre los IDs:** llevan la letra F para no confundirlos con los del backend.

---

## RF-34 — Entrar a los préstamos y ver la lista

### CA-RF34-F01 — Desde el inicio se llega a "Mis préstamos"

- **Dado** una sesión vigente en la vista de inicio
- **Cuando** el usuario toca "Préstamos"
- **Entonces** va a `/prestamos`. Los botones "Registrar ingreso" y "Registrar egreso" no cambian.

> Decisión aprobada: D1.

### CA-RF34-F02 — Las pantallas de préstamos solo con sesión

- **Dado** la navegación de la app
- **Cuando** no hay sesión
- **Entonces** `/prestamos`, `/prestamos/[id]` y `/registrar-prestamo` no están disponibles; con sesión activa, sí.

### CA-RF34-F03 — Carga de la lista

- **Dado** que el backend aún no responde (arranque en frío de Render, RNF-02)
- **Cuando** el usuario abre "Mis préstamos"
- **Entonces** ve el título "Mis préstamos", "Volver" y el indicador "Cargando tus préstamos"; no ve filas, el aviso de vacío ni "+ Registrar préstamo".
- **Y** se llama a `listarDeudas()` y a nada que cree o elimine.

### CA-RF34-F04 — La lista falla y permite reintentar

- **Dado** que la consulta falla
- **Cuando** termina
- **Entonces** ve, según el caso, con un botón "Reintentar" que vuelve a consultar:
  - sin conexión: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  - otro fallo: "No pudimos cargar tus préstamos. Inténtalo de nuevo en unos minutos.".
- **Y** con un `401` la sesión se cierra, sin aviso propio.

### CA-RF34-F05 — Sin préstamos

- **Dado** que `listarDeudas()` entrega `[]`
- **Cuando** termina de cargar
- **Entonces** ve "Todavía no tienes préstamos. Registra el primero cuando alguien te preste dinero." y el botón "+ Registrar préstamo".

### CA-RF34-F06 — Una fila por deuda, sin montos

- **Dado** "Bancolombia" (interés 0.02, un préstamo) y "Papá" (sin interés, dos préstamos), en ese orden
- **Cuando** ve la lista
- **Entonces** ve, en el orden del backend, "Bancolombia" con "Interés: 2 % al mes · 1 préstamo" y "Papá" con "Sin interés · 2 préstamos"; después "+ Registrar préstamo" y la nota "El dinero que te prestan cuenta como dinero recibido, no como ingreso propio.".
- **Y** no ve ningún monto, "saldo", "Debes en total" ni "cuotas".

> Decisión aprobada: D2.

### CA-RF34-F07 — Una deuda pagada se marca

- **Dado** una deuda con `saldada: true`
- **Cuando** ve la lista o su detalle
- **Entonces** su fila dice, por ejemplo, "Sin interés · 1 préstamo · Pagada", y el detalle muestra "Pagada" junto al interés.

> Decisión aprobada: D3.

### CA-RF34-F08 — Al volver a la lista se actualiza

- **Dado** la lista ya cargada
- **Cuando** el usuario regresa del registro o del detalle
- **Entonces** se vuelve a llamar a `listarDeudas()` y ve lo que responda.

### CA-RF34-F09 — "+ Registrar préstamo" abre el registro

- **Dado** la lista cargada
- **Cuando** toca "+ Registrar préstamo"
- **Entonces** va a `/registrar-prestamo`.

---

## RF-34 — Registrar un préstamo, paso a paso

Encabezado de todos los pasos: "Cerrar", "Préstamo recibido" y "N de 5", como el registro.

> Decisión aprobada: D4 (los pasos).

### CA-RF34-F10 — Paso 1: el valor

- **Dado** el registro recién abierto
- **Cuando** lo ve
- **Entonces** ve "1 de 5", "¿Cuánto te prestaron?", el campo "Monto en pesos" y "Siguiente" deshabilitado hasta que escribe un valor mayor que cero.

### CA-RF34-F11 — Paso 2: quién te prestó, con las personas que ya existen

- **Dado** que `listarDeudas()` entrega "Bancolombia" y dos deudas de "Papá" (una activa y otra pagada)
- **Cuando** llega al paso 2
- **Entonces** ve "¿Quién te prestó?", "Bancolombia" y "Papá" (cada nombre una sola vez), "+ Nuevo prestamista" y "Atrás".

### CA-RF34-F12 — Paso 2: carga, error y vacío

- **Dado** el paso 2
- **Cuando** la consulta no ha respondido, falla o entrega `[]`
- **Entonces** respectivamente: ve "Cargando tus préstamos"; ve el aviso de CA-RF34-F04 con "Reintentar"; ve solo "+ Nuevo prestamista".
- **Y** "Atrás" está en los tres casos y vuelve al valor, que sigue escrito.

### CA-RF34-F13 — Una persona nueva escribe su nombre

- **Dado** el paso 2
- **Cuando** toca "+ Nuevo prestamista"
- **Entonces** ve el campo "¿Cómo se llama?" (máximo 50 caracteres) y "Siguiente", deshabilitado mientras esté vacío o solo con espacios.
- **Y** al tocar "Siguiente" pasa al paso del interés, y el nombre se usa sin los espacios de los extremos.

## RF-35 — Sumar un monto a una deuda que ya existe

### CA-RF35-F01 — Elegir a quien ya le debes salta el interés

- **Dado** el paso 2 y "Papá" con una deuda no pagada
- **Cuando** toca "Papá"
- **Entonces** avanza directo a "¿Cuándo fue?" ("4 de 5"); "Atrás" regresa a "¿Quién te prestó?".
- **Y** al guardar, la solicitud lleva `acreedor: 'Papá'` y **no** lleva `tipoInteres` ni `valorInteres`.
- **Y** el resumen muestra las condiciones que ya tiene esa deuda.

> Decisión aprobada: D5.

### CA-RF35-F02 — Escribir el nombre de alguien a quien ya le debes es lo mismo que elegirlo

- **Dado** una deuda no pagada con "Papá"
- **Cuando** en "+ Nuevo prestamista" escribe " papá " y toca "Siguiente"
- **Entonces** pasa lo de CA-RF35-F01, con `acreedor: 'Papá'`.
- **Y** "Papa" (sin tilde) cuenta como otra persona y sí pide el interés.

### CA-RF35-F03 — Si la deuda anterior ya está pagada, se pregunta el interés

- **Dado** "Juan", cuyas deudas están todas pagadas
- **Cuando** lo toca
- **Entonces** ve el paso del interés, como con una persona nueva.

## RF-36 — Con o sin interés

### CA-RF36-F01 — Paso 3: tres opciones, "Sin interés" por defecto

- **Dado** una persona nueva
- **Cuando** llega al paso 3
- **Entonces** ve "3 de 5", "¿Tiene interés?" y las opciones "Sin interés" (seleccionada), "Cada mes" y "Valor fijo", con "Atrás" y "Siguiente".

> Decisión aprobada: D6.

### CA-RF36-F02 — Interés cada mes

- **Dado** el paso 3
- **Cuando** toca "Cada mes"
- **Entonces** ve el campo "Porcentaje de interés al mes" con la ayuda "Ej: 2 es 2 % al mes", que admite coma y hasta 2 decimales.
- **Y** "Siguiente" está deshabilitado si está vacío, es 0 o supera 100.
- **Y** "2" se envía como `tipoInteres: 'TASA', valorInteres: 0.02`; "1,5" como `0.015`.

### CA-RF36-F03 — Interés de un valor fijo

- **Dado** el paso 3
- **Cuando** toca "Valor fijo"
- **Entonces** ve el campo "Monto en pesos" con la ayuda "Es el interés total, no por mes".
- **Y** "Siguiente" está deshabilitado si está vacío o en 0.
- **Y** "50000" se envía como `tipoInteres: 'MONTO_FIJO', valorInteres: 50000`.

### CA-RF36-F04 — Sin interés

- **Dado** el paso 3 con "Sin interés"
- **Cuando** guarda
- **Entonces** la solicitud lleva `tipoInteres: 'SIN_INTERES'` y no lleva `valorInteres`.

## RF-34 — Fecha, resumen y guardado

### CA-RF34-F14 — Paso 4: la fecha

- **Dado** el paso de la fecha
- **Cuando** lo ve
- **Entonces** ve "¿Cuándo fue?" con "Hoy" elegida, "Ayer" y "Otra fecha", como en el registro; "Atrás" vuelve al interés (o a "¿Quién te prestó?" si no hubo paso de interés).

### CA-RF34-F15 — Paso 5: nota opcional y resumen

- **Dado** un préstamo de 500000 de "Juan", sin interés, de hoy
- **Cuando** llega al paso 5
- **Entonces** ve "¿Quieres agregar una nota?" y el resumen: Valor "$ 500.000", Te prestó "Juan", Condiciones "Sin interés", Fecha "Hoy"; debajo "Este dinero entra como dinero recibido: no cuenta como ingreso propio."; "Atrás" y "Guardar".
- **Y** no ve categoría, método de pago, cuotas ni totales.

### CA-RF34-F16 — Guardar envía lo elegido, con clave

- **Dado** el resumen
- **Cuando** toca "Guardar"
- **Entonces** se llama a `registrarPrestamo` una vez con `{ acreedor, monto (número), fecha: 'YYYY-MM-DD', ... }` más el interés según CA-RF35-F01 o CA-RF36, y una clave UUID.
- **Y** `descripcion` solo se envía si escribió una nota (recortada); no se envía ningún otro campo (`metodoPago`, `categoriaId`, `tipo`, `deudaId`).

### CA-RF34-F17 — Mientras guarda, el doble toque no repite

- **Dado** que el backend aún no responde
- **Cuando** toca "Guardar" dos veces seguidas
- **Entonces** hay una sola solicitud, se ve un indicador en el botón y "Guardar" y "Atrás" quedan deshabilitados.

### CA-RF34-F18 — Confirmación de un préstamo nuevo

- **Dado** que el backend responde `deudaCreada: true`, monto 500000 y acreedor "Juan"
- **Cuando** se guarda
- **Entonces** ve "¡Listo!", "Registramos que Juan te prestó $ 500.000.", la nota de dinero recibido y "Listo".
- **Y** "Listo" regresa a "Mis préstamos".

### CA-RF35-F04 — Confirmación al sumar a una deuda

- **Dado** que el backend responde `deudaCreada: false`, monto 200000 y acreedor "Papá"
- **Cuando** se guarda
- **Entonces** ve "Sumamos $ 200.000 a lo que ya le debes a Papá." (nunca el total).

### CA-RF34-F19 — Cerrar sin guardar

- **Dado** el registro en cualquier paso, antes de guardar
- **Cuando** toca "Cerrar"
- **Entonces** vuelve a "Mis préstamos" sin llamar a `registrarPrestamo`.

### CA-RF34-F20 — Errores al guardar

- **Dado** el resumen
- **Cuando** el guardado falla
- **Entonces** ve el aviso (como alerta), con el resumen intacto, y puede volver a tocar "Guardar":

| Respuesta | Qué ve |
|---|---|
| sin conexión | "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." |
| `409` `IDEMPOTENCIA_EN_PROCESO` | "Tu préstamo todavía se está guardando. Espera unos segundos e inténtalo de nuevo." |
| `409` `DEUDA_INTERES_DISTINTO` | "Ya le debes a esta persona con otro interés. Vuelve atrás y elígela en la lista para conservarlo." |
| `409` `DEUDA_REGISTRO_SIMULTANEO` | "Se estaba guardando otro préstamo de esta persona. Inténtalo de nuevo." |
| `400`, `422`, `500` | "No pudimos guardar tu préstamo. Revisa los datos e inténtalo de nuevo." |

- **Y** nunca ve el `message` ni el `action` en estos casos. Con un `401` la sesión se cierra, sin aviso propio.

### CA-RF34-F21 — Reintentar no duplica el préstamo

- **Dado** que un guardado falló
- **Cuando** vuelve a tocar "Guardar" sin cambiar nada
- **Entonces** la solicitud lleva **la misma clave**.
- **Y** si cambió cualquier dato, o el fallo fue `IDEMPOTENCIA_CLAVE_REUTILIZADA`, lleva una clave nueva.

---

## RF-35 — Detalle de una deuda

### CA-RF35-F05 — Tocar una fila abre el detalle

- **Dado** la lista
- **Cuando** toca "Papá"
- **Entonces** va a `/prestamos/[id]` con el `id` de la deuda y su nombre.

### CA-RF35-F06 — Carga, error y deuda que ya no existe

- **Dado** el detalle de "Papá"
- **Cuando** la consulta no ha respondido, falla, o la deuda no viene en la lista
- **Entonces** ve el título "Papá" y "Volver", y respectivamente: el indicador "Cargando el préstamo"; el aviso de CA-RF34-F04 con "Reintentar"; "Este préstamo ya no existe." sin "Reintentar".

### CA-RF35-F07 — Los montos prestados, uno por uno

- **Dado** "Papá", sin interés, con 200000 (2026-09-20, "Para el arriendo") y 500000 (2026-08-15, "Préstamo recibido")
- **Cuando** ve el detalle
- **Entonces** ve "Papá", "Sin interés", la sección "LO QUE TE HAN PRESTADO" y, en el orden del backend, cada monto con su descripción, su fecha ("20 de septiembre de 2026"), "$ 200.000" y un botón de eliminar.
- **Y** no ve ninguna suma ($ 700.000), "Debes", barra de progreso, valor total, abonos ni cuotas.

> Decisión aprobada: D7.

---

## RF-34 — Eliminar un monto prestado

### CA-RF34-F22 — Eliminar siempre pide confirmación

- **Dado** el detalle
- **Cuando** toca "Eliminar el préstamo de $ 200.000, 20 de septiembre de 2026"
- **Entonces** ve el diálogo "¿Eliminar este préstamo?" con "Se quitará el préstamo de $ 200.000 (20 de septiembre de 2026) y su movimiento. Esta acción no se puede deshacer.", "Cancelar" y "Eliminar"; todavía no se llama al backend.
- **Y** "Cancelar" lo cierra sin eliminar nada.

### CA-RF34-F23 — Confirmar elimina solo ese monto

- **Dado** el diálogo de uno de dos montos
- **Cuando** toca "Eliminar" (aunque lo toque dos veces)
- **Entonces** se llama una sola vez a `eliminarPrestamo(deudaId, prestamoId)`, se ve un indicador, y al responder se cierra el diálogo y el detalle se vuelve a pedir.

### CA-RF34-F24 — Eliminar el único monto saca a la persona de la lista

- **Dado** una deuda con un solo monto
- **Cuando** toca su botón de eliminar
- **Entonces** el diálogo agrega "Es el único, así que Juan saldrá de tus préstamos.".
- **Y** al confirmar y responder bien, regresa a "Mis préstamos".

### CA-RF34-F25 — Si ya no existe, se da por eliminado

- **Dado** el diálogo
- **Cuando** el backend responde `404` `DEUDA_NO_ENCONTRADA` o `PRESTAMO_NO_ENCONTRADO`
- **Entonces** el diálogo se cierra sin aviso y la pantalla se actualiza como en CA-RF34-F23 o F24.

### CA-RF34-F26 — Errores al eliminar

- **Dado** el diálogo
- **Cuando** la eliminación falla
- **Entonces** el diálogo sigue abierto, el monto sigue ahí y ve:

| Respuesta | Qué ve |
|---|---|
| sin conexión | "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." |
| `409` `DEUDA_CON_ABONOS` | "Este préstamo ya tiene abonos y no se puede eliminar." |
| `500` | "No pudimos eliminar el préstamo. Inténtalo de nuevo en unos minutos." |

---

## Adaptador

### CA-RF34-F27 — Registrar llama a `POST /deudas/prestamos`

- **Dado** una sesión vigente
- **Cuando** se llama a `registrarPrestamo(datos, clave)`
- **Entonces** hace `POST /deudas/prestamos` con el JWT, el header `Idempotency-Key` con la clave y exactamente `datos` como cuerpo; entrega la respuesta `201`.

### CA-RF34-F28 — Listar llama a `GET /deudas`

- **Dado** que el backend responde `{ items: [...] }`
- **Cuando** se llama a `listarDeudas()`
- **Entonces** hace `GET /deudas` y entrega el arreglo de `items`, en su orden y sin redondear montos.

### CA-RF34-F29 — Eliminar llama a `DELETE`

- **Dado** una sesión vigente
- **Cuando** se llama a `eliminarPrestamo(deudaId, prestamoId)`
- **Entonces** hace `DELETE /deudas/:deudaId/prestamos/:prestamoId` sin cuerpo y termina bien con el `204`.
- **Y** en las tres funciones, un error llega como `ApiError` con su estado y `code`, y sin conexión como `NetworkError`.

---

## No aplica en este paquete

- Movimientos: el préstamo ya se ve como "Dinero recibido" y de solo lectura (criterios existentes). El backend lo guarda con método "Efectivo".
- Abonos y saldos (RF-37, RF-38): cuando el backend los entregue.

---

## Decisiones aprobadas por el desarrollador (2026-11-28)

> Decisión aprobada: **D1 — Por dónde se entra.** Aprobado: un botón "Préstamos" en el inicio (como "Tarjetas") y, dentro de "Mis préstamos", el botón "+ Registrar préstamo". No se agrega un tercer botón de registro en el inicio.

> Decisión aprobada: **D2 — Qué muestra cada fila sin saldo.** Aprobado: nombre, interés y cuántos préstamos hay ("Sin interés · 2 préstamos"), sin ningún monto. Mostrar solo el último valor prestado podría confundirse con lo que se debe.

> Decisión aprobada: **D3 — Deudas pagadas.** Aprobado: se quedan en la misma lista, en el orden que manda el servidor, con la palabra "Pagada". Hoy ninguna puede estarlo porque aún no hay abonos.

> Decisión aprobada: **D4 — Pasos del registro.** Aprobado: valor, quién te prestó, interés, fecha y nota con resumen (5 pasos, como el registro actual). Sin categoría ni método de pago.

> Decisión aprobada: **D5 — Sumar a una deuda que ya existe.** Aprobado: no volver a preguntar el interés; se conserva el que tiene y se ve en el resumen. No hay botón extra en el detalle: se suma desde "+ Registrar préstamo" tocando el nombre.

> Decisión aprobada: **D6 — Cómo se pregunta el interés.** Aprobado: tres opciones, "Sin interés", "Cada mes" (un porcentaje) y "Valor fijo" (pesos en total).

> Decisión aprobada: **D7 — Detalle con uno o varios montos.** Aprobado: siempre la misma lista, un renglón por préstamo con descripción, fecha, valor y su botón de eliminar; sin sumarlos.

> Decisión aprobada: **D8 — Diferencias con el Figma.** Aprobadas:
> 1. Sin "Debes en total", saldo por fila, "Debes", barra, valor total, abonado ni historial de abonos (el servidor aún no los entrega).
> 2. Título y filas usan el nombre de a quién se le debe, no "Préstamo papá" ni "Libre inversión Ba…"; no se repite "Prestamista:".
> 3. Sin "12 cuotas" y sin "24% E.A.".
> 4. "¿Tiene interés?" es un paso aparte con tres opciones, no un interruptor bajo la lista de personas.
> 5. El pie de la lista cambia: el préstamo no tiene categoría "Préstamo recibido" ni es un ingreso propio. Queda "El dinero que te prestan cuenta como dinero recibido, no como ingreso propio.".
> 6. Sin "Sin cuotas fijas: abonas cuando puedes…" (todavía no se puede abonar).
> 7. El registro usa el mismo encabezado del registro actual ("Cerrar", "N de 5") y ocupa la pantalla, como el avance en efectivo, en vez de la hoja del frame.
> 8. Se agregan botones que el frame no trae: "+ Registrar préstamo" en la lista y eliminar en cada monto.
> 9. Las filas no llevan el círculo gris, igual que en tarjetas.
