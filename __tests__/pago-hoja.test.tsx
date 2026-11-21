import { ApiError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type ProyeccionTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  ANTES_DEL_PRIMER_PAGO,
  dejarHoy,
  dibujarDetalle,
  fijarHoy,
  hayBoton,
  mostrarDetalle,
  pagosPedidos,
  proyeccionPedida,
  servirDetalle,
  tarjetaPedida,
  TEXTO,
  VISA,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import {
  abrirHoja,
  botonGuardarPago,
  campoNota,
  campoValor,
  clavesDePago,
  cuerposDePago,
  escribirNota,
  escribirValor,
  eliminarPagoSimulado,
  hojaAbierta,
  mostrarHojaLlena,
  mostrarHojaVacia,
  pagoRegistradoDe,
  registrarPagoSimulado,
  TEXTO_PAGO,
  volverDeLaHojaDePago,
} from './ayudas/pago-tarjeta';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, laHoja, pendiente, UUID, VER_TODO } from './ayudas/tarjetas';

// Registrar un pago desde el detalle de la tarjeta: el botón, la hoja "Nuevo pago", la validación y lo que se envía
// al guardar (criterios/05-pago-de-tarjeta.md, CA-RF32-F01 a F12). El backend se simula en el borde del adaptador
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
  registrarPagoSimulado().mockReset().mockResolvedValue(pagoRegistradoDe());
  servirDetalle();
});
afterEach(() => dejarHoy());

const tocar = (nombre: string) => fireEvent.press(boton(nombre));
const hayAlerta = () => screen.queryByRole('alert') !== null;

describe('Registrar un pago: el botón del detalle', () => {
  it('CA-RF32-F01 con los datos de la tarjeta cargados, "Registrar un pago" se ve junto a "Editar tarjeta" y "Ver cargos fijos"', async () => {
    await mostrarDetalle();

    expect(boton('Registrar un pago')).toBeOnTheScreen();
    expect(boton('Editar tarjeta')).toBeOnTheScreen();
    expect(boton('Ver cargos fijos')).toBeOnTheScreen();
  });

  it('CA-RF32-F01 también se ve mientras se carga otro mes', async () => {
    await mostrarDetalle();
    proyeccionPedida().mockReturnValueOnce(pendiente<ProyeccionTarjeta>().promesa);

    await tocar('Mes siguiente');

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(boton('Registrar un pago')).toBeOnTheScreen();
  });

  it('CA-RF32-F01 también se ve si la proyección falló, mientras la tarjeta haya respondido', async () => {
    proyeccionPedida().mockRejectedValue(new ApiError(500, 'x'));

    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    expect(boton('Registrar un pago')).toBeOnTheScreen();
  });

  it('CA-RF32-F01 no se ve mientras la tarjeta no responde, aunque ya hayan llegado las cifras; al llegar se ve', async () => {
    const tarjeta = pendiente<Tarjeta>();
    tarjetaPedida().mockReturnValue(tarjeta.promesa);

    await dibujarDetalle();
    await screen.findByText(TEXTO.esteMes);

    expect(hayBoton('Registrar un pago')).toBe(false);

    await act(async () => tarjeta.resolver({ ...VISA }));

    expect(await screen.findByRole('button', { name: 'Registrar un pago' })).toBeOnTheScreen();
  });

  it('CA-RF32-F01 no se ve si la tarjeta falló', async () => {
    tarjetaPedida().mockRejectedValue(new ApiError(500, 'x'));

    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    expect(hayBoton('Registrar un pago')).toBe(false);
  });

  it.each([
    ['la proyección', () => proyeccionPedida().mockRejectedValue(new ApiError(404, 'x'))],
    ['la tarjeta', () => tarjetaPedida().mockRejectedValue(new ApiError(404, 'x'))],
  ])(
    'CA-RF32-F01 no se ve en "Esta tarjeta ya no existe." (404 en %s)',
    async (_consulta, fallar) => {
      fallar();

      await dibujarDetalle();
      await screen.findByText(TEXTO.yaNoExiste);

      expect(hayBoton('Registrar un pago')).toBe(false);
    },
  );
});

