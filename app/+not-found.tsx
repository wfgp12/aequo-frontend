import { Text } from '@/components/ui/text';
import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Pantalla no encontrada' }} />
      <View className="flex-1 items-center justify-center gap-4 bg-background p-4">
        <Text>Esta pantalla no existe.</Text>
        <Link href="/">
          <Text variant="muted">Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}
