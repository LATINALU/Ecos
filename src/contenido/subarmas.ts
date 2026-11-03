// Subarmas al estilo Castlevania: se lanzan con ↑ + Patada y gastan CORAZONES, que sueltan las velas.
// Solo se lleva una; recoger otra la reemplaza.

export type IdSubarma = "daga" | "hacha" | "agua" | "cruz";

export interface DefSubarma {
  readonly id: IdSubarma;
  readonly nombre: string;
  readonly costo: number;
  /** Multiplicador sobre el stat Golpe. */
  readonly mult: number;
  readonly color: string;
  readonly descripcion: string;
}

export const SUBARMAS: Readonly<Record<IdSubarma, DefSubarma>> = {
  daga: { id: "daga", nombre: "Daga de Hueso", costo: 1, mult: 0.9, color: "#e8e8f0", descripcion: "Vuela recta y rápida. Barata." },
  hacha: { id: "hacha", nombre: "Hacha del Verdugo", costo: 2, mult: 1.7, color: "#c9b8ff", descripcion: "Sale en arco hacia arriba y atraviesa todo. Ideal contra voladores." },
  agua: { id: "agua", nombre: "Agua Bendita", costo: 2, mult: 0.45, color: "#7fe3ff", descripcion: "Se rompe en el suelo y deja llamas azules que queman varias veces." },
  cruz: { id: "cruz", nombre: "Cruz del Peregrino", costo: 3, mult: 1.25, color: "#ffe27a", descripcion: "Bumerán: atraviesa a la ida y a la vuelta." },
};

export const ORDEN_SUBARMAS: readonly IdSubarma[] = ["daga", "hacha", "agua", "cruz"];

export const CORAZONES_INICIALES = 5;
export const CORAZONES_MAX = 99;
