// Escena de juego: une el dominio (Partida, MapaPiso, Meta) con las entidades, la física y el render.
// Implementa el Contexto que usan las entidades para interactuar con el mundo.

import { AzarSistema, type Azar } from "minialu";
import { PISOS_TOTALES, SALAS_POR_PISO, bioma, type Bioma } from "../contenido/biomas.ts";
import { botinCofre, botinEnemigo, botinVela, type Premio } from "../dominio/botin.ts";
import { crearEco, premiosEco, type Eco } from "../dominio/eco.ts";
import type { Meta } from "../dominio/meta.ts";
import { aperturas, generarPiso, type MapaPiso, type SalaMapa } from "../dominio/mundo/generador.ts";
import {
  ALTO_SALA, ANCHO_SALA, COLS, ENEMIGOS_SPAWN, FILAS, FILAS_PUERTA, T_CRISTAL, T_RAICES, T_ROCA, T_VACIO, TILE,
  construirSala, indice,
} from "../dominio/mundo/sala.ts";
import { Partida, type DatosPartida, type OpcionesInicio, type ResumenPartida } from "../dominio/partida.ts";
import { calcularGolpe } from "../dominio/stats.ts";
import { INFO_RELIQUIA, OPUESTA, RANURAS, type Dir, type Reliquia } from "../dominio/tipos.ts";
import type { Audio } from "../motor/audio.ts";
import type { Entrada } from "../motor/entrada.ts";
import { solapan, type Rect, type Tiles } from "../motor/fisica.ts";
import type { AtaqueJugador, Cadena, Contexto, Peligro } from "./contexto.ts";
import { DECORADO } from "../contenido/atlas.ts";
import { dibujarRecorte, sprites } from "../motor/sprites.ts";
import { GRACIA_ENTRADA, entradaPor, salidaDe } from "./transiciones.ts";
import { Efectos } from "./efectos.ts";
import type { Criatura } from "./entidades/criatura.ts";
import { Enemigo } from "./entidades/enemigo.ts";
import { EcoRival, ElQueRecuerda, Guardian, MadreMicelio } from "./entidades/jefes.ts";
import { JefeConfigurable } from "./entidades/jefe-configurable.ts";
import { CARGA_COMPLETA, Jugador } from "./entidades/jugador.ts";
import { BotinSuelo, Interactuable, colorPremio, premioDestacado } from "./entidades/objetos.ts";
import { Proyectil } from "./entidades/proyectil.ts";
import { MedidorCombo, type AccionEstilo } from "./medidor-combo.ts";
import { Iluminacion, dibujarBarreras, dibujarVineta, fondoBioma, prerenderSala, primerPlano, type Luz } from "./render.ts";
import { Vela } from "./entidades/vela.ts";
import { AzarSemilla } from "minialu";

export interface EventosJuego {
  mensaje(texto: string, color: string): void;
  abrirAltar(): void;
  abrirYunque(): void;
  guardarDescenso(d: DatosDescenso): void;
  borrarDescenso(): void;
  abrirMercader(): void;
  reliquia(r: Reliquia): void;
  jefe(nombre: string, titulo: string): void;
  nuevoPiso(piso: number, b: Bioma): void;
  muerte(resumen: ResumenPartida, eco: Eco): void;
  victoria(resumen: ResumenPartida): void;
  guardar(): void;
}

interface EstadoSala {
  visitada: boolean;
  muertos: Set<number>;
  cofreAbierto: boolean;
  jefeVencido: boolean;
  reliquiaTomada: boolean;
  faroUsado: boolean;
  velasRotas: Set<number>;
  botin: { premio: Premio; x: number; y: number }[];
}

type EstadoSalaPlano = Omit<EstadoSala, "muertos" | "velasRotas"> & { muertos: number[]; velasRotas?: number[] };

/** Partida en curso guardada ("Continuar descenso"). Se borra al morir o al ganar. */
export interface DatosDescenso {
  readonly version: 1;
  readonly partida: DatosPartida;
  readonly mapa: MapaPiso;
  readonly estados: ReadonlyArray<readonly [number, EstadoSalaPlano]>;
  readonly sala: number;
  readonly x: number;
  readonly y: number;
}

export type InicioJuego = { readonly tipo: "nueva"; readonly opciones: OpcionesInicio } | { readonly tipo: "continuar"; readonly datos: DatosDescenso };

class SalaActiva implements Tiles {
  readonly tiles: Uint8Array;
  readonly mapa: SalaMapa;
  lienzo: HTMLCanvasElement;
  luces: readonly Luz[];
  readonly nombre: string;
  private readonly bioma: Bioma;

  constructor(mapa: SalaMapa, tiles: Uint8Array, nombre: string, b: Bioma) {
    this.mapa = mapa;
    this.tiles = tiles;
    this.nombre = nombre;
    this.bioma = b;
    const d = prerenderSala(this, b, mapa.semilla, mapa.tipo !== "normal");
    this.lienzo = d.lienzo;
    this.luces = d.luces;
  }

  rehacer(): void {
    const d = prerenderSala(this, this.bioma, this.mapa.semilla, this.mapa.tipo !== "normal");
    this.lienzo = d.lienzo;
    this.luces = d.luces;
  }

  tile(tx: number, ty: number): number {
    return this.tiles[indice(tx, ty)];
  }

  poner(tx: number, ty: number, v: number): void {
    this.tiles[indice(tx, ty)] = v;
  }
}

export class Juego implements Contexto {
  readonly partida: Partida;
  readonly meta: Meta;
  readonly audio: Audio;
  readonly fx = new Efectos();
  /** Medidor de estilo: combo, rango D → SSS. */
  readonly combo = new MedidorCombo();
  /** Cámara lenta: factor de tiempo y cuánto dura (en segundos reales). */
  private escalaTiempo = 1;
  private ralentizacion = 0;
  readonly jugador = new Jugador();
  mapa!: MapaPiso;
  sala!: SalaActiva;
  criaturas: Criatura[] = [];
  private proyectiles: Proyectil[] = [];
  private peligros: Peligro[] = [];
  private botines: BotinSuelo[] = [];
  private interactuables: Interactuable[] = [];
  private estados = new Map<number, EstadoSala>();
  private readonly entrada: Entrada;
  private readonly eventos: EventosJuego;
  private readonly azarCombate: Azar = new AzarSistema();
  private readonly luz = new Iluminacion(ANCHO_SALA, 270);
  /** Capa emisiva (proyectiles, chispas, llamas) que se difumina y se suma: bloom. */
  private readonly emisiva = document.createElement("canvas");
  private readonly gEmisiva: CanvasRenderingContext2D;
  private fundido = 1;
  private puertasSelladas = false;
  private entradaReciente: { dir: Dir; tiempo: number } | null = null;
  cadena: Cadena | null = null;
  private ultimaDaga = -1;
  private relojRegen = 0;
  private avisosPozo = new Set<string>();
  private sellarPendiente = false;
  private avisosBarrera = new Set<string>();
  private causa = "el Pozo";
  terminado = false;
  tiempo = 0;

