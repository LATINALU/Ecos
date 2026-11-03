// Estado de una partida (una bajada al Pozo). Orquesta las mecánicas de minialu:
//   Inventario (mochila y mazo de cartas), Billetera (esquirlas), CurvaNiveles (nivel de la partida),
//   Catalogo + comprar (mercader), y las reglas propias: forma/resonancias, equipo, únicos y Ecos.
// No sabe nada de render ni de teclado: la escena le pide cosas y muestra el Resultado.

import {
  AzarSemilla, Billetera, Catalogo, Inventario, PuntosHabilidad, RegistroMisiones, comprar, curvaPolinomica, exito, fallo, pagoConBilletera, transferir,
  type Azar, type ErrorHabilidad, type ErrorMision, type MisionActiva, type ReglasHabilidades, type Capa, type CurvaNiveles, type ErrorCompra, type ErrorFusion, type Pila, type Posicion, type Resultado,
} from "minialu";
import { ALMAS } from "../contenido/almas.ts";
import { pasivaMitica } from "../contenido/miticas.ts";
import {
  RANURAS_ALMA, cantidadExtra, escalaCarta, grimorio, topeEfecto,
  type ClaveEfecto, type DefHabilidad, type RanuraAlma,
} from "../contenido/grimorio.ts";
import { ESTILOS, type DefEstilo } from "../contenido/armas.ts";
import {
  CONSUMIBLES, MAT_FRAGMENTO, OBJ_CARTA, dadoParaNivel, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO, apilable, estiloDe, maxPila,
  type EstiloArma,
} from "../contenido/objetos.ts";
import { CORAZONES_INICIALES, CORAZONES_MAX, SUBARMAS, type IdSubarma } from "../contenido/subarmas.ts";
import { TALENTOS, talento, type IdTalento } from "../contenido/talentos.ts";
import { MAX_MISIONES_ACTIVAS, mision } from "../contenido/misiones.ts";
import { CONJUNTOS, type BonoConjunto, type IdConjunto } from "../contenido/conjuntos.ts";
import { MULT_RUNA, RASGOS_EQUIPO, objetoRuna, runaDeObjeto, type IdRasgoEquipo, type IdRuna } from "../contenido/objetos.ts";
import { potenciaElemental, type Elemento } from "../contenido/elementos.ts";
import type { ModificadoresBotin, Premio } from "./botin.ts";
import {
  COSTO_FUSION, capaForma, crearCarta, fusionarCartas, mejorarCarta, nombreCarta, type Carta,
} from "./cartas.ts";
import { capaEquipo, equipoInicial, normalizarEquipo, valorDesguace, type ObjetoEquipo } from "./equipo.ts";
import type { Meta } from "./meta.ts";
import { BASE_PORTADOR, STATS, bloque, capaNivel, escalarCapa, type Bloque, type Stat } from "./stats.ts";
import { RANURAS, ranurasDePieza, type EfectoUnico, type Ranura, type Reliquia } from "./tipos.ts";

/** Ranura del mazo de almas: 0 Forma, 1-3 Habilidades, 4 Definitiva. */
export type RanuraCarta = RanuraAlma;

/** Stats que aporta cada ranura del mazo (la Forma, entera; el resto, una fracción; más si es de la misma familia). */
export const FACTOR_RANURA_ALMA: readonly number[] = [1, 0.3, 0.3, 0.3, 0.4];
export const BONO_SINTONIA = 0.15;
/** Carga necesaria para la Definitiva. */
export const CARGA_DEFINITIVA = 100;

export interface HabilidadEquipada {
  readonly ranura: RanuraAlma;
  readonly carta: Carta;
  readonly def: DefHabilidad;
  readonly escala: number;
  readonly potencia: number;
  readonly costo: number;
  readonly cd: number;
  readonly cantidad: number;
}

export const TAM_MOCHILA = 24;
/** Contenedor seguro: lo que va acá no se pierde al morir en el Pozo. */
export const TAM_SEGURO = 4;

/** Lo que se pierde al morir (y se lleva el Eco de ese piso). */
export interface BotinPerdido {
  readonly equipo: readonly ObjetoEquipo[];
  readonly pilas: readonly Pila[];
  readonly esquirlas: number;
}

export function botinVacio(b: BotinPerdido | undefined): boolean {
  return b === undefined || (b.equipo.length === 0 && b.pilas.length === 0 && b.esquirlas === 0);
}
export const TAM_MAZO = 24;

export const CATALOGO_MERCADER = new Catalogo(
  CONSUMIBLES.map((c) => ({ tienda: "mercader", pestana: 0, objeto: c.id, precio: c.precio })),
);

/** Puntos de habilidad del Portador (minialu/PuntosHabilidad): 3 por nivel, cada uno convertido en stat. */
export const HABILIDADES_PORTADOR: ReglasHabilidades = {
  puntosPorNivel: 3,
  tope: (nivel) => nivel * 3,
  factor: { hp: 6, mp: 3, golpe: 1.5, patada: 1.8, tecnica: 1.8, defensa: 0.7, critico: 0.5 },
};
/** El "personaje" en PuntosHabilidad (un solo Portador). */
const PORTADOR = 0;

export interface OpcionesInicio {
  readonly estilo?: EstiloArma;
  /** Alma de la carta inicial (si no, al azar). */
  readonly alma?: number;
}

export type ErrorTalento = "sin-puntos" | "requisito" | "ya-aprendido";

/** Modificadores de combate que no son stats: salen de rasgos del equipo, el rasgo de la carta y la pasiva. */
export interface ModCombate {
  /** Fracciones extra (0,2 = +20 %). */
  readonly alcance: number;
  readonly velocidad: number;
  readonly critDanio: number;
  readonly agilidad: number;
  readonly tecnicaDanio: number;
  readonly tecnicaCosto: number;
  /** Fracción del daño hecho que cura. */
  readonly robo: number;
  /** Éter extra por golpe acertado. */
  readonly eterGolpe: number;
  /** Probabilidad de esquivar un golpe (capas). */
  readonly esquiva: number;
  /** Fracción de daño recibido que se ignora (capas, collares). */
  readonly resistencia: number;
}

