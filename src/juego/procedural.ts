// Animación procedural: cosas que se mueven con física en vez de con cuadros dibujados.
//
//   · COLGANTES: cadenas y estandartes que cuelgan del techo como cuerdas (integración de Verlet con restricciones
//     de distancia). Se mecen con una brisa suave, el Portador los empuja al pasar y los golpes y las explosiones
//     los sacuden.
//   · PATAS CON CINEMÁTICA INVERSA: patas de dos huesos (muslo y canilla) que buscan apoyo en el suelo. Cada pie
//     queda plantado mientras el cuerpo avanza y, cuando se aleja demasiado de su punto de descanso, da un paso
//     en arco. Las usan los guardianes que caminan (gólem y bestia).

export type TipoColgante = "cadena" | "estandarte";

export interface DefColgante {
  readonly tipo: TipoColgante;
  /** Punto de anclaje en el techo (mundo, px). */
  readonly x: number;
  readonly y: number;
  readonly largo: number;
}

interface Nodo {
  x: number;
  y: number;
  px: number;
  py: number;
}

/** Cuerda de Verlet anclada por arriba. */
export class Colgante {
  readonly tipo: TipoColgante;
  private readonly nodos: Nodo[] = [];
  private readonly tramo: number;
  private readonly fase = Math.random() * 10;

  constructor(def: DefColgante) {
    this.tipo = def.tipo;
    const n = def.tipo === "cadena" ? Math.max(4, Math.round(def.largo / 4)) : 6;
    this.tramo = def.largo / (n - 1);
    for (let i = 0; i < n; i++) this.nodos.push({ x: def.x, y: def.y + i * this.tramo, px: def.x, py: def.y + i * this.tramo });
  }

  get ancla(): { x: number; y: number } {
    return this.nodos[0];
  }

  /** Empuja los nodos que estén dentro del rectángulo (el Portador al pasar, un golpe). */
  empujar(x: number, y: number, w: number, h: number, vx: number, vy: number): void {
    for (let i = 1; i < this.nodos.length; i++) {
      const q = this.nodos[i];
      if (q.x >= x && q.x <= x + w && q.y >= y && q.y <= y + h) {
        q.px -= vx * 0.016;
        q.py -= vy * 0.016;
      }
    }
  }

