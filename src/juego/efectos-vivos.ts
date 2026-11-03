// Efectos "vivos" del jugador: lo que queda en el mundo después de lanzar una habilidad mutada o una resonancia.
//
//   · ZONAS: áreas que siguen dañando cada cierto tiempo (grietas, tornados, columnas, agujeros negros, nubes).
//     Pueden moverse, seguir al Portador y ATRAER enemigos hacia su centro.
//   · ECOS: copias translúcidas del Portador que deja un proyectil al morir; estallan, se pueden usar para
//     teletransportarse e imitan la Definitiva.
//   · PROGRAMADOS: acciones diferidas (la réplica de una nova, la ruptura al final de una embestida…).
//   · VIGILANTES: "cuando este proyectil termine, haz esto" (para dejar el eco donde murió).

import type { DefResonancia } from "../contenido/resonancias.ts";
import type { AtaqueJugador, Contexto } from "./contexto.ts";
import type { Criatura } from "./entidades/criatura.ts";
import { Enemigo } from "./entidades/enemigo.ts";
import { Proyectil } from "./entidades/proyectil.ts";
import { dibujarPortador } from "./render-portador.ts";
import type { Luz } from "./render.ts";

export type FormaZona = "grieta" | "tornado" | "columna" | "agujero" | "nube" | "aura" | "pico" | "haz";

export interface ZonaHabilidad {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Segundos que dura. */
  dur: number;
  /** Cada cuánto daña (s). */
  tick: number;
  readonly ataque: AtaqueJugador;
  readonly color: string;
  readonly forma: FormaZona;
  vx?: number;
  /** Fuerza con la que atrae a los enemigos hacia el centro (px/s). */
  readonly atrae?: number;
  /** Se mueve con el Portador. */
  readonly sigueJugador?: boolean;
  /** Al terminar: un último estallido con este ataque. */
  readonly final?: AtaqueJugador;
}

interface ZonaViva extends ZonaHabilidad {
  t: number;
  desdeTick: number;
}

export interface Eco {
  x: number;
  pies: number;
  vida: number;
  readonly color: string;
  readonly dir: number;
}

export class EfectosVivos {
  readonly zonas: ZonaViva[] = [];
  readonly ecos: Eco[] = [];
  private readonly programados: { t: number; accion: () => void }[] = [];
  private readonly vigilantes: { p: Proyectil; accion: (x: number, y: number) => void }[] = [];

  limpiar(): void {
    this.zonas.length = 0;
    this.ecos.length = 0;
    this.programados.length = 0;
    this.vigilantes.length = 0;
  }

  zona(z: ZonaHabilidad): void {
    this.zonas.push({ ...z, t: 0, desdeTick: z.tick });
    if (this.zonas.length > 24) this.zonas.shift();
  }

  programar(seg: number, accion: () => void): void {
    this.programados.push({ t: seg, accion });
  }

  alTerminar(p: Proyectil, accion: (x: number, y: number) => void): void {
    this.vigilantes.push({ p, accion });
  }

  crearEco(x: number, pies: number, color: string, dir: number): void {
    this.ecos.push({ x, pies, vida: 4, color, dir });
    if (this.ecos.length > 6) this.ecos.shift();
  }

  /** El eco más reciente (para teletransportarse), y lo quita. */
  consumirEco(): Eco | undefined {
    return this.ecos.pop();
  }