describe('Registrar un pago: la hoja "Nuevo pago"', () => {
  it('CA-RF32-F02 al tocar "Registrar un pago" se abre la hoja con el valor vacío, hoy, transferencia, la nota vacía y "Guardar pago"', async () => {
    await mostrarHojaVacia();

    expect(screen.getByText('Nuevo pago')).toBeOnTheScreen();
    expect(screen.getByText('Valor del pago')).toBeOnTheScreen();
    expect(campoValor()).toHaveDisplayValue('');
    expect(screen.getByPlaceholderText('$ 0')).toBeOnTheScreen();
    expect(screen.getByText('Fecha del pago')).toBeOnTheScreen();
    expect(boton('Hoy')).toBeSelected();
    expect(screen.getByText('jueves, 19 de noviembre de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Cómo pagaste')).toBeOnTheScreen();
    expect(boton('Transferencia')).toBeSelected();
    expect(screen.getByText('Nota (opcional)')).toBeOnTheScreen();
    expect(campoNota()).toHaveDisplayValue('');
    expect(boton('Guardar pago')).toBeOnTheScreen();
  });

  it('CA-RF32-F02 abrir la hoja no llama a ningún adaptador y el detalle de atrás queda como estaba', async () => {
    await mostrarHojaVacia();

    expect(registrarPagoSimulado()).not.toHaveBeenCalled();
    expect(eliminarPagoSimulado()).not.toHaveBeenCalled();
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Visa Bancolombia', VER_TODO)).toBeOnTheScreen();
    expect(screen.getByText('noviembre 2026', VER_TODO)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.vacia, VER_TODO)).toBeOnTheScreen();
  });

  it('CA-RF32-F03 "Volver" cierra la hoja sin guardar y deja el detalle como estaba', async () => {
    await mostrarHojaLlena();
    await escribirNota('Cuota de noviembre');

    await fireEvent.press(volverDeLaHojaDePago());

    await waitFor(() => expect(hojaAbierta()).toBe(false));
    expect(registrarPagoSimulado()).not.toHaveBeenCalled();
    expect(eliminarPagoSimulado()).not.toHaveBeenCalled();
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.vacia)).toBeOnTheScreen();
  });

  it('CA-RF32-F03 al volver a abrir la hoja, el formulario está limpio: sin el valor, la fecha, el método ni la nota de antes', async () => {
    await mostrarHojaLlena();
    await escribirNota('Cuota de noviembre');
    await tocar('Ayer');
    await tocar('Efectivo');
    await fireEvent.press(volverDeLaHojaDePago());
    await waitFor(() => expect(hojaAbierta()).toBe(false));

    await abrirHoja();

    expect(campoValor()).toHaveDisplayValue('');
    expect(campoNota()).toHaveDisplayValue('');
    expect(boton('Hoy')).toBeSelected();
    expect(boton('Ayer')).not.toBeSelected();
    expect(screen.getByText('jueves, 19 de noviembre de 2026')).toBeOnTheScreen();
    expect(boton('Transferencia')).toBeSelected();
    expect(boton('Efectivo')).not.toBeSelected();
    expect(hayAlerta()).toBe(false);
  });

  it('CA-RF32-F04 el valor se escribe en pesos con puntos de miles y se anuncia como "Monto en pesos"', async () => {
    await mostrarHojaVacia();

    await escribirValor('346270');

    expect(campoValor()).toHaveDisplayValue('$ 346.270');
  });

  it('CA-RF32-F04 el campo solo admite dígitos, sin ceros a la izquierda y hasta 12 dígitos', async () => {
    await mostrarHojaVacia();

    await escribirValor('abc');
    expect(campoValor()).toHaveDisplayValue('');

    await escribirValor('-3a4b5');
    expect(campoValor()).toHaveDisplayValue('$ 345');

    await escribirValor('0012');
    expect(campoValor()).toHaveDisplayValue('$ 12');

    await escribirValor('1234567890123');
    expect(campoValor()).toHaveDisplayValue('$ 123.456.789.012');
  });

  it('CA-RF32-F05 "Ayer" queda elegida y la fecha en letras pasa a ser la de ayer', async () => {
    await mostrarHojaVacia();

    await tocar('Ayer');

    expect(boton('Ayer')).toBeSelected();
    expect(boton('Hoy')).not.toBeSelected();
    expect(screen.getByText('miércoles, 18 de noviembre de 2026')).toBeOnTheScreen();
    expect(screen.queryByText('jueves, 19 de noviembre de 2026')).toBeNull();
  });

  it('CA-RF32-F05 "Otra fecha" muestra el calendario y al tocar un día la fecha en letras pasa a ser esa; "Hoy" vuelve a la de hoy', async () => {
    await mostrarHojaVacia();

    await tocar('Otra fecha');
    expect(boton('Otra fecha')).toBeSelected();
    expect(laHoja().getByLabelText('Mes siguiente')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('jueves, 5 de noviembre de 2026'));

    expect(screen.getByText('jueves, 5 de noviembre de 2026')).toBeOnTheScreen();
    expect(screen.queryByText('jueves, 19 de noviembre de 2026')).toBeNull();

    await tocar('Hoy');

    expect(boton('Hoy')).toBeSelected();
    expect(screen.getByText('jueves, 19 de noviembre de 2026')).toBeOnTheScreen();
    expect(screen.queryByText('jueves, 5 de noviembre de 2026')).toBeNull();
  });

  it('CA-RF32-F05 el calendario no restringe días pasados ni futuros', async () => {
    await mostrarHojaVacia();
    await tocar('Otra fecha');

    const dia = (etiqueta: string) => screen.getByLabelText(etiqueta);
    expect(dia('domingo, 1 de noviembre de 2026')).toBeEnabled();
    expect(dia('miércoles, 25 de noviembre de 2026')).toBeEnabled();
    await fireEvent.press(dia('miércoles, 25 de noviembre de 2026'));
    expect(screen.getByText('miércoles, 25 de noviembre de 2026')).toBeOnTheScreen();
    await fireEvent.press(dia('domingo, 1 de noviembre de 2026'));
    expect(screen.getByText('domingo, 1 de noviembre de 2026')).toBeOnTheScreen();

    await fireEvent.press(laHoja().getByLabelText('Mes siguiente'));
    await fireEvent.press(screen.getByLabelText('martes, 15 de diciembre de 2026'));
    expect(screen.getByText('martes, 15 de diciembre de 2026')).toBeOnTheScreen();
  });

  it('CA-RF32-F06 el método elegido se marca y deja de estarlo el anterior: efectivo, tarjeta débito o transferencia', async () => {
    await mostrarHojaVacia();
    expect(boton('Transferencia')).toBeSelected();

    await tocar('Efectivo');
    expect(boton('Efectivo')).toBeSelected();
    expect(boton('Transferencia')).not.toBeSelected();
    expect(boton('Tarjeta débito')).not.toBeSelected();

    await tocar('Tarjeta débito');
    expect(boton('Tarjeta débito')).toBeSelected();
    expect(boton('Efectivo')).not.toBeSelected();
    expect(boton('Transferencia')).not.toBeSelected();

    await tocar('Transferencia');
    expect(boton('Transferencia')).toBeSelected();
    expect(boton('Tarjeta débito')).not.toBeSelected();
  });

  it('CA-RF32-F06 no hay una opción de tarjeta de crédito: no se paga una tarjeta con otra', async () => {
    await mostrarHojaVacia();

    expect(laHoja().queryByRole('button', { name: 'Tarjeta crédito' })).toBeNull();
    expect(laHoja().queryByText(/crédito/i)).toBeNull();
  });

  it('CA-RF32-F07 la nota es opcional y solo conserva los primeros 200 caracteres', async () => {
    await mostrarHojaVacia();

    await escribirNota('a'.repeat(150) + 'b'.repeat(100));

    expect(campoNota()).toHaveDisplayValue('a'.repeat(150) + 'b'.repeat(50));
  });
});

