import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
} from '@/lib/api/tarjetas';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  dejarHoy,
  fijarHoy,
  mostrarDetalle,
  PAGO_2,
  PAGO_3,
  PAGO_DE_MAS,
  PAGO_EXACTO,
  PAGO_PARCIAL,
  plano,
  servirDetalle,
  SIN_PAGOS,
  VACIA,
} from './ayudas/detalle-tarjeta';
import {
  abrirHoja,
  botonGuardarPago,
  eliminarPagoSimulado,
  escribirNota,
  escribirValor,
  guardarYVerConfirmacion,
  pagoRegistradoDe,
  registrarPagoSimulado,
  TEXTO_PAGO,
  volverDeLaHojaDePago,
} from './ayudas/pago-tarjeta';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, laHoja } from './ayudas/tarjetas';

// Accesibilidad y lenguaje cotidiano de lo nuevo: botón, hoja, confirmación, avisos, bloque de lo pagado, lista,
// diálogo de eliminar (criterios/05-pago-de-tarjeta.md, CA-RF32-F42 y F43; RNF-04 y RNF-06). El backend se simula
// en el borde del adaptador (lib/api/tarjetas). Hoy es el 19 de noviembre de 2026.
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/tarjetas', () => ({
  listarTarjetas: jest.fn(),
  obtenerTarjeta: jest.fn(),
  obtenerProyeccion: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
  listarPagos: jest.fn(),
  registrarPago: jest.fn(),
  eliminarPago: jest.fn(),
}));

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  jest.mocked(listarTarjetas).mockReset();
  jest.mocked(crearTarjeta).mockReset();
  jest.mocked(actualizarTarjeta).mockReset();
  jest.mocked(eliminarTarjeta).mockReset();
  eliminarPagoSimulado().mockReset();
  registrarPagoSimulado().mockReset().mockResolvedValue(pagoRegistradoDe());
  servirDetalle();
});
afterEach(() => dejarHoy());

const ELIMINAR_PAGO_3 = 'Eliminar el pago de $ 100.000, 15 de noviembre de 2026';
const conPagos = () =>
  mostrarDetalle({
    proyeccion: (mes) => ({ ...PAGO_PARCIAL, mes }),
    pagos: () => [PAGO_3, PAGO_2],
  });
const botones = (nombres: string[]) => {
  for (const nombre of nombres) {
    expect(screen.getByRole('button', { name: nombre })).toBeOnTheScreen();
  }
};

describe('Pago de tarjeta: se puede usar con lector de pantalla', () => {
  it('CA-RF32-F42 en el detalle, "Registrar un pago" y cada "Eliminar el pago de $ X, fecha" se anuncian como botones', async () => {
    await conPagos();

    botones(['Registrar un pago', ELIMINAR_PAGO_3]);
    expect(
      screen.getByRole('button', { name: 'Eliminar el pago de $ 50.000, 10 de noviembre de 2026' }),
    ).toBeOnTheScreen();
  });

  it('CA-RF32-F42 lo pagado se anuncia en una sola frase con su cifra y cada fila de pago como una frase', async () => {
    await conPagos();

    expect(screen.getByLabelText('Este mes has pagado, $ 100.000')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Pago de tarjeta, $ 100.000, 15 de noviembre de 2026, Transferencia'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Abono de la quincena, $ 50.000, 10 de noviembre de 2026, Efectivo'),
    ).toBeOnTheScreen();
  });

  it('CA-RF32-F42 en la hoja, los botones, las opciones con su estado, los campos y el aviso de error se anuncian bien', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
    await abrirHoja();

    expect(volverDeLaHojaDePago()).toBeOnTheScreen();
    botones(['Guardar pago']);
    for (const opcion of [
      'Hoy',
      'Ayer',
      'Otra fecha',
      'Efectivo',
      'Tarjeta débito',
      'Transferencia',
    ]) {
      const elegida = opcion === 'Hoy' || opcion === 'Transferencia';
      const anunciada = screen.getByRole('button', { name: opcion });
      if (elegida) expect(anunciada).toBeSelected();
      else expect(anunciada).not.toBeSelected();
    }
    expect(screen.getByLabelText('Monto en pesos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota')).toBeOnTheScreen();

    await fireEvent.press(botonGuardarPago());
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_PAGO.valorVacio);
  });

  it('CA-RF32-F42 al cambiar de opción, la elegida se anuncia como seleccionada y la anterior ya no', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
    await abrirHoja();

    await fireEvent.press(boton('Ayer'));
    await fireEvent.press(boton('Efectivo'));

    expect(boton('Ayer')).toBeSelected();
    expect(boton('Hoy')).not.toBeSelected();
    expect(boton('Efectivo')).toBeSelected();
    expect(boton('Transferencia')).not.toBeSelected();
  });

  it('CA-RF32-F42 en la confirmación, "Listo" y "Volver" se anuncian como botones', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
    await abrirHoja();
    await escribirValor('100000');
    await guardarYVerConfirmacion();

    expect(boton('Listo')).toBeOnTheScreen();
    expect(laHoja().getByRole('button', { name: 'Volver' })).toBeOnTheScreen();
  });

  it('CA-RF32-F42 en el diálogo de eliminar, "Cancelar" y "Eliminar" se anuncian como botones y el aviso de error como alerta', async () => {
    await conPagos();
    eliminarPagoSimulado().mockRejectedValueOnce(new ApiError(500, 'x'));
    await fireEvent.press(boton(ELIMINAR_PAGO_3));
    await screen.findByText(TEXTO_PAGO.tituloDialogo);

    botones(['Cancelar', 'Eliminar']);
    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_PAGO.errorEliminar);
  });
});

