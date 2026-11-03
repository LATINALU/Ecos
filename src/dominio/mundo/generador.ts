// Generador de pisos estilo metroidvania con "llave y cerradura":
//   1. Crece un árbol de salas sobre una grilla (el Pozo baja: se empieza arriba y se crece hacia abajo/costados).
//   2. Agrega algunos atajos (ciclos) entre salas vecinas.
//   3. Ubica las salas especiales: jefe en la hoja más lejana, reliquia, tesoro, altar, mercader y el Eco.
//   4. Pone barreras (cristal/raíces) en puertas laterales.
//   5. VALIDA con un punto fijo: desde el inicio, con las reliquias que el jugador tiene, junta las que encuentra
//      y vuelve a explorar hasta que no cambie nada. Si el jefe o el altar no quedan alcanzables, se reintenta.
//
// Reglas de paso: lateral = libre (salvo barrera); vertical = libre en ambos sentidos (cadena para trepar).

import { elegirPorPeso, elegirUno, entero, type Azar } from "minialu";
import { DELTA, OPUESTA, RELIQUIA_DE_BARRERA, type Barrera, type Dir, type Reliquia } from "../tipos.ts";

export type TipoSala = "inicio" | "normal" | "altar" | "tesoro" | "reliquia" | "eco" | "mercader" | "jefe";

export interface SalaMapa {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  tipo: TipoSala;
  readonly semilla: number;
  reliquia?: Reliquia;
}

export interface Conexion {
  readonly a: number;
  readonly b: number;
  /** Dirección para ir de `a` a `b`. */
  readonly dir: Dir;
  barrera?: Barrera;
}

export interface MapaPiso {
  readonly piso: number;
  readonly ancho: number;
  readonly alto: number;
  readonly salas: readonly SalaMapa[];
  readonly conexiones: readonly Conexion[];
  readonly inicio: number;
  readonly jefe: number;
  /** Salas con punto de extracción (vuelta al pueblo conservando todo). Opcional: descensos guardados viejos. */
  readonly extracciones?: readonly number[];
}

export interface OpcionesGenerador {
  readonly piso: number;
  readonly cantidadSalas: number;
  readonly ancho: number;
  readonly alto: number;
  readonly reliquiasPoseidas: readonly Reliquia[];
  /** Reliquia que se ofrece en este piso (la primera que falta). */
  readonly reliquiaAColocar?: Reliquia;
  readonly hayEco: boolean;
  readonly probBarrera?: number;
}

const PESO_DIR: ReadonlyArray<readonly [Dir, number]> = [["aba", 1.1], ["izq", 1.3], ["der", 1.3], ["arr", 0.35]];

/** Toda conexión se cruza en ambos sentidos (las verticales tienen cadena); solo las barreras piden reliquia. */
export function puedeCruzar(c: Conexion, _desde: number, reliquias: ReadonlySet<Reliquia>): boolean {
  return c.barrera === undefined || reliquias.has(RELIQUIA_DE_BARRERA[c.barrera]);
}

export function vecinos(mapa: MapaPiso, sala: number): { sala: number; dir: Dir; conexion: Conexion }[] {
  const r: { sala: number; dir: Dir; conexion: Conexion }[] = [];
  for (const c of mapa.conexiones) {
    if (c.a === sala) r.push({ sala: c.b, dir: c.dir, conexion: c });
    else if (c.b === sala) r.push({ sala: c.a, dir: OPUESTA[c.dir], conexion: c });
  }
  return r;
}

export function alcanzables(mapa: MapaPiso, desde: number, reliquias: ReadonlySet<Reliquia>): Set<number> {
  const vistos = new Set<number>([desde]);
  const cola = [desde];
  while (cola.length > 0) {
    const actual = cola.shift()!;
    for (const v of vecinos(mapa, actual)) {
      if (!vistos.has(v.sala) && puedeCruzar(v.conexion, actual, reliquias)) {
        vistos.add(v.sala);
        cola.push(v.sala);
      }
    }
  }
  return vistos;
}

