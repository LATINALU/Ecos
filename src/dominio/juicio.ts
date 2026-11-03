// EL JUICIO — desafíos de lategame (al estilo de las Míticas+).
//
// Al desbloquear el Pozo Profundo (piso 12), el Portador recibe la PIEDRA DEL JUICIO, con un nivel (+2 al
// empezar). En cualquier Campana del Desafío puede elegir el Juicio en vez de la arena normal:
//   · Los enemigos escalan con el nivel de la piedra (+9 % de vida y daño por nivel).
//   · Hay AFIJOS que se suman con el nivel (+2, +4, +7, +10) y ROTAN CADA SEMANA (semana real del calendario).
//   · Siempre hay contrarreloj. A tiempo, la piedra sube (+1, +2 o +3 según cuánto sobró); tarde, baja 1.
//   · El premio escala con el nivel: cofres mejores y una pieza con la rareza mínima garantizada.

import type { Rareza } from "./equipo.ts";

export type AfijoJuicio =
  | "fortificado" | "tiranico"
  | "reforzado" | "enfurecido" | "sanguino"
  | "volcanico" | "explosivo" | "espectral"
  | "abisal";

export const INFO_AFIJO_JUICIO: Readonly<Record<AfijoJuicio, { nombre: string; descripcion: string; color: string }>> = {
  fortificado: { nombre: "Fortificado", descripcion: "Los enemigos comunes tienen +30 % de vida y hacen +20 % de daño.", color: "#c8a070" },
  tiranico: { nombre: "Tiránico", descripcion: "Las élites y campeones tienen +60 % de vida y hacen +30 % de daño.", color: "#ff6a3d" },
  reforzado: { nombre: "Reforzado", descripcion: "Cuando un enemigo muere, los demás ganan +12 % de vida y daño.", color: "#ffd23d" },
  enfurecido: { nombre: "Enfurecido", descripcion: "Por debajo del 30 % de vida, los enemigos hacen +50 % de daño.", color: "#ff4d4d" },
  sanguino: { nombre: "Sanguino", descripcion: "Al morir, los enemigos dejan un charco de sangre que daña.", color: "#c8243a" },
  volcanico: { nombre: "Volcánico", descripcion: "Cada pocos segundos, la roca erupciona bajo tus pies.", color: "#ff8a3d" },
  explosivo: { nombre: "Explosivo", descripcion: "Al morir, los enemigos estallan tras un instante. Aléjate.", color: "#ffb23d" },
  espectral: { nombre: "Espectral", descripcion: "Entre oleadas, sombras voladoras se unen a la pelea.", color: "#9f7aff" },
  abisal: { nombre: "Abisal", descripcion: "Afijo de temporada (+10): el Pozo te mira. Uno de cada tres enemigos es una élite con afijos.", color: "#b04dff" },
};

/** Nivel con el que se entrega la piedra. */
export const NIVEL_INICIAL_JUICIO = 2;
/** Piso a desbloquear para recibir la piedra (lategame: el Pozo Profundo). */
export const PISO_DESBLOQUEO_JUICIO = 12;

const TIER_1: readonly AfijoJuicio[] = ["fortificado", "tiranico"];
const TIER_2: readonly AfijoJuicio[] = ["reforzado", "enfurecido", "sanguino"];
const TIER_3: readonly AfijoJuicio[] = ["volcanico", "explosivo", "espectral"];

/** Número de semana (desde una fecha fija): define la rotación de afijos, igual para todos. */
export function semanaDe(fecha: Date): number {
  const base = Date.UTC(2026, 0, 5); // un lunes
  return Math.max(0, Math.floor((fecha.getTime() - base) / (7 * 24 * 3600 * 1000)));
}

/** Afijos activos para un nivel de piedra en una semana. */
export function afijosJuicio(nivel: number, semana: number): AfijoJuicio[] {
  const r: AfijoJuicio[] = [];
  if (nivel >= 2) r.push(TIER_1[semana % TIER_1.length]);
  if (nivel >= 4) r.push(TIER_2[semana % TIER_2.length]);
  if (nivel >= 7) r.push(TIER_3[(semana + 1) % TIER_3.length]);
  if (nivel >= 10) r.push("abisal");
  return r;
}

/** Multiplicador de vida y daño de los enemigos por el nivel de la piedra. */
export function escalaJuicio(nivel: number): number {
  return Math.round(Math.pow(1.09, Math.max(0, nivel)) * 100) / 100;
}

/** Tiempo del Juicio para una arena con `oleadas` oleadas. */
export function tiempoJuicio(oleadas: number): number {
  return 50 + oleadas * 20;
}

/** Cuánto sube (o baja) la piedra según el tiempo que sobró. */
export function cambioPiedra(tiempoSobrante: number, tiempoTotal: number): number {
  if (tiempoSobrante <= 0) return -1;
  const f = tiempoSobrante / tiempoTotal;
  return f >= 0.4 ? 3 : f >= 0.2 ? 2 : 1;
}

export interface PremioJuicio {
  readonly cofre: number;
  readonly pieza: Rareza;
  readonly esquirlas: number;
  readonly cambio: number;
}

export function premioJuicio(nivel: number, piso: number, tiempoSobrante: number, tiempoTotal: number): PremioJuicio {
  const cambio = cambioPiedra(tiempoSobrante, tiempoTotal);
  const aTiempo = cambio > 0;
  const pieza = Math.min(5, 2 + Math.floor(nivel / 3) - (aTiempo ? 0 : 1)) as Rareza;
  return {
    cofre: Math.min(3, (aTiempo ? 2 : 1) + Math.floor(nivel / 5)),
    pieza: Math.max(1, pieza) as Rareza,
    esquirlas: Math.round(30 * piso * (1 + nivel * 0.12) * (aTiempo ? 1 : 0.5)),
    cambio,
  };
}

export function nuevoNivelPiedra(nivel: number, cambio: number): number {
  return Math.max(NIVEL_INICIAL_JUICIO, nivel + cambio);
}
