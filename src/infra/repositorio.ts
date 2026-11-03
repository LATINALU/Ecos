// Persistencia en localStorage por RANURAS de partida (3). Cada ranura guarda:
//   - meta: reliquias, esencia, Santuario, Ecos y registro de ese mundo.
//   - personaje: el Portador persistente (nivel, equipo, mochila, cartas, talentos, misiones...).
//   - banco: la Bóveda de los Caídos (objetos y esquirlas a salvo).
//   - descenso: el descenso en curso, si se cerró el juego a mitad de camino.
// El formato viejo (una sola partida, "ecos.meta.v1" + "ecos.descenso.v1") se migra a la ranura 1 sin borrarlo.

import { Meta, type DatosMeta } from "../dominio/meta.ts";
import type { DatosBanco } from "../dominio/banco.ts";
import type { DatosPartida } from "../dominio/partida.ts";
import type { DatosDescenso } from "../juego/juego.ts";

export const CANTIDAD_RANURAS = 3;

export interface DatosRanura {
  readonly version: 2;
  readonly nombre: string;
  readonly creada: number;
  readonly actualizada: number;
  readonly meta: DatosMeta;
  readonly personaje: DatosPartida | null;
  readonly banco: DatosBanco | null;
  readonly descenso: DatosDescenso | null;
}

export interface ResumenRanura {
  readonly indice: number;
  readonly nombre: string;
  readonly nivel: number | null;
  readonly pisoDesbloqueado: number;
  readonly mejorPiso: number;
  readonly muertes: number;
  readonly victorias: number;
  readonly enDescenso: number | null;
  readonly actualizada: number;
}

const clave = (i: number): string => `ecos.ranura.${i}`;
const CLAVE_META_VIEJA = "ecos.meta.v1";
const CLAVE_DESCENSO_VIEJA = "ecos.descenso.v1";
const CLAVE_MIGRADO = "ecos.migrado.v2";

function leer<T>(k: string): T | null {
  try {
    const crudo = localStorage.getItem(k);
    return crudo === null ? null : (JSON.parse(crudo) as T);
  } catch {
    return null;
  }
}

function escribir(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Sin almacenamiento (modo privado): se juega igual, sin guardar.
  }
}

/** Meta con los campos que falten completados (guardados de versiones anteriores). */
export function metaDesde(datos: DatosMeta | null | undefined): Meta {
  if (datos === null || datos === undefined || datos.version !== 1) return Meta.nueva();
  const base = Meta.nueva().serializar();
  return new Meta({ ...base, ...datos, registro: { ...base.registro, ...datos.registro } });
}

export function cargarRanura(i: number): DatosRanura | null {
  const d = leer<DatosRanura>(clave(i));
  return d !== null && d.version === 2 ? d : null;
}

export function guardarRanura(i: number, d: Omit<DatosRanura, "version" | "actualizada">): void {
  escribir(clave(i), { ...d, version: 2, actualizada: Date.now() });
}

export function resumenRanuras(): (ResumenRanura | null)[] {
  return Array.from({ length: CANTIDAD_RANURAS }, (_, i) => {
    const d = cargarRanura(i);
    if (d === null) return null;
    const personaje = d.descenso?.partida ?? d.personaje;
    return {
      indice: i,
      nombre: d.nombre,
      nivel: personaje !== null ? nivelAproximado(personaje.experiencia) : null,
      pisoDesbloqueado: personaje?.pisoDesbloqueado ?? 1,
      mejorPiso: d.meta.registro?.mejorPiso ?? 0,
      muertes: d.meta.registro?.muertes ?? 0,
      victorias: d.meta.registro?.victorias ?? 0,
      enDescenso: d.descenso !== null ? d.descenso.partida.piso : null,
      actualizada: d.actualizada,
    };
  });
}

/** Nivel a partir de la experiencia (misma curva que Partida, sin instanciarla). */
function nivelAproximado(exp: number): number {
  let total = 0;
  for (let n = 1; n < 40; n++) {
    total += Math.max(1, Math.round(26 * Math.pow(n, 1.45)));
    if (exp < total) return n;
  }
  return 40;
}

/** Pasa el guardado de una sola partida (versión anterior) a la ranura 1. No borra las claves viejas. */
export function migrarGuardadoViejo(): void {
  try {
    if (localStorage.getItem(CLAVE_MIGRADO) !== null) return;
    const meta = leer<DatosMeta>(CLAVE_META_VIEJA);
    const descenso = leer<DatosDescenso>(CLAVE_DESCENSO_VIEJA);
    if ((meta !== null || descenso !== null) && cargarRanura(0) === null) {
      guardarRanura(0, {
        nombre: "Portador",
        creada: Date.now(),
        meta: meta ?? Meta.nueva().serializar(),
        personaje: descenso?.version === 1 ? descenso.partida : null,
        banco: null,
        descenso: descenso?.version === 1 ? descenso : null,
      });
    }
    localStorage.setItem(CLAVE_MIGRADO, "1");
  } catch {
    // ignorado
  }
}
