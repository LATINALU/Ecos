// El Abismo: alternativa al Pozo. No tiene fondo: cada piso tiene una GRIETA que baja al siguiente y casi nunca
// hay salida. Las salidas (extracciones) son escasas, están ocultas en el mapa y hay que encontrarlas explorando.
//
//   · Profundidad infinita: las zonas se recorren en ciclos (sin el Corazón), cada ciclo más duro.
//   · Cada 5 pisos la grieta está custodiada por un guardián; vencerlo deja empezar desde el piso siguiente.
//   · Salidas: probabilidad que baja con la profundidad, con "piedad" tras varios pisos sin ninguna.

import type { Azar } from "minialu";
import { BIOMAS, statsJefe, type Bioma } from "../contenido/biomas.ts";

/** Zonas que recorre un ciclo del Abismo (todas menos el Corazón del Pozo). */
export const ZONAS_ABISMO = BIOMAS.length - 1;
/** Cada cuántos pisos hay un guardián custodiando la grieta. */
export const CADA_GUARDIAN = 5;
/** Pisos seguidos sin salida tras los que la siguiente es segura. */
export const PIEDAD_SALIDA = 3;

/** Ciclo (1, 2, 3...) de una profundidad. */
export function cicloAbismo(prof: number): number {
  return Math.floor((Math.max(1, prof) - 1) / ZONAS_ABISMO) + 1;
}

/** Zona de una profundidad, con el guardián escalado a esa profundidad. */
export function biomaAbismo(prof: number): Bioma {
  const base = BIOMAS[(Math.max(1, prof) - 1) % ZONAS_ABISMO];
  return { ...base, jefe: { ...base.jefe, ...statsJefe(prof) } };
}

export function hayGuardianAbismo(prof: number): boolean {
  return prof % CADA_GUARDIAN === 0;
}

/** Probabilidad base de que un piso tenga salida (baja con la profundidad, con piso del 18 %). */
export function probSalida(prof: number): number {
  return Math.max(0.18, 0.55 - prof * 0.012);
}

/** ¿Este piso tiene salida? Tras PIEDAD_SALIDA pisos sin ninguna, sí o sí. */
export function tirarSalida(azar: Azar, prof: number, pisosSinSalida: number): boolean {
  if (pisosSinSalida >= PIEDAD_SALIDA) return true;
  return azar.siguiente() < probSalida(prof);
}

/** Salas por piso: crecen hasta 22. */
export function salasAbismo(prof: number): number {
  return Math.min(44, 20 + Math.floor(prof / 3) * 2);
}

/** Piso más hondo desde el que se puede empezar tras vencer al guardián de `prof`. */
export function inicioTrasGuardian(prof: number): number {
  return prof + 1;
}

/** Pisos desde los que se puede empezar: 1 y cada uno tras un guardián vencido, hasta el desbloqueado. */
export function iniciosAbismo(desbloqueado: number): number[] {
  const r = [1];
  for (let p = CADA_GUARDIAN + 1; p <= desbloqueado; p += CADA_GUARDIAN) r.push(p);
  return r;
}

export function numeroRomano(n: number): string {
  const t: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "";
  let x = n;
  for (const [v, s] of t) while (x >= v) { r += s; x -= v; }
  return r;
}
