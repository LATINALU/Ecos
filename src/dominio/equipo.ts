// Equipo con rareza y afijos aleatorios ("loot" de ARPG) y objetos ÚNICOS con efectos que cambian el juego.
// El azar es el de minialu (inyectable): con semilla, el mismo cofre da siempre lo mismo en los tests.

import { elegirPorPeso, elegirUno, entero, type Azar, type Capa } from "minialu";
import { AFIJOS, BASES, NOMBRES_RAREZA, UNICOS, type DefUnico } from "../contenido/objetos.ts";
import { nuevoUid } from "./cartas.ts";
import type { EfectoUnico, Ranura } from "./tipos.ts";

export type Rareza = 0 | 1 | 2 | 3 | 4;
export const RAREZA_UNICA: Rareza = 4;

export interface ObjetoEquipo {
  readonly uid: string;
  /** Id del catálogo (base o único): es el `objeto` de la pila en el inventario. */
  readonly base: number;
  readonly ranura: Ranura;
  readonly nombre: string;
  readonly rareza: Rareza;
  readonly nivel: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly efecto?: EfectoUnico;
  /** Veces que se refinó en el Yunque (0~5). */
  readonly refinado?: number;
}

/** Pesos de rareza (común, raro, épico, legendario) según el piso. */
export const PESOS_RAREZA: readonly (readonly number[])[] = [
  [62, 28, 9, 1],
  [48, 34, 15, 3],
  [34, 38, 22, 6],
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

export function generarEquipo(azar: Azar, piso: number, minima: Rareza = 0, ranura?: Ranura): ObjetoEquipo {
  const rareza = tirarRarezaEquipo(azar, piso, minima);
  const nivel = nivelObjeto(piso, azar);
  const def = elegirUno(azar, ranura === undefined ? BASES : BASES.filter((b) => b.ranura === ranura));
  const stats: Record<string, number> = {};
  sumar(stats, def.porNivel, nivel, MULT_RAREZA[rareza] * (0.85 + azar.siguiente() * 0.3));
  const disponibles = [...AFIJOS];
  const nombres: string[] = [];
  for (let i = 0; i < AFIJOS_POR_RAREZA[rareza] && disponibles.length > 0; i++) {
    const afijo = disponibles.splice(entero(azar, disponibles.length), 1)[0];
    sumar(stats, { [afijo.stat]: afijo.porNivel }, nivel, 0.6 + azar.siguiente() * 0.6);
    nombres.push(afijo.nombre);
  }
  const nombre = nombres.length === 0 ? def.nombre : `${def.nombre} ${nombres[0]}`;
  return { uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre, rareza, nivel, stats };
}

export function crearUnico(azar: Azar, piso: number, def?: DefUnico): ObjetoEquipo {
  const u = def ?? elegirUno(azar, UNICOS);
  const nivel = nivelObjeto(piso, azar) + 2;
  const stats: Record<string, number> = {};
  sumar(stats, u.porNivel, nivel, MULT_RAREZA[RAREZA_UNICA]);
  if (u.efecto === "ojo") stats.critico = (stats.critico ?? 0) + 20;
  return { uid: nuevoUid(azar), base: u.id, ranura: u.ranura, nombre: u.nombre, rareza: RAREZA_UNICA, nivel, stats, efecto: u.efecto };
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
  return { ...o, stats, refinado: n, nombre };
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
