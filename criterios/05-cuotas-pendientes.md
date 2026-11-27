# Criterios de aceptación — 5. Tarjetas de crédito: cuotas por compra en el detalle de la tarjeta

Estado: Aprobado (2026-11-27)

Cubre la parte de RF-30 y RF-31 que quedó pendiente en 5.3.3: ver **de qué compras y avances salen las cuotas** del mes elegido. El backend ya lo entrega en `detalle`, dentro de la respuesta que el detalle de la tarjeta ya pide (`GET /tarjetas/:tarjetaId/proyeccion?mes=`); no hay consultas nuevas. El frontend no calcula nada (RNF-11): solo redondea al peso al mostrar.

**Fuentes:** Especificación de Requisitos (RF-30, RF-31), CLAUDE.md (RNF-02, RNF-04, RNF-06, RNF-11), Figma sección 06, frame móvil "Detalle de tarjeta" (sección "CUOTAS PENDIENTES"), contrato `coordinacion/contratos/proyeccion.md` (cambio 5.3.6) y criterios aprobados `05-detalle-de-tarjeta.md` y `05-pago-de-tarjeta.md`.

**Contrato que importa aquí:** `detalle: [{ compraId, descripcion, tipo: 'COMPRA' | 'AVANCE', numeroCuota, totalCuotas, cuota }]`, una entrada por compra o avance con cuota en el mes consultado, de la más reciente a la más antigua; `cuota` llega sin redondear. Los cargos fijos no vienen en la lista. Sin compras vigentes, `[]`. La API no da fecha de vencimiento.

**Interfaz pública:** en `lib/api/tarjetas.ts`, el tipo `CuotaDelMes` con los seis campos de arriba y `ProyeccionTarjeta.detalle: CuotaDelMes[]` (las filas de `proyeccion` no lo traen). Sin pantalla, función ni consulta nuevas.

**Revisión visual (no se prueba con Jest):** el círculo decorativo a la izquierda de cada fila, colores, tamaños, cómo se parte una descripción larga y los modos claro y oscuro.

**Convención de las pruebas:** la de `05-detalle-de-tarjeta.md` (hoy es el 19 de noviembre de 2026, tarjeta "Visa Bancolombia", respuesta CON_CUOTAS), con este `detalle` simulado, llamado CUATRO (**el frontend no verifica que cuadre** con `cuotas`):

| `descripcion` | `tipo` | `numeroCuota` / `totalCuotas` | `cuota` | Título de la fila | Valor |
|---|---|---|---|---|---|
| Mercado | COMPRA | 2 / 6 | 45000 | "Mercado · cuota 2/6" | "$ 45.000" |
| Tenis | COMPRA | 1 / 3 | 83478,247168 | "Tenis · cuota 1/3" | "$ 83.478" |
| Gasolina | COMPRA | 1 / 1 | 80000 | "Gasolina · pago único" | "$ 80.000" |
| Avance en efectivo | AVANCE | 3 / 12 | 119802,133172 | "Avance en efectivo · cuota 3/12" | "$ 119.802" |

Las decisiones D1 a D7 están al final; el desarrollador las aprobó el 2026-11-27 junto con los 11 criterios.

---

## RF-30 — De qué compras sale lo que se paga en el mes

### CA-RF30-F38 — La sección "Cuotas de este mes", una fila por compra

- **Dado** el detalle en el mes de hoy y que el backend responde CON_CUOTAS con el `detalle` CUATRO
- **Cuando** termina de cargar
- **Entonces** ve el encabezado "Cuotas de este mes" y, debajo, una fila por cada entrada con su título ("Mercado · cuota 2/6", "Tenis · cuota 1/3"…) y su valor ("$ 45.000", "$ 83.478"…), sin segunda línea ni "Vence".
- **Y** la sección va después de "Te queda por pagar después de este mes" y antes de "Próximos meses"; si no hay meses siguientes, la sección se ve igual (por ejemplo, en la última cuota de una compra). Lo demás de la pantalla no cambia de orden.

> Decisiones aprobadas: D1 (título), D2 (lugar) y D3 (sin segunda línea).

### CA-RF30-F39 — "pago único" y avances en efectivo

- **Dado** el detalle con CUATRO
- **Cuando** termina de cargar
- **Entonces** la compra a una sola cuota dice "Gasolina · pago único" (no "cuota 1/1"), y el avance se ve como una fila más, con su descripción tal como llega ("Avance en efectivo · cuota 3/12"), sin etiquetas añadidas ni la palabra "AVANCE".
- **Y** un avance con descripción propia ("Para el arriendo", 1 / 1) dice "Para el arriendo · pago único".

> Decisión aprobada: D4.

### CA-RF30-F40 — Todas las filas, en el orden del backend

- **Dado** que el backend responde un `detalle` de 30 entradas que no está en orden alfabético ni de valor, dos de ellas con la misma descripción y distinto `compraId`
- **Cuando** termina de cargar
- **Entonces** hay 30 filas en el mismo orden en que llegaron, las dos repetidas se ven por separado, y no hay "Ver más" ni paginación.

### CA-RF30-F41 — Una descripción larga se ve completa

- **Dado** una compra con una descripción de 200 caracteres, cuota 2 de 6
- **Cuando** el usuario ve su fila
- **Entonces** ve la descripción completa seguida de "· cuota 2/6", sin puntos suspensivos ni recortes, y su valor.

> Decisión aprobada: D6.

