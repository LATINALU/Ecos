// HISTORIAS DE ÚLTIMO REFUGIO: cada habitante tiene un pasado atado al Pozo.
//
// Hablar con ellos (↑ en el pueblo) cuenta su historia. Cuatro tienen una MISIÓN PERSONAL: en un piso concreto
// vaga el Eco de alguien que perdieron (o el suyo propio, de joven). Hay que bajar, vencerlo y traer su RECUERDO
// (un objeto que se pierde si mueres con él encima). Al entregarlo, el habitante desbloquea algo permanente.

import { OBJ_RECUERDO_BASE } from "./objetos.ts";
import type { Habitos } from "../dominio/habitos.ts";

export type IdHistoria = "dorn" | "ceniza" | "ilse" | "vael";

export interface DefHistoria {
  readonly id: IdHistoria;
  /** Servicio del pueblo de quien la cuenta. */
  readonly servicio: string;
  readonly titulo: string;
  /** Lo que cuenta al pedirle la misión. */
  readonly pedido: string;
  readonly piso: number;
  /** El Eco que espera en ese piso. */
  readonly eco: { readonly nombre: string; readonly alma: number; readonly causa: string; readonly habitos: Habitos };
  readonly recuerdo: { readonly objeto: number; readonly nombre: string; readonly descripcion: string; readonly color: string };
  /** Lo que dice al recibir el recuerdo. */
  readonly gracias: string;
  readonly recompensa: string;
}

export const HISTORIAS: readonly DefHistoria[] = [
  {
    id: "dorn", servicio: "herrero", titulo: "El martillo de Dorn",
    pedido: "Yo también fui Portador. Bajé hasta el piso 18 con un martillo que forjé con mis manos; volví sin piernas y sin martillo. "
      + "Dicen que mi Eco todavía lo empuña allá abajo, joven y estúpido como era. Tráemelo y te enseño a forjar lo que solo forjan los muertos.",
    piso: 18,
    eco: { nombre: "Dorn, el Joven", alma: 0, causa: "su propio orgullo", habitos: { distancia: 0.05, aereo: 0.1, patada: 0.35, tecnica: 0.3, esquiva: 0.05, agresividad: 0.85, estilo: "pesada" } },
    recuerdo: { objeto: OBJ_RECUERDO_BASE, nombre: "Martillo de Dorn", descripcion: "Pesa más de lo que debería. Todavía está tibio.", color: "#ff9a3d" },
    gracias: "…Todavía tiene mis iniciales. Siéntate. Te voy a enseñar la Forja Mítica.",
    recompensa: "Forja Mítica: en la Fragua puedes forjar piezas Míticas con nombre.",
  },
  {
    id: "ceniza", servicio: "altar", titulo: "El rosario de mi hermano",
    pedido: "Mi gemelo y yo hicimos los votos juntos. Él bajó; yo me quedé a rezar por los que bajan. Cayó en el piso 9, entre las estrellas muertas. "
      + "Su Eco lleva nuestro rosario. Si me lo devuelves, las almas que fusiones me escucharán mejor.",
    piso: 9,
    eco: { nombre: "Hermano Ascua", alma: 6, causa: "contar demasiadas estrellas", habitos: { distancia: 0.6, aereo: 0.2, patada: 0.05, tecnica: 0.8, esquiva: 0.3, agresividad: 0.4, estilo: "baston" } },
    recuerdo: { objeto: OBJ_RECUERDO_BASE + 1, nombre: "Rosario de Ceniza", descripcion: "Faltan dos cuentas. Las demás todavía están calientes.", color: "#a07cff" },
    gracias: "Lo siento rezar a través de la madera. Desde hoy, las almas me escuchan mejor.",
    recompensa: "Bendición del Rosario: +10 % de probabilidad de éxito en todas las fusiones del Altar.",
  },
  {
    id: "ilse", servicio: "taberna", titulo: "La cinta de Marta",
    pedido: "Marta tenía dieciséis años cuando bajó. Le dije que no. Le dije que no tres veces. Llegó hasta la Ciudad Sumergida, el piso 5. "
      + "Llevaba una cinta roja en el pelo. No te pido que me la traigas a ella. Solo la cinta.",
    piso: 5,
    eco: { nombre: "Marta, la que no Escuchó", alma: 1, causa: "no escuchar a su madre", habitos: { distancia: 0.15, aereo: 0.55, patada: 0.1, tecnica: 0.3, esquiva: 0.5, agresividad: 0.7, estilo: "espada" } },
    recuerdo: { objeto: OBJ_RECUERDO_BASE + 2, nombre: "Cinta de Marta", descripcion: "Una cinta roja, descolorida por el agua.", color: "#ff4d6d" },
    gracias: "…Gracias. Desde hoy, nadie baja de mi taberna con las manos vacías.",
    recompensa: "Brindis de Ilse: cada descenso empiezas con una Poción de Vida y un Frasco de Éter extra.",
  },
  {
    id: "vael", servicio: "banco", titulo: "La llave del juramento",
    pedido: "Un Portador me dejó su cofre y juró volver por él. Hace once años. En el piso 14, en la Fragua de Obsidiana, su Eco sigue buscando "
      + "la llave que perdió. Si la recuperas, cumpliré su juramento contigo: lo que lleves en la mano no lo reclamará el Pozo.",
    piso: 14,
    eco: { nombre: "Ser Odric, el Perjuro", alma: 2, causa: "romper su juramento", habitos: { distancia: 0.3, aereo: 0.05, patada: 0.2, tecnica: 0.5, esquiva: 0.6, agresividad: 0.35, estilo: "espada" } },
    recuerdo: { objeto: OBJ_RECUERDO_BASE + 3, nombre: "Llave del Juramento", descripcion: "Una llave de hierro negro con un nombre limado.", color: "#c9a7ff" },
    gracias: "El juramento está cumplido. Desde hoy, si caes, tu arma vuelve a esta bóveda.",
    recompensa: "Juramento de Vael: si mueres en el Pozo, conservas el arma que llevabas equipada.",
  },
];

export function historia(id: IdHistoria): DefHistoria {
  return HISTORIAS.find((h) => h.id === id)!;
}

export function historiaDe(servicio: string): DefHistoria | undefined {
  return HISTORIAS.find((h) => h.servicio === servicio);
}

/** Lo que cuenta cada habitante de sí mismo (todos tienen pasado, tengan misión o no). */
export const LORE_NPC: Readonly<Record<string, string>> = {
  taberna: "Ilse abrió la taberna con las monedas que su marido dejó antes de bajar. Sirve a los que vuelven y anota en una pizarra a los que no.",
  mercader: "Tobías compra lo que traen los Portadores y vende lo que dejan los muertos. Jura que nunca bajó, pero conoce el piso 3 como su casa.",
  armero: "Brunhild forja para los vivos. Su hermano forjaba para los muertos: era Dorn, antes de que el Pozo le quitara las piernas.",
  banco: "Custodio Vael guarda cofres que nadie reclama. No cobra por guardarlos; cobra por recordarlos.",
  altar: "La Hermana Ceniza reza por los que bajan. Hizo los votos junto a su gemelo; él bajó, ella se quedó.",
  herrero: "Dorn fue Portador. Volvió del piso 18 sin piernas y sin su martillo. Forja sentado y no habla de lo que vio.",
  santuario: "El Ermitaño dice que es el primer Portador que volvió del fondo. Nadie le cree. Nadie lo contradice.",
};
