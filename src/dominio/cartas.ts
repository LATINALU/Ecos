// Cartas de Alma sobre las mecánicas de minialu (cartas/cartas.ts): rareza por tabla, fusión 3→1 con
// probabilidad por estrella, mejora +1~+5 con tope, stats al azar dentro del rango de la estrella.
//
// Diferencias de diseño con MiniFighter:
//   - La carta equipada como FORMA aporta el 100 % de sus stats y su técnica especial.
//   - Dos RESONANCIAS aportan el 35 % (50 % si son de la misma familia que la forma: "sintonía").
//   - Si la fusión falla, la carta resultante se "reforja": misma estrella, stats nuevos. Nunca se pierde todo.
//   - Se fusionan tres cartas con la MISMA CANTIDAD DE ESTRELLAS, de cualquier alma o familia: sale una de las tres.

import {
  elegirUno, entero, fusionar, generarStats, mejorar, tirarRareza,
  type Azar, type Capa, type ErrorFusion, type Resultado, type TablaRareza,
} from "minialu";
import { ALMAS, ESCALA_ESTRELLA, alma } from "../contenido/almas.ts";
import { escalarCapa } from "./stats.ts";

export interface Carta {
  readonly uid: string;
  readonly tipo: number;
  readonly nivel: number;
  readonly personaje: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly mejoras: number;
  /** Rasgo al azar (solo actúa si la carta es tu Forma). */
  readonly rasgo?: IdRasgoCarta;
  /** Variante rara (3 %): +20 % a todos los stats y borde dorado. */
  readonly brillante?: boolean;
}

export type IdRasgoCarta = "afilada" | "veloz" | "eterna" | "furiosa" | "vampirica" | "colosal";

export const RASGOS_CARTA: Readonly<Record<IdRasgoCarta, { nombre: string; descripcion: string }>> = {
  afilada: { nombre: "Afilada", descripcion: "+8 % de crítico." },
  veloz: { nombre: "Veloz", descripcion: "+12 % de velocidad de ataque." },
  eterna: { nombre: "Eterna", descripcion: "La técnica cuesta un 25 % menos de éter." },
  furiosa: { nombre: "Furiosa", descripcion: "La técnica hace +20 % de daño." },
  vampirica: { nombre: "Vampírica", descripcion: "Te curas un 3 % del daño que haces." },
  colosal: { nombre: "Colosal", descripcion: "+15 % de vida máxima." },
};

const IDS_RASGO_CARTA = Object.keys(RASGOS_CARTA) as IdRasgoCarta[];
export const PROB_BRILLANTE = 0.03;

/** Probabilidad de tener rasgo: 25 % a 1★, +8 % por estrella. */
export function probRasgoCarta(nivel: number): number {
  return Math.min(0.85, 0.25 + nivel * 0.08);
}

export const NIVEL_MAX_CARTA = ESCALA_ESTRELLA.length - 1;
/** Probabilidad de subir de estrella al fusionar, por nivel de las cartas de entrada. */
export const PROB_FUSION: readonly number[] = [1, 1, 0.85, 0.6, 0.4, 0.22, 0.12, 0.08, 0.05, 0.03, 0.02];
/** Costo en esquirlas de fusionar, por nivel de entrada. */
export const COSTO_FUSION: readonly number[] = [15, 40, 100, 240, 550, 1200, 2600, 5500, 11000, 22000, 45000];
/** Mejoras máximas por carta (cada una usa un Polvo de Eco). */
export const MEJORAS_MAX = 5;

