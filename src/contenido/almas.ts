// Almas: guerreros que cayeron en el Pozo. Sus Cartas de Alma son el equivalente a las cartas de personaje de
// MiniFighter: tipo (familia), nivel (estrellas), personaje y stats al azar dentro de un rango por estrella.

import type { Stat } from "../dominio/stats.ts";

export type Tecnica = "orbe" | "tajo" | "terremoto" | "zarpazo" | "lanza";

/** `mult`: multiplicador sobre el stat Técnica por impacto (`impactos` = golpes típicos de una ejecución). */
export const INFO_TECNICA: Readonly<Record<Tecnica, { nombre: string; costo: number; mult: number; impactos: number; descripcion: string }>> = {
  orbe: { nombre: "Orbe Ígneo", costo: 12, mult: 1.6, impactos: 1, descripcion: "Dispara una esfera de fuego que estalla al impactar." },
  tajo: { nombre: "Tajo Fantasma", costo: 14, mult: 1.35, impactos: 1, descripcion: "Atraviesas a los enemigos cortando todo a tu paso, invulnerable." },
  terremoto: { nombre: "Terremoto", costo: 18, mult: 1.45, impactos: 1, descripcion: "Golpeas el suelo: dos ondas recorren el piso hacia ambos lados." },
  zarpazo: { nombre: "Zarpazo Voraz", costo: 13, mult: 0.75, impactos: 3, descripcion: "Tres garras rápidas; cada impacto te devuelve vida." },
  lanza: { nombre: "Lanza Glacial", costo: 15, mult: 1.35, impactos: 1, descripcion: "Una lanza de hielo que atraviesa y ralentiza." },
};

export const FAMILIAS = ["Hoja", "Sombra", "Arcano", "Bestia"] as const;
export const COLOR_FAMILIA = ["#d9d2c3", "#a07cff", "#5fd0ff", "#ff9a4d"] as const;

export interface DefAlma {
  readonly id: number;
  readonly nombre: string;
  readonly titulo: string;
  readonly tipo: number;
  readonly tecnica: Tecnica;
  /** Colores del portador cuando adopta esta forma. */
  readonly color: string;
  readonly colorSec: string;
  /** Peso de cada stat: valor ≈ peso × escala de la estrella. */
  readonly pesos: Readonly<Partial<Record<Stat, number>>>;
  readonly lore: string;
  /** Habilidad pasiva que se activa cuando el alma es tu Forma. */
  readonly pasiva: Pasiva;
}

export type Pasiva = "muro" | "filo" | "sombra" | "humo" | "horno" | "escarcha" | "hambre" | "raiz";

export const INFO_PASIVA: Readonly<Record<Pasiva, { nombre: string; descripcion: string }>> = {
  muro: { nombre: "Muralla", descripcion: "Recibes un 15 % menos de daño." },
  filo: { nombre: "Filo Errante", descripcion: "+12 % de probabilidad de crítico." },
  sombra: { nombre: "Hambre de Sombra", descripcion: "Cada crítico te cura un 3 % de la vida máxima." },
  humo: { nombre: "Cuerpo de Humo", descripcion: "20 % de probabilidad de esquivar un golpe por completo." },
  horno: { nombre: "Corazón de Horno", descripcion: "Tus técnicas hacen un 25 % más de daño." },
  escarcha: { nombre: "Escarcha", descripcion: "Tus golpes ralentizan a los enemigos." },
  hambre: { nombre: "Voracidad", descripcion: "Te curas un 6 % del daño que haces." },
  raiz: { nombre: "Raíz Firme", descripcion: "Tus patadas aturden y tienes +6 de defensa (+1 por nivel)." },
};

