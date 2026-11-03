// Expansión: 10 zonas con jefe, runas, conjuntos, refinado con riesgo, talentos 4×4 y stats nuevos.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { BIOMAS, PISOS_TOTALES, escalaEnemigo } from "../src/contenido/biomas.ts";
import { CONJUNTOS, conjuntoDelPiso } from "../src/contenido/conjuntos.ts";
import { MAT_FRAGMENTO, RUNAS } from "../src/contenido/objetos.ts";
import { ANIMACIONES_CRIATURAS } from "../src/contenido/sprites.generado.ts";
import { TALENTOS } from "../src/contenido/talentos.ts";
import { botinEnemigo } from "../src/dominio/botin.ts";
import { refinarEquipado } from "../src/dominio/crafteo.ts";
import { generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";

describe("zonas y jefes", () => {
  it("hay al menos 10 zonas, cada una con nombre, fondo y guardián propios", () => {
    expect(PISOS_TOTALES).toBeGreaterThanOrEqual(10);
    expect(new Set(BIOMAS.map((b) => b.nombre)).size).toBe(BIOMAS.length);
    expect(new Set(BIOMAS.map((b) => b.jefe.nombre)).size).toBe(BIOMAS.length);
    expect(new Set(BIOMAS.map((b) => b.fondo)).size).toBe(BIOMAS.length);
  });

  it("los jefes configurables tienen forma y ataques; los sprites de cada zona existen", () => {
    for (const b of BIOMAS) {
      if (b.jefe.id === "configurable") {
        expect(b.jefe.forma, b.nombre).toBeDefined();
        expect(b.jefe.patrones?.length ?? 0).toBeGreaterThanOrEqual(3);
      }
      for (const s of Object.values(b.sprites)) {
        expect(ANIMACIONES_CRIATURAS[`${s}_idle`], `${b.nombre}: ${s}`).toBeDefined();
      }
    }
  });

  it("los jefes y los monstruos se vuelven más fuertes piso a piso", () => {
    for (let i = 1; i < BIOMAS.length; i++) {
      expect(BIOMAS[i].jefe.hp).toBeGreaterThan(BIOMAS[i - 1].jefe.hp);
      expect(escalaEnemigo(i + 1).hp).toBeGreaterThan(escalaEnemigo(i).hp);
    }
  });

  it("cada guardián suelta una runa y una pieza del conjunto de su zona", () => {
    const azar = new AzarSemilla(3);
    for (let piso = 1; piso <= 10; piso++) {
      const botin = botinEnemigo(azar, piso, "jefe");
      expect(botin.some((p) => p.tipo === "objeto" && RUNAS.some((r) => r.objeto === p.objeto))).toBe(true);
      expect(botin.some((p) => p.tipo === "equipo" && p.equipo.conjunto === conjuntoDelPiso(piso).id)).toBe(true);
    }
  });
});

describe("runas", () => {
  it("se engarzan, no se repiten y cambian los stats", () => {
    const p = new Partida(Meta.nueva(), 1);
    const def = p.stats().defensa;
    p.mochila.agregar(303, 1); // Runa de Acero
    p.mochila.agregar(303, 1);
    const pos = [...p.mochila.posiciones()].filter((q) => p.mochila.en(q)?.objeto === 303);
    expect(p.engarzarRuna(pos[0], 0).ok).toBe(true);
    expect(p.stats().defensa).toBeGreaterThan(def);
    const r = p.engarzarRuna(pos[1], 1);
    expect(r.ok ? null : r.error).toBe("repetida");
    expect(p.quitarRuna(0).ok).toBe(true);
    expect(p.stats().defensa).toBe(def);
  });

  it("se guardan con la partida", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    p.runas = ["viento", "furia"];
    const q = Partida.restaurar(meta, JSON.parse(JSON.stringify(p.serializar())));
    expect(q.runas).toEqual(["viento", "furia"]);
  });
});

describe("conjuntos", () => {
  it("2 piezas activan el primer bono, 4 el segundo y el set completo de 6 el tercero", () => {
    const azar = new AzarSemilla(5);
    const p = new Partida(Meta.nueva(), 1);
    const c = CONJUNTOS.find((x) => x.id === "astral")!;
    const critBase = p.stats().critico;
    // Las armas y joyas no pueden ser de conjunto.
    p.equipo.arma = generarEquipo(azar, 9, 2, "arma", "astral");
    expect(p.equipo.arma.conjunto).toBeUndefined();
    p.equipo.pecho = generarEquipo(azar, 9, 2, "pecho", "astral");
    expect(p.bonosConjunto()).toHaveLength(0);
    p.equipo.casco = generarEquipo(azar, 9, 2, "casco", "astral");
    expect(p.bonosConjunto()).toEqual([c.dos]);
    expect(p.stats().critico).toBeGreaterThanOrEqual(critBase + 15);
    p.equipo.botas = generarEquipo(azar, 9, 2, "botas", "astral");
    expect(p.bonosConjunto()).toHaveLength(1);
    p.equipo.cinturon = generarEquipo(azar, 9, 2, "cinturon", "astral");
    expect(p.bonosConjunto()).toHaveLength(2);
    expect(p.combate().critDanio).toBeGreaterThanOrEqual(0.6);
    const danio = p.multiplicadorDanio();
    p.equipo.hombros = generarEquipo(azar, 9, 2, "hombros", "astral");
    p.equipo.pantalones = generarEquipo(azar, 9, 2, "pantalones", "astral");
    expect(p.bonosConjunto()).toEqual([c.dos, c.cuatro, c.seis]);
    expect(p.multiplicadorDanio()).toBeCloseTo(danio * 1.25);
  });
});

describe("refinado hasta +10", () => {
  it("hasta +5 nunca falla; después puede fallar sin perder la pieza", () => {
    const p = new Partida(Meta.nueva(), 7);
    p.billetera.acreditar("esquirlas", 1_000_000);
    p.mochila.agregar(MAT_FRAGMENTO, 99);
    for (let i = 0; i < 5; i++) expect(refinarEquipado(p, "arma").ok).toBe(true);
    expect(p.equipo.arma!.refinado).toBe(5);
    let fallos = 0;
    for (let i = 0; i < 40 && (p.equipo.arma!.refinado ?? 0) < 10; i++) {
      const r = refinarEquipado(p, "arma");
      if (!r.ok) {
        expect(r.error).toBe("fallo-refinado");
        fallos++;
      }
      p.mochila.agregar(MAT_FRAGMENTO, 10);
    }
    expect(p.equipo.arma).not.toBeNull();
    expect(fallos).toBeGreaterThan(0);
  });
});

describe("talentos y stats nuevos", () => {
  it("cuatro sendas con cuatro grados cada una", () => {
    expect(TALENTOS).toHaveLength(16);
    for (const senda of ["filo", "vendaval", "eco", "arsenal"]) {
      expect(TALENTOS.filter((t) => t.senda === senda).map((t) => t.grado).sort()).toEqual([1, 2, 3, 4]);
    }
  });

  it("la Suerte mejora las probabilidades de botín", () => {
    const p = new Partida(Meta.nueva(), 1);
    const antes = p.modificadoresBotin().suerte;
    p.runas = ["coleccionista", null];
    expect(p.modificadoresBotin().suerte).toBeGreaterThan(antes);
  });
});
