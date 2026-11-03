// Paso entre salas. Funciones puras (testeadas en test/transiciones.test.ts).
//
// Regla clave: el lugar donde aparece el jugador al ENTRAR nunca puede cumplir la condición de SALIDA.
// Antes, al bajar por un pozo, aparecía con el centro por encima del borde superior (y = −18): en el mismo
// cuadro se detectaba una "salida hacia arriba" y el jugador rebotaba entre las dos salas sin poder bajar.

import { ALTO_SALA, ANCHO_SALA, COLS_POZO, TILE } from "../dominio/mundo/sala.ts";
import type { Dir } from "../dominio/tipos.ts";

export interface Caja {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Hacia dónde salió el cuerpo de la sala (o null si sigue adentro). */
export function salidaDe(c: Caja): Dir | null {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  if (cx < 0) return "izq";
  if (cx > ANCHO_SALA) return "der";
  if (c.y > ALTO_SALA) return "aba";
  if (cy < 0) return "arr";
  return null;
}

/** Margen dentro del borde al aparecer. */
const MARGEN = 2;
const PISO = 14 * TILE;

/**
 * Posición al entrar a la sala vecina después de salir en dirección `dir`.
 * Laterales: mismo alto (sin hundirse en el piso). Verticales: dentro del pozo, del lado de adentro del borde.
 */
export function entradaPor(dir: Dir, c: Caja): { x: number; y: number } {
  const xPozo = Math.max(COLS_POZO[0] * TILE + 1, Math.min((COLS_POZO[COLS_POZO.length - 1] + 1) * TILE - c.w - 1, c.x));
  switch (dir) {
    case "der":
      return { x: MARGEN, y: altoLateral(c) };
    case "izq":
      return { x: ANCHO_SALA - c.w - MARGEN, y: altoLateral(c) };
    case "aba":
      // Entra cayendo desde arriba: completamente adentro (su centro ya no está sobre el borde).
      return { x: xPozo, y: MARGEN };
    case "arr":
      // Entra subiendo desde abajo: los pies apenas dentro del borde inferior.
      return { x: xPozo, y: ALTO_SALA - c.h - MARGEN };
  }
}

/** Al cruzar una puerta se conserva la altura, pero siempre dentro de la sala y sin hundirse en el piso. */
function altoLateral(c: Caja): number {
  return Math.max(MARGEN, Math.min(c.y, PISO - c.h));
}

/** Tiempo tras entrar en el que no se acepta volver por donde se vino (evita rebotes por física). */
export const GRACIA_ENTRADA = 0.25;
