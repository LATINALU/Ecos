// Equipo con rareza y modificadores aleatorios ("loot" de ARPG).
// Seis rarezas: Común (solo stats) · Poco común (1 modificador) · Raro (2) · Épico (3) · Legendario (4) ·
// Mítico (4 + una PASIVA ÚNICA). Los objetos únicos con nombre (Filo Gemelo, Corona Rota...) también son Míticos.
// El azar es el de minialu (inyectable): con semilla, el mismo cofre da siempre lo mismo en los tests.

import { elegirPorPeso, elegirUno, entero, type Azar, type Capa } from "minialu";
import { AFIJOS, BASES, NOMBRES_RAREZA, RASGOS_EQUIPO, UNICOS, firmasDe, type DefUnico, type IdRasgoEquipo } from "../contenido/objetos.ts";
import { conjunto as defConjunto, type IdConjunto } from "../contenido/conjuntos.ts";
import { nuevoUid } from "./cartas.ts";
import { ELEMENTOS, ORDEN_ELEMENTOS, type Elemento } from "../contenido/elementos.ts";
import { pasivaMitica, pasivasMiticasPara, type IdPasivaMitica } from "../contenido/miticas.ts";
import { ARMADURAS, normalizarPieza, type EfectoUnico, type TipoPieza } from "./tipos.ts";

export type Rareza = 0 | 1 | 2 | 3 | 4 | 5;
export const RAREZA_MITICA: Rareza = 5;
/** Los únicos con nombre son Míticos. */
export const RAREZA_UNICA: Rareza = RAREZA_MITICA;
/** Versión del formato de rareza (2 = seis rarezas). Los guardados sin versión se migran en normalizarEquipo. */
export const VERSION_RAREZA = 2;

/** Modificadores (rasgos al azar) por rareza. */
export const MODIFICADORES_POR_RAREZA: readonly number[] = [0, 1, 2, 3, 4, 4];

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
  /** Solo Míticos: pasiva única. */
  readonly pasiva?: IdPasivaMitica;
  /** Versión del formato de rareza. */
  readonly v?: number;
}

/** Probabilidad de que un arma salga elemental según la rareza. */
const PROB_ELEMENTO = [0, 0.25, 0.35, 0.5, 0.6, 0.7];

export function tirarElemento(azar: Azar, rareza: Rareza): Elemento | undefined {
  return azar.siguiente() < PROB_ELEMENTO[rareza] ? elegirUno(azar, ORDEN_ELEMENTOS) : undefined;
}

export function tirarRasgos(
  azar: Azar, ranura: TipoPieza, rareza: Rareza, excluir: readonly string[] = [],
): Partial<Record<IdRasgoEquipo, number>> {
  const cantidad = MODIFICADORES_POR_RAREZA[rareza];
  // `excluir`: los rasgos fijos de la base (así un Estoque no "gasta" un modificador en la velocidad que ya trae).
  const posibles = RASGOS_EQUIPO.filter((r) => r.en.includes(ranura) && !excluir.includes(r.id));
  const rasgos: Partial<Record<IdRasgoEquipo, number>> = {};
  const tirar = (r: (typeof RASGOS_EQUIPO)[number]): void => {
    const v = r.min + azar.siguiente() * (r.max - r.min) * (1 + rareza * 0.08);
    rasgos[r.id] = r.entero === true ? Math.round(v) : Math.round(v * 1000) / 1000;
    posibles.splice(posibles.indexOf(r), 1);
  };
  // Toda pieza con modificadores trae al menos uno de FIRMA de su ranura.
  if (cantidad > 0) {
    const firmas = firmasDe(ranura).filter((r) => posibles.includes(r));
    if (firmas.length > 0) tirar(firmas[entero(azar, firmas.length)]);
  }
  while (Object.keys(rasgos).length < cantidad && posibles.length > 0) tirar(posibles[entero(azar, posibles.length)]);
  return rasgos;
}

/** Calidad de forja: la mayoría ronda el 100 %; las piezas raras salen mejores. */
export function tirarCalidad(azar: Azar, rareza: Rareza): number {
  const v = 0.75 + (azar.siguiente() + azar.siguiente()) / 2 * 0.45 + rareza * 0.02;
  return Math.round(Math.min(1.3, v) * 100) / 100;
}

export function etiquetaCalidad(c: number | undefined): string | null {
  if (c === undefined) return null;
  return c >= 1.18 ? "Magistral" : c <= 0.85 ? "Endeble" : null;
}

