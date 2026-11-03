// Continuidad entre salas: entrar nunca dispara otra salida, y se puede bajar y subir por un pozo
// simulando la física real del Portador sobre dos salas construidas como en el juego.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { Meta } from "../src/dominio/meta.ts";
import { ALTO_SALA, construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Dir, Reliquia } from "../src/dominio/tipos.ts";
import type { Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import { entradaPor, salidaDe } from "../src/juego/transiciones.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

describe("entradaPor / salidaDe", () => {
  const cuerpos = [
    { x: -7, y: 100, w: 12, h: 22 }, { x: 476, y: 100, w: 12, h: 22 },
    { x: 220, y: -15, w: 12, h: 22 }, { x: 230, y: 275, w: 12, h: 22 }, { x: 150, y: 290, w: 12, h: 22 },
  ];
  for (const dir of ["izq", "der", "arr", "aba"] as Dir[]) {
    it(`entrar tras salir hacia ${dir} deja al jugador adentro`, () => {
      for (const c of cuerpos) {
        const p = entradaPor(dir, c);
        expect(salidaDe({ ...c, ...p }), `${dir} ${JSON.stringify(c)}`).toBeNull();
      }
    });
  }
});

function mundo(reliquias: Reliquia[]) {
  const azar = new AzarSemilla(3);
  const arriba = construirSala("normal", 0, { aba: {}, izq: {} }, azar, 0);
  const abajo = construirSala("normal", 1, { arr: {}, der: {} }, azar, 0);
  let actual = arriba;
  const tiles = { tile: (tx: number, ty: number) => actual.tiles[indice(tx, ty)] };
  const jugador = new Jugador();
  jugador.reliquias = new Set(reliquias);
  const ctx = {
    partida: new Partida(Meta.nueva(), 1), tiles, jugador, fx: new Efectos(),
    audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [],
    agregarProyectil: () => {}, agregarCriatura: () => {}, agregarPeligro: () => {}, golpearJugador: () => {},
    golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let pulsadas = new Set<Accion>();
  let recientes = new Set<Accion>();
  const entrada = { pulsada: (a: Accion) => pulsadas.has(a), recien: (a: Accion) => recientes.has(a), soltada: () => false } as unknown as Entrada;
  /** Simula hasta `n` cuadros; si el jugador sale de la sala, devuelve la dirección. */
  const simular = (n: number, mantener: Accion[] = [], tocar: Accion[] = []): Dir | null => {
    for (let i = 0; i < n; i++) {
      pulsadas = new Set(mantener);
      recientes = new Set(i === 0 ? tocar : []);
      jugador.actualizar(1 / 60, ctx, entrada);
      const s = salidaDe(jugador);
      if (s !== null) return s;
    }
    return null;
  };
  const cambiar = (dir: Dir): void => {
    actual = actual === arriba ? abajo : arriba;
    const p = entradaPor(dir, jugador);
    jugador.colocar(p.x, p.y);
    if (dir === "arr") jugador.impulsoDePozo();
  };
  return { jugador, simular, cambiar };
}

describe("pozos entre salas", () => {
  it("se baja manteniendo ↓ y se cae sobre la escalera de la sala inferior, sin rebotar", () => {
    const { jugador, simular, cambiar } = mundo([]);
    jugador.colocar(14 * TILE, 14 * TILE - jugador.h);
    expect(simular(10)).toBeNull();
    expect(jugador.enSuelo).toBe(true);
    expect(simular(120, ["aba"])).toBe("aba");
    cambiar("aba");
    // Ya en la sala de abajo: no debe salir hacia ningún lado y termina parado en una plataforma.
    expect(simular(180)).toBeNull();
    expect(jugador.enSuelo).toBe(true);
    expect(jugador.y).toBeGreaterThan(0);
    expect(jugador.y + jugador.h).toBeLessThan(ALTO_SALA);
  });

  it("con Doble Salto se sube por el pozo y se aterriza en la sala de arriba", () => {
    const { jugador, simular, cambiar } = mundo(["dobleSalto"]);
    cambiar("aba"); // empezar en la sala de abajo
    jugador.colocar(14 * TILE, 5 * TILE - jugador.h);
    simular(10);
    let salida = simular(16, ["saltar"], ["saltar"]);
    if (salida === null) salida = simular(60, ["saltar"], ["saltar"]);
    expect(salida).toBe("arr");
    cambiar("arr");
    expect(simular(180)).toBeNull();
    expect(jugador.enSuelo).toBe(true);
    expect(jugador.y + jugador.h).toBe(14 * TILE);
  });
});
