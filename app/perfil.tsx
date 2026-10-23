import { DialogoEliminarCuenta } from '@/components/dialogo-eliminar-cuenta';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ApiError, NetworkError } from '@/lib/api/client';
import type { Usuario } from '@/lib/api/auth';
import { eliminarCuenta, obtenerPerfil } from '@/lib/api/usuarios';
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
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorAlEliminar, setErrorAlEliminar] = useState<string | null>(null);

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

  function cerrarDialogo() {
    setDialogoAbierto(false);
    setErrorAlEliminar(null);
  }

  async function confirmarEliminacion() {
    setErrorAlEliminar(null);
    setEliminando(true);
    try {
      await eliminarCuenta();
      // Cuenta eliminada: el JWT ya no sirve, así que se borra la sesión local y la app vuelve al login
      await cerrarSesion();
    } catch (e) {
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      if (e instanceof ApiError && e.status === 401) return;
      setErrorAlEliminar('No pudimos eliminar tu cuenta. Inténtalo de nuevo en unos minutos.');
      setEliminando(false);
    }
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

          <View className="mt-12 w-full">
            <Text className="text-xs font-semibold">Zona de peligro</Text>
            <Text variant="muted" className="mt-1 text-xs">
              Eliminar tu cuenta borra para siempre todos tus movimientos, tarjetas, préstamos,
              presupuesto, categorías y metas.
            </Text>
            <Button
              variant="outline"
              className="mt-3 h-[50px] w-full"
              onPress={() => setDialogoAbierto(true)}
            >
              <Text className="font-semibold">Eliminar mi cuenta</Text>
            </Button>
          </View>
        </View>
      )}

      {dialogoAbierto ? (
        <DialogoEliminarCuenta
          eliminando={eliminando}
          error={errorAlEliminar}
          onCancelar={cerrarDialogo}
          onConfirmar={() => {
            void confirmarEliminacion();
          }}
        />
      ) : null}
    </View>
  );
}
