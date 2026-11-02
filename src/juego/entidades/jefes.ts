// Guardianes de cada piso y el Eco rival. Máquinas de estados con ataques ANUNCIADOS (el jugador siempre
// puede leer lo que viene: destello, línea de aviso o zona marcada) y una segunda fase al 50 % de vida.

import { ALMAS, alma, type Tecnica } from "../../contenido/almas.ts";
import { escalaEnemigo, type DefJefe } from "../../contenido/biomas.ts";
import { statsEcoEnemigo, type Eco } from "../../dominio/eco.ts";
import { ANCHO_SALA, TILE } from "../../dominio/mundo/sala.ts";
import { solapan } from "../../motor/fisica.ts";
import type { Contexto } from "../contexto.ts";
import { Criatura, GRAVEDAD } from "./criatura.ts";
import { Enemigo } from "./enemigo.ts";
import { Proyectil } from "./proyectil.ts";

const SUELO = 14 * TILE;
const TECNICAS: readonly Tecnica[] = ["orbe", "lanza", "terremoto", "tajo", "zarpazo"];

abstract class Jefe extends Criatura {
  protected estado = "intro";
  protected tiempo = 1.2;
  protected fase = 1;
  readonly titulo: string;
  readonly colorPrincipal: string;

  constructor(def: DefJefe, piso: number, x: number, y: number, color: string) {
    // Los jefes escalan menos que los monstruos: su vida ya está pensada por piso.
    const e = escalaEnemigo(1);
    super({
      nombre: def.nombre, hp: Math.round(def.hp * e.hp), ataque: def.ataque, defensa: def.defensa,
      exp: def.exp, w: def.w, h: def.h, categoria: "jefe",
    }, x, y - def.h, true);
    this.titulo = def.titulo;
    this.colorPrincipal = color;
    void piso;
  }

  protected entrarFase2(ctx: Contexto): void {
    if (this.fase === 2 || this.hp > this.hpMax / 2) return;
    this.fase = 2;
    ctx.fx.destellar("#ff3d3d", 0.5);
    ctx.fx.sacudir(6);
    ctx.audio.reproducir("jefe");
    ctx.mensaje(`${this.nombre} se enfurece`, "#ff6a6a");
  }

  protected golpeCuerpo(ctx: Contexto, r: { x: number; y: number; w: number; h: number }, mult = 1): void {
    if (solapan(r, ctx.jugador)) ctx.golpearJugador(this.ataque * mult, this.cx, 220);
  }

  /** Dibuja un "!" de aviso sobre la cabeza. */
  protected aviso(g: CanvasRenderingContext2D): void {
    if (Math.floor(this.t * 12) % 2 === 0) return;
    g.fillStyle = "#ff3d3d";
    g.fillRect(Math.round(this.cx) - 1, Math.round(this.y) - 14, 3, 7);
    g.fillRect(Math.round(this.cx) - 1, Math.round(this.y) - 5, 3, 2);
  }
}

// ======================================================================================
// Piso 1 — Guardián del Osario: carga, salto aplastante, barrido; fase 2 agrega lluvia de huesos.
// ======================================================================================
export class Guardian extends Jefe {
  private yaGolpeo = false;

