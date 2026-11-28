import { ApiError, NetworkError } from '@/lib/api/client';
import type { DeudaConPrestamos } from '@/lib/api/deudas';
import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  aLaFecha,
  aLaNota,
  atras,
  avanzar,
  BANCOLOMBIA,
  campoValor,
  datosEnviados,
  dejarHoy,
  elegirPersona,
  fijarHoy,
  guardar,
  guardarDesdeInteres,
  hastaInteres,
  hastaQuien,
  hastaResumen,
  listar,
  montarRegistro,
  nuevoPrestamista,
  PAPA,
  PAPA_PAGADA,
  plano,
  registrado,
  registrar,
  siguiente,
  TEXTO,
  vecesQueVolvio,
} from './ayudas/prestamos';
import { reiniciarRouter, router } from './ayudas/router-simulado';
import { boton, pendiente, RED, textosEnOrden } from './ayudas/tarjetas';

// Los pasos del registro de un préstamo (criterios/06-prestamos.md, CA-RF34-F10 a F15 y F19, CA-RF35-F01 a F03 y
// CA-RF36-F01 a F04). El backend se simula en el borde del adaptador; hoy es el 28 de noviembre de 2026.
let mockPuedeVolver = true;
jest.mock('expo-router', () => {
  const simulado = require('./ayudas/router-simulado');
  return {
    ...simulado.expoRouterSimulado(),
    useRouter: () => ({ ...simulado.router, canGoBack: () => mockPuedeVolver }),
  };
});
jest.mock('@/lib/api/deudas', () => ({
  listarDeudas: jest.fn(),
  registrarPrestamo: jest.fn(),
  eliminarPrestamo: jest.fn(),
}));

const NUEVO = '+ Nuevo prestamista';
const JUAN_PAGADA: DeudaConPrestamos = { ...PAPA_PAGADA, id: 'juan-pagada', acreedor: 'Juan' };
// "Papá" con un interés propio, para ver que el resumen lo conserva
const PAPA_CON_INTERES: DeudaConPrestamos = {
  ...PAPA,
  tipoInteres: 'MONTO_FIJO',
  valorInteres: 50000,
};

const porcentaje = () => screen.getByLabelText('Porcentaje de interés al mes');
const opcion = (nombre: string) => boton(nombre);

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  mockPuedeVolver = true;
  listar().mockReset().mockResolvedValue([BANCOLOMBIA, PAPA, PAPA_PAGADA]);
  registrar().mockReset().mockResolvedValue(registrado());
});
afterEach(() => dejarHoy());

describe('Paso 1 y encabezado', () => {
  it('CA-RF34-F10 pide el valor y "Siguiente" solo se puede tocar con un valor mayor que cero', async () => {
    await montarRegistro();

    expect(screen.getByText('Préstamo recibido')).toBeOnTheScreen();
    expect(boton('Cerrar')).toBeOnTheScreen();
    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    expect(screen.getByText('¿Cuánto te prestaron?')).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();

    await fireEvent.changeText(campoValor(), '0');
    expect(siguiente()).toBeDisabled();

    await fireEvent.changeText(campoValor(), '500000');
    expect(campoValor()).toHaveDisplayValue('$ 500.000');
    expect(siguiente()).not.toBeDisabled();
  });
});

