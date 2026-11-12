# Criterios de aceptación — 3. Reportes y visualización: pantalla de reportes (paquete 3.3.1)

Estado: Aprobado

Cubre RF-13 (al entrar se ve el mes actual), RF-14 (elegir otro periodo) y RF-20 (ver el reporte del periodo con sus gráficas) en el frontend: la pantalla `/reportes`, que reúne las tarjetas ya construidas ("Ingresos vs egresos", "Egresos por categoría" y "Evolución del balance") bajo un selector de periodo compartido. El criterio de la EDT es: "El dashboard integra correctamente todos los componentes de reporte desarrollados." El backend calcula todo (RNF-11): aquí solo se verifica qué periodo se elige, que las tres tarjetas lo reciban a la vez y que cada una siga manejando por su cuenta su carga, su error y su vacío.

**Fuera de este paquete:**
- La comparación entre periodos (RF-15 y RF-16, `GET /reportes/comparacion`): no tiene frame en Figma, tarjeta ni adaptador en el frontend. Decisión: fuera de 3.3.1; se trata en un paquete aparte, con su diseño en Figma y su adaptador. Estos criterios no la cubren.
- Las tarjetas "Egresos por método de pago" (no hay endpoint en el backend), "Presupuesto del mes" (módulo 7) y "Deuda total" (módulo 6).
- El frame "Origen de tus ingresos" (ingreso propio vs préstamos o avances, % comprometido y % ahorrado): es otro indicador, no parte de esta pantalla.
- La versión de escritorio (1280 px: rejilla de dos columnas y menú lateral) y la barra de navegación inferior: aún no existen en el código. Esta pantalla es de una columna, como las demás.
- El drill-down por categoría (filtro de categoría en Movimientos): ver CA-RF20-10.
- Lo que ya cubren las tarjetas: sus textos de carga, error y vacío, sus montos, barras, colores y accesibilidad (`03-reportes-ingresos-egresos.md`, `03-reportes-por-categoria.md`, `03-reportes-evolucion.md`). Aquí no se repite; solo se verifica que la pantalla las muestre y les pase el periodo.
- Cualquier suma, comparación o cálculo de fechas financiero: el frontend solo elige el periodo y lo envía.

**Fuentes:** Especificación de Requisitos (RF-13: ver por defecto el mes actual; RF-14: elegir un mes distinto al actual; RF-20: resumen numérico y gráficas del periodo), CLAUDE.md (decisión de UX: selector de mes o rango compartido con Reportes; carga y errores del arranque en frío, RNF-02; lenguaje sencillo, RNF-04), Figma sección 05 · Reportes, frame "Reportes — Mes (v2…)", móvil 360×760: título "Reportes"; pestañas "Mes" y "Rango"; selector "‹ Septiembre 2026 ›"; y, en una columna con scroll, las tarjetas en este orden: "Ingresos vs egresos", "Egresos por categoría" (subtítulo "Toca una categoría para ver sus movimientos"), "Egresos por método de pago", "Evolución del balance" (subtítulo "Últimos 6 meses hasta septiembre"), "Presupuesto del mes" y "Deuda total"; el filtro Desde/Hasta de Movimientos (`FiltrosDeFecha`); y los criterios de las tres tarjetas.

