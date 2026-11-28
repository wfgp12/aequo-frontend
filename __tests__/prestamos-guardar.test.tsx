import { ApiError, NetworkError } from '@/lib/api/client';
import type { PrestamoRegistrado } from '@/lib/api/deudas';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { conCodigo } from './ayudas/errores';
import {
  aLaFecha,
  aLaNota,
  atras,
  BANCOLOMBIA,
  campoValor,
  claveEnviada,
  datosEnviados,
  dejarHoy,
  elegirPersona,
  fijarHoy,
  guardar,
  hastaInteres,
  hastaQuien,
  hastaResumen,
  listar,
  nuevoPrestamista,
  PAPA,
  plano,
  registrado,
  registrar,
  siguiente,
  TEXTO,
  vecesQueVolvio,
} from './ayudas/prestamos';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, pendiente, RED, UUID } from './ayudas/tarjetas';

// Guardar un préstamo (criterios/06-prestamos.md, CA-RF34-F16 a F18, F20 y F21 y CA-RF35-F04). El backend se
// simula en el borde del adaptador; hoy es el 28 de noviembre de 2026.
jest.mock('expo-router', () => {
  const simulado = require('./ayudas/router-simulado');
  return {
    ...simulado.expoRouterSimulado(),
    useRouter: () => ({ ...simulado.router, canGoBack: () => true }),
  };
});
jest.mock('@/lib/api/deudas', () => ({
  listarDeudas: jest.fn(),
  registrarPrestamo: jest.fn(),
  eliminarPrestamo: jest.fn(),
}));

const BASE = { acreedor: 'Juan', monto: 500000, fecha: '2026-11-28', tipoInteres: 'SIN_INTERES' };
const nota = () => screen.getByLabelText('Nota');

async function guardado() {
  await guardar();
  await screen.findByText('¡Listo!');
}

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  listar().mockReset().mockResolvedValue([BANCOLOMBIA, PAPA]);
  registrar().mockReset().mockResolvedValue(registrado());
});
afterEach(() => dejarHoy());

describe('Guardar el préstamo: lo que se envía', () => {
  it('CA-RF34-F16 envía lo elegido una sola vez, con una clave UUID y sin otros campos', async () => {
    await hastaResumen();

    await guardado();

    expect(registrar()).toHaveBeenCalledTimes(1);
    expect(datosEnviados()).toStrictEqual(BASE);
    expect(claveEnviada()).toMatch(UUID);
  });

  it('CA-RF34-F16 envía el valor escrito, la fecha de ayer y la nota recortada', async () => {
    await hastaInteres('Marta', '1250000');
    await aLaFecha();
    await fireEvent.press(boton('Ayer'));
    await aLaNota();
    await fireEvent.changeText(nota(), '  Para el arriendo  ');

    await guardado();

    expect(datosEnviados()).toStrictEqual({
      acreedor: 'Marta',
      monto: 1250000,
      fecha: '2026-11-27',
      tipoInteres: 'SIN_INTERES',
      descripcion: 'Para el arriendo',
    });
  });

  it('CA-RF34-F16 una nota de solo espacios no se envía', async () => {
    await hastaResumen();
    await fireEvent.changeText(nota(), '    ');

    await guardado();

    expect(datosEnviados()).toStrictEqual(BASE);
  });

  it('CA-RF34-F17 mientras guarda muestra un indicador y el doble toque no repite', async () => {
    const respuesta = pendiente<PrestamoRegistrado>();
    registrar().mockReturnValue(respuesta.promesa);
    await hastaResumen();
    const botonGuardar = boton('Guardar');

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(registrar()).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Guardar')).toBeNull();
    expect(botonGuardar).toBeDisabled();
    expect(atras()).toBeDisabled();

    await act(async () => respuesta.resolver(registrado()));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(registrar()).toHaveBeenCalledTimes(1);
  });
});

describe('Guardar el préstamo: la confirmación', () => {
  it('CA-RF34-F18 un préstamo nuevo: dice quién prestó cuánto y "Listo" regresa a "Mis préstamos"', async () => {
    await hastaResumen();

    await guardado();

    expect(screen.getByText('Registramos que Juan te prestó $ 500.000.')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.dineroRecibido)).toBeOnTheScreen();

    await fireEvent.press(boton('Listo'));

    expect(vecesQueVolvio()).toBe(1);
  });

  it('CA-RF35-F04 al sumar a una deuda dice cuánto se sumó, nunca el total', async () => {
    registrar().mockResolvedValue(registrado('Papá', 200000, false));
    await hastaQuien('200000');
    await elegirPersona('Papá');
    await aLaNota();

    await guardado();

    expect(screen.getByText('Sumamos $ 200.000 a lo que ya le debes a Papá.')).toBeOnTheScreen();
    expect(screen.queryByText(/te prestó/)).toBeNull();
    // Lo que ya debía (200.000 + 500.000) no se suma en la app
    expect(plano()).not.toMatch(/700\.000|900\.000|total/i);
  });
});

