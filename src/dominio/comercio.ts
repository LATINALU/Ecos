// Comercio del pueblo. Reglas de minialu (lecciones de la tienda de MiniFighter):
//   - Mercader: catálogo único (Catalogo) y compra todo o nada (comprar): primero se entrega, después se cobra.
//   - Armero: stock de equipo al azar que cambia cada vez que volvés del Pozo (más fuerte cuanto más bajaste).
//   - Venta: consumibles con precioDeVenta (1/10 del precio, como el NPC original); equipo y cartas, por su valor.

import { Catalogo, comprar, elegirUno, exito, fallo, precioDeVenta, type Azar, type ErrorCompra, type Posicion, type Resultado } from "minialu";
import { CONSUMIBLES, MATERIALES, OBJ_CARTA, OBJ_POCION, apilable, runaDeObjeto, type EstiloArma } from "../contenido/objetos.ts";
import { ACCESORIOS, ARMADURAS } from "./tipos.ts";
import { ESTILOS } from "../contenido/armas.ts";
import { equipoInicial, generarEquipo, puntuacion, type ObjetoEquipo, type Rareza } from "./equipo.ts";
import { cartaDe, equipoDe, type Partida } from "./partida.ts";

/** Precio de compra de los materiales en el mercader del pueblo. */
const PRECIO_MATERIAL = 35;

export const CATALOGO_PUEBLO = new Catalogo([
  ...CONSUMIBLES.map((c) => ({ tienda: "pueblo", pestana: 0, objeto: c.id, precio: c.precio })),
  ...MATERIALES.map((m) => ({ tienda: "pueblo", pestana: 1, objeto: m.id, precio: m.id === 13 ? PRECIO_MATERIAL * 4 : PRECIO_MATERIAL })),
]);

export function comprarEnPueblo(p: Partida, objeto: number): Resultado<number, ErrorCompra> {
  const pestana = CONSUMIBLES.some((c) => c.id === objeto) ? 0 : 1;
  const r = comprar({
    catalogo: CATALOGO_PUEBLO, tienda: "pueblo", pestana, objeto, inventario: p.mochila,
    pago: { nombre: "esquirlas", saldo: () => p.esquirlas, cobrar: (m) => p.billetera.debitar("esquirlas", m), pagar: (m) => p.billetera.acreditar("esquirlas", m) },
  });
  return r.ok ? exito(r.valor.saldoRestante) : r;
}

export function precioPueblo(objeto: number): number {
  return CATALOGO_PUEBLO.buscar("pueblo", objeto, CONSUMIBLES.some((c) => c.id === objeto) ? 0 : 1)?.precio ?? 0;
}

// ---------------- Armero ----------------

export interface ArticuloArmero {
  readonly equipo: ObjetoEquipo;
  readonly precio: number;
}

export function precioEquipo(o: ObjetoEquipo): number {
  return Math.round(puntuacion(o) * 4 + 25 + o.rareza * 40);
}

/** Seis piezas: dos armas, tres de armadura y una joya. Rareza y nivel según el piso más hondo alcanzado. */
export function generarStockArmero(azar: Azar, pisoMaximo: number): ArticuloArmero[] {
  const piso = Math.max(1, Math.min(10, pisoMaximo));
  // El armero nunca vende Míticos: esos solo salen del Pozo.
  const minima: Rareza = piso >= 7 ? 2 : piso >= 3 ? 1 : 0;
  const tipos = ["arma", "arma", elegirUno(azar, ARMADURAS), elegirUno(azar, ARMADURAS), elegirUno(azar, ARMADURAS), elegirUno(azar, ACCESORIOS)] as const;
  return tipos.map((t) => {
    let equipo = generarEquipo(azar, piso, minima, t);
    for (let k = 0; k < 8 && equipo.rareza >= 5; k++) equipo = generarEquipo(azar, piso, minima, t);
    return { equipo, precio: precioEquipo(equipo) };
  });
}

export function comprarAlArmero(p: Partida, stock: ArticuloArmero[], i: number): Resultado<ObjetoEquipo, "agotado" | "sin-fondos" | "sin-espacio"> {
  const a = stock[i];
  if (a === undefined) return fallo("agotado");
  if (p.esquirlas < a.precio) return fallo("sin-fondos");
  if (!p.mochila.agregar(a.equipo.base, 1, { equipo: a.equipo }).ok) return fallo("sin-espacio");
  p.billetera.debitar("esquirlas", a.precio);
  stock.splice(i, 1);
  return exito(a.equipo);
}

// ---------------- Venta ----------------

/** Lo que paga el pueblo por una casilla de la mochila (0 = no se compra). */
export function valorVenta(p: Partida, pos: Posicion): number {
  const pila = p.mochila.en(pos);
  if (pila === null) return 0;
  const eq = equipoDe(pila);
  if (eq !== undefined) return Math.max(5, Math.round(precioEquipo(eq) * 0.3));
  const ru = runaDeObjeto(pila.objeto);
  if (ru !== undefined) return Math.round(120 * (1 + ru.nivel * 1.6));
  const def = apilable(pila.objeto);
  if (def === undefined) return 0;
  return precioDeVenta({ precio: Math.max(def.precio, PRECIO_MATERIAL) * 3, vendible: true, maxPila: 1 }, pila.cantidad);
}

export function vender(p: Partida, pos: Posicion): Resultado<number, "casilla-vacia" | "invendible"> {
  const valor = valorVenta(p, pos);
  if (p.mochila.en(pos) === null) return fallo("casilla-vacia");
  if (valor <= 0) return fallo("invendible");
  p.mochila.sacarDe(pos);
  p.billetera.acreditar("esquirlas", valor);
  return exito(valor);
}

/** Cartas del mazo: valen más cuantas más estrellas (las resplandecientes, el triple). */
export function valorCarta(p: Partida, pos: Posicion): number {
  const pila = p.mazo.en(pos);
  const c = pila !== null && pila.objeto === OBJ_CARTA ? cartaDe(pila) : undefined;
  if (c === undefined) return 0;
  return Math.round(12 * Math.pow(2.2, c.nivel) * (c.brillante === true ? 3 : 1) * (1 + c.mejoras * 0.15));
}

export function venderCarta(p: Partida, pos: Posicion): Resultado<number, "casilla-vacia"> {
  const valor = valorCarta(p, pos);
  if (valor <= 0) return fallo("casilla-vacia");
  p.mazo.sacarDe(pos);
  p.billetera.acreditar("esquirlas", valor);
  return exito(valor);
}

/** ¿El Portador tiene algún arma (equipada, en la mochila o en el contenedor seguro)? */
export function tieneArma(p: Partida): boolean {
  if (p.equipo.arma !== null) return true;
  for (const inv of [p.mochila, p.seguro]) {
    for (const pos of inv.posiciones()) {
      const pila = inv.en(pos);
      if (pila !== null && equipoDe(pila)?.ranura === "arma") return true;
    }
  }
  return false;
}

/**
 * Kit de recluta: si caíste y perdiste todo, el armero te da gratis un arma común del estilo que elijas y una poción.
 * Solo si no tienes ningún arma (para que no sea una fuente de equipo infinito).
 */
export function kitRecluta(p: Partida, azar: Azar, estilo: EstiloArma): Resultado<ObjetoEquipo, "ya-tienes-arma"> {
  if (tieneArma(p)) return fallo("ya-tienes-arma");
  const arma = equipoInicial(azar, ESTILOS[estilo].armaInicial);
  p.equipo.arma = arma;
  if (p.mochila.contar(OBJ_POCION) === 0) p.mochila.agregar(OBJ_POCION, 1);
  return exito(arma);
}
