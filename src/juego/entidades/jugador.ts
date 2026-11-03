// El Portador. Movimiento con "coyote time" y salto en búfer (se siente justo), combo según el ESTILO del arma,
// golpe ascendente (↑ + golpe), patada que rompe guardias, pisotón con rebote, Embestida, Doble Salto,
// talentos (salto de pared, corte final, golpe de éter...) y la técnica de la Forma equipada.

import { ejecutarHabilidad } from "../habilidades.ts";
import { CARGA_DEFINITIVA } from "../../dominio/partida.ts";
import { ELEMENTOS } from "../../contenido/elementos.ts";
import { alma } from "../../contenido/almas.ts";
import type { DefEstilo } from "../../contenido/armas.ts";
import { TILE } from "../../dominio/mundo/sala.ts";
import type { Reliquia } from "../../dominio/tipos.ts";
import type { Entrada } from "../../motor/entrada.ts";
import { SUBARMAS } from "../../contenido/subarmas.ts";
import { mover, solidoEnPunto, type Cuerpo, type Rect } from "../../motor/fisica.ts";
import type { AtaqueJugador, Contexto } from "../contexto.ts";
import type { Criatura } from "./criatura.ts";
import { GRAVEDAD } from "./criatura.ts";
import { Capa, dibujarPortador, type Pose } from "../render-portador.ts";
import { Proyectil } from "./proyectil.ts";

const VEL_MAX = 112;
const ACEL_SUELO = 1300;
const ACEL_AIRE = 900;
const SALTO = -348;
const SALTO_DOBLE = -312;
const CAIDA_MAX = 420;
const DESLIZ_MAX = 55;
const COYOTE = 0.1;
const BUFFER = 0.12;
const RECARGA_EMBESTIDA = 0.6;
const ALTO_DE_PIE = 22;
const ALTO_AGACHADO = 14;
const DURACION_ATRAS = 0.3;
const DURACION_BARRIDA = 0.4;

type TipoAccion = "golpe" | "giro" | "ascendente" | "patada" | "pisoton" | "zarpazo" | "tajo" | "terremoto" | "lanzar" | "estocada" | "cargado";

/** Acciones que se pueden guardar en el búfer de entrada. */
type Pedido = "golpe" | "patada" | "h1" | "h2" | "h3" | "h4";

/** Tiempo de carga para el ataque cargado (mantener el golpe). */
export const CARGA_COMPLETA = 0.45;
/** Ventana desde que empieza una esquiva en la que un golpe enemigo cuenta como "esquiva perfecta". */
export const VENTANA_ESQUIVA_PERFECTA = 0.22;

interface AccionActiva {
  readonly tipo: TipoAccion;
  t: number;
  readonly duracion: number;
  readonly golpeados: Set<Criatura>;
  readonly combo: number;
  extra: number;
}

export class Jugador implements Cuerpo {
  x = 0;
  y = 0;
  readonly w = 12;
  h = ALTO_DE_PIE;
  vx = 0;
  vy = 0;
  enSuelo = false;
  dir: -1 | 1 = 1;
  invuln = 0;
  muerto = false;
  t = 0;
  private coyote = 0;
  private bufferSalto = 0;
  private saltosAereos = 0;
  private accion: AccionActiva | null = null;
  private ventanaCombo = 0;
  private siguienteCombo = 0;
  private comboEnCola = false;
  private embestida = 0;
  private cargasEmbestida = 1;
  private recargaEmbestida = 0;
  private separacionEmbestida = 0;
  private golpeadosEmbestida = new Set<Criatura>();
  /** Enfriamiento de las habilidades I, II, III y la Definitiva. */
  private readonly cdHab = [0, 0, 0, 0];
  /** Ataque de la habilidad en curso (embestida, garras, caída). */
  private ataqueAccion: AtaqueJugador | null = null;
  private colorAccion = "#e0c48a";
  private golpesAccion = 3;
  /** Radio del estallido al caer (Definitivas de salto). */
  radioCaida = 0;
  /** Potenciadores de las auras. */
  buffDanio = 0;
  buffEscudo = 0;
  buffRobo = 0;
  buffVelocidad = 0;
  private tBuff = 0;
  private atravesando = 0;
  private regenEter = 0;
  /** Pared tocada en el aire (-1 izq, 1 der) y por cuánto tiempo sigue valiendo para saltar. */
  private pared: -1 | 0 | 1 = 0;
  private graciaPared = 0;
  private tiempoAbajo = 0;
  private bloqueoX = 0;
  deslizando = false;
  /** Búfer de entrada: lo que se apretó durante otra acción se ejecuta apenas se pueda cancelar. */
  private buffer: Pedido | null = null;
  private tBuffer = 0;
  /** Segundos que lleva cargado el golpe (mantener J). */
  carga = 0;
  private avisoCarga = false;
  /** Esquiva perfecta: tiempo desde que empezó la última esquiva y si ya se usó. */
  private tEsquiva = 99;
  private esquivaUsada = true;
  /** El próximo golpe es crítico seguro (premio de la esquiva perfecta). */
  criticoGarantizado = false;
  /** Área de golpe cuerpo a cuerpo activa este cuadro (para desviar proyectiles). */
  zonaActiva: Rect | null = null;
  /** Agarrado a la cadena de un pasaje vertical. */
  trepando = false;
  private avisoCadena = 0;
  /** Agachado (cuerpo bajo: los proyectiles altos pasan por encima). */
  agachado = false;
  /** Paso atrás (backdash) y barrida (deslizamiento por el suelo): tiempo restante. */
  private atras = 0;
  private cdAtras = 0;
  private atrasFantasma = false;
  private barrida = 0;
  private golpeadosBarrida = new Set<Criatura>();
  private cdSubarma = 0;
  private vyAntes = 0;
  private estabaEnAire = false;
  private readonly capa = new Capa();
  private readonly fantasmas: { x: number; pies: number; dir: number; pose: Pose; vida: number }[] = [];
  private tFantasma = 0;
  /** Estiramiento visual (salto) / aplastamiento (aterrizaje); vuelve a 1. */
  private estir = 1;
  private polvoGiro = 0;
  private readonly estela: { x: number; y: number }[] = [];
  private readonly sombras: { x: number; y: number; vida: number }[] = [];
  reliquias: ReadonlySet<Reliquia> = new Set();

  get cx(): number {
    return this.x + this.w / 2;
  }

  get cy(): number {
    return this.y + this.h / 2;
  }

  get invulnerable(): boolean {
    return this.invuln > 0 || this.embestida > 0 || this.accion?.tipo === "tajo" || this.atras > (this.atrasFantasma ? 0 : DURACION_ATRAS - 0.2)
      || (this.accion?.tipo === "estocada" && this.accion.t < 0.16);
  }

  /** Tipo de la acción en curso (para el medidor de estilo). */
  get tipoAccion(): string | null {
    return this.accion?.tipo ?? null;
  }

  get atacando(): boolean {
    return this.accion !== null;
  }

  colocar(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.estela.length = 0;
    this.capa.reiniciar(this.cx, this.y + 6);
  }

  // ---------------- Agacharse ----------------

  /** Saltos en el aire: Alas de Ceniza y Runa del Viento suman uno cada una. */
  private saltosExtra(ctx: Contexto): number {
    const viento = ctx.partida.potenciaRuna("viento");
    return (this.reliquias.has("dobleSalto") ? 1 : 0) + (viento === 0 ? 0 : viento >= 2.2 ? 2 : 1);
  }

  private agacharse(): void {
    if (this.agachado) return;
    this.agachado = true;
    this.y += ALTO_DE_PIE - ALTO_AGACHADO;
    this.h = ALTO_AGACHADO;
  }

  /** Se levanta solo si hay lugar para la cabeza. */
  private levantarse(ctx: Contexto): boolean {
    if (!this.agachado) return true;
    const arriba = this.y - (ALTO_DE_PIE - ALTO_AGACHADO);
    for (const px of [this.x + 1, this.x + this.w - 1]) {
      if (solidoEnPunto(ctx.tiles, px, arriba)) return false;
    }
    this.agachado = false;
    this.y = arriba;
    this.h = ALTO_DE_PIE;
    return true;
  }

  private maxEmbestidas(ctx: Contexto): number {
    return ctx.partida.tieneTalento("embestidaDoble") ? 2 : 1;
  }

