import { FlujoRegistro } from '@/components/registro/flujo-registro';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

/**
 * Registro guiado en cinco pasos (wireframe "Registrar egreso", de Figma): valor, categoría, método de pago,
 * fecha y nota con resumen. El tipo lo fija el botón con el que se entra (/registrar?tipo=INGRESO|EGRESO).
 */
export default function Registrar() {
  const router = useRouter();
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();

  // Sin un tipo válido no se sabe si es ingreso o egreso: se vuelve al inicio en lugar de adivinar
  if (tipo !== 'INGRESO' && tipo !== 'EGRESO') return <Redirect href="/" />;

  function cerrar() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View className="flex-1 bg-background px-5 pb-6 pt-12">
      <View className="w-full max-w-[420px] flex-1 self-center">
        <FlujoRegistro tipo={tipo} onCerrar={cerrar} />
      </View>
    </View>
  );
}
