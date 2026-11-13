import { fraccionAPorcentaje, porcentajeAFraccion } from '@/lib/tasa';

// Conversión de la tasa entre el porcentaje que escribe la persona y la fracción de la API
// (criterios/05-tarjetas-pantallas.md, CA-RF24-F23 y CA-RF24-F24). Es presentación, no un cálculo financiero:
// tiene que ser exacta en decimales (29,21 es 0.2921, no 0.29210000000000004).

describe('porcentajeAFraccion', () => {
  it.each([
    ['24', 0.24],
    ['29,21', 0.2921],
    ['29.21', 0.2921],
    ['12,5', 0.125],
    ['8,3', 0.083],
    ['57', 0.57],
    ['0,07', 0.0007],
    ['0', 0],
    ['100', 1],
    ['100,01', 1.0001],
  ])('CA-RF24-F23 "%s" se convierte en %s exacto', (texto, fraccion) => {
    expect(porcentajeAFraccion(texto)).toBe(fraccion);
  });

  it.each([
    ['1', 0.01],
    ['5', 0.05],
    ['7', 0.07],
    ['10', 0.1],
    ['0,5', 0.005],
    ['0,1', 0.001],
    ['0,01', 0.0001],
    ['0,0', 0],
    ['0,00', 0],
    ['99,99', 0.9999],
    ['33,33', 0.3333],
    ['8,25', 0.0825],
    ['15', 0.15],
    ['29', 0.29],
    ['58', 0.58],
    ['3,5', 0.035],
    ['29,213', 0.29213],
    ['150', 1.5],
  ])('CA-RF24-F23 bordes y redondeo: "%s" se convierte en %s exacto', (texto, fraccion) => {
    expect(porcentajeAFraccion(texto)).toBe(fraccion);
  });

  it('CA-RF24-F23 el cero es 0 y no "null" ni -0', () => {
    expect(porcentajeAFraccion('0')).toBe(0);
    expect(porcentajeAFraccion('0,0')).toBe(0);
    expect(porcentajeAFraccion('0')).not.toBeNull();
  });

  it('CA-RF24-F23 la coma y el punto valen lo mismo', () => {
    for (const texto of ['1,5', '12,25', '50,5', '99,99', '0,07']) {
      expect(porcentajeAFraccion(texto)).toBe(porcentajeAFraccion(texto.replace(',', '.')));
    }
  });

  it.each(['', ',', '.', 'abc'])('CA-RF24-F23 "%s" no es un número y entrega null', (texto) => {
    expect(porcentajeAFraccion(texto)).toBeNull();
  });

  it('CA-RF24-F23 es exacta en cada porcentaje de 0 a 100 con dos decimales (la misma que da escribir el número en decimal)', () => {
    const malos: string[] = [];
    for (let centesimas = 0; centesimas <= 10000; centesimas++) {
      const entero = Math.floor(centesimas / 100);
      const resto = String(centesimas % 100).padStart(2, '0');
      const texto = `${entero},${resto}`;
      // Oráculo: JavaScript lee el texto decimal "29.21e-2" como el número más cercano a 0.2921
      const esperado = Number(`${entero}.${resto}e-2`);
      if (porcentajeAFraccion(texto) !== esperado) malos.push(texto);
    }
    expect(malos).toEqual([]);
  });

  it('CA-RF24-F23 es exacta en cada porcentaje entero de 0 a 100', () => {
    const malos: string[] = [];
    for (let n = 0; n <= 100; n++) {
      if (porcentajeAFraccion(String(n)) !== Number(`${n}e-2`)) malos.push(String(n));
    }
    expect(malos).toEqual([]);
  });
});

describe('fraccionAPorcentaje', () => {
  it.each([
    [0.24, '24'],
    [0.2921, '29,21'],
    [0.125, '12,5'],
    [0.083, '8,3'],
    [0.07, '7'],
    [0.57, '57'],
    [0.0007, '0,07'],
    [0.29213, '29,213'],
    [0, '0'],
    [1, '100'],
  ])('CA-RF24-F24 %s se muestra como "%s"', (fraccion, texto) => {
    expect(fraccionAPorcentaje(fraccion)).toBe(texto);
  });

  it.each([
    [0.01, '1'],
    [0.05, '5'],
    [0.1, '10'],
    [0.15, '15'],
    [0.2, '20'],
    [0.3, '30'],
    [0.5, '50'],
    [0.29, '29'],
    [0.58, '58'],
    [0.035, '3,5'],
    [0.0035, '0,35'],
    [0.0001, '0,01'],
    [0.0825, '8,25'],
    [0.3333, '33,33'],
    [0.9999, '99,99'],
    [0.1234, '12,34'],
  ])('CA-RF24-F24 bordes y ceros: %s se muestra como "%s"', (fraccion, texto) => {
    expect(fraccionAPorcentaje(fraccion)).toBe(texto);
  });

  it('CA-RF24-F24 nunca muestra ruido de coma flotante ni punto decimal', () => {
    for (const fraccion of [0.07, 0.57, 0.0007, 0.29, 0.58, 0.083, 0.1 + 0.2]) {
      expect(fraccionAPorcentaje(fraccion)).not.toMatch(/\d{9,}|\./);
    }
    expect(fraccionAPorcentaje(0.07)).not.toBe('7,000000000000001');
    expect(fraccionAPorcentaje(0.57)).not.toBe('56,99999999999999');
    expect(fraccionAPorcentaje(0.0007)).not.toBe('0,06999999999999999');
  });

  it('CA-RF24-F24 ida y vuelta: lo que se escribe es lo que se vuelve a mostrar, sin ceros de más', () => {
    const malos: string[] = [];
    for (let centesimas = 0; centesimas <= 10000; centesimas++) {
      const entero = Math.floor(centesimas / 100);
      const resto = String(centesimas % 100).padStart(2, '0');
      const escrito = `${entero},${resto}`;
      const esperado = `${entero}${resto === '00' ? '' : `,${resto.replace(/0$/, '')}`}`;
      const fraccion = porcentajeAFraccion(escrito) as number;
      if (fraccionAPorcentaje(fraccion) !== esperado) malos.push(`${escrito} -> ${esperado}`);
    }
    expect(malos).toEqual([]);
  });
});