  /** Sacudida radial (explosiones, fogonazos). */
  sacudir(cx: number, cy: number, radio: number, fuerza: number): void {
    for (let i = 1; i < this.nodos.length; i++) {
      const q = this.nodos[i];
      const dx = q.x - cx;
      const dy = q.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > radio || d < 0.001) continue;
      const k = (1 - d / radio) * fuerza * 0.016;
      q.px -= (dx / d) * k;
      q.py -= (dy / d) * k;
    }
  }

  actualizar(dt: number, t: number): void {
    const brisa = Math.sin(t * 0.9 + this.fase) * 14 + Math.sin(t * 2.3 + this.fase * 2) * 5;
    const g = 600 * dt * dt;
    const amort = this.tipo === "cadena" ? 0.985 : 0.96;
    for (let i = 1; i < this.nodos.length; i++) {
      const q = this.nodos[i];
      const vx = (q.x - q.px) * amort;
      const vy = (q.y - q.py) * amort;
      q.px = q.x;
      q.py = q.y;
      q.x += vx + brisa * (i / this.nodos.length) * dt * dt * (this.tipo === "estandarte" ? 3 : 1);
      q.y += vy + g;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < this.nodos.length; i++) {
        const a = this.nodos[i - 1];
        const b = this.nodos[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const f = (d - this.tramo) / d;
        if (i === 1) {
          b.x -= dx * f;
          b.y -= dy * f;
        } else {
          a.x += dx * f * 0.5;
          a.y += dy * f * 0.5;
          b.x -= dx * f * 0.5;
          b.y -= dy * f * 0.5;
        }
      }
    }
  }

  dibujar(g: CanvasRenderingContext2D, metal: string, oscuro: string, tela: string, emblema: string): void {
    const n = this.nodos;
    if (this.tipo === "cadena") {
      // Eslabones alternados (de frente y de canto) a lo largo de la cuerda.
      for (let i = 1; i < n.length; i++) {
        const a = n[i - 1];
        const b = n[i];
        const pasos = Math.max(1, Math.round(this.tramo / 3));
        for (let k = 0; k < pasos; k++) {
          const t = k / pasos;
          const x = Math.round(a.x + (b.x - a.x) * t);
          const y = Math.round(a.y + (b.y - a.y) * t);
          const deFrente = (i * pasos + k) % 2 === 0;
          g.fillStyle = oscuro;
          if (deFrente) {
            g.fillRect(x - 2, y - 1, 4, 4);
            g.fillStyle = metal;
            g.fillRect(x - 2, y - 1, 1, 3);
            g.fillRect(x + 1, y - 1, 1, 3);
            g.fillRect(x - 1, y - 1, 2, 1);
          } else {
            g.fillRect(x - 1, y - 1, 2, 4);
            g.fillStyle = metal;
            g.fillRect(x - 1, y - 1, 1, 3);
          }
        }
      }
      // Gancho al final
      const ult = n[n.length - 1];
      g.fillStyle = metal;
      g.fillRect(Math.round(ult.x) - 1, Math.round(ult.y), 2, 3);
      g.fillRect(Math.round(ult.x), Math.round(ult.y) + 2, 2, 1);
      return;
    }
    // Estandarte: tira de tela que sigue la cuerda (más ancha arriba), con borde y emblema, punta en V.
    const ancho = 12;
    g.fillStyle = oscuro;
    g.fillRect(Math.round(n[0].x - ancho / 2 - 2), Math.round(n[0].y) - 1, ancho + 4, 2);
    for (let i = 1; i < n.length; i++) {
      const a = n[i - 1];
      const b = n[i];
      const pasos = Math.max(1, Math.round(this.tramo));
      for (let k = 0; k < pasos; k++) {
        const t = k / pasos;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const fin = i === n.length - 1 ? 1 - t : 1;
        const w = Math.max(2, Math.round(ancho * (i === n.length - 1 ? 0.4 + fin * 0.6 : 1)));
        g.fillStyle = tela;
        g.fillRect(Math.round(x - w / 2), Math.round(y), w, 1);
        g.fillStyle = oscuro;
        g.fillRect(Math.round(x - w / 2), Math.round(y), 1, 1);
        g.fillRect(Math.round(x + w / 2) - 1, Math.round(y), 1, 1);
      }
    }
    // Emblema a un tercio
    const m = n[Math.floor(n.length / 3)];
    g.fillStyle = emblema;
    g.fillRect(Math.round(m.x) - 2, Math.round(m.y) - 2, 4, 4);
    g.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 4, 2, 8);
  }
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Cinemática inversa de dos huesos: dada la cadera, el pie y el largo de cada hueso, devuelve la rodilla.
 * `doblez` elige hacia qué lado se dobla (+1 / −1).
 */
export function rodillaIK(hx: number, hy: number, fx: number, fy: number, l1: number, l2: number, doblez: number): { x: number; y: number } {
  let dx = fx - hx;
  let dy = fy - hy;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) {
    dx = (dx / d) * max;
    dy = (dy / d) * max;
    d = max;
  }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  // Ley del coseno: ángulo en la cadera entre la recta cadera→pie y el muslo.
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cos)));
  const base = Math.atan2(dy, dx);
  const ang = base - a * doblez;
  return { x: hx + Math.cos(ang) * l1, y: hy + Math.sin(ang) * l1 };
}

interface Pie {
  x: number;
  y: number;
  /** Paso en curso: desde dónde, hacia dónde y avance 0..1. */
  desdeX: number;
  haciaX: number;
  avance: number;
  enPaso: boolean;
}

