# Criterios de aceptación — 4. Ahorro: anotar el ahorro real y ver el acumulado

Estado: Aprobado (2026-11-26). El desarrollador aprobó los criterios, los textos nuevos y las decisiones D1 a D8 según la recomendación de cada una.

Cubre RF-23 en el frontend: el usuario **escribe cuánto pudo ahorrar** en un mes y ve el **ahorro acumulado mes a mes**.

**El requisito dice otra cosa.** RF-23: "visualizar el ahorro real acumulado mes a mes, calculado con base en la diferencia entre lo presupuestado y lo efectivamente gastado". El desarrollador decidió el 2026-11-19 que el ahorro real **lo escribe el usuario** al final del mes; el backend no lo calcula desde las transacciones, solo suma lo guardado en cada meta (`GET /ahorro/acumulado`). Estos criterios siguen la decisión, no el texto del RF. Si en el módulo 7 (presupuesto) se decide calcularlo, se revisan. La pantalla no suma ni calcula nada (RNF-11): solo redondea al peso al mostrar.

**Fuera de este paquete (queda anotado, no se prueba aquí):**
- "Referencia: Tu ahorro promedio de los últimos 3 meses…": la API no da ese promedio.
- Gráficas del acumulado, versión de escritorio (1280 px) y seguimiento en el dashboard.
- Calcular o sugerir el ahorro real desde el presupuesto o los movimientos.
- Crear metas de meses anteriores.
- Colores, tamaños, tipografía y posición exacta, en modo claro y oscuro: **revisión visual**, no se prueba con Jest.

**Fuentes:** Especificación de Requisitos (RF-23; CU-12: sin periodos anteriores el acumulado es cero), CLAUDE.md (RNF-02, RNF-04, RNF-06, RNF-11; eliminar siempre pide confirmación), contratos `coordinacion/contratos/ahorro-metas.md` y `ahorro-progreso.md`, código del backend (`backend/src/ahorro`), `04-ahorro-meta.md` y `04-ahorro-progreso.md`. El Figma (sección 09, frame "Meta de ahorro", 19:2) **no tiene** pantalla para anotar el ahorro ni para ver el acumulado: se propone la solución mínima con las piezas que ya existen (decisión D1).

**Contrato del backend que importa aquí** (comprobado en el código; todas las rutas con sesión; el `401` lo resuelve el cliente HTTP compartido):
- `GET /ahorro/acumulado?hasta=YYYY-MM` → `200 { total, meses: [{ periodo, ahorroReal, acumulado }] }`, de la meta más antigua a la más reciente. Los meses sin meta no aparecen. Sin metas, `{ total: 0, meses: [] }`. Sin redondear. No trae el `id` de la meta.
- El ahorro real vive **dentro de la meta del mes**: `ahorroReal`, número, 0 por defecto, admite negativos. No existe "sin escribir": no escrito y 0 son lo mismo.
- `PATCH /ahorro/metas/:id` con `{ ahorroReal }` (basta ese campo) → `200` con la meta; `404` "Meta de ahorro no encontrada". Sin `Idempotency-Key` (repetirlo es inofensivo). Sirve también para meses pasados.
- `DELETE /ahorro/metas/:id` → `409` si `ahorroReal` es distinto de 0.

**Interfaz pública** (aprobada con estos criterios):
- Sin ruta nueva ni botón nuevo en el inicio: todo ocurre en `/meta-de-ahorro`.
- Adaptador, en `lib/api/ahorro.ts`: tipo `AhorroAcumulado` (la forma del contrato); `obtenerAhorroAcumulado(hasta: string): Promise<AhorroAcumulado>`; `guardarAhorroReal(id: string, ahorroReal: number): Promise<MetaAhorro>`.
- Para conseguir el `id` de la meta de un mes se reutiliza `obtenerMetaDelMes(mes)` al guardar.
- Se reutilizan `useRecursoRemoto`, `HojaFormulario`, `useGuardarHoja`, `DialogoEliminar`, `CampoMonto`, `mesActual`, `mesEnLetras` y `formatearPesos`.

