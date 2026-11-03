import { describe, expect, test } from "vitest";
import { Colgante, Patas, rodillaIK } from "../src/juego/procedural.ts";

describe("cinemática inversa de dos huesos", () => {
  test("la rodilla respeta el largo de cada hueso cuando el pie está al alcance", () => {
    for (const [fx, fy] of [[5, 14], [-6, 12], [0, 17], [10, 8]] as const) {
      const k = rodillaIK(0, 0, fx, fy, 9, 9, 1);
      expect(Math.hypot(k.x, k.y)).toBeCloseTo(9, 4);
      expect(Math.hypot(fx - k.x, fy - k.y)).toBeCloseTo(9, 4);
    }
  });

  test("el doblez elige hacia qué lado sale la rodilla", () => {
    const a = rodillaIK(0, 0, 0, 12, 9, 9, 1);
    const b = rodillaIK(0, 0, 0, 12, 9, 9, -1);
    expect(Math.sign(a.x)).toBe(-Math.sign(b.x));
  });

  test("si el pie está fuera de alcance, la pata se estira hacia él sin romperse", () => {
    const k = rodillaIK(0, 0, 0, 100, 9, 9, 1);
    expect(Math.hypot(k.x, k.y)).toBeCloseTo(9, 3);
    expect(k.y).toBeGreaterThan(8);
  });
});

describe("patas que caminan", () => {
  test("los pies quedan plantados en el suelo y dan pasos cuando el cuerpo se aleja", () => {
    const p = new Patas([{ dx: -8, dy: 6 }, { dx: 8, dy: 6 }], 9, 9, 12);
    let x = 100;
    p.actualizar(x, 50, 70, 0, 0.016);
    const pies = (): { x: number; y: number }[] => (p as unknown as { pies: { x: number; y: number }[] }).pies;
    const inicio = pies().map((f) => f.x);
    for (let i = 0; i < 120; i++) {
      x += 1;
      p.actualizar(x, 50, 70, 60, 0.016);
    }
    // Avanzaron con el cuerpo…
    pies().forEach((f, i) => expect(f.x).toBeGreaterThan(inicio[i] + 60));
    // …y siguen cerca de su cadera.
    pies().forEach((f) => expect(Math.abs(f.x - x)).toBeLessThan(40));
  });
});

describe("colgantes con física", () => {
  test("la cadena queda anclada, cuelga hacia abajo y conserva su largo", () => {
    const c = new Colgante({ tipo: "cadena", x: 50, y: 32, largo: 30 });
    for (let i = 0; i < 300; i++) c.actualizar(1 / 60, i / 60);
    const nodos = c.nodos;
    expect(nodos[0].x).toBeCloseTo(50);
    expect(nodos[0].y).toBeCloseTo(32);
    const fin = nodos[nodos.length - 1];
    expect(fin.y).toBeGreaterThan(32 + 25);
    let largo = 0;
    for (let i = 1; i < nodos.length; i++) largo += Math.hypot(nodos[i].x - nodos[i - 1].x, nodos[i].y - nodos[i - 1].y);
    expect(largo).toBeGreaterThan(27);
    expect(largo).toBeLessThan(33);
  });

  test("empujarla la mueve y después vuelve a colgar", () => {
    const c = new Colgante({ tipo: "estandarte", x: 50, y: 32, largo: 40 });
    for (let i = 0; i < 120; i++) c.actualizar(1 / 60, 0);
    const fin = (): { x: number; y: number } => c.nodos[c.nodos.length - 1];
    c.empujar(0, 0, 200, 200, 400, 0);
    for (let i = 0; i < 5; i++) c.actualizar(1 / 60, 0);
    expect(fin().x).toBeGreaterThan(52);
    for (let i = 0; i < 600; i++) c.actualizar(1 / 60, 0);
    expect(Math.abs(fin().x - 50)).toBeLessThan(8);
  });
});
