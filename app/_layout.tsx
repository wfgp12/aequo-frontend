import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { SessionProvider, useSession } from '@/lib/session';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, View } from 'react-native';

export { ErrorBoundary } from 'expo-router';

function Navegacion() {
  const { estado } = useSession();

  // Mientras se lee la sesión guardada, un indicador de carga evita mostrar el login por un instante (RNF-02)
  if (estado === 'cargando') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={estado === 'activa'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="registrar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="movimientos" />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'sin-sesion'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <SessionProvider>
        <Navegacion />
      </SessionProvider>
      <PortalHost />
    </ThemeProvider>
  );
}
