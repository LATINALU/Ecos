// Cosas del escenario: botín en el suelo (con haz de luz según rareza) e interactuables.

import { COLOR_FAMILIA } from "../../contenido/almas.ts";
import { COLORES_RAREZA, apilable } from "../../contenido/objetos.ts";
import type { Premio } from "../../dominio/botin.ts";
import { INFO_RELIQUIA, type Reliquia } from "../../dominio/tipos.ts";
import { COFRE } from "../../contenido/atlas.ts";
import { SUBARMAS } from "../../contenido/subarmas.ts";
import { mover, type Cuerpo, type Tiles } from "../../motor/fisica.ts";
import { dibujarRecorte, sprites } from "../../motor/sprites.ts";
import { dibujarIconoPieza, iconoEquipo, iconoObjeto, imagenDe, type Icono } from "../iconos.ts";
import { GRAVEDAD } from "./criatura.ts";

export function colorPremio(p: Premio): string {
  switch (p.tipo) {
    case "esquirlas": return "#9fe8ff";
    case "objeto": return apilable(p.objeto)?.color ?? "#ffffff";
    case "equipo": return COLORES_RAREZA[p.equipo.rareza];
    case "carta": return p.carta.nivel >= 3 ? "#ffb23d" : COLOR_FAMILIA[p.carta.tipo];
    case "corazones": return "#ff4d6d";
    case "subarma": return SUBARMAS[p.subarma].color;
  }
}

/** ¿Merece haz de luz y fanfarria? */
export function premioDestacado(p: Premio): 0 | 1 | 2 {
  if (p.tipo === "equipo") return p.equipo.rareza >= 4 ? 2 : p.equipo.rareza >= 2 ? 1 : 0;
  if (p.tipo === "carta") return p.carta.nivel >= 5 ? 2 : p.carta.nivel >= 3 ? 1 : 0;
  return 0;
}

export class BotinSuelo implements Cuerpo {
  x: number;
  y: number;
  readonly w = 8;
  readonly h = 8;
  vx: number;
  vy: number;
  enSuelo = false;
  t = 0;
  avisado = false;
  readonly premio: Premio;

  constructor(premio: Premio, x: number, y: number) {
    this.premio = premio;
    this.x = x - 4;
    this.y = y - 4;
    this.vx = (Math.random() - 0.5) * 120;
    this.vy = -160 - Math.random() * 80;
  }

  actualizar(dt: number, tiles: Tiles): void {
    this.t += dt;
    this.vy = Math.min(300, this.vy + GRAVEDAD * dt);
    if (this.enSuelo) this.vx *= 0.8;
    mover(this, tiles, dt);
  }

  get recogible(): boolean {
    return this.t > 0.45;
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const color = colorPremio(this.premio);
    const x = Math.round(this.x);
    const y = Math.round(this.y + Math.sin(this.t * 4) * 1.5);
    const destacado = premioDestacado(this.premio);
    g.save();
    if (destacado > 0) {
      g.globalCompositeOperation = "lighter";
      const alto = destacado === 2 ? 120 : 60;
      const grad = g.createLinearGradient(0, y - alto, 0, y + 8);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, color);
      g.globalAlpha = 0.35 + Math.sin(this.t * 5) * 0.1;
      g.fillStyle = grad;
      g.fillRect(x + 1, y - alto, 6, alto + 8);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
    }
    const icono: Icono | null = this.premio.tipo === "equipo" ? iconoEquipo(this.premio.equipo)
      : this.premio.tipo === "objeto" ? iconoObjeto(this.premio.objeto) : null;
    const img = icono !== null ? imagenDe(icono) : null;
    if (icono !== null && img !== null) {
      const [, , w, h] = icono.rect;
      // Brillo del color de la rareza debajo, para leer el botín de un vistazo.
      g.fillStyle = color;
      g.globalAlpha = 0.6;
      g.fillRect(x - 2, y + 8, 12, 1);
      g.globalAlpha = 0.25;
      g.fillRect(x - 4, y + 9, 16, 1);
      g.globalAlpha = 1;
      dibujarRecorte(g, img, icono.rect, x + 4 - w / 2, y + 8 - h);
      g.restore();
      return;
    }
    switch (this.premio.tipo) {
      case "corazones": {
        // Corazón pixelado (grande si da 5)
        const grande = this.premio.cantidad >= 5;
        const s = grande ? 2 : 1;
        g.fillStyle = color;
        g.fillRect(x + 1 * s, y + 1, 2 * s, 2 * s);
        g.fillRect(x + 4 * s - (grande ? 2 : 0), y + 1, 2 * s, 2 * s);
        g.fillRect(x, y + 2 * s, 7 * s - (grande ? 1 : 0), 2 * s);
        g.fillRect(x + 1 * s, y + 4 * s, 5 * s - (grande ? 2 : 0), 1 * s);
        g.fillRect(x + 2 * s, y + 5 * s, 3 * s - (grande ? 2 : 0), 1 * s);
        g.fillStyle = "#ffffff";
        g.fillRect(x + 1 * s, y + 2 * s, 1, 1);
        break;
      }
      case "subarma":
        dibujarIconoSubarma(g, this.premio.subarma, x + 4, y + 4);
        break;
      case "esquirlas":
        g.fillStyle = color;
        g.fillRect(x + 3, y + 1, 2, 6);
        g.fillRect(x + 2, y + 3, 4, 2);
        g.fillStyle = "#ffffff";
        g.fillRect(x + 3, y + 2, 1, 1);
        break;
      case "objeto":
        g.fillStyle = "#ffffff88";
        g.fillRect(x + 3, y, 2, 2);
        g.fillStyle = color;
        g.fillRect(x + 1, y + 2, 6, 6);
        g.fillStyle = "#ffffff99";
        g.fillRect(x + 2, y + 3, 1, 2);
        break;
      case "equipo":
        dibujarIconoPieza(g, this.premio.equipo.ranura, x + 4, y + 4, color);
        break;
      case "carta":
        g.fillStyle = "#f2e6d0";
        g.fillRect(x, y - 2, 8, 11);
        g.fillStyle = color;
        g.fillRect(x + 1, y - 1, 6, 9);
        g.fillStyle = "#ffffff";
        g.fillRect(x + 3, y + 2, 2, 2);
        break;
    }
    g.restore();
  }
}

