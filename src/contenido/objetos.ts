// Catálogo de objetos. Un único lugar de verdad (lección de la tienda de MiniFighter): ids, pilas, precios.

import type { ClaveEfecto } from "./grimorio.ts";
import type { EfectoUnico, TipoPieza } from "../dominio/tipos.ts";
import type { Stat } from "../dominio/stats.ts";

// ---------------- Consumibles ----------------

export const OBJ_POCION = 1;
export const OBJ_ETER = 2;
export const OBJ_POLVO = 3;
export const OBJ_LAGRIMA = 4;
/** Dados del Destino (4★ a 12★): ids 30 a 38. */
export const OBJ_DADO_BASE = 30;
/** Relicario de Almas: se abre desde el inventario y da una carta de 5★ a 12★ (ver dominio/relicario.ts). */
export const OBJ_RELICARIO = 20;
/** Caja de Almas: la sueltan los monstruos; da una carta de 1★ a 6★. */
export const OBJ_CAJA_ALMAS = 21;
/** Recuerdos de las misiones personales del pueblo (50 martillo, 51 rosario, 52 cinta, 53 llave). */
export const OBJ_RECUERDO_BASE = 50;

export interface DefConsumible {
  readonly id: number;
  readonly nombre: string;
  readonly maxPila: number;
  readonly precio: number;
  readonly color: string;
  readonly descripcion: string;
}

/** Precios de los dados, de 4★ a 12★ (la carta máxima). */
export const PRECIO_DADO: readonly number[] = [20, 50, 100, 300, 800, 2000, 5000, 12000, 30000];
const COLOR_DADO: readonly string[] = ["#9fe8ff", "#7dff9a", "#ffd27a", "#ff9a4d", "#ff4d6d", "#ff6ad5", "#c9a7ff", "#7fe3ff", "#ffffff"];

export const CONSUMIBLES: readonly DefConsumible[] = [
  { id: OBJ_POCION, nombre: "Poción de Vida", maxPila: 5, precio: 60, color: "#ff4d6d", descripcion: "Restaura el 45 % de la vida. Tecla Q." },
  { id: OBJ_ETER, nombre: "Frasco de Éter", maxPila: 5, precio: 45, color: "#4dc3ff", descripcion: "Restaura el 70 % del éter. Tecla R." },
  { id: OBJ_POLVO, nombre: "Polvo de Eco", maxPila: 30, precio: 80, color: "#c9a7ff", descripcion: "Mejora una carta de alma (+1~+5 a todo, hasta 5 veces). Se usa en el Altar." },
  { id: OBJ_LAGRIMA, nombre: "Lágrima de Eco", maxPila: 5, precio: 400, color: "#ffffff", descripcion: "La próxima fusión en el Altar sube de estrella con seguridad (cualquier estrella)." },
  // Dados del Destino: fusión 100 % segura de tres cartas para llegar a esa estrella.
  ...PRECIO_DADO.map((_, k) => k + 4).map((estrellas, k) => ({
    id: OBJ_DADO_BASE + k,
    nombre: `Dado del Destino ${estrellas}★`,
    maxPila: 10,
    precio: PRECIO_DADO[k],
    color: COLOR_DADO[k],
    descripcion: `Fusión 100 % segura: tres cartas de ${estrellas - 1}★ dan una de ${estrellas}★.`,
  })),
];

/** Dado que asegura la fusión de cartas de este nivel (0 = 1★): el de la estrella siguiente. */
export function dadoParaNivel(nivelEntrada: number): number | undefined {
  const k = nivelEntrada - 2;
  return k >= 0 && k < PRECIO_DADO.length ? OBJ_DADO_BASE + k : undefined;
}

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
  readonly ranura: TipoPieza;
  readonly estilo?: EstiloArma;
  /** Rasgos que trae siempre esta base (además de los que salgan al azar). */
  readonly rasgos?: Readonly<Partial<Record<IdRasgoEquipo, number>>>;
  /** Stats principales por nivel de objeto. */
  readonly porNivel: Readonly<Partial<Record<Stat, number>>>;
}

