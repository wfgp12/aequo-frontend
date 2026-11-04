# Criterios de aceptación — 2. Categorías: crear una categoría desde el selector (frontend)

Estado: Aprobado

Cubre el paquete **2.3.3 — selector de categorías (frontend)**, RF-10: agregar una categoría personalizada desde el selector de categorías. El selector ya existe (`ListaDeCategorias`, usado en el paso 2 del registro y en la hoja "Editar movimiento"); aquí solo se agrega la opción de **crear**.

**Fuera de este paquete:** la pantalla "Mis categorías" (editar y eliminar categorías) no tiene paquete en la EDT y no tiene criterios aquí.

**Fuentes:** wireframe de Figma "Registro de egreso, paso 2/5" (buscador "Buscar categoría", categorías con etiqueta "Personal" y, al final de la lista, un botón de borde punteado "+ Agregar categoría") y, solo como referencia de lenguaje, "Mis categorías" y "Editar categoría" (campo "Nombre", botón "Guardar", tipo arriba a la derecha). **No existe un frame para crear**: la hoja "Nueva categoría" reutiliza la estructura de "Editar categoría" y es una propuesta. Decisiones de UX de `CLAUDE.md` y contrato `POST /categorias` del backend.

**Contrato del backend que importa aquí (`POST /categorias`):**
- Cuerpo: `{ nombre, tipo }` con `tipo` `INGRESO` o `EGRESO`; solo esos dos campos. Header `Idempotency-Key` con un UUID por acción del usuario, reutilizado en los reintentos (igual que `crearTransaccion`; ver `02-registro-idempotencia.md`).
- `201`: `{ id, nombre, tipo, esPredeterminada: false, movimientos: 0 }`.
- El nombre va de 1 a 40 caracteres y el backend recorta los espacios de los extremos. No puede repetir (sin distinguir mayúsculas ni tildes) el de otra categoría **del mismo tipo**, general o del usuario: `409` con el mensaje "Ya existe una categoría con ese nombre". Un ingreso y un egreso sí pueden llamarse igual.
- `400` con `{ message: string[] }` si el nombre está vacío o pasa de 40, o el tipo es inválido. `401` cierra la sesión. `500` o falta de red: error genérico o `NetworkError`.

**Sobre los IDs:** el prefijo `CA-RF10-F` distingue estos criterios de los `CA-RF10-nn` que el backend ya usa para su lado. Los marcados "Propuesta" son comportamientos o textos que el wireframe no define; quedaron aprobados junto con el resto. Las decisiones del desarrollador sobre los antiguos pendientes están al final del archivo y ya están aplicadas en los criterios.

---

## RF-10 — Dónde está la opción de crear

### CA-RF10-F01 — El paso de categoría de un egreso termina con "+ Agregar categoría"

- **Dado** el paso 2 del registro de un egreso ("¿En qué categoría?"), con las categorías ya cargadas
- **Cuando** el usuario mira la lista
- **Entonces** ve, después de la última categoría, un botón "+ Agregar categoría" (con nombre accesible "Agregar categoría"), y debajo sigue el botón "Atrás".

### CA-RF10-F02 — Lo mismo en el registro de un ingreso

- **Dado** el paso 2 del registro de un ingreso, con las categorías ya cargadas
- **Cuando** el usuario mira la lista
- **Entonces** ve el mismo botón "+ Agregar categoría" al final de la lista.

> Propuesta: el wireframe solo muestra el paso de egreso; asumo que el de ingreso es idéntico.

### CA-RF10-F03 — La hoja "Editar movimiento" también lo ofrece

- **Dado** la hoja "Editar movimiento" con el campo "Categoría" abierto y las categorías cargadas
- **Cuando** el usuario mira la lista
- **Entonces** ve el botón "+ Agregar categoría" al final de ella, igual que en el registro.

### CA-RF10-F04 — Mientras la lista carga o si falló, no se ofrece crear

- **Dado** que la lista de categorías todavía carga (por ejemplo, arranque en frío de Render), o que falló y muestra "Reintentar"
- **Cuando** el usuario mira la pantalla
- **Entonces** no ve el botón "+ Agregar categoría"; aparece cuando la lista termina de cargar.

> Propuesta: sin la lista cargada no se sabe qué categorías hay, y el aviso de error ya ocupa el espacio.

---

## RF-10 — La hoja "Nueva categoría"

