import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type PagoTarjeta,
  type ProyeccionTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  ANTES_DEL_PRIMER_PAGO,
  CON_CUOTAS,
  dejarHoy,
  dibujarDetalle,
  fijarHoy,
  hayBoton,
  hayCargando,
  hayTexto,
  mesesDePagosPedidos,
  mostrarDetalle,
  PAGO_2,
  PAGO_3,
  PAGO_DE_MAS,
  PAGO_EXACTO,
  PAGO_PARCIAL,
  PAGO_SIN_DEUDA,
  pagoDe,
  pagosPedidos,
  plano,
  proyeccionDe,
  proyeccionPedida,
  servirDetalle,
  SIN_PAGOS,
  tarjetaPedida,
  TEXTO,
  VACIA,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import { eliminarPagoSimulado, registrarPagoSimulado } from './ayudas/pago-tarjeta';
import { reiniciarRouter, router, volverAlFoco } from './ayudas/router-simulado';
import { boton, pendiente, RED } from './ayudas/tarjetas';

// Lo pagado frente a lo estimado y la lista de pagos del mes en el detalle de la tarjeta
// (criterios/05-pago-de-tarjeta.md, CA-RF32-F25 a F33). El backend se simula en el borde del adaptador
// (lib/api/tarjetas). Hoy es el 19 de noviembre de 2026.
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
  registrarPagoSimulado().mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

const hayAlerta = () => screen.queryByRole('alert') !== null;
const delMes = (base: ProyeccionTarjeta) => (mes: string) => ({ ...base, mes });
const ELIMINAR_PAGO_3 = 'Eliminar el pago de $ 100.000, 15 de noviembre de 2026';

