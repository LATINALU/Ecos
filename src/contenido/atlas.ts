// Rectángulos dentro de public/sprites/castillo.png (Generic Dungeon Pack de Anokolisa, CC0).
// Medidos con herramientas/png.py sobre el atlas original (368×224, grilla de 16 px).

export type Rect = readonly [x: number, y: number, w: number, h: number];

const T = 16;
const celda = (col: number, fila: number): Rect => [col * T, fila * T, T, T];

/** Bloque de piedra: borde de piedra gris alrededor de ladrillo. Se elige según qué lados quedan al aire. */
export const ROCA = {
  interior: celda(3, 2),
  arriba: celda(3, 0),
  abajo: celda(3, 4),
  izquierda: celda(1, 2),
  derecha: celda(5, 2),
  arribaIzq: celda(1, 1),
  arribaDer: celda(5, 1),
  abajoIzq: celda(1, 3),
  abajoDer: celda(5, 3),
} as const;

/** Losa de piedra con soporte de madera (plataformas atravesables). */
export const LOSA = { izquierda: celda(7, 6), centro: celda(8, 6), derecha: celda(10, 6) } as const;

/** Pinchos que salen del piso (16×11). */
export const PINCHOS: Rect = [80, 101, 16, 11];

/** Pared de ladrillo violeta para el fondo. */
export const PARED_FONDO: readonly Rect[] = [celda(8, 10), celda(9, 10), celda(8, 11), celda(9, 11)];

export const DECORADO = {
  cadena: [112, 16, 16, 24] as Rect,
  cadenaLarga: [116, 128, 7, 32] as Rect,
  farol: [96, 16, 32, 78] as Rect,
  estandarte: [128, 16, 15, 48] as Rect,
  ventana: [0, 96, 64, 112] as Rect,
  espadas: [64, 85, 32, 11] as Rect,
} as const;

/** Cofre de madera: 4 cuadros de abrirse; cofre de plata (tesoros raros), igual. */
export const COFRE: readonly Rect[] = [0, 1, 2, 3].map((i) => celda(15 + i, 3));
export const COFRE_PLATA: readonly Rect[] = [0, 1, 2, 3].map((i) => celda(15 + i, 5));

export const MONEDA: readonly Rect[] = [[244, 4, 8, 8], [261, 4, 6, 8], [278, 4, 4, 8], [293, 4, 6, 8]];
export const GEMA: readonly Rect[] = [[245, 20, 6, 8], [262, 20, 4, 8], [277, 20, 6, 8], [294, 20, 4, 8]];
export const LLAVE_ORO: Rect = [226, 37, 12, 7];
