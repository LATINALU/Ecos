// TEMPLADO en la Fragua: el refinado nunca falla.
//
// Hasta +5 se templa normal. Del +6 al +10 se elige:
//   · TEMPLADO SEGURO: caro (×3 esquirlas, ×2 fragmentos), sube y listo.
//   · TEMPLADO ABISAL: barato (la mitad), sube igual, pero el Pozo sella un PACTO en la pieza: un bono salvaje
//     junto con una maldición. Así el riesgo deja de ser "perder el tiempo" y pasa a ser una decisión de build.

import type { Azar } from "minialu";
import { elegirUno } from "minialu";

/** Efectos que un pacto puede tocar. Positivo = bueno, salvo `recibido`, `costoTecnica` (que son castigos). */
export interface EfectosPacto {
  /** Daño crítico extra (0,4 = +40 %). */
  readonly critDanio?: number;
  /** Puntos de crítico. */
  readonly critico?: number;
  /** Daño hecho (fracción). */
  readonly danio?: number;
  /** Velocidad de ataque (fracción). */
  readonly velocidad?: number;
  /** Robo de vida (fracción del daño hecho). */
  readonly robo?: number;
  /** Daño de habilidades (fracción). */
  readonly tecnicaDanio?: number;
  /** Carga de la Definitiva (fracción). */
  readonly carga?: number;
  /** Velocidad de movimiento (fracción; negativo = más lento). */
  readonly agilidad?: number;
  /** Vida máxima (fracción; negativo = menos). */
  readonly vida?: number;
  /** Defensa (fracción; negativo = menos). */
  readonly defensa?: number;
  /** Daño RECIBIDO extra (castigo). */
  readonly recibido?: number;
  /** Costo de éter de las habilidades extra (castigo). */
  readonly costoTecnica?: number;
  /** Curación de las pociones (fracción; negativo = curan menos). */
  readonly pociones?: number;
}

export interface DefPacto {
  readonly id: string;
  readonly nombre: string;
  readonly bono: EfectosPacto;
  readonly maldicion: EfectosPacto;
  readonly textoBono: string;
  readonly textoMaldicion: string;
}

export const PACTOS: readonly DefPacto[] = [
  { id: "hambriento", nombre: "Filo Hambriento", bono: { critDanio: 0.4 }, maldicion: { recibido: 0.15 }, textoBono: "+40 % de daño crítico", textoMaldicion: "recibes +15 % de daño" },
  { id: "cristal", nombre: "Cristal Roto", bono: { danio: 0.3 }, maldicion: { recibido: 0.25 }, textoBono: "+30 % de daño", textoMaldicion: "recibes +25 % de daño" },
  { id: "frio", nombre: "Sangre Fría", bono: { velocidad: 0.15 }, maldicion: { vida: -0.12 }, textoBono: "+15 % de velocidad de ataque", textoMaldicion: "−12 % de vida máxima" },
  { id: "vampiro", nombre: "Sed Antigua", bono: { robo: 0.05 }, maldicion: { pociones: -0.4 }, textoBono: "5 % de robo de vida", textoMaldicion: "las pociones curan un 40 % menos" },
  { id: "lengua", nombre: "Lengua de Éter", bono: { tecnicaDanio: 0.3 }, maldicion: { costoTecnica: 0.25 }, textoBono: "+30 % de daño de habilidades", textoMaldicion: "las habilidades cuestan +25 % de éter" },
  { id: "plomo", nombre: "Puño de Plomo", bono: { danio: 0.22 }, maldicion: { agilidad: -0.14 }, textoBono: "+22 % de daño", textoMaldicion: "te mueves un 14 % más lento" },
  { id: "ojo", nombre: "Ojo Abierto", bono: { critico: 12 }, maldicion: { defensa: -0.2 }, textoBono: "+12 de crítico", textoMaldicion: "−20 % de defensa" },
  { id: "furia", nombre: "Furia Prestada", bono: { carga: 0.35 }, maldicion: { vida: -0.1 }, textoBono: "la Definitiva se carga +35 % más rápido", textoMaldicion: "−10 % de vida máxima" },
  { id: "viento", nombre: "Paso del Viento", bono: { agilidad: 0.15, velocidad: 0.06 }, maldicion: { defensa: -0.15 }, textoBono: "+15 % de movimiento y +6 % de velocidad de ataque", textoMaldicion: "−15 % de defensa" },
  { id: "verdugo", nombre: "Pacto del Verdugo", bono: { critDanio: 0.25, critico: 6 }, maldicion: { pociones: -0.3, recibido: 0.08 }, textoBono: "+25 % de daño crítico y +6 de crítico", textoMaldicion: "pociones −30 % y recibes +8 % de daño" },
];

export function pacto(id: string): DefPacto | undefined {
  return PACTOS.find((p) => p.id === id);
}

/** Nivel desde el que hay que elegir entre templado Seguro y Abisal (el paso de +5 a +6). */
export const NIVEL_ELECCION_TEMPLADO = 5;

export type ModoTemplado = "normal" | "seguro" | "abisal";

/** Costo del templado según el nivel actual y el modo. */
export function costoTemplado(nivelActual: number, modo: ModoTemplado): { fragmentos: number; esquirlas: number } {
  const base = { fragmentos: 1 + Math.floor(nivelActual / 2), esquirlas: 50 * (nivelActual + 1) * (nivelActual >= 5 ? 2 : 1) };
  if (nivelActual < NIVEL_ELECCION_TEMPLADO || modo === "normal") return base;
  return modo === "seguro"
    ? { fragmentos: base.fragmentos * 2, esquirlas: base.esquirlas * 3 }
    : { fragmentos: Math.max(1, Math.ceil(base.fragmentos / 2)), esquirlas: Math.ceil(base.esquirlas / 2) };
}

/** Pacto al azar que la pieza todavía no tiene. */
export function tirarPacto(azar: Azar, yaTiene: readonly string[]): DefPacto {
  const libres = PACTOS.filter((p) => !yaTiene.includes(p.id));
  return elegirUno(azar, libres.length > 0 ? libres : PACTOS);
}

/** Suma de los efectos (bono + maldición) de una lista de pactos. */
export function sumarPactos(ids: readonly string[]): Required<EfectosPacto> {
  const r: Record<keyof EfectosPacto, number> = {
    critDanio: 0, critico: 0, danio: 0, velocidad: 0, robo: 0, tecnicaDanio: 0, carga: 0, agilidad: 0, vida: 0, defensa: 0, recibido: 0, costoTecnica: 0, pociones: 0,
  };
  for (const id of ids) {
    const p = pacto(id);
    if (p === undefined) continue;
    for (const ef of [p.bono, p.maldicion]) for (const [k, v] of Object.entries(ef)) r[k as keyof EfectosPacto] += v as number;
  }
  return r;
}