export const BASES: readonly DefBase[] = [
  // ---- Armas (ids 100-109, 114-116)
  { id: 100, nombre: "Espada Mellada", ranura: "arma", estilo: "espada", porNivel: { golpe: 3.2 } },
  // 101, 103 y 115 eran armas de puños: ahora son de las cuatro familias (mismos ids para los guardados).
  { id: 101, nombre: "Gladio", ranura: "arma", estilo: "espada", porNivel: { golpe: 2.9, critico: 0.5 }, rasgos: { velocidad: 0.08 } },
  { id: 102, nombre: "Bastón de Hueso", ranura: "arma", estilo: "baston", porNivel: { tecnica: 3.4, mp: 1.5 } },
  { id: 103, nombre: "Maza de Hierro", ranura: "arma", estilo: "pesada", porNivel: { golpe: 3.6, hp: 1.2 } },
  { id: 104, nombre: "Mazo de Guerra", ranura: "arma", estilo: "pesada", porNivel: { golpe: 3.9, patada: 0.8 } },
  { id: 105, nombre: "Arco de Hueso", ranura: "arma", estilo: "arco", porNivel: { golpe: 2.7, critico: 0.5 } },
  { id: 106, nombre: "Báculo del Eremita", ranura: "arma", estilo: "baston", porNivel: { tecnica: 3, mp: 2, critico: 0.3 } },
  { id: 107, nombre: "Estoque", ranura: "arma", estilo: "espada", porNivel: { golpe: 2.6, critico: 0.8 }, rasgos: { velocidad: 0.15 } },
  { id: 108, nombre: "Hoja Bastarda", ranura: "arma", estilo: "espada", porNivel: { golpe: 3.5 }, rasgos: { alcance: 0.25 } },
  { id: 109, nombre: "Lucero del Alba", ranura: "arma", estilo: "pesada", porNivel: { golpe: 4.2, critico: 0.3 }, rasgos: { critDanio: 0.3 } },
  { id: 114, nombre: "Arco Largo", ranura: "arma", estilo: "arco", porNivel: { golpe: 3 }, rasgos: { alcance: 0.35 } },
  { id: 115, nombre: "Arco Corto", ranura: "arma", estilo: "arco", porNivel: { golpe: 2.5, critico: 0.6 }, rasgos: { velocidad: 0.12 } },
  { id: 116, nombre: "Cetro del Abismo", ranura: "arma", estilo: "baston", porNivel: { tecnica: 3.6, suerte: 0.4 }, rasgos: { eterGolpe: 2 } },
  // ---- Pecho
  { id: 110, nombre: "Coraza", ranura: "pecho", porNivel: { hp: 5, defensa: 1 } },
  { id: 112, nombre: "Túnica de Ceniza", ranura: "pecho", porNivel: { hp: 3.5, mp: 2, tecnica: 0.8 } },
  { id: 113, nombre: "Armadura de Placas", ranura: "pecho", porNivel: { hp: 6.5, defensa: 1.4 }, rasgos: { agilidad: -0.05 } },
  // ---- Hombros
  { id: 119, nombre: "Hombreras de Placa", ranura: "hombros", porNivel: { hp: 3, defensa: 0.8 } },
  // ---- Capas (accesorio con stats únicos: esquiva, resistencia, agilidad)
  { id: 111, nombre: "Capa del Errante", ranura: "capa", porNivel: { hp: 2, critico: 0.4 } },
  { id: 140, nombre: "Manto de Ceniza", ranura: "capa", porNivel: { hp: 2.5, defensa: 0.4 } },
  { id: 141, nombre: "Capa del Cuervo", ranura: "capa", porNivel: { critico: 0.5, suerte: 0.5 } },
  { id: 117, nombre: "Hombreras de Hueso", ranura: "hombros", porNivel: { hp: 2.5, defensa: 0.6, golpe: 0.5 } },
  { id: 118, nombre: "Espaldar Rúnico", ranura: "hombros", porNivel: { mp: 1.5, tecnica: 0.8, defensa: 0.3 } },
  // ---- Casco
  { id: 130, nombre: "Yelmo de Hierro", ranura: "casco", porNivel: { hp: 3, defensa: 0.6 } },
  { id: 131, nombre: "Capucha del Errante", ranura: "casco", porNivel: { hp: 2, critico: 0.5, suerte: 0.4 } },
  { id: 132, nombre: "Corona de Espinas", ranura: "casco", porNivel: { tecnica: 1, mp: 1.5 } },
  // ---- Cinturón
  { id: 150, nombre: "Cinturón de Cuero", ranura: "cinturon", porNivel: { hp: 2, patada: 0.8 } },
  { id: 151, nombre: "Faja del Monje", ranura: "cinturon", porNivel: { mp: 1.5, regen: 0.15 } },
  { id: 152, nombre: "Cinto del Verdugo", ranura: "cinturon", porNivel: { golpe: 0.8, critico: 0.3 } },
  // ---- Pantalones
  { id: 160, nombre: "Grebas de Malla", ranura: "pantalones", porNivel: { hp: 3, defensa: 0.6 } },
  { id: 161, nombre: "Calzas del Viajero", ranura: "pantalones", porNivel: { hp: 2, patada: 0.6 }, rasgos: { agilidad: 0.04 } },
  // ---- Botas
  { id: 170, nombre: "Botas de Cuero", ranura: "botas", porNivel: { hp: 2, patada: 0.6 }, rasgos: { agilidad: 0.03 } },
  { id: 171, nombre: "Botas Ferradas", ranura: "botas", porNivel: { hp: 2.5, defensa: 0.6, patada: 0.8 } },
  // ---- Anillos (stats propios de joyería)
  { id: 121, nombre: "Anillo de Hueso", ranura: "anillo", porNivel: { critico: 0.6, golpe: 0.6 } },
  { id: 180, nombre: "Anillo de la Fortuna", ranura: "anillo", porNivel: { suerte: 1.2 } },
  { id: 181, nombre: "Sello del Verdugo", ranura: "anillo", porNivel: { golpe: 1, critico: 0.3 }, rasgos: { critDanio: 0.1 } },
  { id: 182, nombre: "Anillo de Éter", ranura: "anillo", porNivel: { mp: 2, tecnica: 0.8 } },
  // ---- Aretes
  { id: 123, nombre: "Aretes de Talismán", ranura: "aretes", porNivel: { suerte: 0.8, regen: 0.2 } },
  { id: 190, nombre: "Aretes de Luna", ranura: "aretes", porNivel: { tecnica: 1, critico: 0.4 } },
  // ---- Collares
  { id: 120, nombre: "Amuleto", ranura: "collar", porNivel: { mp: 2, tecnica: 1 } },
  { id: 122, nombre: "Colgante", ranura: "collar", porNivel: { hp: 4, defensa: 0.4 } },
  { id: 191, nombre: "Collar del Abismo", ranura: "collar", porNivel: { hp: 2, golpe: 0.6, tecnica: 0.6, patada: 0.6 } },
];

