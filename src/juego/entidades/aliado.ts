// ESPECTRO TEMPORAL: el Eco con el que pactaste en vez de absorberlo. Flota a tu lado durante el piso, ataca a lo
// que tengas cerca con sus golpes y su técnica, y al terminar el piso con vida te devuelve tu mejor pieza mejorada.
// No es una criatura del mundo: los enemigos no lo atacan (es un recuerdo) y no bloquea el paso.

import { alma } from "../../contenido/almas.ts";
import type { Eco } from "../../dominio/eco.ts";
import type { Contexto } from "../contexto.ts";
import { Enemigo } from "./enemigo.ts";
import { dibujarFigura } from "./jefes.ts";
import { Proyectil } from "./proyectil.ts";

export class EspectroAliado {
  readonly eco: Eco;
  x: number;
  y: number;
  private vx = 0;
  private vy = 0;
  private dir = 1;
  private t = 0;
  private cdGolpe = 0;
  private cdTecnica = 2;
  private atacando = 0;
  readonly w = 12;
  readonly h = 22;
  private readonly colores: readonly [string, string];
  private readonly potencia: number;

  constructor(eco: Eco, x: number, y: number) {
    this.eco = eco;
    this.x = x;
    this.y = y;
    const a = eco.forma !== null ? alma(eco.forma.personaje) : null;
    this.colores = a !== null ? [a.color, a.colorSec] : ["#888899", "#ffffff"];
    this.potencia = Math.max(eco.stats.golpe, eco.stats.patada) * 1.1 + eco.stats.tecnica * 0.3;
  }

  get cx(): number {
    return this.x + this.w / 2;
  }

  colocar(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  actualizar(dt: number, ctx: Contexto): void {
    this.t += dt;
    this.cdGolpe -= dt;
    this.cdTecnica -= dt;
    this.atacando = Math.max(0, this.atacando - dt);
    const j = ctx.jugador;
    const objetivo = ctx.criaturas
      .filter((c) => (c instanceof Enemigo || c.esJefe) && !c.muerto && Math.abs(c.cx - j.cx) < 200 && Math.abs(c.cy - j.cy) < 120)
      .sort((a, b) => Math.abs(a.cx - this.cx) - Math.abs(b.cx - this.cx))[0];
    // Flota: hacia el enemigo más cercano a ti o, si no hay, a tu espalda.
    const tx = objetivo !== undefined ? objetivo.cx - Math.sign(objetivo.cx - this.cx || 1) * 16 : j.cx - j.dir * 22;
    const ty = objetivo !== undefined ? objetivo.cy - 12 : j.y - 6 + Math.sin(this.t * 2.5) * 3;
    this.vx += ((tx - this.cx) * 6 - this.vx) * Math.min(1, dt * 6);
    this.vy += ((ty - (this.y + this.h / 2)) * 6 - this.vy) * Math.min(1, dt * 6);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 8) this.dir = this.vx > 0 ? 1 : -1;
    if (objetivo === undefined) return;
    this.dir = objetivo.cx > this.cx ? 1 : -1;
    // Golpe cuerpo a cuerpo
    if (this.cdGolpe <= 0 && Math.abs(objetivo.cx - this.cx) < 30 && Math.abs(objetivo.cy - (this.y + this.h / 2)) < 26) {
      this.cdGolpe = 0.75;
      this.atacando = 0.18;
      ctx.golpearCriatura(objetivo, { potencia: this.potencia, tipo: "golpe", empuje: 110 }, this.dir);
      ctx.fx.chispas(objetivo.cx, objetivo.cy, this.colores[1], 6, { velocidad: 90, brillo: true });
    }
    // Técnica: un proyectil de su color
    if (this.cdTecnica <= 0) {
      this.cdTecnica = 3.2;
      const ang = Math.atan2(objetivo.cy - (this.y + this.h / 2), objetivo.cx - this.cx);
      ctx.agregarProyectil(new Proyectil({
        tipo: "sombra", x: this.cx, y: this.y + this.h / 2, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, w: 10, h: 8, vida: 1.2,
        atraviesa: true, color: this.colores[1], ataqueJugador: { potencia: this.potencia * 1.4, tipo: "tecnica", empuje: 140 },
      }));
    }
  }

  dibujar(g: CanvasRenderingContext2D): void {
    g.save();
    g.globalAlpha = 0.55 + Math.sin(this.t * 6) * 0.1;
    dibujarFigura(g, this.x, this.y, this.dir, this.colores[0], this.colores[1], this.t, this.atacando > 0, Math.abs(this.vx) > 20,
      this.eco.forma !== null ? alma(this.eco.forma.personaje).tipo : 1);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25;
    g.fillStyle = "#9fe8ff";
    g.fillRect(Math.round(this.x) - 2, Math.round(this.y) - 2, this.w + 4, this.h + 4);
    g.restore();
  }
}
