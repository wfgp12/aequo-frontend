import type {
  CargoFijo,
  CuotaPrevia,
  DatosCargo,
  DatosPago,
  DatosTarjeta,
  PagoTarjeta,
  ProyeccionTarjeta,
  Tarjeta,
} from '@/lib/api/tarjetas';
import type { MetodoPago } from '@/lib/api/transacciones';
import { formatearPesos } from '@/lib/dinero';
import {
  esCaso,
  mensajeAlCambiar,
  mensajeDeFallo,
  textoEnProceso,
  tieneCodigo,
  yaNoExiste,
} from '@/lib/errores';
import { fechaCorta, mesActual, mesEnLetras } from '@/lib/fechas';
import { ETIQUETA_METODO } from '@/lib/movimientos';
import { fraccionAPorcentaje, porcentajeAFraccion } from '@/lib/tasa';
import type { Fallo } from '@/lib/use-lista-remota';
import type { Lectura } from '@/lib/use-guardar-hoja';

// Reglas de presentación de las pantallas de tarjetas y cargos fijos: qué se valida antes de llamar al backend y
// cómo se le explica cada fallo al usuario en lenguaje cotidiano (RNF-04). No calcula nada (RNF-11).

const MAX_ALIAS = 50;
const MAX_DESCRIPCION = 100;

/** "Tasa 29,21 % E.A." */
export const textoDeTasa = (tasaEA: number) => `Tasa ${fraccionAPorcentaje(tasaEA)} % E.A.`;

/** El encabezado del detalle: el nombre de la ruta se ve al instante y el de la tarjeta lo reemplaza al llegar. */
export const encabezadoDeTarjeta = (tarjeta: Tarjeta | null, nombreDeLaRuta?: string) => ({
  titulo: tarjeta?.nombre ?? (nombreDeLaRuta || 'Tarjeta'),
  subtitulo: tarjeta ? textoDeTasa(tarjeta.tasaEA) : undefined,
});

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
  if (tieneCodigo(e, 'IDEMPOTENCIA_EN_PROCESO')) return textoEnProceso('tarjeta');
  if (esCaso(e, 409, 'TARJETA_DUPLICADA'))
    return 'Ya tienes una tarjeta con ese alias. Elige otro.';
  if (editando && esCaso(e, 404, 'TARJETA_NO_ENCONTRADA')) return 'Esta tarjeta ya no existe.';
  return mensajeAlCambiar(
    e,
    'No pudimos guardar tu tarjeta. Revisa los datos e inténtalo de nuevo.',
  );
};

export const mensajeAlGuardarCargo = (e: unknown, editando: boolean) => {
  if (tieneCodigo(e, 'IDEMPOTENCIA_EN_PROCESO')) return textoEnProceso('cargo fijo');
  if (tieneCodigo(e, 'TARJETA_NO_ENCONTRADA')) return 'Esta tarjeta ya no existe.';
  // Sin `code`, al editar lo que falta es el cargo y al crear, la tarjeta
  if (esCaso(e, 404, 'CARGO_NO_ENCONTRADO'))
    return editando ? 'Este cargo fijo ya no existe.' : 'Esta tarjeta ya no existe.';
  return mensajeAlCambiar(
    e,
    'No pudimos guardar el cargo fijo. Revisa los datos e inténtalo de nuevo.',
  );
};

export const mensajeAlEliminarTarjeta = (e: unknown) =>
  esCaso(e, 409, 'TARJETA_CON_COMPRAS', 'TARJETA_CON_PAGOS')
    ? 'Esta tarjeta ya tiene compras o pagos registrados y no se puede eliminar.'
    : mensajeAlCambiar(e, 'No pudimos eliminar tu tarjeta. Inténtalo de nuevo en unos minutos.');

export const mensajeAlEliminarCargo = (e: unknown) =>
  mensajeAlCambiar(e, 'No pudimos eliminar el cargo fijo. Inténtalo de nuevo en unos minutos.');

