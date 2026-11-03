// Estilos de combate. El arma equipada define el combo del golpe (J): velocidad, alcance, daño y extras.
// Al empezar una bajada se elige un arma inicial; después cualquier arma que encuentres cambia tu estilo.
//
// Cuatro familias de armas, cada una con su alcance, su combo y dos PASIVAS DE ATAQUE propias:
//   Espada (alcance medio)  · Sangría (el corte final roba vida) + Filo preciso (+crítico en básicos)
//   Mazo   (alcance largo)  · Quebrantahuesos (ignora defensa) + Rompeguardias (todo golpe rompe guardias)
//   Báculo (alcance medio)  · Canalizador (técnicas y éter) + Orbe de éter (el golpe final lanza un orbe)
//   Arco   (a distancia)    · Ojo de halcón (más daño cuanto más lejos) + Punta barbada (+daño crítico)
// "punos" queda solo como "sin arma" (a puño limpio): no hay armas de puños.

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
  /** Pasivas de ataque de la familia (texto para la UI; los números van abajo). */
  readonly pasivas: readonly { readonly nombre: string; readonly descripcion: string }[];
  /** Puntos de crítico extra en golpes básicos. */
  readonly critBasico?: number;
  /** Daño crítico extra (fracción) de los golpes básicos. */
  readonly critDanio?: number;
  /** Fracción de la defensa enemiga que ignoran los golpes básicos. */
  readonly ignoraDefensa?: number;
  /** Los golpes básicos rompen la guardia de los escuderos. */
  readonly rompeGuardia?: boolean;
  /** Fracción del daño del último golpe del combo que se cura. */
  readonly roboUltimo?: number;
  /** El último golpe del combo lanza un orbe de éter. */
  readonly orbeUltimo?: boolean;
  /** Daño extra máximo (fracción) a gran distancia. */
  readonly bonoDistancia?: number;
}

export const ESTILOS: Readonly<Record<EstiloArma, DefEstilo>> = {
  espada: {
    id: "espada", nombre: "Espada", armaInicial: 100, color: "#e8e8f0",
    descripcion: "Equilibrada, alcance medio. Combo de 3 cortes; el último empuja fuerte.",
    duracion: 0.24, activoDesde: 0.04, activoHasta: 0.14, alcance: 24, alto: 16,
    mults: [1, 1.05, 1.5], empujes: [60, 60, 200], eter: 3, tecnica: 1, costoTecnica: 1, regenEter: 1, aturde: 0,
    pasivas: [
      { nombre: "Sangría", descripcion: "El corte final del combo te cura el 8 % del daño que hace." },
      { nombre: "Filo preciso", descripcion: "+8 de crítico en golpes básicos." },
    ],
    critBasico: 8, roboUltimo: 0.08,
  },
  punos: {
    id: "punos", nombre: "Sin arma", armaInicial: 100, color: "#ffd27a",
    descripcion: "A puño limpio: rápido, flojo y de muy corto alcance. Consigue un arma cuanto antes.",
    duracion: 0.16, activoDesde: 0.03, activoHasta: 0.1, alcance: 14, alto: 14,
    mults: [0.5, 0.5, 0.6, 0.9], empujes: [25, 25, 30, 160], eter: 2, tecnica: 1, costoTecnica: 1, regenEter: 1, aturde: 0.15,
    pasivas: [],
  },
  pesada: {
    id: "pesada", nombre: "Mazo", armaInicial: 104, color: "#b8a98a",
    descripcion: "Lento y brutal, el de mayor alcance cuerpo a cuerpo. Golpe por encima de la cabeza; el segundo aturde y hace temblar el suelo.",
    duracion: 0.36, activoDesde: 0.13, activoHasta: 0.25, alcance: 34, alto: 22,
    mults: [1.75, 2.5], empujes: [170, 330], eter: 5, tecnica: 0.9, costoTecnica: 1, regenEter: 1, aturde: 0.6,
    pasivas: [
      { nombre: "Quebrantahuesos", descripcion: "Los golpes ignoran el 35 % de la defensa enemiga." },
      { nombre: "Rompeguardias", descripcion: "Cada golpe rompe la guardia de escudos y escuderos." },
    ],
    ignoraDefensa: 0.35, rompeGuardia: true,
  },
  baston: {
    id: "baston", nombre: "Báculo", armaInicial: 102, color: "#7fe3ff",
    descripcion: "Alcance medio y golpes flojos, pero es el arma del éter.",
    duracion: 0.28, activoDesde: 0.06, activoHasta: 0.17, alcance: 28, alto: 18,
    mults: [0.75, 0.8, 1], empujes: [70, 70, 160], eter: 6, tecnica: 1.25, costoTecnica: 0.8, regenEter: 2.5, aturde: 0,
    pasivas: [
      { nombre: "Canalizador", descripcion: "Técnicas +25 % de daño y −20 % de costo; el éter se regenera 2,5× más rápido." },
      { nombre: "Orbe de éter", descripcion: "El golpe final del combo lanza un orbe que atraviesa enemigos (daño de técnica)." },
    ],
    orbeUltimo: true,
  },
  arco: {
    id: "arco", nombre: "Arco", armaInicial: 105, color: "#d9b38a",
    descripcion: "A distancia. Cada golpe dispara una flecha; el tercero suelta tres en abanico. Débil cuerpo a cuerpo.",
    duracion: 0.3, activoDesde: 0.12, activoHasta: 0.13, alcance: 230, alto: 4,
    mults: [0.8, 0.8, 0.65], empujes: [50, 50, 80], eter: 2, tecnica: 1, costoTecnica: 1, regenEter: 1, aturde: 0,
    pasivas: [
      { nombre: "Ojo de halcón", descripcion: "Hasta +40 % de daño cuanto más lejos está el blanco." },
      { nombre: "Punta barbada", descripcion: "+30 % de daño crítico con las flechas." },
    ],
    bonoDistancia: 0.4, critDanio: 0.3,
  },
};

/** Las cuatro familias de armas (los puños no se eligen: son "sin arma"). */
export const ORDEN_ESTILOS: readonly EstiloArma[] = ["espada", "pesada", "baston", "arco"];
