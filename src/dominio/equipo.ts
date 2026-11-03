// Equipo con rareza y afijos aleatorios ("loot" de ARPG) y objetos ÚNICOS con efectos que cambian el juego.
// El azar es el de minialu (inyectable): con semilla, el mismo cofre da siempre lo mismo en los tests.

import { elegirPorPeso, elegirUno, entero, type Azar, type Capa } from "minialu";
import { AFIJOS, BASES, NOMBRES_RAREZA, RASGOS_EQUIPO, UNICOS, type DefUnico, type IdRasgoEquipo } from "../contenido/objetos.ts";
import { conjunto as defConjunto, type IdConjunto } from "../contenido/conjuntos.ts";
import { nuevoUid } from "./cartas.ts";
import { ELEMENTOS, ORDEN_ELEMENTOS, type Elemento } from "../contenido/elementos.ts";
import { ACCESORIOS, ARMADURAS, normalizarPieza, type EfectoUnico, type TipoPieza } from "./tipos.ts";

export type Rareza = 0 | 1 | 2 | 3 | 4;
export const RAREZA_UNICA: Rareza = 4;

export interface ObjetoEquipo {
  readonly uid: string;
  /** Id del catálogo (base o único): es el `objeto` de la pila en el inventario. */
  readonly base: number;
  /** Clase de pieza (arma, casco, anillo...). Los anillos van en cualquiera de las dos ranuras de anillo. */
  readonly ranura: TipoPieza;
  readonly nombre: string;
  readonly rareza: Rareza;
  readonly nivel: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly efecto?: EfectoUnico;
  /** Veces que se refinó en el Yunque (0~5). */
  readonly refinado?: number;
  /** Calidad de la forja (0,75~1,3): multiplica los stats. */
  readonly calidad?: number;
  /** Rasgos al azar (alcance, velocidad de ataque, daño crítico...). */
  readonly rasgos?: Readonly<Partial<Record<IdRasgoEquipo, number>>>;
  /** Pieza de un conjunto (2 y 3 piezas dan bonos). */
  readonly conjunto?: IdConjunto;
  /** Solo armas: elemento (fuego, hielo, veneno, rayo) que suma daño y un efecto. */
  readonly elemento?: Elemento;
}

/** Probabilidad de que un arma salga elemental según la rareza. */
const PROB_ELEMENTO = [0.2, 0.35, 0.5, 0.65, 0];

export function tirarElemento(azar: Azar, rareza: Rareza): Elemento | undefined {
  return azar.siguiente() < PROB_ELEMENTO[rareza] ? elegirUno(azar, ORDEN_ELEMENTOS) : undefined;
}

/** Cantidad de rasgos según rareza: común (a veces 1), raro 1, épico 2, legendario 3, único 1. */
const RASGOS_POR_RAREZA = [0, 1, 2, 3, 1];

export function tirarRasgos(azar: Azar, ranura: TipoPieza, rareza: Rareza): Partial<Record<IdRasgoEquipo, number>> {
  const cantidad = RASGOS_POR_RAREZA[rareza] + (rareza === 0 && azar.siguiente() < 0.3 ? 1 : 0);
  const posibles = RASGOS_EQUIPO.filter((r) => r.en === undefined || r.en.includes(ranura));
  const rasgos: Partial<Record<IdRasgoEquipo, number>> = {};
  const tirar = (r: (typeof RASGOS_EQUIPO)[number]): void => {
    const v = r.min + azar.siguiente() * (r.max - r.min) * (1 + rareza * 0.1);
    rasgos[r.id] = r.id === "eterGolpe" || r.id === "eterMax" ? Math.round(v) : Math.round(v * 100) / 100;
    posibles.splice(posibles.indexOf(r), 1);
  };
  // Los accesorios (capa, anillos, aretes, collar) siempre traen al menos un rasgo único de su clase.
  if (ACCESORIOS.includes(ranura)) {
    const unicos = posibles.filter((r) => r.unicoDe?.includes(ranura));
    if (unicos.length > 0) tirar(unicos[entero(azar, unicos.length)]);
  }
  while (Object.keys(rasgos).length < cantidad && posibles.length > 0) tirar(posibles[entero(azar, posibles.length)]);
  return rasgos;
}

