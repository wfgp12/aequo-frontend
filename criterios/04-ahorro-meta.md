# Criterios de aceptación — 4. Ahorro: formulario de la meta mensual (paquete 4.1.3)

Estado: Aprobado

Cubre RF-21 (definir una meta de ahorro mensual, como porcentaje de los ingresos o como monto fijo) en el frontend: la pantalla `/meta-de-ahorro`, donde el usuario ve, fija, cambia y quita **la meta del mes actual**. El criterio de la EDT es: "Pantalla de metas de ahorro." El backend (4.1.2, ya mezclado) guarda una meta por usuario y por mes y no calcula nada en estos endpoints; aquí solo se verifica qué ve el usuario, qué se envía y cómo se explican los errores (RNF-11: la pantalla no convierte porcentajes a pesos ni calcula nada).

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- La tarjeta de progreso de arriba ("Septiembre 2026", monto ahorrado, "83%", barra, "Te faltan $ 250.000 para tu meta"): es del paquete 4.3.2 y usa `GET /ahorro/progreso`.
- El recuadro "Referencia: Tu ahorro promedio de los últimos 3 meses fue de…": no hay endpoint (lo cubren las recomendaciones, paquetes 4.2).
- El widget "Ingresos recurrentes" que acompaña a la meta en escritorio: otra pantalla y otro paquete.
- La versión de escritorio (1280 px, nodo 142:457 de Figma) y su menú lateral; la barra de navegación inferior y el bottom sheet "Más" (no existen todavía: la entrada es un botón en `app/index.tsx`, como se hizo con "Reportes").
- Metas de otros meses: la pantalla trabaja solo con el mes actual, aunque el backend permita crear, editar y quitar metas de cualquier mes. No hay selector de mes.
- `ahorroReal`: el backend lo acepta hoy, pero lo calculará el sistema (RF-23). La pantalla no lo muestra ni lo envía, ni al crear ni al editar.
- Todo cálculo (monto de la meta a partir de un porcentaje, ahorro del mes, disponible): son del backend.

**Fuentes:** Especificación de Requisitos (RF-21), CLAUDE.md (decisiones de UX: confirmar siempre las eliminaciones; carga y arranque en frío de Render, RNF-02; lenguaje sencillo, RNF-04; accesibilidad, RNF-06; cálculos en el backend, RNF-11), Figma sección 09 · Ahorro e ingresos recurrentes, frame móvil "Meta de ahorro" (360 px): encabezado "‹ Meta de ahorro"; campo "Meta mensual" con "$ 1.500.000"; texto de ayuda "Es lo que quieres que te quede cada mes después de restar tus egresos a tus ingresos."; botón primario "Guardar meta" y botón de texto "Quitar meta" (los demás elementos del frame quedan fuera, arriba), contrato `coordinacion/contratos/ahorro-metas.md` (estado "propuesto": falta la conformidad del frontend) y criterios del backend `CA-RF21-28..76` (`aequo-backend/criterios/04-ahorro.md`).

**Contrato del backend que importa aquí** (`/ahorro/metas`, todas las rutas con sesión):
- Una meta: `{ id, tipoMeta, valorObjetivo, periodo, ahorroReal, creadaEn, actualizadaEn }`. `tipoMeta` es `"MONTO_FIJO"` (pesos, > 0, sin tope) o `"PORCENTAJE"` (0 < valor ≤ 100, admite decimales). `periodo` es `"YYYY-MM"`.
- `GET /ahorro/metas?desde=YYYY-MM&hasta=YYYY-MM` → `200 { items: [meta] }` (a lo sumo una por mes; `[]` si no hay).
- `POST /ahorro/metas` con `{ tipoMeta, valorObjetivo, periodo }` y header `Idempotency-Key` (UUID por acción) → `201` con la meta. `409` "Ya existe una meta de ahorro para ese mes"; `400` validación; `422` misma clave con otro cuerpo. El valor va como número JSON, no como texto.
- `PATCH /ahorro/metas/:id` con `{ tipoMeta, valorObjetivo }` (si va `tipoMeta`, `valorObjetivo` es obligatorio en el mismo cuerpo) → `200` con la meta. `404` "Meta de ahorro no encontrada"; `400`. No lleva `Idempotency-Key` (repetirlo es inofensivo).
- `DELETE /ahorro/metas/:id` → `204` sin cuerpo. `409` "No se puede eliminar una meta que ya tiene ahorro registrado"; `404`.
- `401` en cualquier ruta: el cliente HTTP compartido cierra la sesión y la app vuelve al login.

