// Cosas del escenario: botín en el suelo (con haz de luz según rareza) e interactuables.

import { COLOR_FAMILIA, alma } from "../../contenido/almas.ts";
import { hd } from "../../motor/texto-hd.ts";
import { COLORES_RAREZA, OBJ_CAJA_ALMAS, OBJ_RELICARIO, apilable, runaDeObjeto } from "../../contenido/objetos.ts";
import { AURA_ESTRELLA, colorEstrella } from "../../dominio/relicario.ts";
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

  /** Dibuja el botín según su rareza. `cerca`: el Portador está al lado (se muestra el nombre). */
  dibujar(g: CanvasRenderingContext2D, cerca = false): void {
    const p = this.premio;
    const color = colorPremio(p);
    const tier = tierPremio(p);
    const t = this.t;
    const cx = Math.round(this.x + 4);
    const base = Math.round(this.y + 8);
    // Rebote al caer (aparece "inflándose") y flote suave ya en el suelo.
    const pop = t < 0.22 ? 0.55 + (t / 0.22) * 0.6 : t < 0.32 ? 1.15 - ((t - 0.22) / 0.1) * 0.15 : 1;
    const flote = this.enSuelo ? Math.sin(t * 3 + this.x) * 1.5 - 1 : 0;
    g.save();

    // Sombra en el suelo
    if (this.enSuelo) {
      g.fillStyle = "#000000";
      g.globalAlpha = 0.35;
      g.beginPath();
      g.ellipse(cx, base, 4 + tier, 1.5, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    g.globalCompositeOperation = "lighter";
    const pulso = 0.5 + Math.sin(t * 4) * 0.5;
    // Haz de luz en cono (raro en adelante): cuanto más raro, más alto y ancho.
    if (tier >= 2) {
      const alto = 40 + tier * 22;
      const ancho = 2 + tier;
      const grad = g.createLinearGradient(0, base - alto, 0, base);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.7, color);
      grad.addColorStop(1, "#ffffff");
      g.globalAlpha = 0.22 + pulso * 0.12;
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx - 1, base - alto);
      g.lineTo(cx + 1, base - alto);
      g.lineTo(cx + ancho, base);
      g.lineTo(cx - ancho, base);
      g.closePath();
      g.fill();
      if (tier >= 4) {
        g.globalAlpha = 0.5 + pulso * 0.3;
        g.fillStyle = "#ffffff";
        g.fillRect(cx, base - alto * 0.8, 1, alto * 0.8);
      }
    }
    // Aura
    if (tier >= 1) {
      const r = 5 + tier * 2.5 + pulso * 1.5;
      const grad = g.createRadialGradient(cx, base - 4 + flote, 0, cx, base - 4 + flote, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.35 + tier * 0.06;
      g.fillStyle = grad;
      g.fillRect(cx - r, base - 4 + flote - r, r * 2, r * 2);
    }
    // Anillo giratorio y chispas en órbita (legendario y mítico)
    if (tier >= 4) {
      g.globalAlpha = 0.8;
      g.strokeStyle = color;
      g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const a0 = t * 2.4 + (k * Math.PI) / 2;
        g.beginPath();
        g.ellipse(cx, base, 9, 2.5, 0, a0, a0 + 0.9);
        g.stroke();
      }
      for (let k = 0; k < tier - 1; k++) {
        const a = t * 3 + (k * Math.PI * 2) / (tier - 1);
        g.fillStyle = k % 2 === 0 ? "#ffffff" : color;
        g.fillRect(Math.round(cx + Math.cos(a) * 9), Math.round(base - 5 + flote + Math.sin(a) * 4 - Math.sin(t * 2 + k) * 3), 1, 1);
      }
    }
    // Destellos: una estrellita que aparece y se apaga cerca del objeto
    if (tier >= 1) {
      const ciclo = (t * 0.9 + this.x * 0.013) % 1;
      if (ciclo < 0.35) {
        const f = Math.sin((ciclo / 0.35) * Math.PI);
        const sx = Math.round(cx + Math.sin(Math.floor(t * 0.9) * 2.3) * 6);
        const sy = Math.round(base - 9 + flote + Math.cos(Math.floor(t * 0.9) * 1.7) * 3);
        g.globalAlpha = f;
        g.fillStyle = "#ffffff";
        g.fillRect(sx, sy - 1, 1, 3);
        g.fillRect(sx - 1, sy, 3, 1);
      }
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    // El objeto en sí (con el "pop" de escala al aparecer)
    g.translate(cx, base + flote);
    g.scale(pop, pop);
    this.dibujarIcono(g, color, tier);
    g.restore();

    if (cerca && this.recogible) {
      const nombre = nombrePremio(p);
      hd.texto(g, nombre, cx, base - 14 - (tier >= 2 ? 3 : 0), { color, alinear: "center", tam: 7 });
    }
  }

  /** Ícono centrado en (0, 0) = base del objeto. */
  private dibujarIcono(g: CanvasRenderingContext2D, color: string, tier: number): void {
    const p = this.premio;
    if (p.tipo === "objeto" && (p.objeto === OBJ_RELICARIO || p.objeto === OBJ_CAJA_ALMAS)) {
      dibujarRelicario(g, this.t, 1, p.objeto === OBJ_CAJA_ALMAS);
      return;
    }
    const icono: Icono | null = p.tipo === "equipo" ? iconoEquipo(p.equipo) : p.tipo === "objeto" ? iconoObjeto(p.objeto) : null;
    const img = icono !== null ? imagenDe(icono) : null;
    if (icono !== null && img !== null) {
      const [, , w, h] = icono.rect;
      // Contorno del color de la rareza: el mismo sprite desplazado detrás.
      if (tier >= 1) {
        g.save();
        g.globalAlpha = 0.55;
        g.filter = `drop-shadow(0 0 1px ${color})`;
        dibujarRecorte(g, img, icono.rect, -w / 2, -h);
        g.restore();
      }
      dibujarRecorte(g, img, icono.rect, -w / 2, -h);
      return;
    }
    switch (p.tipo) {
      case "corazones": {
        const s = p.cantidad >= 5 ? 2 : 1;
        g.fillStyle = "#5a0a1a";
        g.fillRect(-4 * s, -7 * s, 8 * s, 4 * s);
        g.fillStyle = color;
        g.fillRect(-3 * s, -7 * s, 2 * s, 2 * s);
        g.fillRect(1 * s, -7 * s, 2 * s, 2 * s);
        g.fillRect(-4 * s, -6 * s, 8 * s, 2 * s);
        g.fillRect(-3 * s, -4 * s, 6 * s, 1 * s);
        g.fillRect(-2 * s, -3 * s, 4 * s, 1 * s);
        g.fillRect(-1 * s, -2 * s, 2 * s, 1 * s);
        g.fillStyle = "#ffffff";
        g.fillRect(-3 * s, -6 * s, 1, 1);
        break;
      }
      case "subarma":
        dibujarIconoSubarma(g, p.subarma, 0, -4);
        break;
      case "esquirlas": {
        // Cristal facetado; más esquirlas = más cristales
        const n = p.cantidad >= 60 ? 3 : p.cantidad >= 20 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const dx = (k - (n - 1) / 2) * 4;
          const alto = k === 1 ? 9 : 7;
          g.fillStyle = "#3a8ab0";
          g.beginPath();
          g.moveTo(dx, -alto);
          g.lineTo(dx + 2.5, -alto / 2);
          g.lineTo(dx, 0);
          g.lineTo(dx - 2.5, -alto / 2);
          g.closePath();
          g.fill();
          g.fillStyle = color;
          g.beginPath();
          g.moveTo(dx, -alto);
          g.lineTo(dx + 2.5, -alto / 2);
          g.lineTo(dx, -1);
          g.closePath();
          g.fill();
          g.fillStyle = "#ffffff";
          g.fillRect(Math.round(dx - 1), Math.round(-alto + 2), 1, 2);
        }
        break;
      }
      case "objeto": {
        // Frasco: cuello, corcho y líquido del color del objeto
        g.fillStyle = "#8a6a3a";
        g.fillRect(-1, -9, 2, 1);
        g.fillStyle = "#d8e0f0";
        g.fillRect(-1, -8, 2, 2);
        g.fillRect(-3, -6, 6, 6);
        g.fillStyle = color;
        g.fillRect(-2, -4, 4, 3);
        g.fillStyle = "#ffffff";
        g.fillRect(-2, -5, 1, 2);
        break;
      }
      case "equipo":
        dibujarIconoPieza(g, p.equipo.ranura, 0, -4, color);
        break;
      case "carta": {
        // Carta con marco del color de su familia, dorso y estrellas en pips
        g.fillStyle = "#1a1020";
        g.fillRect(-5, -13, 10, 13);
        g.fillStyle = "#f2e6d0";
        g.fillRect(-4, -12, 8, 11);
        g.fillStyle = color;
        g.fillRect(-3, -11, 6, 7);
        g.fillStyle = "#ffffff";
        g.fillRect(-1, -9, 2, 2);
        const pips = Math.min(6, p.carta.nivel + 1);
        g.fillStyle = "#d8a020";
        for (let k = 0; k < pips; k++) g.fillRect(-3 + (k % 3) * 2 + (k >= 3 ? 1 : 0), k >= 3 ? -2 : -3, 1, 1);
        break;
      }
    }
  }
}

