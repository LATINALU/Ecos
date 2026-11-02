// Construye la grilla de tiles de una sala a partir de su plantilla y sus aperturas (puertas, pozos).
// Medidas: 30 × 17 tiles de 16 px = una pantalla de 480 × 272.
//
//   filas 0-1   techo (pozo de subida en columnas 13-16 si hay apertura "arr")
//   filas 2-13  interior de la plantilla (26 × 12) con paredes en columnas 0-1 y 28-29
//   filas 14-16 piso (plataforma atravesable en columnas 13-16 si hay apertura "aba")
//   puertas laterales en filas 11-13

import type { Azar } from "minialu";
import { plantillaPara } from "../../contenido/plantillas.ts";
import type { Barrera, Dir } from "../tipos.ts";
import type { TipoSala } from "./generador.ts";

export const TILE = 16;
export const COLS = 30;
export const FILAS = 17;
export const ANCHO_SALA = COLS * TILE;
export const ALTO_SALA = FILAS * TILE;

export const T_VACIO = 0;
export const T_ROCA = 1;
export const T_PLATAFORMA = 2;
export const T_PINCHOS = 3;
export const T_CRISTAL = 4;
export const T_RAICES = 5;

export const FILAS_PUERTA = [11, 12, 13] as const;
export const COLS_POZO = [13, 14, 15, 16] as const;
/** Escalera de plataformas que lleva al pozo de subida (separadas para un salto simple). */
export const FILAS_ESCALERA = [11, 8, 5] as const;

export type TipoSpawn =
  | "caminante" | "saltador" | "volador" | "torreta" | "escudero"
  | "cofre" | "altar" | "faro" | "reliquia" | "mercader" | "jefe" | "eco" | "jugador" | "yunque";

export const ENEMIGOS_SPAWN: ReadonlySet<TipoSpawn> = new Set(["caminante", "saltador", "volador", "torreta", "escudero"]);

const LEYENDA: Readonly<Record<string, TipoSpawn>> = {
  e: "caminante", s: "saltador", v: "volador", t: "torreta", g: "escudero",
  C: "cofre", A: "altar", F: "faro", R: "reliquia", M: "mercader", J: "jefe", E: "eco", P: "jugador", Y: "yunque",
};

export interface Spawn {
  readonly tipo: TipoSpawn;
  readonly tx: number;
  readonly ty: number;
}

export interface DatosSala {
  readonly tiles: Uint8Array;
  readonly spawns: readonly Spawn[];
  readonly nombre: string;
}

export type AperturasSala = Partial<Record<Dir, { barrera?: Barrera }>>;

export function esSolido(t: number): boolean {
  return t === T_ROCA || t === T_CRISTAL || t === T_RAICES;
}

export function indice(tx: number, ty: number): number {
  return ty * COLS + tx;
}

export function construirSala(tipo: TipoSala, semilla: number, ap: AperturasSala, azar: Azar, densidadEnemigos: number): DatosSala {
  const plantilla = plantillaPara(tipo, semilla);
  const tiles = new Uint8Array(COLS * FILAS).fill(T_ROCA);
  const spawns: Spawn[] = [];

  plantilla.filas.forEach((fila, iy) => {
    for (let ix = 0; ix < fila.length; ix++) {
      const tx = ix + 2;
      const ty = iy + 2;
      const c = fila[ix];
      tiles[indice(tx, ty)] = c === "#" ? T_ROCA : c === "=" ? T_PLATAFORMA : c === "^" ? T_PINCHOS : T_VACIO;
      const s = LEYENDA[c];
      if (s !== undefined && (!ENEMIGOS_SPAWN.has(s) || azar.siguiente() < densidadEnemigos)) {
        spawns.push({ tipo: s, tx, ty });
      }
    }
  });

  const puerta = (cols: readonly number[], barrera?: Barrera): void => {
    for (const ty of FILAS_PUERTA) {
      for (const tx of cols) tiles[indice(tx, ty)] = T_VACIO;
    }
    if (barrera !== undefined) {
      const t = barrera === "cristal" ? T_CRISTAL : T_RAICES;
      for (const ty of FILAS_PUERTA) tiles[indice(cols[1], ty)] = t;
    }
  };
  if (ap.izq !== undefined) puerta([0, 1], ap.izq.barrera);
  if (ap.der !== undefined) puerta([29, 28], ap.der.barrera);

  if (ap.arr !== undefined) {
    for (let ty = 0; ty <= 4; ty++) {
      for (const tx of COLS_POZO) tiles[indice(tx, ty)] = T_VACIO;
    }
    for (const ty of FILAS_ESCALERA) {
      for (let tx = 12; tx <= 17; tx++) {
        if (tiles[indice(tx, ty)] === T_VACIO) tiles[indice(tx, ty)] = T_PLATAFORMA;
      }
    }
  }
  if (ap.aba !== undefined) {
    for (const tx of COLS_POZO) {
      tiles[indice(tx, 14)] = T_PLATAFORMA;
      tiles[indice(tx, 15)] = T_VACIO;
      tiles[indice(tx, 16)] = T_VACIO;
    }
  }

  return { tiles, spawns, nombre: plantilla.nombre };
}
