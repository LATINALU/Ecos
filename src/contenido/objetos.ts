// Catálogo de objetos. Un único lugar de verdad (lección de la tienda de MiniFighter): ids, pilas, precios.

import type { EfectoUnico, Ranura } from "../dominio/tipos.ts";
import type { Stat } from "../dominio/stats.ts";

// ---------------- Consumibles ----------------

export const OBJ_POCION = 1;
export const OBJ_ETER = 2;
export const OBJ_POLVO = 3;
export const OBJ_LAGRIMA = 4;

export interface DefConsumible {
  readonly id: number;
  readonly nombre: string;
  readonly maxPila: number;
  readonly precio: number;
  readonly color: string;
  readonly descripcion: string;
}

export const CONSUMIBLES: readonly DefConsumible[] = [
  { id: OBJ_POCION, nombre: "Poción de Vida", maxPila: 5, precio: 60, color: "#ff4d6d", descripcion: "Restaura el 45 % de la vida. Tecla Q." },
  { id: OBJ_ETER, nombre: "Frasco de Éter", maxPila: 5, precio: 45, color: "#4dc3ff", descripcion: "Restaura el 70 % del éter. Tecla R." },
  { id: OBJ_POLVO, nombre: "Polvo de Eco", maxPila: 30, precio: 80, color: "#c9a7ff", descripcion: "Mejora una carta de alma (+1~+5 a todo, hasta 5 veces). Se usa en el Altar." },
  { id: OBJ_LAGRIMA, nombre: "Lágrima de Eco", maxPila: 5, precio: 400, color: "#ffffff", descripcion: "La próxima fusión en el Altar sube de estrella con seguridad." },
];

// ---------------- Materiales (crafteo en el Yunque) ----------------

export const MAT_HUESO = 10;
export const MAT_ESPORA = 11;
export const MAT_ESCORIA = 12;
export const MAT_FRAGMENTO = 13;

export const MATERIALES: readonly DefConsumible[] = [
  { id: MAT_HUESO, nombre: "Hueso Antiguo", maxPila: 99, precio: 0, color: "#e8e0cc", descripcion: "Material del Osario Hundido. Se usa en el Yunque." },
  { id: MAT_ESPORA, nombre: "Espora Luminosa", maxPila: 99, precio: 0, color: "#5fffd0", descripcion: "Material del Bosque Micelio. Se usa en el Yunque." },
  { id: MAT_ESCORIA, nombre: "Escoria Ígnea", maxPila: 99, precio: 0, color: "#ff7a3d", descripcion: "Material de la Forja Ahogada. Se usa en el Yunque." },
  { id: MAT_FRAGMENTO, nombre: "Fragmento de Eco", maxPila: 99, precio: 0, color: "#c9a7ff", descripcion: "Memoria cristalizada. Lo sueltan élites, guardianes y el equipo valioso al desguazarlo." },
];

/** Material propio de cada piso. */
export const MATERIAL_DEL_PISO: readonly number[] = [MAT_HUESO, MAT_ESPORA, MAT_ESCORIA];

/** Diez pisos, tres materiales: se repiten por grupos (hueso, espora, escoria...). */
export function materialDelPiso(piso: number): number {
  return MATERIAL_DEL_PISO[(Math.max(1, piso) - 1) % MATERIAL_DEL_PISO.length];
}

// ---------------- Equipo ----------------

/** Estilo de combate que da un arma (cambia el combo del golpe). */
export type EstiloArma = "espada" | "punos" | "pesada" | "baston" | "arco";

/** Id de objeto de inventario para cada carta de alma (pila de 1 con la carta en `extra`). */
export const OBJ_CARTA = 500;

export interface DefBase {
  readonly id: number;
  readonly nombre: string;
  readonly ranura: Ranura;
  readonly estilo?: EstiloArma;
  /** Rasgos que trae siempre esta base (además de los que salgan al azar). */
  readonly rasgos?: Readonly<Partial<Record<IdRasgoEquipo, number>>>;
  /** Stats principales por nivel de objeto. */
  readonly porNivel: Readonly<Partial<Record<Stat, number>>>;
}

