import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarPago,
  eliminarTarjeta,
  listarPagos,
  listarTarjetas,
  obtenerProyeccion,
  obtenerTarjeta,
  registrarPago,
  type ProyeccionTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  anterior,
  CON_CUOTAS,
  dibujarDetalle,
  fijarHoy,
  dejarHoy,
  hayBoton,
  hayCargando,
  mostrarDetalle,
  plano,
  PantallaDeDetalle,
  proyeccionPedida,
  servirDetalle,
  siguiente,
  SIN_DATOS_DE_LA_API,
  tarjetaPedida,
  TECNICO_DEL_DETALLE,
  TEXTO,
  VACIA,
  VISA,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import { reiniciarRouter, router, usarParametros } from './ayudas/router-simulado';
import { boton, pendiente, RED } from './ayudas/tarjetas';

// Detalle de la tarjeta (ruta /tarjetas/[id]): entrada, título, carga, selector de mes y accesibilidad
// (criterios/05-detalle-de-tarjeta.md, CA-RF30-F03 a F06, F31 a F33). El backend se simula en el borde del
// adaptador (lib/api/tarjetas). Hoy es el 19 de noviembre de 2026.
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

const listar = jest.mocked(listarTarjetas);

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  listar.mockReset();
  jest.mocked(crearTarjeta).mockReset();
  jest.mocked(actualizarTarjeta).mockReset();
  jest.mocked(eliminarTarjeta).mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

/** Las dos consultas sin respuesta todavía: el arranque en frío de Render (RNF-02). */
async function dibujarSinRespuestas() {
  const tarjeta = pendiente<Tarjeta>();
  const pagos = pendiente<ProyeccionTarjeta>();
  tarjetaPedida().mockReturnValue(tarjeta.promesa);
  proyeccionPedida().mockReturnValue(pagos.promesa);
  await dibujarDetalle();
  return { tarjeta, pagos };
}

