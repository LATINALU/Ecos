// GRIMORIO DE ALMAS — el rework de las Cartas de Alma.
//
// El Portador lleva un MAZO DE 5 RANURAS. Cada carta, según la ranura donde la pongas, hace algo distinto:
//   0 · Forma          → define tu aspecto y una PASIVA DE ATAQUES BÁSICOS (tus golpes queman, aturden, curan...).
//   1 · Habilidad I    → una habilidad activa (tecla L) + una pasiva.
//   2 · Habilidad II   → otra habilidad activa (tecla U) + otra pasiva.
//   3 · Habilidad III  → otra habilidad activa (tecla O) + otra pasiva.
//   4 · Definitiva     → la habilidad DEFINITIVA (tecla P, se carga peleando) + otra pasiva.
// 12 almas × (5 pasivas + 4 habilidades) = 108 efectos distintos. Todo escala con el nivel de la carta
// (estrellas, mejoras con Polvo de Eco y si es brillante): ver `escalaCarta`.
//
// Las habilidades se arman con "formas" (primitivas) que el motor sabe ejecutar (juego/habilidades.ts);
// cambian el daño, la cantidad, el elemento, el color y los efectos.

export type RanuraAlma = 0 | 1 | 2 | 3 | 4;
export const RANURAS_ALMA: readonly RanuraAlma[] = [0, 1, 2, 3, 4];
export const NOMBRE_RANURA_ALMA = ["Forma", "Habilidad I", "Habilidad II", "Habilidad III", "Definitiva"] as const;
export const TECLA_RANURA_ALMA = ["", "L", "U", "O", "P"] as const;

/** Efectos numéricos de una pasiva (a 1★; se multiplican por la escala de la carta). */
export interface EfectosPasiva {
  readonly critico?: number;
  readonly critDanio?: number;
  readonly velocidad?: number;
  readonly agilidad?: number;
  readonly robo?: number;
  /** Reducción del daño recibido. */
  readonly recibido?: number;
  readonly esquiva?: number;
  readonly hpPct?: number;
  readonly defensaPct?: number;
  readonly tecnicaDanio?: number;
  readonly tecnicaCosto?: number;
  /** Reducción de enfriamientos de habilidades. */
  readonly enfriamiento?: number;
  /** Carga extra de la Definitiva. */
  readonly carga?: number;
  readonly eterGolpe?: number;
  readonly regen?: number;
  /** Daño infligido extra. */
  readonly danio?: number;
  /** Fracción del daño recibido que se devuelve. */
  readonly espinas?: number;
  // ---- Solo ataques básicos (la ranura Forma): probabilidad o fracción por golpe.
  readonly golpeQuema?: number;
  readonly golpeHielo?: number;
  readonly golpeVeneno?: number;
  readonly golpeRayo?: number;
  readonly golpeAturde?: number;
  readonly golpeCura?: number;
  readonly golpeExtra?: number;
  readonly golpeCritico?: number;
}

export type ClaveEfecto = keyof EfectosPasiva;

export interface DefPasivaAlma {
  readonly nombre: string;
  readonly efectos: EfectosPasiva;
}

export type FormaHabilidad =
  | "proyectil" | "embestida" | "onda" | "rayo" | "orbita" | "nova" | "lluvia" | "garras" | "aura" | "boomerang" | "salto";

export type EfectoHabilidad = "quema" | "hielo" | "veneno" | "aturde" | "ralentiza" | "cura" | "lanzar";

export type VisualProyectil = "orbe" | "lanza" | "daga" | "hacha" | "hoja" | "flecha" | "llama" | "sombra" | "rayo" | "hueso" | "agua";

