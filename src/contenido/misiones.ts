// Tablón de misiones de la taberna (minialu/RegistroMisiones, como las 129 misiones encadenadas de MiniFighter).
// Una cadena principal que acompaña el descenso + encargos repetibles. Máximo 3 activas.
// El juego registra eventos: "matar", "elite", "jefe" (objetivo = piso), "cofre", "vela", "fusionar", "refinar", "eco".

import type { DefinicionMision } from "minialu";
import { MAT_FRAGMENTO, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO } from "./objetos.ts";

export interface InfoMision {
  readonly titulo: string;
  readonly descripcion: string;
  /** Texto de cada objetivo, en el mismo orden. */
  readonly objetivos: readonly string[];
}

const jefe = (piso: number, id: number, requiere: number | undefined, esquirlas: number, extra: DefinicionMision["recompensa"]["objetos"] = []): DefinicionMision => ({
  id, requiere, objetivos: [{ tipo: "jefe", objetivo: piso, cantidad: 1 }],
  recompensa: { exp: 60 * piso, monedas: { esquirlas, esencia: 10 * piso }, objetos: extra },
});

export const MISIONES: readonly DefinicionMision[] = [
  { id: 1, objetivos: [{ tipo: "matar", objetivo: -1, cantidad: 15 }], recompensa: { exp: 40, monedas: { esquirlas: 120 }, objetos: [{ objeto: OBJ_POCION, cantidad: 2 }] } },
  jefe(1, 2, 1, 250, [{ objeto: OBJ_POLVO, cantidad: 2 }]),
  { id: 3, requiere: 2, objetivos: [{ tipo: "cofre", objetivo: -1, cantidad: 3 }, { tipo: "vela", objetivo: -1, cantidad: 10 }], recompensa: { exp: 80, monedas: { esquirlas: 200 }, objetos: [{ objeto: OBJ_LAGRIMA, cantidad: 1 }] } },
  jefe(2, 4, 3, 400),
  { id: 5, requiere: 4, objetivos: [{ tipo: "fusionar", objetivo: -1, cantidad: 2 }], recompensa: { exp: 120, monedas: { esquirlas: 300 }, objetos: [{ objeto: OBJ_POLVO, cantidad: 3 }] } },
  jefe(3, 6, 5, 600, [{ objeto: MAT_FRAGMENTO, cantidad: 4 }]),
  { id: 7, requiere: 6, objetivos: [{ tipo: "elite", objetivo: -1, cantidad: 6 }], recompensa: { exp: 200, monedas: { esquirlas: 500 } } },
  jefe(4, 8, 7, 800),
  jefe(5, 9, 8, 1000, [{ objeto: OBJ_LAGRIMA, cantidad: 1 }]),
  { id: 10, requiere: 9, objetivos: [{ tipo: "refinar", objetivo: -1, cantidad: 3 }], recompensa: { exp: 300, monedas: { esquirlas: 700 }, objetos: [{ objeto: MAT_FRAGMENTO, cantidad: 6 }] } },
  jefe(6, 11, 10, 1300),
  jefe(7, 12, 11, 1600, [{ objeto: OBJ_LAGRIMA, cantidad: 2 }]),
  jefe(8, 13, 12, 2000),
  jefe(9, 14, 13, 2500, [{ objeto: OBJ_POLVO, cantidad: 6 }]),
  jefe(10, 15, 14, 5000),
  // Encargos repetibles
  { id: 100, repetible: true, objetivos: [{ tipo: "matar", objetivo: -1, cantidad: 40 }], recompensa: { exp: 120, monedas: { esquirlas: 260 } } },
  { id: 101, repetible: true, objetivos: [{ tipo: "elite", objetivo: -1, cantidad: 4 }], recompensa: { exp: 150, monedas: { esquirlas: 200 }, objetos: [{ objeto: MAT_FRAGMENTO, cantidad: 3 }] } },
  { id: 102, repetible: true, objetivos: [{ tipo: "vela", objetivo: -1, cantidad: 25 }, { tipo: "cofre", objetivo: -1, cantidad: 2 }], recompensa: { exp: 100, monedas: { esquirlas: 180 }, objetos: [{ objeto: OBJ_POLVO, cantidad: 2 }] } },
  { id: 103, repetible: true, objetivos: [{ tipo: "eco", objetivo: -1, cantidad: 1 }], recompensa: { exp: 250, monedas: { esquirlas: 400, esencia: 30 } } },
];

