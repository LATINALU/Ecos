import type { EfectosVivos } from "./efectos-vivos.ts";
import type { DefResonancia } from "../contenido/resonancias.ts";
import type { HabilidadEquipada } from "../dominio/partida.ts";
import type { EstiloArma } from "../contenido/objetos.ts";
// Lo que las entidades pueden pedirle al mundo. Lo implementa Juego; las entidades no se conocen entre sí.

import type { Bioma } from "../contenido/biomas.ts";
import type { Partida } from "../dominio/partida.ts";
import type { Audio } from "../motor/audio.ts";
import type { Tiles } from "../motor/fisica.ts";
import type { Efectos } from "./efectos.ts";
import type { MedidorCombo } from "./medidor-combo.ts";
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
  /** Golpe cuerpo a cuerpo (sostiene en el aire, cuenta para el estilo). */
  readonly cuerpoACuerpo?: boolean;
  /** Efectos elementales de habilidades de alma (cada "hielo" suma una carga de frío). */
  readonly elementos?: readonly ("hielo" | "veneno")[];
  /** Golpe de una Definitiva (no carga la Definitiva). */
  readonly definitiva?: boolean;
  /** Golpe doble de la pasiva (no vuelve a disparar pasivas de golpe). */
  readonly eco?: boolean;
  /** Golpe básico de un arma: aplica las pasivas de ataque de su familia. */
  readonly arma?: EstiloArma;
  /** Último golpe del combo (Sangría). */
  readonly final?: boolean;
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
  /** Cómo se dibuja: "mano" = Mano del Abismo que brota del suelo. */
  forma?: "mano";
}

/** Cadena vertical para trepar entre salas (x del centro; extremos en píxeles; pueden salir de la sala). */
export interface Cadena {
  readonly x: number;
  readonly arriba: number;
  readonly abajo: number;
}

export interface Contexto {
  /** Medidor de estilo (combo); opcional para poder probar al jugador sin el mundo completo. */
  readonly combo?: MedidorCombo;
  /** La cadena de la sala actual, si tiene pasaje vertical. */
  readonly cadena?: Cadena | null;
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
  golpearJugador(ataque: number, desdeX: number, empuje?: number, fuente?: string): void;
  golpearCriatura(c: Criatura, a: AtaqueJugador, dirX: number): boolean;
  /** Golpea todo lo que toque un rectángulo (una vez por criatura por ataque, según `yaGolpeados`). */
  golpearArea(r: { x: number; y: number; w: number; h: number }, a: AtaqueJugador, dirX: number, yaGolpeados: Set<Criatura>): number;
  /** El jugador intentó romper barreras con este rectángulo. */
  tocarBarreras(r: { x: number; y: number; w: number; h: number }, medio: "embestida" | "fuego"): void;
  mensaje(texto: string, color?: string): void;
  /** Efectos vivos (zonas, ecos, acciones programadas) para las mutaciones de habilidad. Opcional en pruebas. */
  readonly vivos?: EfectosVivos;
  /** Dos habilidades resonaron: dispara el efecto combinado (y lo anota en el Códice si es nuevo). */
  resonar?(r: DefResonancia, potencia: number): void;
  /** 12★ Coro de Ecos: cada eco imita la Definitiva. */
  imitarDefinitiva?(h: HabilidadEquipada): void;
}
