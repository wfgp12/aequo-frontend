# Criterios de aceptación — 3. Reportes y visualización: egresos por categoría (paquete 3.2.3)

Estado: Aprobado

Cubre RF-18 (distribución de los egresos por categoría) en el frontend: el adaptador `GET /reportes/categorias` y la tarjeta "Egresos por categoría". El criterio de la EDT es: "El componente refleja los datos agregados del backend". El backend calcula todo (RNF-11): aquí solo se verifica qué se pide, qué se muestra y cómo se redondea al peso.

**Fuera de este paquete:**
- El selector de mes o rango y el dashboard (paquete 3.3.1): la tarjeta recibe el periodo por props.
- La navegación a Movimientos filtrados por categoría: la tarjeta solo avisa qué categoría se tocó (CA-RF18-29); cablearla es de otro paquete (hoy Movimientos solo filtra por fechas).
- La dona (`GraficaDona`, 3.2.1): el Figma define para esta tarjeta una lista con barras horizontales; la dona no se usa ni se modifica aquí.
- El envío del header `X-Zona-Horaria`: ya lo cubre `criterios/03-zona-horaria.md` (incluye `GET /reportes/categorias`).
- Cualquier agrupación, ordenamiento, suma o porcentaje calculado en el frontend.

**Fuentes:** Swagger del backend (`GET /reportes/categorias`), `backend/src/reportes/` (servicio, controlador y DTO), Figma sección 05 · Reportes, frame "Reportes — Mes" (tarjeta blanca con título "Egresos por categoría", subtítulo gris "Toca una categoría para ver sus movimientos" y una fila por categoría: nombre a la izquierda, monto a la derecha con un ">" y debajo una barra horizontal sobre un riel gris; ejemplo: Alimentación $780.000, Hogar $520.000, Transporte $380.000, Salud $240.000, Entretenimiento $150.000, Otros egresos $100.000), y el patrón de carga y error de `criterios/03-reportes-ingresos-egresos.md` (3.2.2).

**Contrato del backend que importa aquí (`GET /reportes/categorias`, con sesión):**
- Query opcional: la misma que `GET /reportes/periodo`: `mes` (`YYYY-MM`) **o** `desde` + `hasta` (`YYYY-MM-DD`, ambos incluidos y siempre juntos). Sin ninguno, el backend usa el mes actual según el header `X-Zona-Horaria`.
- `200`: `{ desde, hasta, total, categorias: [{ categoriaId, nombre, total, porcentaje }] }`.
  - Solo cuenta egresos ordinarios (no ingresos, ni pagos de tarjeta, ni abonos a deudas, ni dinero recibido). `total` es la suma de los `total` de `categorias`.
  - `categorias` trae una entrada por cada categoría con gasto en el periodo (las que no tienen gasto no aparecen), **ordenadas de mayor a menor `total`** y, en empate, por nombre de la A a la Z. El backend ya las deja ordenadas.
  - `porcentaje` = `total` de la categoría ÷ `total` del reporte × 100, sin redondear (los porcentajes suman 100).
  - Un gasto sin categoría (o cuya categoría ya no existe) llega como una entrada con `categoriaId: null` y `nombre: "Sin categoría"`. Se ordena como cualquier otra, por su total (no va siempre al final).
  - El backend **no** agrupa categorías menores en "Otros": devuelve todas las que tuvieron gasto. "Otros egresos" del Figma es una categoría general más.
  - Los montos y porcentajes pueden traer decimales (ej. `119802.13`, `33.3333333`); el redondeo al peso lo hace el cliente.
  - Un periodo sin gastos responde `200` con `total: 0` y `categorias: []`, no un error.
- `400` con `message` como arreglo (parámetros inválidos), `401` (sesión), `500` (fallo inesperado).

**Interfaz pública** (aprobada por el desarrollador):
- Adaptador: `obtenerReporteCategorias(periodo?)` en `lib/api/reportes.ts`, con el mismo `PeriodoReporte` de `obtenerReportePeriodo`. Devuelve la respuesta del backend tal cual (tipo `ReporteCategorias`, con `categorias` de tipo `CategoriaGasto[]`: `{ categoriaId: string | null; nombre: string; total: number; porcentaje: number }`).
- Componente: `TarjetaEgresosPorCategoria` en `components/reportes/tarjeta-egresos-por-categoria.tsx`, con las props opcionales `mes`, `desde`, `hasta` y `onElegirCategoria(categoriaId: string, nombre: string)`.

