# Criterios de aceptación — 3. Reportes y visualización: componentes de gráficas (paquete 3.2.1)

Estado: Aprobado

Cubre los tres componentes base de gráficas (`components/graficas/`) y la pantalla de revisión `/dev-graficas`. Los reportes reales (paquetes siguientes de 3.x) los usarán; aquí solo se define cómo se ve y se comporta cada gráfica con los datos que le llegan.

**Origen de los criterios:** este paquete ya tiene código y PR abierto (#35, Sonar exige 80 % de cobertura en el código nuevo). Los criterios se redactan desde la interfaz pública (props) y lo que ve la persona, no desde los detalles de la implementación. No hay Figma que contrastar: los estilos son provisionales y no se especifican aquí.

**Requisitos:**
- RF-17: gráficas de barras (balance y comparación entre periodos) -> `GraficaBarras`.
- RF-18: gráficas circulares (distribución por categoría y por método de pago) -> `GraficaDona`.
- RF-19: gráfica de línea de tiempo (evolución del balance o ahorro por mes) -> `GraficaLinea`.

**Reglas comunes:**
- Cada componente recibe `datos` (lista de `{ etiqueta, valor }` ya calculados por el backend; RNF-11, el frontend no suma, no promedia ni calcula porcentajes) y `descripcion` (texto para lectores de pantalla, RNF-06).
- Los valores se muestran en pesos con separador de miles y sin decimales, por ejemplo `$1.200.000` (se redondea al peso al mostrar, RNF-11).
- Los colores siguen el modo claro u oscuro del sistema (paleta del proyecto).
- En las pruebas la librería `react-native-gifted-charts` se simula en el borde del módulo: se verifica lo que el componente le entrega (datos, etiquetas, formato de los ejes y colores) y lo que el componente dibuja por su cuenta (leyenda, texto del centro, etiqueta de accesibilidad). No se prueba el dibujo de la librería.

---

## RF-17 — Gráfica de barras

### CA-RF17-01 — La gráfica se anuncia con su descripción

- **Dado** una `GraficaBarras` con `descripcion="Egresos por mes, de enero a junio"`
- **Cuando** se muestra
- **Entonces** un lector de pantalla la encuentra como una imagen con esa descripción como etiqueta de accesibilidad.

### CA-RF17-02 — Cada barra lleva su etiqueta y su valor

- **Dado** los datos Ene $1.200.000, Feb $950.000 y Mar $1.800.000
- **Cuando** se muestra la gráfica
- **Entonces** la librería recibe una barra por cada punto, en el mismo orden, con la etiqueta (`Ene`, `Feb`, `Mar`) y el valor tal como llegó, sin sumarlos ni reordenarlos.

### CA-RF17-03 — El eje de valores se lee en pesos

- **Dado** una gráfica de barras con valores en pesos
- **Cuando** la librería pide el texto de una marca del eje vertical (por ejemplo 1200000)
- **Entonces** se escribe `$1.200.000`, con el signo de pesos y puntos como separador de miles, sin decimales; un valor con decimales (1234.6) se redondea al peso (`$1.235`).

### CA-RF17-04 — El ancho se ajusta a la pantalla y tiene un tope

- **Dado** una pantalla de 360 px de ancho (celular)
- **Cuando** se muestra la gráfica
- **Entonces** cabe dentro de la pantalla (ancho de la pantalla menos un margen de 48 px, descontando además el espacio del eje de valores).
- **Dado** una pantalla de 1280 px (web de escritorio)
- **Cuando** se muestra la gráfica
- **Entonces** el ancho de la gráfica no pasa de 640 px (el tope del ancho completo, antes de descontar el eje).

### CA-RF17-05 — Las barras usan los colores del modo claro y del oscuro

- **Dado** el sistema en modo claro
- **Cuando** se muestra la gráfica
- **Entonces** las barras usan el amarillo de la paleta (#FFD300), el texto de los ejes el gris #757B81 y las líneas guía el gris claro #E3E4E6.
- **Dado** el sistema en modo oscuro
- **Cuando** se muestra la gráfica
- **Entonces** las barras siguen en amarillo, el texto de los ejes pasa a #A6A9AE y las líneas guía al gris oscuro #262B32.

### CA-RF17-06 — Una sola barra

- **Dado** datos con un único punto (Ene $1.200.000)
- **Cuando** se muestra la gráfica
- **Entonces** se muestra esa barra con su etiqueta y su valor, sin error.

### CA-RF17-07 — Valores en cero

- **Dado** datos donde todos los valores son 0
- **Cuando** se muestra la gráfica
- **Entonces** se muestran las etiquetas y el eje con `$0`, sin error y sin texto raro (`NaN`, `Infinity`).

### CA-RF17-08 — Sin datos no se rompe

- **Dado** `datos` vacío
- **Cuando** se muestra la gráfica
- **Entonces** la pantalla no falla (no hay división por cero ni texto `NaN`) y la etiqueta de accesibilidad sigue presente.

> Decisión (aprobada por el desarrollador): en este PR no se agrega ningún mensaje de estado vacío. Con `datos` vacío solo se exige que no se rompa (sin `NaN`, etiqueta de accesibilidad presente). Los mensajes reales se diseñan en los paquetes 3.2.2 a 3.2.4 contra el Figma de la sección 05; no se prueba ningún texto.

---

## RF-18 — Gráfica circular (dona)

### CA-RF18-01 — La dona se anuncia con su descripción

- **Dado** una `GraficaDona` con `descripcion="Egresos por categoría del mes"`
- **Cuando** se muestra
- **Entonces** un lector de pantalla la encuentra con esa descripción como etiqueta de accesibilidad.

### CA-RF18-02 — La leyenda repite cada etiqueta con su valor en pesos

- **Dado** los datos Comida $650.000, Transporte $320.000, Arriendo $1.200.000 y Otros $180.000
- **Cuando** se muestra la dona
- **Entonces** debajo de la dona hay una fila por categoría, en el mismo orden, con su nombre y su valor (`Comida` / `$650.000`, etc.), de modo que la información no dependa solo del color (RNF-06).

### CA-RF18-03 — La librería recibe un segmento por punto

- **Dado** los mismos datos
- **Cuando** se muestra la dona
- **Entonces** la librería recibe un segmento por cada punto, con el valor sin cambiar (el frontend no calcula porcentajes) y como dona (con agujero al centro).

### CA-RF18-04 — El texto del centro

- **Dado** una dona con `centro="$2.350.000"`
- **Cuando** se muestra
- **Entonces** ese texto se ve en el centro de la dona, tal como se pasó (el frontend no lo calcula).
- **Dado** una dona sin `centro`
- **Cuando** se muestra
- **Entonces** el centro queda vacío y no aparece ningún texto como `undefined`.

### CA-RF18-05 — El color de cada segmento coincide con el de su fila de la leyenda

- **Dado** una dona con tres categorías
- **Cuando** se muestra
- **Entonces** el segmento n y el punto de color de la fila n de la leyenda usan el mismo color.

### CA-RF18-06 — La paleta se repite a partir del cuarto segmento

- **Dado** una dona con 7 categorías (la paleta tiene 3 colores)
- **Cuando** se muestra
- **Entonces** el segmento 4 usa el color del segmento 1, el 5 el del 2, el 6 el del 3 y el 7 el del 1, sin error.

### CA-RF18-07 — Los colores cambian con el modo claro y el oscuro

- **Dado** el sistema en modo claro
- **Cuando** se muestra la dona
- **Entonces** los tres primeros segmentos son amarillo #FFD300, grafito #262B32 y gris #757B81, y el círculo interior es blanco.
- **Dado** el sistema en modo oscuro
- **Cuando** se muestra la dona
- **Entonces** el segundo color pasa a blanco (para que no se pierda contra el fondo) y el círculo interior es #090C11.

### CA-RF18-08 — Una sola categoría

- **Dado** datos con un único punto (Comida $650.000)
- **Cuando** se muestra la dona
- **Entonces** se ve un solo segmento y una sola fila en la leyenda con `Comida` y `$650.000`.

### CA-RF18-09 — Valores en cero

- **Dado** datos donde un valor es 0 (por ejemplo Otros $0)
- **Cuando** se muestra la dona
- **Entonces** esa fila de la leyenda aparece con `$0` y no se muestra `NaN`.

### CA-RF18-10 — Sin datos no se rompe

- **Dado** `datos` vacío
- **Cuando** se muestra la dona
- **Entonces** la pantalla no falla, la leyenda queda sin filas y la etiqueta de accesibilidad sigue presente.

> Decisión (aprobada por el desarrollador): sin mensaje de estado vacío en este PR (igual que CA-RF17-08); no se prueba ningún texto.

> Decisión (aprobada por el desarrollador): dos categorías con la misma etiqueta no se soportan ni se prueban (el backend agrupa por categoría, así que no debería ocurrir).

---

## RF-19 — Gráfica de línea de tiempo

### CA-RF19-01 — La gráfica se anuncia con su descripción

- **Dado** una `GraficaLinea` con `descripcion="Egresos por mes, de enero a junio"`
- **Cuando** se muestra
- **Entonces** un lector de pantalla la encuentra como una imagen con esa descripción como etiqueta de accesibilidad.

### CA-RF19-02 — Cada punto lleva su etiqueta y su valor

- **Dado** los datos Ene $1.200.000, Feb $950.000 y Mar $1.800.000
- **Cuando** se muestra la gráfica
- **Entonces** la librería recibe un punto por cada dato, en el mismo orden, con la etiqueta (mes) y el valor tal como llegó, sin reordenarlos ni suavizarlos.

### CA-RF19-03 — El eje de valores se lee en pesos

- **Dado** una gráfica de línea con valores en pesos
- **Cuando** la librería pide el texto de una marca del eje vertical (por ejemplo 2100000)
- **Entonces** se escribe `$2.100.000`, con el mismo formato que en las barras.

### CA-RF19-04 — El ancho se ajusta a la pantalla y tiene un tope

- **Dado** una pantalla de 360 px de ancho
- **Cuando** se muestra la gráfica
- **Entonces** cabe dentro de la pantalla.
- **Dado** una pantalla de 1280 px
- **Cuando** se muestra la gráfica
- **Entonces** no pasa de 640 px, igual que las barras.

### CA-RF19-05 — La línea usa los colores del modo claro y del oscuro

- **Dado** el sistema en modo claro
- **Cuando** se muestra la gráfica
- **Entonces** la línea y sus puntos son amarillos (#FFD300) y los ejes y líneas guía usan los grises del modo claro.
- **Dado** el sistema en modo oscuro
- **Cuando** se muestra la gráfica
- **Entonces** la línea sigue en amarillo y los ejes y líneas guía usan los grises del modo oscuro (los mismos valores de CA-RF17-05).

### CA-RF19-06 — Un solo punto

- **Dado** datos con un único punto
- **Cuando** se muestra la gráfica
- **Entonces** se muestra ese punto con su etiqueta y su valor, sin error.

### CA-RF19-07 — Valores en cero

- **Dado** datos donde todos los valores son 0
- **Cuando** se muestra la gráfica
- **Entonces** se muestran las etiquetas y el eje con `$0`, sin `NaN`.

### CA-RF19-08 — Sin datos no se rompe

- **Dado** `datos` vacío
- **Cuando** se muestra la gráfica
- **Entonces** la pantalla no falla y la etiqueta de accesibilidad sigue presente.

> Decisión (aprobada por el desarrollador): sin mensaje de estado vacío en este PR (igual que CA-RF17-08); no se prueba ningún texto.

---

## Valores negativos (balance, RF-17 y RF-19)

> Decisión (aprobada por el desarrollador): los valores negativos quedan fuera de este PR. El formato de un balance negativo se define y corrige en el paquete 3.2.2 con su propio criterio; aquí no hay criterio ni prueba para negativos.

---

## Colores y ancho compartidos (RNF-06, modo oscuro)

### CA-RF17-09 — Los colores dependen del modo del sistema

- **Dado** el modo `light`
- **Cuando** se piden los colores de gráfica
- **Entonces** se obtiene: acento #FFD300, texto secundario #757B81, líneas #E3E4E6, fondo #FFFFFF y serie [#FFD300, #262B32, #757B81].
- **Dado** el modo `dark`
- **Cuando** se piden los colores de gráfica
- **Entonces** se obtiene: acento #FFD300, texto secundario #A6A9AE, líneas #262B32, fondo #090C11 y serie [#FFD300, #FFFFFF, #757B81].

### CA-RF17-10 — Sin modo definido se usa el claro

- **Dado** que el sistema no informa el modo (`null` o `undefined`)
- **Cuando** se piden los colores de gráfica
- **Entonces** se obtienen los colores del modo claro.

> Nota para el implementador: CA-RF17-09 y CA-RF17-10 corresponden a `coloresDeGrafica` en `lib/theme.ts`; aunque se numeran bajo RF-17 por ser el primer consumidor, sirven a las tres gráficas. Los dos modos de las pruebas de los componentes (CA-RF17-05, CA-RF18-07, CA-RF19-05) se activan con el modo de color de `nativewind`, y el ancho (CA-RF17-04, CA-RF19-04) con las dimensiones de la ventana.

---

## Pantalla de revisión `/dev-graficas` (solo desarrollo)

Esta pantalla no es parte de la app para las personas usuarias: solo existe en desarrollo (`__DEV__`) para revisar las gráficas en web, Expo Go y Android, en modo claro y oscuro. Los textos son los de desarrollo, no se rigen por RNF-04.

### CA-RF17-11 — La pantalla muestra las tres gráficas sin sesión

- **Dado** que no hay sesión y la app corre en modo desarrollo
- **Cuando** se abre `/dev-graficas`
- **Entonces** se ve el título "Gráficas de prueba" y, una debajo de otra, las secciones "Barras", "Dona" y "Línea", cada una con su gráfica.

### CA-RF17-12 — La pantalla usa datos fijos y en pesos

- **Dado** la pantalla `/dev-graficas`
- **Cuando** se muestra
- **Entonces** la dona muestra en su centro `$2.350.000` y en su leyenda las categorías Comida, Transporte, Arriendo y Otros con su valor en pesos, y las barras y la línea llevan la descripción "Egresos por mes, de enero a junio" (la dona, "Egresos por categoría del mes"). No hace ninguna llamada al backend.

### CA-RF17-13 — La pantalla solo se registra en desarrollo

- **Dado** la app fuera del modo desarrollo (`__DEV__` falso, como en producción)
- **Cuando** se intenta abrir `/dev-graficas`
- **Entonces** la ruta no está disponible: nunca se ven las gráficas.

> Decisión (aprobada por el desarrollador): solo se verifica que las gráficas no aparecen; no se fija a qué pantalla se redirige (lo decide Expo Router).

---

## Resumen

- Criterios: 31 (RF-17: 13, incluidos los colores compartidos y la pantalla de desarrollo; RF-18: 10; RF-19: 8).
- Sin pendientes. Decisiones aprobadas: sin mensaje de estado vacío en este PR (3.2.2 a 3.2.4), valores negativos fuera de este PR (3.2.2), etiquetas repetidas en la dona no se soportan, y `/dev-graficas` en producción solo verifica que no aparecen las gráficas.
