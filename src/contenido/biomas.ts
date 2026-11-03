// Las diez zonas del Pozo. Cada una define paleta, atmósfera (fondo, partículas, primer plano), nombres, colores y
// sprites de sus criaturas, y su guardián. Los guardianes 1, 2 y 10 tienen clase propia; el resto usa el motor de
// jefes configurable (forma visual + repertorio de ataques), así que agregar un jefe nuevo es agregar datos.

export type ConductaEnemigo = "caminante" | "saltador" | "volador" | "torreta" | "escudero";

export interface DefEnemigo {
  readonly conducta: ConductaEnemigo;
  readonly hp: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
  readonly w: number;
  readonly h: number;
  readonly velocidad: number;
}

export const ENEMIGOS: Readonly<Record<ConductaEnemigo, DefEnemigo>> = {
  caminante: { conducta: "caminante", hp: 30, ataque: 8, defensa: 2, exp: 6, w: 14, h: 14, velocidad: 38 },
  saltador: { conducta: "saltador", hp: 26, ataque: 9, defensa: 1, exp: 7, w: 14, h: 12, velocidad: 70 },
  volador: { conducta: "volador", hp: 18, ataque: 7, defensa: 0, exp: 6, w: 12, h: 10, velocidad: 48 },
  torreta: { conducta: "torreta", hp: 34, ataque: 9, defensa: 3, exp: 8, w: 16, h: 16, velocidad: 0 },
  escudero: { conducta: "escudero", hp: 50, ataque: 11, defensa: 6, exp: 11, w: 16, h: 20, velocidad: 30 },
};

export type IdJefe = "guardian" | "madre" | "recuerda" | "configurable";

/** Ataques que sabe hacer el jefe configurable (ver juego/entidades/jefes.ts). */
export type PatronJefe =
  | "carga" | "salto" | "lluvia" | "radial" | "rafaga" | "raices" | "rayo" | "invocar" | "laser" | "teleport" | "minas" | "tecnica";

export type FormaJefe = "golem" | "espectro" | "bestia" | "mascara" | "flor" | "reina";

export interface DefJefe {
  readonly id: IdJefe;
  readonly nombre: string;
  readonly titulo: string;
  readonly hp: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
  readonly w: number;
  readonly h: number;
  /** Solo para el configurable. */
  readonly forma?: FormaJefe;
  readonly vuela?: boolean;
  readonly patrones?: readonly PatronJefe[];
  /** Ataques que se suman en la segunda fase. */
  readonly patronesFase2?: readonly PatronJefe[];
  readonly colores?: readonly [string, string, string];
}

export type TipoFondo = "arcos" | "hongos" | "cadenas" | "cristales" | "ruinas" | "estantes" | "espinas" | "engranajes" | "tumbas" | "vacio";
export type TipoParticula = "polvo" | "esporas" | "brasas" | "nieve" | "burbujas" | "ceniza" | "petalos" | "chispas" | "estrellas" | "sangre";

export interface Bioma {
  readonly nombre: string;
  readonly lema: string;
  readonly cielo: readonly [string, string];
  readonly roca: string;
  readonly rocaClaro: string;
  readonly rocaOscuro: string;
  readonly plataforma: string;
  readonly acento: string;
  readonly niebla: string;
  /** Oscuridad de la sala (0 = sin sombra, 1 = negro salvo luces). */
  readonly oscuridad: number;
  readonly particula: TipoParticula;
  readonly fondo: TipoFondo;
  /** Tinte que se aplica a los sprites de terceros (color, intensidad 0~1) para que cada piso tenga su ánimo. */
  readonly tinte: readonly [string, number];
  readonly nombres: Readonly<Record<ConductaEnemigo, string>>;
  readonly colores: Readonly<Record<ConductaEnemigo, readonly [string, string]>>;
  /** Personaje de microFantasy para cada conducta (los voladores son procedurales). */
  readonly sprites: Readonly<Partial<Record<ConductaEnemigo, string>>>;
  readonly jefe: DefJefe;
}

const SPRITES_BASE = { caminante: "lizard", saltador: "rhino", escudero: "troll", torreta: "wizard" } as const;

