import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import {
  PIEDAD_SALIDA, ZONAS_ABISMO, biomaAbismo, cicloAbismo, hayGuardianAbismo, iniciosAbismo, probSalida, tirarSalida,
} from "../src/dominio/abismo.ts";
import { BIOMAS, statsJefe } from "../src/contenido/biomas.ts";
import { generarPiso } from "../src/dominio/mundo/generador.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";

describe("Abismo (pozo sin fin)", () => {
  it("recorre las zonas en ciclos sin el Corazón y escala al guardián", () => {
    expect(ZONAS_ABISMO).toBe(BIOMAS.length - 1);
    expect(biomaAbismo(1).nombre).toBe(BIOMAS[0].nombre);
    expect(biomaAbismo(ZONAS_ABISMO + 1).nombre).toBe(BIOMAS[0].nombre);
    expect(cicloAbismo(ZONAS_ABISMO)).toBe(1);
    expect(cicloAbismo(ZONAS_ABISMO + 1)).toBe(2);
    expect(biomaAbismo(60).jefe.hp).toBe(statsJefe(60).hp);
    expect(biomaAbismo(60).jefe.hp).toBeGreaterThan(biomaAbismo(30).jefe.hp);
  });

  it("guardián cada 5 pisos e inicios desbloqueables", () => {
    expect(hayGuardianAbismo(5)).toBe(true);
    expect(hayGuardianAbismo(6)).toBe(false);
    expect(iniciosAbismo(1)).toEqual([1]);
    expect(iniciosAbismo(11)).toEqual([1, 6, 11]);
  });

  it("las salidas escasean con la profundidad pero la piedad garantiza una", () => {
    expect(probSalida(40)).toBeLessThan(probSalida(1));
    expect(probSalida(500)).toBeGreaterThan(0.1);
    const azar = new AzarSemilla(1);
    for (let i = 0; i < 50; i++) expect(tirarSalida(azar, 100, PIEDAD_SALIDA)).toBe(true);
  });

  it("el generador respeta la cantidad de salidas y las esconde lejos", () => {
    for (let semilla = 1; semilla < 30; semilla++) {
      const base = { piso: 30, cantidadSalas: 16, ancho: 9, alto: 6, reliquiasPoseidas: [], hayEco: false } as const;
      const sin = generarPiso(new AzarSemilla(semilla), { ...base, salidas: 0 });
      expect(sin.extracciones).toEqual([]);
      const con = generarPiso(new AzarSemilla(semilla), { ...base, salidas: 1 });
      expect(con.extracciones?.length).toBe(1);
      expect(con.extracciones?.[0]).not.toBe(con.inicio);
    }
  });

  it("Partida guarda el modo, la piedad y el desbloqueo", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 7);
    p.prepararDescenso(11, true);
    expect(p.piso).toBe(1); // aún no desbloqueado
    expect(p.desbloquearAbismo(10)).toBe(true);
    p.prepararDescenso(11, true);
    expect(p.piso).toBe(11);
    p.pisosSinSalida = 2;
    const r = Partida.restaurar(meta, p.serializar());
    expect(r.abismo).toBe(true);
    expect(r.pisosSinSalida).toBe(2);
    expect(r.abismoDesbloqueado).toBe(11);
    r.prepararDescenso(3, false);
    expect(r.abismo).toBe(false);
  });
});
