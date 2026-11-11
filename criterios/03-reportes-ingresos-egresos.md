# Criterios de aceptación — 3. Reportes y visualización: gráfica de ingresos vs egresos (paquete 3.2.2)

Estado: Aprobado

Cubre RF-17 (gráfica de barras de ingresos contra egresos) en el frontend: el adaptador `GET /reportes/periodo` y la tarjeta "Ingresos vs egresos". El criterio de la EDT es: "La gráfica refleja de forma correcta los datos agregados del backend". El backend calcula todo (RNF-11): aquí solo se verifica qué se pide, qué se muestra y cómo se redondea al peso.

**Fuera de este paquete:**
- El selector de mes o rango y el dashboard (paquete 3.3.1): la tarjeta recibe el periodo por props.
- Las gráficas de dona (3.2.3) y de línea (3.2.4), y la comparación entre periodos.
- El envío del header `X-Zona-Horaria`: ya lo cubre `criterios/03-zona-horaria.md`.
- Valores negativos: aquí no hay (ingresos y egresos son >= 0; el balance negativo no se muestra en esta tarjeta).

**Fuentes:** Swagger del backend (`GET /reportes/periodo`), `backend/criterios/03-reportes.md`, Figma sección 05 · Reportes, frame "Reportes — Mes" (tarjeta blanca con título "Ingresos vs egresos"; dos barras verticales: Ingresos en grafito oscuro, ejemplo $ 3.400.000, y Egresos en gris, ejemplo $ 2.150.000; el valor va encima de cada barra y la etiqueta debajo), criterios de `03-graficas.md` (3.2.1) y el patrón de carga y error de `ListaDeCategorias` y de Movimientos.

**Contrato del backend que importa aquí (`GET /reportes/periodo`, con sesión):**
- Query opcional: `mes` (`YYYY-MM`) **o** `desde` + `hasta` (`YYYY-MM-DD`, ambos incluidos y siempre juntos). Sin ninguno, el backend usa el mes actual según el header `X-Zona-Horaria`.
- `200`: `{ desde, hasta, ingresos, egresos, pagosTarjeta, abonosDeuda, dineroRecibido, balance }`. Los montos pueden traer decimales (ej. `119802.13`); el redondeo al peso lo hace el cliente. Un periodo sin movimientos responde `200` con todo en `0`, no un error.
- `400` con `message` como arreglo (parámetros inválidos), `401` (sesión), `500` (fallo inesperado).

**Interfaz pública** (nombres fijados por el desarrollador al aprobar los criterios):
- Adaptador: `obtenerReportePeriodo(periodo?)` en `lib/api/reportes.ts`, con `periodo` igual a `{ mes: 'YYYY-MM' }`, `{ desde, hasta }` o sin argumento. Devuelve la respuesta del backend tal cual (tipo `ReportePeriodo`).
- Componente: `TarjetaIngresosEgresos` en `components/reportes/tarjeta-ingresos-egresos.tsx`, con las props opcionales `mes`, `desde` y `hasta`. Reutiliza `GraficaBarras`.

**Sobre los IDs:** continúan la numeración RF-17 de `03-graficas.md` (que llegó hasta CA-RF17-13). Las notas "Decisión" recogen comportamientos o textos que el Figma no define y que el desarrollador aprobó.

---

## Adaptador — `GET /reportes/periodo`

### CA-RF17-14 — Sin periodo se pide el mes actual

- **Dado** una sesión vigente
- **Cuando** se consulta el reporte del periodo sin indicar mes ni rango
- **Entonces** se envía un `GET /reportes/periodo` sin parámetros de consulta, con `Authorization: Bearer <JWT propio>`, y el backend decide el mes actual.

### CA-RF17-15 — Un mes concreto se envía como `mes`

- **Dado** una sesión vigente
- **Cuando** se consulta el reporte de `2026-09`
- **Entonces** se envía `GET /reportes/periodo?mes=2026-09` y no se envían `desde` ni `hasta`.

### CA-RF17-16 — Un rango se envía como `desde` y `hasta`