export interface DefAfijo {
  readonly stat: Stat;
  readonly porNivel: number;
  readonly nombre: string;
  /** Piezas donde puede salir: la armadura sube vida y defensa; el arma, golpe y técnica; las joyas, suerte y crítico. */
  readonly en: readonly TipoPieza[];
}

/** Stats al azar ("afijos"): cada pieza suma uno o más según su rareza, de los que tienen sentido en su ranura. */
export const AFIJOS: readonly DefAfijo[] = [
  { stat: "hp", porNivel: 6, nombre: "del Oso", en: ["casco", "hombros", "pecho", "cinturon", "pantalones", "botas", "capa", "collar"] },
  { stat: "mp", porNivel: 2.5, nombre: "del Búho", en: ["casco", "aretes", "collar", "capa", "arma"] },
  { stat: "golpe", porNivel: 1.6, nombre: "Cruel", en: ["arma", "anillo", "hombros"] },
  { stat: "patada", porNivel: 1.8, nombre: "Pesado", en: ["arma", "botas", "pantalones"] },
  { stat: "tecnica", porNivel: 1.8, nombre: "Arcano", en: ["arma", "aretes", "collar", "casco", "anillo"] },
  { stat: "defensa", porNivel: 1, nombre: "Pétreo", en: ["casco", "hombros", "pecho", "cinturon", "pantalones", "botas", "capa"] },
  { stat: "critico", porNivel: 0.7, nombre: "Preciso", en: ["arma", "anillo", "aretes", "casco"] },
  { stat: "suerte", porNivel: 0.9, nombre: "de la Fortuna", en: ["anillo", "collar", "aretes", "cinturon", "capa"] },
  { stat: "regen", porNivel: 0.3, nombre: "del Troll", en: ["pecho", "cinturon", "pantalones", "collar"] },
];

