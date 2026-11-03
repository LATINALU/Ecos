// Botín. Usa minialu/tirarDrop con dos modos:
//   - Monstruos: "cada-uno" (juego de looteo: una muerte puede dar varias cosas o nada).
//   - Cofres:    "ponderado" (siempre sale exactamente una recompensa principal).
// Las tablas contienen consumibles reales y "fichas" (equipo, carta, único) que se resuelven después con el
// generador correspondiente. probabilidadReal() alimenta el Bestiario para que el jugador vea las chances.

import { entero, probabilidadReal, tirarDrop, type Azar, type EntradaDrop } from "minialu";
import { ORDEN_SUBARMAS, type IdSubarma } from "../contenido/subarmas.ts";
import { conjuntoDelPiso } from "../contenido/conjuntos.ts";
import { ACCESORIOS, ARMADURAS, type TipoPieza } from "./tipos.ts";
import { MAT_FRAGMENTO, RUNAS, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO, materialDelPiso } from "../contenido/objetos.ts";
import { RAREZA_CARTA_JEFE, RAREZA_CARTA_PISO, cartaAleatoria, type Carta } from "./cartas.ts";
import { crearUnico, generarEquipo, type ObjetoEquipo, type Rareza } from "./equipo.ts";

export const FICHA_EQUIPO = 900;
export const FICHA_CARTA = 901;
export const FICHA_UNICO = 902;
export const FICHA_RUNA = 903;
export const FICHA_CONJUNTO = 904;
/** Pieza de armadura o accesorio (las armaduras ahora caen aparte de las armas). */
export const FICHA_ARMADURA = 905;

/** Clases de pieza de la ficha de equipo genérica: armas un poco más seguido que cada pieza suelta. */
const CLASES_EQUIPO: readonly TipoPieza[] = ["arma", "arma", "arma", ...ARMADURAS, ...ACCESORIOS];
const CLASES_ARMADURA: readonly TipoPieza[] = [...ARMADURAS, ...ARMADURAS, ...ACCESORIOS];

/**
 * Rareza mínima de lo que suelta cada fuente: los comunes cualquier cosa, las élites y los cofres Poco común o
 * mejor, y los guardianes Raro o mejor (más una pieza garantizada Épica).
 */
const MINIMA: Readonly<Record<"comun" | "elite" | "cofre" | "jefe", Rareza>> = { comun: 0, elite: 1, cofre: 1, jefe: 2 };

export type Premio =
  | { readonly tipo: "esquirlas"; readonly cantidad: number }
  | { readonly tipo: "objeto"; readonly objeto: number; readonly cantidad: number }
  | { readonly tipo: "equipo"; readonly equipo: ObjetoEquipo }
  | { readonly tipo: "carta"; readonly carta: Carta }
  | { readonly tipo: "corazones"; readonly cantidad: number }
  | { readonly tipo: "subarma"; readonly subarma: IdSubarma };

export type Categoria = "comun" | "elite" | "jefe" | "eco";

export const TABLA_COMUN: readonly EntradaDrop[] = [
  [OBJ_POCION, 0.05], [OBJ_ETER, 0.05], [OBJ_POLVO, 0.06], [FICHA_EQUIPO, 0.07], [FICHA_ARMADURA, 0.06], [FICHA_CARTA, 0.09],
  [FICHA_UNICO, 0.002],
];
export const TABLA_ELITE: readonly EntradaDrop[] = [
  [OBJ_POCION, 0.15], [OBJ_ETER, 0.12], [OBJ_POLVO, 0.25], [FICHA_EQUIPO, 0.3], [FICHA_ARMADURA, 0.3], [FICHA_CARTA, 0.4],
  [FICHA_UNICO, 0.02], [FICHA_RUNA, 0.04], [FICHA_CONJUNTO, 0.07],
];
/** Cofre: pesos relativos (ponderado). */
export const TABLA_COFRE: readonly EntradaDrop[] = [
  [FICHA_EQUIPO, 28], [FICHA_ARMADURA, 26], [FICHA_CARTA, 28], [FICHA_UNICO, 5], [OBJ_LAGRIMA, 4], [FICHA_RUNA, 6], [FICHA_CONJUNTO, 9],
];

const ESQUIRLAS_BASE: Readonly<Record<Categoria, readonly [number, number]>> = {
  comun: [2, 6], elite: [10, 22], jefe: [120, 180], eco: [60, 100],
};

export interface ModificadoresBotin {
  /** Multiplicador de probabilidades (Corona Rota). */
  readonly suerte: number;
  /** Multiplicador de esquirlas. */
  readonly codicia: number;
  /** Stat Suerte: inclina la rareza del equipo y puede subir una estrella a las cartas. */
  readonly fortuna?: number;
}

export const SIN_MODIFICADORES: ModificadoresBotin = { suerte: 1, codicia: 1, fortuna: 0 };

