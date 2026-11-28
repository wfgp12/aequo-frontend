import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarPagos,
  listarTarjetas,
  type ProyeccionTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  anterior,
  ANTES_DEL_PRIMER_PAGO,
  dejarHoy,
  dibujarDetalle,
  fijarHoy,
  hayBoton,
  hayCargando,
  hayTexto,
  mesesDePagosPedidos,
  mesesPedidos,
  mostrarDetalle,
  plano,
  proyeccionPedida,
  servirDetalle,
  siguiente,
  SOLO_CARGOS,
  tarjetaPedida,
  TEXTO,
  VACIA,
  VISA,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import { conCodigo, rutaNoEncontrada } from './ayudas/errores';
import { reiniciarRouter, router } from './ayudas/router-simulado';
import { boton, pendiente, RED } from './ayudas/tarjetas';

// Detalle de la tarjeta: casos con ceros, errores, reintentos, tarjeta que ya no existe y cuándo aparecen los
// botones de la tarjeta (criterios/05-detalle-de-tarjeta.md, CA-RF30-F15 a F23 y F30). El backend se simula en el
// borde del adaptador. Hoy es el 19 de noviembre de 2026.
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
  servirDetalle();
});
afterEach(() => dejarHoy());

const hayAlerta = () => screen.queryByRole('alert') !== null;
const sinCifras = () => {
  expect(plano()).not.toContain('$');
  expect(hayTexto(TEXTO.esteMes)).toBe(false);
  expect(hayTexto(TEXTO.proximos)).toBe(false);
  expect(hayTexto(TEXTO.vacia)).toBe(false);
};
const conTitulo = () => {
  expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
  expect(boton('Volver')).toBeOnTheScreen();
  expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
};
const sinBotonesDeLaTarjeta = () => {
  expect(hayBoton('Editar tarjeta')).toBe(false);
  expect(hayBoton('Ver cargos fijos')).toBe(false);
};

describe('Detalle de la tarjeta: casos con ceros', () => {
  it('CA-RF30-F15 un mes sin pagos pero con cuotas más adelante muestra "$ 0" y lo que queda por pagar, sin el aviso de "sin pagos"', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...ANTES_DEL_PRIMER_PAGO, mes }) });

    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(screen.getByText('$ 0')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 0')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 0')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.porPagarEsteMes)).toBeOnTheScreen();
    expect(screen.getByText('$ 1.437.626')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.proximos)).toBeOnTheScreen();
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.vacia)).toBe(false);
    expect(hayAlerta()).toBe(false);
  });

  it('CA-RF30-F16 una tarjeta con solo cargos fijos muestra el total, "$ 0" por pagar después y no "Próximos meses"', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...SOLO_CARGOS, mes }) });

    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(screen.getByText('$ 55.000')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 0')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.porPagarEsteMes)).toBeOnTheScreen();
    expect(screen.getByLabelText('Te queda por pagar después de este mes, $ 0')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.proximos)).toBe(false);
    expect(hayTexto(TEXTO.vacia)).toBe(false);
  });

  it('CA-RF30-F17 una tarjeta sin compras ni cargos muestra un texto amigable y el selector, sin tablas vacías', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });

    expect(screen.getByText(TEXTO.vacia)).toBeOnTheScreen();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.esteMes)).toBeNull();
    expect(screen.queryByText('$ 0')).toBeNull();
    expect(plano()).not.toContain('$');
    expect(screen.queryByText(/^Cuotas/)).toBeNull();
    expect(screen.queryByText(/^Cargos fijos/)).toBeNull();
    expect(screen.queryByText(/Te queda por pagar/)).toBeNull();
    expect(screen.queryByText(TEXTO.proximos)).toBeNull();
    expect(hayAlerta()).toBe(false);
  });

  it('CA-RF30-F17 en una tarjeta sin pagos los botones "Editar tarjeta" y "Ver cargos fijos" siguen disponibles', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...VACIA, mes }) });

    expect(boton('Editar tarjeta')).toBeOnTheScreen();
    expect(boton('Ver cargos fijos')).toBeOnTheScreen();
  });
});

