import type { TransaccionListada } from '@/lib/api/transacciones';
import { encabezadoDeDia, fechaDdMmAaaa } from '@/lib/fechas';
import {
  agruparPorDia,
  montoConSigno,
  subtituloDelMovimiento,
  tituloDelMovimiento,
} from '@/lib/movimientos';

function movimiento(parcial: Partial<TransaccionListada> = {}): TransaccionListada {
  return {
    id: 't1',
    tipo: 'EGRESO',
    monto: 45000,
    fecha: '2026-09-17',
    categoriaId: 'c1',
    categoria: { id: 'c1', nombre: 'Alimentación', tipo: 'EGRESO', esPredeterminada: true },
    metodoPago: 'DEBITO',
    descripcion: 'Almuerzo',
    clasificacionFlujo: 'ORDINARIO',
    creadaEn: '2026-09-17T15:00:00.000Z',
    ...parcial,
  };
}

describe('textos de una fila', () => {
  it('CA-RF06-01 el egreso lleva signo menos y el ingreso signo más, con punto de miles', () => {
    expect(montoConSigno(movimiento())).toBe('− $ 45.000');
    expect(montoConSigno(movimiento({ tipo: 'INGRESO', monto: 3400000 }))).toBe('+ $ 3.400.000');
    expect(montoConSigno(movimiento({ monto: 500 }))).toBe('− $ 500');
  });

  it('CA-RF06-01 con nota, la nota es el título y "Categoría · Método" el detalle', () => {
    expect(tituloDelMovimiento(movimiento())).toBe('Almuerzo');
    expect(subtituloDelMovimiento(movimiento())).toBe('Alimentación · Tarjeta débito');
  });

  it('CA-RF06-02 sin nota, la categoría es el título y el detalle solo trae el método', () => {
    const sinNota = movimiento({ descripcion: '', metodoPago: 'EFECTIVO' });

    expect(tituloDelMovimiento(sinNota)).toBe('Alimentación');
    expect(subtituloDelMovimiento(sinNota)).toBe('Efectivo');
  });

  it('CA-RF06-03 cada método de pago se lee con su nombre cotidiano', () => {
    const detalle = (metodoPago: TransaccionListada['metodoPago']) =>
      subtituloDelMovimiento(movimiento({ metodoPago }));

    expect(detalle('EFECTIVO')).toBe('Alimentación · Efectivo');
    expect(detalle('DEBITO')).toBe('Alimentación · Tarjeta débito');
    expect(detalle('TRANSFERENCIA')).toBe('Alimentación · Transferencia');
    expect(detalle('TARJETA_CREDITO')).toBe('Alimentación · Tarjeta crédito');
  });

  it('CA-RF06-04 los montos se redondean al peso al mostrarlos', () => {
    expect(montoConSigno(movimiento({ monto: 45000.6 }))).toBe('− $ 45.001');
    expect(montoConSigno(movimiento({ monto: 45000.4 }))).toBe('− $ 45.000');
  });

  it('CA-RF06-06 sin nota ni categoría el título es "Sin categoría" y el detalle solo el método', () => {
    const huerfano = movimiento({ descripcion: '', categoria: null, metodoPago: 'EFECTIVO' });

    expect(tituloDelMovimiento(huerfano)).toBe('Sin categoría');
    expect(subtituloDelMovimiento(huerfano)).toBe('Efectivo');
  });

  it('CA-RF06-06 con nota pero sin categoría, el detalle solo trae el método', () => {
    const sinCategoria = movimiento({ categoria: null });

    expect(tituloDelMovimiento(sinCategoria)).toBe('Almuerzo');
    expect(subtituloDelMovimiento(sinCategoria)).toBe('Tarjeta débito');
  });
});

describe('agrupación por día', () => {
  it('CA-RF06-05 agrupa los movimientos del mismo día y respeta el orden recibido', () => {
    const items = [
      movimiento({ id: 'a', fecha: '2026-09-17' }),
      movimiento({ id: 'b', fecha: '2026-09-17' }),
      movimiento({ id: 'c', fecha: '2026-09-16' }),
      movimiento({ id: 'd', fecha: '2026-09-14' }),
    ];

    const secciones = agruparPorDia(items);

    expect(secciones.map((s) => s.fecha)).toEqual(['2026-09-17', '2026-09-16', '2026-09-14']);
    expect(secciones.map((s) => s.data.map((m) => m.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('CA-RF06-05 sin movimientos no hay secciones', () => {
    expect(agruparPorDia([])).toEqual([]);
  });

  it('CA-RF06-05 un día que reaparece tras otro no se reordena', () => {
    const secciones = agruparPorDia([
      movimiento({ id: 'a', fecha: '2026-09-17' }),
      movimiento({ id: 'b', fecha: '2026-09-16' }),
      movimiento({ id: 'c', fecha: '2026-09-17' }),
    ]);

    expect(secciones.map((s) => s.fecha)).toEqual(['2026-09-17', '2026-09-16', '2026-09-17']);
  });
});

describe('fechas de la lista', () => {
  const ahora = new Date(2026, 8, 17, 15, 30);

  it('CA-RF06-05 los encabezados de día dicen hoy, ayer o solo el día de la semana', () => {
    expect(encabezadoDeDia('2026-09-17', ahora)).toBe('HOY · JUEVES 17 SEP');
    expect(encabezadoDeDia('2026-09-16', ahora)).toBe('AYER · MIÉRCOLES 16 SEP');
    expect(encabezadoDeDia('2026-09-14', ahora)).toBe('LUNES 14 SEP');
  });

  it('CA-RF09-01 los filtros muestran la fecha como dd/mm/aaaa', () => {
    expect(fechaDdMmAaaa('2026-09-07')).toBe('07/09/2026');
  });
});
