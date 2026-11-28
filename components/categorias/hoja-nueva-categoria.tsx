import { HojaCategoria } from '@/components/categorias/hoja-categoria';
import { crearCategoria, type Categoria, type TipoMovimiento } from '@/lib/api/categorias';
import { leerNombre, mensajeAlGuardarCategoria } from '@/lib/categorias';
import { claveGastada, esApi } from '@/lib/errores';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';

type Props = {
  tipo: TipoMovimiento;
  onCerrar: () => void;
  /** La categoría que devolvió el backend (puede venir normalizada). */
  onCreada: (categoria: Categoria) => void;
};

/** Hoja "Nueva categoría": el tipo lo fija el selector desde el que se abre, solo se pide el nombre. */
export function HojaNuevaCategoria({ tipo, onCerrar, onCreada }: Props) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón
  const enVuelo = useRef(false);
  // Clave de la acción en curso: se reutiliza al reintentar y se renueva si cambia el nombre
  const intento = useRef<{ nombre: string; clave: string } | null>(null);

  async function guardar() {
    if (enVuelo.current) return;
    const lectura = leerNombre(nombre);
    if ('error' in lectura) return setError(lectura.error);
    const limpio = lectura.datos.nombre;
    if (intento.current?.nombre !== limpio)
      intento.current = { nombre: limpio, clave: randomUUID() };
    enVuelo.current = true;
    setError(null);
    setGuardando(true);
    try {
      onCreada(await crearCategoria({ nombre: limpio, tipo }, intento.current.clave));
    } catch (e) {
      if (claveGastada(e)) intento.current = null;
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      if (!esApi(e, 401)) setError(mensajeAlGuardarCategoria(e));
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  return (
    <HojaCategoria
      titulo="Nueva categoría"
      tipo={tipo}
      nombre={nombre}
      onCambiarNombre={(t) => {
        setNombre(t);
        setError(null);
      }}
      aviso={error}
      guardando={guardando}
      onGuardar={() => {
        void guardar();
      }}
      onCerrar={onCerrar}
    />
  );
}