**Sobre los IDs:** continúan la numeración RF-18 de `03-graficas.md` (que llegó hasta CA-RF18-10). Las notas "Decisión" recogen lo que el Figma no define y que el desarrollador aprobó.

---

## Adaptador — `GET /reportes/categorias`

### CA-RF18-11 — Sin periodo se pide el mes actual

- **Dado** una sesión vigente
- **Cuando** se consulta el reporte por categoría sin indicar mes ni rango
- **Entonces** se envía un `GET /reportes/categorias` sin parámetros de consulta, con `Authorization: Bearer <JWT propio>`, y el backend decide el mes actual.

### CA-RF18-12 — Un mes concreto se envía como `mes`

- **Dado** una sesión vigente
- **Cuando** se consulta el reporte por categoría de `2026-09`
- **Entonces** se envía `GET /reportes/categorias?mes=2026-09` y no se envían `desde` ni `hasta`.

### CA-RF18-13 — Un rango se envía como `desde` y `hasta`

- **Dado** una sesión vigente
- **Cuando** se consulta el reporte por categoría del rango 2026-10-10 a 2026-10-20
- **Entonces** se envía `GET /reportes/categorias?desde=2026-10-10&hasta=2026-10-20` y no se envía `mes`.

### CA-RF18-14 — La respuesta llega tal como la manda el backend

- **Dado** que el backend responde `200` con `{ desde: "2026-10-01", hasta: "2026-10-31", total: 1500000.5, categorias: [{ categoriaId: "665f1c2e9b1d4a0012ab3a01", nombre: "Alimentación", total: 1000000.25, porcentaje: 66.6666 }, { categoriaId: null, nombre: "Sin categoría", total: 500000.25, porcentaje: 33.3333 }] }`
- **Cuando** el adaptador devuelve el resultado
- **Entonces** entrega los cuatro campos del reporte y, de cada categoría, `categoriaId`, `nombre`, `total` y `porcentaje` con los mismos valores y en el mismo orden (incluido `categoriaId: null`), sin redondear, reordenar ni recalcular nada.

### CA-RF18-15 — Un 400 llega como error con el texto del backend

- **Dado** que el backend responde `400` con `message: ["mes debe tener el formato YYYY-MM con un mes del 01 al 12"]`
- **Cuando** se consulta el reporte por categoría
- **Entonces** quien llamó recibe un `ApiError` con status `400` y como mensaje el texto del backend (los mensajes del arreglo unidos con coma).

### CA-RF18-16 — Un 401 cierra la sesión

- **Dado** que el backend responde `401` (token vencido o inválido)
- **Cuando** se consulta el reporte por categoría
- **Entonces** se cierra la sesión local (la app vuelve al login) y quien llamó recibe un `ApiError` con status `401`.
- **Y** si ya no hay sesión (o venció localmente), no se llama al backend.

### CA-RF18-17 — Sin conexión llega como error de red

- **Dado** que la llamada no logra conectar con el servidor
- **Cuando** se consulta el reporte por categoría
- **Entonces** quien llamó recibe un `NetworkError`.

### CA-RF18-18 — Un fallo del servidor llega como error con su status

- **Dado** que el backend responde `500`
- **Cuando** se consulta el reporte por categoría
- **Entonces** quien llamó recibe un `ApiError` con status `500`.

---

## Tarjeta "Egresos por categoría" — carga y errores

### CA-RF18-19 — Mientras carga muestra un indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la tarjeta
- **Entonces** ve el título "Egresos por categoría" y un indicador "Cargando egresos por categoría"; no ve filas, ni un mensaje de vacío, ni un error.

> Decisión (igual que CA-RF17-22): el título se queda visible en la carga y en el error, para que la tarjeta no cambie de forma. Ante un arranque en frío solo se muestra el indicador.
>
> Decisión (aprobada por el desarrollador): el subtítulo "Toca una categoría para ver sus movimientos" no se muestra mientras carga ni en error ni en vacío (no hay nada que tocar). Solo se ve con filas y con `onElegirCategoria` (CA-RF18-29 y CA-RF18-30).

### CA-RF18-20 — Si el servidor falla, avisa en lenguaje sencillo y permite reintentar

