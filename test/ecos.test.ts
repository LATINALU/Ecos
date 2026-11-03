import { beforeEach, describe, expect, test } from "vitest";
import { AzarSemilla } from "minialu";
import { HABITOS_NEUTROS, RegistroHabitos, perfilHabitos } from "../src/dominio/habitos.ts";
import { registrarCicatriz, tituloDevorador, type Cicatriz } from "../src/dominio/cicatrices.ts";
import { crearEco, legadoDelPacto, premiosEco } from "../src/dominio/eco.ts";
import { generarEquipo } from "../src/dominio/equipo.ts";
import { Meta } from "../src/dominio/meta.ts";
import { Partida } from "../src/dominio/partida.ts";
import { ServicioLocal, recompensaVenganza } from "../src/infra/ecos-compartidos.ts";

describe("hábitos: el Eco pelea como peleabas", () => {
  test("un arquero de lejos y un brawler aéreo dan perfiles distintos", () => {
    const arquero = new RegistroHabitos();
    arquero.combate(60);
    for (let i = 0; i < 40; i++) arquero.golpe(170, false, "golpe", "arco");
    for (let i = 0; i < 6; i++) arquero.esquiva();
    const h1 = arquero.vector();
    expect(h1.distancia).toBeGreaterThan(0.8);
    expect(h1.estilo).toBe("arco");
    expect(h1.esquiva).toBeGreaterThan(0.5);
    expect(perfilHabitos(h1)).toContain("desde lejos");

    const aereo = new RegistroHabitos();
    aereo.combate(30);
    for (let i = 0; i < 40; i++) aereo.golpe(20, i % 3 !== 0, i % 4 === 0 ? "patada" : "golpe", "pesada");
    const h2 = aereo.vector();
    expect(h2.distancia).toBeLessThan(0.1);
    expect(h2.aereo).toBeGreaterThan(0.5);
    expect(perfilHabitos(h2)).toContain("aire");
  });

  test("con muy pocos golpes no inventa un estilo", () => {
    const r = new RegistroHabitos();
    r.golpe(100, true, "golpe", "arco");
    expect(r.vector()).toEqual(HABITOS_NEUTROS);
  });
});

describe("cicatrices del Pozo", () => {
  const cic = (piso: number): Cicatriz => ({
    piso, portador: "Lucía", asesino: { nombre: "Cráneo Saltarín", conducta: "saltador", elite: true, afijos: ["explosivo"] },
    arma: "espada", colorArma: "#fff", almaTecnica: 3, fecha: 1,
  });

  test("una por piso, la nueva reemplaza; el Devorador lleva tu nombre", () => {
    const l = registrarCicatriz(registrarCicatriz([], cic(4)), { ...cic(4), portador: "Otra" });
    expect(l).toHaveLength(1);
    expect(tituloDevorador(l[0])).toBe("Devorador de Otra");
  });

  test("la Meta la guarda y vencer al Devorador la cierra", () => {
    const meta = Meta.nueva();
    meta.marcarCicatriz(cic(4));
    const copia = new Meta(meta.serializar());
    expect(copia.cicatrizDelPiso(4)?.asesino.afijos).toEqual(["explosivo"]);
    copia.cerrarCicatriz(4);
    expect(copia.cicatrizDelPiso(4)).toBeUndefined();
  });
});

describe("pactar con tu Eco (Espectro Temporal)", () => {
  test("sin el legado en el botín; al cumplir el pacto vuelve con un templado más", () => {
    const azar = new AzarSemilla(3);
    const legado = generarEquipo(azar, 5, 3);
    const eco = crearEco({
      piso: 5, forma: null, nivel: 8, stats: { hp: 100, mp: 40, golpe: 20, patada: 20, tecnica: 20, defensa: 5, critico: 5, suerte: 0, regen: 0 },
      equipo: [legado], causa: "x", numero: 1, botin: { equipo: [legado], pilas: [], esquirlas: 10 },
    }, azar, 1);
    const normal = premiosEco(eco, azar);
    const pacto = premiosEco(eco, azar, true);
    expect(normal.some((p) => p.tipo === "equipo" && p.equipo.uid === legado.uid)).toBe(true);
    expect(pacto.some((p) => p.tipo === "equipo" && p.equipo.uid === legado.uid)).toBe(false);
    const mejorado = legadoDelPacto(eco, azar)!;
    expect(mejorado.refinado).toBe((legado.refinado ?? 0) + 1);
  });

  test("las piezas espectrales se desvanecen al terminar el descenso", () => {
    const p = new Partida(Meta.nueva(), 4);
    p.recoger({ tipo: "equipo", equipo: { ...generarEquipo(new AzarSemilla(1), 5, 4), espectral: true } });
    expect(p.quitarEspectrales()).toBe(1);
    expect(p.quitarEspectrales()).toBe(0);
  });
});

describe("Ecos asíncronos (servicio local entre ranuras)", () => {
  beforeEach(() => {
    const datos = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
    };
  });

  test("encuentras el Eco de OTRO Portador, nunca el tuyo; vengarlo le avisa y le paga", async () => {
    const s = new ServicioLocal();
    const azar = new AzarSemilla(9);
    const eco = { ...crearEco({ piso: 14, forma: null, nivel: 20, stats: { hp: 1, mp: 1, golpe: 1, patada: 1, tecnica: 1, defensa: 1, critico: 1, suerte: 0, regen: 0 }, equipo: [], causa: "x", numero: 1 }, azar, Date.now()) };
    s.publicar({ eco, portador: "Ana", autor: "ranura-1" });
    expect(s.buscar(14, "ranura-1")).toBeNull();
    const encontrado = s.buscar(14, "ranura-2");
    expect(encontrado?.portador).toBe("Ana");
    s.vengar(encontrado!, "Beto", recompensaVenganza(14));
    expect(s.buscar(14, "ranura-2")).toBeNull();
    const avisos = await s.venganzas("ranura-1");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ piso: 14, vengador: "Beto", recompensa: recompensaVenganza(14) });
    expect(await s.venganzas("ranura-1")).toHaveLength(0);
  });
});
