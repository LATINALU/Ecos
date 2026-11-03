import { describe, expect, test } from "vitest";
import { AzarSemilla } from "minialu";
import { PLANTILLAS_NORMALES, plantillaPara } from "../src/contenido/plantillas.ts";
import { escalonarParaSaltoSimple, validarInterior } from "../src/dominio/mundo/interiores.ts";
import { barrerasPermitidas, esValido, generarPiso, podarBarreras } from "../src/dominio/mundo/generador.ts";
import { construirSala, indice, T_PLATAFORMA } from "../src/dominio/mundo/sala.ts";
import type { Reliquia } from "../src/dominio/tipos.ts";

// Nadie se queda atorado: lo que bloquea el paso solo aparece si el Portador ya puede superarlo
// o va a encontrar en ese mismo piso con qué hacerlo.

const ESPECIALES = ["inicio", "altar", "tesoro", "reliquia", "mercader", "eco", "jefe"] as const;

describe("salas sin Doble Salto", () => {
  test("toda plantilla hecha a mano queda recorrible con salto simple al escalonarla", () => {
    const todas = [...PLANTILLAS_NORMALES, ...ESPECIALES.map((t) => plantillaPara(t, 1))];
    for (const p of todas) {
      const adaptada = escalonarParaSaltoSimple(p.filas);
      expect(validarInterior(adaptada, true), p.nombre).toEqual([]);
      // No borra nada: solo agrega plataformas donde había aire.
      adaptada.forEach((f, y) => {
        for (let x = 0; x < f.length; x++) if (f[x] !== p.filas[y][x]) expect([p.filas[y][x], f[x]]).toEqual([".", "="]);
      });
    }
  });

  test("la arena del jefe tiene escalones solo si no tienes Doble Salto", () => {
    const contar = (tiles: Uint8Array): number => tiles.filter((t) => t === T_PLATAFORMA).length;
    const con = construirSala("jefe", 1, { izq: {} }, new AzarSemilla(1), 0, { dobleSalto: true });
    const sin = construirSala("jefe", 1, { izq: {} }, new AzarSemilla(1), 0, { dobleSalto: false });
    expect(contar(sin.tiles)).toBeGreaterThan(contar(con.tiles));
    // Las cornisas altas originales siguen ahí.
    expect(sin.tiles[indice(5, 7)]).toBe(T_PLATAFORMA);
  });

  test("las salas generadas no cambian (ya cumplen el salto simple)", () => {
    for (let s = 1; s < 40; s++) {
      if (s % 4 === 0) continue;
      const p = plantillaPara("normal", s);
      expect(escalonarParaSaltoSimple(p.filas)).toEqual([...p.filas]);
    }
  });
});

describe("barreras según las reliquias", () => {
  test("solo se permiten barreras de reliquias tenidas o del piso", () => {
    expect(barrerasPermitidas([])).toEqual([]);
    expect(barrerasPermitidas([], "embestida")).toEqual(["cristal"]);
    expect(barrerasPermitidas(["embestida"], "dobleSalto")).toEqual(["cristal"]);
    expect(barrerasPermitidas(["embestida", "garraIgnea"]).sort()).toEqual(["cristal", "raices"]);
  });

  test("un piso nunca pide una reliquia que no tienes ni está en él, y todo lo importante se alcanza", () => {
    const casos: { poseidas: Reliquia[]; aColocar?: Reliquia }[] = [
      { poseidas: [], aColocar: "embestida" },
      { poseidas: ["embestida"], aColocar: "dobleSalto" },
      { poseidas: ["embestida", "dobleSalto"], aColocar: "garraIgnea" },
      { poseidas: ["embestida"] },
      { poseidas: [] },
    ];
    for (const caso of casos) {
      for (let semilla = 1; semilla <= 60; semilla++) {
        const mapa = generarPiso(new AzarSemilla(semilla), {
          piso: 2, cantidadSalas: 12, ancho: 7, alto: 5, reliquiasPoseidas: caso.poseidas, reliquiaAColocar: caso.aColocar, hayEco: false, probBarrera: 0.6,
        });
        const llaves = new Set<Reliquia>(caso.poseidas);
        for (const s of mapa.salas) if (s.reliquia !== undefined) llaves.add(s.reliquia);
        for (const c of mapa.conexiones) {
          if (c.barrera === "raices") expect(llaves.has("garraIgnea")).toBe(true);
          if (c.barrera === "cristal") expect(llaves.has("embestida")).toBe(true);
        }
        expect(esValido(mapa, caso.poseidas)).toBe(true);
      }
    }
  });

  test("las salidas del Abismo siempre se alcanzan", () => {
    for (let semilla = 1; semilla <= 60; semilla++) {
      const mapa = generarPiso(new AzarSemilla(semilla), {
        piso: 30, cantidadSalas: 20, ancho: 9, alto: 6, reliquiasPoseidas: ["embestida"], hayEco: false, salidas: 1, probBarrera: 0.6,
      });
      expect(esValido(mapa, ["embestida"])).toBe(true);
    }
  });

  test("podarBarreras limpia descensos guardados con barreras imposibles", () => {
    const mapa = generarPiso(new AzarSemilla(3), {
      piso: 2, cantidadSalas: 12, ancho: 7, alto: 5, reliquiasPoseidas: ["embestida", "garraIgnea"], hayEco: false, probBarrera: 0.9,
    });
    expect(mapa.conexiones.some((c) => c.barrera === "raices")).toBe(true);
    podarBarreras(mapa, ["embestida"]);
    expect(mapa.conexiones.some((c) => c.barrera === "raices")).toBe(false);
    expect(mapa.conexiones.some((c) => c.barrera === "cristal")).toBe(true);
  });
});
