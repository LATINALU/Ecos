// Elementos de las armas. Cualquier estilo (espada, mazo, arco, báculo, puños) puede salir elemental.
// El elemento suma daño extra y un efecto; cada zona resiste uno y es débil a otro (biomas.ts).

export type Elemento = "fuego" | "hielo" | "veneno" | "rayo";

export interface DefElemento {
  readonly id: Elemento;
  readonly nombre: string;
  /** Sufijo del nombre del arma ("Espada Mellada de Fuego"). */
  readonly sufijo: string;
  readonly color: string;
  readonly brillo: string;
  readonly efecto: string;
}

export const ELEMENTOS: Readonly<Record<Elemento, DefElemento>> = {
  fuego: { id: "fuego", nombre: "Fuego", sufijo: "de Fuego", color: "#ff7a3d", brillo: "#ffd27a", efecto: "Quema: daño durante 3 s." },
  hielo: { id: "hielo", nombre: "Hielo", sufijo: "de Hielo", color: "#7fe3ff", brillo: "#ffffff", efecto: "Ralentiza; 4 golpes seguidos congelan 1,2 s." },
  veneno: { id: "veneno", nombre: "Veneno", sufijo: "de Veneno", color: "#9aff5a", brillo: "#e0ffb0", efecto: "Veneno que se acumula (hasta 3 dosis) durante 4 s." },
  rayo: { id: "rayo", nombre: "Rayo", sufijo: "del Rayo", color: "#ffe84a", brillo: "#ffffff", efecto: "30 % de saltar a 2 enemigos cercanos y aturdirlos." },
};

export const ORDEN_ELEMENTOS: readonly Elemento[] = ["fuego", "hielo", "veneno", "rayo"];

/** Daño elemental extra (fracción del golpe) según la rareza del arma. */
export function potenciaElemental(rareza: number): number {
  return 0.2 + rareza * 0.06;
}

/** Multiplicador del efecto elemental contra una zona (resistencia / debilidad). */
export function multiplicadorElemental(e: Elemento, resiste?: Elemento, debil?: Elemento): number {
  return e === resiste ? 0.5 : e === debil ? 1.5 : 1;
}

/** Afinidad de cada zona (piso 1-10): elemento que resiste y al que es débil. */
export const AFINIDAD_ZONA: readonly (readonly [resiste: Elemento, debil: Elemento])[] = [
  ["veneno", "fuego"], // Osario Hundido: hueso seco
  ["veneno", "fuego"], // Bosque Micelio
  ["fuego", "hielo"], // Forja Ahogada
  ["hielo", "fuego"], // Catacumbas de Escarcha
  ["fuego", "rayo"], // Ciudad Sumergida
  ["fuego", "hielo"], // Biblioteca de Ceniza
  ["veneno", "fuego"], // Jardín de Espinas
  ["rayo", "veneno"], // Engranaje Olvidado (no respira... pero se oxida)
  ["hielo", "rayo"], // Necrópolis Estelar
  ["rayo", "hielo"], // Corazón del Pozo
];

export function afinidadPiso(piso: number): readonly [Elemento, Elemento] {
  return AFINIDAD_ZONA[(Math.max(1, piso) - 1) % AFINIDAD_ZONA.length];
}
