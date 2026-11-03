// ECOS: la mecánica central del juego.
// Cuando el Portador muere, el Pozo "recuerda" su forma: guarda su carta, sus stats, su nivel y su mejor pieza
// de equipo (el LEGADO). En la siguiente partida, ese Eco espera en el mismo piso como un duelo de jefe que
// pelea con tu técnica. Si lo vences, recuperas el legado (y la carta que llevabas), y sumas esencia extra.
// El jefe final, El Que Recuerda, usa las técnicas de todos tus Ecos vivos.
// EXTRACCIÓN: al morir se pierde todo lo que llevabas encima; el Eco de ese piso lo guarda (BOTÍN). Vencerlo lo
// devuelve entero. Si vuelves a morir en el mismo piso antes de recuperarlo, el Eco nuevo reemplaza al viejo y ese
// botín se pierde para siempre.

import { entero, type Azar } from "minialu";
import { OBJ_POLVO } from "../contenido/objetos.ts";
import type { Premio } from "./botin.ts";
import type { BotinPerdido } from "./partida.ts";
import type { Carta } from "./cartas.ts";
import { puntuacion, type ObjetoEquipo } from "./equipo.ts";
import type { Bloque } from "./stats.ts";

export interface Eco {
  readonly uid: string;
  readonly piso: number;
  readonly nombre: string;
  readonly forma: Carta | null;
  readonly nivel: number;
  readonly stats: Bloque;
  readonly legado: ObjetoEquipo | null;
  readonly fecha: number;
  readonly causa: string;
  readonly numero: number;
  /** Todo lo que el Portador perdió al morir (equipo, mochila, esquirlas). */
  readonly botin?: BotinPerdido;
}

export const MAX_ECOS = 3;

const EPITETOS = ["el Impaciente", "la Obstinada", "el Hambriento", "la que Dudó", "el Último", "la Sin Nombre", "el Codicioso", "la Valiente"];

export interface DatosMuerte {
  readonly piso: number;
  readonly forma: Carta | null;
  readonly nivel: number;
  readonly stats: Bloque;
  readonly equipo: readonly (ObjetoEquipo | null)[];
  readonly causa: string;
  readonly numero: number;
  readonly botin?: BotinPerdido;
}

export function crearEco(m: DatosMuerte, azar: Azar, ahora: number): Eco {
  const legado = m.equipo
    .filter((o): o is ObjetoEquipo => o !== null)
    .sort((a, b) => puntuacion(b) - puntuacion(a))[0] ?? null;
  return {
    uid: `eco-${ahora.toString(36)}-${entero(azar, 99999)}`,
    piso: m.piso,
    nombre: `Eco ${m.numero}, ${EPITETOS[entero(azar, EPITETOS.length)]}`,
    forma: m.forma,
    nivel: m.nivel,
    stats: m.stats,
    legado,
    fecha: ahora,
    causa: m.causa,
    numero: m.numero,
    ...(m.botin !== undefined ? { botin: m.botin } : {}),
  };
}

/** Un Eco por piso (el nuevo reemplaza al anterior del mismo piso) y como mucho MAX_ECOS. */
export function registrarEco(ecos: readonly Eco[], nuevo: Eco): Eco[] {
  return [nuevo, ...ecos.filter((e) => e.piso !== nuevo.piso)].slice(0, MAX_ECOS);
}

export function premiosEco(eco: Eco, azar: Azar): Premio[] {
  const premios: Premio[] = [{ tipo: "esquirlas", cantidad: 80 + eco.nivel * 12 + entero(azar, 40) }];
  if (eco.botin !== undefined) {
    // Extracción: el Eco devuelve exactamente lo que perdiste (los objetos originales, no copias).
    if (eco.botin.esquirlas > 0) premios.push({ tipo: "esquirlas", cantidad: eco.botin.esquirlas });
    for (const o of eco.botin.equipo) premios.push({ tipo: "equipo", equipo: o });
    for (const p of eco.botin.pilas) {
      const o = p.extra?.equipo as ObjetoEquipo | undefined;
      premios.push(o !== undefined ? { tipo: "equipo", equipo: o } : { tipo: "objeto", objeto: p.objeto, cantidad: p.cantidad });
    }
    if (eco.forma !== null) premios.push({ tipo: "carta", carta: eco.forma });
    premios.push({ tipo: "objeto", objeto: OBJ_POLVO, cantidad: 3 });
    return premios;
  }
  // El legado vuelve como una COPIA nueva: tu equipo es persistente y no se puede duplicar el mismo objeto.
  if (eco.legado !== null) {
    premios.push({ tipo: "equipo", equipo: { ...eco.legado, uid: `${eco.legado.uid}-eco${entero(azar, 99999)}`, nombre: `${eco.legado.nombre.replace(/ \(Eco\)$/, "")} (Eco)` } });
  }
  if (eco.forma !== null) premios.push({ tipo: "carta", carta: eco.forma });
  premios.push({ tipo: "objeto", objeto: OBJ_POLVO, cantidad: 3 });
  return premios;
}

/** Stats del Eco como enemigo: más vida (es un duelo), mismo daño que tenías. */
export function statsEcoEnemigo(eco: Eco): { hp: number; ataque: number; tecnica: number; defensa: number } {
  return {
    hp: Math.round(eco.stats.hp * 2.6 + 40),
    ataque: Math.round(Math.max(eco.stats.golpe, eco.stats.patada) * 0.7),
    tecnica: Math.round(eco.stats.tecnica * 0.7),
    defensa: eco.stats.defensa,
  };
}
