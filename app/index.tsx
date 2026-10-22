import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { Link } from 'expo-router';
import { View } from 'react-native';

// Vista principal provisional: confirma la sesión activa hasta que existan el dashboard y el registro.
// El acceso al perfil es provisional hasta que exista el menú "Más" del diseño.
export default function Home() {
  const { sesion } = useSession();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background p-6">
      <Text variant="h1">Aequo</Text>
      <Text variant="muted">Hola, {sesion?.usuario.nombre}</Text>
      <Link href="/perfil" asChild>
        <Button variant="outline">
          <Text>Mi perfil</Text>
        </Button>
      </Link>
    </View>
  );
}