  constructor(meta: Meta, audio: Audio, entrada: Entrada, eventos: EventosJuego, inicio: InicioJuego = { tipo: "nueva", opciones: {} }) {
    this.meta = meta;
    this.audio = audio;
    this.entrada = entrada;
    this.eventos = eventos;
    this.emisiva.width = ANCHO_SALA;
    this.emisiva.height = 270;
    this.gEmisiva = this.emisiva.getContext("2d")!;
    this.jugador.reliquias = new Set(meta.listaReliquias());
    if (inicio.tipo === "continuar") {
      const d = inicio.datos;
      this.partida = Partida.restaurar(meta, d.partida);
      this.mapa = d.mapa;
      this.estados = new Map(d.estados.map(([id, e]) => [id, { ...e, muertos: new Set(e.muertos), velasRotas: new Set(e.velasRotas ?? []) }]));
      this.cargarSala(d.sala, null);
      this.jugador.colocar(d.x, d.y);
      this.audio.ambientar(this.partida.piso - 1);
      this.eventos.nuevoPiso(this.partida.piso, this.bioma);
      return;
    }
    meta.registro.partidas++;
    this.partida = new Partida(meta, (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, inicio.opciones);
    this.nuevoPiso();
  }

  /** Foto de la partida en curso para guardarla. */
  serializarDescenso(): DatosDescenso {
    this.guardarEstadoSala();
    return {
      version: 1,
      partida: this.partida.serializar(),
      mapa: this.mapa,
      estados: [...this.estados].map(([id, e]) => [id, { ...e, muertos: [...e.muertos], velasRotas: [...e.velasRotas] }] as const),
      sala: this.sala.mapa.id,
      x: this.jugador.x,
      y: Math.min(this.jugador.y, 14 * TILE - this.jugador.h),
    };
  }

  /** Solo para desarrollo (capturas): saltar a un piso y una sala. */
  depurarIr(piso: number, sala: number): void {
    while (this.partida.piso < piso) {
      this.partida.bajarPiso();
      this.nuevoPiso();
    }
    const id = Math.max(0, Math.min(sala, this.mapa.salas.length - 1));
    this.cargarSala(id, null);
    this.jugador.colocar(4 * TILE, 14 * TILE - this.jugador.h);
  }

  refrescarArte(): void {
    this.sala.rehacer();
  }

  guardarProgreso(): void {
    if (this.terminado) return;
    this.eventos.guardarDescenso(this.serializarDescenso());
  }

  // ---------------- Contexto ----------------

  get tiles(): Tiles {
    return this.sala;
  }

  get bioma(): Bioma {
    return bioma(this.partida.piso);
  }

  get piso(): number {
    return this.partida.piso;
  }

  agregarProyectil(p: Proyectil): void {
    this.proyectiles.push(p);
  }

  agregarCriatura(c: Criatura): void {
    this.criaturas.push(c);
  }

  agregarPeligro(p: Peligro): void {
    this.peligros.push(p);
  }

  mensaje(texto: string, color = "#ffffff"): void {
    this.eventos.mensaje(texto, color);
  }

  golpearJugador(ataque: number, desdeX: number, empuje = 170, fuente?: string): void {
    const j = this.jugador;
    if (this.terminado) return;
    if (j.invulnerable) {
      if (j.intentarEsquivaPerfecta()) this.esquivaPerfecta();
      return;
    }
    if (this.partida.pasiva() === "humo" && this.azarCombate.siguiente() < 0.2) {
      j.invuln = 0.35;
      this.fx.texto(j.cx, j.y - 4, "Esquiva", "#b48cff");
      this.fx.chispas(j.cx, j.cy, "#7d6bff", 10, { velocidad: 60, gravedad: 0 });
      return;
    }
    const s = this.partida.stats();
    const golpe = calcularGolpe(this.azarCombate, ataque, 1, s.defensa, 0);
    const danio = Math.max(1, Math.round(golpe.danio * this.partida.multiplicadorRecibido()));
    const r = this.partida.recibirDanio(danio);
    if (this.combo.golpes >= 5) this.fx.texto(j.cx, j.y - 14, "Combo roto", "#8a84a0");
    this.combo.recibirDanio();
    // Espinas: devuelve parte del daño al enemigo más cercano al golpe.
    if (this.partida.pasiva() === "espinas") {
      const atacante = this.criaturas
        .filter((c) => !c.muerto && !("esObjeto" in c) && Math.abs(c.cx - desdeX) < 48)
        .sort((x, y) => Math.abs(x.cx - desdeX) - Math.abs(y.cx - desdeX))[0];
      if (atacante !== undefined) {
        const reflejo = Math.max(1, Math.round(danio * 0.35));
        atacante.aplicarDanio(reflejo, this);
        this.fx.texto(atacante.cx, atacante.y - 6, `${reflejo}`, "#c4ff7a");
        this.fx.chispas(atacante.cx, atacante.cy, "#c4ff7a", 8, { velocidad: 80 });
      }
    }
    this.fx.texto(j.cx, j.y - 2, `-${danio}`, "#ff4d6d", true);
    this.fx.chispas(j.cx, j.cy, "#ff4d6d", 14, { velocidad: 120 });
    this.fx.sacudir(4);
    this.fx.congelar(0.06);
    this.fx.destellar("#ff0000", 0.25);
    this.audio.reproducir("herido");
    j.herido(desdeX, empuje);
    if (r === "salvado") {
      j.invuln = 2.2;
      this.fx.destellar("#ffffff", 0.8);
      this.mensaje("El Manto del Eco te sostiene. No caerás todavía.", "#ff4d4d");
    } else if (r === "muerto") {
      this.morir(fuente ?? this.causaPorDefecto());
    }
  }

  private causaPorDefecto(): string {
    const jefe = this.criaturas.find((c) => c.esJefe && !c.muerto);
    return jefe?.nombre ?? this.causa;
  }

  golpearCriatura(c: Criatura, a: AtaqueJugador, dirX: number): boolean {
    if (c.muerto) return false;
    if (c instanceof Vela) {
      c.aplicarDanio(1, this);
      this.audio.reproducir("romper");
      this.fx.chispas(c.cx, c.y, "#ffb23d", 12, { velocidad: 90, brillo: true });
      this.fx.congelar(0.02);
      return true;
    }
    if (c.bloquea(dirX, a.tipo)) {
      this.fx.texto(c.cx, c.y - 4, "¡Bloqueo!", "#aaaaff");
      this.fx.chispas(c.cx - dirX * c.w / 2, c.cy, "#ffffff", 6, { velocidad: 100 });
      this.audio.reproducir("bloqueo");
      this.jugador.vx = -dirX * 120;
      return true;
    }
    const s = this.partida.stats();
    const mods = this.partida.combate();
    const ejecutor = this.partida.tieneTalento("ejecutor") && c.hp < c.hpMax * 0.3 ? 1.35 : 1;
    const garantizado = this.jugador.criticoGarantizado;
    this.jugador.criticoGarantizado = false;
    const g = calcularGolpe(this.azarCombate, a.potencia * this.partida.multiplicadorDanio() * ejecutor * this.combo.multiplicadorDanio, 1, c.defensa,
      garantizado ? 100 : s.critico, 1.75 + mods.critDanio);
    c.aplicarDanio(g.danio, this);
    c.empujar(dirX, a.empuje * (g.critico ? 1.4 : 1));
    if (a.rompeGuardia === true && c instanceof Enemigo && c.conGuardia) {
      c.romperGuardia();
      this.fx.texto(c.cx, c.y - 10, "¡Guardia rota!", "#ffe27a");
    }
    if (a.quema === true) c.quemar(a.potencia * 0.15);
    if (a.ralentiza === true) c.lento = 2.5;
    if (a.curaPct !== undefined) this.partida.curar(Math.max(1, Math.round(s.hp * a.curaPct)));
    if (a.eter !== undefined) this.partida.recuperarEter(a.eter + mods.eterGolpe + this.combo.bonoEter);
    if (g.critico && this.partida.tiene("ojo")) this.partida.recuperarEter(4);
    // Críticos que aturden (Runa de Escarcha, conjunto Escarcha Eterna) y golpes que ralentizan (conjunto).
    const aturdeCrit = Math.max(this.partida.tieneRuna("escarcha") ? 0.8 : 0, this.partida.bonoConjuntoActivo("aturdeCrit"));
    if (g.critico && aturdeCrit > 0 && !c.pesado) c.aturdido = Math.max(c.aturdido, aturdeCrit);
    if (this.partida.bonoConjuntoActivo("ralentiza") > 0 && a.tipo === "golpe") c.lento = Math.max(c.lento, 1.5);
    // Lluvia de Acero: cada crítico lanza una daga gratis.
    if (g.critico && this.partida.tieneTalento("lluviaAcero") && this.tiempo - this.ultimaDaga > 0.25) {
      this.ultimaDaga = this.tiempo;
      const j = this.jugador;
      const ang = Math.atan2(c.cy - j.cy, c.cx - j.cx);
      this.agregarProyectil(new Proyectil({
        tipo: "daga", x: j.cx, y: j.cy - 4, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380, w: 10, h: 4, vida: 0.9,
        color: "#e8e8f0", ataqueJugador: { potencia: s.golpe * 0.8, tipo: "golpe", empuje: 60 },
      }));
    }
    if (a.aturde !== undefined && a.aturde > 0 && !c.pesado) c.aturdido = Math.max(c.aturdido, a.aturde);
    if (a.lanzar === true && !c.pesado) c.vy = -330;
    // Aturdimiento corto en cada golpe: los combos conectan. Los jefes no se dejan.
    if (!c.pesado) c.aturdido = Math.max(c.aturdido, a.tipo === "tecnica" ? 0.12 : 0.22);
    if (a.cuerpoACuerpo === true) this.jugador.alAcertarCuerpoACuerpo(this);
    this.sumarEstilo(this.accionDeEstilo(a));
    const pasiva = this.partida.pasiva();
    if (pasiva === "escarcha" && a.tipo === "golpe") c.lento = Math.max(c.lento, 1.5);
    if (pasiva === "sombra" && g.critico) this.partida.curar(Math.max(1, Math.round(s.hp * 0.03)));
    if (mods.robo > 0) this.partida.curar(Math.max(1, Math.round(g.danio * mods.robo)));
    this.fx.texto(c.cx, c.y - 2, `${g.danio}`, g.critico ? "#ffe27a" : "#ffffff", g.critico);
    this.fx.chispas(c.cx, c.cy, g.critico ? "#ffe27a" : "#ffffff", g.critico ? 14 : 7, {
      velocidad: 130, angulo: dirX > 0 ? 0 : Math.PI, apertura: 1.6, vida: 0.35,
    });
    this.audio.reproducir(g.critico ? "critico" : "impacto");
    this.fx.congelar(g.critico ? 0.07 : 0.035);
    this.fx.sacudir(g.critico ? 3 : 1.2);
    return true;
  }

  golpearArea(r: Rect, a: AtaqueJugador, dirX: number, ya: Set<Criatura>): number {
    let n = 0;
    for (const c of this.criaturas) {
      if (c.muerto || ya.has(c) || !solapan(r, c)) continue;
      ya.add(c);
      if (this.golpearCriatura(c, a, dirX)) n++;
    }
    return n;
  }

  tocarBarreras(r: Rect, medio: "embestida" | "fuego"): void {
    const objetivo = medio === "embestida" ? T_CRISTAL : T_RAICES;
    for (let ty = Math.floor(r.y / TILE); ty <= Math.floor((r.y + r.h) / TILE); ty++) {
      for (let tx = Math.floor(r.x / TILE); tx <= Math.floor((r.x + r.w) / TILE); tx++) {
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= FILAS) continue;
        if (this.sala.tile(tx, ty) === objetivo) {
          this.romperBarrera(tx, objetivo);
          return;
        }
      }
    }
  }

