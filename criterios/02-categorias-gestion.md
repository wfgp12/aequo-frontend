# Criterios de aceptación — 2. Categorías: pantalla "Mis categorías" (paquete 2.3.5, código provisional)

Estado: Aprobado (2026-11-27)

Cubre RF-11 (editar y eliminar las categorías propias) y RF-12 (los movimientos de una categoría eliminada se siguen viendo, en "Otros") en el frontend. El criterio de la fila es: "El usuario ve sus categorías, puede renombrar y eliminar las propias, y las generales no se pueden cambiar."

**Fuentes:** Especificación de Requisitos (RF-11, RF-12); CLAUDE.md (confirmar siempre las eliminaciones; RNF-02, RNF-04, RNF-06); Figma sección "04 · Categorías", móvil: frames "Mis categorías" (13:2), "Editar (sheet)" (13:51) y "Confirmar eliminación" (18:2); contrato del backend de `/categorias`.

**Contrato del backend que importa aquí (todas las rutas con sesión):**
- `GET /categorias?tipo=INGRESO|EGRESO` → `{ items: [{ id, nombre, tipo, esPredeterminada, movimientos }] }`, ya ordenadas. `movimientos` cuenta solo las transacciones del usuario, **no** las compras con tarjeta.
- `PATCH /categorias/:id` `{ nombre }` (1 a 40 caracteres; se recortan los espacios) → `200` con la categoría. `400` validación; `403` es general; `404` "Categoría no encontrada"; `409` "Ya existe una categoría con ese nombre" (mismo tipo, sin distinguir mayúsculas ni tildes; cambiar mayúsculas del propio nombre se permite).
- `DELETE /categorias/:id` → `204`. Sus transacciones y compras con tarjeta pasan a la general de respaldo del mismo tipo ("Otros egresos" / "Otros ingresos"; el `GET` no la marca). `403`, `404`; ante un `500` la categoría sigue y se puede reintentar.
- `POST /categorias`: ya cubierto por `02-categorias-crear.md`.

**Interfaz pública** (queda aprobada con estos criterios):
- Pantalla en la ruta `/categorias`, protegida por sesión.
- La pantalla consulta con `listarCategorias(tipo)` (ya existe).
- Se reutiliza la hoja "Nueva categoría" existente, sin cambiar su comportamiento.
- Adaptador, en `lib/api/categorias.ts`: `renombrarCategoria(id, nombre)` y `eliminarCategoria(id)`.

---

## RF-11 — Llegar a la pantalla

### CA-RF11-F01 — La pantalla de inicio lleva a "Mis categorías"

- **Dado** la pantalla de inicio con sesión
- **Cuando** el usuario toca "Mis categorías"
- **Entonces** va a la pantalla "Mis categorías" (`/categorias`).

> Decisión (D1): la app aún no tiene la barra inferior ni el menú "Más", así que se pone un botón provisional "Mis categorías" en el inicio, como los de "Tarjetas" y "Meta de ahorro".

### CA-RF11-F02 — La pantalla exige sesión y permite volver

- **Dado** la ruta `/categorias`
- **Cuando** se abre sin sesión
- **Entonces** no se muestra (la app lleva al inicio de sesión, como las demás pantallas protegidas).
- **Y** con sesión, el encabezado muestra "Mis categorías" y un botón "‹" con nombre accesible "Volver" que regresa a la pantalla anterior.

---

## RF-11 — Ver las categorías

### CA-RF11-F03 — Mientras carga ve un indicador (RNF-02)

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario ve la pantalla
- **Entonces** ve el encabezado, el selector "Egresos" / "Ingresos" y un indicador de carga ("Cargando tus categorías"); no ve las secciones, ni el botón de nueva categoría, ni avisos.

### CA-RF11-F04 — Al abrir muestra los egresos, separados en propias y generales

- **Dado** que el backend devuelve para egresos las propias "Mascotas" (12 movimientos) y "Gimnasio" (4) y las generales "Alimentación", "Transporte", "Hogar", "Salud" y "Otros egresos"
- **Cuando** el usuario abre la pantalla
- **Entonces** "Egresos" está seleccionado y se consultan solo las categorías de egreso.
- **Y** ve, en este orden: la sección "TUS CATEGORÍAS" con "Mascotas", "12 movimientos" y "Gimnasio", "4 movimientos", cada fila con una flecha; el botón "+ Nueva categoría de egreso"; la sección "GENERALES" con solo los nombres; y el texto "Las categorías generales son de Aequo y no se pueden editar."
- **Y** dentro de cada sección se respeta el orden en que las manda el backend.

