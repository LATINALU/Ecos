// Escena de juego: une el dominio (Partida, MapaPiso, Meta) con las entidades, la física y el render.
// Implementa el Contexto que usan las entidades para interactuar con el mundo.

import { OBJ_RELICARIO } from "../contenido/objetos.ts";
import type { HabilidadEquipada } from "../dominio/partida.ts";
import { hd } from "../motor/texto-hd.ts";
import { AzarSistema, elegirUno, entero, type Azar } from "minialu";
import {
  ORIGEN_CONDUCTA, PISOS_TOTALES, SALAS_POR_PISO, bioma, cantidadAfijosElite, probElite,
  type AfijoElite, type Bioma, type ConductaBase, type ConductaEnemigo, type ConductaNueva,
} from "../contenido/biomas.ts";
import { botinCofre, botinEnemigo, botinVela, type Premio } from "../dominio/botin.ts";
import { crearEco, legadoDelPacto, premiosEco, type Eco } from "../dominio/eco.ts";
import { RegistroHabitos } from "../dominio/habitos.ts";
import { tituloDevorador, type Asesino, type Cicatriz } from "../dominio/cicatrices.ts";
import { PROB_ECO_AJENO, recompensaVenganza, type EcoCompartido, type ServicioEcos } from "../infra/ecos-compartidos.ts";
import { EspectroAliado } from "./entidades/aliado.ts";
import { HISTORIAS, type DefHistoria } from "../contenido/historias.ts";
import { crearCarta } from "../dominio/cartas.ts";
import { Cazador } from "./entidades/cazador.ts";
import { PESO_CAZADOR, bonoPeso, nivelEmboscada, planEmboscada, retrasoCazador, statsCazador, type PlanEmboscada } from "../dominio/codicia.ts";
import { tecnicaEnemiga } from "./entidades/jefes.ts";
import { alma } from "../contenido/almas.ts";
import type { Meta } from "../dominio/meta.ts";
import { aperturas, generarPiso, podarBarreras, type MapaPiso, type SalaMapa } from "../dominio/mundo/generador.ts";
import {
  ALTO_SALA, ANCHO_SALA, COLS, ENEMIGOS_SPAWN, FILAS, FILAS_PUERTA, T_CRISTAL, T_PINCHOS, T_PLATAFORMA, T_RAICES, T_ROCA, T_VACIO, TILE,
  construirSala, esSolido, indice,
} from "../dominio/mundo/sala.ts";
import { Partida, type DatosPartida, type ResumenPartida } from "../dominio/partida.ts";
import { calcularGolpe } from "../dominio/stats.ts";
import { ELEMENTOS, afinidadPiso, multiplicadorElemental } from "../contenido/elementos.ts";
import { INFO_RELIQUIA, NOMBRE_PIEZA, OPUESTA, RANURAS, type Dir, type Reliquia } from "../dominio/tipos.ts";
import type { Audio } from "../motor/audio.ts";
import type { Entrada } from "../motor/entrada.ts";
import { solapan, type Rect, type Tiles } from "../motor/fisica.ts";
import type { AtaqueJugador, Cadena, Contexto, Peligro } from "./contexto.ts";
import { DECORADO } from "../contenido/atlas.ts";
import { dibujarRecorte, sprites } from "../motor/sprites.ts";
import { GRACIA_ENTRADA, entradaPor, salidaDe } from "./transiciones.ts";
import { Efectos } from "./efectos.ts";
import { Colgante } from "./procedural.ts";
import { EfectosVivos, ejecutarResonancia } from "./efectos-vivos.ts";
import type { DefResonancia } from "../contenido/resonancias.ts";
import type { Criatura } from "./entidades/criatura.ts";
import { Enemigo } from "./entidades/enemigo.ts";
import { EcoRival, ElQueRecuerda, Guardian, MadreMicelio } from "./entidades/jefes.ts";
import { JefeConfigurable } from "./entidades/jefe-configurable.ts";
import { CARGA_COMPLETA, Jugador } from "./entidades/jugador.ts";
import { BotinSuelo, COLOR_COFRE, Interactuable, NOMBRE_COFRE, colorPremio, premioDestacado } from "./entidades/objetos.ts";
import { Proyectil } from "./entidades/proyectil.ts";
import { MedidorCombo, type AccionEstilo } from "./medidor-combo.ts";
import { pintor } from "../motor/pintor.ts";
import { CapaCicatrices } from "../motor/superficie.ts";
import { SistemaParticulas } from "../motor/particulas.ts";
import { colorEstrella } from "../dominio/relicario.ts";
import { postfx, rgbDe } from "../motor/postfx.ts";
import {
  Iluminacion, mapaNormalesSala, bordesDeSala, dibujarBarreras, dibujarRelieve, dibujarVineta, fondoBioma, prerenderSala, primerPlano, type Borde, type Luz,
} from "./render.ts";
import { Vela } from "./entidades/vela.ts";
import { AzarSemilla } from "minialu";
import { generarEquipo } from "../dominio/equipo.ts";
import { ESTILOS } from "../contenido/armas.ts";
import { biomaAbismo, cicloAbismo, hayGuardianAbismo, salasAbismo, tirarSalida, ZONAS_ABISMO } from "../dominio/abismo.ts";
import { arenaPara, arenasDelPiso, premioArena, type DefArena, type Sello } from "../dominio/desafios.ts";
import {
  afijosJuicio, escalaJuicio, INFO_AFIJO_JUICIO, nuevoNivelPiedra, premioJuicio, semanaDe, tiempoJuicio, type AfijoJuicio,
} from "../dominio/juicio.ts";
import { cartaDeJefe } from "../dominio/botin.ts";
import { valorDesguace, type ObjetoEquipo, type Rareza } from "../dominio/equipo.ts";
import { NOMBRES_RAREZA } from "../contenido/objetos.ts";

/** Lo que se anuncia al llegar a un piso del Abismo. */
export interface AvisoAbismo {
  readonly salida: boolean;
  readonly guardian: boolean;
  readonly ciclo: number;
}

/** Quién juega y dónde se comparten los Ecos (lo configura main antes de crear el Juego). */
export const configEcos: { servicio: ServicioEcos | null; nombre: string; autor: string } = { servicio: null, nombre: "el Portador", autor: "local" };

/** Al vencer a tu propio Eco: absorberlo o pactar con él (Espectro Temporal). */
export interface DecisionEco {
  readonly eco: Eco;
  readonly perfil: string;
  readonly legado: string | null;
  absorber(): void;
  pactar(): void;
}

export interface OpcionesCampana {
  readonly def: DefArena;
  readonly piso: number;
  readonly racha: number;
  /** Solo si el Portador ya tiene la Piedra del Juicio. */
  readonly juicio?: { readonly nivel: number; readonly afijos: readonly AfijoJuicio[]; readonly tiempo: number; readonly escala: number };
  empezar(juicio: boolean): void;
}

/** Mercader errante del Abismo: piezas raras a precio alto. */
export interface ArticuloErrante {
  readonly equipo: ObjetoEquipo;
  readonly precio: number;
}

export interface EventosJuego {
  mensaje(texto: string, color: string): void;
  abrirAltar(): void;
  abrirYunque(): void;
  /** Faro: descansar (una vez por piso). Ya no lleva al pueblo: para salir hay que extraer. */
  abrirFaro(op: { puedeDescansar: boolean; descansar: () => void }): void;
  /** Portal del guardián: seguir bajando (arriesgando lo que llevas) o extraer al pueblo. */
  abrirPortal(op: { final: boolean; abismo?: boolean; seguir: () => void; volver?: () => void }): void;
  /** Termina el descenso y vuelve al pueblo (el personaje conserva todo). */
  volverAlPueblo(motivo: "extraccion" | "portal"): void;
  guardarDescenso(d: DatosDescenso): void;
  borrarDescenso(): void;
  abrirMercader(): void;
  /** Campana del desafío: muestra la arena (y el Juicio si ya se tiene la piedra) y deja elegir. */
  abrirCampana(op: OpcionesCampana): void;
  /** Tu Eco cayó: ¿absorber el recuerdo o dejar que te acompañe? */
  decidirEco(op: DecisionEco): void;
  reliquia(r: Reliquia): void;
  jefe(nombre: string, titulo: string): void;
  nuevoPiso(piso: number, b: Bioma, abismo?: AvisoAbismo): void;
  muerte(resumen: ResumenPartida, eco: Eco): void;
  victoria(resumen: ResumenPartida): void;
  guardar(): void;
}

interface EstadoArena {
  def: DefArena;
  oleada: number;
  estado: EstadoSala;
  activa: boolean;
  golpes: number;
  /** Segundos que quedan (si hay contrarreloj). */
  tiempo: number;
  tiempoTotal?: number;
  /** Juicio (lategame): nivel de la piedra y afijos de la semana. */
  juicio?: { nivel: number; afijos: Set<AfijoJuicio> };
  relojVolcan: number;
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
  /** Claves de los cofres abiertos de la sala (los de plantilla y los extra). */
  cofres?: number[];
  /** Arena: -1 = completada. */
  arena?: number;
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

export type InicioJuego =
  | { readonly tipo: "descenso"; readonly partida: Partida; readonly piso: number; readonly abismo?: boolean }
  | { readonly tipo: "continuar"; readonly datos: DatosDescenso };

/** Segundos que hay que aguantar dentro de la zona de extracción. */
export const SEGUNDOS_EXTRACCION = 5;

class SalaActiva implements Tiles {
  readonly tiles: Uint8Array;
  readonly mapa: SalaMapa;
  lienzo: HTMLCanvasElement;
  luces: readonly Luz[];
  readonly nombre: string;
  private readonly bioma: Bioma;

  /** Aristas de la roca: por baldosa (relieve iluminado) y unidas en tramos (sombras). */
  bordes: Borde[] = [];
  /** Cadenas y estandartes con física. */
  colgantes: Colgante[] = [];
  /** Mapa de normales de la roca (relieve para el compositor WebGL); se genera la primera vez que se necesita. */
  private normalesCache: HTMLCanvasElement | null = null;

  get normales(): HTMLCanvasElement {
    this.normalesCache ??= mapaNormalesSala(this, this.mapa.semilla);
    return this.normalesCache;
  }
  oclusores: Borde[] = [];

  constructor(mapa: SalaMapa, tiles: Uint8Array, nombre: string, b: Bioma) {
    this.mapa = mapa;
    this.tiles = tiles;
    this.nombre = nombre;
    this.bioma = b;
    const d = prerenderSala(this, b, mapa.semilla, mapa.tipo !== "normal");
    this.lienzo = d.lienzo;
    this.luces = d.luces;
    this.colgantes = d.colgantes.map((c) => new Colgante(c));
    this.recalcularBordes();
  }

  recalcularBordes(): void {
    this.normalesCache = null;
    this.bordes = bordesDeSala(this, false);
    this.oclusores = bordesDeSala(this, true);
  }

  rehacer(): void {
    const d = prerenderSala(this, this.bioma, this.mapa.semilla, this.mapa.tipo !== "normal");
    this.lienzo = d.lienzo;
    this.luces = d.luces;
    if (this.colgantes.length !== d.colgantes.length) this.colgantes = d.colgantes.map((c) => new Colgante(c));
  }

  tile(tx: number, ty: number): number {
    return this.tiles[indice(tx, ty)];
  }