/** Punto fijo: explora, recoge reliquias alcanzables, repite. */
export function resolver(mapa: MapaPiso, iniciales: readonly Reliquia[]): { alcanzables: Set<number>; reliquias: Set<Reliquia> } {
  const reliquias = new Set(iniciales);
  for (;;) {
    const alc = alcanzables(mapa, mapa.inicio, reliquias);
    let nueva = false;
    for (const id of alc) {
      const r = mapa.salas[id].reliquia;
      if (r !== undefined && !reliquias.has(r)) {
        reliquias.add(r);
        nueva = true;
      }
    }
    if (!nueva) return { alcanzables: alc, reliquias };
  }
}

export function esValido(mapa: MapaPiso, iniciales: readonly Reliquia[]): boolean {
  const { alcanzables: alc } = resolver(mapa, iniciales);
  if (!alc.has(mapa.jefe)) return false;
  return mapa.salas.every((s) => (s.tipo !== "altar" && s.tipo !== "reliquia" && s.tipo !== "eco") || alc.has(s.id));
}

function distancias(salas: readonly SalaMapa[], conexiones: readonly Conexion[], inicio: number): number[] {
  const dist = salas.map(() => Infinity);
  dist[inicio] = 0;
  const cola = [inicio];
  while (cola.length > 0) {
    const a = cola.shift()!;
    for (const c of conexiones) {
      const b = c.a === a ? c.b : c.b === a ? c.a : -1;
      if (b >= 0 && dist[b] === Infinity) {
        dist[b] = dist[a] + 1;
        cola.push(b);
      }
    }
  }
  return dist;
}

