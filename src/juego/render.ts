// Arte procedural: tiles, fondos con paralaje e iluminación. Todo se dibuja con código (sin imágenes).

import type { Bioma } from "../contenido/biomas.ts";
import { ALTO_SALA, ANCHO_SALA, COLS, FILAS, T_CRISTAL, T_PINCHOS, T_PLATAFORMA, T_RAICES, TILE, esSolido } from "../dominio/mundo/sala.ts";
import { DECORADO, LOSA, PARED_FONDO, PINCHOS, ROCA, type Rect } from "../contenido/atlas.ts";
import type { Tiles } from "../motor/fisica.ts";
import { dibujarRecorte, sprites, type Lienzo } from "../motor/sprites.ts";

function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Hash entero determinista (para que el "ruido" de las rocas no parpadee). */
function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface SalaDibujada {
  readonly lienzo: HTMLCanvasElement;
  /** Fuentes de luz del decorado (faroles, ventanas) para la iluminación dinámica. */
  readonly luces: readonly Luz[];
}

/** Sala con el tileset del castillo (teñido por bioma); si la imagen no está, versión procedural. */
export function prerenderSala(t: Tiles, b: Bioma, semilla: number, especial = false): SalaDibujada {
  const atlas = sprites.tenida("castillo", b.tinte[0], b.tinte[1]);
  if (atlas === null) return { lienzo: prerenderProcedural(t, b, semilla), luces: [] };
  const luces: Luz[] = [];
  return { lienzo: prerenderConAtlas(t, b, semilla, atlas, especial, luces), luces };
}

function prerenderConAtlas(t: Tiles, b: Bioma, semilla: number, atlas: Lienzo, especial: boolean, luces: Luz[]): HTMLCanvasElement {
  const [c, g] = lienzo(ANCHO_SALA, ALTO_SALA);
  const solido = (x: number, y: number): boolean => x < 0 || y < 0 || x >= COLS || y >= FILAS ? true : esSolido(t.tile(x, y));
  const tile = (x: number, y: number): number => x < 0 || y < 0 || x >= COLS || y >= FILAS ? 1 : t.tile(x, y);
  const poner = (r: Rect, x: number, y: number): void => dibujarRecorte(g, atlas, r, x, y);

  // 1. Pared de fondo (ladrillo violeta), tenue, para que se vea el paralaje detrás.
  g.globalAlpha = 0.32;
  for (let ty = 0; ty < FILAS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (!solido(tx, ty)) poner(PARED_FONDO[(tx % 2) + (ty % 2) * 2], tx * TILE, ty * TILE);
    }
  }
  g.globalAlpha = 1;

  // 2. Decorado de fondo: ventana gótica en salas especiales, cadenas, faroles y estandartes colgando del techo.
  if (especial) {
    g.globalAlpha = 0.55;
    poner(DECORADO.ventana, ANCHO_SALA / 2 - 32, 3 * TILE);
    g.globalAlpha = 1;
    luces.push({ x: ANCHO_SALA / 2, y: 6 * TILE, r: 70, fuerza: 0.35 });
  }
  for (let tx = 3; tx < COLS - 3; tx++) {
    if (!solido(tx, 1) || solido(tx, 2) || (tx >= 11 && tx <= 18)) continue;
    const r = hash(tx, semilla, 31);
    const libreAbajo = (n: number): boolean => {
      for (let k = 2; k < 2 + n; k++) if (solido(tx, k) || solido(tx + 1, k) || tile(tx, k) === T_PLATAFORMA) return false;
      return true;
    };
    if (r < 0.07 && solido(tx + 1, 1) && libreAbajo(6)) {
      poner(DECORADO.farol, tx * TILE, 2 * TILE - 16);
      luces.push({ x: tx * TILE + 16, y: 2 * TILE + 44, r: 46, fuerza: 0.75 });
      tx += 2;
    } else if (r < 0.16) {
      poner(DECORADO.cadena, tx * TILE, 2 * TILE);
    } else if (r < 0.22 && libreAbajo(3)) {
      poner(DECORADO.estandarte, tx * TILE, 2 * TILE);
      tx += 1;
    }
  }

  // 3. Tiles sólidos según qué lados quedan al aire.
  for (let ty = 0; ty < FILAS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const tl = t.tile(tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      if (tl === 1) {
        const ar = !solido(tx, ty - 1);
        const ab = !solido(tx, ty + 1);
        const iz = !solido(tx - 1, ty);
        const de = !solido(tx + 1, ty);
        const r = ar && iz ? ROCA.arribaIzq : ar && de ? ROCA.arribaDer : ab && iz ? ROCA.abajoIzq : ab && de ? ROCA.abajoDer
          : ar ? ROCA.arriba : ab ? ROCA.abajo : iz ? ROCA.izquierda : de ? ROCA.derecha : ROCA.interior;
        poner(r, px, py);
        // Las zonas de roca maciza se oscurecen: así el pasillo jugable resalta.
        if (r === ROCA.interior) {
          g.fillStyle = "rgba(6,4,12,0.25)";
          g.fillRect(px, py, TILE, TILE);
        }
      } else if (tl === T_PLATAFORMA) {
        const izq = tile(tx - 1, ty) === T_PLATAFORMA;
        const der = tile(tx + 1, ty) === T_PLATAFORMA;
        poner(!izq ? LOSA.izquierda : !der ? LOSA.derecha : LOSA.centro, px, py);
      } else if (tl === T_PINCHOS) {
        poner(PINCHOS, px, py + TILE - PINCHOS[3]);
      }
    }
  }
  // Un toque del color del bioma en los bordes expuestos (musgo, esporas, brasas).
  g.fillStyle = b.acento;
  g.globalAlpha = 0.35;
  for (let ty = 1; ty < FILAS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (t.tile(tx, ty) === 1 && !solido(tx, ty - 1) && hash(tx, ty, semilla) < 0.35) {
        g.fillRect(tx * TILE + Math.floor(hash(ty, tx, 3) * 12), ty * TILE - 1, 2 + Math.floor(hash(tx, 9) * 3), 1);
      }
    }
  }
  g.globalAlpha = 1;
  return c;
}