### CA-RF11-F05 — La cantidad de movimientos se lee bien en singular y en cero

- **Dado** una categoría propia con 1 movimiento y otra con 0
- **Cuando** el usuario ve la lista
- **Entonces** ve "1 movimiento" y "0 movimientos".

> Decisión (D2): el Figma solo muestra plurales. Además, el número no incluye las compras con tarjeta: una categoría usada solo con tarjeta dice "0 movimientos". Se muestra el número tal como llega, sin notas.

### CA-RF11-F06 — "Ingresos" muestra las categorías de ingreso

- **Dado** la pantalla con los egresos cargados
- **Cuando** el usuario toca "Ingresos"
- **Entonces** "Ingresos" queda seleccionado, mientras llega la respuesta ve el indicador de carga (no las categorías de egreso) y luego las de ingreso, con las mismas secciones y el botón "+ Nueva categoría de ingreso".
- **Y** al tocar "Egresos" vuelve a ver las de egreso.

### CA-RF11-F07 — Sin categorías propias

- **Dado** que el backend solo devuelve categorías generales
- **Cuando** el usuario ve la pantalla
- **Entonces** bajo "TUS CATEGORÍAS" ve "Todavía no tienes categorías propias.", y siguen el botón de nueva categoría y las generales.

> Decisión (D3): el Figma no tiene este estado; se usa ese texto, igual para egresos e ingresos.

### CA-RF11-F08 — Las generales no se pueden tocar

- **Dado** la lista cargada
- **Cuando** el usuario toca una categoría de "GENERALES"
- **Entonces** no se abre nada: no son botones, no tienen flecha y no hay forma de renombrarlas ni eliminarlas.

### CA-RF11-F09 — Si la consulta falla, avisa y permite reintentar

- **Dado** que la consulta falla sin conexión, o con otro error del servidor
- **Cuando** termina
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." o "No pudimos cargar tus categorías. Inténtalo de nuevo en unos minutos." respectivamente, con "Reintentar"; no ve las secciones ni el botón de nueva categoría.
- **Y** el selector y "Volver" siguen disponibles.
- **Y** al tocar "Reintentar" vuelve el indicador de carga y se consulta de nuevo el mismo tipo; si responde bien, ve la lista.
- **Y** ante un `401` no hay aviso propio: la sesión se cierra (cliente HTTP compartido).

---

## RF-11 — Crear desde "Mis categorías"

### CA-RF11-F10 — El botón abre la hoja "Nueva categoría" con el tipo del selector

- **Dado** la pantalla con "Egresos" (o "Ingresos") seleccionado
- **Cuando** el usuario toca "+ Nueva categoría de egreso" (o "de ingreso")
- **Entonces** ve la hoja "Nueva categoría" ya existente con el tipo "Egreso" (o "Ingreso").

### CA-RF11-F11 — Al crear, la lista muestra la categoría nueva

- **Dado** la hoja "Nueva categoría" con un nombre válido
- **Cuando** el usuario toca "Guardar" y el backend responde `201`
- **Entonces** la hoja se cierra, la lista se vuelve a pedir al backend (sin parpadeo: lo anterior sigue visible mientras llega) y muestra la categoría nueva en "TUS CATEGORÍAS".

> Decisión (D4): tras crear, renombrar o eliminar se vuelve a pedir la lista (así quedan el orden y los conteos del servidor) y no se muestra mensaje de éxito.

---

## RF-11 — Renombrar una categoría propia

### CA-RF11-F12 — Tocar una propia abre "Editar categoría"

- **Dado** la lista con "Mascotas"
- **Cuando** el usuario toca su fila
- **Entonces** ve la hoja "Editar categoría" con el tipo "Egreso" (o "Ingreso"), que no se puede cambiar, el campo "Nombre" con "Mascotas", el botón "Guardar" y el botón "Eliminar categoría".

### CA-RF11-F13 — Cerrar la hoja no cambia nada

- **Dado** la hoja con el nombre modificado
- **Cuando** el usuario toca la ✕ ("Cerrar")
- **Entonces** la hoja se cierra sin pedir confirmación y no se envía nada; al abrirla de nuevo, "Nombre" muestra el nombre guardado.