describe('Detalle de la tarjeta: título', () => {
  it('CA-RF30-F03 muestra el nombre de la tarjeta como título y "Volver" regresa a la pantalla anterior', async () => {
    await mostrarDetalle();

    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    await fireEvent.press(boton('Volver'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('CA-RF30-F03 cuando carga la tarjeta ve debajo del título su tasa, con el mismo texto de la lista', async () => {
    await mostrarDetalle();

    expect(screen.getByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
    const texto = plano();
    expect(texto.indexOf('Visa Bancolombia')).toBeLessThan(texto.indexOf('Tasa 29,21 % E.A.'));
  });

  it('CA-RF30-F03 la tasa solo aparece cuando llega la tarjeta: el título ya está desde el principio', async () => {
    const { tarjeta, pagos } = await dibujarSinRespuestas();

    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.queryByText(/^Tasa /)).toBeNull();

    await act(async () => {
      tarjeta.resolver({ ...VISA });
      pagos.resolver({ ...CON_CUOTAS });
    });

    expect(await screen.findByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
  });

  it('CA-RF30-F03 sin nombre en la ruta el título es "Tarjeta" hasta que llega la tarjeta y entonces su nombre', async () => {
    usarParametros({ id: VISA_ID });
    const tarjeta = pendiente<Tarjeta>();
    tarjetaPedida().mockReturnValue(tarjeta.promesa);

    await render(<PantallaDeDetalle />);

    expect(screen.getByText('Tarjeta')).toBeOnTheScreen();
    expect(screen.queryByText('Visa Bancolombia')).toBeNull();
    expect(boton('Volver')).toBeOnTheScreen();

    await act(async () => tarjeta.resolver({ ...VISA }));

    expect(await screen.findByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.queryByText('Tarjeta')).toBeNull();
  });

  it('CA-RF30-F03 si el nombre del backend es distinto del de la ruta, se ve el del backend', async () => {
    usarParametros({ id: VISA_ID, nombre: 'Visa Vieja' });
    const tarjeta = pendiente<Tarjeta>();
    tarjetaPedida().mockReturnValue(tarjeta.promesa);

    await render(<PantallaDeDetalle />);
    expect(screen.getByText('Visa Vieja')).toBeOnTheScreen();

    await act(async () => tarjeta.resolver({ ...VISA }));

    expect(await screen.findByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.queryByText('Visa Vieja')).toBeNull();
  });
});

describe('Detalle de la tarjeta: carga', () => {
  it('CA-RF30-F04 al entrar pide la tarjeta y los pagos del mes de hoy, una sola vez cada una y a la vez', async () => {
    const { tarjeta, pagos } = await dibujarSinRespuestas();

    // Salen las tres sin esperar a que otra responda (CA-RF32-F30: ahora también los pagos registrados del mes)
    expect(obtenerProyeccion).toHaveBeenCalledTimes(1);
    expect(obtenerProyeccion).toHaveBeenCalledWith(VISA_ID, '2026-11');
    expect(obtenerTarjeta).toHaveBeenCalledTimes(1);
    expect(obtenerTarjeta).toHaveBeenCalledWith(VISA_ID);
    expect(listarPagos).toHaveBeenCalledTimes(1);
    expect(listarPagos).toHaveBeenCalledWith(VISA_ID, '2026-11');

    await act(async () => {
      tarjeta.resolver({ ...VISA });
      pagos.resolver({ ...CON_CUOTAS });
    });
  });

  it('CA-RF30-F04 una vez cargado no pide nada más: ni la lista de tarjetas, ni otros meses, ni guarda o elimina', async () => {
    await mostrarDetalle();
    await act(async () => {});

    expect(obtenerProyeccion).toHaveBeenCalledTimes(1);
    expect(obtenerTarjeta).toHaveBeenCalledTimes(1);
    // Solo se suman los pagos registrados del mes (CA-RF32-F30): nada de registrar ni eliminar pagos
    expect(listarPagos).toHaveBeenCalledTimes(1);
    expect(registrarPago).not.toHaveBeenCalled();
    expect(eliminarPago).not.toHaveBeenCalled();
    expect(listar).not.toHaveBeenCalled();
    expect(actualizarTarjeta).not.toHaveBeenCalled();
    expect(crearTarjeta).not.toHaveBeenCalled();
    expect(eliminarTarjeta).not.toHaveBeenCalled();
  });

  it('CA-RF30-F04 el mes se pide con el mes del dispositivo, no con uno fijo (en enero pide 2026-01)', async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 12));

    await mostrarDetalle();

    expect(obtenerProyeccion).toHaveBeenCalledWith(VISA_ID, '2026-01');
    expect(listarPagos).toHaveBeenCalledWith(VISA_ID, '2026-01');
    expect(screen.getByText('enero 2026')).toBeOnTheScreen();
  });

  it('CA-RF30-F04 la tarjeta que se pide es la de la ruta, no una fija', async () => {
    await mostrarDetalle({ params: { id: 'otra-tarjeta', nombre: 'Amex' } });

    expect(obtenerProyeccion).toHaveBeenCalledWith('otra-tarjeta', '2026-11');
    expect(obtenerTarjeta).toHaveBeenCalledWith('otra-tarjeta');
    expect(listarPagos).toHaveBeenCalledWith('otra-tarjeta', '2026-11');
  });

  it('CA-RF30-F05 mientras carga solo se ve el indicador con el título, "Volver" y el selector, sin montos ni avisos ni botones de la tarjeta', async () => {
    const { tarjeta, pagos } = await dibujarSinRespuestas();

    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(boton('Volver')).toBeOnTheScreen();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(plano()).not.toContain('$');
    expect(screen.queryByText(TEXTO.esteMes)).toBeNull();
    expect(screen.queryByText(TEXTO.proximos)).toBeNull();
    expect(screen.queryByText(TEXTO.vacia)).toBeNull();
    expect(screen.queryByText(TEXTO.porPagarEsteMes)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(hayBoton('Editar tarjeta')).toBe(false);
    expect(hayBoton('Ver cargos fijos')).toBe(false);

    await act(async () => {
      tarjeta.resolver({ ...VISA });
      pagos.resolver({ ...CON_CUOTAS });
    });

    expect(await screen.findByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);
  });

  it('CA-RF30-F05 con una tarjeta sin pagos tampoco se ve el aviso de "sin pagos" mientras carga', async () => {
    const { tarjeta, pagos } = await dibujarSinRespuestas();

    expect(screen.queryByText(TEXTO.vacia)).toBeNull();

    await act(async () => {
      tarjeta.resolver({ ...VISA });
      pagos.resolver({ ...VACIA });
    });

    expect(await screen.findByText(TEXTO.vacia)).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);
  });
});

describe('Detalle de la tarjeta: selector de mes', () => {
  it('CA-RF30-F06 empieza en el mes de hoy ("noviembre 2026") con "Mes anterior" y "Mes siguiente"', async () => {
    await mostrarDetalle();

    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(anterior()).toBeEnabled();
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF30-F06 el selector se ve y se puede usar incluso mientras carga', async () => {
    await dibujarSinRespuestas();

    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(anterior()).toBeEnabled();
    expect(siguiente()).toBeEnabled();
    expect(screen.queryByText('2026-11')).toBeNull();
  });
});

describe('Detalle de la tarjeta: accesibilidad (RNF-06)', () => {
  it('CA-RF30-F31 los botones se anuncian como botones y el mes del selector es texto legible', async () => {
    await mostrarDetalle();

    for (const nombre of [
      'Volver',
      'Mes anterior',
      'Mes siguiente',
      'Editar tarjeta',
      'Ver cargos fijos',
    ]) {
      expect(screen.getByRole('button', { name: nombre })).toBeOnTheScreen();
    }
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
  });

  it('CA-RF30-F31 el resumen se anuncia en una sola frase con su cifra', async () => {
    await mostrarDetalle();

    expect(screen.getByLabelText('Este mes pagas, $ 346.270')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Te queda por pagar después de este mes, $ 1.766.529'),
    ).toBeOnTheScreen();
  });

  it('CA-RF30-F31 el indicador de carga se anuncia como "Cargando tu tarjeta"', async () => {
    await dibujarSinRespuestas();

    expect(screen.getByLabelText('Cargando tu tarjeta')).toBeOnTheScreen();
  });

  it('CA-RF30-F31 los avisos de error se anuncian como alerta y "Reintentar" como botón', async () => {
    proyeccionPedida().mockRejectedValue(new ApiError(500, 'x'));

    await dibujarDetalle();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });

  it('CA-RF30-F31 el aviso de que la tarjeta ya no existe también se anuncia como alerta', async () => {
    proyeccionPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));

    await dibujarDetalle();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.yaNoExiste);
  });
});