/** Nivel visual del botín (0 común … 5 mítico): define aura, haz, anillo y chispas. */
export function tierPremio(p: Premio): number {
  switch (p.tipo) {
    case "equipo": return p.equipo.rareza;
    case "carta": return Math.min(5, Math.floor(p.carta.nivel / 2));
    case "subarma": return 1;
    case "objeto": {
      if (p.objeto === OBJ_RELICARIO) return 4;
      if (p.objeto === OBJ_CAJA_ALMAS) return 1;
      const ru = runaDeObjeto(p.objeto);
      return ru !== undefined ? Math.min(5, ru.nivel + 1) : 0;
    }
    default: return 0;
  }
}

export function nombrePremio(p: Premio): string {
  switch (p.tipo) {
    case "equipo": return p.equipo.nombre;
    case "carta": return `Carta de ${alma(p.carta.personaje).nombre} ${p.carta.nivel + 1}★`;
    case "objeto": return apilable(p.objeto)?.nombre ?? "Objeto";
    case "esquirlas": return `${p.cantidad} esquirlas`;
    case "corazones": return `${p.cantidad} corazón${p.cantidad === 1 ? "" : "es"}`;
    case "subarma": return SUBARMAS[p.subarma].nombre;
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

export type TipoInteractuable = "cofre" | "altar" | "faro" | "reliquia" | "mercader" | "portal" | "yunque" | "campana";

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
  /** Campana del desafío: color de la variante de arena. */
  color = "#ff6a3d";

  constructor(tipo: TipoInteractuable, x: number, piso: number, reliquia?: Reliquia) {
    this.tipo = tipo;
    this.reliquia = reliquia;
    const tam: Record<TipoInteractuable, [number, number]> = {
      cofre: [16, 12], altar: [28, 26], faro: [14, 34], reliquia: [16, 24], mercader: [18, 24], portal: [26, 38], yunque: [20, 14], campana: [18, 30],
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
      case "campana": return "Tocar la campana: empezar el desafío";
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
      case "campana": {
        // Pórtico de madera con una campana de bronce que se balancea; el estandarte tiene el color del desafío.
        if (!this.usado) brillo(this.color, 22, 0.2);
        g.fillStyle = "#3a2a1e";
        g.fillRect(x + 1, y, 2, this.h);
        g.fillRect(x + this.w - 3, y, 2, this.h);
        g.fillRect(x, y, this.w, 3);
        g.fillStyle = "#5a4232";
        g.fillRect(x - 1, y + this.h - 2, this.w + 2, 2);
        const vaiven = this.usado ? 0 : Math.round(Math.sin(this.t * 2.2) * 2);
        g.fillStyle = "#6a5040";
        g.fillRect(x + 8, y + 3, 2, 3);
        const bx = x + 4 + vaiven;
        g.fillStyle = "#b07a2a";
        g.fillRect(bx + 2, y + 6, 6, 3);
        g.fillRect(bx + 1, y + 9, 8, 4);
        g.fillRect(bx, y + 13, 10, 3);
        g.fillStyle = "#ffd27a";
        g.fillRect(bx + 2, y + 7, 1, 6);
        g.fillStyle = "#3a2a1e";
        g.fillRect(bx + 4, y + 16, 2, 2);
        g.fillStyle = this.color;
        g.fillRect(x + 6, y + 20, 6, 7);
        g.fillRect(x + 7, y + 27, 4, 1);
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

/**
 * Relicario de Almas: cofrecito dorado con un núcleo que late cambiando entre los colores de aura de las cartas
 * (5★ a 12★). `menor`: la Caja de Almas de los monstruos (hueso y plata, núcleo de 1★ a 6★).
 * Dibujado con la base en (0, 0); `escala` agranda el pixel art.
 */
export function dibujarRelicario(g: CanvasRenderingContext2D, t: number, escala: number, menor = false): void {
  const s = escala;
  const aura = menor ? colorEstrella(Math.floor(t * 1.5) % 6) : AURA_ESTRELLA[Math.floor(t * 1.5) % AURA_ESTRELLA.length];
  const [pata, cuerpoC, ribete, tapa, remate] = menor
    ? ["#4a4458", "#8a8098", "#d8d4e4", "#6a6080", "#e8e4f0"]
    : ["#6a4a1a", "#b07a2a", "#ffd27a", "#8a5a1a", "#ffe9a8"];
  const pulso = 0.5 + Math.sin(t * 5) * 0.5;
  g.save();
  // Núcleo con brillo
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.45 + pulso * 0.35;
  const r = (8 + pulso * 3) * s;
  const halo = g.createRadialGradient(0, -6 * s, 0, 0, -6 * s, r);
  halo.addColorStop(0, aura);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = halo;
  g.fillRect(-r, -6 * s - r, r * 2, r * 2);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  // Patas y cuerpo
  g.fillStyle = pata;
  g.fillRect(-6 * s, -2 * s, 2 * s, 2 * s);
  g.fillRect(4 * s, -2 * s, 2 * s, 2 * s);
  g.fillStyle = cuerpoC;
  g.fillRect(-6 * s, -8 * s, 12 * s, 6 * s);
  g.fillStyle = ribete;
  g.fillRect(-6 * s, -8 * s, 12 * s, 1 * s);
  g.fillRect(-6 * s, -3 * s, 12 * s, 1 * s);
  // Tapa (abovedada en el relicario, plana con calavera en la caja)
  g.fillStyle = tapa;
  g.fillRect(-5 * s, -11 * s, 10 * s, 3 * s);
  if (!menor) g.fillRect(-3 * s, -12 * s, 6 * s, 1 * s);
  g.fillStyle = remate;
  if (menor) {
    g.fillRect(-2 * s, -11 * s, 1 * s, 1 * s);
    g.fillRect(1 * s, -11 * s, 1 * s, 1 * s);
  } else {
    g.fillRect(-1 * s, -14 * s, 2 * s, 2 * s);
  }
  // Ventana del alma (late con el aura)
  g.fillStyle = "#1a1020";
  g.fillRect(-2 * s, -7 * s, 4 * s, 3 * s);
  g.fillStyle = aura;
  g.fillRect(-1 * s, -6 * s, 2 * s, 1 * s);
  if (pulso > 0.7) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, -6 * s, 1 * s, 1 * s);
  }
  g.restore();
}
