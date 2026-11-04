import { describe, expect, test } from "vitest";
import { bonoPeso, nivelFrenesi, planFrenesi } from "../src/dominio/codicia.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";

describe("frenesí de arena", () => {
  test("más violento en pisos hondos, oleadas avanzadas y el Juicio", () => {
    expect(nivelFrenesi(2, 1)).toBe(0);
    expect(nivelFrenesi(14, 3)).toBeGreaterThan(nivelFrenesi(2, 1));
    expect(nivelFrenesi(2, 1, 10)).toBeGreaterThan(nivelFrenesi(2, 1));
    expect(nivelFrenesi(99, 99, 99)).toBe(5);
    const suave = planFrenesi(0);
    const feroz = planFrenesi(5);
    expect(feroz.porOleada).toBeGreaterThan(suave.porOleada);
    expect(feroz.cadaMano).toBeLessThan(suave.cadaMano);
    expect(feroz.tope).toBeLessThanOrEqual(8);
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

  test("sin Peso no hay bono", () => {
    expect(bonoPeso(0).relicarioElite).toBe(0);
    expect(bonoPeso(99).suerte).toBe(bonoPeso(8).suerte);
  });
});
