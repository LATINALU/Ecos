// Persistencia en localStorage:
//   - Progresión permanente (Meta): reliquias, esencia, Santuario, Ecos, registro.
//   - Descenso en curso: se guarda al cambiar de sala, al entrar a un piso y al cerrar la pestaña.
//     Se borra al morir o al ganar (así no se puede "recargar" para evitar una muerte).

import { Meta, type DatosMeta } from "../dominio/meta.ts";
import type { DatosDescenso } from "../juego/juego.ts";

const CLAVE_META = "ecos.meta.v1";
const CLAVE_DESCENSO = "ecos.descenso.v1";

export function cargarMeta(): Meta {
  try {
    const crudo = localStorage.getItem(CLAVE_META);
    if (crudo === null) return Meta.nueva();
    const datos = JSON.parse(crudo) as DatosMeta;
    if (datos.version !== 1) return Meta.nueva();
    return new Meta({ ...Meta.nueva().serializar(), ...datos, registro: { ...Meta.nueva().serializar().registro, ...datos.registro } });
  } catch {
    return Meta.nueva();
  }
}

export function guardarMeta(meta: Meta): void {
  try {
    localStorage.setItem(CLAVE_META, JSON.stringify(meta.serializar()));
  } catch {
    // Sin almacenamiento (modo privado): se juega igual, sin progresión entre sesiones.
  }
}

export function cargarDescenso(): DatosDescenso | null {
  try {
    const crudo = localStorage.getItem(CLAVE_DESCENSO);
    if (crudo === null) return null;
    const d = JSON.parse(crudo) as DatosDescenso;
    return d.version === 1 && d.partida?.version === 1 ? d : null;
  } catch {
    return null;
  }
}

export function guardarDescenso(d: DatosDescenso): void {
  try {
    localStorage.setItem(CLAVE_DESCENSO, JSON.stringify(d));
  } catch {
    // ignorado: sin almacenamiento no hay "continuar".
  }
}

export function borrarDescenso(): void {
  try {
    localStorage.removeItem(CLAVE_DESCENSO);
  } catch {
    // ignorado
  }
}
