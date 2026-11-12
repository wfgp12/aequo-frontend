# Criterios de aceptación — 3. Reportes y visualización: evolución del balance (paquete 3.2.4)

Estado: Aprobado

Cubre RF-19 (evolución del balance en el tiempo, gráfica de línea) en el frontend: el adaptador `GET /reportes/evolucion` y la tarjeta "Evolución del balance". El criterio de la EDT es: "El componente refleja los datos agregados del backend". El backend calcula todo (RNF-11): aquí solo se verifica qué se pide, qué se muestra y cómo se redondea al peso.

**Fuera de este paquete:**
- El selector de mes o rango y el dashboard (paquete 3.3.1): la tarjeta recibe el mes final por props.
- La comparación entre periodos (`GET /reportes/comparacion`, RF-15 y RF-16).
- La evolución del ahorro (la da `GET /ahorro/acumulado`; esta tarjeta es solo del balance).
- El header `X-Zona-Horaria`: el cliente ya lo envía siempre (`criterios/03-zona-horaria.md`) y este endpoint lo ignora; no se prueba aquí.
- Cualquier suma, acumulado, promedio o relleno de meses calculado en el frontend.

**Fuentes:** contrato PROPUESTO por arquitecto-back en `coordinacion/contratos/reportes-comparacion-evolucion.md` y sus criterios (`backend/criterios/03-reportes-comparacion-evolucion.md`, CA-RF19-01 a 17), todavía no mezclado en el backend: **cuando el Swagger de `GET /reportes/evolucion` esté publicado hay que contrastar estos criterios con él**. Figma sección 05 · Reportes, frame "Reportes — Mes (v2…)": tarjeta blanca con título "Evolución del balance", subtítulo gris "Últimos 6 meses hasta septiembre", una línea oscura con un punto por mes (6 puntos) y, debajo, las etiquetas de mes en minúscula abreviada ("abr", "may", "jun", "jul", "ago", "sep"); el Figma no muestra valores ni eje en pesos. Criterios de `03-graficas.md` (3.2.1, `GraficaLinea`) y el patrón de carga y error de `03-reportes-ingresos-egresos.md` (3.2.2) y `03-reportes-por-categoria.md` (3.2.3).

**Contrato del backend que importa aquí (`GET /reportes/evolucion`, con sesión):**
- Query opcional: `desde` y `hasta` en `YYYY-MM` (mes, ambos incluidos), independientes entre sí. Máximo 120 meses; `desde` posterior a `hasta` → `400` con `desde no puede ser posterior a hasta`; parámetros desconocidos → `400`. No usa `X-Zona-Horaria`. **Ojo:** estos meses son `YYYY-MM`, distintos del `PeriodoReporte` de `/reportes/periodo` y `/reportes/categorias` (`{ mes }` o `{ desde, hasta }` en `YYYY-MM-DD`).
- `200`: `{ desde: "YYYY-MM" | null, hasta: "YYYY-MM" | null, puntos: [{ periodo: "YYYY-MM", balance: number }] }`.
  - Con `desde` y `hasta` enviados, `puntos` trae **siempre un punto por cada mes del rango** (6 puntos para 6 meses), del más antiguo al más reciente, con `balance: 0` en los meses sin movimientos, también en los previos al primer movimiento del usuario. Basta un movimiento dentro del rango para que lleguen todos (confirmado por el backend).
  - Si el rango pedido no contiene ningún movimiento: `puntos: []` (con `desde` y `hasta` tal como se enviaron). Usuario sin movimientos y sin rango: `{ desde: null, hasta: null, puntos: [] }`.
  - `balance` del mes = ingresos − egresos − pagos de tarjeta − abonos a deuda (el dinero recibido no suma). **Puede ser negativo** y viene sin redondear (ej. `-250000`, `699.7`); el redondeo al peso lo hace el cliente.
- `400` (`message` como arreglo), `401` (sesión), `500` (fallo inesperado).