const piso = (n: number): string => `Vence al guardián del piso ${n}`;

export const INFO_MISIONES: Readonly<Record<number, InfoMision>> = {
  1: { titulo: "Primera sangre", descripcion: "La tabernera quiere saber si sobrevivís al primer tramo.", objetivos: ["Derrota 15 criaturas"] },
  2: { titulo: "La puerta del Osario", descripcion: "Alguien tiene que cerrar al que Cierra la Puerta.", objetivos: [piso(1)] },
  3: { titulo: "Velas y cofres", descripcion: "El mercader paga bien por lo que se encuentra abajo.", objetivos: ["Abre 3 cofres", "Rompe 10 velas"] },
  4: { titulo: "Raíces que recuerdan", descripcion: "La Madre Micelio florece sobre nuestros muertos.", objetivos: [piso(2)] },
  5: { titulo: "Tres almas, una voz", descripcion: "Aprendé a fusionar en el Altar.", objetivos: ["Fusiona 2 veces"] },
  6: { titulo: "El fuego que espera", descripcion: "La Fragua Viviente no se apagó nunca.", objetivos: [piso(3)] },
  7: { titulo: "Cazador de élites", descripcion: "Los que brillan dorado esconden lo mejor.", objetivos: ["Derrota 6 élites"] },
  8: { titulo: "El río detenido", descripcion: "La Reina del Invierno Callado no deja pasar a nadie.", objetivos: [piso(4)] },
  9: { titulo: "La ciudad que bebió", descripcion: "Algo enorme nada entre las ruinas.", objetivos: [piso(5)] },
  10: { titulo: "Acero templado", descripcion: "El herrero quiere ver tu trabajo.", objetivos: ["Refina 3 veces"] },
  11: { titulo: "El último índice", descripcion: "El Archivista guarda los nombres que ardieron.", objetivos: [piso(6)] },
  12: { titulo: "Flor de herida", descripcion: "La Rosa Carnívora huele a nosotros.", objetivos: [piso(7)] },
  13: { titulo: "La máquina que gira", descripcion: "Hay que detener al Autómata Coloso.", objetivos: [piso(8)] },
  14: { titulo: "Estrellas caídas", descripcion: "El Astrónomo Muerto contó demasiadas.", objetivos: [piso(9)] },
  15: { titulo: "El Corazón del Pozo", descripcion: "Que el Pozo deje de recordar.", objetivos: [piso(10)] },
  100: { titulo: "Encargo: limpieza", descripcion: "Repetible. Menos criaturas, menos pesadillas.", objetivos: ["Derrota 40 criaturas"] },
  101: { titulo: "Encargo: trofeos dorados", descripcion: "Repetible. Las élites dejan fragmentos de eco.", objetivos: ["Derrota 4 élites"] },
  102: { titulo: "Encargo: luz para el pueblo", descripcion: "Repetible. Traé lo que encuentres.", objetivos: ["Rompe 25 velas", "Abre 2 cofres"] },
  103: { titulo: "Encargo: silenciar un eco", descripcion: "Repetible. Vencé a uno de tus propios ecos.", objetivos: ["Vence a un Eco"] },
};

export function mision(id: number): DefinicionMision | undefined {
  return MISIONES.find((m) => m.id === id);
}

export const MAX_MISIONES_ACTIVAS = 3;