export const fallosDeTarjetas = (e: unknown): Fallo => ({
  mensaje: mensajeDeFallo(e, 'No pudimos cargar tus tarjetas. Inténtalo de nuevo en unos minutos.'),
  reintentar: true,
});

// --- Compra con tarjeta y avance en efectivo: lo que se elige, se muestra y se explica ---

export const MAX_CUOTAS = 60;
export const NOTA_DE_LA_CUOTA =
  'Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar.';
export const ACLARACION_DINERO_RECIBIDO =
  'Este dinero entra como dinero recibido: no cuenta como ingreso propio.';
const TARJETA_YA_NO_EXISTE = 'Esta tarjeta ya no existe. Vuelve atrás y elige otra.';

/** Cuántas cuotas y desde qué mes se paga la primera (YYYY-MM). `otra`: el número se escribe en vez de elegirse. */
export type EleccionDeCuotas = { cuotas: string; otra: boolean; primerPago: string };

/** Lo que el usuario va eligiendo de la tarjeta, más la estimación vigente que el backend dio para ello. */
export type EleccionDeTarjeta = EleccionDeCuotas & {
  tarjeta: Tarjeta | null;
  previa: CuotaPrevia | null;
};

/** Una cuota y el mes de hoy como primer pago; el usuario lo cambia. */
export const eleccionInicial = (): EleccionDeTarjeta => ({
  tarjeta: null,
  cuotas: '1',
  otra: false,
  primerPago: mesActual(),
  previa: null,
});

/** Las cuotas escritas (solo dígitos) como número de 1 a 60; null si falta o se sale del rango. */
export function leerCuotas(texto: string): number | null {
  const n = Number(texto);
  return n >= 1 && n <= MAX_CUOTAS ? n : null;
}

/** "1 cuota", "12 cuotas" */
export const textoDeCuotas = (cuotas: number) => (cuotas === 1 ? '1 cuota' : `${cuotas} cuotas`);

/** "en 1 cuota de $ 80.000" o "a 12 cuotas de $ 119.802": la cuota se redondea al peso solo al mostrarla. */
export const textoDeCuotaDe = (cuotas: number, cuota: number) =>
  `${cuotas === 1 ? 'en' : 'a'} ${textoDeCuotas(cuotas)} de $ ${formatearPesos(cuota)}`;

/** Las filas del resumen que son de la tarjeta; todo sale del backend, el mes del último pago incluido. */
export function filasDeTarjeta({ tarjeta, cuotas, primerPago, previa }: EleccionDeTarjeta) {
  if (!tarjeta || !previa) return [];
  return [
    { etiqueta: 'Tarjeta', valor: tarjeta.nombre },
    { etiqueta: 'Cuotas', valor: textoDeCuotas(Number(cuotas)) },
    { etiqueta: 'Cuota estimada', valor: `$ ${formatearPesos(previa.cuota)}` },
    { etiqueta: 'Primer pago', valor: mesEnLetras(primerPago) },
    { etiqueta: 'Último pago', valor: mesEnLetras(previa.mesUltimoPago) },
  ];
}

/** El 409 es el primer intento todavía en proceso con la misma clave; el `code` del 404 dice qué ya no existe. */
export function mensajeAlGuardarCompra(e: unknown, cosa: 'compra' | 'avance' | 'pago') {
  if (esCaso(e, 409, 'IDEMPOTENCIA_EN_PROCESO')) return textoEnProceso(cosa);
  if (tieneCodigo(e, 'TARJETA_NO_ENCONTRADA')) return TARJETA_YA_NO_EXISTE;
  if (tieneCodigo(e, 'CATEGORIA_NO_ENCONTRADA')) {
    return 'Esta categoría ya no existe. Vuelve atrás y elige otra.';
  }
  // Sin `code` no se sabe qué falta: en la compra puede ser la tarjeta o la categoría
  if (esCaso(e, 404)) {
    return cosa === 'compra'
      ? 'La tarjeta o la categoría que elegiste ya no existe. Vuelve atrás y elige otra.'
      : TARJETA_YA_NO_EXISTE;
  }
  return mensajeAlCambiar(
    e,
    `No pudimos guardar tu ${cosa}. Revisa los datos e inténtalo de nuevo.`,
  );
}