  protected pensar(dt: number, ctx: Contexto): void {
    const j = ctx.jugador;
    const dx = j.cx - this.cx;
    const rapido = this.fase === 2 ? 1.3 : 1;
    this.entrarFase2(ctx);
    this.tiempo -= dt * rapido;
    this.vy += GRAVEDAD * dt;

    switch (this.estado) {
      case "intro":
      case "pausa":
        this.vx *= 0.85;
        if (this.tiempo <= 0) this.elegir(ctx, dx);
        break;
      case "caminar":
        this.dir = dx < 0 ? -1 : 1;
        this.vx = this.dir * 45 * rapido;
        if (this.tiempo <= 0) this.elegir(ctx, dx);
        break;
      case "preCarga":
        this.vx = 0;
        if (this.tiempo <= 0) {
          this.estado = "carga";
          this.tiempo = 2;
          this.yaGolpeo = false;
          ctx.audio.reproducir("embestida");
        }
        break;
      case "carga": {
        this.vx = this.dir * 270 * rapido;
        if (!this.yaGolpeo && solapan(this, j)) {
          this.yaGolpeo = true;
          ctx.golpearJugador(this.ataque * 1.4, this.cx, 320);
        }
        if (Math.random() < 0.5) ctx.fx.chispas(this.cx, this.y + this.h, "#b8a98a", 2, { velocidad: 50, vida: 0.4 });
        break;
      }
      case "aturdido":
        this.vx *= 0.8;
        if (this.tiempo <= 0) this.pausa(0.3);
        break;
      case "preSalto":
        this.vx = 0;
        if (this.tiempo <= 0) {
          this.estado = "salto";
          const destino = Math.max(40, Math.min(ANCHO_SALA - 40, j.cx));
          this.vy = -460;
          this.vx = (destino - this.cx) / 0.94;
        }
        break;
      case "salto":
        break;
      case "preBarrido":
        this.vx = 0;
        if (this.tiempo <= 0) {
          this.estado = "barrido";
          this.tiempo = 0.25;
          ctx.audio.reproducir("patada");
          this.golpeCuerpo(ctx, { x: this.dir > 0 ? this.x + this.w : this.x - 40, y: this.y + 8, w: 40, h: this.h - 8 }, 1.2);
          ctx.fx.chispas(this.cx + this.dir * 30, this.cy, "#ffffff", 10, { velocidad: 120, angulo: this.dir > 0 ? 0 : Math.PI, apertura: 1.2 });
        }
        break;
      case "barrido":
        if (this.tiempo <= 0) this.pausa(0.5);
        break;
    }

    const c = this.moverFisica(dt, ctx);
    if (this.estado === "carga" && c.pared !== 0) {
      this.estado = "aturdido";
      this.tiempo = 0.9;
      ctx.fx.sacudir(7);
      ctx.audio.reproducir("explosion");
      ctx.fx.chispas(this.cx + this.dir * this.w / 2, this.cy, "#e8e0cc", 20, { velocidad: 160 });
      if (this.fase === 2) this.lluviaHuesos(ctx, 5);
    }
    if (this.estado === "salto" && c.suelo) {
      ctx.fx.sacudir(6);
      ctx.audio.reproducir("explosion");
      for (const d of [-1, 1]) {
        ctx.agregarProyectil(new Proyectil({
          tipo: "onda", x: this.cx + d * 20, y: this.y + this.h - 8, vx: d * 170, vy: 0, w: 8, h: 14, vida: 2.5,
          rastrero: true, color: "#c9b8ff", ataqueEnemigo: this.ataque,
        }));
      }
      this.pausa(0.6);
    }
  }

  private elegir(ctx: Contexto, dx: number): void {
    this.dir = dx < 0 ? -1 : 1;
    const r = Math.random();
    if (Math.abs(dx) < 50 && r < 0.6) {
      this.estado = "preBarrido";
      this.tiempo = 0.45;
    } else if (r < 0.4) {
      this.estado = "preCarga";
      this.tiempo = 0.65;
    } else if (r < 0.75) {
      this.estado = "preSalto";
      this.tiempo = 0.45;
    } else if (this.fase === 2 && r < 0.9) {
      this.lluviaHuesos(ctx, 7);
      this.pausa(0.8);
    } else {
      this.estado = "caminar";
      this.tiempo = 0.9;
    }
  }

  private lluviaHuesos(ctx: Contexto, n: number): void {
    for (let i = 0; i < n; i++) {
      const x = 40 + Math.random() * (ANCHO_SALA - 80);
      ctx.agregarProyectil(new Proyectil({
        tipo: "hueso", x, y: 10 - Math.random() * 120, vx: 0, vy: 40, w: 6, h: 8, vida: 3, gravedad: 300,
        color: "#e8e0cc", ataqueEnemigo: this.ataque * 0.8,
      }));
    }
  }