/** Estado serializable de una partida (para "Continuar descenso"). */
export interface DatosPartida {
  readonly version: 1;
  readonly semilla: number;
  readonly piso: number;
  readonly experiencia: number;
  readonly esquirlas: number;
  readonly mochila: readonly (Pila | null)[];
  readonly mazo: readonly (Pila | null)[];
  readonly equipo: Readonly<Record<Ranura, ObjetoEquipo | null>>;
  readonly forma: Carta | null;
  readonly resonancias: readonly [Carta | null, Carta | null];
  /** Mazo de 5 ranuras (guardados nuevos). Si falta, se arma con forma + resonancias. */
  readonly almas?: readonly (Carta | null)[];
  readonly hp: number;
  readonly mp: number;
  readonly enemigos: number;
  readonly jefes: number;
  readonly ecosVencidos: number;
  readonly segundaVidaUsada: boolean;
  readonly contadorCorazon: number;
  readonly puntos: Readonly<Partial<Record<Stat, number>>>;
  readonly talentos: readonly IdTalento[];
  /** Opcionales: guardados anteriores a las subarmas no los tienen. */
  readonly corazones?: number;
  readonly subarma?: IdSubarma | null;
  readonly runas?: readonly [IdRuna | null, IdRuna | null];
  readonly nivelesRuna?: readonly [number, number];
  /** Personaje persistente (pueblo): piso más hondo desde el que se puede empezar y misiones. */
  readonly pisoDesbloqueado?: number;
  readonly seguro?: readonly (Pila | null)[];
  readonly misiones?: { readonly activas: readonly MisionActiva[]; readonly entregadas: readonly number[] };
}

export interface ResumenPartida {
  readonly pisoAlcanzado: number;
  readonly nivel: number;
  readonly enemigos: number;
  readonly jefes: number;
  readonly ecos: number;
  readonly esencia: number;
  readonly victoria: boolean;
}

export class Partida {
  readonly azar: Azar;
  readonly curva: CurvaNiveles = curvaPolinomica(40, 26, 1.45);
  readonly billetera = new Billetera({ esquirlas: 0 });
  readonly mochila = new Inventario({ pestanas: 1, casillasPorPestana: TAM_MOCHILA, maxPila });
  readonly mazo = new Inventario({ pestanas: 1, casillasPorPestana: TAM_MAZO, maxPila });
  readonly seguro = new Inventario({ pestanas: 1, casillasPorPestana: TAM_SEGURO, maxPila });
  readonly equipo: Record<Ranura, ObjetoEquipo | null> = equipoVacio();
  /** Mazo de almas: [Forma, Habilidad I, II, III, Definitiva]. */
  readonly almas: (Carta | null)[] = [null, null, null, null, null];
  /** Carga de la Definitiva (0~100). No se guarda: cada descenso empieza en 0. */
  cargaDefinitiva = 0;

  piso = 1;
  experiencia = 0;
  hp = 1;
  mp = 0;
  enemigos = 0;
  jefes = 0;
  ecosVencidos = 0;
  corazones = CORAZONES_INICIALES;
  subarma: IdSubarma | null = null;
  /** Piso más hondo desde el que se puede empezar a bajar (se desbloquea venciendo guardianes). */
  pisoDesbloqueado = 1;
  /** Tablón de misiones de la taberna (minialu/RegistroMisiones). */
  readonly misiones = new RegistroMisiones(mision, MAX_MISIONES_ACTIVAS);
  /** Dos ranuras de runa (pasivas equipables). */
  runas: [IdRuna | null, IdRuna | null] = [null, null];
  /** Rareza de cada runa engarzada (0 Común … 3 Legendaria). */
  nivelesRuna: [number, number] = [0, 0];
  segundaVidaUsada = false;
  readonly puntos = new PuntosHabilidad(HABILIDADES_PORTADOR);
  readonly talentos = new Set<IdTalento>();
  private contadorCorazon = 0;
  private readonly meta: Meta;
  readonly semilla: number;

  /** `"vacia"` crea una partida sin equipo inicial (la usa `restaurar`). */
  constructor(meta: Meta, semilla: number, inicio: OpcionesInicio | "vacia" = {}) {
    this.meta = meta;
    this.semilla = semilla;
    this.azar = new AzarSemilla(semilla);
    if (inicio === "vacia") return;
    const elegida = inicio.alma !== undefined ? ALMAS[inicio.alma] : undefined;
    const almaInicial = elegida ?? ALMAS[semilla % ALMAS.length];
    this.forma = crearCarta(this.azar, almaInicial.id, meta.nivelMejora("afinidad"));
    // El alma inicial también llega como Habilidad I: se empieza con una habilidad activa (L).
    this.almas[1] = crearCarta(this.azar, almaInicial.id, 0);
    meta.verAlma(almaInicial.id);
    this.equipo.arma = equipoInicial(this.azar, ESTILOS[inicio.estilo ?? "espada"].armaInicial);
    this.mochila.agregar(OBJ_POCION, 1 + meta.nivelMejora("frascos"));
    this.billetera.acreditar("esquirlas", 40 * meta.nivelMejora("memoria"));
    const s = this.stats();
    this.hp = s.hp;
    this.mp = s.mp;
  }

  // ---------------- Estilo, pasiva, talentos y puntos ----------------

  estilo(): DefEstilo {
    return ESTILOS[estiloDe(this.equipo.arma?.base)];
  }

  // ---------------- Mazo de almas ----------------

  /** La carta de la ranura Forma (aspecto, técnica del Eco y pasiva de ataques básicos). */
  get forma(): Carta | null {
    return this.almas[0];
  }

  set forma(c: Carta | null) {
    this.almas[0] = c;
  }

  /**
   * Suma de las pasivas de las 5 ranuras del mazo (escaladas por el nivel de cada carta) y de las pasivas
   * MÍTICAS del equipo puesto, con sus topes.
   */
  efectosAlma(): Readonly<Partial<Record<ClaveEfecto, number>>> {
    const total: Partial<Record<ClaveEfecto, number>> = {};
    const sumar = (k: ClaveEfecto, v: number | undefined): void => {
      if (v !== undefined && v !== 0) total[k] = (total[k] ?? 0) + v;
    };
    // Runas nuevas (efectos de golpe y de combate, escalados por su rareza).
    sumar("golpeRayo", 0.1 * this.potenciaRuna("tormenta"));
    sumar("golpeVeneno", 0.14 * this.potenciaRuna("ponzona"));
    sumar("hpPct", 0.07 * this.potenciaRuna("fortaleza"));
    sumar("velocidad", 0.07 * this.potenciaRuna("presteza"));
    sumar("enfriamiento", 0.07 * this.potenciaRuna("sabio"));
    sumar("critDanio", 0.22 * this.potenciaRuna("verdugo"));
    for (const r of RANURAS) {
      const o = this.equipo[r];
      if (o === null) continue;
      // Modificadores del equipo que funcionan como pasivas (vida, defensa, robo, enfriamiento, esquiva...).
      for (const [id, v] of Object.entries(o.rasgos ?? {})) {
        const def = RASGOS_EQUIPO.find((x) => x.id === id);
        if (def?.efecto !== undefined) sumar(def.efecto, v);
      }
      if (o.pasiva === undefined) continue;
      for (const [k, v] of Object.entries(pasivaMitica(o.pasiva).efectos) as [ClaveEfecto, number][]) sumar(k, v);
    }
    RANURAS_ALMA.forEach((r) => {
      const c = this.almas[r];
      if (c === null) return;
      const escala = escalaCarta(c);
      for (const [k, v] of Object.entries(grimorio(c.personaje).pasivas[r].efectos) as [ClaveEfecto, number][]) {
        total[k] = (total[k] ?? 0) + v * escala;
      }
    });
    for (const k of Object.keys(total) as ClaveEfecto[]) total[k] = topeEfecto(k, total[k]!);
    return total;
  }