/** Pesos de rareza (común, poco común, raro, épico, legendario, mítico) según el piso. */
export const PESOS_RAREZA: readonly (readonly number[])[] = [
  [50, 30, 14, 5, 1, 0.15],
  [44, 31, 16, 7, 1.8, 0.25],
  [38, 31, 18, 9, 3, 0.4],
  [33, 30, 20, 11, 4.5, 0.6],
  [28, 29, 22, 13, 6, 0.9],
  [23, 28, 23, 16, 8, 1.2],
  [19, 26, 24, 18, 10, 1.6],
  [15, 24, 25, 20, 12, 2.2],
  [12, 22, 25, 22, 14, 3],
  [9, 20, 25, 24, 17, 4],
];

/** Stats al azar (afijos) según rareza: todas las piezas traen al menos uno. */
const AFIJOS_POR_RAREZA = [1, 1, 1, 2, 2, 3];
/** Multiplicador de la base según rareza. */
const MULT_RAREZA = [1, 1.08, 1.18, 1.32, 1.5, 1.7];

export function nivelObjeto(piso: number, azar: Azar): number {
  return Math.max(1, piso * 4 + entero(azar, 4) - 2);
}

/**
 * Rareza al azar. La SUERTE (`fortuna`, el stat) inclina la tabla hacia arriba: cada 100 puntos, las rarezas
 * altas pesan bastante más (+35 % por escalón de rareza).
 */
export function tirarRarezaEquipo(azar: Azar, piso: number, minima: Rareza = 0, fortuna = 0): Rareza {
  const pesos = PESOS_RAREZA[Math.max(0, Math.min(piso - 1, PESOS_RAREZA.length - 1))];
  const inclinacion = Math.max(0, fortuna) / 100;
  const tabla = pesos.map((p, i) => [i as Rareza, i < minima ? 0 : p * (1 + inclinacion * i * 0.35)] as const).filter(([, p]) => p > 0);
  return tabla.length === 0 ? minima : elegirPorPeso(azar, tabla);
}

function sumar(
  stats: Record<string, number>, porNivel: Readonly<Record<string, number | undefined>>, nivel: number, mult: number, azar?: Azar,
): void {
  for (const [k, v] of Object.entries(porNivel)) {
    if (v === undefined) continue;
    // Con azar, cada stat varía por su cuenta (±15 %): dos piezas iguales nunca salen idénticas.
    const variacion = azar === undefined ? 1 : 0.85 + azar.siguiente() * 0.3;
    stats[k] = (stats[k] ?? 0) + Math.max(1, Math.round(v * nivel * mult * variacion));
  }
}

/** `tipo`: una clase de pieza, una lista de clases (p. ej. todas las de armadura) o cualquiera. */
export function generarEquipo(
  azar: Azar, piso: number, minima: Rareza = 0, tipo?: TipoPieza | readonly TipoPieza[], deConjunto?: IdConjunto, fortuna = 0,
): ObjetoEquipo {
  const rareza = tirarRarezaEquipo(azar, piso, minima, fortuna);
  const nivel = nivelObjeto(piso, azar);
  const tipos = tipo === undefined ? undefined : typeof tipo === "string" ? [tipo] : tipo;
  // Sin tipo pedido: primero la clase de pieza (así las armas no dominan por tener más bases).
  const clase = tipos !== undefined ? elegirUno(azar, tipos) : elegirUno(azar, [...new Set(BASES.map((b) => b.ranura))]);
  const def = elegirUno(azar, BASES.filter((b) => b.ranura === clase));
  const stats: Record<string, number> = {};
  const calidad = tirarCalidad(azar, rareza);
  sumar(stats, def.porNivel, nivel, MULT_RAREZA[rareza] * calidad, azar);
  const disponibles = AFIJOS.filter((a) => a.en.includes(def.ranura));
  const nombres: string[] = [];
  for (let i = 0; i < AFIJOS_POR_RAREZA[rareza] && disponibles.length > 0; i++) {
    const afijo = disponibles.splice(entero(azar, disponibles.length), 1)[0];
    sumar(stats, { [afijo.stat]: afijo.porNivel }, nivel, 0.6 + azar.siguiente() * 0.6);
    nombres.push(afijo.nombre);
  }
  const etiqueta = etiquetaCalidad(calidad);
  const rasgos = tirarRasgos(azar, def.ranura, rareza, Object.keys(def.rasgos ?? {}));
  // La base aporta sus rasgos propios (el Estoque siempre es rápido, el Arco Largo siempre llega lejos).
  for (const [id, v] of Object.entries(def.rasgos ?? {}) as [IdRasgoEquipo, number][]) {
    rasgos[id] = Math.round(((rasgos[id] ?? 0) + v) * 100) / 100;
  }
  // Solo las 6 piezas de armadura pueden ser de conjunto.
  if (deConjunto !== undefined && ARMADURAS.includes(def.ranura)) {
    const c = defConjunto(deConjunto);
    return {
      uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre: `${def.nombre} · ${c.nombre}`,
      rareza: Math.max(rareza, 3) as Rareza, nivel, stats, calidad, rasgos, conjunto: deConjunto, v: VERSION_RAREZA,
    };
  }
  const elemento = def.ranura === "arma" ? tirarElemento(azar, rareza) : undefined;
  const nucleo = elemento !== undefined ? `${def.nombre} ${ELEMENTOS[elemento].sufijo}` : nombres.length === 0 ? def.nombre : `${def.nombre} ${nombres[0]}`;
  // Mítico: una pasiva única acorde a la clase de pieza; su nombre corona el del objeto.
  const pasiva = rareza === RAREZA_MITICA ? elegirUno(azar, pasivasMiticasPara(def.ranura)).id : undefined;
  const nombre = (etiqueta !== null ? `${etiqueta} · ` : "") + nucleo + (pasiva !== undefined ? ` «${pasivaMitica(pasiva).nombre}»` : "");
  const obj: ObjetoEquipo = { uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre, rareza, nivel, stats, calidad, rasgos, v: VERSION_RAREZA };
  return { ...obj, ...(elemento !== undefined ? { elemento } : {}), ...(pasiva !== undefined ? { pasiva } : {}) };
}

