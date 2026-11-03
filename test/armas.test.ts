import { describe, expect, it } from "vitest";
import { ESTILOS, ORDEN_ESTILOS } from "../src/contenido/armas.ts";
import { BASES, UNICOS, estiloDe } from "../src/contenido/objetos.ts";

describe("Cuatro familias de armas", () => {
  it("solo espada, mazo, báculo y arco se eligen", () => {
    expect([...ORDEN_ESTILOS].sort()).toEqual(["arco", "baston", "espada", "pesada"]);
  });

  it("no hay armas de puños (solo 'sin arma')", () => {
    const armas = [...BASES, ...UNICOS].filter((b) => b.ranura === "arma");
    expect(armas.every((b) => b.estilo !== "punos")).toBe(true);
    expect(estiloDe(undefined)).toBe("punos");
    expect(estiloDe(101)).toBe("espada");
  });

  it("cada familia tiene su alcance y dos pasivas de ataque", () => {
    const alcances = ORDEN_ESTILOS.map((id) => ESTILOS[id].alcance);
    expect(new Set(alcances).size).toBe(4);
    for (const id of ORDEN_ESTILOS) expect(ESTILOS[id].pasivas.length).toBe(2);
    expect(ESTILOS.pesada.alcance).toBeGreaterThan(ESTILOS.espada.alcance);
    expect(ESTILOS.arco.alcance).toBeGreaterThan(100);
  });
});
