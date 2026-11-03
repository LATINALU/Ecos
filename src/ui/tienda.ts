// Estética de RPG para las tiendas y servicios: cabecera con el retrato del comerciante (dibujado con el mismo
// motor del Portador), cartel con el nombre del local, globo de diálogo y la bolsa del jugador con sus monedas.
// Cada local tiene su color temático (--tema), que tiñe el marco, los carteles y los botones del panel.

import { dibujarPortador } from "../juego/render-portador.ts";
import { NPCS, type Servicio } from "../juego/pueblo.ts";
import { h } from "./dom.ts";

export type IdTienda = Servicio | "yunqueFaro" | "altarPozo" | "mercaderPozo" | "banco";

interface DefTienda {
  readonly local: string;
  readonly npc: string;
  readonly oficio: string;
  readonly tema: string;
  readonly icono: string;
  readonly paleta: readonly [string, string];
  readonly variante: number;
  readonly frases: readonly string[];
}

const desdeNpc = (s: Servicio, oficio: string, tema: string, icono: string, extra: readonly string[]): DefTienda => {
  const n = NPCS.find((x) => x.servicio === s)!;
  return { local: n.edificio, npc: n.nombre, oficio, tema, icono, paleta: n.paleta, variante: n.variante, frases: [...n.frases, ...extra] };
};

export const TIENDAS: Readonly<Record<IdTienda, DefTienda>> = {
  taberna: desdeNpc("taberna", "Tabernera", "#ffb23d", "🍺", ["Los que vuelven pagan la ronda. Los que no, la deben."]),
  mercader: desdeNpc("mercader", "Mercader", "#7dff9a", "⚖", ["Todo se compra, todo se vende. Hasta los recuerdos."]),
  armero: desdeNpc("armero", "Armera", "#ff7a3d", "⚔", ["Cuanto más hondo bajes, mejor el acero que te traigo."]),
  banco: desdeNpc("banco", "Custodio de la Bóveda", "#ffd27a", "⛁", ["Cada moneda aquí tiene nombre y apellido."]),
  altar: desdeNpc("altar", "Guardiana de las Almas", "#c9a7ff", "✦", ["Fusiona, mejora… y escucha lo que las cartas te dicen."]),
  herrero: desdeNpc("herrero", "Herrero", "#ff9a4d", "⚒", ["El acero recuerda cada golpe del martillo."]),
  santuario: desdeNpc("santuario", "Ermitaño", "#9fe8ff", "✧", ["Lo que ganas al caer no se pierde: se transforma."]),
  pozo: desdeNpc("pozo", "Descenso", "#7dffb0", "⬇", ["Bajas con todo. Vuelves solo con lo que extraigas."]),
  yunqueFaro: {
    local: "Yunque del Faro", npc: "Herrero Errante", oficio: "Espíritu de la forja", tema: "#ff9a4d", icono: "⚒",
    paleta: ["#3a2a20", "#ffb23d"], variante: 0, frases: ["Todo lo que se rompe aquí abajo puede volver a ser útil."],
  },
  altarPozo: {
    local: "Altar del Pozo", npc: "Eco de una Sacerdotisa", oficio: "Guardiana de las Almas", tema: "#c9a7ff", icono: "✦",
    paleta: ["#3a2a50", "#c9a7ff"], variante: 1, frases: ["Incluso aquí abajo, tres almas pueden hablar como una."],
  },
  mercaderPozo: {
    local: "Mercader del Pozo", npc: "Gaspar el Errante", oficio: "Mercader ambulante", tema: "#7dff9a", icono: "⚖",
    paleta: ["#4a3a2a", "#7dff9a"], variante: 3, frases: ["Abajo todo se paga. Arriba también, pero allá lo olvidan."],
  },
};

export interface Moneda {
  readonly icono: string;
  readonly cantidad: number;
  readonly nombre: string;
  readonly color: string;
}

export const esquirlas = (n: number): Moneda => ({ icono: "◆", cantidad: n, nombre: "Esquirlas", color: "#9fe8ff" });
export const esencia = (n: number): Moneda => ({ icono: "✧", cantidad: n, nombre: "Esencia", color: "#ffd27a" });
export const polvo = (n: number): Moneda => ({ icono: "✦", cantidad: n, nombre: "Polvo de Eco", color: "#c9a7ff" });

/** Retrato del comerciante: busto pixel-art con el motor del Portador, en un marco. */
function retrato(d: DefTienda): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 40;
  c.height = 34;
  c.className = "retrato-npc";
  const g = c.getContext("2d");
  if (g !== null) {
    g.imageSmoothingEnabled = false;
    const fondo = g.createRadialGradient(20, 14, 2, 20, 18, 28);
    fondo.addColorStop(0, `${d.tema}55`);
    fondo.addColorStop(1, "#0a0710");
    g.fillStyle = fondo;
    g.fillRect(0, 0, 40, 34);
    // El cuerpo entero mide ~30 px: con los pies abajo del lienzo se ve el busto.
    g.save();
    g.scale(1.5, 1.5);
    dibujarPortador(g, 13.3, 33, 1, "quieto", { cuerpo: d.paleta[0], acento: d.paleta[1] }, 0, { variante: d.variante });
    g.restore();
  }
  return c;
}

export function bolsa(monedas: readonly Moneda[]): HTMLElement {
  return h("div", { class: "bolsa", title: "Tu bolsa" },
    ...monedas.map((m) => h("span", { class: "moneda", style: `--m:${m.color}`, title: m.nombre },
      h("i", {}, m.icono), h("b", {}, m.cantidad.toLocaleString("es")))));
}

/** Cabecera de una tienda: retrato, cartel con el nombre, diálogo del comerciante y bolsa. */
export function cabeceraTienda(id: IdTienda, monedas: readonly Moneda[], frase?: string): HTMLElement {
  const d = TIENDAS[id];
  const dicho = frase ?? d.frases[Math.floor(Math.random() * d.frases.length)];
  return h("header", { class: "cabecera-tienda" },
    h("div", { class: "marco-retrato" }, retrato(d)),
    h("div", { class: "letrero" },
      h("div", { class: "cartel" }, h("span", { class: "icono-local" }, d.icono), h("h2", {}, d.local)),
      h("div", { class: "npc" }, h("b", {}, d.npc), h("span", {}, ` · ${d.oficio}`)),
      h("div", { class: "globo" }, `«${dicho}»`)),
    monedas.length > 0 ? bolsa(monedas) : null);
}

/** Color temático del panel de una tienda (se aplica como --tema). */
export function temaTienda(id: IdTienda): string {
  return TIENDAS[id].tema;
}
