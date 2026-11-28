# Criterios de aceptación — 8.3.9 Adaptar la app a los códigos de error

Estado: Aprobado (2026-11-27)

Paquete 8.3.9 (código provisional). Fuente: `coordinacion/contratos/errores.md` (propuesto por el backend el 2026-11-27, sin implementar).

## Contrato que se usa

- Toda respuesta de error trae `{ statusCode, error, message, code, action? }`. `code` y `action` son nuevos: el backend de hoy no los manda.
- La app decide por `code`; si falta, por el estado HTTP. Nunca por el texto de `message` ni de `action`.
- La app muestra su propio texto. Solo si no tiene uno para ese `code` muestra `message` y debajo `action`.
- Sin respuesta, o con un cuerpo de error que no es JSON, es una falla de conexión.

## Textos que se reutilizan

- **Sin conexión:** "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."
- **Texto general de la pantalla:** el que cada pantalla ya muestra hoy ante un `500` (por ejemplo "No pudimos guardar tu movimiento. Revisa los datos e inténtalo de nuevo.").

Los demás textos aprobados en criterios anteriores no cambian.

## RNF-04 — Cada error se explica en lenguaje cotidiano

### CA-RNF04-01 — El adaptador entrega `code` y `action`

- **Dado** que el backend responde un error con `code` y `action`
- **Cuando** una función del adaptador recibe la respuesta
- **Entonces** el `ApiError` trae el estado, el `message` (los de validación unidos, como hoy), el `code` y el `action`.
- **Y** si la respuesta no los trae (backend de hoy), llegan vacíos y todo lo demás queda igual.

### CA-RNF04-02 — Una respuesta de error que no es JSON es una falla de conexión

- **Dado** que el servidor está arrancando o caído y responde un `502` o `503` con una página que no es JSON
- **Cuando** el usuario carga o guarda algo
- **Entonces** ve lo mismo que sin conexión (en las pantallas que hoy distinguen ese caso, "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."), conserva lo escrito y puede reintentar con la misma clave.
- **Y** una respuesta `204` sin cuerpo sigue siendo un éxito.

> Decisión (D3): cambia la primera parte de CA-RF06-24 (hoy llega como `ApiError` con "Bad Gateway").

### CA-RNF04-03 — El texto de `message` ya no decide nada

- **Dado** dos respuestas con el mismo estado y el mismo `code` (o ambas sin `code`) pero distinto `message`
- **Cuando** el usuario ve el resultado en una pantalla con texto propio para ese caso
- **Entonces** ve exactamente lo mismo en las dos y el `message` no aparece.

### CA-RNF04-04 — Sin `code`, la app se comporta como hoy

- **Dado** el backend de hoy, que no manda `code`
- **Cuando** falla cualquier carga, guardado o eliminación
- **Entonces** el usuario ve y puede hacer lo mismo que antes de este paquete, según el estado HTTP.
- **Y** las únicas diferencias son CA-RNF04-02 y CA-RNF04-13.

> Decisión (D1).

### CA-RNF04-05 — Sesión vencida: vuelve al inicio de sesión

- **Dado** una sesión abierta
- **Cuando** el backend responde `401` con `SESION_INVALIDA`, sin `code` o con un `code` desconocido
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión, sin aviso propio de la pantalla.

### CA-RNF04-06 — Google no se pudo verificar: se queda en el inicio de sesión

- **Dado** la pantalla de inicio de sesión
- **Cuando** el backend responde `401` con `TOKEN_GOOGLE_INVALIDO` (o sin `code`)
- **Entonces** sigue en esa pantalla, ve "No pudimos verificar tu cuenta. Inténtalo de nuevo." y puede volver a tocar "Continuar con Google".
- **Y** con la sesión de prueba (solo desarrollo), un `404` con o sin `code` sigue mostrando su aviso de desarrollo.

### CA-RNF04-07 — Todavía se está guardando: pide esperar, no corregir

- **Dado** un guardado nuevo que el backend responde con `409` `IDEMPOTENCIA_EN_PROCESO`
- **Cuando** el usuario ve el resultado
- **Entonces** ve el texto que corresponde, lo escrito sigue ahí y, al volver a tocar "Guardar", la solicitud lleva **la misma clave**:

| Guardado | Texto | |
|---|---|---|
| Movimiento | "Tu movimiento todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | ya existe |
| Compra con tarjeta | "Tu compra todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | ya existe |
| Avance en efectivo | "Tu avance todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | ya existe |
| Pago de tarjeta | "Tu pago todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | ya existe |
| Categoría | "Tu categoría todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | **nuevo** |
| Tarjeta | "Tu tarjeta todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | **nuevo** |
| Cargo fijo | "Tu cargo fijo todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | **nuevo** |
| Meta de ahorro | "Tu meta todavía se está guardando. Espera unos segundos e inténtalo de nuevo." | **nuevo** |

