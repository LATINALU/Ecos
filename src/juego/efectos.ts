// "Jugo" del combate: partículas, números de daño, sacudida de cámara, pausa de impacto y destellos.

import { hd } from "../motor/texto-hd.ts";

export interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  vidaMax: number;
  color: string;
  tam: number;
  gravedad: number;
  brillo: boolean;
}

interface TextoFlotante {
  x: number;
  y: number;
  texto: string;
  color: string;
  vida: number;
  grande: boolean;
}

/**
 * Fragmento con física: rota, rebota contra el escenario (con fricción) y se apaga con el tiempo.
 * Los "brillantes" (cristal, brasas, metal al rojo) emiten luz y dejan estela de chispas.
 */
export interface Fragmento {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  color: string;
  vida: number;
  vidaMax: number;
  brilla: boolean;
  /** Color de las chispas que suelta al rebotar o volar rápido (null = polvo). */
  chispa: string | null;
  quieto: boolean;
}

/** Luz breve de un impacto (fogonazo), en coordenadas de mundo. */
export interface Fogonazo {
  x: number;
  y: number;
  r: number;
  color: string;
  vida: number;
  vidaMax: number;
}

export interface OpcionesEstallido {
  /** Paleta de los fragmentos (se elige al azar por fragmento). */
  readonly colores: readonly string[];
  readonly n: number;
  readonly velocidad?: number;
  /** Tamaño mínimo y máximo de los fragmentos (px). */
  readonly tam?: readonly [number, number];
  readonly vida?: number;
  readonly brillan?: boolean;
  readonly chispa?: string | null;
  /** Dirección general (radianes) y apertura del cono; sin ángulo, en todas direcciones con sesgo hacia arriba. */
  readonly angulo?: number;
  readonly apertura?: number;
  /** Fogonazo de luz al estallar. */
  readonly luz?: { readonly color: string; readonly r: number; readonly dur?: number };
}

/** Consulta de sólidos del escenario (mundo, px). `plataforma`: solo frena cayendo desde arriba. */
export type ConsultaSuelo = (x: number, y: number) => "solido" | "plataforma" | null;

export interface OpcionesChispa {
  readonly velocidad?: number;
  readonly vida?: number;
  readonly tam?: number;
  readonly gravedad?: number;
  readonly brillo?: boolean;
  readonly angulo?: number;
  readonly apertura?: number;
}

export class Efectos {
  readonly particulas: Particula[] = [];
  readonly fragmentos: Fragmento[] = [];
  readonly fogonazos: Fogonazo[] = [];
  private readonly textos: TextoFlotante[] = [];
  sacudida = 0;
  pausaGolpe = 0;
  destello = 0;
  colorDestello = "#ffffff";

  chispas(x: number, y: number, color: string, n: number, op: OpcionesChispa = {}): void {
    const vel = op.velocidad ?? 90;
    for (let i = 0; i < n; i++) {
      const ang = op.angulo !== undefined ? op.angulo + (Math.random() - 0.5) * (op.apertura ?? 1) : Math.random() * Math.PI * 2;
      const v = vel * (0.4 + Math.random() * 0.8);
      const vida = (op.vida ?? 0.5) * (0.6 + Math.random() * 0.6);
      this.particulas.push({
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida, vidaMax: vida, color,
        tam: op.tam ?? (Math.random() < 0.3 ? 2 : 1), gravedad: op.gravedad ?? 200, brillo: op.brillo ?? false,
      });
    }
    if (this.particulas.length > 900) this.particulas.splice(0, this.particulas.length - 900);
  }