// ---------------- Modificadores de equipo (RNG extra) ----------------
//
// Cada una de las 12 piezas tiene su propio grupo de modificadores, pensado para su papel:
//   · Arma: ofensivos (alcance, golpe doble, elemento, velocidad, crítico, daño, éter por golpe).
//   · Armadura (casco, hombros, pecho, cinturón, pantalones, botas): defensivos (vida, defensa, daño recibido,
//     espinas, regeneración), cada pieza con su toque (el casco piensa, las botas corren, el cinturón administra).
//   · Accesorios (capa, anillos, aretes, collar): únicos (robo de vida, enfriamiento, carga de Definitiva,
//     suerte, esquiva, ahorro de éter...).
// Cada pieza con modificadores trae siempre al menos uno de FIRMA (`firma`), exclusivo o típico de su ranura.
// `efecto` conecta el modificador con el sistema de pasivas (contenido/grimorio.ts): el combate ya lo aplica.

export type IdRasgoEquipo =
  | "alcance" | "velocidad" | "critDanio" | "eterGolpe" | "agilidad" | "robo" | "eterMax"
  | "esquiva" | "resistencia" | "tecnicaDanio" | "elemental"
  | "vidaPct" | "defensaPct" | "espinas" | "regen"
  | "golpeExtra" | "critico" | "danio" | "enfriamiento" | "carga" | "tecnicaCosto" | "suerte" | "codicia" | "curaPocion";

export interface DefRasgoEquipo {
  readonly id: IdRasgoEquipo;
  readonly nombre: string;
  /** Rango del valor (fracción, salvo los `entero`). */
  readonly min: number;
  readonly max: number;
  /** Clases de pieza donde puede salir. */
  readonly en: readonly TipoPieza[];
  /** Piezas donde es modificador de FIRMA: toda pieza con modificadores trae al menos uno de los suyos. */
  readonly firma?: readonly TipoPieza[];
  /** Efecto del sistema de pasivas al que suma (si no, lo lee su sistema propio: alcance, elemento, suerte...). */
  readonly efecto?: ClaveEfecto;
  /** Valor entero (puntos), no fracción. */
  readonly entero?: boolean;
  readonly formato: (v: number) => string;
}

const pct = (v: number): string => `${v >= 0 ? "+" : ""}${Math.round(v * 100)} %`;
const pts = (v: number): string => `+${Math.round(v)}`;
const ARMADURA: readonly TipoPieza[] = ["casco", "hombros", "pecho", "cinturon", "pantalones", "botas"];

