// Motor de jefes configurable: forma visual + repertorio de ataques (datos en contenido/biomas.ts).
// Cada ataque se ANUNCIA (destello y "!" sobre la cabeza, o zona marcada en el suelo) antes de golpear.
// Fase 2 (≤ 50 % de vida): más rápido, anuncios más cortos y ataques extra.

import type { DefJefe, FormaJefe, PatronJefe } from "../../contenido/biomas.ts";
import { ANCHO_SALA, TILE } from "../../dominio/mundo/sala.ts";
import { solapan } from "../../motor/fisica.ts";
import type { Contexto } from "../contexto.ts";
import { Criatura, GRAVEDAD } from "./criatura.ts";
import { Enemigo } from "./enemigo.ts";
import { TECNICAS_ENEMIGAS, tecnicaEnemiga } from "./jefes.ts";
import { Proyectil } from "./proyectil.ts";
import { Patas } from "../procedural.ts";

const SUELO = 14 * TILE;
const PATRONES_DE_SUELO: ReadonlySet<PatronJefe> = new Set(["carga", "salto"]);

export class JefeConfigurable extends Criatura {
  readonly titulo: string;
  private readonly forma: FormaJefe;
  private readonly vuela: boolean;
  private readonly patrones: readonly PatronJefe[];
  private readonly patronesFase2: readonly PatronJefe[];
  private readonly c: readonly [string, string, string];
  private estado: "intro" | "pausa" | "aviso" | "carga" | "salto" | "aturdido" = "intro";
  private patron: PatronJefe = "radial";
  private tiempo = 1.4;
  private fase = 1;
  private destinoX: number;
  private destinoY = 70;
  private yaGolpeo = false;
  private ultimo: PatronJefe | null = null;
  /** Patas con cinemática inversa (solo los que caminan: gólem y bestia). */
  private patas: Patas | null = null;
  private tPatas = 0;

  constructor(def: DefJefe, x: number, piso: number) {
    super({ nombre: def.nombre, hp: def.hp, ataque: def.ataque, defensa: def.defensa, exp: def.exp, w: def.w, h: def.h, categoria: "jefe" },
      x - def.w / 2, (def.vuela === true ? 90 : piso) - def.h, true);
    this.titulo = def.titulo;
    this.forma = def.forma ?? "golem";
    this.vuela = def.vuela === true;
    const filtra = (ps: readonly PatronJefe[]): PatronJefe[] => ps.filter((p) => !this.vuela || !PATRONES_DE_SUELO.has(p));
    this.patrones = filtra(def.patrones ?? ["radial", "rafaga"]);
    this.patronesFase2 = filtra(def.patronesFase2 ?? []);
    this.c = def.colores ?? ["#5a4a6a", "#ff4d4d", "#ffffff"];
    this.destinoX = ANCHO_SALA / 2;
  }

  private get rapidez(): number {
    return this.fase === 2 ? 1.35 : 1;
  }

