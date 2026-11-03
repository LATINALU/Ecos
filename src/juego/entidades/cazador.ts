// CAZADOR DE PORTADORES: llega cuando acumulas demasiado Peso del Eco. Atraviesa paredes, te sigue de sala en sala
// (entra por la misma puerta que tú) y no se detiene al recibir golpes. Se puede matar, pero aguanta mucho.

import type { Contexto } from "../contexto.ts";
import { Criatura } from "./criatura.ts";

export class Cazador extends Criatura {
  private readonly velocidad: number;
  private retroceso = 0;
  private aparicion = 1.2;

  constructor(x: number, y: number, s: { hp: number; ataque: number; defensa: number; velocidad: number }, hp?: number) {
    super({ nombre: "Cazador de Portadores", hp: s.hp, ataque: s.ataque, defensa: s.defensa, exp: 60, w: 14, h: 30, categoria: "elite" }, x, y - 30, true);
    this.velocidad = s.velocidad;
    if (hp !== undefined) this.hp = Math.max(1, Math.min(this.hpMax, hp));
  }

  /** No se aturde ni lo empujan: es implacable. */
  override empujar(): void {
    this.retroceso = 0.25;
  }

  protected pensar(dt: number, ctx: Contexto): void {
    const j = ctx.jugador;
    this.aparicion = Math.max(0, this.aparicion - dt);
    this.retroceso = Math.max(0, this.retroceso - dt);
    this.aturdido = 0;
    const dx = j.cx - this.cx;
    const dy = j.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    this.dir = dx < 0 ? -1 : 1;
    // Flota hacia ti atravesando la roca; al recibir un golpe retrocede un instante.
    const v = this.aparicion > 0 ? 0 : this.retroceso > 0 ? -this.velocidad * 0.6 : this.velocidad;
    this.vx += ((dx / d) * v - this.vx) * Math.min(1, dt * 3);
    this.vy += ((dy / d) * v - this.vy) * Math.min(1, dt * 3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.random() < dt * 14) ctx.fx.chispas(this.cx + (Math.random() - 0.5) * 10, this.y + this.h, "#2a0a24", 1, { velocidad: 20, gravedad: -30, vida: 0.8 });
  }

  override danioContacto(): number {
    return this.aparicion > 0 ? 0 : this.ataque;
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const k = 1 - this.aparicion / 1.2;
    g.save();
    g.globalAlpha = 0.85 * k + Math.sin(this.t * 13) * 0.05;
    // Capa larga y deshilachada
    const ondea = Math.sin(this.t * 5) * 2;
    g.fillStyle = this.color("#120814");
    g.fillRect(x + 1, y + 6, this.w - 2, this.h - 6);
    for (let i = 0; i < 5; i++) g.fillRect(x + i * 3 + Math.round(ondea * (i % 2 === 0 ? 1 : -1)), y + this.h - 1, 2, 3 + (i % 3));
    // Capucha
    g.fillStyle = this.color("#24102a");
    g.fillRect(x + 2, y, this.w - 4, 9);
    g.fillRect(x + 1, y + 3, this.w - 2, 5);
    g.fillStyle = "#000000";
    g.fillRect(x + 4, y + 3, this.w - 8, 5);
    // Ojo-farol rojo
    const ojo = this.dir > 0 ? x + this.w - 6 : x + 4;
    g.fillStyle = "#ff2a3d";
    g.fillRect(ojo, y + 4, 2, 2);
    // Garras
    g.fillStyle = this.color("#3a1a3a");
    g.fillRect(this.dir > 0 ? x + this.w - 1 : x - 3, y + 13, 4, 2);
    g.fillRect(this.dir > 0 ? x + this.w : x - 4, y + 15, 3, 1);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.35 * k;
    g.fillStyle = "#ff2a3d";
    g.fillRect(ojo - 2, y + 2, 6, 6);
    g.restore();
  }
}