  poner(tx: number, ty: number, v: number): void {
    this.tiles[indice(tx, ty)] = v;
    this.recalcularBordes();
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
  /** Zona de extracción de la sala actual (si tiene) y segundos acumulados dentro. */
  zonaExtraccion: Rect | null = null;
  cargaExtraccion = 0;

  constructor(meta: Meta, audio: Audio, entrada: Entrada, eventos: EventosJuego, inicio: InicioJuego) {
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
      podarBarreras(this.mapa, meta.listaReliquias());
      this.estados = new Map(d.estados.map(([id, e]) => [id, { ...e, muertos: new Set(e.muertos), velasRotas: new Set(e.velasRotas ?? []) }]));
      this.cargarSala(d.sala, null);
      this.jugador.colocar(d.x, d.y);
      if (this.partida.pactoEco !== null) this.aliado = new EspectroAliado(this.partida.pactoEco, d.x, d.y - 20);
      this.audio.ambientar(this.indiceAmbiente);
      this.eventos.nuevoPiso(this.partida.piso, this.bioma, this.avisoAbismo());
      return;
    }
    meta.registro.partidas++;
    this.partida = inicio.partida;
    this.partida.prepararDescenso(inicio.piso, inicio.abismo ?? false);
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

  /** Solo para desarrollo: una "batalla" instantánea para ver las cicatrices (sangre, cráter, flecha clavada). */
  depurarBatalla(): void {
    for (const c of this.criaturas) if (c instanceof Enemigo) c.aplicarDanio(c.hp, this);
    const j = this.jugador;
    this.crater(j.cx + 30, j.y + j.h + 3, 9, "#ff9a3d");
    this.clavar(2 * TILE - 1, j.y + 4, Math.PI, "#d8e2ef");
    this.clavar(2 * TILE - 1, j.y - 6, Math.PI + 0.2, "#d8e2ef");
    for (let k = 0; k < 6; k++) this.particulas.sangre(j.cx + 40 + k * 25, j.y, "rgb(110, 10, 24)", 25);
  }

  /** Solo para desarrollo: el Cazador de Portadores aparece ya. */
  depurarCazador(): void {
    this.aparecerCazador(undefined, "Un Cazador de Portadores baja por ti. No se detiene.");
  }

  /** Solo para desarrollo: ir a la sala de la cicatriz del piso. */
  depurarCicatriz(): void {
    if (this.cicatriz === null) return;
    this.cargarSala(this.cicatriz.sala, null);
    this.jugador.colocar(4 * TILE, 14 * TILE - this.jugador.h);
  }

  /** Solo para desarrollo: el diálogo de "tu Eco se arrodilla". */
  depurarDecisionEco(): void {
    const eco = crearEco({
      piso: this.partida.piso, forma: this.partida.forma, nivel: this.partida.nivel(), stats: this.partida.stats(),
      equipo: RANURAS.map((r) => this.partida.equipo[r]), causa: "Cráneo Saltarín", numero: 3,
      habitos: { distancia: 0.8, aereo: 0.5, patada: 0.1, tecnica: 0.6, esquiva: 0.4, agresividad: 0.3, estilo: "arco" }, portador: configEcos.nombre,
    }, this.partida.azar, Date.now());
    this.eventos.decidirEco({ eco, perfil: "acecha desde lejos, ataca desde el aire, esquiva al último instante", legado: eco.legado?.nombre ?? null, absorber: () => undefined, pactar: () => undefined });
  }

  /** Solo para desarrollo: una fila de monstruos y una patada al primero (boliche y muro). */
  depurarPatada(): void {
    this.criaturas = this.criaturas.filter((c) => !(c instanceof Enemigo));
    const suelo = 14 * TILE;
    this.jugador.colocar(5 * TILE, suelo - this.jugador.h);
    const fila = [8, 10, 12, 14].map((tx) => {
      const e = this.crearEnemigo("caminante", tx * TILE, suelo);
      this.criaturas.push(e);
      return e;
    });
    this.lanzar(fila[0], 1, 30, 0);
  }

  /** Solo para desarrollo (capturas): toca la campana de la arena; con `iniciar`, empieza ya (normal o Juicio). */
  depurarCampana(iniciar?: "normal" | "juicio"): void {
    const obj = this.interactuables.find((i) => i.tipo === "campana");
    if (obj === undefined) return;
    if (iniciar === undefined) {
      this.tocarCampana(obj);
      return;
    }
    obj.usado = true;
    const piedra = Math.max(2, this.partida.piedraJuicio);
    this.empezarArena(iniciar === "juicio" ? { nivel: piedra, afijos: new Set(afijosJuicio(piedra, semanaDe(new Date()))) } : undefined);
  }

  /** Solo para desarrollo (capturas): un abanico de botín de todas las rarezas alrededor del Portador. */
  depurarBotin(): void {
    const az = this.partida.azar;
    const premios: Premio[] = [
      { tipo: "esquirlas", cantidad: 80 },
      { tipo: "objeto", objeto: 1, cantidad: 1 },
      { tipo: "carta", carta: crearCarta(az, 0, 6) },
      ...([0, 1, 2, 3, 4, 5] as const).map((r): Premio => ({ tipo: "equipo", equipo: { ...generarEquipo(az, this.partida.piso, r, ["arma"]), rareza: r } })),
    ];
    premios.forEach((p, i) => {
      const b = new BotinSuelo(p, this.jugador.cx - 150 + i * 34, this.jugador.y);
      b.vx = 0;
      b.t = 1;
      this.botines.push(b);
    });
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

  /** El descenso es en el Abismo (pozo sin fin). */
  get abismo(): boolean {
    return this.partida.abismo;
  }

  private get indiceAmbiente(): number {
    return this.abismo ? (this.partida.piso - 1) % ZONAS_ABISMO : this.partida.piso - 1;
  }

  private avisoAbismo(): AvisoAbismo | undefined {
    if (!this.abismo) return undefined;
    const p = this.partida.piso;
    return { salida: (this.mapa.extracciones ?? []).length > 0, guardian: hayGuardianAbismo(p), ciclo: cicloAbismo(p) };
  }

  get bioma(): Bioma {
    if (this.abismo) return biomaAbismo(this.partida.piso);
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
    const esquiva = this.partida.combate().esquiva;
    if (esquiva > 0 && this.azarCombate.siguiente() < esquiva) {
      j.invuln = 0.35;
      this.fx.texto(j.cx, j.y - 4, "Esquiva", "#b48cff");
      this.fx.chispas(j.cx, j.cy, "#7d6bff", 10, { velocidad: 60, gravedad: 0 });
      return;
    }
    const s = this.partida.stats();
    const golpe = calcularGolpe(this.azarCombate, ataque, 1, s.defensa, 0);
    const danio = Math.max(1, Math.round(golpe.danio * this.partida.multiplicadorRecibido() * (1 - j.buffEscudo)));
    this.partida.ganarCarga(3);
    const r = this.partida.recibirDanio(danio);
    const fraccion = danio / Math.max(1, this.partida.stats().hp);
    postfx.trauma(Math.min(0.7, fraccion * 2.6), fraccion > 0.15 ? 0.25 : 0);
    this.particulas.sangre(j.cx, j.cy, "#7a0a18", Math.min(16, 4 + Math.round(fraccion * 40)));
    if (this.arena?.activa === true) this.arena.golpes++;
    const agresor = this.criaturas.find((c): c is Enemigo => c instanceof Enemigo && !c.muerto && Math.abs(c.cx - desdeX) < 40);
    if (agresor !== undefined) {
      this.ultimoAgresor = { a: { nombre: agresor.nombre, conducta: agresor.conducta, elite: agresor.categoria === "elite", afijos: [...agresor.afijos] }, t: this.tiempo };
    }
    if (this.cargaExtraccion > 0 && this.emboscada !== null) {
      this.cargaExtraccion = Math.max(0.01, this.cargaExtraccion - 0.6);
      this.fx.texto(j.cx, j.y - 14, "−0,6 s", "#ff6a6a");
    }
    if (this.combo.golpes >= 5) this.fx.texto(j.cx, j.y - 14, "Combo roto", "#8a84a0");
    this.combo.recibirDanio();
    // Espinas: devuelve parte del daño al enemigo más cercano al golpe.
    const espinas = this.partida.efectoAlma("espinas");
    if (espinas > 0) {
      const atacante = this.criaturas
        .filter((c) => !c.muerto && !("esObjeto" in c) && Math.abs(c.cx - desdeX) < 48)
        .sort((x, y) => Math.abs(x.cx - desdeX) - Math.abs(y.cx - desdeX))[0];
      if (atacante !== undefined) {
        const reflejo = Math.max(1, Math.round(danio * espinas));
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
    // Pasivas de ataque de la familia del arma (solo golpes básicos).
    const pa = a.arma !== undefined && a.tipo === "golpe" ? ESTILOS[a.arma] : undefined;
    const rompe = pa?.rompeGuardia === true && c instanceof Enemigo && c.conGuardia;
    if (!rompe && c.bloquea(dirX, a.tipo)) {
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
    const critBasico = a.tipo === "golpe" ? this.partida.efectoAlma("golpeCritico") : 0;
    const buff = 1 + this.jugador.buffDanio;
    const lejos = pa?.bonoDistancia !== undefined
      ? 1 + pa.bonoDistancia * Math.max(0, Math.min(1, (Math.abs(c.cx - this.jugador.cx) - 48) / 150))
      : 1;
    const g = calcularGolpe(this.azarCombate, a.potencia * this.partida.multiplicadorDanio() * ejecutor * this.combo.multiplicadorDanio * buff * lejos, 1,
      c.defensa * (1 - (pa?.ignoraDefensa ?? 0)),
      garantizado ? 100 : s.critico + critBasico + (pa?.critBasico ?? 0), 1.75 + mods.critDanio + (pa?.critDanio ?? 0));
    if (lejos >= 1.3) this.fx.texto(c.cx, c.y - 14, "¡Certero!", "#ffe9a8");
    if (g.critico) {
      this.particulas.chispas(c.cx, c.cy, dirX, "#ffd27a", 18);
      this.fx.estallar(c.cx, c.cy, {
        colores: ["#ffe9a8", "#ffffff", "#ffd27a"], n: 7, velocidad: 170, tam: [1, 2], vida: 0.7, brillan: true,
        chispa: "#ffd27a", angulo: dirX > 0 ? -0.5 : Math.PI + 0.5, apertura: 1.6, luz: { color: "#ffe9a8", r: 40, dur: 0.18 },
      });
    }
    if (pa?.roboUltimo !== undefined && a.final === true) this.partida.curar(Math.max(1, Math.round(g.danio * pa.roboUltimo)));
    c.aplicarDanio(g.danio, this);
    c.empujar(dirX, a.empuje * (g.critico ? 1.4 : 1));
    if ((a.rompeGuardia === true || pa?.rompeGuardia === true) && c instanceof Enemigo && c.conGuardia) {
      c.romperGuardia();
      postfx.onda(c.cx, c.cy, 2.6);
      this.audio.reproducir("romperEscudo");
      postfx.trauma(0.25, 0.2);
      this.particulas.chispas(c.cx, c.cy, dirX, "#e8e8f0", 30);
      this.fx.texto(c.cx, c.y - 10, "¡Guardia rota!", "#ffe27a");
      this.fx.estallar(c.cx - c.dir * 6, c.cy, {
        colores: ["#c8c8d8", "#8a8a9a", "#5a5a6a", "#e8e8f0"], n: 40, velocidad: 190, tam: [1, 4], vida: 2,
        chispa: "#ffe27a", angulo: dirX > 0 ? -0.6 : Math.PI + 0.6, apertura: 2.2, luz: { color: "#ffe9a8", r: 70, dur: 0.5 },
      });
      this.fx.sacudir(5);
    }
    if (a.quema === true) c.quemar(a.potencia * 0.15);
    this.aplicarElemento(c, g.danio, a);
    if (a.ralentiza === true) c.lento = 2.5;
    if (a.curaPct !== undefined) this.partida.curar(Math.max(1, Math.round(s.hp * a.curaPct)));
    if (a.eter !== undefined) this.partida.recuperarEter(a.eter + mods.eterGolpe + this.combo.bonoEter);
    if (g.critico && this.partida.tiene("ojo")) this.partida.recuperarEter(4);
    // Críticos que aturden (Runa de Escarcha, conjunto Escarcha Eterna) y golpes que ralentizan (conjunto).
    const aturdeCrit = Math.max(Math.min(2, 0.8 * this.partida.potenciaRuna("escarcha")), this.partida.bonoConjuntoActivo("aturdeCrit"));
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
    this.pasivasDeGolpe(c, g.danio, a, dirX);
    // Carga de la Definitiva: golpes básicos cargan más que las habilidades; la Definitiva no se carga a sí misma.
    if (a.definitiva !== true && this.partida.ganarCarga(a.tipo === "tecnica" ? 0.8 : 1.6)) {
      this.fx.texto(this.jugador.cx, this.jugador.y - 20, "¡DEFINITIVA LISTA! (P)", "#ffd27a", true);
      this.audio.reproducir("unico");
    }
    const robo = mods.robo + this.jugador.buffRobo;
    if (robo > 0) this.partida.curar(Math.max(1, Math.round(g.danio * robo)));
    this.fx.texto(c.cx, c.y - 2, `${g.danio}`, g.critico ? "#ffe27a" : "#ffffff", g.critico);
    this.fx.chispas(c.cx, c.cy, g.critico ? "#ffe27a" : "#ffffff", g.critico ? 14 : 7, {
      velocidad: 130, angulo: dirX > 0 ? 0 : Math.PI, apertura: 1.6, vida: 0.35,
    });
    this.audio.reproducir(g.critico ? "critico" : "impacto");
    if (a.arma === "pesada" || this.jugador.accionTipo === "cargado") this.audio.reproducir("golpePesado");
    // HITSTOP: el mundo se congela unos cuadros (más en críticos, remates, el mazo y los cargados) y el enemigo
    // tiembla en el sitio; el empujón se aplica al soltar, así sale despedido con peso.
    const cargado = this.jugador.accionTipo === "cargado";
    const pesado = a.arma === "pesada" || cargado;
    const pausa = Math.min(0.11, (g.critico ? 0.075 : a.final === true ? 0.06 : a.tipo === "patada" ? 0.055 : 0.035) + (pesado ? 0.03 : 0));
    this.fx.congelar(pausa);
    c.vibrar = Math.max(c.vibrar, pausa + 0.04);
    this.fx.sacudir(g.critico || cargado ? 3.5 : pesado ? 2.2 : 1.2);
    this.habitos.golpe(Math.abs(c.cx - this.jugador.cx), !this.jugador.enSuelo, a.tipo, a.arma ?? this.partida.estilo().id);
    // Patadas: el enemigo sale volando y el escenario juega (muro, boliche, púas).
    if (a.tipo === "patada" && a.empuje >= 180 && c instanceof Enemigo && !c.pesado && !c.esJefe && !c.muerto) this.lanzar(c, dirX, g.danio, 0);
    return true;
  }

  /**
   * Pasivas del mazo de almas que actúan en cada golpe: las de ataques básicos (ranura Forma) solo con golpes
   * del arma; los elementos de las habilidades, en cualquier golpe que los lleve.
   */
  private pasivasDeGolpe(c: Criatura, danio: number, a: AtaqueJugador, dirX: number): void {
    for (const el of a.elementos ?? []) {
      if (el === "veneno") c.envenenar(danio * 0.1);
      else if (c.enfriar()) this.fx.texto(c.cx, c.y - 16, c.pesado ? "Entumecido" : "¡Congelado!", "#bff3ff");
    }
    if (a.tipo !== "golpe" || a.eco === true || c.muerto) return;
    const e = this.partida.efectosAlma();
    const tira = (k: "golpeQuema" | "golpeHielo" | "golpeVeneno" | "golpeRayo" | "golpeAturde" | "golpeExtra"): boolean =>
      (e[k] ?? 0) > 0 && this.azarCombate.siguiente() < (e[k] ?? 0);
    if (tira("golpeQuema")) c.quemar(danio * 0.15);
    if (tira("golpeHielo") && c.enfriar()) this.fx.texto(c.cx, c.y - 16, c.pesado ? "Entumecido" : "¡Congelado!", "#bff3ff");
    if (tira("golpeVeneno")) c.envenenar(danio * 0.08);
    if (tira("golpeAturde") && !c.pesado) c.aturdido = Math.max(c.aturdido, 0.6);
    if (tira("golpeRayo")) this.encadenarRayo(c, Math.round(danio * 0.5));
    if ((e.golpeCura ?? 0) > 0) this.partida.curar(Math.max(1, Math.round(this.partida.stats().hp * (e.golpeCura ?? 0))));
    if (tira("golpeExtra")) {
      this.fx.texto(c.cx, c.y - 12, "¡Doble!", "#ffe27a");
      this.golpearCriatura(c, { ...a, potencia: a.potencia * 0.5, eco: true, cuerpoACuerpo: false }, dirX);
    }
  }

  /** Daño y efecto del elemento del arma: Fuego quema, Hielo congela, Veneno se acumula, Rayo salta. */
  private aplicarElemento(c: Criatura, danio: number, a: AtaqueJugador): void {
    const el = this.partida.elementoArma();
    if (el === null || c.muerto && el.elemento !== "rayo") return;
    const [resiste, debil] = afinidadPiso(this.partida.piso);
    const mult = multiplicadorElemental(el.elemento, resiste, debil);
    const def = ELEMENTOS[el.elemento];
    // Las técnicas aplican el elemento a medias.
    const extra = Math.max(1, Math.round(danio * el.potencia * mult * (a.tipo === "tecnica" ? 0.5 : 1)));
    c.aplicarDanio(extra, this);
    this.fx.texto(c.cx + 6, c.y - 10, `${extra}`, def.color);
    if (mult > 1 && this.azarCombate.siguiente() < 0.15) this.fx.texto(c.cx, c.y - 18, "¡Débil!", def.brillo);
    this.fx.chispas(c.cx, c.cy, def.color, 6, { velocidad: 80, brillo: true, gravedad: el.elemento === "fuego" ? -90 : 40 });
    switch (el.elemento) {
      case "fuego":
        c.quemar(danio * 0.12 * mult);
        break;
      case "hielo":
        if (c.enfriar()) {
          this.fx.texto(c.cx, c.y - 16, c.pesado ? "Entumecido" : "¡Congelado!", def.color);
          this.fx.chispas(c.cx, c.cy, "#ffffff", 16, { velocidad: 110, brillo: true });
          this.audio.reproducir("romper");
        }
        break;
      case "veneno":
        c.envenenar(danio * 0.08 * mult);
        break;
      case "rayo":
        if (this.azarCombate.siguiente() < 0.3) this.encadenarRayo(c, Math.round(danio * 0.5 * mult));
        break;
    }
  }

  /** Rayo: salta a los 2 enemigos más cercanos (radio 80) y los aturde un instante. */
  private encadenarRayo(origen: Criatura, danio: number): void {
    const cerca = this.criaturas
      .filter((o) => o !== origen && !o.muerto && !(o instanceof Vela) && Math.hypot(o.cx - origen.cx, o.cy - origen.cy) < 80)
      .sort((p, q) => Math.hypot(p.cx - origen.cx, p.cy - origen.cy) - Math.hypot(q.cx - origen.cx, q.cy - origen.cy))
      .slice(0, 2);
    let desde = origen;
    for (const o of cerca) {
      for (let k = 1; k < 6; k++) {
        const f = k / 6;
        this.fx.chispas(desde.cx + (o.cx - desde.cx) * f, desde.cy + (o.cy - desde.cy) * f, ELEMENTOS.rayo.color, 1, { velocidad: 20, vida: 0.18, gravedad: 0, brillo: true });
      }
      o.aplicarDanio(Math.max(1, danio), this);
      this.fx.texto(o.cx, o.y - 4, `${Math.max(1, danio)}`, ELEMENTOS.rayo.color);
      if (!o.pesado) o.aturdido = Math.max(o.aturdido, 0.5);
      desde = o;
    }
  }

  /** Marcas de estado elemental sobre la criatura (hielo, veneno). */
  private dibujarEstado(g: CanvasRenderingContext2D, c: Criatura): void {
    if (c.muerto) return;
    if (c.congelado > 0) {
      g.save();
      g.globalAlpha = 0.45;
      g.fillStyle = ELEMENTOS.hielo.color;
      g.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, c.w + 2, c.h + 2);
      g.globalAlpha = 0.9;
      g.strokeStyle = "#ffffff";
      g.strokeRect(Math.round(c.x) - 0.5, Math.round(c.y) - 0.5, c.w + 1, c.h + 1);
      g.restore();
    }
    const marcas: string[] = [];
    for (let i = 0; i < c.frio; i++) marcas.push(ELEMENTOS.hielo.color);
    for (let i = 0; i < c.veneno; i++) marcas.push(ELEMENTOS.veneno.color);
    if (c.quemadura > 0) marcas.push(ELEMENTOS.fuego.color);
    const x0 = Math.round(c.cx - marcas.length * 2);
    marcas.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(x0 + i * 4, Math.round(c.y) - 6, 3, 3);
    });
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
        this.fx.estallar(tx * TILE + 8, ty * TILE + 8, tipo === T_CRISTAL
          ? { colores: ["#7fe3ff", "#bff3ff", "#3d8bff", "#ffffff"], n: 22, velocidad: 170, tam: [1, 4], brillan: true, chispa: "#bff3ff", vida: 2.2, luz: { color: "#7fe3ff", r: 80, dur: 0.6 } }
          : { colores: ["#5a3a1a", "#3a2410", "#7a5a2a", "#ff7a3d"], n: 20, velocidad: 140, tam: [1, 4], chispa: "#ff9a3d", vida: 2.4, luz: { color: "#ff7a3d", r: 80, dur: 0.7 } });
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
    if (this.abismo) {
      // Abismo: mapa grande, sin reliquias; la salida (si hay) se esconde lejos.
      const salida = tirarSalida(this.partida.azar, piso, this.partida.pisosSinSalida);
      this.partida.pisosSinSalida = salida ? 0 : this.partida.pisosSinSalida + 1;
      this.mapa = generarPiso(this.partida.azar, {
        piso,
        cantidadSalas: salasAbismo(piso),
        ancho: 9,
        alto: 6,
        reliquiasPoseidas: this.meta.listaReliquias(),
        hayEco: this.prepararEcos(piso),
        salidas: salida ? 1 : 0,
        // De aquí no se sube: el Abismo conserva altar y mercader.
        servicios: true,
        // El mercader del Abismo es ERRANTE: solo aparece en algunos pisos, con rarezas a precio alto.
        mercader: this.partida.azar.siguiente() < 0.35,
        arenas: arenasDelPiso(piso, true),
      });
    } else {
      this.mapa = generarPiso(this.partida.azar, {
        piso,
        cantidadSalas: SALAS_POR_PISO[piso - 1] ?? 12,
        // El Pozo Profundo (piso 11+) tiene mapas más grandes.
        ancho: piso > 10 ? 9 : 7,
        alto: piso > 10 ? 6 : 5,
        reliquiasPoseidas: this.meta.listaReliquias(),
        reliquiaAColocar: this.meta.reliquiaParaPiso(piso),
        hayEco: this.prepararEcos(piso),
        // El Pozo no tiene tiendas ni altares (para eso se sube al pueblo): su lugar lo ocupan los desafíos.
        servicios: false,
        arenas: arenasDelPiso(piso, false),
      });
    }
    this.estados = new Map();
    this.cicatricesSala.clear();
    this.prepararCicatriz(piso);
    this.prepararHistoria(piso);
    this.prepararCazador();
    this.avisosBarrera.clear();
    this.avisosPozo.clear();
    this.cargarSala(this.mapa.inicio, null);
    const inicio = this.interactuables.find((i) => i.tipo === "faro");
    this.jugador.colocar((inicio?.x ?? 200) + 30, 14 * TILE - this.jugador.h);
    this.jugador.vx = 0;
    this.jugador.vy = 0;
    this.audio.ambientar(this.indiceAmbiente);
    this.eventos.nuevoPiso(piso, this.bioma, this.avisoAbismo());
    this.stockErrante = null;
    if (this.abismo && this.mapa.salas.some((x) => x.tipo === "mercader")) {
      this.mensaje("Se oye la campanilla de un mercader errante en algún lugar de este piso…", "#ffb23d");
    }
    this.guardarProgreso();
  }

  // ---------------- Mercader errante (Abismo) ----------------

  private stockErrante: ArticuloErrante[] | null = null;

  /** Rarezas del mercader errante de este piso (Épicas o mejores). Se generan al primer vistazo. */
  errante(): { lista: readonly ArticuloErrante[]; comprar: (i: number) => boolean } | undefined {
    if (!this.abismo) return undefined;
    if (this.stockErrante === null) {
      const azar = new AzarSemilla(this.partida.semilla ^ (this.partida.piso * 104729));
      this.stockErrante = [0, 1, 2].map(() => {
        const equipo = generarEquipo(azar, this.partida.piso, azar.siguiente() < 0.25 ? 4 : 3);
        return { equipo, precio: valorDesguace(equipo) * 8 + this.partida.piso * 40 };
      });
    }
    const lista = this.stockErrante;
    return {
      lista,
      comprar: (i) => {
        const art = lista[i];
        if (art === undefined || !this.partida.comprarEquipo(art.equipo, art.precio).ok) return false;
        lista.splice(i, 1);
        return true;
      },
    };
  }

  estadoDe(id: number): EstadoSala {
    let e = this.estados.get(id);
    if (e === undefined) {
      e = { visitada: false, muertos: new Set(), cofreAbierto: false, jefeVencido: false, reliquiaTomada: false, faroUsado: false, velasRotas: new Set(), botin: [], cofres: [] };
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
    // El Cazador te sigue: si estaba vivo en la sala que dejas, entra por la puerta unos segundos después.
    const cz = this.criaturas.find((c): c is Cazador => c instanceof Cazador && !c.muerto);
    if (cz !== undefined) {
      this.cazador.hp = cz.hp;
      this.cazador.reentrada = 3;
    }
    if (this.emboscada !== null) {
      this.emboscada = null;
      this.audio.tension(false);
    }
    this.enZonaExtraccion = false;
    this.guardarEstadoSala();
    const sm = this.mapa.salas[id];
    const estado = this.estadoDe(id);
    const primeraVez = !estado.visitada;
    estado.visitada = true;
    const ap = aperturas(this.mapa, id);
    const densidad = 0.55 + this.partida.piso * 0.12;
    const datos = construirSala(sm.tipo, sm.semilla, ap, this.partida.azar, densidad, { dobleSalto: this.jugador.reliquias.has("dobleSalto") });
    this.sala = new SalaActiva(sm, datos.tiles, datos.nombre, this.bioma);
    this.criaturas = [];
    this.proyectiles = [];
    this.peligros = [];
    this.interactuables = [];
    this.puertasSelladas = false;
    this.sellarPendiente = false;
    this.fx.limpiar();
    this.vivos.limpiar();
    this.particulas.limpiar();
    this.devorador = null;
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
        const e = this.crearEnemigo(sp.tipo as ConductaBase, x, y);
        if (sp.tipo === "volador") e.y = sp.ty * TILE;
        e.idSpawn = i;
        this.criaturas.push(e);
        return;
      }
      switch (sp.tipo) {
        case "cofre": {
          this.ponerCofre(x, y, i, sm.tipo === "tesoro" ? Math.max(2, this.tirarNivelCofre()) : this.tirarNivelCofre(), estado);
          break;
        }
        case "altar":
          this.interactuables.push(new Interactuable("altar", x, y));
          break;
        case "faro": {
          this.interactuables.push(new Interactuable("faro", x, y));
          break;
        }
        case "yunque":
          // En el Pozo se forja en el pueblo; el yunque del faro solo queda en el Abismo.
          if (this.abismo) this.interactuables.push(new Interactuable("yunque", x, y));
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
          // Abismo: la grieta solo está custodiada cada pocos pisos.
          if (estado.jefeVencido || (this.abismo && !hayGuardianAbismo(this.partida.piso))) {
            this.interactuables.push(new Interactuable("portal", x, piso));
          } else {
            this.invocarJefe(x, piso);
          }
          break;
        case "eco": {
          const propio = this.meta.ecoDelPiso(this.partida.piso);
          const eco = propio ?? this.ecoAjeno?.eco;
          if (eco !== undefined && !estado.jefeVencido) {
            const ajeno = propio === undefined;
            const rival = new EcoRival(eco, x, piso, ajeno);
            rival.idSpawn = i;
            this.criaturas.push(rival);
            this.sellarPuertas(true);
            this.eventos.jefe(ajeno ? `Eco de ${this.ecoAjeno?.portador ?? "otro Portador"}` : eco.nombre,
              ajeno ? `Otro Portador cayó aquí · ${rival.perfil}` : `Tu Eco aprendió de ti: ${rival.perfil}`);
            this.audio.reproducir("jefe");
          }
          break;
        }
        default:
          break;
      }
    });

    this.zonaExtraccion = (this.mapa.extracciones ?? []).includes(id) ? this.ubicarExtraccion() : null;
    if (this.ecoHistoria !== null && this.ecoHistoria.sala === id) this.despertarEcoHistoria(estado);
    if (this.cicatriz !== null && this.cicatriz.sala === id) {
      this.despertarDevorador(estado);
      if (primeraVez) this.mensaje("Reconoces este lugar. Aquí caíste.", "#ff4d6d");
    }
    this.cargaExtraccion = 0;
    if (this.abismo && this.zonaExtraccion !== null && primeraVez) {
      this.mensaje("¡Una SALIDA! Aguanta 5 s en la luz verde para volver al pueblo", "#7dffb0");
      this.audio.reproducir("reliquia");
    }
    this.poblarSala(sm, estado, densidad);

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
  // ---------------- Población de las salas: enemigos, élites, cofres, arenas y bóvedas ----------------

  /** Crea un monstruo: al bajar, parte de las conductas originales pasan a las nuevas; las élites traen afijos. */
  private crearEnemigo(base: ConductaBase, x: number, y: number, forzarElite = false, minAfijos = 0): Enemigo {
    const piso = this.partida.piso;
    const azar = this.partida.azar;
    let conducta: ConductaEnemigo = base;
    for (const [nueva, o] of Object.entries(ORIGEN_CONDUCTA) as [ConductaNueva, (typeof ORIGEN_CONDUCTA)[ConductaNueva]][]) {
      if (o.de === base && piso >= o.desde && azar.siguiente() < o.prob + (piso - o.desde) * 0.01) conducta = nueva;
    }
    const elite = forzarElite || azar.siguiente() < probElite(piso);
    const afijos: AfijoElite[] = [];
    if (elite) {
      const pool: AfijoElite[] = ["veloz", "blindado", "vampiro", "regenerador", "explosivo", "furioso"];
      for (let k = 0; k < Math.max(minAfijos, cantidadAfijosElite(piso)) && pool.length > 0; k++) afijos.push(pool.splice(entero(azar, pool.length), 1)[0]);
    }
    const e = new Enemigo(conducta, piso, this.bioma, x - 7, y, elite, afijos);
    e.x = x - e.w / 2;
    return e;
  }

  /** Lugares de suelo firme (centro de baldosa, x en píxeles; y = pies) lejos de las puertas. */
  private posicionesSuelo(): { x: number; y: number }[] {
    const t = this.sala.tiles;
    const en = (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx >= COLS || ty >= FILAS ? T_ROCA : t[indice(tx, ty)]);
    const libre = (tx: number, ty: number): boolean => !esSolido(en(tx, ty)) && en(tx, ty) !== T_PINCHOS;
    const lugares: { x: number; y: number }[] = [];
    for (let ty = 3; ty < FILAS - 2; ty++) {
      for (let tx = 5; tx < COLS - 5; tx++) {
        const suelo = en(tx, ty + 1);
        if ((suelo === T_ROCA || suelo === 2) && libre(tx, ty) && libre(tx, ty - 1)) lugares.push({ x: tx * TILE + TILE / 2, y: (ty + 1) * TILE });
      }
    }
    return lugares;
  }

  /** Rareza del cofre: madera, plata, oro o mítico (mejor cuanto más hondo). */
  private tirarNivelCofre(): number {
    const piso = this.partida.piso;
    const r = this.partida.azar.siguiente();
    // Mano del Avaro: no hay cofres de madera.
    const minimo = this.meta.tieneReliquia("manoAvaro") ? 1 : 0;
    if (r < 0.01 + piso * 0.004) return 3;
    if (r < 0.09 + piso * 0.016) return 2;
    if (r < 0.35 + piso * 0.02) return 1;
    return minimo;
  }

  private ponerCofre(x: number, y: number, clave: number, nivel: number, estado: EstadoSala): void {
    const c = new Interactuable("cofre", x, y);
    c.nivel = Math.max(0, Math.min(3, nivel));
    c.clave = clave;
    c.usado = (estado.cofres ?? []).includes(clave) || (clave < 1000 && estado.cofreAbierto && (estado.cofres ?? []).length === 0);
    this.interactuables.push(c);
  }

  /** Más enemigos cuanto más hondo, cofres extra, Arenas (oleadas) y Bóvedas (cofre custodiado). */
  private poblarSala(sm: SalaMapa, estado: EstadoSala, densidad: number): void {
    if (sm.tipo === "inicio" || sm.tipo === "jefe" || sm.tipo === "mercader" || sm.tipo === "altar") return;
    // El azar de la sala es determinista (misma sala, mismo contenido al volver).
    const azar = new AzarSemilla(sm.semilla + this.partida.piso * 7919);
    const lugares = this.posicionesSuelo();
    const elegir = (): { x: number; y: number } | undefined => lugares.length === 0 ? undefined : lugares.splice(entero(azar, lugares.length), 1)[0];
    const bases: readonly ConductaBase[] = ["caminante", "saltador", "volador", "torreta", "escudero"];
    // Densidad > 1: monstruos extra (no vuelven a aparecer si se mataron: usan claves 500+).
    if (sm.tipo === "normal" || sm.tipo === "tesoro" || sm.tipo === "reliquia") {
      const extra = Math.min(5, Math.floor(Math.max(0, densidad - 0.9) * 2.5));
      for (let k = 0; k < extra; k++) {
        const clave = 500 + k;
        const l = elegir();
        if (l === undefined || estado.muertos.has(clave)) continue;
        const tipo = bases[entero(azar, bases.length)];
        const e = this.crearEnemigo(tipo, l.x, l.y);
        if (tipo === "volador") e.y = l.y - 3 * TILE;
        e.idSpawn = clave;
        this.criaturas.push(e);
      }
      // Cofre extra (madera o plata casi siempre).
      if (azar.siguiente() < 0.14 + this.partida.piso * 0.006) {
        const l = elegir();
        if (l !== undefined) this.ponerCofre(l.x, l.y, 1000, Math.min(this.tirarNivelCofre(), 1 + (azar.siguiente() < 0.15 ? 1 : 0)), estado);
      }
    }
    if (sm.tipo === "boveda") {
      // Cofre de oro o mítico en el centro, custodiado por dos élites (tres en lo profundo).
      const centro = this.ubicarExtraccion();
      this.ponerCofre(centro.x + centro.w / 2, centro.y + centro.h, 2000, this.partida.piso >= 8 ? 3 : 2, estado);
      const guardias = this.partida.piso >= 14 ? 3 : 2;
      for (let k = 0; k < guardias; k++) {
        const clave = 600 + k;
        const l = elegir();
        if (l === undefined || estado.muertos.has(clave)) continue;
        const e = this.crearEnemigo(k % 2 === 0 ? "escudero" : "caminante", l.x, l.y, true);
        e.idSpawn = clave;
        this.criaturas.push(e);
      }
      if (!(estado.cofres ?? []).includes(2000)) this.mensaje("Una bóveda: sus guardianes no la entregarán sin pelear", "#ffe9a8");
    }
    if (sm.tipo === "arena" && estado.arena !== -1) {
      // Desafío opcional: nada empieza hasta tocar la campana.
      const def = arenaPara(sm.semilla, this.partida.piso);
      this.arena = { def, oleada: 0, estado, activa: false, golpes: 0, tiempo: 0, relojVolcan: 3 };
      const centro = this.ubicarExtraccion();
      const campana = new Interactuable("campana", centro.x + centro.w / 2, centro.y + centro.h);
      campana.color = def.color;
      this.interactuables.push(campana);
      this.mensaje(`${def.nombre} · premio: ${NOMBRE_PIEZA[def.destino].toLowerCase()}. Toca la campana para empezar.`, def.color);
    } else {
      this.arena = null;
    }
  }

  /** Arena: sella las puertas y lanza oleadas; al limpiar la última, abre y deja un cofre. */
  private arena: EstadoArena | null = null;

  /** La campana: muestra la arena y, en el lategame, ofrece el Juicio. */
  private tocarCampana(obj: Interactuable): void {
    const a = this.arena;
    if (a === null || a.activa) return;
    const p = this.partida;
    const piedra = p.piedraJuicio;
    const afijos = afijosJuicio(piedra, semanaDe(new Date()));
    this.eventos.abrirCampana({
      def: a.def,
      piso: p.piso,
      racha: p.rachaArenas,
      juicio: piedra > 0 ? { nivel: piedra, afijos, tiempo: tiempoJuicio(a.def.oleadas), escala: escalaJuicio(piedra) } : undefined,
      empezar: (juicio) => {
        obj.usado = true;
        this.audio.reproducir("reliquia");
        this.empezarArena(juicio ? { nivel: piedra, afijos: new Set(afijos) } : undefined);
      },
    });
  }

  /** Al elegir en la campana: se sellan las puertas y llega la primera oleada. */
  private empezarArena(juicio?: { nivel: number; afijos: Set<AfijoJuicio> }): void {
    const a = this.arena;
    if (a === null || a.activa) return;
    a.activa = true;
    a.golpes = 0;
    a.juicio = juicio;
    a.tiempoTotal = juicio !== undefined ? tiempoJuicio(a.def.oleadas) : a.def.tiempo;
    a.tiempo = a.tiempoTotal ?? 0;
    a.relojVolcan = 3;
    const color = juicio !== undefined ? "#b04dff" : a.def.color;
    this.fx.destellar(color, juicio !== undefined ? 0.6 : 0.35);
    this.fx.sacudir(juicio !== undefined ? 6 : 3);
    if (juicio !== undefined) {
      const nombres = [...juicio.afijos].map((x) => INFO_AFIJO_JUICIO[x].nombre).join(" · ");
      this.mensaje(`Juicio +${juicio.nivel}${nombres !== "" ? ` — ${nombres}` : ""}`, "#c9a7ff");
    }
    this.siguienteOleada();
  }

  /** Juicio: escala al enemigo con el nivel de la piedra y los afijos Fortificado / Tiránico. */
  private aplicarJuicio(e: Enemigo, juicio: { nivel: number; afijos: Set<AfijoJuicio> }): void {
    let vida = escalaJuicio(juicio.nivel);
    let danio = vida;
    const fuerte = e.categoria === "elite";
    if (!fuerte && juicio.afijos.has("fortificado")) {
      vida *= 1.3;
      danio *= 1.2;
    }
    if (fuerte && juicio.afijos.has("tiranico")) {
      vida *= 1.6;
      danio *= 1.3;
    }
    e.hpMax = Math.round(e.hpMax * vida);
    e.hp = e.hpMax;
    e.multAtaque *= danio;
  }

  private siguienteOleada(): void {
    const a = this.arena;
    if (a === null) return;
    a.oleada++;
    const lugares = this.posicionesSuelo();
    const n = a.def.enemigos(a.oleada);
    const bases: readonly ConductaBase[] = ["caminante", "saltador", "volador", "torreta", "escudero"];
    const color = a.juicio !== undefined ? "#b04dff" : a.def.color;
    const nuevos: Enemigo[] = [];
    for (let k = 0; k < n && lugares.length > 0; k++) {
      const l = lugares.splice(entero(this.partida.azar, lugares.length), 1)[0];
      if (a.def.elites === "campeon") {
        // Duelo: el campeón de la zona, con tres afijos y mucha más vida.
        const e = this.crearEnemigo(elegirUno(this.partida.azar, ["caminante", "escudero", "saltador"] as const), l.x, l.y, true, 3);
        e.hpMax = Math.round(e.hpMax * 4);
        e.hp = e.hpMax;
        e.multAtaque *= 1.2;
        nuevos.push(e);
        continue;
      }
      const tipo = bases[entero(this.partida.azar, bases.length)];
      const abisal = a.juicio?.afijos.has("abisal") === true && k % 3 === 0;
      const elite = a.def.elites === "todos" || (a.oleada === a.def.oleadas && k === 0) || abisal;
      const e = this.crearEnemigo(tipo, l.x, l.y, elite);
      if (tipo === "volador") e.y = l.y - 3 * TILE;
      nuevos.push(e);
    }
    // Espectral: entre oleadas se suman sombras voladoras.
    if (a.juicio?.afijos.has("espectral") === true && a.oleada > 1) {
      for (let k = 0; k < 2; k++) {
        const e = this.crearEnemigo("volador", 120 + k * 240, 8 * TILE);
        nuevos.push(e);
      }
    }
    for (const e of nuevos) {
      if (a.juicio !== undefined) this.aplicarJuicio(e, a.juicio);
      this.criaturas.push(e);
      this.fx.chispas(e.cx, e.y + e.h - 8, color, 10, { velocidad: 70, brillo: true });
    }
    this.sellarPuertas(true);
    const titulo = a.juicio !== undefined ? `Juicio +${a.juicio.nivel} · ${a.def.nombre}` : a.def.nombre;
    this.eventos.jefe(`${titulo} · oleada ${a.oleada}/${a.def.oleadas}`, a.oleada === 1 ? a.def.regla : "Nadie sale hasta que caigan todos");
    this.audio.reproducir("jefe");
  }

  /** Juicio: efectos de los afijos mientras dura (Enfurecido y Volcánico). */
  private actualizarJuicio(dt: number, a: EstadoArena): void {
    const j = a.juicio;
    if (j === undefined) return;
    if (j.afijos.has("enfurecido")) {
      for (const c of this.criaturas) {
        if (c instanceof Enemigo && !c.muerto && !c.enfurecido && c.hp < c.hpMax * 0.3) {
          c.enfurecido = true;
          this.fx.texto(c.cx, c.y - 6, "¡Enfurecido!", INFO_AFIJO_JUICIO.enfurecido.color);
        }
      }
    }
    if (j.afijos.has("volcanico")) {
      a.relojVolcan -= dt;
      if (a.relojVolcan <= 0) {
        a.relojVolcan = 3.5;
        const jug = this.jugador;
        this.peligros.push({
          x: jug.cx - 12, y: jug.y + jug.h - 40, w: 24, h: 40, aviso: 1, activo: 0.35,
          danio: Math.round(6 + this.partida.piso * 1.5 * escalaJuicio(j.nivel)), color: INFO_AFIJO_JUICIO.volcanico.color, golpeo: false,
        });
      }
    }
  }

  /** Juicio: lo que pasa cuando cae un enemigo (Reforzado, Sanguino, Explosivo). */
  private muerteEnJuicio(c: Criatura): void {
    const a = this.arena;
    const j = a?.juicio;
    if (a === null || !a.activa || j === undefined || c.esJefe) return;
    const danio = Math.round((5 + this.partida.piso * 1.2) * escalaJuicio(j.nivel));
    if (j.afijos.has("reforzado")) {
      for (const o of this.criaturas) {
        if (o === c || o.muerto || !(o instanceof Enemigo)) continue;
        o.hpMax = Math.round(o.hpMax * 1.12);
        o.hp = Math.round(o.hp * 1.12);
        o.multAtaque *= 1.12;
        this.fx.chispas(o.cx, o.cy, INFO_AFIJO_JUICIO.reforzado.color, 6, { velocidad: 40, brillo: true, gravedad: -40 });
      }
    }
    if (j.afijos.has("sanguino")) {
      this.peligros.push({ x: c.cx - 18, y: c.y + c.h - 6, w: 36, h: 6, aviso: 0.4, activo: 6, danio, color: INFO_AFIJO_JUICIO.sanguino.color, golpeo: false });
    }
    if (j.afijos.has("explosivo")) {
      this.peligros.push({ x: c.cx - 26, y: c.cy - 26, w: 52, h: 52, aviso: 1.1, activo: 0.25, danio: danio * 2, color: INFO_AFIJO_JUICIO.explosivo.color, golpeo: false });
    }
  }

  private revisarArena(dt: number): void {
    const a = this.arena;
    if (a === null || !a.activa || this.terminado) return;
    this.actualizarJuicio(dt, a);
    if (a.tiempoTotal !== undefined && a.tiempo > 0) {
      a.tiempo -= dt;
      if (a.tiempo <= 0) {
        this.mensaje(a.juicio !== undefined ? "¡Se acabó el tiempo! La piedra bajará un nivel" : "¡La arena cayó! Termina igual, pero el premio baja", "#ff9a4d");
        this.audio.reproducir("fallo");
      }
    }
    if (this.criaturas.some((c) => !c.muerto && !(c instanceof Vela) && !(c instanceof Cazador))) return;
    if (a.oleada < a.def.oleadas) {
      this.siguienteOleada();
      return;
    }
    this.completarArena(a);
  }

  /** Desafío superado: cofre según el mérito, la pieza con destino, esquirlas y (en el Duelo) una carta. */
  private completarArena(a: EstadoArena): void {
    const p = this.partida;
    const reg = this.meta.registro;
    let cofre: number;
    let pieza: Rareza | undefined;
    let esquirlas: number;
    let sellos: Sello[];
    if (a.juicio !== undefined) {
      const r = premioJuicio(a.juicio.nivel, p.piso, a.tiempo, a.tiempoTotal ?? 1);
      const antes = p.piedraJuicio;
      p.piedraJuicio = nuevoNivelPiedra(antes, r.cambio);
      ({ cofre, pieza, esquirlas } = r);
      sellos = [{
        texto: r.cambio > 0 ? `¡A tiempo! Piedra +${antes} → +${p.piedraJuicio}` : `Fuera de tiempo. Piedra +${antes} → +${p.piedraJuicio}`,
        bueno: r.cambio > 0,
      }];
      if (r.cambio > 0) {
        reg.juiciosATiempo = (reg.juiciosATiempo ?? 0) + 1;
        reg.mejorJuicio = Math.max(reg.mejorJuicio ?? 0, a.juicio.nivel);
      }
    } else {
      const r = premioArena(a.def, { golpesRecibidos: a.golpes, tiempoSobrante: a.tiempoTotal !== undefined ? a.tiempo : undefined, racha: p.rachaArenas });
      ({ cofre, pieza, esquirlas } = r);
      sellos = [...r.sellos];
    }
    // Registro de desafíos y misiones.
    p.rachaArenas++;
    reg.arenas = (reg.arenas ?? 0) + 1;
    reg.mayorRacha = Math.max(reg.mayorRacha ?? 0, p.rachaArenas);
    if (a.golpes === 0) {
      reg.arenasIntocables = (reg.arenasIntocables ?? 0) + 1;
      this.avisarMision(p.registrarMision("intocable"));
    }
    if (a.def.variante === "reloj" && a.juicio === undefined && a.tiempo > 0) reg.mejorReloj = Math.max(reg.mejorReloj ?? 0, Math.floor(a.tiempo));
    this.avisarMision(p.registrarMision("arena", p.piso));

    a.estado.arena = -1;
    this.arena = null;
    this.sellarPuertas(false);
    const centro = this.ubicarExtraccion();
    const cx = centro.x + centro.w / 2;
    const suelo = centro.y + centro.h;
    this.ponerCofre(cx, suelo, 3000, cofre, a.estado);
    const fortuna = p.modificadoresBotin().fortuna ?? 0;
    const extra: Premio[] = [{ tipo: "esquirlas", cantidad: esquirlas }];
    if (pieza !== undefined) extra.push({ tipo: "equipo", equipo: generarEquipo(p.azar, p.piso, pieza, a.def.destino, undefined, fortuna) });
    if (a.def.carta) extra.push(cartaDeJefe(p.azar, p.piso, fortuna));
    this.soltar(extra, cx, suelo - 20);
    const color = a.juicio !== undefined ? "#b04dff" : a.def.color;
    this.fx.destellar(color, 0.45);
    for (const [k, sl] of sellos.entries()) this.fx.texto(cx, suelo - 40 - k * 10, sl.texto, sl.bueno ? "#7dffb0" : "#ff9a4d", true);
    const nombre = a.juicio !== undefined ? `Juicio +${a.juicio.nivel}` : a.def.nombre;
    this.eventos.jefe(`¡${nombre} superado!`, `${NOMBRE_COFRE[cofre]}${pieza !== undefined ? ` · ${NOMBRE_PIEZA[a.def.destino]} (${NOMBRES_RAREZA[pieza]})` : ""}${a.def.carta ? " · carta de alma" : ""}`);
    this.audio.reproducir("unico");
    this.eventos.guardar();
    this.guardarProgreso();
  }

  /** Contrarreloj de la arena o del Juicio (en pantalla, arriba al centro). */
  private dibujarRelojArena(g: CanvasRenderingContext2D): void {
    const a = this.arena;
    if (a === null || !a.activa || a.tiempoTotal === undefined) return;
    const resto = Math.max(0, a.tiempo);
    const frac = resto / a.tiempoTotal;
    const base = a.juicio !== undefined ? "#c9a7ff" : a.def.color;
    const color = resto <= 0 ? "#8a84a0" : resto < 10 ? "#ff6a6a" : base;
    g.fillStyle = "#000000aa";
    g.fillRect(ANCHO_SALA / 2 - 60, 30, 120, 14);
    g.fillStyle = color;
    g.fillRect(ANCHO_SALA / 2 - 58, 40, Math.round(116 * frac), 2);
    // Marcas de +2 y +3 de la piedra (40 % y 20 % del tiempo).
    if (a.juicio !== undefined) {
      g.fillStyle = "#ffffff88";
      g.fillRect(ANCHO_SALA / 2 - 58 + Math.round(116 * 0.4), 39, 1, 4);
      g.fillRect(ANCHO_SALA / 2 - 58 + Math.round(116 * 0.2), 39, 1, 4);
    }
    const pref = a.juicio !== undefined ? `Juicio +${a.juicio.nivel}` : "Arena";
    hd.texto(g, resto > 0 ? `${pref}: ${Math.ceil(resto)} s` : `${pref}: tarde`, ANCHO_SALA / 2, 38, { color, alinear: "center" });
  }

  /** Busca un tramo de suelo firme de 3 baldosas (sin pinchos ni pozo), lo más cerca posible del centro. */
  private ubicarExtraccion(): Rect {
    const t = this.sala.tiles;
    const en = (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx >= COLS || ty >= FILAS ? T_ROCA : t[indice(tx, ty)]);
    const libre = (tx: number, ty: number): boolean => !esSolido(en(tx, ty)) && en(tx, ty) !== T_PINCHOS;
    let mejor: { tx: number; ty: number; d: number } | null = null;
    for (let ty = 3; ty < FILAS - 1; ty++) {
      for (let tx = 3; tx < COLS - 5; tx++) {
        let ok = true;
        for (let k = 0; k < 3 && ok; k++) {
          ok = en(tx + k, ty + 1) === T_ROCA && libre(tx + k, ty) && libre(tx + k, ty - 1) && libre(tx + k, ty - 2);
        }
        if (!ok) continue;
        // Preferir el suelo bajo (fila 13) y el centro.
        const d = Math.abs(tx + 1.5 - COLS / 2) + Math.abs(ty - 13) * 1.5;
        if (mejor === null || d < mejor.d) mejor = { tx, ty, d };
      }
    }
    const tx = mejor?.tx ?? 4;
    const ty = mejor?.ty ?? 13;
    return { x: tx * TILE, y: (ty - 2) * TILE, w: 3 * TILE, h: 3 * TILE };
  }

  /** Extracción: quedarse 5 s dentro de la zona. Recibir daño reinicia la cuenta. */
  /** Segundos que hay que resistir en la zona (con emboscada: 15~20 s según lo que llevas en riesgo). */
  get duracionExtraccion(): number {
    return this.emboscada?.plan.duracion ?? SEGUNDOS_EXTRACCION;
  }

  /**
   * Extracción: al pisar la zona, el Pozo intenta impedir que te vayas. Hay que acumular el tiempo DENTRO de la zona
   * (salir pausa el progreso, un golpe lo hace retroceder) mientras brotan Manos del Abismo bajo tus pies y llegan
   * cazadores atraídos por el brillo de tu botín. Cuanto más Legendario/Mítico llevas, más violenta es.
   */
  private actualizarExtraccion(dt: number): void {
    const z = this.zonaExtraccion;
    if (z === null || this.terminado) return;
    const dentro = !this.jugador.muerto && solapan(this.jugador, z);
    this.enZonaExtraccion = dentro;
    if (dentro && this.emboscada === null) this.iniciarEmboscada();
    const e = this.emboscada;
    if (e === null) return;
    if (dentro) {
      this.cargaExtraccion += dt;
      if (Math.random() < dt * 20) {
        this.fx.chispas(z.x + Math.random() * z.w, z.y + z.h, "#7dffb0", 1, { velocidad: 40, gravedad: -120, vida: 0.6, brillo: true });
      }
    }
    // Manos del Abismo: brotan bajo tus pies con aviso.
    e.cdMano -= dt;
    if (e.cdMano <= 0) {
      e.cdMano = e.plan.cadaMano * (0.75 + Math.random() * 0.5);
      const j = this.jugador;
      const x = j.cx + (Math.random() - 0.5) * 30;
      this.peligros.push({ x: x - 9, y: j.y + j.h - 34, w: 18, h: 34, aviso: 0.75, activo: 0.4, danio: Math.round(6 + this.partida.piso * 2 + e.nivel * 3), color: "#6a1aa0", golpeo: false, forma: "mano" });
    }
    // Cazadores atraídos por el brillo del botín.
    e.cdOleada -= dt;
    if (e.cdOleada <= 0) {
      e.cdOleada = e.plan.cadaOleada;
      this.oleadaEmboscada(e);
    }
    if (this.cargaExtraccion >= e.plan.duracion) {
      this.emboscada = null;
      this.audio.tension(false);
      this.fx.destellar("#7dffb0", 0.9);
      this.audio.reproducir("reliquia");
      this.salirAlPueblo("extraccion");
    }
  }

  private iniciarEmboscada(): void {
    const nivel = nivelEmboscada(this.partida.resumenRiesgo());
    this.emboscada = { plan: planEmboscada(nivel), nivel, cdMano: 1.2, cdOleada: 1.5 };
    this.cargaExtraccion = 0.01;
    this.audio.tension(true);
    this.audio.reproducir("jefe");
    this.fx.sacudir(6);
    this.eventos.jefe("¡El Pozo no quiere dejarte ir!",
      nivel >= 4 ? "Lo que llevas brilla demasiado: resiste en la zona" : nivel >= 2 ? "Algo huele tu botín: resiste en la zona" : "Resiste en la zona hasta que se abra el camino");
  }

  private oleadaEmboscada(e: { plan: PlanEmboscada; nivel: number }): void {
    const bases: readonly ConductaBase[] = ["caminante", "saltador", "volador"];
    for (let k = 0; k < e.plan.porOleada; k++) {
      const lado = Math.random() < 0.5 ? 2 : COLS - 3;
      const x = lado * TILE + TILE / 2;
      const tipo = bases[Math.floor(Math.random() * bases.length)];
      const elite = Math.random() < e.plan.elite;
      const en = this.crearEnemigo(tipo, x, 14 * TILE, elite);
      if (tipo === "volador") en.y = 8 * TILE;
      en.multAtaque *= 1 + e.nivel * 0.08;
      this.criaturas.push(en);
      this.fx.estallar(x, 13 * TILE, { colores: ["#6a1aa0", "#2a0a3a", "#c9a7ff"], n: 12, velocidad: 90, tam: [1, 2], brillan: true, chispa: "#c9a7ff", luz: { color: "#b04dff", r: 50, dur: 0.4 } });
    }
    if (e.nivel >= 3) this.fx.texto(this.jugador.cx, this.jugador.y - 20, "Atraídos por el brillo…", "#c9a7ff");
  }

  // ---------------- Peso del Eco: el Cazador de Portadores ----------------

  /** Al empezar un piso: si el Peso es alto, el reloj del Cazador empieza a correr. */
  private prepararCazador(): void {
    const peso = this.partida.pesoEco;
    this.cazador = { hp: null, reloj: peso >= PESO_CAZADOR ? retrasoCazador(peso) : Infinity, reentrada: 0 };
    if (peso >= 1) {
      this.mensaje(`Peso del Eco ×${peso}: +${peso * 25} % de hallazgos raros.${peso >= PESO_CAZADOR ? " Algo baja detrás de ti…" : ""}`, peso >= PESO_CAZADOR ? "#ff6a9a" : "#c9a7ff");
    }
  }

  private actualizarCazador(dt: number): void {
    const c = this.cazador;
    if (this.abismo && this.partida.pesoEco < PESO_CAZADOR) return;
    const presente = this.criaturas.some((x) => x instanceof Cazador && !x.muerto);
    if (presente || this.terminado) return;
    if (c.hp === null) {
      c.reloj -= dt;
      if (c.reloj <= 0) this.aparecerCazador(undefined, "Un Cazador de Portadores baja por ti. No se detiene.");
    } else if (c.reentrada > 0) {
      c.reentrada -= dt;
      if (c.reentrada <= 0) this.aparecerCazador(c.hp, "El Cazador entra tras de ti…");
    }
  }

  private aparecerCazador(hp: number | undefined, texto: string): void {
    const j = this.jugador;
    const x = j.cx < ANCHO_SALA / 2 ? 1 * TILE : (COLS - 2) * TILE;
    const cz = new Cazador(x, j.y + j.h, statsCazador(this.partida.piso, this.partida.pesoEco), hp);
    this.criaturas.push(cz);
    this.cazador.hp = cz.hp;
    this.mensaje(texto, "#ff2a3d");
    this.audio.reproducir("jefe");
    this.fx.destellar("#2a0a24", 0.5);
  }

  /** Distorsiones del Pozo con mucho Peso: barras de interferencia en la imagen. */
  private dibujarDistorsion(g: CanvasRenderingContext2D): void {
    const peso = this.partida.pesoEco;
    if (peso < 3 || Math.random() > 0.04 * (peso - 2)) return;
    g.save();
    g.globalCompositeOperation = "difference";
    for (let k = 0; k < 2 + peso; k++) {
      g.globalAlpha = 0.12 + Math.random() * 0.2;
      g.fillStyle = Math.random() < 0.5 ? "#ff2a6a" : "#2affd0";
      g.fillRect(0, Math.floor(Math.random() * 270), ANCHO_SALA, 1 + Math.floor(Math.random() * 3));
    }
    g.restore();
  }

  /** Mano del Abismo: un círculo de aviso en el suelo y después una mano que brota y se cierra. */
  private dibujarMano(g: CanvasRenderingContext2D, z: Peligro): void {
    const suelo = z.y + z.h;
    const cx = z.x + z.w / 2;
    if (z.aviso > 0) {
      g.fillStyle = "#b04dff";
      g.globalAlpha = 0.3 + (Math.floor(this.tiempo * 14) % 2) * 0.3;
      g.fillRect(Math.round(z.x), Math.round(suelo - 2), z.w, 2);
      g.globalAlpha = 0.15;
      g.fillRect(Math.round(z.x + 3), Math.round(suelo - 6), z.w - 6, 4);
      g.globalAlpha = 1;
      return;
    }
    const sube = Math.min(1, (0.4 - z.activo) / 0.12 + 0.2);
    const alto = Math.round(z.h * sube);
    const y0 = Math.round(suelo - alto);
    g.fillStyle = "#2a0a3a";
    g.fillRect(Math.round(cx - 4), y0 + 8, 8, alto - 8);
    g.fillStyle = "#4a1a6a";
    g.fillRect(Math.round(cx - 6), y0 + 4, 12, 6);
    for (let k = 0; k < 4; k++) g.fillRect(Math.round(cx - 6 + k * 3), y0 + (k === 0 || k === 3 ? 2 : 0), 2, 5);
    g.fillStyle = "#c9a7ff";
    g.fillRect(Math.round(cx - 1), y0 + 6, 2, 2);
  }

  /** Emboscada: bordes de la pantalla oscurecidos que laten en rojo. */
  private dibujarTensionExtraccion(g: CanvasRenderingContext2D): void {
    if (this.emboscada === null) return;
    const k = 0.35 + Math.sin(this.tiempo * 7) * 0.12 + this.emboscada.nivel * 0.04;
    const grad = g.createRadialGradient(ANCHO_SALA / 2, 135, 90, ANCHO_SALA / 2, 135, 280);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.7, `rgba(40,0,20,${k * 0.6})`);
    grad.addColorStop(1, `rgba(90,0,30,${k})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, ANCHO_SALA, 270);
  }

  private dibujarExtraccion(g: CanvasRenderingContext2D): void {
    const z = this.zonaExtraccion;
    if (z === null) return;
    const pulso = 0.5 + Math.sin(this.tiempo * 3) * 0.2;
    const prog = Math.min(1, this.cargaExtraccion / SEGUNDOS_EXTRACCION);
    g.save();
    g.globalCompositeOperation = "lighter";
    const grad = g.createLinearGradient(0, z.y - 40, 0, z.y + z.h);
    grad.addColorStop(0, "rgba(125,255,176,0)");
    grad.addColorStop(1, `rgba(125,255,176,${0.25 + pulso * 0.2 + prog * 0.3})`);
    g.fillStyle = grad;
    g.fillRect(z.x, z.y - 40, z.w, z.h + 40);
    g.fillStyle = "#7dffb0";
    g.fillRect(z.x, z.y + z.h - 2, z.w, 2);
    g.fillRect(z.x, z.y + z.h - 6, 1, 6);
    g.fillRect(z.x + z.w - 1, z.y + z.h - 6, 1, 6);
    g.restore();
    hd.texto(g, "EXTRACCIÓN", z.x + z.w / 2, z.y - 8, { color: "#7dffb0", alinear: "center" });
    if (prog > 0) {
      g.fillStyle = "#000000aa";
      g.fillRect(z.x, z.y - 4, z.w, 3);
      g.fillStyle = "#7dffb0";
      g.fillRect(z.x, z.y - 4, Math.round(z.w * prog), 3);
    }
  }

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

  /** Para los fragmentos con física: qué hay en un punto del mundo. */
  private readonly sueloFx = (x: number, y: number): "solido" | "plataforma" | null => {
    const t = this.sala.tile(Math.floor(x / TILE), Math.floor(y / TILE));
    return t === undefined ? "solido" : esSolido(t) ? "solido" : t === T_PLATAFORMA ? "plataforma" : null;
  };

  actualizar(dt: number): void {
    if (this.terminado) {
      this.fx.actualizar(dt, this.sueloFx);
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
    for (const c of this.criaturas) if (c.vibrar > 0) c.vibrar = Math.max(0, c.vibrar - dt);
    this.audio.intensidadMusica(this.combo.indiceRango);
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
        const hpAntes = this.partida.hp;
        this.golpearJugador(c.danioContacto(), c.cx, 180, c.nombre);
        if (c instanceof Enemigo && this.partida.hp < hpAntes) c.alGolpearJugador(hpAntes - this.partida.hp);
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
    this.actualizarExtraccion(dt);
    this.revisarArena(dt);
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
    this.fx.actualizar(dt, this.sueloFx);
    this.actualizarColgantes(dt);
    this.actualizarLanzados(dt);
    this.vivos.actualizar(dt, this, this.proyectiles);
    this.particulas.actualizar(dt, this.solidoMotor, this.cicatrices);
    if (this.criaturas.some((c) => !c.muerto && (c instanceof Enemigo || c.esJefe))) this.habitos.combate(dt);
    this.aliado?.actualizar(dt, this);
    postfx.traumaMinimo(this.partida.hp < this.partida.stats().hp * 0.25 ? 0.35 : 0);
    this.actualizarDevorador(dt);
    this.actualizarCazador(dt);
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
    if (this.combo.indiceRango === 4) this.avisarMision(this.partida.registrarMision("rango"));
    if (this.combo.indiceRango >= 4) {
      this.ralentizar(0.55, 0.12);
      this.fx.destellar(subio.color, 0.25);
      // El Pozo susurra el rango (y la música suma coro y guitarra).
      this.audio.susurrarRango(subio.titulo.replace(/[¡!]/g, ""));
    }
  }

  private esquivaPerfecta(): void {
    const j = this.jugador;
    this.habitos.esquiva();
    postfx.onda(j.cx, j.cy, 1.8);
    postfx.trauma(0.3, 0.5);
    this.audio.reproducir("esquivaPerfecta");
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
          ? (tiene ? "Cristal resonante: atraviésalo con la Embestida (Shift)" : `Un cristal resonante. Necesitas: ${nombre} — está en este piso`)
          : (tiene ? "Muro de raíces: quémalo a golpes con la Garra Ígnea" : `Un muro de raíces. Necesitas: ${nombre} — está en este piso`),
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
        case "lluvia": this.fx.ambiente(x, -4, "#9fc8ff88", 90 + Math.random() * 40, false); break;
        case "luciernagas": this.fx.ambiente(x, y, Math.random() < 0.5 ? "#e8ff7a" : "#9aff5a", -3 + Math.random() * 6, true); break;
        case "hojas": this.fx.ambiente(x, -4, Math.random() < 0.5 ? "#c87a3a" : "#e8b23a", 12 + Math.random() * 8, false); break;
        case "arena": this.fx.ambiente(x, y, "#e0c48a66", 2, false); break;
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
        estado.cofres = [...(estado.cofres ?? []), obj.clave];
        this.avisarMision(this.partida.registrarMision("cofre", this.partida.piso));
        this.audio.reproducir(obj.nivel >= 2 ? "unico" : "cofre");
        const color = COLOR_COFRE[obj.nivel];
        this.fx.estallar(obj.cx, obj.y + 4, {
          colores: obj.nivel >= 2 ? [color, "#ffe9a8", "#ffffff"] : ["#7a5230", "#5a3a22", color], n: 10 + obj.nivel * 10,
          velocidad: 130 + obj.nivel * 30, tam: [1, 3], brillan: obj.nivel >= 2, chispa: obj.nivel >= 1 ? color : null,
          angulo: -Math.PI / 2, apertura: 1.8, luz: { color, r: 50 + obj.nivel * 25, dur: 0.6 },
        });
        this.fx.chispas(obj.cx, obj.y, color, 30 + obj.nivel * 20, { velocidad: 120 + obj.nivel * 30, brillo: true });
        if (obj.nivel >= 2) this.fx.destellar(color, 0.3 + obj.nivel * 0.1);
        if (obj.nivel >= 1) this.fx.texto(obj.cx, obj.y - 12, NOMBRE_COFRE[obj.nivel], color, true);
        this.soltar(botinCofre(this.partida.azar, this.partida.piso, this.partida.modificadoresBotin(), obj.nivel), obj.cx, obj.y);
        break;
      }
      case "altar":
        this.eventos.abrirAltar();
        break;
      case "campana":
        this.tocarCampana(obj);
        break;
      case "yunque":
        this.eventos.abrirYunque();
        break;
      case "mercader":
        this.eventos.abrirMercader();
        break;
      case "faro":
        this.eventos.abrirFaro({
          puedeDescansar: !estado.faroUsado,
          descansar: () => {
            this.partida.curarTodo();
            estado.faroUsado = true;
            this.audio.reproducir("pocion");
            this.fx.chispas(obj.cx, obj.y + 4, "#ffe9a8", 30, { velocidad: 80, gravedad: -60, brillo: true });
            this.mensaje("Descansas junto al faro: vida y éter restaurados (una vez por piso)", "#ffe9a8");
          },
        });
        break;
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
        if (this.abismo) {
          // La grieta solo baja: en el Abismo se sale únicamente por las salidas.
          this.eventos.abrirPortal({ final: false, abismo: true, seguir: () => this.descender() });
          break;
        }
        this.eventos.abrirPortal({
          final: this.partida.piso >= PISOS_TOTALES,
          seguir: () => this.descender(),
          volver: () => this.salirAlPueblo("portal"),
        });
        break;
    }
  }

  /** Vuelve al pueblo conservando todo (el descenso guardado se descarta). */
  salirAlPueblo(motivo: "extraccion" | "portal"): void {
    if (this.terminado) return;
    this.terminado = true;
    this.resolverPacto();
    if (this.partida.quitarEspectrales() > 0) this.mensaje("Las armas espectrales vuelven a sus dueños.", "#7dffb0");
    this.partida.registrarMision("extraer", this.partida.piso);
    this.registrarProfundidad();
    this.audio.silenciarAmbiente();
    this.eventos.borrarDescenso();
    this.eventos.volverAlPueblo(motivo);
  }

  /** Récord del modo en curso: piso del Pozo o profundidad del Abismo. */
  private registrarProfundidad(): void {
    const r = this.meta.registro;
    if (this.abismo) r.mejorAbismo = Math.max(r.mejorAbismo ?? 0, this.partida.piso);
    else r.mejorPiso = Math.max(r.mejorPiso, this.partida.piso);
  }

  private descender(): void {
    if (!this.abismo && this.partida.piso >= PISOS_TOTALES) {
      this.terminar(true);
      return;
    }
    this.guardarEstadoSala();
    this.partida.bajarPiso();
    this.nuevoPiso();
    this.resolverPacto();
  }

  // ---------------- Ecos: pacto, venganzas, cicatrices ----------------

  /** Eco propio en el piso, o (a veces) el de otro Portador. Devuelve si hay sala de Eco. */
  private prepararEcos(piso: number): boolean {
    this.ecoAjeno = null;
    if (this.meta.ecoDelPiso(piso) !== undefined) return true;
    if (configEcos.servicio !== null && this.partida.azar.siguiente() < PROB_ECO_AJENO) {
      this.ecoAjeno = configEcos.servicio.buscar(piso, configEcos.autor);
    }
    return this.ecoAjeno !== null;
  }

  /** El Espectro cumplió: terminaste el piso con vida. Te devuelve tu mejor pieza con un templado más. */
  private resolverPacto(): void {
    const eco = this.partida.pactoEco;
    if (eco === null) return;
    this.partida.pactoEco = null;
    this.aliado = null;
    const legado = legadoDelPacto(eco, this.partida.azar);
    if (legado === null) return;
    const r = this.partida.recoger({ tipo: "equipo", equipo: legado });
    if (!r.ok) this.partida.seguro.agregar(legado.base, 1, { equipo: legado });
    this.mensaje(`El Espectro cumple su pacto y se desvanece: ${legado.nombre}`, "#9fe8ff");
    this.audio.reproducir("reliquia");
  }

  private vengarEcoAjeno(c: EcoRival): void {
    const ajeno = this.ecoAjeno;
    const premios: Premio[] = [{ tipo: "esquirlas", cantidad: 60 + c.eco.nivel * 10 }];
    const legado = c.eco.legado;
    if (legado !== null) {
      premios.push({ tipo: "equipo", equipo: { ...legado, uid: `${legado.uid}-esp${Date.now() % 99999}`, nombre: `${legado.nombre.replace(/ \((Eco|Espectral)\)$/, "")} (Espectral)`, espectral: true } });
    }
    this.soltar(premios, c.cx, c.cy);
    if (ajeno !== null) configEcos.servicio?.vengar(ajeno, configEcos.nombre, recompensaVenganza(this.partida.piso));
    this.mensaje(`Vengaste a ${ajeno?.portador ?? "otro Portador"}. Su arma te acompañará este descenso.`, "#7dffb0");
    this.ecoAjeno = null;
    this.eventos.guardar();
    this.guardarProgreso();
  }

  /** Cicatriz del piso: una sala normal (siempre la misma para ese mapa) guarda tu caída. */
  private prepararCicatriz(piso: number): void {
    this.cicatriz = null;
    this.devorador = null;
    if (this.abismo) return;
    const c = this.meta.cicatrizDelPiso(piso);
    if (c === undefined) return;
    const normales = this.mapa.salas.filter((s) => s.tipo === "normal" && s.id !== this.mapa.inicio);
    if (normales.length === 0) return;
    this.cicatriz = { sala: normales[Math.floor(normales.length / 2)].id, c };
  }

  /** Si una misión personal del pueblo apunta a este piso, su Eco espera en una sala normal. */
  private prepararHistoria(piso: number): void {
    this.ecoHistoria = null;
    if (this.abismo) return;
    const def = HISTORIAS.find((h) => h.piso === piso && this.partida.historias[h.id] === "conocida" && !this.partida.tieneRecuerdo(h.id));
    if (def === undefined) return;
    const normales = this.mapa.salas.filter((s) => s.tipo === "normal" && s.id !== this.mapa.inicio && s.id !== this.cicatriz?.sala);
    if (normales.length === 0) return;
    this.ecoHistoria = { sala: normales[Math.floor(normales.length / 3)].id, def };
  }

  private despertarEcoHistoria(estado: EstadoSala): void {
    const h = this.ecoHistoria;
    if (h === null || estado.jefeVencido) return;
    const piso = this.partida.piso;
    const eco: Eco = {
      uid: `historia-${h.def.id}`, piso, nombre: h.def.eco.nombre, forma: crearCarta(this.partida.azar, h.def.eco.alma, Math.min(9, Math.floor(piso / 2))),
      nivel: piso * 2, stats: { hp: 30 + piso * 12, mp: 40, golpe: 8 + piso * 3, patada: 8 + piso * 3, tecnica: 8 + piso * 3, defensa: piso, critico: 8, suerte: 0, regen: 0 },
      legado: null, fecha: Date.now(), causa: h.def.eco.causa, numero: 0, habitos: h.def.eco.habitos,
    };
    const centro = this.ubicarExtraccion();
    const rival = new EcoRival(eco, centro.x + centro.w / 2 + 40, centro.y + centro.h);
    rival.historia = h.def.id;
    this.criaturas.push(rival);
    this.sellarPuertas(true);
    this.eventos.jefe(eco.nombre, `${h.def.titulo} · Cayó por ${h.def.eco.causa}`);
    this.audio.reproducir("jefe");
  }

  /** Al entrar a la sala de la cicatriz: aparece el Devorador (el monstruo que te mató, con tu nombre). */
  private despertarDevorador(estado: EstadoSala): void {
    const cic = this.cicatriz;
    if (cic === null || this.meta.cicatrizDelPiso(this.partida.piso) === undefined || estado.muertos.has(900)) return;
    const centro = this.ubicarExtraccion();
    const x = centro.x + centro.w / 2 + 48;
    const y = centro.y + centro.h;
    const e = new Enemigo(cic.c.asesino.conducta, this.partida.piso, this.bioma, x, y, true, cic.c.asesino.afijos as AfijoElite[]);
    e.x = x - e.w / 2;
    e.hpMax = Math.round(e.hpMax * 3);
    e.hp = e.hpMax;
    e.multAtaque *= 1.3;
    e.idSpawn = 900;
    this.criaturas.push(e);
    this.devorador = { e, cd: 3 };
    this.eventos.jefe(tituloDevorador(cic.c), "Aquí caíste. Algo creció con tu recuerdo.");
    this.audio.reproducir("jefe");
  }

  /** El Devorador usa una de tus habilidades (la técnica del alma de tu Habilidad I). */
  private actualizarDevorador(dt: number): void {
    const d = this.devorador;
    if (d === null || d.e.muerto) return;
    d.cd -= dt;
    const id = this.cicatriz?.c.almaTecnica;
    if (d.cd <= 0 && id !== null && id !== undefined) {
      d.cd = 4.5;
      const a = alma(id);
      tecnicaEnemiga(a.tecnica, d.e, this, d.e.ataque * 1.2, a.colorSec);
      this.fx.texto(d.e.cx, d.e.y - 14, a.nombre, a.colorSec);
    }
  }

  /** Tus armas rotas clavadas en el suelo y tu sangre seca, en la sala donde caíste. */
  private dibujarCicatriz(g: CanvasRenderingContext2D): void {
    const cic = this.cicatriz;
    if (cic === null || this.sala.mapa.id !== cic.sala) return;
    const centro = this.ubicarExtraccion();
    const suelo = centro.y + centro.h;
    const cx = centro.x + centro.w / 2;
    // Manchas de sangre seca
    g.fillStyle = "#5a0a14";
    for (const [dx, w] of [[-26, 14], [-8, 22], [14, 10], [30, 6], [-40, 5]] as const) {
      g.globalAlpha = 0.75;
      g.fillRect(Math.round(cx + dx), suelo - 1, w, 1);
      g.globalAlpha = 0.45;
      g.fillRect(Math.round(cx + dx + 2), suelo - 2, Math.max(2, w - 4), 1);
    }
    g.globalAlpha = 1;
    // Arma rota clavada (inclinada) y su mitad tirada al lado
    g.save();
    g.translate(Math.round(cx - 6), suelo);
    g.rotate(-0.35);
    g.fillStyle = "#3a2a1e";
    g.fillRect(-1, -22, 3, 8);
    g.fillStyle = "#6a6278";
    g.fillRect(-4, -15, 9, 2);
    g.fillStyle = cic.c.colorArma;
    g.fillRect(-1, -13, 3, 13);
    g.fillStyle = "#ffffff";
    g.fillRect(0, -13, 1, 9);
    g.restore();
    g.fillStyle = cic.c.colorArma;
    g.fillRect(Math.round(cx + 6), suelo - 2, 8, 2);
    g.fillStyle = "#1a1622";
    g.fillRect(Math.round(cx + 14), suelo - 2, 2, 2);
    // Jirón de capa
    g.fillStyle = "#5a1830";
    g.fillRect(Math.round(cx - 20), suelo - 2, 7, 2);
    g.fillRect(Math.round(cx - 17), suelo - 3, 3, 1);
    // Título del Devorador sobre su cabeza
    const d = this.devorador;
    if (d !== null && !d.e.muerto) hd.texto(g, tituloDevorador(cic.c), d.e.cx, d.e.y - 12, { color: "#ff4d6d", alinear: "center", tam: 7, negrita: true });
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
      this.avisarMision(this.partida.registrarMision("vela", this.partida.piso));
      this.soltar(botinVela(this.partida.azar, this.partida.piso), c.cx, c.y + 4);
      return;
    }
    this.audio.reproducir("muerte");
    this.sumarEstilo("muerte");
    this.muerteEnJuicio(c);
    // Élite explosiva (o kamikaze que no llegó a explotar por sí mismo): estalla al morir, con aviso.
    if (c instanceof Enemigo && c.tiene("explosivo") && !c.exploto) c.explotar(this, 1.2, 44, 0.6);
    this.fx.chispas(c.cx, c.cy, "#ffffff", c.esJefe ? 80 : 18, { velocidad: c.esJefe ? 220 : 120, vida: 0.7 });
    this.fx.chispas(c.cx, c.cy, this.bioma.acento, c.esJefe ? 60 : 10, { velocidad: 90, brillo: true, gravedad: -30 });
    this.particulas.sangre(c.cx, c.cy, this.sangreDe(c), c.esJefe ? 60 : 22);
    if (c instanceof Enemigo && c.tiene("explosivo")) this.crater(c.cx, c.y + c.h + 2, 12, "#ff9a3d");
    {
      const pal = c instanceof Enemigo ? c.paleta : [this.bioma.acento, "#d9d0bd"] as const;
      const elite = c instanceof Enemigo && c.categoria === "elite";
      this.fx.estallar(c.cx, c.cy, {
        colores: [pal[0], pal[1], "#1a1622"], n: c.esJefe ? 80 : elite ? 30 : 16, velocidad: c.esJefe ? 240 : 150,
        tam: c.esJefe ? [2, 6] : [1, 3], vida: c.esJefe ? 3 : 1.8, chispa: elite || c.esJefe ? pal[1] : null,
        luz: { color: pal[1], r: c.esJefe ? 160 : elite ? 70 : 40, dur: c.esJefe ? 1 : 0.35 },
      });
    }

    const niveles = this.partida.ganarExperiencia(c.exp);
    if (niveles > 0) {
      this.audio.reproducir("nivel");
      this.fx.texto(this.jugador.cx, this.jugador.y - 12, `¡NIVEL ${this.partida.nivel()}!`, "#ffe27a", true);
      this.fx.chispas(this.jugador.cx, this.jugador.cy, "#ffe27a", 30, { velocidad: 90, gravedad: -80, brillo: true });
    }
    if (c.idSpawn >= 0) estado.muertos.add(c.idSpawn);
    this.meta.registro.enemigos++;

    if (c instanceof EcoRival) {
      this.avisarMision(this.partida.registrarMision("eco", this.partida.piso));
      estado.jefeVencido = true;
      this.partida.ecosVencidos++;
      this.fx.destellar("#ffffff", 0.9);
      this.fx.sacudir(8);
      this.sellarPuertas(false);
      if (c.historia !== null) {
        const def = HISTORIAS.find((h) => h.id === c.historia);
        if (def !== undefined) {
          this.soltar([{ tipo: "objeto", objeto: def.recuerdo.objeto, cantidad: 1 }, { tipo: "esquirlas", cantidad: 40 + this.partida.piso * 12 }], c.cx, c.cy);
          this.eventos.jefe(def.recuerdo.nombre, "Llévalo de vuelta al pueblo. Si caes con él, se pierde.");
          this.audio.reproducir("reliquia");
        }
        this.ecoHistoria = null;
      } else if (c.ajeno) this.vengarEcoAjeno(c);
      else {
        this.meta.vencerEco(c.eco.uid);
        const eco = c.eco;
        const x = c.cx;
        const y = c.cy;
        this.eventos.decidirEco({
          eco, perfil: c.perfil, legado: eco.legado?.nombre ?? null,
          absorber: () => {
            this.soltar(premiosEco(eco, this.partida.azar), x, y);
            this.partida.curarTodo();
            this.fx.chispas(this.jugador.cx, this.jugador.cy, "#c9a7ff", 40, { velocidad: 120, gravedad: -60, brillo: true });
            this.mensaje("Absorbes el recuerdo: recuperas lo que el Pozo te quitó y tus heridas se cierran.", "#c9a7ff");
            this.eventos.guardar();
            this.guardarProgreso();
          },
          pactar: () => {
            this.soltar(premiosEco(eco, this.partida.azar, true), x, y);
            this.partida.pactoEco = eco;
            this.aliado = new EspectroAliado(eco, x, y - 10);
            this.mensaje(`Tu Eco camina a tu lado este piso. Si lo terminas con vida, te devolverá ${eco.legado?.nombre ?? "su fuerza"} mejorado.`, "#9fe8ff");
            this.eventos.guardar();
            this.guardarProgreso();
          },
        });
      }
      return;
    }
    if (c instanceof Cazador) {
      this.cazador.hp = null;
      this.cazador.reloj = retrasoCazador(this.partida.pesoEco) * 1.5;
      this.soltar([
        { tipo: "objeto", objeto: OBJ_RELICARIO, cantidad: 1 },
        { tipo: "equipo", equipo: generarEquipo(this.partida.azar, this.partida.piso, 4) },
      ], c.cx, c.cy);
      this.eventos.jefe("¡Cazador abatido!", "El Pozo tardará en mandar otro");
      this.fx.destellar("#ff2a3d", 0.6);
    }
    if (this.devorador !== null && c === this.devorador.e) {
      this.devorador = null;
      this.meta.cerrarCicatriz(this.partida.piso);
      this.soltar([
        { tipo: "objeto", objeto: OBJ_RELICARIO, cantidad: 1 },
        { tipo: "equipo", equipo: generarEquipo(this.partida.azar, this.partida.piso, 3) },
      ], c.cx, c.cy);
      this.eventos.jefe("La cicatriz se cierra", "Vengaste tu propia caída. El Pozo olvida un poco.");
      this.audio.reproducir("reliquia");
      this.fx.destellar("#ff4d6d", 0.6);
    }
    if (c.categoria === "jefe") {
      this.avisarMision(this.partida.registrarMision("jefe", this.partida.piso));
      if (this.abismo) {
        if (this.partida.desbloquearAbismo(this.partida.piso)) {
          this.mensaje(`Desde el pueblo ya puedes empezar el Abismo en el piso ${this.partida.abismoDesbloqueado}`, "#ffe27a");
        }
      } else {
        const teniaPiedra = this.partida.piedraJuicio > 0;
        if (this.partida.desbloquearPiso(this.partida.piso, PISOS_TOTALES)) {
          this.mensaje(`Desde el pueblo ya puedes empezar a bajar en el piso ${this.partida.pisoDesbloqueado}`, "#ffe27a");
        }
        if (!teniaPiedra && this.partida.piedraJuicio > 0) {
          this.eventos.jefe("La Piedra del Juicio", "Las campanas de las arenas ahora ofrecen el Juicio");
        }
      }
      estado.jefeVencido = true;
      this.partida.jefes++;
      this.meta.registro.jefes++;
      this.soltar(botinEnemigo(this.partida.azar, this.partida.piso, "jefe", this.partida.modificadoresBotin()), c.cx, c.cy);
      this.fx.destellar("#ffffff", 1);
      this.fx.sacudir(10);
      this.fx.congelar(0.25);
      postfx.onda(c.cx, c.cy, 1.2);
      postfx.trauma(0.6, 0.8);
      this.criaturas.forEach((o) => { if (!o.esJefe) o.muerto = true; });
      this.sellarPuertas(false);
      this.interactuables.push(new Interactuable("portal", ANCHO_SALA / 2, 14 * TILE));
      this.mensaje(
        this.abismo ? "El guardián cae. La grieta sigue bajando, sin fondo."
          : this.partida.piso >= PISOS_TOTALES ? "El Corazón del Pozo deja de latir. El portal lleva a la superficie." : "El guardián cae. Un portal se abre hacia abajo.",
        "#ffe27a",
      );
      this.eventos.guardar();
      this.guardarProgreso();
      return;
    }
    this.avisarMision(this.partida.registrarMision("matar", this.partida.piso));
    if (c.categoria === "elite") this.avisarMision(this.partida.registrarMision("elite", this.partida.piso));
    if (this.partida.registrarMuerteEnemigo()) {
      this.fx.texto(this.jugador.cx, this.jugador.y - 10, "Corazón del Pozo", "#ff4d6d");
    }
    if (c.categoria === "elite" && c instanceof Enemigo && this.partida.azar.siguiente() < bonoPeso(this.partida.pesoEco).relicarioElite) {
      this.soltar([{ tipo: "objeto", objeto: OBJ_RELICARIO, cantidad: 1 }], c.cx, c.cy);
    }
    if (c.idSpawn >= 0) {
      this.soltar(botinEnemigo(this.partida.azar, this.partida.piso, c.categoria, this.partida.modificadoresBotin()), c.cx, c.cy);
    }
  }

  private avisarMision(completa: boolean): void {
    if (completa) {
      this.mensaje("¡Misión completa! Entrégala en el tablón de la taberna", "#ffe27a");
      this.audio.reproducir("nivel");
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
    // Las piezas espectrales y el pacto se desvanecen con tu muerte.
    this.partida.quitarEspectrales();
    this.partida.pactoEco = null;
    this.aliado = null;
    // Cicatriz del Pozo: el monstruo que te mató volverá con tu nombre.
    const ag = this.ultimoAgresor;
    if (!this.abismo && ag !== null && this.tiempo - ag.t < 4) {
      this.meta.marcarCicatriz({
        piso: this.partida.piso, portador: configEcos.nombre, asesino: ag.a,
        arma: this.partida.estilo().id, colorArma: this.partida.estilo().color,
        almaTecnica: this.partida.almas[1]?.personaje ?? this.partida.forma?.personaje ?? null, fecha: Date.now(),
      });
    }
    // Extracción fallida: lo que llevabas encima se queda en el Pozo, con tu Eco.
    const stats = this.partida.stats();
    const equipo = RANURAS.map((r) => this.partida.equipo[r]);
    const botin = this.partida.perderTodo();
    const eco = crearEco({
      piso: this.partida.piso,
      forma: this.partida.forma,
      nivel: this.partida.nivel(),
      stats,
      equipo,
      causa,
      numero: this.meta.registro.muertes + 1,
      botin,
      habitos: this.habitos.vector(),
      portador: configEcos.nombre,
    }, this.partida.azar, Date.now());
    this.meta.registrarMuerte(eco);
    // Ecos asíncronos: otros Portadores pueden encontrarlo (sin tu botín: solo tu forma, tus hábitos y tu legado).
    configEcos.servicio?.publicar({ eco: { ...eco, botin: undefined }, portador: configEcos.nombre, autor: configEcos.autor });
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
    this.registrarProfundidad();
    this.eventos.guardar();
  }

  // ---------------- Render ----------------

  // ---------------- Mutaciones y Resonancias ----------------

  /** Zonas, ecos y acciones diferidas de las habilidades mutadas y las resonancias. */
  readonly vivos = new EfectosVivos();
  /** Partículas del motor (SOA): sangre que mancha, chispas que rebotan. */
  readonly particulas = new SistemaParticulas(2000);
  /** Cicatrices de cada sala del piso (sangre, hollín, flechas clavadas): persisten mientras dure el piso. */
  private readonly cicatricesSala = new Map<number, CapaCicatrices>();

  private get cicatrices(): CapaCicatrices {
    const id = this.sala.mapa.id;
    let c = this.cicatricesSala.get(id);
    if (c === undefined) {
      c = new CapaCicatrices(ANCHO_SALA, ALTO_SALA);
      this.cicatricesSala.set(id, c);
    }
    return c;
  }

  private readonly solidoMotor = (x: number, y: number): boolean => this.sueloFx(x, y) === "solido";

  crater(x: number, y: number, radio: number, brasa?: string): void {
    this.cicatrices.crater(x, y, radio, brasa, this.solidoMotor);
  }

  clavar(x: number, y: number, angulo: number, color: string): void {
    // La punta queda un par de píxeles dentro de la roca.
    this.cicatrices.clavar(x + Math.cos(angulo) * 2, y + Math.sin(angulo) * 2, angulo, "#9c6b3b", color);
  }

  /** Color de la sangre de una criatura: el de su cuerpo, oscurecido. */
  private sangreDe(c: Criatura): string {
    const base = c instanceof Enemigo ? c.paleta[0] : "#8a1020";
    const [r, g, b] = rgbDe(base);
    const f = 0.55;
    return `rgb(${Math.round(r * 255 * f)}, ${Math.round(g * 255 * f * 0.7)}, ${Math.round(b * 255 * f * 0.7)})`;
  }
  /** Cómo está peleando el Portador en este descenso (lo hereda su Eco si muere). */
  readonly habitos = new RegistroHabitos();
  /** El último monstruo que te golpeó (para la Cicatriz si mueres). */
  private ultimoAgresor: { a: Asesino; t: number } | null = null;
  /** Eco de otro Portador que espera en este piso (Ecos asíncronos). */
  private ecoAjeno: EcoCompartido | null = null;
  /** Cicatriz del piso: sala marcada y su Devorador. */
  private cicatriz: { sala: number; c: Cicatriz } | null = null;
  private devorador: { e: Enemigo; cd: number } | null = null;
  /** Misión personal del pueblo cuyo Eco espera en este piso. */
  private ecoHistoria: { sala: number; def: DefHistoria } | null = null;
  /** Espectro Temporal (pacto con tu Eco). */
  aliado: EspectroAliado | null = null;
  /** Emboscada de la extracción en curso (el Pozo no quiere dejarte ir). */
  private emboscada: { plan: PlanEmboscada; nivel: number; cdMano: number; cdOleada: number } | null = null;
  /** ¿El Portador está dentro de la zona de extracción? (para el HUD). */
  enZonaExtraccion = false;
  /** Cazador de Portadores del piso: vida que le queda (null = todavía no llegó), reloj y reentrada tras cambiar de sala. */
  private cazador: { hp: number | null; reloj: number; reentrada: number } = { hp: null, reloj: Infinity, reentrada: 0 };

  resonar(r: DefResonancia, potencia: number): void {
    ejecutarResonancia(this, this.vivos, r, potencia);
    this.sumarEstilo("tecnica");
    if (this.meta.descubrirResonancia(r.id)) {
      this.eventos.jefe(`✦ ${r.nombre} ✦`, "¡Resonancia descubierta! Quedó anotada en el Códice");
      this.ralentizar(0.35, 0.7);
      this.audio.reproducir("reliquia");
      this.eventos.guardar();
    }
  }

  imitarDefinitiva(h: HabilidadEquipada): void {
    for (const e of [...this.vivos.ecos]) {
      const r = 60;
      this.golpearArea({ x: e.x - r, y: e.pies - 12 - r * 0.7, w: r * 2, h: r * 1.4 }, { potencia: h.potencia * 0.6, tipo: "tecnica", empuje: 200, definitiva: true }, 1, new Set());
      this.fx.estallar(e.x, e.pies - 12, { colores: [h.def.color, "#ffffff"], n: 24, velocidad: 200, tam: [1, 3], brillan: true, chispa: h.def.color, luz: { color: h.def.color, r: 90, dur: 0.5 } });
      this.fx.texto(e.x, e.pies - 30, "Coro de Ecos", h.def.color);
    }
    this.vivos.ecos.length = 0;
  }

  // ---------------- Patadas con física: muro, boliche y púas ----------------

  /** Enemigos que salieron volando de una patada: velocidad que conservan, daño de la patada y nivel de rebote. */
  private readonly lanzados = new Map<Enemigo, { t: number; vx: number; danio: number; dir: number; cadena: number; golpeados: Set<Criatura> }>();

  private lanzar(c: Enemigo, dir: number, danio: number, cadena: number): void {
    const vx = dir * (cadena === 0 ? 340 : 260);
    c.vx = vx;
    c.vy = Math.min(c.vy, -110);
    c.aturdido = Math.max(c.aturdido, 0.7);
    this.lanzados.set(c, { t: 0.75, vx, danio, dir, cadena, golpeados: new Set([c]) });
  }

  private actualizarLanzados(dt: number): void {
    for (const [c, l] of this.lanzados) {
      l.t -= dt;
      if (c.muerto || l.t <= 0 || Math.abs(l.vx) < 40) {
        this.lanzados.delete(c);
        continue;
      }
      // Conserva el impulso (el aturdimiento lo frenaría de golpe).
      l.vx *= 1 - 1.6 * dt;
      c.vx = l.vx;
      c.aturdido = Math.max(c.aturdido, 0.2);
      // 1) Púas: muerte instantánea (salvo élites, que sufren un golpe enorme).
      if (this.tocaTile(c, T_PINCHOS)) {
        const letal = c.categoria !== "elite";
        c.aplicarDanio(letal ? c.hp : Math.round(l.danio * 3), this);
        this.fx.texto(c.cx, c.y - 10, letal ? "¡EMPALADO!" : "¡Contra las púas!", "#ff4d6d", true);
        this.fx.estallar(c.cx, c.y + c.h, { colores: ["#c8243a", "#8a1020", ...c.paleta], n: 26, velocidad: 160, tam: [1, 3], vida: 2, angulo: -Math.PI / 2, apertura: 2, luz: { color: "#ff4d6d", r: 60, dur: 0.4 } });
        this.fx.congelar(0.1);
        this.fx.sacudir(6);
        this.audio.reproducir("explosion");
        this.sumarEstilo("muerte");
        this.lanzados.delete(c);
        continue;
      }
      // 2) Muro: si choca rápido contra la roca, daño de impacto y queda aturdido.
      const lado = l.dir > 0 ? c.x + c.w + 2 : c.x - 2;
      const t = this.sala.tile(Math.floor(lado / TILE), Math.floor(c.cy / TILE));
      if (t !== undefined && esSolido(t) && Math.abs(l.vx) > 110) {
        const dano = Math.max(1, Math.round(l.danio * 0.8));
        c.aplicarDanio(dano, this);
        c.aturdido = Math.max(c.aturdido, 1.6);
        c.vx = -l.dir * 60;
        this.fx.texto(c.cx, c.y - 10, `¡Contra el muro! ${dano}`, "#ffe27a", true);
        this.fx.estallar(lado, c.cy, { colores: ["#8a8070", "#5a5048", "#c8c0b0"], n: 16, velocidad: 120, tam: [1, 3], angulo: l.dir > 0 ? Math.PI : 0, apertura: 1.6, chispa: null, luz: { color: "#ffe9a8", r: 40, dur: 0.2 } });
        this.fx.congelar(0.07);
        this.fx.sacudir(5);
        this.audio.reproducir("impacto");
        this.sumarEstilo("golpe");
        this.lanzados.delete(c);
        continue;
      }
      // 3) Boliche: arrolla a los demás monstruos, que salen despedidos en cadena (hasta dos rebotes).
      for (const o of this.criaturas) {
        if (!(o instanceof Enemigo) || o.muerto || o.esJefe || l.golpeados.has(o) || !solapan(c, o)) continue;
        l.golpeados.add(o);
        const dano = Math.max(1, Math.round(l.danio * 0.6));
        o.aplicarDanio(dano, this);
        this.fx.texto(o.cx, o.y - 8, `${dano}`, "#ffe27a");
        this.fx.chispas(o.cx, o.cy, "#ffffff", 10, { velocidad: 120, angulo: l.dir > 0 ? 0 : Math.PI, apertura: 1.4 });
        this.fx.congelar(0.05);
        this.audio.reproducir("patada");
        if (!o.pesado && l.cadena < 2) this.lanzar(o, l.dir, Math.round(l.danio * 0.8), l.cadena + 1);
        else o.empujar(l.dir, 180);
        if (l.golpeados.size === 3) this.fx.texto(c.cx, c.y - 22, "¡CHUZA!", "#ff9a3d", true);
        this.sumarEstilo("golpe");
      }
    }
  }

  /** ¿El cuerpo toca una baldosa de este tipo? */
  private tocaTile(c: Criatura, tipo: number): boolean {
    for (let tx = Math.floor((c.x + 1) / TILE); tx <= Math.floor((c.x + c.w - 1) / TILE); tx++) {
      for (let ty = Math.floor((c.y + 1) / TILE); ty <= Math.floor((c.y + c.h + 1) / TILE); ty++) {
        if (this.sala.tile(tx, ty) === tipo) return true;
      }
    }
    return false;
  }

  /** Cadenas y estandartes: brisa, el Portador los aparta al pasar y los estallidos los sacuden. */
  private actualizarColgantes(dt: number): void {
    const j = this.jugador;
    for (const c of this.sala.colgantes) {
      c.actualizar(dt, this.tiempo);
      c.empujar(j.x - 2, j.y, j.w + 4, j.h, j.vx, j.vy);
      for (const p of this.proyectiles) c.empujar(p.x - 4, p.y - 4, 8, 8, (p as unknown as { vx?: number }).vx ?? 0, 0);
      for (const f of this.fx.fogonazos) if (f.vida > f.vidaMax - dt * 1.5) c.sacudir(f.x, f.y, f.r * 1.4, 260);
    }
  }

  /** Color del trazo del arma: el aura de tu Forma (5★+; 12★ prismático) o el color de tu estilo de arma. */
  private colorTrazo(): string {
    const f = this.partida.forma;
    if (f !== null && f.nivel >= 11) return `hsl(${Math.floor(this.tiempo * 220) % 360}, 95%, 65%)`;
    if (f !== null && f.nivel >= 4) return colorEstrella(f.nivel);
    return this.partida.estilo().color;
  }

  /** Todas las luces de la escena, en coordenadas de MUNDO, con su color y si proyectan sombra. */
  private lucesEscena(): Luz[] {
    const j = this.jugador;
    const b = this.bioma;
    const luces: Luz[] = [];
    if (!j.muerto) luces.push({ x: j.cx, y: j.cy, r: 95, sombras: true });
    const colorInter: Partial<Record<string, string>> = {
      faro: "#ffe9a8", portal: "#b04dff", altar: b.acento, mercader: "#ffb23d", yunque: "#ff9a3d",
    };
    for (const i of this.interactuables) {
      if (i.usado && i.tipo !== "faro" && i.tipo !== "portal") continue;
      const color = i.tipo === "cofre" ? COLOR_COFRE[i.nivel] : i.tipo === "campana" ? i.color
        : i.tipo === "reliquia" && i.reliquia !== undefined ? INFO_RELIQUIA[i.reliquia].color : colorInter[i.tipo];
      luces.push({ x: i.cx, y: i.y + i.h / 2, r: i.tipo === "faro" ? 80 : 60, fuerza: 0.8, color, sombras: i.tipo === "faro" || i.tipo === "portal" });
    }
    for (const p of this.proyectiles) luces.push({ x: p.x, y: p.y, r: 30, fuerza: 0.75, color: p.op.color });
    for (const c of this.criaturas) {
      if (c.muerto) continue;
      if (c instanceof Cazador) luces.push({ x: c.cx, y: c.y + 6, r: 55, fuerza: 0.85, color: "#ff2a3d" });
      else if (c.esJefe) luces.push({ x: c.cx, y: c.cy, r: 80, fuerza: 0.6, color: b.acento, sombras: true });
      else if (c instanceof Enemigo) {
        // Los ojos de los monstruos brillan en la oscuridad (más las élites).
        const elite = c.categoria === "elite";
        luces.push({ x: c.cx + c.dir * c.w * 0.25, y: c.y + c.h * 0.3, r: elite ? 26 : 15, fuerza: elite ? 0.6 : 0.4, color: c.paleta[1] });
      }
    }
    for (const bo of this.botines) if (premioDestacado(bo.premio) > 0) luces.push({ x: bo.x, y: bo.y, r: 30, fuerza: 0.6, color: colorPremio(bo.premio) });
    const parpadeo = (k: number): number => 0.9 + Math.sin(this.tiempo * 9 + k * 1.7) * 0.06 + Math.sin(this.tiempo * 23 + k) * 0.04;
    this.sala.luces.forEach((l, k) => luces.push({ x: l.x, y: l.y, r: l.r * parpadeo(k), fuerza: l.fuerza, color: "#ffb060", sombras: true }));
    for (const c of this.criaturas) {
      if (c instanceof Vela) luces.push({ x: c.llama.x, y: c.llama.y, r: 34 * parpadeo(c.indice + 5), fuerza: 0.85, color: "#ff9a3d" });
    }
    const z = this.zonaExtraccion;
    if (z !== null) luces.push({ x: z.x + z.w / 2, y: z.y + z.h - 8, r: 55, fuerza: 0.7, color: "#7dffb0" });
    for (const l of this.fx.luces()) luces.push(l);
    for (const l of this.vivos.luces()) luces.push(l);
    return luces;
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const b = this.bioma;
    const j = this.jugador;
    const lucesMundo = this.lucesEscena();
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
    // Relieve: los cantos de la roca brillan del lado de cada luz. Con WebGL lo hace el compositor (mapa de normales).
    if (pintor.activo) pintor.normales.drawImage(this.sala.normales, sx, Math.round(-camY) + sy);
    else dibujarRelieve(g, this.sala.bordes, lucesMundo);
    // Cicatrices de la sala: lo que las peleas dejaron (sangre, hollín, flechas clavadas).
    const cic = this.cicatricesSala.get(this.sala.mapa.id);
    if (cic !== undefined && cic.marcas > 0) {
      g.drawImage(cic.albedo.canvas, 0, 0);
      if (pintor.activo) {
        pintor.normales.drawImage(cic.normales.canvas, sx, Math.round(-camY) + sy);
        pintor.emisivo.drawImage(cic.emisivo.canvas, sx, Math.round(-camY) + sy);
      }
    }
    for (const c of this.sala.colgantes) c.dibujar(g, "#8a8498", "#221c2c", "#5a1830", b.acento);
    if (pintor.activo) {
      pintor.normales.save();
      pintor.normales.translate(sx, Math.round(-camY) + sy);
      for (const c of this.sala.colgantes) c.dibujarNormales(pintor.normales);
      pintor.normales.restore();
    }
    dibujarBarreras(g, this.sala, this.tiempo);
    if (this.cadena !== null) this.dibujarCadena(g, this.cadena);
    if (this.puertasSelladas) this.dibujarSellos(g);

    for (const z of this.peligros) {
      if (z.forma === "mano") {
        this.dibujarMano(g, z);
        continue;
      }
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

    this.dibujarExtraccion(g);
    this.dibujarCicatriz(g);
    for (const i of this.interactuables) i.dibujar(g, b.acento);
    this.vivos.dibujar(g, this.tiempo);
    for (const bo of this.botines) bo.dibujar(g, Math.abs(bo.x + 4 - j.cx) < 34 && Math.abs(bo.y - j.cy) < 36);
    for (const c of this.criaturas) {
      if (c.vibrar > 0) {
        // Tiembla durante el hitstop.
        g.save();
        g.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 2));
        c.dibujar(g);
        g.restore();
      } else c.dibujar(g);
      this.dibujarEstado(g, c);
    }
    this.aliado?.dibujar(g);
    if (!j.muerto) j.dibujar(g, this);
    // Siluetas para la luz de contorno del compositor.
    if (pintor.activo) {
      const m = pintor.mascara;
      m.save();
      m.translate(sx, Math.round(-camY) + sy);
      for (const c of this.criaturas) if (!(c instanceof Vela) && !c.muerto) c.dibujar(m);
      this.aliado?.dibujar(m);
      if (!j.muerto) j.dibujar(m, this, true);
      m.restore();
    }
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
    this.fx.dibujarFragmentos(g);
    this.fx.dibujarParticulas(g);
    // Partículas del motor y trazo del arma (con WebGL, su brillo va a la capa emisiva).
    if (pintor.activo) {
      const e = pintor.emisivo;
      e.save();
      e.translate(sx, Math.round(-camY) + sy);
      this.particulas.dibujar(g, e);
      if (!j.muerto) j.trazo.dibujar(e, this.colorTrazo(), this.combo.indiceRango);
      // Ojos que brillan en la oscuridad y el aura de la Forma del Portador.
      for (const c of this.criaturas) {
        if (!(c instanceof Enemigo) || c.muerto) continue;
        e.fillStyle = c.paleta[1];
        e.fillRect(Math.round(c.cx + c.dir * c.w * 0.25) - 1, Math.round(c.y + c.h * 0.3), c.categoria === "elite" ? 3 : 2, 1);
      }
      const f = this.partida.forma;
      if (!j.muerto) j.dibujarEmisivo(e, f !== null && f.nivel >= 4 ? this.colorTrazo() : null);
      e.restore();
    } else {
      this.particulas.dibujar(g, null);
      if (!j.muerto) {
        g.save();
        g.globalCompositeOperation = "lighter";
        j.trazo.dibujar(g, this.colorTrazo(), this.combo.indiceRango);
        g.restore();
      }
    }
    g.restore();

    // Iluminación dinámica: luces de color y sombras duras contra la roca.
    const luces: Luz[] = lucesMundo.map((l) => ({ ...l, y: l.y - camY }));
    postfx.camara(0, camY);
    if (pintor.activo) postfx.luces(luces.map((l) => ({ x: l.x, y: l.y, radio: l.r * 1.3, color: rgbDe(l.color), fuerza: l.fuerza ?? 1 })));
    this.luz.dibujar(g, b.oscuridad, luces, "rgba(0,0,0,0)", { bordes: this.sala.oclusores, dx: 0, dy: -camY });

    // Bloom: lo emisivo se dibuja aparte, se difumina y se suma encima de la iluminación.
    // Con WebGL va a la capa emisiva del G-Buffer y el compositor le aplica el bloom.
    const e = pintor.activo ? pintor.emisivo : this.gEmisiva;
    if (!pintor.activo) e.clearRect(0, 0, ANCHO_SALA, 270);
    e.save();
    e.translate(sx, Math.round(-camY) + sy);
    for (const p of this.proyectiles) p.dibujar(e);
    for (const c of this.criaturas) if (c instanceof Vela) e.fillStyle = "#ff9a3d", e.fillRect(Math.round(c.llama.x) - 2, Math.round(c.llama.y) - 3, 4, 4);
    this.fx.dibujarBrillos(e);
    e.restore();
    if (!pintor.activo) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.filter = "blur(4px)";
      g.globalAlpha = 0.85;
      g.drawImage(this.emisiva, 0, 0);
      g.filter = "none";
      g.globalAlpha = 0.5;
      g.drawImage(this.emisiva, 0, 0);
      g.restore();
    }

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
      hd.texto(g, texto, x + 4, y + 9, { color: "#ffe9a8" });
    }
    g.restore();
    this.dibujarRelojArena(g);
    this.dibujarTensionExtraccion(g);
    this.dibujarDistorsion(g);

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