> Decisión (D5): se cierra con ✕ y se descarta, igual que "Nueva categoría".

### CA-RF11-F14 — "Guardar" envía el nombre nuevo y actualiza la lista

- **Dado** la hoja de "Mascotas" con el nombre "  Animales " (con espacios en los extremos)
- **Cuando** el usuario toca "Guardar" y el backend responde `200`
- **Entonces** se llama a `renombrarCategoria` con el id de la categoría y "Animales", la hoja se cierra y la lista se vuelve a pedir y muestra "Animales".
- **Y** cambiar solo mayúsculas o tildes ("mascotas") también se envía.

### CA-RF11-F15 — Guardar sin cambios no llama al backend

- **Dado** la hoja con el nombre igual al guardado (o solo con espacios añadidos en los extremos)
- **Cuando** el usuario toca "Guardar"
- **Entonces** la hoja se cierra y no se envía nada.

> Decisión (D6): sí, como al editar una tarjeta.

### CA-RF11-F16 — Un nombre vacío o muy largo no se envía

- **Dado** la hoja con el nombre vacío (o solo espacios), o de 41 caracteres
- **Cuando** el usuario toca "Guardar"
- **Entonces** ve "Escribe un nombre para la categoría." o "El nombre puede tener hasta 40 letras." respectivamente, la hoja sigue abierta y no se envía nada.
- **Y** con 40 caracteres sí se envía.
- **Y** el aviso deja de verse al editar el campo.

### CA-RF11-F17 — Mientras guarda: indicador y sin doble envío

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario toca "Guardar" dos veces seguidas
- **Entonces** se llama una sola vez a `renombrarCategoria`, "Guardar" muestra un indicador de carga y no se puede tocar, tampoco "Eliminar categoría", y la hoja sigue abierta.

### CA-RF11-F18 — Errores al guardar: avisa, conserva lo escrito y permite reintentar

- **Dado** que el guardado falla
- **Cuando** el usuario ve el resultado
- **Entonces** la hoja sigue abierta con lo escrito, "Guardar" vuelve a estar disponible y ve:
  - `409`: "Ya existe una categoría con ese nombre. Prueba con otro."
  - sin conexión: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."
  - `400`, `403` o `500`: "No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo."
- **Y** ante un `401` no hay aviso propio: la sesión se cierra.

### CA-RF11-F19 — La categoría ya no existe (404 al guardar)

- **Dado** que la categoría se eliminó en otro dispositivo y el backend responde `404`
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Esta categoría ya no existe." en la hoja y la lista se vuelve a pedir, así que al cerrarla ya no aparece.

> Decisión (D7): ese aviso al guardar (como en tarjetas); al eliminar se da por hecho (CA-RF12-F07).

---

## RF-12 — Eliminar una categoría propia

### CA-RF12-F01 — Eliminar siempre pide confirmación y explica qué pasa con los movimientos

- **Dado** la hoja de "Mascotas" (egreso, 12 movimientos)
- **Cuando** el usuario toca "Eliminar categoría"
- **Entonces** ve el diálogo «¿Eliminar "Mascotas"?» con «Sus 12 movimientos no se borran: pasarán a la categoría "Otros egresos".», y los botones "Cancelar" y "Eliminar"; todavía no se ha eliminado nada.
- **Y** el título usa el nombre guardado, aunque en el campo haya uno sin guardar.

### CA-RF12-F02 — En un ingreso, el respaldo es "Otros ingresos"

- **Dado** la hoja de una categoría propia de ingreso con 3 movimientos
- **Cuando** el usuario toca "Eliminar categoría"
- **Entonces** el diálogo dice «Sus 3 movimientos no se borran: pasarán a la categoría "Otros ingresos".»

### CA-RF12-F03 — Con 1 o con 0 movimientos el texto se ajusta

- **Dado** una categoría propia de egreso
- **Cuando** el usuario toca "Eliminar categoría"
- **Entonces** el diálogo dice:
  - con 1: «Su movimiento no se borra: pasará a la categoría "Otros egresos".»
  - con 0: «Lo que hayas anotado con esta categoría no se borra: pasará a la categoría "Otros egresos".»
  - (en ingresos, "Otros ingresos").

> Decisión (D8): el Figma solo tiene el caso con varios. Con 0 puede haber compras con tarjeta (no se cuentan), así que no se dice "no tiene movimientos".

### CA-RF12-F04 — "Cancelar" no elimina

