# Criterios de aceptación — 2. Registro: no duplicar un movimiento (clave de idempotencia)

Estado: Aprobado (2026-10-29), con el contrato `crearTransaccion(datos, clave)` y con clave nueva cuando el usuario cambia un dato después de un fallo (CA-RF06-22). Los demás "Pendiente de decisión" siguen abiertos y no tienen prueba.

Este archivo cubre el uso, desde el frontend, de la **clave de idempotencia** que ya implementó el backend (rama `feature/idempotencia-peticiones`, paquete que ellos numeran 2.2.7). Va en un archivo aparte de `02-registro.md` porque `feature/lista-de-movimientos` todavía no está mezclada en `develop` y así las dos ramas no chocan; cuando ambas estén en `develop` se pueden unir.

**Contrato del backend** (Swagger y `CLAUDE.md` del backend):
- Todo `POST` que crea datos acepta el header `Idempotency-Key` con un UUID, generado **una vez** cuando empieza la acción del usuario y **reutilizado** en cualquier reintento de esa misma acción; una acción nueva lleva una clave nueva.
- Misma clave y misma petición ya terminada: el backend devuelve la respuesta de la primera vez (con el header `Idempotent-Replayed: true`) y no crea nada nuevo.
- Misma clave mientras la primera sigue en proceso: `409`. Misma clave con otro cuerpo o ruta: `422`. Si la primera falla (400, 500…) la clave se libera y se puede reintentar.
- Las claves son por usuario y caducan a las 24 horas. Hoy el header es opcional; el backend lo hará obligatorio (`IDEMPOTENCIA_OBLIGATORIA=true`, sin él `400`) cuando el frontend ya lo envíe, así que **este paquete es lo que le permite activarlo**.
- Dos movimientos iguales seguidos son legítimos: no se deduplica por contenido, solo por clave.

**Alcance:** hoy el único adaptador que crea datos es `crearTransaccion` (`POST /transacciones`), usado por el registro paso a paso. `POST /categorias` también lleva la regla en el backend, pero su adaptador y pantalla llegan en un paquete posterior (2.3.x): al construirlos deben seguir los mismos criterios. No hay criterios para `PATCH` ni `DELETE` (el backend ya tolera repetirlos).

**Sobre los IDs:** continúan la numeración de RF-06 del archivo `02-registro.md` (que llega hasta CA-RF06-14), para no repetir identificadores.

---

## RF-06 — Registrar un movimiento sin duplicarlo

### CA-RF06-15 — El adaptador envía la clave en el header y no en el cuerpo

- **Dado** una sesión vigente y una clave (UUID) que le entrega quien lo llama
- **Cuando** se llama a `crearTransaccion(datos, clave)`
- **Entonces** el `POST /transacciones` lleva el header `Idempotency-Key` con esa clave, además del `Authorization: Bearer …`, y el cuerpo contiene solo los datos del movimiento (la clave no va dentro).

> Decidido: para que un reintento pueda reutilizar la clave, ésta nace fuera del adaptador (en el flujo de registro) y entra como **segundo parámetro obligatorio**: `crearTransaccion(datos, clave)`. Las pruebas del adaptador que llamaban `crearTransaccion(datos)` solo con los datos se actualizaron a ese contrato.

### CA-RF06-16 — Cada acción nueva genera su propia clave

- **Dado** el registro paso a paso con todos los datos completos y el resumen a la vista
- **Cuando** el usuario toca "Guardar" por primera vez
- **Entonces** la solicitud lleva una clave con formato de UUID.
- **Y** si más tarde el usuario abre un registro nuevo (después de guardar o de cerrar y volver a entrar) y guarda, la solicitud lleva una clave **distinta** a la anterior, aunque los datos sean idénticos: dos movimientos iguales seguidos son legítimos.

### CA-RF06-17 — Reintentar tras un fallo reutiliza la misma clave y los mismos datos

