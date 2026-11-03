// Pasivas MÍTICAS: la rareza más alta del equipo trae 4 modificadores y una de estas pasivas únicas.
// Usan los mismos efectos que las pasivas del mazo de almas (contenido/grimorio.ts), así que el combate ya las
// sabe aplicar: probabilidades en los golpes básicos, espinas, carga de la Definitiva, defensa, etc.

import type { TipoPieza } from "../dominio/tipos.ts";
import type { EfectosPasiva } from "./grimorio.ts";

export type IdPasivaMitica =
  | "furiaVolcan" | "inviernoEterno" | "plagaSilente" | "tronador" | "verdugo" | "ecoInfinito" | "sangreAntigua"
  | "murallaViva" | "pasoFantasma" | "coronaEstelar" | "corazonForja" | "sedienta" | "espinoNegro" | "relojRoto"
  | "alaCuervo" | "ojoTormenta";

export interface DefPasivaMitica {
  readonly id: IdPasivaMitica;
  readonly nombre: string;
  readonly efectos: EfectosPasiva;
  /** Clases de pieza donde puede salir (sin dato: cualquiera). */
  readonly en?: readonly TipoPieza[];
}

export const PASIVAS_MITICAS: readonly DefPasivaMitica[] = [
  { id: "furiaVolcan", nombre: "Furia del Volcán", efectos: { golpeQuema: 0.35, danio: 0.08 }, en: ["arma"] },
  { id: "inviernoEterno", nombre: "Invierno Eterno", efectos: { golpeHielo: 0.35, recibido: 0.05 }, en: ["arma", "capa"] },
  { id: "plagaSilente", nombre: "Plaga Silente", efectos: { golpeVeneno: 0.4, critico: 4 }, en: ["arma", "anillo"] },
  { id: "tronador", nombre: "Tronador", efectos: { golpeRayo: 0.25, velocidad: 0.06 }, en: ["arma", "aretes"] },
  { id: "verdugo", nombre: "Verdugo", efectos: { golpeCritico: 12, critDanio: 0.35 }, en: ["arma"] },
  { id: "ecoInfinito", nombre: "Eco Infinito", efectos: { golpeExtra: 0.18 }, en: ["arma", "anillo"] },
  { id: "sangreAntigua", nombre: "Sangre Antigua", efectos: { golpeCura: 0.01, robo: 0.03 } },
  { id: "murallaViva", nombre: "Muralla Viva", efectos: { defensaPct: 0.2, recibido: 0.08 }, en: ["pecho", "casco", "hombros", "pantalones"] },
  { id: "pasoFantasma", nombre: "Paso Fantasma", efectos: { esquiva: 0.1, agilidad: 0.1 }, en: ["botas", "capa", "pantalones"] },
  { id: "coronaEstelar", nombre: "Corona Estelar", efectos: { tecnicaDanio: 0.25, tecnicaCosto: 0.15 }, en: ["casco", "collar", "aretes"] },
  { id: "corazonForja", nombre: "Corazón de Forja", efectos: { hpPct: 0.15, regen: 8 }, en: ["pecho", "collar", "cinturon"] },
  { id: "sedienta", nombre: "La Sedienta", efectos: { robo: 0.05, danio: 0.06 }, en: ["arma", "collar"] },
  { id: "espinoNegro", nombre: "Espino Negro", efectos: { espinas: 0.4, defensaPct: 0.08 }, en: ["pecho", "hombros", "cinturon"] },
  { id: "relojRoto", nombre: "Reloj Roto", efectos: { enfriamiento: 0.2, carga: 0.25 }, en: ["anillo", "aretes", "cinturon"] },
  { id: "alaCuervo", nombre: "Ala de Cuervo", efectos: { velocidad: 0.12, esquiva: 0.04 }, en: ["capa", "hombros", "botas"] },
  { id: "ojoTormenta", nombre: "Ojo de la Tormenta", efectos: { critico: 10, carga: 0.15 }, en: ["casco", "anillo", "aretes"] },
];

export function pasivaMitica(id: IdPasivaMitica): DefPasivaMitica {
  return PASIVAS_MITICAS.find((p) => p.id === id) ?? PASIVAS_MITICAS[0];
}

export function pasivasMiticasPara(tipo: TipoPieza): readonly DefPasivaMitica[] {
  return PASIVAS_MITICAS.filter((p) => p.en === undefined || p.en.includes(tipo));
}
