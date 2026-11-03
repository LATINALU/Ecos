// Marcos "nine-slice" de pixel art para toda la interfaz HTML, dibujados por código al arrancar.
//
// Cada marco es un lienzo chiquito (esquinas, bordes y centro) que se exporta como imagen y se usa con
// `border-image` en CSS: las esquinas quedan fijas y los bordes y el centro se repiten. Así los menús dejan de
// parecer una página web (bordes redondeados, sombras difusas) y comparten la estética del juego:
// hierro forjado con remaches, madera con herrajes, vidrio oscuro y botones biselados.
//
// Se escalan ×2 en CSS (cada píxel del arte = 2 px de pantalla) con `image-rendering: pixelated`.

type Pintor = (p: (x: number, y: number, w: number, h: number, c: string) => void, tam: number) => void;

function crear(tam: number, pintar: Pintor): string {
  const c = document.createElement("canvas");
  c.width = tam;
  c.height = tam;
  const g = c.getContext("2d")!;
  pintar((x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }, tam);
  return c.toDataURL("image/png");
}

/** Ruido determinista (para texturas que no cambian entre cargas). */
function ruido(x: number, y: number, k = 0): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Bisel: luz arriba-izquierda, sombra abajo-derecha. */
function bisel(p: Parameters<Pintor>[0], x: number, y: number, w: number, h: number, luz: string, sombra: string): void {
  p(x, y, w, 1, luz);
  p(x, y, 1, h, luz);
  p(x, y + h - 1, w, 1, sombra);
  p(x + w - 1, y, 1, h, sombra);
}

function remache(p: Parameters<Pintor>[0], x: number, y: number): void {
  p(x, y, 3, 3, "#1a1622");
  p(x, y, 2, 2, "#b8b0c8");
  p(x, y, 1, 1, "#ffffff");
}

/** Panel general: banda de hierro biselada con placas remachadas en las esquinas y centro de piedra oscura. */
const hierro: Pintor = (p, t) => {
  // Centro: piedra oscura con algo de textura.
  for (let y = 0; y < t; y++) {
    for (let x = 0; x < t; x++) {
      const r = ruido(x, y, 3);
      p(x, y, 1, 1, r < 0.08 ? "#1c1530" : r > 0.93 ? "#0b0814" : "#120d1e");
    }
  }
  // Banda de hierro (7 px)
  p(0, 0, t, 1, "#000000");
  p(0, t - 1, t, 1, "#000000");
  p(0, 0, 1, t, "#000000");
  p(t - 1, 0, 1, t, "#000000");
  for (let k = 1; k < 7; k++) {
    const c = k === 1 ? "#8a84a0" : k === 6 ? "#1a1424" : k % 2 === 0 ? "#4a4458" : "#544e64";
    p(k, k, t - k * 2, 1, k === 6 ? c : c);
    p(k, t - 1 - k, t - k * 2, 1, k === 1 ? "#241e30" : c);
    p(k, k, 1, t - k * 2, c);
    p(t - 1 - k, k, 1, t - k * 2, k === 1 ? "#241e30" : c);
  }
  // Rayas de forja en la banda
  for (let x = 9; x < t - 9; x += 4) p(x, 3, 1, 2, "#3a3448");
  // Placas de las esquinas con remache
  for (const [x, y] of [[0, 0], [t - 9, 0], [0, t - 9], [t - 9, t - 9]] as const) {
    p(x + 1, y + 1, 7, 7, "#3a3448");
    bisel(p, x + 1, y + 1, 7, 7, "#9a94b0", "#15101f");
    remache(p, x + 3, y + 3);
  }
};