function prerenderProcedural(t: Tiles, b: Bioma, semilla: number): HTMLCanvasElement {
  const [c, g] = lienzo(ANCHO_SALA, ALTO_SALA);
  const solido = (x: number, y: number): boolean => x < 0 || y < 0 || x >= COLS || y >= FILAS ? true : esSolido(t.tile(x, y));
  for (let ty = 0; ty < FILAS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const tile = t.tile(tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      if (tile === 1) {
        g.fillStyle = b.roca;
        g.fillRect(px, py, TILE, TILE);
        // textura
        for (let i = 0; i < 6; i++) {
          const r = hash(tx, ty, i + semilla);
          g.fillStyle = r < 0.5 ? b.rocaOscuro : b.rocaClaro;
          g.globalAlpha = 0.5;
          g.fillRect(px + Math.floor(hash(tx, ty, i * 7) * 15), py + Math.floor(hash(ty, tx, i * 3) * 15), 1 + Math.floor(r * 3), 1);
        }
        g.globalAlpha = 1;
        // ladrillos sutiles
        if ((tx + ty) % 2 === 0) {
          g.fillStyle = b.rocaOscuro;
          g.globalAlpha = 0.35;
          g.fillRect(px, py + 7, TILE, 1);
          g.fillRect(px + (ty % 2 === 0 ? 5 : 11), py, 1, 7);
          g.globalAlpha = 1;
        }
        // bordes expuestos
        if (!solido(tx, ty - 1)) {
          g.fillStyle = b.rocaClaro;
          g.fillRect(px, py, TILE, 2);
          g.fillStyle = b.acento;
          g.globalAlpha = 0.5;
          for (let i = 0; i < 3; i++) {
            if (hash(tx, ty, 99 + i) < 0.45) g.fillRect(px + Math.floor(hash(tx, i, 5) * 14), py - 1, 1 + Math.floor(hash(i, tx) * 2), 2);
          }
          g.globalAlpha = 1;
        }
        if (!solido(tx, ty + 1)) {
          g.fillStyle = b.rocaOscuro;
          g.fillRect(px, py + TILE - 2, TILE, 2);
          if (hash(tx, ty, 7) < 0.3) g.fillRect(px + 4 + Math.floor(hash(tx, 3) * 8), py + TILE, 2, 2 + Math.floor(hash(ty, 4) * 4));
        }
        if (!solido(tx - 1, ty)) {
          g.fillStyle = b.rocaClaro;
          g.globalAlpha = 0.6;
          g.fillRect(px, py, 1, TILE);
          g.globalAlpha = 1;
        }
        if (!solido(tx + 1, ty)) {
          g.fillStyle = b.rocaOscuro;
          g.fillRect(px + TILE - 1, py, 1, TILE);
        }
      } else if (tile === T_PLATAFORMA) {
        g.fillStyle = b.plataforma;
        g.fillRect(px, py, TILE, 3);
        g.fillStyle = b.rocaOscuro;
        g.fillRect(px, py + 3, TILE, 1);
        if (tx % 3 === 0) {
          g.fillStyle = b.plataforma;
          g.globalAlpha = 0.5;
          g.fillRect(px + 7, py + 4, 2, 5);
          g.globalAlpha = 1;
        }
      } else if (tile === T_PINCHOS) {
        g.fillStyle = "#d9d2c3";
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.moveTo(px + i * 4, py + TILE);
          g.lineTo(px + i * 4 + 2, py + TILE - 9);
          g.lineTo(px + i * 4 + 4, py + TILE);
          g.fill();
        }
        g.fillStyle = "#ff4d4d";
        for (let i = 0; i < 4; i++) g.fillRect(px + i * 4 + 2, py + TILE - 9, 1, 2);
      }
    }
  }
  return c;
}