  actualizar(dt: number, ctx: Contexto, e: Entrada): void {
    const p = ctx.partida;
    const ligereza = p.tieneTalento("ligereza");
    this.t += dt;
    this.zonaActiva = null;
    this.tEsquiva += dt;
    if (this.buffer !== null) {
      this.tBuffer -= dt;
      if (this.tBuffer <= 0) this.buffer = null;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    for (let k = 0; k < 4; k++) this.cdHab[k] = Math.max(0, this.cdHab[k] - dt);
    if (this.tBuff > 0) {
      this.tBuff -= dt;
      if (this.tBuff <= 0) this.aplicarBuff({}, 0);
    }
    this.cdAtras = Math.max(0, this.cdAtras - dt);
    this.cdSubarma = Math.max(0, this.cdSubarma - dt);
    for (const f of this.fantasmas) f.vida -= dt;
    while (this.fantasmas.length > 0 && this.fantasmas[0].vida <= 0) this.fantasmas.shift();
    this.ventanaCombo = Math.max(0, this.ventanaCombo - dt);
    this.atravesando = Math.max(0, this.atravesando - dt);
    this.bufferSalto = Math.max(0, this.bufferSalto - dt);
    this.bloqueoX = Math.max(0, this.bloqueoX - dt);
    this.graciaPared = Math.max(0, this.graciaPared - dt);
    this.separacionEmbestida = Math.max(0, this.separacionEmbestida - dt);
    this.coyote = this.enSuelo ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.enSuelo) this.saltosAereos = this.saltosExtra(ctx);

    // Cargas de Embestida
    const maxCargas = this.maxEmbestidas(ctx);
    if (this.cargasEmbestida < maxCargas) {
      this.recargaEmbestida += dt;
      if (this.recargaEmbestida >= RECARGA_EMBESTIDA) {
        this.recargaEmbestida = 0;
        this.cargasEmbestida++;
      }
    } else {
      this.cargasEmbestida = maxCargas;
    }

    // Regeneración de éter (el bastón regenera más).
    this.regenEter += dt * p.estilo().regenEter;
    if (this.regenEter >= 1) {
      this.regenEter -= 1;
      p.recuperarEter(1);
    }

    for (const s of this.sombras) s.vida -= dt;
    while (this.sombras.length > 0 && this.sombras[0].vida <= 0) this.sombras.shift();

    this.estir += (1 - this.estir) * Math.min(1, dt * 12);
    this.polvoGiro = Math.max(0, this.polvoGiro - dt);
    this.capa.actualizar(this.cx - this.dir * 4, this.y + this.h - (this.agachado ? 11 : 17), this.dir, dt, -this.vx * 2);

    if (this.trepando) {
      this.actualizarTrepar(dt, ctx, e);
      return;
    }
    if (this.intentarTrepar(ctx, e)) return;

    if (this.embestida > 0) {
      this.actualizarEmbestida(dt, ctx, e);
      this.dejarFantasma(dt);
      return;
    }
    if (this.atras > 0) {
      this.actualizarAtras(dt, ctx, e);
      return;
    }
    if (this.barrida > 0) {
      this.actualizarBarrida(dt, ctx);
      return;
    }

    const bloqueoMovimiento = this.accion !== null && (this.accion.tipo === "tajo" || this.accion.tipo === "terremoto" || this.accion.tipo === "estocada");
    // ---- Movimiento horizontal
    const eje = (e.pulsada("der") ? 1 : 0) - (e.pulsada("izq") ? 1 : 0);
    // Agacharse: ↓ en el suelo (sobre una plataforma, mantenerlo un rato la atraviesa).
    const quiereAgacharse = e.pulsada("aba") && this.enSuelo && !bloqueoMovimiento
      && (this.accion === null || this.accion.tipo === "golpe" || this.accion.tipo === "giro");
    if (quiereAgacharse) this.agacharse();
    else if (this.agachado) this.levantarse(ctx);
    if (this.agachado) {
      if (eje !== 0 && this.accion === null) this.dir = eje > 0 ? 1 : -1;
      this.vx += (0 - this.vx) * Math.min(1, dt * 18);
    }
    if (!bloqueoMovimiento && this.bloqueoX <= 0 && !this.agachado) {
      const pesada = (this.accion !== null && this.enSuelo ? (this.accion.tipo === "giro" ? 0.6 : 0.35) : 1) * (this.carga > 0.12 ? 0.5 : 1);
      const objetivo = eje * VEL_MAX * (ligereza ? 1.15 : 1) * (1 + ctx.partida.combate().agilidad) * pesada;
      if (this.enSuelo && eje !== 0 && Math.sign(this.vx) === -eje && Math.abs(this.vx) > 70 && this.polvoGiro <= 0) {
        this.polvoGiro = 0.2;
        ctx.fx.chispas(this.cx, this.y + this.h, "#d9d0bd88", 6, { velocidad: 60, vida: 0.3, gravedad: 40, angulo: eje > 0 ? Math.PI : 0, apertura: 1 });
      }
      const acel = this.enSuelo ? ACEL_SUELO : ACEL_AIRE;
      if (this.vx < objetivo) this.vx = Math.min(objetivo, this.vx + acel * dt);
      else if (this.vx > objetivo) this.vx = Math.max(objetivo, this.vx - acel * dt);
      if (eje !== 0 && this.accion === null) this.dir = eje > 0 ? 1 : -1;
    }

    // ---- Salto (suelo, pared, aire)
    if (e.recien("saltar")) this.bufferSalto = BUFFER;
    const salto = SALTO * (ligereza ? 1.07 : 1);
    if (this.bufferSalto > 0 && !bloqueoMovimiento) {
      if (e.pulsada("aba") && this.enSuelo && this.sobrePlataforma(ctx)) {
        this.atravesando = 0.2;
        this.bufferSalto = 0;
      } else if (e.pulsada("aba") && this.enSuelo) {
        this.bufferSalto = 0;
        this.iniciarBarrida(ctx);
        return;
      } else if (this.coyote > 0) {
        if (this.agachado && !this.levantarse(ctx)) {
          this.bufferSalto = 0;
        } else {
        // Saltar cancela un golpe en curso (como en los Castlevania modernos).
        if (this.accion !== null && (this.accion.tipo === "golpe" || this.accion.tipo === "patada" || this.accion.tipo === "lanzar")) this.accion = null;
        this.vy = salto;
        this.estir = 1.18;
        this.coyote = 0;
        this.bufferSalto = 0;
        ctx.audio.reproducir("salto");
        ctx.fx.chispas(this.cx, this.y + this.h, "#ffffff55", 5, { velocidad: 40, vida: 0.3, gravedad: 0 });
        }
      } else if (this.graciaPared > 0 && this.pared !== 0 && p.tieneTalento("saltoPared")) {
        this.vy = salto * 0.95;
        this.vx = -this.pared * 175;
        this.dir = this.pared > 0 ? -1 : 1;
        this.bloqueoX = 0.16;
        this.graciaPared = 0;
        this.bufferSalto = 0;
        ctx.audio.reproducir("salto");
        ctx.fx.chispas(this.pared > 0 ? this.x + this.w : this.x, this.cy, "#7fe3ff", 10, { velocidad: 80, vida: 0.3 });
      } else if (this.saltosAereos > 0) {
        this.saltosAereos--;
        this.vy = SALTO_DOBLE * (ligereza ? 1.07 : 1);
        this.bufferSalto = 0;
        ctx.audio.reproducir("salto");
        ctx.fx.chispas(this.cx, this.y + this.h, "#ffe27a", 14, { velocidad: 80, vida: 0.4, gravedad: 50, brillo: true });
      }
    }
    // Mantener ↓ sobre una plataforma un instante también la atraviesa (más fácil que ↓ + salto).
    if (e.pulsada("aba") && this.enSuelo && this.accion === null && this.sobrePlataforma(ctx)) {
      this.tiempoAbajo += dt;
      if (this.tiempoAbajo >= 0.3) {
        this.atravesando = 0.2;
        this.tiempoAbajo = 0;
      }
    } else {
      this.tiempoAbajo = 0;
    }
    // Salto variable: soltar corta la subida.
    if (e.soltada("saltar") && this.vy < -120) this.vy *= 0.5;

    // ---- Gravedad (y deslizamiento por pared)
    if (!bloqueoMovimiento || this.accion?.tipo === "terremoto") {
      const g = this.accion?.tipo === "pisoton" ? GRAVEDAD * 1.6 : GRAVEDAD;
      this.vy = Math.min(CAIDA_MAX * (this.accion?.tipo === "pisoton" ? 1.4 : 1), this.vy + g * dt);
    }
    this.deslizando = p.tieneTalento("saltoPared") && !this.enSuelo && this.graciaPared > 0 && this.pared !== 0 && eje === this.pared && this.vy > 0;
    if (this.deslizando) {
      this.vy = Math.min(this.vy, DESLIZ_MAX);
      if (Math.random() < 0.3) ctx.fx.chispas(this.pared > 0 ? this.x + this.w : this.x, this.y + 4, "#ffffff88", 1, { velocidad: 20, vida: 0.3 });
    }

    // ---- Acciones
    if (this.accion === null) {
      if (this.buffer !== null) {
        const b = this.buffer;
        this.buffer = null;
        this.ejecutar(b, ctx, e);
      } else {
        this.leerAcciones(ctx, e);
      }
    } else {
      const a = this.accion;
      if ((a.tipo === "golpe" || a.tipo === "giro") && e.recien("golpe")) this.comboEnCola = true;
      // Lo que se aprieta durante un ataque queda en el búfer (golpe → patada → técnica, en cualquier orden).
      const pedido: Pedido | null = e.recien("patada") ? "patada" : this.pedidoHabilidad(e)
        ?? (e.recien("golpe") && a.tipo !== "golpe" && a.tipo !== "giro" ? "golpe" : null);
      if (pedido !== null) {
        this.buffer = pedido;
        this.tBuffer = 0.22;
      }
      if (this.buffer !== null && this.cancelable(ctx)) {
        const b = this.buffer;
        this.buffer = null;
        this.accion = null;
        this.ejecutar(b, ctx, e);
      }
    }
    // Ataque cargado: mantener el golpe sin otra acción en curso; soltar al estar lleno.
    if (e.pulsada("golpe") && this.accion === null && !this.trepando) {
      this.carga += dt;
      if (this.carga >= CARGA_COMPLETA && !this.avisoCarga) {
        this.avisoCarga = true;
        ctx.audio.reproducir("raro");
        ctx.fx.chispas(this.cx, this.cy, ctx.partida.estilo().color, 16, { velocidad: 70, brillo: true, gravedad: 0 });
      } else if (this.carga > 0.12 && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        ctx.fx.chispas(this.cx + Math.cos(a) * 14, this.cy + Math.sin(a) * 14, ctx.partida.estilo().color, 1, { velocidad: 20, vida: 0.2, gravedad: 0, brillo: true });
      }
    } else if (this.carga > 0) {
      if (this.carga >= CARGA_COMPLETA && this.accion === null) this.iniciarCargado(ctx);
      this.carga = 0;
      this.avisoCarga = false;
    }

    // Shift: con dirección (o en el aire) = Embestida (reliquia); quieto en el suelo = paso atrás.
    if (e.recien("embestida") && this.accion?.tipo !== "tajo" && this.accion?.tipo !== "terremoto") {
      const puedeEmbestir = this.reliquias.has("embestida") && this.cargasEmbestida > 0 && this.separacionEmbestida <= 0;
      if (puedeEmbestir && (eje !== 0 || !this.enSuelo)) {
        if (this.agachado) this.levantarse(ctx);
        this.iniciarEmbestida(ctx, eje);
        return;
      }
      if (this.enSuelo && this.cdAtras <= 0 && (this.levantarse(ctx))) {
        this.iniciarAtras(ctx);
        return;
      }
    }

    // ---- Física
    this.vyAntes = this.vy;
    const c = mover(this, ctx.tiles, dt, { atravesar: this.atravesando > 0 });
    // Aterrizaje: polvo según la caída.
    if (c.suelo && this.estabaEnAire && this.vyAntes > 120) this.estir = Math.max(0.78, 1 - this.vyAntes / 1600);
    if (c.suelo && this.estabaEnAire && this.vyAntes > 220) {
      ctx.fx.chispas(this.cx, this.y + this.h, "#d9d0bd88", Math.min(12, Math.round(this.vyAntes / 40)), { velocidad: 60, vida: 0.35, gravedad: 60, angulo: -Math.PI / 2, apertura: 3 });
    }
    this.estabaEnAire = !this.enSuelo;
    // Las paredes del techo (filas 0-2, donde están los pozos) no sirven para saltar: el pozo exige Doble Salto.
    if (c.pared !== 0 && !this.enSuelo && this.y > 3 * TILE) {
      this.pared = c.pared;
      this.graciaPared = 0.1;
    } else if (this.enSuelo) {
      this.graciaPared = 0;
    }
    if (c.pinchos && !this.invulnerable) {
      ctx.golpearJugador(12 + ctx.piso * 6, this.cx - this.dir * 10, 200);
      this.vy = -260;
    }
    if (c.suelo && this.accion?.tipo === "pisoton") {
      ctx.fx.sacudir(2);
      ctx.fx.chispas(this.cx, this.y + this.h, "#ffffff", 8, { velocidad: 70, vida: 0.3 });
      this.accion = null;
    }

    if (this.accion !== null) this.actualizarAccion(dt, ctx);

    // Estela de la bufanda
    this.estela.unshift({ x: this.cx - this.dir * 3, y: this.y + 8 });
    if (this.estela.length > 7) this.estela.pop();
  }

