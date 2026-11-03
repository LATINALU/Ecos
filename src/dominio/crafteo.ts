// Crafteo en el Yunque. Regla de minialu: "todo o nada". Primero se simula sobre una copia de la mochila
// (Inventario.clonar): se quitan los ingredientes y se prueba que el resultado entre. Solo si todo sale bien
// se aplica de verdad y se cobran las esquirlas.

import { exito, fallo, tirar, type Resultado } from "minialu";
import { MAT_FRAGMENTO, OBJ_CARTA, apilable } from "../contenido/objetos.ts";
import { EXITO_REFINADO, REFINADO_MAX, costoRefinado, type Receta } from "../contenido/recetas.ts";
import { RAREZA_CARTA_JEFE, cartaAleatoria, nombreCarta } from "./cartas.ts";
import { generarEquipo, refinar, type ObjetoEquipo } from "./equipo.ts";
import type { Partida } from "./partida.ts";
import type { Ranura } from "./tipos.ts";

export type ErrorCrafteo = "faltan-materiales" | "sin-fondos" | "sin-espacio" | "nada-que-refinar" | "al-maximo" | "fallo-refinado";

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
export function refinarEquipado(p: Partida, ranura: Ranura): Resultado<ObjetoEquipo, ErrorCrafteo> {
  const o = p.equipo[ranura];
  if (o === null) return fallo("nada-que-refinar");
  const nivel = o.refinado ?? 0;
  if (nivel >= REFINADO_MAX) return fallo("al-maximo");
  const costo = costoRefinado(nivel);
  if (p.mochila.contar(MAT_FRAGMENTO) < costo.fragmentos) return fallo("faltan-materiales");
  if (p.esquirlas < costo.esquirlas) return fallo("sin-fondos");
  p.mochila.quitar(MAT_FRAGMENTO, costo.fragmentos);
  p.billetera.debitar("esquirlas", costo.esquirlas);
  // Del +6 en adelante puede fallar: se pierden los materiales, nunca la pieza.
  if (!tirar(p.azar, EXITO_REFINADO[nivel] ?? 0)) return fallo("fallo-refinado");
  const nuevo = refinar(o);
  p.equipo[ranura] = nuevo;
  p.registrarMision("refinar");
  return exito(nuevo);
}
