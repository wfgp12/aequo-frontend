import { ApiError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type ProyeccionTarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  anterior,
  CON_CUOTAS,
  dejarHoy,
  fijarHoy,
  hayCargando,
  hayTexto,
  mes,
  mesesPedidos,
  mostrarDetalle,
  plano,
  proyeccionDe,
  proyeccionPedida,
  servirDetalle,
  siguiente,
  tarjetaPedida,
  TEXTO,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import { reiniciarRouter, volverAlFoco } from './ayudas/router-simulado';
import { boton, pendiente } from './ayudas/tarjetas';

// Detalle de la tarjeta: cambiar de mes, rótulos según el mes, meses siguientes de cada mes y volver a la
// pantalla (criterios/05-detalle-de-tarjeta.md, CA-RF30-F07 a F10, F12 y F28, CA-RF31-F02 y F08). El backend se
// simula en el borde del adaptador. Hoy es el 19 de noviembre de 2026.
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/tarjetas', () => ({
  listarTarjetas: jest.fn(),
  obtenerTarjeta: jest.fn(),
  obtenerProyeccion: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
}));

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  jest.mocked(listarTarjetas).mockReset();
  jest.mocked(crearTarjeta).mockReset();
  jest.mocked(actualizarTarjeta).mockReset();
  jest.mocked(eliminarTarjeta).mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

const NUEVAS = proyeccionDe('2026-12', {
  cuotas: 100000,
  cargosFijos: 20000,
  total: 120000,
  saldoPendiente: 599010.665859,
  proyeccion: [
    mes('2027-01', 119802.13317188, 55000, 174802.13317188, 119802.13317188),
    mes('2027-02', 119802.13317188, 55000, 174802.13317188, 0),
  ],
});

