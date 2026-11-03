// Las 24 zonas del Pozo (10 originales + 14 del Pozo Profundo; el Corazón pasa a ser el piso 24). Cada una define paleta, atmósfera (fondo, partículas, primer plano), nombres, colores y
// sprites de sus criaturas, y su guardián. Los guardianes 1, 2 y 10 tienen clase propia; el resto usa el motor de
// jefes configurable (forma visual + repertorio de ataques), así que agregar un jefe nuevo es agregar datos.

/** Conductas originales (cada bioma les pone nombre y color). */
export type ConductaBase = "caminante" | "saltador" | "volador" | "torreta" | "escudero";
/** Conductas del rework: aparecen al bajar, reemplazando a parte de las originales. */
export type ConductaNueva = "cargador" | "explosivo" | "lanzador" | "espectro";
export type ConductaEnemigo = ConductaBase | ConductaNueva;

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
  cargador: { conducta: "cargador", hp: 42, ataque: 13, defensa: 3, exp: 10, w: 15, h: 16, velocidad: 40 },
  explosivo: { conducta: "explosivo", hp: 16, ataque: 11, defensa: 0, exp: 8, w: 12, h: 12, velocidad: 85 },
  lanzador: { conducta: "lanzador", hp: 30, ataque: 10, defensa: 2, exp: 9, w: 16, h: 16, velocidad: 0 },
  espectro: { conducta: "espectro", hp: 24, ataque: 10, defensa: 1, exp: 10, w: 12, h: 14, velocidad: 55 },
};

/** De qué conducta original sale cada nueva (nombre de respaldo, colores y sprite) y desde qué piso aparece. */
export const ORIGEN_CONDUCTA: Readonly<Record<ConductaNueva, { readonly de: ConductaBase; readonly desde: number; readonly prob: number }>> = {
  cargador: { de: "caminante", desde: 3, prob: 0.3 },
  lanzador: { de: "torreta", desde: 4, prob: 0.4 },
  explosivo: { de: "saltador", desde: 5, prob: 0.35 },
  espectro: { de: "volador", desde: 7, prob: 0.35 },
};

/** Nombres de las conductas nuevas por piso: [cargador, explosivo, lanzador, espectro]. */
const NOMBRES_NUEVOS: readonly (readonly [string, string, string, string])[] = [
  ["Embestidor de Hueso", "Cráneo Ardiente", "Arrojahuesos", "Ánima del Osario"],
  ["Jabalí Fúngico", "Bulbo Explosivo", "Lanzaesporas", "Espíritu del Micelio"],
  ["Ariete Roto", "Caldera Viva", "Catapulta Ígnea", "Humo Errante"],
  ["Toro de Escarcha", "Carámbano Inestable", "Lanzanieve", "Aliento Helado"],
  ["Tiburón de Cripta", "Pez Globo", "Lanzapiedras Ahogado", "Ahogado Espectral"],
  ["Lomo de Libro", "Pergamino Ardiente", "Lanzatinta", "Página Fantasma"],
  ["Cornúpeta Espinoso", "Vaina Explosiva", "Lanzasemillas", "Polen Errante"],
  ["Pistón Desbocado", "Caldera Rota", "Mortero de Bronce", "Vapor Fantasma"],
  ["Astro Embestidor", "Supernova Menor", "Lanzameteoros", "Constelación Errante"],
  ["Toro de Turba", "Burbuja de Gas", "Lanzalodo", "Fuego Fatuo"],
  ["Morsa Hueca", "Ola Rota", "Lanzaagua", "Recuerdo Ahogado"],
  ["Abejorro Toro", "Panal Inestable", "Lanzamiel", "Enjambre Fantasma"],
  ["Carnero de Arena", "Urna Sellada", "Lanzaarena", "Espejismo"],
  ["Toro de Obsidiana", "Gema Volcánica", "Lanzamagma", "Humo de Fragua"],
  ["Ciervo Hueco", "Calabaza Bomba", "Lanzabellotas", "Sombra Otoñal"],
  ["Pez Martillo", "Erizo Abisal", "Lanzacorales", "Fiel Sumergido"],
  ["Vagoneta Loca", "Dinamita Viva", "Lanzacuarzo", "Minero Fantasma"],
  ["Gigante Menor", "Médula Inestable", "Lanzafémures", "Eco de Gigante"],
  ["Toro Gris", "Hongo Bomba", "Lanzaesporas Gris", "Velo Fúngico"],
  ["Engranaje Loco", "Resorte Bomba", "Lanzatuercas", "Hora Perdida"],
  ["Toro del Trueno", "Esfera Eléctrica", "Lanzarrayos", "Nube Fantasma"],
  ["Prisma Toro", "Cristal Inestable", "Lanzaesquirlas", "Reflejo"],
  ["Recuerdo Furioso", "Latido Bomba", "Lanzalágrimas", "Olvido"],
  ["Pulso Rojo", "Vena Bomba", "Escupidor de Sangre", "Eco Final"],
];

