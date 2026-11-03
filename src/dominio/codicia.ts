// TENSIÓN DE EXTRACCIÓN y CODICIA.
//
// · EXTRACCIÓN CON EMBOSCADA: pisar la zona de extracción despierta al Pozo, que intenta impedir que te vayas.
//   Hay que resistir dentro de la zona entre 15 y 20 s mientras brotan Manos del Abismo y llegan cazadores atraídos
//   por el brillo de lo que llevas. Cuanto más botín Legendario/Mítico llevas EN RIESGO, más violenta es.
// · PESO DEL ECO: cada piso que bajas seguido sin volver al pueblo suma Peso. Más Peso = más hallazgos raros y
//   Relicarios, pero el Pozo se distorsiona y manda CAZADORES DE PORTADORES que te persiguen de sala en sala.

/** Lo que llevas encima, resumido para medir la emboscada. */
export interface ResumenRiesgo {
  /** Valor en esquirlas de todo lo que perderías. */
  readonly valor: number;
  /** Piezas por rareza (0 común … 5 mítico) equipadas o en la mochila. */
  readonly porRareza: readonly number[];
  /** Relicarios en la mochila. */
  readonly relicarios: number;
}

/** Nivel de la emboscada de extracción: 0 (poco que perder) a 5 (una fortuna). */
export function nivelEmboscada(r: ResumenRiesgo): number {
  const brillo = (r.porRareza[3] ?? 0) * 1 + (r.porRareza[4] ?? 0) * 2.5 + (r.porRareza[5] ?? 0) * 5 + r.relicarios * 1.5 + r.valor / 3000;
  return Math.max(0, Math.min(5, Math.floor(brillo / 3)));
}

export interface PlanEmboscada {
  /** Segundos que hay que resistir DENTRO de la zona. */
  readonly duracion: number;
  /** Cada cuánto brota una Mano del Abismo bajo tus pies. */
  readonly cadaMano: number;
  /** Cada cuánto llega una oleada de cazadores, y cuántos. */
  readonly cadaOleada: number;
  readonly porOleada: number;
  /** Probabilidad de que un cazador sea élite. */
  readonly elite: number;
}

export function planEmboscada(nivel: number): PlanEmboscada {
  return {
    duracion: 15 + nivel,
    cadaMano: Math.max(1, 2.6 - nivel * 0.3),
    cadaOleada: Math.max(3, 6 - nivel * 0.5),
    porOleada: 1 + Math.floor(nivel / 1.5),
    elite: Math.min(0.75, 0.05 + nivel * 0.14),
  };
}

// ---------------- Peso del Eco ----------------

export const PESO_MAX = 8;

/** Bonos de hallazgo por Peso del Eco: +25 % de hallazgos raros por piso seguido. */
export function bonoPeso(peso: number): { readonly suerte: number; readonly fortuna: number; readonly relicarioElite: number } {
  const p = Math.max(0, Math.min(PESO_MAX, peso));
  return { suerte: 1 + 0.25 * p, fortuna: 25 * p, relicarioElite: 0.015 * p };
}

/** Desde qué Peso aparecen los Cazadores de Portadores. */
export const PESO_CAZADOR = 2;

/** Segundos en el piso hasta que llega el Cazador (antes cuanto más Peso). */
export function retrasoCazador(peso: number): number {
  return Math.max(35, 95 - Math.max(0, peso - PESO_CAZADOR) * 12);
}

/** Stats del Cazador de Portadores (resistente, pero se puede matar). */
export function statsCazador(piso: number, peso: number): { hp: number; ataque: number; defensa: number; velocidad: number } {
  return {
    hp: Math.round((80 + piso * 50) * (1 + peso * 0.12)),
    ataque: Math.round(8 + piso * 2.4),
    defensa: Math.round(piso * 1.2),
    velocidad: 55 + Math.min(PESO_MAX, peso) * 8,
  };
}