describe('Lo pagado frente a lo estimado', () => {
  it('CA-RF32-F25 con un pago parcial ve "Este mes has pagado" con "$ 100.000" y debajo "Te falta pagar $ 246.270"', async () => {
    await mostrarDetalle({ proyeccion: delMes(PAGO_PARCIAL) });

    expect(screen.getByText('Este mes has pagado')).toBeOnTheScreen();
    expect(screen.getByText('$ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 246.270')).toBeOnTheScreen();
    const texto = plano();
    const orden = ['Este mes has pagado', '$ 100.000', 'Te falta pagar $ 246.270'].map((parte) =>
      texto.indexOf(parte),
    );
    expect(orden.every((posicion) => posicion >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  it('CA-RF32-F25 sigue mostrando "Este mes pagas", la nota y "Te queda por pagar después de este mes" como antes', async () => {
    await mostrarDetalle({ proyeccion: delMes(PAGO_PARCIAL) });

    expect(screen.getByLabelText('Este mes pagas, $ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 291.270')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.notaDelTotal)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.porPagarEsteMes)).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Te queda por pagar después de este mes, $ 1.766.529'),
    ).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.proximos)).toBeOnTheScreen();
  });

  it.each([
    ['sin pagos', '$ 0', 'Te falta pagar $ 346.270', SIN_PAGOS],
    ['con un pago parcial', '$ 100.000', 'Te falta pagar $ 246.270', PAGO_PARCIAL],
    ['con el pago exacto', '$ 346.270', 'Pagaste justo lo estimado', PAGO_EXACTO],
    ['con un pago de más', '$ 400.000', 'Pagaste de más $ 53.730', PAGO_DE_MAS],
  ])(
    'CA-RF32-F25 %s: lo pagado dice "%s" y la diferencia "%s"',
    async (_caso, pagado, diferencia, respuesta) => {
      await mostrarDetalle({ proyeccion: delMes(respuesta) });

      expect(screen.getByLabelText(`Este mes has pagado, ${pagado}`)).toBeOnTheScreen();
      expect(screen.getByText(diferencia)).toBeOnTheScreen();
      expect(plano()).not.toMatch(/−|diferencia|NaN|undefined/i);
    },
  );

  it('CA-RF32-F26 en otro mes el rótulo dice "Has pagado en diciembre 2026" y en el mes de hoy sigue diciendo "Este mes has pagado"', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) =>
        periodo === '2026-12'
          ? { ...CON_CUOTAS, mes: periodo, pagado: 150000, diferencia: -114543.21823395 }
          : { ...CON_CUOTAS, mes: periodo },
    });
    expect(screen.getByText('Este mes has pagado')).toBeOnTheScreen();
    expect(screen.queryByText(/^Has pagado en /)).toBeNull();

    await fireEvent.press(boton('Mes siguiente'));

    expect(await screen.findByText('Has pagado en diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Has pagado en diciembre 2026, $ 150.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 114.543')).toBeOnTheScreen();
    expect(screen.queryByText('Este mes has pagado')).toBeNull();
  });

  it('CA-RF32-F27 un mes sin deuda pero con pagos sí se muestra, sin el aviso de "sin pagos pendientes"', async () => {
    await mostrarDetalle({ proyeccion: delMes(PAGO_SIN_DEUDA) });

    expect(screen.getByLabelText('Este mes pagas, $ 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Este mes has pagado, $ 50.000')).toBeOnTheScreen();
    expect(screen.getByText('Pagaste de más $ 50.000')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.vacia)).toBe(false);
    expect(hayAlerta()).toBe(false);
  });

  it('CA-RF32-F28 sin deuda ni pagos pero con cuotas más adelante no se muestra el bloque de lo pagado', async () => {
    await mostrarDetalle({ proyeccion: delMes(ANTES_DEL_PRIMER_PAGO) });

    expect(screen.queryByText(/has pagado/i)).toBeNull();
    expect(screen.queryByText(/Te falta pagar/)).toBeNull();
    expect(screen.queryByText('Pagaste justo lo estimado')).toBeNull();
    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(screen.getByText('$ 1.437.626')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.proximos)).toBeOnTheScreen();
    expect(hayTexto(TEXTO.vacia)).toBe(false);
  });

  it('CA-RF32-F28 con todo en cero tampoco se muestra el bloque y se ve el aviso de "sin pagos pendientes"', async () => {
    await mostrarDetalle({ proyeccion: delMes(VACIA) });

    expect(screen.queryByText(/has pagado/i)).toBeNull();
    expect(screen.queryByText(/Te falta pagar/)).toBeNull();
    expect(screen.queryByText('Pagaste justo lo estimado')).toBeNull();
    expect(screen.getByText(TEXTO.vacia)).toBeOnTheScreen();
  });

  it('CA-RF32-F18 el detalle muestra lo que responde el backend aunque las cifras no cuadren', async () => {
    await mostrarDetalle({
      proyeccion: (mes) =>
        proyeccionDe(mes, {
          cuotas: 100000,
          cargosFijos: 20000,
          total: 150000,
          saldoPendiente: 999999,
          pagado: 100000,
          diferencia: 5,
        }),
    });

    expect(screen.getByText('Pagaste de más $ 5')).toBeOnTheScreen();
    expect(screen.queryByText(/Te falta pagar/)).toBeNull();
    expect(screen.getByLabelText('Este mes has pagado, $ 100.000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Este mes pagas, $ 150.000')).toBeOnTheScreen();
    // Los pagos no descuentan lo que queda por pagar después de este mes
    expect(
      screen.getByLabelText('Te queda por pagar después de este mes, $ 999.999'),
    ).toBeOnTheScreen();
  });

  it('CA-RF32-F29 al cambiar de mes se ocultan lo pagado y la lista del mes anterior y se ve el indicador hasta que llegan los nuevos', async () => {
    await mostrarDetalle({ proyeccion: delMes(PAGO_PARCIAL), pagos: () => [PAGO_3, PAGO_2] });
    expect(screen.getByText('Te falta pagar $ 246.270')).toBeOnTheScreen();
    expect(screen.getByText('Tus pagos de este mes')).toBeOnTheScreen();
    const proyeccion = pendiente<ProyeccionTarjeta>();
    const pagos = pendiente<PagoTarjeta[]>();
    proyeccionPedida().mockReturnValueOnce(proyeccion.promesa);
    pagosPedidos().mockReturnValueOnce(pagos.promesa);

    await fireEvent.press(boton('Mes siguiente'));

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByText(/has pagado/i)).toBeNull();
    expect(screen.queryByText(/Te falta pagar/)).toBeNull();
    expect(screen.queryByText(/Tus pagos de/)).toBeNull();
    expect(hayBoton(ELIMINAR_PAGO_3)).toBe(false);
    expect(plano()).not.toContain('$');

    await act(async () => {
      proyeccion.resolver({ ...PAGO_DE_MAS, mes: '2026-12' });
      pagos.resolver([pagoDe('pago-d', { valor: 70000, fecha: '2026-12-05' })]);
    });

    expect(await screen.findByText('Has pagado en diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('Pagaste de más $ 53.730')).toBeOnTheScreen();
    expect(screen.getByText('Tus pagos de diciembre 2026')).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);
  });

  it('CA-RF32-F29 una respuesta tardía de un mes viejo no pisa la del último, tampoco en la lista de pagos', async () => {
    await mostrarDetalle();
    const proyeccionDic = pendiente<ProyeccionTarjeta>();
    const proyeccionEne = pendiente<ProyeccionTarjeta>();
    const pagosDic = pendiente<PagoTarjeta[]>();
    const pagosEne = pendiente<PagoTarjeta[]>();
    proyeccionPedida()
      .mockReturnValueOnce(proyeccionDic.promesa)
      .mockReturnValueOnce(proyeccionEne.promesa);
    pagosPedidos().mockReturnValueOnce(pagosDic.promesa).mockReturnValueOnce(pagosEne.promesa);
    await fireEvent.press(boton('Mes siguiente'));
    await fireEvent.press(boton('Mes siguiente'));
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();

    await act(async () => {
      proyeccionEne.resolver(
        proyeccionDe('2027-01', {
          total: 111000,
          cuotas: 111000,
          pagado: 25000,
          diferencia: -86000,
        }),
      );
      pagosEne.resolver([pagoDe('pago-e', { valor: 25000, fecha: '2027-01-05' })]);
    });
    expect(await screen.findByText('Has pagado en enero 2027')).toBeOnTheScreen();
    await act(async () => {
      proyeccionDic.resolver(
        proyeccionDe('2026-12', {
          total: 222000,
          cuotas: 222000,
          pagado: 35000,
          diferencia: -187000,
        }),
      );
      pagosDic.resolver([pagoDe('pago-d', { valor: 35000, fecha: '2026-12-05' })]);
    });

    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(screen.getByLabelText('Has pagado en enero 2027, $ 25.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 86.000')).toBeOnTheScreen();
    expect(screen.getByText('Tus pagos de enero 2027')).toBeOnTheScreen();
    expect(hayBoton('Eliminar el pago de $ 25.000, 5 de enero de 2027')).toBe(true);
    expect(hayBoton('Eliminar el pago de $ 35.000, 5 de diciembre de 2026')).toBe(false);
    expect(screen.queryByText('Has pagado en diciembre 2026')).toBeNull();
    expect(screen.queryByText('Tus pagos de diciembre 2026')).toBeNull();
  });
});