describe('Detalle de la tarjeta: cambiar de mes', () => {
  it('CA-RF30-F07 "Mes anterior" muestra octubre y pide ese mes una sola vez más, sin volver a pedir la tarjeta', async () => {
    await mostrarDetalle();

    await fireEvent.press(anterior());

    expect(screen.getByText('octubre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('noviembre 2026')).toBeNull();
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-10');
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(hayCargando()).toBe(false));
  });

  it('CA-RF30-F07 "Mes siguiente" muestra diciembre y pide ese mes una sola vez más', async () => {
    await mostrarDetalle();

    await fireEvent.press(siguiente());

    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
    expect(mesesPedidos()).toEqual(['2026-11', '2026-12']);
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(hayCargando()).toBe(false));
  });

  it('CA-RF30-F08 "Mes siguiente" pasa de diciembre a enero del año siguiente y sigue disponible', async () => {
    await mostrarDetalle();
    await fireEvent.press(siguiente());
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();

    await fireEvent.press(siguiente());

    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2027-01');
    expect(siguiente()).toBeEnabled();
    await waitFor(() => expect(hayCargando()).toBe(false));
  });

  it('CA-RF30-F08 "Mes siguiente" no tiene tope: un año y medio después sigue pidiendo meses', async () => {
    await mostrarDetalle();

    for (let i = 0; i < 20; i++) await fireEvent.press(siguiente());

    expect(screen.getByText('julio 2028')).toBeOnTheScreen();
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2028-07');
    expect(siguiente()).toBeEnabled();
    expect(mesesPedidos()).toHaveLength(21);
    await waitFor(() => expect(hayCargando()).toBe(false));
  });

  it('CA-RF30-F08 "Mes anterior" no tiene tope y cruza de enero a diciembre del año anterior', async () => {
    await mostrarDetalle();

    for (let i = 0; i < 11; i++) await fireEvent.press(anterior());

    expect(screen.getByText('diciembre 2025')).toBeOnTheScreen();
    expect(mesesPedidos()).toEqual([
      '2026-11',
      '2026-10',
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
      '2026-02',
      '2026-01',
      '2025-12',
    ]);
    expect(anterior()).toBeEnabled();
    await waitFor(() => expect(hayCargando()).toBe(false));
  });

  it('CA-RF30-F08 siguiente y anterior se compensan: se vuelve al mes de partida y se pide de nuevo', async () => {
    await mostrarDetalle();

    await fireEvent.press(siguiente());
    await fireEvent.press(anterior());

    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(mesesPedidos()).toEqual(['2026-11', '2026-12', '2026-11']);
    await waitFor(() => expect(hayCargando()).toBe(false));
  });

  it('CA-RF30-F09 al cambiar de mes se ocultan las cifras del mes anterior y se ve el indicador hasta que llegan las nuevas', async () => {
    await mostrarDetalle();
    const diciembre = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(diciembre.promesa);

    await fireEvent.press(siguiente());

    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByText('$ 346.270')).toBeNull();
    expect(screen.queryByText('$ 1.766.529')).toBeNull();
    expect(screen.queryByText('$ 264.543')).toBeNull();
    expect(screen.queryByText('febrero 2027')).toBeNull();
    expect(plano()).not.toContain('$');
    expect(screen.queryByText(TEXTO.esteMes)).toBeNull();
    expect(screen.queryByText(TEXTO.proximos)).toBeNull();

    await act(async () => diciembre.resolver({ ...NUEVAS }));

    expect(await screen.findByText('$ 120.000')).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);
  });

  it('CA-RF30-F10 una respuesta vieja no pisa a la última: si la de diciembre llega después que la de enero, se ven las cifras de enero', async () => {
    await mostrarDetalle();
    const diciembre = pendiente<ProyeccionTarjeta>();
    const enero = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(diciembre.promesa).mockReturnValueOnce(enero.promesa);

    await fireEvent.press(siguiente());
    await fireEvent.press(siguiente());
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    await act(async () =>
      enero.resolver(proyeccionDe('2027-01', { total: 111000, cuotas: 111000 })),
    );
    expect(await screen.findByText('$ 111.000')).toBeOnTheScreen();
    await act(async () =>
      diciembre.resolver(proyeccionDe('2026-12', { total: 222000, cuotas: 222000 })),
    );

    expect(screen.getByText('$ 111.000')).toBeOnTheScreen();
    expect(screen.queryByText('$ 222.000')).toBeNull();
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(screen.queryByText('diciembre 2026')).toBeNull();
  });

  it('CA-RF30-F10 una respuesta vieja que falla tarde tampoco muestra un aviso sobre las cifras de la última', async () => {
    await mostrarDetalle();
    const diciembre = pendiente<ProyeccionTarjeta>();
    const enero = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(diciembre.promesa).mockReturnValueOnce(enero.promesa);
    await fireEvent.press(siguiente());
    await fireEvent.press(siguiente());
    await act(async () =>
      enero.resolver(proyeccionDe('2027-01', { total: 111000, cuotas: 111000 })),
    );
    await screen.findByText('$ 111.000');

    await act(async () => diciembre.rechazar(new ApiError(500, 'x')));

    expect(screen.getByText('$ 111.000')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
  });
});