/** Rareza de las cartas que sueltan los monstruos, por piso (tabla acumulada de minialu). */
export const RAREZA_CARTA_PISO: readonly TablaRareza[] = [
  [[0, 0.68], [1, 0.26], [2, 0.06]],
  [[0, 0.53], [1, 0.34], [2, 0.11], [3, 0.02]],
  [[0, 0.4], [1, 0.38], [2, 0.16], [3, 0.06]],
  [[0, 0.3], [1, 0.4], [2, 0.21], [3, 0.08], [4, 0.01]],
  [[0, 0.22], [1, 0.38], [2, 0.27], [3, 0.11], [4, 0.02]],
  [[0, 0.15], [1, 0.35], [2, 0.3], [3, 0.15], [4, 0.05]],
  [[0, 0.09], [1, 0.31], [2, 0.33], [3, 0.19], [4, 0.07], [5, 0.01]],
  [[0, 0.05], [1, 0.25], [2, 0.35], [3, 0.23], [4, 0.1], [5, 0.02]],
  [[1, 0.22], [2, 0.35], [3, 0.27], [4, 0.12], [5, 0.035], [6, 0.005]],
  [[1, 0.16], [2, 0.33], [3, 0.3], [4, 0.15], [5, 0.05], [6, 0.01]],
];
/** Jefes y cofres sueltan cartas mejores. */
export const RAREZA_CARTA_JEFE: readonly TablaRareza[] = [
  [[1, 0.5], [2, 0.4], [3, 0.1]],
  [[1, 0.3], [2, 0.5], [3, 0.2]],
  [[2, 0.5], [3, 0.38], [4, 0.12]],
  [[2, 0.35], [3, 0.45], [4, 0.2]],
  [[3, 0.5], [4, 0.38], [5, 0.12]],
  [[3, 0.4], [4, 0.42], [5, 0.18]],
  [[3, 0.3], [4, 0.45], [5, 0.22], [6, 0.03]],
  [[4, 0.5], [5, 0.42], [6, 0.08]],
  [[4, 0.38], [5, 0.48], [6, 0.13], [7, 0.01]],
  [[5, 0.72], [6, 0.25], [7, 0.03]],
];

export function nuevoUid(azar: Azar): string {
  return `${Date.now().toString(36)}-${entero(azar, 2 ** 31).toString(36)}`;
}

export function rangoCarta(personaje: number, nivel: number): { minimos: Record<string, number>; maximos: Record<string, number> } {
  const def = alma(personaje);
  const escala = ESCALA_ESTRELLA[Math.max(0, Math.min(nivel, NIVEL_MAX_CARTA))];
  const minimos: Record<string, number> = {};
  const maximos: Record<string, number> = {};
  for (const [stat, peso] of Object.entries(def.pesos)) {
    if (peso === undefined) continue;
    maximos[stat] = Math.max(1, Math.round(peso * escala));
    minimos[stat] = Math.max(0, Math.floor(maximos[stat] * 0.75));
  }
  return { minimos, maximos };
}

/** Tope de mejora: 20 % por encima del máximo de la estrella. */
export function topeMejora(personaje: number, nivel: number, brillante = false): Record<string, number> {
  const { maximos } = rangoCarta(personaje, nivel);
  const tope: Record<string, number> = {};
  for (const [k, v] of Object.entries(maximos)) tope[k] = Math.ceil(v * 1.2 * (brillante ? 1.2 : 1)) + MEJORAS_MAX;
  return tope;
}

export function crearCarta(azar: Azar, personaje: number, nivel: number): Carta {
  const n = Math.max(0, Math.min(nivel, NIVEL_MAX_CARTA));
  const { minimos, maximos } = rangoCarta(personaje, n);
  const brillante = azar.siguiente() < PROB_BRILLANTE;
  const stats = generarStats(azar, minimos, maximos);
  if (brillante) for (const k of Object.keys(stats)) stats[k] = Math.round(stats[k] * 1.2);
  const rasgo = azar.siguiente() < probRasgoCarta(n) ? elegirUno(azar, IDS_RASGO_CARTA) : undefined;
  return {
    uid: nuevoUid(azar),
    tipo: alma(personaje).tipo,
    nivel: n,
    personaje,
    stats,
    mejoras: 0,
    ...(rasgo !== undefined ? { rasgo } : {}),
    ...(brillante ? { brillante } : {}),
  };
}

