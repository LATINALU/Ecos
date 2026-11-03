// Rework de las Cartas de Alma: mazo de 5 ranuras, una habilidad y una pasiva distinta por ranura, escala por nivel.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { ALMAS } from "../src/contenido/almas.ts";
import { GRIMORIO, RANURAS_ALMA, cantidadExtra, escalaCarta, grimorio } from "../src/contenido/grimorio.ts";
import { crearCarta } from "../src/dominio/cartas.ts";
import { Meta } from "../src/dominio/meta.ts";
import { construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { CARGA_DEFINITIVA, Partida } from "../src/dominio/partida.ts";
import type { AtaqueJugador, Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { Jugador } from "../src/juego/entidades/jugador.ts";
import type { Proyectil } from "../src/juego/entidades/proyectil.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

describe("grimorio", () => {
  it("las 12 almas tienen 5 pasivas y 4 habilidades, todas con nombre distinto", () => {
    expect(GRIMORIO).toHaveLength(ALMAS.length);
    const habilidades = GRIMORIO.flatMap((g) => g.habilidades.map((h) => h.nombre));
    const pasivas = GRIMORIO.flatMap((g) => g.pasivas.map((p) => p.nombre));
    expect(habilidades).toHaveLength(48);
    expect(pasivas).toHaveLength(60);
    expect(new Set(habilidades).size).toBe(48);
    expect(new Set(pasivas).size).toBe(60);
    // La pasiva de la Forma siempre toca los ataques básicos.
    for (const g of GRIMORIO) {
      expect(Object.keys(g.pasivas[0].efectos).some((k) => k.startsWith("golpe")), g.pasivas[0].nombre).toBe(true);
    }
  });

  it("la misma carta da cosas distintas según la ranura", () => {
    const p = new Partida(Meta.nueva(), 1, { alma: 5 });
    const c = crearCarta(new AzarSemilla(1), 8, 0);
    p.almas[1] = c;
    const h1 = p.habilidad(1)!;
    p.almas[1] = null;
    p.almas[2] = c;
    const h2 = p.habilidad(2)!;
    expect(h1.def.nombre).not.toBe(h2.def.nombre);
    expect(p.habilidad(0)).toBeNull();
  });

  it("el poder escala con las estrellas y las mejoras", () => {
    const baja = crearCarta(new AzarSemilla(3), 4, 0);
    const alta = { ...crearCarta(new AzarSemilla(3), 4, 5), mejoras: 5 };
    expect(escalaCarta(alta)).toBeGreaterThan(escalaCarta(baja) * 1.9);
    expect(cantidadExtra(5)).toBe(2);
    const p = new Partida(Meta.nueva(), 1, { alma: 4 });
    p.almas[1] = baja;
    const debil = p.habilidad(1)!;
    p.almas[1] = alta;
    const fuerte = p.habilidad(1)!;
    // Más escala y, además, la carta suma su stat Técnica: el poder crece al menos lo que la escala.
    expect(fuerte.potencia / debil.potencia).toBeGreaterThanOrEqual(escalaCarta(alta) / escalaCarta(baja));
    // Las pasivas también escalan.
    p.almas[0] = { ...crearCarta(new AzarSemilla(4), 4, 0), brillante: false };
    const q1 = p.efectoAlma("golpeQuema");
    p.almas[0] = { ...crearCarta(new AzarSemilla(4), 4, 4), brillante: false };
    expect(p.efectoAlma("golpeQuema")).toBeGreaterThan(q1);
  });

  it("las probabilidades tienen tope (60 %)", () => {
    const p = new Partida(Meta.nueva(), 1, { alma: 4 });
    p.almas[0] = { ...crearCarta(new AzarSemilla(5), 4, 6), mejoras: 5, brillante: true };
    expect(p.efectoAlma("golpeQuema")).toBeLessThanOrEqual(0.6);
  });

  it("los guardados viejos (forma + 2 resonancias) pasan a Forma + Habilidad I + Habilidad II", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 1, { alma: 2 });
    const r0 = crearCarta(new AzarSemilla(6), 3, 1);
    const datos = JSON.parse(JSON.stringify(p.serializar()));
    delete datos.almas;
    datos.resonancias = [r0, null];
    const q = Partida.restaurar(meta, datos);
    expect(q.forma?.personaje).toBe(2);
    expect(q.almas[1]?.uid).toBe(r0.uid);
    expect(q.almas[2]).toBeNull();
    // Y el formato nuevo se conserva entero.
    q.almas[4] = crearCarta(new AzarSemilla(7), 9, 2);
    const z = Partida.restaurar(meta, JSON.parse(JSON.stringify(q.serializar())));
    expect(RANURAS_ALMA.map((r) => z.almas[r]?.uid ?? null)).toEqual(RANURAS_ALMA.map((r) => q.almas[r]?.uid ?? null));
  });

  it("un personaje nuevo empieza con su alma como Forma y como Habilidad I", () => {
    const p = new Partida(Meta.nueva(), 1, { alma: 6 });
    expect(p.forma?.personaje).toBe(6);
    expect(p.habilidad(1)?.def.nombre).toBe(grimorio(6).habilidades[0].nombre);
  });
});

