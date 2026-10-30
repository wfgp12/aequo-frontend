// Bajo jest-expo el módulo nativo de expo-crypto no genera UUID; se usa el de Node para que las claves sean reales
module.exports = { randomUUID: () => require('node:crypto').randomUUID() };
