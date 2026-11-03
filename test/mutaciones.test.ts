import { describe, expect, test } from "vitest";
import { MUTACIONES, tierMutacion } from "../src/contenido/mutaciones.ts";
import { RESONANCIAS, buscarResonancia, esenciaDe, type Esencia } from "../src/contenido/resonancias.ts";
import { GRIMORIO } from "../src/contenido/grimorio.ts";
import { ALMAS } from "../src/contenido/almas.ts";
import { Meta } from "../src/dominio/meta.ts";
import { EfectosVivos } from "../src/juego/efectos-vivos.ts";
import type { Contexto } from "../src/juego/contexto.ts";

describe("mutaciones por estrella", () => {
  test("se desbloquean en 5★, 9★ y 12★", () => {
    expect(tierMutacion(3)).toBe(0); // 4★
    expect(tierMutacion(4)).toBe(1); // 5★
    expect(tierMutacion(7)).toBe(1); // 8★
    expect(tierMutacion(8)).toBe(2); // 9★
    expect(tierMutacion(11)).toBe(3); // 12★
  });

  test("toda forma de habilidad del Grimorio tiene sus tres mutaciones", () => {
    for (const g of GRIMORIO) for (const hab of g.habilidades) expect(MUTACIONES[hab.forma]).toHaveLength(3);
  });
});

describe("resonancias de mazo", () => {
  test("la misma esencia no resuena; el orden no importa", () => {
    expect(buscarResonancia("fuego", "fuego")).toBeUndefined();
    expect(buscarResonancia("fuego", "viento")?.id).toBe("tornado");
    expect(buscarResonancia("viento", "fuego")?.id).toBe("tornado");
  });

  test("cada resonancia se puede descubrir con las almas que existen (dos habilidades de ranuras distintas)", () => {
    // Esencias disponibles por ranura (I, II, III).
    const porRanura: Set<Esencia>[] = [new Set(), new Set(), new Set()];
    GRIMORIO.forEach((g, i) => {
      const familia = ALMAS.find((a) => a.id === i)?.tipo ?? 0;
      for (let r = 0; r < 3; r++) porRanura[r].add(esenciaDe(g.habilidades[r], familia));
    });
    for (const res of RESONANCIAS) {
      const [a, b] = res.esencias;
      const posible = [0, 1, 2].some((r1) => [0, 1, 2].some((r2) => r1 !== r2 && porRanura[r1].has(a) && porRanura[r2].has(b)));
      expect(posible, res.nombre).toBe(true);
    }
  });

  test("el Códice guarda lo descubierto", () => {
    const meta = Meta.nueva();
    expect(meta.descubrirResonancia("tornado")).toBe(true);
    expect(meta.descubrirResonancia("tornado")).toBe(false);
    const copia = new Meta(meta.serializar());
    expect(copia.resonanciaDescubierta("tornado")).toBe(true);
    expect(copia.resonanciaDescubierta("eclipse")).toBe(false);
  });
});

describe("efectos vivos", () => {
  const ctxFalso = (): { ctx: Contexto; golpes: number[] } => {
    const golpes: number[] = [];
    const fx = { chispas: () => undefined, estallar: () => undefined, sacudir: () => undefined, fogonazo: () => undefined };
    const ctx = {
      jugador: { cx: 0, cy: 0 }, criaturas: [], fx, audio: { reproducir: () => undefined },
      golpearArea: (_r: unknown, a: { potencia: number }) => { golpes.push(a.potencia); return 0; },
    } as unknown as Contexto;
    return { ctx, golpes };
  };

  test("una zona daña cada tick mientras dura y estalla al final", () => {
    const { ctx, golpes } = ctxFalso();
    const v = new EfectosVivos();
    v.zona({ x: 0, y: 0, w: 20, h: 20, dur: 1, tick: 0.25, ataque: { potencia: 5, tipo: "tecnica", empuje: 0 }, color: "#fff", forma: "grieta", final: { potencia: 50, tipo: "tecnica", empuje: 0 } });
    for (let i = 0; i < 70; i++) v.actualizar(1 / 60, ctx, []);
    expect(golpes.filter((p) => p === 5).length).toBe(4);
    expect(golpes).toContain(50);
    expect(v.zonas).toHaveLength(0);
  });

  test("las acciones programadas se disparan a su tiempo y los ecos se consumen", () => {
    const { ctx } = ctxFalso();
    const v = new EfectosVivos();
    let hecho = false;
    v.programar(0.5, () => { hecho = true; });
    for (let i = 0; i < 20; i++) v.actualizar(1 / 60, ctx, []);
    expect(hecho).toBe(false);
    for (let i = 0; i < 20; i++) v.actualizar(1 / 60, ctx, []);
    expect(hecho).toBe(true);
    v.crearEco(10, 20, "#fff", 1);
    expect(v.consumirEco()).toMatchObject({ x: 10, pies: 20 });
    expect(v.consumirEco()).toBeUndefined();
  });
});