  private pausa(s: number): void {
    this.estado = "pausa";
    this.tiempo = s;
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const armadura = this.color(this.fase === 2 ? "#8a7a9a" : "#a79c88");
    const oscuro = this.color("#4a4458");
    const paso = this.estado === "caminar" ? Math.floor(this.t * 6) % 2 : 0;
    // piernas
    g.fillStyle = oscuro;
    g.fillRect(x + 6 + paso * 2, y + 34, 8, 10);
    g.fillRect(x + this.w - 14 - paso * 2, y + 34, 8, 10);
    // torso
    g.fillStyle = armadura;
    g.fillRect(x + 2, y + 12, this.w - 4, 24);
    g.fillStyle = oscuro;
    g.fillRect(x + 6, y + 18, this.w - 12, 3);
    // yelmo
    g.fillStyle = armadura;
    g.fillRect(x + 8, y, this.w - 16, 14);
    g.fillStyle = "#000000";
    g.fillRect(x + 10, y + 5, this.w - 20, 3);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = this.fase === 2 ? "#ff3d3d" : "#c9b8ff";
    g.fillRect(this.dir > 0 ? x + this.w - 15 : x + 11, y + 5, 4, 3);
    g.restore();
    // escudo / maza
    g.fillStyle = this.color("#6e6684");
    const brazo = this.estado === "preBarrido" ? -8 : this.estado === "barrido" ? 10 : 0;
    g.fillRect(this.dir > 0 ? x + this.w - 2 : x - 6, y + 14 + brazo, 8, 18);
    if (this.estado.startsWith("pre")) this.aviso(g);
  }
}

// ======================================================================================
// Piso 2 — Madre Micelio: flota; esporas radiales, raíces que brotan, invoca polillas.
// ======================================================================================
export class MadreMicelio extends Jefe {
  private lado = 1;
  private anguloEspora = 0;

  protected pensar(dt: number, ctx: Contexto): void {
    const j = ctx.jugador;
    this.entrarFase2(ctx);
    const rapido = this.fase === 2 ? 1.35 : 1;
    this.tiempo -= dt * rapido;
    const objetivoX = this.lado > 0 ? ANCHO_SALA - 110 : 70;
    const objetivoY = 52 + Math.sin(this.t * 1.5) * 10;
    this.vx = (objetivoX - this.x) * 1.5;
    this.vy = (objetivoY - this.y) * 2;
    this.moverFisica(dt, ctx, true);
    this.dir = j.cx < this.cx ? -1 : 1;

    if (this.tiempo > 0) return;
    const r = Math.random();
    if (this.estado === "preEsporas") {
      this.esporas(ctx);
      this.estado = "pausa";
      this.tiempo = 1.2;
      return;
    }
    if (r < 0.32) {
      this.estado = "preEsporas";
      this.tiempo = 0.6;
    } else if (r < 0.6) {
      this.raices(ctx, j.cx);
      this.estado = "pausa";
      this.tiempo = 1.6;
    } else if (r < 0.75 && ctx.criaturas.filter((c) => !c.esJefe && !c.muerto).length < 4) {
      this.invocar(ctx);
      this.estado = "pausa";
      this.tiempo = 1.4;
    } else if (r < 0.88) {
      this.lado = -this.lado;
      this.estado = "pausa";
      this.tiempo = 1;
    } else {
      this.rafaga(ctx);
      this.estado = "pausa";
      this.tiempo = 1;
    }
  }

  private esporas(ctx: Contexto): void {
    const n = this.fase === 2 ? 14 : 10;
    this.anguloEspora += 0.3;
    ctx.audio.reproducir("tecnica");
    for (let i = 0; i < n; i++) {
      const a = this.anguloEspora + (i / n) * Math.PI * 2;
      ctx.agregarProyectil(new Proyectil({
        tipo: "espora", x: this.cx, y: this.cy, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, w: 7, h: 7, vida: 4,
        atraviesaParedes: true, color: "#5fffd0", ataqueEnemigo: this.ataque * 0.8,
      }));
    }
  }

