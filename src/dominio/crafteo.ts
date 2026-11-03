// Crafteo en el Yunque. Regla de minialu: "todo o nada". Primero se simula sobre una copia de la mochila
// (Inventario.clonar): se quitan los ingredientes y se prueba que el resultado entre. Solo si todo sale bien
// se aplica de verdad y se cobran las esquirlas.

import { exito, fallo, type Resultado } from "minialu";
import {
  COSTO_FUSION_RUNA, MAT_FRAGMENTO, NOMBRES_RAREZA_RUNA, OBJ_CARTA, RAREZA_RUNA_MAX, apilable, objetoRuna, runaDeObjeto,
} from "../contenido/objetos.ts";
import { REFINADO_MAX, type Receta } from "../contenido/recetas.ts";
import { NIVEL_ELECCION_TEMPLADO, costoTemplado, tirarPacto, type DefPacto, type ModoTemplado } from "./templado.ts";
import { RAREZA_CARTA_JEFE, cartaAleatoria, nombreCarta } from "./cartas.ts";
import { crearUnico, generarEquipo, refinar, type ObjetoEquipo } from "./equipo.ts";
import type { Partida } from "./partida.ts";
import type { Ranura } from "./tipos.ts";

export type ErrorCrafteo = "faltan-materiales" | "sin-fondos" | "sin-espacio" | "nada-que-refinar" | "al-maximo" | "elige-templado";

export function faltantes(p: Partida, receta: Receta): { objeto: number; nombre: string; faltan: number }[] {
  return receta.ingredientes
    .map(([objeto, cantidad]) => ({ objeto, nombre: apilable(objeto)?.nombre ?? `#${objeto}`, faltan: cantidad - p.mochila.contar(objeto) }))
    .filter((f) => f.faltan > 0);
}

export function puedeCraftear(p: Partida, receta: Receta): boolean {
  return faltantes(p, receta).length === 0 && p.esquirlas >= receta.esquirlas;
}

export function craftear(p: Partida, receta: Receta): Resultado<string, ErrorCrafteo> {
  if (faltantes(p, receta).length > 0) return fallo("faltan-materiales");
  if (p.esquirlas < receta.esquirlas) return fallo("sin-fondos");

  const prueba = p.mochila.clonar();
  for (const [objeto, cantidad] of receta.ingredientes) {
    if (!prueba.quitar(objeto, cantidad).ok) return fallo("faltan-materiales");
  }
  const r = receta.resultado;
  let equipo: ObjetoEquipo | undefined;
  switch (r.tipo) {
    case "objeto":
      if (!prueba.agregar(r.objeto, r.cantidad).ok) return fallo("sin-espacio");
      break;
    case "equipo":
      equipo = generarEquipo(p.azar, p.piso, r.minima, r.ranura);
      if (!prueba.agregar(equipo.base, 1, { equipo }).ok) return fallo("sin-espacio");
      break;
    case "carta":
      if (p.mazo.casillasLibres() < 1) return fallo("sin-espacio");
      break;
  }

  // Aplicar de verdad.
  for (const [objeto, cantidad] of receta.ingredientes) p.mochila.quitar(objeto, cantidad);
  p.billetera.debitar("esquirlas", receta.esquirlas);
  switch (r.tipo) {
    case "objeto":
      p.mochila.agregar(r.objeto, r.cantidad);
      return exito(`${apilable(r.objeto)?.nombre ?? "Objeto"} ×${r.cantidad}`);
    case "equipo":
      p.mochila.agregar(equipo!.base, 1, { equipo: equipo! });
      return exito(equipo!.nombre);
    case "carta": {
      const carta = cartaAleatoria(p.azar, RAREZA_CARTA_JEFE[Math.max(0, Math.min(p.piso - 1, RAREZA_CARTA_JEFE.length - 1))]);
      p.mazo.agregar(OBJ_CARTA, 1, { carta });
      return exito(`Carta: ${nombreCarta(carta)}`);
    }
  }
}