/** Barreras animadas (no van en el prerender porque se rompen). */
export function dibujarBarreras(g: CanvasRenderingContext2D, t: Tiles, tiempo: number): void {
  for (let ty = 0; ty < FILAS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const tile = t.tile(tx, ty);
      if (tile !== T_CRISTAL && tile !== T_RAICES) continue;
      const px = tx * TILE;
      const py = ty * TILE;
      if (tile === T_CRISTAL) {
        g.fillStyle = "#1d3a4a";
        g.fillRect(px, py, TILE, TILE);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.6 + Math.sin(tiempo * 4 + ty) * 0.25;
        g.fillStyle = "#7fe3ff";
        g.beginPath();
        g.moveTo(px + 8, py);
        g.lineTo(px + 15, py + 8);
        g.lineTo(px + 8, py + 16);
        g.lineTo(px + 1, py + 8);
        g.fill();
        g.fillStyle = "#ffffff";
        g.fillRect(px + 6, py + 4, 2, 5);
        g.restore();
      } else {
        g.fillStyle = "#2a1f14";
        g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = "#7a5a2a";
        g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          const ox = Math.sin(tiempo * 1.5 + i + ty) * 2;
          g.moveTo(px + 3 + i * 5 + ox, py);
          g.lineTo(px + 1 + i * 5 - ox, py + 8);
          g.lineTo(px + 4 + i * 5 + ox, py + 16);
          g.stroke();
        }
        g.fillStyle = "#c4ff7a";
        if (Math.floor(tiempo * 2 + tx) % 3 === 0) g.fillRect(px + 7, py + 6, 2, 2);
      }
    }
  }
}

const cacheFondos = new Map<string, HTMLCanvasElement>();