### CA-RF10-F05 — Tocar el botón abre la hoja con el tipo ya fijado

- **Dado** el paso de categoría de un egreso
- **Cuando** el usuario toca "+ Agregar categoría"
- **Entonces** ve la hoja "Nueva categoría" con el tipo "Egreso" (solo se lee, no se puede cambiar), un campo "Nombre" vacío y un botón "Guardar".
- **Y** en el registro de un ingreso la hoja muestra "Ingreso".

> Decisión: reutiliza la hoja "Editar categoría" del wireframe; el título es "Nueva categoría" y la única forma de cerrarla es la ✕ (no hay botón "Cancelar").

### CA-RF10-F06 — El tipo lo fija el flujo, nunca lo elige el usuario

- **Dado** la hoja "Nueva categoría" abierta desde el registro de un egreso, desde el de un ingreso, o desde la hoja "Editar movimiento" de un movimiento que es un ingreso
- **Cuando** el usuario escribe un nombre y toca "Guardar"
- **Entonces** el cuerpo lleva `tipo: "EGRESO"`, `tipo: "INGRESO"` y `tipo: "INGRESO"` respectivamente.
- **Y** si en la hoja "Editar movimiento" el usuario cambió el tipo del movimiento (todavía sin guardarlo), la categoría se crea con el tipo que muestra la hoja en ese momento, no con el original.

### CA-RF10-F07 — "Guardar" envía solo el nombre y el tipo, con una clave de idempotencia

- **Dado** la hoja "Nueva categoría" de un egreso, con el nombre "  Mascotas " (con espacios en los extremos)
- **Cuando** el usuario toca "Guardar"
- **Entonces** se envía un solo `POST /categorias` con `{ "nombre": "Mascotas", "tipo": "EGRESO" }` (sin espacios sobrantes y sin otros campos) y un header `Idempotency-Key` con formato de UUID.

### CA-RF10-F08 — Cerrar con la ✕ no crea nada

- **Dado** la hoja "Nueva categoría" abierta, con o sin texto escrito
- **Cuando** el usuario toca la ✕ ("Cerrar")
- **Entonces** la hoja se cierra de inmediato, sin pedir confirmación aunque haya texto escrito (se descarta), no se envía nada al backend y el usuario vuelve al selector tal como estaba (en el registro, con el valor y lo ya elegido intactos; en la edición, sin cambios en el formulario).
- **Y** la hoja no tiene botón "Cancelar": la ✕ es la única forma de cerrarla.

> Decisión: se descarta sin confirmar; solo la ✕, sin "Cancelar".

---

## RF-10 — Validación del nombre antes de llamar al backend

### CA-RF10-F09 — Un nombre vacío no se envía

- **Dado** la hoja "Nueva categoría" con el nombre vacío o solo con espacios
- **Cuando** el usuario toca "Guardar"
- **Entonces** ve el aviso "Escribe un nombre para la categoría.", la hoja sigue abierta y no se envía ninguna solicitud.

> Propuesta de texto (RNF-04). El backend ya rechaza el nombre vacío con `400`; validar antes evita una espera inútil.

### CA-RF10-F10 — Un nombre de más de 40 caracteres no se envía

- **Dado** la hoja "Nueva categoría" con un nombre de 41 caracteres (sin contar espacios de los extremos)
- **Cuando** el usuario toca "Guardar"
- **Entonces** ve el aviso "El nombre puede tener hasta 40 letras.", la hoja sigue abierta y no se envía ninguna solicitud.
- **Y** con un nombre de exactamente 40 caracteres sí se envía.

> Propuesta de texto (RNF-04). Propuesta: no se corta lo que el usuario escribe; se le avisa al guardar. Un nombre de 1 carácter también es válido.

### CA-RF10-F11 — El aviso de validación desaparece al corregir

- **Dado** que el usuario ve el aviso de nombre vacío o demasiado largo
- **Cuando** edita el campo "Nombre"
- **Entonces** el aviso deja de verse.

---

## RF-10 — Guardando: carga y doble toque (RNF-02)

### CA-RF10-F12 — Mientras guarda ve un indicador de carga