  private sobrePlataforma(ctx: Contexto): boolean {
    const ty = Math.floor((this.y + this.h + 1) / TILE);
    for (let tx = Math.floor(this.x / TILE); tx <= Math.floor((this.x + this.w - 1) / TILE); tx++) {
      if (ctx.tiles.tile(tx, ty) === 2) return true;
    }
    return false;
  }

  private largoCombo(ctx: Contexto): number {
    return ctx.partida.estilo().mults.length + (ctx.partida.tieneTalento("cuartoCorte") ? 1 : 0);
  }

  private iniciarGolpe(ctx: Contexto, combo: number): void {
    const e = ctx.partida.estilo();
    if (combo >= e.mults.length) {
      this.iniciar("giro", 0.3, combo);
    } else {
      this.iniciar("golpe", e.duracion, combo);
    }
    ctx.audio.reproducir(combo >= e.mults.length ? "patada" : "golpe");
  }

  private leerAcciones(ctx: Contexto, e: Entrada): void {
    if (e.recien("golpe")) this.ejecutar("golpe", ctx, e);
    else if (e.recien("patada")) this.ejecutar("patada", ctx, e);
    else {
      const h = this.pedidoHabilidad(e);
      if (h !== null) this.ejecutar(h, ctx, e);
    }
  }

  /** ¿Ya pasó la parte activa del ataque? Entonces se puede cancelar en otro (fluidez de combo). */
  private cancelable(ctx: Contexto): boolean {
    const a = this.accion;
    if (a === null) return true;
    switch (a.tipo) {
      case "golpe": return a.t >= ctx.partida.estilo().activoHasta;
      case "giro": return a.t >= 0.2;
      case "ascendente": return a.t >= 0.18;
      case "patada": return a.t >= 0.22;
      case "lanzar": return a.t >= 0.12;
      case "estocada": return a.t >= 0.18;
      case "cargado": return a.t >= a.duracion * 0.7;
      default: return false;
    }
  }

  private ejecutar(pedido: Pedido, ctx: Contexto, e: Entrada): void {
    if (pedido === "golpe") {
      if (e.pulsada("arr")) {
        this.iniciar("ascendente", 0.3, 0);
        ctx.audio.reproducir("golpe");
        return;
      }
      const combo = this.ventanaCombo > 0 ? this.siguienteCombo : 0;
      this.iniciarGolpe(ctx, combo % this.largoCombo(ctx));
    } else if (pedido === "patada") {
      if (e.pulsada("arr")) {
        this.lanzarSubarma(ctx);
        return;
      }
      if (!this.enSuelo && e.pulsada("aba")) {
        this.iniciar("pisoton", 1.2, 0);
        this.vy = 200;
      } else {
        this.iniciar("patada", 0.36, 0);
        ctx.audio.reproducir("patada");
      }
    } else {
      this.usarHabilidad(ctx, pedido === "h1" ? 1 : pedido === "h2" ? 2 : pedido === "h3" ? 3 : 4);
    }
  }

  private iniciar(tipo: TipoAccion, duracion: number, combo: number): void {
    this.accion = { tipo, t: 0, duracion, golpeados: new Set(), combo, extra: 0 };
    this.comboEnCola = false;
  }

  // ---------------- Habilidades del mazo de almas ----------------

  /** Qué habilidad se pidió en este paso (L/U/O = 1/2/3, P = Definitiva). */
  private pedidoHabilidad(e: Entrada): Pedido | null {
    return e.recien("hab1") ? "h1" : e.recien("hab2") ? "h2" : e.recien("hab3") ? "h3" : e.recien("definitiva") ? "h4" : null;
  }

  /** Segundos de enfriamiento restantes de cada habilidad (0 = lista). */
  enfriamiento(r: 1 | 2 | 3 | 4): number {
    return this.cdHab[r - 1];
  }