**Sobre los IDs:** los `CA-RF23-01..13` son del backend; estos llevan la letra F (`CA-RF23-F01`…).

**Convención de las pruebas:** hoy es el 17 de septiembre de 2026 (reloj simulado), mes actual `2026-09`. El backend se simula en `jest.mock('@/lib/api/ahorro')` (pantalla) y en `fetch` (adaptador). Los montos se escriben "$ 250.000" y los negativos "-$ 80.000", como la tarjeta de progreso. Respuesta de ejemplo (**ACUMULADO**; julio no tiene meta):

| `periodo` | `ahorroReal` | `acumulado` |
|---|---|---|
| `2026-06` | 250000 | 250000 |
| `2026-08` | 0 | 250000 |
| `2026-09` | 150000 | 400000 |

con `total` 400000.

---

## Decisiones (aprobadas el 2026-11-26)

> Decisión **D1 — dónde vive.** Recomendación: una sección "Ahorro que has anotado" **dentro de "Meta de ahorro"**, debajo del formulario. El dato pertenece a la meta del mes y ya hay un botón para llegar. Para escribirlo, una hoja como las de tarjetas. Alternativa: pantalla propia con otro botón en el inicio (más navegación y más código).

> Decisión **D2 — para qué meses.** Recomendación: **todos los meses que tienen meta, hasta el mes actual**; el actual se puede anotar cualquier día (no se obliga a esperar al final) y los anteriores se pueden corregir sin límite. Un mes sin meta no aparece y **no se puede anotar** (el backend no tiene dónde guardarlo). Consecuencia: como la pantalla solo crea la meta del mes actual, quien no fijó meta en un mes ya no podrá anotar ese ahorro. Alternativas: permitir fijar metas de meses pasados (cambia el alcance de 4.1.3) o guardar el ahorro aparte de la meta (cambia el contrato).

> Decisión **D3 — qué valores.** Recomendación: **pesos enteros, sin negativos** (el campo de monto de siempre). La pregunta es "cuánto pudiste ahorrar"; gastar de más ya se ve en "Ahorro de este mes" de la tarjeta de arriba. Si llega un negativo guardado por otro medio, se muestra con signo. Alternativa: permitir "gasté de más" (campo con signo y textos nuevos).

> Decisión **D4 — cómo volver a 0.** Hace falta para poder quitar la meta, y el campo de monto no deja escribir "0". Recomendación: botón "Borrar lo anotado" con confirmación (envía 0). Guardar con el campo vacío no envía nada. Alternativa: que guardar vacío signifique 0 (fácil de borrar sin querer).

> Decisión **D5 — 0 frente a "no lo he escrito".** El backend no los distingue. Recomendación: un 0 se muestra como **"Sin anotar"**. Consecuencia: quien no ahorró nada ve "Sin anotar" y no puede dejar constancia de un "$ 0". Alternativa: que el backend acepte "sin valor" (`null`); es un cambio de contrato.

> Decisión **D6 — cómo se ve el acumulado.** Recomendación: el total arriba ("Total anotado") y una fila por mes **del más reciente al más antiguo**, cada una con lo anotado y "Llevas $ X" (el acumulado hasta ese mes, tal como llega). El backend entrega el orden contrario; solo se invierte para mostrar. Sin gráfica.

> Decisión **D7 — palabras.** La tarjeta de arriba ya dice "Ahorro de este mes" y es **lo que calcula el sistema** (ingresos menos egresos). Lo nuevo es lo que **escribe el usuario** y puede no coincidir. Recomendación: usar siempre "anotar / anotado" para lo nuevo, con la ayuda "Es lo que de verdad lograste guardar ese mes. Lo escribes tú.", y no tocar la tarjeta.