/** Tiendas: madera oscura con vetas y herrajes de latón en las esquinas. */
const madera: Pintor = (p, t) => {
  for (let y = 0; y < t; y++) {
    for (let x = 0; x < t; x++) {
      const veta = Math.sin(y * 0.9 + ruido(0, y, 7) * 3) > 0.7;
      p(x, y, 1, 1, veta ? "#1e140d" : ruido(x, y, 5) < 0.06 ? "#2a1c12" : "#170f0a");
    }
  }
  p(0, 0, t, 1, "#000000");
  p(0, t - 1, t, 1, "#000000");
  p(0, 0, 1, t, "#000000");
  p(t - 1, 0, 1, t, "#000000");
  for (let k = 1; k < 7; k++) {
    const c = k === 1 ? "#7a5232" : k === 6 ? "#120a06" : ruido(k, 1, 9) > 0.5 ? "#4a301c" : "#3e2816";
    p(k, k, t - k * 2, 1, c);
    p(k, t - 1 - k, t - k * 2, 1, k === 1 ? "#24160c" : c);
    p(k, k, 1, t - k * 2, c);
    p(t - 1 - k, k, 1, t - k * 2, k === 1 ? "#24160c" : c);
  }
  for (const [x, y] of [[0, 0], [t - 9, 0], [0, t - 9], [t - 9, t - 9]] as const) {
    p(x + 1, y + 1, 7, 7, "#8a6a2a");
    bisel(p, x + 1, y + 1, 7, 7, "#ffd27a", "#3a2410");
    p(x + 3, y + 3, 3, 3, "#c89a3a");
    p(x + 3, y + 3, 1, 1, "#fff0b0");
  }
};

/** Vidrio oscuro: fichas, detalles y secciones. Borde fino con una grieta de luz en la esquina. */
const vidrio: Pintor = (p, t) => {
  p(0, 0, t, t, "#0d0a17");
  p(0, 0, t, 1, "#000000");
  p(0, t - 1, t, 1, "#000000");
  p(0, 0, 1, t, "#000000");
  p(t - 1, 0, 1, t, "#000000");
  bisel(p, 1, 1, t - 2, t - 2, "#4a3e66", "#1a1428");
  p(2, 2, t - 4, 1, "#241c38");
  // Grieta de luz
  p(2, 2, 3, 1, "#8a7ab0");
  p(2, 3, 1, 2, "#8a7ab0");
  p(4, 3, 1, 1, "#5a4a80");
};

function boton(cara: string, luz: string, sombra: string, aro: string): Pintor {
  return (p, t) => {
    p(0, 0, t, t, cara);
    // Textura metálica suave
    for (let y = 2; y < t - 2; y++) for (let x = 2; x < t - 2; x++) if (ruido(x, y, 11) < 0.07) p(x, y, 1, 1, sombra);
    p(0, 0, t, 1, "#000000");
    p(0, t - 1, t, 1, "#000000");
    p(0, 0, 1, t, "#000000");
    p(t - 1, 0, 1, t, "#000000");
    bisel(p, 1, 1, t - 2, t - 2, aro, sombra);
    bisel(p, 2, 2, t - 4, t - 4, luz, sombra);
    // Clavos en las esquinas
    for (const [x, y] of [[2, 2], [t - 3, 2], [2, t - 3], [t - 3, t - 3]] as const) p(x, y, 1, 1, aro);
  };
}

const PRESIONADO = (cara: string, luz: string, sombra: string): Pintor => (p, t) => {
  p(0, 0, t, t, cara);
  p(0, 0, t, 1, "#000000");
  p(0, t - 1, t, 1, "#000000");
  p(0, 0, 1, t, "#000000");
  p(t - 1, 0, 1, t, "#000000");
  bisel(p, 1, 1, t - 2, t - 2, sombra, luz);
};

/** Genera todos los marcos y los publica como variables CSS (`--marco-*`). */
export function instalarMarcos(raiz: HTMLElement = document.documentElement): void {
  const marcos: Record<string, string> = {
    hierro: crear(24, hierro),
    madera: crear(24, madera),
    vidrio: crear(12, vidrio),
    boton: crear(12, boton("#2c2440", "#6a6086", "#120e1c", "#8a84a0")),
    "boton-hover": crear(12, boton("#3a2e58", "#9a8ac0", "#160f24", "#ffd27a")),
    "boton-principal": crear(12, boton("#6a3e14", "#ffd27a", "#2a1608", "#ffe9a8")),
    "boton-principal-hover": crear(12, boton("#8a5420", "#fff0b0", "#3a2010", "#ffffff")),
    "boton-on": crear(12, PRESIONADO("#4a3a7a", "#a08ad0", "#1a1030")),
    "boton-apagado": crear(12, boton("#1a1622", "#2e2838", "#0c0a10", "#2e2838")),
  };
  for (const [nombre, url] of Object.entries(marcos)) raiz.style.setProperty(`--marco-${nombre}`, `url("${url}")`);
}
