// Base de todo lo que pelea contra el Portador: monstruos, jefes y Ecos.

import type { Categoria } from "../../dominio/botin.ts";
import { mover, type Contacto, type Cuerpo } from "../../motor/fisica.ts";
import type { Contexto } from "../contexto.ts";

export const GRAVEDAD = 980;

export interface DatosCriatura {
  readonly nombre: string;
  readonly hp: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
  readonly w: number;
  readonly h: number;
  readonly categoria: Categoria;
}

export abstract class Criatura implements Cuerpo {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  enSuelo = false;
  dir: -1 | 1 = -1;
  readonly nombre: string;
  hp: number;
  hpMax: number;
  ataque: number;
  defensa: number;
  readonly exp: number;
  readonly categoria: Categoria;
  flash = 0;
  aturdido = 0;
  lento = 0;
  quemadura = 0;
  private danioQuemadura = 0;
  private tickQuemadura = 0;
  /** Cargas de frío (arma de Hielo): a las 4 se congela. */
  frio = 0;
  private tiempoFrio = 0;
  /** Congelado (no se mueve; los jefes solo se ralentizan). */
  congelado = 0;
  /** Dosis de veneno (hasta 3) y su duración. */
  veneno = 0;
  private tiempoVeneno = 0;
  private danioVeneno = 0;
  private tickVeneno = 0;
  muerto = false;
  t = Math.random() * 10;
  /** Índice del spawn en la plantilla (para que no reaparezca en la misma bajada). */
  idSpawn = -1;
  /** Los jefes no se dejan empujar ni aturdir con cualquier cosa. */
  readonly pesado: boolean;

  constructor(d: DatosCriatura, x: number, y: number, pesado = false) {
    this.nombre = d.nombre;
    this.hp = d.hp;
    this.hpMax = d.hp;
    this.ataque = d.ataque;
    this.defensa = d.defensa;
    this.exp = d.exp;
    this.categoria = d.categoria;
    this.w = d.w;
    this.h = d.h;
    this.x = x;
    this.y = y;
    this.pesado = pesado;
  }

  get cx(): number {
    return this.x + this.w / 2;
  }

  get cy(): number {
    return this.y + this.h / 2;
  }

  get esJefe(): boolean {
    return this.categoria === "jefe" || this.categoria === "eco";
  }

  /** Factor de velocidad por ralentización. */
  get ritmo(): number {
    return this.lento > 0 ? 0.5 : 1;
  }

  actualizar(dt: number, ctx: Contexto): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.lento = Math.max(0, this.lento - dt);
    this.congelado = Math.max(0, this.congelado - dt);
    if (this.frio > 0 && (this.tiempoFrio -= dt) <= 0) this.frio = 0;
    if (this.veneno > 0) {
      this.tiempoVeneno -= dt;
      this.tickVeneno -= dt;
      if (this.tickVeneno <= 0) {
        this.tickVeneno = 0.5;
        const n = Math.max(1, Math.round(this.danioVeneno * this.veneno));
        this.aplicarDanio(n, ctx);
        ctx.fx.texto(this.cx, this.y - 2, `${n}`, "#9aff5a");
        ctx.fx.chispas(this.cx, this.cy, "#9aff5a", 3, { velocidad: 30, gravedad: -60 });
      }
      if (this.tiempoVeneno <= 0) this.veneno = 0;
    }
    if (this.quemadura > 0) {
      this.quemadura -= dt;
      this.tickQuemadura -= dt;
      if (this.tickQuemadura <= 0) {
        this.tickQuemadura = 0.5;
        this.aplicarDanio(this.danioQuemadura, ctx);
        ctx.fx.texto(this.cx, this.y - 2, `${this.danioQuemadura}`, "#ff8a3d");
        ctx.fx.chispas(this.cx, this.cy, "#ff7a3d", 4, { velocidad: 40, gravedad: -80, brillo: true });
      }
    }
    if (this.muerto) return;
    if (this.aturdido > 0) {
      this.aturdido -= dt;
      this.vx *= 0.85;
      this.vy += GRAVEDAD * dt;
      this.moverFisica(dt, ctx);
      return;
    }
    this.pensar(dt * this.ritmo, ctx);
  }

  protected moverFisica(dt: number, ctx: Contexto, fantasma = false): Contacto {
    return mover(this, ctx.tiles, dt, { fantasma });
  }

  /** Arma de Hielo: ralentiza y acumula frío; a las 4 cargas congela (los jefes, solo más lentos). */
  enfriar(): boolean {
    this.lento = Math.max(this.lento, 2);
    this.tiempoFrio = 2.5;
    this.frio++;
    if (this.frio < 4) return false;
    this.frio = 0;
    this.congelado = this.pesado ? 0 : 1.2;
    if (!this.pesado) this.aturdido = Math.max(this.aturdido, 1.2);
    else this.lento = Math.max(this.lento, 4);
    return true;
  }

  /** Arma de Veneno: suma una dosis (hasta 3) y renueva la duración. */
  envenenar(danioPorTick: number): void {
    this.veneno = Math.min(3, this.veneno + 1);
    this.tiempoVeneno = 4;
    this.danioVeneno = Math.max(this.danioVeneno, danioPorTick);
    if (this.tickVeneno <= 0) this.tickVeneno = 0.5;
  }

  quemar(danioPorTick: number): void {
    this.quemadura = 3;
    this.danioQuemadura = Math.max(1, Math.round(danioPorTick));
  }

  /** Devuelve true si murió con este daño. */
  aplicarDanio(n: number, _ctx: Contexto): boolean {
    if (this.muerto) return false;
    this.hp -= n;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.muerto = true;
      return true;
    }
    return false;
  }

  empujar(dirX: number, fuerza: number): void {
    if (this.pesado) return;
    this.vx = dirX * fuerza;
    this.vy = Math.min(this.vy, -fuerza * 0.4);
  }

  /** ¿Bloquea este ataque? (escuderos de frente con golpes). */
  bloquea(_dirAtaque: number, _tipo: string): boolean {
    return false;
  }

  /** Daño por contacto (0 = no daña al tocarlo). */
  danioContacto(): number {
    return this.ataque;
  }

  /** Para que la escena muestre la barra de jefe. */
  barraJefe(): boolean {
    return this.esJefe;
  }

  protected abstract pensar(dt: number, ctx: Contexto): void;
  abstract dibujar(g: CanvasRenderingContext2D): void;

  /** Pinta con un destello blanco cuando recibe daño. */
  protected color(base: string): string {
    return this.flash > 0 ? "#ffffff" : base;
  }

  protected barraVida(g: CanvasRenderingContext2D): void {
    if (this.esJefe || this.hp >= this.hpMax) return;
    const w = Math.max(14, this.w);
    const x = Math.round(this.cx - w / 2);
    const y = Math.round(this.y - 6);
    g.fillStyle = "#000000aa";
    g.fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle = this.categoria === "elite" ? "#ffb23d" : "#ff4d6d";
    g.fillRect(x, y, Math.round((w * this.hp) / this.hpMax), 2);
  }
}
