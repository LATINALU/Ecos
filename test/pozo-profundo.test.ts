// Rework de las mazmorras: 24 pisos, enemigos nuevos con conductas propias, élites con afijos, Arenas, Bóvedas y
// cofres de distinta rareza.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { BIOMAS, ENEMIGOS, SALAS_POR_PISO, bioma, cantidadAfijosElite, escalaEnemigo, nombreEnemigo, probElite } from "../src/contenido/biomas.ts";
import { botinCofre } from "../src/dominio/botin.ts";
import { Meta } from "../src/dominio/meta.ts";
import { dimensionesMapa, generarPiso } from "../src/dominio/mundo/generador.ts";
import { construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Contexto, Peligro } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Enemigo } from "../src/juego/entidades/enemigo.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import type { Proyectil } from "../src/juego/entidades/proyectil.ts";
import type { Audio } from "../src/motor/audio.ts";

describe("24 pisos", () => {
  it("cada piso tiene sus salas (más cuanto más hondo), con Arenas desde el 2 y Bóveda desde el 3", () => {
    expect(SALAS_POR_PISO).toHaveLength(24);
    const azar = new AzarSemilla(17);
    for (let piso = 1; piso <= 24; piso++) {
      const mapa = generarPiso(azar, {
        piso, cantidadSalas: SALAS_POR_PISO[piso - 1], ...dimensionesMapa(SALAS_POR_PISO[piso - 1]),
        reliquiasPoseidas: [], hayEco: false,
      });
      expect(mapa.salas.length, `piso ${piso}`).toBeGreaterThanOrEqual(SALAS_POR_PISO[piso - 1] * 0.9);
      const arenas = mapa.salas.filter((s) => s.tipo === "arena").length;
      if (piso >= 2 && mapa.salas.length >= 10) expect(arenas, `piso ${piso}`).toBeGreaterThanOrEqual(1);
      if (piso >= 3 && mapa.salas.length >= 10) expect(mapa.salas.some((s) => s.tipo === "boveda"), `piso ${piso}`).toBe(true);
      if (piso === 1) expect(arenas).toBe(0);
    }
    // Los pisos profundos son bastante más grandes que los primeros.
    expect(SALAS_POR_PISO[20]).toBeGreaterThan(SALAS_POR_PISO[0] * 2 - 1);
  });

  it("los monstruos siguen subiendo después del piso 10 sin disparar la vida", () => {
    for (let p = 2; p <= 24; p++) expect(escalaEnemigo(p).hp).toBeGreaterThan(escalaEnemigo(p - 1).hp);
    expect(escalaEnemigo(24).hp).toBeLessThan(60);
  });

  it("las conductas nuevas tienen nombre en todos los biomas", () => {
    for (let piso = 1; piso <= 24; piso++) {
      for (const c of ["cargador", "explosivo", "lanzador", "espectro"] as const) {
        expect(nombreEnemigo(piso, bioma(piso), c).length).toBeGreaterThan(2);
      }
    }
    expect(Object.keys(ENEMIGOS)).toHaveLength(9);
    expect(BIOMAS).toHaveLength(24);
  });

  it("las élites aparecen más y con más afijos al bajar (con techo)", () => {
    expect(probElite(24)).toBeLessThanOrEqual(0.32);
    expect(probElite(20)).toBeGreaterThan(probElite(2));
    expect(cantidadAfijosElite(1)).toBe(1);
    expect(cantidadAfijosElite(24)).toBe(3);
  });
});