  private usarHabilidad(ctx: Contexto, r: 1 | 2 | 3 | 4): void {
    const p = ctx.partida;
    const h = p.habilidad(r);
    if (h === null) {
      ctx.mensaje(r === 4 ? "Sin Definitiva: pon una carta en la 5.ª ranura del mazo (I → Cartas)" : `Ranura vacía: pon una carta de alma en «Habilidad ${["I", "II", "III"][r - 1]}» (I → Cartas)`, "#aaaaaa");
      return;
    }
    if (this.cdHab[r - 1] > 0) return;
    if (r === 4) {
      if (p.cargaDefinitiva < CARGA_DEFINITIVA) {
        ctx.fx.texto(this.cx, this.y - 4, `Definitiva ${Math.floor(p.cargaDefinitiva)} %`, "#ffd27a");
        ctx.audio.reproducir("fallo");
        return;
      }
      p.cargaDefinitiva = 0;
    } else {
      if (p.mp < h.costo) {
        ctx.fx.texto(this.cx, this.y - 4, "Sin éter", "#4dc3ff");
        ctx.audio.reproducir("fallo");
        return;
      }
      p.mp -= h.costo;
      if (p.tieneTalento("ecoResonante") && Math.random() < 0.2) {
        p.recuperarEter(h.costo);
        ctx.fx.texto(this.cx, this.y - 8, "¡Eco!", "#c9a7ff");
      }
    }
    this.cdHab[r - 1] = h.cd;
    p.registrarMision(r === 4 ? "definitiva" : "habilidad");
    ctx.audio.reproducir(r === 4 ? "unico" : "tecnica");
    ejecutarHabilidad(this, ctx, h, r === 4);
  }

  /** Arranca una acción de cuerpo (embestida, garras, caída) con el ataque de la habilidad. */
  iniciarAccionHabilidad(tipo: "tajo" | "zarpazo" | "terremoto", duracion: number, ataque: AtaqueJugador, color: string, golpes = 3): void {
    this.iniciar(tipo, duracion, 0);
    this.ataqueAccion = ataque;
    this.colorAccion = color;
    this.golpesAccion = golpes;
    if (tipo === "tajo") {
      this.vy = 0;
      this.vx = this.dir * 340;
    } else if (tipo === "terremoto" && !this.enSuelo) {
      this.vy = 380;
    } else if (tipo === "zarpazo") {
      this.vx = this.dir * 120;
    }
  }

  /** Potenciadores temporales de las auras (se renuevan, no se apilan). */
  aplicarBuff(b: { danio?: number; escudo?: number; robo?: number; velocidad?: number }, duracion: number): void {
    this.buffDanio = b.danio ?? 0;
    this.buffEscudo = b.escudo ?? 0;
    this.buffRobo = b.robo ?? 0;
    this.buffVelocidad = b.velocidad ?? 0;
    this.tBuff = duracion;
  }

  /** Pose breve de lanzamiento (habilidades a distancia). */
  poseLanzar(duracion: number): void {
    this.iniciar("lanzar", duracion, 0);
  }

  get buffActivo(): boolean {
    return this.tBuff > 0;
  }

  private ondasTerremoto(ctx: Contexto): void {
    const ataque: AtaqueJugador = this.ataqueAccion ?? { potencia: ctx.partida.stats().tecnica, tipo: "tecnica", empuje: 160 };
    const color = this.colorAccion;
    ctx.fx.sacudir(6);
    ctx.audio.reproducir("explosion");
    ctx.fx.chispas(this.cx, this.y + this.h, color, 24, { velocidad: 150, vida: 0.5 });
    for (const d of [-1, 1]) {
      ctx.agregarProyectil(new Proyectil({
        tipo: "onda", x: this.cx + d * 10, y: this.y + this.h - 8, vx: d * 230, vy: 0, w: 8, h: 14, vida: 1.4, rastrero: true,
        atraviesa: true, color,
        ataqueJugador: { ...ataque, quema: ataque.quema === true || this.reliquias.has("garraIgnea") },
      }));
    }
    // Las Definitivas de salto (Juicio de Raíz) además estallan donde caen.
    if (this.radioCaida > 0) {
      const r = this.radioCaida;
      ctx.fx.destellar(color, 0.5);
      ctx.fx.chispas(this.cx, this.y + this.h, color, 50, { velocidad: 220, brillo: true });
      ctx.golpearArea({ x: this.cx - r, y: this.y + this.h - r * 0.6, w: r * 2, h: r * 0.6 + 6 }, ataque, this.dir, new Set());
      this.radioCaida = 0;
    }
  }

  // ---------------- Ataques cuerpo a cuerpo ----------------

  private actualizarGolpe(a: AccionActiva, ctx: Contexto, e: DefEstilo): void {
    const p = ctx.partida;
    const s = p.stats();
    const quema = this.reliquias.has("garraIgnea") || ctx.partida.tieneRuna("brasa");
    const giro = a.tipo === "giro";
    const ultimo = a.combo === this.largoCombo(ctx) - 1;
    const desde = giro ? 0.06 : e.activoDesde;
    const hasta = giro ? 0.2 : e.activoHasta;

    const mods = p.combate();
    const alcance = e.alcance * (1 + mods.alcance);

    // Arco: dispara flechas en vez de golpear cuerpo a cuerpo (el último del combo, tres en abanico).
    if (e.id === "arco" && !giro) {
      if (a.t >= desde && a.extra === 0) {
        a.extra = 1;
        const perfora = p.tiene("perforante");
        const carcaj = p.tieneTalento("carcaj");
        const angulos = ultimo ? (carcaj ? [-0.24, -0.08, 0.08, 0.24] : [-0.16, 0, 0.16]) : (carcaj ? [-0.06, 0.06] : [0]);
        const velocidad = 430;
        for (const ang of angulos) {
          ctx.agregarProyectil(new Proyectil({
            tipo: "flecha", x: this.cx + this.dir * 8, y: this.y + (this.agachado ? 6 : 8),
            vx: Math.cos(ang) * velocidad * this.dir, vy: Math.sin(ang) * velocidad, w: 8, h: 3,
            vida: alcance / velocidad, atraviesa: perfora, color: p.equipo.arma?.elemento !== undefined ? ELEMENTOS[p.equipo.arma.elemento].color : e.color,
            ataqueJugador: { potencia: s.golpe * e.mults[a.combo] * (p.tieneTalento("remate") && ultimo ? 1.4 : 1), tipo: "golpe", empuje: e.empujes[a.combo], quema, eter: e.eter },
          }));
        }
        ctx.audio.reproducir("embestida");
      }
    } else if (a.t >= desde && a.t <= hasta) {
      const r = giro
        ? { x: this.cx - alcance - 6, y: this.y, w: alcance * 2 + 12, h: 20 }
        : { x: this.dir > 0 ? this.x + this.w - 2 : this.x - alcance + 2, y: this.y + 2 - (e.id === "pesada" ? 4 : 0), w: alcance, h: e.alto };
      const gemelo = p.tiene("golpe-doble");
      if (gemelo && a.extra === 0 && a.t >= (desde + hasta) / 2) {
        a.extra = 1;
        a.golpeados.clear();
      }
      let mult = giro ? 2 : e.mults[a.combo];
      let aturde = ultimo ? e.aturde : 0;
      if (ultimo && p.tieneTalento("remate")) {
        mult *= 1.4;
        aturde = Math.max(aturde, 0.5);
      }
      const empuje = giro ? 220 : e.empujes[a.combo];
      const potencia = s.golpe * mult * (gemelo ? 0.7 : 1);
      this.zonaActiva = r;
      ctx.golpearArea(r, { potencia, tipo: "golpe", empuje, quema, eter: e.eter, aturde, cuerpoACuerpo: true }, this.dir, a.golpeados);
      if (this.reliquias.has("garraIgnea")) ctx.tocarBarreras(r, "fuego");
      // Golpe de Éter: el último golpe del combo dispara una onda.
      if (ultimo && p.tieneTalento("golpeEter") && a.extra < 2 && a.t >= desde) {
        a.extra = 2;
        ctx.agregarProyectil(new Proyectil({
          tipo: "sombra", x: this.cx + this.dir * 12, y: this.cy - 2, vx: this.dir * 260, vy: 0, w: 10, h: 14, vida: 0.9,
          atraviesa: true, color: "#c9a7ff",
          ataqueJugador: { potencia: s.golpe * 0.9 + s.tecnica * 0.5, tipo: "tecnica", empuje: 100 },
        }));
      }
    }
    if (a.t >= a.duracion) {
      this.ventanaCombo = 0.28;
      const siguiente = (a.combo + 1) % this.largoCombo(ctx);
      this.accion = null;
      if (this.comboEnCola && siguiente !== 0) {
        this.iniciarGolpe(ctx, siguiente);
        return;
      }
      this.siguienteCombo = siguiente;
    }
  }