  private raices(ctx: Contexto, x: number): void {
    const separacion = this.fase === 2 ? 52 : 70;
    const cantidad = this.fase === 2 ? 5 : 3;
    for (let i = 0; i < cantidad; i++) {
      const px = x + (i - Math.floor(cantidad / 2)) * separacion;
      if (px < 20 || px > ANCHO_SALA - 20) continue;
      ctx.agregarPeligro({ x: px - 12, y: SUELO - 46, w: 24, h: 46, aviso: 0.9, activo: 0.35, danio: this.ataque * 1.1, color: "#6fbf8f", golpeo: false });
    }
  }

  private invocar(ctx: Contexto): void {
    ctx.fx.chispas(this.cx, this.cy, "#5fffd0", 30, { velocidad: 120, brillo: true });
    for (const d of [-1, 1]) {
      const e = new Enemigo("volador", ctx.piso, ctx.bioma, this.cx + d * 30, this.cy + 20, false);
      ctx.agregarCriatura(e);
    }
  }

  private rafaga(ctx: Contexto): void {
    const j = ctx.jugador;
    const ang = Math.atan2(j.cy - this.cy, j.cx - this.cx);
    for (const a of [-0.25, 0, 0.25]) {
      ctx.agregarProyectil(new Proyectil({
        tipo: "espora", x: this.cx, y: this.cy, vx: Math.cos(ang + a) * 170, vy: Math.sin(ang + a) * 170, w: 8, h: 8,
        vida: 3, explota: 18, color: "#ff8ad0", ataqueEnemigo: this.ataque,
      }));
    }
  }