export const RASGOS_EQUIPO: readonly DefRasgoEquipo[] = [
  // ---- Ofensivos (arma y algunos accesorios)
  { id: "alcance", nombre: "Alcance", min: 0.08, max: 0.3, en: ["arma"], firma: ["arma"], formato: pct },
  { id: "golpeExtra", nombre: "Golpe doble", min: 0.03, max: 0.09, en: ["arma"], firma: ["arma"], efecto: "golpeExtra", formato: pct },
  { id: "elemental", nombre: "Daño elemental", min: 0.1, max: 0.35, en: ["arma", "anillo"], firma: ["arma"], formato: pct },
  { id: "velocidad", nombre: "Velocidad de ataque", min: 0.04, max: 0.18, en: ["arma", "hombros", "anillo", "capa"], firma: ["hombros"], efecto: "velocidad", formato: pct },
  { id: "critDanio", nombre: "Daño crítico", min: 0.12, max: 0.5, en: ["arma", "anillo", "aretes"], firma: ["anillo"], efecto: "critDanio", formato: pct },
  { id: "critico", nombre: "Crítico", min: 2, max: 8, en: ["arma", "casco", "anillo", "aretes"], firma: ["casco"], efecto: "critico", entero: true, formato: (v) => `+${Math.round(v)} %` },
  { id: "danio", nombre: "Daño", min: 0.03, max: 0.08, en: ["arma", "anillo", "collar"], efecto: "danio", formato: pct },
  { id: "eterGolpe", nombre: "Éter por golpe", min: 1, max: 3, en: ["arma", "aretes"], firma: ["aretes"], efecto: "eterGolpe", entero: true, formato: pts },
  // ---- Defensivos (armadura)
  { id: "vidaPct", nombre: "Vida máxima", min: 0.03, max: 0.09, en: [...ARMADURA, "capa"], firma: ["pecho"], efecto: "hpPct", formato: pct },
  { id: "defensaPct", nombre: "Defensa", min: 0.04, max: 0.12, en: ARMADURA, firma: ["pantalones", "casco"], efecto: "defensaPct", formato: pct },
  { id: "resistencia", nombre: "Daño recibido", min: 0.03, max: 0.08, en: ["hombros", "pecho", "pantalones", "capa", "collar"], firma: ["capa", "pecho"], efecto: "recibido", formato: (v) => `−${Math.round(v * 100)} %` },
  { id: "espinas", nombre: "Daño devuelto", min: 0.05, max: 0.15, en: ["hombros", "pecho", "cinturon"], firma: ["hombros"], efecto: "espinas", formato: pct },
  { id: "regen", nombre: "Regeneración", min: 2, max: 6, en: ["casco", "pecho", "cinturon", "pantalones", "botas", "collar"], firma: ["pantalones"], efecto: "regen", entero: true, formato: pts },
  { id: "agilidad", nombre: "Velocidad de movimiento", min: 0.03, max: 0.1, en: ["botas", "pantalones", "capa"], firma: ["botas"], efecto: "agilidad", formato: pct },
  { id: "esquiva", nombre: "Esquiva", min: 0.02, max: 0.07, en: ["botas", "capa"], firma: ["capa", "botas"], efecto: "esquiva", formato: pct },
  // ---- Únicos de accesorio y de ranura
  { id: "robo", nombre: "Robo de vida", min: 0.01, max: 0.035, en: ["anillo", "collar"], firma: ["anillo", "collar"], efecto: "robo", formato: pct },
  { id: "enfriamiento", nombre: "Enfriamiento de habilidades", min: 0.04, max: 0.12, en: ["aretes", "casco", "anillo"], firma: ["aretes"], efecto: "enfriamiento", formato: (v) => `−${Math.round(v * 100)} %` },
  { id: "carga", nombre: "Carga de Definitiva", min: 0.06, max: 0.18, en: ["aretes", "collar", "casco"], firma: ["aretes"], efecto: "carga", formato: pct },
  { id: "tecnicaDanio", nombre: "Daño de habilidades", min: 0.05, max: 0.18, en: ["aretes", "casco", "collar", "anillo"], firma: ["collar"], efecto: "tecnicaDanio", formato: pct },
  { id: "tecnicaCosto", nombre: "Ahorro de éter", min: 0.04, max: 0.12, en: ["aretes", "collar", "casco"], efecto: "tecnicaCosto", formato: pct },
  { id: "eterMax", nombre: "Éter máximo", min: 8, max: 25, en: ["casco", "aretes", "collar"], firma: ["casco"], entero: true, formato: pts },
  { id: "suerte", nombre: "Suerte", min: 6, max: 20, en: ["anillo", "collar", "cinturon", "capa"], firma: ["anillo"], entero: true, formato: pts },
  { id: "codicia", nombre: "Esquirlas encontradas", min: 0.05, max: 0.15, en: ["cinturon", "anillo"], firma: ["cinturon"], formato: pct },
  { id: "curaPocion", nombre: "Curación de pociones", min: 0.1, max: 0.3, en: ["cinturon"], firma: ["cinturon"], formato: pct },
];