- **Y** en la meta de ahorro no se recarga ni se reemplaza lo escrito.

> Decisión (D6): con `code`, reemplaza "todo `409` es nombre repetido" (CA-RF10-F16) y evita que una tarjeta o una meta en proceso se anuncien como repetidas (CA-RF24-F34, CA-RF21-F29).

### CA-RNF04-08 — Clave ya usada: el siguiente intento lleva una clave nueva

- **Dado** cualquiera de los guardados de CA-RNF04-07
- **Cuando** el backend responde `422` `IDEMPOTENCIA_CLAVE_REUTILIZADA`
- **Entonces** ve el texto general de esa pantalla, con lo escrito intacto.
- **Y** al volver a tocar "Guardar" sin cambiar nada, la solicitud lleva una **clave distinta**.
- **Y** un `422` sin `code` sigue como hoy (misma clave).

> Decisión (D7): resuelve el pendiente del `422` de `02-registro-idempotencia.md`.

### CA-RNF04-09 — Nombre o meta repetidos

- **Dado** que el backend responde `409` con uno de estos códigos
- **Cuando** el usuario guarda
- **Entonces** pasa lo ya aprobado:

| `code` | Qué ve |
|---|---|
| `CATEGORIA_DUPLICADA` | "Ya existe una categoría con ese nombre. Prueba con otro." (CA-RF10-F16) |
| `TARJETA_DUPLICADA` | "Ya tienes una tarjeta con ese alias. Elige otro." (CA-RF24-F34) |
| `META_DUPLICADA` | "Ya tienes una meta para este mes. Te mostramos la que está guardada." y se carga la guardada (CA-RF21-F29) |

### CA-RNF04-10 — Cosas que no se pueden cambiar o eliminar

- **Dado** que el backend responde `409` con uno de estos códigos
- **Cuando** el usuario guarda o confirma la eliminación
- **Entonces** ve el texto ya aprobado y todo sigue como estaba:

| `code` | Qué ve |
|---|---|
| `TRANSACCION_DE_OTRO_MODULO` | al editar: "Este movimiento viene de tarjetas o deudas y no se puede cambiar aquí."; al eliminar: "…no se puede eliminar aquí." |
| `META_CON_AHORRO` | "Ya anotaste ahorro en este mes, así que la meta no se puede quitar. Borra primero lo anotado." |
| `TARJETA_CON_COMPRAS` y `TARJETA_CON_PAGOS` | "Esta tarjeta ya tiene compras o pagos registrados y no se puede eliminar." |

> Decisión (D9): un solo texto para los dos códigos de la tarjeta.

### CA-RNF04-11 — Lo que ya no existe

- **Dado** que el backend responde `404` con un código "no encontrado"
- **Cuando** el usuario carga, guarda o elimina
- **Entonces** pasa lo ya aprobado y la lista se vuelve a pedir:

| `code` | Dónde | Qué ve |
|---|---|---|
| `TRANSACCION_NO_ENCONTRADA` | editar / eliminar movimiento | "Este movimiento ya no existe." / se da por eliminado |
| `META_NO_ENCONTRADA` | guardar / quitar la meta / anotar ahorro | "Esta meta ya no existe. Vuelve a guardarla para crearla de nuevo." / "Meta quitada." / "Ese mes ya no tiene meta, así que no se puede anotar el ahorro." |
| `TARJETA_NO_ENCONTRADA` | detalle, cargos, editar tarjeta, nuevo cargo, pago | "Esta tarjeta ya no existe." |
| `TARJETA_NO_ENCONTRADA` | cuota estimada y avance | "Esta tarjeta ya no existe. Vuelve atrás y elige otra." |
| `CARGO_NO_ENCONTRADO` | editar / eliminar cargo fijo | "Este cargo fijo ya no existe." / se da por eliminado |
| `PAGO_NO_ENCONTRADO` | eliminar pago | se da por eliminado |
| cualquiera de los anteriores | confirmar una eliminación | el diálogo se cierra sin aviso y la lista ya no lo muestra |

> Decisión (D10): las eliminaciones siguen cerrando sin aviso, aunque el contrato dice "recarga la lista y avisa".

### CA-RNF04-12 — Compra con tarjeta: dice qué ya no existe