  efectoAlma(k: ClaveEfecto): number {
    return this.efectosAlma()[k] ?? 0;
  }

  /** Habilidad de una ranura activa (1, 2, 3 o 4 = Definitiva), con su potencia y costo actuales. */
  habilidad(r: RanuraAlma): HabilidadEquipada | null {
    if (r === 0) return null;
    const carta = this.almas[r];
    if (carta === null) return null;
    const def = grimorio(carta.personaje).habilidades[r - 1];
    const escala = escalaCarta(carta);
    const m = this.combate();
    const tecnicaDanio = 1 + m.tecnicaDanio + (carta.rasgo === "furiosa" ? 0.2 : 0);
    const potencia = this.stats().tecnica * def.mult * this.estilo().tecnica * escala * tecnicaDanio;
    const costo = r === 4 ? 0 : this.costoTecnica(def.costo * (carta.rasgo === "eterna" ? 0.75 : 1));
    const cd = r === 4 ? def.cd : def.cd * (1 - this.efectoAlma("enfriamiento"));
    return { ranura: r, carta, def, escala, potencia, costo, cd, cantidad: (def.cantidad ?? 1) + (def.forma === "aura" || def.forma === "embestida" || def.forma === "salto" || def.forma === "onda" || def.forma === "nova" ? 0 : cantidadExtra(carta.nivel)) };
  }

  /** Al llegar a un piso nuevo: la Lágrima del Pozo deja la Definitiva al 40 %. */
  alEmpezarPiso(): void {
    if (this.tieneReliquia("lagrimaPozo") && this.almas[4] !== null) this.cargaDefinitiva = Math.max(this.cargaDefinitiva, 40);
  }

  /** Suma carga a la Definitiva (golpes, daño recibido). Devuelve true si se llenó en este momento. */
  ganarCarga(n: number): boolean {
    if (this.almas[4] === null) return false;
    const antes = this.cargaDefinitiva;
    this.cargaDefinitiva = Math.min(CARGA_DEFINITIVA, this.cargaDefinitiva + n * (1 + this.efectoAlma("carga") + (this.tieneReliquia("lagrimaPozo") ? 0.2 : 0)));
    return antes < CARGA_DEFINITIVA && this.cargaDefinitiva >= CARGA_DEFINITIVA;
  }

  tieneTalento(id: IdTalento): boolean {
    return this.talentos.has(id);
  }

  puntosTalento(): number {
    return Math.max(0, this.nivel() - 1 - this.talentos.size);
  }

  aprenderTalento(id: IdTalento): Resultado<void, ErrorTalento> {
    if (this.talentos.has(id)) return fallo("ya-aprendido");
    const def = talento(id);
    const previo = TALENTOS.find((t) => t.senda === def.senda && t.grado === def.grado - 1);
    if (previo !== undefined && !this.talentos.has(previo.id)) return fallo("requisito");
    if (this.puntosTalento() < 1) return fallo("sin-puntos");
    this.talentos.add(id);
    this.ajustarRecursos();
    return exito(undefined);
  }

  asignarPunto(stat: Stat, cantidad: number | "max" = 1): Resultado<number, ErrorHabilidad> {
    const antes = this.stats();
    const r = this.puntos.asignar(PORTADOR, stat, this.nivel(), cantidad);
    if (r.ok) {
      // Lo que sube el máximo también se llena.
      const despues = this.stats();
      this.hp += Math.max(0, despues.hp - antes.hp);
      this.mp += Math.max(0, despues.mp - antes.mp);
    }
    return r;
  }

  /** Devuelve todos los puntos de stats (cuesta esquirlas). */
  redistribuirPuntos(costo: number): Resultado<void, "sin-fondos"> {
    if (!this.billetera.debitar("esquirlas", costo).ok) return fallo("sin-fondos");
    this.puntos.reiniciar();
    this.ajustarRecursos();
    return exito(undefined);
  }

  puntoEn(stat: Stat): number {
    return this.puntos.puntos(PORTADOR, stat);
  }

  costoTecnica(base: number): number {
    const m = this.combate();
    return Math.max(1, Math.round(base * this.estilo().costoTecnica * (this.tieneTalento("ecoTecnica") ? 0.75 : 1) * (1 - m.tecnicaCosto)));
  }

  /** Suma de rasgos de equipo + rasgo de la Forma + pasiva. */
  combate(): ModCombate {
    const m = { alcance: 0, velocidad: 0, critDanio: 0, agilidad: 0, tecnicaDanio: 0, tecnicaCosto: 0, robo: 0, eterGolpe: 0, esquiva: 0, resistencia: 0 };
    for (const r of RANURAS) {
      const rasgos = this.equipo[r]?.rasgos;
      if (rasgos === undefined) continue;
      // El resto de los modificadores llega por efectosAlma() (ver más abajo).
      m.alcance += rasgos.alcance ?? 0;
    }
    switch (this.forma?.rasgo) {
      case "veloz": m.velocidad += 0.12; break;
      case "eterna": m.tecnicaCosto += 0.25; break;
      case "furiosa": m.tecnicaDanio += 0.2; break;
      case "vampirica": m.robo += 0.03; break;
      default: break;
    }
    // Pasivas del mazo de almas.
    const e = this.efectosAlma();
    m.critDanio += e.critDanio ?? 0;
    m.velocidad += e.velocidad ?? 0;
    m.agilidad += e.agilidad ?? 0;
    m.robo += e.robo ?? 0;
    m.esquiva += e.esquiva ?? 0;
    m.resistencia += e.recibido ?? 0;
    m.tecnicaDanio += e.tecnicaDanio ?? 0;
    m.tecnicaCosto += e.tecnicaCosto ?? 0;
    m.eterGolpe += Math.round(e.eterGolpe ?? 0);
    if (this.tieneTalento("sedSangre")) m.robo += 0.05;
    m.robo += 0.04 * this.potenciaRuna("vampiro");
    m.tecnicaCosto += 0.15 * this.potenciaRuna("eco");
    if (this.tieneReliquia("botasCefiro")) m.agilidad += 0.12;
    for (const b of this.bonosConjunto()) {
      m.velocidad += b.velocidad ?? 0;
      m.robo += b.robo ?? 0;
      m.tecnicaDanio += b.tecnicaDanio ?? 0;
      m.tecnicaCosto += b.tecnicaCosto ?? 0;
      m.critDanio += b.critDanio ?? 0;
    }
    m.tecnicaCosto = Math.min(0.75, m.tecnicaCosto);
    m.esquiva = Math.min(0.3, m.esquiva);
    m.resistencia = Math.min(0.5, m.resistencia);
    return m;
  }

