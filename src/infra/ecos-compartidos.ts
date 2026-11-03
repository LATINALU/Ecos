// ECOS ASÍNCRONOS: a veces, en la sala del Eco te espera el Eco de OTRO Portador que cayó en ese piso.
// Si lo vences, usas una versión ESPECTRAL de su mejor pieza durante el descenso, y a él le llega a su Taberna:
// "Un Portador vengó tu caída en el piso N — Recibes X esquirlas".
//
// La interfaz no depende de dónde vivan los Ecos:
//   · ServicioLocal  — los comparten las ranuras de partida de esta computadora (otros Portadores de la casa).
//   · ServicioHttp   — un servidor ligero (VITE_ECOS_URL): POST /ecos, GET /ecos?piso=N, POST /venganzas, GET /venganzas?id=…
//   · Para Steam, el mismo contrato se puede cumplir con el Workshop/Leaderboards o un servidor propio
//     autenticado con el ticket de sesión de Steam (falta implementarlo: no hay credenciales en este repo).
//
// El juego consulta de forma SÍNCRONA (para generar el piso al instante): por eso cada servicio guarda una caché
// que se rellena con `precargar()` al arrancar.

import type { Eco } from "../dominio/eco.ts";

export interface EcoCompartido {
  readonly eco: Eco;
  /** Nombre del Portador que cayó. */
  readonly portador: string;
  /** Identificador de quién lo publicó (ranura local o id de jugador remoto). */
  readonly autor: string;
}

export interface Venganza {
  readonly piso: number;
  readonly vengador: string;
  readonly recompensa: number;
  readonly fecha: number;
}

export interface ServicioEcos {
  /** Rellena la caché (remoto: pide la lista al servidor). */
  precargar(): Promise<void>;
  publicar(e: EcoCompartido): void;
  /** Un Eco ajeno para este piso (de otro autor), o null. */
  buscar(piso: number, autor: string): EcoCompartido | null;
  /** Avisar al autor que vengaron su caída. */
  vengar(e: EcoCompartido, vengador: string, recompensa: number): void;
  /** Venganzas recibidas por este autor (se consumen al leerlas). */
  venganzas(autor: string): Promise<Venganza[]>;
}

/** Recompensa que recibe el caído cuando alguien lo venga. */
export function recompensaVenganza(piso: number): number {
  return 150 + piso * 25;
}

const CLAVE_ECOS = "ecos.compartidos.v1";
const CLAVE_VENGANZAS = "ecos.venganzas.v1";
const MAX_COMPARTIDOS = 40;
const VIGENCIA_MS = 14 * 24 * 3600 * 1000;

function leer<T>(k: string, def: T): T {
  try {
    const s = localStorage.getItem(k);
    return s === null ? def : (JSON.parse(s) as T);
  } catch {
    return def;
  }
}

function escribir(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // sin almacenamiento: se juega igual, sin Ecos compartidos
  }
}

export class ServicioLocal implements ServicioEcos {
  async precargar(): Promise<void> {
    // Todo vive en localStorage: no hay nada que traer.
  }

  publicar(e: EcoCompartido): void {
    const ahora = Date.now();
    const lista = leer<EcoCompartido[]>(CLAVE_ECOS, []).filter((x) => ahora - x.eco.fecha < VIGENCIA_MS && x.eco.uid !== e.eco.uid);
    escribir(CLAVE_ECOS, [e, ...lista].slice(0, MAX_COMPARTIDOS));
  }

  buscar(piso: number, autor: string): EcoCompartido | null {
    const ahora = Date.now();
    const candidatos = leer<EcoCompartido[]>(CLAVE_ECOS, []).filter((x) => x.eco.piso === piso && x.autor !== autor && ahora - x.eco.fecha < VIGENCIA_MS);
    return candidatos[Math.floor(Math.random() * candidatos.length)] ?? null;
  }

  vengar(e: EcoCompartido, vengador: string, recompensa: number): void {
    // El Eco vengado deja de vagar por el Pozo.
    escribir(CLAVE_ECOS, leer<EcoCompartido[]>(CLAVE_ECOS, []).filter((x) => x.eco.uid !== e.eco.uid));
    const todas = leer<Record<string, Venganza[]>>(CLAVE_VENGANZAS, {});
    todas[e.autor] = [...(todas[e.autor] ?? []), { piso: e.eco.piso, vengador, recompensa, fecha: Date.now() }];
    escribir(CLAVE_VENGANZAS, todas);
  }

  async venganzas(autor: string): Promise<Venganza[]> {
    const todas = leer<Record<string, Venganza[]>>(CLAVE_VENGANZAS, {});
    const mias = todas[autor] ?? [];
    if (mias.length > 0) {
      delete todas[autor];
      escribir(CLAVE_VENGANZAS, todas);
    }
    return mias;
  }
}

/** Servidor ligero (opcional). Si falla la red, el juego sigue con lo que tenga en caché. */
export class ServicioHttp implements ServicioEcos {
  private cache: EcoCompartido[] = [];

  constructor(private readonly base: string) {}

  async precargar(): Promise<void> {
    try {
      const r = await fetch(`${this.base}/ecos`);
      if (r.ok) this.cache = (await r.json()) as EcoCompartido[];
    } catch {
      this.cache = [];
    }
  }

  publicar(e: EcoCompartido): void {
    void fetch(`${this.base}/ecos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) }).catch(() => undefined);
  }

  buscar(piso: number, autor: string): EcoCompartido | null {
    const c = this.cache.filter((x) => x.eco.piso === piso && x.autor !== autor);
    return c[Math.floor(Math.random() * c.length)] ?? null;
  }

  vengar(e: EcoCompartido, vengador: string, recompensa: number): void {
    this.cache = this.cache.filter((x) => x.eco.uid !== e.eco.uid);
    void fetch(`${this.base}/venganzas`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: e.eco.uid, autor: e.autor, piso: e.eco.piso, vengador, recompensa }),
    }).catch(() => undefined);
  }

  async venganzas(autor: string): Promise<Venganza[]> {
    try {
      const r = await fetch(`${this.base}/venganzas?id=${encodeURIComponent(autor)}`);
      return r.ok ? ((await r.json()) as Venganza[]) : [];
    } catch {
      return [];
    }
  }
}

export function crearServicioEcos(): ServicioEcos {
  const url = (import.meta.env as Record<string, string | undefined>).VITE_ECOS_URL;
  return url !== undefined && url !== "" ? new ServicioHttp(url) : new ServicioLocal();
}

/** Probabilidad de que la sala del Eco traiga el Eco de otro Portador (si no tienes uno propio en ese piso). */
export const PROB_ECO_AJENO = 0.2;
