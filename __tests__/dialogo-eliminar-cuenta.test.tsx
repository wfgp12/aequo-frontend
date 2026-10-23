import { DialogoEliminarCuenta } from '@/components/dialogo-eliminar-cuenta';
import { fireEvent, render, screen } from '@testing-library/react-native';

const alCancelar = jest.fn();
const alConfirmar = jest.fn();

async function abrir(props: { eliminando?: boolean; error?: string | null } = {}) {
  await render(
    <DialogoEliminarCuenta
      eliminando={props.eliminando ?? false}
      error={props.error ?? null}
      onCancelar={alCancelar}
      onConfirmar={alConfirmar}
    />,
  );
}

const CAMPO = 'Escribe ELIMINAR para confirmar';

describe('DialogoEliminarCuenta', () => {
  beforeEach(() => {
    alCancelar.mockReset();
    alConfirmar.mockReset();
  });

  it('advierte que se borra todo para siempre y que no se puede deshacer', async () => {
    await abrir();

    expect(screen.getByText('¿Eliminar tu cuenta?')).toBeOnTheScreen();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeOnTheScreen();
    expect(screen.getByText(/movimientos, tarjetas, préstamos, presupuesto/)).toBeOnTheScreen();
  });

  it('el botón de eliminar empieza deshabilitado y no confirma', async () => {
    await abrir();

    await fireEvent.press(screen.getByText('Eliminar cuenta'));

    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it.each(['eliminar', 'ELIMINA', 'ELIMINAR ', 'Eliminar'])(
    'con "%s" el botón sigue deshabilitado: la palabra debe ser exacta',
    async (texto) => {
      await abrir();
      await fireEvent.changeText(screen.getByLabelText(CAMPO), texto);

      await fireEvent.press(screen.getByText('Eliminar cuenta'));

      expect(alConfirmar).not.toHaveBeenCalled();
    },
  );

  it('al escribir ELIMINAR se habilita y confirma', async () => {
    await abrir();
    await fireEvent.changeText(screen.getByLabelText(CAMPO), 'ELIMINAR');

    await fireEvent.press(screen.getByText('Eliminar cuenta'));

    expect(alConfirmar).toHaveBeenCalledTimes(1);
  });

  it('Cancelar cierra sin confirmar', async () => {
    await abrir();

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('mientras elimina no deja confirmar de nuevo ni cancelar', async () => {
    await abrir({ eliminando: true });
    await fireEvent.changeText(screen.getByLabelText(CAMPO), 'ELIMINAR');

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(alCancelar).not.toHaveBeenCalled();
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('muestra el error cuando falla la eliminación', async () => {
    await abrir({ error: 'No pudimos eliminar tu cuenta. Inténtalo de nuevo en unos minutos.' });

    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText(/No pudimos eliminar tu cuenta/)).toBeOnTheScreen();
  });
});