  private romperBarrera(tx: number, tipo: number): void {
    for (const ty of FILAS_PUERTA) {
      if (this.sala.tile(tx, ty) === tipo) {
        this.sala.poner(tx, ty, T_VACIO);
        this.fx.chispas(tx * TILE + 8, ty * TILE + 8, tipo === T_CRISTAL ? "#7fe3ff" : "#ff7a3d", 18, { velocidad: 140, brillo: true });
      }
    }
    const lado: Dir = tx < COLS / 2 ? "izq" : "der";
    const ap = aperturas(this.mapa, this.sala.mapa.id)[lado];
    const conexion = this.mapa.conexiones.find((c) =>
      (c.a === this.sala.mapa.id && c.b === ap?.destino) || (c.b === this.sala.mapa.id && c.a === ap?.destino));
    if (conexion !== undefined) conexion.barrera = undefined;
    this.audio.reproducir("romper");
    this.fx.sacudir(4);
    this.mensaje(tipo === T_CRISTAL ? "El cristal resonante se quiebra" : "Las raíces arden hasta las cenizas", tipo === T_CRISTAL ? "#7fe3ff" : "#ff7a3d");
  }

  // ---------------- Pisos y salas ----------------

  private nuevoPiso(): void {
    const piso = this.partida.piso;
    this.mapa = generarPiso(this.partida.azar, {
      piso,
      cantidadSalas: SALAS_POR_PISO[piso - 1] ?? 12,
      ancho: 7,
      alto: 5,
      reliquiasPoseidas: this.meta.listaReliquias(),
      reliquiaAColocar: this.meta.reliquiaParaPiso(piso),
      hayEco: this.meta.ecoDelPiso(piso) !== undefined,
    });
    this.estados = new Map();
    this.avisosBarrera.clear();
    this.avisosPozo.clear();
    this.cargarSala(this.mapa.inicio, null);
    const inicio = this.interactuables.find((i) => i.tipo === "faro");
    this.jugador.colocar((inicio?.x ?? 200) + 30, 14 * TILE - this.jugador.h);
    this.jugador.vx = 0;
    this.jugador.vy = 0;
    this.audio.ambientar(piso - 1);
    this.eventos.nuevoPiso(piso, this.bioma);
    this.guardarProgreso();
  }

  estadoDe(id: number): EstadoSala {
    let e = this.estados.get(id);
    if (e === undefined) {
      e = { visitada: false, muertos: new Set(), cofreAbierto: false, jefeVencido: false, reliquiaTomada: false, faroUsado: false, velasRotas: new Set(), botin: [] };
      this.estados.set(id, e);
    }
    return e;
  }

  salaVisitada(id: number): boolean {
    return this.estados.get(id)?.visitada ?? false;
  }

  private guardarEstadoSala(): void {
    if (this.sala === undefined) return;
    const e = this.estadoDe(this.sala.mapa.id);
    e.botin = this.botines.map((b) => ({ premio: b.premio, x: b.x + 4, y: b.y + 4 }));
  }

