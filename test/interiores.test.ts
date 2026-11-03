import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { todasLasPlantillas } from "../src/contenido/plantillas.ts";
import { generarInterior, validarInterior } from "../src/dominio/mundo/interiores.ts";

describe("interiores procedurales", () => {
  it("las plantillas hechas a mano se cruzan de puerta a puerta (sus plataformas altas pueden pedir Doble Salto)", () => {
    for (const p of todasLasPlantillas()) expect(validarInterior(p.filas, false), p.nombre).toEqual([]);
  });

  it("500 salas generadas: todas válidas, recorribles y con enemigos", () => {
    const nombres = new Set<string>();
    const distintas = new Set<string>();
    let fallidas = 0;
    for (let s = 1; s <= 500; s++) {
      const i = generarInterior(new AzarSemilla(s * 7919));
      if (i === null) {
        fallidas++;
        continue;
      }
      // Los enemigos no rompen las reglas (son casillas libres).
      expect(validarInterior(i.filas), `semilla ${s}\n${i.filas.join("\n")}`).toEqual([]);
      expect(i.filas.join("")).toMatch(/[egstv]/);
      nombres.add(i.nombre);
      distintas.add(i.filas.join("\n"));
    }
    expect(fallidas).toBeLessThan(5);
    expect(distintas.size).toBeGreaterThan(480);
    expect(nombres.size).toBeGreaterThan(10);
  });

  it("misma semilla, misma sala", () => {
    expect(generarInterior(new AzarSemilla(99))).toEqual(generarInterior(new AzarSemilla(99)));
  });
});
