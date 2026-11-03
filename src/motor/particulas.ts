// PARTÍCULAS SOA (Structure of Arrays): hasta 2000 partículas en arreglos tipados preasignados, sin crear objetos
// por cuadro (cero basura para el recolector). Al morir una, la última ocupa su lugar (swap-and-pop, O(1)).
// Chocan con la roca por ejes separados (rebotan en paredes y ruedan por escalones) y las de sangre MANCHAN la
// sala al tocarla (CapaCicatrices).

import type { CapaCicatrices, FuncionSolido } from "./superficie.ts";

export const COLISIONA = 1;
export const EMISIVA = 2;
export const MANCHA = 4;
export const ESTELA = 8;

export interface Emision {
  readonly x: number;
  readonly y: number;
  readonly cantidad: number;
  readonly color: string;
  readonly velocidad: readonly [number, number];
  /** Cono de salida en radianes (por defecto en todas direcciones). */
  readonly angulo?: readonly [number, number];
  readonly gravedad?: number;
  /** Rebote: 0,2 sangre · 0,75 chispas metálicas. */
  readonly rebote?: number;
  readonly friccion?: number;
  readonly vida?: readonly [number, number];
  readonly tam?: number;
  readonly flags?: number;
}

export class SistemaParticulas {
  activas = 0;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly grav: Float32Array;
  private readonly reb: Float32Array;
  private readonly fric: Float32Array;
  private readonly vida: Float32Array;
  private readonly tam: Uint8Array;
  private readonly flags: Uint8Array;
  private readonly colores: string[];

  constructor(private readonly max = 2000) {
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.reb = new Float32Array(max);
    this.fric = new Float32Array(max);
    this.vida = new Float32Array(max);
    this.tam = new Uint8Array(max);
    this.flags = new Uint8Array(max);
    this.colores = new Array<string>(max).fill("#ffffff");
  }

  limpiar(): void {
    this.activas = 0;
  }

  emitir(e: Emision): void {
    const [a0, a1] = e.angulo ?? [0, Math.PI * 2];
    const [v0, v1] = e.velocidad;
    const [t0, t1] = e.vida ?? [0.35, 0.85];
    for (let n = 0; n < e.cantidad && this.activas < this.max; n++) {
      const i = this.activas++;
      const a = a0 + Math.random() * (a1 - a0);
      const v = v0 + Math.random() * (v1 - v0);
      this.x[i] = e.x;
      this.y[i] = e.y;
      this.vx[i] = Math.cos(a) * v;
      this.vy[i] = Math.sin(a) * v;
      this.grav[i] = e.gravedad ?? 480;
      this.reb[i] = e.rebote ?? 0.55;
      this.fric[i] = e.friccion ?? 0.985;
      this.vida[i] = t0 + Math.random() * (t1 - t0);
      this.tam[i] = e.tam ?? 2;
      this.flags[i] = e.flags ?? (COLISIONA | EMISIVA);
      this.colores[i] = e.color;
    }
  }

  /** Chispas de un impacto fuerte (crítico, romper guardia, mazo). */
  chispas(x: number, y: number, dirX: number, color = "#ffcf40", cantidad = 24): void {
    const base = dirX >= 0 ? -0.35 : Math.PI + 0.35;
    this.emitir({ x, y, cantidad, color, velocidad: [90, 260], angulo: [base - 0.9, base + 0.9], gravedad: 580, rebote: 0.72, vida: [0.25, 0.65], tam: 1, flags: COLISIONA | EMISIVA | ESTELA });
  }

  /** Salpicadura que mancha suelo y paredes. */
  sangre(x: number, y: number, color: string, cantidad = 18): void {
    this.emitir({ x, y, cantidad, color, velocidad: [40, 170], angulo: [-Math.PI, 0], gravedad: 620, rebote: 0.2, vida: [0.5, 1.2], tam: 2, flags: COLISIONA | MANCHA });
  }

  actualizar(dt: number, esSolido: FuncionSolido, cicatrices?: CapaCicatrices): void {
    const paso = Math.min(dt, 0.033);
    let i = 0;
    while (i < this.activas) {
      this.vida[i] -= paso;
      if (this.vida[i] <= 0) {
        this.quitar(i);
        continue;
      }
      this.vy[i] += this.grav[i] * paso;
      this.vx[i] *= this.fric[i];
      this.vy[i] *= this.fric[i];
      const nx = this.x[i] + this.vx[i] * paso;
      const ny = this.y[i] + this.vy[i] * paso;
      const f = this.flags[i];
      if ((f & COLISIONA) !== 0) {
        if (esSolido(nx, this.y[i])) {
          this.vx[i] = -this.vx[i] * this.reb[i];
          if ((f & MANCHA) !== 0 && cicatrices !== undefined && Math.random() < 0.6) cicatrices.liquido(nx, this.y[i], this.colores[i], this.tam[i], (f & EMISIVA) !== 0, esSolido);
        } else this.x[i] = nx;
        if (esSolido(this.x[i], ny)) {
          if ((f & MANCHA) !== 0 && cicatrices !== undefined) {
            cicatrices.liquido(this.x[i], ny, this.colores[i], this.tam[i], (f & EMISIVA) !== 0, esSolido);
            // La gota sin fuerza se funde con la piedra.
            if (Math.abs(this.vy[i]) < 60) {
              this.quitar(i);
              continue;
            }
          }
          this.vy[i] = -this.vy[i] * this.reb[i];
          this.vx[i] *= 0.65;
        } else this.y[i] = ny;
      } else {
        this.x[i] = nx;
        this.y[i] = ny;
      }
      i++;
    }
  }

  /** Dibuja en el color (mundo) y, las emisivas, también en la capa de brillo. */
  dibujar(g: CanvasRenderingContext2D, emisivo: CanvasRenderingContext2D | null): void {
    for (let i = 0; i < this.activas; i++) {
      const sx = Math.round(this.x[i]);
      const sy = Math.round(this.y[i]);
      const f = this.flags[i];
      const color = this.colores[i];
      if ((f & ESTELA) !== 0) {
        const cx = Math.round(sx - this.vx[i] * 0.022);
        const cy = Math.round(sy - this.vy[i] * 0.022);
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(sx, sy);
        g.stroke();
        if ((f & EMISIVA) !== 0 && emisivo !== null) {
          emisivo.strokeStyle = color;
          emisivo.lineWidth = 1;
          emisivo.beginPath();
          emisivo.moveTo(cx, cy);
          emisivo.lineTo(sx, sy);
          emisivo.stroke();
        }
      } else {
        g.fillStyle = color;
        g.fillRect(sx, sy, this.tam[i], this.tam[i]);
        if ((f & EMISIVA) !== 0 && emisivo !== null) {
          emisivo.fillStyle = color;
          emisivo.fillRect(sx, sy, this.tam[i], this.tam[i]);
        }
      }
    }
  }

  /** Posición de una partícula (para pruebas). */
  posicion(i: number): { x: number; y: number } {
    return { x: this.x[i], y: this.y[i] };
  }

  private quitar(i: number): void {
    const u = --this.activas;
    if (i === u) return;
    this.x[i] = this.x[u];
    this.y[i] = this.y[u];
    this.vx[i] = this.vx[u];
    this.vy[i] = this.vy[u];
    this.grav[i] = this.grav[u];
    this.reb[i] = this.reb[u];
    this.fric[i] = this.fric[u];
    this.vida[i] = this.vida[u];
    this.tam[i] = this.tam[u];
    this.flags[i] = this.flags[u];
    this.colores[i] = this.colores[u];
  }
}
