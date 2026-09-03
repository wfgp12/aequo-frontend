# CLAUDE.md — Aequo Frontend

**Nombre del proyecto:** Aequo
**Este repositorio:** `aequo-frontend` — interfaz web del proyecto (Angular).
**Repositorio hermano:** `aequo-backend` (NestJS + MongoDB). Este frontend consume la API expuesta por ese backend; no comparten código, solo el contrato de la API.
**Concepto de marca:** del latín *aequus* (equilibrio/equidad). Tagline: *"Aequo — el equilibrio de tus finanzas personales"*.

Este archivo es el contexto de referencia para trabajar en este repositorio con Claude Code. Léelo antes de generar o modificar código. La documentación completa del proyecto vive en `docs/` — consultala para el detalle que no quepa aquí.

## 1. Qué es Aequo

Aplicación web de gestión financiera personal, simple e intuitiva, dirigida a personas sin conocimientos contables (actor principal) y a personas metódicas que ya llevan control manual en Excel/Numbers (actor secundario). Proyecto personal de Wilhen Fabián García, con fines de portafolio profesional.

## 2. Rol de este repositorio

Contiene **únicamente el frontend**: la interfaz que consume la API REST de `aequo-backend`. No implementa lógica de negocio ni acceso directo a la base de datos.

## 3. Stack técnico

| Elemento | Tecnología | Notas |
|---|---|---|
| Framework | **Angular** | |
| Hosting | **GitHub Pages** | Build estático. |
| Autenticación | **OAuth de Google**, iniciado desde este frontend | El backend emite su propio JWT tras la validación; no reenviar el token de Google en cada request. |
| Comunicación con backend | Patrón **Adapter** | Encapsula las llamadas a la API para que cambios en el backend no rompan el resto de la app; consultá el contrato vía Swagger del backend (`/api/docs`), no un documento estático — la API cambia con frecuencia y el Swagger es la única fuente de verdad. |

## 4. Flujo de registro de movimientos — importante

La pantalla de registro muestra **dos botones separados y visualmente diferenciados**: "Registrar ingreso" y "Registrar egreso". No implementar un formulario único con un selector de tipo (dropdown/radio) — esa decisión de UX ya se tomó explícitamente para ahorrarle un paso al usuario. El tipo queda fijado por el botón que el usuario presiona, y se envía como parte del body al único endpoint `POST /transacciones` del backend.

## 5. Requisitos no funcionales relevantes para este repositorio

| Código | Descripción |
|---|---|
| RNF-02 | Respuesta ágil entre pasos del registro, sin tiempos de espera perceptibles. Considerar un indicador de carga para el primer acceso al backend tras inactividad (posible cold start de Render). |
| RNF-04 | Lenguaje sencillo y cotidiano en toda la interfaz, sin jerga contable o técnica. |
| RNF-05 | Diseño responsive, experiencia adecuada en pantallas móviles pequeñas. |
| RNF-06 | Accesibilidad básica: contraste de colores adecuado, tamaños de texto legibles. |
| RNF-07 | Compatibilidad con los navegadores web más utilizados, independiente del sistema operativo. |

## 6. Enfoque de pruebas (shift-left)

Este repositorio no tiene lógica de cálculo compleja propia (eso vive en el backend), así que no aplica TDD estricto aquí. Sí aplica **shift-left testing**: escribí las pruebas de cada componente/subpaquete inmediatamente después de construirlo, antes de avanzar al siguiente — nunca dejarlas para el final del módulo. Framework: el que trae Angular por defecto (Jasmine/Karma) o Jest si se decide migrar — confirmar antes de asumir.

Cobertura mínima objetivo: 60% en componentes del frontend (ver Plan de Gestión de Calidad).

## 7. Módulos de la interfaz

- **Autenticación**: login con Google, cierre de sesión manual.
- **Registro**: dos botones de ingreso/egreso (ver sección 4), formulario guiado (descripción, monto, fecha, categoría, método de pago), listado editable de movimientos, gestión de categorías personalizadas.
- **Reportes y visualización**: vista por defecto del mes actual con resumen numérico, selector de periodo, comparación entre periodos, gráficas de barras (balance/comparaciones), circulares (distribución por categoría/método de pago) y de línea de tiempo (evolución de balance/ahorro). Usar una librería de gráficos compatible con Angular.
- **Ahorro**: definición de meta mensual (porcentaje o monto fijo), monto disponible, ahorro acumulado.

## 8. Reglas de desarrollo (no negociables)

- Código legible y modular (componentes, servicios, módulos bien separados) por sobre soluciones ingeniosas pero difíciles de mantener.
- Antes de implementar una función nueva no listada en los RF, verificar si está en las exclusiones del alcance (Especificación de Requisitos). Si lo está, señalarlo y preguntar antes de implementarla.
- **GitFlow**: ramas `feature/`, `fix/`, `release/` desde `develop`, nunca directo sobre `main`.
- **Conventional Commits en español**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Ejemplo: `feat: agregar botones de registrar ingreso y egreso`.
- Si una alternativa técnica sería claramente mejor que el stack ya decidido, proponerla y preguntar — no cambiarla unilateralmente.

## 8.1 Flujo de trabajo con Claude Code (avance controlado)

- **Trabajar un paquete de trabajo de la EDT a la vez** (el nivel más atómico, ej. `1.1.3 Implementar botón e integración de login`), nunca un subpaquete completo ni un módulo completo de una sola vez.
- Antes de empezar un paquete nuevo, **esperar confirmación explícita** del desarrollador de que puede avanzar — no encadenar el siguiente paquete automáticamente al terminar el anterior.
- Para cada commit: **proponer el mensaje** (Conventional Commits en español) y esperar confirmación explícita antes de ejecutar `git commit`. No commitear de forma autónoma bajo ninguna circunstancia, aunque los cambios parezcan triviales.
- No agregar co-author tags en commits salvo instrucción explícita.

## 9. Roadmap (referencia rápida)

Orden de construcción por módulo (ver Cronograma para el detalle): 0. Entorno base → 1. Autenticación → 2. Registro → 3. Reportes y visualización → 4. Ahorro → 5. Despliegue y cierre. Cada módulo cierra con sus propias pruebas antes de avanzar al siguiente.