- **Dado** el diálogo abierto
- **Cuando** el usuario toca "Cancelar"
- **Entonces** el diálogo se cierra, la hoja "Editar categoría" sigue como estaba y no se envía nada.

### CA-RF12-F05 — Confirmar elimina y la lista se actualiza

- **Dado** el diálogo de "Mascotas"
- **Cuando** el usuario toca "Eliminar" y el backend responde `204`
- **Entonces** se llama a `eliminarCategoria` con su id, se cierran el diálogo y la hoja, y la lista se vuelve a pedir: "Mascotas" ya no aparece.

### CA-RF12-F06 — Mientras elimina: indicador y sin doble envío

- **Dado** que el backend aún no responde al `DELETE`
- **Cuando** el usuario toca "Eliminar" dos veces seguidas
- **Entonces** se llama una sola vez a `eliminarCategoria`, "Eliminar" muestra un indicador de carga y no se pueden tocar "Eliminar" ni "Cancelar".

### CA-RF12-F07 — Si ya estaba eliminada (404), se da por hecho

- **Dado** que el backend responde `404` al eliminar
- **Cuando** el usuario ve el resultado
- **Entonces** se cierran el diálogo y la hoja y la lista se vuelve a pedir, sin aviso de error.

### CA-RF12-F08 — Si falla, la categoría sigue y se puede reintentar

- **Dado** que el `DELETE` falla
- **Cuando** el usuario ve el resultado
- **Entonces** el diálogo sigue abierto, "Eliminar" y "Cancelar" vuelven a estar disponibles y ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." (sin conexión) o "No pudimos eliminar la categoría. Inténtalo de nuevo en unos minutos." (`403`, `500` u otro).
- **Y** al tocar "Eliminar" otra vez se vuelve a intentar.
- **Y** ante un `401` no hay aviso propio: la sesión se cierra.

---

## RF-11 — Accesibilidad y lenguaje (RNF-04, RNF-06)

### CA-RF11-F20 — Se puede usar con lector de pantalla

- **Dado** la pantalla, la hoja y el diálogo
- **Cuando** un lector de pantalla los recorre
- **Entonces** cada categoría propia es un botón que se lee "Mascotas, 12 movimientos"; "Egresos" y "Ingresos" son botones que anuncian cuál está seleccionado; el campo se anuncia "Nombre"; y los avisos de error se anuncian como alerta.
- **Y** ningún texto muestra términos técnicos ni los mensajes del backend.

---

## Contrato del adaptador

### CA-RF11-F21 — `renombrarCategoria` envía `PATCH /categorias/:id`

- **Dado** una sesión vigente
- **Cuando** se llama a `renombrarCategoria(id, nombre)`
- **Entonces** se hace `PATCH /categorias/<id>` con `Authorization: Bearer …` y cuerpo `{ "nombre": … }` (solo ese campo, sin `Idempotency-Key`), y entrega la categoría del `200`.
- **Y** `400`, `403`, `404`, `409` y `500` llegan como `ApiError` con su código, sin cerrar la sesión; `401` la cierra; sin respuesta llega `NetworkError`.

### CA-RF12-F09 — `eliminarCategoria` envía `DELETE /categorias/:id`

- **Dado** una sesión vigente
- **Cuando** se llama a `eliminarCategoria(id)`
- **Entonces** se hace `DELETE /categorias/<id>` con `Authorization: Bearer …`, sin cuerpo, y un `204` sin contenido se resuelve sin error.
- **Y** `403`, `404` y `500` llegan como `ApiError` con su código, sin cerrar la sesión; `401` la cierra; sin respuesta llega `NetworkError`.

---

## Fuera de este paquete

- Las versiones de escritorio con barra lateral (la app todavía no la tiene).
- La barra inferior y el menú "Más".
- Cambiar el tipo de una categoría, reordenar, buscar, o ver los movimientos de una categoría.
- Elegir a qué categoría pasan los movimientos al eliminar (siempre "Otros").
- La reasignación en sí (RF-12) la hace y la prueba el backend; aquí solo se comprueba lo que se le explica al usuario y lo que se envía.
- Crear: validaciones, errores e idempotencia ya están en `02-categorias-crear.md`.

## Se revisa a ojo (sin prueba automática)

- Flecha de las filas propias y estructura frente a los frames de Figma.
- Web, iPhone y Android, en modo claro y oscuro.