**Interfaz pública (aprobada por el desarrollador; las pruebas la fijan con estos nombres):**
- Adaptador: `obtenerReporteEvolucion(periodo?: { desde?: string; hasta?: string })` en `lib/api/reportes.ts` (`YYYY-MM`; sin argumento o con un objeto vacío no se envía consulta). Devuelve la respuesta del backend tal cual (tipo `ReporteEvolucion = { desde: string | null; hasta: string | null; puntos: PuntoEvolucion[] }`, con `PuntoEvolucion = { periodo: string; balance: number }`).
- Componente: `TarjetaEvolucionBalance` en `components/reportes/tarjeta-evolucion-balance.tsx`, con la prop opcional `mes` (`YYYY-MM`, el mes final). Reutiliza `GraficaLinea`.
- Cambios a código existente: (1) `GraficaLinea` gana las props opcionales `color` (línea y puntos; sin ella sigue el amarillo de 3.2.1) y `margenExtra` (como `GraficaBarras`); (2) `pesos` (`components/graficas/use-tema-grafica.ts`) escribe los negativos como `-$1.500.000` (CA-RF19-29); `formatearPesos` de `lib/dinero.ts` no cambia; (3) tres funciones de presentación en `lib/fechas.ts`, todas con meses `YYYY-MM`: `mesCorto(periodo)` devuelve la abreviatura en minúscula ("2026-04" → "abr"), `restarMeses(periodo, cantidad)` devuelve el mes `cantidad` meses antes ("2026-09", 5 → "2026-04") y `mesActual(ahora = new Date())` devuelve el mes de la fecha local del dispositivo ("2026-11"). Para el nombre completo del mes se reutiliza `nombreDelMes` (ya existe).

**Sobre los IDs:** continúan la numeración RF-19 de `03-graficas.md` (que llegó hasta CA-RF19-08). Las notas "Decisión (aprobada por el desarrollador)" recogen lo que el Figma no define.

---

## Adaptador — `GET /reportes/evolucion`

### CA-RF19-09 — Sin periodo se pide la evolución completa

- **Dado** una sesión vigente
- **Cuando** se consulta la evolución sin indicar `desde` ni `hasta`
- **Entonces** se envía un `GET /reportes/evolucion` sin parámetros de consulta, con `Authorization: Bearer <JWT propio>`.

### CA-RF19-10 — Un rango de meses se envía como `desde` y `hasta`

- **Dado** una sesión vigente
- **Cuando** se consulta la evolución de `desde: "2026-04"` a `hasta: "2026-09"`
- **Entonces** se envía `GET /reportes/evolucion?desde=2026-04&hasta=2026-09`.

### CA-RF19-11 — Cada extremo se envía por separado y lo que falta no se envía

- **Dado** una sesión vigente
- **Cuando** se consulta solo con `desde: "2026-04"`
- **Entonces** se envía `GET /reportes/evolucion?desde=2026-04` y no `hasta`.
- **Cuando** se consulta solo con `hasta: "2026-09"`
- **Entonces** se envía `GET /reportes/evolucion?hasta=2026-09` y no `desde`.
- **Y** un extremo pasado como `undefined` (por ejemplo `{ desde: undefined, hasta: "2026-09" }`) no se envía: nunca aparece el texto `undefined` en la URL.

### CA-RF19-12 — La respuesta llega tal como la manda el backend

- **Dado** que el backend responde `200` con `{ desde: "2026-07", hasta: "2026-10", puntos: [{ periodo: "2026-07", balance: 2000000 }, { periodo: "2026-08", balance: 0 }, { periodo: "2026-09", balance: -250000.5 }, { periodo: "2026-10", balance: 699.7 }] }`
- **Cuando** el adaptador devuelve el resultado
- **Entonces** entrega `desde`, `hasta` y los cuatro puntos con `periodo` y `balance` iguales, en el mismo orden (incluido el balance negativo y los decimales), sin redondear, reordenar, rellenar meses ni recalcular nada.