export interface DefHabilidad {
  readonly nombre: string;
  readonly descripcion: string;
  readonly forma: FormaHabilidad;
  /** Multiplicador sobre el stat Técnica por impacto. */
  readonly mult: number;
  /** Éter (las Definitivas no usan éter: usan la carga). */
  readonly costo: number;
  /** Enfriamiento en segundos. */
  readonly cd: number;
  readonly color: string;
  readonly efectos?: readonly EfectoHabilidad[];
  /** Cantidad de proyectiles, golpes, rayos u hojas. */
  readonly cantidad?: number;
  readonly visual?: VisualProyectil;
  readonly velocidad?: number;
  /** Radio (nova, orbita, explosión) o alcance. */
  readonly radio?: number;
  /** Duración (órbita, aura). */
  readonly duracion?: number;
  readonly atraviesa?: boolean;
  /** Apertura del abanico en radianes (proyectiles múltiples). */
  readonly abanico?: number;
  /** Auras: potenciadores temporales. */
  readonly buff?: { readonly danio?: number; readonly escudo?: number; readonly robo?: number; readonly velocidad?: number };
}

export interface GrimorioAlma {
  /** Pasiva de cada ranura (0 = de ataques básicos). */
  readonly pasivas: readonly [DefPasivaAlma, DefPasivaAlma, DefPasivaAlma, DefPasivaAlma, DefPasivaAlma];
  /** Habilidad de cada ranura activa: [Habilidad I, II, III, Definitiva]. */
  readonly habilidades: readonly [DefHabilidad, DefHabilidad, DefHabilidad, DefHabilidad];
}

const p = (nombre: string, efectos: EfectosPasiva): DefPasivaAlma => ({ nombre, efectos });

/** Definitivas: sin éter, enfriamiento corto (el límite real es la carga). */
const def = (h: Omit<DefHabilidad, "costo" | "cd">): DefHabilidad => ({ ...h, costo: 0, cd: 1 });

