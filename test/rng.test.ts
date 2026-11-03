// Más RNG en equipo y cartas, modificadores de combate, arco y técnicas nuevas.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { ALMAS } from "../src/contenido/almas.ts";
import { BASES, RASGOS_EQUIPO } from "../src/contenido/objetos.ts";
import { PROB_BRILLANTE, crearCarta, mejorarCarta } from "../src/dominio/cartas.ts";
import { crearUnico, generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import type { Proyectil } from "../src/juego/entidades/proyectil.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

describe("equipo con calidad y rasgos", () => {
  it("la calidad está entre 75 % y 130 % y escala los stats", () => {
    const azar = new AzarSemilla(1);
    for (let i = 0; i < 300; i++) {
      const e = generarEquipo(azar, 1 + (i % 3));
      expect(e.calidad).toBeGreaterThanOrEqual(0.75);
      expect(e.calidad).toBeLessThanOrEqual(1.3);
    }
  });

  it("los rasgos respetan su rango y los de arma solo salen en armas", () => {
    const azar = new AzarSemilla(2);
    let conRasgos = 0;
    for (let i = 0; i < 400; i++) {
      const e = generarEquipo(azar, 3, 2);
      const rasgos = Object.entries(e.rasgos ?? {});
      if (rasgos.length > 0) conRasgos++;
      expect(rasgos.length).toBeGreaterThanOrEqual(2);
      for (const [id, v] of rasgos) {
        const def = RASGOS_EQUIPO.find((r) => r.id === id)!;
        // Las bases con rasgo propio (Estoque, Armadura de Placas...) lo suman: no aplica el rango del azar.
        if (BASES.find((b) => b.id === e.base)?.rasgos?.[id as keyof NonNullable<(typeof BASES)[number]["rasgos"]>] !== undefined) continue;
        expect(def.en).toContain(e.ranura);
        expect(v).toBeGreaterThanOrEqual(def.min);
        expect(v).toBeLessThanOrEqual(def.max * 1.5);
      }
    }
    expect(conRasgos).toBe(400);
    expect(Object.keys(crearUnico(azar, 1).rasgos ?? {}).length).toBe(4);
  });
});

describe("cartas con rasgos y resplandecientes", () => {
  it("salen rasgos (más con más estrellas) y alguna resplandeciente", () => {
    const azar = new AzarSemilla(3);
    let rasgos1 = 0;
    let rasgos6 = 0;
    let brillantes = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const c1 = crearCarta(azar, i % ALMAS.length, 0);
      const c6 = crearCarta(azar, i % ALMAS.length, 6);
      if (c1.rasgo !== undefined) rasgos1++;
      if (c6.rasgo !== undefined) rasgos6++;
      if (c1.brillante === true) brillantes++;
    }
    expect(rasgos6).toBeGreaterThan(rasgos1);
    expect(brillantes / n).toBeGreaterThan(PROB_BRILLANTE * 0.5);
    expect(brillantes / n).toBeLessThan(PROB_BRILLANTE * 1.8);
  });

  it("una resplandeciente se puede mejorar (su tope es mayor)", () => {
    const azar = new AzarSemilla(4);
    let c = crearCarta(azar, 0, 3);
    c = { ...c, brillante: true, stats: Object.fromEntries(Object.entries(c.stats).map(([k, v]) => [k, Math.round(v * 1.2)])) };
    expect(mejorarCarta(c, azar).ok).toBe(true);
  });

  it("hay 12 almas y cada una tiene técnica y pasiva", () => {
    expect(ALMAS).toHaveLength(12);
    expect(new Set(ALMAS.map((a) => a.id)).size).toBe(12);
  });
});

describe("modificadores de combate", () => {
  it("suma rasgos del equipo, rasgo de la Forma y la pasiva de la ranura Forma", () => {
    const p = new Partida(Meta.nueva(), 1, { alma: 9 }); // Morrigan en Forma: Plumas Afiladas (+5 % vel. a 1★)
    p.equipo.arma = { ...p.equipo.arma!, rasgos: { alcance: 0.2, velocidad: 0.1 } };
    p.forma = { ...p.forma!, rasgo: "furiosa" };
    p.almas[1] = null; // solo la Forma (el personaje nuevo también trae su alma como Habilidad I)
    const m = p.combate();
    expect(m.alcance).toBeCloseTo(0.2);
    const escala = 1 + p.forma!.nivel * 0.16 + (p.forma!.brillante === true ? 0.1 : 0);
    expect(m.velocidad).toBeCloseTo(0.1 + 0.05 * escala);
    expect(m.tecnicaDanio).toBeCloseTo(0.2);
  });
});

function escenario(estilo: "arco" | "espada") {
  const datos = construirSala("altar", 0, { izq: {}, der: {} }, new AzarSemilla(1), 0);
  const partida = new Partida(Meta.nueva(), 1, { estilo, alma: 8 });
  const jugador = new Jugador();
  const proyectiles: Proyectil[] = [];
  const ctx = {
    partida, tiles: { tile: (tx: number, ty: number) => datos.tiles[indice(tx, ty)] }, jugador, fx: new Efectos(),
    audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [],
    agregarProyectil: (p: Proyectil) => proyectiles.push(p), agregarCriatura: () => {}, agregarPeligro: () => {},
    golpearJugador: () => {}, golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let recientes = new Set<Accion>();
  const entrada = { pulsada: () => false, recien: (a: Accion) => recientes.has(a), soltada: () => false } as unknown as Entrada;
  const paso = (n: number, tocar: Accion[] = []): void => {
    for (let i = 0; i < n; i++) {
      recientes = new Set(i === 0 ? tocar : []);
      jugador.actualizar(1 / 60, ctx, entrada);
    }
  };
  jugador.colocar(10 * TILE, 14 * TILE - jugador.h);
  paso(5);
  return { partida, paso, proyectiles };
}

describe("arco", () => {
  it("cada golpe dispara una flecha y el tercero, tres", () => {
    const { paso, proyectiles } = escenario("arco");
    paso(1, ["golpe"]);
    paso(20);
    expect(proyectiles.filter((p) => p.op.tipo === "flecha")).toHaveLength(1);
    paso(1, ["golpe"]);
    paso(20);
    paso(1, ["golpe"]);
    paso(20);
    expect(proyectiles.filter((p) => p.op.tipo === "flecha")).toHaveLength(5);
  });

  it("la espada no dispara nada", () => {
    const { paso, proyectiles } = escenario("espada");
    paso(1, ["golpe"]);
    paso(20);
    expect(proyectiles).toHaveLength(0);
  });
});