  protected pensar(dt: number, ctx: Contexto): void {
    const j = ctx.jugador;
    if (this.fase === 1 && this.hp <= this.hpMax / 2) {
      this.fase = 2;
      ctx.fx.destellar(this.c[1], 0.55);
      ctx.fx.sacudir(7);
      ctx.audio.reproducir("jefe");
      ctx.mensaje(`${this.nombre} se enfurece`, "#ff6a6a");
    }
    this.tiempo -= dt * this.rapidez;
    this.dir = j.cx < this.cx ? -1 : 1;

    // ---- Movimiento base
    if (this.vuela) {
      if (this.estado !== "carga") {
        this.vx = (this.destinoX - this.cx) * 1.6;
        this.vy = (this.destinoY + Math.sin(this.t * 1.8) * 10 - this.cy) * 2;
      }
      this.moverFisica(dt, ctx, true);
    } else {
      this.vy += GRAVEDAD * dt;
      if (this.estado === "pausa") this.vx += (this.dir * 40 * this.rapidez - this.vx) * Math.min(1, dt * 4);
      if (this.estado === "aviso" || this.estado === "aturdido") this.vx *= 0.8;
      const choque = this.moverFisica(dt, ctx);
      if (this.estado === "carga" && choque.pared !== 0) {
        this.estado = "aturdido";
        this.tiempo = 0.8;
        ctx.fx.sacudir(7);
        ctx.audio.reproducir("explosion");
        ctx.fx.chispas(this.cx + this.dir * this.w / 2, this.cy, this.c[2], 22, { velocidad: 160 });
      }
      if (this.estado === "salto" && choque.suelo && this.tiempo < 0.9) {
        this.ondas(ctx);
        this.pausa(0.6);
      }
    }

    // ---- Estados de ataque
    if (this.estado === "carga") {
      if (this.vuela) {
        // Picada: avanza hacia donde estaba el jugador.
        if (!this.yaGolpeo && solapan(this, j)) {
          this.yaGolpeo = true;
          ctx.golpearJugador(this.ataque * 1.3, this.cx, 300);
        }
        if (this.tiempo <= 0) this.pausa(0.5);
      } else {
        this.vx = this.dir * 290 * this.rapidez;
        if (!this.yaGolpeo && solapan(this, j)) {
          this.yaGolpeo = true;
          ctx.golpearJugador(this.ataque * 1.4, this.cx, 320);
        }
        if (Math.random() < 0.5) ctx.fx.chispas(this.cx, this.y + this.h, this.c[1], 2, { velocidad: 50, vida: 0.4 });
      }
      return;
    }
    if (this.estado === "salto") return;
    if (this.tiempo > 0) return;

    if (this.estado === "aviso") {
      this.ejecutar(ctx);
      return;
    }
    // intro / pausa / aturdido: elegir el próximo ataque (sin repetir el anterior si hay alternativas).
    const opciones = this.fase === 2 ? [...this.patrones, ...this.patronesFase2] : [...this.patrones];
    const sinRepetir = opciones.filter((p) => p !== this.ultimo);
    const lista = sinRepetir.length > 0 ? sinRepetir : opciones;
    this.patron = lista[Math.floor(Math.random() * lista.length)];
    this.ultimo = this.patron;
    this.estado = "aviso";
    this.tiempo = this.fase === 2 ? 0.4 : 0.55;
    this.flash = 0.08;
  }

  private pausa(s: number): void {
    this.estado = "pausa";
    this.tiempo = s;
  }

  private ondas(ctx: Contexto): void {
    ctx.fx.sacudir(6);
    ctx.audio.reproducir("explosion");
    for (const d of [-1, 1]) {
      ctx.agregarProyectil(new Proyectil({
        tipo: "onda", x: this.cx + d * 20, y: this.y + this.h - 8, vx: d * 180, vy: 0, w: 8, h: 14, vida: 2.5, rastrero: true,
        color: this.c[1], ataqueEnemigo: this.ataque,
      }));
    }
  }

  private disparo(ctx: Contexto, x: number, y: number, vx: number, vy: number, extra: Partial<ConstructorParameters<typeof Proyectil>[0]> = {}): void {
    ctx.agregarProyectil(new Proyectil({
      tipo: "espora", x, y, vx, vy, w: 7, h: 7, vida: 4, atraviesaParedes: true, color: this.c[1], ataqueEnemigo: this.ataque * 0.8, ...extra,
    }));
  }

