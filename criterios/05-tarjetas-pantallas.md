# Criterios de aceptación — 5. Tarjetas de crédito: pantallas de tarjetas y cargos fijos (paquete 5.1.3)

Estado: Aprobado

Cubre RF-24 (registrar tarjetas), RF-25 (cambiar la tasa), RF-29 (cargos fijos de una tarjeta) y RF-33 (editar y eliminar tarjetas y cargos fijos) en el frontend. El criterio de la EDT es: "El usuario puede crear, editar, activar o desactivar y eliminar tarjetas y cargos fijos sin salir del módulo." El backend (5.1.2, ya en `develop`) solo guarda y devuelve: no calcula cuotas, deuda, proyección ni totales. Aquí solo se verifica qué ve el usuario, qué se envía y cómo se explican los errores (RNF-11: las pantallas no calculan nada; lo único que transforman es la tasa entre el porcentaje que escribe la persona y la fracción que usa la API, que es presentación).

**Decisión ya tomada por el desarrollador: las pantallas se hacen solo con lo que da la API.** El backend no guarda cupo, día de corte ni día de pago (ningún RF los pide), y la deuda de cada tarjeta llega con la proyección del módulo 5.3. Por eso, frente al Figma:
- El formulario **no** tiene "Cupo total (opcional)", "Día de corte" ni "Día de pago". Tiene "Alias" (el `nombre` de la API), "Tasa de interés E.A." y el interruptor "Compras a 1 cuota sin intereses" (`cuotaUnicaSinInteres`).
- La lista **no** muestra "Corte 15 · Pago 28", ni "$ 1.200.000 deuda" por fila, ni el recuadro "Deuda total en tarjetas". Cada fila muestra el nombre y la tasa.

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- El recuadro "Deuda total en tarjetas", la deuda por fila y "Corte … · Pago …": sin datos en la API (decisión de arriba). La deuda llega con 5.3.
- El "Detalle de tarjeta" (deuda, cupo disponible, próximo pago, cuotas pendientes, "Marcar como pagada"): paquete 5.3.3. Por ahora tocar una fila abre el formulario de editar; el detalle lo reemplazará después.
- El registro de compras con tarjeta, cuotas y avance en efectivo: paquete 5.2.4. La opción "Tarjeta de crédito" del registro de movimientos no cambia aquí.
- La versión de escritorio (tabla y panel lateral, 1280 px), el modal de confirmar eliminación de 1280 px, la barra de navegación inferior y el bottom sheet "Más": no existen todavía. La entrada es un botón en `app/index.tsx`, como "Reportes" y "Meta de ahorro".
- Un interruptor "Activo" directamente en la lista de cargos: activar y desactivar se hace solo desde el formulario del cargo (decisión más abajo).
- Ver o editar la cuota única de compras ya hechas: `cuotaUnicaSinInteres` y la tasa solo afectan compras futuras y eso lo guarda el backend; aquí solo se explica con una nota (CA-RF24-F30).
- Colores, tamaños, tipografía, el círculo de cada fila y el aspecto de los interruptores, en modo claro y oscuro: **revisión visual contra Figma**, no se prueba con Jest.
- Todo cálculo (cuotas, intereses, deuda, total del mes): del backend, en otros paquetes.

**Fuentes:** Especificación de Requisitos (RF-24, RF-25, RF-29, RF-33), CLAUDE.md (confirmar siempre las eliminaciones; carga y arranque en frío de Render, RNF-02; lenguaje sencillo, RNF-04; accesibilidad, RNF-06; cálculos en el backend, RNF-11; modo claro y oscuro), Figma sección 06 · Tarjetas de crédito, frames móviles (360 px), solo con el texto leído: "Mis tarjetas" (encabezado "‹ Mis tarjetas", filas con nombre, y el botón punteado "+ Agregar tarjeta"), "Nueva tarjeta" (campos "Alias" con "Ej: Visa Bancolombia", "Tasa de interés E.A." con "Ej: 24%", interruptor "Compras a 1 cuota sin intereses" y botón "Guardar tarjeta"), "Cargos fijos de tarjeta" (título con el nombre de la tarjeta, secciones "ACTIVOS ESTE MES" con "Netflix · $ 45.000 al mes" y "Spotify · $ 25.000 al mes", "INACTIVOS" con "Gimnasio · $ 90.000 al mes", y el botón punteado "+ Agregar cargo fijo") y "Agregar/editar cargo fijo" (interruptor "Activo este mes" y "Eliminar cargo fijo"); contrato `coordinacion/contratos/tarjetas.md` (estado "propuesto"; backend ya implementado: falta la conformidad del frontend) y criterios del backend `CA-RF24-17..38`, `CA-RF25-01..06`, `CA-RF29-18..38` y `CA-RF33-01..26` (`aequo-backend/criterios/05-tarjetas.md`, paquete 5.1.2).

**Contrato del backend que importa aquí** (`/tarjetas`, todas las rutas con sesión):
- Tarjeta: `{ id, nombre, tasaEA, cuotaUnicaSinInteres, creadaEn, actualizadaEn }`. `tasaEA` es una **fracción de 0 a 1** (29,21 % = `0.2921`; 0 es válido; `29.21` da 400). `nombre`: texto recortado, máximo 50, único por usuario sin distinguir mayúsculas ni espacios. `cuotaUnicaSinInteres`: lógico, `false` por defecto.
- Cargo fijo: `{ id, tarjetaId, descripcion, valor, activo, creadaEn, actualizadaEn }`. `descripcion`: máximo 100. `valor`: pesos, mayor que 0. `activo`: `true` por defecto.
- `POST /tarjetas` `{ nombre, tasaEA, cuotaUnicaSinInteres? }` con `Idempotency-Key` → `201` con la tarjeta; `400`; `409` "Ya existe una tarjeta con ese nombre"; `422` (misma clave con otro cuerpo).
- `GET /tarjetas` → `200 { items: [tarjeta] }`, ya ordenada por nombre sin distinguir mayúsculas, sin paginación; `[]` si no hay.
- `PATCH /tarjetas/:id` con al menos uno de `nombre`, `tasaEA`, `cuotaUnicaSinInteres` → `200` con la tarjeta. **Aquí se cambia la tasa (RF-25)**; no hay ruta aparte. `404` "Tarjeta no encontrada"; `409` por nombre repetido; `400`. Sin `Idempotency-Key`.
- `DELETE /tarjetas/:id` → `204` sin cuerpo; borra en cascada los cargos fijos de la tarjeta. `409` "No se puede eliminar una tarjeta que ya tiene pagos registrados" (no borra nada); `404`.
- `POST /tarjetas/:tarjetaId/cargos` `{ descripcion, valor, activo? }` con `Idempotency-Key` → `201` con el cargo; `404` "Tarjeta no encontrada"; `400`; `422`.
- `GET /tarjetas/:tarjetaId/cargos` (opcional `?activo=true|false`) → `200 { items: [cargo] }` por fecha de creación ascendente; `404` si la tarjeta no existe.
- `PATCH /tarjetas/:tarjetaId/cargos/:id` con al menos uno de `descripcion`, `valor`, `activo` → `200` con el cargo. **Activar y desactivar es un `PATCH` de `activo`.** `404` "Cargo fijo no encontrado"; `400`. Sin clave.
- `DELETE /tarjetas/:tarjetaId/cargos/:id` → `204` sin cuerpo; `404`.
- `401` en cualquier ruta: el cliente HTTP compartido cierra la sesión y la app vuelve al login (sin aviso propio de la pantalla). `404` nunca es `403`.

