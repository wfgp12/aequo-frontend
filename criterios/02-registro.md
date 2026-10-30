# Criterios de aceptación — 2. Registro (frontend)

Estado: Aprobado (2026-10-29), tal como están. Los comportamientos marcados "Pendiente de decisión" siguen sin decidir y no tienen prueba.

Este archivo cubre por ahora solo el paquete **2.2.5 — lista de movimientos** (carga progresiva, orden de más recientes primero, filtros Desde/Hasta). Fuentes: Diccionario de la EDT (2.2.5), wireframe "Movimientos" de Figma (6:2), decisiones de UX de `CLAUDE.md` y contrato `GET /transacciones` (`desde`, `hasta`, `limite` 1-100 por defecto 20, `cursor`; responde `{ items, siguienteCursor }` con fecha descendente).

**Fuera de este paquete:** la edición (sheet 6:68) y la eliminación (diálogo 6:149) no están en la rama `feature/lista-de-movimientos`; van en un paquete posterior y no tienen criterios aquí. Los criterios del 2.2.4 (registro paso a paso) tampoco están todavía en este archivo.

**Sobre los IDs:** la Especificación de Requisitos no tiene un RF propio de "listar movimientos". Uso el RF-06 (lo que se registra de un movimiento: descripción, monto, fecha, categoría y método de pago) para lo que muestra la lista, el RF-09 (fechas pasadas, presentes y futuras) para los filtros por fecha y el RF-02 (solo los datos propios) para la sesión.

---

## RF-06 — Ver los movimientos registrados

### CA-RF06-01 — Cada movimiento muestra su título, su detalle y su monto con signo

- **Dado** que el backend devuelve un egreso "Almuerzo" de $45.000 en la categoría Alimentación pagado con débito, y un ingreso "Salario" de $3.400.000 por transferencia
- **Cuando** el usuario abre Movimientos
- **Entonces** ve "Almuerzo", "Alimentación · Tarjeta débito" y "− $ 45.000"; y ve "Salario", y "+ $ 3.400.000". El egreso lleva signo menos, el ingreso signo más, y los montos llevan punto como separador de miles.

### CA-RF06-02 — Sin nota, el título es la categoría

- **Dado** un movimiento sin descripción, de categoría Transporte, pagado en efectivo
- **Cuando** el usuario lo ve en la lista
- **Entonces** el título es "Transporte" y debajo solo aparece "Efectivo" (sin repetir la categoría).

### CA-RF06-03 — Los métodos de pago se muestran con nombres cotidianos

- **Dado** movimientos pagados con efectivo, débito, transferencia y tarjeta de crédito (esta última viene de compras del módulo de tarjetas)
- **Cuando** el usuario los ve en la lista
- **Entonces** el método se lee "Efectivo", "Tarjeta débito", "Transferencia" y "Tarjeta crédito", respectivamente.

### CA-RF06-04 — Los montos se muestran redondeados al peso

- **Dado** un movimiento cuyo monto llega como 45000.6
- **Cuando** el usuario lo ve en la lista
- **Entonces** ve "− $ 45.001". La pantalla no calcula nada: solo redondea al peso al mostrar (RNF-11).

### CA-RF06-05 — Los movimientos se agrupan por día, en el orden que entrega el backend

- **Dado** movimientos de hoy, de ayer y de un día anterior, entregados del más reciente al más antiguo
- **Cuando** el usuario abre Movimientos
- **Entonces** ve un encabezado por día: "HOY · JUEVES 17 SEP", "AYER · MIÉRCOLES 16 SEP" y "LUNES 14 SEP" (los anteriores, solo con día de la semana, número y mes abreviado), y cada movimiento aparece bajo el encabezado de su día. Los movimientos del mismo día comparten un solo encabezado y se respeta el orden recibido (más recientes primero).