export const BASES: readonly DefBase[] = [
  { id: 100, nombre: "Espada Mellada", ranura: "arma", estilo: "espada", porNivel: { golpe: 3.2 } },
  { id: 101, nombre: "Guanteletes", ranura: "arma", estilo: "punos", porNivel: { golpe: 1.8, patada: 2.2 } },
  { id: 102, nombre: "Bastón de Hueso", ranura: "arma", estilo: "baston", porNivel: { tecnica: 3.4, mp: 1.5 } },
  { id: 103, nombre: "Grebas de Hierro", ranura: "arma", estilo: "punos", porNivel: { patada: 3.6 } },
  { id: 104, nombre: "Mazo de Guerra", ranura: "arma", estilo: "pesada", porNivel: { golpe: 3.9, patada: 0.8 } },
  { id: 105, nombre: "Arco de Hueso", ranura: "arma", estilo: "arco", porNivel: { golpe: 2.7, critico: 0.5 } },
  { id: 106, nombre: "Báculo del Eremita", ranura: "arma", estilo: "baston", porNivel: { tecnica: 3, mp: 2, critico: 0.3 } },
  { id: 107, nombre: "Estoque", ranura: "arma", estilo: "espada", porNivel: { golpe: 2.6, critico: 0.8 }, rasgos: { velocidad: 0.15 } },
  { id: 108, nombre: "Hoja Bastarda", ranura: "arma", estilo: "espada", porNivel: { golpe: 3.5 }, rasgos: { alcance: 0.25 } },
  { id: 109, nombre: "Lucero del Alba", ranura: "arma", estilo: "pesada", porNivel: { golpe: 4.2, critico: 0.3 }, rasgos: { critDanio: 0.3 } },
  { id: 110, nombre: "Arco Largo", ranura: "arma", estilo: "arco", porNivel: { golpe: 3 }, rasgos: { alcance: 0.35 } },
  { id: 111, nombre: "Garras de Hierro", ranura: "arma", estilo: "punos", porNivel: { golpe: 2.2, patada: 1.8, critico: 0.6 }, rasgos: { critDanio: 0.25 } },
  { id: 112, nombre: "Cetro del Abismo", ranura: "arma", estilo: "baston", porNivel: { tecnica: 3.6, suerte: 0.4 }, rasgos: { eterGolpe: 2 } },
  { id: 113, nombre: "Armadura de Placas", ranura: "armadura", porNivel: { hp: 11, defensa: 2.2 }, rasgos: { agilidad: -0.05 } },
  { id: 123, nombre: "Talismán", ranura: "amuleto", porNivel: { suerte: 1.2, regen: 0.2 } },
  { id: 110, nombre: "Coraza", ranura: "armadura", porNivel: { hp: 9, defensa: 1.6 } },
  { id: 111, nombre: "Capa del Errante", ranura: "armadura", porNivel: { hp: 5, defensa: 0.8, critico: 0.6 } },
  { id: 112, nombre: "Túnica de Ceniza", ranura: "armadura", porNivel: { hp: 6, mp: 3, tecnica: 1 } },
  { id: 120, nombre: "Amuleto", ranura: "amuleto", porNivel: { mp: 3, tecnica: 1.4 } },
  { id: 121, nombre: "Anillo de Hueso", ranura: "amuleto", porNivel: { critico: 1, golpe: 1 } },
  { id: 122, nombre: "Colgante", ranura: "amuleto", porNivel: { hp: 7, defensa: 0.6 } },
];

export interface DefAfijo {
  readonly stat: Stat;
  readonly porNivel: number;
  readonly nombre: string;
}

export const AFIJOS: readonly DefAfijo[] = [
  { stat: "hp", porNivel: 6, nombre: "del Oso" },
  { stat: "mp", porNivel: 2.5, nombre: "del Búho" },
  { stat: "golpe", porNivel: 1.6, nombre: "Cruel" },
  { stat: "patada", porNivel: 1.8, nombre: "Pesado" },
  { stat: "tecnica", porNivel: 1.8, nombre: "Arcano" },
  { stat: "defensa", porNivel: 1, nombre: "Pétreo" },
  { stat: "critico", porNivel: 0.7, nombre: "Preciso" },
  { stat: "suerte", porNivel: 0.9, nombre: "de la Fortuna" },
  { stat: "regen", porNivel: 0.3, nombre: "del Troll" },
];

// ---------------- Rasgos de equipo (RNG extra) ----------------

