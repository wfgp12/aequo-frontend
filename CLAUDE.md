# CLAUDE.md — Aequo Frontend

**Nombre del proyecto:** Aequo
**Este repositorio:** `aequo-frontend` — interfaz del proyecto en **React Native con Expo**: una sola base de código para la versión web y las apps de Android e iOS.
**Repositorio hermano:** `aequo-backend` (NestJS + MongoDB). Este frontend consume la API expuesta por ese backend; no comparten código, solo el contrato de la API.
**Concepto de marca:** del latín *aequus* (equilibrio/equidad). Tagline: *"Aequo — el equilibrio de tus finanzas personales"*.

Este archivo es el contexto de referencia para trabajar en este repositorio con Claude Code. Léelo antes de generar o modificar código. La documentación completa del proyecto vive en `docs/` (Charter, Especificación de Requisitos, Diseño Técnico, ADR, Diccionario de la EDT) — consultala para el detalle que no quepa aquí.

## 1. Qué es Aequo

Aplicación de gestión financiera personal, simple e intuitiva, dirigida a personas sin conocimientos contables (actor principal) y a personas metódicas que ya llevan control manual en Excel/Numbers (actor secundario). Además de ingresos, egresos, reportes y ahorro, maneja tarjetas de crédito con compras a cuotas, deudas con personas y presupuesto mensual (ADR-013). Proyecto personal de Wilhen Ferney Gutierrez Pabon, con fines de portafolio profesional.

## 2. Rol de este repositorio

Contiene **únicamente el frontend**: la interfaz que consume la API REST de `aequo-backend`. No implementa lógica de negocio ni cálculos financieros (cuotas, proyecciones, saldos, indicadores): todo eso viene calculado del backend (RNF-11). El frontend solo presenta y formatea (redondeo al peso al mostrar).

**Estado del scaffold:** el repositorio todavía tiene el scaffold inicial de Angular. El paquete **0.6.5** lo reemplaza por un proyecto Expo en una rama `feature/`, conservando la configuración de CI, SonarCloud, GitFlow y CONTRIBUTING.md (ADR-009). Hasta que ese paquete esté cerrado, no agregar código Angular nuevo.

## 3. Stack técnico

| Elemento | Tecnología | Notas |
|---|---|---|
| Framework | **React Native + Expo** (flujo gestionado), **TypeScript**, **Expo Router** | Una sola base de código para web, Android e iOS (ADR-009). |
| Estilos y componentes | **NativeWind** (Tailwind) + **React Native Reusables** | Componentes estilo shadcn copiados al repo y adaptados a la paleta (ADR-010). Fijar versiones en `package.json` y revisar `npm audit` en CI. |
| Gráficas | **react-native-gifted-charts** (sobre `react-native-svg`) | Barras, circulares/dona y línea. Validar en las tres plataformas en el paquete 3.2.1; si la web no se ve bien, aislar las gráficas detrás de un componente propio. |
| Web | Exportación estática de Expo, desplegada en **GitHub Pages** | Único despliegue del MVP (ADR-011). |
| Android e iOS | **Expo Go** y builds de desarrollo | No se publican en tiendas durante el MVP (ADR-011). |
| Autenticación | **Firebase Authentication** (proveedor Google) | SDK web en la versión web e inicio de sesión nativo en el build de desarrollo de Android. El backend verifica el ID Token una sola vez y emite su propio JWT (ADR-007). No reenviar el ID Token de Firebase en cada request: usar el JWT propio. |
| Comunicación con backend | Patrón **Adapter** | Encapsula las llamadas a la API; el contrato se consulta en el Swagger del backend (`/api/docs`), no en un documento estático. |
| Pruebas | **Jest** (preset `jest-expo`) + **React Native Testing Library** | Reemplaza Jasmine/Karma del scaffold anterior. |

## 4. Cómo se revisa la app durante el desarrollo

Con `npx expo start` se ve la misma app en tres lugares:

- **Web:** tecla `w`; usar el modo responsive de las DevTools para tamaños de celular (RNF-05).
- **iPhone:** Expo Go, escaneando el QR (`--tunnel` si el PC y el teléfono no están en la misma red).
- **Android:** tecla `a` para el emulador de Android Studio, o Expo Go en un dispositivo.

**Limitación conocida:** el inicio de sesión nativo con Google no funciona en Expo Go. En el iPhone, las pantallas que requieren sesión se revisan con la **sesión de prueba de desarrollo** (paquete 1.1.4), que solo se activa con la configuración de desarrollo y nunca en producción. El flujo de login completo se valida en web y en el build de desarrollo de Android.

Cada pantalla se considera terminada cuando se ve bien en web, en el iPhone y en Android, en modo claro y oscuro.

## 5. Decisiones de UX ya tomadas — importante

