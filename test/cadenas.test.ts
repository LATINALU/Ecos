// Pasajes verticales con cadena: se sube y se baja en ambos sentidos, sin Doble Salto.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { Meta } from "../src/dominio/meta.ts";
import { ALTO_SALA, ANCHO_SALA, construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Dir } from "../src/dominio/tipos.ts";
import type { Cadena, Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import { entradaPor, salidaDe } from "../src/juego/transiciones.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

const PISO = 14 * TILE;

function mundo() {
  const azar = new AzarSemilla(5);
  const salas = {
    arriba: { datos: construirSala("normal", 2, { aba: {}, izq: {} }, azar, 0), cadena: { x: ANCHO_SALA / 2, arriba: PISO, abajo: ALTO_SALA + 60 } },
    abajo: { datos: construirSala("normal", 3, { arr: {}, der: {} }, azar, 0), cadena: { x: ANCHO_SALA / 2, arriba: -60, abajo: PISO } },
  };
  let actual: keyof typeof salas = "abajo";
  const jugador = new Jugador();
  const ctx = {
    get cadena(): Cadena { return salas[actual].cadena; },
    partida: new Partida(Meta.nueva(), 1), tiles: { tile: (tx: number, ty: number) => salas[actual].datos.tiles[indice(tx, ty)] },
    jugador, fx: new Efectos(), audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [],
    agregarProyectil: () => {}, agregarCriatura: () => {}, agregarPeligro: () => {}, golpearJugador: () => {},
    golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let pulsadas = new Set<Accion>();
  const entrada = { pulsada: (a: Accion) => pulsadas.has(a), recien: () => false, soltada: () => false } as unknown as Entrada;
  const simular = (n: number, mantener: Accion[] = []): Dir | null => {
    for (let i = 0; i < n; i++) {
      pulsadas = new Set(mantener);
      jugador.actualizar(1 / 60, ctx, entrada);
      const s = salidaDe(jugador);
      if (s !== null) return s;
    }
    return null;
  };
  /** Igual que Juego.colocarAlEntrar. */
  const cruzar = (dir: Dir): void => {
    actual = dir === "arr" ? "arriba" : "abajo";
    const p = entradaPor(dir, jugador);
    jugador.colocar(p.x, p.y);
    if (jugador.trepando) jugador.x = salas[actual].cadena.x - jugador.w / 2;
  };
  return { jugador, simular, cruzar };
}

describe("cadenas entre salas", () => {
  it("se sube trepando desde el piso de abajo y se termina parado en la sala de arriba", () => {
    const { jugador, simular, cruzar } = mundo();
    jugador.colocar(ANCHO_SALA / 2 - 6, PISO - jugador.h);
    simular(5);
    expect(simular(400, ["arr"])).toBe("arr");
    expect(jugador.trepando).toBe(true);
    cruzar("arr");
    expect(simular(200, ["arr"])).toBeNull();
    expect(jugador.trepando).toBe(false);
    expect(jugador.y + jugador.h).toBe(PISO);
  });

  it("se baja trepando desde la plataforma del pasaje y se llega al piso de la sala de abajo", () => {
    const { jugador, simular, cruzar } = mundo();
    cruzar("arr");
    jugador.colocar(ANCHO_SALA / 2 - 6, PISO - jugador.h);
    simular(5);
    expect(simular(200, ["aba"])).toBe("aba");
    expect(jugador.trepando).toBe(true);
    cruzar("aba");
    expect(simular(400, ["aba"])).toBeNull();
    expect(jugador.trepando).toBe(false);
    expect(jugador.y + jugador.h).toBe(PISO);
  });

  it("ida y vuelta: bajar y volver a subir por el mismo pasaje", () => {
    const { jugador, simular, cruzar } = mundo();
    cruzar("arr");
    jugador.colocar(ANCHO_SALA / 2 - 6, PISO - jugador.h);
    simular(5);
    expect(simular(200, ["aba"])).toBe("aba");
    cruzar("aba");
    simular(400, ["aba"]);
    expect(simular(400, ["arr"])).toBe("arr");
    cruzar("arr");
    simular(200, ["arr"]);
    expect(jugador.y + jugador.h).toBe(PISO);
  });
});
