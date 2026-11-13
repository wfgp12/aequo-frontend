import type { CargoFijo, Tarjeta } from '@/lib/api/tarjetas';

// Datos y servidor en memoria para las pruebas de las pantallas de tarjetas y cargos fijos
// (criterios/05-tarjetas-pantallas.md). Los adaptadores se simulan con estas funciones: así las pruebas solo miran
// lo que ve el usuario, sin importar si la pantalla recarga la lista o la actualiza.

const FECHAS = { creadaEn: '2026-09-17T15:00:00.000Z', actualizadaEn: '2026-09-17T15:00:00.000Z' };

export const VISA_ID = '66a0b3c4d5e6f70012ab34cd';
export const AMEX_ID = '66a0b3c4d5e6f70012ab34ce';

export const VISA: Tarjeta = {
  id: VISA_ID,
  nombre: 'Visa Bancolombia',
  tasaEA: 0.2921,
  cuotaUnicaSinInteres: true,
  ...FECHAS,
};
export const AMEX: Tarjeta = {
  id: AMEX_ID,
  nombre: 'Amex',
  tasaEA: 0.2421,
  cuotaUnicaSinInteres: false,
  ...FECHAS,
};

export const NETFLIX: CargoFijo = {
  id: 'cargo-1',
  tarjetaId: VISA_ID,
  descripcion: 'Netflix',
  valor: 45000,
  activo: true,
  ...FECHAS,
};
export const SPOTIFY: CargoFijo = {
  id: 'cargo-2',
  tarjetaId: VISA_ID,
  descripcion: 'Spotify',
  valor: 25000,
  activo: true,
  ...FECHAS,
};
export const GIMNASIO: CargoFijo = {
  id: 'cargo-3',
  tarjetaId: VISA_ID,
  descripcion: 'Gimnasio',
  valor: 90000,
  activo: false,
  ...FECHAS,
};

const porNombre = (a: Tarjeta, b: Tarjeta) => {
  const x = a.nombre.trim().toLowerCase();
  const y = b.nombre.trim().toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Servidor de tarjetas en memoria: lo que la pantalla guarda o elimina es lo que la lista vuelve a mostrar. */
export function crearServidorDeTarjetas(inicial: Tarjeta[]) {
  const servidor = {
    items: inicial.map((t) => ({ ...t })) as Tarjeta[],
    ordenadas: (): Tarjeta[] => [...servidor.items].sort(porNombre).map((t) => ({ ...t })),
    listar: async (): Promise<Tarjeta[]> => servidor.ordenadas(),
    crear: async (
      datos: Pick<Tarjeta, 'nombre' | 'tasaEA' | 'cuotaUnicaSinInteres'>,
    ): Promise<Tarjeta> => {
      const nueva: Tarjeta = { id: `nueva-${servidor.items.length + 1}`, ...datos, ...FECHAS };
      servidor.items.push(nueva);
      return { ...nueva };
    },
    actualizar: async (id: string, cambios: Partial<Tarjeta>): Promise<Tarjeta> => {
      const i = servidor.items.findIndex((t) => t.id === id);
      servidor.items[i] = { ...servidor.items[i], ...cambios };
      return { ...servidor.items[i] };
    },
    eliminar: async (id: string): Promise<void> => {
      servidor.items = servidor.items.filter((t) => t.id !== id);
    },
  };
  return servidor;
}

/** Servidor de cargos fijos en memoria (los cargos salen en el orden en que se crearon). */
export function crearServidorDeCargos(inicial: CargoFijo[]) {
  const servidor = {
    items: inicial.map((c) => ({ ...c })) as CargoFijo[],
    listar: async (): Promise<CargoFijo[]> => servidor.items.map((c) => ({ ...c })),
    crear: async (
      tarjetaId: string,
      datos: Pick<CargoFijo, 'descripcion' | 'valor' | 'activo'>,
    ): Promise<CargoFijo> => {
      const nuevo: CargoFijo = {
        id: `nuevo-${servidor.items.length + 1}`,
        tarjetaId,
        ...datos,
        ...FECHAS,
      };
      servidor.items.push(nuevo);
      return { ...nuevo };
    },
    actualizar: async (
      _tarjetaId: string,
      id: string,
      cambios: Partial<CargoFijo>,
    ): Promise<CargoFijo> => {
      const i = servidor.items.findIndex((c) => c.id === id);
      servidor.items[i] = { ...servidor.items[i], ...cambios };
      return { ...servidor.items[i] };
    },
    eliminar: async (_tarjetaId: string, id: string): Promise<void> => {
      servidor.items = servidor.items.filter((c) => c.id !== id);
    },
  };
  return servidor;
}