/** Refina la pieza equipada en esa ranura (+12 % a sus stats). */
/**
 * Templado (refinado) de lo equipado: NUNCA falla. Hasta +5 es "normal"; del +6 al +10 hay que elegir
 * Templado Seguro (caro) o Templado Abisal (barato, sella un pacto: bono salvaje + maldición).
 */
export function refinarEquipado(
  p: Partida, ranura: Ranura, modo: ModoTemplado = "normal",
): Resultado<ObjetoEquipo & { readonly pactoNuevo?: DefPacto }, ErrorCrafteo> {
  const o = p.equipo[ranura];
  if (o === null) return fallo("nada-que-refinar");
  const nivel = o.refinado ?? 0;
  if (nivel >= REFINADO_MAX) return fallo("al-maximo");
  if (nivel >= NIVEL_ELECCION_TEMPLADO && modo === "normal") return fallo("elige-templado");
  const costo = costoTemplado(nivel, modo);
  if (p.mochila.contar(MAT_FRAGMENTO) < costo.fragmentos) return fallo("faltan-materiales");
  if (p.esquirlas < costo.esquirlas) return fallo("sin-fondos");
  p.mochila.quitar(MAT_FRAGMENTO, costo.fragmentos);
  p.billetera.debitar("esquirlas", costo.esquirlas);
  let nuevo = refinar(o);
  let pactoNuevo: DefPacto | undefined;
  if (modo === "abisal" && nivel >= NIVEL_ELECCION_TEMPLADO) {
    pactoNuevo = tirarPacto(p.azar, o.pactos ?? []);
    nuevo = { ...nuevo, pactos: [...(o.pactos ?? []), pactoNuevo.id] };
  }
  p.equipo[ranura] = nuevo;
  p.registrarMision("refinar");
  return exito(pactoNuevo !== undefined ? { ...nuevo, pactoNuevo } : nuevo);
}

/**
 * Fusión de runas en el Yunque: tres runas iguales de la misma rareza se funden en una de la rareza siguiente
 * (Común → Rara → Épica → Legendaria). Cuesta esquirlas.
 */
export function fusionarRunas(p: Partida, objeto: number): Resultado<string, "no-es-runa" | "faltan-runas" | "al-maximo" | "sin-fondos"> {
  const ru = runaDeObjeto(objeto);
  if (ru === undefined) return fallo("no-es-runa");
  if (ru.nivel >= RAREZA_RUNA_MAX) return fallo("al-maximo");
  if (p.mochila.contar(objeto) < 3) return fallo("faltan-runas");
  const costo = COSTO_FUSION_RUNA[ru.nivel];
  if (p.esquirlas < costo) return fallo("sin-fondos");
  p.billetera.debitar("esquirlas", costo);
  p.mochila.quitar(objeto, 3);
  const nueva = objetoRuna(ru.id, ru.nivel + 1);
  p.mochila.agregar(nueva, 1);
  return exito(`${ru.nombre} · ${NOMBRES_RAREZA_RUNA[ru.nivel + 1]}`);
}

/** Costo de la Forja Mítica (Dorn, tras recuperar su martillo). */
export const COSTO_FORJA_MITICA = { fragmentos: 6, esquirlas: 2500 } as const;

/** Forja Mítica: una pieza Mítica con nombre. Solo si Dorn recuperó su martillo. */
export function forjaMitica(p: Partida): Resultado<ObjetoEquipo, ErrorCrafteo | "sin-martillo"> {
  if (!p.historiaCumplida("dorn")) return fallo("sin-martillo");
  if (p.mochila.contar(MAT_FRAGMENTO) < COSTO_FORJA_MITICA.fragmentos) return fallo("faltan-materiales");
  if (p.esquirlas < COSTO_FORJA_MITICA.esquirlas) return fallo("sin-fondos");
  const o = crearUnico(p.azar, Math.max(p.pisoDesbloqueado, 8));
  if (!p.recoger({ tipo: "equipo", equipo: o }).ok) return fallo("sin-espacio");
  p.mochila.quitar(MAT_FRAGMENTO, COSTO_FORJA_MITICA.fragmentos);
  p.billetera.debitar("esquirlas", COSTO_FORJA_MITICA.esquirlas);
  return exito(o);
}
