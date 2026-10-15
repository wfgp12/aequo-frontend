import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useState } from 'react';
import { View } from 'react-native';

export default function Home() {
  const [toques, setToques] = useState(0);

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background p-4">
      <Text variant="h1">Aequo</Text>
      <Text variant="muted">El equilibrio de tus finanzas personales</Text>
      <Button onPress={() => setToques(toques + 1)}>
        <Text>Tocaste {toques} veces</Text>
      </Button>
    </View>
  );
}