describe('Guardar el préstamo: errores', () => {
  const del = (status: number, code: string) =>
    conCodigo(status, code, 'mensaje del servidor', 'acción del servidor');

  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['409 en proceso', del(409, 'IDEMPOTENCIA_EN_PROCESO'), TEXTO.enProceso],
    ['409 interés distinto', del(409, 'DEUDA_INTERES_DISTINTO'), TEXTO.interesDistinto],
    ['409 registro simultáneo', del(409, 'DEUDA_REGISTRO_SIMULTANEO'), TEXTO.simultaneo],
    ['400', del(400, 'VALIDACION'), TEXTO.errorGuardar],
    ['422', del(422, 'IDEMPOTENCIA_CLAVE_REUTILIZADA'), TEXTO.errorGuardar],
    ['500', del(500, 'ERROR_INTERNO'), TEXTO.errorGuardar],
    ['500 sin code', new ApiError(500, 'Internal server error'), TEXTO.errorGuardar],
  ])(
    'CA-RF34-F20 %s: avisa como alerta, el resumen sigue y puede volver a guardar',
    async (_caso, fallo, mensaje) => {
      registrar().mockRejectedValueOnce(fallo);
      await hastaResumen();

      await guardar();

      expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
      expect(plano()).toContain('Valor $ 500.000');
      expect(plano()).toContain('Te prestó Juan');
      expect(plano()).not.toContain(fallo.message);
      expect(plano()).not.toContain('acción del servidor');

      await guardado();
      expect(registrar()).toHaveBeenCalledTimes(2);
    },
  );

  it('CA-RF34-F20 ante un 401 no muestra un aviso propio', async () => {
    registrar().mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await hastaResumen();

    await guardar();
    await act(async () => {});

    expect(registrar()).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('¡Listo!')).toBeNull();
  });
});

describe('Guardar el préstamo: la clave de idempotencia', () => {
  async function conUnPrimerFallo(fallo: Error = new NetworkError()) {
    registrar().mockRejectedValueOnce(fallo);
    await hastaResumen();
    await guardar();
    await screen.findByRole('alert');
  }

  async function otraClave() {
    await guardado();
    expect(registrar()).toHaveBeenCalledTimes(2);
    expect(claveEnviada(1)).toMatch(UUID);
    expect(claveEnviada(1)).not.toBe(claveEnviada(0));
  }

  async function retroceder(hasta: string[]) {
    for (const titulo of hasta) {
      await fireEvent.press(atras());
      await screen.findByText(titulo);
    }
  }

  it('CA-RF34-F21 reintentar sin cambiar nada usa la misma clave y los mismos datos', async () => {
    await conUnPrimerFallo();

    await guardado();

    expect(claveEnviada(1)).toBe(claveEnviada(0));
    expect(datosEnviados(1)).toStrictEqual(datosEnviados(0));
  });

  it('CA-RF34-F21 si cambia la nota, la clave es nueva', async () => {
    await conUnPrimerFallo();

    await fireEvent.changeText(nota(), 'Para el arriendo');

    await otraClave();
  });

  it('CA-RF34-F21 si cambia la fecha, la clave es nueva', async () => {
    await conUnPrimerFallo();

    await retroceder(['¿Cuándo fue?']);
    await fireEvent.press(boton('Ayer'));
    await aLaNota();

    await otraClave();
  });

  it('CA-RF34-F21 si cambia el interés, la clave es nueva', async () => {
    await conUnPrimerFallo();

    await retroceder(['¿Cuándo fue?', '¿Tiene interés?']);
    await fireEvent.press(boton('Valor fijo'));
    await fireEvent.changeText(campoValor(), '50000');
    await aLaFecha();
    await aLaNota();

    await otraClave();
  });

  it('CA-RF34-F21 si cambia quién prestó, la clave es nueva', async () => {
    await conUnPrimerFallo();

    await retroceder(['¿Cuándo fue?', '¿Tiene interés?', '¿Quién te prestó?']);
    await elegirPersona('Papá');
    await aLaNota();

    await otraClave();
    expect(datosEnviados(1).acreedor).toBe('Papá');
  });

  it('CA-RF34-F21 si cambia el valor, la clave es nueva', async () => {
    await conUnPrimerFallo();

    await retroceder([
      '¿Cuándo fue?',
      '¿Tiene interés?',
      '¿Quién te prestó?',
      '¿Cuánto te prestaron?',
    ]);
    await fireEvent.changeText(campoValor(), '750000');
    await fireEvent.press(siguiente());
    await screen.findByText('¿Quién te prestó?');
    await nuevoPrestamista('Juan');
    await screen.findByText('¿Tiene interés?');
    await aLaFecha();
    await aLaNota();

    await otraClave();
    expect(datosEnviados(1).monto).toBe(750000);
  });

  it('CA-RF34-F21 si la clave ya se usó, el siguiente intento lleva una nueva', async () => {
    await conUnPrimerFallo(conCodigo(422, 'IDEMPOTENCIA_CLAVE_REUTILIZADA'));

    await otraClave();
  });
});