> Decisión **D8 — quitar una meta con ahorro anotado.** Hoy dice "Esta meta ya tiene ahorro registrado y no se puede quitar." (CA-RF21-F39), un caso que hasta ahora casi no podía ocurrir y desde este paquete sí. Recomendación: cambiarlo por **"Ya anotaste ahorro en este mes, así que la meta no se puede quitar. Borra primero lo anotado."** Cambia un criterio y pruebas ya aprobados. Alternativa: dejar el texto como está.

---

## Consultar y ver el acumulado

### CA-RF23-F01 — La sección está en "Meta de ahorro", debajo del formulario

- **Dado** una sesión vigente y el backend responde ACUMULADO
- **Cuando** el usuario abre "Meta de ahorro"
- **Entonces** ve, después de la tarjeta de progreso y del formulario de la meta, la sección "Ahorro que has anotado".

### CA-RF23-F02 — Al entrar se pide el acumulado hasta el mes actual, sin esperar a lo demás

- **Dado** que hoy es el 17 de septiembre de 2026
- **Cuando** el usuario abre "Meta de ahorro"
- **Entonces** se llama a `obtenerAhorroAcumulado('2026-09')` una sola vez, a la vez que las consultas de la meta y del progreso (ninguna espera a otra).

### CA-RF23-F03 — Total y una fila por mes, del más reciente al más antiguo

- **Dado** que el backend responde ACUMULADO
- **Cuando** termina de cargar
- **Entonces** ve "Total anotado" con "$ 400.000" y tres filas en este orden: "septiembre 2026" ("Anotaste $ 150.000", "Llevas $ 400.000"), "agosto 2026" ("Sin anotar", "Llevas $ 250.000") y "junio 2026" ("Anotaste $ 250.000", "Llevas $ 250.000").
- **Y** no hay fila de julio.

### CA-RF23-F04 — Cada mes se puede anotar o cambiar

- **Dado** las filas de ACUMULADO
- **Cuando** el usuario las ve
- **Entonces** las filas con `ahorroReal` 0 tienen el botón "Anotar" y las demás "Cambiar".

### CA-RF23-F05 — Redondeo y negativos

- **Dado** que el backend responde `ahorroReal` -80000,4, `acumulado` -80000,4 y `total` -80000,4
- **Cuando** la pantalla lo muestra
- **Entonces** ve "Anotaste -$ 80.000", "Llevas -$ 80.000" y "-$ 80.000" como total; nunca decimales, "-$ 0" ni "NaN".

### CA-RF23-F06 — El frontend no calcula

- **Dado** que el backend responde cifras que no cuadran a propósito (ACUMULADO con `total` 999999 y el `acumulado` de septiembre en 5)
- **Cuando** la pantalla las muestra
- **Entonces** el total dice "$ 999.999" y septiembre "Llevas $ 5" (no se suman los meses).

### CA-RF23-F07 — Sin meses con meta

- **Dado** que el backend responde `{ total: 0, meses: [] }`
- **Cuando** termina de cargar
- **Entonces** ve en la sección "Todavía no hay meses con meta. Cuando fijes tu meta, podrás anotar aquí cuánto ahorraste.", sin "Total anotado", sin filas y sin aviso de error.

## Carga y errores

### CA-RF23-F08 — Mientras carga, solo su indicador

- **Dado** que el acumulado aún no responde (por ejemplo, el arranque en frío de Render, RNF-02)
- **Cuando** el usuario ve la pantalla
- **Entonces** en la sección ve el indicador "Cargando tu ahorro anotado", sin total, filas, aviso de vacío ni de error.
- **Y** la tarjeta de progreso y el formulario se muestran cuando llegan sus propias respuestas.

### CA-RF23-F09 — Si falla, avisa y permite reintentar solo lo suyo