/** Rasgos al azar que cambian cómo se juega, no solo los números. */
export type IdRasgoEquipo = "alcance" | "velocidad" | "critDanio" | "eterGolpe" | "agilidad";

export interface DefRasgoEquipo {
  readonly id: IdRasgoEquipo;
  readonly nombre: string;
  /** Rango del valor (fracción, salvo eterGolpe que son puntos). */
  readonly min: number;
  readonly max: number;
  readonly soloArma: boolean;
  readonly formato: (v: number) => string;
}

const pct = (v: number): string => `${v >= 0 ? "+" : ""}${Math.round(v * 100)} %`;

export const RASGOS_EQUIPO: readonly DefRasgoEquipo[] = [
  { id: "alcance", nombre: "Alcance", min: 0.08, max: 0.35, soloArma: true, formato: pct },
  { id: "velocidad", nombre: "Velocidad de ataque", min: 0.05, max: 0.22, soloArma: false, formato: pct },
  { id: "critDanio", nombre: "Daño crítico", min: 0.15, max: 0.6, soloArma: false, formato: pct },
  { id: "eterGolpe", nombre: "Éter por golpe", min: 1, max: 3, soloArma: true, formato: (v) => `+${Math.round(v)}` },
  { id: "agilidad", nombre: "Velocidad de movimiento", min: 0.04, max: 0.12, soloArma: false, formato: pct },
];

export const NOMBRES_RAREZA = ["Común", "Raro", "Épico", "Legendario", "Único"] as const;
export const COLORES_RAREZA = ["#c8c8c8", "#4da6ff", "#b46bff", "#ffb23d", "#ff4d4d"] as const;

// ---------------- Únicos ----------------

export interface DefUnico {
  readonly id: number;
  readonly nombre: string;
  readonly ranura: Ranura;
  readonly estilo?: EstiloArma;
  readonly efecto: EfectoUnico;
  readonly porNivel: Readonly<Partial<Record<Stat, number>>>;
  readonly descripcion: string;
  readonly cita: string;
}

export const UNICOS: readonly DefUnico[] = [
  {
    id: 200, nombre: "Filo Gemelo", ranura: "arma", estilo: "espada", efecto: "golpe-doble", porNivel: { golpe: 3, critico: 0.5 },
    descripcion: "Cada golpe corta dos veces.", cita: "Dos hermanas, una sola hoja. Ninguna quiso ceder.",
  },
  {
    id: 201, nombre: "Sangre de Vidrio", ranura: "amuleto", efecto: "vidrio", porNivel: { golpe: 2, patada: 2, tecnica: 2 },
    descripcion: "Haces +60 % de daño, pero tu vida máxima baja un 35 %.", cita: "Brilla más quien está por romperse.",
  },
  {
    id: 202, nombre: "Manto del Eco", ranura: "armadura", efecto: "segunda-vida", porNivel: { hp: 6, defensa: 1 },
    descripcion: "Una vez por piso, un golpe mortal te deja con 1 de vida y te vuelve invulnerable.", cita: "El Pozo todavía no terminó contigo.",
  },
  {
    id: 203, nombre: "Corazón del Pozo", ranura: "amuleto", efecto: "corazon", porNivel: { hp: 8 },
    descripcion: "Cada 8 enemigos derrotados recuperas el 20 % de tu vida.", cita: "Late con cada cosa que muere aquí abajo.",
  },
  {
    id: 204, nombre: "Grebas de Ceniza", ranura: "armadura", efecto: "estela-ignea", porNivel: { hp: 5, patada: 1.5 },
    descripcion: "La Embestida deja una estela de fuego que quema a los enemigos.", cita: "Por donde pasa, el suelo recuerda el calor.",
  },
  {
    id: 205, nombre: "Ojo de Tantalio", ranura: "amuleto", efecto: "ojo", porNivel: { critico: 1.4, golpe: 1 },
    descripcion: "+20 % de crítico. Cada crítico te devuelve 4 de éter.", cita: "Ve la grieta antes de que exista.",
  },
  {
    id: 206, nombre: "Martillo del Caído", ranura: "arma", estilo: "pesada", efecto: "onda", porNivel: { patada: 3, hp: 3 },
    descripcion: "Tus patadas lanzan una onda de choque.", cita: "Cayó mil metros sin soltarlo.",
  },
  {
    id: 207, nombre: "Corona Rota", ranura: "amuleto", efecto: "corona", porNivel: { critico: 0.5, mp: 2 },
    descripcion: "+60 % de esquirlas y más botín. Recibes +30 % de daño.", cita: "Un rey sin reino sigue teniendo hambre.",
  },
  {
    id: 208, nombre: "Susurro del Pozo", ranura: "arma", estilo: "arco", efecto: "perforante", porNivel: { golpe: 2.6, critico: 1 },
    descripcion: "Tus flechas atraviesan a todos los enemigos.", cita: "Nadie lo oyó tensarse. Nadie lo oyó soltar.",
  },
];