export function crearUnico(azar: Azar, piso: number, def?: DefUnico): ObjetoEquipo {
  const u = def ?? elegirUno(azar, UNICOS);
  const nivel = nivelObjeto(piso, azar) + 2;
  const stats: Record<string, number> = {};
  sumar(stats, u.porNivel, nivel, MULT_RAREZA[RAREZA_UNICA], azar);
  if (u.efecto === "ojo") stats.critico = (stats.critico ?? 0) + 20;
  return {
    uid: nuevoUid(azar), base: u.id, ranura: u.ranura, nombre: u.nombre, rareza: RAREZA_UNICA, nivel, stats, efecto: u.efecto,
    calidad: 1.1, rasgos: tirarRasgos(azar, u.ranura, RAREZA_UNICA), v: VERSION_RAREZA,
  };
}

/** Arma común de nivel 1 de una base concreta (el arma inicial elegida). */
export function equipoInicial(azar: Azar, idBase: number): ObjetoEquipo {
  const def = BASES.find((b) => b.id === idBase) ?? BASES[0];
  const stats: Record<string, number> = {};
  sumar(stats, def.porNivel, 2, 1);
  return { uid: nuevoUid(azar), base: def.id, ranura: def.ranura, nombre: def.nombre, rareza: 0, nivel: 2, stats, v: VERSION_RAREZA };
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

/** Rareza vieja (5 niveles: común, raro, épico, legendario, único) → nueva (6 niveles). */
const RAREZA_VIEJA_A_NUEVA: readonly Rareza[] = [0, 2, 3, 4, 5];

/**
 * Guardados viejos: la pieza "armadura" pasa a pecho, "amuleto" a collar, y la rareza de 5 niveles pasa a la de 6
 * (Raro sigue siendo Raro, el Único pasa a Mítico).
 */
export function normalizarEquipo(o: ObjetoEquipo): ObjetoEquipo {
  const ranura = normalizarPieza(o.ranura);
  const viejo = o.v === undefined;
  if (ranura === o.ranura && !viejo) return o;
  return { ...o, ranura, ...(viejo ? { rareza: RAREZA_VIEJA_A_NUEVA[o.rareza] ?? o.rareza, v: VERSION_RAREZA } : {}) };
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
  return suma * (1 + o.rareza * 0.2) + (o.rareza === RAREZA_MITICA ? 60 : 0);
}

/** Esquirlas al desguazar una pieza (minialu/venta: una fracción de su valor). */
export function valorDesguace(o: ObjetoEquipo): number {
  return Math.max(3, Math.round(puntuacion(o) * 0.8));
}

export function etiquetaRareza(r: Rareza): string {
  return NOMBRES_RAREZA[r];
}