/** Fondo de dos capas (lejana y media). Más ancho que la pantalla para el paralaje. */
export function fondoBioma(b: Bioma, capa: 0 | 1): HTMLCanvasElement {
  const clave = `${b.nombre}:${capa}`;
  const hecho = cacheFondos.get(clave);
  if (hecho !== undefined) return hecho;
  const W = ANCHO_SALA + 80;
  const [c, g] = lienzo(W, ALTO_SALA);
  if (capa === 0) {
    const grad = g.createLinearGradient(0, 0, 0, ALTO_SALA);
    grad.addColorStop(0, b.cielo[0]);
    grad.addColorStop(1, b.cielo[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, ALTO_SALA);
  }
  const color = capa === 0 ? b.rocaOscuro : b.roca;
  g.fillStyle = color;
  g.globalAlpha = capa === 0 ? 0.55 : 0.35;
  const n = capa === 0 ? 7 : 5;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * W + hash(i, capa) * 40;
    const ancho = 30 + hash(i, 3, capa) * 40;
    const H = ALTO_SALA;
    switch (b.fondo) {
      case "arcos": {
        // arcos y columnas de osario
        g.fillRect(x, 40 + hash(i, 1) * 40, ancho * 0.4, H);
        g.fillRect(x + ancho, 40 + hash(i, 2) * 40, ancho * 0.4, H);
        g.beginPath();
        g.arc(x + ancho * 0.7, 60 + hash(i, 4) * 30, ancho * 0.7, Math.PI, 0);
        g.lineWidth = 8;
        g.strokeStyle = color;
        g.stroke();
        for (let k = 0; k < 4; k++) g.fillRect(x + k * 9, 30 + k * 13 + hash(i, k) * 20, 5, 4);
        break;
      }
      case "hongos": {
        const alto = 90 + hash(i, 5) * 100;
        g.fillRect(x + ancho / 2 - 4, H - alto, 8 + capa * 3, alto);
        g.beginPath();
        g.ellipse(x + ancho / 2, H - alto, ancho * 0.9, 18 + capa * 4, 0, Math.PI, 0);
        g.fill();
        break;
      }
      case "cadenas": {
        g.fillRect(x, 0, 6, 80 + hash(i, 6) * 120);
        for (let k = 0; k < 8; k++) g.fillRect(x - 2, k * 14, 10, 6);
        g.fillRect(x + 20, H - 80 - hash(i, 7) * 60, ancho, 14);
        g.fillRect(x + 20 + ancho / 2 - 6, H - 66 - hash(i, 7) * 60, 12, 200);
        break;
      }
      case "cristales": {
        // estalagmitas y estalactitas de hielo
        const alto = 60 + hash(i, 5) * 110;
        g.beginPath();
        g.moveTo(x, H);
        g.lineTo(x + ancho / 2, H - alto);
        g.lineTo(x + ancho, H);
        g.fill();
        const arriba = 30 + hash(i, 8) * 70;
        g.beginPath();
        g.moveTo(x + ancho * 0.6, 0);
        g.lineTo(x + ancho * 0.8, arriba);
        g.lineTo(x + ancho, 0);
        g.fill();
        break;
      }
      case "ruinas": {
        // columnas partidas y arcos hundidos
        const alto = 70 + hash(i, 5) * 120;
        g.fillRect(x, H - alto, ancho * 0.35, alto);
        g.fillRect(x - 4, H - alto, ancho * 0.35 + 8, 6);
        g.fillRect(x + ancho * 0.5, H - alto * 0.5, ancho * 0.3, alto * 0.5);
        g.beginPath();
        g.arc(x + ancho * 0.3, H - alto * 0.8, ancho * 0.5, Math.PI, Math.PI * 1.6);
        g.lineWidth = 6;
        g.strokeStyle = color;
        g.stroke();
        break;
      }
      case "estantes": {
        // estanterías altas con libros
        const alto = 120 + hash(i, 5) * 120;
        g.fillRect(x, H - alto, ancho, 4);
        g.fillRect(x, H - alto, 4, alto);
        g.fillRect(x + ancho - 4, H - alto, 4, alto);
        for (let k = 1; k < alto / 22; k++) {
          g.fillRect(x, H - alto + k * 22, ancho, 3);
          for (let l = 4; l < ancho - 6; l += 5) g.fillRect(x + l, H - alto + k * 22 - 4 - (hash(k, l, i) * 8), 3, 4 + hash(l, k) * 8);
        }
        break;
      }
      case "espinas": {
        // enredaderas con espinas que cuelgan y suben
        for (let k = 0; k < H; k += 3) {
          const ox = Math.sin(k * 0.05 + i) * 8;
          g.fillRect(x + ox, k, 3, 3);
          if (k % 15 === 0) g.fillRect(x + ox + (k % 30 === 0 ? 3 : -3), k, 3, 1);
        }
        g.beginPath();
        g.arc(x + ancho * 0.5, H - 20 - hash(i, 9) * 40, 8 + hash(i, 3) * 6, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "engranajes": {
        // ruedas dentadas y tubos
        const cy = 40 + hash(i, 5) * (H - 80);
        const radio = 14 + hash(i, 6) * 26;
        g.beginPath();
        g.arc(x + radio, cy, radio, 0, Math.PI * 2);
        g.fill();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          g.fillRect(x + radio + Math.cos(a) * (radio + 2) - 3, cy + Math.sin(a) * (radio + 2) - 3, 6, 6);
        }
        g.fillRect(x + radio * 2, cy - 3, ancho, 6);
        break;
      }
      case "tumbas": {
        // lápidas y estrellas
        const alto = 18 + hash(i, 5) * 30;
        g.fillRect(x, H - alto, 14 + capa * 4, alto);
        g.beginPath();
        g.arc(x + 7 + capa * 2, H - alto, 7 + capa * 2, Math.PI, 0);
        g.fill();
        g.fillRect(x + 30, H - alto * 1.6, 3, alto * 1.6);
        g.fillRect(x + 25, H - alto * 1.3, 13, 3);
        if (capa === 0) {
          g.globalAlpha = 0.9;
          g.fillStyle = "#ffffff";
          for (let k = 0; k < 6; k++) g.fillRect(x + hash(i, k, 1) * 60, hash(k, i, 2) * H * 0.6, 1, 1);
          g.fillStyle = color;
          g.globalAlpha = 0.55;
        }
        break;
      }
      case "vacio": {
        // rocas flotando y venas latiendo
        const cy = 30 + hash(i, 5) * (H - 60);
        g.beginPath();
        g.ellipse(x + ancho / 2, cy, ancho * 0.6, ancho * 0.3, hash(i, 7), 0, Math.PI * 2);
        g.fill();
        g.fillRect(x + ancho / 2 - 1, cy, 2, 30 + hash(i, 8) * 60);
        break;
      }
    }
  }
  g.globalAlpha = 1;
  cacheFondos.set(clave, c);
  return c;
}

/** Siluetas oscuras en primer plano (paralaje rápido): dan profundidad sin tapar el juego. */
export function primerPlano(b: Bioma): HTMLCanvasElement {
  const clave = `pp:${b.nombre}`;
  const hecho = cacheFondos.get(clave);
  if (hecho !== undefined) return hecho;
  const W = ANCHO_SALA + 160;
  const [c, g] = lienzo(W, 270);
  g.fillStyle = "#050308";
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * W + hash(i, 7) * 30;
    const largo = 6 + hash(i, 8) * 22;
    const estilo = b.fondo === "hongos" || b.fondo === "espinas" ? "raices"
      : b.fondo === "cadenas" || b.fondo === "engranajes" ? "ganchos" : "cadenas";
    switch (estilo) {
      case "cadenas":
        // cadenas y huesos colgando
        for (let k = 0; k < largo; k += 4) g.fillRect(x + (k % 8 === 0 ? 0 : 1), k, 2, 3);
        g.fillRect(x - 3, largo, 8, 3);
        break;
      case "raices":
        // raíces
        for (let k = 0; k < largo + 6; k++) g.fillRect(x + Math.round(Math.sin(k * 0.4 + i) * 2), k, 2, 1);
        g.fillRect(x - 1, largo + 6, 4, 4);
        break;
      case "ganchos":
        // ganchos y cadenas de fragua
        for (let k = 0; k < largo; k += 4) g.fillRect(x, k, 2, 3);
        g.fillRect(x - 2, largo, 6, 2);
        g.fillRect(x + 3, largo - 4, 2, 6);
        break;
    }
    // escombros abajo: montículos escalonados, bajos para no tapar el piso
    const ancho = 10 + Math.floor(hash(i, 10) * 16);
    for (let k = 0; k < ancho; k++) {
      const alto = Math.max(1, Math.round(4 * Math.sin((k / ancho) * Math.PI) + hash(i, k) * 1.5));
      g.fillRect(x + 20 + k, 270 - alto, 1, alto);
    }
  }
  cacheFondos.set(clave, c);
  return c;
}

