# Criterios de aceptación — 2. Registro: editar y eliminar un movimiento (frontend)

Estado: Aprobado (2026-11-03), con todas las propuestas tal como están. Los "Pendiente de decisión" siguen abiertos y no tienen prueba.

Cubre la segunda parte del paquete **2.2.5** (RF-08): editar cualquier campo de un movimiento, incluido su tipo, y eliminarlo con confirmación. La primera parte (la lista con carga progresiva y filtros) ya está en `develop`.

**Fuentes:** wireframes de Figma "Editar movimiento" (6:68) y "Confirmar eliminación" (6:149), decisiones de UX de `CLAUDE.md` ("Edición: formulario con todos los campos visibles. Eliminar siempre pide confirmación") y el contrato del backend (`PATCH` y `DELETE /transacciones/:id`, backend 2.2.3, ya mezclado).

**Contrato del backend que importa aquí:**
- `PATCH /transacciones/:id`: los mismos campos que al crear (`tipo`, `monto`, `fecha`, `categoriaId`, `metodoPago`, `descripcion`), todos opcionales pero al menos uno; solo cambia lo que se envía. Un cuerpo vacío responde `400`. **Al cambiar el tipo hay que enviar también `categoriaId`** con una categoría del nuevo tipo. Enviar `descripcion: ""` borra la nota. Responde `200` con la transacción completa.
- `DELETE /transacciones/:id`: responde `204` sin cuerpo; el borrado es inmediato y permanente, y la confirmación es responsabilidad del cliente.
- Ambos: `404` si no existe o es de otro usuario (repetir un borrado ya hecho también da `404`); `409` si el movimiento lo generó otro módulo (tarjetas o deudas); `401` cierra la sesión. Ninguno usa `Idempotency-Key`: el backend ya tolera repetirlos.

**Sobre los IDs:** RF-08 es "editar cualquier campo de un movimiento, incluido su tipo". Cubre también la eliminación porque ambas viven en la misma hoja.

> Las frases marcadas "Propuesta" son comportamientos o textos que el wireframe no define y que dejo escritos para que los apruebes o los cambies; si los apruebas, tendrán prueba. Los marcados "Pendiente de decisión" no tienen prueba.

---

## RF-08 — Abrir la hoja de edición

### CA-RF08-01 — Tocar un movimiento abre "Editar movimiento" con sus datos

- **Dado** la lista de movimientos con un egreso "Almuerzo" de $45.000, categoría Alimentación, pagado con débito, del 17/09/2026
- **Cuando** el usuario toca ese movimiento
- **Entonces** se abre la hoja "Editar movimiento" con el tipo "Egreso" marcado, el valor "$ 45.000", la categoría "Alimentación", el método "Tarjeta débito", la fecha "17/09/2026" y la descripción "Almuerzo".

> Propuesta: la hoja se abre al tocar la fila. El wireframe de la lista no dibuja ese gesto.

### CA-RF08-02 — Todos los campos se ven a la vez, con sus dos acciones

- **Dado** la hoja de edición abierta
- **Cuando** el usuario la mira
- **Entonces** ve juntos, sin pasos, el selector Ingreso/Egreso y los campos "Valor", "Categoría", "Método de pago", "Fecha" y "Descripción (opcional)", y debajo los botones "Guardar cambios" y "Eliminar movimiento".

### CA-RF08-03 — Cerrar con la ✕ no guarda nada

- **Dado** la hoja abierta, con o sin cambios escritos
- **Cuando** el usuario toca la ✕
- **Entonces** la hoja se cierra, no se envía nada al backend y la lista queda igual.

> Pendiente de decisión: si el usuario escribió cambios, no se le pide confirmar antes de descartarlos. Falta definir si debe pedirse.

---

## RF-08 — Guardar cambios

### CA-RF08-04 — Solo se envía lo que cambió

