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

// Medidas del wireframe "Inicio de sesión" de Figma (360×760): logo de 72 px, botón de 50 px de alto y margen de 28 px.
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
    <View className="flex-1 items-center justify-center bg-background px-7">
      <View className="w-full max-w-[360px] items-center">
        {/* ponytail: cuadrado de reemplazo del logo, igual que en el wireframe; cambiar por el logo final cuando exista */}
        <View className="size-[72px] rounded-2xl bg-secondary" />
        <Text variant="h1" className="mt-4">
          Aequo
        </Text>
        <Text variant="muted" className="mt-4 text-center">
          Tus finanzas claras, sin hojas de cálculo.
        </Text>

        <View className="mt-36 w-full">
          <Button
            variant="outline"
            className="h-[50px] w-full"
            onPress={continuarConGoogle}
            disabled={cargando}
            accessibilityLabel="Continuar con Google"
          >
            {cargando ? (
              <ActivityIndicator />
            ) : (
              <>
                {/* ponytail: la "G" reemplaza al icono de Google del wireframe hasta tener el icono oficial */}
                <View className="size-5 items-center justify-center rounded-full bg-muted">
                  <Text className="text-xs font-bold">G</Text>
                </View>
                <Text className="font-semibold">Continuar con Google</Text>
              </>
            )}
          </Button>
          <Text variant="muted" className="mt-4 text-center text-xs">
            Al continuar aceptas el tratamiento de tus datos.
          </Text>
        </View>

        {error ? (
          <Text variant="muted" role="alert" className="mt-4 text-center text-destructive">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
