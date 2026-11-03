// Salas de DESAFÍO (arenas): el lugar del Pozo para conseguir buen equipo peleando, no comprando.
//
// En la sala espera una Campana del Desafío. Nada pasa hasta que el Portador la toca (es opcional): ahí se
// sellan las puertas y llegan las oleadas. Cada arena tiene:
//   · una VARIANTE con su propia regla (oleadas, contrarreloj, élites, marea, duelo contra un campeón),
//   · un BOTÍN CON DESTINO: se anuncia de antemano qué clase de pieza da (para buscar equipo concreto),
//   · SELLOS de mérito que mejoran el premio (Intocable, A tiempo) y la RACHA del descenso.
// Ya en el lategame, la misma campana ofrece el JUICIO (ver dominio/juicio.ts), estilo Mítica+.
//
// Todo es determinista por la semilla de la sala: la misma sala siempre es la misma arena.

import { AzarSemilla, elegirPorPeso, elegirUno } from "minialu";
import type { Rareza } from "./equipo.ts";
import type { TipoPieza } from "./tipos.ts";

export type VarianteArena = "sangre" | "campeones" | "reloj" | "marea" | "duelo";

export interface DefArena {
  readonly variante: VarianteArena;
  readonly nombre: string;
  /** La regla, en una frase (se muestra al tocar la campana). */
  readonly regla: string;
  readonly color: string;
  readonly oleadas: number;
  /** Enemigos de la oleada `n` (1 = la primera). */
  readonly enemigos: (oleada: number) => number;
  /** "ultimo": un élite cierra la última oleada; "todos": todas son élites; "campeon": un solo jefe menor. */
  readonly elites: "ultimo" | "todos" | "campeon";
  /** Contrarreloj: segundos para limpiar todas las oleadas. */
  readonly tiempo?: number;
  /** Cofre base (0 madera … 3 mítico). */
  readonly cofre: number;
  /** Pieza de equipo garantizada con esta rareza mínima (además del cofre). */
  readonly pieza?: Rareza;
  /** Botín con destino: la clase de la pieza garantizada, anunciada de antemano. */
  readonly destino: TipoPieza;
  /** Duelo: una carta de alma de jefe garantizada. */
  readonly carta: boolean;
  /** Esquirlas extra al terminar. */
  readonly esquirlas: number;
}

/** Piso desde el que aparece cada variante y su peso al sortear. */
const DISPONIBLE: Readonly<Record<VarianteArena, { desde: number; peso: number }>> = {
  sangre: { desde: 1, peso: 1.2 },
  reloj: { desde: 2, peso: 1 },
  campeones: { desde: 3, peso: 0.9 },
  marea: { desde: 4, peso: 0.8 },
  duelo: { desde: 5, peso: 0.8 },
};

export const DESTINOS: readonly TipoPieza[] = ["arma", "casco", "hombros", "pecho", "cinturon", "pantalones", "botas", "capa", "anillo", "aretes", "collar"];

const cofreBase = (piso: number): number => Math.min(3, 1 + Math.floor(piso / 8));

export function defArena(variante: VarianteArena, piso: number, destino: TipoPieza = "arma"): DefArena {
  const base = 3 + Math.floor(piso / 4);
  const comun = { variante, destino, carta: false };
  switch (variante) {
    case "sangre":
      return {
        ...comun, nombre: "Arena de Sangre", color: "#ff6a3d",
        regla: "Oleadas que crecen; un campeón élite cierra la última.",
        oleadas: 2 + Math.floor(piso / 6), enemigos: (n) => base + n, elites: "ultimo",
        cofre: cofreBase(piso), pieza: 1, esquirlas: 10 * piso,
      };
    case "campeones":
      return {
        ...comun, nombre: "Foso de Campeones", color: "#ffd23d",
        regla: "Pocos rivales, todos élites. Premio: una pieza Rara o mejor.",
        oleadas: 2, enemigos: () => 2 + Math.floor(piso / 8), elites: "todos",
        cofre: Math.min(3, cofreBase(piso) + 1), pieza: piso >= 10 ? 3 : 2, esquirlas: 15 * piso,
      };
    case "reloj":
      return {
        ...comun, nombre: "Reloj de Arena", color: "#7fe3ff",
        regla: "Limpia las 3 oleadas antes de que caiga la arena: a tiempo, el cofre mejora.",
        oleadas: 3, enemigos: (n) => base + n - 1, elites: "ultimo",
        tiempo: 45 + Math.min(30, piso * 2), cofre: cofreBase(piso), pieza: 1, esquirlas: 10 * piso,
      };
    case "marea":
      return {
        ...comun, nombre: "La Marea", color: "#9f7aff",
        regla: "Cuatro oleadas, muchos enemigos. Deja un botín de esquirlas enorme.",
        oleadas: 4, enemigos: (n) => base + 2 + n, elites: "ultimo",
        cofre: cofreBase(piso), pieza: 1, esquirlas: 40 * piso,
      };
    case "duelo":
      return {
        ...comun, nombre: "Duelo del Campeón", color: "#ff4d6d", carta: true,
        regla: "Un solo rival: el campeón de la zona, enorme y con tres afijos. Premio: una carta de alma de jefe.",
        oleadas: 1, enemigos: () => 1, elites: "campeon",
        cofre: cofreBase(piso), pieza: 2, esquirlas: 20 * piso,
      };
  }
}