- **Dado** que el acumulado responde `400` o `500`
- **Cuando** termina la consulta
- **Entonces** en la sección ve "No pudimos cargar tu ahorro anotado. Inténtalo de nuevo en unos minutos." y un botón "Reintentar" (se anuncia como "Reintentar ahorro anotado"); la tarjeta y el formulario siguen funcionando.
- **Y** al tocarlo ve el indicador, se llama una vez más a `obtenerAhorroAcumulado('2026-09')` y a nada más; si responde bien, ve las filas.

### CA-RF23-F10 — Sin conexión

- **Dado** que el acumulado falla por falta de conexión
- **Cuando** termina la consulta
- **Entonces** ve en la sección "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." con "Reintentar".

### CA-RF23-F11 — Sesión vencida (401)

- **Dado** que el acumulado responde `401`
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al login; la sección no muestra un aviso propio.

## Anotar el ahorro de un mes

### CA-RF23-F12 — La hoja del mes elegido

- **Dado** las filas de ACUMULADO
- **Cuando** el usuario toca "Anotar" en agosto 2026
- **Entonces** se abre la hoja "Ahorro de agosto 2026" con el campo "¿Cuánto pudiste ahorrar?" vacío ("$ 0"), la ayuda "Es lo que de verdad lograste guardar ese mes. Lo escribes tú.", el botón "Guardar ahorro" y "Volver"; no ve "Borrar lo anotado".
- **Y** abrirla no llama al backend. El mes actual y los anteriores se abren igual.

### CA-RF23-F13 — Con ahorro ya anotado, el campo lo trae

- **Dado** la fila de junio 2026 con 250000
- **Cuando** el usuario toca "Cambiar"
- **Entonces** el campo muestra "$ 250.000" y se ve "Borrar lo anotado".
- **Y** si lo anotado es negativo, el campo empieza vacío y también se ve "Borrar lo anotado".

### CA-RF23-F14 — El campo escribe pesos enteros

- **Dado** la hoja de un mes
- **Cuando** el usuario escribe "-abc1250000"
- **Entonces** el campo muestra "$ 1.250.000" (solo dígitos, con puntos de miles; sin signos ni decimales).

### CA-RF23-F15 — Campo vacío: no se envía

- **Dado** la hoja con el campo vacío (o con "0", que el campo deja vacío)
- **Cuando** el usuario toca "Guardar ahorro"
- **Entonces** ve "Escribe cuánto ahorraste." (alerta) y no se llama al backend; el aviso desaparece al escribir.

### CA-RF23-F16 — "Volver" no guarda

- **Dado** la hoja con un valor escrito
- **Cuando** el usuario toca "Volver" y vuelve a abrirla
- **Entonces** no se envió nada, la fila sigue igual y el campo trae lo guardado, no lo que había escrito.

## Guardar

### CA-RF23-F17 — Guardar anota el valor en la meta de ese mes

- **Dado** la hoja de agosto 2026 con "320000" y `obtenerMetaDelMes('2026-08')` responde la meta con `id` "meta-agosto"
- **Cuando** el usuario toca "Guardar ahorro"
- **Entonces** se llama a `guardarAhorroReal('meta-agosto', 320000)` una sola vez (número, no texto) y no se llama a `crearMeta` ni a `actualizarMeta`.

### CA-RF23-F18 — Al guardar, la hoja se cierra y el acumulado se actualiza

- **Dado** que el backend responde `200`
- **Cuando** termina de guardar
- **Entonces** la hoja se cierra y se vuelve a llamar a `obtenerAhorroAcumulado('2026-09')`; las filas y el total muestran lo que responda. La meta y el progreso no se vuelven a pedir.
- **Y** mientras llega la respuesta se siguen viendo las cifras anteriores, sin indicador.

### CA-RF23-F19 — Guardar sin cambiar nada solo cierra

- **Dado** la hoja de junio con "$ 250.000" tal como llegó
- **Cuando** el usuario toca "Guardar ahorro"
- **Entonces** la hoja se cierra sin llamar al backend.

### CA-RF23-F20 — Mientras guarda, indicador y sin doble envío

