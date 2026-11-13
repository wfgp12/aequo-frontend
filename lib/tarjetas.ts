import type { CargoFijo, DatosCargo, DatosTarjeta, Tarjeta } from '@/lib/api/tarjetas';
import { formatearPesos } from '@/lib/dinero';
import { esApi, mensajeDeFallo } from '@/lib/errores';
import { fraccionAPorcentaje, porcentajeAFraccion } from '@/lib/tasa';
import type { Fallo } from '@/lib/use-lista-remota';
import type { Lectura } from '@/lib/use-guardar-hoja';

// Reglas de presentación de las pantallas de tarjetas y cargos fijos: qué se valida antes de llamar al backend y
// cómo se le explica cada fallo al usuario en lenguaje cotidiano (RNF-04). No calcula nada (RNF-11).

const MAX_ALIAS = 50;
const MAX_DESCRIPCION = 100;

/** "Tasa 29,21 % E.A." */
export const textoDeTasa = (tasaEA: number) => `Tasa ${fraccionAPorcentaje(tasaEA)} % E.A.`;

/** "$ 45.000 al mes" */
export const textoAlMes = (valor: number) => `$ ${formatearPesos(valor)} al mes`;

/** Lo que el formulario de la tarjeta muestra al abrirse: vacío para una nueva, lo guardado para una existente. */
export const camposDeTarjeta = (tarjeta: Tarjeta | null) => ({
  alias: tarjeta?.nombre ?? '',
  tasa: tarjeta ? fraccionAPorcentaje(tarjeta.tasaEA) : '',
  cuotaUnica: tarjeta?.cuotaUnicaSinInteres ?? false,
});

/** Lo que el formulario del cargo muestra al abrirse: el valor en pesos enteros, solo dígitos; un cargo nuevo empieza activo. */
export const camposDeCargo = (cargo: CargoFijo | null) => ({
  descripcion: cargo?.descripcion ?? '',
  valor: cargo ? String(Math.round(cargo.valor)) : '',
  activo: cargo?.activo ?? true,
});

/** Lo escrito en el formulario de la tarjeta (la tasa como porcentaje) convertido a lo que recibe la API. */
export function leerTarjeta(
  alias: string,
  tasa: string,
  cuotaUnica: boolean,
): Lectura<DatosTarjeta> {
  const nombre = alias.trim();
  if (nombre === '') return { error: 'Escribe un alias para tu tarjeta.' };
  if (nombre.length > MAX_ALIAS) return { error: 'El alias no puede tener más de 50 caracteres.' };
  const tasaEA = porcentajeAFraccion(tasa);
  if (tasaEA === null)
    return { error: 'Escribe la tasa de interés. Si tu tarjeta no cobra intereses, escribe 0.' };
  if (tasaEA > 1) return { error: 'La tasa no puede pasar de 100.' };
  return { datos: { nombre, tasaEA, cuotaUnicaSinInteres: cuotaUnica } };
}

/** Lo escrito en el formulario del cargo fijo (el valor, en pesos enteros) convertido a lo que recibe la API. */
export function leerCargo(
  descripcion: string,
  valor: string,
  activo: boolean,
): Lectura<DatosCargo> {
  const texto = descripcion.trim();
  if (texto === '') return { error: 'Escribe una descripción para el cargo.' };
  if (texto.length > MAX_DESCRIPCION)
    return { error: 'La descripción no puede tener más de 100 caracteres.' };
  if (!(Number(valor) > 0)) return { error: 'Escribe un valor mayor que cero.' };
  return { datos: { descripcion: texto, valor: Number(valor), activo } };
}

/** Solo los campos que cambiaron: el backend rechaza un PATCH vacío y así la tasa guardada nunca se reenvía. */
export function soloLoCambiado<D extends object>(actual: D, nuevos: D): Partial<D> {
  return Object.fromEntries(
    Object.entries(nuevos).filter(([campo, valor]) => valor !== actual[campo as keyof D]),
  ) as Partial<D>;
}

// --- Cómo se explica cada fallo ---

export const mensajeAlGuardarTarjeta = (e: unknown, editando: boolean) => {
  if (esApi(e, 409)) return 'Ya tienes una tarjeta con ese alias. Elige otro.';
  if (editando && esApi(e, 404)) return 'Esta tarjeta ya no existe.';
  return mensajeDeFallo(e, 'No pudimos guardar tu tarjeta. Revisa los datos e inténtalo de nuevo.');
};

export const mensajeAlGuardarCargo = (e: unknown, editando: boolean) => {
  if (esApi(e, 404))
    return editando ? 'Este cargo fijo ya no existe.' : 'Esta tarjeta ya no existe.';
  return mensajeDeFallo(
    e,
    'No pudimos guardar el cargo fijo. Revisa los datos e inténtalo de nuevo.',
  );
};

export const mensajeAlEliminarTarjeta = (e: unknown) =>
  esApi(e, 409)
    ? 'Esta tarjeta ya tiene pagos registrados y no se puede eliminar.'
    : mensajeDeFallo(e, 'No pudimos eliminar tu tarjeta. Inténtalo de nuevo en unos minutos.');

export const mensajeAlEliminarCargo = (e: unknown) =>
  mensajeDeFallo(e, 'No pudimos eliminar el cargo fijo. Inténtalo de nuevo en unos minutos.');

export const fallosDeTarjetas = (e: unknown): Fallo => ({
  mensaje: mensajeDeFallo(e, 'No pudimos cargar tus tarjetas. Inténtalo de nuevo en unos minutos.'),
  reintentar: true,
});

export const fallosDeCargos = (e: unknown): Fallo =>
  esApi(e, 404)
    ? { mensaje: 'Esta tarjeta ya no existe.', reintentar: false }
    : {
        mensaje: mensajeDeFallo(
          e,
          'No pudimos cargar los cargos fijos. Inténtalo de nuevo en unos minutos.',
        ),
        reintentar: true,
      };
