import Perfil from '@/app/perfil';
import { NetworkError } from '@/lib/api/client';
import { obtenerPerfil } from '@/lib/api/usuarios';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockCerrarSesion = jest.fn();
const mockVolver = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockVolver }) }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ cerrarSesion: mockCerrarSesion }) }));
jest.mock('@/lib/api/usuarios', () => ({ obtenerPerfil: jest.fn() }));

const ana = { id: 'u1', nombre: 'Ana Prueba', email: 'ana@correo.com', fotoUrl: null };

describe('Perfil', () => {
  beforeEach(() => {
    mockCerrarSesion.mockReset();
    mockVolver.mockReset();
    jest.mocked(obtenerPerfil).mockReset();
  });

  it('muestra los datos del usuario que entrega el backend', async () => {
    jest.mocked(obtenerPerfil).mockResolvedValue(ana);
    await render(<Perfil />);

    expect(await screen.findByText('Ana Prueba')).toBeOnTheScreen();
    expect(screen.getByText('ana@correo.com')).toBeOnTheScreen();
    expect(screen.getByText('Inicio de sesión')).toBeOnTheScreen();
    expect(screen.getByText('Google')).toBeOnTheScreen();
    expect(screen.getByText('Tu nombre y foto vienen de tu cuenta de Google.')).toBeOnTheScreen();
  });

  it('no muestra los datos que el backend todavía no entrega', async () => {
    jest.mocked(obtenerPerfil).mockResolvedValue(ana);
    await render(<Perfil />);
    await screen.findByText('Ana Prueba');

    expect(screen.queryByText('Miembro desde')).toBeNull();
    expect(screen.queryByText('Movimientos registrados')).toBeNull();
  });

  it('sin foto muestra la inicial del nombre', async () => {
    jest.mocked(obtenerPerfil).mockResolvedValue(ana);
    await render(<Perfil />);

    expect(await screen.findByText('A')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Tu foto de perfil')).toBeNull();
  });

  it('con foto la muestra', async () => {
    jest.mocked(obtenerPerfil).mockResolvedValue({ ...ana, fotoUrl: 'https://foto.test/ana.png' });
    await render(<Perfil />);

    expect(await screen.findByLabelText('Tu foto de perfil')).toBeOnTheScreen();
  });

  it('mientras carga muestra un indicador', async () => {
    jest.mocked(obtenerPerfil).mockReturnValue(new Promise(() => undefined));
    await render(<Perfil />);

    expect(screen.getByLabelText('Cargando tu perfil')).toBeOnTheScreen();
  });

  it('si falla la carga avisa en lenguaje sencillo y permite reintentar', async () => {
    jest.mocked(obtenerPerfil).mockRejectedValueOnce(new NetworkError());
    jest.mocked(obtenerPerfil).mockResolvedValueOnce(ana);
    await render(<Perfil />);

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Reintentar'));

    expect(await screen.findByText('Ana Prueba')).toBeOnTheScreen();
    expect(obtenerPerfil).toHaveBeenCalledTimes(2);
  });

  it('ante cualquier otro fallo muestra el mensaje general', async () => {
    jest.mocked(obtenerPerfil).mockRejectedValue(new Error('boom'));
    await render(<Perfil />);

    expect(await screen.findByText(/No pudimos cargar tu perfil/)).toBeOnTheScreen();
  });

  it('cierra la sesión desde el botón', async () => {
    jest.mocked(obtenerPerfil).mockResolvedValue(ana);
    await render(<Perfil />);

    await fireEvent.press(await screen.findByText('Cerrar sesión'));

    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('vuelve a la pantalla anterior con la flecha', async () => {
    jest.mocked(obtenerPerfil).mockResolvedValue(ana);
    await render(<Perfil />);

    await fireEvent.press(await screen.findByLabelText('Volver'));

    expect(mockVolver).toHaveBeenCalledTimes(1);
  });
});
