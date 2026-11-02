// Proyectiles de ambos bandos. Los del jugador llevan un AtaqueJugador; los enemigos, un ataque bruto.

import { mover, solidoEnPunto, type Rect } from "../../motor/fisica.ts";
import type { AtaqueJugador, Contexto } from "../contexto.ts";
import type { Criatura } from "./criatura.ts";

export type TipoProyectil = "orbe" | "lanza" | "onda" | "espora" | "hueso" | "bala" | "fuego" | "sombra";

export interface OpcionesProyectil {
  readonly tipo: TipoProyectil;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly w?: number;
  readonly h?: number;
  readonly vida?: number;
  readonly gravedad?: number;
  readonly atraviesa?: boolean;
  readonly atraviesaParedes?: boolean;
  /** Radio de explosión al chocar (0 = no explota). */
  readonly explota?: number;
  /** Ondas: se pegan al piso y mueren al llegar a una pared o al vacío. */
  readonly rastrero?: boolean;
  readonly color: string;
  readonly ataqueJugador?: AtaqueJugador;
  readonly ataqueEnemigo?: number;
}

export class Proyectil implements Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  vida: number;
  muerto = false;
  t = 0;
  enSuelo = false;
  readonly golpeados = new Set<Criatura>();
  readonly op: OpcionesProyectil;

  constructor(op: OpcionesProyectil) {
    this.op = op;
    this.w = op.w ?? 6;
    this.h = op.h ?? 6;
    this.x = op.x - this.w / 2;
    this.y = op.y - this.h / 2;
    this.vx = op.vx;
    this.vy = op.vy;
    this.vida = op.vida ?? 3;
  }

  get deJugador(): boolean {
    return this.op.ataqueJugador !== undefined;
  }

  actualizar(dt: number, ctx: Contexto): void {
    this.t += dt;
    this.vida -= dt;
    if (this.vida <= 0) {
      this.morir(ctx);
      return;
    }
    this.vy += (this.op.gravedad ?? 0) * dt;
    if (this.op.rastrero === true) {
      const c = { x: this.x, y: this.y, w: this.w, h: this.h, vx: this.vx, vy: 400, enSuelo: false };
      const contacto = mover(c, ctx.tiles, dt);
      this.x = c.x;
      this.y = c.y;
      if (contacto.pared !== 0 || this.t > 0.15 && !contacto.suelo) this.morir(ctx);
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.op.atraviesaParedes !== true && solidoEnPunto(ctx.tiles, this.x + this.w / 2, this.y + this.h / 2)) {
        this.morir(ctx);
        return;
      }
    }
    // Estela
    if (Math.random() < 0.7) {
      ctx.fx.chispas(this.x + this.w / 2, this.y + this.h / 2, this.op.color, 1, { velocidad: 15, vida: 0.3, gravedad: 0, brillo: true });
    }
    if (this.x < -40 || this.x > 520 || this.y < -60 || this.y > 320) this.muerto = true;
  }

  /** Al impactar: los que no atraviesan mueren (y quizás explotan). */
  impacto(ctx: Contexto): void {
    if (this.op.atraviesa !== true) this.morir(ctx);
  }

  morir(ctx: Contexto): void {
    if (this.muerto) return;
    this.muerto = true;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const r = this.op.explota ?? 0;
    ctx.fx.chispas(cx, cy, this.op.color, r > 0 ? 26 : 6, { velocidad: r > 0 ? 140 : 60, vida: 0.4, brillo: true });
    if (r > 0) {
      ctx.audio.reproducir("explosion");
      ctx.fx.sacudir(3);
      const area = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
      if (this.op.ataqueJugador !== undefined) {
        ctx.golpearArea(area, this.op.ataqueJugador, Math.sign(this.vx) || 1, this.golpeados);
      } else if (this.op.ataqueEnemigo !== undefined) {
        const j = ctx.jugador;
        if (j.x < area.x + area.w && j.x + j.w > area.x && j.y < area.y + area.h && j.y + j.h > area.y) {
          ctx.golpearJugador(this.op.ataqueEnemigo, cx);
        }
      }
    }
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const cx = Math.round(this.x + this.w / 2);
    const cy = Math.round(this.y + this.h / 2);
    const c = this.op.color;
    g.save();
    g.globalCompositeOperation = "lighter";
    switch (this.op.tipo) {
      case "lanza": {
        const d = Math.sign(this.vx) || 1;
        g.fillStyle = c;
        g.fillRect(cx - 9, cy - 1, 18, 3);
        g.fillStyle = "#ffffff";
        g.fillRect(cx + (d > 0 ? 5 : -9), cy - 2, 4, 5);
        break;
      }
      case "onda": {
        g.fillStyle = c;
        const alto = 10 + Math.sin(this.t * 30) * 3;
        g.fillRect(cx - 3, Math.round(this.y + this.h - alto), 6, alto);
        g.globalAlpha = 0.5;
        g.fillRect(cx - 6, Math.round(this.y + this.h - alto * 0.6), 12, alto * 0.6);
        break;
      }
      case "hueso":
        g.fillStyle = "#e8e0cc";
        g.fillRect(cx - 1, cy - 4, 3, 8);
        g.fillRect(cx - 2, cy - 4, 5, 2);
        g.fillRect(cx - 2, cy + 2, 5, 2);
        break;
      default: {
        const r = this.w / 2 + Math.sin(this.t * 20);
        g.fillStyle = c;
        g.globalAlpha = 0.35;
        g.beginPath();
        g.arc(cx, cy, r + 3, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#ffffff";
        g.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }
    g.restore();
  }
}