export const ALMAS: readonly DefAlma[] = [
  {
    id: 0, nombre: "Tormo", titulo: "el Muro", tipo: 0, tecnica: "terremoto", color: "#9c8f7a", colorSec: "#e0c48a",
    pesos: { hp: 3.2, defensa: 0.9, patada: 1.1, golpe: 0.5, tecnica: 0.8, mp: 0.4, critico: 0.05 },
    lore: "Sostuvo la puerta del Pozo tres días. Cuando cayó, la puerta cayó con él.",
    pasiva: "muro",
  },
  {
    id: 1, nombre: "Sira", titulo: "Filo Errante", tipo: 0, tecnica: "tajo", color: "#c9c9d6", colorSec: "#ff5a6a",
    pesos: { hp: 1.6, golpe: 1.3, patada: 0.8, tecnica: 0.9, defensa: 0.4, mp: 0.5, critico: 0.3 },
    lore: "Juró no envainar hasta encontrar el fondo. Su espada todavía busca.",
    pasiva: "filo",
  },
  {
    id: 2, nombre: "Kage", titulo: "el que No Estuvo", tipo: 1, tecnica: "tajo", color: "#3b3550", colorSec: "#b48cff",
    pesos: { hp: 1.2, golpe: 1.1, patada: 0.9, tecnica: 1.0, defensa: 0.3, mp: 0.7, critico: 0.45 },
    lore: "Nadie recuerda su cara. El Pozo tampoco, y eso lo enfurece.",
    pasiva: "sombra",
  },
  {
    id: 3, nombre: "Velo", titulo: "Viuda de Humo", tipo: 1, tecnica: "orbe", color: "#2c2a3a", colorSec: "#7d6bff",
    pesos: { hp: 1.3, golpe: 0.6, patada: 0.7, tecnica: 1.5, defensa: 0.4, mp: 1.0, critico: 0.3 },
    lore: "Prendió fuego a su propia sombra para no volver a estar sola.",
    pasiva: "humo",
  },
  {
    id: 4, nombre: "Brasa", titulo: "Hija del Horno", tipo: 2, tecnica: "orbe", color: "#b8432f", colorSec: "#ffcf5a",
    pesos: { hp: 1.4, golpe: 0.6, patada: 0.6, tecnica: 1.7, defensa: 0.4, mp: 1.2, critico: 0.15 },
    lore: "Forjaba armas en la Forja Ahogada. Ahora forja su propia ira.",
    pasiva: "horno",
  },
  {
    id: 5, nombre: "Nix", titulo: "Invierno Callado", tipo: 2, tecnica: "lanza", color: "#3d6f9e", colorSec: "#bff3ff",
    pesos: { hp: 1.5, golpe: 0.7, patada: 0.6, tecnica: 1.5, defensa: 0.6, mp: 1.1, critico: 0.2 },
    lore: "Congeló el río subterráneo para cruzarlo. El río todavía no se lo perdona.",
    pasiva: "escarcha",
  },
  {
    id: 6, nombre: "Ulva", titulo: "Hambre de Luna", tipo: 3, tecnica: "zarpazo", color: "#5b4636", colorSec: "#ffe08a",
    pesos: { hp: 2.2, golpe: 1.2, patada: 1.0, tecnica: 0.7, defensa: 0.5, mp: 0.5, critico: 0.3 },
    lore: "La manada la siguió hasta el Pozo. Ninguno quiso volver arriba.",
    pasiva: "hambre",
  },
  {
    id: 7, nombre: "Grum", titulo: "Raíz de Piedra", tipo: 3, tecnica: "terremoto", color: "#4f6b3a", colorSec: "#c4ff7a",
    pesos: { hp: 2.8, golpe: 0.8, patada: 1.3, tecnica: 0.8, defensa: 0.8, mp: 0.4, critico: 0.05 },
    lore: "Durmió tanto en el Micelio que le crecieron bosques en la espalda.",
    pasiva: "raiz",
  },
];

export function alma(id: number): DefAlma {
  const a = ALMAS[id];
  if (a === undefined) throw new Error(`Alma desconocida: ${id}`);
  return a;
}

/** Escala de stats por estrella (nivel 0 = 1★ ... nivel 6 = 7★). */
export const ESCALA_ESTRELLA: readonly number[] = [6, 11, 17, 25, 35, 48, 65];