describe('Registrar un pago: el valor que empieza escrito', () => {
  it('CA-RF32-F08 en el mes de hoy el valor ya trae el total estimado redondeado al peso', async () => {
    await mostrarDetalle();

    await abrirHoja();

    expect(campoValor()).toHaveDisplayValue('$ 346.270');
  });

  it('CA-RF32-F08 al guardar sin tocarlo viaja lo que se ve, 346270, y no el total con decimales', async () => {
    await mostrarDetalle();
    await abrirHoja();

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    const datos = cuerposDePago()[0];
    expect(datos.valor).toBe(346270);
    expect(typeof datos.valor).toBe('number');
  });

  it('CA-RF32-F08 el usuario puede cambiarlo o borrarlo', async () => {
    await mostrarDetalle();
    await abrirHoja();

    await escribirValor('200000');
    expect(campoValor()).toHaveDisplayValue('$ 200.000');

    await escribirValor('');
    expect(campoValor()).toHaveDisplayValue('');
  });

  it('CA-RF32-F08 en otro mes empieza vacío, aunque ese mes también tenga total', async () => {
    await mostrarDetalle();
    await tocar('Mes siguiente');
    await screen.findByText('Pagas en diciembre 2026');

    await abrirHoja();

    expect(campoValor()).toHaveDisplayValue('');
  });

  it('CA-RF32-F08 si el total es 0 empieza vacío', async () => {
    await mostrarDetalle({ proyeccion: (mes) => ({ ...ANTES_DEL_PRIMER_PAGO, mes }) });

    await abrirHoja();

    expect(campoValor()).toHaveDisplayValue('');
  });

  it('CA-RF32-F08 si todavía no hay cifras (la proyección está cargando) empieza vacío', async () => {
    proyeccionPedida().mockReturnValue(pendiente<ProyeccionTarjeta>().promesa);
    await dibujarDetalle();
    await screen.findByRole('button', { name: 'Registrar un pago' });

    await abrirHoja();

    expect(campoValor()).toHaveDisplayValue('');
  });

  it('CA-RF32-F08 si las cifras fallaron empieza vacío', async () => {
    proyeccionPedida().mockRejectedValue(new ApiError(500, 'x'));
    await dibujarDetalle();
    await screen.findByText(TEXTO.errorCarga);

    await abrirHoja();

    expect(campoValor()).toHaveDisplayValue('');
  });
});