  private actualizarAccion(dt: number, ctx: Contexto): void {
    const a = this.accion!;
    const cuerpoACuerpo = a.tipo === "golpe" || a.tipo === "giro" || a.tipo === "patada" || a.tipo === "ascendente";
    a.t += dt * (cuerpoACuerpo || a.tipo === "cargado" ? 1 + ctx.partida.combate().velocidad + this.buffVelocidad + (ctx.combo?.bonoVelocidad ?? 0) : 1);
    const p = ctx.partida;
    const s = p.stats();
    const quema = this.reliquias.has("garraIgnea") || ctx.partida.tieneRuna("brasa");

    switch (a.tipo) {
      case "golpe":
      case "giro":
        this.actualizarGolpe(a, ctx, p.estilo());
        break;
      case "ascendente": {
        if (a.t >= 0.05 && a.t <= 0.18) {
          const r = { x: this.cx - 14, y: this.y - 22, w: 28, h: 30 };
          this.zonaActiva = r;
          const n = ctx.golpearArea(r, { potencia: s.golpe * 1.2, tipo: "golpe", empuje: 20, quema, eter: 3, lanzar: true, cuerpoACuerpo: true }, this.dir, a.golpeados);
          if (n > 0 && !this.enSuelo && a.extra === 0) {
            a.extra = 1;
            this.vy = Math.min(this.vy, -200);
          }
          if (this.reliquias.has("garraIgnea")) ctx.tocarBarreras(r, "fuego");
        }
        if (a.t >= a.duracion) this.accion = null;
        break;
      }
      case "patada": {
        if (a.t >= 0.12 && a.t <= 0.22) {
          const r = { x: this.dir > 0 ? this.x + this.w - 2 : this.x - 24, y: this.y + 6, w: 26, h: 14 };
          const aturde = p.efectoAlma("golpeAturde") > 0 ? 0.5 : 0;
          this.zonaActiva = r;
          ctx.golpearArea(r, { potencia: s.patada, tipo: "patada", empuje: 250, rompeGuardia: true, quema, eter: 4, aturde, cuerpoACuerpo: true }, this.dir, a.golpeados);
          if (this.reliquias.has("garraIgnea")) ctx.tocarBarreras(r, "fuego");
          if (a.extra === 0 && p.tiene("onda") && this.enSuelo) {
            a.extra = 1;
            ctx.agregarProyectil(new Proyectil({
              tipo: "onda", x: this.cx + this.dir * 14, y: this.y + this.h - 8, vx: this.dir * 220, vy: 0, w: 8, h: 14,
              vida: 1.2, rastrero: true, atraviesa: true, color: "#ffd23d",
              ataqueJugador: { potencia: s.patada * 0.6, tipo: "patada", empuje: 120 },
            }));
          }
        }
        if (a.t >= a.duracion) this.accion = null;
        break;
      }
      case "pisoton": {
        const r = { x: this.x - 2, y: this.y + this.h - 4, w: this.w + 4, h: 12 };
        const n = ctx.golpearArea(r, { potencia: s.patada * 0.9, tipo: "patada", empuje: 60, rompeGuardia: true, quema, eter: 4, cuerpoACuerpo: true }, this.dir, a.golpeados);
        if (n > 0) {
          this.vy = -300;
          this.saltosAereos = this.saltosExtra(ctx);
          this.accion = null;
        } else if (a.t >= a.duracion) {
          this.accion = null;
        }
        break;
      }
      case "estocada": {
        const f = Math.max(0, 1 - a.t / a.duracion);
        this.vx = this.dir * 330 * f;
        this.vy = 0;
        const alcance = p.estilo().alcance * (1 + p.combate().alcance) * 1.3;
        const r = { x: this.dir > 0 ? this.x + this.w - 2 : this.x - alcance + 2, y: this.y + 6, w: alcance, h: 10 };
        this.zonaActiva = r;
        ctx.golpearArea(r, { potencia: s.golpe * 1.6, tipo: "golpe", empuje: 220, quema, eter: 5, cuerpoACuerpo: true }, this.dir, a.golpeados);
        this.dejarFantasma(dt);
        if (a.t >= a.duracion) this.accion = null;
        break;
      }
      case "cargado":
        this.actualizarCargado(a, ctx);
        break;
      case "lanzar":
        if (a.t >= a.duracion) this.accion = null;
        break;
      case "tajo": {
        this.vx = this.dir * 340;
        this.vy = 0;
        const r = { x: this.x - 6, y: this.y, w: this.w + 12, h: this.h };
        if (this.ataqueAccion !== null) ctx.golpearArea(r, { ...this.ataqueAccion, quema: this.ataqueAccion.quema === true || quema }, this.dir, a.golpeados);
        this.dejarFantasma(dt);
        if (a.t >= a.duracion) {
          this.accion = null;
          this.vx *= 0.3;
        }
        break;
      }
      case "terremoto":
        if (this.enSuelo && a.extra === 0) {
          a.extra = 1;
          a.t = Math.max(a.t, a.duracion - 0.2);
          this.ondasTerremoto(ctx);
        }
        if (a.t >= a.duracion) {
          if (a.extra === 0) this.ondasTerremoto(ctx);
          this.accion = null;
        }
        break;
      case "zarpazo": {
        const golpe = Math.floor(a.t / 0.13);
        if (golpe !== a.extra && golpe < this.golpesAccion) {
          a.extra = golpe;
          a.golpeados.clear();
          ctx.audio.reproducir("golpe");
        }
        if (golpe < this.golpesAccion && this.ataqueAccion !== null) {
          const r = { x: this.dir > 0 ? this.x + this.w - 2 : this.x - 26, y: this.y - 4, w: 28, h: 26 };
          ctx.golpearArea(r, { ...this.ataqueAccion, quema: this.ataqueAccion.quema === true || quema }, this.dir, a.golpeados);
          if (Math.random() < 0.5) ctx.fx.chispas(r.x + r.w / 2, r.y + r.h / 2, this.colorAccion, 3, { velocidad: 90, brillo: true });
        }
        this.vx *= 0.9;
        if (a.t >= a.duracion) this.accion = null;
        break;
      }
    }
  }

  // ---------------- Cadenas ----------------

  /** ¿Está al alcance de la cadena? (horizontalmente cerca y dentro de su tramo vertical). */
  cercaDeCadena(ctx: Contexto): boolean {
    const c = ctx.cadena ?? null;
    if (c === null) return false;
    const pies = this.y + this.h;
    return Math.abs(this.cx - c.x) <= 9 && pies >= c.arriba - 1 && this.y <= c.abajo;
  }

  private intentarTrepar(ctx: Contexto, e: Entrada): boolean {
    const c = ctx.cadena ?? null;
    if (c === null || this.accion !== null || this.atras > 0 || this.barrida > 0 || !this.cercaDeCadena(ctx)) return false;
    const pies = this.y + this.h;
    const sube = e.pulsada("arr") && pies > c.arriba + 2;
    // Bajar: parado justo sobre el comienzo de la cadena (plataforma del pasaje) o colgando en el aire.
    const baja = e.pulsada("aba") && pies < c.abajo - 1 && (Math.abs(pies - c.arriba) < 2 || !this.enSuelo);
    if (!sube && !baja) return false;
    if (this.agachado && !this.levantarse(ctx)) return false;
    this.trepando = true;
    this.accion = null;
    this.vx = 0;
    this.vy = 0;
    this.x = c.x - this.w / 2;
    ctx.audio.reproducir("puerta");
    return true;
  }

  private actualizarTrepar(dt: number, ctx: Contexto, e: Entrada): void {
    const c = ctx.cadena ?? null;
    if (c === null) {
      this.trepando = false;
      return;
    }
    this.x = c.x - this.w / 2;
    this.vx = 0;
    const eje = (e.pulsada("der") ? 1 : 0) - (e.pulsada("izq") ? 1 : 0);
    if (eje !== 0) this.dir = eje > 0 ? 1 : -1;
    // Saltar suelta la cadena.
    if (e.recien("saltar")) {
      this.trepando = false;
      this.vy = SALTO * 0.7;
      this.vx = eje * 120;
      this.saltosAereos = this.saltosExtra(ctx);
      ctx.audio.reproducir("salto");
      return;
    }
    const mov = (e.pulsada("aba") ? 1 : 0) - (e.pulsada("arr") ? 1 : 0);
    this.vy = mov * 95;
    this.y += this.vy * dt;
    this.enSuelo = false;
    const pies = this.y + this.h;
    // Abajo: el piso termina la cadena.
    if (mov > 0 && pies >= c.abajo) {
      this.y = c.abajo - this.h;
      this.trepando = false;
      this.enSuelo = true;
      this.vy = 0;
    }
    // Arriba (sin salida por el techo): se sube a la plataforma del pasaje.
    if (mov < 0 && pies <= c.arriba) {
      this.y = c.arriba - this.h;
      this.trepando = false;
      this.enSuelo = true;
      this.vy = 0;
    }
    if (mov !== 0 && Math.random() < 0.08) ctx.fx.chispas(c.x, this.y + 4, "#9a90b0", 1, { velocidad: 20, vida: 0.3 });
    this.avisoCadena += dt;
  }

  // ---------------- Paso atrás, barrida y subarmas ----------------

  private marcarEsquiva(): void {
    this.tEsquiva = 0;
    this.esquivaUsada = false;
  }

  /** La llama el mundo cuando algo te iba a golpear mientras eras invulnerable por una esquiva. */
  intentarEsquivaPerfecta(): boolean {
    if (this.esquivaUsada || this.tEsquiva > VENTANA_ESQUIVA_PERFECTA) return false;
    this.esquivaUsada = true;
    this.criticoGarantizado = true;
    return true;
  }

