// "Jugo" del combate: partículas, números de daño, sacudida de cámara, pausa de impacto y destellos.

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

  actualizar(dt: number): void {
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
    g.textAlign = "center";
    for (const t of this.textos) {
      g.globalAlpha = Math.min(1, t.vida * 2.5);
      g.font = t.grande ? "bold 11px monospace" : "bold 8px monospace";
      g.fillStyle = "#000000";
      g.fillText(t.texto, Math.round(t.x) + 1, Math.round(t.y) + 1);
      g.fillStyle = t.color;
      g.fillText(t.texto, Math.round(t.x), Math.round(t.y));
    }
    g.globalAlpha = 1;
    g.textAlign = "left";
  }
}