  private cargarSala(id: number, entrada: Dir | null): void {
    this.guardarEstadoSala();
    const sm = this.mapa.salas[id];
    const estado = this.estadoDe(id);
    estado.visitada = true;
    const ap = aperturas(this.mapa, id);
    const densidad = 0.55 + this.partida.piso * 0.12;
    const datos = construirSala(sm.tipo, sm.semilla, ap, this.partida.azar, densidad);
    this.sala = new SalaActiva(sm, datos.tiles, datos.nombre, this.bioma);
    this.criaturas = [];
    this.proyectiles = [];
    this.peligros = [];
    this.interactuables = [];
    this.puertasSelladas = false;
    this.sellarPendiente = false;
    this.fx.limpiar();
    this.botines = estado.botin.map((b) => {
      const s = new BotinSuelo(b.premio, b.x, b.y);
      s.vx = 0;
      s.vy = 0;
      s.t = 1;
      return s;
    });

    const piso = 14 * TILE;
    datos.spawns.forEach((sp, i) => {
      const x = sp.tx * TILE + TILE / 2;
      const y = (sp.ty + 1) * TILE;
      if (ENEMIGOS_SPAWN.has(sp.tipo)) {
        if (estado.muertos.has(i)) return;
        const elite = this.partida.azar.siguiente() < 0.1 + this.partida.piso * 0.03;
        const e = new Enemigo(sp.tipo as "caminante", this.partida.piso, this.bioma, x - 7, y, elite);
        e.x = x - e.w / 2;
        if (sp.tipo === "volador") e.y = sp.ty * TILE;
        e.idSpawn = i;
        this.criaturas.push(e);
        return;
      }
      switch (sp.tipo) {
        case "cofre": {
          const c = new Interactuable("cofre", x, y);
          c.usado = estado.cofreAbierto;
          this.interactuables.push(c);
          break;
        }
        case "altar":
          this.interactuables.push(new Interactuable("altar", x, y));
          break;
        case "faro": {
          const f = new Interactuable("faro", x, y);
          f.usado = estado.faroUsado;
          this.interactuables.push(f);
          break;
        }
        case "yunque":
          this.interactuables.push(new Interactuable("yunque", x, y));
          break;
        case "mercader":
          this.interactuables.push(new Interactuable("mercader", x, y));
          break;
        case "reliquia":
          if (sm.reliquia !== undefined) {
            const r = new Interactuable("reliquia", x, y, sm.reliquia);
            r.usado = estado.reliquiaTomada || this.meta.tieneReliquia(sm.reliquia);
            this.interactuables.push(r);
          }
          break;
        case "jefe":
          if (estado.jefeVencido) {
            this.interactuables.push(new Interactuable("portal", x, piso));
          } else {
            this.invocarJefe(x, piso);
          }
          break;
        case "eco": {
          const eco = this.meta.ecoDelPiso(this.partida.piso);
          if (eco !== undefined && !estado.jefeVencido) {
            const rival = new EcoRival(eco, x, piso);
            rival.idSpawn = i;
            this.criaturas.push(rival);
            this.sellarPuertas(true);
            this.eventos.jefe(eco.nombre, `Tu Eco · ${eco.causa}`);
            this.audio.reproducir("jefe");
          }
          break;
        }
        default:
          break;
      }
    });

    this.cadena = ap.arr !== undefined || ap.aba !== undefined
      ? { x: ANCHO_SALA / 2, arriba: ap.arr !== undefined ? -60 : 14 * TILE, abajo: ap.aba !== undefined ? ALTO_SALA + 60 : 14 * TILE }
      : null;
    if (this.cadena === null) this.jugador.trepando = false;
    this.colocarVelas(sm, estado);
    if (entrada !== null) {
      this.colocarAlEntrar(entrada);
      this.guardarProgreso();
    }
    this.fundido = 1;
    this.audio.reproducir("puerta");
  }

  /** Velas rompibles (Castlevania): sobre el piso o las plataformas, deterministas por sala. */
  private colocarVelas(sm: SalaMapa, estado: EstadoSala): void {
    if (sm.tipo === "jefe" || sm.tipo === "eco") return;
    const azar = new AzarSemilla(sm.semilla ^ 0x5eed);
    const candidatos: [number, number][] = [];
    for (let ty = 3; ty <= 13; ty++) {
      for (let tx = 3; tx <= 26; tx++) {
        if (tx >= 11 && tx <= 18) continue;
        const aqui = this.sala.tile(tx, ty);
        const abajo = this.sala.tile(tx, ty + 1);
        if (aqui === T_VACIO && (abajo === T_ROCA || abajo === 2) && this.sala.tile(tx, ty - 1) === T_VACIO) candidatos.push([tx, ty]);
      }
    }
    const cantidad = Math.min(candidatos.length, 2 + Math.floor(azar.siguiente() * 2));
    for (let i = 0; i < cantidad; i++) {
      const [tx, ty] = candidatos.splice(Math.floor(azar.siguiente() * candidatos.length), 1)[0];
      // separarlas un poco
      for (let k = candidatos.length - 1; k >= 0; k--) if (Math.abs(candidatos[k][0] - tx) < 4 && candidatos[k][1] === ty) candidatos.splice(k, 1);
      if (estado.velasRotas.has(i)) continue;
      this.criaturas.push(new Vela(tx * TILE + 8, (ty + 1) * TILE, i, azar.siguiente() < 0.4));
      if (candidatos.length === 0) break;
    }
  }

  private invocarJefe(x: number, piso: number): void {
    const def = this.bioma.jefe;
    const jefe = def.id === "guardian"
      ? new Guardian(def, this.partida.piso, x - def.w / 2, piso, "#c9b8ff")
      : def.id === "madre"
        ? new MadreMicelio(def, this.partida.piso, x - def.w / 2, 70, "#5fffd0")
        : def.id === "configurable"
          ? new JefeConfigurable(def, x, piso)
          : new ElQueRecuerda(def, this.partida.piso, x - def.w / 2, 110, this.meta.listaEcos());
    this.criaturas.push(jefe);
    this.sellarPuertas(true);
    this.eventos.jefe(def.nombre, def.titulo);
    this.audio.reproducir("jefe");
  }

  /** Sella (o abre) las puertas laterales mientras dura un duelo. El sello espera a que el jugador entre. */
  private sellarPuertas(sellar: boolean): void {
    if (sellar) {
      this.sellarPendiente = true;
      return;
    }
    this.sellarPendiente = false;
    this.aplicarSello(false);
  }

  private revisarSello(): void {
    if (!this.sellarPendiente) return;
    const j = this.jugador;
    if (j.x > 3 * TILE && j.x + j.w < 27 * TILE) {
      this.sellarPendiente = false;
      this.aplicarSello(true);
      this.audio.reproducir("puerta");
      this.fx.sacudir(3);
    }
  }

  private aplicarSello(sellar: boolean): void {
    const ap = aperturas(this.mapa, this.sala.mapa.id);
    for (const [lado, cols] of [["izq", [0, 1]], ["der", [28, 29]]] as const) {
      if (ap[lado] === undefined) continue;
      for (const ty of FILAS_PUERTA) {
        for (const tx of cols) this.sala.poner(tx, ty, sellar ? T_ROCA : T_VACIO);
      }
    }
    this.puertasSelladas = sellar;
  }

  private colocarAlEntrar(dir: Dir): void {
    const j = this.jugador;
    const p = entradaPor(dir, j);
    j.colocar(p.x, p.y);
    if (j.trepando && this.cadena !== null && (dir === "arr" || dir === "aba")) {
      // Sigue agarrado: aparece sobre la cadena de la sala nueva.
      j.x = this.cadena.x - j.w / 2;
    } else if (dir === "arr") {
      j.impulsoDePozo();
    }
    this.entradaReciente = { dir, tiempo: GRACIA_ENTRADA };
  }

