// MUTACIONES POR ESTRELLA: las estrellas ya no solo suben números. Al cruzar 5★, 9★ y 12★, cada habilidad
// CAMBIA LO QUE HACE según su forma (proyectil, embestida, onda…). Todas las cartas mutan: la misma regla vale para
// las 48 habilidades del Grimorio, y cada una se ve distinta porque conserva su color, sus efectos y su forma.
//
// Ejemplo (proyectil): 1★–4★ dispara · 5★ donde muere el proyectil queda un ECO tuyo que estalla ·
// 9★ si repites la tecla durante el enfriamiento, te TELETRANSPORTAS al eco cortando todo a tu paso ·
// 12★ al usar tu Definitiva, todos tus ecos la IMITAN.

import type { FormaHabilidad } from "./grimorio.ts";

export interface DefMutacion {
  readonly nombre: string;
  readonly descripcion: string;
}

/** Estrella (en ★) a la que se desbloquea cada mutación. */
export const UMBRALES_MUTACION = [5, 9, 12] as const;

/** Cuántas mutaciones tiene activas una carta de este nivel interno (0 = 1★). */
export function tierMutacion(nivel: number): 0 | 1 | 2 | 3 {
  return nivel >= 11 ? 3 : nivel >= 8 ? 2 : nivel >= 4 ? 1 : 0;
}

const m = (nombre: string, descripcion: string): DefMutacion => ({ nombre, descripcion });

export const MUTACIONES: Readonly<Record<FormaHabilidad, readonly [DefMutacion, DefMutacion, DefMutacion]>> = {
  proyectil: [
    m("Eco", "Donde termina cada proyectil queda un eco tuyo que estalla."),
    m("Paso del Eco", "Repite la tecla durante el enfriamiento: te teletransportas al eco cortando todo a tu paso."),
    m("Coro de Ecos", "Al usar tu Definitiva, cada eco la imita con un estallido propio."),
  ],
  boomerang: [
    m("Eco", "Donde vuelve el arma queda un eco tuyo que estalla."),
    m("Paso del Eco", "Repite la tecla durante el enfriamiento: te teletransportas al eco cortando todo a tu paso."),
    m("Coro de Ecos", "Al usar tu Definitiva, cada eco la imita con un estallido propio."),
  ],
  embestida: [
    m("Estela Cortante", "Dejas una estela que sigue cortando durante un instante."),
    m("Doble Paso", "Puedes encadenar una segunda embestida de inmediato."),
    m("Ruptura", "Al terminar la embestida, una onda expansiva estalla a tu alrededor."),
  ],
  garras: [
    m("Media Luna", "El último zarpazo lanza una media luna que atraviesa."),
    m("Frenesí", "Cada zarpazo te devuelve un poco de vida."),
    m("Mil Garras", "El doble de zarpazos, invulnerable mientras duran."),
  ],
  onda: [
    m("Grietas", "Las ondas abren grietas que siguen dañando."),
    m("Succión", "Antes del golpe, el suelo atrae a los enemigos hacia ti."),
    m("Erupción", "Columnas de energía brotan una tras otra hacia ambos lados."),
  ],
  salto: [
    m("Grieta", "Al caer abres una grieta que sigue dañando."),
    m("Impacto Doble", "La onda de la caída es un 60 % más grande."),
    m("Meteoro", "Caes como un meteoro: onda enorme y columnas alrededor."),
  ],
  rayo: [
    m("Cadena", "Cada rayo salta a un segundo enemigo cercano."),
    m("Columna", "Donde cae el rayo queda una columna de energía."),
    m("Juicio", "El rayo cae sobre todos los enemigos a la vista."),
  ],
  orbita: [
    m("Órbita Mayor", "Las hojas giran más lejos y durante más tiempo."),
    m("Disparo Final", "Al terminar, las hojas salen disparadas hacia afuera."),
    m("Doble Anillo", "Un segundo anillo gira en sentido contrario."),
  ],
  nova: [
    m("Réplica", "Un segundo estallido llega un instante después."),
    m("Gravedad", "Antes de estallar, atrae a los enemigos hacia el centro."),
    m("Singularidad", "Deja un agujero negro que sigue atrayendo y dañando."),
  ],
  lluvia: [
    m("Diluvio", "Cae un 50 % más."),
    m("Suelo en Llamas", "El suelo bajo la lluvia sigue dañando."),
    m("Segunda Oleada", "Una segunda lluvia cae un segundo después."),
  ],
  aura: [
    m("Aura Viva", "Mientras dura, el aura daña a lo que tienes cerca."),
    m("Estallido Final", "Al terminar, el aura estalla."),
    m("Avatar", "El potenciador es el doble de fuerte y empiezas invulnerable."),
  ],
};

export function mutacionesDe(forma: FormaHabilidad): readonly [DefMutacion, DefMutacion, DefMutacion] {
  return MUTACIONES[forma];
}
