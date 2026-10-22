import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { NetworkError } from '@/lib/api/client';
import type { Usuario } from '@/lib/api/auth';
import { obtenerPerfil } from '@/lib/api/usuarios';
import { useSession } from '@/lib/session';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
function mensajeDeError(e: unknown) {
  return e instanceof NetworkError
    ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    : 'No pudimos cargar tu perfil. Inténtalo de nuevo en unos minutos.';
}

function Foto({ usuario }: { usuario: Usuario }) {
  if (usuario.fotoUrl) {
    return (
      <Image
        source={{ uri: usuario.fotoUrl }}
        accessibilityLabel="Tu foto de perfil"
        className="size-[72px] rounded-full bg-muted"
      />
    );
  }
  return (
    <View className="size-[72px] items-center justify-center rounded-full bg-muted">
      <Text className="text-2xl font-semibold">{usuario.nombre.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// Wireframe "Perfil" de Figma. Quedan fuera por ahora "Miembro desde" y "Movimientos registrados" (el backend aún
// no los entrega), "Seguridad social" (otro módulo) y la zona de peligro (eliminar cuenta es el paquete 1.3.4).
export default function Perfil() {
  const router = useRouter();
  const { cerrarSesion } = useSession();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerPerfil()
      .then((u) => {
        if (vigente) setUsuario(u);
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  function reintentar() {
    setError(null);
    setCargando(true);
    setIntento((n) => n + 1);
  }

  return (
    <View className="flex-1 bg-background px-5 pt-12">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text className="text-2xl">‹</Text>
        </Pressable>
        <Text variant="large">Perfil</Text>
      </View>

      {cargando ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Cargando tu perfil" />
        </View>
      ) : error || !usuario ? (
        <View className="flex-1 items-center justify-center gap-4">
          <Text variant="muted" role="alert" className="text-center">
            {error}
          </Text>
          <Button variant="outline" onPress={reintentar}>
            <Text>Reintentar</Text>
          </Button>
        </View>
      ) : (
        <View className="mt-8 w-full max-w-[360px] items-center self-center">
          <Foto usuario={usuario} />
          <Text variant="large" className="mt-4">
            {usuario.nombre}
          </Text>
          <Text variant="muted" className="mt-1">
            {usuario.email}
          </Text>

          <View className="mt-8 w-full rounded-xl border border-border bg-card px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text variant="muted">Inicio de sesión</Text>
              <Text className="font-semibold">Google</Text>
            </View>
          </View>
          <Text variant="muted" className="mt-3 w-full text-xs">
            Tu nombre y foto vienen de tu cuenta de Google.
          </Text>

          <Button
            variant="outline"
            className="mt-10 h-[50px] w-full"
            onPress={() => {
              void cerrarSesion();
            }}
          >
            <Text className="font-semibold">Cerrar sesión</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
