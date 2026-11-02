// Monstruos comunes y élite. Cinco conductas; cada bioma les cambia nombre y colores.

import { ENEMIGOS, escalaEnemigo, type Bioma, type ConductaEnemigo } from "../../contenido/biomas.ts";
import { ANIMACIONES_CRIATURAS, type CuadroSprite } from "../../contenido/sprites.generado.ts";
import { haySuelo, solidoEnPunto } from "../../motor/fisica.ts";
import { dibujarRecorte, sprites } from "../../motor/sprites.ts";
import type { Contexto } from "../contexto.ts";
import { Criatura, GRAVEDAD } from "./criatura.ts";
import { Proyectil } from "./proyectil.ts";

/** Personaje de microFantasy que representa cada conducta (los voladores siguen siendo procedurales). */
const SPRITE_DE: Readonly<Partial<Record<ConductaEnemigo, string>>> = {
  caminante: "lizard", saltador: "rhino", escudero: "troll", torreta: "wizard",
};

function cuadroEn(anim: readonly CuadroSprite[], ms: number): CuadroSprite {
  const total = anim.reduce((s, c) => s + c[4], 0);
  let t = ms % total;
  for (const c of anim) {
    if (t < c[4]) return c;
    t -= c[4];
  }
  return anim[0];
}

export class Enemigo extends Criatura {
  readonly conducta: ConductaEnemigo;
  private readonly velocidad: number;
  private readonly colores: readonly [string, string];
  private espera = 1 + Math.random();
  private guardiaRota = 0;
  private baseY: number;
  private readonly tinte: readonly [string, number];

  constructor(conducta: ConductaEnemigo, piso: number, bioma: Bioma, x: number, y: number, elite: boolean) {
    const def = ENEMIGOS[conducta];
    const e = escalaEnemigo(piso);
    const mult = elite ? 2.6 : 1;
    super({
      nombre: (elite ? "Élite: " : "") + bioma.nombres[conducta],
      hp: Math.round(def.hp * e.hp * mult),
      ataque: Math.round(def.ataque * e.ataque * (elite ? 1.35 : 1)),
      defensa: Math.round(def.defensa * e.defensa * (elite ? 1.5 : 1)),
      exp: Math.round(def.exp * e.exp * (elite ? 3 : 1)),
      w: Math.round(def.w * (elite ? 1.35 : 1)),
      h: Math.round(def.h * (elite ? 1.35 : 1)),
      categoria: elite ? "elite" : "comun",
    }, x, y);
    this.y = y - this.h;
    this.baseY = this.y;
    this.conducta = conducta;
    this.velocidad = def.velocidad * (elite ? 1.15 : 1);
    this.colores = bioma.colores[conducta];
    this.tinte = bioma.tinte;
  }

  /** Animación según lo que está haciendo. */
  private animacion(): string | null {
    const base = SPRITE_DE[this.conducta];
    if (base === undefined) return null;
    if (this.conducta === "torreta") return this.espera < 0.45 ? `${base}_attack` : `${base}_idle`;
    if (this.conducta === "saltador") return this.enSuelo ? `${base}_idle` : `${base}_run`;
    if (this.aturdido > 0) return `${base}_idle`;
    return Math.abs(this.vx) > 5 ? `${base}_run` : `${base}_idle`;
  }

  /** Dibuja con sprite; devuelve false si no hay imagen (y se usa el dibujo procedural). */
  private dibujarSprite(g: CanvasRenderingContext2D): boolean {
    const nombre = this.animacion();
    const anim = nombre === null ? undefined : ANIMACIONES_CRIATURAS[nombre];
    const img = this.flash > 0 ? sprites.tenida("criaturas", "#ffffff", 1) : sprites.tenida("criaturas", this.tinte[0], this.tinte[1] * 0.6);
    if (anim === undefined || img === null) return false;
    const [x, y, w, h, , pie, centro] = cuadroEn(anim, this.t * 1000);
    const escala = this.categoria === "elite" ? 1.9 : 1.5;
    const espejo = this.dir < 0;
    const cx = espejo ? w - centro : centro;
    dibujarRecorte(g, img, [x, y, w, h], this.cx - cx * escala, this.y + this.h - pie * escala, espejo, escala);
    return true;
  }

