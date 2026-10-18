# Aequo — Frontend

> *"Aequo — el equilibrio de tus finanzas personales"*

Interfaz de **Aequo**, una aplicación de gestión financiera personal. Es un proyecto React Native con Expo: la misma base de código sirve para la versión web y para las apps de Android e iOS (ADR-009). Este repositorio solo tiene el frontend; la API vive en `aequo-backend` (NestJS + MongoDB) y todos los cálculos financieros vienen de ahí. La app solo presenta los datos.

## Stack

| Elemento | Tecnología |
|---|---|
| Framework | Expo SDK 57, React Native, TypeScript, Expo Router |
| Estilos y componentes | NativeWind (Tailwind 3) y React Native Reusables (ADR-010) |
| Pruebas | Jest con `jest-expo` y React Native Testing Library |
| Lint y formato | ESLint (`eslint-config-expo`) y Prettier |
| Autenticación | Firebase Authentication (Google). El backend verifica el ID Token y emite su propio JWT |
| Backend | Patrón Adapter sobre la API REST; el contrato está en el Swagger del backend (`/api/docs`) |
| Despliegue | Web estática en GitHub Pages. Android e iOS no se publican en el MVP (ADR-011) |

Las versiones están fijadas en `package.json`, sin `^` ni `~`. El archivo `.npmrc` tiene `save-exact=true` para que las instalaciones nuevas queden igual.

## Requisitos

- Node.js 22 o superior
- Para Android: Android Studio con un emulador (AVD) creado, o un teléfono con Expo Go
- Para iPhone: la app Expo Go desde la App Store. No hace falta Mac
- `aequo-backend` corriendo si se quiere consumir la API

## Instalación

```bash
npm install
```

## Firebase

El inicio de sesión usa Firebase Authentication con Google como proveedor (ADR-007). El proyecto de Firebase se comparte con `aequo-backend`; los pasos de la consola están en el README del backend. Aquí solo se necesitan los datos de las apps web y Android:

1. En Firebase Console, *Configuración del proyecto → General → Tus apps*, registra la **app web** y copia su configuración.
2. Copia `.env.example` a `.env` y completa `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID` y `EXPO_PUBLIC_FIREBASE_APP_ID`. Expo incluye en el bundle las variables con prefijo `EXPO_PUBLIC_`, así que son identificadores públicos de la app y no llaves secretas.
3. Registra la **app Android** con el paquete `com.wfgp12.aequo`, el mismo de `app.json`. La huella SHA-1 de la llave de firma (`npx eas-cli credentials --platform android` la muestra) se agrega al implementar el login nativo en el paquete 1.1.3; ahí también se descarga el `google-services.json` definitivo y se deja en la raíz del repositorio.
4. En *Authentication → Sign-in method* habilita **Google** y, en *Settings → Authorized domains*, deja autorizado `localhost` y, al publicar, `wfgp12.github.io`.
5. Reinicia el servidor de Expo para que lea el `.env`.

El `.env` y `google-services.json` están en `.gitignore` y no se versionan. Para los builds de EAS se cargan como variables del proyecto en expo.dev, no en el repositorio.

### Inicio de sesión con Google

La pantalla `app/login.tsx` usa un código distinto según la plataforma, y en los dos casos obtiene un ID Token de Firebase que se envía al backend (`POST /auth/login`). El backend lo verifica una sola vez y responde con su propio JWT, que es el que guarda la app (ADR-007).

- **Web:** ventana emergente de Google con el SDK de Firebase (`lib/google-sign-in.web.ts`). Solo necesita las variables `EXPO_PUBLIC_FIREBASE_*` y que `localhost` esté entre los dominios autorizados.
- **Android (build de desarrollo):** inicio de sesión nativo con `@react-native-google-signin/google-signin` (`lib/google-sign-in.ts`). Necesita:
  1. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en el `.env`.
  2. La huella SHA-1 de la llave de firma agregada a la app Android en Firebase (`npx eas-cli credentials --platform android` la muestra).
  3. El `google-services.json` descargado después de agregar la huella, en la raíz del repositorio para uso local. Para EAS, súbelo como variable de archivo: `npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment development`.
  4. Un build de desarrollo nuevo, porque el módulo nativo no estaba en el anterior: `npx eas-cli build --platform android --profile development`.
- **Expo Go (iPhone):** el módulo nativo no existe ahí. La app abre igual, pero el botón de Google falla; las pantallas con sesión se revisan con la sesión de prueba de desarrollo (paquete 1.1.4).

`EXPO_PUBLIC_API_URL` apunta al backend. Desde el emulador de Android el PC se ve como `10.0.2.2`, y desde el iPhone hace falta la IP local del PC. La sesión se guarda en el almacén seguro del teléfono (`expo-secure-store`) y en `localStorage` en web, y dura 24 horas.

## Cómo correr la app

Todo arranca con el mismo comando:

```bash
npx expo start
```