### CA-RF30-F42 — Se redondea al peso y no se calcula nada

- **Dado** que el backend responde `cuotas` 200000,8 y dos entradas de `cuota` 100000,4
- **Cuando** la pantalla las muestra
- **Entonces** cada fila dice "$ 100.000" y arriba sigue "Cuotas $ 200.001" (la suma de lo redondeado puede no coincidir, y la pantalla no la "corrige"); no hay fila de total ni de ajuste, ni decimales.

### CA-RF30-F43 — Sin cuotas en el mes no hay sección

- **Dado** que el backend responde `detalle: []`: con solo cargos fijos (SOLO_CARGOS), antes del primer pago (ANTES_DEL_PRIMER_PAGO) o con la tarjeta sin nada (VACIA)
- **Cuando** termina de cargar
- **Entonces** no ve el encabezado "Cuotas de este mes", ni filas, ni un aviso de "sin cuotas"; lo demás queda como hoy (CA-RF30-F15 a F17).
- **Y** los cargos fijos nunca aparecen como filas, haya o no compras: siguen sumados en la línea "Cargos fijos".

### CA-RF30-F44 — Registrar un pago no marca ni quita filas

- **Dado** el detalle con CUATRO y que, tras registrar un pago por todo el estimado, el backend responde el mismo `detalle` con `pagado` igual a `total`
- **Cuando** se guarda el pago y las cifras se vuelven a pedir
- **Entonces** ve las mismas cuatro filas, con los mismos textos y valores, sin "Pagada", "Pendiente", tachados ni marcas; lo pagado se ve en su bloque, como en 5.3.4.
- **Y** si la respuesta nueva trae otro `detalle` (se vuelve a pedir tras un pago o al volver a la pantalla), las filas son las nuevas.

### CA-RF30-F45 — Carga y error son los de la pantalla; no hay consultas nuevas

- **Dado** que el usuario abre el detalle y la primera respuesta de la proyección falla
- **Cuando** ve el aviso, toca "Reintentar" y el backend responde con CUATRO
- **Entonces** con el aviso y mientras carga (incluido el arranque en frío, RNF-02) no hay sección ni filas; al responder bien aparecen. En total solo se pidió la proyección (dos veces), la tarjeta y los pagos: ninguna consulta de compras.

### CA-RF30-F46 — Cada fila se lee como una frase y no se toca

- **Dado** el detalle con CUATRO
- **Cuando** un lector de pantalla lo recorre
- **Entonces** el encabezado es texto legible y cada fila se anuncia como una sola frase: "Mercado, cuota 2 de 6, $ 45.000", "Gasolina, pago único, $ 80.000"; el círculo no se anuncia.
- **Y** las filas no son botones: tocarlas no navega, no abre nada y no llama al backend.

> Decisión aprobada: D5.

### CA-RF30-F47 — Si el backend no manda `detalle`, la pantalla no se rompe

- **Dado** una respuesta de la proyección sin el campo `detalle` (un backend que aún no está actualizado)
- **Cuando** termina de cargar
- **Entonces** ve el detalle como hoy (total, pagado, lo que queda y próximos meses), sin la sección y sin avisos de error.

> Decisión aprobada: D7.

## RF-31 — Las cuotas de otros meses

### CA-RF31-F10 — Al cambiar de mes, la sección es la de ese mes

- **Dado** el detalle en noviembre 2026 con CUATRO y que, para diciembre 2026, el backend responde solo "Mercado" con cuota 3 de 6
- **Cuando** el usuario toca "Mes siguiente"
- **Entonces** mientras carga no se ve ninguna fila de noviembre, y al responder ve el encabezado "Cuotas de diciembre 2026" y solo "Mercado · cuota 3/6".
- **Y** en un mes pasado el encabezado sigue la misma forma ("Cuotas de octubre 2026").

> Decisión aprobada: D1.

---

## Decisiones tomadas (aprobadas el 2026-11-27)

- **D1. Nombre de la sección:** "Cuotas de este mes" en el mes de hoy y "Cuotas de diciembre 2026" en los demás. El Figma dice "CUOTAS PENDIENTES", pero la lista es lo que toca pagar en el mes consultado: sigue igual después de pagar y también aparece en meses pasados, así que "pendientes" podría ser falso.
- **D2. Lugar:** después de "Te queda por pagar…" y antes de "Próximos meses" (debajo de todo el resumen, como en el Figma, sin mover lo existente).
- **D3. Segunda línea de la fila:** ninguna. El Figma pone "Vence 28 sep" y la API no tiene fecha de vencimiento; no se inventa otro dato en su lugar.
- **D4. Avances:** sin marca especial; se ven con su descripción (por defecto el servidor pone "Avance en efectivo").
- **D5. Tocar una fila:** no hace nada; no hay pantalla de la compra en este alcance.
- **D6. Descripción larga (hasta 200 caracteres):** se ve completa, en las líneas que haga falta.
- **D7. Respuesta sin `detalle`:** se tolera (no se muestra la sección), para que la web publicada no se rompa si el backend desplegado va atrasado.

## Efecto en lo existente

Ningún comportamiento ya aprobado cambia. Se anotó en `05-detalle-de-tarjeta.md` y `05-pago-de-tarjeta.md` que el `detalle` se cubre aquí (CA-RF30-F33 sigue valiendo: no se ve "CUOTAS PENDIENTES" ni "Vence"), y las respuestas simuladas de las pruebas (`proyeccionDe` y el adaptador) incluyen `detalle`.
