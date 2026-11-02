// Botín. Usa minialu/tirarDrop con dos modos:
//   - Monstruos: "cada-uno" (juego de looteo: una muerte puede dar varias cosas o nada).
//   - Cofres:    "ponderado" (siempre sale exactamente una recompensa principal).
// Las tablas contienen consumibles reales y "fichas" (equipo, carta, único) que se resuelven después con el
// generador correspondiente. probabilidadReal() alimenta el Bestiario para que el jugador vea las chances.

import { entero, probabilidadReal, tirarDrop, type Azar, type EntradaDrop } from "minialu";
import { MAT_FRAGMENTO, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO, materialDelPiso } from "../contenido/objetos.ts";
import { RAREZA_CARTA_JEFE, RAREZA_CARTA_PISO, cartaAleatoria, type Carta } from "./cartas.ts";
import { crearUnico, generarEquipo, type ObjetoEquipo, type Rareza } from "./equipo.ts";

export const FICHA_EQUIPO = 900;
export const FICHA_CARTA = 901;
export const FICHA_UNICO = 902;

export type Premio =
  | { readonly tipo: "esquirlas"; readonly cantidad: number }
  | { readonly tipo: "objeto"; readonly objeto: number; readonly cantidad: number }
  | { readonly tipo: "equipo"; readonly equipo: ObjetoEquipo }
  | { readonly tipo: "carta"; readonly carta: Carta };

export type Categoria = "comun" | "elite" | "jefe" | "eco";

export const TABLA_COMUN: readonly EntradaDrop[] = [
  [OBJ_POCION, 0.05], [OBJ_ETER, 0.05], [OBJ_POLVO, 0.06], [FICHA_EQUIPO, 0.08], [FICHA_CARTA, 0.085], [FICHA_UNICO, 0.003],
];
export const TABLA_ELITE: readonly EntradaDrop[] = [
  [OBJ_POCION, 0.15], [OBJ_ETER, 0.12], [OBJ_POLVO, 0.25], [FICHA_EQUIPO, 0.35], [FICHA_CARTA, 0.3], [FICHA_UNICO, 0.02],
];
/** Cofre: pesos relativos (ponderado). */
export const TABLA_COFRE: readonly EntradaDrop[] = [
  [FICHA_EQUIPO, 52], [FICHA_CARTA, 33], [FICHA_UNICO, 9], [OBJ_LAGRIMA, 6],
];

const ESQUIRLAS_BASE: Readonly<Record<Categoria, readonly [number, number]>> = {
  comun: [2, 6], elite: [10, 22], jefe: [120, 180], eco: [60, 100],
};

export interface ModificadoresBotin {
  /** Multiplicador de probabilidades (Corona Rota). */
  readonly suerte: number;
  /** Multiplicador de esquirlas. */
  readonly codicia: number;
}

export const SIN_MODIFICADORES: ModificadoresBotin = { suerte: 1, codicia: 1 };

function resolverFicha(azar: Azar, piso: number, ficha: number, minima: Rareza = 0): Premio {
  switch (ficha) {
    case FICHA_EQUIPO:
      return { tipo: "equipo", equipo: generarEquipo(azar, piso, minima) };
    case FICHA_CARTA:
      return { tipo: "carta", carta: cartaAleatoria(azar, (minima > 0 ? RAREZA_CARTA_JEFE : RAREZA_CARTA_PISO)[indicePiso(piso)]) };
    case FICHA_UNICO:
      return { tipo: "equipo", equipo: crearUnico(azar, piso) };
    default:
      return { tipo: "objeto", objeto: ficha, cantidad: 1 };
  }
}

function indicePiso(piso: number): number {
  return Math.max(0, Math.min(piso - 1, RAREZA_CARTA_PISO.length - 1));
}

function esquirlas(azar: Azar, piso: number, categoria: Categoria, mod: ModificadoresBotin): Premio {
  const [min, max] = ESQUIRLAS_BASE[categoria];
  const base = min + entero(azar, max - min + 1);
  return { tipo: "esquirlas", cantidad: Math.round(base * (1 + (piso - 1) * 0.6) * mod.codicia) };
}

/** Materiales para el Yunque: cada piso suelta el suyo; élites y guardianes, Fragmentos de Eco. */
export function tablaMateriales(piso: number, categoria: "comun" | "elite"): EntradaDrop[] {
  const mat = materialDelPiso(piso);
  return categoria === "comun"
    ? [[mat, 0.32], [MAT_FRAGMENTO, 0.025]]
    : [[mat, 1], [mat, 0.6], [MAT_FRAGMENTO, 0.4]];
}

function agruparObjetos(ids: readonly number[]): Premio[] {
  const cuenta = new Map<number, number>();
  for (const id of ids) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  return [...cuenta].map(([objeto, cantidad]) => ({ tipo: "objeto", objeto, cantidad }));
}

export function botinEnemigo(azar: Azar, piso: number, categoria: Categoria, mod: ModificadoresBotin = SIN_MODIFICADORES): Premio[] {
  const premios: Premio[] = [esquirlas(azar, piso, categoria, mod)];
  if (categoria === "jefe") {
    premios.push(resolverFicha(azar, piso, FICHA_UNICO));
    premios.push(resolverFicha(azar, piso, FICHA_CARTA, 2));
    premios.push({ tipo: "equipo", equipo: generarEquipo(azar, piso, 2) });
    premios.push({ tipo: "objeto", objeto: OBJ_POCION, cantidad: 2 });
    premios.push({ tipo: "objeto", objeto: OBJ_POLVO, cantidad: 2 + entero(azar, 3) });
    premios.push({ tipo: "objeto", objeto: materialDelPiso(piso), cantidad: 5 });
    premios.push({ tipo: "objeto", objeto: MAT_FRAGMENTO, cantidad: 3 });
    return premios;
  }
  const tabla = categoria === "comun" ? TABLA_COMUN : TABLA_ELITE;
  for (const ficha of tirarDrop(azar, tabla, "cada-uno", mod.suerte)) {
    premios.push(resolverFicha(azar, piso, ficha, categoria === "elite" ? 1 : 0));
  }
  premios.push(...agruparObjetos(tirarDrop(azar, tablaMateriales(piso, categoria === "comun" ? "comun" : "elite"), "cada-uno", mod.suerte)));
  return premios;
}

export function botinCofre(azar: Azar, piso: number, mod: ModificadoresBotin = SIN_MODIFICADORES): Premio[] {
  const [ficha] = tirarDrop(azar, TABLA_COFRE, "ponderado");
  return [
    esquirlas(azar, piso, "elite", mod),
    resolverFicha(azar, piso, ficha, 1),
    { tipo: "objeto", objeto: entero(azar, 2) === 0 ? OBJ_POCION : OBJ_ETER, cantidad: 1 },
    { tipo: "objeto", objeto: materialDelPiso(piso), cantidad: 2 },
  ];
}

/** Probabilidades reales por muerte (para el Bestiario). */
export function chancesVisibles(categoria: "comun" | "elite"): Map<number, number> {
  return probabilidadReal(categoria === "comun" ? TABLA_COMUN : TABLA_ELITE, "cada-uno");
}
