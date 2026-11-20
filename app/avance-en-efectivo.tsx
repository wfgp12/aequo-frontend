import { FlujoAvance } from '@/components/registro/flujo-avance';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

/**
 * Avance en efectivo (wireframe "Registro — Avance en efectivo", de Figma): dinero que se saca con una tarjeta y se
 * paga en cuotas. Se entra desde "Mis tarjetas" y, al terminar, se vuelve a ella.
 */
export default function AvanceEnEfectivo() {
  const router = useRouter();

  function cerrar() {
    if (router.canGoBack()) router.back();
    else router.replace('/tarjetas');
  }

  return (
    <View className="flex-1 bg-background px-5 pb-6 pt-12">
      <View className="w-full max-w-[420px] flex-1 self-center">
        <FlujoAvance onCerrar={cerrar} />
      </View>
    </View>
  );
}