/** Calidad de forja: la mayoría ronda el 100 %; las piezas raras salen mejores. */
export function tirarCalidad(azar: Azar, rareza: Rareza): number {
  const v = 0.75 + (azar.siguiente() + azar.siguiente()) / 2 * 0.45 + rareza * 0.025;
  return Math.round(Math.min(1.3, v) * 100) / 100;
}

export function etiquetaCalidad(c: number | undefined): string | null {
  if (c === undefined) return null;
  return c >= 1.18 ? "Magistral" : c <= 0.85 ? "Endeble" : null;
}

/** Pesos de rareza (común, raro, épico, legendario) según el piso. */
export const PESOS_RAREZA: readonly (readonly number[])[] = [
  [62, 28, 9, 1],
  [52, 32, 13, 3],
  [44, 35, 17, 4],
  [38, 37, 20, 5],
  [32, 38, 23, 7],
  [27, 38, 26, 9],
  [22, 37, 29, 12],
  [18, 35, 32, 15],
  [14, 33, 35, 18],
  [10, 30, 38, 22],
];

/** Afijos extra según rareza. */
const AFIJOS_POR_RAREZA = [0, 1, 2, 3, 0];
/** Multiplicador de la base según rareza. */
const MULT_RAREZA = [1, 1.15, 1.3, 1.5, 1.4];

export function nivelObjeto(piso: number, azar: Azar): number {
  return Math.max(1, piso * 4 + entero(azar, 4) - 2);
}

export function tirarRarezaEquipo(azar: Azar, piso: number, minima: Rareza = 0): Rareza {
  const pesos = PESOS_RAREZA[Math.max(0, Math.min(piso - 1, PESOS_RAREZA.length - 1))];
  const tabla = pesos.map((p, i) => [i as Rareza, i < minima ? 0 : p] as const).filter(([, p]) => p > 0);
  return tabla.length === 0 ? minima : elegirPorPeso(azar, tabla);
}

function sumar(stats: Record<string, number>, porNivel: Readonly<Record<string, number | undefined>>, nivel: number, mult: number): void {
  for (const [k, v] of Object.entries(porNivel)) {
    if (v === undefined) continue;
    stats[k] = (stats[k] ?? 0) + Math.max(1, Math.round(v * nivel * mult));
  }
}

/** `tipo`: una clase de pieza, una lista de clases (p. ej. todas las de armadura) o cualquiera. */
export function generarEquipo(
  azar: Azar, piso: number, minima: Rareza = 0, tipo?: TipoPieza | readonly TipoPieza[], deConjunto?: IdConjunto,
): ObjetoEquipo {
  const rareza = tirarRarezaEquipo(azar, piso, minima);
  const nivel = nivelObjeto(piso, azar);
  const tipos = tipo === undefined ? undefined : typeof tipo === "string" ? [tipo] : tipo;
  // Sin tipo pedido: primero la clase de pieza (así las armas no dominan por tener más bases).
  const clase = tipos !== undefined ? elegirUno(azar, tipos) : elegirUno(azar, [...new Set(BASES.map((b) => b.ranura))]);
  const def = elegirUno(azar, BASES.filter((b) => b.ranura === clase));
  const stats: Record<string, number> = {};
  const calidad = tirarCalidad(azar, rareza);
  sumar(stats, def.porNivel, nivel, MULT_RAREZA[rareza] * calidad);
  const disponibles = [...AFIJOS];
  const nombres: string[] = [];
  for (let i = 0; i < AFIJOS_POR_RAREZA[rareza] && disponibles.length > 0; i++) {
    const afijo = disponibles.splice(entero(azar, disponibles.length), 1)[0];
    sumar(stats, { [afijo.stat]: afijo.porNivel }, nivel, 0.6 + azar.siguiente() * 0.6);
    nombres.push(afijo.nombre);
  }
  const etiqueta = etiquetaCalidad(calidad);
  const rasgos = tirarRasgos(azar, def.ranura, rareza);
  // La base aporta sus rasgos propios (el Estoque siempre es rápido, el Arco Largo siempre llega lejos).
  for (const [id, v] of Object.entries(def.rasgos ?? {}) as [IdRasgoEquipo, number][]) {
    rasgos[id] = Math.round(((rasgos[id] ?? 0) + v) * 100) / 100;
  }
  // Solo las 6 piezas de armadura pueden ser de conjunto.
  if (deConjunto !== undefined && ARMADURAS.includes(def.ranura)) {
    const c = defConjunto(deConjunto);
    return {
      uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre: `${def.nombre} · ${c.nombre}`,
      rareza: Math.max(rareza, 2) as Rareza, nivel, stats, calidad, rasgos, conjunto: deConjunto,
    };
  }
  const elemento = def.ranura === "arma" ? tirarElemento(azar, rareza) : undefined;
  const nucleo = elemento !== undefined ? `${def.nombre} ${ELEMENTOS[elemento].sufijo}` : nombres.length === 0 ? def.nombre : `${def.nombre} ${nombres[0]}`;
  const nombre = (etiqueta !== null ? `${etiqueta} · ` : "") + nucleo;
  const obj: ObjetoEquipo = { uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre, rareza, nivel, stats, calidad, rasgos };
  return elemento !== undefined ? { ...obj, elemento } : obj;
}