### CA-RF19-13 — Sin movimientos llega vacío, no como error

- **Dado** que el backend responde `200` con `{ desde: null, hasta: null, puntos: [] }`, o con `{ desde: "2026-04", hasta: "2026-09", puntos: [] }`
- **Cuando** el adaptador devuelve el resultado
- **Entonces** entrega esa respuesta tal cual (`puntos` vacío, `desde` y `hasta` nulos o los enviados) y no lanza error.

### CA-RF19-14 — Un 400 llega como error con el texto del backend

- **Dado** que el backend responde `400` con `message: ["desde no puede ser posterior a hasta"]`
- **Cuando** se consulta la evolución
- **Entonces** quien llamó recibe un `ApiError` con status `400` y como mensaje el texto del backend (los mensajes del arreglo unidos con coma).

### CA-RF19-15 — Un 401 cierra la sesión

- **Dado** que el backend responde `401` (token vencido o inválido)
- **Cuando** se consulta la evolución
- **Entonces** se cierra la sesión local (la app vuelve al login) y quien llamó recibe un `ApiError` con status `401`.
- **Y** si ya no hay sesión (o venció localmente), no se llama al backend.

### CA-RF19-16 — Sin conexión llega como error de red

- **Dado** que la llamada no logra conectar con el servidor
- **Cuando** se consulta la evolución
- **Entonces** quien llamó recibe un `NetworkError`.

### CA-RF19-17 — Un fallo del servidor llega como error con su status

- **Dado** que el backend responde `500`
- **Cuando** se consulta la evolución
- **Entonces** quien llamó recibe un `ApiError` con status `500`.

---

## Tarjeta "Evolución del balance" — carga y errores

### CA-RF19-18 — Mientras carga muestra un indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la tarjeta
- **Entonces** ve el título "Evolución del balance" y un indicador "Cargando evolución del balance"; no ve la gráfica, ni un mensaje de vacío, ni un error.

> Decisión (aprobada por el desarrollador; igual que CA-RF17-22 y CA-RF18-19): el título se queda visible en la carga y en el error, para que la tarjeta no cambie de forma.

### CA-RF19-19 — Si el servidor falla, avisa en lenguaje sencillo y permite reintentar