export function nombreEnemigo(piso: number, b: Bioma, c: ConductaEnemigo): string {
  if (c in b.nombres) return b.nombres[c as ConductaBase];
  const fila = NOMBRES_NUEVOS[Math.max(0, Math.min(piso - 1, NOMBRES_NUEVOS.length - 1))];
  const i = (["cargador", "explosivo", "lanzador", "espectro"] as const).indexOf(c as ConductaNueva);
  return fila[i] ?? b.nombres[ORIGEN_CONDUCTA[c as ConductaNueva].de];
}

export function coloresEnemigo(b: Bioma, c: ConductaEnemigo): readonly [string, string] {
  return c in b.colores ? b.colores[c as ConductaBase] : b.colores[ORIGEN_CONDUCTA[c as ConductaNueva].de];
}

export function spriteEnemigo(b: Bioma, c: ConductaEnemigo): string | undefined {
  if (c === "espectro") return undefined;
  if (c === "explosivo") return b.sprites.saltador;
  if (c === "lanzador") return b.sprites.torreta;
  if (c === "cargador") return b.sprites.escudero ?? b.sprites.caminante;
  return b.sprites[c];
}

/** Afijos de élite: hacen que cada élite sea un problema distinto. Más afijos cuanto más hondo. */
export type AfijoElite = "veloz" | "blindado" | "vampiro" | "regenerador" | "explosivo" | "furioso";

export const INFO_AFIJO_ELITE: Readonly<Record<AfijoElite, { readonly nombre: string; readonly color: string }>> = {
  veloz: { nombre: "Veloz", color: "#7fe3ff" },
  blindado: { nombre: "Blindado", color: "#c8c8d8" },
  vampiro: { nombre: "Vampiro", color: "#ff4d6d" },
  regenerador: { nombre: "Regenerador", color: "#7dff9a" },
  explosivo: { nombre: "Explosivo", color: "#ff9a3d" },
  furioso: { nombre: "Furioso", color: "#ff3d3d" },
};

export function cantidadAfijosElite(piso: number): number {
  return piso >= 16 ? 3 : piso >= 7 ? 2 : 1;
}

/** Probabilidad de que un monstruo sea élite (sube con el piso, con techo). */
export function probElite(piso: number): number {
  return Math.min(0.32, 0.08 + piso * 0.012);
}

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

export type TipoFondo =
  | "arcos" | "hongos" | "cadenas" | "cristales" | "ruinas" | "estantes" | "espinas" | "engranajes" | "tumbas" | "vacio"
  | "cascadas" | "colmena" | "obsidiana" | "raicesGigantes";