describe('Los pagos del mes: cuándo se piden', () => {
  it('CA-RF32-F30 al abrir el detalle se piden los pagos del mes de hoy, una sola vez y a la vez que las otras consultas', async () => {
    tarjetaPedida().mockReturnValue(pendiente<Tarjeta>().promesa);
    proyeccionPedida().mockReturnValue(pendiente<ProyeccionTarjeta>().promesa);
    pagosPedidos().mockReturnValue(pendiente<PagoTarjeta[]>().promesa);

    await dibujarDetalle();

    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledWith(VISA_ID, '2026-11');
  });

  it('CA-RF32-F30 "Mes anterior" pide los pagos del mes nuevo una vez más y nunca se piden sin mes', async () => {
    await mostrarDetalle();

    await fireEvent.press(boton('Mes anterior'));

    await waitFor(() => expect(pagosPedidos()).toHaveBeenCalledTimes(2));
    expect(pagosPedidos()).toHaveBeenLastCalledWith(VISA_ID, '2026-10');
    expect(mesesDePagosPedidos()).toEqual(['2026-11', '2026-10']);
    expect(mesesDePagosPedidos().every((mes) => typeof mes === 'string')).toBe(true);
  });

  it('CA-RF32-F30 al recuperar el foco se vuelven a pedir con el mes que se estaba viendo', async () => {
    await mostrarDetalle();
    await fireEvent.press(boton('Mes siguiente'));
    await screen.findByText('Pagas en diciembre 2026');

    await volverAlFoco();

    await waitFor(() => expect(pagosPedidos()).toHaveBeenCalledTimes(3));
    expect(mesesDePagosPedidos()).toEqual(['2026-11', '2026-12', '2026-12']);
  });
});

