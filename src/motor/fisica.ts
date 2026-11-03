// Física de plataformas por ejes separados contra la grilla de tiles.
// Plataformas "=" solo frenan desde arriba (y se atraviesan con ↓ + salto). Fuera de la sala no hay tiles
// (así se puede salir por las puertas y los pozos).

import { COLS, FILAS, T_PINCHOS, T_PLATAFORMA, TILE, esSolido } from "../dominio/mundo/sala.ts";

export interface Cuerpo {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  enSuelo: boolean;
}

export interface Tiles {
  tile(tx: number, ty: number): number;
  /** Ancho en tiles si no es una sala estándar (el pueblo es más ancho). */
  readonly cols?: number;
}

export interface Contacto {
  suelo: boolean;
  techo: boolean;
  pared: -1 | 0 | 1;
  pinchos: boolean;
}

export interface OpcionesMovimiento {
  /** Ignorar plataformas atravesables (bajar de una). */
  readonly atravesar?: boolean;
  /** No chocar con nada (fantasmas). */
  readonly fantasma?: boolean;
}

export function tileEn(t: Tiles, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= (t.cols ?? COLS) || ty >= FILAS) return 0;
  return t.tile(tx, ty);
}

export function solidoEnPunto(t: Tiles, px: number, py: number): boolean {
  return esSolido(tileEn(t, Math.floor(px / TILE), Math.floor(py / TILE)));
}

export function mover(c: Cuerpo, t: Tiles, dt: number, op: OpcionesMovimiento = {}): Contacto {
  const contacto: Contacto = { suelo: false, techo: false, pared: 0, pinchos: false };
  if (op.fantasma === true) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.enSuelo = false;
    return contacto;
  }

  // Eje X
  c.x += c.vx * dt;
  {
    const ty0 = Math.floor(c.y / TILE);
    const ty1 = Math.floor((c.y + c.h - 0.01) / TILE);
    if (c.vx > 0) {
      const tx = Math.floor((c.x + c.w) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (esSolido(tileEn(t, tx, ty))) {
          c.x = tx * TILE - c.w - 0.001;
          c.vx = 0;
          contacto.pared = 1;
          break;
        }
      }
    } else if (c.vx < 0) {
      const tx = Math.floor(c.x / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (esSolido(tileEn(t, tx, ty))) {
          c.x = (tx + 1) * TILE + 0.001;
          c.vx = 0;
          contacto.pared = -1;
          break;
        }
      }
    }
  }

  // Eje Y
  const pieAntes = c.y + c.h;
  c.y += c.vy * dt;
  c.enSuelo = false;
  {
    const tx0 = Math.floor(c.x / TILE);
    const tx1 = Math.floor((c.x + c.w - 0.01) / TILE);
    if (c.vy >= 0) {
      const ty = Math.floor((c.y + c.h) / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        const tile = tileEn(t, tx, ty);
        const plataforma = tile === T_PLATAFORMA && op.atravesar !== true && pieAntes <= ty * TILE + 0.5;
        if (esSolido(tile) || plataforma) {
          c.y = ty * TILE - c.h;
          c.vy = 0;
          c.enSuelo = true;
          contacto.suelo = true;
          break;
        }
      }
    } else {
      const ty = Math.floor(c.y / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (esSolido(tileEn(t, tx, ty))) {
          c.y = (ty + 1) * TILE + 0.001;
          c.vy = 0;
          contacto.techo = true;
          break;
        }
      }
    }
  }

  // Pinchos: se tocan con los pies.
  const tyPie = Math.floor((c.y + c.h - 1) / TILE);
  for (let tx = Math.floor((c.x + 2) / TILE); tx <= Math.floor((c.x + c.w - 2) / TILE); tx++) {
    if (tileEn(t, tx, tyPie) === T_PINCHOS) contacto.pinchos = true;
  }
  return contacto;
}

/** ¿Hay suelo justo debajo del punto (para que los caminantes no se caigan de las cornisas)? */
export function haySuelo(t: Tiles, px: number, pyPie: number): boolean {
  const tile = tileEn(t, Math.floor(px / TILE), Math.floor((pyPie + 2) / TILE));
  return esSolido(tile) || tile === T_PLATAFORMA;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function solapan(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function centro(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
