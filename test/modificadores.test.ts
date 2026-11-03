// Modificadores por pieza: la armadura defiende, los accesorios traen lo único, cada ranura tiene su firma.
// Y la Suerte, que ahora inclina rareza, estrellas de cartas y esquirlas.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { OBJ_POCION, RASGOS_EQUIPO, firmasDe } from "../src/contenido/objetos.ts";
import { cartaAleatoria } from "../src/dominio/cartas.ts";
import { MODIFICADORES_POR_RAREZA, generarEquipo, tirarRarezaEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { RANURAS, piezaDeRanura, type TipoPieza } from "../src/dominio/tipos.ts";

const PIEZAS: readonly TipoPieza[] = [...new Set(RANURAS.map(piezaDeRanura))];
const DEFENSIVOS = ["vidaPct", "defensaPct", "resistencia", "espinas", "regen", "agilidad", "esquiva"];

describe("modificadores por pieza", () => {
  it("las 11 clases de pieza (12 ranuras) tienen al menos 4 modificadores posibles y alguno de firma", () => {
    expect(PIEZAS).toHaveLength(11);
    for (const t of PIEZAS) {
      expect(RASGOS_EQUIPO.filter((r) => r.en.includes(t)).length, t).toBeGreaterThanOrEqual(4);
      expect(firmasDe(t).length, t).toBeGreaterThan(0);
    }
  });

  it("toda pieza con modificadores trae uno de firma y la armadura solo trae defensivos", () => {
    const azar = new AzarSemilla(31);
    for (const t of PIEZAS) {
      for (let i = 0; i < 80; i++) {
        const o = generarEquipo(azar, 6, 1, t);
        const ids = Object.keys(o.rasgos ?? {});
        expect(ids.some((id) => RASGOS_EQUIPO.find((r) => r.id === id)?.firma?.includes(t)), `${t}: ${ids}`).toBe(true);
        if (["casco", "hombros", "pecho", "pantalones", "botas"].includes(t)) {
          for (const id of ids) {
            const ofensivoDeCasco = t === "casco" && ["critico", "enfriamiento", "carga", "tecnicaDanio", "tecnicaCosto", "eterMax"].includes(id);
            const velocidadDeHombros = t === "hombros" && id === "velocidad";
            if (!ofensivoDeCasco && !velocidadDeHombros) expect(DEFENSIVOS, `${t}: ${id}`).toContain(id);
          }
        }
      }
    }
  });

  it("el robo de vida y el enfriamiento solo salen en accesorios", () => {
    for (const id of ["robo", "enfriamiento", "suerte", "codicia"]) {
      const def = RASGOS_EQUIPO.find((r) => r.id === id)!;
      for (const t of def.en) expect(["anillo", "aretes", "collar", "capa", "cinturon", "casco"]).toContain(t);
    }
  });

  it("todas las piezas traen stats al azar: dos iguales no salen idénticas", () => {
    const a = generarEquipo(new AzarSemilla(1), 5, 0, "botas");
    const b = generarEquipo(new AzarSemilla(2), 5, 0, "botas");
    expect(JSON.stringify(a.stats)).not.toBe(JSON.stringify(b.stats));
    expect(Object.keys(a.stats).length).toBeGreaterThan(0);
  });

  it("los modificadores equipados actúan: enfriamiento, robo, cinturón de pociones y esquirlas", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.almas[0] = null;
    p.almas[1] = null;
    const base = p.modificadoresBotin().codicia;
    p.equipo.aretes = { ...generarEquipo(new AzarSemilla(3), 4, 1, "aretes"), rasgos: { enfriamiento: 0.1 } };
    p.equipo.anillo1 = { ...generarEquipo(new AzarSemilla(4), 4, 1, "anillo"), rasgos: { robo: 0.03, suerte: 20 } };
    p.equipo.cinturon = { ...generarEquipo(new AzarSemilla(5), 4, 1, "cinturon"), rasgos: { curaPocion: 0.3, codicia: 0.1 } };
    expect(p.efectoAlma("enfriamiento")).toBeCloseTo(0.1);
    expect(p.combate().robo).toBeGreaterThanOrEqual(0.03);
    expect(p.modificadoresBotin().codicia).toBeGreaterThan(base * 1.1);
    // La poción cura un 30 % más.
    p.hp = 1;
    p.mochila.agregar(OBJ_POCION, 1);
    p.usarPocion();
    expect(p.hp).toBeGreaterThanOrEqual(Math.round(p.stats().hp * 0.45 * 1.3));
  });
});

describe("suerte", () => {
  it("inclina la rareza del equipo hacia arriba", () => {
    const media = (fortuna: number): number => {
      const azar = new AzarSemilla(9);
      let s = 0;
      for (let i = 0; i < 3000; i++) s += tirarRarezaEquipo(azar, 5, 0, fortuna);
      return s / 3000;
    };
    expect(media(150)).toBeGreaterThan(media(0) + 0.3);
  });

  it("puede subir una estrella a las cartas", () => {
    const media = (fortuna: number): number => {
      const azar = new AzarSemilla(10);
      let s = 0;
      for (let i = 0; i < 3000; i++) s += cartaAleatoria(azar, [[2, 1]], fortuna).nivel;
      return s / 3000;
    };
    expect(media(0)).toBe(2);
    expect(media(200)).toBeGreaterThan(2.3);
  });

  it("el modificador Suerte suma al stat", () => {
    const p = new Partida(Meta.nueva(), 1);
    const s0 = p.stats().suerte;
    p.equipo.collar = { ...generarEquipo(new AzarSemilla(6), 4, 1, "collar"), rasgos: { suerte: 15 } };
    expect(p.stats().suerte).toBe(s0 + 15);
    expect(MODIFICADORES_POR_RAREZA[0]).toBe(0);
  });
});
