// Conjuntos de armadura: solo las 6 piezas (casco, hombros, pecho, cinturón, pantalones, botas) pueden ser de un
// conjunto. Llevar 2, 4 y las 6 piezas da bonos acumulables.
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
  /** Daño infligido extra (0,15 = +15 %). */
  readonly danio?: number;
}

export interface DefConjunto {
  readonly id: IdConjunto;
  readonly nombre: string;
  readonly color: string;
  /** Pisos donde caen sus piezas. */
  readonly pisos: readonly number[];
  /** Bono con 2 piezas. */
  readonly dos: BonoConjunto;
  /** Bono con 4 piezas (además del de 2). */
  readonly cuatro: BonoConjunto;
  /** Bono con el set completo de 6 piezas (además de los anteriores). */
  readonly seis: BonoConjunto;
}

export const CONJUNTOS: readonly DefConjunto[] = [
  {
    id: "vigia", nombre: "Vigía del Osario", color: "#d9d0bd", pisos: [1, 2],
    dos: { descripcion: "+25 % de defensa.", defensaPct: 0.25 },
    cuatro: { descripcion: "Muro de Huesos: recibes un 20 % menos de daño.", recibido: 0.2 },
    seis: { descripcion: "Osario Completo: +120 de vida y +15 % de daño.", hp: 120, danio: 0.15 },
  },
  {
    id: "escarcha", nombre: "Escarcha Eterna", color: "#7fe3ff", pisos: [3, 4],
    dos: { descripcion: "Tus golpes ralentizan.", ralentiza: true },
    cuatro: { descripcion: "Tus críticos aturden 1 s y hacen +30 % de daño.", aturdeCrit: 1, critDanio: 0.3 },
    seis: { descripcion: "Invierno Eterno: +20 % de daño y −10 % de daño recibido.", danio: 0.2, recibido: 0.1 },
  },
  {
    id: "abisal", nombre: "Marea Abisal", color: "#4d8bff", pisos: [5, 6],
    dos: { descripcion: "+15 % de velocidad de ataque.", velocidad: 0.15 },
    cuatro: { descripcion: "Te curas un 6 % del daño que haces y +60 de vida.", robo: 0.06, hp: 60 },
    seis: { descripcion: "Pleamar: +15 % de velocidad de ataque y +20 % de daño.", velocidad: 0.15, danio: 0.2 },
  },
  {
    id: "engranaje", nombre: "Engranaje Olvidado", color: "#e0a050", pisos: [7, 8],
    dos: { descripcion: "+30 % de daño de técnica.", tecnicaDanio: 0.3 },
    cuatro: { descripcion: "Las técnicas cuestan un 25 % menos de éter.", tecnicaCosto: 0.25 },
    seis: { descripcion: "Maquinaria Perfecta: +40 % de daño de técnica y +15 % de daño.", tecnicaDanio: 0.4, danio: 0.15 },
  },
  {
    id: "astral", nombre: "Manto Astral", color: "#c9a7ff", pisos: [9, 10],
    dos: { descripcion: "+15 % de crítico.", critico: 15 },
    cuatro: { descripcion: "+60 % de daño crítico.", critDanio: 0.6 },
    seis: { descripcion: "Constelación: +10 % de crítico y +25 % de daño.", critico: 10, danio: 0.25 },
  },
];

export function conjunto(id: IdConjunto): DefConjunto {
  return CONJUNTOS.find((c) => c.id === id)!;
}

export function conjuntoDelPiso(piso: number): DefConjunto {
  // Del piso 11 en adelante los conjuntos vuelven a empezar (Pozo Profundo: las mismas familias, más fuertes).
  const p = ((Math.max(1, piso) - 1) % 10) + 1;
  return CONJUNTOS.find((c) => c.pisos.includes(p)) ?? CONJUNTOS[CONJUNTOS.length - 1];
}