describe('Detalle de la tarjeta: los rótulos dicen el mes', () => {
  it('CA-RF30-F12 en el mes de hoy dice "Este mes pagas" y en otro mes "Pagas en diciembre 2026"', async () => {
    await mostrarDetalle();
    expect(screen.getByText('Este mes pagas')).toBeOnTheScreen();
    expect(screen.queryByText(/^Pagas en /)).toBeNull();

    await fireEvent.press(siguiente());

    expect(await screen.findByText('Pagas en diciembre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('Este mes pagas')).toBeNull();
  });

  it('CA-RF30-F12 con un mes pasado sigue diciendo "Pagas en octubre 2026", sin otro texto', async () => {
    await mostrarDetalle();

    await fireEvent.press(anterior());

    expect(await screen.findByText('Pagas en octubre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('Este mes pagas')).toBeNull();
  });

  it('CA-RF30-F12 al volver al mes de hoy el rótulo vuelve a decir "Este mes pagas"', async () => {
    await mostrarDetalle();
    await fireEvent.press(siguiente());
    await screen.findByText('Pagas en diciembre 2026');

    await fireEvent.press(anterior());

    expect(await screen.findByText('Este mes pagas')).toBeOnTheScreen();
    expect(screen.queryByText(/^Pagas en /)).toBeNull();
  });

  it('CA-RF31-F02 en otro mes lo que queda por pagar dice "después de diciembre 2026" y en el de hoy "después de este mes"', async () => {
    await mostrarDetalle();
    expect(screen.getByText('Te queda por pagar después de este mes')).toBeOnTheScreen();

    await fireEvent.press(siguiente());

    expect(
      await screen.findByText('Te queda por pagar después de diciembre 2026'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Te queda por pagar después de este mes')).toBeNull();
  });
});

describe('Detalle de la tarjeta: los meses siguientes de cada mes', () => {
  it('CA-RF31-F08 al cambiar de mes se ve lo que responde el backend para ese mes y solo sus meses siguientes', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) => (periodo === '2026-12' ? NUEVAS : CON_CUOTAS),
    });
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('$ 264.543')).toBeOnTheScreen();

    await fireEvent.press(siguiente());

    expect(await screen.findByText('Pagas en diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('$ 120.000')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 20.000')).toBeOnTheScreen();
    expect(screen.getByText('Te queda por pagar después de diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('$ 599.011')).toBeOnTheScreen();
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(screen.getByText('febrero 2027')).toBeOnTheScreen();
    // "diciembre 2026" ya solo está en el selector: la fila de la lista anterior desapareció
    expect(screen.getAllByText('diciembre 2026')).toHaveLength(1);
    expect(screen.queryByText('$ 264.543')).toBeNull();
    expect(screen.queryByText('$ 346.270')).toBeNull();
  });
});

describe('Detalle de la tarjeta: al volver a la pantalla', () => {
  it('CA-RF30-F28 al recuperar el foco vuelve a pedir los pagos del mismo mes y muestra las cifras nuevas', async () => {
    await mostrarDetalle();
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    // Desactivó un cargo fijo en "Cargos fijos": el total del mes es menor
    proyeccionPedida().mockImplementation(async (_id, periodo) =>
      proyeccionDe(periodo, {
        cuotas: 291270.05016469,
        cargosFijos: 10000,
        total: 301270.05016469,
      }),
    );

    await volverAlFoco();

    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(2));
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    expect(await screen.findByText('$ 301.270')).toBeOnTheScreen();
    expect(screen.queryByText('$ 346.270')).toBeNull();
    expect(screen.getByText('Cargos fijos $ 10.000')).toBeOnTheScreen();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
  });

  it('CA-RF30-F28 si el usuario estaba en otro mes, vuelve a pedir ese mes y el selector no cambia', async () => {
    await mostrarDetalle();
    await fireEvent.press(siguiente());
    await fireEvent.press(siguiente());
    await screen.findByText('Pagas en enero 2027');

    await volverAlFoco();

    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(4));
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2027-01');
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(mesesPedidos()).toEqual(['2026-11', '2026-12', '2027-01', '2027-01']);
  });

  it('CA-RF30-F28 mientras llega la respuesta nueva se siguen viendo las cifras que ya estaban, sin indicador', async () => {
    await mostrarDetalle();
    const nueva = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(nueva.promesa);

    await volverAlFoco();

    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('$ 1.766.529')).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);

    await act(async () => nueva.resolver(proyeccionDe('2026-11', { total: 77000, cuotas: 77000 })));

    expect(await screen.findByText('$ 77.000')).toBeOnTheScreen();
    expect(screen.queryByText('$ 346.270')).toBeNull();
  });

  it('CA-RF30-F28 si la consulta nueva falla, se ve el aviso de error en vez de las cifras viejas', async () => {
    await mostrarDetalle();
    proyeccionPedida().mockRejectedValueOnce(new ApiError(500, 'x'));

    await volverAlFoco();

    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
    expect(screen.queryByText('$ 346.270')).toBeNull();
    expect(hayTexto(TEXTO.esteMes)).toBe(false);
    expect(boton('Reintentar')).toBeOnTheScreen();
  });
});