// ---------------- Runas (pasivas equipables, 2 ranuras) ----------------

export type IdRuna = "brasa" | "vampiro" | "viento" | "acero" | "avaro" | "calma" | "eco" | "furia" | "coleccionista" | "escarcha";

export interface DefRuna {
  readonly id: IdRuna;
  readonly objeto: number;
  readonly nombre: string;
  readonly color: string;
  readonly descripcion: string;
}

export const RUNAS: readonly DefRuna[] = [
  { id: "brasa", objeto: 300, nombre: "Runa de Brasa", color: "#ff7a3d", descripcion: "Tus golpes y patadas queman." },
  { id: "vampiro", objeto: 301, nombre: "Runa del Vampiro", color: "#ff4d6d", descripcion: "Te curas un 4 % del daño que haces." },
  { id: "viento", objeto: 302, nombre: "Runa del Viento", color: "#bff3ff", descripcion: "Un salto extra en el aire." },
  { id: "acero", objeto: 303, nombre: "Runa de Acero", color: "#c8c2d6", descripcion: "+20 % de defensa." },
  { id: "avaro", objeto: 304, nombre: "Runa del Avaro", color: "#ffd23d", descripcion: "+35 % de esquirlas." },
  { id: "calma", objeto: 305, nombre: "Runa de la Calma", color: "#7dff9a", descripcion: "+8 de Regeneración." },
  { id: "eco", objeto: 306, nombre: "Runa del Eco", color: "#c9a7ff", descripcion: "Las técnicas cuestan un 15 % menos de éter." },
  { id: "furia", objeto: 307, nombre: "Runa de Furia", color: "#ff3d3d", descripcion: "+30 % de daño cuando te queda menos del 40 % de vida." },
  { id: "coleccionista", objeto: 308, nombre: "Runa del Coleccionista", color: "#ffb23d", descripcion: "+30 de Suerte (más botín, mejores rasgos)." },
  { id: "escarcha", objeto: 309, nombre: "Runa de Escarcha", color: "#7fe3ff", descripcion: "Tus críticos aturden 0,8 s." },
];

export function runaDeObjeto(id: number): DefRuna | undefined {
  return RUNAS.find((r) => r.objeto === id);
}

export function unico(id: number): DefUnico | undefined {
  return UNICOS.find((u) => u.id === id);
}

export function base(id: number): DefBase | undefined {
  return BASES.find((b) => b.id === id);
}

export function consumible(id: number): DefConsumible | undefined {
  return CONSUMIBLES.find((c) => c.id === id);
}

/** Consumible o material: todo lo que se apila en la mochila. */
export function apilable(id: number): DefConsumible | undefined {
  const runa = runaDeObjeto(id);
  if (runa !== undefined) return { id, nombre: runa.nombre, maxPila: 1, precio: 0, color: runa.color, descripcion: runa.descripcion };
  return consumible(id) ?? MATERIALES.find((m) => m.id === id);
}

/** Estilo de combate de un arma (base o única). Sin arma: a puño limpio. */
export function estiloDe(id: number | undefined): EstiloArma {
  if (id === undefined) return "punos";
  return base(id)?.estilo ?? unico(id)?.estilo ?? "punos";
}

/** maxPila para minialu/Inventario: consumibles se apilan, equipo y cartas son de a uno. */
export function maxPila(id: number): number | undefined {
  const c = apilable(id);
  if (c !== undefined) return c.maxPila;
  if (base(id) !== undefined || unico(id) !== undefined || id === OBJ_CARTA) return 1;
  return undefined;
}
