// Recetas del Yunque. Ingredientes = materiales/consumibles de la mochila + esquirlas.

import type { Rareza } from "../dominio/equipo.ts";
import { ARMADURAS, JOYAS, type TipoPieza } from "../dominio/tipos.ts";
import {
  MAT_ESCORIA, MAT_ESPORA, MAT_FRAGMENTO, MAT_HUESO, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO,
} from "./objetos.ts";

export type ResultadoReceta =
  | { readonly tipo: "objeto"; readonly objeto: number; readonly cantidad: number }
  | { readonly tipo: "equipo"; readonly ranura: TipoPieza | readonly TipoPieza[]; readonly minima: Rareza }
  | { readonly tipo: "carta" };

export interface Receta {
  readonly id: string;
  readonly nombre: string;
  readonly ingredientes: ReadonlyArray<readonly [objeto: number, cantidad: number]>;
  readonly esquirlas: number;
  readonly resultado: ResultadoReceta;
}

export const RECETAS: readonly Receta[] = [
  { id: "pocion", nombre: "Poción de Vida", ingredientes: [[MAT_HUESO, 3]], esquirlas: 0, resultado: { tipo: "objeto", objeto: OBJ_POCION, cantidad: 1 } },
  { id: "eter", nombre: "Frasco de Éter", ingredientes: [[MAT_ESPORA, 3]], esquirlas: 0, resultado: { tipo: "objeto", objeto: OBJ_ETER, cantidad: 1 } },
  { id: "pocion2", nombre: "Poción de Vida (escoria)", ingredientes: [[MAT_ESCORIA, 2]], esquirlas: 0, resultado: { tipo: "objeto", objeto: OBJ_POCION, cantidad: 1 } },
  { id: "polvo", nombre: "Polvo de Eco", ingredientes: [[MAT_FRAGMENTO, 1], [MAT_HUESO, 2]], esquirlas: 10, resultado: { tipo: "objeto", objeto: OBJ_POLVO, cantidad: 1 } },
  { id: "lagrima", nombre: "Lágrima de Eco", ingredientes: [[MAT_FRAGMENTO, 4], [MAT_ESPORA, 3]], esquirlas: 60, resultado: { tipo: "objeto", objeto: OBJ_LAGRIMA, cantidad: 1 } },
  { id: "arma", nombre: "Forjar arma (Rara o mejor)", ingredientes: [[MAT_HUESO, 6], [MAT_FRAGMENTO, 1]], esquirlas: 40, resultado: { tipo: "equipo", ranura: "arma", minima: 1 } },
  { id: "armadura", nombre: "Forjar pieza de armadura (Rara o mejor)", ingredientes: [[MAT_ESPORA, 6], [MAT_FRAGMENTO, 1]], esquirlas: 40, resultado: { tipo: "equipo", ranura: ARMADURAS, minima: 1 } },
  { id: "amuleto", nombre: "Forjar joya: anillo, aretes o collar (Rara o mejor)", ingredientes: [[MAT_HUESO, 3], [MAT_ESPORA, 3], [MAT_FRAGMENTO, 1]], esquirlas: 40, resultado: { tipo: "equipo", ranura: JOYAS, minima: 1 } },
  { id: "epico", nombre: "Forjar arma Épica", ingredientes: [[MAT_ESCORIA, 6], [MAT_FRAGMENTO, 3]], esquirlas: 150, resultado: { tipo: "equipo", ranura: "arma", minima: 2 } },
  { id: "carta", nombre: "Invocar Carta de Alma", ingredientes: [[MAT_FRAGMENTO, 3], [MAT_HUESO, 2], [MAT_ESPORA, 2]], esquirlas: 30, resultado: { tipo: "carta" } },
];

/** Refinar la pieza equipada: +12 % a todos sus stats, hasta +10. Del +6 en adelante puede fallar. */
export const REFINADO_MAX = 10;

/** Probabilidad de éxito para pasar de `nivelActual` al siguiente (como la mejora de MiniFighter). */
export const EXITO_REFINADO: readonly number[] = [1, 1, 1, 1, 1, 0.75, 0.6, 0.45, 0.33, 0.22];

export function costoRefinado(nivelActual: number): { fragmentos: number; esquirlas: number } {
  return { fragmentos: 1 + Math.floor(nivelActual / 2), esquirlas: 50 * (nivelActual + 1) * (nivelActual >= 5 ? 2 : 1) };
}