  actualizar(dt: number, ctx: Contexto, proyectiles: readonly Proyectil[]): void {
    for (let i = this.programados.length - 1; i >= 0; i--) {
      const p = this.programados[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.programados.splice(i, 1);
        p.accion();
      }
    }
    for (let i = this.vigilantes.length - 1; i >= 0; i--) {
      const v = this.vigilantes[i];
      if (!proyectiles.includes(v.p)) {
        this.vigilantes.splice(i, 1);
        v.accion(v.p.x + v.p.w / 2, v.p.y + v.p.h / 2);
      }
    }
    for (const e of this.ecos) e.vida -= dt;
    for (let i = this.ecos.length - 1; i >= 0; i--) if (this.ecos[i].vida <= 0) this.ecos.splice(i, 1);

    const j = ctx.jugador;
    for (let i = this.zonas.length - 1; i >= 0; i--) {
      const z = this.zonas[i];
      z.t += dt;
      if (z.sigueJugador === true) {
        z.x = j.cx - z.w / 2;
        z.y = j.cy - z.h / 2;
      }
      z.x += (z.vx ?? 0) * dt;
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2;
      if (z.atrae !== undefined) atraer(ctx.criaturas, cx, cy, Math.max(z.w, z.h) * 1.4, z.atrae, dt);
      z.desdeTick += dt;
      if (z.desdeTick >= z.tick) {
        z.desdeTick = 0;
        ctx.golpearArea(z, z.ataque, (z.vx ?? 0) >= 0 ? 1 : -1, new Set());
      }
      particulasZona(ctx, z);
      if (z.t >= z.dur) {
        this.zonas.splice(i, 1);
        if (z.final !== undefined) {
          const r = Math.max(z.w, z.h) * 0.8;
          ctx.golpearArea({ x: cx - r, y: cy - r * 0.7, w: r * 2, h: r * 1.4 }, z.final, 1, new Set());
          ctx.fx.estallar(cx, cy, { colores: [z.color, "#ffffff"], n: 30, velocidad: 200, tam: [1, 3], brillan: true, chispa: z.color, luz: { color: z.color, r: r * 2, dur: 0.5 } });
          ctx.fx.sacudir(5);
          ctx.audio.reproducir("explosion");
        }
      }
    }
  }

  dibujar(g: CanvasRenderingContext2D, t: number): void {
    for (const z of this.zonas) {
      const k = Math.min(1, (z.dur - z.t) * 3) * Math.min(1, z.t * 8);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.fillStyle = z.color;
      const cx = z.x + z.w / 2;
      switch (z.forma) {
        case "tornado": {
          for (let a = 0; a < 7; a++) {
            const yy = z.y + z.h - a * (z.h / 7);
            const ancho = 4 + a * (z.w / 9) + Math.sin(t * 9 + a) * 2;
            g.globalAlpha = 0.18 * k;
            g.fillRect(Math.round(cx - ancho / 2 + Math.sin(t * 6 + a * 0.8) * 4), Math.round(yy - z.h / 7), Math.round(ancho), Math.ceil(z.h / 7));
          }
          break;
        }
        case "agujero": {
          const r = Math.max(z.w, z.h) / 2;
          const grad = g.createRadialGradient(cx, z.y + z.h / 2, 0, cx, z.y + z.h / 2, r);
          grad.addColorStop(0, "rgba(0,0,0,0.9)");
          grad.addColorStop(0.35, z.color);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          g.globalCompositeOperation = "source-over";
          g.globalAlpha = 0.7 * k;
          g.fillStyle = grad;
          g.fillRect(z.x, z.y, z.w, z.h);
          break;
        }
        case "columna":
        case "pico":
        case "haz":
          g.globalAlpha = (0.25 + Math.sin(t * 30) * 0.08) * k;
          g.fillRect(Math.round(z.x), Math.round(z.y), Math.round(z.w), Math.round(z.h));
          g.globalAlpha = 0.6 * k;
          g.fillStyle = "#ffffff";
          if (z.forma === "haz") g.fillRect(Math.round(z.x), Math.round(z.y + z.h / 2 - 1), Math.round(z.w), 2);
          else g.fillRect(Math.round(cx - 1), Math.round(z.y), 2, Math.round(z.h));
          break;
        default:
          g.globalAlpha = 0.16 * k;
          g.fillRect(Math.round(z.x), Math.round(z.y), Math.round(z.w), Math.round(z.h));
          g.globalAlpha = 0.5 * k;
          g.fillRect(Math.round(z.x), Math.round(z.y + z.h - 2), Math.round(z.w), 2);
          break;
      }
      g.restore();
    }
    // Ecos: tu silueta translúcida, del color de la habilidad, parpadeando al apagarse.
    for (const e of this.ecos) {
      g.save();
      g.globalAlpha = Math.min(0.55, e.vida * 0.4) * (e.vida < 1 && Math.floor(e.vida * 12) % 2 === 0 ? 0.4 : 1);
      g.globalCompositeOperation = "lighter";
      dibujarPortador(g, e.x, e.pies, e.dir, "quieto", { cuerpo: e.color, acento: "#ffffff" }, t);
      g.restore();
    }
  }

