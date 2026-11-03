// Extracción estilo Tarkov, armas elementales, capa y accesorios con rasgos únicos.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { AFINIDAD_ZONA, ELEMENTOS, afinidadPiso, multiplicadorElemental } from "../src/contenido/elementos.ts";
import { RASGOS_EQUIPO } from "../src/contenido/objetos.ts";
import { kitRecluta, tieneArma } from "../src/dominio/comercio.ts";
import { generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { generarPiso } from "../src/dominio/mundo/generador.ts";
import { Partida } from "../src/dominio/partida.ts";
import { ACCESORIOS, ARMADURAS } from "../src/dominio/tipos.ts";

describe("zonas de extracción", () => {
  it("cada piso tiene 1~2 extracciones en salas normales, nunca en el inicio ni en el guardián", () => {
    const azar = new AzarSemilla(11);
    for (let piso = 1; piso <= 10; piso++) {
      const mapa = generarPiso(azar, { piso, cantidadSalas: 12, ancho: 7, alto: 5, reliquiasPoseidas: [], hayEco: piso % 2 === 0 });
      const ex = mapa.extracciones ?? [];
      expect(ex.length).toBeGreaterThanOrEqual(1);
      expect(ex.length).toBeLessThanOrEqual(2);
      for (const id of ex) {
        expect(id).not.toBe(mapa.inicio);
        expect(id).not.toBe(mapa.jefe);
        expect(mapa.salas[id].tipo).toBe("normal");
      }
    }
  });
});

describe("armas elementales", () => {
  it("todos los estilos pueden salir con los 4 elementos; nombre y potencia acordes", () => {
    const azar = new AzarSemilla(4);
    const vistos = new Set<string>();
    for (let i = 0; i < 800; i++) {
      const a = generarEquipo(azar, 5, 1, "arma");
      if (a.elemento === undefined) continue;
      vistos.add(a.elemento);
      expect(a.nombre).toContain(ELEMENTOS[a.elemento].sufijo);
    }
    expect([...vistos].sort()).toEqual(["fuego", "hielo", "rayo", "veneno"]);
    // Las armaduras nunca son elementales.
    for (let i = 0; i < 100; i++) expect(generarEquipo(azar, 5, 2, ARMADURAS).elemento).toBeUndefined();
  });

  it("el arma equipada da su elemento y la potencia sube con anillos de daño elemental", () => {
    const p = new Partida(Meta.nueva(), 1);
    expect(p.elementoArma()).toBeNull();
    p.equipo.arma = { ...p.equipo.arma!, elemento: "hielo", rareza: 2 };
    const base = p.elementoArma()!;
    expect(base.elemento).toBe("hielo");
    p.equipo.anillo1 = { ...generarEquipo(new AzarSemilla(1), 3, 0, "anillo"), rasgos: { elemental: 0.2 } };
    expect(p.elementoArma()!.potencia).toBeCloseTo(base.potencia + 0.2);
  });

  it("cada zona resiste un elemento y es débil a otro", () => {
    expect(AFINIDAD_ZONA).toHaveLength(10);
    for (let piso = 1; piso <= 10; piso++) {
      const [resiste, debil] = afinidadPiso(piso);
      expect(resiste).not.toBe(debil);
      expect(multiplicadorElemental(resiste, resiste, debil)).toBeLessThan(1);
      expect(multiplicadorElemental(debil, resiste, debil)).toBeGreaterThan(1);
    }
  });
});

describe("capa y accesorios", () => {
  it("capa, anillos, aretes y collar siempre traen un rasgo único de su clase", () => {
    const azar = new AzarSemilla(9);
    for (const tipo of ACCESORIOS) {
      for (let i = 0; i < 60; i++) {
        const o = generarEquipo(azar, 4, 0, tipo);
        const unicos = Object.keys(o.rasgos ?? {}).filter((id) => RASGOS_EQUIPO.find((r) => r.id === id)?.unicoDe?.includes(tipo));
        expect(unicos.length, `${tipo}: ${JSON.stringify(o.rasgos)}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("la capa da esquiva y resistencia al combate (con tope)", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.equipo.capa = { ...generarEquipo(new AzarSemilla(2), 3, 0, "capa"), rasgos: { esquiva: 0.08, resistencia: 0.1 } };
    expect(p.combate().esquiva).toBeCloseTo(0.08);
    expect(p.combate().resistencia).toBeCloseTo(0.1);
    p.equipo.collar = { ...generarEquipo(new AzarSemilla(3), 3, 0, "collar"), rasgos: { resistencia: 0.5 } };
    expect(p.combate().resistencia).toBe(0.4);
  });
});

describe("kit de recluta", () => {
  it("solo se entrega si no tienes ningún arma", () => {
    const p = new Partida(Meta.nueva(), 1);
    expect(kitRecluta(p, new AzarSemilla(1), "arco").ok).toBe(false);
    p.perderTodo();
    expect(tieneArma(p)).toBe(false);
    const r = kitRecluta(p, new AzarSemilla(1), "arco");
    expect(r.ok).toBe(true);
    expect(p.estilo().id).toBe("arco");
    expect(kitRecluta(p, new AzarSemilla(1), "espada").ok).toBe(false);
  });
});