export const GRIMORIO: readonly GrimorioAlma[] = [
  // 0 · Tormo, el Muro
  {
    pasivas: [
      p("Puño de Roca", { golpeAturde: 0.15, defensaPct: 0.05 }),
      p("Piel de Piedra", { hpPct: 0.1 }),
      p("Muralla", { defensaPct: 0.14 }),
      p("Inamovible", { recibido: 0.07 }),
      p("Puerta Cerrada", { espinas: 0.2, recibido: 0.04 }),
    ],
    habilidades: [
      { nombre: "Sacudida", descripcion: "Golpea el suelo: dos ondas que aturden.", forma: "onda", mult: 1.4, costo: 14, cd: 3, color: "#e0c48a", efectos: ["aturde"] },
      { nombre: "Embestida de Piedra", descripcion: "Carga invulnerable que arrolla todo.", forma: "embestida", mult: 1.3, costo: 12, cd: 3.5, color: "#c9a76a", efectos: ["lanzar"] },
      { nombre: "Baluarte", descripcion: "−40 % de daño recibido durante 5 s y un empujón a tu alrededor.", forma: "aura", mult: 0.8, costo: 16, cd: 12, color: "#e0c48a", radio: 36, duracion: 5, buff: { escudo: 0.4 } },
      def({ nombre: "Cataclismo", descripcion: "Cae una lluvia de rocas que aturde todo lo que pisa el suelo.", forma: "lluvia", mult: 1.7, color: "#c9a76a", cantidad: 12, visual: "hueso", radio: 150, efectos: ["aturde"] }),
    ],
  },
  // 1 · Sira, Filo Errante
  {
    pasivas: [
      p("Filo Errante", { golpeCritico: 10, golpeExtra: 0.06 }),
      p("Ojo de Duelo", { critico: 6 }),
      p("Corte Profundo", { critDanio: 0.25 }),
      p("Pies Ligeros", { velocidad: 0.08 }),
      p("Juramento", { danio: 0.06, critico: 3 }),
    ],
    habilidades: [
      { nombre: "Tajo Fantasma", descripcion: "Atraviesas a los enemigos cortando todo a tu paso, invulnerable.", forma: "embestida", mult: 1.35, costo: 14, cd: 2.5, color: "#ff5a6a" },
      { nombre: "Abanico de Acero", descripcion: "Lanzas un abanico de dagas.", forma: "proyectil", mult: 0.75, costo: 12, cd: 2.5, color: "#e8e8f0", cantidad: 3, visual: "daga", velocidad: 420, abanico: 0.3 },
      { nombre: "Filo Ascendente", descripcion: "Tres cortes que levantan a los enemigos.", forma: "garras", mult: 0.7, costo: 13, cd: 3, color: "#ff8a9a", cantidad: 3, efectos: ["lanzar"] },
      def({ nombre: "Mil Cortes", descripcion: "Una tormenta de cortes delante de ti, invulnerable.", forma: "garras", mult: 0.85, color: "#ff5a6a", cantidad: 10 }),
    ],
  },
  // 2 · Kage, el que No Estuvo
  {
    pasivas: [
      p("Hoja Envenenada", { golpeVeneno: 0.22 }),
      p("Nadie Me Ve", { esquiva: 0.05 }),
      p("Golpe Oculto", { critico: 5, critDanio: 0.1 }),
      p("Hambre de Sombra", { robo: 0.025 }),
      p("Sin Rostro", { carga: 0.2, esquiva: 0.02 }),
    ],
    habilidades: [
      { nombre: "Paso Sombrío", descripcion: "Te deslizas entre las sombras aturdiendo a quien cruzas.", forma: "embestida", mult: 1.15, costo: 12, cd: 2.5, color: "#b48cff", efectos: ["aturde"] },
      { nombre: "Dagas de Sombra", descripcion: "Dos dagas que atraviesan y envenenan.", forma: "proyectil", mult: 0.9, costo: 12, cd: 2.5, color: "#7d6bff", cantidad: 2, visual: "sombra", velocidad: 380, abanico: 0.12, atraviesa: true, efectos: ["veneno"] },
      { nombre: "Marca Sombría", descripcion: "La sombra cae sobre el enemigo más cercano y lo envenena.", forma: "rayo", mult: 2.0, costo: 15, cd: 4, color: "#b48cff", cantidad: 1, efectos: ["veneno"] },
      def({ nombre: "Eclipse", descripcion: "Apagas la luz: un estallido enorme de sombra que ralentiza.", forma: "nova", mult: 4.2, color: "#7d6bff", radio: 130, efectos: ["ralentiza", "veneno"] }),
    ],
  },
  // 3 · Velo, Viuda de Humo
  {
    pasivas: [
      p("Ceniza Viva", { golpeQuema: 0.25 }),
      p("Cuerpo de Humo", { esquiva: 0.06 }),
      p("Llama Interior", { tecnicaDanio: 0.12 }),
      p("Respiración Lenta", { tecnicaCosto: 0.1 }),
      p("Viudez", { carga: 0.2, tecnicaDanio: 0.05 }),
    ],
    habilidades: [
      { nombre: "Orbe Ígneo", descripcion: "Una esfera de fuego que estalla al impactar.", forma: "proyectil", mult: 1.6, costo: 12, cd: 2, color: "#ff7a3d", visual: "orbe", velocidad: 240, radio: 30, efectos: ["quema"] },
      { nombre: "Cortina de Humo", descripcion: "Humo a tu alrededor: ralentiza y −25 % de daño recibido 4 s.", forma: "aura", mult: 0.6, costo: 14, cd: 10, color: "#7d6bff", radio: 48, duracion: 4, buff: { escudo: 0.25 }, efectos: ["ralentiza"] },
      { nombre: "Llamarada", descripcion: "Un abanico de cinco llamas cortas.", forma: "proyectil", mult: 0.65, costo: 14, cd: 3, color: "#ffb23d", cantidad: 5, visual: "llama", velocidad: 260, abanico: 0.7, efectos: ["quema"] },
      def({ nombre: "Infierno de Humo", descripcion: "Llueven bolas de fuego sobre todo lo que ves.", forma: "lluvia", mult: 1.5, color: "#ff7a3d", cantidad: 16, visual: "orbe", radio: 170, efectos: ["quema"] }),
    ],
  },
  // 4 · Brasa, Hija del Horno
  {
    pasivas: [
      p("Golpe de Fragua", { golpeQuema: 0.45 }),
      p("Corazón de Horno", { tecnicaDanio: 0.2 }),
      p("Fuelle", { eterGolpe: 1 }),
      p("Temple", { danio: 0.06 }),
      p("Forja Rápida", { enfriamiento: 0.12 }),
    ],
    habilidades: [
      { nombre: "Orbe Colosal", descripcion: "Un orbe lento y enorme que estalla en un radio amplio.", forma: "proyectil", mult: 1.9, costo: 16, cd: 3, color: "#ff7a3d", visual: "orbe", velocidad: 160, radio: 46, efectos: ["quema"] },
      { nombre: "Río de Lava", descripcion: "Ondas de fuego recorren el suelo hacia ambos lados.", forma: "onda", mult: 1.3, costo: 15, cd: 3.5, color: "#ff4d2d", efectos: ["quema"] },
      { nombre: "Volcán", descripcion: "Seis rocas ardientes caen delante de ti.", forma: "lluvia", mult: 1.0, costo: 17, cd: 5, color: "#ffb23d", cantidad: 6, visual: "llama", radio: 90, efectos: ["quema"] },
      def({ nombre: "Sol Caído", descripcion: "Lanzas un sol en miniatura que lo arrasa todo al estallar.", forma: "proyectil", mult: 6.5, color: "#ffd27a", visual: "orbe", velocidad: 150, radio: 95, efectos: ["quema"] }),
    ],
  },
  // 5 · Nix, Invierno Callado
  {
    pasivas: [
      p("Toque Gélido", { golpeHielo: 0.35 }),
      p("Aliento Frío", { recibido: 0.06 }),
      p("Calma Glacial", { tecnicaCosto: 0.12 }),
      p("Río Quieto", { regen: 4 }),
      p("Hielo Eterno", { defensaPct: 0.08, enfriamiento: 0.06 }),
    ],
    habilidades: [
      { nombre: "Lanza Glacial", descripcion: "Una lanza de hielo que atraviesa y congela.", forma: "proyectil", mult: 1.35, costo: 13, cd: 2, color: "#bff3ff", visual: "lanza", velocidad: 340, atraviesa: true, efectos: ["hielo"] },
      { nombre: "Nova de Escarcha", descripcion: "Un estallido de frío a tu alrededor.", forma: "nova", mult: 1.2, costo: 15, cd: 4, color: "#7fe3ff", radio: 52, efectos: ["hielo", "hielo"] },
      { nombre: "Carámbanos", descripcion: "Cinco carámbanos caen delante de ti.", forma: "lluvia", mult: 1.0, costo: 15, cd: 4, color: "#bff3ff", cantidad: 5, visual: "lanza", radio: 80, efectos: ["hielo"] },
      def({ nombre: "Invierno Absoluto", descripcion: "Todo lo que ves queda congelado.", forma: "nova", mult: 3.2, color: "#bff3ff", radio: 170, efectos: ["hielo", "hielo", "hielo", "hielo"] }),
    ],
  },
  // 6 · Ulva, Hambre de Luna
  {
    pasivas: [
      p("Colmillos", { golpeCura: 0.012 }),
      p("Voracidad", { robo: 0.03 }),
      p("Sangre de Luna", { hpPct: 0.08 }),
      p("Instinto", { velocidad: 0.06, critico: 2 }),
      p("Manada", { agilidad: 0.08, danio: 0.04 }),
    ],
    habilidades: [
      { nombre: "Zarpazo Voraz", descripcion: "Tres garras rápidas; cada impacto te cura.", forma: "garras", mult: 0.75, costo: 13, cd: 2.5, color: "#ffe08a", cantidad: 3, efectos: ["cura"] },
      { nombre: "Salto Lunar", descripcion: "Saltas y caes con ondas a ambos lados.", forma: "salto", mult: 1.4, costo: 14, cd: 3.5, color: "#ffe08a", efectos: ["aturde"] },
      { nombre: "Aullido", descripcion: "+25 % de daño y robo de vida durante 6 s.", forma: "aura", mult: 0.4, costo: 14, cd: 14, color: "#ffe08a", radio: 30, duracion: 6, buff: { danio: 0.25, robo: 0.04 } },
      def({ nombre: "Cacería Lunar", descripcion: "Diez zarpazos salvajes que te curan.", forma: "garras", mult: 1.0, color: "#ffe08a", cantidad: 10, efectos: ["cura"] }),
    ],
  },
  // 7 · Grum, Raíz de Piedra
  {
    pasivas: [
      p("Raíz Firme", { golpeAturde: 0.12, defensaPct: 0.06 }),
      p("Corteza", { defensaPct: 0.12 }),
      p("Savia", { regen: 6 }),
      p("Tronco Viejo", { hpPct: 0.1 }),
      p("Bosque Dormido", { recibido: 0.08 }),
    ],
    habilidades: [
      { nombre: "Terremoto", descripcion: "Golpeas el suelo: dos ondas recorren el piso.", forma: "onda", mult: 1.45, costo: 16, cd: 3, color: "#c4ff7a" },
      { nombre: "Raíces Atrapadoras", descripcion: "Raíces brotan bajo los tres enemigos más cercanos y los aturden.", forma: "rayo", mult: 1.1, costo: 15, cd: 4, color: "#7dff9a", cantidad: 3, efectos: ["aturde"] },
      { nombre: "Piel de Corteza", descripcion: "−35 % de daño recibido 5 s; las espinas devuelven daño.", forma: "aura", mult: 0.7, costo: 15, cd: 12, color: "#c4ff7a", radio: 34, duracion: 5, buff: { escudo: 0.35 } },
      def({ nombre: "Bosque Despierto", descripcion: "Raíces gigantes bajo todos los enemigos de la sala.", forma: "rayo", mult: 2.4, color: "#7dff9a", cantidad: 10, efectos: ["aturde", "lanzar"] }),
    ],
  },
  // 8 · Iskra, Tormenta Viva
  {
    pasivas: [
      p("Chispa", { golpeRayo: 0.18 }),
      p("Chispa Letal", { critDanio: 0.3 }),
      p("Electricidad Estática", { carga: 0.25 }),
      p("Relámpago", { enfriamiento: 0.1 }),
      p("Ojo de la Tormenta", { critico: 5, tecnicaDanio: 0.06 }),
    ],
    habilidades: [
      { nombre: "Rayo del Abismo", descripcion: "Un rayo cae sobre el enemigo más cercano y lo aturde.", forma: "rayo", mult: 2.1, costo: 16, cd: 3, color: "#9fe8ff", cantidad: 1, efectos: ["aturde"] },
      { nombre: "Cadena Eléctrica", descripcion: "Rayos sobre los tres enemigos más cercanos.", forma: "rayo", mult: 1.1, costo: 15, cd: 3.5, color: "#ffe84a", cantidad: 3 },
      { nombre: "Bola de Plasma", descripcion: "Una esfera lenta que atraviesa todo y estalla.", forma: "proyectil", mult: 1.2, costo: 15, cd: 3, color: "#9fe8ff", visual: "rayo", velocidad: 170, atraviesa: true, radio: 34 },
      def({ nombre: "Tormenta Viva", descripcion: "Doce rayos caen sobre todos los enemigos.", forma: "rayo", mult: 1.7, color: "#ffe84a", cantidad: 12, efectos: ["aturde"] }),
    ],
  },
  // 9 · Morrigan, Cuervo de Ceniza
  {
    pasivas: [
      p("Plumas Afiladas", { golpeExtra: 0.1, velocidad: 0.05 }),
      p("Vendaval", { velocidad: 0.1 }),
      p("Alas", { agilidad: 0.1 }),
      p("Ceniza en el Viento", { esquiva: 0.04 }),
      p("Promesa Rota", { critico: 6 }),
    ],
    habilidades: [
      { nombre: "Plumas Orbitales", descripcion: "Tres plumas giran a tu alrededor 4 s cortando todo.", forma: "orbita", mult: 0.55, costo: 17, cd: 6, color: "#ff6a8a", cantidad: 3, visual: "hoja", radio: 24, duracion: 4 },
      { nombre: "Bandada", descripcion: "Cuatro cuervos que atraviesan a los enemigos.", forma: "proyectil", mult: 0.8, costo: 13, cd: 2.5, color: "#ff6a8a", cantidad: 4, visual: "hoja", velocidad: 330, abanico: 0.45, atraviesa: true },
      { nombre: "Picotazo", descripcion: "Una embestida corta que aturde.", forma: "embestida", mult: 1.0, costo: 10, cd: 2, color: "#ff6a8a", efectos: ["aturde"] },
      def({ nombre: "Tormenta de Plumas", descripcion: "Ocho plumas enormes giran a tu alrededor 6 s.", forma: "orbita", mult: 0.9, color: "#ff6a8a", cantidad: 8, visual: "hoja", radio: 40, duracion: 6 }),
    ],
  },
  // 10 · Bruno, Martillo de Raíz
  {
    pasivas: [
      p("Golpe de Martillo", { golpeAturde: 0.15, danio: 0.04 }),
      p("Espinas", { espinas: 0.25 }),
      p("Brotes", { hpPct: 0.1 }),
      p("Yunque Vivo", { defensaPct: 0.12 }),
      p("Martillo Paciente", { recibido: 0.06, carga: 0.1 }),
    ],
    habilidades: [
      { nombre: "Martillazo", descripcion: "Un golpe a tu alrededor que lanza por los aires.", forma: "nova", mult: 1.5, costo: 14, cd: 3, color: "#c4ff7a", radio: 40, efectos: ["lanzar", "aturde"] },
      { nombre: "Martillo Bumerán", descripcion: "Lanzas el martillo: vuelve a tu mano golpeando dos veces.", forma: "boomerang", mult: 1.2, costo: 13, cd: 3, color: "#c9a76a", visual: "hacha" },
      { nombre: "Remolino de Martillos", descripcion: "Dos martillos giran a tu alrededor 3 s.", forma: "orbita", mult: 0.8, costo: 16, cd: 6, color: "#c4ff7a", cantidad: 2, visual: "hacha", radio: 28, duracion: 3 },
      def({ nombre: "Juicio de Raíz", descripcion: "Saltas y caes con la fuerza del bosque entero.", forma: "salto", mult: 5, color: "#c4ff7a", radio: 120, efectos: ["aturde", "lanzar"] }),
    ],
  },
  // 11 · Fenra, Loba Blanca
  {
    pasivas: [
      p("Colmillo Blanco", { golpeHielo: 0.2, velocidad: 0.04 }),
      p("Patas de Nieve", { agilidad: 0.1 }),
      p("Mirada de Loba", { critico: 6 }),
      p("Aullido Largo", { velocidad: 0.08 }),
      p("Manada Fantasma", { esquiva: 0.05, carga: 0.1 }),
    ],
    habilidades: [
      { nombre: "Colmillo Helado", descripcion: "Una lanza de hielo veloz que congela.", forma: "proyectil", mult: 1.25, costo: 12, cd: 2, color: "#7fe3ff", visual: "lanza", velocidad: 460, efectos: ["hielo"] },
      { nombre: "Embestida Glacial", descripcion: "Te lanzas como una ventisca congelando a tu paso.", forma: "embestida", mult: 1.2, costo: 13, cd: 3, color: "#bff3ff", efectos: ["hielo"] },
      { nombre: "Aullido Blanco", descripcion: "Ralentiza a tu alrededor; +20 % de velocidad de ataque 6 s.", forma: "aura", mult: 0.5, costo: 14, cd: 12, color: "#c8c8d8", radio: 60, duracion: 6, buff: { velocidad: 0.2, danio: 0.1 }, efectos: ["ralentiza"] },
      def({ nombre: "Manada Fantasma", descripcion: "Seis lobos espectrales cruzan la sala congelando todo.", forma: "proyectil", mult: 2.2, color: "#bff3ff", cantidad: 6, visual: "sombra", velocidad: 300, abanico: 0.9, atraviesa: true, efectos: ["hielo", "hielo"] }),
    ],
  },
];