  luces(): Luz[] {
    const r: Luz[] = [];
    for (const z of this.zonas) r.push({ x: z.x + z.w / 2, y: z.y + z.h / 2, r: Math.max(40, Math.max(z.w, z.h) * 0.9), fuerza: 0.7, color: z.color });
    for (const e of this.ecos) r.push({ x: e.x, y: e.pies - 12, r: 30, fuerza: 0.5, color: e.color });
    return r;
  }
}

/** Atrae a los enemigos (no pesados ni jefes) hacia un punto. */
export function atraer(criaturas: readonly Criatura[], x: number, y: number, radio: number, fuerza: number, dt: number): void {
  for (const c of criaturas) {
    if (!(c instanceof Enemigo) || c.muerto || c.pesado || c.esJefe) continue;
    const dx = x - c.cx;
    const dy = y - c.cy;
    const d = Math.hypot(dx, dy);
    if (d > radio || d < 4) continue;
    c.aturdido = Math.max(c.aturdido, 0.15);
    c.vx = (dx / d) * fuerza;
    c.vy += (dy / d) * fuerza * dt * 4;
  }
}

function particulasZona(ctx: Contexto, z: ZonaViva): void {
  if (Math.random() > 0.6) return;
  const x = z.x + Math.random() * z.w;
  const y = z.forma === "grieta" || z.forma === "nube" ? z.y + z.h - Math.random() * z.h * 0.6 : z.y + Math.random() * z.h;
  const sube = z.forma === "tornado" || z.forma === "columna" || z.forma === "grieta" || z.forma === "pico";
  ctx.fx.chispas(x, y, z.color, 1, { velocidad: sube ? 60 : 30, angulo: sube ? -Math.PI / 2 : undefined, apertura: 0.6, vida: 0.45, gravedad: sube ? -40 : 0, brillo: true });
}

// ---------------------------------------------------------------------------------------------------------------
// Resonancias: el efecto combinado de dos esencias.

