import { describe, expect, it } from "vitest";
import { AzarSemilla } from "minialu";
import { ALMAS } from "../src/contenido/almas.ts";
import { OBJ_CARTA, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO } from "../src/contenido/objetos.ts";
import { todasLasPlantillas } from "../src/contenido/plantillas.ts";
import { botinCofre, botinEnemigo } from "../src/dominio/botin.ts";
import { crearCarta, fusionarCartas, mejorarCarta, NIVEL_MAX_CARTA, rangoCarta } from "../src/dominio/cartas.ts";
import { crearEco, premiosEco, registrarEco } from "../src/dominio/eco.ts";
import { crearUnico, generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { aperturas, esValido, generarPiso, resolver, type MapaPiso } from "../src/dominio/mundo/generador.ts";
import { COLS, FILAS, T_CRISTAL, T_PLATAFORMA, T_VACIO, construirSala, indice } from "../src/dominio/mundo/sala.ts";
import { Partida, cartaDe } from "../src/dominio/partida.ts";
import { calcularGolpe } from "../src/dominio/stats.ts";

describe("plantillas", () => {
  it("respetan medidas, zona central y zonas de puerta", () => {
    for (const p of todasLasPlantillas()) {
      expect(p.filas, p.nombre).toHaveLength(12);
      p.filas.forEach((f, y) => {
        expect(f, `${p.nombre} fila ${y}`).toHaveLength(26);
        for (let x = 9; x <= 16; x++) expect("#^".includes(f[x]), `${p.nombre} central ${x},${y}`).toBe(false);
        if (y >= 9) {
          for (const x of [0, 1, 2, 23, 24, 25]) expect(f[x] === "." || /[a-z]/.test(f[x]), `${p.nombre} puerta ${x},${y}`).toBe(true);
          for (const x of [0, 1, 2, 23, 24, 25]) expect("#=^".includes(f[x]), `${p.nombre} puerta ${x},${y}`).toBe(false);
        }
      });
    }
  });
});

describe("salas", () => {
  it("abre puertas, pozos y barreras", () => {
    const d = construirSala("normal", 3, { izq: { barrera: "cristal" }, der: {}, arr: {}, aba: {} }, new AzarSemilla(1), 1);
    expect(d.tiles).toHaveLength(COLS * FILAS);
    expect(d.tiles[indice(0, 12)]).toBe(T_VACIO);
    expect(d.tiles[indice(1, 12)]).toBe(T_CRISTAL);
    expect(d.tiles[indice(29, 12)]).toBe(T_VACIO);
    expect(d.tiles[indice(14, 0)]).toBe(T_VACIO);
    expect(d.tiles[indice(14, 14)]).toBe(T_PLATAFORMA);
    expect(d.tiles[indice(14, 16)]).toBe(T_VACIO);
    expect(d.tiles[indice(14, 5)]).toBe(T_PLATAFORMA);
  });
});

describe("generador de pisos", () => {
  it("siempre deja al jefe alcanzable, con o sin reliquias", () => {
    for (let s = 1; s <= 120; s++) {
      const poseidas = s % 3 === 0 ? [] : s % 3 === 1 ? (["embestida"] as const) : (["embestida", "dobleSalto", "garraIgnea"] as const);
      const mapa = generarPiso(new AzarSemilla(s), {
        piso: 1 + (s % 3), cantidadSalas: 9 + (s % 5), ancho: 7, alto: 5,
        reliquiasPoseidas: [...poseidas], reliquiaAColocar: poseidas.length === 0 ? "embestida" : undefined, hayEco: s % 2 === 0,
      });
      expect(esValido(mapa, [...poseidas]), `semilla ${s}`).toBe(true);
      expect(mapa.salas[mapa.jefe].tipo).toBe("jefe");
      expect(resolver(mapa, [...poseidas]).alcanzables.has(mapa.jefe)).toBe(true);
    }
  });

  it("las aperturas de vecinos son simétricas", () => {
    const mapa: MapaPiso = generarPiso(new AzarSemilla(42), {
      piso: 1, cantidadSalas: 12, ancho: 7, alto: 5, reliquiasPoseidas: [], hayEco: false,
    });
    for (const c of mapa.conexiones) {
      const desdeA = aperturas(mapa, c.a)[c.dir];
      expect(desdeA?.destino).toBe(c.b);
    }
  });
});

describe("cartas", () => {
  it("se crean dentro del rango de su estrella", () => {
    const azar = new AzarSemilla(7);
    for (const a of ALMAS) {
      for (let n = 0; n <= NIVEL_MAX_CARTA; n++) {
        const c = crearCarta(azar, a.id, n);
        const { minimos, maximos } = rangoCarta(a.id, n);
        const f = c.brillante === true ? 1.2 : 1; // las Resplandecientes llevan +20 %
        for (const k of Object.keys(maximos)) {
          expect(c.stats[k]).toBeGreaterThanOrEqual(Math.floor(minimos[k] * f));
          expect(c.stats[k]).toBeLessThanOrEqual(Math.round(maximos[k] * f));
        }
      }
    }
  });

  it("tres cartas iguales en tipo y estrella se fusionan; distinto nivel falla", () => {
    const azar = new AzarSemilla(3);
    const a = crearCarta(azar, 4, 0);
    const b = crearCarta(azar, 5, 0);
    const c = crearCarta(azar, 4, 0);
    const r = fusionarCartas([a, b, c], azar);
    expect(r.ok && r.valor.subio && r.valor.carta.nivel === 1 && r.valor.carta.tipo === 2).toBe(true);
    const mala = fusionarCartas([a, b, crearCarta(azar, 4, 1)], azar);
    expect(mala.ok ? null : mala.error).toBe("distinto-nivel");
  });

  it("la mejora tiene tope de 5", () => {
    const azar = new AzarSemilla(9);
    let c = crearCarta(azar, 0, 2);
    for (let i = 0; i < 5; i++) {
      const r = mejorarCarta(c, azar);
      expect(r.ok).toBe(true);
      if (r.ok) c = r.valor.carta;
    }
    expect(mejorarCarta(c, azar).ok).toBe(false);
  });
});

describe("equipo y botín", () => {
  it("genera equipo y únicos con stats positivos", () => {
    const azar = new AzarSemilla(11);
    for (let i = 0; i < 50; i++) {
      const e = generarEquipo(azar, 1 + (i % 3));
      expect(Object.values(e.stats).every((v) => v > 0)).toBe(true);
    }
    const u = crearUnico(azar, 2);
    expect(u.rareza).toBe(4);
    expect(u.efecto).toBeDefined();
  });

  it("los jefes siempre sueltan un único y los cofres una recompensa principal", () => {
    const azar = new AzarSemilla(5);
    const jefe = botinEnemigo(azar, 2, "jefe");
    expect(jefe.some((p) => p.tipo === "equipo" && p.equipo.rareza === 4)).toBe(true);
    const cofre = botinCofre(azar, 1);
    expect(cofre.length).toBe(4);
  });
});

describe("partida", () => {
  it("equipar suma stats y desequipar los quita", () => {
    const meta = Meta.nueva();
    const p = new Partida(meta, 123);
    p.equipo.arma = null; // se empieza con un arma; la quitamos para medir
    const antes = p.stats().golpe;
    const espada = { ...generarEquipo(p.azar, 1), stats: { golpe: 10 }, ranura: "arma" as const };
    expect(p.recoger({ tipo: "equipo", equipo: espada }).ok).toBe(true);
    const pos = [...p.mochila.posiciones()].find((q) => p.mochila.en(q)?.objeto === espada.base)!;
    expect(p.equiparDesde(pos).ok).toBe(true);
    expect(p.stats().golpe).toBe(antes + 10);
    expect(p.desequipar("arma").ok).toBe(true);
    expect(p.stats().golpe).toBe(antes);
  });

  it("fusiona desde el mazo cobrando esquirlas y con Lágrima sube seguro", () => {
    const p = new Partida(Meta.nueva(), 1);
    p.billetera.acreditar("esquirlas", 10000);
    for (let i = 0; i < 3; i++) p.recoger({ tipo: "carta", carta: crearCarta(p.azar, 2, 5) });
    p.recoger({ tipo: "objeto", objeto: OBJ_LAGRIMA, cantidad: 1 });
    const pos = [...p.mazo.posiciones()].filter((q) => p.mazo.en(q)?.objeto === OBJ_CARTA).slice(0, 3);
    const r = p.fusionar([pos[0], pos[1], pos[2]], true);
    expect(r.ok && r.valor.subio).toBe(true);
    expect(cartaDe(p.mazo.en(pos[0])!)?.nivel).toBe(6);
    expect(p.mochila.contar(OBJ_LAGRIMA)).toBe(0);
  });

  it("el Manto del Eco salva una vez por piso", () => {
    const p = new Partida(Meta.nueva(), 2);
    p.equipo.armadura = { ...crearUnico(p.azar, 1), efecto: "segunda-vida" };
    expect(p.recibirDanio(99999)).toBe("salvado");
    expect(p.recibirDanio(99999)).toBe("muerto");
  });

  it("compra en el mercader con minialu/comprar", () => {
    const p = new Partida(Meta.nueva(), 4);
    p.billetera.acreditar("esquirlas", 100);
    const antes = p.mochila.contar(OBJ_POCION);
    expect(p.comprar(OBJ_POCION).ok).toBe(true);
    expect(p.mochila.contar(OBJ_POCION)).toBe(antes + 1);
    expect(p.comprar(OBJ_POLVO).ok).toBe(false);
  });
});

describe("ecos y meta", () => {
  it("al morir se crea un Eco con el mejor equipo como legado, uno por piso", () => {
    const azar = new AzarSemilla(8);
    const p = new Partida(Meta.nueva(), 8);
    const unico = crearUnico(azar, 1);
    const eco = crearEco({
      piso: 2, forma: p.forma, nivel: 5, stats: p.stats(), equipo: [generarEquipo(azar, 1), unico, null], causa: "x", numero: 1,
    }, azar, 1000);
    expect(eco.legado?.uid).toBe(unico.uid);
    expect(premiosEco(eco, azar).some((x) => x.tipo === "equipo")).toBe(true);
    const ecos = registrarEco(registrarEco([], eco), { ...eco, uid: "otro" });
    expect(ecos).toHaveLength(1);
  });

  it("las mejoras del santuario cobran esencia y tienen máximo", () => {
    const meta = Meta.nueva();
    expect(meta.comprarMejora("afinidad").ok).toBe(false);
    meta.ganarEsencia(1000);
    expect(meta.comprarMejora("afinidad").ok).toBe(true);
    expect(meta.comprarMejora("afinidad").ok).toBe(true);
    const r = meta.comprarMejora("afinidad");
    expect(r.ok ? null : r.error).toBe("al-maximo");
    expect(meta.esencia).toBe(720);
    const copia = new Meta(meta.serializar());
    expect(copia.nivelMejora("afinidad")).toBe(2);
  });

  it("el daño respeta defensa y nunca es menor que 1", () => {
    const azar = new AzarSemilla(1);
    expect(calcularGolpe(azar, 1, 0.1, 9999, 0).danio).toBe(1);
    const sinDef = calcularGolpe(new AzarSemilla(2), 100, 1, 0, 0).danio;
    const conDef = calcularGolpe(new AzarSemilla(2), 100, 1, 60, 0).danio;
    expect(conDef).toBeLessThan(sinDef);
  });
});
