// Movimiento estilo Castlevania moderno: agacharse, paso atrás, barrida y subarmas.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { botinVela } from "../src/dominio/botin.ts";
import { Meta } from "../src/dominio/meta.ts";
import { construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import type { Proyectil } from "../src/juego/entidades/proyectil.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

function escenario() {
  const datos = construirSala("altar", 0, { izq: {}, der: {} }, new AzarSemilla(1), 0);
  const tiles = { tile: (tx: number, ty: number) => datos.tiles[indice(tx, ty)] };
  const partida = new Partida(Meta.nueva(), 1);
  const jugador = new Jugador();
  const proyectiles: Proyectil[] = [];
  const ctx = {
    partida, tiles, jugador, fx: new Efectos(), audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [],
    agregarProyectil: (p: Proyectil) => proyectiles.push(p), agregarCriatura: () => {}, agregarPeligro: () => {},
    golpearJugador: () => {}, golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let pulsadas = new Set<Accion>();
  let recientes = new Set<Accion>();
  const entrada = { pulsada: (a: Accion) => pulsadas.has(a), recien: (a: Accion) => recientes.has(a), soltada: () => false } as unknown as Entrada;
  const paso = (n: number, mantener: Accion[] = [], tocar: Accion[] = []): void => {
    for (let i = 0; i < n; i++) {
      pulsadas = new Set(mantener);
      recientes = new Set(i === 0 ? tocar : []);
      jugador.actualizar(1 / 60, ctx, entrada);
    }
  };
  jugador.colocar(10 * TILE, 14 * TILE - jugador.h);
  paso(10);
  return { jugador, partida, paso, proyectiles };
}

describe("movimiento", () => {
  it("agacharse baja el cuerpo sin despegar los pies del piso, y al soltar se levanta", () => {
    const { jugador, paso } = escenario();
    const pies = jugador.y + jugador.h;
    paso(5, ["aba"]);
    expect(jugador.agachado).toBe(true);
    expect(jugador.h).toBeLessThan(22);
    expect(jugador.y + jugador.h).toBeCloseTo(pies, 3);
    paso(3);
    expect(jugador.agachado).toBe(false);
    expect(jugador.h).toBe(22);
  });

  it("el paso atrás retrocede, es invulnerable al principio y no cambia hacia dónde mira", () => {
    const { jugador, paso } = escenario();
    paso(4, ["der"]);
    paso(10);
    const x0 = jugador.x;
    paso(1, [], ["embestida"]);
    expect(jugador.invulnerable).toBe(true);
    paso(20);
    expect(jugador.x).toBeLessThan(x0 - 30);
    expect(jugador.dir).toBe(1);
  });

  it("↓ + Salto en el suelo es una barrida: avanza bajo y no salta", () => {
    const { jugador, paso } = escenario();
    paso(4, ["der"]);
    paso(10);
    const x0 = jugador.x;
    const y0 = jugador.y + jugador.h;
    paso(1, ["aba", "saltar"], ["saltar"]);
    paso(10, ["aba"]);
    expect(jugador.x).toBeGreaterThan(x0 + 30);
    expect(jugador.y + jugador.h).toBeCloseTo(y0, 3);
    expect(jugador.agachado).toBe(true);
  });

  it("la subarma gasta corazones y lanza un proyectil; sin corazones no", () => {
    const { partida, paso, proyectiles } = escenario();
    partida.subarma = "hacha";
    partida.corazones = 3;
    paso(1, ["arr"], ["patada"]);
    expect(partida.corazones).toBe(1);
    expect(proyectiles.length).toBe(1);
    paso(30);
    paso(1, ["arr"], ["patada"]);
    expect(partida.corazones).toBe(1);
    expect(proyectiles.length).toBe(1);
  });

  it("las velas sueltan casi siempre corazones", () => {
    const azar = new AzarSemilla(4);
    let corazones = 0;
    for (let i = 0; i < 200; i++) if (botinVela(azar, 1).some((p) => p.tipo === "corazones")) corazones++;
    expect(corazones).toBeGreaterThan(130);
  });

  it("el guardado conserva corazones y subarma", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 2);
    p.corazones = 42;
    p.subarma = "cruz";
    const q = Partida.restaurar(meta, JSON.parse(JSON.stringify(p.serializar())));
    expect(q.corazones).toBe(42);
    expect(q.subarma).toBe("cruz");
  });
});