export function grimorio(personaje: number): GrimorioAlma {
  return GRIMORIO[personaje] ?? GRIMORIO[0];
}

/** Escala de poder de una carta: estrellas, mejoras y brillo. 1★ sin mejoras = 1. */
export function escalaCarta(c: { readonly nivel: number; readonly mejoras: number; readonly brillante?: boolean }): number {
  return 1 + c.nivel * 0.16 + c.mejoras * 0.05 + (c.brillante === true ? 0.1 : 0);
}

/** Proyectiles, rayos u hojas extra por estrellas (a 4★, 6★, 9★ y 12★). */
export function cantidadExtra(nivel: number): number {
  return (nivel >= 3 ? 1 : 0) + (nivel >= 5 ? 1 : 0) + (nivel >= 8 ? 1 : 0) + (nivel >= 11 ? 1 : 0);
}

/** Topes (las probabilidades no pasan del 60 %; algunas defensas tienen techo). */
const TOPES: Partial<Record<ClaveEfecto, number>> = {
  golpeQuema: 0.6, golpeHielo: 0.6, golpeVeneno: 0.6, golpeRayo: 0.6, golpeAturde: 0.6, golpeExtra: 0.5,
  esquiva: 0.3, recibido: 0.5, tecnicaCosto: 0.6, enfriamiento: 0.5,
};

