import { describe, expect, test } from "vitest";
import { HISTORIAS, LORE_NPC, historia } from "../src/contenido/historias.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { forjaMitica } from "../src/dominio/crafteo.ts";
import { MAT_FRAGMENTO, OBJ_ETER, OBJ_POCION, apilable } from "../src/contenido/objetos.ts";
import { comentariosPueblo } from "../src/juego/pueblo.ts";

describe("historias del pueblo", () => {
  test("cada misión tiene recuerdo con su objeto y cada habitante tiene pasado", () => {
    for (const h of HISTORIAS) {
      expect(apilable(h.recuerdo.objeto)?.nombre).toBe(h.recuerdo.nombre);
      expect(LORE_NPC[h.servicio]).toBeDefined();
    }
    expect(historia("dorn").piso).toBe(18);
  });

  test("aceptar, traer el recuerdo y entregarlo la cumple (sin recuerdo no se puede)", () => {
    const p = new Partida(Meta.nueva(), 1);
    expect(p.entregarRecuerdo("dorn")).toBe(false);
    p.aceptarHistoria("dorn");
    expect(p.entregarRecuerdo("dorn")).toBe(false);
    p.mochila.agregar(historia("dorn").recuerdo.objeto, 1);
    expect(p.tieneRecuerdo("dorn")).toBe(true);
    expect(p.entregarRecuerdo("dorn")).toBe(true);
    expect(p.historiaCumplida("dorn")).toBe(true);
    expect(p.tieneRecuerdo("dorn")).toBe(false);
    const copia = Partida.restaurar(Meta.nueva(), p.serializar());
    expect(copia.historiaCumplida("dorn")).toBe(true);
  });

  test("Forja Mítica solo con el martillo de Dorn devuelto", () => {
    const p = new Partida(Meta.nueva(), 2);
    p.billetera.acreditar("esquirlas", 10000);
    p.mochila.agregar(MAT_FRAGMENTO, 20);
    expect(forjaMitica(p).ok).toBe(false);
    p.historias.dorn = "cumplida";
    const r = forjaMitica(p);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.rareza).toBe(5);
  });

  test("recompensas: Rosario (+10 % fusión), Brindis (pociones al bajar), Juramento (conservas el arma)", () => {
    const p = new Partida(Meta.nueva(), 3);
    expect(p.bonoFusion()).toBe(0);
    p.historias.ceniza = "cumplida";
    expect(p.bonoFusion()).toBeCloseTo(0.1);

    p.historias.ilse = "cumplida";
    const pociones = p.mochila.contar(OBJ_POCION);
    const eter = p.mochila.contar(OBJ_ETER);
    p.prepararDescenso(1);
    expect(p.mochila.contar(OBJ_POCION)).toBeGreaterThan(pociones);
    expect(p.mochila.contar(OBJ_ETER)).toBe(eter + 1);

    const arma = p.equipo.arma;
    expect(arma).not.toBeNull();
    p.historias.vael = "cumplida";
    const perdido = p.perderTodo();
    expect(p.equipo.arma).toBe(arma);
    expect(perdido.equipo.some((o) => o.uid === arma!.uid)).toBe(false);
  });

  test("los aventureros comentan lo que hiciste", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 4);
    expect(comentariosPueblo(p, meta).some((c) => c.includes("Osario"))).toBe(true);
    p.pisoDesbloqueado = 9;
    meta.registro.muertes = 3;
    const c = comentariosPueblo(p, meta);
    expect(c.some((x) => x.includes("venciste"))).toBe(true);
    expect(c.some((x) => x.includes("Moriste 3 veces"))).toBe(true);
  });
});
