import * as SecureStore from 'expo-secure-store';

const KEY = 'aequo.sesion';

// Nativo: Keychain/Keystore. La versión web está en session-storage.web.ts.
export const sessionStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (value: string) => SecureStore.setItemAsync(KEY, value),
  remove: () => SecureStore.deleteItemAsync(KEY),
};
