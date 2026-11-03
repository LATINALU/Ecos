// Seis rarezas con modificadores, pasivas míticas, drops nuevos y fusión de cartas con Dados del Destino.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { PASIVAS_MITICAS } from "../src/contenido/miticas.ts";
import { CONSUMIBLES, NOMBRES_RAREZA, OBJ_DADO_BASE, OBJ_LAGRIMA, OBJ_RELICARIO, PRECIO_DADO, dadoParaNivel } from "../src/contenido/objetos.ts";
import { botinEnemigo } from "../src/dominio/botin.ts";
import { NIVEL_MAX_CARTA, crearCarta, fusionarCartas } from "../src/dominio/cartas.ts";
import { comprarEnPueblo } from "../src/dominio/comercio.ts";
import { MODIFICADORES_POR_RAREZA, generarEquipo, normalizarEquipo, type ObjetoEquipo, type Rareza } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { ARMADURAS, ACCESORIOS } from "../src/dominio/tipos.ts";
import { BASES } from "../src/contenido/objetos.ts";

/** Rasgos que vinieron del azar (sin contar los propios de la base, como el Estoque rápido). */
function modificadores(o: ObjetoEquipo): number {
  const base = BASES.find((b) => b.id === o.base)?.rasgos ?? {};
  return Object.keys(o.rasgos ?? {}).filter((k) => !(k in base)).length;
}