**Contrato del backend que importa aquí** (ya cubierto por los criterios de las tarjetas; la pantalla no agrega endpoints):
- `GET /reportes/periodo` y `GET /reportes/categorias`: `mes=YYYY-MM` **o** `desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (juntos); sin nada, el backend usa el mes actual según `X-Zona-Horaria`.
- `GET /reportes/evolucion`: `desde=YYYY-MM&hasta=YYYY-MM` (meses). La tarjeta de evolución recibe solo el mes final (`mes`) y pide ella misma los 6 meses hasta ese mes.

**Interfaz pública** (aprobada con estos criterios):
- Pantalla: `app/reportes.tsx` (ruta `/reportes`), con la sesión como las demás pantallas (`Stack.Protected` en `app/_layout.tsx`).
- Entrada: un botón "Reportes" en `app/index.tsx`, junto a "Movimientos" y "Mi perfil".
- Las tres tarjetas se montan siempre con un periodo explícito (nunca sin `mes`, `desde` ni `hasta`).

**Sobre los IDs:** RF-14 (CA-RF14-01 a 15) cubre el selector de periodo; RF-20 (CA-RF20-01 a 11) cubre la vista del reporte. No existían IDs previos con estos prefijos. El ID de RF-13 del "mes actual por defecto" está en CA-RF14-01 (los CA-RF13-xx ya los usa `03-zona-horaria.md`). Las notas "Decisión" son lo que el Figma y los RF no definen y el desarrollador ya aprobó.

**Convención de las pruebas:** hoy es el 17 de septiembre de 2026 (reloj simulado), para que el mes actual coincida con el "Septiembre 2026" del Figma. El backend se simula en el borde de los adaptadores `obtenerReportePeriodo`, `obtenerReporteCategorias` y `obtenerReporteEvolucion` (`lib/api/reportes`), y la librería de gráficas como en las pruebas de las tarjetas.

---

## Selector de periodo — modo "Mes"

### CA-RF14-01 — Al entrar se ve el mes actual (RF-13)

- **Dado** una sesión vigente y que hoy es el 17 de septiembre de 2026
- **Cuando** el usuario abre "Reportes"
- **Entonces** ve el título "Reportes", las pestañas "Mes" y "Rango" con "Mes" seleccionada, y el selector "Septiembre 2026" entre una flecha para ir al mes anterior y otra para ir al siguiente.
- **Y** las tres tarjetas piden ese mes: `GET /reportes/periodo?mes=2026-09`, `GET /reportes/categorias?mes=2026-09` y `GET /reportes/evolucion?desde=2026-04&hasta=2026-09`, una consulta de cada una (no se hacen consultas sin periodo).

> Decisión: la pantalla siempre manda el mes de forma explícita (no deja que el backend elija) para que las tres tarjetas y el selector muestren el mismo mes. El mes actual es el del dispositivo (`mesActual()`); el backend usa el de la zona horaria que recibe, y ambos coinciden salvo por minutos en el cambio de mes.

### CA-RF14-02 — El mes se escribe con su nombre y su año

- **Dado** la pantalla en el mes de septiembre de 2026
- **Cuando** el usuario lee el selector
- **Entonces** ve "Septiembre 2026" (nombre del mes con mayúscula inicial y el año, no "2026-09").
- **Y** las flechas se anuncian como botones con las etiquetas "Mes anterior" y "Mes siguiente".

### CA-RF14-03 — La flecha "anterior" muestra el mes anterior

- **Dado** la pantalla en "Septiembre 2026" con sus tarjetas ya cargadas
- **Cuando** el usuario toca "Mes anterior"
- **Entonces** el selector dice "Agosto 2026", y las tres tarjetas piden `mes=2026-08` (evolución: `desde=2026-03&hasta=2026-08`), con una consulta nueva cada una; el subtítulo de la evolución dice "Últimos 6 meses hasta agosto".

### CA-RF14-04 — Pasar de enero al diciembre del año anterior

- **Dado** que hoy es el 15 de enero de 2026 y la pantalla muestra "Enero 2026"
- **Cuando** el usuario toca "Mes anterior"
- **Entonces** el selector dice "Diciembre 2025" y las tarjetas piden `mes=2025-12` (evolución: `desde=2025-07&hasta=2025-12`).

> Esta prueba usa su propio reloj simulado (15 de enero de 2026); lo que importa es que el año cambie junto con el mes.

### CA-RF14-05 — La flecha "siguiente" avanza hasta el mes actual y ahí se detiene

- **Dado** la pantalla en "Julio 2026" y que hoy es el 17 de septiembre de 2026
- **Cuando** el usuario toca "Mes siguiente" dos veces
- **Entonces** el selector pasa a "Agosto 2026" y luego a "Septiembre 2026", con sus consultas.
- **Y** en "Septiembre 2026" el botón "Mes siguiente" está deshabilitado: tocarlo no cambia el mes ni hace consultas.

> Decisión: no se puede avanzar más allá del mes actual (no hay movimientos futuros que ver, y evita meses vacíos que parezcan un error). Alternativa descartada por ahora: permitir meses futuros. Hacia atrás no hay límite en el frontend (el backend acepta hasta 120 meses en la evolución; el selector no lo limita).

### CA-RF14-06 — Las tres tarjetas cambian a la vez

- **Dado** la pantalla con las tres tarjetas mostrando septiembre
- **Cuando** el usuario toca "Mes anterior"
- **Entonces** las tres tarjetas dejan de mostrar los datos de septiembre y muestran su indicador de carga hasta que responda cada una (cada tarjeta, la suya), y después cada una muestra los datos de agosto; ninguna se queda con septiembre.

### CA-RF14-07 — Toques seguidos en la flecha

- **Dado** la pantalla en "Septiembre 2026"
- **Cuando** el usuario toca "Mes anterior" dos veces seguidas, antes de que respondan las consultas de agosto
- **Entonces** el selector dice "Julio 2026" y las tarjetas muestran solo datos de julio: la respuesta tardía de agosto no los pisa.

> Esto no es protección contra doble toque (no se guarda nada): cada toque es un cambio de mes válido; lo que se verifica es que se vea siempre el último elegido.

---

## Selector de periodo — modo "Rango"

### CA-RF14-08 — La pestaña "Rango" muestra Desde y Hasta con un periodo inicial

- **Dado** la pantalla en modo "Mes" y que hoy es el 17 de septiembre de 2026
- **Cuando** el usuario toca la pestaña "Rango"
- **Entonces** "Rango" queda seleccionada, el selector de mes con sus flechas se reemplaza por los campos "Desde: 01/09/2026" y "Hasta: 17/09/2026" (los mismos del filtro de Movimientos, con calendario), y las tarjetas piden ese rango.

> Decisión: el rango empieza en el primer día del mes actual y hoy, igual que "Hasta" empieza en hoy en Movimientos. No intenta convertir el mes que se estaba viendo en rango (evita calcular el último día de un mes).

### CA-RF14-09 — En modo "Rango" las tarjetas piden `desde` y `hasta`

- **Dado** la pantalla en "Rango" con Desde 01/09/2026 y Hasta 17/09/2026
- **Cuando** se muestran las tarjetas
- **Entonces** "Ingresos vs egresos" pide `GET /reportes/periodo?desde=2026-09-01&hasta=2026-09-17` y "Egresos por categoría" pide `GET /reportes/categorias?desde=2026-09-01&hasta=2026-09-17`; ninguna manda `mes`.

### CA-RF14-10 — En modo "Rango" la evolución termina en el mes de "Hasta"

- **Dado** la pantalla en "Rango" con Desde 10/07/2026 y Hasta 20/08/2026
- **Cuando** se muestran las tarjetas
- **Entonces** "Evolución del balance" pide los 6 meses hasta agosto (`GET /reportes/evolucion?desde=2026-03&hasta=2026-08`) y su subtítulo dice "Últimos 6 meses hasta agosto".

> Decisión: la evolución es siempre de 6 meses; en modo rango termina en el mes de "Hasta" (la tarjeta no sabe de rangos). El rango no cambia el largo de la gráfica. Alternativa descartada: que la evolución siga el rango completo (implica otra tarjeta y un largo variable).

### CA-RF14-11 — Cambiar Desde o Hasta vuelve a consultar

- **Dado** la pantalla en "Rango" con sus tarjetas cargadas
- **Cuando** el usuario elige otra fecha en "Hasta" (p. ej. 20/09/2026 → 15/09/2026) en el calendario
- **Entonces** "Ingresos vs egresos" y "Egresos por categoría" hacen una consulta nueva con el rango actualizado y muestran su indicador mientras llega; lo mismo al cambiar "Desde".
- **Y** "Evolución del balance" consulta de nuevo solo si cambia el mes de la fecha "Hasta" (con los 6 meses hasta ese mes); si "Hasta" sigue en el mismo mes, conserva lo que ya muestra.

> Aclarado al escribir las pruebas: la evolución depende solo del mes de "Hasta" (CA-RF14-10), así que cambiar el día dentro del mismo mes no pide otra consulta.

### CA-RF14-12 — Si falta una fecha, avisa y no consulta

- **Dado** la pantalla en "Rango"
- **Cuando** el usuario quita la fecha "Desde" o la fecha "Hasta" (con "Quitar esta fecha")
- **Entonces** ve el aviso "Elige las dos fechas para ver tu reporte." y no ve las tarjetas; no se hace ninguna consulta nueva. Al volver a elegir la fecha, las tarjetas aparecen y consultan.

> Decisión: el backend exige `desde` y `hasta` juntos; en vez de mandar uno solo (un 400) o inventar el otro, se pide completar. Alternativa: dejar la fecha quitada en el último valor válido (esconde lo que el usuario hizo).

### CA-RF14-13 — "Desde" posterior a "Hasta"

- **Dado** la pantalla en "Rango" con Desde 01/09/2026 y Hasta 17/09/2026
- **Cuando** el usuario elige en "Desde" el 20/09/2026
- **Entonces** ve el aviso "La fecha Desde no puede ser posterior a la fecha Hasta." y las tarjetas no se muestran ni consultan; al corregir la fecha, vuelven a consultar.

> Decisión: lo valida la pantalla (sin calcular nada financiero) para no mandar un rango que el backend rechazaría y no mostrar tres errores del servidor juntos. El backend es la autoridad: si acepta ese rango, esta regla se puede quitar.

### CA-RF14-14 — Cambiar de pestaña conserva lo elegido

- **Dado** el usuario en "Mes" viendo "Julio 2026" que pasa a "Rango" y cambia "Desde" a 05/09/2026
- **Cuando** vuelve a tocar "Mes" y luego otra vez "Rango"
- **Entonces** al volver a "Mes" ve "Julio 2026" y las tarjetas piden `mes=2026-07` (no un rango), y al volver a "Rango" ve el "Desde" que había elegido (05/09/2026).

> Decisión: cada pestaña recuerda lo que el usuario eligió en ella mientras la pantalla esté abierta. Al salir y volver a entrar, vuelve al mes actual (CA-RF14-01).

### CA-RF14-15 — Cada pestaña se anuncia como pestaña

- **Dado** la pantalla de reportes
- **Cuando** un lector de pantalla recorre el selector
- **Entonces** "Mes" y "Rango" se anuncian como pestañas, con la seleccionada marcada como tal.

---

## La vista del reporte

### CA-RF20-01 — Desde el inicio se llega a "Reportes"

- **Dado** una sesión vigente en la vista de inicio
- **Cuando** el usuario ve las opciones
- **Entonces** hay un botón "Reportes" (junto a "Movimientos" y "Mi perfil") que lleva a la ruta `/reportes`.

### CA-RF20-02 — Solo con sesión

- **Dado** que no hay sesión (o está cerrada)
- **Cuando** se arma la navegación de la app
- **Entonces** la pantalla de reportes no está disponible (como Movimientos y Perfil: la app lleva al login); con sesión activa, sí.

### CA-RF20-03 — Las tres tarjetas, en el orden del diseño

- **Dado** que el backend responde con datos a las tres consultas
- **Cuando** termina de cargar la pantalla
- **Entonces** ve, de arriba abajo, bajo el selector: "Ingresos vs egresos", "Egresos por categoría" y "Evolución del balance" (con su subtítulo "Últimos 6 meses hasta septiembre"), cada una con sus datos.
- **Y** no ve tarjetas de "Egresos por método de pago", "Presupuesto del mes" ni "Deuda total" (ni espacios vacíos ni avisos de "próximamente").

> Decisión: lo que aún no existe no se dibuja a medias. Cada tarjeta se agrega cuando se construya su paquete.

### CA-RF20-04 — Mientras carga, cada tarjeta muestra su indicador y el selector funciona

- **Dado** que el backend aún no responde a ninguna de las tres consultas (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** ve el título "Reportes", las pestañas y el selector de mes, y las tres tarjetas con sus títulos y sus indicadores "Cargando ingresos y egresos", "Cargando egresos por categoría" y "Cargando evolución del balance"; no ve avisos de error ni de vacío.
- **Y** el usuario puede tocar "Mes anterior" sin esperar a que termine de cargar.

### CA-RF20-05 — Un error en una tarjeta no afecta a las otras

- **Dado** que "Egresos por categoría" falla (`500`) y las otras dos responden bien
- **Cuando** termina de cargar
- **Entonces** ve "Ingresos vs egresos" y "Evolución del balance" con sus datos, y en "Egresos por categoría" el aviso "No pudimos cargar tus egresos por categoría. Inténtalo de nuevo en unos minutos." con su botón "Reintentar".
- **Y** lo mismo con cualquiera de las otras dos: el aviso aparece solo en la tarjeta que falló, con su propio texto.

### CA-RF20-06 — "Reintentar" repite solo la consulta de esa tarjeta

- **Dado** que "Egresos por categoría" muestra su aviso de error y las otras dos ya cargaron
- **Cuando** el usuario toca "Reintentar" en esa tarjeta
- **Entonces** solo esa tarjeta vuelve a consultar (con el periodo que tiene la pantalla en ese momento); las otras dos no hacen una consulta nueva ni vuelven a mostrar su indicador.

### CA-RF20-07 — Sin conexión, cada tarjeta lo dice

- **Dado** que las tres consultas fallan por falta de conexión
- **Cuando** termina de cargar
- **Entonces** cada tarjeta muestra "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." y su botón "Reintentar" (tres avisos, uno por tarjeta); el título "Reportes" y el selector siguen visibles y usables.

### CA-RF20-08 — Un mes sin movimientos

- **Dado** que el backend responde sin movimientos a las tres consultas (`ingresos: 0` y `egresos: 0`; `total: 0` y `categorias: []`; `puntos: []`)
- **Cuando** termina de cargar
- **Entonces** cada tarjeta muestra su propio aviso de vacío ("No hay movimientos en este periodo.", "No hay egresos en este periodo." y "No hay movimientos en estos meses."), sin gráficas, sin `NaN` y sin errores; el selector sigue funcionando.

### CA-RF20-09 — Una tarjeta vacía no vacía a las otras

- **Dado** que el mes elegido tiene movimientos para "Ingresos vs egresos" y "Egresos por categoría", pero la evolución responde `puntos: []`
- **Cuando** termina de cargar
- **Entonces** las dos primeras muestran sus datos y la de evolución su aviso de vacío; cada una decide por separado.

### CA-RF20-10 — Al tocar una categoría no pasa nada nuevo

- **Dado** "Egresos por categoría" con filas cargadas
- **Cuando** el usuario ve la tarjeta
- **Entonces** las filas de categoría se leen como texto (no como botones), sin el ">" y sin el subtítulo "Toca una categoría para ver sus movimientos" (no promete algo que no hace).

> Decisión: hoy "Movimientos" solo filtra por fechas, no por categoría; el Figma sí promete que tocar una categoría lleva a sus movimientos. Se aprobó no pasar `onElegirCategoria` a la tarjeta en este paquete y dejar el drill-down (con su filtro de categoría en Movimientos y en el backend) como paquete aparte; la tarjeta ya está lista para recibirlo (CA-RF18-29). Alternativa descartada: navegar a `/movimientos` con el periodo, porque mostraría todos los movimientos del periodo (no los de la categoría) tras prometer lo contrario.

### CA-RF20-11 — Volver

- **Dado** la pantalla de reportes
- **Cuando** el usuario toca "Volver" (el mismo botón "‹" que en Movimientos)
- **Entonces** regresa a la pantalla anterior.

> Decisión: fuera de este paquete; paquete aparte. El resumen numérico del RF-20 ("ingresos, egresos y balance del periodo, además de las gráficas") no se cubre aquí: las tarjetas ya construidas solo dibujan barras y líneas, y el frame "Reportes — Mes" de Figma no muestra un resumen con las tres cifras.

---

## Resumen

- Criterios: 26 (CA-RF14-01 a CA-RF14-15 y CA-RF20-01 a CA-RF20-11): selector Mes 7 (CA-RF14-01 a 07), selector Rango 7 (08 a 14), accesibilidad del selector 1 (15), vista 11 (CA-RF20-01 a 11).
- Cambios que pide a código existente: `app/_layout.tsx` registra la pantalla `reportes` dentro de las protegidas; `app/index.tsx` gana el botón "Reportes". Las tarjetas y los hooks no cambian. Se reutilizan `FiltrosDeFecha`, `mesActual`, `restarMeses`, `nombreDelMes` y `hoy`; el primer día del mes actual en modo rango y los textos de los avisos del rango son de la pantalla.
- Nuevos en la pantalla (sin existir hoy): las pestañas "Mes" y "Rango", el selector de mes con flechas ("Mes anterior", "Mes siguiente") y los avisos "Elige las dos fechas para ver tu reporte." y "La fecha Desde no puede ser posterior a la fecha Hasta."
