// Texto en alta resolución. El juego se dibuja en 480×270 y se escala en píxeles enteros (pixel art), pero las
// letras a 8 px quedaban borrosas y difíciles de leer. Todo el texto del juego (HUD, números de daño, carteles)
// se encola acá en coordenadas lógicas y se pinta al final del cuadro en un canvas superpuesto a la resolución
// real de la pantalla, con contorno: nítido a cualquier escala.

export interface OpcionesTexto {
  /** Tamaño en píxeles LÓGICOS (8 ≈ el viejo "8px monospace"). */
  readonly tam?: number;
  readonly color?: string;
  readonly alinear?: CanvasTextAlign;
  readonly negrita?: boolean;
  /** Fuente decorativa (títulos, nombres de jefe). */
  readonly titulo?: boolean;
  readonly alfa?: number;
}

interface Orden {
  readonly x: number;
  readonly y: number;
  readonly texto: string;
  readonly tam: number;
  readonly color: string;
  readonly alinear: CanvasTextAlign;
  readonly negrita: boolean;
  readonly titulo: boolean;
  readonly alfa: number;
}

// Fuentes de píxel (las mismas que la interfaz): el texto del juego deja de verse "de navegador".
const FUENTE = '"Pixelify Sans", "Segoe UI", "Trebuchet MS", Verdana, sans-serif';
const FUENTE_TITULO = '"Jacquard 12", Georgia, "Times New Roman", serif';

class TextoHD {
  private cola: Orden[] = [];
  private lienzo: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private anchoLogico = 480;

  /** Conecta el canvas superpuesto (lo crea el arranque). */
  conectar(lienzo: HTMLCanvasElement, anchoLogico: number): void {
    this.lienzo = lienzo;
    this.g = lienzo.getContext("2d");
    this.anchoLogico = anchoLogico;
  }

  /** Ajusta la resolución del canvas al tamaño en pantalla × devicePixelRatio. */
  redimensionar(anchoCss: number, altoCss: number): void {
    if (this.lienzo === null) return;
    const dpr = window.devicePixelRatio || 1;
    this.lienzo.width = Math.round(anchoCss * dpr);
    this.lienzo.height = Math.round(altoCss * dpr);
    this.lienzo.style.width = `${anchoCss}px`;
    this.lienzo.style.height = `${altoCss}px`;
  }

  /**
   * Encola un texto. `g` es el contexto del juego: se usa su transformación actual (cámara, sacudida) para pasar
   * de coordenadas del mundo a coordenadas de pantalla, y su globalAlpha.
   */
  texto(g: CanvasRenderingContext2D | null, texto: string, x: number, y: number, op: OpcionesTexto = {}): void {
    let px = x;
    let py = y;
    let alfa = op.alfa ?? 1;
    if (g !== null) {
      const m = g.getTransform();
      px = m.a * x + m.c * y + m.e;
      py = m.b * x + m.d * y + m.f;
      alfa *= g.globalAlpha;
    }
    if (alfa <= 0.01) return;
    this.cola.push({
      x: px, y: py, texto, tam: op.tam ?? 8, color: op.color ?? "#ffffff", alinear: op.alinear ?? "left",
      negrita: op.negrita ?? true, titulo: op.titulo ?? false, alfa,
    });
  }

  /** Pinta lo encolado y vacía la cola (una vez por cuadro). */
  pintar(): void {
    const g = this.g;
    const lienzo = this.lienzo;
    if (g === null || lienzo === null) {
      this.cola = [];
      return;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, lienzo.width, lienzo.height);
    const k = lienzo.width / this.anchoLogico;
    g.textBaseline = "alphabetic";
    g.lineJoin = "round";
    for (const o of this.cola) {
      const tam = Math.round(o.tam * k * 1.05);
      g.font = `${o.negrita ? "700 " : ""}${tam}px ${o.titulo ? FUENTE_TITULO : FUENTE}`;
      g.textAlign = o.alinear;
      g.globalAlpha = o.alfa;
      const x = o.x * k;
      const y = o.y * k;
      g.lineWidth = Math.max(2, tam * 0.22);
      g.strokeStyle = "rgba(0,0,0,0.85)";
      g.strokeText(o.texto, x, y);
      g.fillStyle = o.color;
      g.fillText(o.texto, x, y);
    }
    g.globalAlpha = 1;
    this.cola = [];
  }

  /** Descarta lo encolado (p. ej. cuando una escena no se dibuja). */
  limpiar(): void {
    this.cola = [];
  }
}

export const hd = new TextoHD();
