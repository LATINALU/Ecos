// Efectos de pantalla para el juego, sin depender de si hay WebGL: el juego pide "onda de choque aquí" o "trauma",
// y si el compositor está activo los aplica; si no, no pasa nada (el juego sigue igual que antes).

import type { CompositorWebGL, LuzCompositor } from "./compositor.ts";

let compositor: CompositorWebGL | null = null;
/** Desplazamiento mundo → pantalla del cuadro actual (lo actualiza la escena). */
let camX = 0;
let camY = 0;

export const postfx = {
  conectar(c: CompositorWebGL | null): void {
    compositor = c;
  },

  get activo(): boolean {
    return compositor !== null;
  },

  camara(x: number, y: number): void {
    camX = x;
    camY = y;
  },

  /** Onda de choque en coordenadas de MUNDO. */
  onda(x: number, y: number, velocidad = 2.2): void {
    compositor?.ondaDeChoque(x - camX, y - camY, velocidad);
  },

  /** Trauma (aberración cromática y viñeta) y destello blanco de impacto. */
  trauma(cantidad: number, destello = 0): void {
    compositor?.agregarTrauma(cantidad, destello);
  },

  /** Trauma que no baja (vida crítica). */
  traumaMinimo(v: number): void {
    if (compositor !== null) compositor.traumaMinimo = v;
  },

  /** Luces del cuadro para el relieve (en coordenadas de PANTALLA). */
  luces(lista: readonly LuzCompositor[]): void {
    if (compositor === null) return;
    compositor.iniciarCuadro();
    // Las más fuertes primero (hay lugar para 32).
    const orden = lista.length > 32 ? [...lista].sort((a, b) => b.fuerza * b.radio - a.fuerza * a.radio) : lista;
    for (const l of orden) compositor.agregarLuz(l);
  },
};

/** "#ff9a3d" o "rgb(…)"/"hsl(…)" a RGB 0..1 (lo que no se entienda, blanco cálido). */
export function rgbDe(color: string | undefined): [number, number, number] {
  if (color === undefined) return [1, 0.9, 0.75];
  if (color.startsWith("#") && (color.length === 7 || color.length === 9)) {
    return [parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255];
  }
  if (color.startsWith("#") && color.length === 4) {
    return [parseInt(color[1] + color[1], 16) / 255, parseInt(color[2] + color[2], 16) / 255, parseInt(color[3] + color[3], 16) / 255];
  }
  return [1, 0.9, 0.75];
}