/** Variante y destino de la arena de una sala (deterministas por su semilla). */
export function arenaPara(semilla: number, piso: number): DefArena {
  const azar = new AzarSemilla(semilla ^ 0x5a17);
  const pool = (Object.keys(DISPONIBLE) as VarianteArena[])
    .filter((v) => piso >= DISPONIBLE[v].desde)
    .map((v) => [v, DISPONIBLE[v].peso] as const);
  const variante = elegirPorPeso(azar, pool);
  return defArena(variante, piso, elegirUno(azar, DESTINOS));
}

/**
 * Cuántas salas de desafío tiene un piso. El Pozo no tiene tiendas ni altares (para eso está la superficie):
 * su lugar lo ocupan las arenas. En el Abismo, que sí tiene servicios, son algunas menos.
 */
export function arenasDelPiso(piso: number, abismo: boolean): number {
  return abismo ? Math.min(3, 1 + Math.floor(piso / 10)) : Math.min(4, 1 + Math.floor(piso / 5));
}

export interface DesempenoArena {
  readonly golpesRecibidos: number;
  /** Contrarreloj: segundos que sobraron (negativo o 0 = tarde). */
  readonly tiempoSobrante?: number;
  /** Arenas ya superadas en este descenso (sin contar esta). */
  readonly racha?: number;
}

export interface Sello {
  readonly texto: string;
  readonly bueno: boolean;
}

export interface PremioArena {
  readonly cofre: number;
  readonly pieza?: Rareza;
  readonly esquirlas: number;
  readonly sellos: readonly Sello[];
}

const subir = (r: Rareza | undefined, n = 1): Rareza => Math.min(5, (r ?? 0) + n) as Rareza;

export function premioArena(def: DefArena, d: DesempenoArena): PremioArena {
  let cofre = def.cofre;
  let pieza = def.pieza;
  let esquirlas = def.esquirlas;
  const sellos: Sello[] = [];
  if (d.golpesRecibidos === 0) {
    cofre++;
    pieza = subir(pieza);
    sellos.push({ texto: "Intocable: el cofre y la pieza mejoran", bueno: true });
  } else if (d.golpesRecibidos <= 3) {
    esquirlas = Math.round(esquirlas * 1.5);
    sellos.push({ texto: "Pocos rasguños: +50 % de esquirlas", bueno: true });
  }
  if (def.tiempo !== undefined) {
    if ((d.tiempoSobrante ?? 0) > 0) {
      cofre++;
      sellos.push({ texto: "¡A tiempo!: el cofre mejora", bueno: true });
    } else {
      cofre--;
      pieza = undefined;
      sellos.push({ texto: "Tarde: la arena cayó antes que ellos", bueno: false });
    }
  }
  // Racha: encadenar desafíos en un mismo descenso (sin extraer) paga cada vez más.
  const racha = (d.racha ?? 0) + 1;
  if (racha >= 2) {
    esquirlas = Math.round(esquirlas * (1 + Math.min(1, (racha - 1) * 0.25)));
    if (racha >= 3) cofre++;
    if (racha >= 5 && pieza !== undefined) pieza = subir(pieza);
    sellos.push({ texto: `Racha ×${racha}${racha >= 5 ? ": cofre y pieza mejoran" : racha >= 3 ? ": el cofre mejora" : ": más esquirlas"}`, bueno: true });
  }
  return { cofre: Math.max(0, Math.min(3, cofre)), pieza, esquirlas, sellos };
}