describe("seis rarezas", () => {
  it("Común, Poco común, Raro, Épico, Legendario y Mítico", () => {
    expect(NOMBRES_RAREZA).toEqual(["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico"]);
    expect(MODIFICADORES_POR_RAREZA).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it("cada rareza trae exactamente sus modificadores; el Común solo stats y el Mítico una pasiva única", () => {
    const azar = new AzarSemilla(21);
    const vistas = new Set<Rareza>();
    for (let i = 0; i < 1500; i++) {
      const o = generarEquipo(azar, 10, 0);
      vistas.add(o.rareza);
      const n = modificadores(o);
      expect(n, `${o.nombre} (${NOMBRES_RAREZA[o.rareza]})`).toBe(MODIFICADORES_POR_RAREZA[o.rareza]);
      if (o.rareza === 0) expect(o.elemento).toBeUndefined();
      expect(o.pasiva !== undefined).toBe(o.rareza === 5);
    }
    expect([...vistas].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("las pasivas míticas respetan la clase de pieza", () => {
    const azar = new AzarSemilla(5);
    for (let i = 0; i < 200; i++) {
      const o = generarEquipo(azar, 5, 5);
      const def = PASIVAS_MITICAS.find((p) => p.id === o.pasiva)!;
      if (def.en !== undefined) expect(def.en).toContain(o.ranura);
    }
  });

  it("una pasiva mítica equipada actúa en el combate", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.almas[0] = null;
    p.almas[1] = null;
    expect(p.efectoAlma("espinas")).toBe(0);
    p.equipo.pecho = { ...generarEquipo(new AzarSemilla(2), 5, 5, "pecho"), rasgos: {}, pasiva: "espinoNegro" };
    expect(p.efectoAlma("espinas")).toBeCloseTo(0.4);
  });

  it("los guardados viejos (5 rarezas) se migran: Raro sigue Raro y el Único pasa a Mítico", () => {
    const viejo = (r: number): ObjetoEquipo => ({ ...generarEquipo(new AzarSemilla(1), 1, 0), rareza: r as Rareza, v: undefined });
    expect(normalizarEquipo(viejo(1)).rareza).toBe(2);
    expect(normalizarEquipo(viejo(3)).rareza).toBe(4);
    expect(normalizarEquipo(viejo(4)).rareza).toBe(5);
    // Ya migrado: no se vuelve a tocar.
    const nuevo = normalizarEquipo(viejo(2));
    expect(normalizarEquipo(nuevo).rareza).toBe(nuevo.rareza);
  });
});

describe("drops", () => {
  it("las armaduras y accesorios caen tanto como las armas y los guardianes sueltan Épico o mejor", () => {
    const azar = new AzarSemilla(8);
    let armas = 0;
    let armaduras = 0;
    for (let i = 0; i < 2000; i++) {
      for (const p of botinEnemigo(azar, 4, "elite")) {
        if (p.tipo !== "equipo") continue;
        if (p.equipo.ranura === "arma") armas++;
        else if ([...ARMADURAS, ...ACCESORIOS].includes(p.equipo.ranura)) armaduras++;
        expect(p.equipo.rareza).toBeGreaterThanOrEqual(1);
      }
    }
    expect(armaduras).toBeGreaterThan(armas);
    for (let i = 0; i < 30; i++) {
      const jefe = botinEnemigo(azar, 6, "jefe");
      expect(jefe.filter((p) => p.tipo === "equipo" && p.equipo.rareza >= 3).length).toBeGreaterThanOrEqual(2);
      expect(jefe.filter((p) => p.tipo === "objeto" && p.objeto === OBJ_RELICARIO)).toHaveLength(1);
    }
  });
});

describe("fusión de cartas y Dados del Destino", () => {
  it("cartas hasta 12★ y un dado para cada estrella de 4★ a 12★", () => {
    expect(NIVEL_MAX_CARTA).toBe(11);
    for (let n = 2; n < NIVEL_MAX_CARTA; n++) expect(dadoParaNivel(n), `${n + 2}★`).toBeDefined();
    expect(dadoParaNivel(NIVEL_MAX_CARTA)).toBeUndefined();
    expect(CONSUMIBLES.find((c) => c.id === dadoParaNivel(10))?.nombre).toBe("Dado del Destino 12★");
  });

  it("se fusionan tres cartas con las mismas estrellas aunque sean de almas y familias distintas", () => {
    const azar = new AzarSemilla(4);
    const cartas = [crearCarta(azar, 0, 2), crearCarta(azar, 3, 2), crearCarta(azar, 8, 2)] as const;
    expect(new Set(cartas.map((c) => c.tipo)).size).toBeGreaterThan(1);
    const r = fusionarCartas(cartas, azar, true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.carta.nivel).toBe(3);
      expect([0, 3, 8]).toContain(r.valor.carta.personaje);
    }
    const distintas = fusionarCartas([crearCarta(azar, 0, 2), crearCarta(azar, 0, 2), crearCarta(azar, 0, 3)], azar);
    expect(distintas.ok).toBe(false);
  });

  it("los dados se compran en el Bazar (6★ 100, 7★ 300, 8★ 800) y aseguran la fusión de su estrella", () => {
    expect(PRECIO_DADO.slice(2, 5)).toEqual([100, 300, 800]);
    expect(PRECIO_DADO).toHaveLength(9);
    expect(dadoParaNivel(4)).toBe(OBJ_DADO_BASE + 2); // tres de 5★ → 6★
    expect(CONSUMIBLES.find((c) => c.id === OBJ_DADO_BASE + 2)?.nombre).toBe("Dado del Destino 6★");
    const p = new Partida(Meta.nueva(), 1);
    p.billetera.acreditar("esquirlas", 10_000);
    expect(comprarEnPueblo(p, OBJ_DADO_BASE + 2).ok).toBe(true);
    // Tres cartas de 5★ al mazo y fusión asegurada con el dado.
    for (const id of [1, 5, 9]) p.recoger({ tipo: "carta", carta: crearCarta(new AzarSemilla(id), id, 4) });
    const pos = [...p.mazo.posiciones()].filter((q) => (p.mazo.en(q)?.extra?.carta as { nivel: number } | undefined)?.nivel === 4);
    expect(pos).toHaveLength(3);
    const r = p.fusionar([pos[0], pos[1], pos[2]], true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.carta.nivel).toBe(5);
    expect(p.mochila.contar(OBJ_DADO_BASE + 2)).toBe(0);
    expect(p.mochila.contar(OBJ_LAGRIMA)).toBe(0);
  });
});