describe('Los pagos del mes: la lista', () => {
  it('CA-RF32-F31 con pagos ve "Tus pagos de este mes" y una fila por pago, con su valor, su fecha y su método', async () => {
    await mostrarDetalle({ pagos: () => [PAGO_3, PAGO_2] });

    expect(screen.getByText('Tus pagos de este mes')).toBeOnTheScreen();
    expect(screen.getByText('Pago de tarjeta')).toBeOnTheScreen();
    expect(screen.getByText('$ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('15 de noviembre de 2026 · Transferencia')).toBeOnTheScreen();
    expect(screen.getByText('Abono de la quincena')).toBeOnTheScreen();
    expect(screen.getByText('$ 50.000')).toBeOnTheScreen();
    expect(screen.getByText('10 de noviembre de 2026 · Efectivo')).toBeOnTheScreen();
  });

  it('CA-RF32-F31 las filas salen en el orden del backend: la pantalla no reordena ni agrupa', async () => {
    await mostrarDetalle({ pagos: () => [PAGO_2, PAGO_3] });

    const texto = plano();
    expect(texto.indexOf('Abono de la quincena')).toBeGreaterThan(-1);
    expect(texto.indexOf('Abono de la quincena')).toBeLessThan(texto.indexOf('Pago de tarjeta'));
  });

  it('CA-RF32-F31 un pago de hoy dice "Hoy" y uno de ayer dice "Ayer"', async () => {
    await mostrarDetalle({
      pagos: () => [
        pagoDe('pago-hoy', { valor: 30000, fecha: '2026-11-19', descripcion: 'Pago de hoy' }),
        pagoDe('pago-ayer', {
          valor: 20000,
          fecha: '2026-11-18',
          metodoPago: 'DEBITO',
          descripcion: 'Pago de ayer',
        }),
      ],
    });

    expect(screen.getByText('Hoy · Transferencia')).toBeOnTheScreen();
    expect(screen.getByText('Ayer · Tarjeta débito')).toBeOnTheScreen();
    expect(screen.queryByText(/19 de noviembre de 2026 ·/)).toBeNull();
    expect(screen.queryByText(/18 de noviembre de 2026 ·/)).toBeNull();
  });

  it('CA-RF32-F31 en otro mes el encabezado dice "Tus pagos de diciembre 2026"', async () => {
    await mostrarDetalle({
      pagos: (mes) => (mes === '2026-12' ? [pagoDe('pago-d', { fecha: '2026-12-05' })] : []),
    });

    await fireEvent.press(boton('Mes siguiente'));

    expect(await screen.findByText('Tus pagos de diciembre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('Tus pagos de este mes')).toBeNull();
    expect(screen.getByText('5 de diciembre de 2026 · Transferencia')).toBeOnTheScreen();
  });

  it('CA-RF32-F31 tocar una fila no abre nada: los pagos no se editan', async () => {
    await mostrarDetalle({ pagos: () => [PAGO_3, PAGO_2] });

    await fireEvent.press(screen.getByText('Abono de la quincena'));
    await act(async () => {});

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText('Nuevo pago')).toBeNull();
    expect(screen.queryByText('Editar pago')).toBeNull();
    expect(screen.queryByText(/^¿Eliminar/)).toBeNull();
    expect(registrarPagoSimulado()).not.toHaveBeenCalled();
    expect(eliminarPagoSimulado()).not.toHaveBeenCalled();
  });

  it('CA-RF32-F31 cada monto se redondea al peso, sin decimales ni "NaN"', async () => {
    await mostrarDetalle({
      pagos: () => [pagoDe('pago-d', { valor: 100000.5, fecha: '2026-11-15' })],
    });

    expect(screen.getByText('$ 100.001')).toBeOnTheScreen();
    const texto = plano();
    expect(texto).not.toMatch(/\$ [\d.]*,/);
    expect(texto).not.toMatch(/\d\.\d{1,2}(?!\d|\.)/);
    expect(texto).not.toMatch(/NaN|undefined|null/);
  });

  it('CA-RF32-F32 sin pagos en el mes no hay encabezado, ni filas, ni un aviso de "sin pagos"; lo demás sigue igual', async () => {
    await mostrarDetalle({ pagos: () => [] });

    expect(screen.queryByText(/Tus pagos de/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Eliminar el pago/ })).toBeNull();
    expect(screen.queryByText(/sin pagos|no has registrado|todavía no pagaste/i)).toBeNull();
    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(hayAlerta()).toBe(false);
  });
});

describe('Los pagos del mes: si la lista no carga', () => {
  it.each([
    ['un error del servidor (500)', new ApiError(500, 'x'), TEXTO.errorCarga],
    ['un error de datos (400)', new ApiError(400, 'x'), TEXTO.errorCarga],
    ['falta de conexión', new NetworkError(), RED],
  ])(
    'CA-RF32-F33 si la lista falla por %s avisa como cualquier otra consulta, con "Reintentar" y sin montos ni lista',
    async (_causa, error, aviso) => {
      pagosPedidos().mockRejectedValue(error);

      await dibujarDetalle();

      expect(await screen.findByText(aviso)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(aviso);
      expect(boton('Reintentar')).toBeOnTheScreen();
      expect(plano()).not.toContain('$');
      expect(screen.queryByText(/Tus pagos de/)).toBeNull();
      expect(hayCargando()).toBe(false);
    },
  );

  it('CA-RF32-F33 si la lista responde 404 ve "Esta tarjeta ya no existe." sin "Reintentar"', async () => {
    pagosPedidos().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));

    await dibujarDetalle();

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(hayBoton('Reintentar')).toBe(false);
    expect(plano()).not.toContain('$');
    expect(screen.queryByText('Tarjeta no encontrada')).toBeNull();
  });

  it('CA-RF32-F33 "Reintentar" vuelve a pedir solo la lista, una vez aunque se toque dos veces', async () => {
    pagosPedidos().mockRejectedValueOnce(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);
    const nueva = pendiente<PagoTarjeta[]>();
    pagosPedidos().mockReturnValueOnce(nueva.promesa);
    const reintentar = boton('Reintentar');

    await fireEvent.press(reintentar);
    await fireEvent.press(reintentar);

    expect(pagosPedidos()).toHaveBeenCalledTimes(2);
    expect(pagosPedidos()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);

    await act(async () => nueva.resolver([{ ...PAGO_3 }]));

    expect(await screen.findByText('Tus pagos de este mes')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(hayAlerta()).toBe(false);
    expect(pagosPedidos()).toHaveBeenCalledTimes(2);
  });
});