  /** Elemento del arma equipada y su potencia (daño extra como fracción del golpe), sumando los rasgos "Daño elemental". */
  elementoArma(): { readonly elemento: Elemento; readonly potencia: number } | null {
    const arma = this.equipo.arma;
    if (arma?.elemento === undefined) return null;
    let extra = 0;
    for (const r of RANURAS) extra += this.equipo[r]?.rasgos?.elemental ?? 0;
    return { elemento: arma.elemento, potencia: potenciaElemental(arma.rareza) + extra };
  }

  // ---------------- Runas y conjuntos ----------------

  tieneRuna(r: IdRuna): boolean {
    return this.runas[0] === r || this.runas[1] === r;
  }

  /** Multiplicador del efecto de una runa engarzada según su rareza (0 si no está). */
  potenciaRuna(r: IdRuna): number {
    if (this.runas[0] === r) return MULT_RUNA[this.nivelesRuna[0]] ?? 1;
    if (this.runas[1] === r) return MULT_RUNA[this.nivelesRuna[1]] ?? 1;
    return 0;
  }

  tieneReliquia(r: Reliquia): boolean {
    return this.meta.tieneReliquia(r);
  }

  /** Engarza una runa de la mochila en una ranura; la que estaba vuelve a la mochila. */
  engarzarRuna(pos: Posicion, ranura: 0 | 1): Resultado<IdRuna, "casilla-vacia" | "no-es-runa" | "repetida"> {
    const pila = this.mochila.en(pos);
    if (pila === null) return fallo("casilla-vacia");
    const def = runaDeObjeto(pila.objeto);
    if (def === undefined) return fallo("no-es-runa");
    if (this.runas[1 - ranura] === def.id) return fallo("repetida");
    this.mochila.sacarDe(pos, 1);
    const anterior = this.runas[ranura];
    const nivelAnterior = this.nivelesRuna[ranura];
    this.runas[ranura] = def.id;
    this.nivelesRuna[ranura] = def.nivel;
    if (anterior !== null) this.mochila.agregar(objetoRuna(anterior, nivelAnterior), 1);
    this.ajustarRecursos();
    return exito(def.id);
  }

  quitarRuna(ranura: 0 | 1): Resultado<void, "vacia" | "sin-espacio"> {
    const r = this.runas[ranura];
    if (r === null) return fallo("vacia");
    if (!this.mochila.agregar(objetoRuna(r, this.nivelesRuna[ranura]), 1).ok) return fallo("sin-espacio");
    this.runas[ranura] = null;
    this.nivelesRuna[ranura] = 0;
    this.ajustarRecursos();
    return exito(undefined);
  }