/** Carta al azar de la tabla; la SUERTE (`fortuna`) puede subirla una estrella (hasta 40 % con 200 de suerte). */
export function cartaAleatoria(azar: Azar, tabla: TablaRareza, fortuna = 0): Carta {
  const nivel = tirarRareza(azar, tabla);
  const sube = fortuna > 0 && azar.siguiente() < Math.min(0.4, fortuna / 500);
  return crearCarta(azar, elegirUno(azar, ALMAS).id, Math.min(NIVEL_MAX_CARTA, nivel + (sube ? 1 : 0)));
}

export function fusionarCartas(
  cartas: readonly [Carta, Carta, Carta],
  azar: Azar,
  suerte = false,
  /** Bono a la probabilidad de subir (Bendición del Rosario). */
  bono = 0,
): Resultado<{ carta: Carta; subio: boolean }, ErrorFusion> {
  // minialu exige el mismo "tipo": acá la regla es solo la misma estrella, así que se fusiona con tipo común
  // y la carta nueva toma la familia de su alma. Si las almas difieren, sale una de las tres.
  const sinFamilia = cartas.map((c) => ({ ...c, tipo: 0 })) as unknown as readonly [Carta, Carta, Carta];
  return fusionar(sinFamilia, {
    azar,
    nivelMaximo: NIVEL_MAX_CARTA,
    probabilidad: (_tipo, nivel) => Math.min(1, PROB_FUSION[nivel] + bono),
    personajesPosibles: (cs) => cs.map((c) => c.personaje),
    crear: (_tipo, nivel, personaje) => crearCarta(azar, personaje, nivel),
  }, suerte);
}

export function mejorarCarta(carta: Carta, azar: Azar): Resultado<{ carta: Carta; incremento: number }, "al-maximo"> {
  if (carta.mejoras >= MEJORAS_MAX) {
    return { ok: false, error: "al-maximo" };
  }
  const r = mejorar({ ...carta.stats }, topeMejora(carta.personaje, carta.nivel, carta.brillante === true), azar);
  if (!r.ok) return r;
  return { ok: true, valor: { incremento: r.valor.incremento, carta: { ...carta, stats: r.valor.stats, mejoras: carta.mejoras + 1 } } };
}

export function capaForma(carta: Carta | null): Capa {
  return carta === null ? {} : carta.stats;
}

export const FACTOR_RESONANCIA = 0.35;
export const FACTOR_SINTONIA = 0.5;

export function capaResonancia(carta: Carta | null, forma: Carta | null, extra = 0): Capa {
  if (carta === null) return {};
  const sintonia = forma !== null && forma.tipo === carta.tipo;
  return escalarCapa(carta.stats, (sintonia ? FACTOR_SINTONIA : FACTOR_RESONANCIA) + extra);
}

/** "★★★" hasta 6 estrellas; de 7★ en adelante, "★7" (no entra una fila de doce estrellas). */
export function textoEstrellas(nivel: number): string {
  return nivel < 6 ? "★".repeat(nivel + 1) : `★${nivel + 1}`;
}

export function estrellas(carta: Carta): string {
  return textoEstrellas(carta.nivel);
}

export function nombreCarta(carta: Carta): string {
  const a = alma(carta.personaje);
  const prefijo = carta.brillante === true ? "✧ " : "";
  const rasgo = carta.rasgo !== undefined ? ` (${RASGOS_CARTA[carta.rasgo].nombre})` : "";
  return `${prefijo}${a.nombre}, ${a.titulo}${carta.mejoras > 0 ? ` +${carta.mejoras}` : ""}${rasgo}`;
}

/** Valor para comparar cartas (y elegir el legado del Eco). */
export function poderCarta(carta: Carta): number {
  return Object.entries(carta.stats).reduce((s, [k, v]) => s + (k === "hp" ? v / 3 : v), 0);
}