  private revisarSalida(dt: number): void {
    const j = this.jugador;
    if (this.entradaReciente !== null) {
      this.entradaReciente.tiempo -= dt;
      if (this.entradaReciente.tiempo <= 0) this.entradaReciente = null;
    }
    const dir = salidaDe(j);
    if (dir === null) return;
    // Recién entrado: no se vuelve por donde se vino en el mismo instante (rebote).
    if (this.entradaReciente !== null && dir === OPUESTA[this.entradaReciente.dir]) {
      const p = entradaPor(this.entradaReciente.dir, j);
      j.colocar(p.x, p.y);
      return;
    }
    const ap = aperturas(this.mapa, this.sala.mapa.id)[dir];
    if (ap === undefined) {
      // No debería pasar (las salas tienen paredes): volver al faro.
      this.volverAlFaro();
      return;
    }
    this.cargarSala(ap.destino, dir);
  }

  volverAlFaro(): void {
    if (this.criaturas.some((c) => c.esJefe && !c.muerto)) {
      this.mensaje("Un duelo te retiene aquí", "#ff6a6a");
      return;
    }
    this.cargarSala(this.mapa.inicio, null);
    const faro = this.interactuables.find((i) => i.tipo === "faro");
    this.jugador.colocar((faro?.x ?? 200) + 24, 14 * TILE - this.jugador.h);
    this.jugador.vx = 0;
    this.jugador.vy = 0;
  }

  // ---------------- Bucle ----------------

  actualizar(dt: number): void {
    if (this.terminado) {
      this.fx.actualizar(dt);
      return;
    }
    // Cámara lenta (esquiva perfecta, subir de rango): el mundo entero va más despacio.
    if (this.ralentizacion > 0) {
      this.ralentizacion -= dt;
      dt *= this.escalaTiempo;
      if (this.ralentizacion <= 0) this.escalaTiempo = 1;
    }
    this.tiempo += dt;
    this.combo.actualizar(dt);
    this.fundido = Math.max(0, this.fundido - dt * 5);
    if (this.fx.pausaGolpe > 0) {
      this.fx.pausaGolpe -= dt;
      return;
    }

    if (this.entrada.recien("pocion")) {
      if (this.partida.usarPocion()) {
        this.audio.reproducir("pocion");
        this.fx.chispas(this.jugador.cx, this.jugador.cy, "#ff4d6d", 16, { velocidad: 60, gravedad: -100, brillo: true });
      } else this.mensaje("No tienes pociones (o ya estás a tope)", "#aaaaaa");
    }
    if (this.entrada.recien("eter")) {
      if (this.partida.usarEter()) {
        this.audio.reproducir("pocion");
        this.fx.chispas(this.jugador.cx, this.jugador.cy, "#4dc3ff", 16, { velocidad: 60, gravedad: -100, brillo: true });
      } else this.mensaje("No tienes frascos de éter (o ya estás a tope)", "#aaaaaa");
    }

    this.jugador.actualizar(dt, this, this.entrada);
    if (this.terminado) return;

    for (const c of this.criaturas) {
      c.actualizar(dt, this);
      if (!c.muerto && solapan(c, this.jugador) && c.danioContacto() > 0) {
        this.golpearJugador(c.danioContacto(), c.cx, 180, c.nombre);
      }
    }
    for (const c of this.criaturas) if (c.muerto) this.procesarMuerte(c);
    this.criaturas = this.criaturas.filter((c) => !c.muerto);

    for (const p of this.proyectiles) {
      p.actualizar(dt, this);
      if (p.muerto) continue;
      if (p.op.ataqueJugador !== undefined) {
        for (const c of this.criaturas) {
          if (c.muerto || p.golpeados.has(c) || !solapan(p, c)) continue;
          p.golpeados.add(c);
          this.golpearCriatura(c, p.op.ataqueJugador, Math.sign(p.vx) || this.jugador.dir);
          p.impacto(this);
          if (p.muerto) break;
        }
      } else if (p.op.ataqueEnemigo !== undefined) {
        // Desvío: el golpe cuerpo a cuerpo devuelve el proyectil.
        const zona = this.jugador.zonaActiva;
        if (zona !== null && solapan(p, zona)) {
          this.desviar(p);
          continue;
        }
        if (solapan(p, this.jugador)) {
          if (this.jugador.invulnerable) {
            this.golpearJugador(p.op.ataqueEnemigo, p.x, 150);
          } else {
            this.golpearJugador(p.op.ataqueEnemigo, p.x, 150);
            p.impacto(this);
          }
        }
      }
    }
    for (const c of this.criaturas) if (c.muerto) this.procesarMuerte(c);
    this.criaturas = this.criaturas.filter((c) => !c.muerto);
    this.proyectiles = this.proyectiles.filter((p) => !p.muerto);

    for (const z of this.peligros) {
      if (z.aviso > 0) {
        z.aviso -= dt;
        continue;
      }
      z.activo -= dt;
      if (!z.golpeo && solapan(z, this.jugador)) {
        z.golpeo = true;
        this.golpearJugador(z.danio, z.x + z.w / 2, 200);
      }
    }
    this.peligros = this.peligros.filter((z) => z.aviso > 0 || z.activo > 0);

    this.actualizarBotin(dt);
    // Regeneración: cada 5 s cura lo que diga el stat.
    this.relojRegen += dt;
    if (this.relojRegen >= 5) {
      this.relojRegen = 0;
      const regen = this.partida.stats().regen;
      if (regen > 0 && this.partida.hp < this.partida.stats().hp) {
        this.partida.curar(regen);
        this.fx.texto(this.jugador.cx, this.jugador.y - 6, `+${regen}`, "#7dff9a");
      }
    }
    this.avisarBarreras();
    this.revisarSello();
    if (this.entrada.recien("interactuar")) this.interactuar();
    this.ambiente();
    this.fx.actualizar(dt);
    this.ayudasDePozo();
    if (!this.terminado) this.revisarSalida(dt);
  }

  private actualizarBotin(dt: number): void {
    for (const b of this.botines) {
      b.actualizar(dt, this.sala);
      if (!b.recogible || !solapan(b, this.jugador)) continue;
      const r = this.partida.recoger(b.premio);
      if (r.ok) {
        b.t = -999;
        const destacado = premioDestacado(b.premio);
        this.audio.reproducir(destacado === 2 ? "unico" : destacado === 1 ? "raro" : "recoger");
        this.fx.chispas(b.x + 4, b.y + 4, colorPremio(b.premio), destacado > 0 ? 20 : 6, { velocidad: 70, brillo: true, gravedad: -40 });
        if (b.premio.tipo === "esquirlas") this.fx.texto(b.x + 4, b.y - 4, `+${b.premio.cantidad}`, "#9fe8ff");
        else if (b.premio.tipo === "corazones") this.fx.texto(b.x + 4, b.y - 4, `+${b.premio.cantidad} ♥`, "#ff8aa0");
        else this.mensaje(r.valor, colorPremio(b.premio));
      } else if (!b.avisado) {
        b.avisado = true;
        this.mensaje(b.premio.tipo === "carta" ? "Mazo lleno: libera espacio (I)" : "Mochila llena: desguaza o usa algo (I)", "#ff9a4d");
      }
    }
    this.botines = this.botines.filter((b) => b.t > -1);
  }

  // ---------------- Combate: estilo, cámara lenta, esquiva perfecta y desvío ----------------

  ralentizar(factor: number, segundos: number): void {
    this.escalaTiempo = Math.min(this.escalaTiempo, factor);
    this.ralentizacion = Math.max(this.ralentizacion, segundos);
  }

  private accionDeEstilo(a: AtaqueJugador): AccionEstilo {
    if (a.cuerpoACuerpo !== true) return a.tipo === "tecnica" ? "tecnica" : "subarma";
    const actual = this.jugador.tipoAccion;
    if (actual === "estocada") return "estocada";
    if (actual === "cargado") return "cargado";
    if (!this.jugador.enSuelo) return "aereo";
    return a.tipo === "patada" ? "patada" : "golpe";
  }