- **Dado** la hoja abierta con el egreso "Almuerzo" de $45.000
- **Cuando** el usuario cambia el valor a $50.000 y toca "Guardar cambios"
- **Entonces** se envía un `PATCH /transacciones/:id` con solo `{ "monto": 50000 }` y el JWT propio; los demás campos no viajan.

### CA-RF08-05 — Al guardar, la hoja se cierra y la lista muestra el cambio

- **Dado** que el backend responde `200`
- **Cuando** el usuario termina de guardar
- **Entonces** la hoja se cierra y la lista muestra el movimiento con el valor nuevo ("− $ 50.000"), sin que aparezca duplicado.

### CA-RF08-06 — Cambiar la fecha lo reubica en su día

- **Dado** un movimiento del 17/09/2026
- **Cuando** el usuario elige otra fecha en el calendario del campo "Fecha" y guarda
- **Entonces** se envía `{ "fecha": "AAAA-MM-DD" }` con la fecha elegida y, al volver a la lista, el movimiento aparece bajo el encabezado de su nuevo día.

### CA-RF08-07 — Vaciar la nota la borra

- **Dado** un movimiento con la nota "Almuerzo"
- **Cuando** el usuario deja vacío el campo "Descripción (opcional)" y guarda
- **Entonces** se envía `{ "descripcion": "" }` (no se omite el campo) y la fila pasa a mostrar la categoría como título.

### CA-RF08-08 — Sin cambios no se llama al backend

- **Dado** la hoja recién abierta, sin tocar nada
- **Cuando** el usuario toca "Guardar cambios"
- **Entonces** no se envía ninguna solicitud (el backend rechazaría un cuerpo vacío) y la hoja se cierra.

> Propuesta: cerrar en silencio en lugar de mostrar un aviso.

### CA-RF08-09 — Un valor en cero no se puede guardar

- **Dado** la hoja abierta
- **Cuando** el usuario borra el valor o lo deja en cero
- **Entonces** "Guardar cambios" queda deshabilitado y no se envía nada, igual que el botón "Siguiente" del primer paso del registro.

### CA-RF08-10 — El método de pago ofrece las mismas opciones que el registro

- **Dado** la hoja abierta
- **Cuando** el usuario abre el campo "Método de pago"
- **Entonces** puede elegir "Efectivo", "Tarjeta débito" y "Transferencia"; al tocar "Tarjeta crédito" no se elige y ve el mismo aviso que en el registro ("…se podrán registrar muy pronto…").

> Propuesta: reutilizar el mismo comportamiento del paso 3 del registro mientras las tarjetas no existan.

---

## RF-08 — Cambiar el tipo (ingreso ↔ egreso)

### CA-RF08-11 — Al cambiar el tipo hay que elegir una categoría del nuevo tipo

- **Dado** la hoja abierta con un egreso en la categoría "Alimentación"
- **Cuando** el usuario toca "Ingreso"
- **Entonces** el campo "Categoría" queda sin elegir y al abrirlo solo ve categorías de ingreso; mientras no elija una, "Guardar cambios" no envía nada y avisa "Elige una categoría de ingreso para guardar."

> Propuesta de texto del aviso (RNF-04). Motivo: el backend exige que la categoría sea del mismo tipo que el movimiento y responde 400 si no.

### CA-RF08-12 — Con la categoría nueva, el cambio de tipo se envía completo

- **Dado** que el usuario cambió a "Ingreso" y eligió la categoría "Otros ingresos"
- **Cuando** toca "Guardar cambios"
- **Entonces** se envía `{ "tipo": "INGRESO", "categoriaId": "<id de Otros ingresos>" }` (y solo los demás campos que además haya cambiado), y la lista muestra el movimiento con "+" en el monto.

---

## RF-08 — Carga y errores al guardar

### CA-RF08-13 — Doble toque en "Guardar cambios": una sola solicitud

- **Dado** la hoja con un cambio listo para guardar
- **Cuando** el usuario toca "Guardar cambios" dos veces seguidas
- **Entonces** se envía un solo `PATCH`; mientras llega la respuesta ve un indicador de carga en lugar del texto del botón.