- **Dado** que el backend responde con un error (cualquier `ApiError`, por ejemplo `500` o un `400`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar la evolución de tu balance. Inténtalo de nuevo en unos minutos." como aviso (`role="alert"`) y un botón "Reintentar"; no ve la gráfica ni el texto técnico del backend.

> Decisión (aprobada por el desarrollador): el texto sigue el patrón "No pudimos cargar …" de 3.2.2 y 3.2.3. Un `401` no muestra aviso propio: la sesión ya se cerró y la app vuelve al login.

### CA-RF19-20 — Si no hay conexión, lo dice y permite reintentar

- **Dado** que la consulta falla por falta de conexión
- **Cuando** el usuario ve la tarjeta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." y un botón "Reintentar".

### CA-RF19-21 — "Reintentar" vuelve a consultar

- **Dado** la tarjeta con el aviso de error y el botón "Reintentar"
- **Cuando** el usuario toca "Reintentar"
- **Entonces** el aviso desaparece, ve de nuevo el indicador de carga, se hace una nueva consulta con el mismo rango de meses y, si ahora responde, ve la gráfica.

### CA-RF19-22 — Doble toque en "Reintentar"

- **Dado** la tarjeta con el aviso de error
- **Cuando** el usuario toca "Reintentar" dos veces seguidas
- **Entonces** se envía una sola solicitud al backend.

---

## Tarjeta "Evolución del balance" — qué muestra

### CA-RF19-23 — Título y subtítulo con el mes final

- **Dado** la tarjeta con `mes="2026-09"`
- **Cuando** se muestra (cargando, con error, vacía o con datos)
- **Entonces** ve el título "Evolución del balance" y bajo él el subtítulo "Últimos 6 meses hasta septiembre".
- **Y** con `mes="2026-02"` el subtítulo dice "Últimos 6 meses hasta febrero" (el nombre del mes final, en minúscula y sin año).

> Decisión (aprobada por el desarrollador): el subtítulo del Figma describe el periodo de la tarjeta, así que se ve siempre (también en carga, error y vacío, donde "estos meses" del aviso vacío se refiere a él). No lleva año, como en el Figma; el año lo mostrará el selector de 3.3.1.

### CA-RF19-24 — Un punto por mes, en el orden del backend, con la etiqueta del mes

- **Dado** que el backend responde seis puntos `2026-04` a `2026-09` con balances 1.200.000, 0, -300.000, 450.000, 800.000 y 1.500.000
- **Cuando** termina de cargar
- **Entonces** la gráfica de línea recibe seis puntos, en el mismo orden, con los valores tal como llegaron (sin sumarlos, acumularlos, reordenarlos ni suavizarlos) y con las etiquetas "abr", "may", "jun", "jul", "ago" y "sep".

### CA-RF19-25 — Las etiquetas son el mes abreviado, en minúscula y sin año

- **Dado** puntos de los doce meses (`2026-01` a `2026-12`)
- **Cuando** se muestra la tarjeta
- **Entonces** las etiquetas son "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov" y "dic", tomadas del `periodo` de cada punto.
- **Y** si la serie cruza el año (`2025-09` a `2026-02`) las etiquetas son "sep", "oct", "nov", "dic", "ene" y "feb", en ese orden, sin año.

> Decisión (aprobada por el desarrollador): las etiquetas no llevan año aunque el rango cruce de año; son seis puntos seguidos y el año de los extremos va en la descripción de accesibilidad (CA-RF19-31) y en el selector de 3.3.1.

### CA-RF19-26 — Los meses sin movimientos se dibujan en cero, no como hueco

- **Dado** que el backend responde seis puntos y dos de ellos (`2026-05` y `2026-08`) traen `balance: 0`
- **Cuando** se muestra la tarjeta
- **Entonces** la gráfica recibe los seis puntos, y esos dos con valor 0 y su etiqueta ("may", "ago"); el frontend no los quita, no los une ni los deja sin valor.

### CA-RF19-27 — El eje de valores se lee en pesos

- **Dado** la tarjeta con datos
- **Cuando** la gráfica pide el texto de una marca del eje vertical (por ejemplo 1500000, 0 o 1234.6)
- **Entonces** se escribe `$1.500.000`, `$0` y `$1.235` (signo de pesos, puntos de miles, sin decimales; redondeado al peso solo al mostrar).

> Decisión (aprobada por el desarrollador): el Figma no dibuja valores ni eje en pesos, pero sin ellos un balance no se puede leer (RNF-06) y el eje en pesos es lo que ya hace `GraficaLinea` (CA-RF19-03). No se muestra el valor sobre cada punto ni al tocarlo (seis valores encima de una línea en 360 px no caben; ver CA-RF19-31 para lectores de pantalla). Desviación del Figma aprobada.

### CA-RF19-28 — Un balance negativo se dibuja bajo cero y se escribe con el signo delante

- **Dado** que el backend responde un mes con `balance: -250000` entre otros con valores positivos
- **Cuando** se muestra la tarjeta
- **Entonces** la gráfica recibe ese punto con el valor `-250000` (no se corta en cero, no se convierte en valor absoluto ni se esconde) y, si la gráfica pide la marca del eje -250000, se escribe `-$250.000`.
- **Y** con un balance con decimales negativo (`-1234.6`) la marca se escribe `-$1.235`.

> Decisión (aprobada por el desarrollador): la librería calcula sola el rango del eje con negativos; lo comprobable es lo que se le entrega (valores sin tocar) y el texto del eje. La línea cruzando el cero se revisa a ojo en `/dev-graficas` (web e iPhone); no hay prueba automática de eso.

### CA-RF19-29 — `pesos` escribe los negativos como `-$1.500.000`

- **Dado** el formato de pesos de las gráficas (`pesos`)
- **Cuando** recibe `-1500000`, `-250000.6`, `-0.4` y `0`
- **Entonces** escribe `-$1.500.000`, `-$250.001`, `$0` y `$0` (el signo "menos" va antes del signo de pesos; un valor que se redondea a cero no lleva signo).
- **Y** los valores positivos siguen igual que antes (`$1.200.000`, `$1.235`), de modo que las otras gráficas (barras, dona, `GraficaLinea` de 3.2.1) no cambian.

> Decisión (aprobada por el desarrollador; cierra el pendiente de 3.2.1, "Valores negativos"): la corrección va en `pesos` (`use-tema-grafica.ts`), que es el formato de pesos de todas las gráficas y hoy da `$-1.500.000`. `formatearPesos` (`lib/dinero.ts`) no se toca: lo usan formularios y listas que escriben el número sin signo. Un valor que se redondea a 0 no lleva signo.
>
> Nota: el caso del medio exacto negativo (`-250000.5`, que `Math.round` lleva a `-250000`) no se fija aquí; las pruebas usan `-250000.6` para no depender de ese detalle.

### CA-RF19-30 — La línea y los puntos usan el color de la tarjeta, en modo claro y oscuro

- **Dado** el sistema en modo claro
- **Cuando** se muestra la tarjeta con datos
- **Entonces** la línea y sus puntos son grafito (#262B32), y el texto de los ejes y las líneas guía usan los grises de siempre (#757B81 y #E3E4E6).
- **Dado** el sistema en modo oscuro
- **Cuando** se muestra la tarjeta con datos
- **Entonces** la línea y sus puntos son blancos (#FFFFFF), y el texto de los ejes y las líneas guía usan los grises del modo oscuro (#A6A9AE y #262B32).
- **Y** una `GraficaLinea` sin color propio (como en 3.2.1 y `/dev-graficas`) sigue en amarillo (#FFD300), sin cambios (CA-RF19-05).

> Decisión (aprobada por el desarrollador): el Figma solo define el modo claro (línea oscura). En oscuro el grafito se pierde contra el fondo (#090C11), así que pasa a blanco, igual que la barra de Ingresos (CA-RF17-29) y la barra de categorías (CA-RF18-27). Es el segundo color de la serie de `coloresDeGrafica` (#262B32 claro, #FFFFFF oscuro), no un color nuevo. `GraficaLinea` acepta un color de línea y de puntos (prop `color`); si el relleno bajo la línea se conserva o no, no se prueba.

### CA-RF19-31 — La gráfica se anuncia con el rango de meses

- **Dado** la tarjeta con `mes="2026-09"` y datos
- **Cuando** un lector de pantalla recorre la tarjeta
- **Entonces** encuentra la gráfica como una imagen con la etiqueta "Evolución del balance de abril a septiembre".
- **Y** si el rango cruza el año (`mes="2026-02"`), la etiqueta lleva los años: "Evolución del balance de septiembre de 2025 a febrero de 2026".

> Decisión (aprobada por el desarrollador): la etiqueta solo nombra el rango y no lee los valores de cada mes. El año solo se nombra cuando el rango cruza de año; el nombre del mes sale del rango pedido, no de las etiquetas abreviadas.

### CA-RF19-32 — Solo el balance: ningún otro monto

- **Dado** la tarjeta con datos
- **Cuando** el usuario la ve
- **Entonces** no ve ningún monto escrito aparte de los del eje de la gráfica, ni los textos "Ingresos", "Egresos", "Pagos de tarjeta", "Abonos" o "Dinero recibido": la tarjeta solo habla del balance mes a mes.

### CA-RF19-33 — Todos los meses en cero siguen siendo una gráfica

- **Dado** que el backend responde seis puntos, todos con `balance: 0` (hubo movimientos que se compensan o solo dinero recibido)
- **Cuando** se muestra la tarjeta
- **Entonces** ve la gráfica con los seis puntos en cero y sus etiquetas, y el eje con `$0`, sin `NaN`, sin mensaje de vacío y sin error.

> Decisión (aprobada por el desarrollador): a diferencia de 3.2.2 (ingresos y egresos en 0 = vacío), aquí el vacío es solo `puntos: []`: si el backend manda puntos, hubo movimientos en el rango y una línea plana en cero es información válida. El frontend no decide el vacío mirando los valores.

### CA-RF19-34 — Un solo punto

- **Dado** que el backend responde un único punto (`2026-09`, `balance: 450000`)
- **Cuando** se muestra la tarjeta
- **Entonces** ve ese punto con la etiqueta "sep", sin error ni `NaN`; el frontend dibuja los puntos que llegan y no completa hasta seis.

> Nota: con `desde` y `hasta` enviados el backend siempre manda los 6 puntos o ninguno, así que este caso no debería ocurrir; el criterio solo exige que la tarjeta no se rompa ni invente puntos si llegaran menos (o más) de seis.

### CA-RF19-35 — Valores muy distintos entre sí

- **Dado** que el backend responde balances de `-12000000`, `500` y `9900000`, entre otros
- **Cuando** se muestra la tarjeta
- **Entonces** la gráfica recibe los valores sin cambiarlos (la escala la pone la librería), las marcas del eje se escriben completas (`-$12.000.000`, `$9.900.000`) y la gráfica cabe en el ancho de la tarjeta (CA-RF19-36).

### CA-RF19-36 — La gráfica cabe dentro de la tarjeta

- **Dado** una pantalla de 360 px de ancho
- **Cuando** se muestra la tarjeta con datos
- **Entonces** el ancho de la gráfica descuenta el margen de la pantalla (48 px), el relleno y el borde de la tarjeta (34 px) y el espacio del eje de valores (72 px): 206 px, y no se sale de la tarjeta.
- **Dado** una pantalla de 1280 px
- **Cuando** se muestra la tarjeta
- **Entonces** el ancho no pasa del tope de las gráficas (640 px antes de descontar el eje, el relleno y el borde).

> Nota para el implementador: igual que `GraficaBarras`, `GraficaLinea` acepta `margenExtra`. Sin él, el comportamiento de 3.2.1 (CA-RF19-04) no cambia.

### CA-RF19-37 — Sin movimientos en esos meses, un aviso sencillo

- **Dado** que el backend responde `200` con `puntos: []`
- **Cuando** termina de cargar
- **Entonces** ve el título "Evolución del balance", el subtítulo y el aviso "No hay movimientos en estos meses.", sin la gráfica, sin `NaN` y sin error.

> Decisión (aprobada por el desarrollador): el Figma no trae estado vacío. El aviso es el de 3.2.2 ("No hay movimientos en …") con "estos meses", porque la tarjeta habla de seis meses y no de un periodo. Se oculta la gráfica.

---

## Tarjeta "Evolución del balance" — el rango de meses

### CA-RF19-38 — La tarjeta pide los 6 meses que terminan en el mes recibido

- **Dado** la tarjeta con `mes="2026-09"`
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/evolucion?desde=2026-04&hasta=2026-09` (seis meses, ambos extremos incluidos) y se hace una sola consulta.
- **Y** con `mes="2026-06"` se pide `desde=2026-01&hasta=2026-06`, y con `mes="2026-12"`, `desde=2026-07&hasta=2026-12`.

> Nota: restar meses es presentación (elegir qué ventana pedir), no un cálculo financiero (RNF-11); el balance de cada mes sigue viniendo del backend.

### CA-RF19-39 — Al cruzar el año hacia atrás, el rango retrocede al año anterior

- **Dado** la tarjeta con `mes="2026-02"`
- **Cuando** se abre
- **Entonces** se pide `desde=2025-09&hasta=2026-02`.
- **Y** con `mes="2026-01"` se pide `desde=2025-08&hasta=2026-01`; con `mes="2026-05"`, `desde=2025-12&hasta=2026-05`.

### CA-RF19-40 — Sin `mes`, la ventana termina en el mes actual del dispositivo

- **Dado** la tarjeta sin `mes` y que hoy es el 15 de noviembre de 2026 (fecha local del dispositivo)
- **Cuando** se abre
- **Entonces** se pide `GET /reportes/evolucion?desde=2026-06&hasta=2026-11`, el subtítulo dice "Últimos 6 meses hasta noviembre" y se hace una sola consulta.

> Decisión (aprobada por el desarrollador): sin `mes` la tarjeta usa el mes actual según la fecha local del dispositivo (el mismo criterio de "hoy" del registro de movimientos), porque este endpoint no usa `X-Zona-Horaria` y, sin `desde` ni `hasta`, el backend devolvería todo el historial. Cuando exista el selector de 3.3.1 la tarjeta siempre recibirá `mes`.

### CA-RF19-41 — Al cambiar el mes se pide de nuevo

- **Dado** la tarjeta mostrando la gráfica de `mes="2026-09"`
- **Cuando** el mes cambia a `2026-10`
- **Entonces** se hace una nueva consulta con `desde=2026-05&hasta=2026-10`, el subtítulo pasa a "Últimos 6 meses hasta octubre", mientras llega ve el indicador de carga (no la gráfica de septiembre como si fuera de octubre) y después ve la gráfica con los datos nuevos.

### CA-RF19-42 — Una respuesta vieja no pisa la nueva

- **Dado** que se pidió `mes="2026-09"` y, antes de que responda, el mes cambió a `2026-10`
- **Cuando** la respuesta de septiembre llega después que la de octubre (o llega al final)
- **Entonces** la tarjeta sigue mostrando solo la gráfica de octubre; la respuesta de septiembre se ignora, y tampoco un error de la consulta vieja reemplaza lo que se ve.

---

## Resumen

- Criterios: 34 (CA-RF19-09 a CA-RF19-42): adaptador 9 (09 a 17), carga y errores 5 (18 a 22), qué muestra 15 (23 a 37), rango de meses 5 (38 a 42).
- Decisiones aprobadas por el desarrollador: (a) negativos como `-$1.500.000` corrigiendo `pesos`, no `formatearPesos`; un valor que redondea a 0 sin signo (CA-RF19-29); línea bajo cero revisada a ojo (CA-RF19-28); (b) meses en cero se dibujan, y todo en cero no es vacío (CA-RF19-26, 33); (c) etiquetas de mes en minúscula sin año (CA-RF19-25); (d) eje en pesos, desviación del Figma aprobada (CA-RF19-27); (e) línea grafito en claro y blanca en oscuro (CA-RF19-30); (f) accesibilidad con el rango de meses, con años si cruza de año (CA-RF19-31); (g) sin `mes` usa el mes actual del dispositivo (CA-RF19-40); (h) subtítulo siempre visible (CA-RF19-23); (i) textos de error y vacío propuestos (CA-RF19-19, 37). El backend confirmó: con `desde` y `hasta` siempre 6 puntos; `puntos: []` solo si el rango no tiene movimientos.
- Cambios que pide a código existente: `lib/api/reportes.ts` gana `obtenerReporteEvolucion`; `GraficaLinea` gana `color` y `margenExtra`; `pesos` maneja negativos; `lib/fechas.ts` gana `mesCorto`, `restarMeses` y `mesActual`. El hook genérico `lib/use-reporte.ts` puede reutilizarse (no se prueba directamente, solo lo que se ve).
- El contrato del backend es PROPUESTO y aún no está mezclado: contrastar con el Swagger de `/api/docs` cuando se publique.