  /** Golpe cuerpo a cuerpo acertado: en el aire te sostiene y recarga salto y embestida (combos aéreos). */
  alAcertarCuerpoACuerpo(ctx: Contexto): void {
    if (this.enSuelo) return;
    if (this.vy > -40) this.vy = -40;
    this.saltosAereos = Math.max(this.saltosAereos, this.saltosExtra(ctx));
    this.cargasEmbestida = Math.max(this.cargasEmbestida, 1);
  }

  // ---------------- Estocada y ataque cargado ----------------

  private iniciarEstocada(ctx: Contexto): void {
    this.iniciar("estocada", 0.26, 0);
    this.vy = 0;
    this.vx = this.dir * 330;
    ctx.audio.reproducir("embestida");
    ctx.fx.chispas(this.cx - this.dir * 6, this.cy, "#ffffff", 8, { velocidad: 80, angulo: this.dir > 0 ? Math.PI : 0, apertura: 0.6, gravedad: 0 });
  }

  private iniciarCargado(ctx: Contexto): void {
    const id = ctx.partida.estilo().id;
    const duracion = id === "punos" ? 0.46 : id === "pesada" ? 0.5 : 0.4;
    this.iniciar("cargado", duracion, 0);
    ctx.audio.reproducir(id === "pesada" ? "explosion" : "critico");
    ctx.fx.destellar(ctx.partida.estilo().color, 0.25);
  }

  private iniciarAtras(ctx: Contexto): void {
    this.marcarEsquiva();
    this.accion = null;
    this.atras = DURACION_ATRAS;
    this.atrasFantasma = ctx.partida.tieneTalento("pasoFantasma");
    this.cdAtras = (this.atrasFantasma ? 0.21 : 0.42) * (this.reliquias.has("botasCefiro") ? 0.6 : 1);
    this.vy = -60;
    ctx.audio.reproducir("embestida");
    ctx.fx.chispas(this.cx, this.y + this.h, "#ffffff55", 6, { velocidad: 50, vida: 0.3, gravedad: 0 });
  }

  private actualizarAtras(dt: number, ctx: Contexto, e: Entrada): void {
    this.atras -= dt;
    const f = Math.max(0, this.atras / DURACION_ATRAS);
    this.vx = -this.dir * 270 * f;
    this.vy = Math.min(CAIDA_MAX, this.vy + GRAVEDAD * dt);
    mover(this, ctx.tiles, dt);
    this.dejarFantasma(dt);
    // Cancelar el final del paso atrás con un golpe o un salto.
    if (this.atras < DURACION_ATRAS * 0.45) {
      if (e.recien("golpe")) {
        this.atras = 0;
        this.iniciarEstocada(ctx);
      } else if (e.recien("patada") || this.pedidoHabilidad(e) !== null) {
        this.atras = 0;
        this.leerAcciones(ctx, e);
      } else if (e.recien("saltar") && this.enSuelo) {
        this.atras = 0;
        this.vy = SALTO;
        ctx.audio.reproducir("salto");
      }
    }
  }

  private iniciarBarrida(ctx: Contexto): void {
    this.marcarEsquiva();
    this.accion = null;
    this.agacharse();
    this.barrida = DURACION_BARRIDA;
    this.golpeadosBarrida = new Set();
    ctx.audio.reproducir("patada");
  }

  private actualizarBarrida(dt: number, ctx: Contexto): void {
    this.barrida -= dt;
    const f = Math.max(0.25, this.barrida / DURACION_BARRIDA);
    this.vx = this.dir * 290 * f;
    this.vy = Math.min(CAIDA_MAX, this.vy + GRAVEDAD * dt);
    const c = mover(this, ctx.tiles, dt);
    const s = ctx.partida.stats();
    ctx.golpearArea({ x: this.dir > 0 ? this.x + this.w - 4 : this.x - 6, y: this.y + 4, w: 10, h: this.h - 4 },
      { potencia: s.patada * 0.75, tipo: "patada", empuje: 180, rompeGuardia: true, eter: 3, lanzar: true }, this.dir, this.golpeadosBarrida);
    if (Math.random() < 0.6) ctx.fx.chispas(this.cx - this.dir * 6, this.y + this.h, "#d9d0bd88", 1, { velocidad: 40, vida: 0.3, gravedad: 0 });
    this.dejarFantasma(dt);
    if (c.pared !== 0 || !this.enSuelo) this.barrida = 0;
    if (this.barrida <= 0) this.vx *= 0.3;
  }

  private lanzarSubarma(ctx: Contexto): void {
    const p = ctx.partida;
    if (this.cdSubarma > 0) return;
    const r = p.gastarSubarma();
    if (!r.ok) {
      ctx.fx.texto(this.cx, this.y - 4, r.error === "sin-subarma" ? "Sin subarma" : "Sin ♥", "#ff8aa0");
      ctx.audio.reproducir("fallo");
      return;
    }
    const def = SUBARMAS[r.valor];
    const potencia = p.stats().golpe * def.mult * p.multiplicadorDanio();
    const veces = p.tieneTalento("armasGemelas") ? 2 : 1;
    this.cdSubarma = 0.32;
    this.iniciar("lanzar", 0.22, 0);
    ctx.audio.reproducir("golpe");
    const base = { ataqueJugador: { potencia, tipo: "golpe" as const, empuje: 90 }, color: def.color };
    for (let k = 0; k < veces; k++) {
    // La segunda copia (Armas Gemelas) sale un poco más alta y más lenta.
    const x = this.cx + this.dir * 6;
    const y = this.y + 6 - k * 7;
    const f = 1 - k * 0.22;
    switch (r.valor) {
      case "daga":
        ctx.agregarProyectil(new Proyectil({ ...base, tipo: "daga", x, y, vx: this.dir * 390 * f, vy: 0, w: 10, h: 4, vida: 1.1 }));
        break;
      case "hacha":
        ctx.agregarProyectil(new Proyectil({
          ...base, tipo: "hacha", x, y: y - 4, vx: this.dir * 130 * (k === 0 ? 1 : 1.6), vy: -370 * f, gravedad: 820, w: 10, h: 10, vida: 2,
          atraviesa: true, atraviesaParedes: true,
        }));
        break;
      case "agua":
        ctx.agregarProyectil(new Proyectil({
          ...base, tipo: "agua", x, y, vx: this.dir * 150 * (k === 0 ? 1 : 1.5), vy: -150, gravedad: 700, w: 6, h: 6, vida: 2,
          alMorir: (c, mx, my) => {
            c.audio.reproducir("romper");
            for (let i = -2; i <= 2; i++) {
              c.agregarProyectil(new Proyectil({
                tipo: "llama", x: mx + i * 9, y: my - 6, vx: 0, vy: 0, w: 8, h: 12, vida: 1.6, atraviesa: true,
                atraviesaParedes: true, color: def.color,
                ataqueJugador: { potencia, tipo: "golpe", empuje: 20, quema: true },
              }));
            }
          },
        }));
        break;
      case "cruz":
        ctx.agregarProyectil(new Proyectil({
          ...base, tipo: "cruz", x, y, vx: this.dir * 300 * f, vy: 0, w: 10, h: 10, vida: 2.6, atraviesa: true,
          atraviesaParedes: true, boomerang: true,
        }));
        break;
    }
    }
  }

  private dejarFantasma(dt: number): void {
    this.tFantasma -= dt;
    if (this.tFantasma > 0) return;
    this.tFantasma = 0.03;
    this.fantasmas.push({ x: this.cx, pies: this.y + this.h, dir: this.dir, pose: this.pose(), vida: 0.22 });
  }