/** Ícono procedural de cada subarma, centrado en (cx, cy). */
export function dibujarIconoSubarma(g: CanvasRenderingContext2D, id: keyof typeof SUBARMAS, cx: number, cy: number): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const c = SUBARMAS[id].color;
  switch (id) {
    case "daga":
      g.fillStyle = c;
      g.fillRect(x - 4, y, 7, 1);
      g.fillStyle = "#8a6a3a";
      g.fillRect(x + 3, y - 1, 1, 3);
      g.fillRect(x + 4, y, 2, 1);
      break;
    case "hacha":
      g.fillStyle = "#8a6a3a";
      g.fillRect(x, y - 4, 1, 9);
      g.fillStyle = c;
      g.fillRect(x - 3, y - 4, 3, 4);
      g.fillRect(x + 1, y - 4, 3, 4);
      break;
    case "agua":
      g.fillStyle = "#e8e8f0";
      g.fillRect(x - 1, y - 4, 2, 2);
      g.fillStyle = c;
      g.fillRect(x - 2, y - 2, 4, 5);
      g.fillStyle = "#ffffff";
      g.fillRect(x - 1, y - 1, 1, 2);
      break;
    case "cruz":
      g.fillStyle = c;
      g.fillRect(x - 1, y - 4, 2, 8);
      g.fillRect(x - 3, y - 2, 6, 2);
      break;
  }
}

export type TipoInteractuable = "cofre" | "altar" | "faro" | "reliquia" | "mercader" | "portal" | "yunque";

/** Rarezas de cofre: madera, plata, oro y mítico. */
export const NOMBRE_COFRE = ["Cofre", "Cofre de plata", "Cofre de oro", "Cofre mítico"] as const;
export const COLOR_COFRE = ["#c8a070", "#d8e0ff", "#ffd23d", "#ff4d6d"] as const;

export class Interactuable {
  x: number;
  y: number;
  w: number;
  h: number;
  t = Math.random() * 5;
  usado = false;
  /** Cofres: 0 madera, 1 plata, 2 oro, 3 mítico. */
  nivel = 0;
  /** Cofres: clave para recordar si se abrió. */
  clave = 0;
  readonly tipo: TipoInteractuable;
  readonly reliquia?: Reliquia;

  constructor(tipo: TipoInteractuable, x: number, piso: number, reliquia?: Reliquia) {
    this.tipo = tipo;
    this.reliquia = reliquia;
    const tam: Record<TipoInteractuable, [number, number]> = {
      cofre: [16, 12], altar: [28, 26], faro: [14, 34], reliquia: [16, 24], mercader: [18, 24], portal: [26, 38], yunque: [20, 14],
    };
    [this.w, this.h] = tam[tipo];
    this.x = x - this.w / 2;
    this.y = piso - this.h;
  }

  get cx(): number {
    return this.x + this.w / 2;
  }

  etiqueta(): string {
    switch (this.tipo) {
      case "cofre": return `Abrir ${NOMBRE_COFRE[this.nivel].toLowerCase()}`;
      case "altar": return "Altar de las Almas";
      case "faro": return "Faro de descenso";
      case "reliquia": return this.reliquia !== undefined ? `Tomar: ${INFO_RELIQUIA[this.reliquia].nombre}` : "";
      case "mercader": return "Hablar con el mercader";
      case "portal": return "Descender";
      case "yunque": return "Yunque: craftear y refinar";
    }
  }