> Pendiente de decisión: el encabezado no lleva año, así que un movimiento de 2020 se lee igual que uno de este año ("LUNES 2 MAR"). Falta definir si se agrega el año cuando no es el actual.

### CA-RF06-06 — Un movimiento sin categoría tiene un título neutro

- **Dado** un movimiento sin descripción y sin categoría
- **Cuando** el usuario lo ve en la lista
- **Entonces** el título es "Sin categoría" y debajo solo aparece el método de pago.

> Pendiente de decisión: por RF-12, al eliminar una categoría sus movimientos pasan a "Otros", así que este caso no debería darse. Confirma si se mantiene como respaldo o se descarta.

---

## Carga de la lista (RNF-02, RNF-04)

### CA-RF06-07 — Al abrir pide la primera página con "Hasta" en hoy

- **Dado** que el usuario entró a Movimientos
- **Cuando** la pantalla se abre
- **Entonces** se hace una sola consulta con `hasta` igual a la fecha de hoy, sin `desde` y sin `limite` (se usa el de 20 por defecto del backend).

### CA-RF06-08 — Mientras carga muestra un indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario espera
- **Entonces** ve un indicador "Cargando tus movimientos" y no ve ni la lista vacía ni un error.

> Pendiente de decisión: no está definido qué se muestra si la espera es muy larga (más de unos segundos por el arranque en frío). Hoy solo hay el indicador.

### CA-RF06-09 — Sin movimientos, un aviso sencillo

- **Dado** que el backend devuelve una página sin movimientos
- **Cuando** termina de cargar
- **Entonces** ve "No hay movimientos en este periodo." y no ve la lista.

> Pendiente de decisión: el wireframe 6:2 no trae estado vacío; el texto lo propuso la implementación. Confirma el texto o el diseño.

### CA-RF06-10 — Si falla la carga, avisa y permite reintentar

- **Dado** que la primera consulta falla por falta de conexión
- **Cuando** el usuario ve la pantalla
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." y un botón "Reintentar"; al tocarlo se vuelve a consultar y, si ahora responde, ve sus movimientos.
- **Y** si el fallo es cualquier otro, ve "No pudimos cargar tus movimientos. Inténtalo de nuevo en unos minutos." sin términos técnicos.

---

## Carga progresiva (EDT 2.2.5)

### CA-RF06-11 — Al llegar al final se piden más movimientos y se agregan al final

- **Dado** que la primera página trae un cursor de "siguiente página"
- **Cuando** el usuario llega al final de la lista
- **Entonces** se pide la siguiente página enviando ese cursor con los mismos filtros, y los movimientos nuevos aparecen al final sin perder los que ya estaban.
- **Y** mientras llega, ve "Cargando más…" al final de la lista.

### CA-RF06-12 — Cuando ya no hay más, no se vuelve a pedir

- **Dado** que la última página llegó sin cursor de siguiente página
- **Cuando** el usuario llega al final de la lista
- **Entonces** no se hace ninguna consulta nueva.

### CA-RF06-13 — No se pide dos veces la misma página

- **Dado** que la página siguiente ya se está cargando
- **Cuando** el usuario vuelve a llegar al final antes de que termine
- **Entonces** no se envía una segunda solicitud.

### CA-RF06-14 — Si falla la página siguiente, conserva lo cargado y permite reintentar

- **Dado** una lista con movimientos ya cargados y un cursor de siguiente página
- **Cuando** la consulta de la siguiente página falla por falta de conexión
- **Entonces** ve el aviso "No hay conexión con el servidor…", los movimientos que ya tenía siguen visibles y hay un botón "Reintentar"; al tocarlo se pide de nuevo la misma página y, si responde, se agregan al final.
- **Y** si el fallo es otro, el aviso dice "No pudimos cargar más movimientos. Inténtalo de nuevo en unos minutos."

---

## RF-09 — Filtros Desde y Hasta

### CA-RF09-01 — "Hasta" empieza en hoy y "Desde" vacío