- **Dado** el resumen de una compra con tarjeta
- **Cuando** el backend responde `404` con `TARJETA_NO_ENCONTRADA` o con `CATEGORIA_NO_ENCONTRADA`
- **Entonces** ve "Esta tarjeta ya no existe. Vuelve atrás y elige otra." o "Esta categoría ya no existe. Vuelve atrás y elige otra.", respectivamente, con el resumen intacto.

### CA-RNF04-13 — Compra con tarjeta con el backend de hoy: aviso que cubre los dos casos

- **Dado** el resumen de una compra con tarjeta
- **Cuando** el backend responde `404` sin `code`, diga lo que diga `message`
- **Entonces** ve "La tarjeta o la categoría que elegiste ya no existe. Vuelve atrás y elige otra." (**nuevo**), con el resumen intacto.
- **Y** en el avance en efectivo y en el pago, donde solo puede faltar la tarjeta, un `404` sin `code` dice que la tarjeta ya no existe (el texto de CA-RNF04-11).

> Decisión (D2): reemplaza CA-RF26-F23 y su decisión E3 (comparar el texto del backend) y el `404` de CA-RF28-F12.

### CA-RNF04-14 — Al editar un cargo, si falta la tarjeta, lo dice

- **Dado** la hoja "Editar cargo fijo"
- **Cuando** el backend responde `404` `TARJETA_NO_ENCONTRADA`
- **Entonces** ve "Esta tarjeta ya no existe." en vez de "Este cargo fijo ya no existe.".

> Decisión (D8): mejora la decisión de CA-RF29-F27, que sigue igual sin `code`.

### CA-RNF04-15 — Una dirección que no existe no se confunde con algo eliminado

- **Dado** que el backend responde `404` `RUTA_NO_ENCONTRADA`
- **Cuando** el usuario carga, guarda o confirma una eliminación
- **Entonces** ve el texto general de esa pantalla; no ve "ya no existe", la eliminación **no** se da por hecha y lo que estaba sigue ahí. En una carga puede tocar "Reintentar".

### CA-RNF04-16 — Datos rechazados: texto sencillo, nunca el del servidor

- **Dado** que el backend responde `400` `VALIDACION` con una lista de mensajes (algunos en inglés, con nombres de campos)
- **Cuando** el usuario guarda
- **Entonces** ve el texto general de esa pantalla, sin ninguno de esos mensajes ni nombres de campos, con lo escrito intacto.

> Decisión (D5): no se marcan campos uno por uno; las pantallas ya validan antes de enviar.

### CA-RNF04-17 — Fallos del servidor y otros sin catalogar: texto general

- **Dado** que el backend responde con `ERROR_INTERNO` o `ERROR_HTTP`
- **Cuando** el usuario carga, guarda o elimina
- **Entonces** ve el texto general de esa pantalla (no el `message` ni el `action`) y puede reintentar como hoy; al guardar algo nuevo, el reintento lleva la misma clave.

> Decisión (D4): para `ERROR_HTTP` el contrato dice "mostrar `message`", pero puede venir en inglés.

### CA-RNF04-18 — Un caso para el que la app no tiene texto: muestra el del servidor

- **Dado** que el backend responde un error `4xx` (no `401`) con un `code` que esa pantalla no conoce y que no es uno de los de CA-RNF04-08, 15, 16 y 17 (por ejemplo, uno de deudas o uno futuro)
- **Cuando** el usuario guarda o elimina
- **Entonces** ve el `message` y, debajo, el `action`, como un solo aviso de error; si no hay `action`, solo el `message`.
- **Y** el estado HTTP decide lo que pasa: con un `404`, lo mismo que hoy (recargar la lista o dar por eliminado); en los demás, la pantalla sigue con lo escrito y permite reintentar.

> Decisión (D4): es la única excepción a "nunca muestra los mensajes del backend" de criterios anteriores.

### CA-RNF04-19 — Nunca se ven códigos ni términos técnicos

- **Dado** cualquiera de los avisos anteriores
- **Cuando** el usuario lo lee
- **Entonces** no ve ningún `code` ("SESION_INVALIDA", "TARJETA_DUPLICADA"…), ni números de estado, ni "idempotencia", "payload", "null" o "undefined"; los avisos de error se anuncian como alerta.

## Mis categorías (agregado y aprobado el 2026-11-27)

La pantalla ya está en `develop` (`02-categorias-gestion.md`). Estos criterios solo precisan por `code` lo ya aprobado allí; no hay textos nuevos.

### CA-RNF04-20 — Al renombrar una categoría