describe('Detalle de la tarjeta: cuando una consulta falla', () => {
  it.each([500, 400])(
    'CA-RF30-F18 si la proyección responde %s avisa con "Reintentar", sin montos, y el título, "Volver" y el selector siguen',
    async (status) => {
      proyeccionPedida().mockRejectedValue(new ApiError(status, 'mensaje del backend'));

      await dibujarDetalle();

      expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
      expect(boton('Reintentar')).toBeOnTheScreen();
      sinCifras();
      conTitulo();
      expect(screen.queryByText('mensaje del backend')).toBeNull();
      expect(hayCargando()).toBe(false);
    },
  );

  it.each([500, 400])(
    'CA-RF30-F18 si la tarjeta responde %s avisa igual y tampoco se ven "Editar tarjeta" ni "Ver cargos fijos"',
    async (status) => {
      tarjetaPedida().mockRejectedValue(new ApiError(status, 'mensaje del backend'));

      await dibujarDetalle();

      expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
      expect(boton('Reintentar')).toBeOnTheScreen();
      sinCifras();
      conTitulo();
      sinBotonesDeLaTarjeta();
      expect(screen.queryByText('mensaje del backend')).toBeNull();
    },
  );

  it('CA-RF30-F19 sin conexión avisa con "Reintentar" y el título, "Volver" y el selector siguen visibles', async () => {
    proyeccionPedida().mockRejectedValue(new NetworkError());

    await dibujarDetalle();

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(RED);
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.errorCarga)).toBe(false);
    conTitulo();
    sinCifras();
  });

  it('CA-RF30-F19 sin conexión al pedir la tarjeta avisa igual', async () => {
    tarjetaPedida().mockRejectedValue(new NetworkError());

    await dibujarDetalle();

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(boton('Reintentar')).toBeOnTheScreen();
    conTitulo();
  });
});

describe('Detalle de la tarjeta: "Reintentar"', () => {
  it('CA-RF30-F20 si falló la proyección, "Reintentar" vuelve a pedir solo la proyección de ese mes, una vez aunque se toque dos veces', async () => {
    proyeccionPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);
    const nueva = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(nueva.promesa);
    const reintentar = boton('Reintentar');

    await fireEvent.press(reintentar);
    await fireEvent.press(reintentar);

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(hayTexto(TEXTO.errorCarga)).toBe(false);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    // Solo se vuelve a pedir lo que falló: los pagos del mes ya habían llegado (CA-RF32-F33)
    expect(listarPagos).toHaveBeenCalledTimes(1);

    await act(async () => nueva.resolver({ ...ANTES_DEL_PRIMER_PAGO }));

    expect(await screen.findByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);
    expect(hayAlerta()).toBe(false);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
  });

  it('CA-RF30-F20 si falló la tarjeta, "Reintentar" vuelve a pedir solo la tarjeta, una vez aunque se toque dos veces', async () => {
    tarjetaPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);
    const reintentar = boton('Reintentar');

    await fireEvent.press(reintentar);
    await fireEvent.press(reintentar);

    expect(tarjetaPedida()).toHaveBeenCalledTimes(2);
    expect(tarjetaPedida()).toHaveBeenLastCalledWith(VISA_ID);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Editar tarjeta' })).toBeOnTheScreen();
    expect(await screen.findByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(tarjetaPedida()).toHaveBeenCalledTimes(2);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(listarPagos).toHaveBeenCalledTimes(1);
  });

  it('CA-RF30-F20 si fallaron las dos, "Reintentar" las vuelve a pedir una vez cada una', async () => {
    tarjetaPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    proyeccionPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    await fireEvent.press(boton('Reintentar'));

    await screen.findByRole('button', { name: 'Editar tarjeta' });
    expect(tarjetaPedida()).toHaveBeenCalledTimes(2);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(listarPagos).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(TEXTO.esteMes)).toBeOnTheScreen();
  });

  it('CA-RF30-F20 pide el mes que se estaba viendo, no el de hoy', async () => {
    await mostrarDetalle();
    proyeccionPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    await fireEvent.press(anterior());
    await screen.findByText(TEXTO.errorCarga);

    await fireEvent.press(boton('Reintentar'));

    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(3));
    expect(mesesPedidos()).toEqual(['2026-11', '2026-10', '2026-10']);
    // Los pagos de octubre llegaron bien: no se vuelven a pedir al reintentar (CA-RF32-F33)
    expect(mesesDePagosPedidos()).toEqual(['2026-11', '2026-10']);
    expect(screen.getByText('octubre 2026')).toBeOnTheScreen();
    expect(await screen.findByText('Pagas en octubre 2026')).toBeOnTheScreen();
  });

  it('CA-RF30-F20 si al reintentar vuelve a fallar, se ve de nuevo el aviso', async () => {
    proyeccionPedida().mockRejectedValue(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    await fireEvent.press(boton('Reintentar'));

    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
  });

  it('CA-RF30-F21 con un aviso de error, cambiar de mes lo intenta de nuevo: el aviso se va, se ve el indicador y se pide el mes nuevo', async () => {
    proyeccionPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);
    const nueva = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(nueva.promesa);

    await fireEvent.press(anterior());

    expect(hayTexto(TEXTO.errorCarga)).toBe(false);
    expect(hayAlerta()).toBe(false);
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.getByText('octubre 2026')).toBeOnTheScreen();
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-10');

    await act(async () => nueva.resolver({ ...ANTES_DEL_PRIMER_PAGO, mes: '2026-10' }));

    expect(await screen.findByText('Pagas en octubre 2026')).toBeOnTheScreen();
    expect(screen.getByText('$ 1.437.626')).toBeOnTheScreen();
  });

  it('CA-RF30-F21 con un aviso de error, "Mes siguiente" también pide el mes nuevo', async () => {
    proyeccionPedida().mockRejectedValueOnce(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    await fireEvent.press(siguiente());

    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-12');
    expect(await screen.findByText('Pagas en diciembre 2026')).toBeOnTheScreen();
    expect(hayAlerta()).toBe(false);
  });
});

