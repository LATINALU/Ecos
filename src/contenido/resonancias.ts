// RESONANCIAS DE MAZO: combinaciones secretas entre dos habilidades.
//
// Cada habilidad tiene una ESENCIA (fuego, hielo, veneno, tormenta, tierra, viento, sombra o arcano) que sale de sus
// efectos y de su forma. Si usas una habilidad y, en menos de 1,5 s, otra de OTRA ranura cuya esencia combina con la
// primera, las dos resuenan y aparece un efecto que no existe en ninguna de las cartas por separado
// (p. ej. fuego + viento = Tornado de Ceniza). Están ocultas: se van anotando en el Códice al descubrirlas.

import type { DefHabilidad } from "./grimorio.ts";

export type Esencia = "fuego" | "hielo" | "veneno" | "tormenta" | "tierra" | "viento" | "sombra" | "arcano";

export const INFO_ESENCIA: Readonly<Record<Esencia, { nombre: string; color: string; icono: string }>> = {
  fuego: { nombre: "Fuego", color: "#ff7a3d", icono: "🜂" },
  hielo: { nombre: "Hielo", color: "#9fe8ff", icono: "❄" },
  veneno: { nombre: "Veneno", color: "#9aff5a", icono: "☠" },
  tormenta: { nombre: "Tormenta", color: "#ffe27a", icono: "ϟ" },
  tierra: { nombre: "Tierra", color: "#c9a76a", icono: "▲" },
  viento: { nombre: "Viento", color: "#bff3ff", icono: "≋" },
  sombra: { nombre: "Sombra", color: "#a07cff", icono: "◐" },
  arcano: { nombre: "Arcano", color: "#5fd0ff", icono: "✦" },
};

/** Esencia de una habilidad: por sus efectos y su forma; si no dice nada, por la familia del alma. */
export function esenciaDe(def: DefHabilidad, familia: number): Esencia {
  const ef = def.efectos ?? [];
  if (ef.includes("quema")) return "fuego";
  if (ef.includes("hielo")) return "hielo";
  if (ef.includes("veneno")) return "veneno";
  if (def.forma === "rayo") return "tormenta";
  if (ef.includes("aturde") && (def.forma === "onda" || def.forma === "lluvia" || def.forma === "salto")) return "tierra";
  if (ef.includes("aturde")) return "tormenta";
  if (def.forma === "embestida" || def.forma === "garras" || def.forma === "boomerang" || def.forma === "orbita" || ef.includes("lanzar")) return "viento";
  return (["tierra", "sombra", "arcano", "viento"] as const)[familia] ?? "arcano";
}

export interface DefResonancia {
  readonly id: string;
  readonly nombre: string;
  readonly esencias: readonly [Esencia, Esencia];
  readonly descripcion: string;
  readonly color: string;
}

export const RESONANCIAS: readonly DefResonancia[] = [
  { id: "tornado", nombre: "Tornado de Ceniza", esencias: ["fuego", "viento"], color: "#ff9a3d", descripcion: "Un tornado de brasas avanza, atrae a los enemigos y los quema." },
  { id: "glacial", nombre: "Tormenta Glacial", esencias: ["hielo", "tormenta"], color: "#bff3ff", descripcion: "Rayos de hielo caen sobre todos los enemigos cercanos y los congelan." },
  { id: "miasma", nombre: "Miasma Ígneo", esencias: ["veneno", "fuego"], color: "#c8ff5a", descripcion: "Una nube tóxica envenena y, al rato, estalla en llamas." },
  { id: "glaciar", nombre: "Glaciar", esencias: ["tierra", "hielo"], color: "#7fe3ff", descripcion: "Picos de hielo brotan del suelo uno tras otro hacia delante." },
  { id: "rayo-negro", nombre: "Rayo Negro", esencias: ["sombra", "tormenta"], color: "#7d4dff", descripcion: "Un haz de sombra eléctrica atraviesa la sala de lado a lado." },
  { id: "vendaval", nombre: "Vendaval Pútrido", esencias: ["viento", "veneno"], color: "#9aff5a", descripcion: "Una ráfaga aparta a todos y los deja envenenados." },
  { id: "erupcion", nombre: "Erupción", esencias: ["fuego", "tierra"], color: "#ff5a2a", descripcion: "Columnas de lava brotan a tu alrededor." },
  { id: "eclipse", nombre: "Eclipse Menor", esencias: ["sombra", "arcano"], color: "#b04dff", descripcion: "Un agujero negro atrae a todos y después implosiona." },
  { id: "ciclon", nombre: "Ciclón Eléctrico", esencias: ["viento", "tormenta"], color: "#ffe27a", descripcion: "Un ciclón cargado de rayos gira a tu alrededor." },
  { id: "prisma", nombre: "Prisma Arcano", esencias: ["arcano", "hielo"], color: "#5fd0ff", descripcion: "Un cristal refracta tu poder en haces hacia todos lados." },
];

/** Resonancia de dos esencias (en cualquier orden), si existe. */
export function buscarResonancia(a: Esencia, b: Esencia): DefResonancia | undefined {
  if (a === b) return undefined;
  return RESONANCIAS.find((r) => (r.esencias[0] === a && r.esencias[1] === b) || (r.esencias[0] === b && r.esencias[1] === a));
}

/** Ventana para encadenar las dos habilidades. */
export const VENTANA_RESONANCIA = 1.5;