- **Dado** que el primer "Guardar" falló por falta de conexión o por un error del servidor (el backend pudo haber alcanzado a guardar el movimiento sin que el usuario se enterara)
- **Cuando** el usuario vuelve a tocar "Guardar" sin cambiar nada
- **Entonces** la nueva solicitud lleva **la misma clave** y los mismos datos que la primera, y el usuario ve el aviso de error mientras tanto y ninguno al lograr guardar.

### CA-RF06-18 — Una respuesta repetida cuenta como éxito

- **Dado** que el backend responde 201 con el header `Idempotent-Replayed: true` porque el primer intento sí se había guardado
- **Cuando** el usuario ve el resultado
- **Entonces** ve la misma confirmación "¡Listo!" que en un guardado normal (con el valor y la categoría), sin ningún aviso extra y sin que se haya creado un segundo movimiento.

### CA-RF06-19 — Si todavía se está procesando (409), espera y reintenta con la misma clave

- **Dado** que el backend responde 409 porque la primera solicitud con esa clave sigue ejecutándose
- **Cuando** el usuario ve el resultado
- **Entonces** ve "Tu movimiento todavía se está guardando. Espera unos segundos e inténtalo de nuevo." (no el mensaje de datos incorrectos), el botón "Guardar" vuelve a estar disponible y, al tocarlo, la nueva solicitud lleva **la misma clave**.

> Pendiente de decisión: el texto es una propuesta mía, en lenguaje cotidiano (RNF-04); el wireframe no lo trae.

### CA-RF06-20 — Doble toque en "Guardar": una sola solicitud

- **Dado** el resumen de un movimiento listo para guardar
- **Cuando** el usuario toca "Guardar" dos veces seguidas
- **Entonces** se envía una sola solicitud al backend, con una sola clave.

### CA-RF06-21 — La clave sigue siendo la misma mientras el usuario recorre los pasos

- **Dado** que el primer "Guardar" falló
- **Cuando** el usuario vuelve a pasos anteriores sin cambiar ningún dato, regresa al resumen y toca "Guardar"
- **Entonces** la solicitud lleva la misma clave que el intento fallido.

### CA-RF06-22 — Si el usuario cambia un dato después de un fallo, es una acción nueva

- **Dado** que el primer "Guardar" falló
- **Cuando** el usuario cambia cualquier dato (el monto, la categoría, el método, la fecha o la nota) y vuelve a tocar "Guardar"
- **Entonces** la nueva solicitud lleva una clave **distinta** a la del intento fallido, y los datos nuevos.

> Decidido por el desarrollador: se trata como una acción nueva, porque el backend define que "una acción nueva lleva una clave nueva". Riesgo conocido: si el primer intento sí se había guardado en el servidor sin que el usuario lo supiera, el cambio crea un segundo movimiento (el usuario puede editarlo o eliminarlo después).

---

## Pendientes de decisión (sin prueba hasta que se definan)

> Pendiente de decisión: **respuesta 422** ("la clave ya se usó con otra petición"). En la práctica solo se da si se reutiliza una clave con otros datos. Falta definir el mensaje al usuario y si el siguiente "Guardar" lleva clave nueva.

> Pendiente de decisión: **cómo se genera el UUID en el celular.** El backend sugiere `crypto.randomUUID()`, que no existe en todos los motores de React Native (Hermes). Probablemente hará falta una dependencia de Expo (`expo-crypto`). Las pruebas solo piden que la clave tenga formato de UUID y no dependen de cómo se genere; la elección del generador es de la implementación y, si agrega una dependencia, conviene avisarte (CLAUDE.md pide fijar versiones y revisar `npm audit`).

> Pendiente de decisión: **mientras el backend no active la exigencia**, el header es opcional. Este paquete lo envía siempre; cuando el frontend esté desplegado, el backend puede poner `IDEMPOTENCIA_OBLIGATORIA=true`.

## No aplica en este paquete

- Estado de carga, vacío y error del backend: ya cubiertos por el registro paso a paso (2.2.4); aquí solo cambia lo relacionado con la clave y con los códigos 409 y 422.
- `POST /categorias`: se cubrirá cuando exista su adaptador (2.3.x).
