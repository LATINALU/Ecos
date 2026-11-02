// Lo que las entidades pueden pedirle al mundo. Lo implementa Juego; las entidades no se conocen entre sí.

import type { Bioma } from "../contenido/biomas.ts";
import type { Partida } from "../dominio/partida.ts";
import type { Audio } from "../motor/audio.ts";
import type { Tiles } from "../motor/fisica.ts";
import type { Efectos } from "./efectos.ts";
import type { Criatura } from "./entidades/criatura.ts";
import type { Jugador } from "./entidades/jugador.ts";
import type { Proyectil } from "./entidades/proyectil.ts";

export type TipoAtaque = "golpe" | "patada" | "tecnica";

/** Un ataque del jugador ya calculado con sus stats (antes de defensa y crítico). */
export interface AtaqueJugador {
  readonly potencia: number;
  readonly tipo: TipoAtaque;
  readonly empuje: number;
  readonly rompeGuardia?: boolean;
  readonly quema?: boolean;
  readonly ralentiza?: boolean;
  /** Fracción de vida máxima que cura cada impacto (Zarpazo). */
  readonly curaPct?: number;
  /** Éter que se gana al acertar. */
  readonly eter?: number;
  /** Segundos de aturdimiento. */
  readonly aturde?: number;
  /** Lanza al enemigo hacia arriba (golpe ascendente). */
  readonly lanzar?: boolean;
}

/** Zona de peligro anunciada (raíces que brotan, lluvia de huesos): avisa y después daña. */
export interface Peligro {
  x: number;
  y: number;
  w: number;
  h: number;
  aviso: number;
  activo: number;
  danio: number;
  color: string;
  golpeo: boolean;
}

export interface Contexto {
  readonly partida: Partida;
  readonly tiles: Tiles;
  readonly jugador: Jugador;
  readonly fx: Efectos;
  readonly audio: Audio;
  readonly bioma: Bioma;
  readonly piso: number;
  readonly criaturas: readonly Criatura[];
  agregarProyectil(p: Proyectil): void;
  agregarCriatura(c: Criatura): void;
  agregarPeligro(p: Peligro): void;
  /** Daño bruto (ataque del enemigo) al jugador; aplica defensa, invulnerabilidad y efectos. */
  golpearJugador(ataque: number, desdeX: number, empuje?: number): void;
  golpearCriatura(c: Criatura, a: AtaqueJugador, dirX: number): boolean;
  /** Golpea todo lo que toque un rectángulo (una vez por criatura por ataque, según `yaGolpeados`). */
  golpearArea(r: { x: number; y: number; w: number; h: number }, a: AtaqueJugador, dirX: number, yaGolpeados: Set<Criatura>): number;
  /** El jugador intentó romper barreras con este rectángulo. */
  tocarBarreras(r: { x: number; y: number; w: number; h: number }, medio: "embestida" | "fuego"): void;
  mensaje(texto: string, color?: string): void;
}