export type TipoParticula =
  | "polvo" | "esporas" | "brasas" | "nieve" | "burbujas" | "ceniza" | "petalos" | "chispas" | "estrellas" | "sangre"
  | "lluvia" | "luciernagas" | "hojas" | "arena";

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
  readonly nombres: Readonly<Record<ConductaBase, string>>;
  readonly colores: Readonly<Record<ConductaBase, readonly [string, string]>>;
  /** Personaje de microFantasy para cada conducta (los voladores son procedurales). */
  readonly sprites: Readonly<Partial<Record<ConductaBase, string>>>;
  readonly jefe: DefJefe;
}

interface DatosZona {
  readonly nombre: string;
  readonly lema: string;
  readonly cielo: readonly [string, string];
  readonly roca: readonly [string, string, string];
  readonly plataforma: string;
  readonly acento: string;
  readonly niebla: string;
  readonly oscuridad: number;
  readonly particula: TipoParticula;
  readonly fondo: TipoFondo;
  readonly tinte: readonly [string, number];
  /** caminante, saltador, volador, torreta, escudero. */
  readonly nombres: readonly [string, string, string, string, string];
  readonly colores: readonly (readonly [string, string])[];
  readonly sprites: Readonly<Partial<Record<ConductaBase, string>>>;
  readonly jefe: {
    readonly nombre: string; readonly titulo: string; readonly forma: FormaJefe; readonly vuela?: boolean;
    readonly patrones: readonly PatronJefe[]; readonly fase2: readonly PatronJefe[]; readonly colores: readonly [string, string, string];
  };
}

/** Stats de un guardián del Pozo Profundo según su piso (misma curva que los monstruos, más dura). */
export function statsJefe(piso: number): { hp: number; ataque: number; defensa: number; exp: number } {
  const e = escalaEnemigo(piso);
  return { hp: Math.round(1150 * e.hp), ataque: Math.round(14 * e.ataque), defensa: Math.round(6 * e.defensa), exp: Math.round(170 * e.exp) };
}

