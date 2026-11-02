// Estilos de combate. El arma equipada define el combo del golpe (J): velocidad, alcance, daño y extras.
// Al empezar una bajada se elige un arma inicial; después cualquier arma que encuentres cambia tu estilo.

import type { EstiloArma } from "./objetos.ts";

export interface DefEstilo {
  readonly id: EstiloArma;
  readonly nombre: string;
  readonly descripcion: string;
  /** Arma común con la que se empieza si eliges este estilo. */
  readonly armaInicial: number;
  /** Duración de cada golpe del combo (s) y ventana en la que daña. */
  readonly duracion: number;
  readonly activoDesde: number;
  readonly activoHasta: number;
  /** Tamaño del área de golpe delante del Portador. */
  readonly alcance: number;
  readonly alto: number;
  /** Multiplicador de daño de cada golpe del combo (su largo = largo del combo). */
  readonly mults: readonly number[];
  readonly empujes: readonly number[];
  /** Éter que da cada golpe acertado. */
  readonly eter: number;
  /** Multiplicadores de la técnica: daño y costo de éter. */
  readonly tecnica: number;
  readonly costoTecnica: number;
  /** Regeneración pasiva de éter por segundo. */
  readonly regenEter: number;
  /** Aturdimiento del último golpe del combo (s). */
  readonly aturde: number;
  readonly color: string;
}

export const ESTILOS: Readonly<Record<EstiloArma, DefEstilo>> = {
  espada: {
    id: "espada", nombre: "Espada", armaInicial: 100, color: "#e8e8f0",
    descripcion: "Equilibrada. Combo de 3 cortes; el último empuja fuerte.",
    duracion: 0.24, activoDesde: 0.04, activoHasta: 0.14, alcance: 22, alto: 16,
    mults: [1, 1.05, 1.5], empujes: [60, 60, 200], eter: 3, tecnica: 1, costoTecnica: 1, regenEter: 1, aturde: 0,
  },
  punos: {
    id: "punos", nombre: "Puños", armaInicial: 101, color: "#ffd27a",
    descripcion: "Rapidísimos y de corto alcance. Combo de 4 golpes; ideales para acumular éter.",
    duracion: 0.16, activoDesde: 0.03, activoHasta: 0.1, alcance: 16, alto: 14,
    mults: [0.62, 0.62, 0.7, 1.15], empujes: [25, 25, 30, 190], eter: 3, tecnica: 1, costoTecnica: 1, regenEter: 1, aturde: 0.2,
  },
  pesada: {
    id: "pesada", nombre: "Martillo", armaInicial: 104, color: "#b8a98a",
    descripcion: "Lento y brutal. Combo de 2 golpes de gran alcance; el segundo aturde.",
    duracion: 0.36, activoDesde: 0.13, activoHasta: 0.25, alcance: 30, alto: 22,
    mults: [1.75, 2.5], empujes: [170, 330], eter: 5, tecnica: 0.9, costoTecnica: 1, regenEter: 1, aturde: 0.6,
  },
  baston: {
    id: "baston", nombre: "Bastón", armaInicial: 102, color: "#7fe3ff",
    descripcion: "Golpes flojos, pero tus técnicas pegan +25 %, cuestan −20 % y el éter se regenera más rápido.",
    duracion: 0.28, activoDesde: 0.06, activoHasta: 0.17, alcance: 26, alto: 14,
    mults: [0.75, 0.8, 1], empujes: [70, 70, 160], eter: 6, tecnica: 1.25, costoTecnica: 0.8, regenEter: 2.5, aturde: 0,
  },
};

export const ORDEN_ESTILOS: readonly EstiloArma[] = ["espada", "punos", "pesada", "baston"];
