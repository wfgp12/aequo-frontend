import {
  eliminarPago,
  registrarPago,
  type ComparacionDePagos,
  type PagoRegistrado,
} from '@/lib/api/tarjetas';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mostrarDetalle, VACIA, VISA_ID, type Opciones } from './detalle-tarjeta';
import { boton, volverDeLaHoja, VER_TODO } from './tarjetas';

// Ayudas compartidas por las pruebas del pago de una tarjeta (criterios/05-pago-de-tarjeta.md). No son pruebas: Jest
// solo corre los archivos *.test.ts(x). Los `jest.mock` no se pueden compartir: cada archivo de prueba simula
// `expo-router` (ver ./router-simulado) y `@/lib/api/tarjetas` con las funciones que pide ./detalle-tarjeta.

export const registrarPagoSimulado = () => jest.mocked(registrarPago);
export const eliminarPagoSimulado = () => jest.mocked(eliminarPago);

/** Los textos nuevos del pago (RNF-04). */
export const TEXTO_PAGO = {
  errorGuardar: 'No pudimos guardar tu pago. Revisa los datos e inténtalo de nuevo.',
  procesando: 'Tu pago todavía se está guardando. Espera unos segundos e inténtalo de nuevo.',
  valorVacio: 'Escribe un valor mayor que cero.',
  errorEliminar: 'No pudimos eliminar el pago. Inténtalo de nuevo en unos minutos.',
  tituloDialogo: '¿Eliminar este pago?',
};

/** Lo que responde POST …/pagos: el pago ($ 100.000 de hoy, por transferencia) y la comparación del mes del pago. */
export function pagoRegistradoDe(
  parcial: Partial<PagoRegistrado> = {},
  comparacion: Partial<ComparacionDePagos> = {},
): PagoRegistrado {
  return {
    id: 'pago-nuevo',
    tarjetaId: VISA_ID,
    valor: 100000,
    fecha: '2026-11-19',
    metodoPago: 'TRANSFERENCIA',
    descripcion: 'Pago de tarjeta',
    creadaEn: '2026-11-19T17:00:00.000Z',
    ...parcial,
    comparacion: {
      mes: '2026-11',
      estimado: 346270.05016469,
      pagado: 100000,
      diferencia: -246270.05016469,
      ...comparacion,
    },
  };
}

// --- La hoja "Nuevo pago": sus campos son únicos en la pantalla; "Volver" y "Mes anterior/siguiente" se repiten ---

export const campoValor = () => screen.getByLabelText('Monto en pesos');
export const campoNota = () => screen.getByLabelText('Nota');
export const botonGuardarPago = () => boton('Guardar pago');
/** La hoja sigue abierta: se ve el formulario ("Nuevo pago") o la confirmación ("¡Listo!"). */
export const hojaAbierta = () =>
  ['Nuevo pago', '¡Listo!'].some((texto) => screen.queryByText(texto, VER_TODO) !== null);
export const volverDeLaHojaDePago = () => volverDeLaHoja('Nuevo pago');

export const escribirValor = (valor: string) => fireEvent.changeText(campoValor(), valor);
export const escribirNota = (nota: string) => fireEvent.changeText(campoNota(), nota);

/** Del detalle ya cargado a la hoja "Nuevo pago" abierta. */
export async function abrirHoja() {
  await fireEvent.press(boton('Registrar un pago'));
  await screen.findByText('Nuevo pago');
}

/**
 * El detalle con un mes sin nada que pagar (total 0: el valor de la hoja empieza vacío, CA-RF32-F08) y la hoja
 * abierta. Con `opciones` se cambia lo que responde el detalle.
 */
export async function mostrarHojaVacia(opciones: Opciones = {}) {
  await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }), ...opciones });
  await abrirHoja();
}

/** La hoja con el valor ya escrito (por defecto $ 100.000), lista para tocar "Guardar pago". */
export async function mostrarHojaLlena(valor = '100000', opciones: Opciones = {}) {
  await mostrarHojaVacia(opciones);
  await escribirValor(valor);
}

/** Guarda el pago y espera la confirmación "¡Listo!". */
export async function guardarYVerConfirmacion() {
  await fireEvent.press(botonGuardarPago());
  await screen.findByText('¡Listo!');
}

/** Espera a que la hoja se cierre del todo. */
export const esperarHojaCerrada = () => waitFor(() => expect(hojaAbierta()).toBe(false));

/** Las claves con que se llamó a `registrarPago`, en orden. */
export const clavesDePago = () => registrarPagoSimulado().mock.calls.map(([, , clave]) => clave);
/** Los cuerpos con que se llamó a `registrarPago`, en orden. */
export const cuerposDePago = () => registrarPagoSimulado().mock.calls.map(([, datos]) => datos);