**Interfaz pública** (aprobada con estos criterios):
- Pantalla: `app/meta-de-ahorro.tsx` (ruta `/meta-de-ahorro`), protegida por sesión (`Stack.Protected` en `app/_layout.tsx`).
- Entrada: un botón "Meta de ahorro" en `app/index.tsx`, junto a "Movimientos", "Reportes" y "Mi perfil".
- Adaptador nuevo `lib/api/ahorro.ts` (sobre `requestAutenticado`, como `lib/api/categorias.ts`):
  - tipos `TipoMeta = 'MONTO_FIJO' | 'PORCENTAJE'` y `MetaAhorro` (la forma del contrato);
  - `obtenerMetaDelMes(mes: string): Promise<MetaAhorro | null>`: `GET /ahorro/metas?desde=<mes>&hasta=<mes>`; devuelve `items[0]` o `null`;
  - `crearMeta(datos: { tipoMeta, valorObjetivo, periodo }, claveIdempotencia: string): Promise<MetaAhorro>`: `POST /ahorro/metas`;
  - `actualizarMeta(id: string, datos: { tipoMeta, valorObjetivo }): Promise<MetaAhorro>`: `PATCH /ahorro/metas/:id`;
  - `eliminarMeta(id: string): Promise<void>`: `DELETE /ahorro/metas/:id`.
- La pantalla reutiliza `CampoMonto` (`components/campo-monto.tsx`) para el monto, y `mesActual`, `nombreDelMes` (`lib/fechas.ts`). El mes actual es el del dispositivo, como en Reportes.

**Sobre los IDs:** los `CA-RF21-01..76` ya los usa el backend para su lado (otro repositorio). Para no confundirlos, estos llevan la letra F (`CA-RF21-F01`…), como hizo `02-categorias-crear.md` con `CA-RF10-F`. Las notas "Decisión" recogen textos o comportamientos que el Figma y el RF no definen y que el desarrollador ya aprobó (los textos propuestos quedaron aprobados tal como están escritos).

**Convención de las pruebas:** hoy es el 17 de septiembre de 2026 (reloj simulado), para que el mes actual sea `2026-09` ("septiembre de 2026"). El backend se simula en el borde del adaptador (`jest.mock('@/lib/api/ahorro')`) en las pruebas de la pantalla, y `fetch`/`requestAutenticado` en las del adaptador, igual que las pruebas de categorías. La clave de idempotencia nace en la pantalla (`randomUUID` de `expo-crypto`).

---

## Entrada y ruta

### CA-RF21-F01 — Desde el inicio se llega a "Meta de ahorro"

- **Dado** una sesión vigente en la vista de inicio
- **Cuando** el usuario ve las opciones
- **Entonces** hay un botón "Meta de ahorro" (junto a "Movimientos", "Reportes" y "Mi perfil") que lleva a la ruta `/meta-de-ahorro`.

### CA-RF21-F02 — Solo con sesión

- **Dado** que no hay sesión (o está cerrada)
- **Cuando** se arma la navegación de la app
- **Entonces** la pantalla de la meta no está disponible (como Reportes y Perfil: la app lleva al login); con sesión activa, sí.

### CA-RF21-F03 — Título y "Volver"

- **Dado** la pantalla de la meta
- **Cuando** el usuario la abre
- **Entonces** ve el título "Meta de ahorro" y un botón "Volver" (el mismo "‹" de Reportes y Movimientos) que regresa a la pantalla anterior.

---

## Carga de la meta del mes

### CA-RF21-F04 — Al entrar se consulta la meta del mes actual, una sola vez

- **Dado** una sesión vigente y que hoy es el 17 de septiembre de 2026
- **Cuando** el usuario abre "Meta de ahorro"
- **Entonces** se llama a `obtenerMetaDelMes('2026-09')` una sola vez (`GET /ahorro/metas?desde=2026-09&hasta=2026-09`); no se piden otros meses ni se envía nada más.

> Decisión (del desarrollador): la pantalla trabaja solo con la meta del mes actual; el mes es el del dispositivo, como en Reportes.

> Actualizado en 4.3.2: "no se envía nada más" se refiere a la meta (no se crea, edita ni quita nada al entrar). El progreso del mes se pide aparte y a la vez (CA-RF22-F01).

