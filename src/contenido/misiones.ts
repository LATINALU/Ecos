// Tablón de misiones de la taberna (minialu/RegistroMisiones, como las 129 misiones encadenadas de MiniFighter).
// 120 misiones: 10 por zona (3 líneas en paralelo + el guardián) y 2 encargos repetibles por zona. Máximo 3 activas.
//
//   Zona N (ids N·1000 + k; no chocan con los ids del tablón viejo, que se descartan al cargar):
//     Exploración  k=1 → 2 → 3 ─┐
//     Combate      k=4 → 5 → 6  ├─ k=10: vencer al guardián (requiere k=3)
//     Alma         k=7 → 8 → 9 ─┘
//     Encargos     k=50, 51 (repetibles, se abren al entregar k=1)
//   Las líneas de la zona N se abren al entregar el guardián de la zona N−1.
//
// Eventos que registra el juego (objetivo = piso cuando corresponde, -1 = cualquiera):
//   "matar", "elite", "vela", "cofre", "extraer", "jefe", "eco" (por piso)
//   "rango" (combo en rango S o más), "habilidad", "definitiva", "fusionar", "refinar", "mejorar".
//   "arena" (desafío superado, por piso), "intocable" (desafío sin recibir golpes).

import type { DefinicionMision, RecompensaMision } from "minialu";
import { MAT_FRAGMENTO, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO } from "./objetos.ts";

export interface InfoMision {
  readonly titulo: string;
  readonly descripcion: string;
  /** Texto de cada objetivo, en el mismo orden. */
  readonly objetivos: readonly string[];
  /** Zona (1-10) y línea, para agrupar en el tablón. */
  readonly zona: number;
  readonly linea: "exploracion" | "combate" | "alma" | "guardian" | "encargo";
}

interface Zona {
  readonly nombre: string;
  readonly jefe: string;
  /** Cómo se llama a sus criaturas en los títulos. */
  readonly criaturas: string;
  readonly luz: string;
  readonly frase: string;
  /** Misión especial de la línea del alma (k=9). */
  readonly especial: readonly [tipo: string, cantidad: number, texto: string];
}

const ZONAS: readonly Zona[] = [
  { nombre: "Osario Hundido", jefe: "Guardián del Osario", criaturas: "huesos inquietos", luz: "Velas de hueso", frase: "Aquí los muertos discuten quién cayó primero.", especial: ["mejorar", 1, "Mejora una carta con Polvo de Eco"] },
  { nombre: "Bosque Micelio", jefe: "Madre Micelio", criaturas: "esporas andantes", luz: "Linternas de hongo", frase: "Las esporas recuerdan cada paso.", especial: ["fusionar", 1, "Fusiona cartas en el Altar"] },
  { nombre: "Forja Ahogada", jefe: "Fragua Viviente", criaturas: "autómatas rotos", luz: "Brasas dormidas", frase: "El fuego aprendió a esperar.", especial: ["refinar", 2, "Refina equipo 2 veces"] },
  { nombre: "Catacumbas de Escarcha", jefe: "Reina del Invierno Callado", criaturas: "momias heladas", luz: "Cirios de escarcha", frase: "El frío conserva. A veces, demasiado.", especial: ["mejorar", 3, "Mejora cartas 3 veces"] },
  { nombre: "Ciudad Sumergida", jefe: "Leviatán de Cripta", criaturas: "ahogados", luz: "Faroles hundidos", frase: "Una ciudad entera bebió el río.", especial: ["fusionar", 2, "Fusiona cartas 2 veces"] },
  { nombre: "Biblioteca de Ceniza", jefe: "Archivista Quemado", criaturas: "páginas vivas", luz: "Lámparas de lectura", frase: "Cada nombre que ardió sigue aquí.", especial: ["refinar", 3, "Refina equipo 3 veces"] },
  { nombre: "Jardín de Espinas", jefe: "Rosa Carnívora", criaturas: "flores con dientes", luz: "Farolillos de savia", frase: "Todo lo que florece aquí tiene hambre.", especial: ["eco", 1, "Vence a uno de tus Ecos"] },
  { nombre: "Engranaje Olvidado", jefe: "Autómata Coloso", criaturas: "engranajes sueltos", luz: "Lámparas de aceite", frase: "La máquina sigue girando sin nadie.", especial: ["mejorar", 4, "Mejora cartas 4 veces"] },
  { nombre: "Necrópolis Estelar", jefe: "Astrónomo Muerto", criaturas: "astros caídos", luz: "Faros estelares", frase: "Alguien contó demasiadas estrellas.", especial: ["fusionar", 3, "Fusiona cartas 3 veces"] },
  { nombre: "Corazón del Pozo", jefe: "El Que Recuerda", criaturas: "recuerdos", luz: "Latidos de luz", frase: "Que el Pozo deje de recordar.", especial: ["eco", 2, "Vence a 2 de tus Ecos"] },
];

