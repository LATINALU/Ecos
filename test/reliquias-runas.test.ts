// Reliquias nuevas (8 en total, repartidas por la partida) y runas con rareza (16 runas × 4 rarezas).

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { COSTO_FUSION_RUNA, MULT_RUNA, OBJ_POCION, RUNAS, objetoRuna, runaDeObjeto } from "../src/contenido/objetos.ts";
import { tirarRarezaRuna } from "../src/dominio/botin.ts";
import { fusionarRunas } from "../src/dominio/crafteo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { PISOS_RELIQUIA, RELIQUIAS } from "../src/dominio/tipos.ts";

describe("reliquias", () => {
  it("son 8 y salen a lo largo de la partida (pisos 1, 2, 3, 5, 8, 12, 16 y 20)", () => {
    expect(RELIQUIAS).toHaveLength(8);
    expect(PISOS_RELIQUIA).toEqual([1, 2, 3, 5, 8, 12, 16, 20]);
    const meta = Meta.nueva();
    expect(meta.reliquiaParaPiso(4)).toBeUndefined();
    for (const r of RELIQUIAS.slice(0, 3)) meta.otorgarReliquia(r);
    expect(meta.reliquiaParaPiso(5)).toBe("botasCefiro");
  });

  it("cada una mejora algo concreto", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    const agil = p.combate().agilidad;
    const codicia = p.modificadoresBotin().codicia;
    meta.otorgarReliquia("botasCefiro");
    meta.otorgarReliquia("manoAvaro");
    expect(p.combate().agilidad).toBeCloseTo(agil + 0.12);
    expect(p.modificadoresBotin().codicia).toBeCloseTo(codicia * 1.25);
    // Corazón del Eco: una poción extra al bajar.
    meta.otorgarReliquia("corazonEco");
    const pociones = p.mochila.contar(OBJ_POCION);
    p.prepararDescenso(1);
    expect(p.mochila.contar(OBJ_POCION)).toBe(pociones + 1);
    // Lágrima del Pozo: la Definitiva empieza al 40 %.
    meta.otorgarReliquia("lagrimaPozo");
    p.almas[4] = p.almas[0];
    p.prepararDescenso(1);
    expect(p.cargaDefinitiva).toBe(40);
  });
});

describe("runas con rareza", () => {
  it("16 runas; cada una existe en 4 rarezas con ids distintos (las Comunes conservan el id viejo)", () => {
    expect(RUNAS).toHaveLength(16);
    expect(objetoRuna("brasa", 0)).toBe(300);
    const ids = new Set<number>();
    for (const r of RUNAS) {
      for (let n = 0; n <= 3; n++) {
        const id = objetoRuna(r.id, n);
        ids.add(id);
        const vuelta = runaDeObjeto(id)!;
        expect(vuelta.id).toBe(r.id);
        expect(vuelta.nivel).toBe(n);
      }
    }
    expect(ids.size).toBe(64);
  });

  it("la rareza multiplica el efecto", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    const def0 = p.stats().defensa;
    p.mochila.agregar(objetoRuna("acero", 0), 1);
    p.engarzarRuna([...p.mochila.posiciones()].find((q) => p.mochila.en(q)?.objeto === 303)!, 0);
    const comun = p.stats().defensa - def0;
    p.quitarRuna(0);
    p.mochila.agregar(objetoRuna("acero", 3), 1);
    const pos = [...p.mochila.posiciones()].find((q) => p.mochila.en(q)?.objeto === objetoRuna("acero", 3))!;
    expect(p.engarzarRuna(pos, 0).ok).toBe(true);
    expect(p.stats().defensa - def0).toBeGreaterThan(comun * 2.5);
    expect(p.potenciaRuna("acero")).toBe(MULT_RUNA[3]);
    // Y se guarda con la partida.
    const q = Partida.restaurar(meta, JSON.parse(JSON.stringify(p.serializar())));
    expect(q.potenciaRuna("acero")).toBe(MULT_RUNA[3]);
  });

  it("las runas nuevas actúan (Verdugo: daño crítico)", () => {
    const p = new Partida(Meta.nueva(), 1);
    const base = p.combate().critDanio;
    p.mochila.agregar(objetoRuna("verdugo", 1), 1);
    p.engarzarRuna([...p.mochila.posiciones()].find((q) => p.mochila.en(q)?.objeto === objetoRuna("verdugo", 1))!, 1);
    expect(p.combate().critDanio).toBeCloseTo(base + 0.22 * 1.5);
  });

  it("tres runas iguales se funden en una de la rareza siguiente (cuesta esquirlas)", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.billetera.acreditar("esquirlas", COSTO_FUSION_RUNA[0]);
    p.mochila.agregar(objetoRuna("tormenta", 0), 3);
    expect(fusionarRunas(p, objetoRuna("tormenta", 0)).ok).toBe(true);
    expect(p.mochila.contar(objetoRuna("tormenta", 0))).toBe(0);
    expect(p.mochila.contar(objetoRuna("tormenta", 1))).toBe(1);
    expect(p.esquirlas).toBe(0);
    expect(fusionarRunas(p, objetoRuna("tormenta", 1)).ok).toBe(false);
  });

  it("las runas caen más raras cuanto más hondo", () => {
    const media = (piso: number): number => {
      const azar = new AzarSemilla(3);
      let s = 0;
      for (let i = 0; i < 3000; i++) s += tirarRarezaRuna(azar, piso);
      return s / 3000;
    };
    expect(media(20)).toBeGreaterThan(media(1) + 0.4);
  });
});