- **Registro:** dos botones separados y visualmente diferenciados, "Registrar ingreso" y "Registrar egreso". Nada de formulario único con selector de tipo. El tipo queda fijado por el botón y se envía en el body del único endpoint `POST /transacciones`.
- **Paso a paso del registro:** valor → categoría (generales y personalizadas en una lista, con opción de crear) → método de pago (lista que avanza al tocar) → fecha (hoy por defecto, ayer o elegir) → descripción opcional → resumen antes de guardar.
- **Tarjeta de crédito como método de pago:** el flujo pide tarjeta, número de cuotas y mes del primer pago, y muestra la cuota estimada (calculada por el backend) en el resumen. Se guarda como compra con tarjeta, no como transacción.
- **Edición:** formulario con todos los campos visibles. Eliminar siempre pide confirmación.
- **Dashboard:** solo indicadores, con selector de mes o rango compartido con Reportes. Muestra por separado el **ingreso propio** y el **dinero recibido** por préstamos o avances (ADR-014).
- **Movimientos:** carga progresiva (más recientes primero) con filtros Desde/Hasta, independiente del periodo del dashboard.
- **Más:** bottom sheet con Mis categorías, Meta de ahorro y Cerrar sesión; tocar el nombre abre Perfil (con eliminar cuenta). Dónde van Tarjetas, Deudas y Presupuesto en la navegación se define con los wireframes del paquete 0.7.5; no inventarlo antes.
- **Paleta:** #FFFFFF, #FFD300, #757B81, #262B32, #090C11; respetar el modo oscuro del sistema. Diseño en Figma, archivo "Aequo — Design System" (las pantallas de tarjetas, deudas y presupuesto se diseñan en el paquete 0.7.5).

## 6. Requisitos no funcionales relevantes para este repositorio

| Código | Descripción |
|---|---|
| RNF-02 | Respuesta ágil entre pasos del registro. Indicador de carga para el primer acceso tras inactividad (posible cold start de Render). |
| RNF-04 | Lenguaje sencillo y cotidiano en toda la interfaz, sin jerga contable o técnica. |
| RNF-05 | Web responsive y la misma interfaz ejecutable como app en Android e iOS. |
| RNF-06 | Accesibilidad básica: contraste adecuado, tamaños de texto legibles. |
| RNF-07 | Funciona en las versiones de Android e iOS soportadas por el SDK de Expo y en los navegadores más usados. |
| RNF-11 | Los cálculos financieros vienen del backend; el frontend solo redondea al peso al mostrar. |
| RNF-12 | Lo registrado en una plataforma se ve igual en las demás (no hay datos locales que no estén en el servidor). |

## 7. Enfoque de pruebas (shift-left)

Este repositorio no tiene lógica de cálculo propia, así que no aplica TDD estricto aquí. Sí aplica **shift-left testing**: escribí las pruebas de cada componente o pantalla inmediatamente después de construirlo, antes de avanzar al siguiente paquete. Framework: Jest con `jest-expo` y React Native Testing Library.

Cobertura mínima objetivo: 60% en componentes del frontend (ver Plan de Gestión de Calidad).

## 8. Módulos de la interfaz

- **Autenticación:** login con Google, cierre de sesión, perfil y eliminación de cuenta.
- **Registro:** botones de ingreso/egreso, registro paso a paso, lista editable de movimientos, gestión de categorías.
- **Reportes y visualización:** mes actual por defecto, selector de periodo, comparación entre periodos, gráficas de barras, circulares y línea de tiempo, drill-down por categoría.
- **Ahorro:** meta mensual (porcentaje o monto fijo), monto disponible, ahorro acumulado.
- **Tarjetas de crédito:** tarjetas con su tasa, cargos fijos, compras a cuotas y avances, total del mes, proyección y registro de pagos.
- **Deudas:** préstamos recibidos con o sin intereses, abonos y saldos.
- **Presupuesto e indicadores:** presupuesto por categoría, obligaciones fijas, pendiente por pagar, ingresos recurrentes, aportes e indicadores del mes.

## 9. Reglas de desarrollo (no negociables)

- Código legible y modular (pantallas, componentes, hooks y adaptadores bien separados) por sobre soluciones ingeniosas pero difíciles de mantener.
- Antes de implementar una función nueva no listada en los RF, verificar si está en las exclusiones del alcance (Especificación de Requisitos y Charter). Si lo está, señalarlo y preguntar antes de implementarla.
- **GitFlow**: ramas `feature/`, `fix/`, `release/` desde `develop`, nunca directo sobre `main`. Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para el flujo completo (incluida `qa`) y convención de nombres.
- **Conventional Commits en español**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Ejemplo: `feat: agregar botones de registrar ingreso y egreso`.
- Si una alternativa técnica sería claramente mejor que el stack ya decidido, proponerla y preguntar — no cambiarla unilateralmente.

## 9.1 Flujo de trabajo con Claude Code (avance controlado)

- **Trabajar un paquete de trabajo de la EDT a la vez** (el nivel más atómico, ej. `1.1.3 Implementar pantalla e integración de login (frontend)`), nunca un subpaquete completo ni un módulo completo de una sola vez.
- Antes de empezar un paquete nuevo, **esperar confirmación explícita** del desarrollador de que puede avanzar — no encadenar el siguiente paquete automáticamente al terminar el anterior.
- Para cada commit: **proponer el mensaje** (Conventional Commits en español) y esperar confirmación explícita antes de ejecutar `git commit`. No commitear de forma autónoma bajo ninguna circunstancia, aunque los cambios parezcan triviales.
- No agregar co-author tags en commits salvo instrucción explícita.
- El avance de cada paquete se registra en el tablero de Notion "Aequo Finanzas — Seguimiento de la EDT".

## 10. Roadmap (referencia rápida)

Orden de construcción por módulo (EDT v2.0; detalle en el Diccionario de la EDT y en Notion): 0. Gestión y entorno (0.6.5 migración a Expo, 0.6.6 entorno móvil) → 1. Autenticación → 2. Registro → 3. Reportes y visualización → 4. Ahorro → 5. Tarjetas de crédito → 6. Deudas → 7. Presupuesto e indicadores → 8. Despliegue y cierre. Cada módulo cierra con sus propias pruebas antes de avanzar al siguiente.
