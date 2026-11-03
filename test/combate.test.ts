// Combate fluido: medidor de estilo, búfer y cancelaciones, estocada, ataque cargado, esquiva perfecta, combos aéreos.

import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { Meta } from "../src/dominio/meta.ts";
import { construirSala, indice, TILE } from "../src/dominio/mundo/sala.ts";
import { Partida } from "../src/dominio/partida.ts";
import type { Contexto } from "../src/juego/contexto.ts";
import { Efectos } from "../src/juego/efectos.ts";
import { CARGA_COMPLETA, Jugador } from "../src/juego/entidades/jugador.ts";
import { MedidorCombo, RANGOS, VENTANA_COMBO } from "../src/juego/medidor-combo.ts";
import type { Audio } from "../src/motor/audio.ts";
import type { Accion, Entrada } from "../src/motor/entrada.ts";

describe("medidor de estilo", () => {
  it("sube de rango pegando y variar rinde más que repetir", () => {
    const repetir = new MedidorCombo();
    const variar = new MedidorCombo();
    const ciclo = ["golpe", "patada", "tecnica", "subarma"] as const;
    for (let i = 0; i < 20; i++) {
      repetir.registrar("golpe");
      variar.registrar(ciclo[i % ciclo.length]);
    }
    expect(variar.puntos).toBeGreaterThan(repetir.puntos * 1.5);
    expect(variar.indiceRango).toBeGreaterThan(repetir.indiceRango);
    expect(variar.multiplicadorDanio).toBeGreaterThan(1);
  });

  it("se corta si dejás de pegar o si te golpean", () => {
    const c = new MedidorCombo();
    for (let i = 0; i < 10; i++) c.registrar("golpe");
    c.actualizar(VENTANA_COMBO + 0.1);
    expect(c.golpes).toBe(0);
    for (let i = 0; i < 10; i++) c.registrar("patada");
    c.recibirDanio();
    expect(c.puntos).toBe(0);
    expect(c.mejorCombo).toBe(10);
  });

  it("devuelve el rango nuevo al subir (para festejarlo) y llega a SSS", () => {
    const c = new MedidorCombo();
    const subidas: string[] = [];
    const acciones = ["golpe", "patada", "estocada", "cargado", "tecnica", "aereo", "desvio", "esquiva", "muerte", "subarma"] as const;
    for (let i = 0; i < 80; i++) {
      const r = c.registrar(acciones[i % acciones.length]);
      if (r !== null) subidas.push(r.nombre);
    }
    expect(subidas[subidas.length - 1]).toBe(RANGOS[RANGOS.length - 1].nombre);
    expect(c.bonoVelocidad).toBeGreaterThan(0);
  });
});

function escenario(estilo: "espada" | "pesada" | "arco" | "baston" | "punos" = "espada") {
  const datos = construirSala("altar", 0, { izq: {}, der: {} }, new AzarSemilla(1), 0);
  const partida = new Partida(Meta.nueva(), 1, { estilo });
  const jugador = new Jugador();
  const ctx = {
    partida, tiles: { tile: (tx: number, ty: number) => datos.tiles[indice(tx, ty)] }, jugador, fx: new Efectos(),
    audio: { reproducir: () => {} } as unknown as Audio, piso: 1, criaturas: [],
    agregarProyectil: () => {}, agregarCriatura: () => {}, agregarPeligro: () => {}, golpearJugador: () => {},
    golpearCriatura: () => false, golpearArea: () => 0, tocarBarreras: () => {}, mensaje: () => {},
  } as unknown as Contexto;
  let pulsadas = new Set<Accion>();
  let recientes = new Set<Accion>();
  let soltadas = new Set<Accion>();
  const entrada = {
    pulsada: (a: Accion) => pulsadas.has(a), recien: (a: Accion) => recientes.has(a), soltada: (a: Accion) => soltadas.has(a),
  } as unknown as Entrada;
  const paso = (n: number, mantener: Accion[] = [], tocar: Accion[] = [], soltar: Accion[] = []): void => {
    for (let i = 0; i < n; i++) {
      pulsadas = new Set(mantener);
      recientes = new Set(i === 0 ? tocar : []);
      soltadas = new Set(i === 0 ? soltar : []);
      jugador.actualizar(1 / 60, ctx, entrada);
    }
  };
  jugador.colocar(10 * TILE, 14 * TILE - jugador.h);
  paso(5);
  return { jugador, partida, paso };
}

describe("cancelaciones y búfer", () => {
  it("una patada apretada durante el golpe sale apenas termina la parte activa", () => {
    const { jugador, paso } = escenario();
    paso(1, [], ["golpe"]);
    expect(jugador.tipoAccion).toBe("golpe");
    paso(2, [], ["patada"]); // demasiado pronto: queda en el búfer
    expect(jugador.tipoAccion).toBe("golpe");
    paso(8);
    expect(jugador.tipoAccion).toBe("patada");
  });

  it("golpe durante el paso atrás = estocada", () => {
    const { jugador, paso } = escenario();
    paso(1, [], ["embestida"]);
    paso(12);
    paso(1, [], ["golpe"]);
    expect(jugador.tipoAccion).toBe("estocada");
    expect(jugador.invulnerable).toBe(true);
  });
});

describe("ataque cargado", () => {
  for (const estilo of ["espada", "pesada", "arco", "baston", "punos"] as const) {
    it(`mantener el golpe y soltar dispara el cargado (${estilo})`, () => {
      const { jugador, paso } = escenario(estilo);
      paso(1, ["golpe"], ["golpe"]);
      paso(30, ["golpe"]); // termina el golpe normal y empieza a cargar
      paso(Math.ceil(CARGA_COMPLETA * 60) + 2, ["golpe"]);
      expect(jugador.carga).toBeGreaterThanOrEqual(CARGA_COMPLETA);
      paso(1, [], [], ["golpe"]);
      expect(jugador.tipoAccion).toBe("cargado");
    });
  }

  it("soltar antes de tiempo no hace nada", () => {
    const { jugador, paso } = escenario();
    paso(1, ["golpe"], ["golpe"]);
    paso(20, ["golpe"]);
    paso(1, [], [], ["golpe"]);
    expect(jugador.tipoAccion).not.toBe("cargado");
  });
});

describe("esquiva perfecta y combos aéreos", () => {
  it("solo cuenta justo al empezar la esquiva, una vez, y deja un crítico seguro", () => {
    const { jugador, paso } = escenario();
    expect(jugador.intentarEsquivaPerfecta()).toBe(false);
    paso(1, [], ["embestida"]);
    expect(jugador.intentarEsquivaPerfecta()).toBe(true);
    expect(jugador.criticoGarantizado).toBe(true);
    expect(jugador.intentarEsquivaPerfecta()).toBe(false);
  });

  it("acertar en el aire te sostiene y recupera el salto aéreo", () => {
    const { jugador, partida, paso } = escenario();
    partida.runas = ["viento", null];
    paso(1, ["saltar"], ["saltar"]);
    paso(1, ["saltar"], ["saltar"]); // gasta el salto aéreo
    paso(20);
    expect(jugador.enSuelo).toBe(false);
    const ctx = { partida } as unknown as Contexto;
    jugador.vy = 200;
    jugador.alAcertarCuerpoACuerpo(ctx);
    expect(jugador.vy).toBeLessThanOrEqual(-40);
  });
});
