// Pueblo y personaje persistente: equipo completo, banco, comercio, misiones, descensos y muerte.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { BASES, MAT_HUESO, OBJ_CARTA, OBJ_POCION, UNICOS } from "../src/contenido/objetos.ts";
import { Banco } from "../src/dominio/banco.ts";
import { crearCarta } from "../src/dominio/cartas.ts";
import { comprarAlArmero, comprarEnPueblo, generarStockArmero, valorCarta, vender, venderCarta } from "../src/dominio/comercio.ts";
import { generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { crearEco, premiosEco } from "../src/dominio/eco.ts";
import { ACCESORIOS, ARMADURAS, RANURAS } from "../src/dominio/tipos.ts";

const posDe = (p: Partida, objeto: number) => [...p.mochila.posiciones()].find((q) => p.mochila.en(q)?.objeto === objeto)!;

describe("equipo completo", () => {
  it("12 ranuras: arma, 6 de armadura, capa y 4 joyas (dos anillos)", () => {
    expect(RANURAS).toHaveLength(12);
    expect(ARMADURAS).toHaveLength(6);
    for (const t of [...ARMADURAS, ...ACCESORIOS, "arma"] as const) {
      expect(BASES.some((b) => b.ranura === t), t).toBe(true);
    }
  });

  it("los ids del catálogo no se repiten (bases y únicos)", () => {
    const ids = [...BASES.map((b) => b.id), ...UNICOS.map((u) => u.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("un anillo va al primer hueco libre y se puede elegir la ranura", () => {
    const azar = new AzarSemilla(1);
    const p = new Partida(Meta.nueva(), 1);
    const a1 = generarEquipo(azar, 2, 0, "anillo");
    const a2 = generarEquipo(azar, 2, 0, "anillo");
    p.recoger({ tipo: "equipo", equipo: a1 });
    p.equiparDesde(posDe(p, a1.base));
    expect(p.equipo.anillo1?.uid).toBe(a1.uid);
    p.recoger({ tipo: "equipo", equipo: a2 });
    p.equiparDesde(posDe(p, a2.base));
    expect(p.equipo.anillo2?.uid).toBe(a2.uid);
  });

  it("los guardados viejos (armadura / amuleto) se migran a pecho / collar", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 3);
    const viejo = { ...generarEquipo(new AzarSemilla(2), 1, 0, "pecho"), ranura: "armadura" };
    const datos = JSON.parse(JSON.stringify(p.serializar()));
    datos.equipo = { arma: datos.equipo.arma, armadura: viejo, amuleto: null };
    const q = Partida.restaurar(meta, datos);
    expect(q.equipo.pecho?.uid).toBe(viejo.uid);
    expect(q.equipo.pecho?.ranura).toBe("pecho");
  });
});

describe("banco", () => {
  it("guarda y devuelve objetos y esquirlas; sobrevive al guardado", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.billetera.acreditar("esquirlas", 500);
    p.mochila.agregar(MAT_HUESO, 7);
    const banco = new Banco();
    expect(banco.depositar(p, posDe(p, MAT_HUESO)).ok).toBe(true);
    expect(p.mochila.contar(MAT_HUESO)).toBe(0);
    expect(banco.depositarEsquirlas(p, 300).ok).toBe(true);
    expect(p.esquirlas).toBe(200);
    const b2 = Banco.restaurar(JSON.parse(JSON.stringify(banco.serializar())));
    expect(b2.esquirlas).toBe(300);
    expect(b2.inventario.contar(MAT_HUESO)).toBe(7);
    const pos = [...b2.inventario.posiciones()].find((q) => b2.inventario.en(q) !== null)!;
    expect(b2.retirar(p, pos).ok).toBe(true);
    expect(p.mochila.contar(MAT_HUESO)).toBe(7);
  });
});

describe("comercio", () => {
  it("comprar en el bazar cobra el precio del catálogo; sin fondos no entrega", () => {
    const p = new Partida(Meta.nueva(), 1);
    const antes = p.mochila.contar(OBJ_POCION);
    expect(comprarEnPueblo(p, OBJ_POCION).ok).toBe(false);
    p.billetera.acreditar("esquirlas", 100);
    expect(comprarEnPueblo(p, OBJ_POCION).ok).toBe(true);
    expect(p.mochila.contar(OBJ_POCION)).toBe(antes + 1);
  });

  it("el armero tiene 6 piezas acordes al piso y se agotan al comprar", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.billetera.acreditar("esquirlas", 1_000_000);
    const stock = generarStockArmero(new AzarSemilla(5), 3);
    expect(stock).toHaveLength(6);
    expect(stock.filter((a) => a.equipo.ranura === "arma")).toHaveLength(2);
    const r = comprarAlArmero(p, stock, 0);
    expect(r.ok).toBe(true);
    expect(stock).toHaveLength(5);
  });

  it("vender da esquirlas y saca el objeto; las cartas valen más con más estrellas", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.mochila.agregar(MAT_HUESO, 10);
    const r = vender(p, posDe(p, MAT_HUESO));
    expect(r.ok && r.valor > 0).toBe(true);
    expect(p.mochila.contar(MAT_HUESO)).toBe(0);
    p.recoger({ tipo: "carta", carta: crearCarta(new AzarSemilla(1), 0, 0) });
    p.recoger({ tipo: "carta", carta: crearCarta(new AzarSemilla(2), 0, 4) });
    const pos = [...p.mazo.posiciones()].filter((q) => p.mazo.en(q)?.objeto === OBJ_CARTA);
    expect(valorCarta(p, pos[1])).toBeGreaterThan(valorCarta(p, pos[0]));
    expect(venderCarta(p, pos[0]).ok).toBe(true);
  });
});

