// Escena de juego: une el dominio (Partida, MapaPiso, Meta) con las entidades, la física y el render.
// Implementa el Contexto que usan las entidades para interactuar con el mundo.

import { AzarSistema, type Azar } from "minialu";
import { PISOS_TOTALES, SALAS_POR_PISO, bioma, type Bioma } from "../contenido/biomas.ts";
import { botinCofre, botinEnemigo, type Premio } from "../dominio/botin.ts";
import { crearEco, premiosEco, type Eco } from "../dominio/eco.ts";
import type { Meta } from "../dominio/meta.ts";
import { aperturas, generarPiso, type MapaPiso, type SalaMapa } from "../dominio/mundo/generador.ts";
import {
  ALTO_SALA, ANCHO_SALA, COLS, COLS_POZO, ENEMIGOS_SPAWN, FILAS, FILAS_PUERTA, T_CRISTAL, T_RAICES, T_ROCA, T_VACIO, TILE,
  construirSala, indice,
} from "../dominio/mundo/sala.ts";
import { Partida, type DatosPartida, type OpcionesInicio, type ResumenPartida } from "../dominio/partida.ts";
import { calcularGolpe } from "../dominio/stats.ts";
import { INFO_RELIQUIA, RANURAS, type Dir, type Reliquia } from "../dominio/tipos.ts";
import type { Audio } from "../motor/audio.ts";
import type { Entrada } from "../motor/entrada.ts";
import { solapan, type Rect, type Tiles } from "../motor/fisica.ts";
import type { AtaqueJugador, Contexto, Peligro } from "./contexto.ts";
import { Efectos } from "./efectos.ts";
import type { Criatura } from "./entidades/criatura.ts";
import { Enemigo } from "./entidades/enemigo.ts";
import { EcoRival, ElQueRecuerda, Guardian, MadreMicelio } from "./entidades/jefes.ts";
import { Jugador } from "./entidades/jugador.ts";
import { BotinSuelo, Interactuable, colorPremio, premioDestacado } from "./entidades/objetos.ts";
import type { Proyectil } from "./entidades/proyectil.ts";
import { Iluminacion, dibujarBarreras, fondoBioma, prerenderSala, type Luz } from "./render.ts";

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
  botin: { premio: Premio; x: number; y: number }[];
}

