// Generador procedural de interiores de sala (26 × 12, misma leyenda que las plantillas a mano).
// Combina un MOTIVO (la idea de la sala) con piezas al azar y después VALIDA que se pueda recorrer:
// un BFS sobre las casillas donde el Portador puede pararse, con el alcance real de su salto
// (sube hasta 3 casillas, avanza hasta 4 en el aire). Si algo queda inalcanzable, se descarta y se reintenta.
//
// Reglas que respeta (las mismas que validan los tests de las plantillas):
//   - Columnas 9..16 (centro): sin '#' ni '^' — ahí va la cadena de los pasajes verticales.
//   - Zonas de puerta (columnas 0..2 y 23..25, filas 9..11): libres.
//   - Obstáculos del piso de 3 casillas como máximo (se saltan), púas en tramos de 3 como máximo.

import { elegirUno, entero, type Azar } from "minialu";

export const ANCHO_INTERIOR = 26;
export const ALTO_INTERIOR = 12;
const CENTRO_MIN = 9;
const CENTRO_MAX = 16;

export interface Interior {
  readonly nombre: string;
  readonly filas: readonly string[];
}

type Grilla = string[][];

const MOTIVOS = ["escalonada", "pilares", "techoBajo", "foso", "puentes"] as const;
type Motivo = (typeof MOTIVOS)[number];

const NOMBRES: Readonly<Record<Motivo, readonly string[]>> = {
  escalonada: ["Galería escalonada", "Gradas del osario", "Balcones rotos"],
  pilares: ["Sala de pilares", "Columnata caída", "Bosque de piedra"],
  techoBajo: ["Cripta de techo bajo", "Pasaje aplastado", "Bóveda hundida"],
  foso: ["Foso de púas", "Paso de las agujas", "Cámara de trampas"],
  puentes: ["Puentes colgantes", "Pasarelas del vacío", "Andamios del Pozo"],
};

const solido = (c: string): boolean => c === "#";
const soporte = (c: string): boolean => c === "#" || c === "=";
const libre = (c: string): boolean => c !== "#" && c !== "=" && c !== "^";

function vacia(): Grilla {
  return Array.from({ length: ALTO_INTERIOR }, () => Array<string>(ANCHO_INTERIOR).fill("."));
}

function enCentro(x: number): boolean {
  return x >= CENTRO_MIN && x <= CENTRO_MAX;
}

function enPuerta(x: number, y: number): boolean {
  return y >= 9 && (x <= 2 || x >= 23);
}

/** Pone un tramo horizontal si todas las casillas están libres y respetan las reglas. */
function tramo(g: Grilla, y: number, x0: number, ancho: number, c: string): boolean {
  if (y < 0 || y >= ALTO_INTERIOR || x0 < 0 || x0 + ancho > ANCHO_INTERIOR) return false;
  for (let x = x0; x < x0 + ancho; x++) {
    if (g[y][x] !== ".") return false;
    if ((c === "#" || c === "^") && enCentro(x)) return false;
    if (enPuerta(x, y)) return false;
  }
  for (let x = x0; x < x0 + ancho; x++) g[y][x] = c;
  return true;
}

/** Plataformas a izquierda y derecha (y a veces en el centro) en una fila. */
function plataformas(azar: Azar, g: Grilla, y: number, centro: boolean): void {
  const izq = 2 + entero(azar, 4);
  tramo(g, y, izq, 3 + entero(azar, 3), "=");
  const anchoDer = 3 + entero(azar, 3);
  tramo(g, y, ANCHO_INTERIOR - 2 - anchoDer - entero(azar, 4), anchoDer, "=");
  if (centro) tramo(g, y, CENTRO_MIN + entero(azar, 3), 3 + entero(azar, 3), "=");
}

function pilar(azar: Azar, g: Grilla, x: number, alto: number): void {
  for (let k = 0; k < alto; k++) tramo(g, ALTO_INTERIOR - 1 - k, x, 2, "#");
  void azar;
}

