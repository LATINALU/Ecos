import { describe, expect, test } from "vitest";
import { COLISIONA, MANCHA, SistemaParticulas } from "../src/motor/particulas.ts";
import { TrazoArma } from "../src/motor/trazos.ts";
import { CuerdaVerlet } from "../src/motor/verlet.ts";
import { rgbDe } from "../src/motor/postfx.ts";
import type { CapaCicatrices } from "../src/motor/superficie.ts";

const sueloEn = (y0: number) => (_x: number, y: number): boolean => y >= y0;

describe("partículas SOA", () => {
  test("caen, rebotan contra el suelo y nunca lo atraviesan", () => {
    const p = new SistemaParticulas(100);
    p.emitir({ x: 50, y: 10, cantidad: 20, color: "#fff", velocidad: [10, 60], vida: [5, 5], flags: COLISIONA, rebote: 0.5 });
    for (let k = 0; k < 240; k++) {
      p.actualizar(1 / 60, sueloEn(100));
      for (let i = 0; i < p.activas; i++) expect(p.posicion(i).y).toBeLessThan(100);
    }
    expect(p.activas).toBe(20);
  });

  test("las que manchan pintan la superficie al tocarla y se funden con la piedra", () => {
    const p = new SistemaParticulas(100);
    const manchas: [number, number][] = [];
    const cic = { liquido: (x: number, y: number) => void manchas.push([x, y]) } as unknown as CapaCicatrices;
    p.emitir({ x: 50, y: 90, cantidad: 10, color: "#a00", velocidad: [0, 1], angulo: [Math.PI / 2, Math.PI / 2], vida: [3, 3], flags: COLISIONA | MANCHA, rebote: 0.2 });
    for (let k = 0; k < 120; k++) p.actualizar(1 / 60, sueloEn(100), cic);
    expect(manchas.length).toBeGreaterThan(0);
    expect(manchas.every(([, y]) => y >= 100)).toBe(true);
    expect(p.activas).toBe(0);
  });

  test("al morir, la última ocupa su lugar (swap-and-pop) y el tope se respeta", () => {
    const p = new SistemaParticulas(50);
    p.emitir({ x: 0, y: 0, cantidad: 80, color: "#fff", velocidad: [0, 0], vida: [0.1, 0.1], flags: 0 });
    expect(p.activas).toBe(50);
    for (let k = 0; k < 20; k++) p.actualizar(1 / 60, sueloEn(9999));
    expect(p.activas).toBe(0);
  });
});

describe("trazo del arma", () => {
  test("guarda las muestras en anillo y las olvida con el tiempo (más con más estilo)", () => {
    const t = new TrazoArma(6, 0.1);
    for (let k = 0; k < 9; k++) t.muestra(0, 0, k, k);
    expect(t.cantidad).toBe(6);
    t.actualizar(0.05, 0);
    expect(t.cantidad).toBe(6);
    t.actualizar(0.06, 0);
    expect(t.cantidad).toBe(0);
    for (let k = 0; k < 4; k++) t.muestra(0, 0, k, k);
    t.actualizar(0.105, 6);
    expect(t.cantidad).toBe(4);
  });
});

describe("cuerda Verlet", () => {
  test("anclada arriba, cuelga con su largo y responde a un impulso", () => {
    const c = new CuerdaVerlet({ x: 10, y: 0, segmentos: 6, largoSegmento: 4, iteraciones: 8 });
    for (let k = 0; k < 300; k++) c.actualizar(1 / 60);
    expect(c.x[0]).toBe(10);
    expect(c.y[c.n - 1]).toBeGreaterThan(20);
    let largo = 0;
    for (let i = 1; i < c.n; i++) largo += Math.hypot(c.x[i] - c.x[i - 1], c.y[i] - c.y[i - 1]);
    expect(largo).toBeCloseTo(24, 0);
    c.impulso(0, c.y[c.n - 1], 30, 600);
    c.actualizar(1 / 60);
    expect(c.x[c.n - 1]).toBeGreaterThan(10);
  });
});

describe("colores para el compositor", () => {
  test("hex largos y cortos a RGB 0..1", () => {
    expect(rgbDe("#ff0000")).toEqual([1, 0, 0]);
    expect(rgbDe("#0f0")).toEqual([0, 1, 0]);
    expect(rgbDe(undefined)).toHaveLength(3);
  });
});