  private actualizarCargado(a: AccionActiva, ctx: Contexto): void {
    const p = ctx.partida;
    const s = p.stats();
    const e = p.estilo();
    const quema = this.reliquias.has("garraIgnea") || p.tieneRuna("brasa");
    const alcance = e.alcance * (1 + p.combate().alcance);
    const ataque = (potencia: number, extra: Partial<AtaqueJugador> = {}): AtaqueJugador =>
      ({ potencia, tipo: "golpe", empuje: 280, quema, eter: 6, cuerpoACuerpo: true, aturde: 0.5, ...extra });
    switch (e.id) {
      case "espada": {
        // Tajo Lunar: corte enorme + media luna que vuela.
        if (a.t >= 0.08 && a.t <= 0.2) {
          const r = { x: this.dir > 0 ? this.x + this.w - 4 : this.x - alcance * 2.2 + 4, y: this.y - 8, w: alcance * 2.2, h: 34 };
          this.zonaActiva = r;
          ctx.golpearArea(r, ataque(s.golpe * 3.2, { lanzar: true }), this.dir, a.golpeados);
          if (a.extra === 0) {
            a.extra = 1;
            ctx.fx.sacudir(5);
            ctx.agregarProyectil(new Proyectil({
              tipo: "sombra", x: this.cx + this.dir * 16, y: this.cy - 2, vx: this.dir * 360, vy: 0, w: 14, h: 26, vida: 0.6,
              atraviesa: true, color: e.color, ataqueJugador: { potencia: s.golpe * 1.4, tipo: "golpe", empuje: 160 },
            }));
          }
        }
        break;
      }
      case "pesada":
        // Sismo: golpe al suelo, ondas a ambos lados y aturdimiento largo.
        if (a.t >= 0.18 && a.extra === 0) {
          a.extra = 1;
          const r = { x: this.cx - alcance * 1.6, y: this.y - 6, w: alcance * 3.2, h: this.h + 10 };
          this.zonaActiva = r;
          ctx.golpearArea(r, ataque(s.golpe * 3.5, { aturde: 1.1 }), this.dir, a.golpeados);
          ctx.fx.sacudir(9);
          ctx.audio.reproducir("explosion");
          ctx.fx.chispas(this.cx, this.y + this.h, e.color, 30, { velocidad: 170, vida: 0.5 });
          for (const d of [-1, 1]) {
            ctx.agregarProyectil(new Proyectil({
              tipo: "onda", x: this.cx + d * 12, y: this.y + this.h - 8, vx: d * 240, vy: 0, w: 8, h: 16, vida: 1.2, rastrero: true,
              atraviesa: true, color: e.color, ataqueJugador: { potencia: s.golpe * 2, tipo: "golpe", empuje: 200 },
            }));
          }
        }
        break;
      case "baston":
        // Nova: estallido de éter alrededor; devuelve éter.
        if (a.t >= 0.1 && a.extra === 0) {
          a.extra = 1;
          const r = { x: this.cx - 58, y: this.cy - 42, w: 116, h: 84 };
          this.zonaActiva = r;
          const n = ctx.golpearArea(r, ataque(s.tecnica * 2.4 * e.tecnica, { tipo: "tecnica", empuje: 240 }), this.dir, a.golpeados);
          p.recuperarEter(8 + n * 4);
          ctx.fx.destellar(e.color, 0.4);
          for (let k = 0; k < 32; k++) {
            const ang = (k / 32) * Math.PI * 2;
            ctx.fx.chispas(this.cx + Math.cos(ang) * 10, this.cy + Math.sin(ang) * 10, e.color, 1, { velocidad: 200, angulo: ang, apertura: 0, vida: 0.35, gravedad: 0, brillo: true });
          }
        }
        break;
      case "arco":
        // Flecha Perforante: enorme, rápida, atraviesa todo.
        if (a.t >= 0.12 && a.extra === 0) {
          a.extra = 1;
          ctx.agregarProyectil(new Proyectil({
            tipo: "flecha", x: this.cx + this.dir * 10, y: this.y + 8, vx: this.dir * 640, vy: 0, w: 16, h: 6, vida: 0.75, atraviesa: true,
            color: "#ffffff", ataqueJugador: { potencia: s.golpe * 3.6, tipo: "golpe", empuje: 300, quema },
          }));
          ctx.fx.sacudir(3);
          ctx.audio.reproducir("embestida");
        }
        break;
      default: {
        // Puños: Ráfaga de seis golpes.
        const golpe = Math.floor(a.t / 0.07);
        if (golpe !== a.extra && golpe < 6) {
          a.extra = golpe;
          a.golpeados.clear();
          ctx.audio.reproducir("golpe");
        }
        if (golpe < 6) {
          const r = { x: this.dir > 0 ? this.x + this.w - 2 : this.x - alcance - 4, y: this.y + 2, w: alcance + 6, h: 16 };
          this.zonaActiva = r;
          ctx.golpearArea(r, ataque(s.golpe * 0.8, { empuje: golpe === 5 ? 320 : 40, aturde: 0.3 }), this.dir, a.golpeados);
          this.vx = this.dir * 60;
        }
      }
    }
    if (a.t >= a.duracion) this.accion = null;
  }

  // ---------------- Embestida ----------------

  private iniciarEmbestida(ctx: Contexto, eje: number): void {
    this.marcarEsquiva();
    if (eje !== 0) this.dir = eje > 0 ? 1 : -1;
    this.embestida = 0.2;
    this.cargasEmbestida--;
    this.separacionEmbestida = 0.25;
    this.golpeadosEmbestida = new Set();
    this.accion = null;
    this.vy = 0;
    ctx.audio.reproducir("embestida");
  }

  private actualizarEmbestida(dt: number, ctx: Contexto, e: Entrada): void {
    // Golpe durante la embestida: estocada.
    if (e.recien("golpe")) {
      this.embestida = 0;
      this.iniciarEstocada(ctx);
      return;
    }
    this.embestida -= dt;
    this.vx = this.dir * 330;
    this.vy = 0;
    const r: Rect = { x: this.dir > 0 ? this.x + this.w : this.x - 6, y: this.y, w: 6, h: this.h };
    ctx.tocarBarreras(r, "embestida");
    mover(this, ctx.tiles, dt);
    const s = ctx.partida.stats();
    if (ctx.partida.tieneTalento("embestidaDoble")) {
      ctx.golpearArea({ x: this.x - 4, y: this.y, w: this.w + 8, h: this.h },
        { potencia: s.patada * 0.6, tipo: "patada", empuje: 120 }, this.dir, this.golpeadosEmbestida);
    }
    if (ctx.partida.tiene("estela-ignea") && Math.random() < dt * 25) {
      ctx.agregarProyectil(new Proyectil({
        tipo: "fuego", x: this.cx, y: this.y + this.h - 4, vx: 0, vy: 0, w: 10, h: 8, vida: 1.2, atraviesa: true,
        atraviesaParedes: true, color: "#ff7a3d",
        ataqueJugador: { potencia: s.tecnica * 0.35, tipo: "tecnica", empuje: 0, quema: true },
      }));
    }
    if (this.embestida <= 0) this.vx *= 0.4;
  }

  /** Lo llama el mundo al recibir daño. */
  herido(desdeX: number, empuje: number): void {
    this.invuln = 0.9;
    this.accion = null;
    this.atras = 0;
    this.barrida = 0;
    this.trepando = false;
    this.vx = (this.cx < desdeX ? -1 : 1) * empuje * 0.75;
    this.vy = -170;
  }

  /** Corta el ascenso al entrar a una sala desde abajo y asegura llegar a la plataforma. */
  impulsoDePozo(): void {
    this.vy = Math.min(this.vy, -345);
  }

  // ---------------- Dibujo ----------------

  /** Pose según lo que está haciendo (la usan el dibujo y los fantasmas). */
  pose(): Pose {
    const a = this.accion;
    if (this.trepando) return "trepar";
    if (this.invuln > 0.65) return "herido";
    if (this.barrida > 0) return "deslizar";
    if (this.atras > 0) return "atras";
    if (a !== null) {
      if (a.tipo === "golpe" || a.tipo === "giro" || a.tipo === "zarpazo" || a.tipo === "tajo" || a.tipo === "estocada" || a.tipo === "cargado") return this.agachado ? "agachado" : "golpe";
      if (a.tipo === "ascendente") return "golpeAlto";
      if (a.tipo === "patada" || a.tipo === "pisoton") return "patada";
      if (a.tipo === "lanzar" || a.tipo === "terremoto") return "lanzar";
    }
    if (this.agachado) return "agachado";
    if (this.deslizando) return "pared";
    if (!this.enSuelo) return this.vy < 0 ? "saltar" : "caer";
    return Math.abs(this.vx) > 15 ? "correr" : "quieto";
  }

  dibujar(g: CanvasRenderingContext2D, ctx: Contexto): void {
    const forma = ctx.partida.forma;
    const a = forma !== null ? alma(forma.personaje) : null;
    const cuerpo = a?.color ?? "#6a6a7a";
    const acento = a?.colorSec ?? "#d0d0e0";
    const estilo = ctx.partida.estilo();
    const elem = ctx.partida.equipo.arma?.elemento;
    const colorArma: string = elem !== undefined ? ELEMENTOS[elem].color : estilo.color;

    // Fantasmas (paso atrás, barrida, embestida, tajo): siluetas del color de la Forma.
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const f of this.fantasmas) {
      g.globalAlpha = Math.max(0, f.vida / 0.22) * 0.45;
      dibujarPortador(g, f.x, f.pies, f.dir, f.pose, { cuerpo: acento, acento }, this.t);
    }
    g.restore();

    if (this.invuln > 0 && this.atras <= 0 && Math.floor(this.t * 20) % 2 === 0) return;

    const pose = this.pose();
    const enUso = pose === "golpe" || pose === "golpeAlto";
    // Arma en reposo: a la espalda, detrás de la capa y del cuerpo.
    if (!enUso) this.dibujarArma(g, estilo.id, Math.round(this.cx - this.dir * 4), Math.round(this.y + this.h - (this.agachado ? 8 : 12)), colorArma, false);
    // Capa (detrás del cuerpo)
    this.capa.dibujar(g, cuerpo === "#6a6a7a" ? "#3a3448" : sombra(cuerpo), acento);