- **Dado** la hoja "Editar categoría" con un nombre nuevo
- **Cuando** el usuario toca "Guardar" y el backend responde uno de estos códigos
- **Entonces** la hoja sigue abierta con lo escrito y ve el texto ya aprobado, sin el `message` ni el `action`:

| `code` | Qué ve | |
|---|---|---|
| `CATEGORIA_DUPLICADA` (409) | "Ya existe una categoría con ese nombre. Prueba con otro." | CA-RF11-F18 |
| `CATEGORIA_NO_ENCONTRADA` (404) | "Esta categoría ya no existe." y la lista se vuelve a pedir | CA-RF11-F19 |
| `CATEGORIA_PREDETERMINADA` (403) | "No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo." | CA-RF11-F18 |

> Decisión (M1): `CATEGORIA_PREDETERMINADA` no se puede provocar desde la pantalla (las generales no se pueden tocar). Se deja el texto general ya aprobado para el `403`, no el `message` y el `action` del servidor (CA-RNF04-18).

### CA-RNF04-21 — Al eliminar una categoría

- **Dado** el diálogo de confirmación de eliminar una categoría propia
- **Cuando** el usuario toca "Eliminar" y el backend responde uno de estos códigos
- **Entonces** pasa lo ya aprobado:

| `code` | Qué ve | |
|---|---|---|
| `CATEGORIA_NO_ENCONTRADA` (404) | se da por eliminada: se cierran el diálogo y la hoja, sin aviso, y la lista se vuelve a pedir | CA-RF12-F07 y D10 |
| `CATEGORIA_PREDETERMINADA` (403) | "No pudimos eliminar la categoría. Inténtalo de nuevo en unos minutos." y la categoría sigue | CA-RF12-F08 y M1 |

## Movimientos: la categoría elegida ya no existe (aprobado el 2026-11-27)

La categoría elegida se eliminó en otro dispositivo antes de guardar.

### CA-RNF04-22 — Al registrar un movimiento

- **Dado** el resumen de un movimiento
- **Cuando** el usuario toca "Guardar" y el backend responde `404` `CATEGORIA_NO_ENCONTRADA`
- **Entonces** ve "Esta categoría ya no existe. Vuelve atrás y elige otra.", sin el `message` ni el `action`, con el resumen intacto.

### CA-RNF04-23 — Al editar un movimiento

- **Dado** la hoja "Editar movimiento" con otra categoría elegida
- **Cuando** el usuario toca "Guardar cambios" y el backend responde `404` `CATEGORIA_NO_ENCONTRADA`
- **Entonces** ve "Esta categoría ya no existe. Elige otra." (**nuevo**), sin el `message` ni el `action`, y no ve "Este movimiento ya no existe.".
- **Y** la hoja sigue abierta con lo escrito, y puede elegir otra categoría y guardar.

> Decisión (M2). Sin `code`, ambos casos siguen como hoy (CA-RNF04-04).

## Criterios anteriores que cambian

| Criterio anterior | Cambio |
|---|---|
| CA-RF06-24 (cuerpo que no es JSON) | Reemplazado por CA-RNF04-02. El JSON sin `message` sigue igual. |
| CA-RF26-F23 y decisión E3 | Reemplazados por CA-RNF04-12 y 13. |
| CA-RF28-F12 (el `404`) | Ya no depende de "Tarjeta no encontrada" (CA-RNF04-13). |
| CA-RF10-F16, CA-RF24-F34, CA-RF21-F29 | Siguen sin `code`; con `code` se precisan en CA-RNF04-07 y 09. |
| CA-RF29-F27 | Precisado por CA-RNF04-14. |
| CA-RF08-16 (`404` al editar un movimiento) | Sigue sin `code`; con `CATEGORIA_NO_ENCONTRADA` se precisa en CA-RNF04-23. |
| "Nunca muestra mensajes del backend" (CA-RF30, CA-RF32-F43 y similares) | Excepción de CA-RNF04-18. |

## No aplica en este paquete

- Estados de carga y vacío, y doble toque: no cambian; siguen los criterios de cada módulo.
- Marcar campos uno por uno y traducir validaciones (D5).
- Registrar en un log el `RUTA_NO_ENCONTRADA`: el usuario no lo ve y la app no tiene registro de errores.
- Un tiempo límite propio para las peticiones: hoy no existe y el paquete no lo pide.
- Códigos sin interfaz todavía (`COMPRA_NO_ENCONTRADA`, deudas y préstamos): quedan cubiertos por CA-RNF04-18. `CATEGORIA_PREDETERMINADA` sí tiene interfaz (Mis categorías): CA-RNF04-20 y 21.