describe('Detalle de la tarjeta: la tarjeta ya no existe', () => {
  const noExisteEn: [string, () => void][] = [
    [
      'la proyección',
      () => proyeccionPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada')),
    ],
    [
      'la tarjeta',
      () => tarjetaPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada')),
    ],
  ];

  it.each(noExisteEn)(
    'CA-RF30-F22 si el backend responde 404 a %s, avisa que ya no existe, sin reintentar, sin selector, sin cifras y sin botones de la tarjeta',
    async (_consulta, fallar) => {
      fallar();

      await dibujarDetalle();

      expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
      await waitFor(() => expect(hayCargando()).toBe(false));
      expect(screen.queryByText('Reintentar')).toBeNull();
      expect(hayBoton('Reintentar')).toBe(false);
      expect(hayBoton('Mes anterior')).toBe(false);
      expect(hayBoton('Mes siguiente')).toBe(false);
      expect(screen.queryByText('noviembre 2026')).toBeNull();
      sinCifras();
      sinBotonesDeLaTarjeta();
      expect(screen.queryByText('Tarjeta no encontrada')).toBeNull();
    },
  );

  it.each(noExisteEn)(
    'CA-RF30-F22 con 404 en %s, "Volver" sigue disponible y regresa a "Mis tarjetas"',
    async (_consulta, fallar) => {
      fallar();
      await dibujarDetalle();
      await screen.findByText(TEXTO.yaNoExiste);

      await fireEvent.press(boton('Volver'));

      expect(router.back).toHaveBeenCalledTimes(1);
    },
  );

  it('CA-RF30-F22 si ya había cargado y al cambiar de mes el backend responde 404, no queda nada de lo anterior', async () => {
    await mostrarDetalle();
    proyeccionPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));

    await fireEvent.press(siguiente());

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(hayBoton('Mes siguiente')).toBe(false);
    sinCifras();
    sinBotonesDeLaTarjeta();
  });

  it.each([
    ['la proyección', () => proyeccionPedida().mockRejectedValue(new ApiError(401, 'x'))],
    ['la tarjeta', () => tarjetaPedida().mockRejectedValue(new ApiError(401, 'x'))],
  ])(
    'CA-RF30-F23 ante un 401 en %s la pantalla no muestra un aviso de error propio',
    async (_consulta, fallar) => {
      fallar();

      await dibujarDetalle();
      await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(tarjetaPedida()).toHaveBeenCalledTimes(1));
      await act(async () => {});

      expect(hayAlerta()).toBe(false);
      expect(hayTexto(TEXTO.errorCarga)).toBe(false);
      expect(hayTexto(TEXTO.yaNoExiste)).toBe(false);
      expect(hayTexto(RED)).toBe(false);
      expect(hayBoton('Reintentar')).toBe(false);
    },
  );
});