- **Dado** que el backend responde con un error (cualquier `ApiError`, por ejemplo `500` o un `400`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar tus egresos por categoría. Inténtalo de nuevo en unos minutos." como aviso (`role="alert"`) y un botón "Reintentar"; no ve filas ni el texto técnico del backend.

> Decisión (aprobada por el desarrollador): el texto sigue el patrón de 3.2.2 ("No pudimos cargar …"). Un `401` no muestra aviso propio: la sesión ya se cerró y la app vuelve al login (como en CA-RF17-23).

### CA-RF18-21 — Si no hay conexión, lo dice y permite reintentar

- **Dado** que la consulta falla por falta de conexión
- **Cuando** el usuario ve la tarjeta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." y un botón "Reintentar".

### CA-RF18-22 — "Reintentar" vuelve a consultar

- **Dado** la tarjeta con el aviso de error y el botón "Reintentar"
- **Cuando** el usuario toca "Reintentar"
- **Entonces** el aviso desaparece, ve de nuevo el indicador de carga, se hace una nueva consulta con el mismo periodo y, si ahora responde, ve las categorías.

### CA-RF18-23 — Doble toque en "Reintentar"

- **Dado** la tarjeta con el aviso de error
- **Cuando** el usuario toca "Reintentar" dos veces seguidas
- **Entonces** se envía una sola solicitud al backend.

---

## Tarjeta "Egresos por categoría" — qué muestra

### CA-RF18-24 — Una fila por categoría, con nombre y monto, en el orden del backend

- **Dado** que el backend responde `total: 2170000` y las categorías Alimentación $780.000, Hogar $520.000, Transporte $380.000, Salud $240.000, Entretenimiento $150.000 y Otros egresos $100.000
- **Cuando** termina de cargar
- **Entonces** ve el título "Egresos por categoría" y, debajo, una fila por categoría, en ese mismo orden, con el nombre y el monto en pesos (`$780.000`: signo de pesos, puntos de miles, sin decimales). No ve el total del periodo ni los porcentajes escritos.
- **Y** el frontend no reordena, ni suma, ni agrupa: si el backend entregara las filas en otro orden, se ven en ese otro orden.

> Decisión (igual que CA-RF17-28): el monto se escribe con el formato de pesos del proyecto (`$780.000`, sin espacio después del signo), aunque el Figma lo dibuje como "$ 780.000".

### CA-RF18-25 — Los montos con decimales se redondean al peso al mostrarlos

- **Dado** que el backend responde una categoría con `total: 780000.4` y otra con `total: 519999.6`
- **Cuando** se muestra la tarjeta
- **Entonces** ve `$780.000` y `$520.000`; el redondeo es solo de presentación.

### CA-RF18-26 — Cada fila tiene una barra con el ancho del porcentaje del backend

- **Dado** que el backend responde Alimentación con `porcentaje: 60`, Hogar con `porcentaje: 30` y Salud con `porcentaje: 10`
- **Cuando** se muestra la tarjeta
- **Entonces** bajo cada fila hay una barra horizontal sobre un riel, y el ancho de cada barra es exactamente ese porcentaje del ancho del riel (60 %, 30 % y 10 %), tomado tal cual del backend: el frontend no calcula proporciones, no las redondea y no las compara con la categoría mayor.
- **Y** un porcentaje con decimales (`33.3333333`) se usa tal como llega.

> Decisión (aprobada por el desarrollador): el Figma dibuja las barras relativas a la categoría mayor (la primera casi llena el riel), pero el backend entrega el `porcentaje` sobre el total, y calcular "relativo a la mayor" sería una cuenta financiera del frontend (RNF-11). Ancho = `porcentaje` del backend, sin cálculo y comprobable sin aritmética; las barras quedan más cortas que en el Figma (Alimentación se vería al 36 %, no casi llena) pero mantienen la proporción real frente al total. El porcentaje no se escribe en pantalla (el Figma no lo muestra). No se fija un ancho mínimo para porcentajes muy chicos. Alternativa descartada por ahora: pedir al backend un campo relativo a la mayor.
>
> Nota para el implementador: para poder comprobarlo, cada barra lleva `testID="barra-categoria"` y su ancho como porcentaje en el estilo (`width: "60%"`); el riel lleva `testID="riel-categoria"`.

### CA-RF18-27 — Los colores de la barra y del riel siguen el modo claro y el oscuro

- **Dado** el sistema en modo claro
- **Cuando** se muestra la tarjeta
- **Entonces** las barras son grafito (#262B32) sobre un riel gris claro (#E3E4E6).
- **Dado** el sistema en modo oscuro
- **Cuando** se muestra la tarjeta
- **Entonces** las barras son blancas (#FFFFFF) sobre un riel #262B32.

> Decisión (aprobada por el desarrollador): el Figma solo define el modo claro (barra grafito sobre riel gris claro). Para oscuro, como en 3.2.2 (CA-RF17-29): la barra pasa a blanco para que no se pierda contra el fondo (#090C11) y el riel toma el color de las líneas guía del modo oscuro (#262B32). Son los mismos colores de `coloresDeGrafica` (la serie para la barra y las líneas para el riel), no colores nuevos.
>
> Nota para el implementador: los colores se aplican como `backgroundColor` en el estilo de la barra y del riel.

### CA-RF18-28 — Cada fila se anuncia con su nombre y su monto

- **Dado** la categoría Alimentación con `total: 780000`
- **Cuando** un lector de pantalla recorre la tarjeta
- **Entonces** encuentra la fila con la etiqueta "Alimentación, $780.000" (monto ya redondeado al peso) y no lee la barra ni el ">" por separado.

### CA-RF18-29 — Con `onElegirCategoria`, cada fila es un botón que avisa qué categoría se tocó

- **Dado** la tarjeta con `onElegirCategoria` y la categoría Alimentación (`categoriaId: "665f1c2e9b1d4a0012ab3a01"`)
- **Cuando** el usuario toca la fila
- **Entonces** se llama a `onElegirCategoria` una vez con `("665f1c2e9b1d4a0012ab3a01", "Alimentación")`.
- **Y** cada fila con categoría se encuentra como botón (con la etiqueta de CA-RF18-28) y lleva el ">" a la derecha del monto; con el subtítulo "Toca una categoría para ver sus movimientos" bajo el título.

> Decisión (aprobada por el desarrollador): hoy Movimientos no filtra por categoría, así que la tarjeta solo avisa y la navegación se cablea después (3.3.1 u otro paquete). Callback opcional; el tocar no necesita protección contra doble toque (no guarda ni elimina), la protección, si hace falta, es de quien navega.

### CA-RF18-30 — Sin `onElegirCategoria`, las filas no son botones

- **Dado** la tarjeta sin `onElegirCategoria`
- **Cuando** el usuario la ve
- **Entonces** las filas no se anuncian como botones, no llevan el ">" y no se ve el subtítulo "Toca una categoría para ver sus movimientos" (no promete algo que no hace); el nombre, el monto y la barra se ven igual.

### CA-RF18-31 — La fila "Sin categoría" se ve como las demás pero no se puede tocar

- **Dado** que el backend responde una entrada `{ categoriaId: null, nombre: "Sin categoría", total: 90000, porcentaje: 9 }` entre otras categorías, y la tarjeta tiene `onElegirCategoria`
- **Cuando** se muestra la tarjeta
- **Entonces** ve "Sin categoría" con `$90.000` y su barra, en la posición que el backend le dio (no se mueve al final).
- **Y** esa fila no es un botón ni lleva ">": tocarla no llama a `onElegirCategoria`; las demás filas siguen siendo botones.

> Decisión (aprobada por el desarrollador): no hay una categoría a la que filtrar los movimientos, así que la fila es informativa: sin botón y sin ">". Alternativa descartada: llamar a `onElegirCategoria(null, "Sin categoría")` y que quien navega decida (hoy no tendría efecto).

### CA-RF18-32 — Un nombre largo se recorta y el monto sigue visible

- **Dado** una categoría con un nombre muy largo (por ejemplo "Gastos varios de la casa, el colegio y las mascotas del mes")
- **Cuando** se muestra la tarjeta
- **Entonces** el nombre ocupa una sola línea (se recorta con puntos suspensivos) y el monto sigue viéndose completo a su derecha; la etiqueta de accesibilidad conserva el nombre completo.

### CA-RF18-33 — Una sola categoría

- **Dado** que el backend responde una única categoría (Alimentación, `total: 780000`, `porcentaje: 100`)
- **Cuando** se muestra la tarjeta
- **Entonces** ve una sola fila con `$780.000` y su barra al 100 % del riel, sin error ni `NaN`.

### CA-RF18-34 — Valores muy distintos entre sí

- **Dado** que el backend responde Alimentación `$9.900.000` (`porcentaje: 99.99`) y Otros egresos `$1.000` (`porcentaje: 0.01`)
- **Cuando** se muestra la tarjeta
- **Entonces** ve las dos filas con sus montos completos, la barra de Alimentación al 99.99 % y la de Otros egresos al 0.01 % (tal como llegan), y ninguna se sale del riel ni del ancho de la pantalla.

### CA-RF18-35 — Todas las categorías que manda el backend, sin agrupar

- **Dado** que el backend responde 15 categorías con gasto
- **Cuando** se muestra la tarjeta
- **Entonces** ve las 15 filas, en el orden recibido; el frontend no las recorta, no deja "las N mayores" y no inventa una fila "Otros".

> Decisión (aprobada por el desarrollador): el backend no agrupa (devuelve todas las categorías con gasto y "Otros egresos" es una categoría real). Se muestran todas y la tarjeta crece (el número de categorías del usuario es acotado y la tarjeta está dentro de una pantalla con scroll). Alternativa descartada: topar a las N mayores con un "ver todas", pero eso exige agrupar o sumar en el frontend y una pantalla que el Figma no define.

### CA-RF18-36 — Sin egresos, un aviso sencillo

- **Dado** que el backend responde `200` con `total: 0` y `categorias: []`
- **Cuando** termina de cargar
- **Entonces** ve el título "Egresos por categoría" y el aviso "No hay egresos en este periodo.", sin filas, sin subtítulo, sin `NaN` y sin error.
- **Y** lo mismo ocurre si llega `total: 0` aunque la lista traiga entradas (no se dibujan barras con un total en cero).

> Decisión (aprobada por el desarrollador): el Figma no trae estado vacío. El aviso es "No hay egresos en este periodo." (más preciso que "No hay movimientos…", porque la tarjeta solo habla de egresos). Un periodo con solo ingresos también cae aquí.

### CA-RF18-37 — Dos categorías con el mismo nombre se muestran las dos

- **Dado** que el backend responde dos categorías distintas (ids distintos) llamadas "Otros", una general y una personal
- **Cuando** se muestra la tarjeta
- **Entonces** ve las dos filas, cada una con su monto; con `onElegirCategoria`, tocar cada una avisa su propio `categoriaId`.

---

## Tarjeta "Egresos por categoría" — el periodo

### CA-RF18-38 — La tarjeta pide el periodo que recibe

- **Dado** la tarjeta con `mes="2026-09"`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/categorias?mes=2026-09`.
- **Dado** la tarjeta con `desde="2026-10-10"` y `hasta="2026-10-20"`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/categorias?desde=2026-10-10&hasta=2026-10-20`.
- **Dado** la tarjeta sin `mes`, `desde` ni `hasta`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/categorias` sin parámetros (el mes actual lo decide el backend) y se hace una sola consulta.

### CA-RF18-39 — Al cambiar el periodo se pide de nuevo

- **Dado** la tarjeta mostrando las categorías de `2026-09`
- **Cuando** el periodo cambia a `2026-10`
- **Entonces** se hace una nueva consulta con `mes=2026-10`, mientras llega ve el indicador de carga (no las categorías de septiembre como si fueran de octubre) y después ve las categorías nuevas.
- **Y** lo mismo ocurre al cambiar de un mes a un rango, o al cambiar `desde` o `hasta`.

### CA-RF18-40 — Una respuesta vieja no pisa la nueva

- **Dado** que se pidió `2026-09` y, antes de que responda, el periodo cambió a `2026-10`
- **Cuando** la respuesta de septiembre llega después que la de octubre (o llega al final)
- **Entonces** la tarjeta sigue mostrando solo las categorías de octubre; la respuesta de septiembre se ignora, y tampoco un error de la consulta vieja reemplaza lo que se ve.

---

## Resumen

- Criterios: 30 (CA-RF18-11 a CA-RF18-40): adaptador 8 (11 a 18), carga y errores 5 (19 a 23), qué muestra 14 (24 a 37), periodo 3 (38 a 40).
- Decisiones aprobadas por el desarrollador: (a) ancho de la barra = `porcentaje` del backend, no relativo a la mayor (CA-RF18-26); (b) callback opcional `onElegirCategoria(categoriaId, nombre)`; sin él, las filas no son botones, sin ">" ni subtítulo (CA-RF18-29 y 30); (c) "Sin categoría" informativa, sin botón (CA-RF18-31); (d) todas las categorías, sin agrupar (CA-RF18-35); (e) vacío "No hay egresos en este periodo." (CA-RF18-36); (f) colores en oscuro: barra blanca y riel #262B32 (CA-RF18-27). Además, los textos de carga y error (CA-RF18-19 a 21) y el subtítulo visible solo con filas y callback.
- Cambios que pide a código existente: `lib/api/reportes.ts` gana `obtenerReporteCategorias`; el hook de carga de 3.2.2 (`useReportePeriodo`) está atado a `obtenerReportePeriodo`, así que el implementador decide si lo generaliza o crea uno propio (no se prueba directamente, solo lo que se ve). Sin cambios a `GraficaDona` ni a `GraficaBarras`.