/** Modificadores de firma de una ranura (los que la hacen única). */
export function firmasDe(tipo: TipoPieza): readonly DefRasgoEquipo[] {
  return RASGOS_EQUIPO.filter((r) => r.firma?.includes(tipo));
}

export const NOMBRES_RAREZA = ["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico"] as const;
export const COLORES_RAREZA = ["#c8c8c8", "#6fe36a", "#4da6ff", "#b46bff", "#ffb23d", "#ff4d6d"] as const;

// ---------------- Únicos ----------------

export interface DefUnico {
  readonly id: number;
  readonly nombre: string;
  readonly ranura: TipoPieza;
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
    id: 201, nombre: "Sangre de Vidrio", ranura: "collar", efecto: "vidrio", porNivel: { golpe: 2, patada: 2, tecnica: 2 },
    descripcion: "Haces +60 % de daño, pero tu vida máxima baja un 35 %.", cita: "Brilla más quien está por romperse.",
  },
  {
    id: 202, nombre: "Manto del Eco", ranura: "capa", efecto: "segunda-vida", porNivel: { hp: 6, defensa: 1 },
    descripcion: "Una vez por piso, un golpe mortal te deja con 1 de vida y te vuelve invulnerable.", cita: "El Pozo todavía no terminó contigo.",
  },
  {
    id: 203, nombre: "Corazón del Pozo", ranura: "collar", efecto: "corazon", porNivel: { hp: 8 },
    descripcion: "Cada 8 enemigos derrotados recuperas el 20 % de tu vida.", cita: "Late con cada cosa que muere aquí abajo.",
  },
  {
    id: 204, nombre: "Grebas de Ceniza", ranura: "botas", efecto: "estela-ignea", porNivel: { hp: 5, patada: 1.5 },
    descripcion: "La Embestida deja una estela de fuego que quema a los enemigos.", cita: "Por donde pasa, el suelo recuerda el calor.",
  },
  {
    id: 205, nombre: "Ojo de Tantalio", ranura: "anillo", efecto: "ojo", porNivel: { critico: 1.4, golpe: 1 },
    descripcion: "+20 % de crítico. Cada crítico te devuelve 4 de éter.", cita: "Ve la grieta antes de que exista.",
  },
  {
    id: 206, nombre: "Martillo del Caído", ranura: "arma", estilo: "pesada", efecto: "onda", porNivel: { patada: 3, hp: 3 },
    descripcion: "Tus patadas lanzan una onda de choque.", cita: "Cayó mil metros sin soltarlo.",
  },
  {
    id: 207, nombre: "Corona Rota", ranura: "casco", efecto: "corona", porNivel: { critico: 0.5, mp: 2 },
    descripcion: "+60 % de esquirlas y más botín. Recibes +30 % de daño.", cita: "Un rey sin reino sigue teniendo hambre.",
  },
  {
    id: 208, nombre: "Susurro del Pozo", ranura: "arma", estilo: "arco", efecto: "perforante", porNivel: { golpe: 2.6, critico: 1 },
    descripcion: "Tus flechas atraviesan a todos los enemigos.", cita: "Nadie lo oyó tensarse. Nadie lo oyó soltar.",
  },
];

// ---------------- Runas (pasivas equipables, 2 ranuras) ----------------
//
// 16 runas, cada una en 4 rarezas (Común, Rara, Épica, Legendaria) que multiplican su efecto (×1 · ×1,5 · ×2,2 · ×3,2).
// Tres runas iguales se fusionan en el Yunque en una de la rareza siguiente.
// Ids de objeto: rareza Común = 300 + índice (los guardados viejos siguen valiendo); el resto, 3000 + índice·10 + rareza.

export type IdRuna =
  | "brasa" | "vampiro" | "viento" | "acero" | "avaro" | "calma" | "eco" | "furia" | "coleccionista" | "escarcha"
  | "tormenta" | "ponzona" | "fortaleza" | "presteza" | "sabio" | "verdugo";

