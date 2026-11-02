// Cartas de Alma sobre las mecánicas de minialu (cartas/cartas.ts): rareza por tabla, fusión 3→1 con
// probabilidad por estrella, mejora +1~+5 con tope, stats al azar dentro del rango de la estrella.
//
// Diferencias de diseño con MiniFighter:
//   - La carta equipada como FORMA aporta el 100 % de sus stats y su técnica especial.
//   - Dos RESONANCIAS aportan el 35 % (50 % si son de la misma familia que la forma: "sintonía").
//   - Si la fusión falla, la carta resultante se "reforja": misma estrella, stats nuevos. Nunca se pierde todo.

import {
  elegirUno, entero, fusionar, generarStats, mejorar, tirarRareza,
  type Azar, type Capa, type ErrorFusion, type Resultado, type TablaRareza,
} from "minialu";
import { ALMAS, ESCALA_ESTRELLA, alma } from "../contenido/almas.ts";
import { escalarCapa } from "./stats.ts";

export interface Carta {
  readonly uid: string;
  readonly tipo: number;
  readonly nivel: number;
  readonly personaje: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly mejoras: number;
}

export const NIVEL_MAX_CARTA = ESCALA_ESTRELLA.length - 1;
/** Probabilidad de subir de estrella al fusionar, por nivel de las cartas de entrada. */
export const PROB_FUSION: readonly number[] = [1, 1, 0.85, 0.6, 0.4, 0.22];
/** Costo en esquirlas de fusionar, por nivel de entrada. */
export const COSTO_FUSION: readonly number[] = [15, 40, 100, 240, 550, 1200];
/** Mejoras máximas por carta (cada una usa un Polvo de Eco). */
export const MEJORAS_MAX = 5;

/** Rareza de las cartas que sueltan los monstruos, por piso (tabla acumulada de minialu). */
export const RAREZA_CARTA_PISO: readonly TablaRareza[] = [
  [[0, 0.7], [1, 0.25], [2, 0.05]],
  [[0, 0.45], [1, 0.38], [2, 0.14], [3, 0.03]],
  [[0, 0.25], [1, 0.4], [2, 0.25], [3, 0.08], [4, 0.02]],
];
/** Jefes y cofres sueltan cartas mejores. */
export const RAREZA_CARTA_JEFE: readonly TablaRareza[] = [
  [[1, 0.5], [2, 0.4], [3, 0.1]],
  [[2, 0.5], [3, 0.38], [4, 0.12]],
  [[3, 0.5], [4, 0.38], [5, 0.12]],
];

export function nuevoUid(azar: Azar): string {
  return `${Date.now().toString(36)}-${entero(azar, 2 ** 31).toString(36)}`;
}

export function rangoCarta(personaje: number, nivel: number): { minimos: Record<string, number>; maximos: Record<string, number> } {
  const def = alma(personaje);
  const escala = ESCALA_ESTRELLA[Math.max(0, Math.min(nivel, NIVEL_MAX_CARTA))];
  const minimos: Record<string, number> = {};
  const maximos: Record<string, number> = {};
  for (const [stat, peso] of Object.entries(def.pesos)) {
    if (peso === undefined) continue;
    maximos[stat] = Math.max(1, Math.round(peso * escala));
    minimos[stat] = Math.max(0, Math.floor(maximos[stat] * 0.75));
  }
  return { minimos, maximos };
}

/** Tope de mejora: 20 % por encima del máximo de la estrella. */
export function topeMejora(personaje: number, nivel: number): Record<string, number> {
  const { maximos } = rangoCarta(personaje, nivel);
  const tope: Record<string, number> = {};
  for (const [k, v] of Object.entries(maximos)) tope[k] = Math.ceil(v * 1.2) + MEJORAS_MAX;
  return tope;
}

export function crearCarta(azar: Azar, personaje: number, nivel: number): Carta {
  const n = Math.max(0, Math.min(nivel, NIVEL_MAX_CARTA));
  const { minimos, maximos } = rangoCarta(personaje, n);
  return {
    uid: nuevoUid(azar),
    tipo: alma(personaje).tipo,
    nivel: n,
    personaje,
    stats: generarStats(azar, minimos, maximos),
    mejoras: 0,
  };
}

export function cartaAleatoria(azar: Azar, tabla: TablaRareza): Carta {
  return crearCarta(azar, elegirUno(azar, ALMAS).id, tirarRareza(azar, tabla));
}

export function fusionarCartas(
  cartas: readonly [Carta, Carta, Carta],
  azar: Azar,
  suerte = false,
): Resultado<{ carta: Carta; subio: boolean }, ErrorFusion> {
  return fusionar(cartas, {
    azar,
    nivelMaximo: NIVEL_MAX_CARTA,
    probabilidad: (_tipo, nivel) => PROB_FUSION[nivel],
    // Si las tres son de almas distintas, sale cualquier alma de esa familia.
    personajesPosibles: (cs) => ALMAS.filter((a) => a.tipo === cs[0].tipo).map((a) => a.id),
    crear: (_tipo, nivel, personaje) => crearCarta(azar, personaje, nivel),
  }, suerte);
}

export function mejorarCarta(carta: Carta, azar: Azar): Resultado<{ carta: Carta; incremento: number }, "al-maximo"> {
  if (carta.mejoras >= MEJORAS_MAX) {
    return { ok: false, error: "al-maximo" };
  }
  const r = mejorar({ ...carta.stats }, topeMejora(carta.personaje, carta.nivel), azar);
  if (!r.ok) return r;
  return { ok: true, valor: { incremento: r.valor.incremento, carta: { ...carta, stats: r.valor.stats, mejoras: carta.mejoras + 1 } } };
}

export function capaForma(carta: Carta | null): Capa {
  return carta === null ? {} : carta.stats;
}

export const FACTOR_RESONANCIA = 0.35;
export const FACTOR_SINTONIA = 0.5;

export function capaResonancia(carta: Carta | null, forma: Carta | null, extra = 0): Capa {
  if (carta === null) return {};
  const sintonia = forma !== null && forma.tipo === carta.tipo;
  return escalarCapa(carta.stats, (sintonia ? FACTOR_SINTONIA : FACTOR_RESONANCIA) + extra);
}

export function estrellas(carta: Carta): string {
  return "★".repeat(carta.nivel + 1);
}

export function nombreCarta(carta: Carta): string {
  const a = alma(carta.personaje);
  return `${a.nombre}, ${a.titulo}${carta.mejoras > 0 ? ` +${carta.mejoras}` : ""}`;
}

/** Valor para comparar cartas (y elegir el legado del Eco). */
export function poderCarta(carta: Carta): number {
  return Object.entries(carta.stats).reduce((s, [k, v]) => s + (k === "hp" ? v / 3 : v), 0);
}