export function crearUnico(azar: Azar, piso: number, def?: DefUnico): ObjetoEquipo {
  const u = def ?? elegirUno(azar, UNICOS);
  const nivel = nivelObjeto(piso, azar) + 2;
  const stats: Record<string, number> = {};
  sumar(stats, u.porNivel, nivel, MULT_RAREZA[RAREZA_UNICA]);
  if (u.efecto === "ojo") stats.critico = (stats.critico ?? 0) + 20;
  return {
    uid: nuevoUid(azar), base: u.id, ranura: u.ranura, nombre: u.nombre, rareza: RAREZA_UNICA, nivel, stats, efecto: u.efecto,
    calidad: 1.1, rasgos: tirarRasgos(azar, u.ranura, RAREZA_UNICA),
  };
}

/** Arma común de nivel 1 de una base concreta (el arma inicial elegida). */
export function equipoInicial(azar: Azar, idBase: number): ObjetoEquipo {
  const def = BASES.find((b) => b.id === idBase) ?? BASES[0];
  const stats: Record<string, number> = {};
  sumar(stats, def.porNivel, 2, 1);
  return { uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre: def.nombre, rareza: 0, nivel: 2, stats };
}

/** Refinado: +12 % a todos los stats (al menos +1) y "+N" en el nombre. */
export function refinar(o: ObjetoEquipo): ObjetoEquipo {
  const n = (o.refinado ?? 0) + 1;
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.stats)) stats[k] = Math.max(v + 1, Math.round(v * 1.12));
  const nombre = o.nombre.replace(/ \+\d+$/, "") + ` +${n}`;
  // (los rasgos y la calidad se conservan: refinar mejora los números, no cambia la pieza)
  return { ...o, stats, refinado: n, nombre };
}

/** Guardados viejos: la pieza "armadura" pasa a pecho y "amuleto" a collar. */
export function normalizarEquipo(o: ObjetoEquipo): ObjetoEquipo {
  const ranura = normalizarPieza(o.ranura);
  return ranura === o.ranura ? o : { ...o, ranura };
}

export function capaEquipo(objetos: readonly (ObjetoEquipo | null | undefined)[]): Capa {
  const total: Record<string, number> = {};
  for (const o of objetos) {
    if (o == null) continue;
    for (const [k, v] of Object.entries(o.stats)) total[k] = (total[k] ?? 0) + v;
  }
  return total;
}

/** Puntuación para comparar piezas: suma de stats ponderada por rareza. */
export function puntuacion(o: ObjetoEquipo): number {
  const suma = Object.entries(o.stats).reduce((s, [k, v]) => s + (k === "hp" ? v / 4 : v), 0);
  return suma * (1 + o.rareza * 0.25) + (o.rareza === RAREZA_UNICA ? 50 : 0);
}

/** Esquirlas al desguazar una pieza (minialu/venta: una fracción de su valor). */
export function valorDesguace(o: ObjetoEquipo): number {
  return Math.max(3, Math.round(puntuacion(o) * 0.8));
}

export function etiquetaRareza(r: Rareza): string {
  return NOMBRES_RAREZA[r];
}