  /** Estallido de fragmentos con física (escudos, barreras, enemigos, cofres…). */
  estallar(x: number, y: number, op: OpcionesEstallido): void {
    const vel = op.velocidad ?? 140;
    const [tmin, tmax] = op.tam ?? [1, 3];
    for (let i = 0; i < op.n; i++) {
      const ang = op.angulo !== undefined
        ? op.angulo + (Math.random() - 0.5) * (op.apertura ?? 1.2)
        : -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const v = vel * (0.35 + Math.random() * 0.85);
      const vida = (op.vida ?? 1.6) * (0.6 + Math.random() * 0.7);
      this.fragmentos.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 18,
        w: tmin + Math.random() * (tmax - tmin), h: Math.max(1, tmin + Math.random() * (tmax - tmin) * 0.7),
        color: op.colores[Math.floor(Math.random() * op.colores.length)], vida, vidaMax: vida,
        brilla: op.brillan ?? false, chispa: op.chispa === undefined ? null : op.chispa, quieto: false,
      });
    }
    if (this.fragmentos.length > 260) this.fragmentos.splice(0, this.fragmentos.length - 260);
    if (op.luz !== undefined) this.fogonazo(x, y, op.luz.color, op.luz.r, op.luz.dur ?? 0.45);
  }

  /** Luz breve (impactos, explosiones). */
  fogonazo(x: number, y: number, color: string, r: number, dur = 0.4): void {
    this.fogonazos.push({ x, y, r, color, vida: dur, vidaMax: dur });
    if (this.fogonazos.length > 24) this.fogonazos.shift();
  }

  /** Luces que emiten los efectos este cuadro (fogonazos y fragmentos brillantes), en mundo. */
  luces(): { x: number; y: number; r: number; fuerza: number; color: string }[] {
    const r: { x: number; y: number; r: number; fuerza: number; color: string }[] = [];
    for (const f of this.fogonazos) {
      const k = f.vida / f.vidaMax;
      r.push({ x: f.x, y: f.y, r: f.r * (0.6 + k * 0.4), fuerza: k, color: f.color });
    }
    let n = 0;
    for (const f of this.fragmentos) {
      if (!f.brilla || n >= 14) continue;
      n++;
      r.push({ x: f.x, y: f.y, r: 12, fuerza: 0.5 * (f.vida / f.vidaMax), color: f.color });
    }
    return r;
  }

  ambiente(x: number, y: number, color: string, vy: number, brillo: boolean): void {
    this.particulas.push({ x, y, vx: (Math.random() - 0.5) * 8, vy, vida: 4, vidaMax: 4, color, tam: 1, gravedad: 0, brillo });
  }

  texto(x: number, y: number, texto: string, color = "#ffffff", grande = false): void {
    this.textos.push({ x: x + (Math.random() - 0.5) * 6, y, texto, color, vida: grande ? 1.1 : 0.8, grande });
  }

  sacudir(n: number): void {
    this.sacudida = Math.max(this.sacudida, n);
  }

  congelar(s: number): void {
    this.pausaGolpe = Math.max(this.pausaGolpe, s);
  }

  destellar(color: string, intensidad = 0.6): void {
    this.colorDestello = color;
    this.destello = Math.max(this.destello, intensidad);
  }

  actualizar(dt: number, suelo?: ConsultaSuelo): void {
    this.actualizarFragmentos(dt, suelo);
    for (const f of this.fogonazos) f.vida -= dt;
    for (let i = this.fogonazos.length - 1; i >= 0; i--) if (this.fogonazos[i].vida <= 0) this.fogonazos.splice(i, 1);
    for (const p of this.particulas) {
      p.vida -= dt;
      p.vy += p.gravedad * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.particulas.length - 1; i >= 0; i--) if (this.particulas[i].vida <= 0) this.particulas.splice(i, 1);
    for (const t of this.textos) {
      t.vida -= dt;
      t.y -= (t.grande ? 22 : 30) * dt;
    }
    for (let i = this.textos.length - 1; i >= 0; i--) if (this.textos[i].vida <= 0) this.textos.splice(i, 1);
    this.sacudida = Math.max(0, this.sacudida - dt * 30);
    this.destello = Math.max(0, this.destello - dt * 2.5);
  }

  limpiar(): void {
    this.particulas.length = 0;
    this.textos.length = 0;
    this.fragmentos.length = 0;
    this.fogonazos.length = 0;
  }

  private actualizarFragmentos(dt: number, suelo?: ConsultaSuelo): void {
    for (const f of this.fragmentos) {
      f.vida -= dt;
      if (f.quieto) continue;
      f.vy += 520 * dt;
      const nx = f.x + f.vx * dt;
      const ny = f.y + f.vy * dt;
      const rapido = Math.abs(f.vx) + Math.abs(f.vy);
      // Estela: los rápidos sueltan chispas (o polvo) por el camino.
      if (f.chispa !== null && rapido > 140 && Math.random() < 0.35) {
        this.particulas.push({ x: f.x, y: f.y, vx: 0, vy: 0, vida: 0.18, vidaMax: 0.18, color: f.chispa, tam: 1, gravedad: 0, brillo: true });
      }
      if (suelo === undefined) {
        f.x = nx;
        f.y = ny;
      } else {
        // Choque vertical (piso/techo; las plataformas solo frenan cayendo).
        const v = suelo(f.x, ny);
        const pisaPlataforma = v === "plataforma" && f.vy > 0 && Math.floor(f.y / 16) < Math.floor(ny / 16);
        if (v === "solido" || pisaPlataforma) {
          if (f.vy > 0) f.y = Math.floor(ny / 16) * 16 - 0.5;
          const fuerte = Math.abs(f.vy) > 70;
          f.vy = -f.vy * 0.42;
          f.vx *= 0.72;
          f.vrot *= 0.6;
          if (fuerte) this.rebote(f);
          if (Math.abs(f.vy) < 25 && Math.abs(f.vx) < 12) {
            f.quieto = true;
            f.vy = 0;
            f.vx = 0;
          }
        } else {
          f.y = ny;
        }
        // Choque horizontal (paredes).
        if (suelo(nx, f.y) === "solido") {
          f.vx = -f.vx * 0.5;
          if (Math.abs(f.vx) > 50) this.rebote(f);
        } else {
          f.x = nx;
        }
      }
      f.rot += f.vrot * dt;
    }
    for (let i = this.fragmentos.length - 1; i >= 0; i--) if (this.fragmentos[i].vida <= 0) this.fragmentos.splice(i, 1);
  }

  /** Al rebotar fuerte: chispitas (metal/cristal/brasas) o polvo. */
  private rebote(f: Fragmento): void {
    const color = f.chispa ?? "#8a8070";
    const n = f.chispa !== null ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 30 + Math.random() * 70;
      this.particulas.push({
        x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.3, vidaMax: 0.3, color, tam: 1,
        gravedad: f.chispa !== null ? 260 : 60, brillo: f.chispa !== null,
      });
    }
  }

  dibujarFragmentos(g: CanvasRenderingContext2D): void {
    for (const f of this.fragmentos) {
      const a = Math.max(0, Math.min(1, (f.vida / f.vidaMax) * 2.5));
      g.save();
      g.globalAlpha = a;
      if (f.brilla) g.globalCompositeOperation = "lighter";
      g.translate(Math.round(f.x), Math.round(f.y));
      g.rotate(f.quieto ? Math.round(f.rot / (Math.PI / 2)) * (Math.PI / 2) : f.rot);
      g.fillStyle = f.color;
      g.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      // Arista iluminada: le da volumen al fragmento.
      g.fillStyle = "#ffffff";
      g.globalAlpha = a * 0.35;
      g.fillRect(-f.w / 2, -f.h / 2, f.w, Math.min(1, f.h));
      g.restore();
    }
  }

  dibujarParticulas(g: CanvasRenderingContext2D): void {
    for (const p of this.particulas) {
      g.globalAlpha = Math.max(0, Math.min(1, p.vida / p.vidaMax));
      if (p.brillo) g.globalCompositeOperation = "lighter";
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
  }

  /** Solo las partículas brillantes (capa emisiva del bloom). */
  dibujarBrillos(g: CanvasRenderingContext2D): void {
    for (const p of this.particulas) {
      if (!p.brillo) continue;
      g.globalAlpha = Math.max(0, Math.min(1, p.vida / p.vidaMax));
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.tam + 1, p.tam + 1);
    }
    g.globalAlpha = 1;
  }

  dibujarTextos(g: CanvasRenderingContext2D): void {
    for (const t of this.textos) {
      hd.texto(g, t.texto, t.x, t.y, { color: t.color, alinear: "center", tam: t.grande ? 11 : 8, alfa: Math.min(1, t.vida * 2.5) });
    }
  }
}