describe('Paso 2: quién te prestó', () => {
  it('CA-RF34-F11 muestra cada persona una sola vez, "+ Nuevo prestamista" y "Atrás"', async () => {
    await hastaQuien();

    expect(await screen.findByRole('button', { name: 'Papá' })).toBeOnTheScreen();
    expect(screen.getByText('2 de 5')).toBeOnTheScreen();
    expect(screen.getAllByText('Papá')).toHaveLength(1);
    expect(screen.getAllByText('Bancolombia')).toHaveLength(1);
    expect(boton(NUEVO)).toBeOnTheScreen();
    expect(atras()).toBeOnTheScreen();
    const textos = textosEnOrden();
    expect(textos.indexOf('Bancolombia')).toBeLessThan(textos.indexOf('Papá'));
  });

  async function sigueElValorAlVolver() {
    await fireEvent.press(atras());
    expect(screen.getByText('¿Cuánto te prestaron?')).toBeOnTheScreen();
    expect(campoValor()).toHaveDisplayValue('$ 500.000');
  }

  it('CA-RF34-F12 mientras carga ve el indicador, y "Atrás" conserva el valor', async () => {
    listar().mockReturnValue(pendiente<DeudaConPrestamos[]>().promesa);
    await hastaQuien();

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    await sigueElValorAlVolver();
  });

  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['otro fallo', new ApiError(500, 'x'), TEXTO.errorCarga],
  ])('CA-RF34-F12 %s: avisa y permite reintentar', async (_caso, fallo, mensaje) => {
    listar().mockRejectedValueOnce(fallo);
    await hastaQuien();

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    expect(atras()).toBeOnTheScreen();

    await fireEvent.press(boton('Reintentar'));

    expect(await screen.findByRole('button', { name: 'Papá' })).toBeOnTheScreen();
  });

  it('CA-RF34-F12 si falla, "Atrás" conserva el valor', async () => {
    listar().mockRejectedValue(new NetworkError());
    await hastaQuien();
    await screen.findByText(RED);

    await sigueElValorAlVolver();
  });

  it('CA-RF34-F12 sin préstamos ve solo "+ Nuevo prestamista" y "Atrás" conserva el valor', async () => {
    listar().mockResolvedValue([]);
    await hastaQuien();

    expect(await screen.findByRole('button', { name: NUEVO })).toBeOnTheScreen();
    expect(screen.queryByText('Papá')).toBeNull();
    await sigueElValorAlVolver();
  });

  it('CA-RF34-F13 una persona nueva escribe su nombre; "Siguiente" no se puede tocar si está vacío', async () => {
    await hastaQuien();
    await fireEvent.press(await screen.findByRole('button', { name: NUEVO }));
    const campo = screen.getByLabelText('¿Cómo se llama?');

    expect(campo.props.maxLength).toBe(50);
    expect(siguiente()).toBeDisabled();
    await fireEvent.changeText(campo, '    ');
    expect(siguiente()).toBeDisabled();
    await fireEvent.changeText(campo, '  Marta  ');
    await avanzar();

    expect(await screen.findByText('¿Tiene interés?')).toBeOnTheScreen();
    await guardarDesdeInteres();
    expect(datosEnviados().acreedor).toBe('Marta');
  });
});