/** Arma un bioma de los pisos nuevos a partir de datos compactos. */
function zona(piso: number, z: DatosZona): Bioma {
  const conductas: readonly ConductaBase[] = ["caminante", "saltador", "volador", "torreta", "escudero"];
  const nombres = Object.fromEntries(conductas.map((c, i) => [c, z.nombres[i]])) as Record<ConductaBase, string>;
  const colores = Object.fromEntries(conductas.map((c, i) => [c, z.colores[i]])) as Record<ConductaBase, readonly [string, string]>;
  const s = statsJefe(piso);
  return {
    nombre: z.nombre, lema: z.lema, cielo: z.cielo, roca: z.roca[0], rocaClaro: z.roca[1], rocaOscuro: z.roca[2],
    plataforma: z.plataforma, acento: z.acento, niebla: z.niebla, oscuridad: z.oscuridad, particula: z.particula, fondo: z.fondo,
    tinte: z.tinte, nombres, colores, sprites: z.sprites,
    jefe: {
      id: "configurable", nombre: z.jefe.nombre, titulo: z.jefe.titulo, ...s, w: 40, h: 46, forma: z.jefe.forma,
      ...(z.jefe.vuela === true ? { vuela: true } : {}), patrones: z.jefe.patrones, patronesFase2: z.jefe.fase2, colores: z.jefe.colores,
    },
  };
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
  // ======================= Pisos 10 a 23: el Pozo Profundo =======================
  zona(10, {
    nombre: "Pantano de los Ahogados", lema: "El agua no se llevó a nadie. Los guarda.",
    cielo: ["#06110a", "#14281a"], roca: ["#2f3f2a", "#4f6a3f", "#141f12"], plataforma: "#7a9a5a", acento: "#c4ff7a",
    niebla: "rgba(150,220,120,0.07)", oscuridad: 0.6, particula: "luciernagas", fondo: "raicesGigantes", tinte: ["#3a6a2a", 0.45],
    nombres: ["Ahogado", "Sapo Gigante", "Mosca de Ciénaga", "Bulbo Escupidor", "Guardián de Turba"],
    colores: [["#5a7a4a", "#c4ff7a"], ["#4a6a3a", "#ffe08a"], ["#9aff5a", "#ffffff"], ["#6a4a3a", "#c4ff7a"], ["#3a4a2a", "#e0ff9a"]],
    sprites: { caminante: "oldman", saltador: "lizard", escudero: "troll", torreta: "wizard" },
    jefe: { nombre: "Reina de la Ciénaga", titulo: "La que Ahoga los Nombres", forma: "flor", patrones: ["raices", "lluvia", "invocar", "minas"], fase2: ["radial", "rafaga"], colores: ["#2a3a1a", "#c4ff7a", "#ffe08a"] },
  }),
  zona(11, {
    nombre: "Cascadas del Olvido", lema: "Cada gota cae con un recuerdo. Ninguna lo devuelve.",
    cielo: ["#04101c", "#0c2a40"], roca: ["#2a3a4e", "#4a6a8a", "#121c28"], plataforma: "#8ab8e0", acento: "#7fe3ff",
    niebla: "rgba(120,200,255,0.08)", oscuridad: 0.5, particula: "lluvia", fondo: "cascadas", tinte: ["#2a5a8a", 0.4],
    nombres: ["Náufrago", "Salmón Hueco", "Gaviota Pálida", "Ojo de Torrente", "Muralla de Agua"],
    colores: [["#6a8aaa", "#7fe3ff"], ["#8ab8e0", "#ffffff"], ["#e0f0ff", "#7fe3ff"], ["#3a5a7a", "#bff3ff"], ["#2a4a6a", "#7fe3ff"]],
    sprites: { caminante: "monk", saltador: "rhino", escudero: "knight_blue", torreta: "wizard" },
    jefe: { nombre: "Leviatán del Olvido", titulo: "El que Bebe Recuerdos", forma: "bestia", patrones: ["carga", "lluvia", "rafaga", "salto"], fase2: ["laser", "radial"], colores: ["#1a3a5a", "#7fe3ff", "#ffffff"] },
  }),
  zona(12, {
    nombre: "Colmena Carmesí", lema: "Zumba. Siempre zumba. Hasta en tus sueños.",
    cielo: ["#140804", "#2e140a"], roca: ["#5a2a14", "#8a4a24", "#2a1208"], plataforma: "#e0a040", acento: "#ffb23d",
    niebla: "rgba(255,160,60,0.07)", oscuridad: 0.5, particula: "chispas", fondo: "colmena", tinte: ["#8a4a14", 0.42],
    nombres: ["Obrera de Cera", "Larva Saltarina", "Avispón Rojo", "Panal Escupidor", "Zángano Acorazado"],
    colores: [["#c87a2a", "#ffe08a"], ["#e0c08a", "#ff5a5a"], ["#ff4d2d", "#ffe84a"], ["#8a4a14", "#ffb23d"], ["#5a3a14", "#ffb23d"]],
    sprites: { caminante: "dwarf", saltador: "lizard", escudero: "guard", torreta: "wizard" },
    jefe: { nombre: "Reina Colmena", titulo: "Madre de Mil Aguijones", forma: "reina", vuela: true, patrones: ["invocar", "rafaga", "lluvia", "carga"], fase2: ["minas", "radial"], colores: ["#5a2a0a", "#ffb23d", "#ff4d2d"] },
  }),
  zona(13, {
    nombre: "Desierto Sepultado", lema: "Un desierto entero cayó al Pozo. La arena todavía busca el sol.",
    cielo: ["#1a1208", "#3a2a14"], roca: ["#6a5030", "#a08050", "#3a2a14"], plataforma: "#e0c48a", acento: "#ffe08a",
    niebla: "rgba(240,200,120,0.08)", oscuridad: 0.42, particula: "arena", fondo: "ruinas", tinte: ["#a07a3a", 0.4],
    nombres: ["Momia de Arena", "Escarabajo Sagrado", "Buitre Hueso", "Obelisco Maldito", "Guardián Faraón"],
    colores: [["#c8b08a", "#ffe08a"], ["#3a8a8a", "#ffe08a"], ["#a08060", "#ff7a3d"], ["#8a7050", "#7fe3ff"], ["#c8a040", "#3a8a8a"]],
    sprites: { caminante: "monk", saltador: "rhino", escudero: "knight_yellow", torreta: "wizard" },
    jefe: { nombre: "Faraón sin Tumba", titulo: "El que Exige el Sol", forma: "mascara", patrones: ["teleport", "laser", "invocar", "lluvia"], fase2: ["radial", "rayo"], colores: ["#3a2a0a", "#ffe08a", "#3a8a8a"] },
  }),
  zona(14, {
    nombre: "Fragua de Obsidiana", lema: "Aquí se forjó el primer filo. Todavía corta.",
    cielo: ["#0a0404", "#1e0806"], roca: ["#1e1418", "#3a2a30", "#0a0608"], plataforma: "#ff7a3d", acento: "#ff4d2d",
    niebla: "rgba(255,80,40,0.08)", oscuridad: 0.62, particula: "brasas", fondo: "obsidiana", tinte: ["#6a1a0a", 0.45],
    nombres: ["Hoja Viva", "Magma Saltarín", "Ceniza Alada", "Volcán Menor", "Coloso de Vidrio"],
    colores: [["#2a2028", "#ff4d2d"], ["#ff7a3d", "#ffe08a"], ["#5a4a4a", "#ff7a3d"], ["#3a2028", "#ff4d2d"], ["#1e1418", "#ff9a4d"]],
    sprites: { caminante: "knight_red", saltador: "rhino", escudero: "guard", torreta: "wizard" },
    jefe: { nombre: "Primer Herrero", titulo: "El que Forjó el Filo", forma: "golem", patrones: ["carga", "minas", "salto", "lluvia"], fase2: ["radial", "rafaga", "laser"], colores: ["#1e1418", "#ff4d2d", "#ffe08a"] },
  }),
  zona(15, {
    nombre: "Bosque Otoñal Hueco", lema: "Siempre es otoño. Las hojas no terminan de caer.",
    cielo: ["#140a04", "#2e1a0a"], roca: ["#4a3020", "#7a5030", "#22140a"], plataforma: "#c87a3a", acento: "#e8b23a",
    niebla: "rgba(232,178,58,0.06)", oscuridad: 0.5, particula: "hojas", fondo: "raicesGigantes", tinte: ["#8a4a1a", 0.42],
    nombres: ["Espantapájaros", "Ardilla Hueca", "Cuervo Otoñal", "Calabaza Ígnea", "Ent Podrido"],
    colores: [["#8a6a3a", "#e8b23a"], ["#a05a2a", "#ffe08a"], ["#2a1e1a", "#e8b23a"], ["#e87a2a", "#ffe08a"], ["#4a3020", "#c4ff7a"]],
    sprites: { caminante: "oldman", saltador: "mooseman", escudero: "troll", torreta: "wizard" },
    jefe: { nombre: "Señor del Último Otoño", titulo: "El que Deshoja Almas", forma: "flor", patrones: ["raices", "rafaga", "lluvia", "teleport"], fase2: ["radial", "invocar"], colores: ["#3a1e0a", "#e8b23a", "#c87a3a"] },
  }),
  zona(16, {
    nombre: "Templo Sumergido", lema: "Rezaban al agua. El agua contestó.",
    cielo: ["#021014", "#062a30"], roca: ["#1a3a3e", "#2f6a6e", "#0a1c1e"], plataforma: "#5fd0c0", acento: "#5fffd0",
    niebla: "rgba(80,255,210,0.07)", oscuridad: 0.58, particula: "burbujas", fondo: "arcos", tinte: ["#1a6a6a", 0.45],
    nombres: ["Sacerdote Ahogado", "Medusa Saltarina", "Raya Espectral", "Ídolo de Coral", "Templario Marino"],
    colores: [["#2f6a6e", "#5fffd0"], ["#9fe8ff", "#ff8aff"], ["#5fd0c0", "#ffffff"], ["#c87a6a", "#5fffd0"], ["#1a3a3e", "#5fffd0"]],
    sprites: { caminante: "monk", saltador: "lizard", escudero: "knight_green", torreta: "wizard" },
    jefe: { nombre: "Oráculo Abisal", titulo: "La Voz Bajo el Agua", forma: "espectro", vuela: true, patrones: ["teleport", "rayo", "radial", "lluvia"], fase2: ["laser", "invocar"], colores: ["#0a2a2e", "#5fffd0", "#ff8aff"] },
  }),
  zona(17, {
    nombre: "Mina de Cristal Negro", lema: "Excavaron buscando oro. Encontraron algo que miraba.",
    cielo: ["#06040c", "#140c22"], roca: ["#1e1830", "#3a2e5a", "#0a0814"], plataforma: "#a07cff", acento: "#c9a7ff",
    niebla: "rgba(160,124,255,0.07)", oscuridad: 0.66, particula: "chispas", fondo: "cristales", tinte: ["#3a1a6a", 0.45],
    nombres: ["Minero Hueco", "Geoda Viva", "Murciélago de Cuarzo", "Lámpara Maldita", "Gólem de Veta"],
    colores: [["#5a4a6a", "#ffe08a"], ["#3a2e5a", "#c9a7ff"], ["#c9a7ff", "#ffffff"], ["#5a4a2a", "#ffe08a"], ["#2a2440", "#c9a7ff"]],
    sprites: { caminante: "dwarf", saltador: "rhino", escudero: "guard", torreta: "wizard" },
    jefe: { nombre: "Corazón de Veta", titulo: "Lo que Miraba desde la Roca", forma: "golem", patrones: ["minas", "rayo", "salto", "radial"], fase2: ["laser", "carga"], colores: ["#1e1830", "#c9a7ff", "#ffffff"] },
  }),
  zona(18, {
    nombre: "Osario de Gigantes", lema: "Antes del Pozo, aquí caminaban gigantes. Ahora caminan sus huesos.",
    cielo: ["#100c10", "#241c24"], roca: ["#5a5048", "#8a7e6a", "#2a2420"], plataforma: "#d9d0bd", acento: "#ffe9a8",
    niebla: "rgba(255,233,168,0.06)", oscuridad: 0.55, particula: "ceniza", fondo: "tumbas", tinte: ["#5a4a3a", 0.4],
    nombres: ["Costilla Andante", "Cráneo Colosal", "Buitre de Médula", "Mandíbula Torre", "Fémur Guardián"],
    colores: [["#e8e0cc", "#ff5a5a"], ["#d9d0bd", "#ffe08a"], ["#8a7e6a", "#ff5a5a"], ["#cfc6b0", "#ff8a3d"], ["#b8ae98", "#ffe9a8"]],
    sprites: { caminante: "barbarian", saltador: "rhino", escudero: "knight_yellow", torreta: "wizard" },
    jefe: { nombre: "Gigante Sin Nombre", titulo: "El Último que Caminó Arriba", forma: "golem", patrones: ["salto", "carga", "lluvia", "minas"], fase2: ["radial", "rafaga"], colores: ["#5a5048", "#ffe9a8", "#ff5a5a"] },
  }),
  zona(19, {
    nombre: "Jardín de Esporas Gris", lema: "Las flores aprendieron a respirar por ti.",
    cielo: ["#0c0a10", "#1e1a26"], roca: ["#3a3644", "#5e586e", "#1a1820"], plataforma: "#a8a0c0", acento: "#d8c8ff",
    niebla: "rgba(200,190,255,0.09)", oscuridad: 0.6, particula: "esporas", fondo: "hongos", tinte: ["#5a5070", 0.45],
    nombres: ["Infectado Gris", "Seta Saltarina", "Polilla de Ceniza", "Hongo Mortaja", "Portador Fúngico"],
    colores: [["#8a8098", "#d8c8ff"], ["#a8a0c0", "#ff8aff"], ["#d8c8ff", "#ffffff"], ["#5e586e", "#9aff5a"], ["#3a3644", "#d8c8ff"]],
    sprites: { caminante: "oldman", saltador: "mooseman", escudero: "troll", torreta: "wizard" },
    jefe: { nombre: "Matriarca Gris", titulo: "La que Respira por Todos", forma: "flor", patrones: ["minas", "raices", "invocar", "radial"], fase2: ["lluvia", "teleport"], colores: ["#2a2632", "#d8c8ff", "#9aff5a"] },
  }),
  zona(20, {
    nombre: "Torre del Reloj Caído", lema: "Marca la hora en que todo cayó. Una y otra vez.",
    cielo: ["#0e0a04", "#24180a"], roca: ["#4a3a20", "#7a6030", "#22180a"], plataforma: "#e0b050", acento: "#ffd27a",
    niebla: "rgba(255,210,122,0.06)", oscuridad: 0.5, particula: "polvo", fondo: "engranajes", tinte: ["#7a5a1a", 0.4],
    nombres: ["Relojero Roto", "Péndulo Saltarín", "Manecilla Voladora", "Cucú Infernal", "Autómata de Bronce"],
    colores: [["#8a6a3a", "#ffd27a"], ["#c8a040", "#ffffff"], ["#e0b050", "#ff5a5a"], ["#6a4a2a", "#ffd27a"], ["#5a4a2a", "#ffd27a"]],
    sprites: { caminante: "dwarf", saltador: "rhino", escudero: "knight_yellow", torreta: "wizard" },
    jefe: { nombre: "El Gran Engranaje", titulo: "El que Detiene el Tiempo", forma: "mascara", patrones: ["rafaga", "laser", "minas", "teleport"], fase2: ["radial", "lluvia", "carga"], colores: ["#3a2a0a", "#ffd27a", "#ffffff"] },
  }),
  zona(21, {
    nombre: "Tormenta Eterna", lema: "Llueve desde que el mundo es mundo. Hacia abajo, siempre.",
    cielo: ["#04060e", "#0e1428"], roca: ["#1e2638", "#34446a", "#0a0e1a"], plataforma: "#7a9ac8", acento: "#ffe84a",
    niebla: "rgba(160,190,255,0.08)", oscuridad: 0.64, particula: "lluvia", fondo: "cascadas", tinte: ["#1a2a5a", 0.45],
    nombres: ["Heraldo del Trueno", "Rayo Saltarín", "Nube Viva", "Pararrayos Maldito", "Titán de Tormenta"],
    colores: [["#34446a", "#ffe84a"], ["#ffe84a", "#ffffff"], ["#7a9ac8", "#ffe84a"], ["#1e2638", "#9fe8ff"], ["#2a3450", "#ffe84a"]],
    sprites: { caminante: "knight_blue", saltador: "lizard", escudero: "guard", torreta: "wizard" },
    jefe: { nombre: "Ojo de la Tormenta", titulo: "La Lluvia que Piensa", forma: "espectro", vuela: true, patrones: ["rayo", "rafaga", "teleport", "lluvia"], fase2: ["laser", "radial", "minas"], colores: ["#0e1428", "#ffe84a", "#9fe8ff"] },
  }),
  zona(22, {
    nombre: "Abismo de Cristal Vivo", lema: "El cristal crece hacia ti. Siempre hacia ti.",
    cielo: ["#100414", "#280a30"], roca: ["#3a1a40", "#6a3a7a", "#1a0a20"], plataforma: "#ff8aff", acento: "#7fe3ff",
    niebla: "rgba(255,138,255,0.08)", oscuridad: 0.58, particula: "estrellas", fondo: "colmena", tinte: ["#6a1a7a", 0.45],
    nombres: ["Prisma Andante", "Esquirla Saltarina", "Mariposa de Vidrio", "Faro Cristalino", "Caballero Facetado"],
    colores: [["#ff8aff", "#7fe3ff"], ["#7fe3ff", "#ffffff"], ["#ffffff", "#ff8aff"], ["#6a3a7a", "#7fe3ff"], ["#3a1a40", "#ff8aff"]],
    sprites: { caminante: "knight_green", saltador: "lizard", escudero: "guard", torreta: "wizard" },
    jefe: { nombre: "Emperatriz Facetada", titulo: "La que se Refleja en Ti", forma: "reina", vuela: true, patrones: ["laser", "radial", "teleport", "minas"], fase2: ["rafaga", "rayo", "invocar"], colores: ["#280a30", "#ff8aff", "#7fe3ff"] },
  }),
  zona(23, {
    nombre: "Umbral del Recuerdo", lema: "Un paso más y el Pozo te recordará para siempre.",
    cielo: ["#0a0208", "#1e0618"], roca: ["#2a0e24", "#4e1e44", "#120610"], plataforma: "#c83a8a", acento: "#ff6ad5",
    niebla: "rgba(255,106,213,0.08)", oscuridad: 0.66, particula: "sangre", fondo: "vacio", tinte: ["#6a0e4a", 0.45],
    nombres: ["Eco Perdido", "Latido Errante", "Lágrima Negra", "Ojo del Umbral", "Centinela del Fin"],
    colores: [["#4e1e44", "#ff6ad5"], ["#c83a8a", "#ffe08a"], ["#ff6ad5", "#ffffff"], ["#2a0e24", "#ff6ad5"], ["#3a1030", "#ff6ad5"]],
    sprites: { caminante: "barbarian", saltador: "rhino", escudero: "knight_red", torreta: "wizard" },
    jefe: { nombre: "Guardián del Umbral", titulo: "El Último Olvido", forma: "mascara", patrones: ["tecnica", "teleport", "laser", "invocar"], fase2: ["radial", "rafaga", "rayo", "minas"], colores: ["#1e0618", "#ff6ad5", "#ffffff"] },
  }),
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
    jefe: { id: "recuerda", nombre: "El Que Recuerda", titulo: "Corazón del Pozo", hp: 52000, ataque: 190, defensa: 80, exp: 9000, w: 40, h: 48 },
  },
];

export const PISOS_TOTALES = BIOMAS.length;

export function bioma(piso: number): Bioma {
  return BIOMAS[Math.max(0, Math.min(piso - 1, BIOMAS.length - 1))];
}

/**
 * Escala de los monstruos por piso. Hasta el 10 es la curva original; del 11 al 24 sigue subiendo más suave en
 * vida (cuadrática atenuada) para que el Pozo Profundo sea duro pero no imposible con equipo del piso.
 */
export function escalaEnemigo(piso: number): { hp: number; ataque: number; defensa: number; exp: number } {
  const p = Math.max(0, piso - 1);
  const profundo = Math.max(0, piso - 10);
  return {
    hp: 1 + 0.75 * p + 0.06 * Math.min(p, 9) ** 2 + 0.9 * profundo + 0.025 * profundo * profundo,
    ataque: 1 + 0.5 * p,
    defensa: 1 + 0.45 * p,
    exp: 1 + 0.8 * p,
  };
}

/** Salas por piso (1 a 24): más grandes cuanto más hondo; el último es un tramo corto hasta el Corazón. */
export const SALAS_POR_PISO: readonly number[] = [
  9, 10, 10, 11, 11, 12, 12, 12, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 12,
];
