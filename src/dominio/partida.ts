// Estado de una partida (una bajada al Pozo). Orquesta las mecánicas de minialu:
//   Inventario (mochila y mazo de cartas), Billetera (esquirlas), CurvaNiveles (nivel de la partida),
//   Catalogo + comprar (mercader), y las reglas propias: forma/resonancias, equipo, únicos y Ecos.
// No sabe nada de render ni de teclado: la escena le pide cosas y muestra el Resultado.

import {
  AzarSemilla, Billetera, Catalogo, Inventario, PuntosHabilidad, comprar, curvaPolinomica, exito, fallo, pagoConBilletera,
  type Azar, type ErrorHabilidad, type ReglasHabilidades, type Capa, type CurvaNiveles, type ErrorCompra, type ErrorFusion, type Pila, type Posicion, type Resultado,
} from "minialu";
import { ALMAS, INFO_TECNICA, alma, type Pasiva } from "../contenido/almas.ts";
import { ESTILOS, type DefEstilo } from "../contenido/armas.ts";
import {
  CONSUMIBLES, MAT_FRAGMENTO, OBJ_CARTA, OBJ_ETER, OBJ_LAGRIMA, OBJ_POCION, OBJ_POLVO, apilable, estiloDe, maxPila,
  type EstiloArma,
} from "../contenido/objetos.ts";
import { CORAZONES_INICIALES, CORAZONES_MAX, SUBARMAS, type IdSubarma } from "../contenido/subarmas.ts";
import { TALENTOS, talento, type IdTalento } from "../contenido/talentos.ts";
import { CONJUNTOS, type BonoConjunto, type IdConjunto } from "../contenido/conjuntos.ts";
import { RUNAS, runaDeObjeto, type IdRuna } from "../contenido/objetos.ts";
import type { ModificadoresBotin, Premio } from "./botin.ts";
import {
  COSTO_FUSION, capaForma, capaResonancia, crearCarta, fusionarCartas, mejorarCarta, nombreCarta, type Carta,
} from "./cartas.ts";
import { capaEquipo, equipoInicial, valorDesguace, type ObjetoEquipo } from "./equipo.ts";
import type { Meta } from "./meta.ts";
import { BASE_PORTADOR, STATS, bloque, capaNivel, type Bloque, type Stat } from "./stats.ts";
import { RANURAS, type EfectoUnico, type Ranura } from "./tipos.ts";

export type RanuraCarta = "forma" | 0 | 1;