Desde esa terminal se abre la app en cada plataforma.

**Web.** Presiona `w`. Se abre en el navegador; para ver tamaños de celular usa el modo responsive de las DevTools.

**iPhone con Expo Go.** Instala Expo Go y escanea el QR con la cámara. Si el PC y el teléfono no están en la misma red, arranca con `npx expo start --tunnel`.

**Emulador de Android.** Abre el emulador desde Android Studio (Device Manager) y presiona `a` en la terminal. Expo instala Expo Go en el emulador la primera vez. También sirve Expo Go en un teléfono Android con el mismo QR.

El inicio de sesión nativo con Google no funciona en Expo Go. Ese flujo se valida en la web y en el build de desarrollo de Android; en el iPhone las pantallas con sesión se revisan con la sesión de prueba de desarrollo (paquete 1.1.4).

## Entorno móvil

Con `npm start` abierto, un cambio en el código se ve a la vez en la web, en Expo Go en el iPhone y en Android, sin pasos manuales. Esto es lo que hay que tener montado.

**Android Studio y el emulador.** Instala Android Studio con la opción Standard, que baja el SDK, `platform-tools` y el emulador. En Device Manager crea un dispositivo y ábrelo una vez. Después define la variable de usuario `ANDROID_HOME` con la ruta del SDK (en Windows es `%LOCALAPPDATA%\Android\Sdk`) y agrega `%ANDROID_HOME%\platform-tools` al PATH, para que Expo encuentre `adb`. Abre las terminales de nuevo para que lean el cambio. Con el emulador encendido, `a` en la terminal de Expo abre la app. En Windows el emulador necesita la Plataforma del Hipervisor de Windows activada y se pone lento con poca RAM.

**Java.** Los builds locales de Android usan el JDK que indique `JAVA_HOME`; el recomendado es el 17. Android Studio trae su propio JDK, así que para el emulador no hace falta nada más.

**Expo Go en el iPhone.** Instala Expo Go desde la App Store y escanea el QR de `npm start`. La versión de Expo Go tiene que soportar el SDK de este proyecto (57).

**Build de desarrollo de Android.** Expo Go no incluye módulos nativos propios, como el inicio de sesión con Google. Para probarlos hay un build de desarrollo, que se genera en la nube con EAS Build (plan gratuito) y no consume recursos del equipo. Desde la raíz del repositorio:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile development
```

`eas init` agrega el `projectId` y el dueño en `app.json`; ese cambio se commitea. Cuando el build termina, EAS entrega un enlace al APK: se instala en el emulador (arrastrándolo a la ventana) o en un teléfono Android. Luego se levanta el servidor con `npm run start:dev` y el APK se conecta solo. El paquete de Android es `com.wfgp12.aequo`. Los builds de iOS quedan fuera del MVP porque exigen la cuenta de pago de Apple (ADR-011).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo de Expo, para abrir en Expo Go y en la web |
| `npm run start:dev` | Servidor de desarrollo para el build de desarrollo de Android (`expo-dev-client`) |
| `npm run web` / `android` / `ios` | Abre directamente en esa plataforma |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint con autofix |
| `npm test` | Pruebas con Jest |
| `npm run test:coverage` | Pruebas con cobertura (genera `coverage/lcov.info`, que lee SonarCloud) |
| `npm run format` | Prettier sobre el código |
| `npx expo export -p web` | Exportación estática de la web en `dist/` |

## Estructura

```
app/          pantallas y rutas (Expo Router)
components/   componentes; components/ui viene de React Native Reusables
lib/          utilidades y tema
__tests__/    pruebas
global.css    variables de color de la paleta, con modo oscuro según el sistema
```

Para agregar un componente de Reusables: `npx @react-native-reusables/cli@latest add <nombre>`. Se copia a `components/ui` y queda bajo control del proyecto.

## Paleta y modo oscuro

La paleta es `#FFFFFF`, `#FFD300`, `#757B81`, `#262B32` y `#090C11`. Los colores están como variables en `global.css` y el modo oscuro sigue la configuración del sistema (`prefers-color-scheme`). Si se cambia un color, hay que actualizarlo también en `lib/theme.ts`, que alimenta la navegación.

## Integración continua

El workflow de `.github/workflows/ci.yml` corre `npm ci`, lint, pruebas con cobertura, `npm audit --omit=dev --audit-level=critical` y el análisis de SonarCloud.

## Flujo de trabajo

GitFlow: ramas `feature/`, `fix/` y `release/` desde `develop`, nunca directo sobre `main`. Commits en español con Conventional Commits. El detalle está en [CONTRIBUTING.md](./CONTRIBUTING.md).

[CLAUDE.md](./CLAUDE.md) tiene el contexto completo de desarrollo: decisiones de UX, requisitos no funcionales y el flujo de trabajo con Claude Code. La documentación del proyecto (Charter, requisitos, ADR, EDT y diseño técnico) está en `../docs`, fuera de este repositorio.