### CA-RF21-F05 — Mientras carga, solo el indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** ve el título "Meta de ahorro" y un indicador de carga ("Cargando tu meta de ahorro"); no ve el formulario, ni "Guardar meta", ni "Quitar meta", ni avisos de error.

> Actualizado en 4.3.2: la pantalla tiene ahora un segundo indicador, el de la tarjeta de progreso ("Cargando tu progreso de ahorro", CA-RF22-F15); este criterio habla solo del indicador de la meta ("Cargando tu meta de ahorro") y no debe asumir que hay uno solo.

> Decisión: sin saber si ya hay meta del mes, un "Guardar meta" tocado a tiempo crearía una segunda (409) o pisaría lo escrito al llegar la respuesta. Por eso el formulario aparece cuando termina la consulta.

### CA-RF21-F06 — Si la consulta falla, avisa y permite reintentar

- **Dado** que el backend responde `500` (u otro error que no sea de red ni `401`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar tu meta de ahorro. Inténtalo de nuevo en unos minutos." con un botón "Reintentar", y no ve el formulario.
- **Y** al tocar "Reintentar" vuelve a ver el indicador de carga y se consulta de nuevo el mismo mes; si ahora responde bien, ve el formulario.

> Decisión: texto calcado de "No pudimos cargar tus categorías…" y de las tarjetas de Reportes (RNF-04).

### CA-RF21-F07 — Sin conexión

- **Dado** que la consulta falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar", y el título "Meta de ahorro" y "Volver" siguen visibles.

### CA-RF21-F08 — Sesión vencida al cargar (401)

- **Dado** que el backend responde `401` a la consulta
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión (lo resuelve el cliente HTTP compartido); la pantalla no muestra un aviso de error propio.

---

## Lo que se ve según haya o no meta

### CA-RF21-F09 — Sin meta del mes: formulario vacío y sin "Quitar meta"

- **Dado** que el backend responde sin meta (`{ items: [] }`; el adaptador entrega `null`)
- **Cuando** termina de cargar
- **Entonces** ve el tipo "Monto" seleccionado (y "Porcentaje" sin seleccionar), el campo de monto vacío (con el marcador "$ 0"), el botón "Guardar meta" y **no** ve "Quitar meta" (no hay nada que quitar).

> Decisión: "Monto" es el tipo por defecto porque es el que muestra el Figma.

### CA-RF21-F10 — Con una meta de monto: campos precargados

- **Dado** que el backend responde con una meta `MONTO_FIJO` de 1500000 para `2026-09`
- **Cuando** termina de cargar
- **Entonces** ve "Monto" seleccionado, el campo con "$ 1.500.000", el botón "Guardar meta" y el botón "Quitar meta".

### CA-RF21-F11 — Con una meta de porcentaje: campos precargados

- **Dado** que el backend responde con una meta `PORCENTAJE` de 12,5
- **Cuando** termina de cargar
- **Entonces** ve "Porcentaje" seleccionado, el campo con "12,5", la etiqueta "% de tus ingresos", "Guardar meta" y "Quitar meta".

> Decisión: el porcentaje se muestra con coma decimal, como se escribe en Colombia; al enviarse va como número (12.5).

### CA-RF21-F12 — Textos fijos, en lenguaje cotidiano, y lo que todavía no aparece

- **Dado** la pantalla con el formulario visible (con o sin meta), hoy 17 de septiembre de 2026
- **Cuando** el usuario la lee
- **Entonces** ve el título del campo "Meta mensual"; el texto de ayuda del tipo elegido (con "Monto": "Es lo que quieres que te quede cada mes después de restar tus egresos a tus ingresos."; con "Porcentaje": "Es la parte de tus ingresos que quieres que te quede cada mes, después de restar tus egresos."); y la nota "Esta meta es para septiembre de 2026. Cada mes puedes fijar la tuya."
- **Y** no ve el recuadro "Referencia", ni "Ingresos recurrentes", ni la frase "El cambio aplica desde este mes en adelante…" (ni espacios vacíos ni avisos de "próximamente").

> Actualizado en 4.3.2: la tarjeta de progreso ("83%", la barra, "Te faltan…", "Septiembre 2026") ya aparece arriba del formulario; esa cláusula queda sustituida por CA-RF22-F02 y F03 (`04-ahorro-progreso.md`).

> Decisión (del desarrollador): la nota del Figma ("El cambio aplica desde este mes en adelante. Los meses anteriores conservan la meta que tenían.") se reemplaza por la del mes, porque la meta es de un solo mes y cada mes nuevo arranca sin meta. El texto de ayuda del porcentaje y el de la nota quedaron aprobados tal como están escritos (RNF-04).

---

## Elegir el tipo y escribir el valor

### CA-RF21-F13 — El selector "Monto" / "Porcentaje" cambia el campo

- **Dado** el formulario sin meta (tipo "Monto")
- **Cuando** el usuario toca "Porcentaje"
- **Entonces** "Porcentaje" queda seleccionado y "Monto" no; el campo de monto se reemplaza por uno de porcentaje (con la etiqueta "% de tus ingresos") y el texto de ayuda cambia al del porcentaje (CA-RF21-F12). Al tocar "Monto" vuelve el campo de monto.

> Decisión (del desarrollador): el selector va encima del campo; el RF y el backend piden los dos tipos aunque el Figma solo muestra el monto.

### CA-RF21-F14 — Cada tipo recuerda lo que el usuario escribió

- **Dado** el formulario con "Monto" y el valor "$ 1.500.000" escrito
- **Cuando** el usuario toca "Porcentaje", escribe "20", y luego vuelve a tocar "Monto"
- **Entonces** el campo de porcentaje arrancó vacío (el monto no se convierte en porcentaje), y al volver a "Monto" sigue "$ 1.500.000"; al volver a "Porcentaje" sigue "20".

> Decisión (del desarrollador): **cada tipo recuerda su propio valor** mientras la pantalla esté abierta y arranca vacío si no tiene. Un monto y un porcentaje no son comparables (1.500.000 como porcentaje sería absurdo y el backend lo rechaza), así que ninguno se arrastra al otro; recordarlos evita perder lo escrito por un toque de más (igual que las pestañas de Reportes, CA-RF14-14).

### CA-RF21-F15 — El campo de monto escribe pesos con puntos de miles y solo acepta dígitos

- **Dado** el formulario con "Monto"
- **Cuando** el usuario escribe "1500000" (o "1.500.000", o "abc1500000")
- **Entonces** el campo muestra "$ 1.500.000": solo quedan los dígitos, se separan los miles con puntos y no se puede escribir un valor negativo ni letras (el mismo comportamiento del campo de valor del registro de movimientos, con su tope de 12 dígitos).

### CA-RF21-F16 — El campo de porcentaje acepta coma o punto y hasta dos decimales

- **Dado** el formulario con "Porcentaje"
- **Cuando** el usuario escribe "12,5", o "12.5", o "abc12,5"
- **Entonces** el campo muestra "12,5" (letras y signos no se pueden escribir; la coma y el punto valen como separador decimal; solo puede haber un separador).
- **Y** si escribe "12,555" el campo conserva "12,55" (hasta dos decimales).

> Decisión (del desarrollador): el campo muestra y acepta como decimal tanto la coma (costumbre local) como el punto (teclados que solo lo traen); se muestra siempre con coma. El tope de dos decimales no está en el RF ni en el backend (que admite decimales sin límite): es un límite de la interfaz.

---

## Validación antes de llamar al backend

### CA-RF21-F17 — Monto vacío o en cero: no se envía

- **Dado** el formulario con "Monto" y el campo vacío (o con "0", que el campo deja vacío)
- **Cuando** el usuario toca "Guardar meta"
- **Entonces** ve el aviso "Escribe un monto mayor que cero.", el formulario sigue igual y no se llama al backend (ni para crear ni para editar).

> Decisión: texto aprobado (RNF-04). El backend ya rechaza el cero con `400`; validar antes evita la espera. Un monto negativo o con letras no puede llegar aquí (CA-RF21-F15).

### CA-RF21-F18 — Porcentaje vacío o en cero: no se envía

- **Dado** el formulario con "Porcentaje" y el campo vacío, o con "0", "0,0" o solo ","
- **Cuando** el usuario toca "Guardar meta"
- **Entonces** ve el aviso "Escribe un porcentaje mayor que 0.", y no se llama al backend.

### CA-RF21-F19 — Porcentaje mayor que 100: no se envía

- **Dado** el formulario con "Porcentaje" y el valor "100,5" (o "150")
- **Cuando** el usuario toca "Guardar meta"
- **Entonces** ve el aviso "El porcentaje no puede pasar de 100.", y no se llama al backend.
- **Y** con "100" y con "0,5" sí se envía (los extremos válidos del contrato: 0 < valor ≤ 100).

### CA-RF21-F20 — El aviso desaparece al corregir

- **Dado** que el usuario ve un aviso de validación
- **Cuando** edita el campo o cambia el tipo
- **Entonces** el aviso deja de verse.
- **Y** los avisos se anuncian como alerta.

---

## Guardar la meta

### CA-RF21-F21 — Sin meta, "Guardar meta" crea con el cuerpo exacto y una clave

- **Dado** el formulario sin meta, hoy 17 de septiembre de 2026
- **Cuando** el usuario elige "Monto", escribe 1500000 y toca "Guardar meta"
- **Entonces** se llama a `crearMeta({ tipoMeta: 'MONTO_FIJO', valorObjetivo: 1500000, periodo: '2026-09' }, clave)` una sola vez, con una `clave` en formato UUID, y a nadie más (ni `actualizarMeta`).
- **Y** con "Porcentaje" y "12,5" se envía `{ tipoMeta: 'PORCENTAJE', valorObjetivo: 12.5, periodo: '2026-09' }`; `valorObjetivo` es un número (no texto).
- **Y** el cuerpo no lleva ningún otro campo (en particular, no lleva `ahorroReal`).

### CA-RF21-F22 — Al guardar con éxito, la pantalla refleja lo guardado

- **Dado** que el backend responde con la meta guardada (al crear o al editar), con valores que pueden venir normalizados
- **Cuando** el usuario ve el resultado
- **Entonces** ve el aviso "Meta guardada.", el tipo y el valor **que devolvió el backend** en el formulario, el botón "Quitar meta" (si no estaba) y ningún aviso de error; la pantalla no se cierra.
- **Y** no se vuelve a consultar la meta (`obtenerMetaDelMes` no se llama otra vez): se usa lo que respondió el `201` o el `200`.
- **Y** el aviso "Meta guardada." desaparece si el usuario edita el campo o cambia el tipo.

> Decisión (del desarrollador): el Figma no muestra una confirmación; el aviso "Meta guardada." es fijo, en la propia pantalla (sin temporizador ni pantalla nueva), para que el usuario sepa que se guardó. Solo se apaga cuando el usuario edita el campo o cambia el tipo.

### CA-RF21-F23 — Tras crear, el siguiente "Guardar meta" edita (no crea otra)

- **Dado** que el usuario acaba de crear la meta (el backend respondió `201` con un `id`)
- **Cuando** cambia el valor (por ejemplo, de 1.500.000 a 1.800.000) y toca "Guardar meta" otra vez
- **Entonces** se llama a `actualizarMeta(id, …)` con el `id` de la meta creada y no a `crearMeta`.

### CA-RF21-F24 — Con meta, "Guardar meta" edita con el tipo y el valor juntos

- **Dado** el formulario con una meta `MONTO_FIJO` de 1500000 (con `id`)
- **Cuando** el usuario cambia el monto a 1800000 y toca "Guardar meta"
- **Entonces** se llama a `actualizarMeta(id, { tipoMeta: 'MONTO_FIJO', valorObjetivo: 1800000 })` una sola vez: siempre van `tipoMeta` y `valorObjetivo` juntos, aunque solo haya cambiado el valor, y no se envían `periodo` ni `ahorroReal`. No se llama a `crearMeta`.
- **Y** si el usuario cambia a "Porcentaje" y escribe 20, se envía `{ tipoMeta: 'PORCENTAJE', valorObjetivo: 20 }`.
- **Y** si no cambió nada y toca "Guardar meta", se envía igual el mismo cuerpo (repetirlo es inofensivo para el backend) y ve "Meta guardada.".

> Decisión (del desarrollador): guardar sin haber cambiado nada envía igual el `PATCH`; es inofensivo (CA-RF21-56 del backend) y evita lógica de "cambios" en la pantalla.

### CA-RF21-F25 — Al cambiar de tipo en una meta existente, el valor nuevo hace falta

- **Dado** el formulario con una meta `MONTO_FIJO` de 1500000
- **Cuando** el usuario toca "Porcentaje" y toca "Guardar meta" sin escribir un porcentaje
- **Entonces** ve "Escribe un porcentaje mayor que 0." y no se llama al backend (no se envía el tipo nuevo con el valor viejo).

### CA-RF21-F26 — Mientras guarda ve un indicador y no se puede tocar de nuevo

- **Dado** que el backend aún no responde al guardado (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario espera
- **Entonces** el botón "Guardar meta" muestra un indicador de carga en lugar de su texto y no se puede tocar de nuevo; el formulario sigue visible con lo escrito.

### CA-RF21-F27 — Doble toque al crear: una sola solicitud

- **Dado** el formulario sin meta con un valor válido
- **Cuando** el usuario toca "Guardar meta" dos veces seguidas
- **Entonces** se llama una sola vez a `crearMeta`, con una sola clave.

### CA-RF21-F28 — Doble toque al editar: una sola solicitud

- **Dado** el formulario con una meta y un valor nuevo válido
- **Cuando** el usuario toca "Guardar meta" dos veces seguidas
- **Entonces** se llama una sola vez a `actualizarMeta`.

---

## Errores al guardar

### CA-RF21-F29 — Ya existe una meta para el mes (409 al crear)

- **Dado** que el usuario ve el formulario sin meta (por ejemplo, la creó desde otra pestaña o dispositivo) y el backend responde `409` ("Ya existe una meta de ahorro para ese mes") a `crearMeta`
- **Cuando** el usuario ve el resultado
- **Entonces** ve el aviso "Ya tienes una meta para este mes. Te mostramos la que está guardada.", y el formulario pasa a mostrar la meta que hay en el servidor (se vuelve a llamar a `obtenerMetaDelMes('2026-09')`), con "Quitar meta" visible; la sesión no se cierra.
- **Y** el siguiente "Guardar meta" edita esa meta (`actualizarMeta`), no intenta crear otra.

> Decisión (del desarrollador): ante el 409 al crear (caso raro: una meta creada desde otra pestaña) se avisa y se **carga la meta existente** para que el usuario vea lo que hay y decida; así el 409 no deja un botón que siempre falla. Lo que el usuario había escrito se reemplaza por lo guardado. El texto quedó aprobado (RNF-04). Si esa recarga falla, se muestra el aviso general de CA-RF21-F32.

### CA-RF21-F30 — La meta ya no existe (404 al editar)

- **Dado** el formulario con una meta (que otra pestaña ya quitó) y el backend responde `404` a `actualizarMeta`
- **Cuando** el usuario ve el resultado
- **Entonces** ve el aviso "Esta meta ya no existe. Vuelve a guardarla para crearla de nuevo.", el formulario conserva lo escrito, "Quitar meta" desaparece, y el siguiente "Guardar meta" crea una meta (`crearMeta`) con una clave nueva.

> Decisión (del desarrollador): cubre una carrera poco probable sin dejar al usuario atascado. Texto aprobado (RNF-04).

### CA-RF21-F31 — Sin conexión: avisa, conserva lo escrito y reintenta con la misma clave

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.", el formulario sigue con lo escrito y "Guardar meta" vuelve a estar disponible.
- **Y** al volver a tocar "Guardar meta" sin cambiar nada, la nueva llamada a `crearMeta` lleva **la misma clave** y el mismo cuerpo que la primera, y el aviso desaparece al lograr guardar. (Al editar no hay clave: el reintento repite el mismo `actualizarMeta`.)

### CA-RF21-F32 — Otro fallo (400, 422 o 500): mensaje general y la misma clave

- **Dado** que el backend responde `400`, `422` o `500` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar tu meta. Revisa el valor e inténtalo de nuevo.", sin términos técnicos y sin los mensajes del backend, con el formulario abierto y lo escrito intacto.
- **Y** si vuelve a tocar "Guardar meta" sin cambiar nada, la solicitud de crear lleva la misma clave.

> Decisión: texto aprobado (calcado de los de categorías y movimientos).

### CA-RF21-F33 — Si el usuario cambia el valor o el tipo tras un fallo, es una acción nueva

- **Dado** que el primer "Guardar meta" (al crear) falló (por falta de conexión o por otro error)
- **Cuando** el usuario cambia el valor, o cambia de tipo, y vuelve a tocar "Guardar meta"
- **Entonces** la nueva llamada a `crearMeta` lleva una clave **distinta** a la del intento fallido y el cuerpo nuevo (el backend respondería `422` si se reutilizara la clave con otro cuerpo).

> Calcado de CA-RF10-F19 (categorías) y CA-RF06-22 (registro).

### CA-RF21-F34 — Sesión vencida al guardar (401)

- **Dado** que el backend responde `401` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; el formulario no muestra un aviso de error propio.

---

## Quitar la meta

### CA-RF21-F35 — "Quitar meta" pide confirmación antes de hacer nada

- **Dado** el formulario con una meta
- **Cuando** el usuario toca "Quitar meta"
- **Entonces** ve un diálogo "¿Quitar tu meta de ahorro?" con el texto "Se quitará la meta de septiembre de 2026. Esta acción no se puede deshacer." y los botones "Cancelar" y "Quitar"; todavía no se llamó a `eliminarMeta`.

> Decisión (del desarrollador): eliminar siempre pide confirmación (como "¿Eliminar este movimiento?"). Los textos quedaron aprobados (RNF-04).

### CA-RF21-F36 — Cancelar no quita nada

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Cancelar" (o cierra el diálogo con el gesto "atrás")
- **Entonces** el diálogo se cierra, no se llama a `eliminarMeta` y el formulario sigue con su meta y "Quitar meta" visible.

### CA-RF21-F37 — Confirmar quita la meta y vuelve al estado sin meta

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Quitar" y el backend responde `204`
- **Entonces** se llamó una sola vez a `eliminarMeta(id)`, el diálogo se cierra y ve el aviso "Meta quitada.", con el formulario como en CA-RF21-F09: tipo "Monto", campo vacío, sin "Quitar meta".
- **Y** el siguiente "Guardar meta" crea una meta nueva (`crearMeta`, con una clave nueva).
- **Y** no se vuelve a consultar la meta del mes.

> Decisión (del desarrollador): el aviso "Meta quitada." confirma la acción, ya que el formulario vacío por sí solo no basta para saber que funcionó.

### CA-RF21-F38 — Mientras quita ve un indicador; un doble toque no repite

- **Dado** que el backend aún no responde al `DELETE`
- **Cuando** el usuario espera, o toca "Quitar" dos veces seguidas
- **Entonces** "Quitar" muestra un indicador de carga, "Quitar" y "Cancelar" no se pueden tocar, y `eliminarMeta` se llama una sola vez.

### CA-RF21-F39 — Meta con ahorro registrado (409): lo explica y la meta sigue

- **Dado** que el backend responde `409` ("No se puede eliminar una meta que ya tiene ahorro registrado")
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo, "Esta meta ya tiene ahorro registrado y no se puede quitar.", el diálogo sigue abierto ("Cancelar" lo cierra) y, al cerrarlo, la meta sigue en el formulario con "Quitar meta" visible.

> Decisión: texto aprobado (RNF-04). Nota: con esta pantalla sin enviar `ahorroReal`, este caso solo ocurre si otro cliente lo dejó distinto de 0; se cubre igual porque el backend lo define (D8).

### CA-RF21-F40 — La meta ya estaba quitada (404): se cumple lo que el usuario quería

- **Dado** que el backend responde `404` a `eliminarMeta`
- **Cuando** el usuario ve el resultado
- **Entonces** el diálogo se cierra y el formulario queda como sin meta (igual que CA-RF21-F37), sin aviso de error.

> Decisión (del desarrollador): calcado de lo que hace "Eliminar movimiento" con un `404`: se da por quitada.

### CA-RF21-F41 — Sin conexión u otro fallo al quitar

- **Dado** que `eliminarMeta` falla por falta de conexión, o con `400` o `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo, "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." (sin conexión) o "No pudimos quitar tu meta. Inténtalo de nuevo en unos minutos." (otro fallo); el diálogo sigue abierto, "Quitar" vuelve a estar disponible, y la meta sigue en el formulario.

### CA-RF21-F42 — Sesión vencida al quitar (401)

- **Dado** que el backend responde `401` a `eliminarMeta`
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; el diálogo no muestra un aviso de error propio.

---

## Accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)

### CA-RF21-F43 — Se puede usar con lector de pantalla

- **Dado** la pantalla de la meta
- **Cuando** un lector de pantalla la recorre
- **Entonces** "Volver", "Monto", "Porcentaje", "Guardar meta" y "Quitar meta" se anuncian como botones con ese nombre (el tipo elegido, como seleccionado); el campo de monto se anuncia como "Monto en pesos" y el de porcentaje como "Porcentaje de tus ingresos"; los avisos de error y de validación se anuncian como alerta; el diálogo de confirmación se anuncia con el nombre "¿Quitar tu meta de ahorro?" y sus botones "Cancelar" y "Quitar".

### CA-RF21-F44 — Todos los textos son cotidianos

- **Dado** cualquier texto de la pantalla (etiquetas, ayuda, nota, avisos, diálogo)
- **Cuando** el usuario lo lee
- **Entonces** no contiene términos técnicos ni contables ("MONTO_FIJO", "PORCENTAJE", "periodo", "valorObjetivo", "409", "idempotencia", "payload"): habla de "meta", "monto", "porcentaje", "mes", "internet" y "servidor".

### CA-RF21-F45 — El frontend no calcula: el porcentaje no se convierte en pesos

- **Dado** el formulario con "Porcentaje" y el valor "20", con ingresos que el frontend pudiera conocer
- **Cuando** el usuario escribe y guarda
- **Entonces** la pantalla no muestra ningún monto en pesos derivado del porcentaje, y a `crearMeta` o `actualizarMeta` va `valorObjetivo: 20` tal cual (no un monto); del mismo modo, un monto nunca se muestra ni se envía como porcentaje.

---

## Contrato del adaptador (`lib/api/ahorro.ts`)

### CA-RF21-F46 — `obtenerMetaDelMes` consulta el mes y entrega la meta o `null`

- **Dado** una sesión vigente
- **Cuando** se llama a `obtenerMetaDelMes('2026-09')`
- **Entonces** se hace `GET /ahorro/metas?desde=2026-09&hasta=2026-09` con `Authorization: Bearer …`, sin cuerpo; si responde `{ items: [meta] }` entrega esa meta tal cual (`id`, `tipoMeta`, `valorObjetivo`, `periodo`, `ahorroReal`, `creadaEn`, `actualizadaEn`, sin redondear ni cambiar nada); si responde `{ items: [] }` entrega `null`.

### CA-RF21-F47 — `crearMeta` envía la petición según el contrato

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `crearMeta({ tipoMeta, valorObjetivo, periodo }, clave)`
- **Entonces** se hace `POST /ahorro/metas` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo `tipoMeta`, `valorObjetivo` (número) y `periodo` (la clave no va dentro) y la función entrega la meta que responde el `201`.

> La clave nace fuera del adaptador (en la pantalla) y entra como segundo parámetro obligatorio, igual que `crearCategoria`, para poder reutilizarla en un reintento.

### CA-RF21-F48 — `actualizarMeta` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `actualizarMeta('66a0…', { tipoMeta, valorObjetivo })`
- **Entonces** se hace `PATCH /ahorro/metas/66a0…` con `Authorization: Bearer …` y `Content-Type: application/json`, **sin** `Idempotency-Key`; el cuerpo contiene solo `tipoMeta` y `valorObjetivo`, y la función entrega la meta que responde el `200`.

### CA-RF21-F49 — `eliminarMeta` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `eliminarMeta('66a0…')`
- **Entonces** se hace `DELETE /ahorro/metas/66a0…` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key`, y la función termina sin error aunque el `204` no traiga cuerpo (no entrega nada).

### CA-RF21-F50 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error a cualquiera de las cuatro funciones
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `404` y un `409` llegan como `ApiError` con su código y el mensaje del backend (ambos sin cerrar la sesión); un `422` o un `500` llegan como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

## Resumen

- Criterios: 50 (CA-RF21-F01 a F50): entrada y ruta 3 (F01 a F03), carga 5 (F04 a F08), qué se ve según haya o no meta 4 (F09 a F12), tipo y valor 4 (F13 a F16), validación 4 (F17 a F20), guardar 8 (F21 a F28), errores al guardar 6 (F29 a F34), quitar 8 (F35 a F42), accesibilidad y lenguaje 3 (F43 a F45), adaptador 5 (F46 a F50).
- Código nuevo que piden: `app/meta-de-ahorro.tsx`, `lib/api/ahorro.ts`, el diálogo de confirmación para quitar la meta y el campo de porcentaje; `app/_layout.tsx` registra `meta-de-ahorro` dentro de las protegidas y `app/index.tsx` gana el botón "Meta de ahorro". Se reutilizan `CampoMonto`, `mesActual`, `nombreDelMes`, `requestAutenticado`, `ApiError` y `NetworkError`.
- Decisiones del desarrollador sobre los puntos abiertos: F05 (formulario oculto mientras carga), F14 (cada tipo recuerda su valor), F16 (porcentaje con coma o punto, dos decimales, se muestra con coma), F22 (aviso "Meta guardada." fijo, sin temporizador), F24 (guardar sin cambios envía igual), F29 (409 al crear: aviso y recarga de la meta), F30 (404 al editar), F37 y F40 ("Meta quitada." y 404 al quitar cuenta como éxito).