**Interfaz pública** (queda aprobada con estos criterios):
- Pantalla de la lista: ruta `/tarjetas`, protegida por sesión (`Stack.Protected` en `app/_layout.tsx`).
- El formulario de la tarjeta (nueva y editar) es una **hoja** sobre la lista, como la edición de movimientos y la nueva categoría; el diálogo de eliminar es un diálogo, como "¿Eliminar este movimiento?".
- Pantalla de los cargos fijos de una tarjeta: ruta `/tarjetas/<id>/cargos`, protegida por sesión, con el parámetro `nombre` (el nombre de la tarjeta, que es el título). Se llega con `router.push({ pathname: '/tarjetas/[id]/cargos', params: { id, nombre } })`. El formulario del cargo es una hoja sobre esa pantalla.
- Entrada: un botón "Tarjetas" en `app/index.tsx`, junto a "Movimientos", "Reportes", "Meta de ahorro" y "Mi perfil".
- Adaptador nuevo `lib/api/tarjetas.ts` (sobre `requestAutenticado`, como `lib/api/ahorro.ts`): ver "Contrato del adaptador" al final.
- Utilidad nueva `lib/tasa.ts` con las dos conversiones de la tasa (CA-RF24-F23 y F24): `porcentajeAFraccion(texto: string): number | null` y `fraccionAPorcentaje(fraccion: number): string`.
- Se reutilizan `CampoMonto` (`components/campo-monto.tsx`), `normalizarPorcentaje` de `components/ahorro/campo-porcentaje.tsx` (el campo de la tasa lleva sus propios textos: "Tasa de interés E.A.", no "% de tus ingresos"), `formatearPesos` (`lib/dinero.ts`), `requestAutenticado`, `ApiError` y `NetworkError`.

**Sobre los IDs:** los `CA-RF24-17..38`, `CA-RF29-18..38` y similares ya los usa el backend para su lado (otro repositorio). Para no confundirlos, estos llevan la letra F (`CA-RF24-F01`…, `CA-RF29-F01`…), como hizo `04-ahorro-meta.md`. Bajo `CA-RF24-F` va todo lo de **tarjetas** (RF-24, RF-25 y la edición y eliminación de RF-33); bajo `CA-RF29-F`, todo lo de **cargos fijos** (RF-29 y su edición y eliminación de RF-33). Las notas "Decisión" recogen textos o comportamientos que el Figma, el RF y el contrato no definen: el desarrollador debe aprobarlos (los textos propuestos quedan aprobados tal como están escritos).

**Convención de las pruebas:** el backend se simula en el borde del adaptador (`jest.mock('@/lib/api/tarjetas')`) en las pruebas de las pantallas, y `fetch`/`requestAutenticado` en las del adaptador, igual que las pruebas de la meta de ahorro. `expo-router` se simula con `useRouter` (`back`, `push`) y `useLocalSearchParams` (`id`, `nombre`) en la pantalla de cargos. La clave de idempotencia nace en el formulario (`randomUUID` de `expo-crypto`). Los ejemplos usan la tarjeta "Visa Bancolombia" (tasa `0.2921`) y los cargos "Netflix" 45000, "Spotify" 25000 (activos) y "Gimnasio" 90000 (inactivo).

---

# Tarjetas (`CA-RF24-F`)

## Entrada y ruta

### CA-RF24-F01 — Desde el inicio se llega a "Tarjetas"

- **Dado** una sesión vigente en la vista de inicio
- **Cuando** el usuario ve las opciones
- **Entonces** hay un botón "Tarjetas" (junto a "Movimientos", "Reportes", "Meta de ahorro" y "Mi perfil") que lleva a la ruta `/tarjetas`.

### CA-RF24-F02 — Solo con sesión

- **Dado** que no hay sesión (o está cerrada)
- **Cuando** se arma la navegación de la app
- **Entonces** ni la lista de tarjetas ni la pantalla de cargos fijos están disponibles (la app lleva al login, como Reportes y Perfil); con sesión activa, sí.

### CA-RF24-F03 — Título y "Volver"

- **Dado** la pantalla de tarjetas
- **Cuando** el usuario la abre
- **Entonces** ve el título "Mis tarjetas" y un botón "Volver" (el mismo "‹" de Reportes y Movimientos) que regresa a la pantalla anterior.

---

## Carga de la lista

### CA-RF24-F04 — Al entrar se piden las tarjetas, una sola vez

- **Dado** una sesión vigente
- **Cuando** el usuario abre "Mis tarjetas"
- **Entonces** se llama a `listarTarjetas()` una sola vez (`GET /tarjetas`) y no se envía nada más (no se crea, edita ni elimina nada al entrar).

### CA-RF24-F05 — Mientras carga, solo el indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** ve el título "Mis tarjetas" y un indicador de carga ("Cargando tus tarjetas"); no ve la lista, ni "+ Agregar tarjeta", ni el aviso de vacío, ni avisos de error.

> Decisión: sin saber si hay tarjetas, mostrar "Todavía no tienes tarjetas" o dejar tocar "+ Agregar tarjeta" a destiempo daría una imagen falsa de la cuenta. El botón aparece cuando termina la consulta.

### CA-RF24-F06 — Si la consulta falla, avisa y permite reintentar