describe('Sumar a una deuda que ya existe', () => {
  it('CA-RF35-F01 elegir a quien ya le debes salta el interés, y "Atrás" regresa a "¿Quién te prestó?"', async () => {
    await hastaQuien();
    await elegirPersona('Papá');

    expect(screen.getByText('4 de 5')).toBeOnTheScreen();
    expect(screen.queryByText('¿Tiene interés?')).toBeNull();

    await fireEvent.press(atras());

    expect(await screen.findByText('¿Quién te prestó?')).toBeOnTheScreen();
  });

  it('CA-RF35-F01 el resumen muestra las condiciones que ya tiene y no se envía el interés', async () => {
    listar().mockResolvedValue([PAPA_CON_INTERES, PAPA_PAGADA]);
    await hastaQuien();
    await elegirPersona('Papá');
    await aLaNota();

    expect(plano()).toContain('Condiciones Interés total: $ 50.000');

    await guardar();
    await screen.findByText('¡Listo!');
    expect(datosEnviados()).toStrictEqual({
      acreedor: 'Papá',
      monto: 500000,
      fecha: '2026-11-28',
    });
  });

  it('CA-RF35-F02 escribir " papá " es lo mismo que elegir "Papá"', async () => {
    await hastaQuien();
    await screen.findByRole('button', { name: 'Papá' });
    await nuevoPrestamista(' papá ');

    expect(await screen.findByText('¿Cuándo fue?')).toBeOnTheScreen();
    expect(screen.getByText('4 de 5')).toBeOnTheScreen();
    await aLaNota();
    await guardar();
    await screen.findByText('¡Listo!');
    expect(datosEnviados()).toStrictEqual({
      acreedor: 'Papá',
      monto: 500000,
      fecha: '2026-11-28',
    });
  });

  it('CA-RF35-F02 "Papa" sin tilde es otra persona y pide el interés', async () => {
    await hastaQuien();
    await screen.findByRole('button', { name: 'Papá' });
    await nuevoPrestamista('Papa');

    expect(await screen.findByText('¿Tiene interés?')).toBeOnTheScreen();
    await guardarDesdeInteres();
    expect(datosEnviados()).toMatchObject({ acreedor: 'Papa', tipoInteres: 'SIN_INTERES' });
  });

  it('CA-RF35-F03 si las deudas de la persona están pagadas, se pregunta el interés', async () => {
    listar().mockResolvedValue([JUAN_PAGADA]);
    await hastaQuien();

    await fireEvent.press(await screen.findByRole('button', { name: 'Juan' }));

    expect(await screen.findByText('¿Tiene interés?')).toBeOnTheScreen();
    expect(screen.getByText('3 de 5')).toBeOnTheScreen();
    await guardarDesdeInteres();
    expect(datosEnviados()).toMatchObject({ acreedor: 'Juan', tipoInteres: 'SIN_INTERES' });
  });
});

describe('Paso 3: con o sin interés', () => {
  it('CA-RF36-F01 ofrece tres opciones, con "Sin interés" elegida', async () => {
    await hastaInteres();

    expect(screen.getByText('3 de 5')).toBeOnTheScreen();
    expect(opcion('Sin interés')).toBeSelected();
    expect(opcion('Cada mes')).not.toBeSelected();
    expect(opcion('Valor fijo')).not.toBeSelected();
    expect(atras()).toBeOnTheScreen();
    expect(siguiente()).not.toBeDisabled();
  });

  it('CA-RF36-F02 "Cada mes" pide el porcentaje, con coma y hasta 2 decimales', async () => {
    await hastaInteres();
    await fireEvent.press(opcion('Cada mes'));

    expect(opcion('Cada mes')).toBeSelected();
    expect(screen.getByText('Ej: 2 es 2 % al mes')).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();

    await fireEvent.changeText(porcentaje(), '1,555');

    expect(porcentaje()).toHaveDisplayValue('1,55');
  });

  it.each(['', '0', '100,01', '101'])(
    'CA-RF36-F02 con el porcentaje "%s" no se puede seguir',
    async (texto) => {
      await hastaInteres();
      await fireEvent.press(opcion('Cada mes'));

      await fireEvent.changeText(porcentaje(), '2');
      await fireEvent.changeText(porcentaje(), texto);

      expect(siguiente()).toBeDisabled();
    },
  );

  it.each([
    ['2', 0.02, 'Interés: 2 % al mes'],
    ['1,5', 0.015, 'Interés: 1,5 % al mes'],
    ['100', 1, 'Interés: 100 % al mes'],
  ])(
    'CA-RF36-F02 "%s" se envía como TASA %s y el resumen dice "%s"',
    async (texto, valorInteres, condiciones) => {
      await hastaInteres();
      await fireEvent.press(opcion('Cada mes'));
      await fireEvent.changeText(porcentaje(), texto);
      await aLaFecha();
      await aLaNota();

      expect(plano()).toContain(`Condiciones ${condiciones}`);

      await guardar();
      await screen.findByText('¡Listo!');
      expect(datosEnviados()).toStrictEqual({
        acreedor: 'Juan',
        monto: 500000,
        fecha: '2026-11-28',
        tipoInteres: 'TASA',
        valorInteres,
      });
    },
  );

  it('CA-RF36-F03 "Valor fijo" pide el interés total y se envía como MONTO_FIJO', async () => {
    await hastaInteres();
    await fireEvent.press(opcion('Valor fijo'));

    expect(screen.getByText('Es el interés total, no por mes')).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();
    await fireEvent.changeText(campoValor(), '0');
    expect(siguiente()).toBeDisabled();
    await fireEvent.changeText(campoValor(), '50000');
    await aLaFecha();
    await aLaNota();

    expect(plano()).toContain('Condiciones Interés total: $ 50.000');

    await guardar();
    await screen.findByText('¡Listo!');
    expect(datosEnviados()).toStrictEqual({
      acreedor: 'Juan',
      monto: 500000,
      fecha: '2026-11-28',
      tipoInteres: 'MONTO_FIJO',
      valorInteres: 50000,
    });
  });

  it('CA-RF36-F04 "Sin interés" no envía valorInteres, aunque antes hubiera escrito un porcentaje', async () => {
    await hastaInteres();
    await fireEvent.press(opcion('Cada mes'));
    await fireEvent.changeText(porcentaje(), '2');
    await fireEvent.press(opcion('Sin interés'));

    await guardarDesdeInteres();

    expect(datosEnviados()).toStrictEqual({
      acreedor: 'Juan',
      monto: 500000,
      fecha: '2026-11-28',
      tipoInteres: 'SIN_INTERES',
    });
  });
});