export function topeEfecto(k: ClaveEfecto, v: number): number {
  const t = TOPES[k];
  return t === undefined ? v : Math.min(t, v);
}

const ETIQUETA: Readonly<Record<ClaveEfecto, readonly [string, "pct" | "pts" | "num"]>> = {
  critico: ["crítico", "pts"], critDanio: ["daño crítico", "pct"], velocidad: ["velocidad de ataque", "pct"],
  agilidad: ["velocidad de movimiento", "pct"], robo: ["robo de vida", "pct"], recibido: ["menos daño recibido", "pct"],
  esquiva: ["esquiva", "pct"], hpPct: ["vida máxima", "pct"], defensaPct: ["defensa", "pct"], tecnicaDanio: ["daño de habilidades", "pct"],
  tecnicaCosto: ["menos costo de éter", "pct"], enfriamiento: ["menos enfriamiento", "pct"], carga: ["carga de Definitiva", "pct"],
  eterGolpe: ["éter por golpe", "num"], regen: ["regeneración", "num"], danio: ["daño", "pct"], espinas: ["daño devuelto", "pct"],
  golpeQuema: ["prob. de quemar", "pct"], golpeHielo: ["prob. de congelar (frío)", "pct"], golpeVeneno: ["prob. de envenenar", "pct"],
  golpeRayo: ["prob. de rayo en cadena", "pct"], golpeAturde: ["prob. de aturdir", "pct"], golpeCura: ["vida máx. curada por golpe", "pct"],
  golpeExtra: ["prob. de golpe doble", "pct"], golpeCritico: ["crítico en golpes básicos", "pts"],
};

/** Texto de los efectos ya escalados ("+12 % crítico · +8 % vida máxima"). */
export function describirEfectos(e: EfectosPasiva, escala = 1): string {
  return (Object.entries(e) as [ClaveEfecto, number][])
    .map(([k, v]) => {
      const [nombre, tipo] = ETIQUETA[k];
      const x = topeEfecto(k, v * escala);
      const n = tipo === "pct" ? `${Math.round(x * 1000) / 10} %` : tipo === "pts" ? `${Math.round(x)} %` : `${Math.round(x)}`;
      return `+${n} ${nombre}`;
    })
    .join(" · ");
}