/** Repetir la consulta no ayuda si la tarjeta ya no existe; en los demás fallos sí. */
export const fallosDeCuotaPrevia = (e: unknown): Fallo =>
  yaNoExiste(e)
    ? { mensaje: TARJETA_YA_NO_EXISTE, reintentar: false }
    : {
        mensaje: mensajeDeFallo(e, 'No pudimos calcular tu cuota. Inténtalo de nuevo.'),
        reintentar: true,
      };

/** Repetir la consulta no ayuda si la tarjeta ya no existe; en los demás fallos sí. */
const fallosDeUnaTarjeta =
  (general: string) =>
  (e: unknown): Fallo =>
    yaNoExiste(e)
      ? { mensaje: 'Esta tarjeta ya no existe.', reintentar: false }
      : { mensaje: mensajeDeFallo(e, general), reintentar: true };

export const fallosDeCargos = fallosDeUnaTarjeta(
  'No pudimos cargar los cargos fijos. Inténtalo de nuevo en unos minutos.',
);

export const fallosDeDetalle = fallosDeUnaTarjeta(
  'No pudimos cargar tu tarjeta. Inténtalo de nuevo en unos minutos.',
);

// --- Pagos de la tarjeta: lo que se escribe, se muestra y se explica ---

/** Lo escrito en la hoja "Nuevo pago": el valor en pesos enteros; la nota solo viaja si trae algo (con `null` el backend da 400). */
export function leerPago(
  valor: string,
  fecha: string,
  metodoPago: MetodoPago,
  nota: string,
): Lectura<DatosPago> {
  if (!(Number(valor) > 0)) return { error: 'Escribe un valor mayor que cero.' };
  const descripcion = nota.trim();
  return {
    datos: { valor: Number(valor), fecha, metodoPago, ...(descripcion ? { descripcion } : {}) },
  };
}

/** El valor con que empieza la hoja: el total estimado de hoy, redondeado al peso; en otro mes, o sin cifras, vacío. */
export function valorSugeridoDelPago(proyeccion: ProyeccionTarjeta | null) {
  if (proyeccion?.mes !== mesActual()) return '';
  const pesos = Math.round(proyeccion.total);
  return pesos > 0 ? String(pesos) : '';
}

/** "Te falta pagar $ X", "Pagaste de más $ X" o "Pagaste justo lo estimado" (menos de medio peso cuenta como justo). */
export function textoDeDiferencia(diferencia: number) {
  const pesos = formatearPesos(Math.abs(diferencia));
  if (pesos === '0') return 'Pagaste justo lo estimado';
  return diferencia < 0 ? `Te falta pagar $ ${pesos}` : `Pagaste de más $ ${pesos}`;
}

export const mensajeAlGuardarPago = (e: unknown) =>
  esCaso(e, 404, 'TARJETA_NO_ENCONTRADA')
    ? 'Esta tarjeta ya no existe.'
    : mensajeAlGuardarCompra(e, 'pago');

export const mensajeAlEliminarPago = (e: unknown) =>
  mensajeAlCambiar(e, 'No pudimos eliminar el pago. Inténtalo de nuevo en unos minutos.');

/** "Hoy · Transferencia" o "15 de noviembre de 2026 · Transferencia". */
export const fechaYMetodoDelPago = (pago: Pick<PagoTarjeta, 'fecha' | 'metodoPago'>) =>
  `${fechaCorta(pago.fecha)} · ${ETIQUETA_METODO[pago.metodoPago]}`;
