import {
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  renombrarCategoria,
  type Categoria,
  type TipoMovimiento,
} from '@/lib/api/categorias';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { boton } from './tarjetas';

// Ayudas de las pruebas de "Mis categorías" (criterios/02-categorias-gestion.md). No son pruebas: Jest solo corre
// los archivos *.test.ts(x). Cada archivo de prueba simula `expo-router` y `@/lib/api/categorias`.

export const TEXTO = {
  cargando: 'Cargando tus categorías',
  notaGenerales: 'Las categorías generales son de Aequo y no se pueden editar.',
  sinPropias: 'Todavía no tienes categorías propias.',
  errorCarga: 'No pudimos cargar tus categorías. Inténtalo de nuevo en unos minutos.',
  vacio: 'Escribe un nombre para la categoría.',
  largo: 'El nombre puede tener hasta 40 letras.',
  repetido: 'Ya existe una categoría con ese nombre. Prueba con otro.',
  errorGuardar: 'No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo.',
  yaNoExiste: 'Esta categoría ya no existe.',
  errorEliminar: 'No pudimos eliminar la categoría. Inténtalo de nuevo en unos minutos.',
};

// Palabras que el usuario nunca debe leer (RNF-04)
export const TECNICO =
  /esPredeterminada|idempoten|payload|ApiError|NetworkError|internal server|forbidden|\b(400|403|404|409|500)\b/i;

const categoria = (
  id: string,
  nombre: string,
  tipo: TipoMovimiento,
  esPredeterminada: boolean,
  movimientos = 0,
): Categoria => ({ id, nombre, tipo, esPredeterminada, movimientos });

export const MASCOTAS = categoria('c-mascotas', 'Mascotas', 'EGRESO', false, 12);
export const GIMNASIO = categoria('c-gimnasio', 'Gimnasio', 'EGRESO', false, 4);
export const FREELANCE = categoria('c-freelance', 'Freelance', 'INGRESO', false, 3);

// Como el backend: primero las generales. El orden no es alfabético a propósito: la pantalla no reordena.
export const GENERALES_EGRESO = [
  'Alimentación',
  'Transporte',
  'Hogar',
  'Salud',
  'Otros egresos',
].map((nombre, i) => categoria(`g-e${i}`, nombre, 'EGRESO', true, i === 0 ? 7 : 0));
export const GENERALES_INGRESO = ['Salario', 'Otros ingresos'].map((nombre, i) =>
  categoria(`g-i${i}`, nombre, 'INGRESO', true),
);

export const TODAS = [...GENERALES_EGRESO, MASCOTAS, GIMNASIO, ...GENERALES_INGRESO, FREELANCE];

/** Un backend de mentira con estado: lo que se crea, renombra o elimina se ve en la siguiente consulta. */
export function crearServidor(iniciales: Categoria[] = TODAS) {
  let items = [...iniciales];
  const quitar = (id: string) => {
    items = items.filter((c) => c.id !== id);
  };
  jest
    .mocked(listarCategorias)
    .mockImplementation(async (tipo) => items.filter((c) => !tipo || c.tipo === tipo));
  jest.mocked(crearCategoria).mockImplementation(async (datos) => {
    const nueva = categoria('c-nueva', datos.nombre, datos.tipo, false);
    items = [...items, nueva];
    return nueva;
  });
  jest.mocked(renombrarCategoria).mockImplementation(async (id, nombre) => {
    items = items.map((c) => (c.id === id ? { ...c, nombre } : c));
    return items.find((c) => c.id === id)!;
  });
  jest.mocked(eliminarCategoria).mockImplementation(async (id) => quitar(id));
  return { quitar };
}

export function reiniciarAdaptador() {
  [listarCategorias, crearCategoria, renombrarCategoria, eliminarCategoria].forEach((f) =>
    jest.mocked(f).mockReset(),
  );
}

/** Muestra la pantalla sin esperar a que cargue. */
export async function montar() {
  // require diferido: mientras la pantalla no exista, falla cada prueba por su cuenta y no el archivo entero
  const Categorias = require('@/app/categorias').default;
  return render(<Categorias />);
}

export const cargada = () => screen.findByText(TEXTO.notaGenerales);

export async function mostrar(iniciales?: Categoria[]) {
  const servidor = crearServidor(iniciales);
  await montar();
  await cargada();
  return servidor;
}

export const fila = (nombre: string, movimientos: number) =>
  boton(`${nombre}, ${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'}`);

export const campoNombre = () => screen.getByLabelText('Nombre');

export async function verIngresos() {
  await fireEvent.press(boton('Ingresos'));
  await screen.findByText('Salario');
}

/** Toca la fila de una categoría propia y espera la hoja "Editar categoría". */
export async function abrirEdicion(nombre = 'Mascotas', movimientos = 12) {
  await fireEvent.press(fila(nombre, movimientos));
  await screen.findByText('Editar categoría');
}

export const escribir = (nombre: string) => fireEvent.changeText(campoNombre(), nombre);
