// Vocabulario compartido del dominio de ECOS.

/** Poderes permanentes (persisten entre partidas). Son las "llaves" del metroidvania. */
export type Reliquia = "embestida" | "dobleSalto" | "garraIgnea";
export const RELIQUIAS: readonly Reliquia[] = ["embestida", "dobleSalto", "garraIgnea"];

export const INFO_RELIQUIA: Readonly<Record<Reliquia, { nombre: string; descripcion: string; color: string }>> = {
  embestida: {
    nombre: "Embestida del Errante",
    descripcion: "Shift: te lanzas hacia delante, invulnerable. Rompe los cristales resonantes.",
    color: "#7fe3ff",
  },
  dobleSalto: {
    nombre: "Alas de Ceniza",
    descripcion: "Salta otra vez en el aire. Permite subir por los pozos verticales.",
    color: "#ffe27a",
  },
  garraIgnea: {
    nombre: "Garra Ígnea",
    descripcion: "Tus golpes queman. Reduce a cenizas los muros de raíces.",
    color: "#ff7a3d",
  },
};

export type Ranura = "arma" | "armadura" | "amuleto";
export const RANURAS: readonly Ranura[] = ["arma", "armadura", "amuleto"];

/** Efectos especiales de los objetos únicos. El combate los consulta por nombre. */
export type EfectoUnico =
  | "golpe-doble"
  | "vidrio"
  | "segunda-vida"
  | "corazon"
  | "estela-ignea"
  | "ojo"
  | "onda"
  | "corona";

export type Dir = "izq" | "der" | "arr" | "aba";
export const OPUESTA: Readonly<Record<Dir, Dir>> = { izq: "der", der: "izq", arr: "aba", aba: "arr" };
export const DELTA: Readonly<Record<Dir, readonly [number, number]>> = {
  izq: [-1, 0], der: [1, 0], arr: [0, -1], aba: [0, 1],
};

/** Barreras de puertas laterales y la reliquia que las abre. */
export type Barrera = "cristal" | "raices";
export const RELIQUIA_DE_BARRERA: Readonly<Record<Barrera, Reliquia>> = { cristal: "embestida", raices: "garraIgnea" };