    const atk = this.accion;
    const pies = this.y + this.h;
    const variante = forma !== null ? alma(forma.personaje).tipo : 1;
    const progreso = atk !== null && (atk.tipo === "golpe" || atk.tipo === "giro" || atk.tipo === "ascendente" || atk.tipo === "estocada" || atk.tipo === "cargado")
      ? atk.t / Math.max(0.05, (atk.tipo === "golpe" ? estilo.activoHasta : 0.18) + 0.04)
      : 0.6;
    const mano = dibujarPortador(g, this.cx, pies, this.dir, pose, { cuerpo, acento }, this.t,
      { variante, progreso, estiramiento: this.estir });
    if (this.deslizando) {
      g.fillStyle = "#ffffff55";
      g.fillRect(this.pared > 0 ? Math.round(this.x + this.w) : Math.round(this.x) - 1, Math.round(this.y) + 2, 1, this.h - 4);
    }

    // Arma en la mano (solo al atacar)
    if (enUso) this.dibujarArmaEnUso(g, estilo.id, mano.manoX, mano.manoY, mano.angulo, colorArma, estilo.alcance * (1 + ctx.partida.combate().alcance), progreso);

    // Arcos de ataque
    if (atk !== null) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const x = Math.round(this.cx);
      const y = Math.round(this.y) + (this.agachado ? -6 : 0);
      if (atk.tipo === "golpe" && estilo.id !== "arco" && atk.t >= estilo.activoDesde * 0.6 && atk.t < estilo.activoHasta + 0.06) {
        // Estela en media luna: más ancha en el frente del corte, desvaneciéndose hacia el inicio.
        const ultimo = atk.combo === this.largoCombo(ctx) - 1;
        const radio = estilo.alcance * (1 + ctx.partida.combate().alcance) * 0.82;
        const avance = Math.min(1, atk.t / Math.max(0.01, estilo.activoHasta));
        const desdeA = estilo.id === "pesada" ? -2.2 : -1.4;
        const barrido = (estilo.id === "pesada" ? 3.0 : 2.5) * avance;
        const pasos = 10;
        for (let k = 0; k < pasos; k++) {
          const f = k / pasos;
          const a0 = desdeA + barrido * f;
          const ang = this.dir > 0 ? a0 : Math.PI - a0;
          g.globalAlpha = 0.15 + f * 0.6;
          g.strokeStyle = ultimo ? "#ffe27a" : colorArma;
          g.lineWidth = (estilo.id === "pesada" ? 3 : 1.5) + f * (ultimo ? 4 : 3);
          g.beginPath();
          g.arc(x, y + 11, radio, ang - 0.13, ang + 0.13);
          g.stroke();
        }
        g.globalAlpha = 1;
      } else if (atk.tipo === "giro" && atk.t < 0.24) {
        g.strokeStyle = "#ffe27a";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y + 11, estilo.alcance + 4, 9, 0, atk.t * 30, atk.t * 30 + Math.PI * 1.6);
        g.stroke();
      } else if (atk.tipo === "ascendente" && atk.t < 0.2) {
        g.strokeStyle = colorArma;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y + 4, 16, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      } else if (atk.tipo === "patada" && atk.t >= 0.1 && atk.t <= 0.24) {
        g.fillStyle = "#ffffffaa";
        g.fillRect(this.dir > 0 ? x + 4 : x - 26, y + 12, 22, 3);
      } else if (atk.tipo === "pisoton") {
        g.fillStyle = "#ffffff88";
        g.fillRect(Math.round(this.x), Math.round(this.y + this.h), this.w, 3);
      } else if (atk.tipo === "zarpazo") {
        g.strokeStyle = "#ffe08a";
        g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          const bx = this.dir > 0 ? x + 6 : x - 18;
          g.moveTo(bx + i * 4, y + 2 + i * 2);
          g.lineTo(bx + 12 + i * 4, y + 16 + i * 2);
          g.stroke();
        }
      }
      g.restore();
    }
  }

  /** Arma en la mano, rotada según el brazo (el largo depende del alcance). */
  private dibujarArmaEnUso(g: CanvasRenderingContext2D, estilo: string, mx: number, my: number, ang: number, color: string, alcance: number, progreso: number): void {
    g.save();
    g.translate(mx, my);
    switch (estilo) {
      case "arco": {
        // Arco vertical delante; la cuerda se tensa y se suelta.
        const d = this.dir;
        const tension = progreso < 0.5 ? progreso * 2 : Math.max(0, 1 - (progreso - 0.5) * 4);
        g.fillStyle = "#8a6a3a";
        for (let k = -7; k <= 7; k++) g.fillRect(d * Math.round(2 - (k * k) / 20), k, 1, 1);
        g.fillStyle = "#e8e8f0";
        for (let k = -6; k <= 6; k++) g.fillRect(d * Math.round(-tension * 4 * (1 - Math.abs(k) / 7)), k, 1, 1);
        if (tension > 0.2) {
          g.fillStyle = color;
          g.fillRect(d > 0 ? -Math.round(tension * 4) : -8 + Math.round(tension * 4), 0, 10, 1);
        }
        break;
      }
      case "punos":
        g.fillStyle = color;
        g.fillRect(-1, -1, 4, 3);
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.5;
        g.fillRect(-2, -2, 6, 5);
        break;
      default: {
        g.rotate(ang);
        const largo = Math.max(9, Math.min(26, alcance * 0.6));
        if (estilo === "pesada") {
          g.fillStyle = "#6a5a4a";
          g.fillRect(0, -1, largo, 2);
          g.fillStyle = color;
          g.fillRect(largo - 3, -4, 6, 8);
          g.fillStyle = "#ffffff55";
          g.fillRect(largo - 2, -4, 1, 8);
        } else if (estilo === "baston") {
          g.fillStyle = "#7a5a3a";
          g.fillRect(-3, -1, largo + 3, 1);
          g.fillStyle = color;
          g.fillRect(largo, -2, 3, 3);
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = 0.6;
          g.fillRect(largo - 1, -3, 5, 5);
        } else {
          g.fillStyle = "#8a6a3a";
          g.fillRect(-2, -1, 3, 2);
          g.fillStyle = "#c9a76a";
          g.fillRect(1, -2, 1, 4);
          g.fillStyle = color;
          g.fillRect(2, -1, largo, 2);
          g.fillStyle = "#ffffff";
          g.fillRect(2, -1, largo, 1);
        }
      }
    }
    g.restore();
  }

  private dibujarArma(g: CanvasRenderingContext2D, estilo: string, mx: number, my: number, color: string, extendida: boolean): void {
    const d = this.dir;
    switch (estilo) {
      case "espada":
        g.fillStyle = "#8a6a3a";
        g.fillRect(mx - 1, my - 1, 2, 2);
        g.fillStyle = color;
        if (extendida) g.fillRect(d > 0 ? mx + 1 : mx - 11, my - 1, 10, 1);
        else {
          // A la espalda, asomando por encima del hombro.
          for (let k = 0; k < 9; k++) g.fillRect(mx - d * Math.floor(k / 3), my - 4 - k, 1, 1);
          g.fillStyle = "#8a6a3a";
          g.fillRect(mx - 1, my - 3, 3, 1);
        }
        break;
      case "pesada":
        g.fillStyle = "#6a5a4a";
        if (extendida) {
          g.fillRect(d > 0 ? mx : mx - 9, my - 1, 9, 2);
          g.fillStyle = color;
          g.fillRect(d > 0 ? mx + 8 : mx - 12, my - 4, 4, 7);
        } else {
          g.fillRect(mx - 1, my - 10, 2, 12);
          g.fillStyle = color;
          g.fillRect(mx - 3, my - 13, 6, 4);
        }
        break;
      case "arco":
        g.fillStyle = "#8a6a3a";
        for (let k = -8; k <= 8; k++) g.fillRect(mx - d * Math.round(2 - (k * k) / 24), my - 6 + k, 1, 1);
        g.fillStyle = "#e8e8f0";
        g.fillRect(mx + d * 2, my - 14, 1, 16);
        break;
      case "baston":
        g.fillStyle = "#7a5a3a";
        if (extendida) g.fillRect(d > 0 ? mx : mx - 12, my - 1, 12, 1);
        else g.fillRect(mx, my - 12, 1, 18);
        g.fillStyle = color;
        g.fillRect(extendida ? (d > 0 ? mx + 11 : mx - 13) : mx - 1, extendida ? my - 2 : my - 14, 3, 3);
        break;
      default:
        g.fillStyle = color;
        g.fillRect(mx - 1, my - 1, 3, 3);
    }
  }
}

/** Versión oscura de un color #rrggbb (exterior de la capa). */
function sombra(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (v: number): number => Math.round(v * 0.55);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
