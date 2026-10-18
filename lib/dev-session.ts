// La sesión de prueba solo existe en desarrollo. __DEV__ es false en los bundles de producción,
// y el backend además responde 404 en /auth/dev-login salvo con DEV_SESSION_ENABLED=true (ADR-011).
export const sesionDePruebaDisponible = () => __DEV__;
