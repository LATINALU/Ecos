// Vocabulario compartido del dominio de ECOS.

/** Poderes permanentes (persisten entre partidas). Son las "llaves" del metroidvania. */
export type Reliquia =
  | "embestida" | "dobleSalto" | "garraIgnea"
  | "botasCefiro" | "corazonEco" | "ojoAbismo" | "manoAvaro" | "lagrimaPozo";
/** En el orden en que se encuentran a lo largo de la partida (ver Meta.reliquiaParaPiso). */
export const RELIQUIAS: readonly Reliquia[] = ["embestida", "dobleSalto", "garraIgnea", "botasCefiro", "corazonEco", "ojoAbismo", "manoAvaro", "lagrimaPozo"];
/** Piso donde aparece cada reliquia (la primera que falte se ofrece en el siguiente de estos pisos). */
export const PISOS_RELIQUIA: readonly number[] = [1, 2, 3, 5, 8, 12, 16, 20];

export const INFO_RELIQUIA: Readonly<Record<Reliquia, { nombre: string; descripcion: string; color: string }>> = {
  embestida: {
    nombre: "Embestida del Errante",
    descripcion: "Shift: te lanzas hacia delante, invulnerable. Rompe los cristales resonantes.",
    color: "#7fe3ff",
  },
  dobleSalto: {
    nombre: "Alas de Ceniza",
    descripcion: "Salta otra vez en el aire: alcanzas cornisas altas, escapas de los jefes y saltas desde las cadenas.",
    color: "#ffe27a",
  },
  garraIgnea: {
    nombre: "Garra Ígnea",
    descripcion: "Tus golpes queman. Reduce a cenizas los muros de raíces.",
    color: "#ff7a3d",
  },
  botasCefiro: {
    nombre: "Botas del Céfiro",
    descripcion: "Te mueves un 12 % más rápido y el paso atrás se recarga un 40 % antes.",
    color: "#bff3ff",
  },
  corazonEco: {
    nombre: "Corazón del Eco",
    descripcion: "Las pociones curan un 25 % más y cada descenso empiezas con una poción extra.",
    color: "#ff4d6d",
  },
  ojoAbismo: {
    nombre: "Ojo del Abismo",
    descripcion: "El mapa de cada piso se revela entero desde que llegas: salas, bóvedas, arenas y extracciones.",
    color: "#c9a7ff",
  },
  manoAvaro: {
    nombre: "Mano del Avaro",
    descripcion: "+25 % de esquirlas y ningún cofre es de madera: los peores salen de plata.",
    color: "#ffd23d",
  },
  lagrimaPozo: {
    nombre: "Lágrima del Pozo",
    descripcion: "La Definitiva empieza cada piso cargada al 40 % y se carga un 20 % más rápido.",
    color: "#7fe3ff",
  },
};

/** Clase de pieza de equipo (lo que ES el objeto). */
export type TipoPieza = "arma" | "casco" | "hombros" | "pecho" | "cinturon" | "pantalones" | "botas" | "capa" | "anillo" | "aretes" | "collar";

/**
 * Ranura del Portador donde se lleva. 1 arma + 6 piezas de SET (armadura) + 5 ACCESORIOS con stats únicos
 * (capa, dos anillos, aretes, collar) = 12.
 */
export type Ranura = "arma" | "casco" | "hombros" | "pecho" | "cinturon" | "pantalones" | "botas" | "capa" | "anillo1" | "anillo2" | "aretes" | "collar";

export const RANURAS: readonly Ranura[] = [
  "arma", "casco", "hombros", "pecho", "cinturon", "pantalones", "botas", "capa", "anillo1", "anillo2", "aretes", "collar",
];

/** Piezas de set: pueden pertenecer a un conjunto (bonos a 2, 4 y 6 piezas). */
export const ARMADURAS: readonly TipoPieza[] = ["casco", "hombros", "pecho", "cinturon", "pantalones", "botas"];
/** Accesorios: siempre traen stats únicos de su tipo. */
export const ACCESORIOS: readonly TipoPieza[] = ["capa", "anillo", "aretes", "collar"];
export const JOYAS: readonly TipoPieza[] = ["anillo", "aretes", "collar"];

export const NOMBRE_PIEZA: Readonly<Record<TipoPieza, string>> = {
  arma: "Arma", casco: "Casco", hombros: "Hombros", pecho: "Pecho", cinturon: "Cinturón", pantalones: "Pantalones",
  botas: "Botas", capa: "Capa", anillo: "Anillo", aretes: "Aretes", collar: "Collar",
};

export const NOMBRE_RANURA: Readonly<Record<Ranura, string>> = {
  arma: "Arma", casco: "Casco", hombros: "Hombros", pecho: "Pecho", cinturon: "Cinturón", pantalones: "Pantalones",
  botas: "Botas", capa: "Capa", anillo1: "Anillo I", anillo2: "Anillo II", aretes: "Aretes", collar: "Collar",
};

export function piezaDeRanura(r: Ranura): TipoPieza {
  return r === "anillo1" || r === "anillo2" ? "anillo" : r;
}

export function ranurasDePieza(t: TipoPieza): Ranura[] {
  return t === "anillo" ? ["anillo1", "anillo2"] : [t];
}

/** Guardados viejos (3 ranuras): "armadura" pasa a ser pecho y "amuleto", collar. */
export function normalizarPieza(t: string): TipoPieza {
  return t === "armadura" ? "pecho" : t === "amuleto" ? "collar" : (t as TipoPieza);
}

/** Efectos especiales de los objetos únicos. El combate los consulta por nombre. */
export type EfectoUnico =
  | "golpe-doble"
  | "vidrio"
  | "segunda-vida"
  | "corazon"
  | "estela-ignea"
  | "ojo"
  | "onda"
  | "corona"
  | "perforante";

export type Dir = "izq" | "der" | "arr" | "aba";
export const OPUESTA: Readonly<Record<Dir, Dir>> = { izq: "der", der: "izq", arr: "aba", aba: "arr" };
export const DELTA: Readonly<Record<Dir, readonly [number, number]>> = {
  izq: [-1, 0], der: [1, 0], arr: [0, -1], aba: [0, 1],
};

/** Barreras de puertas laterales y la reliquia que las abre. */
export type Barrera = "cristal" | "raices";
export const RELIQUIA_DE_BARRERA: Readonly<Record<Barrera, Reliquia>> = { cristal: "embestida", raices: "garraIgnea" };