- **Dado** una sesión vigente
- **Cuando** se consulta el reporte del rango 2026-10-10 a 2026-10-20
- **Entonces** se envía `GET /reportes/periodo?desde=2026-10-10&hasta=2026-10-20` y no se envía `mes`.

### CA-RF17-17 — La respuesta llega tal como la manda el backend

- **Dado** que el backend responde `200` con `{ desde: "2026-10-01", hasta: "2026-10-31", ingresos: 2800000, egresos: 1379700.5, pagosTarjeta: 119802.13, abonosDeuda: 200000, dineroRecibido: 1000000, balance: 1100497.37 }`
- **Cuando** el adaptador devuelve el resultado
- **Entonces** entrega los ocho campos con los mismos valores, sin redondear ni recalcular nada (el redondeo es de quien muestra el dato).

### CA-RF17-18 — Un 400 llega como error con el texto del backend

- **Dado** que el backend responde `400` con `message: ["mes debe tener el formato YYYY-MM con un mes del 01 al 12"]`
- **Cuando** se consulta el reporte
- **Entonces** quien llamó recibe un `ApiError` con status `400` y como mensaje el texto del backend (los mensajes del arreglo unidos con coma).

### CA-RF17-19 — Un 401 cierra la sesión

- **Dado** que el backend responde `401` (token vencido o inválido)
- **Cuando** se consulta el reporte
- **Entonces** se cierra la sesión local (la app vuelve al login) y quien llamó recibe un `ApiError` con status `401`.
- **Y** si ya no hay sesión (o venció localmente), no se llama al backend.

### CA-RF17-20 — Sin conexión llega como error de red

- **Dado** que la llamada no logra conectar con el servidor
- **Cuando** se consulta el reporte
- **Entonces** quien llamó recibe un `NetworkError`.

### CA-RF17-21 — Un fallo del servidor llega como error con su status

- **Dado** que el backend responde `500`
- **Cuando** se consulta el reporte
- **Entonces** quien llamó recibe un `ApiError` con status `500`.

---

## Tarjeta "Ingresos vs egresos" — carga y errores

### CA-RF17-22 — Mientras carga muestra un indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la tarjeta
- **Entonces** ve el título "Ingresos vs egresos" y un indicador "Cargando ingresos y egresos"; no ve la gráfica, ni un mensaje de vacío, ni un error.

> Decisión (aprobada por el desarrollador): el título se queda visible en la carga y en el error, para que la tarjeta no cambie de forma. Ante un arranque en frío solo se muestra el indicador, como en Categorías y Movimientos (no hay aviso adicional si la espera es larga).

### CA-RF17-23 — Si el servidor falla, avisa en lenguaje sencillo y permite reintentar