  private sumarEstilo(a: AccionEstilo): void {
    const subio = this.combo.registrar(a);
    if (subio === null) return;
    const j = this.jugador;
    this.fx.texto(j.cx, j.y - 18, `${subio.nombre} · ${subio.titulo}`, subio.color, true);
    this.audio.reproducir(this.combo.indiceRango >= 4 ? "unico" : "nivel");
    if (this.combo.indiceRango >= 4) {
      this.ralentizar(0.55, 0.12);
      this.fx.destellar(subio.color, 0.25);
    }
  }

  private esquivaPerfecta(): void {
    const j = this.jugador;
    this.ralentizar(0.3, 0.5);
    this.fx.texto(j.cx, j.y - 16, "¡ESQUIVA PERFECTA!", "#9fe8ff", true);
    this.fx.destellar("#9fe8ff", 0.35);
    this.fx.chispas(j.cx, j.cy, "#9fe8ff", 24, { velocidad: 110, brillo: true, gravedad: 0 });
    this.audio.reproducir("raro");
    this.partida.recuperarEter(15);
    this.sumarEstilo("esquiva");
  }

  private desviar(p: Proyectil): void {
    const j = this.jugador;
    p.muerto = true;
    const s = this.partida.stats();
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    // Sale hacia donde mira el jugador, más rápido.
    const vel = Math.max(220, Math.hypot(p.vx, p.vy) * 1.5);
    const vy = Math.max(-80, Math.min(80, -p.vy * 0.5));
    this.agregarProyectil(new Proyectil({
      tipo: p.op.tipo === "onda" || p.op.tipo === "hueso" ? "sombra" : p.op.tipo, x: cx, y: cy,
      vx: j.dir * vel, vy, w: p.w, h: p.h, vida: 1.5, atraviesaParedes: p.op.atraviesaParedes, explota: p.op.explota,
      color: "#ffffff", ataqueJugador: { potencia: s.golpe * 1.5 + (p.op.ataqueEnemigo ?? 0), tipo: "golpe", empuje: 160 },
    }));
    this.fx.texto(cx, cy - 8, "¡Desvío!", "#ffffff");
    this.fx.chispas(cx, cy, "#ffffff", 14, { velocidad: 140, brillo: true });
    this.fx.congelar(0.05);
    this.audio.reproducir("bloqueo");
    this.sumarEstilo("desvio");
  }

  /** Explica cómo bajar y por qué no se puede subir (una vez por sala). */
  private ayudasDePozo(): void {
    const j = this.jugador;
    if (this.cadena === null || j.trepando || !j.cercaDeCadena(this)) return;
    const clave = "cadena";
    if (this.avisosPozo.has(clave)) return;
    this.avisosPozo.add(clave);
    const ap = aperturas(this.mapa, this.sala.mapa.id);
    const sentido = ap.arr !== undefined && ap.aba !== undefined ? "↑ / ↓" : ap.arr !== undefined ? "↑" : "↓";
    this.mensaje(`Cadena: ${sentido} para trepar · Salto para soltarte`, "#ffe9a8");
  }

  private avisarBarreras(): void {
    const j = this.jugador;
    for (const [tx, lado] of [[1, -1], [28, 1]] as const) {
      const cerca = lado < 0 ? j.x < (tx + 2) * TILE : j.x + j.w > (tx - 1) * TILE;
      if (!cerca) continue;
      const tile = this.sala.tile(tx, 12);
      if (tile !== T_CRISTAL && tile !== T_RAICES) continue;
      const clave = `${this.sala.mapa.id}:${tx}`;
      if (this.avisosBarrera.has(clave)) continue;
      this.avisosBarrera.add(clave);
      const reliquia: Reliquia = tile === T_CRISTAL ? "embestida" : "garraIgnea";
      const tiene = this.jugador.reliquias.has(reliquia);
      const nombre = INFO_RELIQUIA[reliquia].nombre;
      this.mensaje(
        tile === T_CRISTAL
          ? (tiene ? "Cristal resonante: atraviésalo con la Embestida (Shift)" : `Un cristal resonante. Necesitas: ${nombre}`)
          : (tiene ? "Muro de raíces: quémalo a golpes con la Garra Ígnea" : `Un muro de raíces. Necesitas: ${nombre}`),
        INFO_RELIQUIA[reliquia].color,
      );
    }
  }

  private ambiente(): void {
    const b = this.bioma;
    if (Math.random() < 0.25) {
      const x = Math.random() * ANCHO_SALA;
      const y = Math.random() * ALTO_SALA;
      switch (b.particula) {
        case "brasas": this.fx.ambiente(x, ALTO_SALA, "#ff8a3d", -20 - Math.random() * 20, true); break;
        case "esporas": this.fx.ambiente(x, y, "#5fffd0", -6, true); break;
        case "nieve": this.fx.ambiente(x, -4, "#ffffff", 14 + Math.random() * 10, false); break;
        case "burbujas": this.fx.ambiente(x, ALTO_SALA, "#9fe8ff88", -18 - Math.random() * 12, true); break;
        case "ceniza": this.fx.ambiente(x, -4, "#a09080", 8 + Math.random() * 6, false); break;
        case "petalos": this.fx.ambiente(x, -4, "#ff5a8a", 10 + Math.random() * 8, false); break;
        case "chispas": this.fx.ambiente(x, y, "#ffc84a", -30 - Math.random() * 30, true); break;
        case "estrellas": this.fx.ambiente(x, y, Math.random() < 0.5 ? "#ffffff" : "#c9a7ff", 0, true); break;
        case "sangre": this.fx.ambiente(x, y, "#ff4d4d88", -4, true); break;
        default: this.fx.ambiente(x, y, "#c9b8ff55", 4, false);
      }
    }
  }

  private interactuar(): void {
    const j = this.jugador;
    const zona = { x: j.x - 8, y: j.y - 4, w: j.w + 16, h: j.h + 8 };
    const obj = this.interactuables.find((i) => !i.usado && solapan(zona, i));
    if (obj === undefined) return;
    const estado = this.estadoDe(this.sala.mapa.id);
    switch (obj.tipo) {
      case "cofre": {
        obj.usado = true;
        estado.cofreAbierto = true;
        this.audio.reproducir("cofre");
        this.fx.chispas(obj.cx, obj.y, "#ffd23d", 30, { velocidad: 120, brillo: true });
        this.soltar(botinCofre(this.partida.azar, this.partida.piso, this.partida.modificadoresBotin()), obj.cx, obj.y);
        break;
      }
      case "altar":
        this.eventos.abrirAltar();
        break;
      case "yunque":
        this.eventos.abrirYunque();
        break;
      case "mercader":
        this.eventos.abrirMercader();
        break;
      case "faro": {
        const s = this.partida.stats();
        if (this.partida.hp >= s.hp && this.partida.mp >= s.mp) {
          this.mensaje("El faro arde en calma. Desde el mapa (M) puedes volver aquí.", "#ffe9a8");
          break;
        }
        this.partida.hp = s.hp;
        this.partida.mp = s.mp;
        obj.usado = true;
        estado.faroUsado = true;
        this.audio.reproducir("pocion");
        this.fx.chispas(obj.cx, obj.y + 4, "#ffe9a8", 30, { velocidad: 80, gravedad: -60, brillo: true });
        this.mensaje("Descansas junto al faro: vida y éter restaurados (una vez por piso)", "#ffe9a8");
        break;
      }
      case "reliquia":
        if (obj.reliquia === undefined) break;
        obj.usado = true;
        estado.reliquiaTomada = true;
        this.meta.otorgarReliquia(obj.reliquia);
        this.jugador.reliquias = new Set(this.meta.listaReliquias());
        this.audio.reproducir("reliquia");
        this.fx.destellar(INFO_RELIQUIA[obj.reliquia].color, 0.9);
        this.fx.chispas(obj.cx, obj.y, INFO_RELIQUIA[obj.reliquia].color, 60, { velocidad: 160, brillo: true, gravedad: 0 });
        this.eventos.reliquia(obj.reliquia);
        this.eventos.guardar();
        this.guardarProgreso();
        break;
      case "portal":
        this.descender();
        break;
    }
  }

