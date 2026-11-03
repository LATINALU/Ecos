// RELICARIO DE ALMAS: un cofrecito que se abre desde el inventario y entrega UNA carta de alma de 5★ a 12★.
//
//   · Tabla: 5★ es lo más común y la probabilidad cae estrella a estrella hasta 12★ (rarísima).
//   · GARANTÍA (piedad) por cada bloque de 100 aperturas: al menos 1 de 12★, 3 de 11★, 5 de 10★ y 8 de 9★.
//     Si lo que falta para cumplir las cuotas ya no entra en las aperturas que quedan del bloque, la siguiente
//     apertura se FUERZA a la estrella más alta pendiente. Al cerrar el bloque se empieza otro.
//   · Cómo se consigue: TODO guardián suelta uno (y los cofres de oro y míticos). Los monstruos comunes y las
//     élites sueltan en cambio CAJAS DE ALMAS (1★ a 6★): las cartas ya no caen sueltas, todas salen de cajas.
//   · Cada estrella tiene su AURA (color) para reconocer la rareza de un vistazo.

import type { Azar } from "minialu";

/** Nivel interno de las cartas (0 = 1★): el relicario da de 4 (5★) a 11 (12★). */
export const NIVEL_MIN_RELICARIO = 4;
export const NIVEL_MAX_RELICARIO = 11;

/** Probabilidad de cada estrella (índice 0 = 5★ … 7 = 12★). Suma 1. */
export const PROB_RELICARIO: readonly number[] = [0.45, 0.25, 0.14, 0.08, 0.045, 0.022, 0.01, 0.003];

/** Cuotas garantizadas por bloque de 100 aperturas, por nivel interno (11 = 12★). */
export const BLOQUE_RELICARIO = 100;
export const CUOTAS_RELICARIO: Readonly<Record<number, number>> = { 11: 1, 10: 3, 9: 5, 8: 8 };

/**
 * Aura de cada estrella de 5★ a 12★: gris, morada, verde, azul, roja, dorada, plateada y prismática.
 * Brilla DETRÁS del retrato del alma para reconocer su rareza de un vistazo.
 */
export const AURA_ESTRELLA: readonly string[] = ["#a8a8b8", "#a45cff", "#3dff7a", "#3d8bff", "#ff3d4d", "#ffc83d", "#e6eef8", "#ffffff"];
export const NOMBRE_AURA: readonly string[] = ["Gris", "Morada", "Verde", "Azul", "Roja", "Dorada", "Plateada", "Prismática"];
/** Color (sin aura) de las estrellas bajas, 1★ a 4★. */
const COLOR_ESTRELLA_BAJA: readonly string[] = ["#8a8070", "#9aa4ae", "#8fbf9f", "#8fb0e0"];

/** Color del aura de una carta (5★ o más). Las de menos no tienen aura: devuelve un tono apagado. */
export function auraDeNivel(nivel: number): string {
  if (nivel < NIVEL_MIN_RELICARIO) return "#c8c0d8";
  return AURA_ESTRELLA[Math.min(NIVEL_MAX_RELICARIO, nivel) - NIVEL_MIN_RELICARIO];
}

/** Color de cualquier estrella (1★ a 12★), para animaciones y tablas. */
export function colorEstrella(nivel: number): string {
  return nivel < NIVEL_MIN_RELICARIO ? COLOR_ESTRELLA_BAJA[Math.max(0, nivel)] : auraDeNivel(nivel);
}

// ---------------- Caja de Almas (la sueltan los monstruos: 1★ a 6★) ----------------

export const NIVEL_MAX_CAJA = 5;
/** Probabilidad de cada estrella de la Caja de Almas (índice 0 = 1★ … 5 = 6★). Suma 1. */
export const PROB_CAJA: readonly number[] = [0.34, 0.27, 0.19, 0.11, 0.065, 0.025];

export function tirarNivelCaja(azar: Azar): number {
  let r = azar.siguiente();
  for (let i = 0; i < PROB_CAJA.length; i++) {
    r -= PROB_CAJA[i];
    if (r < 0) return i;
  }
  return 0;
}

export interface PiedadRelicario {
  /** Aperturas hechas en el bloque actual (0..99). */
  readonly abiertos: number;
  /** Conseguidas en el bloque actual por nivel interno (solo las que tienen cuota). */
  readonly conseguidas: Readonly<Record<number, number>>;
}

export const PIEDAD_INICIAL: PiedadRelicario = { abiertos: 0, conseguidas: {} };

/** Cuánto falta de cada cuota en el bloque actual. */
export function pendientes(p: PiedadRelicario): Record<number, number> {
  const r: Record<number, number> = {};
  for (const [n, c] of Object.entries(CUOTAS_RELICARIO)) r[Number(n)] = Math.max(0, c - (p.conseguidas[Number(n)] ?? 0));
  return r;
}

export function tirarNivelRelicario(azar: Azar): number {
  let r = azar.siguiente();
  for (let i = 0; i < PROB_RELICARIO.length; i++) {
    r -= PROB_RELICARIO[i];
    if (r < 0) return NIVEL_MIN_RELICARIO + i;
  }
  return NIVEL_MIN_RELICARIO;
}

export interface Apertura {
  readonly nivel: number;
  /** Salió por la garantía, no por suerte. */
  readonly garantizada: boolean;
  readonly piedad: PiedadRelicario;
}

export function abrirRelicario(azar: Azar, piedad: PiedadRelicario): Apertura {
  const falta = pendientes(piedad);
  const deficit = Object.values(falta).reduce((a, b) => a + b, 0);
  const quedan = BLOQUE_RELICARIO - piedad.abiertos;
  let nivel: number;
  let garantizada = false;
  if (deficit > 0 && deficit >= quedan) {
    // La garantía manda: la estrella más alta que todavía falta.
    nivel = Math.max(...Object.entries(falta).filter(([, f]) => f > 0).map(([n]) => Number(n)));
    garantizada = true;
  } else {
    nivel = tirarNivelRelicario(azar);
  }
  const conseguidas = { ...piedad.conseguidas };
  if (CUOTAS_RELICARIO[nivel] !== undefined) conseguidas[nivel] = (conseguidas[nivel] ?? 0) + 1;
  const abiertos = piedad.abiertos + 1;
  const nueva = abiertos >= BLOQUE_RELICARIO ? PIEDAD_INICIAL : { abiertos, conseguidas };
  return { nivel, garantizada, piedad: nueva };
}