function construirMotivo(m: Motivo, azar: Azar): Grilla {
  const g = vacia();
  switch (m) {
    case "escalonada":
      plataformas(azar, g, 9, azar.siguiente() < 0.5);
      plataformas(azar, g, 6, azar.siguiente() < 0.5);
      plataformas(azar, g, 3, azar.siguiente() < 0.4);
      break;
    case "pilares": {
      const xs = [3 + entero(azar, 3), 18 + entero(azar, 3)];
      if (azar.siguiente() < 0.5) xs.push(6 + entero(azar, 2));
      // Pilares de 3: su tope es el primer escalón (las plataformas van de a 3 casillas, lo que alcanza un salto).
      for (const x of xs) pilar(azar, g, x, 3);
      plataformas(azar, g, 9, false);
      plataformas(azar, g, 6, true);
      if (azar.siguiente() < 0.6) plataformas(azar, g, 3, false);
      break;
    }
    case "techoBajo":
      for (let y = 0; y < 3 + entero(azar, 2); y++) {
        tramo(g, y, 0, 5 + entero(azar, 3), "#");
        tramo(g, y, ANCHO_INTERIOR - 5 - entero(azar, 3), 5 + entero(azar, 2), "#");
      }
      plataformas(azar, g, 9, true);
      if (azar.siguiente() < 0.5) plataformas(azar, g, 6, false);
      break;
    case "foso": {
      for (const x0 of [3 + entero(azar, 3), 17 + entero(azar, 3)]) tramo(g, 11, x0, 2 + entero(azar, 2), "^");
      plataformas(azar, g, 9, true);
      if (azar.siguiente() < 0.6) plataformas(azar, g, 6, false);
      break;
    }
    case "puentes":
      // Pasarelas finas y largas, con huecos para saltar.
      for (const y of azar.siguiente() < 0.5 ? [9, 6] : [9, 6, 3]) {
        let x = 2 + entero(azar, 2);
        while (x < ANCHO_INTERIOR - 4) {
          const ancho = 3 + entero(azar, 4);
          tramo(g, y, x, Math.min(ancho, ANCHO_INTERIOR - 2 - x), "=");
          x += ancho + 2 + entero(azar, 2);
        }
      }
      break;
  }
  // Detalles comunes: estalactitas en el techo y alguna púa suelta.
  for (let i = 0; i < 1 + entero(azar, 3); i++) {
    const x = elegirUno(azar, [entero(azar, 7), 17 + entero(azar, 7)]);
    tramo(g, 0, x, 1 + entero(azar, 3), "#");
  }
  if (m !== "foso" && azar.siguiente() < 0.35) tramo(g, 11, elegirUno(azar, [4 + entero(azar, 4), 18 + entero(azar, 3)]), 2, "^");
  return g;
}

/** Casilla donde el Portador puede estar parado (dos de alto libres y algo firme debajo o el piso). */
function parable(g: Grilla, x: number, y: number): boolean {
  if (!libre(g[y][x])) return false;
  if (y > 0 && solido(g[y - 1][x])) return false;
  return y === ALTO_INTERIOR - 1 ? true : soporte(g[y + 1][x]);
}

/** BFS de alcanzabilidad desde la puerta izquierda. Devuelve las casillas alcanzadas como "x,y". */
export function alcanzables(g: readonly (readonly string[])[] | Grilla): Set<string> {
  const grilla = g as Grilla;
  const puntos: [number, number][] = [];
  for (let y = 0; y < ALTO_INTERIOR; y++) {
    for (let x = 0; x < ANCHO_INTERIOR; x++) if (parable(grilla, x, y)) puntos.push([x, y]);
  }
  const vistos = new Set<string>(["1,11"]);
  const cola: [number, number][] = [[1, 11]];
  while (cola.length > 0) {
    const [x, y] = cola.shift()!;
    for (const [x2, y2] of puntos) {
      const k = `${x2},${y2}`;
      if (vistos.has(k)) continue;
      const dx = Math.abs(x2 - x);
      const sube = y - y2;
      const ok = sube <= 3 && sube >= -12 && dx <= (sube > 0 ? 4 : 6) && !techoEntre(grilla, x, y, x2, y2);
      if (ok) {
        vistos.add(k);
        cola.push([x2, y2]);
      }
    }
  }
  return vistos;
}