  private descender(): void {
    if (this.partida.piso >= PISOS_TOTALES) {
      this.terminar(true);
      return;
    }
    this.guardarEstadoSala();
    this.partida.bajarPiso();
    this.nuevoPiso();
  }

  private soltar(premios: readonly Premio[], x: number, y: number): void {
    for (const p of premios) this.botines.push(new BotinSuelo(p, x, y));
  }

  private procesarMuerte(c: Criatura): void {
    if ((c as { procesada?: boolean }).procesada === true) return;
    (c as { procesada?: boolean }).procesada = true;
    const estado = this.estadoDe(this.sala.mapa.id);
    if (c instanceof Vela) {
      estado.velasRotas.add(c.indice);
      this.soltar(botinVela(this.partida.azar, this.partida.piso), c.cx, c.y + 4);
      return;
    }
    this.audio.reproducir("muerte");
    this.sumarEstilo("muerte");
    this.fx.chispas(c.cx, c.cy, "#ffffff", c.esJefe ? 80 : 18, { velocidad: c.esJefe ? 220 : 120, vida: 0.7 });
    this.fx.chispas(c.cx, c.cy, this.bioma.acento, c.esJefe ? 60 : 10, { velocidad: 90, brillo: true, gravedad: -30 });

    const niveles = this.partida.ganarExperiencia(c.exp);
    if (niveles > 0) {
      this.audio.reproducir("nivel");
      this.fx.texto(this.jugador.cx, this.jugador.y - 12, `¡NIVEL ${this.partida.nivel()}!`, "#ffe27a", true);
      this.fx.chispas(this.jugador.cx, this.jugador.cy, "#ffe27a", 30, { velocidad: 90, gravedad: -80, brillo: true });
    }
    if (c.idSpawn >= 0) estado.muertos.add(c.idSpawn);
    this.meta.registro.enemigos++;

    if (c instanceof EcoRival) {
      estado.jefeVencido = true;
      this.partida.ecosVencidos++;
      this.meta.vencerEco(c.eco.uid);
      this.soltar(premiosEco(c.eco, this.partida.azar), c.cx, c.cy);
      this.fx.destellar("#ffffff", 0.9);
      this.fx.sacudir(8);
      this.sellarPuertas(false);
      this.mensaje("Tu Eco se disuelve. Recuperas lo que el Pozo te quitó.", "#c9a7ff");
      this.eventos.guardar();
      this.guardarProgreso();
      return;
    }
    if (c.categoria === "jefe") {
      estado.jefeVencido = true;
      this.partida.jefes++;
      this.meta.registro.jefes++;
      this.soltar(botinEnemigo(this.partida.azar, this.partida.piso, "jefe", this.partida.modificadoresBotin()), c.cx, c.cy);
      this.fx.destellar("#ffffff", 1);
      this.fx.sacudir(10);
      this.fx.congelar(0.25);
      this.criaturas.forEach((o) => { if (!o.esJefe) o.muerto = true; });
      this.sellarPuertas(false);
      this.interactuables.push(new Interactuable("portal", ANCHO_SALA / 2, 14 * TILE));
      this.mensaje(
        this.partida.piso >= PISOS_TOTALES ? "El Corazón del Pozo deja de latir. El portal lleva a la superficie." : "El guardián cae. Un portal se abre hacia abajo.",
        "#ffe27a",
      );
      this.eventos.guardar();
      this.guardarProgreso();
      return;
    }
    if (this.partida.registrarMuerteEnemigo()) {
      this.fx.texto(this.jugador.cx, this.jugador.y - 10, "Corazón del Pozo", "#ff4d6d");
    }
    if (c.idSpawn >= 0) {
      this.soltar(botinEnemigo(this.partida.azar, this.partida.piso, c.categoria, this.partida.modificadoresBotin()), c.cx, c.cy);
    }
  }

  rendirse(): void {
    this.morir("su propia rendición");
  }

  private morir(causa: string): void {
    if (this.terminado) return;
    this.terminado = true;
    this.jugador.muerto = true;
    this.fx.destellar("#000000", 1);
    this.fx.chispas(this.jugador.cx, this.jugador.cy, "#ffffff", 60, { velocidad: 150, gravedad: -20, vida: 1.2, brillo: true });
    const eco = crearEco({
      piso: this.partida.piso,
      forma: this.partida.forma,
      nivel: this.partida.nivel(),
      stats: this.partida.stats(),
      equipo: RANURAS.map((r) => this.partida.equipo[r]),
      causa,
      numero: this.meta.registro.muertes + 1,
    }, this.partida.azar, Date.now());
    this.meta.registrarMuerte(eco);
    this.cerrarRegistro(false);
    this.audio.silenciarAmbiente();
    this.eventos.muerte(this.partida.resumen(false), eco);
  }

  private terminar(victoria: boolean): void {
    this.terminado = true;
    this.meta.registro.victorias += victoria ? 1 : 0;
    this.cerrarRegistro(victoria);
    this.audio.silenciarAmbiente();
    this.eventos.victoria(this.partida.resumen(victoria));
  }

  private cerrarRegistro(victoria: boolean): void {
    this.eventos.borrarDescenso();
    this.meta.ganarEsencia(this.partida.esenciaGanada(victoria));
    this.meta.registro.mejorPiso = Math.max(this.meta.registro.mejorPiso, this.partida.piso);
    this.eventos.guardar();
  }

  // ---------------- Render ----------------

