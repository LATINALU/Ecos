import { describe, expect, test } from "vitest";
import { AzarSemilla } from "minialu";
import { arenaPara, arenasDelPiso, defArena, premioArena } from "../src/dominio/desafios.ts";
import { generarPiso } from "../src/dominio/mundo/generador.ts";
import { afijosJuicio, cambioPiedra, escalaJuicio, nuevoNivelPiedra, premioJuicio, semanaDe } from "../src/dominio/juicio.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";

describe("salas de desafío", () => {
  test("la variante es determinista por semilla y respeta el piso de aparición", () => {
    expect(arenaPara(1234, 6).variante).toBe(arenaPara(1234, 6).variante);
    for (let s = 0; s < 200; s++) expect(arenaPara(s, 1).variante).toBe("sangre");
    const vistas = new Set<string>();
    for (let s = 0; s < 400; s++) vistas.add(arenaPara(s, 10).variante);
    expect([...vistas].sort()).toEqual(["campeones", "duelo", "marea", "reloj", "sangre"]);
  });

  test("intocable mejora cofre y pieza; tarde en el reloj los empeora", () => {
    const reloj = defArena("reloj", 8);
    const limpio = premioArena(reloj, { golpesRecibidos: 0, tiempoSobrante: 10 });
    const tarde = premioArena(reloj, { golpesRecibidos: 9, tiempoSobrante: 0 });
    expect(limpio.cofre).toBeGreaterThan(tarde.cofre);
    expect(limpio.pieza).toBeGreaterThan(0);
    expect(tarde.pieza).toBeUndefined();
    const campeones = premioArena(defArena("campeones", 4), { golpesRecibidos: 5 });
    expect(campeones.pieza).toBeGreaterThanOrEqual(2);
    expect(premioArena(defArena("sangre", 30), { golpesRecibidos: 0 }).cofre).toBe(3);
  });

  test("el Pozo no tiene altar ni mercader y tiene más desafíos; el Abismo conserva los servicios", () => {
    for (let s = 1; s <= 30; s++) {
      const pozo = generarPiso(new AzarSemilla(s), {
        piso: 6, cantidadSalas: 14, ancho: 7, alto: 5, reliquiasPoseidas: [], hayEco: false, servicios: false, arenas: arenasDelPiso(6, false),
      });
      expect(pozo.salas.some((x) => x.tipo === "altar" || x.tipo === "mercader")).toBe(false);
      expect(pozo.salas.filter((x) => x.tipo === "arena").length).toBe(2);
      const abismo = generarPiso(new AzarSemilla(s), {
        piso: 6, cantidadSalas: 14, ancho: 9, alto: 6, reliquiasPoseidas: [], hayEco: false, servicios: true, salidas: 1, arenas: arenasDelPiso(6, true),
      });
      expect(abismo.salas.some((x) => x.tipo === "mercader")).toBe(true);
    }
  });
});

describe("botín con destino, racha y duelo", () => {
  test("el destino es determinista y el duelo da carta", () => {
    expect(arenaPara(77, 9).destino).toBe(arenaPara(77, 9).destino);
    const destinos = new Set<string>();
    for (let s = 0; s < 300; s++) destinos.add(arenaPara(s, 9).destino);
    expect(destinos.size).toBeGreaterThan(8);
    expect(defArena("duelo", 6).carta).toBe(true);
    expect(defArena("duelo", 6).oleadas).toBe(1);
  });

  test("encadenar arenas mejora el premio", () => {
    const def = defArena("sangre", 4);
    const sola = premioArena(def, { golpesRecibidos: 6, racha: 0 });
    const tercera = premioArena(def, { golpesRecibidos: 6, racha: 2 });
    const quinta = premioArena(def, { golpesRecibidos: 6, racha: 4 });
    expect(tercera.esquirlas).toBeGreaterThan(sola.esquirlas);
    expect(tercera.cofre).toBe(sola.cofre + 1);
    expect(quinta.pieza).toBeGreaterThan(sola.pieza ?? 0);
  });
});

describe("el Juicio (lategame, estilo Mítica+)", () => {
  test("los afijos se suman con el nivel y rotan por semana", () => {
    expect(afijosJuicio(1, 0)).toEqual([]);
    expect(afijosJuicio(2, 0)).toHaveLength(1);
    expect(afijosJuicio(4, 0)).toHaveLength(2);
    expect(afijosJuicio(7, 0)).toHaveLength(3);
    expect(afijosJuicio(10, 0)).toContain("abisal");
    expect(afijosJuicio(2, 0)).not.toEqual(afijosJuicio(2, 1));
    expect(semanaDe(new Date(Date.UTC(2026, 0, 12))) - semanaDe(new Date(Date.UTC(2026, 0, 5)))).toBe(1);
  });

  test("la escala crece con el nivel; la piedra sube a tiempo y baja tarde (nunca de +2)", () => {
    expect(escalaJuicio(10)).toBeGreaterThan(escalaJuicio(5));
    expect(cambioPiedra(50, 100)).toBe(3);
    expect(cambioPiedra(25, 100)).toBe(2);
    expect(cambioPiedra(5, 100)).toBe(1);
    expect(cambioPiedra(0, 100)).toBe(-1);
    expect(nuevoNivelPiedra(2, -1)).toBe(2);
    expect(nuevoNivelPiedra(8, 3)).toBe(11);
    const alto = premioJuicio(12, 14, 40, 100);
    const bajo = premioJuicio(2, 14, 40, 100);
    expect(alto.pieza).toBeGreaterThan(bajo.pieza);
    expect(premioJuicio(5, 14, 0, 100).esquirlas).toBeLessThan(premioJuicio(5, 14, 10, 100).esquirlas);
  });

  test("la piedra se recibe al desbloquear el piso 12 y se guarda", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1);
    expect(p.piedraJuicio).toBe(0);
    for (let piso = 1; piso <= 11; piso++) p.desbloquearPiso(piso, 24);
    expect(p.pisoDesbloqueado).toBe(12);
    expect(p.piedraJuicio).toBe(2);
    p.piedraJuicio = 7;
    p.rachaArenas = 3;
    const copia = Partida.restaurar(meta, p.serializar());
    expect(copia.piedraJuicio).toBe(7);
    expect(copia.rachaArenas).toBe(3);
    copia.prepararDescenso(1);
    expect(copia.rachaArenas).toBe(0);
  });
});
