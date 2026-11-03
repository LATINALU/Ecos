// Expansión: 10 zonas con jefe, runas, conjuntos, refinado con riesgo, talentos 4×4 y stats nuevos.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { BIOMAS, PISOS_TOTALES, escalaEnemigo } from "../src/contenido/biomas.ts";
import { CONJUNTOS, conjuntoDelPiso } from "../src/contenido/conjuntos.ts";
import { MAT_FRAGMENTO, runaDeObjeto } from "../src/contenido/objetos.ts";
import { ANIMACIONES_CRIATURAS } from "../src/contenido/sprites.generado.ts";
import { TALENTOS } from "../src/contenido/talentos.ts";
import { botinEnemigo } from "../src/dominio/botin.ts";
import { refinarEquipado } from "../src/dominio/crafteo.ts";
import { costoTemplado } from "../src/dominio/templado.ts";
import { generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";

describe("zonas y jefes", () => {
  it("hay 24 zonas, cada una con nombre, guardián y atmósfera (fondo + partículas + paleta) propios", () => {
    expect(PISOS_TOTALES).toBe(24);
    expect(new Set(BIOMAS.map((b) => b.nombre)).size).toBe(BIOMAS.length);
    expect(new Set(BIOMAS.map((b) => b.jefe.nombre)).size).toBe(BIOMAS.length);
    expect(new Set(BIOMAS.map((b) => `${b.fondo}|${b.particula}|${b.acento}`)).size).toBe(BIOMAS.length);
    expect(new Set(BIOMAS.map((b) => b.fondo)).size).toBe(14);
    // El jefe final sigue siendo El Que Recuerda, ahora en el piso 24.
    expect(BIOMAS[23].jefe.id).toBe("recuerda");
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
      expect(botin.some((p) => p.tipo === "objeto" && runaDeObjeto(p.objeto) !== undefined)).toBe(true);
      expect(botin.some((p) => p.tipo === "equipo" && p.equipo.conjunto === conjuntoDelPiso(piso).id)).toBe(true);
    }
  });
});

describe("runas", () => {
  it("se engarzan, no se repiten y cambian los stats", () => {
    const p = new Partida(Meta.nueva(), 1);
    const def = p.stats().defensa;
    p.mochila.agregar(303, 2); // dos Runas de Acero (se apilan)
    const pos = () => [...p.mochila.posiciones()].find((q) => p.mochila.en(q)?.objeto === 303)!;
    expect(p.engarzarRuna(pos(), 0).ok).toBe(true);
    expect(p.stats().defensa).toBeGreaterThan(def);
    const r = p.engarzarRuna(pos(), 1);
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

describe("templado hasta +10 (nunca falla)", () => {
  it("hasta +5 es normal; del +6 se elige Seguro o Abisal y siempre sube", () => {
    const p = new Partida(Meta.nueva(), 7);
    p.billetera.acreditar("esquirlas", 1_000_000);
    p.mochila.agregar(MAT_FRAGMENTO, 99);
    for (let i = 0; i < 5; i++) expect(refinarEquipado(p, "arma").ok).toBe(true);
    expect(p.equipo.arma!.refinado).toBe(5);
    const sinElegir = refinarEquipado(p, "arma");
    expect(sinElegir.ok).toBe(false);
    if (!sinElegir.ok) expect(sinElegir.error).toBe("elige-templado");
    expect(refinarEquipado(p, "arma", "seguro").ok).toBe(true);
    expect(p.equipo.arma!.refinado).toBe(6);
    expect(p.equipo.arma!.pactos ?? []).toHaveLength(0);
    for (let i = 0; i < 4; i++) {
      p.mochila.agregar(MAT_FRAGMENTO, 10);
      const r = refinarEquipado(p, "arma", "abisal");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.valor.pactoNuevo).toBeDefined();
    }
    expect(p.equipo.arma!.refinado).toBe(10);
    // Cuatro pactos distintos en la pieza.
    expect(new Set(p.equipo.arma!.pactos).size).toBe(4);
  });

  it("el Abisal es más barato que el Seguro y los pactos cambian los números", () => {
    expect(costoTemplado(6, "abisal").esquirlas).toBeLessThan(costoTemplado(6, "seguro").esquirlas);
    const p = new Partida(Meta.nueva(), 9);
    const antes = { hp: p.stats().hp, recibido: p.multiplicadorRecibido(), critDanio: p.combate().critDanio };
    p.equipo.arma = { ...p.equipo.arma!, pactos: ["hambriento", "frio"] };
    expect(p.combate().critDanio).toBeCloseTo(antes.critDanio + 0.4);
    expect(p.multiplicadorRecibido()).toBeCloseTo(antes.recibido * 1.15);
    expect(p.stats().hp).toBeLessThan(antes.hp);
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
