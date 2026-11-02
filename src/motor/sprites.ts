// Cargador de imágenes con RESPALDO: si una imagen no cargó (o todavía no), `imagen()` devuelve null y quien
// dibuja usa el arte procedural de siempre. Así el juego nunca depende de los archivos para funcionar.
// También guarda versiones "teñidas" por bioma (el mismo castillo en verde para el Micelio, en brasa para la Forja).

export type NombreImagen = "castillo" | "criaturas" | "iconos";

const RUTAS: Readonly<Record<NombreImagen, string>> = {
  castillo: "sprites/castillo.png",
  criaturas: "sprites/criaturas.png",
  iconos: "sprites/iconos.png",
};

export type Lienzo = HTMLImageElement | HTMLCanvasElement;

class Sprites {
  private readonly listas = new Map<NombreImagen, HTMLImageElement>();
  private readonly tenidas = new Map<string, HTMLCanvasElement>();
  activado = true;

  /** Carga todo; resuelve igual si algo falla (se usará el respaldo). Con tiempo máximo. */
  cargar(base = import.meta.env.BASE_URL, maxMs = 4000): Promise<void> {
    const promesas = (Object.keys(RUTAS) as NombreImagen[]).map((nombre) => new Promise<void>((ok) => {
      const img = new Image();
      img.onload = () => {
        this.listas.set(nombre, img);
        ok();
      };
      img.onerror = () => ok();
      img.src = base + RUTAS[nombre];
    }));
    return Promise.race([
      Promise.all(promesas).then(() => undefined),
      new Promise<void>((ok) => setTimeout(ok, maxMs)),
    ]);
  }

  imagen(nombre: NombreImagen): HTMLImageElement | null {
    return this.activado ? this.listas.get(nombre) ?? null : null;
  }

  /** La imagen con un tinte encima (solo donde hay píxeles). `alfa` 0 = sin tinte. */
  tenida(nombre: NombreImagen, color: string, alfa: number): Lienzo | null {
    const img = this.imagen(nombre);
    if (img === null || alfa <= 0) return img;
    const clave = `${nombre}|${color}|${alfa}`;
    const hecha = this.tenidas.get(clave);
    if (hecha !== undefined) return hecha;
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = alfa;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this.tenidas.set(clave, c);
    return c;
  }

  /** URL de la imagen (para CSS en los menús), o null si no está. */
  url(nombre: NombreImagen): string | null {
    return this.imagen(nombre)?.src ?? null;
  }
}

export const sprites = new Sprites();

/** Dibuja un recorte; `espejo` lo voltea horizontalmente alrededor de su propio ancho. */
export function dibujarRecorte(
  g: CanvasRenderingContext2D, img: Lienzo, r: readonly [number, number, number, number],
  x: number, y: number, espejo = false, escala = 1,
): void {
  const [sx, sy, sw, sh] = r;
  const w = sw * escala;
  const h = sh * escala;
  if (!espejo) {
    g.drawImage(img, sx, sy, sw, sh, Math.round(x), Math.round(y), w, h);
    return;
  }
  g.save();
  g.translate(Math.round(x) + w, Math.round(y));
  g.scale(-1, 1);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  g.restore();
}
