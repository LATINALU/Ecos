// CICATRICES DEL POZO: "el Pozo recuerda a todos".
// Aunque los pisos se generan al azar, el lugar donde caíste queda marcado: la próxima vez que pases por ese piso,
// una sala guarda tus armas rotas clavadas en el suelo, tu sangre seca y al monstruo que te mató, más grande,
// con tu nombre en su título ("Devorador de …") y usando una de tus habilidades.

import type { EstiloArma } from "../contenido/objetos.ts";
import type { ConductaEnemigo } from "../contenido/biomas.ts";

export interface Asesino {
  readonly nombre: string;
  readonly conducta: ConductaEnemigo;
  readonly elite: boolean;
  readonly afijos: readonly string[];
}

export interface Cicatriz {
  readonly piso: number;
  /** Nombre del Portador caído (para el título del Devorador). */
  readonly portador: string;
  readonly asesino: Asesino;
  /** Arma que llevabas (se ve rota y clavada en el suelo). */
  readonly arma: EstiloArma;
  readonly colorArma: string;
  /** Alma de tu Habilidad I (el Devorador usa su técnica). */
  readonly almaTecnica: number | null;
  readonly fecha: number;
}

export const MAX_CICATRICES = 6;

/** Una cicatriz por piso (la nueva reemplaza a la vieja) y como mucho MAX_CICATRICES. */
export function registrarCicatriz(lista: readonly Cicatriz[], nueva: Cicatriz): Cicatriz[] {
  return [nueva, ...lista.filter((c) => c.piso !== nueva.piso)].slice(0, MAX_CICATRICES);
}

/** Título del monstruo que te mató, cuando vuelve con tu recuerdo. */
export function tituloDevorador(c: Cicatriz): string {
  return `Devorador de ${c.portador}`;
}