- **Dado** que el backend responde con un error (cualquier `ApiError`, por ejemplo `500` o un `400`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar tus ingresos y egresos. Inténtalo de nuevo en unos minutos." como aviso (`role="alert"`) y un botón "Reintentar"; no ve la gráfica ni el texto técnico del backend.

> Decisión (aprobada por el desarrollador): el texto sigue el patrón de las otras pantallas ("No pudimos cargar …"). Un `401` no muestra aviso propio: la sesión ya se cerró y la app vuelve al login.

### CA-RF17-24 — Si no hay conexión, lo dice y permite reintentar

- **Dado** que la consulta falla por falta de conexión
- **Cuando** el usuario ve la tarjeta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." y un botón "Reintentar".

### CA-RF17-25 — "Reintentar" vuelve a consultar

- **Dado** la tarjeta con el aviso de error y el botón "Reintentar"
- **Cuando** el usuario toca "Reintentar"
- **Entonces** el aviso desaparece, ve de nuevo el indicador de carga, se hace una nueva consulta con el mismo periodo y, si ahora responde, ve la gráfica.

### CA-RF17-26 — Doble toque en "Reintentar"

- **Dado** la tarjeta con el aviso de error
- **Cuando** el usuario toca "Reintentar" dos veces seguidas
- **Entonces** se envía una sola solicitud al backend.

> Decisión (aprobada por el desarrollador): el botón no guarda ni elimina, pero una consulta repetida no aporta nada y en un arranque en frío empeora la espera.

---

## Tarjeta "Ingresos vs egresos" — qué muestra

### CA-RF17-27 — Dos barras: Ingresos y Egresos, con los valores del backend

- **Dado** que el backend responde `ingresos: 3400000` y `egresos: 2150000`
- **Cuando** termina de cargar
- **Entonces** ve el título "Ingresos vs egresos" y una gráfica de barras con exactamente dos barras, en este orden: "Ingresos" (3.400.000) y "Egresos" (2.150.000). La gráfica recibe los valores tal como llegaron, sin sumarlos, restarlos ni ordenarlos.

### CA-RF17-28 — El valor en pesos va sobre cada barra y la etiqueta debajo

- **Dado** los mismos datos
- **Cuando** el usuario mira la gráfica
- **Entonces** ve `$3.400.000` sobre la barra de Ingresos y `$2.150.000` sobre la de Egresos (signo de pesos, puntos de miles, sin decimales), y debajo de cada barra su etiqueta, "Ingresos" y "Egresos".

> Nota para el implementador: hoy `GraficaBarras` solo escribe las etiquetas y el eje de valores; mostrar el valor encima de cada barra es un cambio de ese componente. Debe seguir cumpliendo CA-RF17-02, 03 y 04 de `03-graficas.md`.

### CA-RF17-29 — Cada barra tiene su propio color

- **Dado** el sistema en modo claro
- **Cuando** se muestra la gráfica
- **Entonces** la barra de Ingresos es grafito (#262B32) y la de Egresos gris (#757B81), distintas entre sí (como en el Figma, no amarillas como la gráfica de prueba).
- **Dado** el sistema en modo oscuro
- **Cuando** se muestra la gráfica
- **Entonces** la barra de Ingresos es blanca (#FFFFFF) y la de Egresos sigue gris (#757B81).

> Decisión (aprobada por el desarrollador): el Figma solo define el modo claro. En oscuro el grafito (#262B32) se pierde contra el fondo (#090C11), así que Ingresos va en blanco, igual que la dona de 3.2.1 cambia su segundo color a blanco (CA-RF18-07); Egresos sigue en #757B81.
>
> Nota para el implementador: hoy `GraficaBarras` pinta todas las barras con el acento amarillo; necesita aceptar un color por barra sin cambiar el comportamiento por defecto (CA-RF17-05).

### CA-RF17-30 — Los valores con decimales se redondean al peso al mostrarlos

- **Dado** que el backend responde `ingresos: 3400000.4` y `egresos: 2150000.6`
- **Cuando** se muestra la tarjeta
- **Entonces** ve `$3.400.000` y `$2.150.001`; el redondeo es solo de presentación (la gráfica recibe los valores como llegaron).

### CA-RF17-31 — Solo ingresos y egresos: ningún otro total

- **Dado** que el backend responde también `pagosTarjeta`, `abonosDeuda`, `dineroRecibido` y `balance` con valores distintos de cero
- **Cuando** se muestra la tarjeta
- **Entonces** no ve ninguno de esos montos ni los textos "Balance", "Pagos de tarjeta", "Abonos" o "Dinero recibido": la tarjeta solo habla de Ingresos y Egresos.

> Decisión (aprobada por el desarrollador): el "dinero recibido" (préstamos y avances, ADR-014) se informa aparte; NO aparece en esta tarjeta, como en el Figma, y lo muestra el dashboard o el reporte en su propio indicador.

### CA-RF17-32 — La gráfica se anuncia con los dos valores

- **Dado** que el backend responde `ingresos: 3400000` y `egresos: 2150000`
- **Cuando** un lector de pantalla recorre la tarjeta
- **Entonces** encuentra la gráfica como una imagen con la etiqueta "Ingresos de $3.400.000 y egresos de $2.150.000" (valores ya redondeados al peso).

### CA-RF17-33 — Solo un valor en cero

- **Dado** que el backend responde `ingresos: 0` y `egresos: 500000`
- **Cuando** se muestra la tarjeta
- **Entonces** ve las dos barras con sus etiquetas, `$0` sobre Ingresos y `$500.000` sobre Egresos, sin `NaN` ni mensaje de vacío. Con `ingresos: 800000` y `egresos: 0` pasa lo mismo al revés.

### CA-RF17-34 — Valores muy distintos entre sí

- **Dado** que el backend responde `ingresos: 10000000` y `egresos: 1000`
- **Cuando** se muestra la tarjeta
- **Entonces** ve `$10.000.000` y `$1.000` con sus etiquetas, la gráfica recibe ambos valores sin cambiarlos (la escala la pone la gráfica) y sigue cabiendo en el ancho de la pantalla (CA-RF17-04 de `03-graficas.md`).

### CA-RF17-35 — Sin ingresos ni egresos, un aviso sencillo

- **Dado** que el backend responde `200` con `ingresos: 0` y `egresos: 0`
- **Cuando** termina de cargar
- **Entonces** ve el título "Ingresos vs egresos" y el aviso "No hay movimientos en este periodo.", sin la gráfica, sin `NaN` y sin error.

> Decisión (aprobada por el desarrollador): el Figma no trae estado vacío ni 3.2.1 define mensajes. Se usa el mismo texto que ya usa Movimientos ("No hay movimientos en este periodo.") y se oculta la gráfica (dos barras de altura cero no dicen nada). Además cuenta como vacío aunque `pagosTarjeta`, `abonosDeuda` o `dineroRecibido` no sean cero, porque la tarjeta solo habla de ingresos y egresos.

---

## Tarjeta "Ingresos vs egresos" — el periodo

### CA-RF17-36 — La tarjeta pide el periodo que recibe

- **Dado** la tarjeta con `mes="2026-09"`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/periodo?mes=2026-09`.
- **Dado** la tarjeta con `desde="2026-10-10"` y `hasta="2026-10-20"`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/periodo?desde=2026-10-10&hasta=2026-10-20`.
- **Dado** la tarjeta sin `mes`, `desde` ni `hasta`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/periodo` sin parámetros (el mes actual lo decide el backend) y se hace una sola consulta.

### CA-RF17-37 — Al cambiar el periodo se pide de nuevo

- **Dado** la tarjeta mostrando la gráfica de `2026-09`
- **Cuando** el periodo cambia a `2026-10`
- **Entonces** se hace una nueva consulta con `mes=2026-10`, mientras llega ve el indicador de carga (no los datos de septiembre como si fueran de octubre) y después ve la gráfica con los datos nuevos.
- **Y** lo mismo ocurre al cambiar de un mes a un rango, o al cambiar `desde` o `hasta`.

### CA-RF17-38 — Una respuesta vieja no pisa la nueva

- **Dado** que se pidió `2026-09` y, antes de que responda, el periodo cambió a `2026-10`
- **Cuando** la respuesta de septiembre llega después que la de octubre (o llega al final)
- **Entonces** la tarjeta sigue mostrando solo los datos de octubre; la respuesta de septiembre se ignora, y tampoco un error de la consulta vieja reemplaza lo que se ve.

---

## Resumen

- Criterios: 25 (CA-RF17-14 a CA-RF17-38): adaptador 8 (14 a 21), carga y errores 5 (22 a 26), qué muestra 9 (27 a 35), periodo 3 (36 a 38).
- Decisiones aprobadas: (1) colores de las barras en modo oscuro, blanco para Ingresos (CA-RF17-29); (2) el dinero recibido no aparece en esta tarjeta (CA-RF17-31); (3) estado vacío: texto "No hay movimientos en este periodo." y gráfica oculta (CA-RF17-35).
- Propuestas sin Figma, aprobadas: título visible durante carga y error (CA-RF17-22), texto del error del servidor (CA-RF17-23) y doble toque en "Reintentar" (CA-RF17-26).
- Cambios que pide a código existente: `GraficaBarras` debe mostrar el valor sobre cada barra y aceptar un color por barra (CA-RF17-28 y 29), sin romper los criterios de 3.2.1.
