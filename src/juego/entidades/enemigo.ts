// Monstruos comunes y élite. Nueve conductas (cinco originales + embestidor, kamikaze, lanzador y espectro);
// cada bioma les cambia nombre y colores. Las élites traen afijos (veloz, blindado, vampiro, regenerador,
// explosivo, furioso) que se suman según la profundidad.

import {
  ENEMIGOS, INFO_AFIJO_ELITE, coloresEnemigo, escalaEnemigo, nombreEnemigo, spriteEnemigo,
  type AfijoElite, type Bioma, type ConductaEnemigo,
} from "../../contenido/biomas.ts";
import { ANIMACIONES_CRIATURAS, type CuadroSprite } from "../../contenido/sprites.generado.ts";
import { haySuelo, solidoEnPunto } from "../../motor/fisica.ts";
import { dibujarRecorte, sprites } from "../../motor/sprites.ts";
import type { Contexto } from "../contexto.ts";
import { Criatura, GRAVEDAD } from "./criatura.ts";
import { Proyectil } from "./proyectil.ts";


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
  /** Afijos de élite. */
  readonly afijos: readonly AfijoElite[];
  /** Estado de las conductas nuevas: fase y temporizador (carga, mecha, lanzamiento, parpadeo). */
  private fase: "normal" | "aviso" | "carga" | "descanso" | "mecha" = "normal";
  private tFase = 0;
  private readonly ataqueBase: number;
  /** El kamikaze ya explotó. */
  exploto = false;

  constructor(conducta: ConductaEnemigo, piso: number, bioma: Bioma, x: number, y: number, elite: boolean, afijos: readonly AfijoElite[] = []) {
    const def = ENEMIGOS[conducta];
    const e = escalaEnemigo(piso);
    const mult = elite ? 2.6 : 1;
    const titulo = afijos.length > 0 ? `Élite ${afijos.map((a) => INFO_AFIJO_ELITE[a].nombre).join(" y ")}: ` : elite ? "Élite: " : "";
    super({
      nombre: titulo + nombreEnemigo(piso, bioma, conducta),
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
    this.afijos = afijos;
    this.velocidad = def.velocidad * (elite ? 1.15 : 1) * (afijos.includes("veloz") ? 1.5 : 1);
    this.colores = coloresEnemigo(bioma, conducta);
    this.tinte = bioma.tinte;
    this.sprite = spriteEnemigo(bioma, conducta);
    this.ataqueBase = this.ataque;
    if (conducta === "espectro" || conducta === "volador") this.baseY = this.y;
  }

  tiene(a: AfijoElite): boolean {
    return this.afijos.includes(a);
  }

  /** Blindado: recibe un 35 % menos de daño. */
  override aplicarDanio(n: number, ctx: Contexto): boolean {
    return super.aplicarDanio(this.tiene("blindado") ? Math.max(1, Math.round(n * 0.65)) : n, ctx);
  }

  /** Vampiro: cada golpe al Portador lo cura. */
  alGolpearJugador(danio: number): void {
    if (this.tiene("vampiro")) this.hp = Math.min(this.hpMax, this.hp + Math.max(1, Math.round(danio * 1.5)));
  }

  /** Personaje de microFantasy de esta zona para la conducta (los voladores siguen siendo procedurales). */
  private readonly sprite: string | undefined;

  /** Animación según lo que está haciendo. */
  private animacion(): string | null {
    const base = this.sprite;
    if (base === undefined) return null;
    if (this.conducta === "torreta" || this.conducta === "lanzador") return this.espera < 0.45 ? `${base}_attack` : `${base}_idle`;
    if (this.conducta === "cargador" && this.fase === "carga") return `${base}_run`;
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
    this.tFase -= dt;
    if (this.tiene("regenerador") && this.hp < this.hpMax) this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.025 * dt);
    // Furioso: bajo la mitad de vida pega un 50 % más fuerte y se mueve más rápido.
    const furia = this.tiene("furioso") && this.hp < this.hpMax * 0.5;
    this.ataque = Math.round(this.ataqueBase * (furia ? 1.5 : 1));
    if (furia && Math.random() < dt * 6) ctx.fx.chispas(this.cx, this.y, "#ff3d3d", 1, { velocidad: 30, gravedad: -60 });
    if (furia) dt *= 1.25;

    switch (this.conducta) {
      case "cargador": {
        // Camina; si ve al Portador a su altura, avisa (tiembla) y embiste en línea recta.
        this.vy += GRAVEDAD * dt;
        const misma = Math.abs(dy) < 28 && Math.abs(dx) < 190;
        if (this.fase === "normal") {
          if (misma && this.enSuelo && this.tFase <= 0) {
            this.fase = "aviso";
            this.tFase = 0.55;
            this.dir = dx < 0 ? -1 : 1;
            this.vx = 0;
          } else {
            this.vx += (this.dir * this.velocidad - this.vx) * Math.min(1, dt * 6);
            const delanteX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
            if (this.enSuelo && (!haySuelo(ctx.tiles, delanteX, this.y + this.h) || solidoEnPunto(ctx.tiles, delanteX, this.cy))) this.dir = this.dir > 0 ? -1 : 1;
          }
        } else if (this.fase === "aviso") {
          this.vx = 0;
          if (Math.random() < 0.5) ctx.fx.chispas(this.cx - this.dir * 6, this.y + this.h, "#ffffff88", 1, { velocidad: 30, vida: 0.3 });
          if (this.tFase <= 0) {
            this.fase = "carga";
            this.tFase = 0.7;
          }
        } else if (this.fase === "carga") {
          this.vx = this.dir * 290 * (this.tiene("veloz") ? 1.25 : 1);
          if (Math.random() < 0.6) ctx.fx.chispas(this.cx - this.dir * 8, this.y + this.h - 2, this.colores[1], 1, { velocidad: 40, vida: 0.25 });
          if (this.tFase <= 0) {
            this.fase = "descanso";
            this.tFase = 1.1;
          }
        } else {
          this.vx *= 0.85;
          if (this.tFase <= 0) {
            this.fase = "normal";
            this.tFase = 0.6;
          }
        }
        const c = this.moverFisica(dt, ctx);
        if (c.pared !== 0) {
          if (this.fase === "carga") {
            // Se estrella contra la pared: queda aturdido.
            this.fase = "descanso";
            this.tFase = 1.4;
            this.aturdido = Math.max(this.aturdido, 1);
            ctx.fx.sacudir(2);
            ctx.fx.chispas(this.cx + this.dir * 8, this.cy, "#ffffff", 10, { velocidad: 90 });
          }
          this.dir = c.pared > 0 ? -1 : 1;
        }
        break;
      }
      case "explosivo": {
        // Corre hacia el Portador; cerca, prende la mecha y explota (salvo que lo maten antes).
        this.vy += GRAVEDAD * dt;
        if (this.fase === "mecha") {
          this.vx *= 0.8;
          if (this.tFase <= 0 && !this.exploto) this.explotar(ctx, 1.6, 40);
        } else if (dist < 210) {
          this.dir = dx < 0 ? -1 : 1;
          this.vx += (this.dir * this.velocidad - this.vx) * Math.min(1, dt * 5);
          if (this.enSuelo && dy < -24 && Math.random() < dt * 2) this.vy = -260;
          if (dist < 30) {
            this.fase = "mecha";
            this.tFase = 0.7;
            ctx.audio.reproducir("fallo");
          }
        } else {
          this.vx *= 0.9;
        }
        this.moverFisica(dt, ctx);
        break;
      }
      case "lanzador": {
        // Quieto: lanza proyectiles en parábola que caen sobre el Portador (pasan por encima de coberturas).
        this.vy += GRAVEDAD * dt;
        this.moverFisica(dt, ctx);
        this.dir = dx < 0 ? -1 : 1;
        this.espera -= dt;
        if (this.espera <= 0 && dist < 300) {
          this.espera = this.categoria === "elite" ? 1.6 : 2.6;
          const tVuelo = 0.9 + Math.min(0.5, Math.abs(dx) / 400);
          const g = 420;
          const tiros = this.categoria === "elite" ? [-14, 0, 14] : [0];
          for (const off of tiros) {
            ctx.agregarProyectil(new Proyectil({
              tipo: "hueso", x: this.cx, y: this.y - 2, vx: (dx + off) / tVuelo, vy: dy / tVuelo - 0.5 * g * tVuelo,
              w: 7, h: 7, vida: tVuelo + 1.2, gravedad: g, color: this.colores[1], ataqueEnemigo: this.ataque,
            }));
          }
          this.flash = 0.05;
        }
        break;
      }
      case "espectro": {
        // Atraviesa paredes, flota hacia el Portador y cada tanto se teletransporta a su espalda.
        if (dist < 230) {
          this.vx += (Math.sign(dx) * this.velocidad - this.vx) * dt * 1.6;
          this.vy += (Math.sign(dy) * this.velocidad * 0.7 - this.vy) * dt * 1.6;
          this.dir = dx < 0 ? -1 : 1;
          if (this.tFase <= 0) {
            this.tFase = 3.2 + Math.random();
            ctx.fx.chispas(this.cx, this.cy, this.colores[1], 12, { velocidad: 60, brillo: true, gravedad: 0 });
            this.x = j.cx - j.dir * 46 - this.w / 2;
            this.y = j.y - 6;
            ctx.fx.chispas(this.cx, this.cy, this.colores[1], 12, { velocidad: 60, brillo: true, gravedad: 0 });
          }
        } else {
          this.vx *= 0.95;
          this.vy = (this.baseY + Math.sin(this.t * 1.6) * 16 - this.y) * 1.5;
        }
        this.moverFisica(dt, ctx, true);
        break;
      }
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

  /** Explosión (kamikaze o afijo explosivo): zona de peligro alrededor. */
  explotar(ctx: Contexto, mult: number, radio: number, aviso = 0): void {
    this.exploto = true;
    ctx.agregarPeligro({
      x: this.cx - radio, y: this.cy - radio, w: radio * 2, h: radio * 2, aviso, activo: 0.15,
      danio: Math.round(this.ataqueBase * mult), color: "#ff9a3d", golpeo: false,
    });
    ctx.fx.chispas(this.cx, this.cy, "#ff9a3d", 30, { velocidad: 160, brillo: true });
    ctx.fx.chispas(this.cx, this.cy, "#ffe08a", 16, { velocidad: 90, brillo: true });
    ctx.fx.sacudir(4);
    ctx.audio.reproducir("explosion");
    if (this.conducta === "explosivo" && !this.muerto) {
      this.hp = 0;
      this.muerto = true;
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
    if (this.conducta === "torreta" || this.conducta === "lanzador") return Math.round(this.ataque * 0.5);
    if (this.conducta === "cargador" && this.fase === "carga") return Math.round(this.ataque * 1.4);
    if (this.conducta === "explosivo") return Math.round(this.ataque * 0.4);
    return this.ataque;
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
      const col = this.afijos.length > 0 ? INFO_AFIJO_ELITE[this.afijos[0]].color : "#ffb23d";
      // Resplandor ovalado a los pies y un halo suave, en vez de un recuadro.
      const pies = y + this.h;
      const grad = g.createRadialGradient(this.cx, pies - 2, 1, this.cx, pies - 2, this.w * 1.4);
      grad.addColorStop(0, col);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.55 + Math.sin(this.t * 6) * 0.15;
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(this.cx, pies - 1, this.w * 1.4, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.12 + Math.sin(this.t * 6) * 0.05;
      g.beginPath();
      g.ellipse(this.cx, this.cy, this.w * 0.9, this.h * 0.8, 0, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      g.restore();
      // Un punto por afijo, del color de cada uno.
      this.afijos.forEach((a, k) => {
        g.fillStyle = INFO_AFIJO_ELITE[a].color;
        g.fillRect(x + k * 4, y - 9, 3, 3);
      });
    }
    // Avisos de las conductas nuevas.
    if (this.fase === "aviso" && Math.floor(this.t * 20) % 2 === 0) {
      g.fillStyle = "#ffffff";
      g.fillRect(Math.round(this.cx) - 1, y - 12, 2, 6);
      g.fillRect(Math.round(this.cx) - 1, y - 4, 2, 2);
    }
    if (this.fase === "mecha") {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.floor(this.t * 16) % 2 === 0 ? 0.8 : 0.2;
      g.fillStyle = "#ff4d2d";
      g.fillRect(x - 2, y - 2, this.w + 4, this.h + 4);
      g.restore();
    }
    if (this.conducta === "espectro") {
      // Medio transparente: se ve mejor cuanto más cerca (dibujo procedural tipo fantasma).
      g.save();
      g.globalAlpha = 0.55 + Math.sin(this.t * 3) * 0.15;
      g.fillStyle = cuerpo;
      g.fillRect(x + 2, y, this.w - 4, this.h - 3);
      g.fillRect(x, y + 3, this.w, this.h - 6);
      for (let k = 0; k < 3; k++) g.fillRect(x + 1 + k * 4, y + this.h - 3 + (Math.floor(this.t * 6 + k) % 2), 3, 3);
      g.globalCompositeOperation = "lighter";
      g.fillStyle = c2;
      g.fillRect(this.dir > 0 ? x + this.w - 5 : x + 2, y + 4, 2, 2);
      g.fillRect(this.dir > 0 ? x + this.w - 9 : x + 6, y + 4, 2, 2);
      g.restore();
      this.barraVida(g);
      return;
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
    const dibujo = this.conducta === "cargador" ? "caminante" : this.conducta === "explosivo" ? "saltador"
      : this.conducta === "lanzador" ? "torreta" : this.conducta;
    switch (dibujo) {
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