  dibujar(g: CanvasRenderingContext2D, acento: string): void {
    this.t += 1 / 60;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const brillo = (color: string, r: number, a = 0.3): void => {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = a + Math.sin(this.t * 3) * 0.08;
      g.fillStyle = color;
      g.beginPath();
      g.arc(this.cx, y + this.h / 2, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    switch (this.tipo) {
      case "cofre": {
        const color = COLOR_COFRE[this.nivel];
        if (!this.usado) brillo(color, 14 + this.nivel * 6, 0.15 + this.nivel * 0.07);
        const atlas = sprites.imagen("castillo");
        if (atlas !== null) {
          const cuadro = this.usado ? 3 : Math.floor(this.t * 1.5) % 4 === 0 ? 1 : 0;
          dibujarRecorte(g, atlas, COFRE[cuadro], x, y + this.h - 16);
          // Herrajes del color de su rareza y destellos en los cofres buenos.
          if (this.nivel > 0) {
            g.fillStyle = color;
            g.fillRect(x + 1, y + this.h - 6, 14, 1);
            g.fillRect(x + 7, y + this.h - 9, 2, 3);
            if (!this.usado && Math.floor(this.t * 4) % 3 === 0) {
              g.fillStyle = "#ffffff";
              g.fillRect(x + 2 + Math.floor(this.t * 7) % 12, y + this.h - 13, 1, 1);
            }
          }
          break;
        }
        g.fillStyle = "#5a3a22";
        g.fillRect(x, y + 4, 16, 8);
        g.fillStyle = this.usado ? "#3a2616" : "#7a5230";
        g.fillRect(x, this.usado ? y : y + 1, 16, 4);
        g.fillStyle = "#ffd23d";
        g.fillRect(x + 7, y + 4, 2, 3);
        g.fillRect(x, y + 7, 16, 1);
        break;
      }
      case "altar":
        brillo(acento, 26, 0.18);
        g.fillStyle = "#3a3448";
        g.fillRect(x, y + 18, 28, 8);
        g.fillRect(x + 4, y + 8, 20, 10);
        g.fillStyle = "#6e6684";
        g.fillRect(x + 2, y + 6, 24, 3);
        for (let i = 0; i < 3; i++) {
          const fy = y + Math.round(Math.sin(this.t * 2 + i * 2) * 2);
          g.fillStyle = ["#d9d2c3", "#a07cff", "#5fd0ff"][i];
          g.fillRect(x + 6 + i * 7, fy, 4, 6);
        }
        break;
      case "faro":
        brillo("#ffe9a8", 30, 0.2);
        g.fillStyle = "#4a4458";
        g.fillRect(x + 4, y + 8, 6, 26);
        g.fillStyle = "#6e6684";
        g.fillRect(x + 2, y + 30, 10, 4);
        g.fillStyle = "#ffe9a8";
        g.fillRect(x + 3, y + 1 + Math.round(Math.sin(this.t * 4)), 8, 7);
        g.fillStyle = "#ffffff";
        g.fillRect(x + 6, y + 3, 2, 3);
        break;
      case "reliquia": {
        const color = this.reliquia !== undefined ? INFO_RELIQUIA[this.reliquia].color : "#ffffff";
        g.fillStyle = "#3a3448";
        g.fillRect(x, y + 16, 16, 8);
        if (!this.usado) {
          brillo(color, 22, 0.35);
          const fy = y + Math.round(Math.sin(this.t * 2.5) * 3);
          g.fillStyle = color;
          g.fillRect(x + 4, fy + 2, 8, 8);
          g.fillStyle = "#ffffff";
          g.fillRect(x + 6, fy + 4, 4, 4);
        }
        break;
      }
      case "mercader": {
        brillo("#ffb23d", 18, 0.14);
        g.fillStyle = "#2c2a3a";
        g.fillRect(x + 3, y + 6, 12, 18);
        g.fillStyle = "#5a4636";
        g.fillRect(x + 1, y + 10, 16, 10);
        g.fillStyle = "#2c2a3a";
        g.fillRect(x + 4, y, 10, 8);
        g.fillStyle = "#ffb23d";
        g.fillRect(x + 6, y + 3, 2, 2);
        g.fillRect(x + 10, y + 3, 2, 2);
        g.fillStyle = "#ffd23d";
        g.fillRect(x + 14, y + 4 + Math.round(Math.sin(this.t * 3) * 2), 4, 6);
        break;
      }
      case "yunque": {
        brillo("#ff9a4d", 16, 0.14);
        g.fillStyle = "#3a3448";
        g.fillRect(x + 6, y + 8, 8, 6);
        g.fillStyle = "#6e6684";
        g.fillRect(x, y + 2, 20, 6);
        g.fillRect(x + 16, y + 3, 4, 3);
        g.fillStyle = "#9a90b0";
        g.fillRect(x + 1, y + 2, 18, 1);
        if (Math.floor(this.t * 2) % 3 === 0) {
          g.fillStyle = "#ffb23d";
          g.fillRect(x + 8 + Math.round(Math.sin(this.t * 9) * 4), y - 1, 1, 1);
        }
        break;
      }
      case "portal": {
        g.save();
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < 4; i++) {
          g.globalAlpha = 0.25;
          g.fillStyle = i % 2 === 0 ? acento : "#ffffff";
          const r = 8 + i * 3 + Math.sin(this.t * 4 + i) * 2;
          g.beginPath();
          g.ellipse(this.cx, y + this.h / 2, r * 0.7, r * 1.3, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
        break;
      }
    }
  }
}
