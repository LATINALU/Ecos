// Simula al Portador en una sala real para comprobar que el diseño de niveles se puede recorrer:
// el salto simple alcanza las plataformas de la escalera y solo el Doble Salto sale por el pozo de arriba.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { Meta } from "../src/dominio/meta.ts";
import { construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Reliquia } from "../src/dominio/tipos.ts";
import type { Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

function escenario(reliquias: Reliquia[], talentos: string[] = []) {
  const datos = construirSala("altar", 0, { arr: {}, izq: {}, der: {} }, new AzarSemilla(1), 0);
  const tiles = { tile: (tx: number, ty: number) => datos.tiles[indice(tx, ty)] };
  const partida = new Partida(Meta.nueva(), 1);
  for (const t of talentos) partida.talentos.add(t as never);
  const jugador = new Jugador();
  jugador.reliquias = new Set(reliquias);
  const ctx = {
    partida, tiles, jugador, fx: new Efectos(),
    audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [],
    agregarProyectil: () => {}, agregarCriatura: () => {}, agregarPeligro: () => {}, golpearJugador: () => {},
    golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let pulsadas = new Set<Accion>();
  let recientes = new Set<Accion>();
  const entrada = {
    pulsada: (a: Accion) => pulsadas.has(a), recien: (a: Accion) => recientes.has(a), soltada: () => false,
  } as unknown as Entrada;
  const paso = (n: number, mantener: Accion[] = [], tocar: Accion[] = []): number => {
    let minY = Infinity;
    for (let i = 0; i < n; i++) {
      pulsadas = new Set(mantener);
      recientes = new Set(i === 0 ? tocar : []);
      jugador.actualizar(1 / 60, ctx, entrada);
      minY = Math.min(minY, jugador.y);
    }
    return minY;
  };
  return { jugador, paso };
}

describe("física del Portador", () => {
  it("un salto simple llega a la primera plataforma de la escalera (3 tiles)", () => {
    const { jugador, paso } = escenario([]);
    jugador.colocar(14 * TILE, 14 * TILE - jugador.h);
    paso(10);
    expect(jugador.enSuelo).toBe(true);
    paso(60, ["saltar"], ["saltar"]);
    // terminó parado sobre la plataforma de la fila 11
    expect(jugador.y + jugador.h).toBe(11 * TILE);
  });

  it("sin Doble Salto no sale por el pozo; con Doble Salto sí", () => {
    for (const [reliquias, sale] of [[[], false], [["dobleSalto"], true]] as const) {
      const { jugador, paso } = escenario([...reliquias]);
      jugador.colocar(14 * TILE, 5 * TILE - jugador.h);
      paso(10);
      paso(18, ["saltar"], ["saltar"]);
      const minY = paso(40, ["saltar"], ["saltar"]);
      expect(minY + jugador.h / 2 < 0, `reliquias=${reliquias.join()}`).toBe(sale);
    }
  });

  it("el Salto de Pared no permite trepar el pozo sin Doble Salto", () => {
    const { jugador, paso } = escenario([], ["saltoPared"]);
    let minY = Infinity;
    for (const lado of ["izq", "der"] as const) {
      for (let intento = 0; intento < 6; intento++) {
        jugador.colocar(14 * TILE - 2 + intento * 3, 5 * TILE - jugador.h);
        jugador.vx = 0;
        jugador.vy = 0;
        paso(5);
        minY = Math.min(minY, paso(14, ["saltar", lado], ["saltar"]));
        for (let k = 0; k < 8; k++) minY = Math.min(minY, paso(5, ["saltar", k % 2 === 0 ? "izq" : "der"], ["saltar"]));
      }
    }
    expect(minY + jugador.h / 2).toBeGreaterThan(0);
  });

  it("con Salto de Pared se desliza y rebota en una pared lateral", () => {
    const { jugador, paso } = escenario([], ["saltoPared"]);
    jugador.colocar(2 * TILE + 1, 6 * TILE);
    paso(12, ["izq"]);
    expect(jugador.deslizando).toBe(true);
    expect(jugador.vy).toBeLessThanOrEqual(55);
    paso(1, ["izq", "saltar"], ["saltar"]);
    expect(jugador.vx).toBeGreaterThan(100);
    expect(jugador.vy).toBeLessThan(-200);
  });
});
