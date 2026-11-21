import { act } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

// `expo-router` simulado para las pruebas del detalle de la tarjeta y de "Mis tarjetas"
// (criterios/05-detalle-de-tarjeta.md, "Convención de las pruebas"): `useRouter` (`back`, `push`),
// `useLocalSearchParams` y `useFocusEffect`, que ejecuta el efecto al montar la pantalla y permite volver a
// dispararlo con `volverAlFoco()` para simular "volver a la pantalla". No son pruebas: Jest solo corre los
// archivos *.test.ts(x). Cada archivo de prueba lo instala con:
//   jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());

export const router = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() };

export const parametros: Record<string, string | undefined> = {};

/** Los parámetros de la ruta de la pantalla que se va a mostrar (por ejemplo `{ id, nombre }`). */
export function usarParametros(nuevos: Record<string, string | undefined>) {
  Object.keys(parametros).forEach((clave) => delete parametros[clave]);
  Object.assign(parametros, nuevos);
}

const pantallas = new Set<() => void>();

/** Como el de `expo-router`: el efecto corre al montar y cada vez que la pantalla recupera el foco. */
export function useFocusEffectSimulado(efecto: () => void | (() => void)) {
  const [vez, setVez] = useState(0);
  useEffect(() => {
    const recuperarFoco = () => setVez((v) => v + 1);
    pantallas.add(recuperarFoco);
    return () => {
      pantallas.delete(recuperarFoco);
    };
  }, []);
  // Igual que el real: si el efecto cambia en cada render (no está memorizado), se repite en cada render
  useEffect(() => efecto(), [efecto, vez]);
}

/** Las pantallas montadas recuperan el foco (el usuario vuelve a ellas desde otra pantalla). */
export const volverAlFoco = () =>
  act(async () => {
    pantallas.forEach((recuperarFoco) => recuperarFoco());
  });

export const expoRouterSimulado = () => ({
  useRouter: () => router,
  useLocalSearchParams: () => parametros,
  useFocusEffect: useFocusEffectSimulado,
});

export function reiniciarRouter() {
  Object.values(router).forEach((f) => f.mockReset());
  usarParametros({});
}
