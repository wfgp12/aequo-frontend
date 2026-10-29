import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { Link } from 'expo-router';
import { View } from 'react-native';

// Vista principal provisional: confirma la sesión activa hasta que existan el dashboard y la barra de navegación.
// Los accesos a registrar y al perfil son provisionales hasta que existan el botón "+" y el menú "Más" del diseño.
export default function Home() {
  const { sesion } = useSession();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background p-6">
      <Text variant="h1">Aequo</Text>
      <Text variant="muted">Hola, {sesion?.usuario.nombre}</Text>
      <View className="w-full max-w-[320px] gap-3">
        <Link href={{ pathname: '/registrar', params: { tipo: 'INGRESO' } }} asChild>
          <Button className="h-[50px] w-full">
            <Text className="font-semibold">Registrar ingreso</Text>
          </Button>
        </Link>
        <Link href={{ pathname: '/registrar', params: { tipo: 'EGRESO' } }} asChild>
          <Button variant="secondary" className="h-[50px] w-full">
            <Text className="font-semibold">Registrar egreso</Text>
          </Button>
        </Link>
        <Link href="/movimientos" asChild>
          <Button variant="outline">
            <Text>Movimientos</Text>
          </Button>
        </Link>
        <Link href="/perfil" asChild>
          <Button variant="outline">
            <Text>Mi perfil</Text>
          </Button>
        </Link>
      </View>
    </View>
  );
}