function resolverFicha(azar: Azar, piso: number, ficha: number, minima: Rareza = 0, fortuna = 0): Premio {
  switch (ficha) {
    case FICHA_EQUIPO:
      return { tipo: "equipo", equipo: generarEquipo(azar, piso, minima, CLASES_EQUIPO, undefined, fortuna) };
    case FICHA_ARMADURA:
      return { tipo: "equipo", equipo: generarEquipo(azar, piso, minima, CLASES_ARMADURA, undefined, fortuna) };
    case FICHA_CARTA:
      // Élites y cofres: tabla de cartas de un piso más hondo; guardianes, la de jefes.
      return { tipo: "carta", carta: cartaAleatoria(azar, minima >= 2 ? RAREZA_CARTA_JEFE[indicePiso(piso)] : RAREZA_CARTA_PISO[indicePiso(piso + (minima > 0 ? 2 : 0))], fortuna) };
    case FICHA_UNICO:
      return { tipo: "equipo", equipo: crearUnico(azar, piso) };
    case FICHA_RUNA:
      return { tipo: "objeto", objeto: RUNAS[entero(azar, RUNAS.length)].objeto, cantidad: 1 };
    case FICHA_CONJUNTO:
      return { tipo: "equipo", equipo: generarEquipo(azar, piso, 3, ARMADURAS, conjuntoDelPiso(piso).id) };
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
    // Un Mítico con nombre (35 %) o una pieza Legendaria o mejor; una pieza Épica o mejor; dos cartas de jefe.
    const f = mod.fortuna ?? 0;
    premios.push(azar.siguiente() < 0.35 ? resolverFicha(azar, piso, FICHA_UNICO) : { tipo: "equipo", equipo: generarEquipo(azar, piso, 4, CLASES_EQUIPO, undefined, f) });
    premios.push({ tipo: "equipo", equipo: generarEquipo(azar, piso, 3, CLASES_ARMADURA, undefined, f) });
    premios.push(resolverFicha(azar, piso, FICHA_CARTA, MINIMA.jefe, f));
    premios.push(resolverFicha(azar, piso, FICHA_CARTA, MINIMA.jefe, f));
    premios.push({ tipo: "objeto", objeto: OBJ_POCION, cantidad: 2 });
    premios.push({ tipo: "objeto", objeto: OBJ_POLVO, cantidad: 2 + entero(azar, 3) });
    premios.push({ tipo: "objeto", objeto: materialDelPiso(piso), cantidad: 5 });
    premios.push({ tipo: "objeto", objeto: MAT_FRAGMENTO, cantidad: 3 });
    // Cada guardián suelta una runa y una pieza del conjunto de su zona.
    premios.push(resolverFicha(azar, piso, FICHA_RUNA));
    premios.push(resolverFicha(azar, piso, FICHA_CONJUNTO));
    return premios;
  }
  const tabla = categoria === "comun" ? TABLA_COMUN : TABLA_ELITE;
  for (const ficha of tirarDrop(azar, tabla, "cada-uno", mod.suerte)) {
    premios.push(resolverFicha(azar, piso, ficha, categoria === "elite" ? MINIMA.elite : MINIMA.comun, mod.fortuna ?? 0));
  }
  premios.push(...agruparObjetos(tirarDrop(azar, tablaMateriales(piso, categoria === "comun" ? "comun" : "elite"), "cada-uno", mod.suerte)));
  return premios;
}

export function botinCofre(azar: Azar, piso: number, mod: ModificadoresBotin = SIN_MODIFICADORES): Premio[] {
  const [ficha] = tirarDrop(azar, TABLA_COFRE, "ponderado");
  return [
    esquirlas(azar, piso, "elite", mod),
    resolverFicha(azar, piso, ficha, MINIMA.cofre, mod.fortuna ?? 0),
    { tipo: "objeto", objeto: entero(azar, 2) === 0 ? OBJ_POCION : OBJ_ETER, cantidad: 1 },
    { tipo: "objeto", objeto: materialDelPiso(piso), cantidad: 2 },
  ];
}

/** Vela rota (estilo Castlevania): casi siempre corazones; a veces una subarma o esquirlas. */
export function botinVela(azar: Azar, piso: number): Premio[] {
  const r = azar.siguiente();
  if (r < 0.1) return [{ tipo: "subarma", subarma: ORDEN_SUBARMAS[entero(azar, ORDEN_SUBARMAS.length)] }];
  if (r < 0.22) return [{ tipo: "esquirlas", cantidad: 2 + entero(azar, 4) * piso }];
  return [{ tipo: "corazones", cantidad: r < 0.35 ? 5 : 1 }];
}

/** Probabilidades reales por muerte (para el Bestiario). */
export function chancesVisibles(categoria: "comun" | "elite"): Map<number, number> {
  return probabilidadReal(categoria === "comun" ? TABLA_COMUN : TABLA_ELITE, "cada-uno");
}