- **Dado** que el backend aún no responde
- **Cuando** el usuario espera o toca "Guardar ahorro" dos veces seguidas
- **Entonces** el botón muestra un indicador y no se puede tocar; `guardarAhorroReal` se llama una sola vez.

### CA-RF23-F21 — Sin conexión: avisa y conserva lo escrito

- **Dado** que guardar falla por falta de conexión (al consultar la meta del mes o al guardar)
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." en la hoja (alerta), con lo escrito intacto; al volver a tocar "Guardar ahorro" lo intenta de nuevo.

### CA-RF23-F22 — Otro fallo: mensaje general

- **Dado** que guardar falla con `400` o `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve "No pudimos guardar tu ahorro. Inténtalo de nuevo en unos minutos.", sin mensajes del backend, con la hoja abierta y lo escrito intacto.

### CA-RF23-F23 — El mes ya no tiene meta

- **Dado** que la meta se quitó en otro dispositivo (`obtenerMetaDelMes` responde `null`, o `guardarAhorroReal` responde `404`)
- **Cuando** el usuario toca "Guardar ahorro"
- **Entonces** ve en la hoja "Ese mes ya no tiene meta, así que no se puede anotar el ahorro." y se vuelve a pedir el acumulado.

### CA-RF23-F24 — Sesión vencida al guardar (401)

- **Dado** que guardar responde `401`
- **Cuando** el usuario ve el resultado
- **Entonces** la sesión se cierra y la app vuelve al login; la hoja no muestra un aviso propio.

## Borrar lo anotado

### CA-RF23-F25 — Pide confirmación

- **Dado** la hoja de junio 2026 (250000 anotados)
- **Cuando** el usuario toca "Borrar lo anotado"
- **Entonces** ve el diálogo "¿Borrar lo anotado?" con "Se borrará el ahorro anotado de junio 2026. La meta de ese mes no cambia." y los botones "Cancelar" y "Eliminar"; todavía no se envía nada.
- **Y** "Cancelar" cierra el diálogo sin llamar al backend y la hoja sigue.

### CA-RF23-F26 — Confirmar deja el mes sin anotar

- **Dado** el diálogo abierto
- **Cuando** el usuario toca "Eliminar" (aunque lo toque dos veces)
- **Entonces** ve un indicador y se llama una sola vez a `guardarAhorroReal(id, 0)` con el `id` de la meta de ese mes; al terminar se cierran el diálogo y la hoja y se vuelve a pedir el acumulado.
- **Y** si la meta ya no existe (`null` o `404`), pasa lo mismo, sin aviso de error.

### CA-RF23-F27 — Si borrar falla

- **Dado** que borrar falla sin conexión o con `500`
- **Cuando** el usuario ve el resultado
- **Entonces** ve, dentro del diálogo, "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." o "No pudimos borrar lo anotado. Inténtalo de nuevo en unos minutos.", y puede volver a intentarlo.
- **Y** con `401` la sesión se cierra, sin aviso propio.

## Relación con la meta del mes

### CA-RF23-F28 — Si la meta cambia, el acumulado se vuelve a pedir

- **Dado** la pantalla cargada
- **Cuando** el usuario fija o quita la meta con éxito
- **Entonces** se vuelve a llamar a `obtenerAhorroAcumulado('2026-09')` y la sección muestra lo que responda (aparece o desaparece la fila del mes).
- **Y** si la validación o el guardado de la meta fallan sin conexión o con `500`, no se vuelve a pedir.

### CA-RF23-F29 — No se puede quitar una meta con ahorro anotado

- **Dado** que `eliminarMeta` responde `409`
- **Cuando** el usuario confirma "Quitar"
- **Entonces** ve dentro del diálogo "Ya anotaste ahorro en este mes, así que la meta no se puede quitar. Borra primero lo anotado." (D8) y la meta sigue.

## Accesibilidad y lenguaje (RNF-04, RNF-06)

### CA-RF23-F30 — Se puede usar con lector de pantalla

- **Dado** la sección, la hoja y el diálogo
- **Cuando** un lector de pantalla los recorre
- **Entonces** cada botón de fila se anuncia con su mes ("Anotar el ahorro de agosto 2026", "Cambiar el ahorro de junio 2026"); "Guardar ahorro", "Borrar lo anotado", "Volver", "Cancelar" y "Eliminar" son botones; el campo se anuncia como "Monto en pesos"; los avisos de error, como alerta; y el total y cada fila se leen en una sola frase ("Total anotado, $ 400.000"; "septiembre 2026, anotaste $ 150.000, llevas $ 400.000"; un mes sin anotar, "agosto 2026, sin anotar, llevas $ 250.000").

### CA-RF23-F31 — Textos cotidianos y sin datos crudos

- **Dado** cualquier estado de lo nuevo
- **Cuando** el usuario lee su texto
- **Entonces** no ve "ahorroReal", "acumulado", "periodo", "meta-agosto", "404", "409", "NaN", "null" ni "undefined", ni mensajes del backend.

## Adaptador (`lib/api/ahorro.ts`)

### CA-RF23-F32 — `obtenerAhorroAcumulado` sigue el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `obtenerAhorroAcumulado('2026-09')`
- **Entonces** hace `GET /ahorro/acumulado?hasta=2026-09` con `Authorization: Bearer …`, sin cuerpo ni `Idempotency-Key`, y entrega `{ total, meses }` tal como llega (con decimales y en el mismo orden; `meses` puede venir vacío).

### CA-RF23-F33 — `guardarAhorroReal` sigue el contrato

- **Dado** una sesión vigente
- **Cuando** se llama a `guardarAhorroReal('66a0', 320000)` (o con 0)
- **Entonces** hace `PATCH /ahorro/metas/66a0` con `Authorization: Bearer …` y `Content-Type: application/json`, sin `Idempotency-Key`, con el cuerpo `{ "ahorroReal": 320000 }` y nada más, y entrega la meta que responde el `200`.

### CA-RF23-F34 — Errores del adaptador

- **Dado** que el backend responde con error a cualquiera de las dos funciones
- **Cuando** se llama
- **Entonces** `400`, `404` y `500` llegan como `ApiError` con su código; `401` cierra la sesión; sin respuesta llega un `NetworkError`.

---

## Efecto en lo ya aprobado (aprobado y aplicado el 2026-11-26)

- `04-ahorro-meta.md`: la pantalla ahora **sí** muestra y envía `ahorroReal` (en un `PATCH` aparte); crear y editar la meta siguen sin enviarlo (CA-RF21-F21 y F24 no cambian). Los meses pasados dejan de estar fuera solo para anotar el ahorro.
- CA-RF21-F04 y CA-RF22-F01 ("no se piden otros meses"): además se pide el acumulado (CA-RF23-F02).
- CA-RF21-F39: cambia el texto por D8 (`TEXTO.conAhorro` en `meta-de-ahorro-pantalla.test.tsx` y `meta-de-ahorro-progreso.test.tsx`).
- Los `jest.mock('@/lib/api/ahorro')` de esas dos pruebas deben sumar `obtenerAhorroAcumulado` y `guardarAhorroReal`.
- `04-ahorro-progreso.md` dejaba el acumulado fuera: queda cubierto aquí.
- Con la aprobación, el frontend da su conformidad a `GET /ahorro/acumulado` (ya anotada en `coordinacion/contratos/ahorro-progreso.md`).

## Resumen

- Criterios: 34 (`CA-RF23-F01` a `F34`): consultar y ver 7 (F01 a F07), carga y errores 4 (F08 a F11), hoja 5 (F12 a F16), guardar 8 (F17 a F24), borrar 3 (F25 a F27), relación con la meta 2 (F28, F29), accesibilidad y lenguaje 2 (F30, F31), adaptador 3 (F32 a F34).
- Decisiones aprobadas: D1 a D8. Sin decisiones abiertas.