  protected pensar(dt: number, ctx: Contexto): void {
    const j = ctx.jugador;
    const dx = j.cx - this.cx;
    const dy = j.cy - this.cy;
    const dist = Math.hypot(dx, dy);
    this.guardiaRota = Math.max(0, this.guardiaRota - dt);

    switch (this.conducta) {
      case "caminante":
      case "escudero": {
        const alerta = dist < 140 && Math.abs(dy) < 40;
        if (alerta) this.dir = dx < 0 ? -1 : 1;
        const vel = this.velocidad * (alerta ? (this.conducta === "escudero" ? 1.3 : 1.9) : 1);
        const objetivo = this.dir * vel;
        this.vx += (objetivo - this.vx) * Math.min(1, dt * 8);
        this.vy += GRAVEDAD * dt;
        const delanteX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
        if (this.enSuelo && (!haySuelo(ctx.tiles, delanteX, this.y + this.h) || solidoEnPunto(ctx.tiles, delanteX, this.cy))) {
          this.dir = this.dir > 0 ? -1 : 1;
          this.vx = 0;
        }
        const c = this.moverFisica(dt, ctx);
        if (c.pared !== 0) this.dir = c.pared > 0 ? -1 : 1;
        break;
      }
      case "saltador": {
        this.vy += GRAVEDAD * dt;
        if (this.enSuelo) {
          this.vx *= 0.8;
          this.espera -= dt;
          if (this.espera <= 0 && dist < 220) {
            this.dir = dx < 0 ? -1 : 1;
            this.vx = this.dir * (60 + Math.min(110, Math.abs(dx)));
            this.vy = -260 - Math.random() * 80;
            this.espera = 1 + Math.random() * 0.9;
          }
        }
        this.moverFisica(dt, ctx);
        break;
      }
      case "volador": {
        if (dist < 190) {
          this.vx += (Math.sign(dx) * this.velocidad - this.vx) * dt * 2;
          this.vy += (Math.sign(dy) * this.velocidad * 0.8 - this.vy) * dt * 2;
          this.dir = dx < 0 ? -1 : 1;
        } else {
          this.vx += (Math.sin(this.t * 0.7) * this.velocidad * 0.5 - this.vx) * dt;
          this.vy = (this.baseY + Math.sin(this.t * 2) * 12 - this.y) * 2;
        }
        this.vy += Math.sin(this.t * 6) * 20 * dt;
        this.moverFisica(dt, ctx);
        break;
      }
      case "torreta": {
        this.vy += GRAVEDAD * dt;
        this.moverFisica(dt, ctx);
        this.dir = dx < 0 ? -1 : 1;
        this.espera -= dt;
        if (this.espera <= 0 && dist < 260) {
          this.espera = this.categoria === "elite" ? 1.4 : 2.3;
          const v = 120 + ctx.piso * 15;
          const ang = Math.atan2(dy, dx);
          const disparos = this.categoria === "elite" ? [-0.2, 0, 0.2] : [0];
          for (const a of disparos) {
            ctx.agregarProyectil(new Proyectil({
              tipo: "espora", x: this.cx, y: this.cy - 3, vx: Math.cos(ang + a) * v, vy: Math.sin(ang + a) * v,
              w: 6, h: 6, vida: 3, color: this.colores[1], ataqueEnemigo: this.ataque,
            }));
          }
          this.flash = 0.05;
        }
        break;
      }
    }
  }

  override bloquea(dirAtaque: number, tipo: string): boolean {
    if (this.conducta !== "escudero" || this.guardiaRota > 0 || tipo !== "golpe") return false;
    // El escudo mira hacia `dir`; un ataque que viene de frente tiene dirección opuesta.
    return dirAtaque === -this.dir;
  }

  romperGuardia(): void {
    this.guardiaRota = 2;
    this.aturdido = Math.max(this.aturdido, 0.6);
  }

  get conGuardia(): boolean {
    return this.conducta === "escudero" && this.guardiaRota <= 0;
  }