export function ejecutarResonancia(ctx: Contexto, vivos: EfectosVivos, r: DefResonancia, potencia: number): void {
  const j = ctx.jugador;
  const dir = j.dir;
  const pie = j.y + j.h;
  const at = (mult: number, extra: Partial<AtaqueJugador> = {}): AtaqueJugador => ({ potencia: potencia * mult, tipo: "tecnica", empuje: 80, ...extra });
  ctx.fx.destellar(r.color, 0.5);
  ctx.fx.sacudir(6);
  ctx.audio.reproducir("unico");
  ctx.fx.texto(j.cx, j.y - 30, `✦ ${r.nombre.toUpperCase()} ✦`, r.color, true);
  switch (r.id) {
    case "tornado":
      vivos.zona({ x: j.cx + dir * 20 - 18, y: pie - 70, w: 36, h: 70, dur: 3, tick: 0.25, ataque: at(0.35, { quema: true, empuje: 30 }), color: r.color, forma: "tornado", vx: dir * 70, atrae: 140 });
      break;
    case "glacial": {
      const objetivos = ctx.criaturas.filter((c) => !c.muerto && Math.abs(c.cx - j.cx) < 260 && Math.abs(c.cy - j.cy) < 140).slice(0, 8);
      objetivos.forEach((c, k) => vivos.programar(k * 0.08, () => {
        ctx.golpearArea({ x: c.cx - 14, y: c.y - 6, w: 28, h: c.h + 12 }, at(1.1, { elementos: ["hielo", "hielo", "hielo"] }), dir, new Set());
        ctx.fx.estallar(c.cx, c.cy, { colores: ["#bff3ff", "#ffffff", "#7fe3ff"], n: 12, velocidad: 140, tam: [1, 3], brillan: true, chispa: "#ffffff", luz: { color: "#bff3ff", r: 50, dur: 0.3 } });
      }));
      break;
    }
    case "miasma":
      vivos.zona({ x: j.cx + dir * 50 - 50, y: pie - 50, w: 100, h: 50, dur: 2.2, tick: 0.4, ataque: at(0.25, { elementos: ["veneno"], empuje: 0 }), color: "#9aff5a", forma: "nube", final: at(2.2, { quema: true, empuje: 220 }) });
      break;
    case "glaciar":
      for (let k = 0; k < 7; k++) {
        vivos.programar(k * 0.09, () => vivos.zona({ x: j.cx + dir * (24 + k * 26) - 9, y: pie - 44, w: 18, h: 44, dur: 0.6, tick: 0.3, ataque: at(0.9, { elementos: ["hielo", "hielo"], lanzar: true }), color: "#7fe3ff", forma: "pico" }));
      }
      break;
    case "rayo-negro":
      vivos.zona({ x: dir > 0 ? j.cx : 0, y: j.cy - 10, w: dir > 0 ? 480 - j.cx : j.cx, h: 20, dur: 0.6, tick: 0.15, ataque: at(0.8, { aturde: 0.6, empuje: 40 }), color: "#7d4dff", forma: "haz" });
      break;
    case "vendaval":
      ctx.golpearArea({ x: j.cx - 110, y: j.cy - 60, w: 220, h: 120 }, at(0.9, { elementos: ["veneno", "veneno"], empuje: 360 }), dir, new Set());
      for (let k = 0; k < 40; k++) ctx.fx.chispas(j.cx, j.cy, k % 2 === 0 ? "#9aff5a" : "#bff3ff", 1, { velocidad: 260, vida: 0.5, gravedad: 0, brillo: true });
      break;
    case "erupcion":
      for (let k = 0; k < 6; k++) {
        const lado = k % 2 === 0 ? 1 : -1;
        vivos.programar(Math.floor(k / 2) * 0.14, () => vivos.zona({ x: j.cx + lado * (30 + Math.floor(k / 2) * 34) - 10, y: pie - 60, w: 20, h: 60, dur: 0.9, tick: 0.3, ataque: at(0.8, { quema: true, lanzar: true }), color: "#ff5a2a", forma: "columna" }));
      }
      break;
    case "eclipse":
      vivos.zona({ x: j.cx + dir * 70 - 40, y: j.cy - 40, w: 80, h: 80, dur: 2, tick: 0.3, ataque: at(0.3, { empuje: 0 }), color: "#b04dff", forma: "agujero", atrae: 170, final: at(2.6, { empuje: 260 }) });
      break;
    case "ciclon":
      vivos.zona({ x: j.cx - 50, y: j.cy - 40, w: 100, h: 80, dur: 2.5, tick: 0.25, ataque: at(0.4, { aturde: 0.3, empuje: 60 }), color: "#ffe27a", forma: "aura", sigueJugador: true });
      break;
    case "prisma":
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.agregarProyectil(new Proyectil({
          tipo: "rayo", x: j.cx, y: j.cy, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, w: 10, h: 6, vida: 0.9, atraviesa: true,
          color: "#5fd0ff", ataqueJugador: at(0.9, { elementos: ["hielo"] }),
        }));
      }
      break;
  }
}
