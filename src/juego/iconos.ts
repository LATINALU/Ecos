// Ícono de cada objeto (microFantasy / Generic Dungeon Pack). Lo usan el botín en el suelo y los menús.
// Devuelve null si no hay ícono o si la imagen no cargó: entonces se dibuja el ícono procedural.

import { GEMA } from "../contenido/atlas.ts";
import { MAT_FRAGMENTO, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO, estiloDe } from "../contenido/objetos.ts";
import { ICONOS } from "../contenido/sprites.generado.ts";
import type { ObjetoEquipo } from "../dominio/equipo.ts";
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

export function iconoEquipo(o: ObjetoEquipo): Icono | null {
  switch (o.ranura) {
    case "arma":
      return delAtlas(ARMA_POR_ESTILO[estiloDe(o.base)] ?? "sword");
    case "armadura":
      return delAtlas(o.rareza >= 4 ? "shield_red" : o.rareza >= 2 ? "shield_yellow" : "shield_blue");
    case "amuleto":
      return { imagen: "castillo", rect: GEMA[0] };
  }
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