describe('Detalle de la tarjeta: cuándo aparecen "Editar tarjeta" y "Ver cargos fijos"', () => {
  it('CA-RF30-F30 mientras la tarjeta no responde no se ven, aunque ya hayan llegado los pagos; al llegar se ven los dos', async () => {
    const tarjeta = pendiente<Tarjeta>();
    tarjetaPedida().mockReturnValue(tarjeta.promesa);

    await dibujarDetalle();
    await screen.findByText(TEXTO.esteMes);

    sinBotonesDeLaTarjeta();

    await act(async () => tarjeta.resolver({ ...VISA }));

    expect(await screen.findByRole('button', { name: 'Editar tarjeta' })).toBeOnTheScreen();
    expect(boton('Ver cargos fijos')).toBeOnTheScreen();
  });

  it('CA-RF30-F30 si la tarjeta falló no se ven, aunque hayan llegado los pagos', async () => {
    tarjetaPedida().mockRejectedValue(new ApiError(500, 'x'));

    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    sinBotonesDeLaTarjeta();
  });

  it('CA-RF30-F30 si la tarjeta llegó, se ven los dos aunque la proyección haya fallado', async () => {
    proyeccionPedida().mockRejectedValue(new ApiError(500, 'x'));

    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    expect(boton('Editar tarjeta')).toBeOnTheScreen();
    expect(boton('Ver cargos fijos')).toBeOnTheScreen();
  });

  it('CA-RF30-F30 si la tarjeta llegó, se ven los dos también mientras se carga otro mes', async () => {
    await mostrarDetalle();
    proyeccionPedida().mockReturnValueOnce(pendiente<ProyeccionTarjeta>().promesa);

    await fireEvent.press(siguiente());

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(boton('Editar tarjeta')).toBeOnTheScreen();
    expect(boton('Ver cargos fijos')).toBeOnTheScreen();
  });
});

// criterios/08-codigos-de-error.md
describe('Detalle de la tarjeta: códigos de error al cargar', () => {
  it('CA-RNF04-11 con TARJETA_NO_ENCONTRADA dice que ya no existe, sin "Reintentar"', async () => {
    proyeccionPedida().mockRejectedValue(conCodigo(404, 'TARJETA_NO_ENCONTRADA'));

    await dibujarDetalle();

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(hayBoton('Reintentar')).toBe(false);
  });

  it.each([
    ['CA-RNF04-15', 'una dirección que no existe', rutaNoEncontrada()],
    ['CA-RNF04-17', 'ERROR_HTTP', conCodigo(429, 'ERROR_HTTP', 'Too Many Requests')],
    ['CA-RNF04-17', 'ERROR_INTERNO', conCodigo(500, 'ERROR_INTERNO', 'Internal server error')],
  ])('%s con %s muestra el texto general y deja reintentar', async (_id, _caso, fallo) => {
    proyeccionPedida().mockRejectedValueOnce(fallo);
    await dibujarDetalle();

    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.yaNoExiste)).toBeNull();
    expect(screen.queryByText(fallo.message)).toBeNull();

    await fireEvent.press(boton('Reintentar'));

    await waitFor(() => expect(screen.queryByText(TEXTO.errorCarga)).toBeNull());
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
  });
});