// Lo que el usuario nunca debe leer (RNF-04): los valores del backend tal cual, jerga y mensajes del servidor
const NUNCA_EN_MAYUSCULAS = /PAGO_TARJETA|ABONO_DEUDA|EFECTIVO|DEBITO|TRANSFERENCIA/;
const NUNCA_TECNICO =
  /clasificacionFlujo|comparacion|diferencia|metodoPago|idempoten|payload|\b(409|422|404)\b|NaN|undefined|\bnull\b/i;
const NUNCA_DEL_BACKEND = /Pago no encontrado|Tarjeta no encontrada|mensaje del backend/;
// Lo que la API no da y el detalle no debe mostrar (CA-RF30-F33 sigue vigente)
const NUNCA_SIN_DATOS = /marcar como pagada|próximo pago|vence|cupo disponible|deuda total/i;

describe('Pago de tarjeta: los textos son cotidianos y sin datos crudos', () => {
  const estados: [string, () => Promise<void>][] = [
    ['el detalle con lo pagado y la lista', async () => void (await conPagos())],
    [
      'el detalle sin pagos',
      async () => void (await mostrarDetalle({ proyeccion: (mes) => ({ ...SIN_PAGOS, mes }) })),
    ],
    [
      'el detalle con el pago exacto',
      async () => void (await mostrarDetalle({ proyeccion: (mes) => ({ ...PAGO_EXACTO, mes }) })),
    ],
    [
      'el detalle con un pago de más',
      async () => void (await mostrarDetalle({ proyeccion: (mes) => ({ ...PAGO_DE_MAS, mes }) })),
    ],
    [
      'la hoja "Nuevo pago"',
      async () => {
        await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await abrirHoja();
      },
    ],
    [
      'la hoja con el aviso del valor',
      async () => {
        await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await abrirHoja();
        await fireEvent.press(botonGuardarPago());
        await screen.findByText(TEXTO_PAGO.valorVacio);
      },
    ],
    [
      'la confirmación',
      async () => {
        await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await abrirHoja();
        await escribirValor('100000');
        await escribirNota('Cuota');
        await guardarYVerConfirmacion();
      },
    ],
    [
      'la hoja sin conexión',
      async () => {
        registrarPagoSimulado().mockRejectedValueOnce(new NetworkError());
        await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await abrirHoja();
        await escribirValor('100000');
        await fireEvent.press(botonGuardarPago());
        await screen.findByText(
          'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
        );
      },
    ],
    [
      'la hoja con un error del servidor',
      async () => {
        registrarPagoSimulado().mockRejectedValueOnce(new ApiError(422, 'mensaje del backend'));
        await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await abrirHoja();
        await escribirValor('100000');
        await fireEvent.press(botonGuardarPago());
        await screen.findByText(TEXTO_PAGO.errorGuardar);
      },
    ],
    [
      'la hoja cuando se está procesando',
      async () => {
        registrarPagoSimulado().mockRejectedValueOnce(new ApiError(409, 'mensaje del backend'));
        await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await abrirHoja();
        await escribirValor('100000');
        await fireEvent.press(botonGuardarPago());
        await screen.findByText(TEXTO_PAGO.procesando);
      },
    ],
    [
      'el diálogo de eliminar',
      async () => {
        await conPagos();
        await fireEvent.press(boton(ELIMINAR_PAGO_3));
        await screen.findByText(TEXTO_PAGO.tituloDialogo);
      },
    ],
    [
      'el diálogo con un error al eliminar',
      async () => {
        eliminarPagoSimulado().mockRejectedValueOnce(new ApiError(500, 'mensaje del backend'));
        await conPagos();
        await fireEvent.press(boton(ELIMINAR_PAGO_3));
        await screen.findByText(TEXTO_PAGO.tituloDialogo);
        await fireEvent.press(boton('Eliminar'));
        await screen.findByText(TEXTO_PAGO.errorEliminar);
      },
    ],
  ];

  it.each(estados)(
    'CA-RF32-F43 %s no tiene términos técnicos, datos crudos ni mensajes del backend',
    async (_estado, mostrar) => {
      await mostrar();

      const texto = plano();
      expect(texto).not.toMatch(NUNCA_EN_MAYUSCULAS);
      expect(texto).not.toMatch(NUNCA_TECNICO);
      expect(texto).not.toMatch(NUNCA_DEL_BACKEND);
    },
  );

  it.each(estados)(
    'CA-RF32-F43 %s no muestra "Marcar como pagada", "Próximo pago", "Vence", "Cupo disponible" ni "Deuda total"',
    async (_estado, mostrar) => {
      await mostrar();

      expect(plano()).not.toMatch(NUNCA_SIN_DATOS);
    },
  );

  it('CA-RF32-F43 los textos de lo nuevo hablan de "pago", "has pagado", "te falta pagar", "pagaste de más" y "estimado"', async () => {
    registrarPagoSimulado().mockResolvedValue(pagoRegistradoDe({}, { diferencia: 53729.94983531 }));
    await conPagos();

    const detalle = plano();
    expect(detalle).toMatch(/Registrar un pago/);
    expect(detalle).toMatch(/has pagado/);
    expect(detalle).toMatch(/Te falta pagar/);

    await abrirHoja();
    await escribirValor('100000');
    await guardarYVerConfirmacion();

    const confirmacion = plano();
    expect(confirmacion).toMatch(/Registramos tu pago/);
    expect(confirmacion).toMatch(/Estimado de/);
    expect(confirmacion).toMatch(/Pagaste de más/);
  });
});
