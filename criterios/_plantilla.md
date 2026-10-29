# Criterios de aceptación — <número y nombre del módulo>

Cada archivo de esta carpeta cubre un módulo de la EDT (por ejemplo `05-tarjetas.md`). Los redacta el agente tester a partir del RF, el wireframe de Figma y el contrato del Swagger, y solo pasan a pruebas cuando el desarrollador los aprueba. Las pruebas usan el ID del criterio en su nombre, así se puede ir del requisito a la prueba y de vuelta.

Aquí van los criterios de lo que **ve y hace el usuario**. Las reglas de cálculo (cuotas, saldos, indicadores) se especifican en `aequo-backend/criterios/`.

Estado: Borrador | Aprobado (fecha)

## RF-xx — <descripción corta del requisito>

### CA-RFxx-01 — <comportamiento en pocas palabras>

- **Dado** <la pantalla y el estado: sesión, datos que devuelve el backend>
- **Cuando** <lo que hace el usuario: toca, escribe, navega>
- **Entonces** <lo que ve o lo que se envía al backend>

> Pendiente de decisión: <solo si el comportamiento no está definido en el RF, el wireframe ni CLAUDE.md>

---

## Ejemplo (RF-26, registro con tarjeta de crédito)

### CA-RF26-01 — Elegir tarjeta de crédito pide las cuotas

- **Dado** el paso de método de pago de un egreso, con una tarjeta registrada
- **Cuando** el usuario toca "Tarjeta de crédito"
- **Entonces** ve el paso para elegir la tarjeta, el número de cuotas y el mes del primer pago

### CA-RF26-02 — El resumen muestra la cuota que calcula el backend

- **Dado** que el backend estima una cuota de $119.802 para la compra
- **Cuando** el usuario llega al resumen
- **Entonces** ve "12 cuotas de $119.802" redondeado al peso, sin calcularla en el frontend

### CA-RF26-03 — Doble toque en Guardar

- **Dado** el resumen de una compra con tarjeta
- **Cuando** el usuario toca "Guardar" dos veces seguidas
- **Entonces** se envía una sola solicitud al backend
