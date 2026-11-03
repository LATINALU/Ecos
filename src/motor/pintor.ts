// PINTOR DIFERIDO (G-Buffer 2D): además del lienzo de color (ALBEDO, donde el juego dibuja como siempre),
// mantiene dos capas ocultas del mismo tamaño (480×270):
//
//   · NORMALES: hacia dónde "mira" cada píxel (R = izquierda→derecha, G = abajo→arriba, B = hacia la cámara).
//     El neutro #8080ff es una superficie plana de frente. Los biseles de la roca, el metal y las cadenas se pintan
//     inclinados, y el compositor WebGL los ilumina según cada luz (relieve y brillo especular reales).
//   · EMISIVO: lo que brilla con luz propia (proyectiles mágicos, llamas, cortes de arma, auras). El compositor le
//     aplica bloom y lo suma encima de todo, sin que la oscuridad lo apague.
//
// Si el navegador no tiene WebGL2, nada de esto se usa (`activo` = false) y el juego dibuja como antes.

export const NORMAL_NEUTRA = "#8080ff";
export const NORMAL_ARRIBA = "rgb(128, 215, 200)";
export const NORMAL_ABAJO = "rgb(128, 40, 200)";
export const NORMAL_IZQUIERDA = "rgb(40, 128, 200)";
export const NORMAL_DERECHA = "rgb(215, 128, 200)";

function lienzo(w: number, h: number): CanvasRenderingContext2D {
  // Fuera del navegador (pruebas en Node) no hay lienzos: el pintor queda inactivo y nadie lo usa.
  if (typeof document === "undefined") return null as unknown as CanvasRenderingContext2D;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return g;
}

export class PintorDiferido {
  readonly normales: CanvasRenderingContext2D;
  readonly emisivo: CanvasRenderingContext2D;
  /**
   * MÁSCARA de siluetas (Portador, enemigos, jefes, Ecos, habitantes): el compositor saca de su borde una normal
   * y les da LUZ DE CONTORNO del color de cada luz cercana, sin tener que redibujar cada personaje con volumen.
   */
  readonly mascara: CanvasRenderingContext2D;
  /** El emisivo con su halo (bloom): nítido + difuminado a dos radios. Es lo que recibe el compositor. */
  private readonly bloom: CanvasRenderingContext2D;
  /** true solo si el compositor WebGL2 está funcionando. */
  activo = false;

  constructor(readonly ancho = 480, readonly alto = 270) {
    this.normales = lienzo(ancho, alto);
    this.emisivo = lienzo(ancho, alto);
    this.bloom = lienzo(ancho, alto);
    this.mascara = lienzo(ancho, alto);
  }

  /** Convierte todo lo dibujado en la máscara en silueta blanca (alfa intacto). */
  cerrarMascara(): HTMLCanvasElement {
    const m = this.mascara;
    m.save();
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalAlpha = 1;
    m.globalCompositeOperation = "source-in";
    m.fillStyle = "#ffffff";
    m.fillRect(0, 0, this.ancho, this.alto);
    m.restore();
    return m.canvas;
  }

  /** Emisivo con bloom listo para subir a la GPU. */
  emisivoConBloom(): HTMLCanvasElement {
    const b = this.bloom;
    b.clearRect(0, 0, this.ancho, this.alto);
    b.globalCompositeOperation = "lighter";
    b.filter = "blur(5px)";
    b.globalAlpha = 0.9;
    b.drawImage(this.emisivo.canvas, 0, 0);
    b.filter = "blur(2px)";
    b.globalAlpha = 0.7;
    b.drawImage(this.emisivo.canvas, 0, 0);
    b.filter = "none";
    b.globalAlpha = 0.85;
    b.drawImage(this.emisivo.canvas, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = "source-over";
    return b.canvas;
  }

  /** Al empezar cada cuadro: normales neutras y emisivo vacío. */
  limpiar(): void {
    this.normales.globalCompositeOperation = "source-over";
    this.normales.globalAlpha = 1;
    this.normales.fillStyle = NORMAL_NEUTRA;
    this.normales.fillRect(0, 0, this.ancho, this.alto);
    this.emisivo.clearRect(0, 0, this.ancho, this.alto);
    this.mascara.setTransform(1, 0, 0, 1, 0, 0);
    this.mascara.globalCompositeOperation = "source-over";
    this.mascara.clearRect(0, 0, this.ancho, this.alto);
  }

  /** Rectángulo con bisel: el centro mira de frente y los bordes hacia los lados (para columnas, bloques…). */
  rectVolumetrico(x: number, y: number, w: number, h: number, bisel = 2): void {
    const n = this.normales;
    const rx = Math.round(x);
    const ry = Math.round(y);
    n.fillStyle = NORMAL_NEUTRA;
    n.fillRect(rx, ry, w, h);
    n.fillStyle = NORMAL_IZQUIERDA;
    n.fillRect(rx, ry, bisel, h);
    n.fillStyle = NORMAL_DERECHA;
    n.fillRect(rx + w - bisel, ry, bisel, h);
    n.fillStyle = NORMAL_ARRIBA;
    n.fillRect(rx, ry, w, bisel);
    n.fillStyle = NORMAL_ABAJO;
    n.fillRect(rx, ry + h - bisel, w, bisel);
  }

  /** Semiesfera en el mapa de normales (orbes, cabezas, escudos); `brilla` también la pinta en el emisivo. */
  circuloVolumetrico(x: number, y: number, radio: number, color?: string): void {
    const n = this.normales;
    const grad = n.createRadialGradient(x - radio * 0.3, y - radio * 0.3, 1, x, y, radio);
    grad.addColorStop(0, "rgb(170, 170, 255)");
    grad.addColorStop(1, "rgb(70, 70, 170)");
    n.fillStyle = grad;
    n.beginPath();
    n.arc(x, y, radio, 0, Math.PI * 2);
    n.fill();
    if (color !== undefined) {
      this.emisivo.fillStyle = color;
      this.emisivo.beginPath();
      this.emisivo.arc(x, y, radio, 0, Math.PI * 2);
      this.emisivo.fill();
    }
  }
}

/** Único pintor del juego (lo configura main al arrancar). */
export const pintor = new PintorDiferido();
