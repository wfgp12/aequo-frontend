import AvanceEnEfectivo from '@/app/avance-en-efectivo';
import { obtenerCuotaPrevia, type CuotaPrevia } from '@/lib/api/tarjetas';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  cuotaDe,
  elegirCuotas,
  elegirTarjeta,
  escribirValor,
  esperar,
  hastaFecha,
  hastaResumen,
  mesSiguiente,
  OPCION,
} from './compra-tarjeta';

// Recorridos de la pantalla del avance en efectivo (criterios/05-compra-con-tarjeta.md, CA-RF28-F). Van aparte de
// las ayudas de la compra porque importan la pantalla `app/avance-en-efectivo`.

/** Abre el avance, escribe el valor y espera la lista de tarjetas. */
export async function avanceHastaTarjetas(valor = '500000') {
  const pantalla = await render(<AvanceEnEfectivo />);
  await escribirValor(valor);
  await screen.findByRole('button', { name: '+ Agregar tarjeta' });
  return pantalla;
}

/** Elige la tarjeta y deja que llegue la primera estimación. */
export async function avanceHastaCuotas(opcion = OPCION.visa, valor = '500000') {
  const pantalla = await avanceHastaTarjetas(valor);
  await elegirTarjeta(opcion);
  return pantalla;
}

export type OpcionesDelAvance = {
  tarjeta?: string;
  valor?: string;
  /** Cuotas fijas (3, 6 o 12); 1 es la que viene elegida. */
  cuotas?: 1 | 3 | 6 | 12;
  /** Cuántas veces toca "Mes siguiente" (el primer pago parte de noviembre 2026). */
  meses?: number;
  respuesta?: CuotaPrevia;
  ayer?: boolean;
};

const POR_DEFECTO: Required<OpcionesDelAvance> = {
  tarjeta: OPCION.visa,
  valor: '500000',
  cuotas: 6,
  meses: 1,
  respuesta: cuotaDe(89741.0851, '2027-05'),
  ayer: false,
};

/** Recorre el avance hasta el resumen (por defecto: $ 500.000, Visa, 6 cuotas desde diciembre 2026). */
export async function avanceHastaElResumen(opciones: OpcionesDelAvance = {}) {
  const { tarjeta, valor, cuotas, meses, respuesta, ayer } = { ...POR_DEFECTO, ...opciones };
  jest.mocked(obtenerCuotaPrevia).mockReset().mockResolvedValue(respuesta);
  const pantalla = await avanceHastaCuotas(tarjeta, valor);
  if (cuotas !== 1) await elegirCuotas(cuotas);
  if (meses) {
    await mesSiguiente(meses);
    await esperar(400);
  }
  await hastaFecha();
  if (ayer) await fireEvent.press(screen.getByRole('button', { name: 'Ayer' }));
  await hastaResumen();
  return pantalla;
}
