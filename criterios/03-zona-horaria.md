# Criterios de aceptación — 3. Reportes: enviar la zona horaria del dispositivo (X-Zona-Horaria)

Estado: Aprobado

Cubre RF-13 en el frontend: el "mes actual" de los reportes depende de la zona horaria de la persona (alguien en Bogotá a las 9 p. m. del último día del mes todavía está en ese mes, aunque en UTC ya sea el siguiente). El backend decide el mes; el frontend solo le dice en qué zona está (RNF-11: aquí no se calcula nada). Este paquete toca únicamente el cliente HTTP compartido (`lib/api/client.ts`); no toca pantallas.

**Contrato del backend** (confirmado por `arquitecto-back`; el Swagger `/api/docs` es la fuente de verdad):
- Header opcional `X-Zona-Horaria` con una zona IANA (por ejemplo `America/Bogota`).
- Solo lo leen `GET /reportes/periodo` y `GET /reportes/categorias`; en las demás rutas se ignora.
- Decide cuál es el "mes actual" cuando no se envía `mes` ni `desde`/`hasta`. Sin el header usa UTC.
- Zona inválida: `400` con `message` (arreglo) que menciona `X-Zona-Horaria`, también si se envía `mes` o rango.
- CORS no lo bloquea.

**Comportamiento acordado:** el cliente HTTP envía el header en todas las peticiones, con la zona que entrega el dispositivo (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Si el entorno no entrega una zona, el header no se envía.

**Sobre los IDs:** el backend usa CA-RF13-04 a CA-RF13-12 para su lado; aquí empiezan en 01 porque son del frontend (`aequo-frontend`), y la prueba lleva el ID en su nombre.

---

## RF-13 — Mes actual según la zona horaria de la persona

### CA-RF13-01 — Una consulta con sesión lleva la zona del dispositivo

- **Dado** una sesión vigente y un dispositivo cuya zona es `America/Bogota`
- **Cuando** se hace cualquier consulta `GET` al backend (por ejemplo, el reporte del periodo)
- **Entonces** la petición lleva el header `X-Zona-Horaria: America/Bogota`, con ese nombre exacto y el valor tal cual lo entrega el dispositivo, sin cambiarlo.

### CA-RF13-02 — Las peticiones sin sesión también la llevan

- **Dado** que todavía no hay sesión (por ejemplo, el inicio de sesión con Google) y un dispositivo en `America/Bogota`
- **Cuando** se envía la petición, sin `Authorization`
- **Entonces** lleva `X-Zona-Horaria: America/Bogota`, igual que las demás.

### CA-RF13-03 — Las peticiones que crean, cambian o eliminan también la llevan

- **Dado** una sesión vigente y un dispositivo en `America/Bogota`
- **Cuando** se envía una petición `POST`, `PATCH` o `DELETE` (por ejemplo, guardar, editar o eliminar un movimiento)
- **Entonces** cada una lleva `X-Zona-Horaria: America/Bogota`.

> Decisión (aprobada por el desarrollador): el backend solo lee el header en dos rutas de reportes y lo ignora en las demás. Se envía en todas para que el cliente HTTP no tenga que saber qué ruta lo usa y cualquier reporte futuro lo reciba sin cambios; el costo es un header de unos 30 bytes por petición. En la web, un header nuevo hace que el navegador pregunte (preflight) antes de cada petición: el backend confirmó que CORS lo permite.

### CA-RF13-04 — Convive con los otros headers sin pisarlos

- **Dado** una sesión vigente, un cuerpo JSON, una clave de idempotencia y un dispositivo en `America/Bogota`
- **Cuando** se envía un `POST` (por ejemplo, guardar un movimiento)
- **Entonces** la petición lleva a la vez `Authorization: Bearer …`, `Content-Type: application/json`, `Idempotency-Key` con la clave recibida y `X-Zona-Horaria: America/Bogota`, cada uno con su valor intacto.

### CA-RF13-05 — Si el dispositivo no entrega zona, el header se omite

- **Dado** un entorno donde la zona del dispositivo viene vacía (`""`) o indefinida (el dispositivo no la entrega)
- **Cuando** se envía cualquier petición
- **Entonces** la petición no lleva el header `X-Zona-Horaria` (ni vacío ni con la palabra "undefined"), se envía igual con sus demás headers y la llamada funciona con normalidad. El backend usará UTC.

> Decisión (aprobada por el desarrollador): con el header omitido, el "mes actual" se calcula en UTC y puede quedar desfasado un día en el cambio de mes (por ejemplo, en Bogotá a partir de las 7 p. m. del último día). Se acepta, porque el frontend no debe inventar una zona por su cuenta; lo normal es que Hermes, Safari y los navegadores sí la entreguen.

### CA-RF13-06 — Si la zona cambia, se envía la nueva

- **Dado** una persona que cambió la zona de su dispositivo (por ejemplo, viajó de `America/Bogota` a `America/Mexico_City`) sin cerrar la app
- **Cuando** se envía una petición nueva
- **Entonces** lleva la zona vigente en ese momento, no la que había cuando se abrió la app.

> Decisión (aprobada por el desarrollador): la zona se lee en cada petición (es barato) para que un viaje o un cambio de configuración se reflejen sin reiniciar.

### CA-RF13-07 — Una zona que el backend rechaza llega como el error de siempre

- **Dado** que el backend responde `400` con `message` como arreglo, por ejemplo `["X-Zona-Horaria debe ser una zona horaria IANA válida"]`
- **Cuando** la petición falla
- **Entonces** quien la llamó recibe un error con el código `400` y como mensaje el texto del backend (los mensajes del arreglo unidos con coma), como ocurre con los demás 400 de validación; el cliente no lo oculta, no lo reintenta sin el header ni lo convierte en un fallo interno.

> Decisión (aprobada por el desarrollador): si el dispositivo entrega una zona que el backend rechaza (por ejemplo, un alias poco común que algún motor devuelva en lugar del nombre IANA canónico), no se maneja en este paquete. Hoy no hay pantalla de Reportes que lo muestre; el 400 llega como `ApiError` y la pantalla de Reportes (3.x) decide qué texto sencillo mostrar (RNF-04). Si en la práctica aparece, se corrige con una lista de equivalencias en un paquete aparte, nunca con cálculos en el frontend.

---

## No aplica en este paquete

- Pantallas, estados de carga, vacío y error visibles: este paquete no toca pantallas; los verá el paquete de Reportes que consuma estas rutas.
- Qué mes se calcula y cuándo cambia de mes: es del backend (`aequo-backend/criterios/03-reportes-zona-horaria.md`).
- Estado de carga y arranque en frío de Render (RNF-02): ya los cubre cada pantalla; enviar un header no cambia la espera.
- Doble toque: el header no depende de acciones del usuario.
- Pruebas de CORS: son del backend y del despliegue.
