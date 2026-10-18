import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
function mensajeDeError(e: unknown) {
  if (e instanceof NetworkError)
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (e instanceof ApiError && e.status === 401)
    return 'No pudimos verificar tu cuenta. Inténtalo de nuevo.';
  return 'No pudimos iniciar tu sesión. Inténtalo de nuevo en unos minutos.';
}

export default function Login() {
  const { iniciarSesion } = useSession();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuarConGoogle() {
    setError(null);
    setCargando(true);
    try {
      await iniciarSesion();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background p-6">
      <Text variant="h1">Aequo</Text>
      <Text variant="muted">El equilibrio de tus finanzas personales</Text>
      <Button
        onPress={continuarConGoogle}
        disabled={cargando}
        accessibilityLabel="Continuar con Google"
      >
        {cargando ? <ActivityIndicator /> : <Text>Continuar con Google</Text>}
      </Button>
      {error ? (
        <Text variant="muted" role="alert" className="text-center text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