export const BIOMAS: readonly Bioma[] = [
  {
    nombre: "Osario Hundido",
    lema: "Aquí los huesos todavía discuten quién cayó primero.",
    cielo: ["#120f1c", "#2a2238"],
    roca: "#4a4458", rocaClaro: "#6e6684", rocaOscuro: "#2b2735", plataforma: "#b8a98a", acento: "#c9b8ff",
    niebla: "rgba(150,130,200,0.06)", oscuridad: 0.55, particula: "polvo", fondo: "arcos", tinte: ["#2a1f44", 0.18],
    nombres: { caminante: "Osamenta", saltador: "Cráneo Saltarín", volador: "Murciélago Pálido", torreta: "Gárgola", escudero: "Centinela de Hueso" },
    colores: {
      caminante: ["#d9d0bd", "#7a6f5c"], saltador: ["#e8e0cc", "#ff5a5a"], volador: ["#8d7fb0", "#ffde59"],
      torreta: ["#6e6684", "#ff8a3d"], escudero: ["#cfc6b0", "#5a5a7a"],
    },
    sprites: SPRITES_BASE,
    jefe: { id: "guardian", nombre: "Guardián del Osario", titulo: "Aquel que Cierra la Puerta", hp: 650, ataque: 14, defensa: 6, exp: 120, w: 34, h: 44 },
  },
  {
    nombre: "Bosque Micelio",
    lema: "Las esporas recuerdan cada paso. Algunas, cada nombre.",
    cielo: ["#06151a", "#0f2e2c"],
    roca: "#2d4a45", rocaClaro: "#3f6b5f", rocaOscuro: "#16292a", plataforma: "#6fbf8f", acento: "#5fffd0",
    niebla: "rgba(80,255,200,0.05)", oscuridad: 0.62, particula: "esporas", fondo: "hongos", tinte: ["#1f6b5a", 0.45],
    nombres: { caminante: "Andarín Fúngico", saltador: "Sapo de Musgo", volador: "Polilla Luminosa", torreta: "Hongo Escupidor", escudero: "Guardia Corteza" },
    colores: {
      caminante: ["#8fbf7a", "#3d5a3a"], saltador: ["#4f8f4a", "#ffef7a"], volador: ["#bff7ff", "#5fffd0"],
      torreta: ["#c85a8a", "#ffd0f0"], escudero: ["#7a5a3a", "#5fffd0"],
    },
    sprites: { caminante: "lizard", saltador: "mooseman", escudero: "troll", torreta: "wizard" },
    jefe: { id: "madre", nombre: "Madre Micelio", titulo: "La que Florece en los Caídos", hp: 1400, ataque: 20, defensa: 9, exp: 260, w: 48, h: 40 },
  },
  {
    nombre: "Forja Ahogada",
    lema: "El fuego no se apagó cuando llegó el agua. Solo aprendió a esperar.",
    cielo: ["#140809", "#2c1210"],
    roca: "#4a2e2a", rocaClaro: "#7a463a", rocaOscuro: "#24120f", plataforma: "#e08a3d", acento: "#ffb23d",
    niebla: "rgba(255,120,60,0.06)", oscuridad: 0.5, particula: "brasas", fondo: "cadenas", tinte: ["#b0441f", 0.38],
    nombres: { caminante: "Autómata Roto", saltador: "Brasa Viva", volador: "Chispa Errante", torreta: "Fuelle Maldito", escudero: "Yunque Andante" },
    colores: {
      caminante: ["#8a7a6a", "#ff7a3d"], saltador: ["#ff7a3d", "#ffe08a"], volador: ["#ffd23d", "#ffffff"],
      torreta: ["#5a4a4a", "#ff4d2d"], escudero: ["#6a6a7a", "#ffb23d"],
    },
    sprites: { caminante: "dwarf", saltador: "rhino", escudero: "knight_red", torreta: "wizard" },
    jefe: {
      id: "configurable", nombre: "Fragua Viviente", titulo: "El Fuego que Aprendió a Esperar", hp: 2200, ataque: 26, defensa: 12, exp: 380,
      w: 40, h: 46, forma: "golem", patrones: ["carga", "salto", "lluvia", "rafaga"], patronesFase2: ["minas", "radial"],
      colores: ["#5a3a2a", "#ff7a3d", "#ffe08a"],
    },
  },
  {
    nombre: "Catacumbas de Escarcha",
    lema: "El frío conserva. A veces, demasiado.",
    cielo: ["#0a1420", "#1c3048"],
    roca: "#3a4a62", rocaClaro: "#6f8aa8", rocaOscuro: "#1c2638", plataforma: "#bfe6ff", acento: "#bff3ff",
    niebla: "rgba(190,240,255,0.07)", oscuridad: 0.5, particula: "nieve", fondo: "cristales", tinte: ["#3d7ab0", 0.4],
    nombres: { caminante: "Momia Helada", saltador: "Carámbano Vivo", volador: "Espíritu de Escarcha", torreta: "Ojo de Hielo", escudero: "Guardián Glacial" },
    colores: {
      caminante: ["#c8e0f0", "#4d8bff"], saltador: ["#bff3ff", "#ffffff"], volador: ["#e0f8ff", "#7fe3ff"],
      torreta: ["#6f8aa8", "#bff3ff"], escudero: ["#9ab8d8", "#ffffff"],
    },
    sprites: { caminante: "oldman", saltador: "lizard", escudero: "knight_blue", torreta: "wizard" },
    jefe: {
      id: "configurable", nombre: "Reina del Invierno Callado", titulo: "La que Detuvo el Río", hp: 3200, ataque: 32, defensa: 15, exp: 520,
      w: 34, h: 50, forma: "reina", vuela: true, patrones: ["rayo", "lluvia", "laser", "teleport"], patronesFase2: ["radial", "invocar"],
      colores: ["#3d6f9e", "#bff3ff", "#ffffff"],
    },
  },
  {
    nombre: "Ciudad Sumergida",
    lema: "Nadie se ahogó aquí. Simplemente dejaron de subir.",
    cielo: ["#04101e", "#0a2440"],
    roca: "#1e3a52", rocaClaro: "#33607e", rocaOscuro: "#0c1c2a", plataforma: "#5fb0c8", acento: "#4dd8ff",
    niebla: "rgba(60,160,255,0.08)", oscuridad: 0.6, particula: "burbujas", fondo: "ruinas", tinte: ["#164a7a", 0.45],
    nombres: { caminante: "Ahogado", saltador: "Pez Abisal", volador: "Medusa Errante", torreta: "Coral Escupidor", escudero: "Caballero Hundido" },
    colores: {
      caminante: ["#5f8fa8", "#4dd8ff"], saltador: ["#3d6f9e", "#ffe08a"], volador: ["#9fe8ff", "#ff8ad0"],
      torreta: ["#c85a6a", "#ffd0d0"], escudero: ["#4a6a7a", "#4dd8ff"],
    },
    sprites: { caminante: "monk", saltador: "lizard", escudero: "knight_blue", torreta: "wizard" },
    jefe: {
      id: "configurable", nombre: "Leviatán de Cripta", titulo: "El que Bebió la Ciudad", hp: 4300, ataque: 38, defensa: 18, exp: 680,
      w: 54, h: 36, forma: "bestia", patrones: ["carga", "salto", "radial", "rafaga"], patronesFase2: ["invocar", "lluvia"],
      colores: ["#1e4a6a", "#4dd8ff", "#ffe08a"],
    },
  },
  {
    nombre: "Biblioteca de Ceniza",
    lema: "Cada libro que ardió guardaba un nombre. La ceniza todavía lo susurra.",
    cielo: ["#141010", "#2a2220"],
    roca: "#4a4038", rocaClaro: "#7a6a5a", rocaOscuro: "#221c18", plataforma: "#a07a4a", acento: "#ffd27a",
    niebla: "rgba(200,180,150,0.06)", oscuridad: 0.58, particula: "ceniza", fondo: "estantes", tinte: ["#6a5030", 0.35],
    nombres: { caminante: "Escriba Quemado", saltador: "Tomo Rabioso", volador: "Página Errante", torreta: "Atril Maldito", escudero: "Bibliotecario Férreo" },
    colores: {
      caminante: ["#8a7a6a", "#ffd27a"], saltador: ["#7a3a2a", "#ffe08a"], volador: ["#e8e0cc", "#ff7a3d"],
      torreta: ["#5a4a3a", "#ffd27a"], escudero: ["#6a5a4a", "#ffb23d"],
    },
    sprites: { caminante: "oldman", saltador: "dwarf", escudero: "guard", torreta: "wizard" },
    jefe: {
      id: "configurable", nombre: "Archivista Quemado", titulo: "Guardián del Último Índice", hp: 5600, ataque: 45, defensa: 21, exp: 860,
      w: 36, h: 44, forma: "mascara", vuela: true, patrones: ["radial", "teleport", "rafaga", "tecnica"], patronesFase2: ["minas", "laser"],
      colores: ["#2a1a14", "#ffd27a", "#ff7a3d"],
    },
  },
  {
    nombre: "Jardín de Espinas",
    lema: "Las rosas de aquí abajo no necesitan sol. Necesitan sangre.",
    cielo: ["#140810", "#2a1020"],
    roca: "#3a2a32", rocaClaro: "#6a4a5a", rocaOscuro: "#1c1018", plataforma: "#8a4a6a", acento: "#ff5a8a",
    niebla: "rgba(255,90,140,0.06)", oscuridad: 0.56, particula: "petalos", fondo: "espinas", tinte: ["#8a2050", 0.4],
    nombres: { caminante: "Jardinero Muerto", saltador: "Capullo Saltarín", volador: "Abeja Carmesí", torreta: "Rosa Escupidora", escudero: "Zarza Andante" },
    colores: {
      caminante: ["#7a6a5a", "#ff5a8a"], saltador: ["#c84a6a", "#ffe08a"], volador: ["#ff5a8a", "#ffe08a"],
      torreta: ["#a03a5a", "#ffd0e0"], escudero: ["#4a3a2a", "#ff5a8a"],
    },
    sprites: { caminante: "mooseman", saltador: "lizard", escudero: "barbarian", torreta: "wizard" },
    jefe: {
      id: "configurable", nombre: "Rosa Carnívora", titulo: "La que Florece en la Herida", hp: 7000, ataque: 52, defensa: 24, exp: 1050,
      w: 50, h: 44, forma: "flor", vuela: true, patrones: ["raices", "radial", "invocar", "rafaga"], patronesFase2: ["lluvia", "minas"],
      colores: ["#4a1a2a", "#ff5a8a", "#c4ff7a"],
    },
  },
  {
    nombre: "Engranaje Olvidado",
    lema: "La máquina sigue girando. Ya nadie recuerda qué fabricaba.",
    cielo: ["#100c08", "#2a2014"],
    roca: "#4a3a28", rocaClaro: "#8a6a3a", rocaOscuro: "#221a10", plataforma: "#c89a4a", acento: "#ffc84a",
    niebla: "rgba(255,200,80,0.05)", oscuridad: 0.5, particula: "chispas", fondo: "engranajes", tinte: ["#8a6020", 0.4],
    nombres: { caminante: "Autómata Obrero", saltador: "Resorte Loco", volador: "Dron de Latón", torreta: "Torreta de Vapor", escudero: "Gólem de Bronce" },
    colores: {
      caminante: ["#8a6a3a", "#ffc84a"], saltador: ["#c89a4a", "#ff7a3d"], volador: ["#e0b050", "#9fe8ff"],
      torreta: ["#6a5a3a", "#ff4d2d"], escudero: ["#a07a3a", "#ffc84a"],
    },
    sprites: { caminante: "dwarf", saltador: "rhino", escudero: "knight_yellow", torreta: "guard" },
    jefe: {
      id: "configurable", nombre: "Autómata Coloso", titulo: "El que Sigue Girando", hp: 8600, ataque: 60, defensa: 27, exp: 1250,
      w: 48, h: 52, forma: "golem", patrones: ["laser", "carga", "minas", "salto"], patronesFase2: ["lluvia", "radial"],
      colores: ["#6a5030", "#ffc84a", "#ff4d2d"],
    },
  },
  {
    nombre: "Necrópolis Estelar",
    lema: "Aquí entierran a los que miraron demasiado tiempo hacia arriba.",
    cielo: ["#06041a", "#140c30"],
    roca: "#2e2848", rocaClaro: "#5a4a8a", rocaOscuro: "#140e24", plataforma: "#8a7ad8", acento: "#c9a7ff",
    niebla: "rgba(170,140,255,0.07)", oscuridad: 0.62, particula: "estrellas", fondo: "tumbas", tinte: ["#4a30a0", 0.42],
    nombres: { caminante: "Astrónomo Hueco", saltador: "Fragmento Estelar", volador: "Cometa Menor", torreta: "Telescopio Maldito", escudero: "Custodio del Cielo" },
    colores: {
      caminante: ["#6a5a9a", "#c9a7ff"], saltador: ["#c9a7ff", "#ffffff"], volador: ["#ffe08a", "#ffffff"],
      torreta: ["#3a3060", "#c9a7ff"], escudero: ["#5a4a8a", "#ffe08a"],
    },
    sprites: { caminante: "monk", saltador: "lizard", escudero: "knight_green", torreta: "wizard" },
    jefe: {
      id: "configurable", nombre: "Astrónomo Muerto", titulo: "El que Contó las Estrellas Caídas", hp: 10500, ataque: 68, defensa: 30, exp: 1500,
      w: 34, h: 48, forma: "espectro", vuela: true, patrones: ["lluvia", "rayo", "teleport", "tecnica"], patronesFase2: ["radial", "laser"],
      colores: ["#1a1438", "#c9a7ff", "#ffe08a"],
    },
  },
  {
    nombre: "Corazón del Pozo",
    lema: "Todo lo que cayó termina aquí. Todo lo que recuerda, también.",
    cielo: ["#100406", "#2a0810"],
    roca: "#3a1418", rocaClaro: "#6a2a30", rocaOscuro: "#1c080a", plataforma: "#a03a40", acento: "#ff4d4d",
    niebla: "rgba(255,60,60,0.07)", oscuridad: 0.6, particula: "sangre", fondo: "vacio", tinte: ["#8a1020", 0.42],
    nombres: { caminante: "Recuerdo Rojo", saltador: "Latido", volador: "Lágrima Errante", torreta: "Vena Escupidora", escudero: "Eco Sin Nombre" },
    colores: {
      caminante: ["#8a3a40", "#ff4d4d"], saltador: ["#c83a40", "#ffe08a"], volador: ["#ff8a8a", "#ffffff"],
      torreta: ["#6a1a20", "#ff4d4d"], escudero: ["#5a2a30", "#ff4d4d"],
    },
    sprites: { caminante: "barbarian", saltador: "rhino", escudero: "knight_red", torreta: "wizard" },
    jefe: { id: "recuerda", nombre: "El Que Recuerda", titulo: "Corazón del Pozo", hp: 13000, ataque: 76, defensa: 34, exp: 2500, w: 40, h: 48 },
  },
];

export const PISOS_TOTALES = BIOMAS.length;

export function bioma(piso: number): Bioma {
  return BIOMAS[Math.max(0, Math.min(piso - 1, BIOMAS.length - 1))];
}

/** Escala de los monstruos por piso (cuadrática suave: diez pisos sin que el final sea imposible). */
export function escalaEnemigo(piso: number): { hp: number; ataque: number; defensa: number; exp: number } {
  const p = Math.max(0, piso - 1);
  return { hp: 1 + 0.75 * p + 0.06 * p * p, ataque: 1 + 0.5 * p, defensa: 1 + 0.45 * p, exp: 1 + 0.8 * p };
}

/** Salas por piso. */
export const SALAS_POR_PISO: readonly number[] = [9, 10, 10, 11, 11, 12, 12, 12, 13, 10];