export interface DefRuna {
  readonly id: IdRuna;
  readonly objeto: number;
  readonly nombre: string;
  readonly color: string;
  /** Descripción a rareza Común. */
  readonly descripcion: string;
  /** Descripción con el multiplicador de su rareza. */
  readonly texto: (m: number) => string;
}

export const NOMBRES_RAREZA_RUNA = ["Común", "Rara", "Épica", "Legendaria"] as const;
export const COLORES_RAREZA_RUNA = ["#c8c8c8", "#4da6ff", "#b46bff", "#ffb23d"] as const;
/** Multiplicador del efecto según la rareza de la runa. */
export const MULT_RUNA: readonly number[] = [1, 1.5, 2.2, 3.2];
export const RAREZA_RUNA_MAX = 3;
/** Esquirlas para fusionar 3 runas de esta rareza en una de la siguiente. */
export const COSTO_FUSION_RUNA: readonly number[] = [150, 600, 2400];

const pctR = (v: number): string => `${Math.round(v * 100)} %`;
const r1 = (v: number): string => (Math.round(v * 10) / 10).toString().replace(".", ",");

const runa = (id: IdRuna, objeto: number, nombre: string, color: string, texto: (m: number) => string): DefRuna =>
  ({ id, objeto, nombre, color, texto, descripcion: texto(1) });

export const RUNAS: readonly DefRuna[] = [
  runa("brasa", 300, "Runa de Brasa", "#ff7a3d", (m) => `Tus golpes y patadas queman y haces +${pctR(0.05 * m)} de daño.`),
  runa("vampiro", 301, "Runa del Vampiro", "#ff4d6d", (m) => `Te curas un ${pctR(0.04 * m)} del daño que haces.`),
  runa("viento", 302, "Runa del Viento", "#bff3ff", (m) => `${m >= 2.2 ? "Dos saltos" : "Un salto"} extra en el aire.`),
  runa("acero", 303, "Runa de Acero", "#c8c2d6", (m) => `+${pctR(0.2 * m)} de defensa.`),
  runa("avaro", 304, "Runa del Avaro", "#ffd23d", (m) => `+${pctR(0.35 * m)} de esquirlas.`),
  runa("calma", 305, "Runa de la Calma", "#7dff9a", (m) => `+${Math.round(8 * m)} de Regeneración.`),
  runa("eco", 306, "Runa del Eco", "#c9a7ff", (m) => `Las habilidades cuestan un ${pctR(0.15 * m)} menos de éter.`),
  runa("furia", 307, "Runa de Furia", "#ff3d3d", (m) => `+${pctR(0.3 * m)} de daño cuando te queda menos del 40 % de vida.`),
  runa("coleccionista", 308, "Runa del Coleccionista", "#ffb23d", (m) => `+${Math.round(30 * m)} de Suerte (más botín, mejores rarezas).`),
  runa("escarcha", 309, "Runa de Escarcha", "#7fe3ff", (m) => `Tus críticos aturden ${r1(Math.min(2, 0.8 * m))} s.`),
  // ---- Runas nuevas
  runa("tormenta", 310, "Runa de la Tormenta", "#ffe84a", (m) => `${pctR(0.1 * m)} de que tus golpes lancen un rayo en cadena.`),
  runa("ponzona", 311, "Runa Ponzoñosa", "#9aff5a", (m) => `${pctR(0.14 * m)} de que tus golpes envenenen.`),
  runa("fortaleza", 312, "Runa de la Fortaleza", "#e8e0cc", (m) => `+${pctR(0.07 * m)} de vida máxima.`),
  runa("presteza", 313, "Runa de Presteza", "#7fe3ff", (m) => `+${pctR(0.07 * m)} de velocidad de ataque.`),
  runa("sabio", 314, "Runa del Sabio", "#9fe8ff", (m) => `−${pctR(0.07 * m)} de enfriamiento de habilidades.`),
  runa("verdugo", 315, "Runa del Verdugo", "#ff5a6a", (m) => `+${pctR(0.22 * m)} de daño crítico.`),
];

