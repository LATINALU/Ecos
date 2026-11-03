// CICATRICES DE SALA (destrucción persistente): cada sala tiene tres lienzos de su tamaño (color, relieve y brillo)
// donde se pinta UNA sola vez, en el instante del impacto: sangre que salpica muros y suelo, hollín y cráteres de
// explosiones y pisotones, flechas clavadas en la pared. Como no se borran entre cuadros, al terminar una Arena o
// un Juicio la sala queda contando la batalla, sin costo extra por cuadro (se copian con un drawImage).

export type FuncionSolido = (x: number, y: number) => boolean;

function lienzo(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return g;
}

export class CapaCicatrices {
  readonly albedo: CanvasRenderingContext2D;
  readonly normales: CanvasRenderingContext2D;
  readonly emisivo: CanvasRenderingContext2D;
  /** Cuántas marcas tiene (para no seguir pintando sin fin en salas muy castigadas). */
  marcas = 0;

  constructor(readonly ancho: number, readonly alto: number) {
    this.albedo = lienzo(ancho, alto);
    this.normales = lienzo(ancho, alto);
    this.emisivo = lienzo(ancho, alto);
  }

  private dentro(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.ancho && y < this.alto;
  }

  /** Gota de líquido (sangre, icor) o polvo: solo se queda pegada sobre roca. */
  liquido(x: number, y: number, color: string, tam = 2, brilla = false, esSolido?: FuncionSolido): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (!this.dentro(rx, ry) || (esSolido !== undefined && !esSolido(rx, ry))) return;
    this.marcas++;
    this.albedo.fillStyle = color;
    this.albedo.globalAlpha = 0.85;
    this.albedo.fillRect(rx, ry, tam, tam);
    this.albedo.globalAlpha = 1;
    // Relieve húmedo: la gota mira apenas hacia arriba (brilla con las luces).
    this.normales.fillStyle = "rgb(128, 190, 240)";
    this.normales.fillRect(rx, ry, tam, 1);
    if (brilla) {
      this.emisivo.fillStyle = color;
      this.emisivo.fillRect(rx, ry, tam, tam);
    }
  }

  /** Cráter con hollín (explosiones, pisotones, la Garra Ígnea); brasas opcionales en el centro. */
  crater(x: number, y: number, radio: number, colorBrasa?: string, esSolido?: FuncionSolido): void {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const r2 = radio * radio;
    this.marcas += 4;
    for (let dy = -radio; dy <= radio; dy++) {
      for (let dx = -radio; dx <= radio; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const px = cx + dx;
        const py = cy + dy;
        if (!this.dentro(px, py) || (esSolido !== undefined && !esSolido(px, py))) continue;
        const f = Math.sqrt(d2) / radio;
        // Bordes deshilachados (dithering): aspecto pixel art orgánico.
        if (f > 0.65 && Math.random() < f) continue;
        this.albedo.fillStyle = f < 0.4 ? "rgba(12,10,16,0.8)" : "rgba(25,22,30,0.5)";
        this.albedo.fillRect(px, py, 1, 1);
        // Normales hacia adentro: las luces lo leen como un hueco hundido.
        this.normales.fillStyle = `rgb(${Math.round(128 - (dx / radio) * 80)}, ${Math.round(128 + (dy / radio) * 80)}, 175)`;
        this.normales.fillRect(px, py, 1, 1);
        if (colorBrasa !== undefined && f < 0.45 && Math.random() < 0.22) {
          this.emisivo.fillStyle = colorBrasa;
          this.emisivo.fillRect(px, py, 1, 1);
        }
      }
    }
  }

  /** Flecha, daga o lanza clavada en la pared (inclinada según cómo llegó). */
  clavar(x: number, y: number, angulo: number, colorAsta = "#9c6b3b", colorPunta = "#d8e2ef", largo = 7): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (!this.dentro(px, py)) return;
    this.marcas++;
    const g = this.albedo;
    g.strokeStyle = colorAsta;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px - Math.cos(angulo) * largo, py - Math.sin(angulo) * largo);
    g.lineTo(px, py);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.fillRect(Math.round(px - Math.cos(angulo) * largo) - 1, Math.round(py - Math.sin(angulo) * largo), 2, 1);
    g.fillStyle = colorPunta;
    g.fillRect(px, py, 2, 2);
    this.normales.fillStyle = "rgb(160, 180, 245)";
    this.normales.fillRect(px, py, 2, 1);
  }
}