export const TAM_MOCHILA = 24;
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
  readonly equipo: Record<Ranura, ObjetoEquipo | null> = { arma: null, armadura: null, amuleto: null };
  forma: Carta | null = null;
  resonancias: [Carta | null, Carta | null] = [null, null];

  piso = 1;
  experiencia = 0;
  hp = 1;
  mp = 0;
  enemigos = 0;
  jefes = 0;
  ecosVencidos = 0;
  corazones = CORAZONES_INICIALES;
  subarma: IdSubarma | null = null;
  /** Dos ranuras de runa (pasivas equipables). */
  runas: [IdRuna | null, IdRuna | null] = [null, null];
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

  pasiva(): Pasiva | null {
    return this.forma === null ? null : alma(this.forma.personaje).pasiva;
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
    const m = { alcance: 0, velocidad: 0, critDanio: 0, agilidad: 0, tecnicaDanio: 0, tecnicaCosto: 0, robo: 0, eterGolpe: 0 };
    for (const r of RANURAS) {
      const rasgos = this.equipo[r]?.rasgos;
      if (rasgos === undefined) continue;
      m.alcance += rasgos.alcance ?? 0;
      m.velocidad += rasgos.velocidad ?? 0;
      m.critDanio += rasgos.critDanio ?? 0;
      m.agilidad += rasgos.agilidad ?? 0;
      m.eterGolpe += rasgos.eterGolpe ?? 0;
    }
    switch (this.forma?.rasgo) {
      case "veloz": m.velocidad += 0.12; break;
      case "eterna": m.tecnicaCosto += 0.25; break;
      case "furiosa": m.tecnicaDanio += 0.2; break;
      case "vampirica": m.robo += 0.03; break;
      default: break;
    }
    switch (this.pasiva()) {
      case "chispa": m.critDanio += 0.5; break;
      case "vendaval": m.velocidad += 0.2; m.agilidad += 0.08; break;
      case "hambre": m.robo += 0.06; break;
      default: break;
    }
    if (this.tieneTalento("sedSangre")) m.robo += 0.05;
    if (this.tieneRuna("vampiro")) m.robo += 0.04;
    if (this.tieneRuna("eco")) m.tecnicaCosto += 0.15;
    for (const b of this.bonosConjunto()) {
      m.velocidad += b.velocidad ?? 0;
      m.robo += b.robo ?? 0;
      m.tecnicaDanio += b.tecnicaDanio ?? 0;
      m.tecnicaCosto += b.tecnicaCosto ?? 0;
      m.critDanio += b.critDanio ?? 0;
    }
    m.tecnicaCosto = Math.min(0.75, m.tecnicaCosto);
    return m;
  }

  // ---------------- Runas y conjuntos ----------------

  tieneRuna(r: IdRuna): boolean {
    return this.runas[0] === r || this.runas[1] === r;
  }

  /** Engarza una runa de la mochila en una ranura; la que estaba vuelve a la mochila. */
  engarzarRuna(pos: Posicion, ranura: 0 | 1): Resultado<IdRuna, "casilla-vacia" | "no-es-runa" | "repetida"> {
    const pila = this.mochila.en(pos);
    if (pila === null) return fallo("casilla-vacia");
    const def = runaDeObjeto(pila.objeto);
    if (def === undefined) return fallo("no-es-runa");
    if (this.runas[1 - ranura] === def.id) return fallo("repetida");
    this.mochila.sacarDe(pos);
    const anterior = this.runas[ranura];
    this.runas[ranura] = def.id;
    if (anterior !== null) this.mochila.ponerEn(pos, { objeto: RUNAS.find((r) => r.id === anterior)!.objeto, cantidad: 1 });
    this.ajustarRecursos();
    return exito(def.id);
  }

  quitarRuna(ranura: 0 | 1): Resultado<void, "vacia" | "sin-espacio"> {
    const r = this.runas[ranura];
    if (r === null) return fallo("vacia");
    if (!this.mochila.agregar(RUNAS.find((x) => x.id === r)!.objeto, 1).ok) return fallo("sin-espacio");
    this.runas[ranura] = null;
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

  /** Bonos activos (2 piezas, y 3 piezas además del de 2). */
  bonosConjunto(): BonoConjunto[] {
    const bonos: BonoConjunto[] = [];
    for (const [id, n] of this.piezasConjunto()) {
      const def = CONJUNTOS.find((c) => c.id === id)!;
      if (n >= 2) bonos.push(def.dos);
      if (n >= 3) bonos.push(def.tres);
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
    const tec = this.forma !== null ? INFO_TECNICA[alma(this.forma.personaje).tecnica] : null;
    return {
      golpe: Math.round(s.golpe * e.mults[0] * mult),
      combo: Math.round(s.golpe * combo * mult),
      patada: Math.round(s.patada * mult),
      tecnica: tec === null ? 0 : Math.round(s.tecnica * tec.mult * tec.impactos * e.tecnica * mult * (this.pasiva() === "horno" ? 1.25 : 1) * (1 + this.combate().tecnicaDanio)),
      tecnicaNombre: tec?.nombre ?? null,
      costoTecnica: tec === null ? 0 : this.costoTecnica(tec.costo),
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
      Resonancias: sumarCapas(
        capaResonancia(this.resonancias[0], this.forma, this.tieneTalento("resonanciaProfunda") ? 0.15 : 0),
        capaResonancia(this.resonancias[1], this.forma, this.tieneTalento("resonanciaProfunda") ? 0.15 : 0),
      ),
      Habilidades: this.puntos.capa(PORTADOR),
      Pasiva: this.pasiva() === "filo" ? { critico: 12 } : this.pasiva() === "raiz" ? { defensa: 6 + this.nivel() } : {},
      Rasgo: this.forma?.rasgo === "afilada" ? { critico: 8 } : {},
      Runas: { regen: this.tieneRuna("calma") ? 8 : 0, suerte: this.tieneRuna("coleccionista") ? 30 : 0 },
      Conjuntos: { critico: this.bonoConjuntoActivo("critico"), hp: this.bonoConjuntoActivo("hp") },
      Equipo: capaEquipo(RANURAS.map((r) => this.equipo[r])),
    };
  }

  stats(): Bloque {
    const b = bloque(Object.values(this.capas()));
    if (this.tiene("vidrio")) b.hp = Math.max(1, Math.round(b.hp * 0.65));
    if (this.forma?.rasgo === "colosal") b.hp = Math.round(b.hp * 1.15);
    const defensaPct = (this.tieneRuna("acero") ? 0.2 : 0) + this.bonoConjuntoActivo("defensaPct");
    if (defensaPct > 0) b.defensa = Math.round(b.defensa * (1 + defensaPct));
    return b;
  }

  /** Multiplicador de daño infligido y recibido por efectos únicos. */
  multiplicadorDanio(): number {
    const furia = this.tieneRuna("furia") && this.hp < this.stats().hp * 0.4 ? 1.3 : 1;
    return (this.tiene("vidrio") ? 1.6 : 1) * furia;
  }

  multiplicadorRecibido(): number {
    return (this.tiene("corona") ? 1.3 : 1) * (this.pasiva() === "muro" ? 0.85 : 1) * (1 - this.bonoConjuntoActivo("recibido"));
  }

  modificadoresBotin(): ModificadoresBotin {
    const corona = this.tiene("corona");
    const suerte = this.stats().suerte;
    return {
      suerte: (corona ? 1.5 : 1) * (1 + suerte / 100),
      codicia: (1 + 0.12 * this.meta.nivelMejora("codicia")) * (corona ? 1.6 : 1) * (this.tieneRuna("avaro") ? 1.35 : 1),
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
        const r = this.mochila.agregar(p.equipo.base, 1, { equipo: p.equipo });
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

  equiparDesde(pos: Posicion): Resultado<ObjetoEquipo, "no-es-equipo" | "casilla-vacia"> {
    const pila = this.mochila.en(pos);
    if (pila === null) return fallo("casilla-vacia");
    const obj = equipoDe(pila);
    if (obj === undefined) return fallo("no-es-equipo");
    this.mochila.sacarDe(pos);
    const anterior = this.equipo[obj.ranura];
    this.equipo[obj.ranura] = obj;
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
    if (obj.rareza >= 2) this.mochila.agregar(MAT_FRAGMENTO, obj.rareza >= 3 ? 2 : 1);
    return exito(valor);
  }

  // ---------------- Cartas ----------------

  cartaEn(r: RanuraCarta): Carta | null {
    return r === "forma" ? this.forma : this.resonancias[r];
  }

  private ponerCarta(r: RanuraCarta, c: Carta | null): void {
    if (r === "forma") this.forma = c;
    else this.resonancias[r] = c;
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
    if (usarLagrima && this.mochila.contar(OBJ_LAGRIMA) < 1) return fallo("sin-lagrima");
    if (this.billetera.saldo("esquirlas") < costo) return fallo("sin-fondos");
    const r = fusionarCartas([a, b, c], this.azar, usarLagrima);
    if (!r.ok) return r;
    this.billetera.debitar("esquirlas", costo);
    if (usarLagrima) this.mochila.quitar(OBJ_LAGRIMA, 1);
    for (const p of posiciones) this.mazo.sacarDe(p);
    this.mazo.ponerEn(posiciones[0], { objeto: OBJ_CARTA, cantidad: 1, extra: { carta: r.valor.carta } });
    this.meta.verAlma(r.valor.carta.personaje);
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
    return exito(r.valor);
  }

  // ---------------- Consumibles y mercader ----------------

  usarPocion(): boolean {
    if (this.hp >= this.stats().hp || !this.mochila.quitar(OBJ_POCION, 1).ok) return false;
    this.curar(Math.round(this.stats().hp * 0.45));
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
      forma: this.forma, resonancias: [this.resonancias[0], this.resonancias[1]], hp: this.hp, mp: this.mp,
      enemigos: this.enemigos, jefes: this.jefes, ecosVencidos: this.ecosVencidos,
      segundaVidaUsada: this.segundaVidaUsada, contadorCorazon: this.contadorCorazon,
      puntos, talentos: [...this.talentos], corazones: this.corazones, subarma: this.subarma, runas: [this.runas[0], this.runas[1]],
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
    for (const r of RANURAS) p.equipo[r] = d.equipo[r] ?? null;
    p.forma = d.forma;
    p.resonancias = [d.resonancias[0], d.resonancias[1]];
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

function cargarEn(inv: Inventario, pilas: readonly (Pila | null)[]): void {
  const posiciones = [...inv.posiciones()];
  pilas.forEach((p, i) => {
    if (p !== null && posiciones[i] !== undefined) inv.ponerEn(posiciones[i], p);
  });
}

function sumarCapas(a: Capa, b: Capa): Record<string, number> {
  const r: Record<string, number> = {};
  for (const capa of [a, b]) {
    for (const [k, v] of Object.entries(capa)) if (v !== undefined) r[k] = (r[k] ?? 0) + v;
  }
  return r;
}

export { OBJ_ETER, OBJ_POCION, OBJ_POLVO, OBJ_LAGRIMA };
