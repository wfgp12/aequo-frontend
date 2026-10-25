import { EncabezadoRegistro } from '@/components/registro/encabezado';
import { PasoCategoria } from '@/components/registro/paso-categoria';
import { PasoDescripcion } from '@/components/registro/paso-descripcion';
import { PasoFecha } from '@/components/registro/paso-fecha';
import { PasoMetodoPago } from '@/components/registro/paso-metodo-pago';
import { PasoValor } from '@/components/registro/paso-valor';
import { NetworkError } from '@/lib/api/client';
import { listarCategorias } from '@/lib/api/categorias';
import { MAX_DESCRIPCION } from '@/lib/api/transacciones';
import { ayer, hoy } from '@/lib/fechas';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/lib/api/categorias', () => ({ listarCategorias: jest.fn() }));

const categorias = [
  { id: 'c1', nombre: 'Alimentación', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c2', nombre: 'Transporte', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c3', nombre: 'Mascotas', tipo: 'EGRESO', esPredeterminada: false, movimientos: 12 },
] as const;

describe('EncabezadoRegistro', () => {
  it('muestra el título, el avance "N de 5" y cierra con la ✕', async () => {
    const alCerrar = jest.fn();
    await render(<EncabezadoRegistro titulo="Nuevo egreso" paso={2} onCerrar={alCerrar} />);

    expect(screen.getByText('Nuevo egreso')).toBeOnTheScreen();
    expect(screen.getByText('2 de 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Paso 2 de 5')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

describe('PasoValor', () => {
  const alCambiar = jest.fn();
  const alSiguiente = jest.fn();

  beforeEach(() => {
    alCambiar.mockReset();
    alSiguiente.mockReset();
  });

  const abrir = (valor: string, tipo: 'INGRESO' | 'EGRESO' = 'EGRESO') =>
    render(<PasoValor tipo={tipo} valor={valor} onCambiar={alCambiar} onSiguiente={alSiguiente} />);

  it('pregunta según el tipo', async () => {
    await abrir('');
    expect(screen.getByText('¿Cuánto gastaste?')).toBeOnTheScreen();
    expect(screen.getByText('Pesos colombianos (COP)')).toBeOnTheScreen();
  });

  it('para un ingreso pregunta cuánto recibiste', async () => {
    await abrir('', 'INGRESO');
    expect(screen.getByText('¿Cuánto recibiste?')).toBeOnTheScreen();
  });

  it('muestra el monto con separador de miles', async () => {
    await abrir('45000');
    expect(screen.getByLabelText('Monto en pesos').props.value).toBe('$ 45.000');
  });

  it('solo deja pasar dígitos, sin ceros a la izquierda y con tope de 12 dígitos', async () => {
    await abrir('');
    const campo = screen.getByLabelText('Monto en pesos');

    await fireEvent.changeText(campo, '12a.3b');
    expect(alCambiar).toHaveBeenLastCalledWith('123');

    await fireEvent.changeText(campo, '000450');
    expect(alCambiar).toHaveBeenLastCalledWith('450');

    await fireEvent.changeText(campo, '1234567890123456');
    expect(alCambiar).toHaveBeenLastCalledWith('123456789012');
  });

  it('con monto cero o vacío no deja avanzar', async () => {
    await abrir('');
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(alSiguiente).not.toHaveBeenCalled();
  });

  it('con un monto válido avanza', async () => {
    await abrir('45000');
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(alSiguiente).toHaveBeenCalledTimes(1);
  });
});

describe('PasoCategoria', () => {
  const alElegir = jest.fn();
  const alAtras = jest.fn();

  beforeEach(() => {
    alElegir.mockReset();
    alAtras.mockReset();
    jest
      .mocked(listarCategorias)
      .mockReset()
      .mockResolvedValue([...categorias]);
  });

  const abrir = (tipo: 'INGRESO' | 'EGRESO' = 'EGRESO') =>
    render(<PasoCategoria tipo={tipo} onElegir={alElegir} onAtras={alAtras} />);

  it('lista las categorías del backend para el tipo y marca las personales', async () => {
    await abrir();

    expect(await screen.findByText('Alimentación')).toBeOnTheScreen();
    expect(screen.getByText('Transporte')).toBeOnTheScreen();
    expect(screen.getByText('Mascotas')).toBeOnTheScreen();
    expect(screen.getAllByText('Personal')).toHaveLength(1);
    expect(listarCategorias).toHaveBeenCalledWith('EGRESO');
  });

  it('pide las categorías de ingreso cuando es un ingreso', async () => {
    await abrir('INGRESO');
    await screen.findByText('Alimentación');
    expect(listarCategorias).toHaveBeenCalledWith('INGRESO');
  });

  it('mientras carga muestra un indicador', async () => {
    jest.mocked(listarCategorias).mockReturnValue(new Promise(() => undefined));
    await abrir();
    expect(screen.getByLabelText('Cargando categorías')).toBeOnTheScreen();
  });

  it('al tocar una categoría la devuelve para avanzar', async () => {
    await abrir();

    await fireEvent.press(await screen.findByLabelText('Transporte'));

    expect(alElegir).toHaveBeenCalledWith(categorias[1]);
  });

  it('la búsqueda ignora mayúsculas y tildes', async () => {
    await abrir();
    await screen.findByText('Alimentación');

    await fireEvent.changeText(screen.getByLabelText('Buscar categoría'), 'alimentacion');

    expect(screen.getByText('Alimentación')).toBeOnTheScreen();
    expect(screen.queryByText('Transporte')).toBeNull();
  });

  it('avisa cuando la búsqueda no encuentra nada', async () => {
    await abrir();
    await screen.findByText('Alimentación');

    await fireEvent.changeText(screen.getByLabelText('Buscar categoría'), 'zzz');

    expect(screen.getByText('No encontramos categorías con ese nombre.')).toBeOnTheScreen();
  });

  it('si falla la carga avisa y permite reintentar', async () => {
    jest.mocked(listarCategorias).mockRejectedValueOnce(new NetworkError());
    await abrir();

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Reintentar'));

    expect(await screen.findByText('Alimentación')).toBeOnTheScreen();
    expect(listarCategorias).toHaveBeenCalledTimes(2);
  });

  it('ante cualquier otro fallo muestra el mensaje general', async () => {
    jest.mocked(listarCategorias).mockRejectedValue(new Error('boom'));
    await abrir();
    expect(await screen.findByText(/No pudimos cargar tus categorías/)).toBeOnTheScreen();
  });

  it('Atrás vuelve al paso anterior', async () => {
    await abrir();
    await fireEvent.press(await screen.findByText('Atrás'));
    expect(alAtras).toHaveBeenCalledTimes(1);
  });
});

describe('PasoMetodoPago', () => {
  const alElegir = jest.fn();
  const alAtras = jest.fn();

  beforeEach(() => {
    alElegir.mockReset();
    alAtras.mockReset();
  });

  const abrir = (tipo: 'INGRESO' | 'EGRESO' = 'EGRESO') =>
    render(<PasoMetodoPago tipo={tipo} onElegir={alElegir} onAtras={alAtras} />);

  it.each([
    ['Efectivo', 'EFECTIVO'],
    ['Tarjeta débito', 'DEBITO'],
    ['Transferencia', 'TRANSFERENCIA'],
  ])('al tocar "%s" avanza con %s', async (etiqueta, valor) => {
    await abrir();
    await fireEvent.press(screen.getByLabelText(etiqueta));
    expect(alElegir).toHaveBeenCalledWith(valor);
  });

  it('para un egreso ofrece la tarjeta de crédito, pero no avanza y explica por qué', async () => {
    await abrir();

    await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));

    expect(alElegir).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText(/se podrán registrar muy pronto/)).toBeOnTheScreen();
  });

  it('el aviso desaparece al elegir un método válido', async () => {
    await abrir();
    await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));
    await fireEvent.press(screen.getByLabelText('Efectivo'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(alElegir).toHaveBeenCalledWith('EFECTIVO');
  });

  it('para un ingreso no ofrece la tarjeta de crédito', async () => {
    await abrir('INGRESO');

    expect(screen.queryByLabelText('Tarjeta crédito')).toBeNull();
    expect(screen.getByText('¿Cómo lo recibiste?')).toBeOnTheScreen();
  });

  it('Atrás vuelve al paso anterior', async () => {
    await abrir();
    await fireEvent.press(screen.getByText('Atrás'));
    expect(alAtras).toHaveBeenCalledTimes(1);
  });
});

describe('PasoFecha', () => {
  const alCambiar = jest.fn();
  const alSiguiente = jest.fn();
  const alAtras = jest.fn();

  beforeEach(() => {
    alCambiar.mockReset();
    alSiguiente.mockReset();
    alAtras.mockReset();
  });

  const abrir = (fecha: string) =>
    render(
      <PasoFecha fecha={fecha} onCambiar={alCambiar} onSiguiente={alSiguiente} onAtras={alAtras} />,
    );

  it('hoy viene seleccionado y no muestra el calendario', async () => {
    await abrir(hoy());

    expect(screen.getByText('Hoy')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Mes siguiente')).toBeNull();
  });

  it('"Ayer" cambia la fecha a la de ayer', async () => {
    await abrir(hoy());

    await fireEvent.press(screen.getByText('Ayer'));

    expect(alCambiar).toHaveBeenCalledWith(ayer());
  });

  it('"Hoy" vuelve a la fecha de hoy', async () => {
    await abrir(ayer());

    await fireEvent.press(screen.getByText('Hoy'));

    expect(alCambiar).toHaveBeenCalledWith(hoy());
  });

  it('"Otra fecha" abre el calendario y permite elegir un día', async () => {
    await abrir('2026-03-10');
    expect(screen.getByLabelText('Mes siguiente')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('miércoles, 11 de marzo de 2026'));

    expect(alCambiar).toHaveBeenCalledWith('2026-03-11');
  });

  it('abre el calendario al tocar "Otra fecha"', async () => {
    await abrir(hoy());

    await fireEvent.press(screen.getByText('Otra fecha'));

    expect(screen.getByLabelText('Mes siguiente')).toBeOnTheScreen();
  });

  it('muestra la fecha elegida en texto largo', async () => {
    await abrir('2026-09-17');
    expect(screen.getByText('jueves, 17 de septiembre de 2026')).toBeOnTheScreen();
  });

  it('Siguiente y Atrás navegan', async () => {
    await abrir(hoy());

    await fireEvent.press(screen.getByText('Siguiente'));
    await fireEvent.press(screen.getByText('Atrás'));

    expect(alSiguiente).toHaveBeenCalledTimes(1);
    expect(alAtras).toHaveBeenCalledTimes(1);
  });
});

describe('PasoDescripcion', () => {
  const alCambiar = jest.fn();
  const alAtras = jest.fn();
  const alGuardar = jest.fn();
  const resumen = {
    monto: 45000,
    categoria: 'Alimentación',
    metodo: 'Tarjeta débito',
    fecha: hoy(),
  };

  beforeEach(() => {
    alCambiar.mockReset();
    alAtras.mockReset();
    alGuardar.mockReset();
  });

  const abrir = (
    props: { guardando?: boolean; error?: string | null; descripcion?: string } = {},
  ) =>
    render(
      <PasoDescripcion
        descripcion={props.descripcion ?? ''}
        onCambiar={alCambiar}
        resumen={resumen}
        guardando={props.guardando ?? false}
        error={props.error ?? null}
        onAtras={alAtras}
        onGuardar={alGuardar}
      />,
    );

  it('muestra el resumen para revisar todo antes de guardar', async () => {
    await abrir();

    expect(screen.getByText('¿Quieres agregar una nota?')).toBeOnTheScreen();
    expect(screen.getByText('Resumen')).toBeOnTheScreen();
    expect(screen.getByText('$ 45.000')).toBeOnTheScreen();
    expect(screen.getByText('Alimentación')).toBeOnTheScreen();
    expect(screen.getByText('Tarjeta débito')).toBeOnTheScreen();
    expect(screen.getByText('Hoy')).toBeOnTheScreen();
  });

  it('la nota es opcional: se puede guardar sin escribirla', async () => {
    await abrir();
    await fireEvent.press(screen.getByText('Guardar'));
    expect(alGuardar).toHaveBeenCalledTimes(1);
  });

  it('limita la nota a 200 caracteres', async () => {
    await abrir();

    await fireEvent.changeText(screen.getByLabelText('Nota'), 'x'.repeat(MAX_DESCRIPCION + 50));

    expect(alCambiar).toHaveBeenCalledWith('x'.repeat(MAX_DESCRIPCION));
  });

  it('mientras guarda bloquea los botones', async () => {
    await abrir({ guardando: true });

    await fireEvent.press(screen.getByText('Atrás'));

    expect(alAtras).not.toHaveBeenCalled();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('muestra el error cuando falla el guardado', async () => {
    await abrir({ error: 'No pudimos guardar tu movimiento.' });

    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText('No pudimos guardar tu movimiento.')).toBeOnTheScreen();
  });
});
