const mockInitializeApp = jest.fn(() => ({ nombre: 'app' }));
const mockGetApp = jest.fn(() => ({ nombre: 'app-existente' }));
const mockGetApps = jest.fn();
const mockGetAuth = jest.fn((app: unknown) => ({ app }));

jest.mock('firebase/app', () => ({
  initializeApp: mockInitializeApp,
  getApp: mockGetApp,
  getApps: mockGetApps,
}));
jest.mock('firebase/auth', () => ({ getAuth: mockGetAuth }));

describe('lib/firebase', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('inicializa la app con las variables EXPO_PUBLIC_FIREBASE_*', () => {
    mockGetApps.mockReturnValue([]);
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'proyecto-de-prueba';

    require('@/lib/firebase');

    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proyecto-de-prueba' }),
    );
    expect(mockGetAuth).toHaveBeenCalledWith({ nombre: 'app' });
  });

  it('reutiliza la app si ya estaba inicializada', () => {
    mockGetApps.mockReturnValue([{}]);

    require('@/lib/firebase');

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockGetAuth).toHaveBeenCalledWith({ nombre: 'app-existente' });
  });
});