### CA-RF08-14 — Sin conexión: avisa, conserva lo escrito y permite reintentar

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.", la hoja sigue abierta con lo que escribió, y al volver a tocar "Guardar cambios" se reintenta.

### CA-RF08-15 — Otro fallo del servidor: mensaje general

- **Dado** que el backend responde `400` o `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar los cambios. Revisa los datos e inténtalo de nuevo.", sin términos técnicos, con la hoja abierta y lo escrito intacto.

> Propuesta de texto (calcado del mensaje del registro).

### CA-RF08-16 — El movimiento ya no existe (404)

- **Dado** que el backend responde `404` al guardar (otro dispositivo lo eliminó)
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Este movimiento ya no existe." y, al cerrar la hoja, la lista ya no lo muestra.

> Propuesta de texto.

### CA-RF08-17 — Lo generó otro módulo (409)

- **Dado** que el backend responde `409` porque el movimiento viene de tarjetas o deudas
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Este movimiento viene de tarjetas o deudas y no se puede cambiar aquí." y la hoja sigue abierta.

> Propuesta de texto.

---

## RF-08 — Eliminar con confirmación

### CA-RF08-18 — "Eliminar movimiento" pide confirmar y no borra todavía

- **Dado** la hoja abierta con el egreso "Almuerzo" de $45.000 del 17 de septiembre
- **Cuando** el usuario toca "Eliminar movimiento"
- **Entonces** ve el diálogo "¿Eliminar este movimiento?" con "Almuerzo · $ 45.000 · 17 sep. Esta acción no se puede deshacer." y los botones "Cancelar" y "Eliminar"; todavía no se envió ninguna solicitud.

> Pendiente de decisión: el wireframe solo muestra el ejemplo de septiembre. El formato de la fecha en otros meses ("oct.", "may.", "jun.") y la inclusión del año cuando no es el actual no están definidos; solo se prueba el ejemplo del diseño.

### CA-RF08-19 — Cancelar deja todo como estaba

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Cancelar"
- **Entonces** el diálogo se cierra, la hoja de edición sigue abierta con sus datos y no se envió nada al backend.

### CA-RF08-20 — Confirmar elimina y la lista deja de mostrarlo

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Eliminar" y el backend responde `204`
- **Entonces** se envió un `DELETE /transacciones/:id` con el JWT propio y sin cuerpo, el diálogo y la hoja se cierran y el movimiento ya no aparece en la lista.

### CA-RF08-21 — Doble toque en "Eliminar": una sola solicitud

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Eliminar" dos veces seguidas
- **Entonces** se envía un solo `DELETE`.

### CA-RF08-22 — Si falla el borrado, avisa y permite reintentar

- **Dado** que el `DELETE` falla por falta de conexión o por un error del servidor
- **Cuando** el usuario ve el resultado
- **Entonces** el diálogo sigue abierto con "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." (o, si es otro fallo, "No pudimos eliminar el movimiento. Inténtalo de nuevo en unos minutos."), el movimiento sigue en la lista y al tocar "Eliminar" de nuevo se reintenta.

> Propuesta de texto del segundo mensaje.

### CA-RF08-23 — Si ya estaba eliminado (404), se da por eliminado

- **Dado** que el backend responde `404` al eliminar (por ejemplo, un reintento después de que el primer intento sí se hizo)
- **Cuando** el usuario ve el resultado
- **Entonces** se trata como eliminado: el diálogo y la hoja se cierran y el movimiento ya no aparece en la lista, sin mostrar un error.

> Propuesta: el resultado que quiere el usuario ya se cumplió, así que no tiene sentido asustarlo.

### CA-RF08-24 — Lo generó otro módulo (409)

- **Dado** que el backend responde `409` al eliminar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Este movimiento viene de tarjetas o deudas y no se puede eliminar aquí." con el diálogo abierto y el movimiento intacto en la lista.

> Propuesta de texto.

---

## Contrato de los adaptadores (`lib/api/transacciones.ts`)

### CA-RF08-25 — `actualizarTransaccion(id, cambios)` (`PATCH /transacciones/:id`)

- **Dado** una sesión vigente
- **Cuando** se llama con el id de un movimiento y los campos a cambiar
- **Entonces** se envía `PATCH /transacciones/<id>` con el JWT en `Authorization: Bearer …`, `Content-Type: application/json` y el cuerpo con exactamente esos campos, **sin** header `Idempotency-Key`, y se devuelve la transacción que responde el backend.
- **Y** un `400` llega con sus mensajes unidos, un `404` y un `409` llegan como `ApiError` con ese código sin cerrar la sesión, y un `401` cierra la sesión.

### CA-RF08-26 — `eliminarTransaccion(id)` (`DELETE /transacciones/:id`)

- **Dado** una sesión vigente
- **Cuando** se llama con el id de un movimiento
- **Entonces** se envía `DELETE /transacciones/<id>` con el JWT, sin cuerpo y sin `Idempotency-Key`, y con la respuesta `204` sin cuerpo se resuelve sin error.
- **Y** un `404` y un `409` llegan como `ApiError` con ese código sin cerrar la sesión, y un `401` cierra la sesión.

---

## RF-08 — Aviso de tarjeta de crédito y "Guardar cambios" (agregado tras revisar el PR 29)

> Estado: **Aprobado** (2026-11-04), tal como está. Surge de revisar la implementación mezclada: tocar "Tarjeta crédito" deja un aviso que bloquea "Guardar cambios" sin decirlo, y el aviso no se limpia al cerrar la lista de métodos. CA-RF08-10 solo cubría que la tarjeta no se elige.

### CA-RF08-27 — Tocar "Tarjeta crédito" no impide guardar el resto de los cambios

- **Dado** la hoja abierta con un movimiento pagado con débito, y el usuario cambió la nota
- **Cuando** abre "Método de pago", toca "Tarjeta crédito" (ve el aviso), vuelve a tocar el campo "Método de pago" para cerrar la lista y toca "Guardar cambios"
- **Entonces** el método sigue siendo "Tarjeta débito", se envía un solo `PATCH` con únicamente la nota nueva (sin `metodoPago`), la hoja se cierra y la lista muestra el cambio.
- **Y** el aviso de la tarjeta ya no se ve una vez cerrada la lista de métodos.
- **Y** si el usuario solo tocó "Tarjeta crédito" y no cambió nada más, "Guardar cambios" no llama al backend y cierra en silencio, igual que CA-RF08-08.

> Propuesta: el aviso es solo una explicación dentro de la lista de métodos; no es un estado que bloquee el guardado. Hoy el botón queda inerte sin explicación cuando el usuario cierra la lista con el aviso activo.

---

## Pendientes de decisión (sin prueba hasta que se definan)

> Pendiente de decisión: **movimientos que no se pueden editar.** Los que vienen de tarjetas o deudas dan `409`. Falta definir si la lista los distingue (por ejemplo, sin el gesto de tocar) o si se deja que el usuario intente y vea el aviso de CA-RF08-17.

> Pendiente de decisión: **posición en la lista tras guardar o eliminar.** No está definido si la lista se vuelve a cargar desde el principio o solo se actualiza la fila; las pruebas solo verifican lo que el usuario ve, no cuál de las dos formas se usa.

> Pendiente de decisión: **versión de escritorio.** El Figma solo trae una versión de 1280 px para Autenticación, Dashboard, Registro y Reportes; la edición es solo móvil.

## No aplica en este paquete

- **Doble toque en guardar o eliminar:** sí aplica y está en CA-RF08-13 y 21.
- **Idempotencia:** `PATCH` y `DELETE` no llevan `Idempotency-Key`; el backend ya tolera repetirlos.
- **Estado vacío de la lista:** ya cubierto por CA-RF06-09 del archivo `02-registro.md`.
