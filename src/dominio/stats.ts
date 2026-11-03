// Stats del Portador: la misma idea de MiniFighter (suma de capas, minialu/componerStats) con stats propios.
//   base + nivel de la partida + santuario + forma (carta principal) + resonancias + equipo
// Cada capa queda separada para poder mostrar el desglose en la interfaz.

import { componerStats, entero, type Azar, type Capa } from "minialu";

export const STATS = ["hp", "mp", "golpe", "patada", "tecnica", "defensa", "critico", "suerte", "regen"] as const;
export type Stat = (typeof STATS)[number];
export type Bloque = Record<Stat, number>;

export const NOMBRE_STAT: Readonly<Record<Stat, string>> = {
  hp: "Vida", mp: "Éter", golpe: "Golpe", patada: "Patada", tecnica: "Técnica", defensa: "Defensa", critico: "Crítico %", suerte: "Suerte", regen: "Regeneración",
};

export const BASE_PORTADOR: Capa = { hp: 100, mp: 40, golpe: 10, patada: 14, tecnica: 12, defensa: 4, critico: 5 };

export function capaNivel(nivel: number): Capa {
  const n = Math.max(0, nivel - 1);
  return { hp: 9 * n, mp: 2 * n, golpe: 2 * n, patada: 3 * n, tecnica: 3 * n, defensa: n };
}

export function bloque(capas: readonly Capa[]): Bloque {
  const t = componerStats(capas);
  const b = {} as Bloque;
  for (const s of STATS) {
    b[s] = Math.max(0, Math.round(t[s] ?? 0));
  }
  b.hp = Math.max(1, b.hp);
  b.critico = Math.min(75, b.critico);
  b.suerte = Math.min(200, b.suerte);
  return b;
}

/** Escala una capa (resonancias aportan una fracción de su carta). */
export function escalarCapa(capa: Capa, factor: number): Capa {
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries(capa)) {
    if (v !== undefined) r[k] = Math.round(v * factor);
  }
  return r;
}

export interface Golpe {
  readonly danio: number;
  readonly critico: boolean;
}

/**
 * Daño = ataque × multiplicador × 60 / (60 + defensa), ±10 %, crítico ×1,75.
 * La defensa nunca anula el golpe: rendimientos decrecientes y mínimo 1.
 */
export function calcularGolpe(azar: Azar, ataque: number, multiplicador: number, defensa: number, criticoPct: number, multCritico = 1.75): Golpe {
  const variacion = 0.9 + entero(azar, 21) / 100;
  const critico = azar.siguiente() * 100 < criticoPct;
  const bruto = ataque * multiplicador * (60 / (60 + Math.max(0, defensa))) * variacion * (critico ? multCritico : 1);
  return { danio: Math.max(1, Math.round(bruto)), critico };
}