/** Mundo mínimo para ver actuar a un monstruo. */
function escenario(piso = 12) {
  const datos = construirSala("normal", 3, { izq: {}, der: {} }, new AzarSemilla(1), 0);
  const tiles = new Uint8Array(datos.tiles);
  // Suelo plano y sin obstáculos en el medio.
  for (let tx = 2; tx < 28; tx++) for (let ty = 2; ty < 14; ty++) tiles[indice(tx, ty)] = 0;
  const partida = new Partida(Meta.nueva(), 1);
  const jugador = new Jugador();
  jugador.colocar(10 * TILE, 14 * TILE - jugador.h);
  const proyectiles: Proyectil[] = [];
  const peligros: Peligro[] = [];
  const ctx = {
    partida, tiles: { tile: (tx: number, ty: number) => tiles[indice(tx, ty)] }, jugador, fx: new Efectos(),
    audio: { reproducir: () => {} } as unknown as Audio, piso, criaturas: [], bioma: bioma(piso),
    agregarProyectil: (p: Proyectil) => proyectiles.push(p), agregarCriatura: () => {},
    agregarPeligro: (p: Peligro) => peligros.push(p),
    golpearJugador: () => {}, golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  return { ctx, proyectiles, peligros, jugador };
}

describe("conductas nuevas", () => {
  it("el embestidor avisa y después carga muy rápido hacia el Portador", () => {
    const { ctx } = escenario();
    const e = new Enemigo("cargador", 12, bioma(12), 18 * TILE, 14 * TILE, false);
    let maxVel = 0;
    for (let i = 0; i < 180; i++) {
      e.actualizar(1 / 60, ctx);
      maxVel = Math.max(maxVel, Math.abs(e.vx));
    }
    expect(maxVel).toBeGreaterThan(200);
  });

  it("el lanzador tira proyectiles en parábola (con gravedad)", () => {
    const { ctx, proyectiles } = escenario();
    const e = new Enemigo("lanzador", 12, bioma(12), 20 * TILE, 14 * TILE, false);
    for (let i = 0; i < 300; i++) e.actualizar(1 / 60, ctx);
    expect(proyectiles.length).toBeGreaterThan(0);
    expect(proyectiles[0].op.gravedad ?? 0).toBeGreaterThan(0);
    expect(proyectiles[0].vy).toBeLessThan(0);
  });

  it("el kamikaze corre hacia el Portador y explota (zona de peligro) muriendo en el acto", () => {
    const { ctx, peligros } = escenario();
    const e = new Enemigo("explosivo", 12, bioma(12), 14 * TILE, 14 * TILE, false);
    for (let i = 0; i < 300 && !e.muerto; i++) e.actualizar(1 / 60, ctx);
    expect(peligros.length).toBe(1);
    expect(e.muerto).toBe(true);
  });

  it("el espectro se teletransporta junto al Portador", () => {
    const { ctx, jugador } = escenario();
    const e = new Enemigo("espectro", 12, bioma(12), 22 * TILE, 8 * TILE, false);
    let cerca = false;
    for (let i = 0; i < 400; i++) {
      e.actualizar(1 / 60, ctx);
      if (Math.abs(e.cx - jugador.cx) < 60) cerca = true;
    }
    expect(cerca).toBe(true);
  });

  it("élite blindada recibe menos daño; regeneradora se cura; con nombre de afijos", () => {
    const { ctx } = escenario();
    const blind = new Enemigo("caminante", 12, bioma(12), 14 * TILE, 14 * TILE, true, ["blindado"]);
    const hp = blind.hp;
    blind.aplicarDanio(100, ctx);
    expect(hp - blind.hp).toBe(65);
    expect(blind.nombre).toContain("Blindado");
    const regen = new Enemigo("caminante", 12, bioma(12), 14 * TILE, 14 * TILE, true, ["regenerador"]);
    regen.aplicarDanio(50, ctx);
    const tras = regen.hp;
    for (let i = 0; i < 120; i++) regen.actualizar(1 / 60, ctx);
    expect(regen.hp).toBeGreaterThan(tras);
  });
});

describe("cofres por rareza", () => {
  it("cuanto mejor el cofre, más premios y de más rareza", () => {
    const azar = new AzarSemilla(5);
    const cuenta = (nivel: number): { premios: number; minRareza: number } => {
      let premios = 0;
      let minRareza = 9;
      for (let i = 0; i < 50; i++) {
        const b = botinCofre(azar, 8, undefined, nivel);
        premios += b.length;
        for (const p of b) if (p.tipo === "equipo") minRareza = Math.min(minRareza, p.equipo.rareza);
      }
      return { premios, minRareza };
    };
    const madera = cuenta(0);
    const mitico = cuenta(3);
    expect(mitico.premios).toBeGreaterThan(madera.premios * 1.5);
    expect(madera.minRareza).toBeGreaterThanOrEqual(1);
    expect(mitico.minRareza).toBeGreaterThanOrEqual(4);
  });
});