- **Dado** que el usuario abre Movimientos
- **Cuando** ve los filtros
- **Entonces** "Desde" no tiene fecha (se lee "dd/mm/aaaa") y "Hasta" tiene la fecha de hoy.

> Pendiente de decisión: el wireframe 6:2 escribe "Hoy" dentro del campo "Hasta"; la implementación muestra la fecha (por ejemplo "29/10/2026"). Confirma cuál se queda.

### CA-RF09-02 — Elegir una fecha vuelve a consultar con ese filtro

- **Dado** la lista abierta con "Desde" vacío
- **Cuando** el usuario toca "Desde" y elige el primer día del mes en el calendario
- **Entonces** el calendario se cierra, se consulta de nuevo con `desde` en esa fecha y el mismo `hasta`, y la lista se reemplaza por el resultado (ver CA-RF09-04).

### CA-RF09-03 — Se puede quitar una fecha

- **Dado** un filtro con fecha
- **Cuando** el usuario toca el filtro y luego "Quitar esta fecha"
- **Entonces** el filtro queda "sin fecha" y se consulta de nuevo sin ese límite.

### CA-RF09-04 — Al cambiar un filtro no se mezclan resultados

- **Dado** una lista ya cargada
- **Cuando** el usuario cambia un filtro
- **Entonces** los movimientos anteriores desaparecen mientras carga la consulta nueva y solo ve los del resultado nuevo.

### CA-RF09-05 — Una respuesta tardía de un filtro anterior no pisa el actual

- **Dado** que el usuario cambia un filtro mientras todavía llega la respuesta de la consulta anterior (o de una "página siguiente" pedida con el filtro anterior)
- **Cuando** esa respuesta atrasada llega
- **Entonces** se descarta y no se agrega a la lista: solo se ve el resultado del filtro vigente.

> Pendiente de decisión: "Desde" posterior a "Hasta". El backend responde 400 ("desde no puede ser posterior a hasta") y hoy el usuario vería el mensaje genérico "No pudimos cargar tus movimientos…". Falta definir si se impide elegirla o qué mensaje se muestra.

> Pendiente de decisión: con "Hasta" en hoy por defecto, los movimientos con fecha futura (permitidos por RF-09) no aparecen hasta que el usuario cambia o quita "Hasta". Confirma que es lo buscado; el wireframe solo dice que "Hasta" arranca en hoy.

---

## RF-02 — Solo los datos propios y sesión

### CA-RF02-01 — Contrato del adaptador `listarTransacciones` (`GET /transacciones`)

- **Dado** una sesión vigente
- **Cuando** se pide la lista
- **Entonces** se llama `GET /transacciones` con el JWT propio en `Authorization: Bearer …`; si hay filtros, se envían `desde`, `hasta`, `limite` y `cursor` como parámetros tal cual, y los que estén vacíos o sin definir se omiten.
- **Y** si el backend responde 401 se cierra la sesión (la app vuelve al login); si responde 400 el error llega con el mensaje del backend y la sesión **no** se cierra.

---

## No aplica en este paquete

- **Doble toque en guardar o eliminar:** la lista no guarda ni elimina nada (eso llega con la edición). El doble disparo que sí aplica es el de la carga de la página siguiente (CA-RF06-13).
- **Periodo del dashboard:** la lista usa sus propios filtros y no comparte estado con el dashboard (decisión de `CLAUDE.md`); no hay comportamiento propio que probar.

## Diferencias con el wireframe 6:2 para que decidas

1. El campo "Hasta" dice "Hoy" en el diseño y la fecha en la implementación (ver CA-RF09-01).
2. El diseño no tiene la flecha "‹ Volver" del encabezado (usa la barra inferior de navegación); la implementación la agrega y su prueba previa la daba por buena. No la cubro con un criterio hasta que decidas si se queda.
3. El diseño no trae estado vacío ni de error; los textos actuales son de la implementación.
