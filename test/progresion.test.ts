import { describe, expect, it } from "vitest";
import { MAT_ESPORA, MAT_FRAGMENTO, MAT_HUESO, OBJ_POCION, estiloDe } from "../src/contenido/objetos.ts";
import { RECETAS } from "../src/contenido/recetas.ts";
import { craftear, refinarEquipado } from "../src/dominio/crafteo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";

const receta = (id: string) => RECETAS.find((r) => r.id === id)!;

describe("arma y alma inicial", () => {
  it("el arma elegida define el estilo de combate", () => {
    const p = new Partida(Meta.nueva(), 5, { estilo: "pesada", alma: 6 });
    expect(p.estilo().id).toBe("pesada");
    expect(estiloDe(p.equipo.arma?.base)).toBe("pesada");
    expect(p.forma?.personaje).toBe(6);
    // La pasiva de ataques básicos de Ulva (Colmillos) cura con cada golpe.
    expect(p.efectoAlma("golpeCura")).toBeGreaterThan(0);
  });
});

describe("habilidades y talentos", () => {
  it("subir de nivel da 3 puntos de stats y 1 de talento", () => {
    const p = new Partida(Meta.nueva(), 1);
    expect(p.puntos.disponibles).toBe(0);
    while (p.nivel() < 3) p.ganarExperiencia(50);
    expect(p.puntos.disponibles).toBe(6);
    expect(p.puntosTalento()).toBe(2);
    const antes = p.stats().golpe;
    expect(p.asignarPunto("golpe", 2).ok).toBe(true);
    expect(p.stats().golpe).toBe(antes + 3);
  });

  it("los talentos piden el grado anterior de su senda", () => {
    const p = new Partida(Meta.nueva(), 1);
    while (p.nivel() < 4) p.ganarExperiencia(50);
    const r = p.aprenderTalento("cuartoCorte");
    expect(r.ok ? null : r.error).toBe("requisito");
    expect(p.aprenderTalento("remate").ok).toBe(true);
    expect(p.aprenderTalento("cuartoCorte").ok).toBe(true);
    expect(p.tieneTalento("cuartoCorte")).toBe(true);
  });
});

describe("crafteo", () => {
  it("todo o nada: sin materiales no cobra ni cambia nada", () => {
    const p = new Partida(Meta.nueva(), 1);
    const pociones = p.mochila.contar(OBJ_POCION);
    expect(craftear(p, receta("pocion")).ok).toBe(false);
    expect(p.mochila.contar(OBJ_POCION)).toBe(pociones);
    p.mochila.agregar(MAT_HUESO, 3);
    expect(craftear(p, receta("pocion")).ok).toBe(true);
    expect(p.mochila.contar(OBJ_POCION)).toBe(pociones + 1);
    expect(p.mochila.contar(MAT_HUESO)).toBe(0);
  });

  it("forja equipo de la ranura pedida y refina lo equipado", () => {
    const p = new Partida(Meta.nueva(), 2);
    p.billetera.acreditar("esquirlas", 1000);
    p.mochila.agregar(MAT_ESPORA, 6);
    p.mochila.agregar(MAT_FRAGMENTO, 3);
    const r = craftear(p, receta("armadura"));
    expect(r.ok).toBe(true);
    const golpeAntes = p.equipo.arma!.stats.golpe ?? p.equipo.arma!.stats.tecnica;
    const ref = refinarEquipado(p, "arma");
    expect(ref.ok && ref.valor.refinado).toBe(1);
    expect((p.equipo.arma!.stats.golpe ?? p.equipo.arma!.stats.tecnica)).toBeGreaterThan(golpeAntes);
  });
});

describe("guardado de la partida", () => {
  it("serializar y restaurar conserva lo importante", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 9, { estilo: "baston" });
    while (p.nivel() < 3) p.ganarExperiencia(50);
    p.asignarPunto("tecnica", 3);
    p.aprenderTalento("ecoTecnica");
    p.mochila.agregar(MAT_HUESO, 7);
    p.billetera.acreditar("esquirlas", 321);
    const datos = JSON.parse(JSON.stringify(p.serializar()));
    const q = Partida.restaurar(meta, datos);
    expect(q.nivel()).toBe(p.nivel());
    expect(q.esquirlas).toBe(p.esquirlas);
    expect(q.puntoEn("tecnica")).toBe(3);
    expect(q.puntos.disponibles).toBe(p.puntos.disponibles);
    expect(q.tieneTalento("ecoTecnica")).toBe(true);
    expect(q.mochila.contar(MAT_HUESO)).toBe(7);
    expect(q.estilo().id).toBe("baston");
    expect(q.stats()).toEqual(p.stats());
  });
});