/**
 * ¿Hay un bloque sólido encima del punto de despegue que corta la subida? (Se sube en vertical y después se
 * avanza en el aire; la cornisa de llegada no cuenta: se aterriza sobre ella).
 */
function techoEntre(g: Grilla, x: number, y: number, _x2: number, y2: number): boolean {
  if (y2 >= y) return false;
  for (let yy = Math.max(0, y2 - 1); yy < y; yy++) if (solido(g[yy][x])) return true;
  return false;
}

/**
 * Errores de una grilla (vacío = válida). Lo usan el generador y los tests.
 * `estricto`: además de cruzar de puerta a puerta, toda plataforma se alcanza con salto simple
 * (las salas generadas lo cumplen siempre; las hechas a mano pueden guardar zonas para el Doble Salto).
 */
export function validarInterior(filas: readonly string[], estricto = true): string[] {
  const errores: string[] = [];
  if (filas.length !== ALTO_INTERIOR) errores.push("alto");
  filas.forEach((f, y) => {
    if (f.length !== ANCHO_INTERIOR) errores.push(`ancho fila ${y}`);
    for (let x = 0; x < f.length; x++) {
      if (enCentro(x) && (f[x] === "#" || f[x] === "^")) errores.push(`centro ${x},${y}`);
      if (enPuerta(x, y) && (f[x] === "#" || f[x] === "=" || f[x] === "^")) errores.push(`puerta ${x},${y}`);
    }
  });
  if (errores.length > 0) return errores;
  const g = filas.map((f) => f.split(""));
  const alc = alcanzables(g);
  if (!alc.has("24,11")) errores.push("no se llega a la puerta derecha");
  if (!estricto) return errores;
  // Toda plataforma tiene que poder pisarse.
  for (let y = 1; y < ALTO_INTERIOR; y++) {
    for (let x = 0; x < ANCHO_INTERIOR; x++) {
      if (g[y][x] !== "=") continue;
      // Un tramo es alcanzable si alguna de sus casillas lo es.
      let x0 = x;
      while (x0 > 0 && g[y][x0 - 1] === "=") x0--;
      let x1 = x;
      while (x1 < ANCHO_INTERIOR - 1 && g[y][x1 + 1] === "=") x1++;
      let algun = false;
      for (let xx = x0; xx <= x1; xx++) if (alc.has(`${xx},${y - 1}`)) algun = true;
      if (!algun) errores.push(`plataforma inalcanzable ${x0}-${x1},${y}`);
      x = x1;
    }
  }
  return errores;
}

/** Tramos de plataforma ('=') a los que no se llega con salto simple: [fila, desde, hasta]. */
function tramosInalcanzables(g: Grilla): [number, number, number][] {
  const alc = alcanzables(g);
  const r: [number, number, number][] = [];
  for (let y = ALTO_INTERIOR - 1; y >= 1; y--) {
    for (let x = 0; x < ANCHO_INTERIOR; x++) {
      if (g[y][x] !== "=") continue;
      let x1 = x;
      while (x1 < ANCHO_INTERIOR - 1 && g[y][x1 + 1] === "=") x1++;
      let algun = false;
      for (let xx = x; xx <= x1; xx++) if (alc.has(`${xx},${y - 1}`)) algun = true;
      if (!algun) r.push([y, x, x1]);
      x = x1;
    }
  }
  return r;
}

