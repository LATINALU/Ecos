// El Portador. Movimiento con "coyote time" y salto en búfer (se siente justo), combo según el ESTILO del arma,
// golpe ascendente (↑ + golpe), patada que rompe guardias, pisotón con rebote, Embestida, Doble Salto,
// talentos (salto de pared, corte final, golpe de éter...) y la técnica de la Forma equipada.

import { INFO_TECNICA, alma, type Tecnica } from "../../contenido/almas.ts";
import type { DefEstilo } from "../../contenido/armas.ts";
import { TILE } from "../../dominio/mundo/sala.ts";
import type { Reliquia } from "../../dominio/tipos.ts";
import type { Entrada } from "../../motor/entrada.ts";
import { mover, type Cuerpo, type Rect } from "../../motor/fisica.ts";
import type { Contexto } from "../contexto.ts";
import type { Criatura } from "./criatura.ts";
import { GRAVEDAD } from "./criatura.ts";
import { dibujarFigura } from "./jefes.ts";
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

type TipoAccion = "golpe" | "giro" | "ascendente" | "patada" | "pisoton" | "zarpazo" | "tajo" | "terremoto" | "lanzar";

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
  readonly h = 22;
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
  private cdTecnica = 0;
  private atravesando = 0;
  private regenEter = 0;
  /** Pared tocada en el aire (-1 izq, 1 der) y por cuánto tiempo sigue valiendo para saltar. */
  private pared: -1 | 0 | 1 = 0;
  private graciaPared = 0;
  private bloqueoX = 0;
  deslizando = false;
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
    return this.invuln > 0 || this.embestida > 0 || this.accion?.tipo === "tajo";
  }

  get atacando(): boolean {
    return this.accion !== null;
  }

  colocar(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.estela.length = 0;
  }

  private maxEmbestidas(ctx: Contexto): number {
    return ctx.partida.tieneTalento("embestidaDoble") ? 2 : 1;
  }

  actualizar(dt: number, ctx: Contexto, e: Entrada): void {
    const p = ctx.partida;
    const ligereza = p.tieneTalento("ligereza");
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.cdTecnica = Math.max(0, this.cdTecnica - dt);
    this.ventanaCombo = Math.max(0, this.ventanaCombo - dt);
    this.atravesando = Math.max(0, this.atravesando - dt);
    this.bufferSalto = Math.max(0, this.bufferSalto - dt);
    this.bloqueoX = Math.max(0, this.bloqueoX - dt);
    this.graciaPared = Math.max(0, this.graciaPared - dt);
    this.separacionEmbestida = Math.max(0, this.separacionEmbestida - dt);
    this.coyote = this.enSuelo ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.enSuelo) this.saltosAereos = this.reliquias.has("dobleSalto") ? 1 : 0;

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

    if (this.embestida > 0) {
      this.actualizarEmbestida(dt, ctx);
      return;
    }

    const bloqueoMovimiento = this.accion !== null && (this.accion.tipo === "tajo" || this.accion.tipo === "terremoto");
    // ---- Movimiento horizontal
    const eje = (e.pulsada("der") ? 1 : 0) - (e.pulsada("izq") ? 1 : 0);
    if (!bloqueoMovimiento && this.bloqueoX <= 0) {
      const pesada = this.accion !== null && this.enSuelo ? (this.accion.tipo === "giro" ? 0.6 : 0.35) : 1;
      const objetivo = eje * VEL_MAX * (ligereza ? 1.15 : 1) * pesada;
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
      } else if (this.coyote > 0) {
        this.vy = salto;
        this.coyote = 0;
        this.bufferSalto = 0;
        ctx.audio.reproducir("salto");
        ctx.fx.chispas(this.cx, this.y + this.h, "#ffffff55", 5, { velocidad: 40, vida: 0.3, gravedad: 0 });
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
    if (this.accion === null) this.leerAcciones(ctx, e);
    else if ((this.accion.tipo === "golpe" || this.accion.tipo === "giro") && e.recien("golpe")) this.comboEnCola = true;

    if (e.recien("embestida") && this.reliquias.has("embestida") && this.cargasEmbestida > 0 && this.separacionEmbestida <= 0 && this.accion?.tipo !== "tajo") {
      this.iniciarEmbestida(ctx, eje);
      return;
    }

    // ---- Física
    const c = mover(this, ctx.tiles, dt, { atravesar: this.atravesando > 0 });
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
    if (e.recien("golpe")) {
      if (e.pulsada("arr")) {
        this.iniciar("ascendente", 0.3, 0);
        ctx.audio.reproducir("golpe");
        return;
      }
      const combo = this.ventanaCombo > 0 ? this.siguienteCombo : 0;
      this.iniciarGolpe(ctx, combo % this.largoCombo(ctx));
    } else if (e.recien("patada")) {
      if (!this.enSuelo && e.pulsada("aba")) {
        this.iniciar("pisoton", 1.2, 0);
        this.vy = 200;
      } else {
        this.iniciar("patada", 0.36, 0);
        ctx.audio.reproducir("patada");
      }
    } else if (e.recien("tecnica")) {
      this.usarTecnica(ctx);
    }
  }

  private iniciar(tipo: TipoAccion, duracion: number, combo: number): void {
    this.accion = { tipo, t: 0, duracion, golpeados: new Set(), combo, extra: 0 };
    this.comboEnCola = false;
  }

  // ---------------- Técnicas ----------------

  tecnicaActual(ctx: Contexto): Tecnica | null {
    const f = ctx.partida.forma;
    return f === null ? null : alma(f.personaje).tecnica;
  }

  /** Stat Técnica × estilo × pasiva Horno. */
  private potenciaTecnica(ctx: Contexto, tec: Tecnica): number {
    const p = ctx.partida;
    return p.stats().tecnica * INFO_TECNICA[tec].mult * p.estilo().tecnica * (p.pasiva() === "horno" ? 1.25 : 1);
  }

  private usarTecnica(ctx: Contexto): void {
    const tec = this.tecnicaActual(ctx);
    if (tec === null) {
      ctx.mensaje("Sin Forma: equipa una Carta de Alma (I)", "#aaaaaa");
      return;
    }
    const costo = ctx.partida.costoTecnica(INFO_TECNICA[tec].costo);
    if (this.cdTecnica > 0) return;
    if (ctx.partida.mp < costo) {
      ctx.fx.texto(this.cx, this.y - 4, "Sin éter", "#4dc3ff");
      ctx.audio.reproducir("fallo");
      return;
    }
    ctx.partida.mp -= costo;
    this.cdTecnica = 0.35;
    ctx.audio.reproducir("tecnica");
    const potencia = this.potenciaTecnica(ctx, tec);
    const quema = this.reliquias.has("garraIgnea");
    const color = alma(ctx.partida.forma!.personaje).colorSec;
    switch (tec) {
      case "orbe":
        this.iniciar("lanzar", 0.25, 0);
        ctx.agregarProyectil(new Proyectil({
          tipo: "orbe", x: this.cx + this.dir * 8, y: this.cy - 2, vx: this.dir * 230, vy: 0, w: 10, h: 10, vida: 2.2,
          explota: 30, color: "#ff7a3d",
          ataqueJugador: { potencia, tipo: "tecnica", empuje: 200, quema: true },
        }));
        break;
      case "lanza":
        this.iniciar("lanzar", 0.25, 0);
        ctx.agregarProyectil(new Proyectil({
          tipo: "lanza", x: this.cx + this.dir * 10, y: this.cy - 2, vx: this.dir * 330, vy: 0, w: 18, h: 5, vida: 1.6,
          atraviesa: true, color: "#bff3ff",
          ataqueJugador: { potencia, tipo: "tecnica", empuje: 80, ralentiza: true, quema },
        }));
        break;
      case "tajo":
        this.iniciar("tajo", 0.26, 0);
        this.vy = 0;
        this.vx = this.dir * 340;
        ctx.fx.destellar(color, 0.2);
        break;
      case "terremoto":
        this.iniciar("terremoto", this.enSuelo ? 0.3 : 1.2, 0);
        if (!this.enSuelo) this.vy = 380;
        break;
      case "zarpazo":
        this.iniciar("zarpazo", 0.42, 0);
        this.vx = this.dir * 120;
        break;
    }
  }

  private ondasTerremoto(ctx: Contexto): void {
    const potencia = this.potenciaTecnica(ctx, "terremoto");
    ctx.fx.sacudir(6);
    ctx.audio.reproducir("explosion");
    ctx.fx.chispas(this.cx, this.y + this.h, "#e0c48a", 24, { velocidad: 150, vida: 0.5 });
    for (const d of [-1, 1]) {
      ctx.agregarProyectil(new Proyectil({
        tipo: "onda", x: this.cx + d * 10, y: this.y + this.h - 8, vx: d * 230, vy: 0, w: 8, h: 14, vida: 1.4, rastrero: true,
        atraviesa: true, color: "#e0c48a",
        ataqueJugador: { potencia, tipo: "tecnica", empuje: 160, quema: this.reliquias.has("garraIgnea") },
      }));
    }
  }

  // ---------------- Ataques cuerpo a cuerpo ----------------

  private actualizarGolpe(a: AccionActiva, ctx: Contexto, e: DefEstilo): void {
    const p = ctx.partida;
    const s = p.stats();
    const quema = this.reliquias.has("garraIgnea");
    const giro = a.tipo === "giro";
    const ultimo = a.combo === this.largoCombo(ctx) - 1;
    const desde = giro ? 0.06 : e.activoDesde;
    const hasta = giro ? 0.2 : e.activoHasta;

    if (a.t >= desde && a.t <= hasta) {
      const r = giro
        ? { x: this.cx - e.alcance - 6, y: this.y, w: e.alcance * 2 + 12, h: 20 }
        : { x: this.dir > 0 ? this.x + this.w - 2 : this.x - e.alcance + 2, y: this.y + 2, w: e.alcance, h: e.alto };
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
      ctx.golpearArea(r, { potencia, tipo: "golpe", empuje, quema, eter: e.eter, aturde }, this.dir, a.golpeados);
      if (quema) ctx.tocarBarreras(r, "fuego");
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
    a.t += dt;
    const p = ctx.partida;
    const s = p.stats();
    const quema = this.reliquias.has("garraIgnea");

    switch (a.tipo) {
      case "golpe":
      case "giro":
        this.actualizarGolpe(a, ctx, p.estilo());
        break;
      case "ascendente": {
        if (a.t >= 0.05 && a.t <= 0.18) {
          const r = { x: this.cx - 14, y: this.y - 22, w: 28, h: 30 };
          const n = ctx.golpearArea(r, { potencia: s.golpe * 1.2, tipo: "golpe", empuje: 20, quema, eter: 3, lanzar: true }, this.dir, a.golpeados);
          if (n > 0 && !this.enSuelo && a.extra === 0) {
            a.extra = 1;
            this.vy = Math.min(this.vy, -200);
          }
          if (quema) ctx.tocarBarreras(r, "fuego");
        }
        if (a.t >= a.duracion) this.accion = null;
        break;
      }
      case "patada": {
        if (a.t >= 0.12 && a.t <= 0.22) {
          const r = { x: this.dir > 0 ? this.x + this.w - 2 : this.x - 24, y: this.y + 6, w: 26, h: 14 };
          const aturde = p.pasiva() === "raiz" ? 0.5 : 0;
          ctx.golpearArea(r, { potencia: s.patada, tipo: "patada", empuje: 250, rompeGuardia: true, quema, eter: 4, aturde }, this.dir, a.golpeados);
          if (quema) ctx.tocarBarreras(r, "fuego");
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
        const n = ctx.golpearArea(r, { potencia: s.patada * 0.9, tipo: "patada", empuje: 60, rompeGuardia: true, quema, eter: 4 }, this.dir, a.golpeados);
        if (n > 0) {
          this.vy = -300;
          this.saltosAereos = this.reliquias.has("dobleSalto") ? 1 : 0;
          this.accion = null;
        } else if (a.t >= a.duracion) {
          this.accion = null;
        }
        break;
      }
      case "lanzar":
        if (a.t >= a.duracion) this.accion = null;
        break;
      case "tajo": {
        this.vx = this.dir * 340;
        this.vy = 0;
        const r = { x: this.x - 6, y: this.y, w: this.w + 12, h: this.h };
        ctx.golpearArea(r, { potencia: this.potenciaTecnica(ctx, "tajo"), tipo: "tecnica", empuje: 120, quema }, this.dir, a.golpeados);
        this.sombras.push({ x: this.x, y: this.y, vida: 0.25 });
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
        if (golpe !== a.extra && golpe < 3) {
          a.extra = golpe;
          a.golpeados.clear();
          ctx.audio.reproducir("golpe");
        }
        if (golpe < 3) {
          const r = { x: this.dir > 0 ? this.x + this.w - 2 : this.x - 22, y: this.y, w: 24, h: 20 };
          ctx.golpearArea(r, { potencia: this.potenciaTecnica(ctx, "zarpazo"), tipo: "tecnica", empuje: 70, curaPct: 0.03, quema }, this.dir, a.golpeados);
        }
        this.vx *= 0.9;
        if (a.t >= a.duracion) this.accion = null;
        break;
      }
    }
  }

  // ---------------- Embestida ----------------

  private iniciarEmbestida(ctx: Contexto, eje: number): void {
    if (eje !== 0) this.dir = eje > 0 ? 1 : -1;
    this.embestida = 0.2;
    this.cargasEmbestida--;
    this.separacionEmbestida = 0.25;
    this.golpeadosEmbestida = new Set();
    this.accion = null;
    this.vy = 0;
    ctx.audio.reproducir("embestida");
  }

  private actualizarEmbestida(dt: number, ctx: Contexto): void {
    this.embestida -= dt;
    this.vx = this.dir * 330;
    this.vy = 0;
    const r: Rect = { x: this.dir > 0 ? this.x + this.w : this.x - 6, y: this.y, w: 6, h: this.h };
    ctx.tocarBarreras(r, "embestida");
    mover(this, ctx.tiles, dt);
    this.sombras.push({ x: this.x, y: this.y, vida: 0.2 });
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
    this.vx = (this.cx < desdeX ? -1 : 1) * empuje * 0.75;
    this.vy = -170;
  }

  /** Corta el ascenso al entrar a una sala desde abajo y asegura llegar a la plataforma. */
  impulsoDePozo(): void {
    this.vy = Math.min(this.vy, -345);
  }

  // ---------------- Dibujo ----------------

  dibujar(g: CanvasRenderingContext2D, ctx: Contexto): void {
    const forma = ctx.partida.forma;
    const a = forma !== null ? alma(forma.personaje) : null;
    const cuerpo = a?.color ?? "#6a6a7a";
    const acento = a?.colorSec ?? "#d0d0e0";
    const estilo = ctx.partida.estilo();

    // sombras de embestida / tajo
    for (const s of this.sombras) {
      g.globalAlpha = s.vida * 2;
      g.fillStyle = acento;
      g.fillRect(Math.round(s.x) + 1, Math.round(s.y), this.w - 2, this.h);
    }
    g.globalAlpha = 1;

    if (this.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) return;

    // bufanda que flamea
    g.fillStyle = acento;
    this.estela.forEach((p, i) => {
      if (i === 0) return;
      g.globalAlpha = 1 - i / this.estela.length;
      g.fillRect(Math.round(p.x - this.dir * i * 1.5), Math.round(p.y + Math.sin(this.t * 10 + i) * 1.2 + i * 0.4), 3, 2);
    });
    g.globalAlpha = 1;

    const atk = this.accion;
    const atacando = atk !== null && (atk.tipo === "golpe" || atk.tipo === "giro" || atk.tipo === "patada" || atk.tipo === "zarpazo");
    const x0 = Math.round(this.x);
    const y0 = Math.round(this.y);

    // Arma en reposo (a la espalda o en la mano)
    if (!atacando) this.dibujarArma(g, estilo.id, x0, y0, estilo.color);
    dibujarFigura(g, this.x, this.y, this.dir, cuerpo, acento, this.t, atacando, Math.abs(this.vx) > 15 && this.enSuelo);
    if (this.deslizando) {
      g.fillStyle = "#ffffff55";
      g.fillRect(this.pared > 0 ? x0 + this.w : x0 - 1, y0 + 2, 1, this.h - 4);
    }

    // Arcos de ataque
    if (atk !== null) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const x = Math.round(this.cx);
      const y = y0;
      if (atk.tipo === "golpe" && atk.t < estilo.activoHasta + 0.03) {
        const ultimo = atk.combo === this.largoCombo(ctx) - 1;
        g.strokeStyle = ultimo ? "#ffe27a" : estilo.color;
        g.lineWidth = estilo.id === "pesada" ? 4 : ultimo ? 3 : 2;
        g.beginPath();
        const ini = this.dir > 0 ? -1.2 : Math.PI + 1.2;
        const fin = this.dir > 0 ? 1.0 : Math.PI - 1.0;
        g.arc(x, y + 10, estilo.alcance * 0.75, Math.min(ini, fin), Math.max(ini, fin));
        g.stroke();
      } else if (atk.tipo === "giro" && atk.t < 0.24) {
        g.strokeStyle = "#ffe27a";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y + 11, estilo.alcance + 4, 9, 0, atk.t * 30, atk.t * 30 + Math.PI * 1.6);
        g.stroke();
      } else if (atk.tipo === "ascendente" && atk.t < 0.2) {
        g.strokeStyle = estilo.color;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y + 4, 16, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      } else if (atk.tipo === "patada" && atk.t >= 0.1 && atk.t <= 0.24) {
        g.fillStyle = "#ffffffaa";
        g.fillRect(this.dir > 0 ? x + 4 : x - 26, y + 12, 22, 3);
      } else if (atk.tipo === "pisoton") {
        g.fillStyle = "#ffffff88";
        g.fillRect(x0, Math.round(this.y + this.h), this.w, 3);
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

  private dibujarArma(g: CanvasRenderingContext2D, estilo: string, x: number, y: number, color: string): void {
    const atras = this.dir > 0 ? x - 1 : x + this.w - 2;
    g.fillStyle = color;
    switch (estilo) {
      case "espada":
        g.fillRect(atras, y + 4, 2, 13);
        g.fillStyle = "#8a6a3a";
        g.fillRect(atras - 1, y + 15, 4, 2);
        break;
      case "pesada":
        g.fillStyle = "#6a5a4a";
        g.fillRect(atras, y + 3, 2, 15);
        g.fillStyle = color;
        g.fillRect(atras - 2, y + 1, 6, 5);
        break;
      case "baston":
        g.fillStyle = "#7a5a3a";
        g.fillRect(atras, y - 2, 2, 22);
        g.fillStyle = color;
        g.fillRect(atras - 1, y - 4, 4, 3);
        break;
      default:
        g.fillRect(this.dir > 0 ? x + 10 : x - 1, y + 13, 3, 3);
    }
  }
}
