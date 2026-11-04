// FRENESÍ DE ARENA y PESO DEL ECO.
//
// · FRENESÍ: mientras dura una Arena, el Pozo se enfurece: brotan Manos del Abismo bajo tus pies y llegan
//   refuerzos por los lados mientras quede alguien de la oleada en pie. Es más violento en pisos hondos y en el Juicio.
// · PESO DEL ECO: cada piso que bajas seguido sin volver al pueblo suma Peso = más hallazgos raros y Relicarios.

/** Nivel del frenesí de una arena (0..5): crece con el piso, la oleada y el Juicio. */
export function nivelFrenesi(piso: number, oleada: number, juicio = 0): number {
  return Math.max(0, Math.min(5, Math.floor(piso / 6) + Math.floor(oleada / 2) + (juicio > 0 ? 1 + Math.floor(juicio / 5) : 0)));
}

export interface PlanFrenesi {
  /** Cada cuánto brota una Mano del Abismo bajo tus pies. */
  readonly cadaMano: number;
  /** Cada cuánto llegan refuerzos, y cuántos. */
  readonly cadaOleada: number;
  readonly porOleada: number;
  /** Probabilidad de que un refuerzo sea élite. */
  readonly elite: number;
  /** Refuerzos vivos a la vez como mucho (para que no se vuelva injusto). */
  readonly tope: number;
}

export function planFrenesi(nivel: number): PlanFrenesi {
  return {
    cadaMano: Math.max(1.2, 3 - nivel * 0.3),
    cadaOleada: Math.max(3.5, 6.5 - nivel * 0.5),
    porOleada: 1 + Math.floor(nivel / 2),
    elite: Math.min(0.5, 0.04 + nivel * 0.09),
    tope: 3 + nivel,
  };
}

// ---------------- Peso del Eco ----------------

export const PESO_MAX = 8;

/** Bonos de hallazgo por Peso del Eco: +25 % de hallazgos raros por piso seguido. */
export function bonoPeso(peso: number): { readonly suerte: number; readonly fortuna: number; readonly relicarioElite: number } {
  const p = Math.max(0, Math.min(PESO_MAX, peso));
  return { suerte: 1 + 0.25 * p, fortuna: 25 * p, relicarioElite: 0.015 * p };
}
