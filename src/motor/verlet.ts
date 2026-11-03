// CUERDAS VERLET: nodos en arreglos tipados unidos por restricciones de distancia (relajación de Jakobsen).
// La usan las cadenas y estandartes del techo (juego/procedural.ts) y sirve para capas, lianas o puentes:
// cualquier nodo se puede anclar, y los golpes empujan a los nodos cercanos.

export interface ConfigCuerda {
  readonly x: number;
  readonly y: number;
  readonly segmentos: number;
  readonly largoSegmento: number;
  /** px/s² (por defecto 600). */
  readonly gravedad?: number;
  /** 0..1 (por defecto 0,97). */
  readonly friccion?: number;
  /** Rigidez: 4 para telas, 8 para cadenas. */
  readonly iteraciones?: number;
}

export class CuerdaVerlet {
  readonly n: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  private readonly ox: Float32Array;
  private readonly oy: Float32Array;
  private readonly fijo: Uint8Array;
  readonly largo: number;
  private readonly gravedad: number;
  friccion: number;
  private readonly iteraciones: number;

  constructor(c: ConfigCuerda) {
    this.n = c.segmentos + 1;
    this.largo = c.largoSegmento;
    this.gravedad = c.gravedad ?? 600;
    this.friccion = c.friccion ?? 0.97;
    this.iteraciones = c.iteraciones ?? 6;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.ox = new Float32Array(this.n);
    this.oy = new Float32Array(this.n);
    this.fijo = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.ox[i] = c.x;
      this.y[i] = this.oy[i] = c.y + i * this.largo;
    }
    this.fijo[0] = 1;
  }

  /** Mueve (y fija) un nodo: el ancla de una cadena, los hombros de una capa… */
  anclar(x: number, y: number, i = 0): void {
    this.fijo[i] = 1;
    this.x[i] = this.ox[i] = x;
    this.y[i] = this.oy[i] = y;
  }

  /** Pone toda la cuerda en un punto (teletransportes, cambios de sala). */
  reiniciar(x: number, y: number): void {
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.ox[i] = x;
      this.y[i] = this.oy[i] = y + i * this.largo;
    }
  }

  soltar(i: number): void {
    this.fijo[i] = 0;
  }

  /** Empuja (cambiando la velocidad implícita) los nodos dentro de un rectángulo. */
  empujarRect(x: number, y: number, w: number, h: number, vx: number, vy: number, dt = 0.016): void {
    for (let i = 0; i < this.n; i++) {
      if (this.fijo[i] === 1) continue;
      if (this.x[i] >= x && this.x[i] <= x + w && this.y[i] >= y && this.y[i] <= y + h) {
        this.ox[i] -= vx * dt;
        this.oy[i] -= vy * dt;
      }
    }
  }

  /** Impulso radial desde un punto (explosiones), más fuerte cuanto más cerca. */
  impulso(cx: number, cy: number, radio: number, fuerza: number, dt = 0.016): void {
    for (let i = 0; i < this.n; i++) {
      if (this.fijo[i] === 1) continue;
      const dx = this.x[i] - cx;
      const dy = this.y[i] - cy;
      const d = Math.hypot(dx, dy);
      if (d > radio || d < 0.001) continue;
      const k = (1 - d / radio) * fuerza * dt;
      this.ox[i] -= (dx / d) * k;
      this.oy[i] -= (dy / d) * k;
    }
  }

  /** Un paso de simulación; `vientoX` empuja los nodos según su altura en la cuerda. */
  actualizar(dt: number, vientoX = 0): void {
    const p = Math.min(dt, 0.033);
    const p2 = p * p;
    for (let i = 0; i < this.n; i++) {
      if (this.fijo[i] === 1) continue;
      const vx = (this.x[i] - this.ox[i]) * this.friccion;
      const vy = (this.y[i] - this.oy[i]) * this.friccion;
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
      this.x[i] += vx + vientoX * (i / this.n) * p2;
      this.y[i] += vy + this.gravedad * p2;
    }
    for (let it = 0; it < this.iteraciones; it++) {
      for (let i = 0; i < this.n - 1; i++) {
        const dx = this.x[i + 1] - this.x[i];
        const dy = this.y[i + 1] - this.y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const dif = (this.largo - d) / d;
        const f1 = this.fijo[i] === 1;
        const f2 = this.fijo[i + 1] === 1;
        if (!f1 && !f2) {
          this.x[i] -= dx * dif * 0.5;
          this.y[i] -= dy * dif * 0.5;
          this.x[i + 1] += dx * dif * 0.5;
          this.y[i + 1] += dy * dif * 0.5;
        } else if (f1 && !f2) {
          this.x[i + 1] += dx * dif;
          this.y[i + 1] += dy * dif;
        } else if (!f1 && f2) {
          this.x[i] -= dx * dif;
          this.y[i] -= dy * dif;
        }
      }
    }
  }

  /** Eslabones metálicos en el mapa de normales: lado izquierdo hacia −X, derecho hacia +X (brillan con las luces). */
  dibujarNormalesCadena(n: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.n - 1; i++) {
      const x = Math.round(this.x[i]);
      const y = Math.round(this.y[i]);
      const h = Math.ceil(this.largo) + 1;
      n.fillStyle = "rgb(50, 135, 210)";
      n.fillRect(x - 2, y, 1, h);
      n.fillStyle = "rgb(205, 135, 220)";
      n.fillRect(x + 1, y, 1, h);
    }
  }
}