  override danioContacto(): number {
    return this.conducta === "torreta" ? Math.round(this.ataque * 0.5) : this.ataque;
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const [c1, c2] = this.colores;
    const cuerpo = this.color(c1);
    const elite = this.categoria === "elite";
    if (elite) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.25 + Math.sin(this.t * 6) * 0.1;
      g.fillStyle = "#ffb23d";
      g.fillRect(x - 3, y - 3, this.w + 6, this.h + 6);
      g.restore();
    }
    if (this.dibujarSprite(g)) {
      if (this.conducta === "escudero" && this.conGuardia) {
        g.fillStyle = this.color(c2);
        const sx = this.dir > 0 ? x + this.w - 1 : x - 4;
        g.fillRect(sx, y + 4, 5, this.h - 6);
        g.fillStyle = "#ffffff55";
        g.fillRect(sx + 1, y + 5, 1, this.h - 9);
      }
      if (this.aturdido > 0) {
        g.fillStyle = "#ffe27a";
        const a = this.t * 8;
        g.fillRect(Math.round(this.cx + Math.cos(a) * 6), Math.round(this.y - 4 + Math.sin(a) * 2), 2, 2);
      }
      this.barraVida(g);
      return;
    }
    const ojos = (ox: number, oy: number): void => {
      g.fillStyle = this.aturdido > 0 ? "#ffffff" : c2;
      const ex = this.dir > 0 ? x + this.w - ox - 2 : x + ox;
      g.fillRect(ex, y + oy, 2, 2);
      g.fillRect(ex + (this.dir > 0 ? -4 : 4), y + oy, 2, 2);
    };
    switch (this.conducta) {
      case "caminante": {
        const paso = Math.floor(this.t * 8) % 2;
        g.fillStyle = cuerpo;
        g.fillRect(x + 1, y + 2, this.w - 2, this.h - 5);
        g.fillRect(x + 3, y, this.w - 6, 3);
        g.fillStyle = this.color("#00000055");
        g.fillRect(x + 2, y + this.h - 6, this.w - 4, 2);
        g.fillStyle = cuerpo;
        g.fillRect(x + 2 + paso, y + this.h - 3, 3, 3);
        g.fillRect(x + this.w - 5 - paso, y + this.h - 3, 3, 3);
        ojos(3, 4);
        break;
      }
      case "saltador": {
        const estira = this.enSuelo ? 0 : 2;
        g.fillStyle = cuerpo;
        g.fillRect(x, y + 3 - estira, this.w, this.h - 3 + estira);
        g.fillRect(x + 2, y + 1 - estira, this.w - 4, 3);
        g.fillStyle = this.color(c2);
        g.fillRect(x + 2, y + this.h - 4, this.w - 4, 2);
        ojos(2, 4 - estira);
        break;
      }
      case "volador": {
        const ala = Math.sin(this.t * 22) > 0 ? -3 : 2;
        g.fillStyle = cuerpo;
        g.fillRect(x + 3, y + 2, this.w - 6, this.h - 3);
        g.fillStyle = this.color(c1);
        g.fillRect(x - 3, y + 3 + ala, 6, 3);
        g.fillRect(x + this.w - 3, y + 3 + ala, 6, 3);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.fillStyle = c2;
        g.fillRect(x + 4, y + 4, 2, 2);
        g.fillRect(x + this.w - 6, y + 4, 2, 2);
        g.restore();
        break;
      }
      case "torreta": {
        g.fillStyle = cuerpo;
        g.fillRect(x + 1, y + 4, this.w - 2, this.h - 4);
        g.fillRect(x + 3, y, this.w - 6, 5);
        g.fillStyle = this.color(c2);
        const boca = this.espera < 0.4 ? 4 : 2;
        g.fillRect(this.dir > 0 ? x + this.w - 4 : x, y + 7, 4, boca);
        g.fillStyle = "#000000";
        g.fillRect(x + 4, y + 2, 2, 2);
        g.fillRect(x + this.w - 6, y + 2, 2, 2);
        break;
      }
      case "escudero": {
        const paso = Math.floor(this.t * 6) % 2;
        g.fillStyle = cuerpo;
        g.fillRect(x + 3, y, this.w - 6, 6);
        g.fillRect(x + 2, y + 6, this.w - 4, this.h - 9);
        g.fillRect(x + 3 + paso, y + this.h - 3, 3, 3);
        g.fillRect(x + this.w - 6 - paso, y + this.h - 3, 3, 3);
        ojos(4, 2);
        if (this.conGuardia) {
          g.fillStyle = this.color(c2);
          const sx = this.dir > 0 ? x + this.w - 2 : x - 3;
          g.fillRect(sx, y + 3, 5, this.h - 5);
          g.fillStyle = "#ffffff55";
          g.fillRect(sx + 1, y + 4, 1, this.h - 8);
        }
        break;
      }
    }
    this.barraVida(g);
  }
}