describe('Registrar un pago: validación antes de llamar al backend', () => {
  it.each([
    ['vacío', ''],
    ['en cero', '0'],
  ])(
    'CA-RF32-F09 con el valor %s avisa "Escribe un valor mayor que cero." como alerta y no envía nada',
    async (_caso, valor) => {
      await mostrarHojaVacia();
      await escribirValor(valor);

      await fireEvent.press(botonGuardarPago());

      expect(await screen.findByText(TEXTO_PAGO.valorVacio)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO_PAGO.valorVacio);
      expect(registrarPagoSimulado()).not.toHaveBeenCalled();
      expect(hojaAbierta()).toBe(true);
    },
  );

  it.each([
    ['el valor', () => escribirValor('5000')],
    ['la fecha', () => tocar('Ayer')],
    ['el método', () => tocar('Efectivo')],
    ['la nota', () => escribirNota('Cuota')],
  ])('CA-RF32-F09 el aviso desaparece al cambiar %s', async (_campo, cambiar) => {
    await mostrarHojaVacia();
    await fireEvent.press(botonGuardarPago());
    await screen.findByText(TEXTO_PAGO.valorVacio);

    await cambiar();

    expect(screen.queryByText(TEXTO_PAGO.valorVacio)).toBeNull();
    expect(hayAlerta()).toBe(false);
  });
});

