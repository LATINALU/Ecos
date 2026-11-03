// TRAZOS DE ARMA: guarda en un anillo las últimas posiciones de la empuñadura y la punta del arma mientras dura el
// golpe, y dibuja con ellas una cinta de energía que se afina hacia la cola. El color sale del AURA de tu Forma
// (gris 5★ … dorada 10★, plateada 11★, prismática 12★) y el grosor y la duración del MEDIDOR DE ESTILO (D → SSS).

export class TrazoArma {
  private readonly bx: Float32Array;
  private readonly by: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly edad: Float32Array;
  private cabeza = 0;
  private activos = 0;

  constructor(private readonly max = 10, private readonly vidaBase = 0.14) {
    this.bx = new Float32Array(max);
    this.by = new Float32Array(max);
    this.px = new Float32Array(max);
    this.py = new Float32Array(max);
    this.edad = new Float32Array(max);
  }

  get cantidad(): number {
    return this.activos;
  }

  muestra(bx: number, by: number, px: number, py: number): void {
    const i = this.cabeza;
    this.bx[i] = bx;
    this.by[i] = by;
    this.px[i] = px;
    this.py[i] = py;
    this.edad[i] = 0;
    this.cabeza = (this.cabeza + 1) % this.max;
    if (this.activos < this.max) this.activos++;
  }

  limpiar(): void {
    this.activos = 0;
  }

  /** Envejece las muestras; `rango` (0 D … 6 SSS) las hace durar más. */
  actualizar(dt: number, rango = 0): void {
    const vida = this.vidaBase * (1 + rango * 0.12);
    let vivas = 0;
    for (let k = 0; k < this.activos; k++) {
      const i = (this.cabeza - 1 - k + this.max) % this.max;
      this.edad[i] += dt;
      if (this.edad[i] < vida) vivas++;
      else break;
    }
    this.activos = vivas;
  }

  /** Cinta de energía (en el contexto que se le dé: emisivo con WebGL, o el color con "lighter" sin WebGL). */
  dibujar(g: CanvasRenderingContext2D, color: string, rango = 0): void {
    if (this.activos < 2) return;
    const ancho = 0.45 + Math.min(6, rango) * 0.09;
    const idx = (k: number): number => (this.cabeza - 1 - k + this.max) % this.max;
    g.save();
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    g.beginPath();
    for (let k = 0; k < this.activos; k++) {
      const i = idx(k);
      if (k === 0) g.moveTo(this.px[i], this.py[i]);
      else g.lineTo(this.px[i], this.py[i]);
    }
    // Regreso por el borde interior: cuanto más vieja la muestra (o menor el estilo), más se afina hacia la punta.
    for (let k = this.activos - 1; k >= 0; k--) {
      const i = idx(k);
      const cierre = Math.min(1, k / this.activos + (1 - ancho));
      g.lineTo(this.bx[i] + (this.px[i] - this.bx[i]) * cierre, this.by[i] + (this.py[i] - this.by[i]) * cierre);
    }
    g.closePath();
    g.fill();
    // Filo incandescente
    g.strokeStyle = "#ffffff";
    g.globalAlpha = 1;
    g.lineWidth = rango >= 5 ? 2 : 1;
    g.beginPath();
    for (let k = 0; k < Math.min(this.activos, 4); k++) {
      const i = idx(k);
      if (k === 0) g.moveTo(this.px[i], this.py[i]);
      else g.lineTo(this.px[i], this.py[i]);
    }
    g.stroke();
    g.restore();
  }
}