  override danioContacto(): number {
    return Math.round(this.ataque * 0.7);
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const late = Math.sin(this.t * 4) * 2;
    // sombrero
    g.fillStyle = this.color(this.fase === 2 ? "#c85a8a" : "#8a4a7a");
    g.fillRect(x, y + 4 - late, this.w, 14);
    g.fillRect(x + 6, y - late, this.w - 12, 6);
    g.fillStyle = this.color("#ffd0f0");
    for (let i = 0; i < 5; i++) g.fillRect(x + 4 + i * 9, y + 7 - late, 3, 3);
    // cuerpo
    g.fillStyle = this.color("#d9e8c8");
    g.fillRect(x + 12, y + 18, this.w - 24, 16);
    g.fillStyle = "#000000";
    g.fillRect(x + 17, y + 22, 3, 3);
    g.fillRect(x + this.w - 20, y + 22, 3, 3);
    // raíces colgantes
    g.fillStyle = this.color("#6fbf8f");
    for (let i = 0; i < 6; i++) {
      const largo = 6 + ((i * 7 + Math.floor(this.t * 6)) % 5);
      g.fillRect(x + 10 + i * 5, y + 34, 2, largo);
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25;
    g.fillStyle = "#5fffd0";
    g.beginPath();
    g.arc(this.cx, this.cy, 34 + late * 2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (this.estado === "preEsporas") this.aviso(g);
  }
}

// ======================================================================================
// Técnicas en manos enemigas (las usan El Que Recuerda y los Ecos).
// ======================================================================================
function tecnicaEnemiga(t: Tecnica, quien: Criatura, ctx: Contexto, potencia: number, color: string): void {
  const j = ctx.jugador;
  const dir = j.cx < quien.cx ? -1 : 1;
  ctx.audio.reproducir("tecnica");
  switch (t) {
    case "orbe": {
      const ang = Math.atan2(j.cy - quien.cy, j.cx - quien.cx);
      ctx.agregarProyectil(new Proyectil({
        tipo: "orbe", x: quien.cx, y: quien.cy, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, w: 10, h: 10, vida: 3,
        explota: 26, color, ataqueEnemigo: potencia * 1.2,
      }));
      break;
    }
    case "lanza":
      ctx.agregarProyectil(new Proyectil({
        tipo: "lanza", x: quien.cx, y: j.cy, vx: dir * 260, vy: 0, w: 18, h: 4, vida: 2.5, atraviesaParedes: true,
        color: "#bff3ff", ataqueEnemigo: potencia,
      }));
      break;
    case "terremoto":
      ctx.fx.sacudir(5);
      for (const d of [-1, 1]) {
        ctx.agregarProyectil(new Proyectil({
          tipo: "onda", x: quien.cx + d * 12, y: SUELO - 8, vx: d * 180, vy: 0, w: 8, h: 14, vida: 2.5, rastrero: true,
          color, ataqueEnemigo: potencia,
        }));
      }
      break;
    case "tajo":
      ctx.agregarPeligro({ x: 0, y: j.y + j.h / 2 - 6, w: ANCHO_SALA, h: 12, aviso: 0.7, activo: 0.2, danio: potencia * 1.3, color, golpeo: false });
      break;
    case "zarpazo":
      for (let i = 0; i < 3; i++) {
        ctx.agregarPeligro({ x: j.cx - 18 + (i - 1) * 14, y: j.y - 6, w: 22, h: j.h + 12, aviso: 0.55 + i * 0.12, activo: 0.12, danio: potencia * 0.7, color: "#ffe08a", golpeo: false });
      }
      break;
  }
}

// ======================================================================================
// Piso 3 — El Que Recuerda: usa las técnicas de tus Ecos. Fase 2: se teletransporta y encadena.
// ======================================================================================
export class ElQueRecuerda extends Jefe {
  private readonly tecnicas: readonly Tecnica[];
  private destinoX = ANCHO_SALA / 2;
  private destinoY = 70;
  private indice = 0;

  constructor(def: DefJefe, piso: number, x: number, y: number, ecos: readonly Eco[]) {
    super(def, piso, x, y, "#ffb23d");
    const propias = ecos.map((e) => (e.forma !== null ? alma(e.forma.personaje).tecnica : null)).filter((t): t is Tecnica => t !== null);
    this.tecnicas = propias.length > 0 ? [...new Set(propias), "orbe"] : TECNICAS;
  }

  get memorias(): readonly Tecnica[] {
    return this.tecnicas;
  }

  protected pensar(dt: number, ctx: Contexto): void {
    this.entrarFase2(ctx);
    const rapido = this.fase === 2 ? 1.4 : 1;
    this.tiempo -= dt * rapido;
    this.vx = (this.destinoX - this.cx) * 2;
    this.vy = (this.destinoY + Math.sin(this.t * 2) * 8 - this.cy) * 2;
    this.moverFisica(dt, ctx, true);
    this.dir = ctx.jugador.cx < this.cx ? -1 : 1;
    if (this.tiempo > 0) return;

    if (this.estado === "preTecnica") {
      const t = this.tecnicas[this.indice % this.tecnicas.length];
      this.indice++;
      tecnicaEnemiga(t, this, ctx, this.ataque, "#ffb23d");
      if (this.fase === 2 && Math.random() < 0.5) {
        tecnicaEnemiga(this.tecnicas[(this.indice + 1) % this.tecnicas.length], this, ctx, this.ataque * 0.8, "#ff5a3d");
      }
      this.estado = "pausa";
      this.tiempo = 1.1;
      return;
    }
    const r = Math.random();
    if (r < 0.55) {
      this.estado = "preTecnica";
      this.tiempo = 0.55;
    } else if (r < 0.8) {
      this.anillo(ctx);
      this.estado = "pausa";
      this.tiempo = 1.2;
    } else {
      // Se mueve (en fase 2, aparece de golpe en otro lado).
      this.destinoX = 70 + Math.random() * (ANCHO_SALA - 140);
      this.destinoY = 50 + Math.random() * 60;
      if (this.fase === 2) {
        ctx.fx.chispas(this.cx, this.cy, "#ffb23d", 30, { velocidad: 150, brillo: true });
        this.x = this.destinoX - this.w / 2;
        this.y = this.destinoY - this.h / 2;
      }
      this.estado = "pausa";
      this.tiempo = 0.6;
    }
  }

  private anillo(ctx: Contexto): void {
    const n = this.fase === 2 ? 16 : 12;
    const hueco = Math.floor(Math.random() * n);
    for (let i = 0; i < n; i++) {
      if (i === hueco || i === (hueco + 1) % n) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.agregarProyectil(new Proyectil({
        tipo: "sombra", x: this.cx, y: this.cy, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, w: 7, h: 7, vida: 4,
        atraviesaParedes: true, color: "#ff7a3d", ataqueEnemigo: this.ataque * 0.8,
      }));
    }
  }

  override danioContacto(): number {
    return Math.round(this.ataque * 0.6);
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.3;
    g.fillStyle = this.fase === 2 ? "#ff3d3d" : "#ffb23d";
    g.beginPath();
    g.arc(this.cx, this.cy, 30 + Math.sin(this.t * 5) * 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // manto
    g.fillStyle = this.color("#1a0c0a");
    g.fillRect(x + 4, y + 10, this.w - 8, this.h - 10);
    for (let i = 0; i < 5; i++) g.fillRect(x + 4 + i * 7, y + this.h - 2 + Math.round(Math.sin(this.t * 6 + i) * 2), 5, 4);
    // máscaras: una por memoria
    this.tecnicas.forEach((t, i) => {
      const a = this.t * 1.2 + (i / this.tecnicas.length) * Math.PI * 2;
      const mx = Math.round(this.cx + Math.cos(a) * 26) - 3;
      const my = Math.round(this.cy + Math.sin(a) * 14) - 3;
      const duena = ALMAS.find((al) => al.tecnica === t);
      g.fillStyle = duena?.colorSec ?? "#ffffff";
      g.fillRect(mx, my, 7, 7);
      g.fillStyle = "#000000";
      g.fillRect(mx + 1, my + 2, 2, 1);
      g.fillRect(mx + 4, my + 2, 2, 1);
    });
    // máscara principal
    g.fillStyle = this.color("#f2e6d0");
    g.fillRect(x + 10, y, this.w - 20, 16);
    g.fillStyle = "#000000";
    g.fillRect(x + 13, y + 5, 4, 3);
    g.fillRect(x + this.w - 17, y + 5, 4, 3);
    g.fillStyle = this.fase === 2 ? "#ff3d3d" : "#ffb23d";
    g.fillRect(x + 14, y + 6, 2, 1);
    g.fillRect(x + this.w - 16, y + 6, 2, 1);
    g.fillRect(Math.round(this.cx) - 1, y + 10, 2, 5);
    if (this.estado === "preTecnica") this.aviso(g);
  }
}

// ======================================================================================
// El Eco: tu yo de una partida anterior. Pelea como un Portador, con tu técnica.
// ======================================================================================
export class EcoRival extends Criatura {
  readonly eco: Eco;
  private readonly tecnica: Tecnica;
  private readonly potenciaTecnica: number;
  private readonly colores: readonly [string, string];
  private estado = "intro";
  private tiempo = 1.4;
  private cdTecnica = 3;
  private golpeo = false;

  constructor(eco: Eco, x: number, y: number) {
    const s = statsEcoEnemigo(eco);
    super({ nombre: eco.nombre, hp: s.hp, ataque: s.ataque, defensa: s.defensa, exp: 40 + eco.nivel * 8, w: 12, h: 22, categoria: "eco" }, x, y - 22, true);
    this.eco = eco;
    const a = eco.forma !== null ? alma(eco.forma.personaje) : null;
    this.tecnica = a?.tecnica ?? "orbe";
    this.potenciaTecnica = s.tecnica;
    this.colores = a !== null ? [a.color, a.colorSec] : ["#888899", "#ffffff"];
  }

  get titulo(): string {
    return `Caíste aquí: ${this.eco.causa}`;
  }

  protected pensar(dt: number, ctx: Contexto): void {
    const j = ctx.jugador;
    const dx = j.cx - this.cx;
    this.tiempo -= dt;
    this.cdTecnica -= dt;
    this.vy += GRAVEDAD * dt;

    switch (this.estado) {
      case "intro":
        if (this.tiempo <= 0) this.estado = "acechar";
        break;
      case "acechar": {
        this.dir = dx < 0 ? -1 : 1;
        const lejos = Math.abs(dx) > 26;
        this.vx += ((lejos ? this.dir * 105 : 0) - this.vx) * Math.min(1, dt * 10);
        if (this.enSuelo && j.y + j.h < this.y - 20 && Math.random() < dt * 2) this.vy = -340;
        if (this.cdTecnica <= 0) {
          this.estado = "preTecnica";
          this.tiempo = 0.45;
          this.vx = 0;
        } else if (!lejos && Math.abs(j.cy - this.cy) < 24) {
          this.estado = "preGolpe";
          this.tiempo = 0.28;
          this.golpeo = false;
        }
        break;
      }
      case "preGolpe":
        this.vx *= 0.7;
        if (this.tiempo <= 0) {
          this.estado = "golpe";
          this.tiempo = 0.18;
          ctx.audio.reproducir("golpe");
        }
        break;
      case "golpe":
        if (!this.golpeo) {
          this.golpeo = true;
          const r = { x: this.dir > 0 ? this.x + this.w : this.x - 22, y: this.y + 2, w: 22, h: 16 };
          if (solapan(r, j)) ctx.golpearJugador(this.ataque, this.cx, 200);
        }
        if (this.tiempo <= 0) {
          this.estado = Math.random() < 0.35 ? "retroceso" : "acechar";
          this.tiempo = 0.3;
          if (this.estado === "retroceso") {
            this.vx = -this.dir * 260;
            this.vy = -150;
          }
        }
        break;
      case "retroceso":
        if (this.tiempo <= 0) this.estado = "acechar";
        break;
      case "preTecnica":
        this.vx = 0;
        if (this.tiempo <= 0) {
          tecnicaEnemiga(this.tecnica, this, ctx, this.potenciaTecnica, this.colores[1]);
          this.cdTecnica = 3.2 + Math.random() * 1.8;
          this.estado = "acechar";
        }
        break;
    }
    this.moverFisica(dt, ctx);
  }

  dibujar(g: CanvasRenderingContext2D): void {
    g.save();
    g.globalAlpha = 0.8 + Math.sin(this.t * 8) * 0.15;
    dibujarFigura(g, this.x, this.y, this.dir, this.color(this.colores[0]), this.colores[1], this.t, this.estado === "golpe", Math.abs(this.vx) > 10);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25;
    g.fillStyle = this.colores[1];
    g.fillRect(Math.round(this.x) - 2, Math.round(this.y) - 2, this.w + 4, this.h + 4);
    g.restore();
    if (this.estado === "preTecnica" || this.estado === "preGolpe") {
      g.fillStyle = "#ff3d3d";
      if (Math.floor(this.t * 12) % 2 === 0) g.fillRect(Math.round(this.cx) - 1, Math.round(this.y) - 10, 3, 6);
    }
  }
}

/** Figura humanoide del Portador (la usan el jugador y los Ecos). */
export function dibujarFigura(
  g: CanvasRenderingContext2D, px: number, py: number, dir: number, cuerpo: string, acento: string,
  t: number, atacando: boolean, corriendo: boolean,
): void {
  const x = Math.round(px);
  const y = Math.round(py);
  const paso = corriendo ? Math.floor(t * 12) % 2 : 0;
  // piernas
  g.fillStyle = "#1a1622";
  g.fillRect(x + 2 + paso, y + 17, 3, 5);
  g.fillRect(x + 7 - paso, y + 17, 3, 5);
  // cuerpo
  g.fillStyle = cuerpo;
  g.fillRect(x + 1, y + 7, 10, 11);
  // cabeza (capucha)
  g.fillRect(x + 2, y, 8, 8);
  g.fillStyle = "#0d0b12";
  g.fillRect(dir > 0 ? x + 5 : x + 2, y + 3, 5, 3);
  g.fillStyle = acento;
  g.fillRect(dir > 0 ? x + 8 : x + 3, y + 4, 1, 1);
  // bufanda
  g.fillStyle = acento;
  g.fillRect(x + 1, y + 7, 10, 2);
  // brazo / arma
  if (atacando) {
    g.fillStyle = "#e8e8f0";
    g.fillRect(dir > 0 ? x + 11 : x - 9, y + 9, 10, 2);
  } else {
    g.fillStyle = cuerpo;
    g.fillRect(dir > 0 ? x + 9 : x, y + 10, 3, 6);
  }
}