/**
 * Patas de una criatura que camina: cada pata tiene un offset de cadera respecto del cuerpo y un punto de descanso
 * en el suelo. Los pies se alternan (nunca dan el paso dos vecinos a la vez) para que el andar se vea natural.
 */
export class Patas {
  private readonly pies: Pie[] = [];
  private iniciado = false;

  constructor(
    private readonly caderas: readonly { readonly dx: number; readonly dy: number }[],
    private readonly muslo: number,
    private readonly canilla: number,
    private readonly zancada: number,
  ) {
    for (let i = 0; i < caderas.length; i++) this.pies.push({ x: 0, y: 0, desdeX: 0, haciaX: 0, avance: 1, enPaso: false });
  }

  /** `cx, cy` = centro del cuerpo; `suelo` = y del piso; `vx` = velocidad (adelanta el paso hacia donde va). */
  actualizar(cx: number, cy: number, suelo: number, vx: number, dt: number): void {
    const adelanto = Math.max(-1, Math.min(1, vx / 80)) * this.zancada * 0.45;
    if (!this.iniciado) {
      this.pies.forEach((p, i) => {
        p.x = cx + this.caderas[i].dx;
        p.y = suelo;
      });
      this.iniciado = true;
    }
    this.pies.forEach((p, i) => {
      const reposo = cx + this.caderas[i].dx + adelanto;
      if (p.enPaso) {
        p.avance = Math.min(1, p.avance + dt * (3.5 + Math.abs(vx) / 40));
        p.x = p.desdeX + (p.haciaX - p.desdeX) * p.avance;
        p.y = suelo - Math.sin(p.avance * Math.PI) * Math.min(10, this.zancada * 0.5);
        if (p.avance >= 1) {
          p.enPaso = false;
          p.y = suelo;
        }
        return;
      }
      p.y = suelo;
      const vecinoEnPaso = (this.pies[i - 1]?.enPaso ?? false) || (this.pies[i + 1]?.enPaso ?? false);
      if (Math.abs(p.x - reposo) > this.zancada && !vecinoEnPaso) {
        p.enPaso = true;
        p.avance = 0;
        p.desdeX = p.x;
        p.haciaX = reposo + Math.sign(reposo - p.x) * this.zancada * 0.4;
      }
    });
    void cy;
  }

  /** Dibuja cada pata (muslo y canilla gruesos, pie) desde la cadera hasta su pie plantado. */
  dibujar(g: CanvasRenderingContext2D, cx: number, cy: number, dir: number, color: string, articulacion: string, grosor: number): void {
    this.pies.forEach((p, i) => {
      const hx = cx + this.caderas[i].dx;
      const hy = cy + this.caderas[i].dy;
      // Las patas traseras doblan al revés que las delanteras (como un cuadrúpedo).
      const delantera = Math.sign(this.caderas[i].dx || 1) === Math.sign(dir || 1);
      const k = rodillaIK(hx, hy, p.x, p.y, this.muslo, this.canilla, delantera ? -dir : dir);
      linea(g, hx, hy, k.x, k.y, grosor + 1, color);
      linea(g, k.x, k.y, p.x, p.y, grosor, color);
      g.fillStyle = articulacion;
      g.fillRect(Math.round(k.x - grosor / 2), Math.round(k.y - grosor / 2), grosor, grosor);
      // Pie
      g.fillStyle = color;
      g.fillRect(Math.round(p.x - grosor), Math.round(p.y - 2), grosor * 2, 2);
    });
  }
}

function linea(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, ancho: number, color: string): void {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const pasos = Math.max(1, Math.ceil(d));
  g.fillStyle = color;
  for (let k = 0; k <= pasos; k++) {
    const t = k / pasos;
    g.fillRect(Math.round(x1 + (x2 - x1) * t - ancho / 2), Math.round(y1 + (y2 - y1) * t - ancho / 2), ancho, ancho);
  }
}