  dibujar(g: CanvasRenderingContext2D): void {
    const b = this.bioma;
    const j = this.jugador;
    const camY = Math.max(0, Math.min(ALTO_SALA - 270, j.cy - 135));
    const sx = this.fx.sacudida > 0 ? Math.round((Math.random() - 0.5) * this.fx.sacudida) : 0;
    const sy = this.fx.sacudida > 0 ? Math.round((Math.random() - 0.5) * this.fx.sacudida) : 0;

    g.drawImage(fondoBioma(b, 0), Math.round(-40 - (j.cx - ANCHO_SALA / 2) * 0.04), 0);
    g.drawImage(fondoBioma(b, 1), Math.round(-40 - (j.cx - ANCHO_SALA / 2) * 0.12), 0);
    g.fillStyle = b.niebla;
    g.fillRect(0, 0, ANCHO_SALA, 270);

    g.save();
    g.translate(sx, Math.round(-camY) + sy);
    g.drawImage(this.sala.lienzo, 0, 0);
    dibujarBarreras(g, this.sala, this.tiempo);
    if (this.cadena !== null) this.dibujarCadena(g, this.cadena);
    if (this.puertasSelladas) this.dibujarSellos(g);

    for (const z of this.peligros) {
      if (z.aviso > 0) {
        g.fillStyle = z.color;
        g.globalAlpha = 0.15 + (Math.floor(this.tiempo * 14) % 2) * 0.15;
        g.fillRect(z.x, z.y, z.w, z.h);
        g.globalAlpha = 0.8;
        g.fillRect(z.x, z.y + z.h - 2, z.w, 2);
      } else {
        g.globalAlpha = 0.9;
        g.fillStyle = z.color;
        g.fillRect(z.x + 2, z.y, z.w - 4, z.h);
        g.fillStyle = "#ffffff";
        g.fillRect(z.x + z.w / 2 - 1, z.y, 2, z.h);
      }
      g.globalAlpha = 1;
    }

    for (const i of this.interactuables) i.dibujar(g, b.acento);
    for (const bo of this.botines) bo.dibujar(g);
    for (const c of this.criaturas) c.dibujar(g);
    if (!j.muerto) j.dibujar(g, this);
    if (!j.muerto && j.carga > 0.12) {
      const f = Math.min(1, j.carga / CARGA_COMPLETA);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = f >= 1 ? "#ffffff" : this.partida.estilo().color;
      g.lineWidth = f >= 1 ? 2 : 1;
      g.beginPath();
      g.arc(j.cx, j.cy, 15, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      g.stroke();
      g.restore();
    }
    if (this.ralentizacion > 0) {
      g.save();
      g.globalAlpha = 0.12;
      g.fillStyle = "#9fe8ff";
      g.fillRect(0, 0, ANCHO_SALA, ALTO_SALA);
      g.restore();
    }
    for (const p of this.proyectiles) p.dibujar(g);
    this.fx.dibujarParticulas(g);
    g.restore();

    // Iluminación
    const luces: Luz[] = [{ x: j.cx, y: j.cy - camY, r: 95 }];
    for (const i of this.interactuables) if (!i.usado || i.tipo === "faro" || i.tipo === "portal") luces.push({ x: i.cx, y: i.y - camY + i.h / 2, r: 60, fuerza: 0.8 });
    for (const p of this.proyectiles) luces.push({ x: p.x, y: p.y - camY, r: 28, fuerza: 0.7 });
    for (const c of this.criaturas) if (c.esJefe) luces.push({ x: c.cx, y: c.cy - camY, r: 70, fuerza: 0.6 });
    for (const bo of this.botines) if (premioDestacado(bo.premio) > 0) luces.push({ x: bo.x, y: bo.y - camY, r: 30, fuerza: 0.6 });
    const parpadeo = (k: number): number => 0.9 + Math.sin(this.tiempo * 9 + k * 1.7) * 0.06 + Math.sin(this.tiempo * 23 + k) * 0.04;
    this.sala.luces.forEach((l, k) => luces.push({ x: l.x, y: l.y - camY, r: l.r * parpadeo(k), fuerza: l.fuerza }));
    for (const c of this.criaturas) {
      if (c instanceof Vela) luces.push({ x: c.llama.x, y: c.llama.y - camY, r: 34 * parpadeo(c.indice + 5), fuerza: 0.85 });
    }
    this.luz.dibujar(g, b.oscuridad, luces, "rgba(0,0,0,0)");

    // Bloom: lo emisivo se dibuja aparte, se difumina y se suma encima de la iluminación.
    const e = this.gEmisiva;
    e.clearRect(0, 0, ANCHO_SALA, 270);
    e.save();
    e.translate(sx, Math.round(-camY) + sy);
    for (const p of this.proyectiles) p.dibujar(e);
    for (const c of this.criaturas) if (c instanceof Vela) e.fillStyle = "#ff9a3d", e.fillRect(Math.round(c.llama.x) - 2, Math.round(c.llama.y) - 3, 4, 4);
    this.fx.dibujarBrillos(e);
    e.restore();
    g.save();
    g.globalCompositeOperation = "lighter";
    g.filter = "blur(4px)";
    g.globalAlpha = 0.85;
    g.drawImage(this.emisiva, 0, 0);
    g.filter = "none";
    g.globalAlpha = 0.5;
    g.drawImage(this.emisiva, 0, 0);
    g.restore();

    // Primer plano con paralaje rápido, gradación de color del bioma y viñeta.
    g.drawImage(primerPlano(b), Math.round(-80 - (j.cx - ANCHO_SALA / 2) * 0.25), 0);
    g.save();
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = 0.18;
    g.fillStyle = b.acento;
    g.fillRect(0, 0, ANCHO_SALA, 270);
    g.restore();
    dibujarVineta(g);

    g.save();
    g.translate(sx, -camY + sy);
    this.fx.dibujarTextos(g);
    // Indicación de interacción
    const zona = { x: j.x - 8, y: j.y - 4, w: j.w + 16, h: j.h + 8 };
    const cerca = this.interactuables.find((i) => !i.usado && solapan(zona, i));
    if (cerca !== undefined && !this.terminado) {
      const texto = `E · ${cerca.etiqueta()}`;
      g.font = "bold 8px monospace";
      const w = g.measureText(texto).width + 8;
      const x = Math.round(cerca.cx - w / 2);
      const y = Math.round(cerca.y - 16);
      g.fillStyle = "#000000cc";
      g.fillRect(x, y, w, 12);
      g.fillStyle = "#ffe9a8";
      g.fillText(texto, x + 4, y + 9);
    }
    g.restore();

    if (this.fx.destello > 0) {
      g.globalAlpha = this.fx.destello * 0.6;
      g.fillStyle = this.fx.colorDestello;
      g.fillRect(0, 0, ANCHO_SALA, 270);
      g.globalAlpha = 1;
    }
    if (this.fundido > 0) {
      g.globalAlpha = this.fundido;
      g.fillStyle = "#000000";
      g.fillRect(0, 0, ANCHO_SALA, 270);
      g.globalAlpha = 1;
    }
  }

  private dibujarCadena(g: CanvasRenderingContext2D, c: Cadena): void {
    const desde = Math.max(0, c.arriba);
    const hasta = Math.min(ALTO_SALA, c.abajo);
    const atlas = sprites.tenida("castillo", this.bioma.tinte[0], this.bioma.tinte[1]);
    if (atlas !== null) {
      for (let y = desde; y < hasta; y += 32) {
        const alto = Math.min(32, hasta - y);
        dibujarRecorte(g, atlas, [DECORADO.cadenaLarga[0], DECORADO.cadenaLarga[1], DECORADO.cadenaLarga[2], alto], c.x - 3, y);
      }
      return;
    }
    for (let y = desde; y < hasta; y += 6) {
      g.fillStyle = "#6e6684";
      g.fillRect(c.x - 2, y, 4, 4);
      g.fillStyle = "#1a1622";
      g.fillRect(c.x - 1, y + 1, 2, 2);
    }
  }

  private dibujarSellos(g: CanvasRenderingContext2D): void {
    const ap = aperturas(this.mapa, this.sala.mapa.id);
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const [lado, x] of [["izq", 0], ["der", 28 * TILE]] as const) {
      if (ap[lado] === undefined) continue;
      g.globalAlpha = 0.5 + Math.sin(this.tiempo * 6) * 0.2;
      g.fillStyle = "#ff3d3d";
      g.fillRect(x + (lado === "izq" ? 28 : 0), FILAS_PUERTA[0] * TILE, 4, TILE * 3);
    }
    g.restore();
  }

  /** Jefe vivo en la sala (para la barra del HUD). */
  jefeActivo(): Criatura | undefined {
    return this.criaturas.find((c) => c.barraJefe() && !c.muerto);
  }

  salaActualId(): number {
    return this.sala.mapa.id;
  }
}


