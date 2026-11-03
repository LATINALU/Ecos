// Ícono de cada objeto (microFantasy / Generic Dungeon Pack). Lo usan el botín en el suelo y los menús.
// Devuelve null si no hay ícono o si la imagen no cargó: entonces se dibuja el ícono procedural.

import { GEMA } from "../contenido/atlas.ts";
import { MAT_FRAGMENTO, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO, estiloDe } from "../contenido/objetos.ts";
import { ICONOS } from "../contenido/sprites.generado.ts";
import type { ObjetoEquipo } from "../dominio/equipo.ts";
import type { TipoPieza } from "../dominio/tipos.ts";
import { sprites, type Lienzo, type NombreImagen } from "../motor/sprites.ts";

export interface Icono {
  readonly imagen: NombreImagen;
  readonly rect: readonly [number, number, number, number];
}

function delAtlas(nombre: string): Icono | null {
  const i = ICONOS[nombre];
  return i === undefined ? null : { imagen: "iconos", rect: [i * 16, 0, 16, 16] };
}

const ARMA_POR_ESTILO: Readonly<Record<string, string>> = {
  espada: "sword", pesada: "big_axe", baston: "magic_staff", punos: "cleaver", arco: "arrow",
};

const APILABLES: Readonly<Record<number, string>> = {
  [OBJ_POCION]: "potion_red", [OBJ_ETER]: "potion_blue", [OBJ_POLVO]: "potion_green", [OBJ_LAGRIMA]: "potion_yellow",
};

/** Íconos de imagen: armas (microFantasy) y el collar (gema). El resto de las piezas usa glifos procedurales. */
export function iconoEquipo(o: ObjetoEquipo): Icono | null {
  if (o.ranura === "arma") return delAtlas(ARMA_POR_ESTILO[estiloDe(o.base)] ?? "sword");
  return null;
}

/**
 * Glifo pixelado de cada clase de pieza, centrado en (cx, cy), ~10 px. Sirve en el mundo (botín) y en los menús.
 */
export function dibujarIconoPieza(g: CanvasRenderingContext2D, tipo: TipoPieza, cx: number, cy: number, color: string): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const r = (dx: number, dy: number, w: number, h: number, c = color): void => {
    g.fillStyle = c;
    g.fillRect(x + dx, y + dy, w, h);
  };
  const oscuro = "#1a1622";
  switch (tipo) {
    case "casco":
      r(-4, -4, 8, 6); r(-5, 0, 10, 2); r(-2, -1, 4, 1, oscuro); r(-1, -6, 2, 2);
      break;
    case "hombros":
      r(-5, -2, 4, 4); r(1, -2, 4, 4); r(-1, -1, 2, 2, oscuro); r(-5, -3, 4, 1, "#ffffff55"); r(1, -3, 4, 1, "#ffffff55");
      break;
    case "pecho":
      r(-4, -4, 8, 9); r(-6, -4, 2, 4); r(4, -4, 2, 4); r(-1, -4, 2, 2, oscuro); r(-3, 1, 6, 1, oscuro);
      break;
    case "cinturon":
      r(-5, -1, 10, 3); r(-1, -2, 3, 5, "#ffd27a"); r(0, -1, 1, 3, oscuro);
      break;
    case "pantalones":
      r(-4, -4, 8, 3); r(-4, -1, 3, 6); r(1, -1, 3, 6);
      break;
    case "botas":
      r(-5, -4, 3, 6); r(-5, 2, 5, 2); r(1, -4, 3, 6); r(1, 2, 5, 2);
      break;
    case "anillo":
      r(-3, -2, 6, 1); r(-3, 3, 6, 1); r(-4, -1, 1, 4); r(3, -1, 1, 4); r(-1, -5, 3, 3, "#ffffff"); r(0, -4, 1, 1, color);
      break;
    case "aretes":
      r(-4, -4, 1, 3); r(3, -4, 1, 3); r(-5, -1, 3, 4); r(2, -1, 3, 4); r(-4, 0, 1, 1, "#ffffff"); r(3, 0, 1, 1, "#ffffff");
      break;
    case "collar":
      for (let k = -4; k <= 4; k++) r(k, -4 + Math.round((k * k) / 4), 1, 1);
      r(-2, 1, 4, 4); r(-1, 2, 2, 2, "#ffffff");
      break;
    case "capa":
      r(-3, -5, 6, 2); r(-4, -3, 8, 4); r(-5, 1, 10, 4); r(-1, -5, 2, 1, "#ffd27a"); r(-5, 4, 2, 1, oscuro); r(1, 4, 2, 1, oscuro);
      break;
    case "arma":
      r(-1, -5, 2, 8); r(-3, 2, 6, 1, "#c9a76a"); r(-1, 3, 2, 2, "#8a6a3a");
      break;
  }
}

/** Lienzo con el glifo procedural (menús), escalado. */
export function lienzoPieza(tipo: TipoPieza, color: string, escala = 3): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16 * escala;
  c.height = 16 * escala;
  c.className = "icono-sprite";
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.scale(escala, escala);
  dibujarIconoPieza(g, tipo, 8, 8, color);
  return c;
}

/** Ícono de una pieza para los menús: imagen si hay, glifo si no. */
export function lienzoEquipo(o: ObjetoEquipo, color: string, escala = 3): HTMLCanvasElement {
  return lienzoIcono(iconoEquipo(o), escala) ?? lienzoPieza(o.ranura, color, escala);
}

export function iconoObjeto(id: number): Icono | null {
  if (id === MAT_FRAGMENTO) return { imagen: "castillo", rect: GEMA[0] };
  const n = APILABLES[id];
  return n === undefined ? null : delAtlas(n);
}

export function imagenDe(i: Icono): Lienzo | null {
  return sprites.imagen(i.imagen);
}

/** Lienzo pequeño con el ícono ampliado, para los menús. */
export function lienzoIcono(i: Icono | null, escala = 3): HTMLCanvasElement | null {
  if (i === null) return null;
  const img = imagenDe(i);
  if (img === null) return null;
  const [x, y, w, h] = i.rect;
  const c = document.createElement("canvas");
  c.width = w * escala;
  c.height = h * escala;
  c.className = "icono-sprite";
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, x, y, w, h, 0, 0, w * escala, h * escala);
  return c;
}