let vineta: HTMLCanvasElement | null = null;

/** Viñeta: oscurece los bordes de la pantalla (encuadre cinematográfico). */
export function dibujarVineta(g: CanvasRenderingContext2D): void {
  if (vineta === null) {
    const [c, v] = lienzo(ANCHO_SALA, 270);
    const grad = v.createRadialGradient(ANCHO_SALA / 2, 135, 120, ANCHO_SALA / 2, 135, 290);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    v.fillStyle = grad;
    v.fillRect(0, 0, ANCHO_SALA, 270);
    vineta = c;
  }
  g.drawImage(vineta, 0, 0);
}

export interface Luz {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly fuerza?: number;
}

/** Oscuridad con agujeros de luz (destination-out sobre una capa negra). */
export class Iluminacion {
  private readonly c: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;

  constructor(w: number, h: number) {
    [this.c, this.g] = lienzo(w, h);
  }

  dibujar(destino: CanvasRenderingContext2D, oscuridad: number, luces: readonly Luz[], tinte: string): void {
    const g = this.g;
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, this.c.width, this.c.height);
    g.fillStyle = `rgba(4,2,10,${oscuridad})`;
    g.fillRect(0, 0, this.c.width, this.c.height);
    g.globalCompositeOperation = "destination-out";
    for (const l of luces) {
      const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      grad.addColorStop(0, `rgba(0,0,0,${l.fuerza ?? 1})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.globalCompositeOperation = "source-over";
    destino.drawImage(this.c, 0, 0);
    destino.fillStyle = tinte;
    destino.fillRect(0, 0, this.c.width, this.c.height);
  }
}