function intentar(azar: Azar, op: OpcionesGenerador, permitirSubidas: boolean, conBarreras: boolean): MapaPiso {
  const grilla = new Map<string, number>();
  const salas: SalaMapa[] = [];
  const conexiones: Conexion[] = [];
  const clave = (x: number, y: number): string => `${x},${y}`;
  const agregar = (x: number, y: number): number => {
    const id = salas.length;
    salas.push({ id, x, y, tipo: "normal", semilla: entero(azar, 2 ** 31) });
    grilla.set(clave(x, y), id);
    return id;
  };
  const inicio = agregar(Math.floor(op.ancho / 2), 0);
  const pesos = PESO_DIR.filter(([d]) => permitirSubidas || d !== "arr");

  let intentos = 0;
  while (salas.length < op.cantidadSalas && intentos++ < 2000) {
    // Preferir crecer desde salas recientes da pasillos largos (más "exploración").
    const desde = salas[Math.max(0, salas.length - 1 - entero(azar, Math.min(salas.length, 4)))];
    const dir = elegirPorPeso(azar, pesos);
    const [dx, dy] = DELTA[dir];
    const x = desde.x + dx;
    const y = desde.y + dy;
    if (x < 0 || y < 0 || x >= op.ancho || y >= op.alto || grilla.has(clave(x, y))) continue;
    const nueva = agregar(x, y);
    conexiones.push({ a: desde.id, b: nueva, dir });
  }

  // Atajos: conectar vecinos que no lo estén (solo laterales y bajadas: no inventan subidas obligatorias).
  for (const s of salas) {
    for (const dir of ["der", "aba"] as const) {
      const [dx, dy] = DELTA[dir];
      const otro = grilla.get(clave(s.x + dx, s.y + dy));
      if (otro === undefined) continue;
      const existe = conexiones.some((c) => (c.a === s.id && c.b === otro) || (c.a === otro && c.b === s.id));
      if (!existe && azar.siguiente() < 0.2) conexiones.push({ a: s.id, b: otro, dir });
    }
  }

  const dist = distancias(salas, conexiones, inicio);
  const grado = (id: number): number => conexiones.filter((c) => c.a === id || c.b === id).length;
  const hojas = salas.filter((s) => s.id !== inicio && grado(s.id) === 1);
  const porDistancia = [...salas].filter((s) => s.id !== inicio).sort((a, b) => dist[b.id] - dist[a.id]);

  const jefe = (hojas.length > 0 ? [...hojas].sort((a, b) => dist[b.id] - dist[a.id])[0] : porDistancia[0]).id;
  salas[inicio].tipo = "inicio";
  salas[jefe].tipo = "jefe";

  const libres = (): SalaMapa[] => salas.filter((s) => s.tipo === "normal");
  const tomar = (preferidas: SalaMapa[]): SalaMapa | undefined => {
    const lista = preferidas.filter((s) => s.tipo === "normal");
    if (lista.length > 0) return elegirUno(azar, lista);
    const resto = libres();
    return resto.length > 1 ? elegirUno(azar, resto) : undefined;
  };

  if (op.reliquiaAColocar !== undefined) {
    const medio = tomar(salas.filter((s) => dist[s.id] >= 2 && dist[s.id] <= dist[jefe] - 1));
    if (medio !== undefined) {
      medio.tipo = "reliquia";
      medio.reliquia = op.reliquiaAColocar;
    }
  }
  if (op.hayEco) {
    const eco = tomar(salas.filter((s) => dist[s.id] >= 2));
    if (eco !== undefined) eco.tipo = "eco";
  }
  const altar = tomar(salas.filter((s) => dist[s.id] >= 1 && dist[s.id] <= 3));
  if (altar !== undefined) altar.tipo = "altar";
  const tesoro = tomar(hojas);
  if (tesoro !== undefined) tesoro.tipo = "tesoro";
  const mercader = tomar(salas.filter((s) => dist[s.id] >= 2));
  if (mercader !== undefined) mercader.tipo = "mercader";

  // Extracción (estilo Tarkov): 1~2 salas normales lejos del inicio. Una a media distancia y otra al fondo.
  const extracciones: number[] = [];
  const candidatas = salas.filter((s) => s.tipo === "normal" && dist[s.id] >= 2).sort((a, b) => dist[a.id] - dist[b.id]);
  if (candidatas.length > 0) {
    extracciones.push(candidatas[Math.floor(candidatas.length / 2)].id);
    const fondo = candidatas[candidatas.length - 1];
    if (candidatas.length >= 3 && !extracciones.includes(fondo.id)) extracciones.push(fondo.id);
  } else {
    const resto = salas.filter((s) => s.tipo === "normal");
    if (resto.length > 0) extracciones.push(elegirUno(azar, resto).id);
  }

  if (conBarreras) {
    const prob = op.probBarrera ?? 0.3;
    for (const c of conexiones) {
      if ((c.dir === "izq" || c.dir === "der") && c.a !== inicio && c.b !== inicio && azar.siguiente() < prob) {
        c.barrera = azar.siguiente() < 0.5 ? "cristal" : "raices";
      }
    }
  }

  return { piso: op.piso, ancho: op.ancho, alto: op.alto, salas, conexiones, inicio, jefe, extracciones };
}

export function generarPiso(azar: Azar, op: OpcionesGenerador): MapaPiso {
  for (let i = 0; i < 60; i++) {
    const mapa = intentar(azar, op, true, true);
    if (mapa.salas.length >= Math.min(op.cantidadSalas, 6) && esValido(mapa, op.reliquiasPoseidas)) return mapa;
  }
  // Último recurso: sin subidas ni barreras, todo se alcanza bajando o caminando.
  return intentar(azar, op, false, false);
}

/** Aperturas de una sala: hacia dónde tiene puertas y con qué barrera. */
export function aperturas(mapa: MapaPiso, sala: number): Partial<Record<Dir, { destino: number; barrera?: Barrera }>> {
  const r: Partial<Record<Dir, { destino: number; barrera?: Barrera }>> = {};
  for (const v of vecinos(mapa, sala)) r[v.dir] = { destino: v.sala, barrera: v.conexion.barrera };
  return r;
}