/** Id de objeto de una runa de cierta rareza. */
export function objetoRuna(id: IdRuna, nivel: number): number {
  const i = RUNAS.findIndex((r) => r.id === id);
  return nivel <= 0 ? RUNAS[i].objeto : 3000 + i * 10 + Math.min(RAREZA_RUNA_MAX, nivel);
}

export interface RunaObjeto extends DefRuna {
  readonly nivel: number;
}

export function runaDeObjeto(id: number): RunaObjeto | undefined {
  const comun = RUNAS.find((r) => r.objeto === id);
  if (comun !== undefined) return { ...comun, nivel: 0 };
  if (id >= 3000 && id < 3000 + RUNAS.length * 10) {
    const i = Math.floor((id - 3000) / 10);
    const nivel = (id - 3000) % 10;
    if (nivel >= 1 && nivel <= RAREZA_RUNA_MAX) {
      const def = RUNAS[i];
      return { ...def, nivel, nombre: def.nombre, descripcion: def.texto(MULT_RUNA[nivel]) };
    }
  }
  return undefined;
}

/** Nombre con rareza ("Runa de Brasa · Épica"). */
export function nombreRuna(r: RunaObjeto): string {
  return r.nivel === 0 ? r.nombre : `${r.nombre} · ${NOMBRES_RAREZA_RUNA[r.nivel]}`;
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

/** Objetos especiales: no se venden en el Bazar. */
export const OBJETOS_ESPECIALES: readonly DefConsumible[] = [
  { id: OBJ_RECUERDO_BASE, nombre: "Martillo de Dorn", maxPila: 1, precio: 0, color: "#ff9a3d", descripcion: "Recuerdo. Pesa más de lo que debería. Llévaselo a Dorn, en la Fragua. Se pierde si mueres con él." },
  { id: OBJ_RECUERDO_BASE + 1, nombre: "Rosario de Ceniza", maxPila: 1, precio: 0, color: "#a07cff", descripcion: "Recuerdo. Faltan dos cuentas. Llévaselo a la Hermana Ceniza. Se pierde si mueres con él." },
  { id: OBJ_RECUERDO_BASE + 2, nombre: "Cinta de Marta", maxPila: 1, precio: 0, color: "#ff4d6d", descripcion: "Recuerdo. Una cinta roja, descolorida por el agua. Llévasela a Ilse. Se pierde si mueres con ella." },
  { id: OBJ_RECUERDO_BASE + 3, nombre: "Llave del Juramento", maxPila: 1, precio: 0, color: "#c9a7ff", descripcion: "Recuerdo. Una llave de hierro negro. Llévasela a Custodio Vael. Se pierde si mueres con ella." },
  {
    id: OBJ_RELICARIO, nombre: "Relicario de Almas", maxPila: 99, precio: 0, color: "#ffd27a",
    descripcion: "Un cofrecito sellado que late; lo sueltan los guardianes. Ábrelo desde el inventario: guarda UNA carta de alma de 5★ a 12★. "
      + "Cada 100 aperturas garantizan al menos 1 de 12★, 3 de 11★, 5 de 10★ y 8 de 9★.",
  },
  {
    id: OBJ_CAJA_ALMAS, nombre: "Caja de Almas", maxPila: 99, precio: 0, color: "#b8a8e0",
    descripcion: "Una cajita de hueso con un alma dormida; la sueltan los monstruos. Ábrela desde el inventario: guarda UNA carta de 1★ a 6★.",
  },
];

/** Consumible o material: todo lo que se apila en la mochila. */
export function apilable(id: number): DefConsumible | undefined {
  const ru = runaDeObjeto(id);
  if (ru !== undefined) return { id, nombre: nombreRuna(ru), maxPila: 5, precio: 0, color: ru.nivel === 0 ? ru.color : COLORES_RAREZA_RUNA[ru.nivel], descripcion: `${NOMBRES_RAREZA_RUNA[ru.nivel]}. ${ru.descripcion}` };
  return consumible(id) ?? MATERIALES.find((m) => m.id === id) ?? OBJETOS_ESPECIALES.find((m) => m.id === id);
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
