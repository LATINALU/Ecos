import { describe, expect, test } from "vitest";
import { AzarSemilla } from "minialu";
import { PESO_CAZADOR, bonoPeso, nivelEmboscada, planEmboscada, retrasoCazador, statsCazador } from "../src/dominio/codicia.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { generarEquipo } from "../src/dominio/equipo.ts";
import { OBJ_RELICARIO } from "../src/contenido/objetos.ts";

describe("emboscada de extracción", () => {
  test("cuanto más brilla lo que llevas, más violenta y más larga", () => {
    const pobre = nivelEmboscada({ valor: 200, porRareza: [3, 1, 0, 0, 0, 0], relicarios: 0 });
    const rico = nivelEmboscada({ valor: 9000, porRareza: [0, 0, 1, 2, 3, 2], relicarios: 2 });
    expect(pobre).toBe(0);
    expect(rico).toBe(5);
    expect(planEmboscada(rico).duracion).toBe(20);
    expect(planEmboscada(pobre).duracion).toBe(15);
    expect(planEmboscada(rico).porOleada).toBeGreaterThan(planEmboscada(pobre).porOleada);
    expect(planEmboscada(rico).cadaMano).toBeLessThan(planEmboscada(pobre).cadaMano);
  });

  test("la partida resume su riesgo (sin contar lo espectral)", () => {
    const p = new Partida(Meta.nueva(), 2);
    p.recoger({ tipo: "equipo", equipo: { ...generarEquipo(new AzarSemilla(1), 9, 5), rareza: 5 } });
    p.recoger({ tipo: "equipo", equipo: { ...generarEquipo(new AzarSemilla(2), 9, 5), rareza: 5, espectral: true } });
    p.mochila.agregar(OBJ_RELICARIO, 2);
    const r = p.resumenRiesgo();
    expect(r.porRareza[5]).toBe(1);
    expect(r.relicarios).toBe(2);
  });
});

describe("Peso del Eco", () => {
  test("crece al bajar pisos seguidos, se reinicia al volver a bajar desde el pueblo y se guarda", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 3);
    p.prepararDescenso(1);
    const base = p.modificadoresBotin();
    p.bajarPiso();
    p.bajarPiso();
    expect(p.pesoEco).toBe(2);
    expect(p.modificadoresBotin().suerte).toBeCloseTo(base.suerte * 1.5);
    expect(p.modificadoresBotin().fortuna).toBe((base.fortuna ?? 0) + 50);
    expect(Partida.restaurar(meta, p.serializar()).pesoEco).toBe(2);
    p.prepararDescenso(1);
    expect(p.pesoEco).toBe(0);
  });

  test("los Cazadores llegan antes y son más duros con más Peso", () => {
    expect(bonoPeso(0).relicarioElite).toBe(0);
    expect(retrasoCazador(6)).toBeLessThan(retrasoCazador(PESO_CAZADOR));
    expect(retrasoCazador(99)).toBeGreaterThanOrEqual(35);
    expect(statsCazador(10, 6).hp).toBeGreaterThan(statsCazador(10, 2).hp);
  });
});