type EstadoSalaPlano = Omit<EstadoSala, "muertos"> & { muertos: number[] };

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
  readonly nombre: string;
  private readonly bioma: Bioma;

  constructor(mapa: SalaMapa, tiles: Uint8Array, nombre: string, b: Bioma) {
    this.mapa = mapa;
    this.tiles = tiles;
    this.nombre = nombre;
    this.bioma = b;
    this.lienzo = prerenderSala(this, b, mapa.semilla, mapa.tipo !== "normal");
  }

  rehacer(): void {
    this.lienzo = prerenderSala(this, this.bioma, this.mapa.semilla, this.mapa.tipo !== "normal");
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
  private fundido = 1;
  private puertasSelladas = false;
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
    this.jugador.reliquias = new Set(meta.listaReliquias());
    if (inicio.tipo === "continuar") {
      const d = inicio.datos;
      this.partida = Partida.restaurar(meta, d.partida);
      this.mapa = d.mapa;
      this.estados = new Map(d.estados.map(([id, e]) => [id, { ...e, muertos: new Set(e.muertos) }]));
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
      estados: [...this.estados].map(([id, e]) => [id, { ...e, muertos: [...e.muertos] }] as const),
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
    if (j.invulnerable || this.terminado) return;
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
    if (c.bloquea(dirX, a.tipo)) {
      this.fx.texto(c.cx, c.y - 4, "¡Bloqueo!", "#aaaaff");
      this.fx.chispas(c.cx - dirX * c.w / 2, c.cy, "#ffffff", 6, { velocidad: 100 });
      this.audio.reproducir("bloqueo");
      this.jugador.vx = -dirX * 120;
      return true;
    }
    const s = this.partida.stats();
    const g = calcularGolpe(this.azarCombate, a.potencia * this.partida.multiplicadorDanio(), 1, c.defensa, s.critico);
    c.aplicarDanio(g.danio, this);
    c.empujar(dirX, a.empuje * (g.critico ? 1.4 : 1));
    if (a.rompeGuardia === true && c instanceof Enemigo && c.conGuardia) {
      c.romperGuardia();
      this.fx.texto(c.cx, c.y - 10, "¡Guardia rota!", "#ffe27a");
    }
    if (a.quema === true) c.quemar(a.potencia * 0.15);
    if (a.ralentiza === true) c.lento = 2.5;
    if (a.curaPct !== undefined) this.partida.curar(Math.max(1, Math.round(s.hp * a.curaPct)));
    if (a.eter !== undefined) this.partida.recuperarEter(a.eter);
    if (g.critico && this.partida.tiene("ojo")) this.partida.recuperarEter(4);
    if (a.aturde !== undefined && a.aturde > 0 && !c.pesado) c.aturdido = Math.max(c.aturdido, a.aturde);
    if (a.lanzar === true && !c.pesado) c.vy = -330;
    const pasiva = this.partida.pasiva();
    if (pasiva === "escarcha" && a.tipo === "golpe") c.lento = Math.max(c.lento, 1.5);
    if (pasiva === "sombra" && g.critico) this.partida.curar(Math.max(1, Math.round(s.hp * 0.03)));
    if (pasiva === "hambre") this.partida.curar(Math.max(1, Math.round(g.danio * 0.06)));
    if (this.partida.tieneTalento("sedSangre") && a.tipo !== "tecnica") this.partida.curar(Math.max(1, Math.round(g.danio * 0.05)));
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
      e = { visitada: false, muertos: new Set(), cofreAbierto: false, jefeVencido: false, reliquiaTomada: false, faroUsado: false, botin: [] };
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

    if (entrada !== null) {
      this.colocarAlEntrar(entrada);
      this.guardarProgreso();
    }
    this.fundido = 1;
    this.audio.reproducir("puerta");
  }

  private invocarJefe(x: number, piso: number): void {
    const def = this.bioma.jefe;
    const jefe = def.id === "guardian"
      ? new Guardian(def, this.partida.piso, x - def.w / 2, piso, "#c9b8ff")
      : def.id === "madre"
        ? new MadreMicelio(def, this.partida.piso, x - def.w / 2, 70, "#5fffd0")
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
    const dentroDelPozo = (): number => Math.max(COLS_POZO[0] * TILE + 1, Math.min((COLS_POZO[3] + 1) * TILE - j.w - 1, j.x));
    switch (dir) {
      case "der":
        j.colocar(2, Math.min(j.y, 14 * TILE - j.h));
        break;
      case "izq":
        j.colocar(ANCHO_SALA - j.w - 2, Math.min(j.y, 14 * TILE - j.h));
        break;
      case "aba":
        j.colocar(dentroDelPozo(), -j.h + 4);
        break;
      case "arr":
        j.colocar(dentroDelPozo(), ALTO_SALA - j.h / 2);
        j.impulsoDePozo();
        break;
    }
  }

  private revisarSalida(): void {
    const j = this.jugador;
    let dir: Dir | null = null;
    if (j.cx < 0) dir = "izq";
    else if (j.cx > ANCHO_SALA) dir = "der";
    else if (j.cy < 0) dir = "arr";
    else if (j.y > ALTO_SALA) dir = "aba";
    if (dir === null) return;
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
    this.tiempo += dt;
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
      if (!c.muerto && !this.jugador.invulnerable && solapan(c, this.jugador) && c.danioContacto() > 0) {
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
      } else if (p.op.ataqueEnemigo !== undefined && solapan(p, this.jugador) && !this.jugador.invulnerable) {
        this.golpearJugador(p.op.ataqueEnemigo, p.x, 150);
        p.impacto(this);
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
    this.avisarBarreras();
    this.revisarSello();
    if (this.entrada.recien("interactuar")) this.interactuar();
    this.ambiente();
    this.fx.actualizar(dt);
    if (!this.terminado) this.revisarSalida();
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
        else this.mensaje(r.valor, colorPremio(b.premio));
      } else if (!b.avisado) {
        b.avisado = true;
        this.mensaje(b.premio.tipo === "carta" ? "Mazo lleno: libera espacio (I)" : "Mochila llena: desguaza o usa algo (I)", "#ff9a4d");
      }
    }
    this.botines = this.botines.filter((b) => b.t > -1);
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
      if (b.particula === "brasas") this.fx.ambiente(x, ALTO_SALA, "#ff8a3d", -20 - Math.random() * 20, true);
      else if (b.particula === "esporas") this.fx.ambiente(x, Math.random() * ALTO_SALA, "#5fffd0", -6, true);
      else this.fx.ambiente(x, Math.random() * ALTO_SALA, "#c9b8ff55", 4, false);
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
    this.audio.reproducir("muerte");
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
    for (const p of this.proyectiles) p.dibujar(g);
    this.fx.dibujarParticulas(g);
    g.restore();

    // Iluminación
    const luces: Luz[] = [{ x: j.cx, y: j.cy - camY, r: 95 }];
    for (const i of this.interactuables) if (!i.usado || i.tipo === "faro" || i.tipo === "portal") luces.push({ x: i.cx, y: i.y - camY + i.h / 2, r: 60, fuerza: 0.8 });
    for (const p of this.proyectiles) luces.push({ x: p.x, y: p.y - camY, r: 28, fuerza: 0.7 });
    for (const c of this.criaturas) if (c.esJefe) luces.push({ x: c.cx, y: c.cy - camY, r: 70, fuerza: 0.6 });
    for (const bo of this.botines) if (premioDestacado(bo.premio) > 0) luces.push({ x: bo.x, y: bo.y - camY, r: 30, fuerza: 0.6 });
    this.luz.dibujar(g, b.oscuridad, luces, "rgba(0,0,0,0)");

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