  private ejecutar(ctx: Contexto): void {
    const j = ctx.jugador;
    const f2 = this.fase === 2;
    ctx.audio.reproducir("tecnica");
    switch (this.patron) {
      case "carga":
        this.estado = "carga";
        this.yaGolpeo = false;
        this.tiempo = 2;
        if (this.vuela) {
          const d = Math.hypot(j.cx - this.cx, j.cy - this.cy) || 1;
          this.vx = ((j.cx - this.cx) / d) * 320;
          this.vy = ((j.cy - this.cy) / d) * 320;
          this.tiempo = 0.6;
        }
        ctx.audio.reproducir("embestida");
        return;
      case "salto": {
        this.estado = "salto";
        this.tiempo = 1.5;
        const destino = Math.max(40, Math.min(ANCHO_SALA - 40, j.cx));
        this.vy = -470;
        this.vx = (destino - this.cx) / 0.95;
        return;
      }
      case "lluvia":
        for (let i = 0; i < (f2 ? 10 : 7); i++) {
          this.disparo(ctx, 30 + Math.random() * (ANCHO_SALA - 60), -10 - Math.random() * 140, 0, 40, { gravedad: 300, w: 8, h: 8, color: this.c[2] });
        }
        break;
      case "radial": {
        const n = f2 ? 16 : 11;
        const giro = Math.random();
        for (let i = 0; i < n; i++) {
          const a = giro + (i / n) * Math.PI * 2;
          this.disparo(ctx, this.cx, this.cy, Math.cos(a) * 100, Math.sin(a) * 100);
        }
        break;
      }
      case "rafaga": {
        const ang = Math.atan2(j.cy - this.cy, j.cx - this.cx);
        const abanico = f2 ? [-0.36, -0.18, 0, 0.18, 0.36] : [-0.2, 0, 0.2];
        for (const a of abanico) {
          this.disparo(ctx, this.cx, this.cy, Math.cos(ang + a) * 175, Math.sin(ang + a) * 175, { explota: 18, w: 8, h: 8, color: this.c[2], atraviesaParedes: false });
        }
        break;
      }
      case "raices": {
        const n = f2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const px = j.cx + (i - Math.floor(n / 2)) * (f2 ? 50 : 66);
          if (px < 20 || px > ANCHO_SALA - 20) continue;
          ctx.agregarPeligro({ x: px - 12, y: SUELO - 46, w: 24, h: 46, aviso: 0.85, activo: 0.35, danio: this.ataque * 1.1, color: this.c[1], golpeo: false });
        }
        break;
      }
      case "rayo": {
        const columnas = f2 ? [-56, 0, 56] : [0];
        for (const d of columnas) {
          ctx.agregarPeligro({ x: j.cx + d - 9, y: 0, w: 18, h: SUELO, aviso: 0.75, activo: 0.2, danio: this.ataque * 1.3, color: this.c[2], golpeo: false });
        }
        break;
      }
      case "laser":
        ctx.agregarPeligro({ x: 0, y: j.y + j.h / 2 - 6, w: ANCHO_SALA, h: 12, aviso: 0.8, activo: 0.25, danio: this.ataque * 1.3, color: this.c[1], golpeo: false });
        if (f2) ctx.agregarPeligro({ x: 0, y: SUELO - 14, w: ANCHO_SALA, h: 12, aviso: 1.2, activo: 0.25, danio: this.ataque * 1.1, color: this.c[2], golpeo: false });
        break;
      case "invocar": {
        const vivos = ctx.criaturas.filter((c) => !c.esJefe && !c.muerto && !("esObjeto" in c)).length;
        if (vivos < 4) {
          ctx.fx.chispas(this.cx, this.cy, this.c[1], 30, { velocidad: 120, brillo: true });
          for (const d of [-1, 1]) {
            ctx.agregarCriatura(new Enemigo(this.vuela ? "volador" : "caminante", ctx.piso, ctx.bioma, this.cx + d * 30, this.vuela ? this.cy + 20 : SUELO, false));
          }
        }
        break;
      }
      case "teleport":
        ctx.fx.chispas(this.cx, this.cy, this.c[1], 30, { velocidad: 150, brillo: true });
        this.destinoX = j.cx < ANCHO_SALA / 2 ? ANCHO_SALA - 90 - Math.random() * 80 : 90 + Math.random() * 80;
        this.destinoY = 50 + Math.random() * 60;
        if (this.vuela) {
          this.x = this.destinoX - this.w / 2;
          this.y = this.destinoY - this.h / 2;
        } else {
          this.x = this.destinoX - this.w / 2;
        }
        ctx.fx.chispas(this.cx, this.cy, this.c[2], 30, { velocidad: 150, brillo: true });
        // Llega disparando.
        this.disparo(ctx, this.cx, this.cy, (j.cx > this.cx ? 1 : -1) * 160, 0, { explota: 20 });
        break;
      case "minas":
        for (let i = 0; i < (f2 ? 5 : 3); i++) {
          const px = Math.max(30, Math.min(ANCHO_SALA - 30, j.cx + (i - 1) * 46 + (Math.random() - 0.5) * 20));
          ctx.agregarProyectil(new Proyectil({
            tipo: "orbe", x: px, y: SUELO - 30, vx: 0, vy: 0, w: 9, h: 9, vida: 1.6, gravedad: 500, explota: 30,
            color: this.c[2], ataqueEnemigo: this.ataque * 1.1,
          }));
        }
        break;
      case "tecnica": {
        const t = TECNICAS_ENEMIGAS[Math.floor(Math.random() * TECNICAS_ENEMIGAS.length)];
        tecnicaEnemiga(t, this, ctx, this.ataque, this.c[1]);
        break;
      }
    }
    if (this.vuela && Math.random() < 0.4) {
      this.destinoX = 80 + Math.random() * (ANCHO_SALA - 160);
      this.destinoY = 50 + Math.random() * 60;
    }
    this.pausa(f2 ? 0.75 : 1.05);
  }

  override danioContacto(): number {
    return Math.round(this.ataque * (this.vuela ? 0.6 : 0.8));
  }

  // ---------------- Dibujo por forma ----------------

  private dibujarPatas(
    g: CanvasRenderingContext2D, caderas: readonly { dx: number; dy: number }[], muslo: number, canilla: number, zancada: number,
    color: string, articulacion: string, grosor: number,
  ): void {
    if (this.vuela) return;
    if (this.patas === null) this.patas = new Patas(caderas, muslo, canilla, zancada);
    const dt = Math.min(0.05, Math.max(0, this.t - this.tPatas));
    this.tPatas = this.t;
    this.patas.actualizar(this.cx, this.cy, this.y + this.h, this.vx, dt);
    this.patas.dibujar(g, this.cx, this.cy, this.dir, color, articulacion, grosor);
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const [base, acento, brillo] = this.c;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const w = this.w;
    const h = this.h;
    const cuerpo = this.color(base);
    const t = this.t;
    const furia = this.fase === 2;
    const r = (rx: number, ry: number, rw: number, rh: number, c: string): void => {
      g.fillStyle = c;
      g.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
    };
    // Aura
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.18 + Math.sin(t * 4) * 0.06;
    g.fillStyle = furia ? "#ff3d3d" : acento;
    g.beginPath();
    g.ellipse(this.cx, this.cy, w * 0.8, h * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    const d = this.dir;
    const ojoX = (o: number): number => (d > 0 ? x + w - o : x + o);
    switch (this.forma) {
      case "golem": {
        // Piernas de roca con IK: los pies se plantan y dan pasos en arco mientras el cuerpo avanza.
        this.dibujarPatas(g, [{ dx: -w * 0.24, dy: h / 2 - 13 }, { dx: w * 0.24, dy: h / 2 - 13 }], 9, 9, 16, this.color("#2a2020"), acento, 6);
        r(x + 2, y + 12, w - 4, h - 24, cuerpo);
        r(x + 6, y + 2, w - 12, 14, cuerpo);
        // grietas brillantes
        r(x + w / 2 - 2, y + 16, 4, h - 30, acento);
        r(x + 8, y + 24, w / 2 - 8, 2, acento);
        r(ojoX(12), y + 7, 4, 3, brillo);
        // brazos de roca
        const golpe = this.estado === "aviso" ? -6 : 0;
        r(d > 0 ? x + w - 4 : x - 8, y + 14 + golpe, 12, 18, this.color("#3a2a2a"));
        r(d > 0 ? x - 6 : x + w - 6, y + 16, 10, 16, this.color("#3a2a2a"));
        break;
      }
      case "bestia": {
        const ond = Math.sin(t * 6) * 2;
        // Cuatro patas con IK que se alternan al andar (como un insecto de cripta).
        this.dibujarPatas(g, [{ dx: -w * 0.38, dy: h / 2 - 8 }, { dx: -w * 0.14, dy: h / 2 - 8 }, { dx: w * 0.14, dy: h / 2 - 8 }, { dx: w * 0.38, dy: h / 2 - 8 }],
          6, 7, 11, this.color("#1a1420"), acento, 3);
        r(x, y + 8 + ond, w, h - 14, cuerpo);
        r(d > 0 ? x + w - 16 : x, y + 2, 16, h - 8, cuerpo);
        // mandíbula
        const abre = this.estado === "aviso" ? 5 : 1;
        r(d > 0 ? x + w - 14 : x + 2, y + h - 10 + abre, 12, 3, this.color("#0a0a14"));
        for (let i = 0; i < 4; i++) r(d > 0 ? x + w - 13 + i * 3 : x + 3 + i * 3, y + h - 10, 1, 2, "#ffffff");
        r(ojoX(9), y + 8, 3, 3, brillo);
        // aletas / púas
        for (let i = 0; i < 5; i++) r(x + 6 + i * 8, y + 2 + ond - (i % 2) * 3, 4, 8, acento);
        // cola
        r(d > 0 ? x - 8 : x + w, y + 14 - ond, 8, 6, cuerpo);
        break;
      }
      case "mascara": {
        // Libros / fragmentos orbitando
        for (let i = 0; i < 5; i++) {
          const a = t * 1.4 + (i / 5) * Math.PI * 2;
          r(this.cx + Math.cos(a) * (w * 0.8) - 3, this.cy + Math.sin(a) * (h * 0.5) - 4, 6, 8, i % 2 === 0 ? acento : brillo);
        }
        r(x + 4, y + h * 0.45, w - 8, h * 0.55, this.color("#1a1010"));
        for (let i = 0; i < 4; i++) r(x + 6 + i * 7, y + h - 2 + Math.sin(t * 5 + i) * 2, 4, 4, this.color("#1a1010"));
        r(x + 2, y, w - 4, h * 0.5, this.color("#e8dcc0"));
        r(x + 7, y + 7, 6, 4, "#000000");
        r(x + w - 13, y + 7, 6, 4, "#000000");
        r(x + 9, y + 8, 2, 2, furia ? "#ff3d3d" : acento);
        r(x + w - 11, y + 8, 2, 2, furia ? "#ff3d3d" : acento);
        r(x + w / 2 - 4, y + 15, 8, 2, "#000000");
        r(x + w / 2 - 1, y - 2, 2, 6, acento);
        break;
      }
      case "flor": {
        // tallo y raíces
        r(this.cx - 3, y + h * 0.6, 6, h * 0.4 + 30, this.color("#2a4a2a"));
        for (let i = 0; i < 4; i++) r(this.cx - 14 + i * 9, y + h - 2 + Math.sin(t * 3 + i) * 3, 3, 10, this.color("#2a4a2a"));
        // pétalos
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.sin(t) * 0.1;
          r(this.cx + Math.cos(a) * w * 0.38 - 6, this.cy + Math.sin(a) * h * 0.38 - 6, 12, 12, this.color(acento));
        }
        r(this.cx - w * 0.25, this.cy - h * 0.25, w * 0.5, h * 0.5, cuerpo);
        // boca
        const abre = this.estado === "aviso" ? 6 : 2;
        r(this.cx - 7, this.cy - abre / 2, 14, abre, "#0a0006");
        for (let i = 0; i < 4; i++) r(this.cx - 6 + i * 4, this.cy - abre / 2, 2, 2, "#ffffff");
        r(this.cx - 2, this.cy - h * 0.18, 4, 3, brillo);
        break;
      }
      case "reina": {
        // vestido largo flotante
        for (let k = 0; k < h - 14; k += 2) {
          const ancho = 8 + k * 0.45;
          r(this.cx - ancho / 2 + Math.sin(t * 3 + k * 0.2), y + 14 + k, ancho, 2, cuerpo);
        }
        r(this.cx - 4, y + 6, 8, 9, this.color("#e8f4ff"));
        r(this.cx + (d > 0 ? 0 : -3), y + 9, 3, 2, "#000000");
        r(this.cx + (d > 0 ? 1 : -2), y + 9, 1, 1, brillo);
        // corona de hielo
        for (let i = 0; i < 5; i++) r(this.cx - 6 + i * 3, y + 2 - (i % 2) * 3, 2, 5, acento);
        // brazos-cristal
        r(this.cx - 12, y + 16, 4, 12, acento);
        r(this.cx + 8, y + 16, 4, 12, acento);
        // fragmentos orbitando
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + (i / 3) * Math.PI * 2;
          r(this.cx + Math.cos(a) * 24 - 2, this.cy + Math.sin(a) * 16 - 4, 4, 8, brillo);
        }
        break;
      }
      case "espectro": {
        // túnica con jirones
        r(x + 4, y + 12, w - 8, h - 18, cuerpo);
        for (let i = 0; i < 5; i++) r(x + 4 + i * ((w - 8) / 5), y + h - 6 + Math.sin(t * 6 + i) * 3, (w - 8) / 5 - 1, 6, cuerpo);
        r(x + 6, y, w - 12, 14, cuerpo);
        r(x + 9, y + 4, w - 18, 7, "#000000");
        r(ojoX(12), y + 6, 2, 2, brillo);
        r(ojoX(17), y + 6, 2, 2, brillo);
        // estrellas en órbita
        for (let i = 0; i < 6; i++) {
          const a = -t * 1.3 + (i / 6) * Math.PI * 2;
          const sx = this.cx + Math.cos(a) * w * 0.9;
          const sy = this.cy + Math.sin(a) * h * 0.55;
          r(sx - 1, sy - 3, 2, 6, acento);
          r(sx - 3, sy - 1, 6, 2, acento);
        }
        break;
      }
    }
    if (this.estado === "aviso" && Math.floor(t * 12) % 2 === 1) {
      r(this.cx - 1, y - 14, 3, 7, "#ff3d3d");
      r(this.cx - 1, y - 5, 3, 2, "#ff3d3d");
    }
  }
}
