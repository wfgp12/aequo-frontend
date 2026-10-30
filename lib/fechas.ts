const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local como YYYY-MM-DD: sin hora ni zona horaria, para que el día no se corra. */
export function aFechaIso(fecha: Date) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Convierte YYYY-MM-DD en una fecha local (mediodía, para evitar saltos por horario de verano). */
export function desdeFechaIso(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12);
}

export function hoy(ahora = new Date()) {
  return aFechaIso(ahora);
}

export function ayer(ahora = new Date()) {
  const d = new Date(ahora);
  d.setDate(d.getDate() - 1);
  return aFechaIso(d);
}

/** "jueves, 17 de septiembre de 2026" */
export function fechaLarga(iso: string) {
  const d = desdeFechaIso(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "Hoy", "Ayer" o "17 de septiembre de 2026". */
export function fechaCorta(iso: string, ahora = new Date()) {
  if (iso === hoy(ahora)) return 'Hoy';
  if (iso === ayer(ahora)) return 'Ayer';
  const d = desdeFechaIso(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function nombreDelMes(mes: number) {
  return MESES[mes];
}

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "17/09/2026", el formato de los campos de fecha del diseño (dd/mm/aaaa). */
export function fechaDdMmAaaa(iso: string) {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Encabezado de un día en la lista: "HOY · JUEVES 17 SEP", "AYER · MIÉRCOLES 16 SEP" o "LUNES 14 SEP". */
export function encabezadoDeDia(iso: string, ahora = new Date()) {
  const d = desdeFechaIso(iso);
  const dia = `${DIAS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
  if (iso === hoy(ahora)) return `HOY · ${dia}`.toUpperCase();
  if (iso === ayer(ahora)) return `AYER · ${dia}`.toUpperCase();
  return dia.toUpperCase();
}