/** Escenario con un enemigo de prueba delante para que los rayos tengan a quién caer. */
function escenario(partida: Partida) {
  const datos = construirSala("altar", 0, { izq: {}, der: {} }, new AzarSemilla(1), 0);
  const jugador = new Jugador();
  const proyectiles: Proyectil[] = [];
  const golpes: AtaqueJugador[] = [];
  const objetivo = { cx: 12 * TILE, cy: 13 * TILE, x: 12 * TILE - 8, y: 12 * TILE, w: 16, h: 2 * TILE, muerto: false };
  const ctx = {
    partida, tiles: { tile: (tx: number, ty: number) => datos.tiles[indice(tx, ty)] }, jugador, fx: new Efectos(),
    audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [objetivo],
    agregarProyectil: (p: Proyectil) => proyectiles.push(p), agregarCriatura: () => {}, agregarPeligro: () => {},
    golpearJugador: () => {}, golpearCriatura: () => false,
    golpearArea: (_r: unknown, a: AtaqueJugador) => { golpes.push(a); return 1; },
    tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let recientes = new Set<Accion>();
  const entrada = { pulsada: () => false, recien: (a: Accion) => recientes.has(a), soltada: () => false } as unknown as Entrada;
  const paso = (n: number, tocar: Accion[] = []): void => {
    for (let i = 0; i < n; i++) {
      recientes = new Set(i === 0 ? tocar : []);
      jugador.actualizar(1 / 60, ctx, entrada);
    }
  };
  jugador.colocar(10 * TILE, 14 * TILE - jugador.h);
  paso(5);
  return { paso, proyectiles, golpes, jugador };
}

describe("habilidades en juego", () => {
  const teclas: Accion[] = ["hab1", "hab2", "hab3", "definitiva"];
  for (const a of ALMAS) {
    it(`${a.nombre}: las 4 habilidades se lanzan, gastan éter / carga y producen ataques`, () => {
      const p = new Partida(Meta.nueva(), 1, { alma: a.id });
      for (const r of RANURAS_ALMA) p.almas[r] = crearCarta(new AzarSemilla(r + 1), a.id, 2);
      p.mp = 999;
      p.cargaDefinitiva = CARGA_DEFINITIVA;
      const { paso, proyectiles, golpes, jugador } = escenario(p);
      teclas.forEach((t, k) => {
        const antesP = proyectiles.length;
        const antesG = golpes.length;
        const mp = p.mp;
        paso(1, [t]);
        paso(90);
        const hizoAlgo = proyectiles.length > antesP || golpes.length > antesG || jugador.buffActivo;
        expect(hizoAlgo, `${a.nombre} · ${grimorio(a.id).habilidades[k].nombre}`).toBe(true);
        if (k < 3) expect(p.mp).toBeLessThan(mp);
      });
      expect(p.cargaDefinitiva).toBe(0);
      // Sin carga, la Definitiva no sale.
      const antes = proyectiles.length + golpes.length;
      paso(1, ["definitiva"]);
      paso(60);
      expect(proyectiles.length + golpes.length).toBe(antes);
    });
  }
});