describe('Registrar un pago: guardar', () => {
  it('CA-RF32-F10 "Guardar pago" envía el pago con una clave UUID y solo lo necesario: valor, fecha y método', async () => {
    await mostrarHojaLlena('100000');

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    expect(registrarPagoSimulado()).toHaveBeenCalledWith(
      VISA_ID,
      { valor: 100000, fecha: '2026-11-19', metodoPago: 'TRANSFERENCIA' },
      expect.stringMatching(UUID),
    );
  });

  it('CA-RF32-F10 el valor es un número y el cuerpo no lleva descripcion, tarjetaId, tipo, monto ni categoriaId', async () => {
    await mostrarHojaLlena('100000');

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    const datos = cuerposDePago()[0];
    expect(typeof datos.valor).toBe('number');
    expect(Object.keys(datos).sort()).toEqual(['fecha', 'metodoPago', 'valor']);
  });

  it('CA-RF32-F11 con "Ayer", "Efectivo" y una nota con espacios se envía lo elegido, con la nota sin los espacios de los extremos', async () => {
    await mostrarHojaLlena('100000');
    await tocar('Ayer');
    await tocar('Efectivo');
    await escribirNota('  Cuota de noviembre  ');

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    expect(registrarPagoSimulado()).toHaveBeenCalledWith(
      VISA_ID,
      {
        valor: 100000,
        fecha: '2026-11-18',
        metodoPago: 'EFECTIVO',
        descripcion: 'Cuota de noviembre',
      },
      expect.stringMatching(UUID),
    );
  });

  it('CA-RF32-F11 con "Tarjeta débito" el método es DEBITO', async () => {
    await mostrarHojaLlena('100000');
    await tocar('Tarjeta débito');

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    expect(cuerposDePago()[0].metodoPago).toBe('DEBITO');
  });

  it('CA-RF32-F11 con otra fecha elegida en el calendario (el 5 de noviembre) la fecha es 2026-11-05', async () => {
    await mostrarHojaLlena('100000');
    await tocar('Otra fecha');
    await fireEvent.press(screen.getByLabelText('jueves, 5 de noviembre de 2026'));

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    expect(cuerposDePago()[0].fecha).toBe('2026-11-05');
  });

  it('CA-RF32-F11 con una nota de solo espacios no se envía descripcion', async () => {
    await mostrarHojaLlena('100000');
    await escribirNota('     ');

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    expect(Object.keys(cuerposDePago()[0]).sort()).toEqual(['fecha', 'metodoPago', 'valor']);
  });

  it('CA-RF32-F12 mientras guarda, el botón muestra un indicador en lugar de su texto, no se puede tocar y la hoja sigue abierta con lo escrito', async () => {
    const respuesta = pendiente<ReturnType<typeof pagoRegistradoDe>>();
    await mostrarHojaLlena('100000');
    await escribirNota('Cuota');
    registrarPagoSimulado().mockReturnValueOnce(respuesta.promesa);
    const guardar = botonGuardarPago();

    await fireEvent.press(guardar);

    expect(screen.queryByText('Guardar pago')).toBeNull();
    expect(guardar).toBeDisabled();
    expect(screen.getByText('Nuevo pago')).toBeOnTheScreen();
    expect(campoValor()).toHaveDisplayValue('$ 100.000');
    expect(campoNota()).toHaveDisplayValue('Cuota');
    await act(async () => respuesta.resolver(pagoRegistradoDe()));
  });

  it('CA-RF32-F12 dos toques seguidos en "Guardar pago" llaman una sola vez, con una sola clave', async () => {
    const respuesta = pendiente<ReturnType<typeof pagoRegistradoDe>>();
    await mostrarHojaLlena('100000');
    registrarPagoSimulado().mockReturnValueOnce(respuesta.promesa);
    const guardar = botonGuardarPago();

    await fireEvent.press(guardar);
    await fireEvent.press(guardar);

    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1);
    await act(async () => respuesta.resolver(pagoRegistradoDe()));
    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1);
    expect(clavesDePago()).toHaveLength(1);
  });
});
