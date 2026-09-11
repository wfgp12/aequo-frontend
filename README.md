# Aequo — Frontend

> *"Aequo — el equilibrio de tus finanzas personales"*

Interfaz web del proyecto **Aequo**, una aplicación de gestión financiera personal simple e intuitiva. Este repositorio contiene únicamente el frontend; la API vive en el repositorio hermano `aequo-backend` (NestJS + MongoDB), que expone los datos que esta app consume.

## Stack

| Elemento | Tecnología |
|---|---|
| Framework | [Angular](https://angular.dev/) 20 (standalone, TypeScript) |
| Estilos | Tailwind CSS 4 vía PostCSS |
| Autenticación | Firebase Authentication (proveedor Google) — el backend verifica el ID Token y emite su propio JWT de sesión |
| Comunicación con backend | Patrón Adapter sobre la API REST de `aequo-backend`; contrato vía Swagger (`/api/docs`) del backend |
| Testing | Jasmine + Karma |
| Lint / formato | ESLint (`angular-eslint`) + Prettier |
| Hosting (objetivo) | GitHub Pages (build estático) |

## Arquitectura

API REST NestJS (`aequo-backend`) → esta interfaz Angular → GitHub Pages. La autenticación se delega a Firebase; este frontend no gestiona contraseñas ni credenciales propias de usuario, solo inicia el flujo de login con Firebase y guarda el JWT de sesión que emite el backend.

Documentación completa del proyecto (Charter, Especificación de Requisitos, ADR, EDT, Documento de Diseño Técnico, Cronograma) en `../docs` (fuera de este repo, hermano de `frontend/` y `backend/`).

## Módulos de la interfaz

- **Autenticación**: login con Google (vía Firebase), cierre de sesión manual.
- **Registro**: botones separados de ingreso/egreso, formulario guiado, listado editable de movimientos, gestión de categorías personalizadas.
- **Reportes y visualización**: resumen del mes actual, selector y comparación de periodos, gráficas de barras/circulares/línea de tiempo.
- **Ahorro**: definición de meta mensual, monto disponible, ahorro acumulado.

Ver [CLAUDE.md](./CLAUDE.md) sección 7 para el detalle de cada módulo.

## Requisitos

- Node.js 22+
- Proyecto de Firebase con Authentication (proveedor Google) habilitado
- `aequo-backend` corriendo (local o desplegado) para consumir la API

## Instalación

```bash
npm install
```

Configurar la config de Firebase del cliente (`environment.ts`) y la URL base de la API del backend antes de levantar la app.

## Scripts

```bash
npm start          # servidor de desarrollo (ng serve)
npm run build        # build de producción
npm run watch         # build en modo watch (desarrollo)
npm run lint           # ESLint
npm run lint:fix        # ESLint con autofix
npm test                 # pruebas unitarias (Karma + Jasmine)
npm run format             # Prettier sobre src/
```

## Flujo de trabajo

GitFlow: ramas `feature/`, `fix/`, `release/` desde `develop`; nunca directo sobre `main`. Conventional Commits en español (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para el detalle completo del flujo (incluida `qa`) y convención de nombres.

Ver [CLAUDE.md](./CLAUDE.md) para el contexto completo de desarrollo (reglas de arquitectura, RNF relevantes, enfoque de pruebas y flujo de trabajo con Claude Code).
