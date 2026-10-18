import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { View } from 'react-native';

// Vista principal provisional: confirma la sesión activa hasta que existan el dashboard y el registro.
export default function Home() {
  const { sesion, cerrarSesion } = useSession();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background p-6">
      <Text variant="h1">Aequo</Text>
      <Text variant="muted">Hola, {sesion?.usuario.nombre}</Text>
      <Button variant="outline" onPress={cerrarSesion}>
        <Text>Cerrar sesión</Text>
      </Button>
    </View>
  );
}