- **Dado** que el backend responde `500` (u otro error que no sea de red ni `401`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar tus tarjetas. Inténtalo de nuevo en unos minutos." con un botón "Reintentar", y no ve la lista ni "+ Agregar tarjeta".
- **Y** al tocar "Reintentar" vuelve a ver el indicador de carga y se consulta de nuevo; si ahora responde bien, ve la lista.

> Decisión: texto calcado de "No pudimos cargar tus categorías…" y "No pudimos cargar tu meta de ahorro…" (RNF-04).

### CA-RF24-F07 — Sin conexión

- **Dado** que la consulta falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar", y el título "Mis tarjetas" y "Volver" siguen visibles.

### CA-RF24-F08 — Sesión vencida al cargar (401)

- **Dado** que el backend responde `401` a la consulta
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión (lo resuelve el cliente HTTP compartido); la pantalla no muestra un aviso de error propio.

---

## Lo que se ve según haya o no tarjetas

### CA-RF24-F09 — Sin tarjetas: invita a agregar la primera

- **Dado** que el backend responde `{ items: [] }`
- **Cuando** termina de cargar
- **Entonces** ve "Todavía no tienes tarjetas. Agrega la primera para empezar." y el botón "+ Agregar tarjeta"; no ve filas ni avisos de error.

> Decisión: el texto del estado vacío no está en el Figma; se propone en lenguaje cotidiano (RNF-04).

### CA-RF24-F10 — Con tarjetas: una fila por tarjeta, en el orden del backend

- **Dado** que el backend responde con "Amex" (tasa `0.2421`) y "Visa Bancolombia" (tasa `0.2921`), en ese orden
- **Cuando** termina de cargar
- **Entonces** ve una fila por tarjeta, en el mismo orden en que llegaron, cada una con su nombre ("Amex", "Visa Bancolombia") y su tasa ("Tasa 24,21 % E.A.", "Tasa 29,21 % E.A."), y al final el botón "+ Agregar tarjeta".
- **Y** no ve "Deuda total en tarjetas", ni "deuda" en las filas, ni "Corte" ni "Pago" con días (la API no tiene esos datos).

> Decisión (del desarrollador, ya tomada): sin deuda, corte ni pago hasta que llegue la proyección (5.3). Es una desviación del Figma. Decisión (propuesta): la fila dice "Tasa 29,21 % E.A."; la pantalla no reordena las tarjetas (el backend ya las manda por nombre sin distinguir mayúsculas).

### CA-RF24-F11 — La tasa de la fila se muestra sin ruido

- **Dado** tarjetas con tasa `0.24`, `0.2921`, `0.083`, `0.07`, `0.57`, `0` y `1`
- **Cuando** el usuario ve la lista
- **Entonces** las filas dicen "Tasa 24 % E.A.", "Tasa 29,21 % E.A.", "Tasa 8,3 % E.A.", "Tasa 7 % E.A.", "Tasa 57 % E.A.", "Tasa 0 % E.A." y "Tasa 100 % E.A." (con coma decimal, sin ceros ni decimales de más, sin ruidos como "7,000000000000001").

### CA-RF24-F12 — "+ Agregar tarjeta" abre el formulario vacío

- **Dado** la lista cargada (con o sin tarjetas)
- **Cuando** el usuario toca "+ Agregar tarjeta"
- **Entonces** se abre la hoja "Nueva tarjeta" (CA-RF24-F14) con "Alias" y "Tasa de interés E.A." vacíos y el interruptor "Compras a 1 cuota sin intereses" apagado.

### CA-RF24-F13 — Tocar una fila abre el mismo formulario con los datos de esa tarjeta

- **Dado** la lista con "Visa Bancolombia" (tasa `0.2921`, `cuotaUnicaSinInteres` `true`)
- **Cuando** el usuario toca esa fila
- **Entonces** se abre la hoja "Editar tarjeta" con "Alias" en "Visa Bancolombia", "Tasa de interés E.A." en "29,21" y el interruptor "Compras a 1 cuota sin intereses" encendido; no se llama al backend (los datos salen de la lista ya cargada).

> Decisión (del arquitecto): tocar la fila abre el formulario de editar; el detalle con deuda y cuotas (5.3.3) lo reemplazará.

---

## El formulario de la tarjeta

### CA-RF24-F14 — Qué contiene el formulario, para una tarjeta nueva y para una existente

- **Dado** la hoja abierta
- **Cuando** el usuario la lee
- **Entonces** ve el título ("Nueva tarjeta" o "Editar tarjeta"), un botón "Volver", el campo "Alias" (con el marcador "Ej: Visa Bancolombia"), el campo "Tasa de interés E.A." (con el marcador "Ej: 24%"), el interruptor "Compras a 1 cuota sin intereses" y el botón "Guardar tarjeta".
- **Y** en "Editar tarjeta" ve además los botones "Cargos fijos" y "Eliminar tarjeta", y la nota "Si cambias la tasa, aplica solo a las compras nuevas. Las anteriores conservan la que tenían."; en "Nueva tarjeta" no ve ninguno de los tres.
- **Y** no ve "Cupo total", "Día de corte" ni "Día de pago".

> Decisión: el Figma muestra el mismo formulario para agregar y editar, con el botón "Guardar tarjeta" en ambos casos. "Cargos fijos" y "Eliminar tarjeta" no están en el frame móvil leído: se proponen en la hoja de editar, igual que "Eliminar movimiento" en la edición de movimientos. La nota sobre la tasa explica RF-25 (se propone, en lenguaje cotidiano, calcada de la nota de la meta de ahorro). Los textos de "Cargos fijos", "Eliminar tarjeta" y la nota quedan aprobados tal como están escritos.

### CA-RF24-F15 — "Volver" cierra la hoja sin guardar

- **Dado** la hoja abierta, con o sin cambios escritos
- **Cuando** el usuario toca "Volver"
- **Entonces** la hoja se cierra, no se envía nada al backend y la lista queda igual.

> Decisión: si el usuario escribió algo no se le pide confirmar antes de descartarlo (igual que la edición de movimientos, CA-RF08-03).

### CA-RF24-F16 — El campo de la tasa escribe un porcentaje con coma o punto y hasta dos decimales

- **Dado** el formulario
- **Cuando** el usuario escribe "29,21", o "29.21", o "abc29,21", o "-5"
- **Entonces** el campo muestra "29,21" (la coma y el punto valen como separador decimal y se muestra coma; solo queda un separador), y con "-5" muestra "5": letras y signos no se pueden escribir.
- **Y** si escribe "12,555" el campo conserva "12,55" (hasta dos decimales).

> Decisión: mismo comportamiento que el campo de porcentaje de la meta (CA-RF21-F16). Por eso una tasa negativa o con letras nunca llega a validarse: no se puede escribir. El tope de dos decimales es un límite de la interfaz (la API admite más).

### CA-RF24-F17 — El interruptor cambia al tocarlo

- **Dado** el formulario con el interruptor "Compras a 1 cuota sin intereses" apagado
- **Cuando** el usuario lo toca
- **Entonces** queda encendido; al volver a tocarlo, apagado.

---

## Validación antes de llamar al backend

### CA-RF24-F18 — Alias vacío: no se envía

- **Dado** el formulario con "Alias" vacío o solo con espacios y una tasa válida
- **Cuando** el usuario toca "Guardar tarjeta"
- **Entonces** ve el aviso "Escribe un alias para tu tarjeta." y no se llama al backend (ni para crear ni para editar).

### CA-RF24-F19 — Alias de más de 50 caracteres: no se envía

- **Dado** el formulario con un "Alias" de 51 caracteres y una tasa válida
- **Cuando** el usuario toca "Guardar tarjeta"
- **Entonces** ve el aviso "El alias no puede tener más de 50 caracteres." y no se llama al backend.
- **Y** con 50 caracteres sí se envía.

### CA-RF24-F20 — Tasa vacía: no se envía

- **Dado** el formulario con "Tasa de interés E.A." vacía (o solo ",") y un alias válido
- **Cuando** el usuario toca "Guardar tarjeta"
- **Entonces** ve el aviso "Escribe la tasa de interés. Si tu tarjeta no cobra intereses, escribe 0." y no se llama al backend.

> Decisión: la tasa es obligatoria en la API (sin tasa, 400) y el Figma no la marca "(opcional)". Escribir "0" **sí** es una tasa válida (tarjeta sin intereses): a diferencia de la meta, aquí el cero no es error.

### CA-RF24-F21 — Tasa mayor que 100: no se envía; 0 y 100 sí

- **Dado** el formulario con "Tasa de interés E.A." en "100,01" (o "150")
- **Cuando** el usuario toca "Guardar tarjeta"
- **Entonces** ve el aviso "La tasa no puede pasar de 100." y no se llama al backend (la API respondería 400).
- **Y** con "100", con "0" y con "0,0" sí se envía (los extremos válidos: de 0 a 100).

### CA-RF24-F22 — El aviso desaparece al corregir

- **Dado** que el usuario ve un aviso de validación
- **Cuando** edita cualquier campo o toca el interruptor
- **Entonces** el aviso deja de verse.
- **Y** los avisos se anuncian como alerta.

---

## La tasa: del porcentaje a la fracción y de vuelta

### CA-RF24-F23 — Lo que el usuario escribe como porcentaje se envía como fracción exacta

- **Dado** el formulario (nueva tarjeta o editando la tasa)
- **Cuando** el usuario guarda con estos porcentajes
- **Entonces** el valor `tasaEA` que se envía es exactamente (número JSON, no texto, sin decimales de más):

| Escribe | Se envía `tasaEA` |
|---|---|
| "24" | `0.24` |
| "29,21" y "29.21" | `0.2921` |
| "12,5" | `0.125` |
| "8,3" | `0.083` |
| "57" | `0.57` |
| "0,07" | `0.0007` |
| "0" | `0` |
| "100" | `1` |
| "100,01" (no se envía: CA-RF24-F21) | (`porcentajeAFraccion` devuelve `1.0001`) |

- **Y** `porcentajeAFraccion` entrega esos mismos números exactos, y `null` si el texto no es un número ("", ",", "abc").

> Decisión (del arquitecto): la conversión es de presentación, no un cálculo financiero (RNF-11). Debe ser exacta en decimales: `29,21 → 0.2921`, no `0.29210000000000004`; en JavaScript `57 * 0.01` da `0.5700000000000001` y `0,07 * 0.01` da `0.0007000000000000001`, por eso los casos "57" y "0,07" están en la tabla. Se prueba por la pantalla (lo que llega a `crearTarjeta` / `actualizarTarjeta`) y directamente sobre la función.

### CA-RF24-F24 — La tasa guardada se muestra como porcentaje sin ruido

- **Dado** una tarjeta cuya tasa guardada es: `0.24`, `0.2921`, `0.125`, `0.083`, `0.07`, `0.57`, `0.0007`, `0.29213`, `0`, `1`
- **Cuando** el usuario abre "Editar tarjeta"
- **Entonces** el campo "Tasa de interés E.A." muestra respectivamente "24", "29,21", "12,5", "8,3", "7", "57", "0,07", "29,213" (no se recorta lo guardado), "0" y "100"; nunca "7,000000000000001", "56,99999999999999" ni "0,06999999999999999".
- **Y** `fraccionAPorcentaje` entrega esos mismos textos.
- **Y** si el usuario guarda sin tocar la tasa, la tasa no se envía (CA-RF24-F29).

---

## Guardar una tarjeta nueva

### CA-RF24-F25 — Crear envía el cuerpo exacto y una clave

- **Dado** la hoja "Nueva tarjeta"
- **Cuando** el usuario escribe "  Visa Bancolombia  " en "Alias", "29,21" en la tasa, enciende "Compras a 1 cuota sin intereses" y toca "Guardar tarjeta"
- **Entonces** se llama a `crearTarjeta({ nombre: 'Visa Bancolombia', tasaEA: 0.2921, cuotaUnicaSinInteres: true }, clave)` una sola vez, con una `clave` en formato UUID, y a nadie más (ni `actualizarTarjeta`).
- **Y** con el interruptor apagado se envía `cuotaUnicaSinInteres: false` (el campo siempre va).
- **Y** el cuerpo no lleva ningún otro campo (ni `id`, ni fechas).

> Decisión: el alias se envía sin los espacios de los extremos (el backend también los recorta). Siempre van los tres campos al crear.

### CA-RF24-F26 — Al crear, la hoja se cierra y la lista muestra la tarjeta

- **Dado** que el backend responde `201` con la tarjeta creada
- **Cuando** el usuario ve el resultado
- **Entonces** la hoja se cierra, se vuelve a pedir la lista (`listarTarjetas()` se llama otra vez) y, con la respuesta del backend (que ahora incluye la tarjeta nueva, en el orden que mande), la lista la muestra una sola vez, con su nombre y su tasa.
- **Y** no aparece un aviso de "guardada": ver la fila basta.

> Decisión: la lista se vuelve a pedir, en vez de insertar la tarjeta a mano, para que el orden lo ponga el backend y la pantalla no ordene nada. Sin aviso de confirmación, como al guardar un movimiento.

### CA-RF24-F27 — Mientras guarda ve un indicador y no se puede tocar de nuevo

- **Dado** que el backend aún no responde al guardado (por ejemplo, el arranque en frío de Render)
- **Cuando** el usuario espera
- **Entonces** el botón "Guardar tarjeta" muestra un indicador de carga en lugar de su texto y no se puede tocar de nuevo; la hoja sigue abierta con lo escrito.

### CA-RF24-F28 — Doble toque al crear: una sola solicitud

- **Dado** el formulario de una tarjeta nueva con datos válidos
- **Cuando** el usuario toca "Guardar tarjeta" dos veces seguidas
- **Entonces** se llama una sola vez a `crearTarjeta`, con una sola clave.

---

## Editar una tarjeta (y cambiar su tasa)

### CA-RF24-F29 — Editar envía solo lo que cambió

- **Dado** la hoja "Editar tarjeta" de "Visa Bancolombia" (tasa `0.2921`, interruptor encendido)
- **Cuando** el usuario cambia "Alias" a "Visa Oro" y toca "Guardar tarjeta"
- **Entonces** se llama a `actualizarTarjeta(id, { nombre: 'Visa Oro' })` una sola vez: solo el campo cambiado, sin `tasaEA` ni `cuotaUnicaSinInteres`, sin clave, y no se llama a `crearTarjeta`.
- **Y** si solo apaga el interruptor, se envía `{ cuotaUnicaSinInteres: false }`.
- **Y** si cambia el alias y el interruptor, se envían los dos campos juntos.
- **Y** si escribe el mismo alias con espacios sobrantes o la misma tasa con otro formato (por ejemplo "29.21" en lugar de "29,21"), eso no cuenta como cambio.

> Decisión: se envía solo lo que cambió, como en la edición de movimientos (CA-RF08-04); así el cambio de tasa viaja solo y la tasa guardada nunca se reenvía convertida de ida y vuelta.

### CA-RF24-F30 — Cambiar la tasa envía solo la tasa nueva

- **Dado** la hoja "Editar tarjeta" de "Visa Bancolombia" con tasa `0.2921`
- **Cuando** el usuario cambia la tasa a "31,5" y toca "Guardar tarjeta"
- **Entonces** se llama a `actualizarTarjeta(id, { tasaEA: 0.315 })` (la misma ruta de editar; no hay otra para la tasa), y al volver a la lista la fila dice "Tasa 31,5 % E.A.".
- **Y** el nombre de la tarjeta y las demás tarjetas no cambian; la pantalla no cambia ni muestra ningún valor de compras anteriores (lo que pasa con las compras ya hechas lo decide el backend).

### CA-RF24-F31 — Guardar sin cambios no llama al backend

- **Dado** la hoja "Editar tarjeta" recién abierta, sin tocar nada
- **Cuando** el usuario toca "Guardar tarjeta"
- **Entonces** no se envía ninguna solicitud (el backend rechazaría un cuerpo vacío) y la hoja se cierra.

> Decisión: se cierra en silencio, igual que CA-RF08-08.

### CA-RF24-F32 — Al editar con éxito, la hoja se cierra y la lista muestra el cambio

- **Dado** que el backend responde `200` con la tarjeta editada
- **Cuando** el usuario ve el resultado
- **Entonces** la hoja se cierra, se vuelve a pedir la lista y la fila de esa tarjeta muestra el nombre y la tasa nuevos, sin que la tarjeta aparezca duplicada.

### CA-RF24-F33 — Doble toque al editar: una sola solicitud

- **Dado** la hoja "Editar tarjeta" con un cambio válido
- **Cuando** el usuario toca "Guardar tarjeta" dos veces seguidas
- **Entonces** se llama una sola vez a `actualizarTarjeta`, y mientras llega la respuesta ve el indicador de carga en el botón.

---

## Errores al guardar una tarjeta

### CA-RF24-F34 — Alias repetido (409), al crear y al editar

- **Dado** que el backend responde `409` ("Ya existe una tarjeta con ese nombre") a `crearTarjeta` o a `actualizarTarjeta`
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Ya tienes una tarjeta con ese alias. Elige otro." dentro de la hoja, que sigue abierta con lo escrito; la sesión no se cierra y la lista no cambia.
- **Y** el aviso desaparece al cambiar el alias.

> Decisión: texto propuesto (RNF-04). Aplica igual al renombrar una tarjeta.

### CA-RF24-F35 — La tarjeta ya no existe (404 al editar)

- **Dado** que el backend responde `404` ("Tarjeta no encontrada") a `actualizarTarjeta`
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Esta tarjeta ya no existe." en la hoja y, al cerrarla con "Volver", la lista (que se vuelve a pedir) ya no la muestra.

> Decisión: calcada de CA-RF08-16 ("Este movimiento ya no existe.").

### CA-RF24-F36 — Sin conexión: avisa, conserva lo escrito y reintenta con la misma clave

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.", la hoja sigue con lo escrito y "Guardar tarjeta" vuelve a estar disponible.
- **Y** al volver a tocarlo sin cambiar nada, la nueva llamada a `crearTarjeta` lleva **la misma clave** y el mismo cuerpo que la primera, y el aviso desaparece al lograr guardar. (Al editar no hay clave: el reintento repite el mismo `actualizarTarjeta`.)

### CA-RF24-F37 — Otro fallo (400, 422 o 500): mensaje general y la misma clave

- **Dado** que el backend responde `400`, `422` o `500` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar tu tarjeta. Revisa los datos e inténtalo de nuevo.", sin términos técnicos y sin los mensajes del backend, con la hoja abierta y lo escrito intacto.
- **Y** si vuelve a tocar "Guardar tarjeta" sin cambiar nada, la solicitud de crear lleva la misma clave.

### CA-RF24-F38 — Si el usuario cambia algo tras un fallo, es una acción nueva

- **Dado** que el primer "Guardar tarjeta" (al crear) falló (por falta de conexión, por alias repetido o por otro error)
- **Cuando** el usuario cambia el alias, la tasa o el interruptor y vuelve a tocar "Guardar tarjeta"
- **Entonces** la nueva llamada a `crearTarjeta` lleva una clave **distinta** a la del intento fallido y el cuerpo nuevo (el backend respondería `422` si se reutilizara la clave con otro cuerpo).

> Calcado de CA-RF21-F33 (meta) y CA-RF10-F19 (categorías).

### CA-RF24-F39 — Sesión vencida al guardar (401)

- **Dado** que el backend responde `401` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; la hoja no muestra un aviso de error propio.

---

## Eliminar una tarjeta

### CA-RF24-F40 — "Eliminar tarjeta" pide confirmación antes de hacer nada

- **Dado** la hoja "Editar tarjeta" de "Visa Bancolombia"
- **Cuando** el usuario toca "Eliminar tarjeta"
- **Entonces** ve un diálogo "¿Eliminar esta tarjeta?" con el texto "Visa Bancolombia. Se eliminarán también sus cargos fijos. Esta acción no se puede deshacer." y los botones "Cancelar" y "Eliminar"; todavía no se llamó a `eliminarTarjeta`.

> Decisión: eliminar siempre pide confirmación (CLAUDE.md). Los textos se proponen (RNF-04); el aviso de los cargos fijos refleja que el backend los borra en cascada.

### CA-RF24-F41 — Cancelar no elimina nada

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Cancelar" (o lo cierra con el gesto "atrás")
- **Entonces** el diálogo se cierra, no se llama a `eliminarTarjeta` y la hoja de editar sigue abierta con sus datos.

### CA-RF24-F42 — Confirmar elimina y la lista deja de mostrarla

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Eliminar" y el backend responde `204`
- **Entonces** se llamó una sola vez a `eliminarTarjeta(id)`, el diálogo y la hoja se cierran, se vuelve a pedir la lista y esa tarjeta ya no aparece; si era la última, ve el aviso de vacío (CA-RF24-F09).

### CA-RF24-F43 — Mientras elimina ve un indicador; un doble toque no repite

- **Dado** que el backend aún no responde al `DELETE`
- **Cuando** el usuario espera, o toca "Eliminar" dos veces seguidas
- **Entonces** "Eliminar" muestra un indicador de carga, "Eliminar" y "Cancelar" no se pueden tocar y `eliminarTarjeta` se llama una sola vez.

### CA-RF24-F44 — Tarjeta con pagos registrados (409): lo explica y la tarjeta sigue

- **Dado** que el backend responde `409` ("No se puede eliminar una tarjeta que ya tiene pagos registrados")
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo, "Esta tarjeta ya tiene pagos registrados y no se puede eliminar.", el diálogo sigue abierto ("Cancelar" lo cierra) y la tarjeta sigue en la lista.

> Decisión: texto propuesto (RNF-04). No dice cómo resolverlo: hoy desde Movimientos no se pueden eliminar los pagos de tarjeta (CA-RF08-24), así que no se le da al usuario una salida que no existe. Ver dudas en el reporte.

### CA-RF24-F45 — La tarjeta ya estaba eliminada (404): se cumple lo que el usuario quería

- **Dado** que el backend responde `404` a `eliminarTarjeta`
- **Cuando** el usuario ve el resultado
- **Entonces** el diálogo y la hoja se cierran y la tarjeta ya no aparece en la lista, sin aviso de error.

> Decisión: calcado de CA-RF08-23 y CA-RF21-F40.

### CA-RF24-F46 — Sin conexión u otro fallo al eliminar

- **Dado** que `eliminarTarjeta` falla por falta de conexión, o con `400` o `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo, "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." (sin conexión) o "No pudimos eliminar tu tarjeta. Inténtalo de nuevo en unos minutos." (otro fallo); el diálogo sigue abierto, "Eliminar" vuelve a estar disponible y la tarjeta sigue en la lista.

### CA-RF24-F47 — Sesión vencida al eliminar (401)

- **Dado** que el backend responde `401` a `eliminarTarjeta`
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; el diálogo no muestra un aviso de error propio.

---

## Ir a los cargos fijos de la tarjeta

### CA-RF24-F48 — "Cargos fijos" abre la pantalla de esa tarjeta

- **Dado** la hoja "Editar tarjeta" de "Visa Bancolombia" (id `66a0b3c4d5e6f70012ab34cd`)
- **Cuando** el usuario toca "Cargos fijos"
- **Entonces** la hoja se cierra y la app navega a `/tarjetas/66a0b3c4d5e6f70012ab34cd/cargos` con el nombre "Visa Bancolombia" (`router.push({ pathname: '/tarjetas/[id]/cargos', params: { id, nombre } })`); no se envía nada al backend ni se guarda lo escrito en el formulario.

> Decisión: si el usuario cambió algo en el formulario y toca "Cargos fijos", lo escrito se descarta (igual que con "Volver", CA-RF24-F15).

---

## Accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)

### CA-RF24-F49 — Se puede usar con lector de pantalla

- **Dado** la pantalla de tarjetas
- **Cuando** un lector de pantalla la recorre
- **Entonces** "Volver", "+ Agregar tarjeta", "Guardar tarjeta", "Cargos fijos", "Eliminar tarjeta" y cada fila (con el nombre accesible "Visa Bancolombia, Tasa 29,21 % E.A.") se anuncian como botones; los campos se anuncian como "Alias" y "Tasa de interés E.A."; el interruptor, como interruptor con el nombre "Compras a 1 cuota sin intereses" y su estado (encendido o apagado); los avisos de error y de validación, como alerta; el diálogo de eliminar, con el nombre "¿Eliminar esta tarjeta?" y sus botones "Cancelar" y "Eliminar".

### CA-RF24-F50 — Todos los textos son cotidianos

- **Dado** cualquier texto de las pantallas de tarjetas (etiquetas, avisos, notas, diálogo)
- **Cuando** el usuario lo lee
- **Entonces** no contiene términos técnicos ni contables ("tasaEA", "cuotaUnicaSinInteres", "nombre" como campo, "409", "idempotencia", "payload", "cascada"): habla de "alias", "tasa de interés", "tarjeta", "cargos fijos", "internet" y "servidor". ("E.A." aparece solo porque lo usa el diseño en el título del campo.)

### CA-RF24-F51 — El frontend no calcula: ni deuda, ni cuotas, ni cupo

- **Dado** la lista y los formularios de tarjetas, con cualquier dato que responda el backend
- **Cuando** el usuario los ve
- **Entonces** no hay ningún monto en pesos derivado (no hay deuda, cupo, cuota ni total de las tarjetas); lo único que la pantalla transforma es la tasa entre porcentaje y fracción (CA-RF24-F23 y F24).

---

## Contrato del adaptador (`lib/api/tarjetas.ts`, tarjetas)

### CA-RF24-F52 — `listarTarjetas` pide las tarjetas y entrega la lista

- **Dado** una sesión vigente
- **Cuando** se llama a `listarTarjetas()`
- **Entonces** se hace `GET /tarjetas` con `Authorization: Bearer …`, sin cuerpo, y entrega el arreglo `items` tal cual (`id`, `nombre`, `tasaEA`, `cuotaUnicaSinInteres`, `creadaEn`, `actualizadaEn`, sin redondear ni cambiar nada, en el orden recibido); si responde `{ items: [] }` entrega `[]`.

### CA-RF24-F53 — `crearTarjeta` envía la petición según el contrato

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `crearTarjeta({ nombre, tasaEA, cuotaUnicaSinInteres }, clave)`
- **Entonces** se hace `POST /tarjetas` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo `nombre`, `tasaEA` (número) y `cuotaUnicaSinInteres` (la clave no va dentro) y la función entrega la tarjeta que responde el `201`.

### CA-RF24-F54 — `actualizarTarjeta` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `actualizarTarjeta('66a0…', { tasaEA: 0.315 })`
- **Entonces** se hace `PATCH /tarjetas/66a0…` con `Authorization: Bearer …` y `Content-Type: application/json`, **sin** `Idempotency-Key`; el cuerpo contiene solo los campos recibidos (aquí `tasaEA`), y la función entrega la tarjeta que responde el `200`.

### CA-RF24-F55 — `eliminarTarjeta` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `eliminarTarjeta('66a0…')`
- **Entonces** se hace `DELETE /tarjetas/66a0…` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key`, y la función termina sin error aunque el `204` no traiga cuerpo (no entrega nada).

### CA-RF24-F56 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error a cualquiera de las cuatro funciones
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `404` y un `409` llegan como `ApiError` con su código y el mensaje del backend (ambos sin cerrar la sesión); un `422` o un `500` llegan como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

# Cargos fijos (`CA-RF29-F`)

Se llega desde "Cargos fijos" en la hoja de editar tarjeta (CA-RF24-F48). Los cargos fijos son lo que la tarjeta cobra cada mes por su cuenta (una suscripción, un seguro). Los ejemplos suponen la tarjeta "Visa Bancolombia" con id `66a0b3c4d5e6f70012ab34cd`.

## Pantalla y carga

### CA-RF29-F01 — Título con el nombre de la tarjeta y "Volver"

- **Dado** la pantalla de cargos fijos abierta con el nombre "Visa Bancolombia"
- **Cuando** el usuario la ve
- **Entonces** ve el título "Visa Bancolombia" con un subtítulo o encabezado "Cargos fijos" (en la pantalla se leen ambos textos), y un botón "Volver" que regresa a la lista de tarjetas.
- **Y** si la pantalla se abre sin nombre (por ejemplo, al recargar la página en la web), el título es solo "Cargos fijos".

> Decisión: el Figma muestra el nombre de la tarjeta como título; el texto "Cargos fijos" acompañante se propone para que se entienda qué lista es. El nombre llega como parámetro de la ruta, no se vuelve a pedir al backend.

### CA-RF29-F02 — Al entrar se piden los cargos de la tarjeta, una sola vez

- **Dado** una sesión vigente
- **Cuando** el usuario abre la pantalla de cargos fijos
- **Entonces** se llama a `listarCargos('66a0b3c4d5e6f70012ab34cd')` una sola vez (`GET /tarjetas/66a0…/cargos`, **sin** `?activo=`) y no se envía nada más.

> Decisión: una sola consulta con todos los cargos; la pantalla los separa en "ACTIVOS ESTE MES" e "INACTIVOS" según el campo `activo` que ya trae cada cargo (agrupar es presentación, no cálculo).

### CA-RF29-F03 — Mientras carga, solo el indicador

- **Dado** que el backend aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** ve el título y un indicador de carga ("Cargando tus cargos fijos"); no ve las secciones, ni "+ Agregar cargo fijo", ni el aviso de vacío, ni avisos de error.

### CA-RF29-F04 — Si la consulta falla, avisa y permite reintentar

- **Dado** que el backend responde `500` (u otro error que no sea de red, `401` ni `404`)
- **Cuando** termina la consulta
- **Entonces** ve "No pudimos cargar los cargos fijos. Inténtalo de nuevo en unos minutos." con "Reintentar", y no ve las secciones ni "+ Agregar cargo fijo".
- **Y** al tocar "Reintentar" vuelve a ver el indicador de carga y se consulta de nuevo la misma tarjeta; si ahora responde bien, ve la lista.

### CA-RF29-F05 — Sin conexión

- **Dado** que la consulta falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar", y el título y "Volver" siguen visibles.

### CA-RF29-F06 — Sesión vencida al cargar (401)

- **Dado** que el backend responde `401` a la consulta
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; la pantalla no muestra un aviso de error propio.

### CA-RF29-F07 — La tarjeta ya no existe (404)

- **Dado** que el backend responde `404` ("Tarjeta no encontrada") a la consulta (otro dispositivo la eliminó)
- **Cuando** termina la consulta
- **Entonces** ve "Esta tarjeta ya no existe." (sin "Reintentar" ni "+ Agregar cargo fijo") y "Volver" sigue disponible.

---

## Lo que se ve según haya o no cargos

### CA-RF29-F08 — Sin cargos: invita a agregar el primero

- **Dado** que el backend responde `{ items: [] }`
- **Cuando** termina de cargar
- **Entonces** ve "Esta tarjeta no tiene cargos fijos. Agrega los que te cobran cada mes, como una suscripción." y el botón "+ Agregar cargo fijo"; no ve ni "ACTIVOS ESTE MES" ni "INACTIVOS".

> Decisión: texto propuesto (RNF-04); no está en el Figma.

### CA-RF29-F09 — Con cargos: separados en activos e inactivos, con su valor al mes

- **Dado** que el backend responde con "Netflix" (45000, activo), "Spotify" (25000, activo) y "Gimnasio" (90000, inactivo), en ese orden
- **Cuando** termina de cargar
- **Entonces** ve la sección "ACTIVOS ESTE MES" con las filas "Netflix" y "Spotify" (en el orden recibido) y, debajo, la sección "INACTIVOS" con la fila "Gimnasio"; cada fila muestra su descripción y "$ 45.000 al mes", "$ 25.000 al mes" y "$ 90.000 al mes"; al final, "+ Agregar cargo fijo".
- **Y** no ve ningún total (ni de los activos ni de todos).

> Decisión: el valor se muestra redondeado al peso solo al mostrar (por ejemplo, `45900.5` se muestra "$ 45.901 al mes"). El Figma lee cada fila como "Netflix · $ 45.000 al mes": la descripción y el valor pueden ir en una o dos líneas; lo que se prueba es que se vean los dos textos.

### CA-RF29-F10 — Solo se ve la sección que tiene cargos

- **Dado** que todos los cargos son activos (o todos inactivos)
- **Cuando** el usuario ve la lista
- **Entonces** ve solo "ACTIVOS ESTE MES" (o solo "INACTIVOS"), sin la otra sección vacía.

### CA-RF29-F11 — "+ Agregar cargo fijo" abre el formulario vacío

- **Dado** la lista cargada (con o sin cargos)
- **Cuando** el usuario toca "+ Agregar cargo fijo"
- **Entonces** se abre la hoja "Nuevo cargo fijo" (CA-RF29-F13) con "Descripción" y "Valor al mes" vacíos y el interruptor "Activo este mes" **encendido**.

### CA-RF29-F12 — Tocar una fila abre el formulario con los datos de ese cargo

- **Dado** la lista con "Gimnasio" (90000, inactivo)
- **Cuando** el usuario toca esa fila
- **Entonces** se abre la hoja "Editar cargo fijo" con "Descripción" en "Gimnasio", "Valor al mes" en "$ 90.000" y el interruptor "Activo este mes" apagado; no se llama al backend.

---

## El formulario del cargo

### CA-RF29-F13 — Qué contiene el formulario, para un cargo nuevo y para uno existente

- **Dado** la hoja abierta
- **Cuando** el usuario la lee
- **Entonces** ve el título ("Nuevo cargo fijo" o "Editar cargo fijo"), un botón "Volver", el campo "Descripción" (con el marcador "Ej: Netflix"), el campo "Valor al mes" (con el marcador "$ 0"), el interruptor "Activo este mes" y el botón "Guardar cargo fijo".
- **Y** en "Editar cargo fijo" ve además el botón "Eliminar cargo fijo"; en "Nuevo cargo fijo" no.

> Decisión: el Figma solo mostró el interruptor "Activo este mes" y "Eliminar cargo fijo" (sin los demás textos). Los nombres de campos y botón y los marcadores se proponen en lenguaje cotidiano (RNF-04); el valor es en pesos enteros, como los demás montos de la app (el campo de monto escribe solo dígitos, con puntos de miles y tope de 12 dígitos, igual que CA-RF21-F15).

### CA-RF29-F14 — "Volver" cierra la hoja sin guardar

- **Dado** la hoja abierta, con o sin cambios escritos
- **Cuando** el usuario toca "Volver"
- **Entonces** la hoja se cierra, no se envía nada al backend y la lista queda igual.

### CA-RF29-F15 — El interruptor "Activo este mes" cambia al tocarlo

- **Dado** el formulario con el interruptor encendido
- **Cuando** el usuario lo toca
- **Entonces** queda apagado; al volver a tocarlo, encendido.

---

## Validación antes de llamar al backend

### CA-RF29-F16 — Descripción vacía: no se envía

- **Dado** el formulario con "Descripción" vacía o solo con espacios y un valor válido
- **Cuando** el usuario toca "Guardar cargo fijo"
- **Entonces** ve "Escribe una descripción para el cargo." y no se llama al backend (ni para crear ni para editar).

### CA-RF29-F17 — Descripción de más de 100 caracteres: no se envía

- **Dado** el formulario con una "Descripción" de 101 caracteres y un valor válido
- **Cuando** el usuario toca "Guardar cargo fijo"
- **Entonces** ve "La descripción no puede tener más de 100 caracteres." y no se llama al backend; con 100 caracteres sí se envía.

### CA-RF29-F18 — Valor vacío o en cero: no se envía

- **Dado** el formulario con "Valor al mes" vacío (o en "0", que el campo deja vacío) y una descripción válida
- **Cuando** el usuario toca "Guardar cargo fijo"
- **Entonces** ve "Escribe un valor mayor que cero." y no se llama al backend.
- **Y** los avisos desaparecen al editar cualquier campo o tocar el interruptor, y se anuncian como alerta.

> Decisión: para dejar de contar un cargo se desactiva, no se pone en cero (así lo pide el backend, CA-RF29-23).

---

## Guardar un cargo nuevo

### CA-RF29-F19 — Crear envía el cuerpo exacto y una clave

- **Dado** la hoja "Nuevo cargo fijo" de la tarjeta `66a0b3c4d5e6f70012ab34cd`
- **Cuando** el usuario escribe "  Netflix  " en "Descripción", 45000 en "Valor al mes" y toca "Guardar cargo fijo"
- **Entonces** se llama a `crearCargo('66a0b3c4d5e6f70012ab34cd', { descripcion: 'Netflix', valor: 45000, activo: true }, clave)` una sola vez, con una `clave` en formato UUID, y a nadie más; el cuerpo no lleva `tarjetaId` ni otro campo.
- **Y** con el interruptor apagado se envía `activo: false` (el campo siempre va al crear).

### CA-RF29-F20 — Al crear, la hoja se cierra y el cargo aparece en su sección

- **Dado** que el backend responde `201` con el cargo creado
- **Cuando** el usuario ve el resultado
- **Entonces** la hoja se cierra, se vuelve a pedir la lista (`listarCargos` se llama otra vez) y, con la respuesta, el cargo aparece una sola vez en "ACTIVOS ESTE MES" (o en "INACTIVOS" si se creó apagado), sin aviso de "guardado".

### CA-RF29-F21 — Mientras guarda ve un indicador y un doble toque no repite

- **Dado** que el backend aún no responde al guardado
- **Cuando** el usuario espera, o toca "Guardar cargo fijo" dos veces seguidas
- **Entonces** el botón muestra un indicador de carga en lugar de su texto y no se puede tocar de nuevo, y `crearCargo` se llama una sola vez, con una sola clave; la hoja sigue abierta con lo escrito.

---

## Editar un cargo y activarlo o desactivarlo

### CA-RF29-F22 — Editar envía solo lo que cambió

- **Dado** la hoja "Editar cargo fijo" de "Netflix" (45000, activo)
- **Cuando** el usuario cambia el valor a 49900 y toca "Guardar cargo fijo"
- **Entonces** se llama a `actualizarCargo('66a0…', id, { valor: 49900 })` una sola vez: solo el campo cambiado, sin clave, y no se llama a `crearCargo`.
- **Y** si cambia la descripción y el valor, se envían los dos; escribir la misma descripción con espacios sobrantes no cuenta como cambio.

### CA-RF29-F23 — Desactivar un cargo: solo se envía `activo`

- **Dado** la hoja "Editar cargo fijo" de "Netflix" (activo)
- **Cuando** el usuario apaga "Activo este mes" y toca "Guardar cargo fijo"
- **Entonces** se llama a `actualizarCargo('66a0…', id, { activo: false })` (un `PATCH` de `activo`, sin descripción ni valor), la hoja se cierra, se vuelve a pedir la lista y "Netflix" aparece en "INACTIVOS", ya no en "ACTIVOS ESTE MES".

### CA-RF29-F24 — Activar un cargo inactivo

- **Dado** la hoja "Editar cargo fijo" de "Gimnasio" (inactivo)
- **Cuando** el usuario enciende "Activo este mes" y toca "Guardar cargo fijo"
- **Entonces** se llama a `actualizarCargo('66a0…', id, { activo: true })`, la hoja se cierra y, con la lista nueva, "Gimnasio" aparece en "ACTIVOS ESTE MES".

> Decisión (del arquitecto): activar y desactivar se hace solo desde el formulario del cargo (lo más simple); la lista no tiene interruptores que guarden al instante.

### CA-RF29-F25 — Guardar sin cambios no llama al backend

- **Dado** la hoja "Editar cargo fijo" recién abierta, sin tocar nada
- **Cuando** el usuario toca "Guardar cargo fijo"
- **Entonces** no se envía ninguna solicitud y la hoja se cierra.

### CA-RF29-F26 — Doble toque al editar: una sola solicitud

- **Dado** la hoja "Editar cargo fijo" con un cambio válido
- **Cuando** el usuario toca "Guardar cargo fijo" dos veces seguidas
- **Entonces** se llama una sola vez a `actualizarCargo`, y mientras llega la respuesta ve el indicador de carga en el botón.

---

## Errores al guardar un cargo

### CA-RF29-F27 — La tarjeta o el cargo ya no existen (404)

- **Dado** que el backend responde `404` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro de la hoja, "Esta tarjeta ya no existe." si estaba creando un cargo, o "Este cargo fijo ya no existe." si estaba editando uno; la hoja sigue abierta con lo escrito y, al cerrarla con "Volver", la lista (que se vuelve a pedir) muestra lo que haya.

> Decisión: textos propuestos (RNF-04). Con `PATCH` el 404 puede ser del cargo o de la tarjeta; la pantalla no distingue (usa el texto del cargo) y la lista recargada mostrará el aviso de CA-RF29-F07 si la tarjeta ya no existe.

### CA-RF29-F28 — Sin conexión: avisa, conserva lo escrito y reintenta con la misma clave

- **Dado** que el guardado falla por falta de conexión
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.", la hoja sigue con lo escrito y "Guardar cargo fijo" vuelve a estar disponible.
- **Y** al volver a tocarlo sin cambiar nada, la nueva llamada a `crearCargo` lleva **la misma clave** y el mismo cuerpo, y el aviso desaparece al lograr guardar. (Al editar no hay clave: el reintento repite el mismo `actualizarCargo`.)

### CA-RF29-F29 — Otro fallo (400, 422 o 500): mensaje general y la misma clave

- **Dado** que el backend responde `400`, `422` o `500` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar el cargo fijo. Revisa los datos e inténtalo de nuevo.", sin términos técnicos ni los mensajes del backend, con la hoja abierta y lo escrito intacto.
- **Y** si vuelve a tocar "Guardar cargo fijo" sin cambiar nada, la solicitud de crear lleva la misma clave.

### CA-RF29-F30 — Si el usuario cambia algo tras un fallo, es una acción nueva

- **Dado** que el primer "Guardar cargo fijo" (al crear) falló
- **Cuando** el usuario cambia la descripción, el valor o el interruptor y vuelve a guardar
- **Entonces** la nueva llamada a `crearCargo` lleva una clave **distinta** y el cuerpo nuevo.

### CA-RF29-F31 — Sesión vencida al guardar (401)

- **Dado** que el backend responde `401` al guardar
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; la hoja no muestra un aviso de error propio.

---

## Eliminar un cargo

### CA-RF29-F32 — "Eliminar cargo fijo" pide confirmación antes de hacer nada

- **Dado** la hoja "Editar cargo fijo" de "Netflix" (45000)
- **Cuando** el usuario toca "Eliminar cargo fijo"
- **Entonces** ve un diálogo "¿Eliminar este cargo fijo?" con "Netflix · $ 45.000 al mes. Esta acción no se puede deshacer." y los botones "Cancelar" y "Eliminar"; todavía no se llamó a `eliminarCargo`.

> Decisión: textos propuestos (RNF-04); eliminar siempre pide confirmación.

### CA-RF29-F33 — Cancelar no elimina nada

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Cancelar" (o lo cierra con el gesto "atrás")
- **Entonces** el diálogo se cierra, no se llama a `eliminarCargo` y la hoja de editar sigue abierta con sus datos.

### CA-RF29-F34 — Confirmar elimina y la lista deja de mostrarlo

- **Dado** el diálogo de confirmación abierto
- **Cuando** el usuario toca "Eliminar" y el backend responde `204`
- **Entonces** se llamó una sola vez a `eliminarCargo('66a0…', id)`, el diálogo y la hoja se cierran, se vuelve a pedir la lista y el cargo ya no aparece; si era el último, ve el aviso de vacío (CA-RF29-F08).

### CA-RF29-F35 — Mientras elimina ve un indicador; un doble toque no repite

- **Dado** que el backend aún no responde al `DELETE`
- **Cuando** el usuario espera, o toca "Eliminar" dos veces seguidas
- **Entonces** "Eliminar" muestra un indicador de carga, "Eliminar" y "Cancelar" no se pueden tocar y `eliminarCargo` se llama una sola vez.

### CA-RF29-F36 — El cargo ya estaba eliminado (404): se cumple lo que el usuario quería

- **Dado** que el backend responde `404` a `eliminarCargo`
- **Cuando** el usuario ve el resultado
- **Entonces** el diálogo y la hoja se cierran y el cargo ya no aparece en la lista, sin aviso de error.

### CA-RF29-F37 — Sin conexión u otro fallo al eliminar

- **Dado** que `eliminarCargo` falla por falta de conexión, o con `400` o `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo, "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." (sin conexión) o "No pudimos eliminar el cargo fijo. Inténtalo de nuevo en unos minutos." (otro fallo); el diálogo sigue abierto, "Eliminar" vuelve a estar disponible y el cargo sigue en la lista.

### CA-RF29-F38 — Sesión vencida al eliminar (401)

- **Dado** que el backend responde `401` a `eliminarCargo`
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al inicio de sesión; el diálogo no muestra un aviso de error propio.

---

## Accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)

### CA-RF29-F39 — Se puede usar con lector de pantalla

- **Dado** la pantalla de cargos fijos
- **Cuando** un lector de pantalla la recorre
- **Entonces** "Volver", "+ Agregar cargo fijo", "Guardar cargo fijo", "Eliminar cargo fijo" y cada fila (con el nombre accesible "Netflix, $ 45.000 al mes") se anuncian como botones; los campos se anuncian como "Descripción" y "Monto en pesos" (el nombre del campo de monto compartido); el interruptor, como interruptor "Activo este mes" con su estado; los avisos de error y de validación, como alerta; el diálogo, con el nombre "¿Eliminar este cargo fijo?" y sus botones "Cancelar" y "Eliminar".

### CA-RF29-F40 — Todos los textos son cotidianos

- **Dado** cualquier texto de la pantalla de cargos fijos (etiquetas, secciones, avisos, diálogo)
- **Cuando** el usuario lo lee
- **Entonces** no contiene términos técnicos ni contables ("activo" como campo, "valor" de la API, "recurrente", "409", "idempotencia", "tarjetaId", "payload"): habla de "cargo fijo", "al mes", "activo este mes", "inactivos", "internet" y "servidor".

### CA-RF29-F41 — El frontend no calcula: no suma los cargos

- **Dado** la lista de cargos con cualquier dato que responda el backend
- **Cuando** el usuario la ve
- **Entonces** no hay ningún total (de activos, de inactivos ni de todos): cada valor se muestra tal como lo devolvió el backend, redondeado al peso solo al mostrarlo.

---

## Contrato del adaptador (`lib/api/tarjetas.ts`, cargos fijos)

### CA-RF29-F42 — `listarCargos` pide los cargos de la tarjeta y entrega la lista

- **Dado** una sesión vigente
- **Cuando** se llama a `listarCargos('66a0…')`
- **Entonces** se hace `GET /tarjetas/66a0…/cargos` (sin query), con `Authorization: Bearer …` y sin cuerpo, y entrega el arreglo `items` tal cual (`id`, `tarjetaId`, `descripcion`, `valor`, `activo`, `creadaEn`, `actualizadaEn`, sin redondear, en el orden recibido); si responde `{ items: [] }` entrega `[]`.

### CA-RF29-F43 — `crearCargo` envía la petición según el contrato

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `crearCargo('66a0…', { descripcion, valor, activo }, clave)`
- **Entonces** se hace `POST /tarjetas/66a0…/cargos` con `Authorization: Bearer …`, `Content-Type: application/json` y `Idempotency-Key` con esa clave; el cuerpo contiene solo `descripcion`, `valor` (número) y `activo` (sin `tarjetaId` ni la clave) y la función entrega el cargo que responde el `201`.

### CA-RF29-F44 — `actualizarCargo` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `actualizarCargo('66a0…', '66a1…', { activo: false })`
- **Entonces** se hace `PATCH /tarjetas/66a0…/cargos/66a1…` con `Authorization: Bearer …` y `Content-Type: application/json`, **sin** `Idempotency-Key`; el cuerpo contiene solo los campos recibidos (aquí `activo`), y la función entrega el cargo que responde el `200`.

### CA-RF29-F45 — `eliminarCargo` envía la petición según el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `eliminarCargo('66a0…', '66a1…')`
- **Entonces** se hace `DELETE /tarjetas/66a0…/cargos/66a1…` con `Authorization: Bearer …`, sin cuerpo y sin `Idempotency-Key`, y la función termina sin error aunque el `204` no traiga cuerpo (no entrega nada).

### CA-RF29-F46 — El adaptador distingue los errores del backend

- **Dado** que el backend responde con un error a cualquiera de las cuatro funciones de cargos
- **Cuando** se llama a la función
- **Entonces** un `400` llega como `ApiError` con código 400 y los mensajes del backend unidos; un `404` llega como `ApiError` con su código y el mensaje del backend ("Tarjeta no encontrada" o "Cargo fijo no encontrado"), sin cerrar la sesión; un `422` o un `500` llegan como `ApiError` con su código; un `401` cierra la sesión; sin respuesta del servidor llega un `NetworkError`.

---

## Contrato del adaptador: resumen de funciones y tipos (`lib/api/tarjetas.ts`)

- Tipos: `Tarjeta` (`{ id, nombre, tasaEA, cuotaUnicaSinInteres, creadaEn, actualizadaEn }`) y `CargoFijo` (`{ id, tarjetaId, descripcion, valor, activo, creadaEn, actualizadaEn }`), con la forma del contrato.
- `listarTarjetas(): Promise<Tarjeta[]>`: `GET /tarjetas` (devuelve `items`).
- `crearTarjeta(datos: { nombre: string; tasaEA: number; cuotaUnicaSinInteres: boolean }, claveIdempotencia: string): Promise<Tarjeta>`: `POST /tarjetas` con `Idempotency-Key`.
- `actualizarTarjeta(id: string, cambios: Partial<{ nombre: string; tasaEA: number; cuotaUnicaSinInteres: boolean }>): Promise<Tarjeta>`: `PATCH /tarjetas/:id`, sin clave.
- `eliminarTarjeta(id: string): Promise<void>`: `DELETE /tarjetas/:id`.
- `listarCargos(tarjetaId: string): Promise<CargoFijo[]>`: `GET /tarjetas/:tarjetaId/cargos`.
- `crearCargo(tarjetaId: string, datos: { descripcion: string; valor: number; activo: boolean }, claveIdempotencia: string): Promise<CargoFijo>`: `POST /tarjetas/:tarjetaId/cargos` con `Idempotency-Key`.
- `actualizarCargo(tarjetaId: string, id: string, cambios: Partial<{ descripcion: string; valor: number; activo: boolean }>): Promise<CargoFijo>`: `PATCH /tarjetas/:tarjetaId/cargos/:id`, sin clave.
- `eliminarCargo(tarjetaId: string, id: string): Promise<void>`: `DELETE /tarjetas/:tarjetaId/cargos/:id`.
- El adaptador no convierte la tasa: recibe y entrega la fracción tal cual. Tampoco se usan `GET /tarjetas/:id`, `GET …/cargos/:id` ni el filtro `?activo=` (no hacen falta en este paquete).

---

## Resumen

- Criterios: 102. **Tarjetas** (CA-RF24-F01 a F56): 56 — entrada y ruta 3 (F01 a F03), carga de la lista 5 (F04 a F08), qué se ve 5 (F09 a F13), formulario 4 (F14 a F17), validación 5 (F18 a F22), conversión de la tasa 2 (F23, F24), crear 4 (F25 a F28), editar y cambiar la tasa 5 (F29 a F33), errores al guardar 6 (F34 a F39), eliminar 8 (F40 a F47), ir a cargos 1 (F48), accesibilidad y lenguaje 3 (F49 a F51), adaptador 5 (F52 a F56). **Cargos fijos** (CA-RF29-F01 a F46): 46 — pantalla y carga 7 (F01 a F07), qué se ve 5 (F08 a F12), formulario 3 (F13 a F15), validación 3 (F16 a F18), crear 3 (F19 a F21), editar y activar/desactivar 5 (F22 a F26), errores al guardar 5 (F27 a F31), eliminar 7 (F32 a F38), accesibilidad y lenguaje 3 (F39 a F41), adaptador 5 (F42 a F46).
- Código nuevo que piden: `lib/api/tarjetas.ts`, `lib/tasa.ts`, la pantalla `/tarjetas` (con su hoja de formulario y el diálogo de eliminar), la pantalla `/tarjetas/[id]/cargos` (con su hoja de formulario y su diálogo), el botón "Tarjetas" en `app/index.tsx` y las dos rutas protegidas en `app/_layout.tsx`.