describe('Detalle de la tarjeta: lenguaje cotidiano (RNF-04, RNF-11)', () => {
  const estados: [string, () => Promise<void>][] = [
    ['cargando', async () => void (await dibujarSinRespuestas())],
    ['con cifras', async () => mostrarDetalle()],
    [
      'sin pagos',
      async () => {
        servirDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });
        await dibujarDetalle();
        await screen.findByText(TEXTO.vacia);
      },
    ],
    [
      'con un error de la consulta',
      async () => {
        proyeccionPedida().mockRejectedValue(new ApiError(500, 'Internal server error'));
        await dibujarDetalle();
        await screen.findByText(TEXTO.errorCarga);
      },
    ],
    [
      'sin conexión',
      async () => {
        proyeccionPedida().mockRejectedValue(new NetworkError());
        await dibujarDetalle();
        await screen.findByText(RED);
      },
    ],
    [
      'con la tarjeta que ya no existe',
      async () => {
        tarjetaPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));
        await dibujarDetalle();
        await screen.findByText(TEXTO.yaNoExiste);
      },
    ],
  ];

  it.each(estados)(
    'CA-RF30-F32 los textos del detalle %s no tienen términos técnicos, datos crudos ni mensajes del backend',
    async (_estado, mostrar) => {
      await mostrar();

      const texto = plano();
      expect(texto).not.toMatch(TECNICO_DEL_DETALLE);
      expect(texto).not.toMatch(/Tarjeta no encontrada|Internal server error/i);
    },
  );

  it.each(estados)(
    'CA-RF30-F33 el detalle %s no muestra cupo, deuda total, próximo pago, vencimientos ni fechas de día y mes',
    async (_estado, mostrar) => {
      await mostrar();

      expect(plano()).not.toMatch(SIN_DATOS_DE_LA_API);
    },
  );

  it('CA-RF30-F32 el total se llama "Este mes pagas" y lo demás habla de cuotas, cargos fijos y próximos meses', async () => {
    await mostrarDetalle();

    for (const texto of [
      'Este mes pagas',
      'Cuotas $ 291.270',
      'Cargos fijos $ 55.000',
      'Te queda por pagar después de este mes',
      'Próximos meses',
    ]) {
      expect(screen.getByText(texto)).toBeOnTheScreen();
    }
  });
});