  /** Piezas equipadas por conjunto. */
  piezasConjunto(): Map<IdConjunto, number> {
    const cuenta = new Map<IdConjunto, number>();
    for (const r of RANURAS) {
      const c = this.equipo[r]?.conjunto;
      if (c !== undefined) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
    return cuenta;
  }

  /** Bonos activos (2 piezas, y 4 piezas además del de 2). */
  bonosConjunto(): BonoConjunto[] {
    const bonos: BonoConjunto[] = [];
    for (const [id, n] of this.piezasConjunto()) {
      const def = CONJUNTOS.find((c) => c.id === id)!;
      if (n >= 2) bonos.push(def.dos);
      if (n >= 4) bonos.push(def.cuatro);
      if (n >= 6) bonos.push(def.seis);
    }
    return bonos;
  }

  bonoConjuntoActivo(efecto: keyof BonoConjunto): number {
    return this.bonosConjunto().reduce((s, b) => {
      const v = b[efecto];
      return s + (typeof v === "number" ? v : v === true ? 1 : 0);
    }, 0);
  }

  /** Daño bruto (antes de defensa) de cada ataque, para mostrar en la interfaz. */
  potencias(): { golpe: number; combo: number; patada: number; tecnica: number; tecnicaNombre: string | null; costoTecnica: number } {
    const s = this.stats();
    const e = this.estilo();
    const mult = this.multiplicadorDanio();
    const combo = e.mults.reduce((a, b) => a + b, 0) + (this.tieneTalento("cuartoCorte") ? 2 : 0);
    const h1 = this.habilidad(1);
    return {
      golpe: Math.round(s.golpe * e.mults[0] * mult),
      combo: Math.round(s.golpe * combo * mult),
      patada: Math.round(s.patada * mult),
      tecnica: h1 === null ? 0 : Math.round(h1.potencia * mult),
      tecnicaNombre: h1?.def.nombre ?? null,
      costoTecnica: h1?.costo ?? 0,
    };
  }

  // ---------------- Stats ----------------

  nivel(): number {
    return this.curva.nivelDe(this.experiencia).nivel;
  }

  efectos(): Set<EfectoUnico> {
    const set = new Set<EfectoUnico>();
    for (const r of RANURAS) {
      const e = this.equipo[r]?.efecto;
      if (e !== undefined) set.add(e);
    }
    return set;
  }

  tiene(e: EfectoUnico): boolean {
    return this.efectos().has(e);
  }

  /** Capas con nombre, para el desglose del menú. */
  capas(): Record<string, Capa> {
    return {
      Base: BASE_PORTADOR,
      Nivel: capaNivel(this.nivel()),
      Santuario: { hp: 15 * this.meta.nivelMejora("vigor") },
      Forma: capaForma(this.forma),
      "Mazo de almas": sumarCapas(this.capaRanuraAlma(1), this.capaRanuraAlma(2), this.capaRanuraAlma(3), this.capaRanuraAlma(4)),
      Habilidades: this.puntos.capa(PORTADOR),
      "Pasivas de alma": {
        critico: Math.round(this.efectoAlma("critico")),
        regen: Math.round(this.efectoAlma("regen")),
      },
      Rasgo: {
        critico: this.forma?.rasgo === "afilada" ? 8 : 0,
        mp: this.sumaRasgo("eterMax"),
        suerte: this.sumaRasgo("suerte"),
      },
      Runas: { regen: Math.round(8 * this.potenciaRuna("calma")), suerte: Math.round(30 * this.potenciaRuna("coleccionista")) },
      Conjuntos: { critico: this.bonoConjuntoActivo("critico"), hp: this.bonoConjuntoActivo("hp") },
      Equipo: capaEquipo(RANURAS.map((r) => this.equipo[r])),
    };
  }

  stats(): Bloque {
    const b = bloque(Object.values(this.capas()));
    if (this.tiene("vidrio")) b.hp = Math.max(1, Math.round(b.hp * 0.65));
    if (this.forma?.rasgo === "colosal") b.hp = Math.round(b.hp * 1.15);
    const hpPct = this.efectoAlma("hpPct");
    if (hpPct > 0) b.hp = Math.round(b.hp * (1 + hpPct));
    const defensaPct = 0.2 * this.potenciaRuna("acero") + this.bonoConjuntoActivo("defensaPct") + this.efectoAlma("defensaPct");
    if (defensaPct > 0) b.defensa = Math.round(b.defensa * (1 + defensaPct));
    return b;
  }

  /** Multiplicador de daño infligido y recibido por efectos únicos. */
  multiplicadorDanio(): number {
    const furia = this.tieneRuna("furia") && this.hp < this.stats().hp * 0.4 ? 1 + 0.3 * this.potenciaRuna("furia") : 1;
    return (this.tiene("vidrio") ? 1.6 : 1) * furia * (1 + this.bonoConjuntoActivo("danio") + this.efectoAlma("danio") + 0.05 * this.potenciaRuna("brasa"));
  }

  multiplicadorRecibido(): number {
    return (this.tiene("corona") ? 1.3 : 1) * (1 - this.bonoConjuntoActivo("recibido")) * (1 - this.combate().resistencia);
  }

  /** Suma de un modificador en todo el equipo puesto. */
  sumaRasgo(id: IdRasgoEquipo): number {
    return RANURAS.reduce((s, r) => s + (this.equipo[r]?.rasgos?.[id] ?? 0), 0);
  }

  /**
   * Botín: la SUERTE multiplica la chance de que caigan cosas, inclina la rareza del equipo hacia arriba,
   * puede subir una estrella a las cartas y suma esquirlas.
   */
  modificadoresBotin(): ModificadoresBotin {
    const corona = this.tiene("corona");
    const suerte = this.stats().suerte;
    return {
      suerte: (corona ? 1.5 : 1) * (1 + suerte / 100),
      codicia: (1 + 0.12 * this.meta.nivelMejora("codicia")) * (corona ? 1.6 : 1) * (1 + 0.35 * this.potenciaRuna("avaro")) * (this.tieneReliquia("manoAvaro") ? 1.25 : 1)
        * (1 + this.sumaRasgo("codicia")) * (1 + suerte / 400),
      fortuna: suerte,
    };
  }

  /** Recorta vida y éter si bajó el máximo (por cambiar de equipo, por ejemplo). */
  ajustarRecursos(): void {
    const s = this.stats();
    this.hp = Math.min(this.hp, s.hp);
    this.mp = Math.min(this.mp, s.mp);
  }

  // ---------------- Progresión ----------------

  /** Devuelve cuántos niveles subió. Subir de nivel cura por completo. */
  ganarExperiencia(n: number): number {
    const antes = this.nivel();
    this.experiencia += Math.max(0, Math.round(n));
    const subidos = this.nivel() - antes;
    this.puntos.alcanzarNivel(this.nivel());
    if (subidos > 0) {
      const s = this.stats();
      this.hp = s.hp;
      this.mp = s.mp;
    }
    return subidos;
  }

  /** Registra una muerte de enemigo. Devuelve true si el Corazón del Pozo curó. */
  registrarMuerteEnemigo(): boolean {
    this.enemigos++;
    if (!this.tiene("corazon")) return false;
    this.contadorCorazon++;
    if (this.contadorCorazon >= 8) {
      this.contadorCorazon = 0;
      this.curar(Math.round(this.stats().hp * 0.2));
      return true;
    }
    return false;
  }

  curar(n: number): void {
    this.hp = Math.min(this.stats().hp, this.hp + n);
  }

  recuperarEter(n: number): void {
    this.mp = Math.min(this.stats().mp, this.mp + n);
  }

  /** Aplica daño. Devuelve "muerto", "salvado" (Manto del Eco) o "vivo". */
  recibirDanio(n: number): "vivo" | "salvado" | "muerto" {
    this.hp -= n;
    if (this.hp > 0) return "vivo";
    if (this.tiene("segunda-vida") && !this.segundaVidaUsada) {
      this.segundaVidaUsada = true;
      this.hp = 1;
      return "salvado";
    }
    this.hp = 0;
    return "muerto";
  }

  bajarPiso(): void {
    this.piso++;
    this.segundaVidaUsada = false;
    this.alEmpezarPiso();
  }

  // ---------------- Botín ----------------

  /** Mete un premio en la mochila, el mazo o la billetera. Si no entra, falla y el premio queda en el suelo. */
  recoger(p: Premio): Resultado<string, "sin-espacio"> {
    switch (p.tipo) {
      case "esquirlas":
        this.billetera.acreditar("esquirlas", p.cantidad);
        return exito(`+${p.cantidad} esquirlas`);
      case "objeto": {
        const r = this.mochila.agregar(p.objeto, p.cantidad);
        return r.ok ? exito(`${apilable(p.objeto)?.nombre ?? "Objeto"} ×${p.cantidad}`) : fallo("sin-espacio");
      }
      case "equipo": {
        const r = this.mochila.agregar(p.equipo.base, 1, { equipo: normalizarEquipo(p.equipo) });
        return r.ok ? exito(p.equipo.nombre) : fallo("sin-espacio");
      }
      case "carta": {
        const r = this.mazo.agregar(OBJ_CARTA, 1, { carta: p.carta });
        if (r.ok) this.meta.verAlma(p.carta.personaje);
        return r.ok ? exito(`Carta: ${nombreCarta(p.carta)}`) : fallo("sin-espacio");
      }
      case "corazones":
        this.corazones = Math.min(CORAZONES_MAX, this.corazones + p.cantidad);
        return exito(`+${p.cantidad} ♥`);
      case "subarma":
        this.subarma = p.subarma;
        return exito(`Subarma: ${SUBARMAS[p.subarma].nombre} (↑ + Patada)`);
    }
  }

  // ---------------- Equipo ----------------

  /** Ranura donde iría una pieza: la pedida si es válida; si no, la primera libre de su clase (anillos: I o II). */
  ranuraPara(obj: ObjetoEquipo, pedida?: Ranura): Ranura {
    const destinos = ranurasDePieza(obj.ranura);
    if (pedida !== undefined && destinos.includes(pedida)) return pedida;
    return destinos.find((d) => this.equipo[d] === null) ?? destinos[0];
  }

  equiparDesde(pos: Posicion, pedida?: Ranura): Resultado<ObjetoEquipo, "no-es-equipo" | "casilla-vacia"> {
    const pila = this.mochila.en(pos);
    if (pila === null) return fallo("casilla-vacia");
    const obj = equipoDe(pila);
    if (obj === undefined) return fallo("no-es-equipo");
    this.mochila.sacarDe(pos);
    const ranura = this.ranuraPara(obj, pedida);
    const anterior = this.equipo[ranura];
    this.equipo[ranura] = obj;
    if (anterior !== null) this.mochila.ponerEn(pos, { objeto: anterior.base, cantidad: 1, extra: { equipo: anterior } });
    this.ajustarRecursos();
    return exito(obj);
  }

  desequipar(r: Ranura): Resultado<void, "vacia" | "sin-espacio"> {
    const obj = this.equipo[r];
    if (obj === null) return fallo("vacia");
    const res = this.mochila.agregar(obj.base, 1, { equipo: obj });
    if (!res.ok) return fallo("sin-espacio");
    this.equipo[r] = null;
    this.ajustarRecursos();
    return exito(undefined);
  }

  /** Desguazar: convierte una pieza en esquirlas (venta al "NPC" del Pozo). */
  desguazar(pos: Posicion): Resultado<number, "no-es-equipo" | "casilla-vacia"> {
    const pila = this.mochila.en(pos);
    if (pila === null) return fallo("casilla-vacia");
    const obj = equipoDe(pila);
    if (obj === undefined) return fallo("no-es-equipo");
    this.mochila.sacarDe(pos);
    const valor = valorDesguace(obj);
    this.billetera.acreditar("esquirlas", valor);
    // El equipo valioso deja memoria cristalizada.
    if (obj.rareza >= 2) this.mochila.agregar(MAT_FRAGMENTO, obj.rareza >= 5 ? 4 : obj.rareza >= 4 ? 2 : 1);
    return exito(valor);
  }

  // ---------------- Cartas ----------------

  cartaEn(r: RanuraCarta): Carta | null {
    return this.almas[r];
  }

  private ponerCarta(r: RanuraCarta, c: Carta | null): void {
    this.almas[r] = c;
    if (r === 4 && c === null) this.cargaDefinitiva = 0;
  }

  /** Stats que aporta una ranura que no es la Forma: una fracción de la carta (sintonía si es de la familia de la Forma). */
  capaRanuraAlma(r: 1 | 2 | 3 | 4): Capa {
    const c = this.almas[r];
    if (c === null) return {};
    const sintonia = this.forma !== null && this.forma.tipo === c.tipo ? BONO_SINTONIA : 0;
    const talento = this.tieneTalento("resonanciaProfunda") ? 0.1 : 0;
    return escalarCapa(c.stats, FACTOR_RANURA_ALMA[r] + sintonia + talento);
  }

  /** Pone una carta del mazo en una ranura; la que estaba vuelve al mazo en la misma casilla. */
  asignarCarta(pos: Posicion, r: RanuraCarta): Resultado<Carta, "casilla-vacia"> {
    const pila = this.mazo.en(pos);
    const carta = pila === null ? undefined : cartaDe(pila);
    if (carta === undefined) return fallo("casilla-vacia");
    this.mazo.sacarDe(pos);
    const anterior = this.cartaEn(r);
    this.ponerCarta(r, carta);
    if (anterior !== null) this.mazo.ponerEn(pos, { objeto: OBJ_CARTA, cantidad: 1, extra: { carta: anterior } });
    this.ajustarRecursos();
    return exito(carta);
  }

  retirarCarta(r: RanuraCarta): Resultado<void, "vacia" | "sin-espacio"> {
    const c = this.cartaEn(r);
    if (c === null) return fallo("vacia");
    const res = this.mazo.agregar(OBJ_CARTA, 1, { carta: c });
    if (!res.ok) return fallo("sin-espacio");
    this.ponerCarta(r, null);
    this.ajustarRecursos();
    return exito(undefined);
  }

  /** Fusión en el Altar: tres cartas del mazo (mismo tipo y estrella) → una. Paga esquirlas; Lágrima = éxito. */
  fusionar(posiciones: readonly [Posicion, Posicion, Posicion], usarLagrima: boolean):
    Resultado<{ carta: Carta; subio: boolean; costo: number }, ErrorFusion | "casilla-vacia" | "repetida" | "sin-fondos" | "sin-lagrima"> {
    const claves = new Set(posiciones.map((p) => `${p.pestana}:${p.casilla}`));
    if (claves.size !== 3) return fallo("repetida");
    const cartas = posiciones.map((p) => {
      const pila = this.mazo.en(p);
      return pila === null ? undefined : cartaDe(pila);
    });
    if (cartas.some((c) => c === undefined)) return fallo("casilla-vacia");
    const [a, b, c] = cartas as Carta[];
    const costo = COSTO_FUSION[a.nivel] ?? 0;
    // Asegurar la fusión: primero el Dado del Destino de esa estrella; si no hay, una Lágrima de Eco.
    const dado = dadoParaNivel(a.nivel);
    const conDado = usarLagrima && dado !== undefined && this.mochila.contar(dado) > 0;
    if (usarLagrima && !conDado && this.mochila.contar(OBJ_LAGRIMA) < 1) return fallo("sin-lagrima");
    if (this.billetera.saldo("esquirlas") < costo) return fallo("sin-fondos");
    const r = fusionarCartas([a, b, c], this.azar, usarLagrima);
    if (!r.ok) return r;
    this.billetera.debitar("esquirlas", costo);
    if (conDado) this.mochila.quitar(dado!, 1);
    else if (usarLagrima) this.mochila.quitar(OBJ_LAGRIMA, 1);
    for (const p of posiciones) this.mazo.sacarDe(p);
    this.mazo.ponerEn(posiciones[0], { objeto: OBJ_CARTA, cantidad: 1, extra: { carta: r.valor.carta } });
    this.meta.verAlma(r.valor.carta.personaje);
    this.registrarMision("fusionar");
    return exito({ ...r.valor, costo });
  }

  /** Mejora con Polvo de Eco una carta equipada o del mazo. */
  mejorar(objetivo: RanuraCarta | Posicion): Resultado<{ carta: Carta; incremento: number }, "sin-polvo" | "casilla-vacia" | "al-maximo"> {
    if (this.mochila.contar(OBJ_POLVO) < 1) return fallo("sin-polvo");
    const enMazo = typeof objetivo === "object";
    const pila = enMazo ? this.mazo.en(objetivo) : null;
    const carta = enMazo ? (pila === null ? undefined : cartaDe(pila)) : this.cartaEn(objetivo) ?? undefined;
    if (carta === undefined) return fallo("casilla-vacia");
    const r = mejorarCarta(carta, this.azar);
    if (!r.ok) return r;
    this.mochila.quitar(OBJ_POLVO, 1);
    if (enMazo) {
      this.mazo.sacarDe(objetivo);
      this.mazo.ponerEn(objetivo, { objeto: OBJ_CARTA, cantidad: 1, extra: { carta: r.valor.carta } });
    } else {
      this.ponerCarta(objetivo, r.valor.carta);
    }
    this.registrarMision("mejorar");
    return exito(r.valor);
  }

  // ---------------- Consumibles y mercader ----------------

  usarPocion(): boolean {
    if (this.hp >= this.stats().hp || !this.mochila.quitar(OBJ_POCION, 1).ok) return false;
    this.curar(Math.round(this.stats().hp * 0.45 * (1 + this.sumaRasgo("curaPocion") + (this.tieneReliquia("corazonEco") ? 0.25 : 0))));
    return true;
  }

  usarEter(): boolean {
    if (this.mp >= this.stats().mp || !this.mochila.quitar(OBJ_ETER, 1).ok) return false;
    this.recuperarEter(Math.round(this.stats().mp * 0.7));
    return true;
  }

  comprar(objeto: number): Resultado<number, ErrorCompra> {
    const r = comprar({
      catalogo: CATALOGO_MERCADER, tienda: "mercader", objeto, inventario: this.mochila,
      pago: pagoConBilletera(this.billetera, "esquirlas"),
    });
    return r.ok ? exito(r.valor.saldoRestante) : r;
  }

  get esquirlas(): number {
    return this.billetera.saldo("esquirlas");
  }

  // ---------------- Subarmas ----------------

  /** Gasta los corazones de la subarma equipada. */
  costoSubarma(): number {
    if (this.subarma === null) return 0;
    return Math.max(1, SUBARMAS[this.subarma].costo - (this.tieneTalento("corazonValiente") ? 1 : 0));
  }

  gastarSubarma(): Resultado<IdSubarma, "sin-subarma" | "sin-corazones"> {
    if (this.subarma === null) return fallo("sin-subarma");
    const costo = this.costoSubarma();
    if (this.corazones < costo) return fallo("sin-corazones");
    this.corazones -= costo;
    return exito(this.subarma);
  }

  // ---------------- Pueblo: descensos, muerte y misiones ----------------

  /** Antes de bajar: elegir piso inicial (hasta el desbloqueado) y salir descansado. */
  prepararDescenso(piso: number): void {
    this.piso = Math.max(1, Math.min(piso, this.pisoDesbloqueado));
    this.segundaVidaUsada = false;
    this.cargaDefinitiva = 0;
    this.alEmpezarPiso();
    // Corazón del Eco: una poción extra al bajar.
    if (this.tieneReliquia("corazonEco")) this.mochila.agregar(OBJ_POCION, 1);
    this.curarTodo();
  }

  curarTodo(): void {
    const s = this.stats();
    this.hp = s.hp;
    this.mp = s.mp;
  }

  /** Vencer al guardián de un piso desbloquea empezar desde el siguiente. */
  desbloquearPiso(pisoVencido: number, pisosTotales: number): boolean {
    const nuevo = Math.min(pisosTotales, pisoVencido + 1);
    if (nuevo <= this.pisoDesbloqueado) return false;
    this.pisoDesbloqueado = nuevo;
    return true;
  }

  // ---------------- Extracción ----------------

  /**
   * Morir en el Pozo (como en Tarkov): se pierde TODO lo equipado, la mochila, la subarma y las esquirlas que llevabas.
   * Se conservan el contenedor seguro, las cartas, el nivel, los talentos, las runas engarzadas y el banco.
   * Devuelve lo perdido (el Eco del piso lo guarda: si lo vences, lo recuperas).
   */
  perderTodo(): BotinPerdido {
    const equipo: ObjetoEquipo[] = [];
    for (const r of RANURAS) {
      const o = this.equipo[r];
      if (o !== null) equipo.push(o);
      this.equipo[r] = null;
    }
    const pilas: Pila[] = [];
    for (const pos of [...this.mochila.posiciones()]) {
      const p = this.mochila.en(pos);
      if (p === null) continue;
      pilas.push({ ...p });
      this.mochila.sacarDe(pos, p.cantidad);
    }
    const esquirlas = this.esquirlas;
    if (esquirlas > 0) this.billetera.debitar("esquirlas", esquirlas);
    this.subarma = null;
    this.curarTodo();
    return { equipo, pilas, esquirlas };
  }

  /** Valor en riesgo (esquirlas + lo que valen equipo y mochila): lo que perderías si mueres ahora. */
  valorEnRiesgo(): number {
    let v = this.esquirlas;
    for (const r of RANURAS) {
      const o = this.equipo[r];
      if (o !== null) v += valorDesguace(o);
    }
    for (const pos of this.mochila.posiciones()) {
      const p = this.mochila.en(pos);
      if (p === null) continue;
      const o = equipoDe(p);
      v += o !== undefined ? valorDesguace(o) : (apilable(p.objeto)?.precio ?? 5) * p.cantidad;
    }
    return v;
  }

  /** Mueve una pila de la mochila al contenedor seguro (todo o nada). */
  guardarEnSeguro(pos: Posicion): Resultado<void, string> {
    const r = transferir(this.mochila, pos, this.seguro);
    return r.ok ? exito(undefined) : fallo(r.error);
  }

  sacarDeSeguro(pos: Posicion): Resultado<void, string> {
    const r = transferir(this.seguro, pos, this.mochila);
    return r.ok ? exito(undefined) : fallo(r.error);
  }

  /** Avisa algo al tablón ("matar", "jefe"...). Devuelve true si alguna misión quedó completa. */
  registrarMision(tipo: string, objetivo = -1, cantidad = 1): boolean {
    const cambiadas = this.misiones.registrar(tipo, objetivo, cantidad);
    return cambiadas.some((c) => this.misiones.completa(c.id));
  }

  /** Entrega una misión completa y cobra la recompensa (la esencia va a la Meta). */
  entregarMision(id: number): Resultado<string[], ErrorMision> {
    const r = this.misiones.entregar(id);
    if (!r.ok) return r;
    const premio = r.valor;
    const textos: string[] = [];
    if (premio.exp !== undefined) {
      this.ganarExperiencia(premio.exp);
      textos.push(`+${premio.exp} EXP`);
    }
    for (const [moneda, n] of Object.entries(premio.monedas ?? {})) {
      if (moneda === "esencia") this.meta.ganarEsencia(n);
      else this.billetera.acreditar(moneda, n);
      textos.push(`+${n} ${moneda}`);
    }
    for (const o of premio.objetos ?? []) {
      if (this.mochila.agregar(o.objeto, o.cantidad).ok) textos.push(`${apilable(o.objeto)?.nombre ?? "Objeto"} ×${o.cantidad}`);
    }
    return exito(textos);
  }

  // ---------------- Guardado ----------------

  serializar(): DatosPartida {
    const puntos: Partial<Record<Stat, number>> = {};
    for (const s of STATS) {
      const n = this.puntoEn(s);
      if (n > 0) puntos[s] = n;
    }
    return {
      version: 1, semilla: this.semilla, piso: this.piso, experiencia: this.experiencia, esquirlas: this.esquirlas,
      mochila: volcar(this.mochila), mazo: volcar(this.mazo), equipo: { ...this.equipo },
      forma: this.forma, resonancias: [this.almas[1], this.almas[2]], almas: [...this.almas], hp: this.hp, mp: this.mp,
      enemigos: this.enemigos, jefes: this.jefes, ecosVencidos: this.ecosVencidos,
      segundaVidaUsada: this.segundaVidaUsada, contadorCorazon: this.contadorCorazon,
      puntos, talentos: [...this.talentos], corazones: this.corazones, subarma: this.subarma, runas: [this.runas[0], this.runas[1]], nivelesRuna: [this.nivelesRuna[0], this.nivelesRuna[1]],
      pisoDesbloqueado: this.pisoDesbloqueado, misiones: this.misiones.exportar(), seguro: volcar(this.seguro),
    };
  }

  static restaurar(meta: Meta, d: DatosPartida): Partida {
    // Semilla nueva para el azar: retomar no repite las mismas tiradas.
    const p = new Partida(meta, (d.semilla + d.piso * 7919 + Math.floor(Math.random() * 1e6)) >>> 0, "vacia");
    p.piso = d.piso;
    p.experiencia = d.experiencia;
    p.billetera.acreditar("esquirlas", d.esquirlas);
    cargarEn(p.mochila, d.mochila);
    cargarEn(p.mazo, d.mazo);
    if (d.seguro !== undefined) cargarEn(p.seguro, d.seguro);
    // Guardados viejos tenían 3 ranuras: arma, armadura (→ pecho) y amuleto (→ collar).
    const viejo = d.equipo as Readonly<Record<string, ObjetoEquipo | null | undefined>>;
    for (const r of RANURAS) {
      const o = viejo[r] ?? (r === "pecho" ? viejo.armadura : r === "collar" ? viejo.amuleto : undefined) ?? null;
      p.equipo[r] = o === null ? null : normalizarEquipo(o);
    }
    // Guardados viejos: forma + 2 resonancias pasan a Forma + Habilidad I + Habilidad II.
    const almas = d.almas ?? [d.forma, d.resonancias[0], d.resonancias[1], null, null];
    RANURAS_ALMA.forEach((r) => { p.almas[r] = almas[r] ?? null; });
    p.enemigos = d.enemigos;
    p.jefes = d.jefes;
    p.ecosVencidos = d.ecosVencidos;
    p.segundaVidaUsada = d.segundaVidaUsada;
    p.contadorCorazon = d.contadorCorazon;
    const nivel = p.nivel();
    p.puntos.alcanzarNivel(nivel);
    for (const [stat, n] of Object.entries(d.puntos)) {
      if (n !== undefined && n > 0) p.puntos.asignar(PORTADOR, stat, nivel, n);
    }
    for (const t of d.talentos) if (TALENTOS.some((x) => x.id === t)) p.talentos.add(t);
    p.corazones = d.corazones ?? CORAZONES_INICIALES;
    p.subarma = d.subarma ?? null;
    p.runas = d.runas !== undefined ? [d.runas[0], d.runas[1]] : [null, null];
    p.nivelesRuna = d.nivelesRuna !== undefined ? [d.nivelesRuna[0], d.nivelesRuna[1]] : [0, 0];
    p.pisoDesbloqueado = Math.max(1, d.pisoDesbloqueado ?? 1);
    // Misiones: se descartan las de versiones viejas del tablón (ids que ya no existen).
    if (d.misiones !== undefined) {
      p.misiones.importar({
        activas: d.misiones.activas.filter((a) => mision(a.id) !== undefined && mision(a.id)!.objetivos.length === a.progreso.length),
        entregadas: d.misiones.entregadas.filter((id) => mision(id) !== undefined),
      });
    }
    p.hp = d.hp;
    p.mp = d.mp;
    p.ajustarRecursos();
    return p;
  }

  // ---------------- Final ----------------

  esenciaGanada(victoria: boolean): number {
    return (this.piso - 1) * 15 + this.jefes * 30 + this.ecosVencidos * 40 + Math.floor(this.enemigos / 4) + this.nivel() * 2 + (victoria ? 150 : 0);
  }

  resumen(victoria: boolean): ResumenPartida {
    return {
      pisoAlcanzado: this.piso, nivel: this.nivel(), enemigos: this.enemigos, jefes: this.jefes,
      ecos: this.ecosVencidos, esencia: this.esenciaGanada(victoria), victoria,
    };
  }
}

export function equipoDe(pila: Pila): ObjetoEquipo | undefined {
  return (pila.extra?.equipo as ObjetoEquipo | undefined) ?? undefined;
}

export function cartaDe(pila: Pila): Carta | undefined {
  return (pila.extra?.carta as Carta | undefined) ?? undefined;
}

function volcar(inv: Inventario): (Pila | null)[] {
  return [...inv.posiciones()].map((pos) => {
    const p = inv.en(pos);
    return p === null ? null : { ...p };
  });
}

export function cargarEn(inv: Inventario, pilas: readonly (Pila | null)[]): void {
  const posiciones = [...inv.posiciones()];
  pilas.forEach((p, i) => {
    if (p === null || posiciones[i] === undefined) return;
    const eq = equipoDe(p);
    inv.ponerEn(posiciones[i], eq !== undefined ? { ...p, extra: { equipo: normalizarEquipo(eq) } } : p);
  });
}

export function volcarInventario(inv: Inventario): (Pila | null)[] {
  return volcar(inv);
}

export function equipoVacio(): Record<Ranura, ObjetoEquipo | null> {
  return Object.fromEntries(RANURAS.map((r) => [r, null])) as Record<Ranura, ObjetoEquipo | null>;
}

function sumarCapas(...capas: Capa[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const capa of capas) {
    for (const [k, v] of Object.entries(capa)) if (v !== undefined) r[k] = (r[k] ?? 0) + v;
  }
  return r;
}

export { OBJ_ETER, OBJ_POCION, OBJ_POLVO, OBJ_LAGRIMA };
