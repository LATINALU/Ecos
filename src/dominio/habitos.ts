// HÁBITOS: cómo jugó el Portador en un descenso, resumido en un vector de 0 a 1.
// Al morir se guarda en el Eco, y el Eco PELEA COMO PELEABAS: si eras un arquero que se mantenía lejos, te hará
// kiting por la sala; si vivías en el aire, te caerá encima; si esquivabas a último momento, te esquivará a ti.

import type { EstiloArma } from "../contenido/objetos.ts";

export interface Habitos {
  /** 0 = siempre pegado al enemigo · 1 = siempre lejos. */
  readonly distancia: number;
  /** Fracción de golpes dados en el aire. */
  readonly aereo: number;
  /** Fracción de golpes que fueron patadas. */
  readonly patada: number;
  /** Uso de habilidades (0 nunca · 1 constante). */
  readonly tecnica: number;
  /** Esquivas perfectas (0 nunca · 1 muy seguido). */
  readonly esquiva: number;
  /** Ritmo de golpes (0 pasivo · 1 frenético). */
  readonly agresividad: number;
  /** Arma con la que más peleó. */
  readonly estilo: EstiloArma;
}

export const HABITOS_NEUTROS: Habitos = { distancia: 0.2, aereo: 0.15, patada: 0.15, tecnica: 0.3, esquiva: 0.1, agresividad: 0.5, estilo: "espada" };

const lim = (x: number): number => Math.max(0, Math.min(1, x));

/** Contadores que el juego va sumando mientras peleas. */
export class RegistroHabitos {
  private golpes = 0;
  private sumaDistancia = 0;
  private aereos = 0;
  private patadas = 0;
  private tecnicas = 0;
  private esquivas = 0;
  private segundosCombate = 0;
  private readonly porEstilo = new Map<EstiloArma, number>();

  golpe(distancia: number, enAire: boolean, tipo: "golpe" | "patada" | "tecnica", estilo: EstiloArma): void {
    this.golpes++;
    this.sumaDistancia += distancia;
    if (enAire) this.aereos++;
    if (tipo === "patada") this.patadas++;
    this.porEstilo.set(estilo, (this.porEstilo.get(estilo) ?? 0) + 1);
  }

  tecnica(): void {
    this.tecnicas++;
  }

  esquiva(): void {
    this.esquivas++;
  }

  /** Tiempo con enemigos en la sala (para medir ritmos por minuto). */
  combate(dt: number): void {
    this.segundosCombate += dt;
  }

  vector(): Habitos {
    if (this.golpes < 8) return HABITOS_NEUTROS;
    const minutos = Math.max(0.5, this.segundosCombate / 60);
    let estilo: EstiloArma = "espada";
    let max = -1;
    for (const [e, n] of this.porEstilo) if (n > max) [estilo, max] = [e, n];
    return {
      distancia: lim((this.sumaDistancia / this.golpes - 30) / 130),
      aereo: lim(this.aereos / this.golpes),
      patada: lim(this.patadas / this.golpes),
      tecnica: lim(this.tecnicas / minutos / 8),
      esquiva: lim(this.esquivas / minutos / 3),
      agresividad: lim(this.golpes / minutos / 45),
      estilo,
    };
  }
}

/** Descripción corta del estilo de pelea (para el título del Eco). */
export function perfilHabitos(h: Habitos): string {
  const rasgos: string[] = [];
  if (h.distancia > 0.55 || h.estilo === "arco") rasgos.push("acecha desde lejos");
  else if (h.distancia < 0.15) rasgos.push("pelea pegado");
  if (h.aereo > 0.35) rasgos.push("ataca desde el aire");
  if (h.esquiva > 0.3) rasgos.push("esquiva al último instante");
  if (h.patada > 0.25) rasgos.push("patea sin piedad");
  if (h.tecnica > 0.5) rasgos.push("abusa de sus habilidades");
  if (h.agresividad > 0.7) rasgos.push("no da respiro");
  else if (h.agresividad < 0.25) rasgos.push("espera tu error");
  return rasgos.length === 0 ? "pelea como tú" : rasgos.slice(0, 3).join(", ");
}