describe("misiones del tablón", () => {
  it("aceptar, avanzar con eventos del juego y entregar (la esencia va a la Meta)", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    expect(p.misiones.aceptar(1, p.nivel()).ok).toBe(true);
    let completa = false;
    for (let i = 0; i < 15; i++) completa = p.registrarMision("matar") || completa;
    expect(completa).toBe(true);
    const esq = p.esquirlas;
    const r = p.entregarMision(1);
    expect(r.ok).toBe(true);
    expect(p.esquirlas).toBe(esq + 120);
    // La cadena sigue: la 2 pide vencer al guardián del piso 1.
    expect(p.misiones.aceptar(2, p.nivel()).ok).toBe(true);
    p.registrarMision("jefe", 2);
    expect(p.misiones.completa(2)).toBe(false);
    p.registrarMision("jefe", 1);
    expect(p.misiones.completa(2)).toBe(true);
    const e0 = meta.esencia;
    p.entregarMision(2);
    expect(meta.esencia).toBeGreaterThan(e0);
  });

  it("como mucho 3 activas y se guardan con el personaje", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    for (const id of [1, 100, 101]) expect(p.misiones.aceptar(id, 1).ok).toBe(true);
    expect(p.misiones.aceptar(102, 1).ok).toBe(false);
    const q = Partida.restaurar(meta, JSON.parse(JSON.stringify(p.serializar())));
    expect(q.misiones.listaActivas()).toHaveLength(3);
  });
});

describe("descensos y muerte", () => {
  it("se empieza hasta el piso desbloqueado; vencer guardianes desbloquea el siguiente", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.prepararDescenso(5);
    expect(p.piso).toBe(1);
    expect(p.desbloquearPiso(1, 10)).toBe(true);
    expect(p.desbloquearPiso(1, 10)).toBe(false);
    p.prepararDescenso(5);
    expect(p.piso).toBe(2);
  });

  it("morir pierde todo lo que llevás encima salvo el contenedor seguro (extracción)", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    p.billetera.acreditar("esquirlas", 1000);
    const arma = p.equipo.arma!;
    p.mochila.agregar(MAT_HUESO, 6);
    p.mochila.agregar(OBJ_POCION, 1);
    expect(p.guardarEnSeguro(posDe(p, MAT_HUESO)).ok).toBe(true);
    const cartas = [...p.mazo.posiciones()].filter((q) => p.mazo.en(q) !== null).length;
    expect(p.valorEnRiesgo()).toBeGreaterThan(1000);
    const botin = p.perderTodo();
    expect(botin.esquirlas).toBe(1000);
    expect(botin.equipo.map((o) => o.uid)).toContain(arma.uid);
    expect(botin.pilas.some((q) => q.objeto === OBJ_POCION)).toBe(true);
    expect(p.esquirlas).toBe(0);
    expect(p.equipo.arma).toBeNull();
    expect(p.mochila.contar(OBJ_POCION)).toBe(0);
    // A salvo: contenedor seguro y cartas; y se guarda con el personaje.
    expect(p.seguro.contar(MAT_HUESO)).toBe(6);
    expect([...p.mazo.posiciones()].filter((q) => p.mazo.en(q) !== null).length).toBe(cartas);
    const q = Partida.restaurar(meta, JSON.parse(JSON.stringify(p.serializar())));
    expect(q.seguro.contar(MAT_HUESO)).toBe(6);
  });

  it("el contenedor seguro tiene 4 casillas", () => {
    const p = new Partida(Meta.nueva(), 1);
    for (const id of [10, 11, 12, 13, 300]) p.mochila.agregar(id, 1);
    let ok = 0;
    for (const id of [10, 11, 12, 13, 300]) if (p.guardarEnSeguro(posDe(p, id)).ok) ok++;
    expect(ok).toBe(4);
  });

  it("el Eco guarda el botín perdido y lo devuelve entero al vencerlo", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    p.billetera.acreditar("esquirlas", 500);
    const arma = p.equipo.arma!;
    const botin = p.perderTodo();
    const eco = crearEco({ piso: 2, forma: p.forma, nivel: 3, stats: p.stats(), equipo: [arma], causa: "test", numero: 1, botin }, new AzarSemilla(1), 1);
    const premios = premiosEco(eco, new AzarSemilla(2));
    expect(premios.some((x) => x.tipo === "equipo" && x.equipo.uid === arma.uid)).toBe(true);
    expect(premios.some((x) => x.tipo === "esquirlas" && x.cantidad === 500)).toBe(true);
  });
});
