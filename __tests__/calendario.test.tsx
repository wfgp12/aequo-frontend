import { Calendario } from '@/components/calendario';
import { fireEvent, render, screen } from '@testing-library/react-native';

const alElegir = jest.fn();

describe('Calendario', () => {
  beforeEach(() => alElegir.mockReset());

  it('muestra el mes de la fecha elegida y los días de la semana desde el lunes', async () => {
    await render(<Calendario valor="2026-09-17" onElegir={alElegir} />);

    expect(screen.getByText('Septiembre de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Lu')).toBeOnTheScreen();
    expect(screen.getByText('Do')).toBeOnTheScreen();
    expect(screen.getByLabelText('jueves, 17 de septiembre de 2026')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /de septiembre de 2026$/ })).toHaveLength(30);
  });

  it('marca el día elegido', async () => {
    await render(<Calendario valor="2026-09-17" onElegir={alElegir} />);

    expect(
      screen.getByLabelText('jueves, 17 de septiembre de 2026').props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
    expect(
      screen.getByLabelText('miércoles, 16 de septiembre de 2026').props.accessibilityState,
    ).toMatchObject({
      selected: false,
    });
  });

  it('al tocar un día devuelve su fecha en formato YYYY-MM-DD', async () => {
    await render(<Calendario valor="2026-09-17" onElegir={alElegir} />);

    await fireEvent.press(screen.getByLabelText('lunes, 21 de septiembre de 2026'));

    expect(alElegir).toHaveBeenCalledWith('2026-09-21');
  });

  it('navega al mes anterior y al siguiente, también entre años', async () => {
    await render(<Calendario valor="2026-01-15" onElegir={alElegir} />);

    await fireEvent.press(screen.getByLabelText('Mes anterior'));
    expect(screen.getByText('Diciembre de 2025')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    await fireEvent.press(screen.getByLabelText('Mes siguiente'));
    expect(screen.getByText('Febrero de 2026')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('domingo, 1 de febrero de 2026'));
    expect(alElegir).toHaveBeenCalledWith('2026-02-01');
  });

  it('febrero de un año bisiesto tiene 29 días', async () => {
    await render(<Calendario valor="2028-02-10" onElegir={alElegir} />);

    expect(screen.getAllByRole('button', { name: /de febrero de 2028$/ })).toHaveLength(29);
  });
});
