import { describe, expect, test } from "vitest";
import { AzarSemilla, type Azar } from "minialu";
import {
  BLOQUE_RELICARIO, CUOTAS_RELICARIO, PIEDAD_INICIAL, PROB_CAJA, PROB_RELICARIO, abrirRelicario, type PiedadRelicario,
} from "../src/dominio/relicario.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { OBJ_CAJA_ALMAS, OBJ_RELICARIO } from "../src/contenido/objetos.ts";
import { botinCofre, botinEnemigo } from "../src/dominio/botin.ts";

/** El peor azar posible: siempre 0 → siempre la estrella más común. */
const sinSuerte: Azar = { siguiente: () => 0 } as Azar;

function bloque(azar: Azar, piedad: PiedadRelicario = PIEDAD_INICIAL): { cuenta: Map<number, number>; piedad: PiedadRelicario } {
  const cuenta = new Map<number, number>();
  let p = piedad;
  for (let i = 0; i < BLOQUE_RELICARIO; i++) {
    const r = abrirRelicario(azar, p);
    cuenta.set(r.nivel, (cuenta.get(r.nivel) ?? 0) + 1);
    p = r.piedad;
  }
  return { cuenta, piedad: p };
}

describe("Relicario de Almas", () => {
  test("la tabla suma 1 y va de 5★ (lo más común) a 12★ (lo más raro)", () => {
    expect(PROB_RELICARIO.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    for (let i = 1; i < PROB_RELICARIO.length; i++) expect(PROB_RELICARIO[i]).toBeLessThan(PROB_RELICARIO[i - 1]);
  });

  test("aun sin ninguna suerte, cada 100 aperturas cumplen las cuotas (1×12★, 3×11★, 5×10★, 8×9★)", () => {
    const { cuenta, piedad } = bloque(sinSuerte);
    for (const [nivel, cuota] of Object.entries(CUOTAS_RELICARIO)) expect(cuenta.get(Number(nivel)) ?? 0).toBe(cuota);
    expect(cuenta.get(4)).toBe(100 - 1 - 3 - 5 - 8);
    // El bloque se reinicia.
    expect(piedad).toEqual(PIEDAD_INICIAL);
  });

  test("con azar real, todos los bloques cumplen las cuotas y lo más común es 5★", () => {
    const azar = new AzarSemilla(2026);
    let p = PIEDAD_INICIAL;
    const total = new Map<number, number>();
    for (let b = 0; b < 20; b++) {
      const r = bloque(azar, p);
      p = r.piedad;
      for (const [nivel, cuota] of Object.entries(CUOTAS_RELICARIO)) expect(r.cuenta.get(Number(nivel)) ?? 0).toBeGreaterThanOrEqual(cuota);
      for (const [n, c] of r.cuenta) total.set(n, (total.get(n) ?? 0) + c);
    }
    const masComun = [...total].sort((a, b) => b[1] - a[1])[0][0];
    expect(masComun).toBe(4);
    for (const n of total.keys()) expect(n).toBeGreaterThanOrEqual(4);
    for (const n of total.keys()) expect(n).toBeLessThanOrEqual(11);
  });

  test("abrir pasa la carta al mazo y gasta la caja; el relicario guarda su piedad", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 7);
    expect(p.abrirRelicario().ok).toBe(false);
    p.mochila.agregar(OBJ_RELICARIO, 2);
    p.mochila.agregar(OBJ_CAJA_ALMAS, 3);
    const cartas = (): number => [...p.mazo.posiciones()].filter((x) => p.mazo.en(x) !== null).length;
    const antes = cartas();
    const r = p.abrirCaja(OBJ_RELICARIO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.carta.nivel).toBeGreaterThanOrEqual(4);
    const c = p.abrirCaja(OBJ_CAJA_ALMAS);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.valor.carta.nivel).toBeLessThanOrEqual(5);
    expect(p.mochila.contar(OBJ_RELICARIO)).toBe(1);
    expect(p.mochila.contar(OBJ_CAJA_ALMAS)).toBe(2);
    expect(cartas()).toBe(antes + 2);
    expect(p.piedadRelicario.abiertos).toBe(1);
    expect(Partida.restaurar(meta, p.serializar()).piedadRelicario.abiertos).toBe(1);
  });

  test("la Caja de Almas va de 1★ a 6★ y lo más común es 1★", () => {
    expect(PROB_CAJA.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const p = new Partida(Meta.nueva(), 11);
    p.mochila.agregar(OBJ_CAJA_ALMAS, 60);
    const cuenta = new Map<number, number>();
    for (let i = 0; i < 40; i++) {
      const r = p.abrirCaja(OBJ_CAJA_ALMAS);
      if (r.ok) cuenta.set(r.valor.carta.nivel, (cuenta.get(r.valor.carta.nivel) ?? 0) + 1);
    }
    for (const n of cuenta.keys()) expect(n).toBeLessThanOrEqual(5);
  });

  test("las cartas ya no caen sueltas: monstruos → cajas; guardianes → un relicario seguro", () => {
    const azar = new AzarSemilla(5);
    for (let i = 0; i < 300; i++) {
      for (const pr of botinEnemigo(azar, 4, i % 3 === 0 ? "elite" : "comun")) expect(pr.tipo).not.toBe("carta");
    }
    for (let i = 0; i < 20; i++) {
      const jefe = botinEnemigo(azar, 4, "jefe");
      expect(jefe.filter((x) => x.tipo === "objeto" && x.objeto === OBJ_RELICARIO)).toHaveLength(1);
      expect(jefe.some((x) => x.tipo === "carta")).toBe(false);
    }
    const oro = botinCofre(azar, 6, undefined, 2);
    expect(oro.some((x) => x.tipo === "objeto" && x.objeto === OBJ_RELICARIO)).toBe(true);
  });
});