describe('Pasos 4 y 5', () => {
  it('CA-RF34-F14 la fecha ofrece "Hoy" elegida, "Ayer" y "Otra fecha", y "Atrás" vuelve al interés', async () => {
    await hastaInteres();
    await aLaFecha();

    expect(screen.getByText('4 de 5')).toBeOnTheScreen();
    expect(boton('Hoy')).toBeSelected();
    expect(boton('Ayer')).toBeOnTheScreen();
    expect(boton('Otra fecha')).toBeOnTheScreen();

    await fireEvent.press(atras());

    expect(await screen.findByText('¿Tiene interés?')).toBeOnTheScreen();
  });

  it('CA-RF34-F15 el resumen muestra valor, quién, condiciones y fecha, con la aclaración', async () => {
    listar().mockResolvedValue([]);
    await hastaResumen('Juan');

    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota')).toBeOnTheScreen();
    expect(plano()).toContain('Valor $ 500.000');
    expect(plano()).toContain('Te prestó Juan');
    expect(plano()).toContain('Condiciones Sin interés');
    expect(plano()).toContain('Fecha Hoy');
    expect(screen.getByText(TEXTO.dineroRecibido)).toBeOnTheScreen();
    expect(atras()).toBeOnTheScreen();
    expect(boton('Guardar')).toBeOnTheScreen();
    expect(plano()).not.toMatch(/Categoría|Método|cuota|total/i);
    expect(registrar()).not.toHaveBeenCalled();
  });
});

describe('Cerrar sin guardar', () => {
  const PASOS: [string, () => Promise<unknown>][] = [
    ['el valor', () => montarRegistro()],
    ['quién te prestó', () => hastaQuien()],
    ['el interés', () => hastaInteres()],
    [
      'la fecha',
      async () => {
        await hastaInteres();
        await aLaFecha();
      },
    ],
    ['el resumen', () => hastaResumen()],
  ];

  it.each(PASOS)(
    'CA-RF34-F19 "Cerrar" en %s vuelve a "Mis préstamos" sin guardar',
    async (_paso, llegar) => {
      await llegar();

      await fireEvent.press(boton('Cerrar'));
      await act(async () => {});

      expect(vecesQueVolvio()).toBe(1);
      expect(registrar()).not.toHaveBeenCalled();
    },
  );

  it('CA-RF34-F19 si no hay pantalla anterior, "Cerrar" va a "Mis préstamos"', async () => {
    mockPuedeVolver = false;
    await montarRegistro();

    await fireEvent.press(boton('Cerrar'));

    expect(router.back).not.toHaveBeenCalled();
    expect(vecesQueVolvio()).toBe(1);
  });
});