export const TOTAL_ZONAS_MISION = ZONAS.length;

const MISIONES_LISTA: DefinicionMision[] = [];
const INFO: Record<number, InfoMision> = {};

function premio(n: number, base: number, objetos: RecompensaMision["objetos"] = [], esencia = 0): RecompensaMision {
  return {
    exp: Math.round(base * (0.6 + n * 0.55)),
    monedas: { esquirlas: Math.round(base * 2.2 * (0.7 + n * 0.6)), ...(esencia > 0 ? { esencia } : {}) },
    objetos,
  };
}

function agregar(def: DefinicionMision, info: InfoMision): void {
  MISIONES_LISTA.push(def);
  INFO[def.id] = info;
}

ZONAS.forEach((z, i) => {
  const n = i + 1;
  const base = n * 1000;
  const abre = n === 1 ? undefined : (n - 1) * 1000 + 10;
  const o = (tipo: string, cantidad: number, objetivo = n): DefinicionMision["objetivos"][number] => ({ tipo, objetivo, cantidad });
  const zona = (t: string): InfoMision["linea"] => t as InfoMision["linea"];
  const m = (k: number, requiere: number | undefined, objetivos: DefinicionMision["objetivos"], recompensa: RecompensaMision,
    titulo: string, descripcion: string, textos: string[], linea: string): void => {
    agregar({ id: base + k, requiere, objetivos, recompensa }, { titulo, descripcion, objetivos: textos, zona: n, linea: zona(linea) });
  };
  const matar = 10 + n * 4;
  // ---- Exploración
  m(1, abre, [o("matar", matar)], premio(n, 40, [{ objeto: OBJ_POCION, cantidad: 1 }]),
    `${z.nombre}: primeros pasos`, z.frase, [`Derrota ${matar} criaturas en el piso ${n}`], "exploracion");
  m(2, base + 1, [o("vela", 8 + n * 2), o("cofre", 1)], premio(n, 50, [{ objeto: OBJ_ETER, cantidad: 1 }]),
    `${z.luz}`, `El mercader paga por lo que brilla en ${z.nombre}.`, [`Rompe ${8 + n * 2} velas en el piso ${n}`, `Abre un cofre en el piso ${n}`], "exploracion");
  m(3, base + 2, [o("extraer", 1)], premio(n, 70, [{ objeto: OBJ_POLVO, cantidad: 1 }]),
    `Volver de ${z.nombre}`, "De nada sirve el botín si no vuelves con él.", [`Extrae desde el piso ${n}`], "exploracion");
  // ---- Combate
  const elites = 2 + Math.floor(n / 2);
  m(4, abre, [o("elite", elites)], premio(n, 55, [{ objeto: MAT_FRAGMENTO, cantidad: 1 + Math.floor(n / 3) }]),
    `Los dorados de ${z.nombre}`, `Las élites de ${z.criaturas} esconden lo mejor.`, [`Derrota ${elites} élites en el piso ${n}`], "combate");
  m(5, base + 4, [o("rango", 2 + Math.floor(n / 3), -1)], premio(n, 60),
    `Danza en ${z.nombre}`, "Ilse quiere historias de combates dignos de canción.", [`Lleva el combo a rango S ${2 + Math.floor(n / 3)} veces`], "combate");
  m(6, base + 5, [o("matar", matar * 2), o("elite", 1)], premio(n, 80, [{ objeto: OBJ_POCION, cantidad: 2 }]),
    `Limpieza de ${z.criaturas}`, "Menos criaturas, menos pesadillas en el pueblo.", [`Derrota ${matar * 2} criaturas en el piso ${n}`, `Derrota una élite en el piso ${n}`], "combate");
  // ---- Alma
  const usos = 12 + n * 3;
  m(7, abre, [o("habilidad", usos, -1)], premio(n, 50, [{ objeto: OBJ_ETER, cantidad: 1 }]),
    `Voces del alma (${z.nombre})`, "Las cartas hablan cuando las usas.", [`Usa habilidades de alma ${usos} veces`], "alma");
  const defin = 1 + Math.floor(n / 3);
  m(8, base + 7, [o("definitiva", defin, -1)], premio(n, 70, [{ objeto: OBJ_POLVO, cantidad: 1 + Math.floor(n / 4) }]),
    `El grito definitivo`, "Hay recuerdos que solo despiertan con toda tu fuerza.", [`Usa tu Definitiva ${defin} ${defin === 1 ? "vez" : "veces"}`], "alma");
  const [tipoEsp, cantEsp, textoEsp] = z.especial;
  m(9, base + 8, [o(tipoEsp, cantEsp, -1)], premio(n, 90, [{ objeto: n >= 5 ? OBJ_LAGRIMA : OBJ_POLVO, cantidad: 1 }], 5 * n),
    `Ofrenda de ${z.nombre}`, "La Hermana Ceniza pide una prueba de tu vínculo con las almas.", [textoEsp], "alma");
  // ---- Guardián
  m(10, base + 3, [o("jefe", 1)], premio(n, 140, [{ objeto: OBJ_POLVO, cantidad: 2 }, { objeto: MAT_FRAGMENTO, cantidad: 2 + n }], 10 * n),
    `${z.jefe}`, `Alguien tiene que detener a ${z.jefe}.`, [`Vence al guardián del piso ${n}`], "guardian");
  // ---- Encargos repetibles
  agregar({ id: base + 50, requiere: base + 1, repetible: true, objetivos: [o("matar", 30 + n * 5)], recompensa: premio(n, 45) },
    { titulo: `Encargo: ${z.criaturas}`, descripcion: "Repetible.", objetivos: [`Derrota ${30 + n * 5} criaturas en el piso ${n}`], zona: n, linea: "encargo" });
  agregar({ id: base + 51, requiere: base + 1, repetible: true, objetivos: [o("extraer", 1), o("cofre", 2)], recompensa: premio(n, 65, [{ objeto: OBJ_POCION, cantidad: 1 }]) },
    { titulo: `Encargo: botín de ${z.nombre}`, descripcion: "Repetible. Trae el botín vivo.", objetivos: [`Extrae desde el piso ${n}`, `Abre 2 cofres en el piso ${n}`], zona: n, linea: "encargo" });
  agregar({ id: base + 52, requiere: base + 1, repetible: true, objetivos: [o("arena", 1 + Math.floor(n / 4))], recompensa: premio(n, 75, [{ objeto: MAT_FRAGMENTO, cantidad: 1 + Math.floor(n / 3) }]) },
    { titulo: `Encargo: la campana de ${z.nombre}`, descripcion: "Repetible. Ilse paga por cada historia de arena.", objetivos: [`Supera ${1 + Math.floor(n / 4)} desafío(s) en el piso ${n}`], zona: n, linea: "encargo" });
  if (n >= 3) {
    m(11, base + 6, [o("intocable", 1, -1)], premio(n, 110, [{ objeto: OBJ_POLVO, cantidad: 2 }], 5 * n),
      `Sin un rasguño`, "Dicen que hay Portadores que salen de la arena sin una gota de sangre.", ["Supera un desafío sin recibir golpes"], "combate");
  }
});

export const MISIONES: readonly DefinicionMision[] = MISIONES_LISTA;
export const INFO_MISIONES: Readonly<Record<number, InfoMision>> = INFO;

const POR_ID = new Map(MISIONES_LISTA.map((d) => [d.id, d]));

export function mision(id: number): DefinicionMision | undefined {
  return POR_ID.get(id);
}

export const MAX_MISIONES_ACTIVAS = 3;