- **Dado** que el backend aún no responde al `POST /categorias` (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario espera
- **Entonces** el botón "Guardar" muestra un indicador de carga en lugar de su texto y no se puede tocar de nuevo; la hoja sigue abierta.

> Decisión: ante un arranque en frío de Render solo se muestra este indicador; no hay un aviso adicional si la espera es larga.

### CA-RF10-F13 — Doble toque en "Guardar": una sola solicitud

- **Dado** la hoja con un nombre válido
- **Cuando** el usuario toca "Guardar" dos veces seguidas
- **Entonces** se envía una sola solicitud al backend, con una sola clave.

### CA-RF10-F14 — Cada acción nueva lleva su propia clave

- **Dado** que el usuario ya creó una categoría
- **Cuando** abre la hoja otra vez y crea otra (aunque los datos sean iguales)
- **Entonces** la segunda solicitud lleva una clave **distinta** a la primera.

---

## RF-10 — Al crear con éxito

### CA-RF10-F15 — La hoja se cierra y la categoría nueva queda elegida

- **Dado** que el backend responde `201` con la categoría creada
- **Cuando** el usuario ve el resultado
- **Entonces** la hoja "Nueva categoría" se cierra, no ve ningún aviso de error y la categoría nueva queda **elegida**:
  - en el registro, el flujo avanza al paso 3 "método de pago" ("3 de 5") con esa categoría (el resumen y el movimiento guardado usan esa categoría);
  - en la hoja "Editar movimiento", queda seleccionada en el campo "Categoría" (se ve su nombre) y se envía al guardar los cambios.
- **Y** el usuario no pierde lo que ya había capturado.
- **Y** la categoría nueva se agrega al selector con la etiqueta "Personal", usando lo que devolvió el `201`: **no se vuelve a pedir la lista** con `GET /categorias`.

> Decisión: se elige automáticamente y se usa la respuesta del `201`. La posición dentro de la lista no está definida y no se prueba.

---

## RF-10 — Errores al guardar

### CA-RF10-F16 — Nombre repetido (409): lo dice con claridad y permite corregir

- **Dado** que el backend responde `409` ("Ya existe una categoría con ese nombre")
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Ya existe una categoría con ese nombre. Prueba con otro.", la hoja sigue abierta con el nombre escrito, el botón "Guardar" vuelve a estar disponible y no se cierra la sesión.

> Propuesta de texto (RNF-04); el mensaje del backend no se muestra tal cual para mantener el lenguaje de la interfaz bajo control.

> Decisión: todo `409` se trata como nombre repetido, sea cual sea el mensaje del backend (aunque sea el de "la misma clave sigue en proceso"). El `422` de idempotencia no se distingue: cae en el aviso general de CA-RF10-F18.

### CA-RF10-F17 — Sin conexión: avisa, conserva lo escrito y permite reintentar con la misma clave

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.", la hoja sigue abierta con el nombre escrito y "Guardar" vuelve a estar disponible.
- **Y** al volver a tocar "Guardar" sin cambiar el nombre, la nueva solicitud lleva **la misma clave** y el mismo cuerpo que la primera, y el aviso desaparece al lograr guardar.

### CA-RF10-F18 — Otro fallo del servidor (400, 422 o 500): mensaje general y la misma clave

- **Dado** que el backend responde `400`, `422` o `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo.", sin términos técnicos y sin mostrar los mensajes del backend, con la hoja abierta y el nombre intacto.
- **Y** si vuelve a tocar "Guardar" sin cambiar nada, la solicitud lleva la misma clave.

> Propuesta de texto (calcado de los mensajes del registro y de la edición).

### CA-RF10-F19 — Si el usuario cambia el nombre después de un fallo, es una acción nueva

- **Dado** que el primer "Guardar" falló (por falta de conexión, por `409` o por otro error)
- **Cuando** el usuario cambia el nombre y vuelve a tocar "Guardar"
- **Entonces** la nueva solicitud lleva una clave **distinta** a la del intento fallido y el nombre nuevo.

> Calcado de CA-RF06-22, ya aprobado para el registro.

### CA-RF10-F20 — Sesión vencida (401)

- **Dado** que el backend responde `401` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión (lo resuelve el cliente HTTP compartido); la hoja no muestra un aviso de error propio.

---

## RF-10 — Accesibilidad y lenguaje (RNF-04, RNF-06)

### CA-RF10-F21 — Se puede usar con lector de pantalla

- **Dado** la hoja "Nueva categoría"
- **Cuando** un lector de pantalla recorre la hoja
- **Entonces** el campo se anuncia como "Nombre", "Guardar" y "Cerrar" son botones con ese nombre, "+ Agregar categoría" es un botón con nombre "Agregar categoría", y los avisos de error se anuncian como alerta.

### CA-RF10-F22 — Todos los textos son cotidianos

- **Dado** cualquier aviso de la hoja (validación, repetido, conexión, error general)
- **Cuando** el usuario lo lee
- **Entonces** no contiene términos técnicos ni contables ("409", "idempotencia", "payload", "tipo INGRESO/EGRESO"): habla de "categoría", "nombre", "internet" y "servidor".

---

## RF-10 — Contrato del adaptador `crearCategoria` (`POST /categorias`)

### CA-RF10-F23 — El adaptador envía la petición según el contrato

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `crearCategoria({ nombre, tipo }, clave)`
- **Entonces** se hace `POST /categorias` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo `nombre` y `tipo` (la clave no va dentro) y la función entrega la categoría que responde el `201` (`id`, `nombre`, `tipo`, `esPredeterminada: false`, `movimientos: 0`).

> Decidido por analogía con CA-RF06-15: la clave nace fuera del adaptador (en la hoja) y entra como **segundo parámetro obligatorio**, para poder reutilizarla en un reintento. El nombre `crearCategoria` es propuesta; vive en `lib/api/categorias.ts` junto a `listarCategorias`.

### CA-RF10-F24 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error
- **Cuando** se llama a `crearCategoria`
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `409` llega como `ApiError` con código 409 y el mensaje del backend; ambos sin cerrar la sesión. Un `422` o un `500` llegan como `ApiError` con su código. Un `401` cierra la sesión. Sin respuesta del servidor llega un `NetworkError`.

---

## RF-10 — El buscador y los nombres repetidos

> Agregado tras la aprobación (decisiones 5 y 6).

### CA-RF10-F25 — "+ Agregar categoría" sigue visible aunque el buscador filtre o no encuentre nada

- **Dado** el selector de categorías cargado
- **Cuando** el usuario escribe en "Buscar categoría" algo que filtra la lista, o que no encuentra nada ("No encontramos categorías con ese nombre.")
- **Entonces** el botón "+ Agregar categoría" sigue visible en ambos casos.

### CA-RF10-F26 — El campo "Nombre" siempre arranca vacío

- **Dado** que el usuario escribió algo en "Buscar categoría"
- **Cuando** toca "+ Agregar categoría"
- **Entonces** el campo "Nombre" de la hoja está vacío (no hereda lo buscado).

### CA-RF10-F27 — El frontend no valida nombres repetidos: decide el backend

- **Dado** que el nombre escrito es idéntico al de una categoría que ya está en la lista (por ejemplo "Alimentación")
- **Cuando** el usuario toca "Guardar"
- **Entonces** la solicitud se envía igual al backend, sin aviso previo y sin ocultar el botón; si el backend responde `409`, se aplica CA-RF10-F16.

---

## Decisiones del desarrollador sobre los pendientes originales

1. Tras crear (`201`) la categoría queda elegida: avanza al paso 3 en el registro y queda seleccionada en la hoja de edición (CA-RF10-F15).
2. Se agrega con la etiqueta "Personal" y se usa la categoría que devolvió el `201`; no se vuelve a pedir la lista (CA-RF10-F15).
3. Cerrar con ✕ con texto escrito descarta sin confirmar (CA-RF10-F08).
4. Título "Nueva categoría", solo ✕ para cerrar, y los textos de error propuestos (CA-RF10-F05, F09, F10, F16, F17, F18).
5. El botón sigue visible aunque el buscador filtre o no encuentre; "Nombre" arranca vacío (CA-RF10-F25, F26).
6. Un nombre idéntico a uno existente: el frontend no valida; decide el backend con `409` (CA-RF10-F27).
7. Todo `409` es "nombre repetido"; el `422` cae en el aviso general (CA-RF10-F16, F18).
8. Arranque en frío de Render: solo el indicador de carga (CA-RF10-F12).

## No aplica en este paquete

- **Editar o eliminar categorías:** viven en "Mis categorías", sin paquete en la EDT.
- **Estado vacío del selector:** las categorías generales siempre existen, así que la lista nunca llega vacía; el aviso de "no encontramos" ya está cubierto por el selector actual.
- **Reglas de nombre únicas por tipo:** son del backend (`CA-RF10-nn` en `aequo-backend`); aquí solo se prueba que la interfaz envía lo que corresponde y muestra bien la respuesta.
