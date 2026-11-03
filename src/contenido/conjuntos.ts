// Conjuntos de equipo: tres piezas (arma, armadura, amuleto). Llevar 2 o 3 del mismo conjunto da bonos.
// Cada conjunto cae en un par de zonas (y su guardián siempre suelta una pieza).

export type IdConjunto = "vigia" | "escarcha" | "abisal" | "engranaje" | "astral";

export interface BonoConjunto {
  readonly descripcion: string;
  /** Efectos que el combate y los stats leen por nombre. */
  readonly defensaPct?: number;
  readonly recibido?: number;
  readonly ralentiza?: boolean;
  readonly aturdeCrit?: number;
  readonly velocidad?: number;
  readonly robo?: number;
  readonly tecnicaDanio?: number;
  readonly tecnicaCosto?: number;
  readonly critico?: number;
  readonly critDanio?: number;
  readonly hp?: number;
}

export interface DefConjunto {
  readonly id: IdConjunto;
  readonly nombre: string;
  readonly color: string;
  /** Pisos donde caen sus piezas. */
  readonly pisos: readonly number[];
  readonly dos: BonoConjunto;
  readonly tres: BonoConjunto;
}

export const CONJUNTOS: readonly DefConjunto[] = [
  {
    id: "vigia", nombre: "Vigía del Osario", color: "#d9d0bd", pisos: [1, 2],
    dos: { descripcion: "+25 % de defensa.", defensaPct: 0.25 },
    tres: { descripcion: "Muro de Huesos: recibes un 20 % menos de daño.", recibido: 0.2 },
  },
  {
    id: "escarcha", nombre: "Escarcha Eterna", color: "#7fe3ff", pisos: [3, 4],
    dos: { descripcion: "Tus golpes ralentizan.", ralentiza: true },
    tres: { descripcion: "Tus críticos aturden 1 s y hacen +30 % de daño.", aturdeCrit: 1, critDanio: 0.3 },
  },
  {
    id: "abisal", nombre: "Marea Abisal", color: "#4d8bff", pisos: [5, 6],
    dos: { descripcion: "+15 % de velocidad de ataque.", velocidad: 0.15 },
    tres: { descripcion: "Te curas un 6 % del daño que haces y +60 de vida.", robo: 0.06, hp: 60 },
  },
  {
    id: "engranaje", nombre: "Engranaje Olvidado", color: "#e0a050", pisos: [7, 8],
    dos: { descripcion: "+30 % de daño de técnica.", tecnicaDanio: 0.3 },
    tres: { descripcion: "Las técnicas cuestan un 25 % menos de éter.", tecnicaCosto: 0.25 },
  },
  {
    id: "astral", nombre: "Manto Astral", color: "#c9a7ff", pisos: [9, 10],
    dos: { descripcion: "+15 % de crítico.", critico: 15 },
    tres: { descripcion: "+60 % de daño crítico.", critDanio: 0.6 },
  },
];

export function conjunto(id: IdConjunto): DefConjunto {
  return CONJUNTOS.find((c) => c.id === id)!;
}

export function conjuntoDelPiso(piso: number): DefConjunto {
  return CONJUNTOS.find((c) => c.pisos.includes(piso)) ?? CONJUNTOS[CONJUNTOS.length - 1];
}