/**
 * Sin Doble Salto: agrega escalones (plataformas de 3) debajo de cada cornisa que solo se alcanza con doble salto,
 * hasta que toda la sala se recorra con salto simple. Así una sala hecha a mano (o la arena de un jefe que vuela)
 * nunca deja al Portador sin poder subir. Las salas generadas ya cumplen la regla y salen iguales.
 */
export function escalonarParaSaltoSimple(filas: readonly string[]): string[] {
  const g: Grilla = filas.map((f) => f.split(""));
  for (let iter = 0; iter < 30; iter++) {
    const pendientes = tramosInalcanzables(g);
    if (pendientes.length === 0) break;
    // De abajo hacia arriba: cada escalón nuevo sirve de base al siguiente.
    const [y, x0, x1] = pendientes[0];
    let mejor: { g: Grilla; puntos: number } | undefined;
    for (const fila of [y + 3, y + 2]) {
      if (fila >= ALTO_INTERIOR) continue;
      for (let xs = x0 - 6; xs <= x1 + 4; xs++) {
        const prueba = g.map((f) => [...f]);
        if (!tramo(prueba, fila, xs, 3, "=")) continue;
        const resto = tramosInalcanzables(prueba);
        const resuelto = !resto.some(([ry, rx0]) => ry === y && rx0 === x0);
        const escalonListo = !resto.some(([ry, rx0, rx1]) => ry === fila && rx0 <= xs + 2 && rx1 >= xs);
        // Preferir: cornisa resuelta > escalón alcanzable > cualquiera; y a igualdad, el más cerca de la cornisa.
        const puntos = (resuelto ? 1000 : 0) + (escalonListo ? 100 : 0) - Math.abs(xs + 1 - (x0 + x1) / 2) - (fila === y + 3 ? 0 : 5);
        if (mejor === undefined || puntos > mejor.puntos) mejor = { g: prueba, puntos };
      }
    }
    if (mejor === undefined) break;
    for (let yy = 0; yy < ALTO_INTERIOR; yy++) g[yy] = mejor.g[yy];
  }
  return g.map((f) => f.join(""));
}

/** Coloca enemigos en lugares con sentido: caminantes en el piso, torretas en plataformas, voladores en el aire. */
function poblar(azar: Azar, g: Grilla): void {
  const alc = alcanzables(g);
  const piso: [number, number][] = [];
  const altos: [number, number][] = [];
  for (const k of alc) {
    const [x, y] = k.split(",").map(Number);
    if (enPuerta(x, y) || x <= 3 || x >= 22) continue;
    if (y === ALTO_INTERIOR - 1) piso.push([x, y]);
    else altos.push([x, y]);
  }
  const poner = (lista: [number, number][], c: string): void => {
    if (lista.length === 0) return;
    const [x, y] = lista.splice(entero(azar, lista.length), 1)[0];
    if (g[y][x] === ".") g[y][x] = c;
  };
  const n = 3 + entero(azar, 3);
  for (let i = 0; i < n; i++) {
    const r = azar.siguiente();
    if (r < 0.4) poner(piso, "e");
    else if (r < 0.55) poner(piso, "g");
    else if (r < 0.7) poner(piso, "s");
    else if (r < 0.82) poner(altos, "t");
    else {
      const x = 3 + entero(azar, 20);
      const y = 1 + entero(azar, 5);
      if (g[y][x] === "." && !enCentro(x)) g[y][x] = "v";
    }
  }
}

/** Genera un interior válido. Reintenta hasta encontrar uno recorrible (en la práctica, pocos intentos). */
export function generarInterior(azar: Azar): Interior | null {
  for (let intento = 0; intento < 40; intento++) {
    const motivo = elegirUno(azar, MOTIVOS);
    const g = construirMotivo(motivo, azar);
    const filas = g.map((f) => f.join(""));
    if (validarInterior(filas).length > 0) continue;
    poblar(azar, g);
    return { nombre: elegirUno(azar, NOMBRES[motivo]), filas: g.map((f) => f.join("")) };
  }
  return null;
}
