// Menús en DOM sobre el canvas: título, Santuario, Memorial, inventario (equipo, cartas, stats), Altar,
// mercader, mapa, pausa, reliquias, muerte y victoria. La lógica vive en el dominio; acá solo se muestra
// y se llama a Partida/Meta, mostrando el Resultado (ok / código de error) que devuelven.

import { biomaAbismo, iniciosAbismo, numeroRomano } from "../dominio/abismo.ts";
import type { ArticuloErrante, AvisoAbismo, DecisionEco, OpcionesCampana } from "../juego/juego.ts";
import { INFO_AFIJO_JUICIO, afijosJuicio, semanaDe } from "../dominio/juicio.ts";
import { UMBRALES_MUTACION, mutacionesDe, tierMutacion } from "../contenido/mutaciones.ts";
import { HISTORIAS, LORE_NPC } from "../contenido/historias.ts";
import { COSTO_FORJA_MITICA, forjaMitica } from "../dominio/crafteo.ts";
import { INFO_ESENCIA, RESONANCIAS, VENTANA_RESONANCIA, esenciaDe } from "../contenido/resonancias.ts";
import {
  BLOQUE_RELICARIO, NIVEL_MIN_RELICARIO, NOMBRE_AURA, PROB_CAJA, PROB_RELICARIO, auraDeNivel, colorEstrella, pendientes,
} from "../dominio/relicario.ts";
import { dibujarPortador } from "../juego/render-portador.ts";
import { TAM_MOCHILA } from "../dominio/partida.ts";
import { dibujarRelicario } from "../juego/entidades/objetos.ts";
import { OBJ_CAJA_ALMAS, OBJ_RELICARIO } from "../contenido/objetos.ts";
import { pasivaMitica } from "../contenido/miticas.ts";
import { MODIFICADORES_POR_RAREZA } from "../dominio/equipo.ts";
import { cabeceraTienda, esencia, esquirlas, polvo as monedaPolvo, temaTienda, type IdTienda } from "./tienda.ts";
import { ELEMENTOS, potenciaElemental } from "../contenido/elementos.ts";
import type { Posicion } from "minialu";
import { ALMAS, COLOR_FAMILIA, FAMILIAS, alma } from "../contenido/almas.ts";
import {
  NOMBRE_RANURA_ALMA, RANURAS_ALMA, TECLA_RANURA_ALMA, cantidadExtra, describirEfectos, escalaCarta, grimorio, type RanuraAlma,
} from "../contenido/grimorio.ts";
import { ESTILOS, ORDEN_ESTILOS } from "../contenido/armas.ts";
import { REFINADO_MAX, RECETAS } from "../contenido/recetas.ts";
import { NIVEL_ELECCION_TEMPLADO, costoTemplado, pacto, type ModoTemplado } from "../dominio/templado.ts";
import { CONJUNTOS, conjunto as defConjunto } from "../contenido/conjuntos.ts";
import { COLORES_RAREZA_RUNA, estiloDe, COSTO_FUSION_RUNA, NOMBRES_RAREZA_RUNA, RAREZA_RUNA_MAX, nombreRuna, objetoRuna, runaDeObjeto } from "../contenido/objetos.ts";
import { SENDAS, TALENTOS, type Senda } from "../contenido/talentos.ts";
import { craftear, faltantes, fusionarRunas, puedeCraftear, refinarEquipado } from "../dominio/crafteo.ts";
import { bioma, type Bioma } from "../contenido/biomas.ts";
import {
  BASES, COLORES_RAREZA, CONSUMIBLES, MAT_FRAGMENTO, MATERIALES, PRECIO_DADO, dadoParaNivel, NOMBRES_RAREZA, OBJ_LAGRIMA, OBJ_POLVO, RASGOS_EQUIPO, apilable, unico, type EstiloArma,
} from "../contenido/objetos.ts";
import { COSTO_FUSION, MEJORAS_MAX, NIVEL_MAX_CARTA, PROB_FUSION, RASGOS_CARTA, estrellas, nombreCarta, textoEstrellas, type Carta } from "../dominio/cartas.ts";
import type { Eco } from "../dominio/eco.ts";
import { valorDesguace, type ObjetoEquipo } from "../dominio/equipo.ts";
import { MEJORAS_SANTUARIO, type Meta } from "../dominio/meta.ts";
import type { OpcionesInicio, Partida, RanuraCarta, ResumenPartida } from "../dominio/partida.ts";
import type { ResumenRanura } from "../infra/repositorio.ts";
import { CASILLAS_PESTANA_BANCO, PESTANAS_BANCO, type Banco } from "../dominio/banco.ts";
import {
  comprarAlArmero, comprarEnPueblo, precioPueblo, valorCarta, valorVenta, vender, venderCarta, type ArticuloArmero,
  kitRecluta, tieneArma,
} from "../dominio/comercio.ts";
import { INFO_MISIONES, MAX_MISIONES_ACTIVAS, MISIONES, mision } from "../contenido/misiones.ts";
import { PISOS_TOTALES } from "../contenido/biomas.ts";
import type { Inventario } from "minialu";
import { HABILIDADES_PORTADOR } from "../dominio/partida.ts";
import { TAM_SEGURO, cartaDe, equipoDe } from "../dominio/partida.ts";
import { NOMBRE_STAT, STATS, bloque, type Stat } from "../dominio/stats.ts";
import { INFO_RELIQUIA, NOMBRE_PIEZA, NOMBRE_RANURA, RANURAS, RELIQUIAS, piezaDeRanura, ranurasDePieza, type Ranura, type Reliquia } from "../dominio/tipos.ts";
import type { Audio } from "../motor/audio.ts";
import { AYUDA_CONTROLES } from "../motor/entrada.ts";
import type { Juego } from "../juego/juego.ts";
import { iconoObjeto, lienzoEquipo, lienzoIcono, lienzoPieza } from "../juego/iconos.ts";
import { sprites } from "../motor/sprites.ts";
import { h, limpiar } from "./dom.ts";
import { dibujarMinimapa } from "./hud.ts";

/** Lo único que los menús necesitan del juego o del pueblo: la partida (el personaje). */
export interface ConPartida {
  readonly partida: Partida;
}

export interface Acciones {
  /** Resumen de las ranuras de partida (null = vacía). */
  ranuras(): (ResumenRanura | null)[];
  /** Continuar una partida guardada (al pueblo o al descenso a medias). */
  jugarRanura(i: number): void;
  crearPartida(i: number, nombre: string, opciones: OpcionesInicio): void;
  /** Desde el Pozo del pueblo. */
  descender(piso: number, abismo?: boolean): void;
  /** Tras morir o ganar. */
  volverAlPueblo(): void;
  stockArmero(): ArticuloArmero[];
  banco(): Banco;
  aTitulo(): void;
  abandonar(): void;
  guardarYSalir(): void;
  /** Vuelve a dibujar la sala actual (al cambiar entre sprites y arte procedural). */
  refrescarArte(): void;
  guardar(): void;
}

const ERRORES: Readonly<Record<string, string>> = {
  "sin-fondos": "No tienes suficientes esquirlas",
  "sin-espacio": "No hay espacio",
  "distinto-nivel": "Las tres cartas deben tener las mismas estrellas",
  "distinto-tipo": "Las tres cartas deben ser de la misma familia",
  "nivel-maximo": "Esa carta ya está en su máximo de estrellas",
  "al-maximo": "Ya está al máximo",
  "sin-polvo": "Necesitas Polvo de Eco",
  "sin-lagrima": "Necesitas un Dado del Destino de esa estrella o una Lágrima de Eco",
  "repetida": "Elige tres cartas distintas",
  "casilla-vacia": "No hay nada ahí",
  "vacia": "No hay nada equipado ahí",
  "no-a-la-venta": "Eso no está a la venta",
  "monto-invalido": "Monto inválido",
  "faltan-materiales": "Faltan materiales",
  "faltan-runas": "Necesitas tres runas iguales de la misma rareza",
  "nada-que-refinar": "No tienes nada equipado ahí",
  "requisito": "Primero aprende el talento anterior de esa senda",
  "ya-aprendido": "Ya lo aprendiste",
  "sin-puntos": "No tienes puntos libres",
  "al-tope": "Ese stat llegó a su tope para tu nivel",
  "elige-templado": "Del +6 en adelante elige Templado Seguro o Templado Abisal",
  "no-es-runa": "Eso no es una runa",
};

function textoError(e: string): string {
  return ERRORES[e] ?? e;
}

function formatoStats(stats: Readonly<Record<string, number>>): HTMLElement {
  return h("div", { class: "stats" }, ...STATS.filter((s) => (stats[s] ?? 0) !== 0).map((s) =>
    h("span", { class: "stat" }, `${NOMBRE_STAT[s]} `, h("b", {}, `+${stats[s]}`))));
}

/** Grilla de casillas de un inventario (banco, contenedor seguro). */
const NOMBRE_LINEA: Readonly<Record<string, string>> = {
  exploracion: "Exploración", combate: "Combate", alma: "Alma", guardian: "Guardián", encargo: "Encargo repetible",
};

/** Orden del tablón: primero lo de la zona más baja, los encargos repetibles al final. */
function m2(m: { id: number; repetible?: boolean }): number {
  return (m.repetible === true ? 100 : 0) + Math.floor(m.id / 1000);
}

/** Qué hace una carta en cada ranura del mazo (pasivas y habilidades, ya escaladas por su nivel). */
function grimorioCarta(c: Carta, resaltar?: RanuraAlma): HTMLElement {
  const g = grimorio(c.personaje);
  const escala = escalaCarta(c);
  return h("div", { class: "grimorio" },
    h("div", { class: "sub" }, `Poder de la carta: ×${escala.toFixed(2).replace(".", ",")}${cantidadExtra(c.nivel) > 0 ? ` · +${cantidadExtra(c.nivel)} proyectiles/rayos` : ""}`),
    ...RANURAS_ALMA.map((r) => {
      const pas = g.pasivas[r];
      const hab = r === 0 ? null : g.habilidades[r - 1];
      return h("div", { class: `fila-grimorio${resaltar === r ? " activa" : ""}` },
        h("b", {}, NOMBRE_RANURA_ALMA[r] + (TECLA_RANURA_ALMA[r] !== "" ? ` (${TECLA_RANURA_ALMA[r]})` : "")),
        hab !== null ? h("div", { class: "hab", style: `color:${hab.color}` },
          `✦ ${hab.nombre}`, h("span", { class: "sub" },
            ` — ${hab.descripcion} ${r === 4 ? "(carga 100 %)" : `(${hab.costo} éter · ${hab.cd} s)`} · poder ×${(hab.mult * escala).toFixed(1).replace(".", ",")}`)) : null,
        hab !== null && r !== 4 ? (() => {
          const es = INFO_ESENCIA[esenciaDe(hab, alma(c.personaje).tipo)];
          return h("span", { class: "esencia", style: `--c:${es.color}`, title: "Esencia: combínala con otra en las Resonancias de Mazo" }, `${es.icono} ${es.nombre}`);
        })() : null,
        hab !== null ? h("div", { class: "mutaciones" }, ...mutacionesDe(hab.forma).map((mu, k) => {
          const activa = tierMutacion(c.nivel) > k;
          return h("div", { class: `mutacion${activa ? " on" : ""}`, title: mu.descripcion },
            h("b", {}, `${UMBRALES_MUTACION[k]}★ ${mu.nombre}`), ` — ${mu.descripcion}`);
        })) : null,
        h("div", { class: "pasiva" }, `${r === 0 ? "Ataques básicos" : "Pasiva"}: `, h("b", {}, pas.nombre), ` — ${describirEfectos(pas.efectos, escala)}`));
    }));
}

function grillaInventario(inv: Inventario, alClic: (pos: Posicion) => void, pestana?: number): HTMLElement {
  const g = h("div", { class: "grilla" });
  for (const pos of inv.posiciones()) {
    if (pestana !== undefined && pos.pestana !== pestana) continue;
    const pila = inv.en(pos);
    const eq = pila !== null ? equipoDe(pila) : undefined;
    const cons = pila !== null ? apilable(pila.objeto) : undefined;
    g.append(h("button", {
      class: `celda${pila === null ? " vacia" : ""}`,
      style: eq !== undefined ? `--c:${COLORES_RAREZA[eq.rareza]}` : cons !== undefined ? `--c:${cons.color}` : "",
      title: eq?.nombre ?? cons?.nombre ?? "",
      disabled: pila === null,
      onclick: () => alClic(pos),
    }, pila !== null ? (eq !== undefined ? lienzoEquipo(eq, COLORES_RAREZA[eq.rareza]) : lienzoIcono(iconoObjeto(pila.objeto)) ?? h("span", { class: "icono pocion" })) : null,
    pila !== null && pila.cantidad > 1 ? h("small", {}, pila.cantidad) : null));
  }
  return g;
}

function fichaEquipo(o: ObjetoEquipo, comparar?: ObjetoEquipo | null): HTMLElement {
  const u = unico(o.base);
  const dif = comparar !== undefined && comparar !== null
    ? h("div", { class: "comparar" }, "Comparado con lo equipado: ",
      ...STATS.map((s) => {
        const d = (o.stats[s] ?? 0) - (comparar.stats[s] ?? 0);
        return d === 0 ? null : h("span", { class: d > 0 ? "sube" : "baja" }, `${NOMBRE_STAT[s]} ${d > 0 ? "+" : ""}${d} `);
      }))
    : null;
  return h("div", { class: "ficha" },
    h("div", { class: "nombre", style: `color:${COLORES_RAREZA[o.rareza]}` }, o.nombre),
    h("div", { class: `sub rareza-${o.rareza}` }, h("b", { style: `color:${COLORES_RAREZA[o.rareza]}` }, NOMBRES_RAREZA[o.rareza]),
      ` · ${NOMBRE_PIEZA[o.ranura]} · Nv ${o.nivel} · ${MODIFICADORES_POR_RAREZA[o.rareza]} modificador${MODIFICADORES_POR_RAREZA[o.rareza] === 1 ? "" : "es"}`),
    pasivasArma(o),
    formatoStats(o.stats),
    o.elemento !== undefined ? (() => {
      const e = ELEMENTOS[o.elemento];
      return h("div", { class: "elemento", style: `color:${e.color}` },
        `${e.nombre} · +${Math.round(potenciaElemental(o.rareza) * 100)} % de daño elemental — ${e.efecto}`);
    })() : null,
    o.calidad !== undefined ? h("div", { class: o.calidad >= 1.1 ? "sube" : o.calidad < 0.9 ? "baja" : "sub" }, `Calidad de forja: ${Math.round(o.calidad * 100)} %`) : null,
    ...Object.entries(o.rasgos ?? {}).map(([id, v]) => {
      const def = RASGOS_EQUIPO.find((r) => r.id === id);
      if (def === undefined || v === undefined) return null;
      const deBase = (BASES.find((b) => b.id === o.base)?.rasgos as Record<string, number> | undefined)?.[id] !== undefined;
      const firma = def.firma?.includes(o.ranura) === true;
      return h("div", { class: `rasgo${deBase ? " de-base" : ""}${firma ? " firma" : ""}` },
        `${firma ? "◆" : "◈"} ${def.nombre} ${def.formato(v)}${deBase ? " (propio de la pieza)" : firma ? " · firma" : ""}`);
    }),
    ...(o.pactos ?? []).map((id) => {
      const pc = pacto(id);
      return pc === undefined ? null : h("div", { class: "pacto" },
        h("b", {}, `⛧ Pacto · ${pc.nombre}`),
        h("div", { class: "sube" }, `+ ${pc.textoBono}`),
        h("div", { class: "baja" }, `− ${pc.textoMaldicion}`));
    }),
    o.pasiva !== undefined ? h("div", { class: "pasiva-mitica" },
      h("b", {}, `✦ Pasiva mítica · ${pasivaMitica(o.pasiva).nombre}`), h("div", {}, describirEfectos(pasivaMitica(o.pasiva).efectos))) : null,
    u !== undefined ? h("div", { class: "efecto" }, `✦ ${u.descripcion}`) : null,
    u !== undefined ? h("div", { class: "cita" }, `«${u.cita}»`) : null,
    o.conjunto !== undefined ? (() => {
      const c = defConjunto(o.conjunto);
      return h("div", { class: "conjunto", style: `--c:${c.color}` },
        h("b", {}, `Conjunto: ${c.nombre}`),
        h("div", {}, `(2) ${c.dos.descripcion}`),
        h("div", {}, `(4) ${c.cuatro.descripcion}`),
        h("div", {}, `(6) ${c.seis.descripcion}`));
    })() : null,
    dif);
}

/** Alcance de un arma en palabras (en píxeles es poco claro para el jugador). */
function textoAlcance(px: number): string {
  return px >= 100 ? "a distancia" : px >= 32 ? "largo" : px >= 22 ? "medio" : "corto";
}

/** Familia de un arma: alcance y pasivas de ataque (en la ficha del arma). */
function pasivasArma(o: ObjetoEquipo): HTMLElement | null {
  if (o.ranura !== "arma") return null;
  const e = ESTILOS[estiloDe(o.base)];
  if (e.pasivas.length === 0) return null;
  return h("div", { class: "pasivas-arma" },
    h("div", { class: "sub" }, `${e.nombre} · alcance ${textoAlcance(e.alcance)} · combo de ${e.mults.length}`),
    ...e.pasivas.map((pv) => h("div", { class: "pasiva-arma" }, h("b", { style: `color:${e.color}` }, `◈ ${pv.nombre}: `), pv.descripcion)));
}

function fichaCarta(c: Carta): HTMLElement {
  const a = alma(c.personaje);
  const g = grimorio(c.personaje);
  return h("div", { class: "ficha" },
    h("div", { class: "nombre", style: `color:${a.colorSec}` }, nombreCarta(c)),
    h("div", { class: "sub" }, h("span", { style: `color:${COLOR_FAMILIA[c.tipo]}` }, FAMILIAS[c.tipo]), ` · ${estrellas(c)} · mejoras ${c.mejoras}/${MEJORAS_MAX}`),
    formatoStats(c.stats),
    c.brillante === true ? h("div", { class: "brillo" }, "✧ Resplandeciente: +20 % a todos sus stats") : null,
    c.rasgo !== undefined ? h("div", { class: "rasgo" }, `◈ Rasgo ${RASGOS_CARTA[c.rasgo].nombre}: ${RASGOS_CARTA[c.rasgo].descripcion} (solo como Forma)`) : null,
    h("div", { class: "efecto" }, `Habilidades: ${g.habilidades.slice(0, 3).map((x) => x.nombre).join(" · ")} · Definitiva: ${g.habilidades[3].nombre}`),
    h("div", { class: "cita" }, `«${a.lore}»`));
}

/** Ícono del Relicario de Almas (o de la Caja de Almas, `menor`) para los menús: lienzo animado. */
function lienzoRelicario(escala: number, menor = false): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16 * escala;
  c.height = 16 * escala;
  c.className = "icono-relicario";
  const g = c.getContext("2d")!;
  const t0 = performance.now();
  const pintar = (ahora: number): void => {
    if (!c.isConnected && ahora - t0 > 500) return;
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.translate(8 * escala, 15 * escala);
    dibujarRelicario(g, (ahora - t0) / 1000, escala, menor);
    g.restore();
    requestAnimationFrame(pintar);
  };
  pintar(t0);
  return c;
}

/** Figura del Portador para el muñeco del inventario (con el aura de su Forma detrás si es de 5★ o más). */
function lienzoPortador(p: Partida): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 40;
  c.height = 48;
  c.className = "inv-figura-lienzo";
  const g = c.getContext("2d")!;
  const forma = p.forma;
  const a = forma !== null ? alma(forma.personaje) : null;
  const cuerpo = a?.color ?? "#6a6a7a";
  const acento = a?.colorSec ?? "#d0d0e0";
  const t0 = performance.now();
  const pintar = (ahora: number): void => {
    if (!c.isConnected && ahora - t0 > 500) return;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "#00000066";
    g.beginPath();
    g.ellipse(20, 43, 10, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    dibujarPortador(g, 20, 43, 1, "quieto", { cuerpo, acento }, (ahora - t0) / 1000, { variante: a?.tipo ?? 1 });
    requestAnimationFrame(pintar);
  };
  pintar(t0);
  return c;
}

type FiltroMochila = "todo" | "equipo" | "cajas" | "consumibles" | "runas" | "materiales";

function categoriaPila(pila: { objeto: number; extra?: unknown }): FiltroMochila {
  if (equipoDe(pila as never) !== undefined) return "equipo";
  if (pila.objeto === OBJ_RELICARIO || pila.objeto === OBJ_CAJA_ALMAS) return "cajas";
  if (runaDeObjeto(pila.objeto) !== undefined) return "runas";
  if (MATERIALES.some((m) => m.id === pila.objeto)) return "materiales";
  return "consumibles";
}

/** Valor de una pieza para compararla con la equipada (flecha verde/roja en la mochila). */
function valorPieza(o: ObjetoEquipo): number {
  return o.nivel * (4 + o.rareza * 2) + (o.refinado ?? 0) * 6;
}

const h3 = (t: string): HTMLElement => h("h3", {}, t);

function miniCarta(c: Carta | null, etiqueta: string, sel: boolean, onclick: () => void): HTMLElement {
  if (c === null) return h("button", { class: `carta vacia${sel ? " sel" : ""}`, onclick }, h("small", {}, etiqueta), "—");
  const a = alma(c.personaje);
  const aura = c.nivel >= NIVEL_MIN_RELICARIO ? ` con-aura${c.nivel >= 11 ? " prisma" : ""}` : "";
  return h("button", { class: `carta${sel ? " sel" : ""}${c.brillante === true ? " brillante" : ""}${aura}`, style: `--c1:${a.color};--c2:${a.colorSec};--fam:${COLOR_FAMILIA[c.tipo]};--aura:${auraDeNivel(c.nivel)}`, onclick },
    h("small", {}, etiqueta),
    h("span", { class: "retrato-marco" }, h("span", { class: "retrato" })),
    h("b", {}, a.nombre),
    h("span", { class: "estrellas" }, estrellas(c) + (c.mejoras > 0 ? ` +${c.mejoras}` : "")),
    c.rasgo !== undefined ? h("small", { class: "rasgo" }, RASGOS_CARTA[c.rasgo].nombre) : null);
}

export class Interfaz {
  private pestanaBanco = 0;
  private readonly panel: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly banner: HTMLElement;
  private meta: Meta;
  private readonly audio: Audio;
  private readonly acciones: Acciones;
  private abiertoActual: string | null = null;
  private alCerrar: (() => void) | null = null;

  constructor(raiz: HTMLElement, meta: Meta, audio: Audio, acciones: Acciones) {

    this.meta = meta;
    this.audio = audio;
    this.acciones = acciones;
    this.panel = h("div", { class: "panel oculto" });
    this.toasts = h("div", { class: "toasts" });
    this.banner = h("div", { class: "banner" });
    raiz.append(this.toasts, this.banner, this.panel);
  }

  /** Cada ranura de partida tiene su propia Meta (reliquias, esencia, ecos). */
  usarMeta(m: Meta): void {
    this.meta = m;
  }

  /** ¿Hay un panel que pausa el juego? */
  get abierto(): string | null {
    return this.abiertoActual;
  }

  cerrar(): void {
    if (this.abiertoActual === "muerte" || this.abiertoActual === "victoria" || this.abiertoActual === "titulo") return;
    this.panel.classList.add("oculto");
    limpiar(this.panel);
    this.abiertoActual = null;
    const f = this.alCerrar;
    this.alCerrar = null;
    f?.();
  }

  /** Cierra cualquier panel (incluidos título, muerte y victoria) al empezar una partida. */
  cerrarForzado(): void {
    this.panel.classList.add("oculto");
    limpiar(this.panel);
    this.abiertoActual = null;
    this.alCerrar = null;
  }

  /** Abre un panel con la estética de tienda de RPG (marco temático y cabecera con el comerciante). */
  private abrirTienda(nombre: string, id: IdTienda, ...contenido: (Node | null)[]): void {
    this.abrir(nombre, ...contenido);
    this.panel.classList.add("tienda");
    this.panel.style.setProperty("--tema", temaTienda(id));
  }

  private abrir(nombre: string, ...contenido: (Node | null)[]): void {
    limpiar(this.panel);
    this.panel.className = `panel panel-${nombre}`;
    this.panel.style.removeProperty("--tema");
    for (const c of contenido) if (c !== null) this.panel.append(c);
    this.abiertoActual = nombre;
  }

  private botonCerrar(): HTMLElement {
    return h("button", { class: "cerrar", onclick: () => this.cerrar(), title: "Cerrar (Esc)" }, "✕");
  }

  toast(texto: string, color = "#ffffff"): void {
    const t = h("div", { class: "toast", style: `color:${color};border-color:${color}55` }, texto);
    this.toasts.append(t);
    while (this.toasts.children.length > 5) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add("saliendo"), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  anunciar(titulo: string, subtitulo: string, color: string): void {
    limpiar(this.banner);
    this.banner.append(h("div", { class: "b-titulo", style: `color:${color}` }, titulo), h("div", { class: "b-sub" }, subtitulo));
    this.banner.classList.remove("visible");
    void this.banner.offsetWidth;
    this.banner.classList.add("visible");
  }

  anunciarPiso(piso: number, b: Bioma, abismo?: AvisoAbismo): void {
    if (abismo === undefined) {
      this.anunciar(`Piso ${piso} — ${b.nombre}`, b.lema, b.acento);
      return;
    }
    const ciclo = abismo.ciclo > 1 ? ` · Ciclo ${numeroRomano(abismo.ciclo)}` : "";
    const pista = abismo.salida
      ? "Sientes una corriente de aire: en este piso hay una SALIDA escondida."
      : "Silencio absoluto. Ninguna salida en este piso.";
    this.anunciar(`Abismo ${piso} — ${b.nombre}${ciclo}`, abismo.guardian ? `${pista} Un guardián custodia la grieta.` : pista, abismo.salida ? "#7dffb0" : b.acento);
  }

  // =============================== Título ===============================

  mostrarTitulo(): void {
    this.abrir("titulo",
      h("div", { class: "titulo" },
        h("h1", {}, "ECOS"),
        h("div", { class: "lema" }, "El Pozo que Recuerda"),
        h("p", { class: "intro" },
          "Cada guerrero que cae en el Pozo deja un eco. Desde el último pueblo de la superficie bajas una y otra vez ",
          "a buscar el Corazón que los guarda a todos. Cuando caigas, tu Eco te esperará abajo."),
        h("div", { class: "menu" },
          h("button", { class: "principal", onclick: () => { this.audio.activar(); this.mostrarPartidas(); } }, "Jugar"),
          h("button", { onclick: () => this.mostrarControles(() => this.mostrarTitulo()) }, "Controles")),
        h("div", { class: "creditos" }, "Arte de escenario y criaturas: Anokolisa (Vaca Roxa) y 0x72 · CC0")));
  }

  /** Las tres ranuras de partida. */
  mostrarPartidas(confirmar: number | null = null): void {
    const tarjetas = this.acciones.ranuras().map((r, i) => {
      if (r === null) {
        return h("div", { class: "ranura-partida vacia" },
          h("b", {}, `Partida ${i + 1}`),
          h("p", { class: "sub" }, "Vacía"),
          h("button", { class: "principal", onclick: () => this.mostrarPreparacion(i) }, "Nueva partida"));
      }
      const fecha = new Date(r.actualizada).toLocaleString();
      return h("div", { class: "ranura-partida" },
        h("b", {}, r.nombre),
        h("div", { class: "sub" }, r.nivel !== null ? `Nivel ${r.nivel} · Piso desbloqueado ${r.pisoDesbloqueado}` : "Sin personaje"),
        h("div", { class: "sub" }, `Mejor piso ${r.mejorPiso} · Muertes ${r.muertes} · Victorias ${r.victorias}`),
        r.enDescenso !== null ? h("div", { class: "aviso-descenso" }, `En el Pozo: piso ${r.enDescenso}`) : null,
        h("small", { class: "sub" }, fecha),
        h("div", { class: "botones" },
          h("button", { class: "principal", onclick: () => { this.audio.activar(); this.acciones.jugarRanura(i); } }, r.enDescenso !== null ? "Continuar descenso" : "Continuar"),
          confirmar === i
            ? h("button", { class: "peligro", onclick: () => this.mostrarPreparacion(i) }, "Sí, sobrescribir")
            : h("button", { onclick: () => this.mostrarPartidas(i) }, "Nueva aquí")),
        confirmar === i ? h("p", { class: "baja" }, "Esto reemplaza esta partida (personaje, banco y mundo).") : null);
    });
    this.abrir("partidas",
      h("h2", {}, "Partidas"),
      h("div", { class: "ranuras-partida" }, ...tarjetas),
      h("button", { onclick: () => this.mostrarTitulo() }, "Volver"));
  }

  /** Antes de bajar: elegir arma inicial (estilo de combate) y alma inicial. */
  mostrarPreparacion(ranura: number, estilo: EstiloArma = "espada", almaId: number | null = null, nombre = ""): void {
    const m = this.meta;
    const campo = h("input", { type: "text", maxlength: 18, placeholder: `Portador ${ranura + 1}`, value: nombre, class: "nombre-portador" });
    const nombreActual = (): string => campo.value.trim();
    const armas = h("div", { class: "estilos" }, ...ORDEN_ESTILOS.map((id) => {
      const e = ESTILOS[id];
      return h("button", { class: `estilo${id === estilo ? " sel" : ""}`, style: `--c:${e.color}`, onclick: () => this.mostrarPreparacion(ranura, id, almaId, nombreActual()) },
        h("span", { class: `icono-estilo ${id}` }),
        h("b", {}, e.nombre),
        h("small", {}, `Combo de ${e.mults.length} · alcance ${textoAlcance(e.alcance)}`),
        h("span", { class: "sub" }, e.descripcion),
        ...e.pasivas.map((pv) => h("small", { class: "pasiva-arma" }, h("b", {}, `◈ ${pv.nombre}: `), pv.descripcion)));
    }));
    const vistas = ALMAS.filter((a) => m.almaVista(a.id));
    const almas = h("div", { class: "almas" },
      h("button", { class: `alma${almaId === null ? " sel" : ""}`, onclick: () => this.mostrarPreparacion(ranura, estilo, null, nombreActual()) },
        h("span", { class: "retrato azar" }), h("b", {}, "Al azar"), h("small", {}, "Que el Pozo decida")),
      ...vistas.map((a) => h("button", {
        class: `alma${almaId === a.id ? " sel" : ""}`, style: `--c1:${a.color};--c2:${a.colorSec}`, title: a.lore,
        onclick: () => this.mostrarPreparacion(ranura, estilo, a.id, nombreActual()),
      }, h("span", { class: "retrato" }), h("b", {}, a.nombre), h("small", {}, grimorio(a.id).habilidades[0].nombre), h("small", { class: "pasiva" }, grimorio(a.id).pasivas[0].nombre))));
    const elegida = almaId !== null ? alma(almaId) : null;
    this.abrir("preparacion",
      h("h2", {}, `Nuevo Portador · Partida ${ranura + 1}`),
      h("label", { class: "campo" }, "Nombre ", campo),
      h("h3", {}, "Arma inicial — define tu combo"),
      armas,
      h("h3", {}, "Alma inicial — tu Forma (pasiva de ataques básicos) y tu primera habilidad (L)"),
      vistas.length === 0 ? h("p", { class: "sub" }, "Todavía no conoces ningún alma: la primera será al azar. Las almas que encuentres quedarán disponibles aquí.") : null,
      almas,
      elegida !== null ? h("p", { class: "sub" }, `${elegida.nombre} · Ataques básicos: ${grimorio(elegida.id).pasivas[0].nombre} (${describirEfectos(grimorio(elegida.id).pasivas[0].efectos)}) · `
        + `Habilidad I: ${grimorio(elegida.id).habilidades[0].nombre} — ${grimorio(elegida.id).habilidades[0].descripcion}`) : null,
      h("div", { class: "menu fila" },
        h("button", { onclick: () => this.mostrarPartidas() }, "Volver"),
        h("button", {
          class: "principal",
          onclick: () => this.acciones.crearPartida(ranura, nombreActual() || `Portador ${ranura + 1}`, { estilo, alma: almaId ?? undefined }),
        }, "Comenzar")));
  }

  mostrarControles(volver: () => void): void {
    this.abrir("controles",
      h("h2", {}, "Controles"),
      h("table", { class: "controles" }, ...AYUDA_CONTROLES.map(([k, v]) => h("tr", {}, h("td", { class: "tecla" }, k), h("td", {}, v)))),
      h("div", { class: "consejos" },
        h("p", {}, "La ", h("b", {}, "patada"), " rompe la guardia de los escuderos. El ", h("b", {}, "golpe"), " es rápido y da éter al acertar."),
        h("p", {}, "Junta tres ", h("b", {}, "Cartas de Alma"), " de la misma familia y estrellas y fusiónalas en el ", h("b", {}, "Altar"), "."),
        h("p", {}, "Las ", h("b", {}, "reliquias"), " son permanentes: abren cristales y raíces en todas tus bajadas. Los pasajes verticales tienen cadenas: ↑/↓ para trepar.")),
      h("button", { class: "principal", onclick: volver }, "Volver"));
  }

  mostrarSantuario(): void {
    const m = this.meta;
    const filas = MEJORAS_SANTUARIO.map((d) => {
      const nivel = m.nivelMejora(d.id);
      const costo = m.costoMejora(d.id);
      return h("div", { class: "mejora" },
        h("div", {}, h("b", {}, d.nombre), h("div", { class: "sub" }, d.descripcion)),
        h("div", { class: "pips" }, ...Array.from({ length: d.maximo }, (_, i) => h("span", { class: i < nivel ? "pip on" : "pip" }))),
        costo === undefined
          ? h("span", { class: "sub" }, "Completo")
          : h("button", {
            disabled: m.esencia < costo,
            onclick: () => {
              const r = m.comprarMejora(d.id);
              if (r.ok) {
                this.audio.reproducir("nivel");
                this.acciones.guardar();
              } else this.audio.reproducir("fallo");
              this.mostrarSantuario();
            },
          }, `${costo} ✧`));
    });
    this.abrirTienda("santuario", "santuario", this.botonCerrar(),
      cabeceraTienda("santuario", [esencia(m.esencia)]),
      h("p", { class: "sub" }, "La esencia de cada descenso fortalece al próximo Portador."),
      h("h3", {}, "Bendiciones permanentes"),
      ...filas,
      h("button", { class: "principal", onclick: () => this.cerrar() }, "Volver al pueblo"));
  }

  mostrarMemorial(): void {
    const m = this.meta;
    const ecos = m.listaEcos();
    this.abrir("memorial",
      h("h2", {}, "Memorial"),
      h("h3", {}, "Ecos que esperan"),
      ecos.length === 0 ? h("p", { class: "sub" }, "Todavía no has caído. El Pozo es paciente.") : null,
      ...ecos.map((e) => h("div", { class: "eco" },
        h("b", {}, e.nombre), h("span", { class: "sub" }, ` · Piso ${e.piso} (${bioma(e.piso).nombre}) · Nv ${e.nivel}`),
        h("div", { class: "sub" }, `Cayó ante: ${e.causa}`),
        h("div", {}, "Forma: ", e.forma !== null ? h("span", { style: `color:${alma(e.forma.personaje).colorSec}` }, `${nombreCarta(e.forma)} ${estrellas(e.forma)}`) : "ninguna"),
        h("div", {}, "Legado: ", e.legado !== null ? h("span", { style: `color:${COLORES_RAREZA[e.legado.rareza]}` }, e.legado.nombre) : "nada"))),
      h("h3", {}, "Almas conocidas"),
      h("div", { class: "almas" }, ...ALMAS.map((a) => m.almaVista(a.id)
        ? h("div", { class: "alma", style: `--c1:${a.color};--c2:${a.colorSec}`, title: a.lore },
          h("span", { class: "retrato" }), h("b", {}, a.nombre), h("small", {}, a.titulo), h("small", {}, grimorio(a.id).habilidades[3].nombre))
        : h("div", { class: "alma oculta" }, h("span", { class: "retrato" }), h("b", {}, "???")))),
      h("button", { class: "principal", onclick: () => this.cerrar() }, "Volver al pueblo"));
  }

  // =============================== Inventario ===============================

  abrirInventario(juego: ConPartida, pestana: "equipo" | "cartas" | "habilidades" | "stats" = "equipo", seleccion?: Posicion | Ranura | RanuraCarta): void {
    const p = juego.partida;
    const tabs = h("div", { class: "tabs" },
      ...([["equipo", "Equipo"], ["cartas", "Cartas de Alma"], ["habilidades", "Habilidades"], ["stats", "Stats y daño"]] as const).map(([id, txt]) =>
        h("button", { class: pestana === id ? "tab on" : "tab", onclick: () => this.abrirInventario(juego, id) }, txt)));
    const cuerpo = pestana === "equipo" ? this.vistaEquipo(juego, p, seleccion)
      : pestana === "cartas" ? this.vistaCartas(juego, p, seleccion)
        : pestana === "habilidades" ? this.vistaHabilidades(juego, p)
          : this.vistaStats(p);
    const libres = p.puntos.disponibles + p.puntosTalento();
    if (libres > 0 && pestana !== "habilidades") tabs.children[2]?.classList.add("aviso");
    this.abrir("inventario", this.botonCerrar(), h("h2", {}, "Portador"), tabs, cuerpo);
  }

  private filtroMochila: FiltroMochila = "todo";

  /**
   * Inventario estilo RPG moderno: a la izquierda el PERSONAJE (muñeco con las 12 ranuras alrededor de la figura,
   * runas, poder y stats), al centro la MOCHILA (capacidad, filtros, ordenar, rejilla con rareza, nivel y
   * comparación con lo equipado) y a la derecha el DETALLE del objeto elegido con sus acciones.
   */
  private vistaEquipo(juego: ConPartida, p: Partida, sel?: Posicion | Ranura | RanuraCarta): HTMLElement {
    const refrescar = (s2?: Posicion | Ranura): void => this.abrirInventario(juego, "equipo", s2);
    const ranura = (r: Ranura): HTMLElement => {
      const o = p.equipo[r];
      return h("button", {
        class: `inv-ranura${sel === r ? " sel" : ""}${o === null ? " libre" : ` r${o.rareza}`}`,
        style: o !== null ? `--c:${COLORES_RAREZA[o.rareza]}` : "",
        title: o?.nombre ?? NOMBRE_RANURA[r],
        onclick: () => refrescar(r),
      },
      o !== null ? lienzoEquipo(o, COLORES_RAREZA[o.rareza], 2) : lienzoPieza(piezaDeRanura(r), "#3a3050", 2),
      o !== null ? h("i", { class: "nv" }, String(o.nivel)) : h("small", {}, NOMBRE_RANURA[r]));
    };
    const izquierda: Ranura[] = ["casco", "hombros", "pecho", "cinturon", "pantalones", "botas"];
    const derecha: Ranura[] = ["arma", "capa", "collar", "aretes", "anillo1", "anillo2"];
    const forma = p.forma;
    const s0 = p.stats();
    const stat = (nombre: string, valor: string | number, color: string): HTMLElement =>
      h("div", { class: "inv-stat" }, h("small", {}, nombre), h("b", { style: `color:${color}` }, String(valor)));
    const runas = h("div", { class: "inv-runas" }, ...([0, 1] as const).map((k) => {
      const r = p.runas[k];
      const def = r !== null ? runaDeObjeto(objetoRuna(r, p.nivelesRuna[k])) : undefined;
      return h("button", {
        class: "inv-runa", style: def !== undefined ? `--c:${COLORES_RAREZA_RUNA[def.nivel]}` : "", title: def?.descripcion ?? "Engarza una runa desde la mochila",
        onclick: () => {
          if (r === null) return;
          const res = p.quitarRuna(k);
          if (!res.ok) this.toast(textoError(res.error), "#ff9a4d");
          refrescar();
        },
      }, h("small", {}, `Runa ${k === 0 ? "I" : "II"}`), def !== undefined ? h("span", { style: `color:${def.color}` }, def.nombre) : h("span", { class: "sub" }, "vacía"));
    }));
    const personaje = h("section", { class: "inv-personaje" },
      h("div", { class: "inv-cabecera" },
        h("b", {}, forma !== null ? alma(forma.personaje).nombre : "Portador"),
        h("small", {}, `Nivel ${p.nivel()}${forma !== null ? ` · Forma ${estrellas(forma)}` : ""}`),
        h("div", { class: "inv-poder", title: "Poder: nivel y rareza de lo equipado" }, h("small", {}, "PODER"), h("b", {}, String(p.poder())))),
      h("div", { class: "inv-munieco" },
        h("div", { class: "inv-columna" }, ...izquierda.map(ranura)),
        h("div", { class: `inv-figura${forma !== null && forma.nivel >= NIVEL_MIN_RELICARIO ? " con-aura" : ""}${forma !== null && forma.nivel >= 11 ? " prisma" : ""}`, style: `--aura:${forma !== null ? auraDeNivel(forma.nivel) : "#7a6aa0"}` },
          lienzoPortador(p)),
        h("div", { class: "inv-columna" }, ...derecha.map(ranura))),
      runas,
      h("div", { class: "inv-stats" },
        stat("Vida", s0.hp, "#ff6a7a"), stat("Éter", s0.mp, "#4dc3ff"), stat("Golpe", s0.golpe, "#ffd27a"),
        stat("Técnica", s0.tecnica, "#c9a7ff"), stat("Defensa", s0.defensa, "#9fe8ff"), stat("Crítico", `${s0.critico} %`, "#ff9a4d")));

    // ---- Mochila
    const filtro = this.filtroMochila;
    let usadas = 0;
    const grilla = h("div", { class: "inv-grilla" });
    for (const pos of p.mochila.posiciones()) {
      const pila = p.mochila.en(pos);
      if (pila !== null) usadas++;
      const eq = pila !== null ? equipoDe(pila) : undefined;
      const cons = pila !== null ? apilable(pila.objeto) : undefined;
      const esSel = typeof sel === "object" && sel.casilla === pos.casilla;
      const oculta = pila !== null && filtro !== "todo" && categoriaPila(pila) !== filtro;
      let flecha: HTMLElement | null = null;
      if (eq !== undefined) {
        const puesta = p.equipo[p.ranuraPara(eq)];
        const dif = puesta === null ? 1 : valorPieza(eq) - valorPieza(puesta);
        if (dif !== 0) flecha = h("i", { class: dif > 0 ? "mejor" : "peor" }, dif > 0 ? "▲" : "▼");
      }
      const color = eq !== undefined ? COLORES_RAREZA[eq.rareza] : cons?.color ?? "";
      grilla.append(h("button", {
        class: `inv-celda${esSel ? " sel" : ""}${pila === null ? " vacia" : ""}${oculta ? " filtrada" : ""}${eq !== undefined ? ` r${eq.rareza}` : ""}`,
        style: pila !== null ? `--c:${color}` : "",
        title: eq?.nombre ?? cons?.nombre ?? "",
        onclick: () => refrescar(pos),
      },
      pila !== null
        ? (eq !== undefined ? lienzoEquipo(eq, COLORES_RAREZA[eq.rareza])
          : pila.objeto === OBJ_RELICARIO ? lienzoRelicario(2)
            : pila.objeto === OBJ_CAJA_ALMAS ? lienzoRelicario(2, true)
              : lienzoIcono(iconoObjeto(pila.objeto)) ?? h("span", { class: "icono pocion" }))
        : null,
      eq !== undefined ? h("i", { class: "nv" }, String(eq.nivel)) : null,
      flecha,
      pila !== null && pila.cantidad > 1 ? h("small", {}, pila.cantidad) : null));
    }
    const filtros: readonly [FiltroMochila, string][] = [["todo", "Todo"], ["equipo", "Equipo"], ["cajas", "Cajas"], ["consumibles", "Consumibles"], ["runas", "Runas"], ["materiales", "Materiales"]];
    const bolsa = h("section", { class: "inv-bolsa" },
      h("div", { class: "inv-cabecera" },
        h("b", {}, "Mochila"),
        h("div", { class: "inv-capacidad", title: `${usadas} de ${TAM_MOCHILA} casillas` },
          h("i", { style: `width:${Math.round((usadas / TAM_MOCHILA) * 100)}%`, class: usadas >= TAM_MOCHILA - 4 ? "llena" : "" }),
          h("span", {}, `${usadas}/${TAM_MOCHILA}`)),
        h("span", { class: "inv-esquirlas" }, `◆ ${p.esquirlas}`),
        h("button", { class: "inv-ordenar", title: "Ordenar: equipo por rareza, cajas, consumibles, runas y materiales", onclick: () => { p.ordenarMochila(); this.audio.reproducir("recoger"); refrescar(); } }, "⇅ Ordenar")),
      h("div", { class: "inv-filtros" }, ...filtros.map(([id, txt]) => h("button", {
        class: filtro === id ? "on" : "",
        onclick: () => { this.filtroMochila = id; refrescar(typeof sel === "object" || typeof sel === "string" ? sel as Posicion | Ranura : undefined); },
      }, txt))),
      grilla);

    // ---- Detalle
    let detalle: HTMLElement = h("div", { class: "detalle inv-vacio" },
      h("div", { class: "inv-pista" }, "Elige un objeto para ver sus detalles."),
      h("small", {}, "▲ mejor que lo equipado · ▼ peor. Las cajas se abren aquí."));
    if (typeof sel === "string" && (RANURAS as readonly string[]).includes(sel)) {
      const r = sel as Ranura;
      const o = p.equipo[r];
      if (o !== null) {
        detalle = h("div", { class: "detalle" }, fichaEquipo(o),
          h("button", {
            onclick: () => {
              const res = p.desequipar(r);
              if (!res.ok) this.toast(textoError(res.error), "#ff9a4d");
              refrescar();
            },
          }, "Quitar"));
      } else {
        detalle = h("div", { class: "detalle inv-vacio" }, h("div", { class: "inv-pista" }, `${NOMBRE_RANURA[r]}: vacío`), h("small", {}, "Elige una pieza de la mochila y pulsa Equipar."));
      }
    } else if (typeof sel === "object") {
      const pila = p.mochila.en(sel);
      const eq = pila !== null ? equipoDe(pila) : undefined;
      const cons = pila !== null ? apilable(pila.objeto) : undefined;
      if (eq !== undefined) {
        const destinos = ranurasDePieza(eq.ranura);
        detalle = h("div", { class: "detalle" }, fichaEquipo(eq, p.equipo[p.ranuraPara(eq)]),
          h("div", { class: "botones" },
            ...destinos.map((d, k) => h("button", {
              class: k === 0 ? "principal" : "",
              onclick: () => {
                p.equiparDesde(sel, d);
                this.audio.reproducir("recoger");
                refrescar(d);
              },
            }, destinos.length > 1 ? `Equipar en ${NOMBRE_RANURA[d]}` : "Equipar")),
            h("button", {
              onclick: () => {
                const r = p.desguazar(sel);
                if (r.ok) {
                  this.audio.reproducir("romper");
                  this.toast(`Desguazado: +${r.valor} esquirlas`, "#9fe8ff");
                }
                refrescar();
              },
            }, `Desguazar (+${valorDesguace(eq)} ◆)`)));
      } else if (cons !== undefined && pila !== null) {
        const runa = runaDeObjeto(pila.objeto);
        const caja = pila.objeto === OBJ_RELICARIO || pila.objeto === OBJ_CAJA_ALMAS ? this.detalleCaja(juego, p, pila.objeto) : null;
        detalle = h("div", { class: "detalle" },
          h("div", { class: "ficha" }, h("div", { class: "nombre", style: `color:${cons.color}` }, `${cons.nombre} ×${pila.cantidad}`), h("div", { class: "sub" }, cons.descripcion)),
          caja,
          runa !== undefined ? h("div", { class: "botones" }, ...([0, 1] as const).map((k) => h("button", {
            class: k === 0 ? "principal" : "",
            onclick: () => {
              const res = p.engarzarRuna(sel, k);
              if (!res.ok) this.toast(textoError(res.error), "#ff9a4d");
              else this.audio.reproducir("raro");
              refrescar();
            },
          }, `Engarzar en Runa ${k === 0 ? "I" : "II"}`))) : null);
      }
    }
    return h("div", { class: "inv" }, personaje, bolsa, h("section", { class: "inv-detalle" }, detalle));
  }

  private vistaCartas(juego: ConPartida, p: Partida, sel?: Posicion | Ranura | RanuraCarta): HTMLElement {
    const slots = h("div", { class: "slots-cartas mazo-almas" }, ...RANURAS_ALMA.map((r) =>
      miniCarta(p.cartaEn(r), `${NOMBRE_RANURA_ALMA[r]}${TECLA_RANURA_ALMA[r] !== "" ? ` · ${TECLA_RANURA_ALMA[r]}` : ""}`, sel === r,
        () => this.abrirInventario(juego, "cartas", r))));
    const mazo = h("div", { class: "grilla cartas" });
    for (const pos of p.mazo.posiciones()) {
      const pila = p.mazo.en(pos);
      const c = pila !== null ? cartaDe(pila) ?? null : null;
      const esSel = typeof sel === "object" && sel.casilla === pos.casilla;
      if (c === null) mazo.append(h("div", { class: "carta vacia mini" }));
      else mazo.append(miniCarta(c, "", esSel, () => this.abrirInventario(juego, "cartas", pos)));
    }
    let detalle: HTMLElement = h("div", { class: "detalle sub" },
      h("p", {}, "Mazo de almas: cada carta hace algo distinto según la ranura donde la pongas."),
      h("p", {}, "Forma: tu aspecto, el 100 % de sus stats y una pasiva para tus ataques básicos. "
        + "Habilidades I, II y III (L, U, O): una habilidad activa y una pasiva cada una. "
        + "Definitiva (P): un ataque devastador que se carga peleando, y otra pasiva."),
      h("p", {}, "El resto de las ranuras aporta un 30~40 % de los stats de la carta (+15 % si es de la familia de tu Forma). "
        + "Todo escala con las estrellas y las mejoras de la carta."));
    if (typeof sel === "number") {
      const c = p.cartaEn(sel);
      if (c !== null) {
        detalle = h("div", { class: "detalle" }, fichaCarta(c), grimorioCarta(c, sel),
          h("button", {
            onclick: () => {
              const r = p.retirarCarta(sel);
              if (!r.ok) this.toast(textoError(r.error), "#ff9a4d");
              this.abrirInventario(juego, "cartas");
            },
          }, "Retirar al mazo"));
      } else {
        detalle = h("div", { class: "detalle sub" }, `Ranura «${NOMBRE_RANURA_ALMA[sel]}» vacía: elige una carta del mazo y pulsa el botón de esta ranura.`);
      }
    } else if (typeof sel === "object") {
      const pila = p.mazo.en(sel);
      const c = pila !== null ? cartaDe(pila) : undefined;
      if (c !== undefined) {
        const asignar = (r: RanuraCarta): void => {
          p.asignarCarta(sel, r);
          this.audio.reproducir("raro");
          this.abrirInventario(juego, "cartas", r);
        };
        detalle = h("div", { class: "detalle" }, fichaCarta(c),
          h("div", { class: "botones" }, ...RANURAS_ALMA.map((r) =>
            h("button", { class: r === 0 ? "principal" : "", onclick: () => asignar(r) }, NOMBRE_RANURA_ALMA[r]))),
          grimorioCarta(c));
      }
    }
    // Esencias de lo equipado y Códice de Resonancias (las no descubiertas, ocultas).
    const esencias = h("div", { class: "esencias-mazo" }, ...([1, 2, 3] as const).map((r) => {
      const c = p.cartaEn(r);
      if (c === null) return h("span", { class: "esencia vacia" }, `${NOMBRE_RANURA_ALMA[r]}: —`);
      const hab = grimorio(c.personaje).habilidades[r - 1];
      const es = INFO_ESENCIA[esenciaDe(hab, alma(c.personaje).tipo)];
      return h("span", { class: "esencia", style: `--c:${es.color}` }, `${NOMBRE_RANURA_ALMA[r]}: ${es.icono} ${es.nombre}`);
    }));
    const descubiertas = RESONANCIAS.filter((x) => this.meta.resonanciaDescubierta(x.id)).length;
    const codice = h("div", { class: "codice" },
      h("h3", {}, `Códice de Resonancias · ${descubiertas}/${RESONANCIAS.length}`),
      h("p", { class: "sub" }, `Usa una habilidad y, en menos de ${String(VENTANA_RESONANCIA).replace(".", ",")} s, otra de OTRA ranura: si sus esencias combinan, resuenan en algo nuevo.`),
      esencias,
      h("div", { class: "codice-lista" }, ...RESONANCIAS.map((x) => this.meta.resonanciaDescubierta(x.id)
        ? h("div", { class: "resonancia on", style: `--c:${x.color}` },
          h("b", {}, x.nombre),
          h("small", {}, x.esencias.map((e) => `${INFO_ESENCIA[e].icono} ${INFO_ESENCIA[e].nombre}`).join(" + ")),
          h("span", { class: "sub" }, x.descripcion))
        : h("div", { class: "resonancia" }, h("b", {}, "???"), h("small", {}, "Dos esencias por descubrir")))));
    return h("div", { class: "vista" }, h("div", { class: "col" }, h("h3", {}, "Mazo de almas (5 ranuras)"), slots, codice, h("h3", {}, "Cartas"), mazo), detalle);
  }

  private vistaHabilidades(juego: ConPartida, p: Partida): HTMLElement {
    const refrescar = (): void => this.abrirInventario(juego, "habilidades");
    const filas = STATS.map((stat: Stat) => {
      const pts = p.puntoEn(stat);
      const factor = HABILIDADES_PORTADOR.factor[stat] ?? 0;
      const tope = HABILIDADES_PORTADOR.tope(p.nivel());
      return h("div", { class: "punto" },
        h("span", {}, NOMBRE_STAT[stat]),
        h("span", { class: "sub" }, `+${factor % 1 === 0 ? factor : factor.toFixed(1)} por punto`),
        h("b", {}, `${pts}`),
        h("span", { class: "sub" }, `= +${Math.floor(pts * factor)}`),
        h("button", {
          disabled: p.puntos.disponibles < 1 || pts >= tope,
          onclick: () => {
            const r = p.asignarPunto(stat);
            if (!r.ok) this.toast(textoError(r.error), "#ff9a4d");
            else this.audio.reproducir("recoger");
            refrescar();
          },
        }, "+1"),
        h("button", {
          disabled: p.puntos.disponibles < 1 || pts >= tope,
          onclick: () => {
            p.asignarPunto(stat, Math.min(5, p.puntos.disponibles));
            this.audio.reproducir("recoger");
            refrescar();
          },
        }, "+5"));
    });
    const costoReinicio = 40 * p.piso;
    const sendas = (Object.keys(SENDAS) as Senda[]).map((senda) => {
      const info = SENDAS[senda];
      return h("div", { class: "senda", style: `--c:${info.color}` },
        h("b", { style: `color:${info.color}` }, info.nombre),
        h("small", { class: "sub" }, info.lema),
        ...TALENTOS.filter((t) => t.senda === senda).map((t) => {
          const aprendido = p.tieneTalento(t.id);
          return h("button", {
            class: `talento${aprendido ? " aprendido" : ""}`,
            disabled: aprendido,
            onclick: () => {
              const r = p.aprenderTalento(t.id);
              if (!r.ok) {
                this.audio.reproducir("fallo");
                this.toast(textoError(r.error), "#ff9a4d");
              } else {
                this.audio.reproducir("nivel");
                this.toast(`Talento aprendido: ${t.nombre}`, info.color);
              }
              refrescar();
            },
          }, h("small", {}, `Grado ${t.grado}${aprendido ? " · aprendido" : ""}`), h("b", {}, t.nombre), h("span", { class: "sub" }, t.descripcion));
        }));
    });
    return h("div", { class: "vista" },
      h("div", { class: "col" },
        h("h3", {}, `Puntos de stats · libres: ${p.puntos.disponibles}`),
        h("p", { class: "sub" }, `Ganas 3 por nivel. Tope por stat: ${HABILIDADES_PORTADOR.tope(p.nivel())} (sube con tu nivel).`),
        ...filas,
        h("button", {
          disabled: p.puntos.total === p.puntos.disponibles,
          onclick: () => {
            const r = p.redistribuirPuntos(costoReinicio);
            if (!r.ok) this.toast(textoError(r.error), "#ff9a4d");
            refrescar();
          },
        }, `Redistribuir puntos (${costoReinicio} ◆)`)),
      h("div", { class: "col" },
        h("h3", {}, `Talentos · puntos libres: ${p.puntosTalento()}`),
        h("p", { class: "sub" }, "1 punto por nivel. Cada senda se aprende en orden."),
        h("div", { class: "sendas" }, ...sendas)));
  }

  private vistaStats(p: Partida): HTMLElement {
    const capas = p.capas();
    const total = p.stats();
    const nombres = Object.keys(capas);
    const tabla = h("table", { class: "desglose" },
      h("tr", {}, h("th", {}, "Stat"), ...nombres.map((n) => h("th", {}, n)), h("th", {}, "Total")),
      ...STATS.map((s) => h("tr", {},
        h("td", {}, NOMBRE_STAT[s]),
        ...nombres.map((n) => h("td", { class: (capas[n][s] ?? 0) === 0 ? "cero" : "" }, `${Math.round(capas[n][s] ?? 0)}`)),
        h("td", { class: "total" }, `${total[s]}`))));
    const efectos = [...p.efectos()].map((e) => {
      const u = RANURAS.map((r) => p.equipo[r]).find((o) => o?.efecto === e);
      return u !== undefined && u !== null ? h("div", { class: "efecto" }, `✦ ${u.nombre}: ${unico(u.base)?.descripcion ?? ""}`) : null;
    });
    const sinVidrio = bloque(Object.values(capas)).hp;
    const pot = p.potencias();
    const mods = p.combate();
    const estilo = p.estilo();
    const efectosAlma = p.efectosAlma();
    const danio = h("div", { class: "danios" },
      h("div", {}, h("small", {}, `Golpe (${estilo.nombre})`), h("b", {}, `${pot.golpe}`), h("small", {}, `combo completo ${pot.combo}`)),
      h("div", {}, h("small", {}, "Patada"), h("b", {}, `${pot.patada}`), h("small", {}, "rompe guardias")),
      ...([1, 2, 3, 4] as const).map((r) => {
        const hab = p.habilidad(r);
        return h("div", {}, h("small", {}, `${NOMBRE_RANURA_ALMA[r]} (${TECLA_RANURA_ALMA[r]})`),
          h("b", { style: hab !== null ? `color:${hab.def.color}` : "" }, hab === null ? "—" : `${Math.round(hab.potencia * p.multiplicadorDanio())}`),
          h("small", {}, hab === null ? "ranura vacía" : `${hab.def.nombre}${r === 4 ? "" : ` · ${hab.costo} éter`}`));
      }),
      h("div", {}, h("small", {}, "Crítico"), h("b", {}, `${total.critico} %`), h("small", {}, `×${(1.75 + mods.critDanio).toFixed(2).replace(".", ",")} de daño`)));
    const filaMod = (nombre: string, v: number, sufijo = " %"): HTMLElement | null =>
      v === 0 ? null : h("span", { class: "stat" }, `${nombre} `, h("b", {}, `+${sufijo === " %" ? Math.round(v * 100) : v}${sufijo}`));
    const modsUi = h("div", { class: "stats" },
      h("span", { class: "stat" }, "Alcance ", h("b", {}, estilo.id === "arco" ? `${Math.round(estilo.alcance * (1 + mods.alcance))} px` : `${Math.round(estilo.alcance * (1 + mods.alcance))} px`)),
      filaMod("Vel. de ataque", mods.velocidad), filaMod("Daño crítico", mods.critDanio), filaMod("Movimiento", mods.agilidad),
      filaMod("Daño de técnica", mods.tecnicaDanio), filaMod("Ahorro de éter", mods.tecnicaCosto), filaMod("Robo de vida", mods.robo),
      filaMod("Éter por golpe", mods.eterGolpe, ""));
    return h("div", { class: "vista una" },
      h("h3", {}, `Daño por ataque (antes de la defensa enemiga) · ${estilo.nombre}`),
      danio,
      modsUi,
      Object.keys(efectosAlma).length > 0
        ? h("div", { class: "pasiva" }, `Pasivas de alma, míticas y modificadores del equipo: ${describirEfectos(efectosAlma)}`) : null,
      (() => {
        const suerte = total.suerte;
        const b = p.modificadoresBotin();
        return h("div", { class: "suerte-info" },
          h("b", {}, `Suerte ${suerte}`),
          ` · botín ×${b.suerte.toFixed(2).replace(".", ",")} · rarezas altas +${Math.round(suerte * 0.35)} % por escalón`
          + ` · ${Math.round(Math.min(0.4, suerte / 500) * 100)} % de que una carta suba una estrella`
          + ` · esquirlas ×${b.codicia.toFixed(2).replace(".", ",")}`);
      })(),
      h("h3", {}, "Desglose de stats"),
      tabla,
      total.hp !== sinVidrio ? h("div", { class: "sub" }, `Sangre de Vidrio reduce tu vida de ${sinVidrio} a ${total.hp}.`) : null,
      ...efectos,
      h("h3", {}, "Conjuntos y runas"),
      ...[...p.piezasConjunto()].map(([id, n]) => {
        const c = CONJUNTOS.find((x) => x.id === id)!;
        return h("div", { class: "conjunto", style: `--c:${c.color}` },
          h("b", {}, `${c.nombre} (${n} piezas)`),
          h("div", { class: n >= 2 ? "sube" : "sub" }, `(2) ${c.dos.descripcion}`),
          h("div", { class: n >= 4 ? "sube" : "sub" }, `(4) ${c.cuatro.descripcion}`),
          h("div", { class: n >= 6 ? "sube" : "sub" }, `(6) ${c.seis.descripcion}`));
      }),
      ...([0, 1] as const).filter((k) => p.runas[k] !== null).map((k) => {
        const def = runaDeObjeto(objetoRuna(p.runas[k]!, p.nivelesRuna[k]))!;
        return h("div", { style: `color:${def.color}` }, `◆ ${nombreRuna(def)}: ${def.descripcion}`);
      }),
      p.piezasConjunto().size === 0 && p.runas.every((r) => r === null) ? h("p", { class: "sub" }, "Sin conjuntos ni runas. Las piezas de conjunto caen en cada zona y los guardianes siempre sueltan una.") : null,
      h("h3", {}, "Reliquias"),
      h("div", { class: "reliquias" }, ...RELIQUIAS.map((r) =>
        h("span", { class: this.meta.tieneReliquia(r) ? "rel si" : "rel no", style: `--c:${INFO_RELIQUIA[r].color}`, title: INFO_RELIQUIA[r].descripcion },
          this.meta.tieneReliquia(r) ? INFO_RELIQUIA[r].nombre : "???"))),
      h("div", { class: "sub" }, `Enemigos ${p.enemigos} · Jefes ${p.jefes} · Ecos vencidos ${p.ecosVencidos}`));
  }

  // =============================== Altar ===============================

  abrirAltar(juego: ConPartida, elegidas: Posicion[] = [], lagrima = false, mensaje?: HTMLElement): void {
    const p = juego.partida;
    const cartasMazo: { pos: Posicion; carta: Carta }[] = [];
    for (const pos of p.mazo.posiciones()) {
      const pila = p.mazo.en(pos);
      const c = pila !== null ? cartaDe(pila) : undefined;
      if (c !== undefined) cartasMazo.push({ pos, carta: c });
    }
    const esElegida = (pos: Posicion): boolean => elegidas.some((e) => e.casilla === pos.casilla);
    const grilla = h("div", { class: "grilla cartas" }, ...cartasMazo.map(({ pos, carta }) =>
      miniCarta(carta, "", esElegida(pos), () => {
        const nuevas = esElegida(pos) ? elegidas.filter((e) => e.casilla !== pos.casilla) : [...elegidas, pos].slice(-3);
        this.abrirAltar(juego, nuevas, lagrima);
      })));

    const sel = elegidas.map((pos) => cartasMazo.find((c) => c.pos.casilla === pos.casilla)?.carta).filter((c): c is Carta => c !== undefined);
    const n = sel[0]?.nivel ?? -1;
    const compatibles = sel.every((c) => c.nivel === n);
    // Sello 100 %: el Dado del Destino de esa estrella; si no hay, una Lágrima de Eco.
    const dado = n >= 0 ? dadoParaNivel(n) : undefined;
    const dados = dado !== undefined ? p.mochila.contar(dado) : 0;
    const lagrimas = p.mochila.contar(OBJ_LAGRIMA);
    const selloDisponible = dados > 0 || lagrimas > 0;
    const usaSello = lagrima && selloDisponible;
    const sello = dados > 0 && dado !== undefined
      ? { id: dado, nombre: `Dado del Destino ${n + 2}★`, cantidad: dados }
      : { id: OBJ_LAGRIMA, nombre: "Lágrima de Eco", cantidad: lagrimas };
    const costo = n >= 0 ? COSTO_FUSION[n] ?? 0 : 0;
    const prob = n < 0 ? 0 : n >= NIVEL_MAX_CARTA ? 0 : usaSello ? 1 : Math.min(1, PROB_FUSION[n] + p.bonoFusion());

    const ranuraCarta = (i: number): HTMLElement => {
      const c = sel[i];
      if (c === undefined) return h("div", { class: "ranura-fusion vacia" }, h("small", {}, `Alma ${i + 1}`), h("span", {}, "+"));
      return h("div", { class: "ranura-fusion llena" },
        miniCarta(c, `Alma ${i + 1}`, false, () => this.abrirAltar(juego, elegidas.filter((_, k) => k !== i), lagrima)));
    };
    const ranuraSello = h("button", {
      class: `ranura-fusion sello${usaSello ? " activo" : ""}${selloDisponible ? "" : " agotado"}`,
      disabled: !selloDisponible || n < 0,
      title: "Asegura la fusión: sube de estrella con 100 % de probabilidad",
      onclick: () => this.abrirAltar(juego, elegidas, !lagrima),
    },
    h("small", {}, "Sello 100 %"),
    lienzoIcono(iconoObjeto(sello.id), 3) ?? h("span", { class: "glifo" }, "⚅"),
    h("b", {}, n < 0 ? "Elige cartas" : selloDisponible ? sello.nombre : "Sin sello"),
    h("span", { class: "sub" }, n < 0 ? "—" : selloDisponible ? `${usaSello ? "Colocado" : "Clic para colocar"} · tienes ${sello.cantidad}` : "Cómpralo en el Bazar"));

    const resultado = h("div", { class: "resultado-fusion" },
      h("small", {}, "Resultado"),
      h("div", { class: "estrellas-meta" }, n < 0 ? "?" : textoEstrellas(Math.min(n + 1, NIVEL_MAX_CARTA))),
      h("div", { class: "prob" }, h("i", { style: `width:${Math.round(prob * 100)}%` })),
      h("span", {}, n < 0 ? "Probabilidad —" : `Probabilidad ${Math.round(prob * 100)} %`),
      h("span", { class: p.esquirlas >= costo ? "sub" : "baja" }, n < 0 ? "" : `Costo ${costo} ◆`));

    const listo = sel.length === 3 && compatibles && n < NIVEL_MAX_CARTA;
    const mesa = h("div", { class: `mesa-fusion${usaSello ? " sellada" : ""}` },
      ranuraCarta(0), ranuraCarta(1), ranuraCarta(2),
      h("span", { class: "signo" }, "+"), ranuraSello,
      h("span", { class: "signo" }, "→"), resultado);

    const avisos: (HTMLElement | null)[] = [
      sel.length === 0 ? h("p", { class: "sub" }, "Elige tres cartas con la misma cantidad de estrellas (de cualquier alma) en tu mazo: sale una de las tres. Clic en una ranura para sacarla.") : null,
      sel.length > 0 && !compatibles ? h("p", { class: "baja" }, "No tienen la misma cantidad de estrellas.") : null,
      dado !== undefined && dados === 0 ? h("p", { class: "sub" }, `El Dado del Destino ${n + 2}★ se compra en el Bazar del Pozo (${PRECIO_DADO[n - 2]} ◆). La Lágrima de Eco sirve para cualquier estrella.`) : null,
    ];
    const fusionar: HTMLElement = h("button", {
      class: "principal boton-fusion",
      disabled: !listo,
      onclick: () => {
        const r = p.fusionar([elegidas[0], elegidas[1], elegidas[2]], usaSello);
        if (!r.ok) {
          this.audio.reproducir("fallo");
          this.abrirAltar(juego, elegidas, lagrima, h("p", { class: "baja" }, textoError(r.error)));
          return;
        }
        this.audio.reproducir("fusion");
        this.acciones.guardar();
        this.abrirAltar(juego, [], false, h("div", { class: r.valor.subio ? "resultado sube" : "resultado" },
          r.valor.subio ? "¡La fusión asciende!" : "Las almas se reforjan sin ascender…",
          fichaCarta(r.valor.carta)));
      },
    }, usaSello ? "Fusionar (asegurada)" : "Fusionar");
    const info = h("div", {}, ...avisos);

    // Mejora con Polvo de Eco
    const polvo = p.mochila.contar(OBJ_POLVO);
    const mejorables: [RanuraCarta | Posicion, Carta][] = [];
    for (const r of RANURAS_ALMA) {
      const c = p.cartaEn(r);
      if (c !== null) mejorables.push([r, c]);
    }
    const mejora = h("div", { class: "mejoras" }, ...mejorables.map(([obj, c]) =>
      h("button", {
        disabled: polvo < 1 || c.mejoras >= MEJORAS_MAX,
        onclick: () => {
          const r = p.mejorar(obj);
          if (!r.ok) {
            this.audio.reproducir("fallo");
            this.toast(textoError(r.error), "#ff9a4d");
          } else {
            this.audio.reproducir("raro");
            this.toast(`${nombreCarta(r.valor.carta)}: +${r.valor.incremento} a todo`, "#c9a7ff");
          }
          this.abrirAltar(juego, elegidas, lagrima);
        },
      }, `${typeof obj === "number" ? NOMBRE_RANURA_ALMA[obj] : "Mazo"}: ${alma(c.personaje).nombre} ${estrellas(c)} (${c.mejoras}/${MEJORAS_MAX})`)));

    const enPueblo = !("mapa" in juego);
    this.abrirTienda("altar", enPueblo ? "altar" : "altarPozo", this.botonCerrar(),
      cabeceraTienda(enPueblo ? "altar" : "altarPozo", [esquirlas(p.esquirlas), monedaPolvo(polvo)]),
      h("h3", {}, "Fusión: tres almas, una sola voz"),
      mesa, info, fusionar, mensaje ?? null,
      h("div", { class: "vista" },
        h("div", { class: "col" }, h("h3", {}, "Tu mazo"), grilla),
        h("div", { class: "detalle" },
          h("h3", {}, `Mejora · Polvo de Eco: ${polvo}`),
          h("p", { class: "sub" }, "Cada polvo suma +1~+5 a todos los stats de una carta equipada (máx. 5 veces)."),
          mejora)));
  }

  // =============================== Yunque ===============================

  abrirYunque(juego: ConPartida, resultado?: HTMLElement): void {
    const p = juego.partida;
    const refrescar = (r?: HTMLElement): void => this.abrirYunque(juego, r);
    const materiales = h("div", { class: "materiales" }, ...MATERIALES.map((m) =>
      h("span", { style: `color:${m.color}`, title: m.descripcion }, `${m.nombre}: `, h("b", {}, `${p.mochila.contar(m.id)}`))));
    const recetas = RECETAS.map((r) => {
      const falta = faltantes(p, r);
      const ok = puedeCraftear(p, r);
      return h("div", { class: `receta${ok ? " lista" : ""}` },
        h("b", {}, r.nombre),
        h("span", { class: "sub" },
          ...r.ingredientes.map(([id, n]) => {
            const def = apilable(id);
            const tiene = p.mochila.contar(id);
            return h("span", { class: tiene >= n ? "sube" : "baja" }, `${def?.nombre ?? id} ${tiene}/${n}  `);
          }),
          r.esquirlas > 0 ? h("span", { class: p.esquirlas >= r.esquirlas ? "sube" : "baja" }, `◆ ${r.esquirlas}`) : null),
        h("button", {
          disabled: !ok,
          title: falta.map((f) => `Faltan ${f.faltan} ${f.nombre}`).join(", "),
          onclick: () => {
            const res = craftear(p, r);
            if (!res.ok) {
              this.audio.reproducir("fallo");
              refrescar(h("p", { class: "baja" }, textoError(res.error)));
              return;
            }
            this.audio.reproducir(r.resultado.tipo === "objeto" ? "recoger" : "raro");
            refrescar(h("p", { class: "resultado sube" }, `Forjado: ${res.valor}`));
          },
        }, "Craftear"));
    });
    const refinar = RANURAS.map((ranura) => {
      const o = p.equipo[ranura];
      const nivel = o?.refinado ?? 0;
      const eleccion = nivel >= NIVEL_ELECCION_TEMPLADO;
      const frag = p.mochila.contar(MAT_FRAGMENTO);
      const templar = (modo: ModoTemplado): void => {
        const res = refinarEquipado(p, ranura, modo);
        if (!res.ok) {
          this.audio.reproducir("fallo");
          refrescar(h("p", { class: "baja" }, textoError(res.error)));
          return;
        }
        this.audio.reproducir(modo === "abisal" ? "explosion" : "fusion");
        const pc = res.valor.pactoNuevo;
        refrescar(h("div", { class: `resultado sube${pc !== undefined ? " abisal" : ""}` },
          pc !== undefined ? `¡Templado Abisal! El Pozo sella un pacto: ${pc.nombre}` : "¡Templado!",
          fichaEquipo(res.valor)));
      };
      const boton = (modo: ModoTemplado, texto: string, clase = ""): HTMLElement => {
        const c = costoTemplado(nivel, modo);
        return h("button", {
          class: clase,
          disabled: o === null || nivel >= REFINADO_MAX || frag < c.fragmentos || p.esquirlas < c.esquirlas,
          title: `Fragmentos de Eco ${frag}/${c.fragmentos} · ◆ ${c.esquirlas}`,
          onclick: () => templar(modo),
        }, `${texto} · ${c.fragmentos}✦ ${c.esquirlas}◆`);
      };
      return h("div", { class: "receta" },
        h("b", { style: o !== null ? `color:${COLORES_RAREZA[o.rareza]}` : "" }, o?.nombre ?? `${NOMBRE_RANURA[ranura]}: nada equipado`),
        h("span", { class: "sub" }, o === null ? "" : nivel >= REFINADO_MAX ? "Templado al máximo"
          : eleccion ? `+${nivel}→+${nivel + 1} · +12 % a todo. Nunca falla: elige cómo templar.` : `+${nivel}→+${nivel + 1} · +12 % a todo. Nunca falla.`),
        o !== null && (o.pactos ?? []).length > 0 ? h("span", { class: "baja" }, `Pactos: ${(o.pactos ?? []).map((id) => pacto(id)?.nombre ?? id).join(", ")}`) : null,
        o === null || nivel >= REFINADO_MAX ? null
          : eleccion
            ? h("div", { class: "botones" },
              boton("seguro", "Templado Seguro"),
              boton("abisal", "Templado Abisal (pacto)", "peligro"))
            : boton("normal", "Templar"));
    });
    const enPueblo = !("mapa" in juego);
    // Forja Mítica: solo en el pueblo y si Dorn recuperó su martillo.
    const mitica = !enPueblo ? null : !p.historiaCumplida("dorn")
      ? h("p", { class: "sub" }, "Dorn guarda un secreto de forja. Habla con él (↑) en la Fragua.")
      : h("div", { class: "receta mitica" },
        h("b", { style: "color:#ff4d6d" }, "Forja Mítica (Martillo de Dorn)"),
        h("span", { class: "sub" }, `Una pieza Mítica con nombre · Fragmentos de Eco ${p.mochila.contar(MAT_FRAGMENTO)}/${COSTO_FORJA_MITICA.fragmentos} · ◆ ${COSTO_FORJA_MITICA.esquirlas}`),
        h("button", {
          class: "principal",
          disabled: p.mochila.contar(MAT_FRAGMENTO) < COSTO_FORJA_MITICA.fragmentos || p.esquirlas < COSTO_FORJA_MITICA.esquirlas,
          onclick: () => {
            const r = forjaMitica(p);
            if (!r.ok) {
              this.audio.reproducir("fallo");
              refrescar(h("p", { class: "baja" }, textoError(r.error)));
              return;
            }
            this.audio.reproducir("unico");
            this.acciones.guardar();
            refrescar(h("div", { class: "resultado sube" }, "¡Forja Mítica!", fichaEquipo(r.valor)));
          },
        }, "Forjar"));
    // Fusión de runas: tres iguales de la misma rareza → una de la rareza siguiente.
    const fusionables = [...new Set([...p.mochila.posiciones()].map((q) => p.mochila.en(q)?.objeto).filter((o): o is number => o !== undefined))]
      .map((o) => ({ o, ru: runaDeObjeto(o), n: p.mochila.contar(o) }))
      .filter((x) => x.ru !== undefined);
    const runasUi = fusionables.length === 0 ? h("p", { class: "sub" }, "No llevas runas. Caen de élites, cofres y guardianes; tres iguales se funden en una más rara.")
      : h("div", {}, ...fusionables.map(({ o, ru, n }) => {
        const r = ru!;
        const max = r.nivel >= RAREZA_RUNA_MAX;
        const costo = max ? 0 : COSTO_FUSION_RUNA[r.nivel];
        return h("div", { class: "receta" },
          h("b", { style: `color:${COLORES_RAREZA_RUNA[r.nivel]}` }, `${nombreRuna(r)} ×${n}`),
          h("span", { class: "sub" }, max ? "Rareza máxima." : `3 → ${NOMBRES_RAREZA_RUNA[r.nivel + 1]} (${r.texto([1, 1.5, 2.2, 3.2][r.nivel + 1])})`),
          h("button", {
            disabled: max || n < 3 || p.esquirlas < costo,
            onclick: () => {
              const res = fusionarRunas(p, o);
              this.audio.reproducir(res.ok ? "unico" : "fallo");
              this.acciones.guardar();
              refrescar(h("p", { class: res.ok ? "resultado sube" : "baja" }, res.ok ? `¡Runa fundida! ${res.valor}` : textoError(res.error)));
            },
          }, max ? "—" : `Fundir · ${costo} ◆`));
      }));
    this.abrirTienda("yunque", enPueblo ? "herrero" : "yunqueFaro", this.botonCerrar(),
      cabeceraTienda(enPueblo ? "herrero" : "yunqueFaro", [esquirlas(p.esquirlas)]),
      h("h3", {}, "Materiales"),
      materiales,
      resultado ?? null,
      h("h3", {}, "Recetas"), ...recetas,
      mitica,
      h("h3", {}, "Refinar equipo puesto"), ...refinar,
      h("h3", {}, "Fundir runas"), runasUi);
  }

  // =============================== Mercader ===============================

  abrirMercader(juego: ConPartida, errante?: { lista: readonly ArticuloErrante[]; comprar: (i: number) => boolean }): void {
    const p = juego.partida;
    const rarezas = errante === undefined ? null : h("div", {},
      h("h3", {}, "Rarezas del errante · solo en este piso"),
      errante.lista.length === 0 ? h("p", { class: "sub" }, "Ya no le queda nada raro que ofrecerte.") : null,
      h("div", { class: "catalogo" }, ...errante.lista.map((art, i) => h("div", { class: "articulo-ficha venta", style: `--c:${COLORES_RAREZA[art.equipo.rareza]}` },
        fichaEquipo(art.equipo, p.equipo[p.ranuraPara(art.equipo)]),
        h("button", {
          class: "principal",
          disabled: p.esquirlas < art.precio,
          onclick: () => {
            const ok = errante.comprar(i);
            this.audio.reproducir(ok ? "unico" : "fallo");
            if (!ok) this.toast(p.esquirlas < art.precio ? "No te alcanzan las esquirlas" : "No tienes espacio en la mochila", "#ff9a4d");
            this.abrirMercader(juego, errante);
          },
        }, `Comprar · ${art.precio} ◆`)))));
    const venta = CONSUMIBLES.map((c) => h("div", { class: "articulo" },
      h("span", { style: `color:${c.color}` }, c.nombre),
      h("span", { class: "sub" }, c.descripcion),
      h("button", {
        disabled: p.esquirlas < c.precio,
        onclick: () => {
          const r = p.comprar(c.id);
          if (r.ok) this.audio.reproducir("recoger");
          else {
            this.audio.reproducir("fallo");
            this.toast(textoError(r.error), "#ff9a4d");
          }
          this.abrirMercader(juego, errante);
        },
      }, `${c.precio} ◆`)));
    const desguace: HTMLElement[] = [];
    for (const pos of p.mochila.posiciones()) {
      const pila = p.mochila.en(pos);
      const eq = pila !== null ? equipoDe(pila) : undefined;
      if (eq === undefined) continue;
      desguace.push(h("div", { class: "articulo" },
        h("span", { style: `color:${COLORES_RAREZA[eq.rareza]}` }, eq.nombre),
        h("span", { class: "sub" }, `${NOMBRES_RAREZA[eq.rareza]} · Nv ${eq.nivel}`),
        h("button", {
          onclick: () => {
            const r = p.desguazar(pos);
            if (r.ok) this.audio.reproducir("romper");
            this.abrirMercader(juego, errante);
          },
        }, `+${valorDesguace(eq)} ◆`)));
    }
    this.abrirTienda("mercader", "mercaderPozo", this.botonCerrar(),
      cabeceraTienda("mercaderPozo", [esquirlas(p.esquirlas)]),
      rarezas,
      h("h3", {}, "Comprar"), ...venta,
      h("h3", {}, "Desguazar equipo"), desguace.length > 0 ? h("div", {}, ...desguace) : h("p", { class: "sub" }, "No llevas equipo para desguazar."));
  }

  // =============================== Pueblo ===============================

  /** Taberna: tablón de misiones (minialu/RegistroMisiones) y memorial. */
  abrirTaberna(juego: ConPartida, aviso?: HTMLElement): void {
    const p = juego.partida;
    const refrescar = (a?: HTMLElement): void => this.abrirTaberna(juego, a);
    const activas = p.misiones.listaActivas();
    const recompensa = (id: number): string => {
      const r = mision(id)?.recompensa;
      if (r === undefined) return "";
      const partes = [r.exp !== undefined ? `${r.exp} EXP` : null, ...Object.entries(r.monedas ?? {}).map(([m, n]) => `${n} ${m}`),
        ...(r.objetos ?? []).map((o) => `${apilable(o.objeto)?.nombre ?? "objeto"} ×${o.cantidad}`)];
      return partes.filter((x) => x !== null).join(" · ");
    };
    const filaActiva = (a: { id: number; progreso: number[] }): HTMLElement => {
      const def = mision(a.id)!;
      const info = INFO_MISIONES[a.id];
      const completa = p.misiones.completa(a.id);
      return h("div", { class: `mision${completa ? " completa" : ""}` },
        h("b", {}, info?.titulo ?? `Misión ${a.id}`),
        ...def.objetivos.map((o, k) => h("div", { class: "objetivo" },
          h("span", {}, info?.objetivos[k] ?? o.tipo), h("span", { class: "sub" }, ` ${a.progreso[k]}/${o.cantidad}`),
          h("span", { class: "barra" }, h("i", { style: `width:${Math.round((a.progreso[k] / o.cantidad) * 100)}%` })))),
        h("div", { class: "sub" }, `Recompensa: ${recompensa(a.id)}`),
        h("div", { class: "botones" },
          completa
            ? h("button", {
              class: "principal",
              onclick: () => {
                const r = p.entregarMision(a.id);
                this.audio.reproducir(r.ok ? "nivel" : "fallo");
                this.acciones.guardar();
                refrescar(h("p", { class: r.ok ? "resultado sube" : "baja" }, r.ok ? `Recompensa: ${r.valor.join(" · ")}` : String(r.error)));
              },
            }, "Entregar")
            : h("button", { onclick: () => { p.misiones.abandonar(a.id); refrescar(); } }, "Abandonar")));
    };
    // Se pueden aceptar aunque estén las 3 activas ocupadas (el botón queda deshabilitado): se listan igual.
    const libre = (id: number): boolean => {
      const r = p.misiones.puedeAceptar(id, p.nivel());
      return r.ok || r.error === "demasiadas";
    };
    const disponibles = MISIONES.filter((m) => libre(m.id)).sort((a, b) => (m2(a) - m2(b)) || a.id - b.id).slice(0, 8);
    const entregadas = MISIONES.filter((m) => m.repetible !== true && p.misiones.exportar().entregadas.includes(m.id)).length;
    const totalUnicas = MISIONES.filter((m) => m.repetible !== true).length;
    this.abrirTienda("taberna", "taberna", this.botonCerrar(),
      cabeceraTienda("taberna", [esquirlas(p.esquirlas)]),
      aviso ?? null,
      this.registroDesafios(p),
      h("div", { class: "vista" },
        h("div", { class: "col" },
          h("h3", {}, `Misiones activas (${activas.length}/${MAX_MISIONES_ACTIVAS})`),
          activas.length === 0 ? h("p", { class: "sub" }, "Ninguna. Elige del tablón.") : null,
          ...activas.map(filaActiva)),
        h("div", { class: "col" },
          h("h3", {}, `Tablón · ${entregadas}/${totalUnicas} misiones cumplidas · ${MISIONES.length} en total`),
          disponibles.length === 0 ? h("p", { class: "sub" }, "No hay encargos nuevos por ahora.") : null,
          ...disponibles.map((m) => h("div", { class: "mision" },
            h("b", {}, INFO_MISIONES[m.id]?.titulo ?? `Misión ${m.id}`),
            h("small", { class: "etiqueta-mision" }, `Zona ${INFO_MISIONES[m.id]?.zona ?? "?"} · ${NOMBRE_LINEA[INFO_MISIONES[m.id]?.linea ?? "encargo"]}`),
            h("div", { class: "sub" }, INFO_MISIONES[m.id]?.descripcion ?? ""),
            h("div", { class: "sub" }, (INFO_MISIONES[m.id]?.objetivos ?? []).join(" · ")),
            h("div", { class: "sub" }, `Recompensa: ${recompensa(m.id)}`),
            h("button", {
              disabled: activas.length >= MAX_MISIONES_ACTIVAS,
              onclick: () => {
                const r = p.misiones.aceptar(m.id, p.nivel());
                this.audio.reproducir(r.ok ? "recoger" : "fallo");
                refrescar();
              },
            }, "Aceptar"))),
          h("button", { onclick: () => this.mostrarMemorial() }, "Memorial de los Ecos"))));
  }

  /** Registro de desafíos: arenas, récords y la Piedra del Juicio con los afijos de esta semana. */
  private registroDesafios(p: Partida): HTMLElement {
    const r = this.meta.registro;
    const semana = semanaDe(new Date());
    const piedra = p.piedraJuicio;
    const afijos = afijosJuicio(Math.max(piedra, 10), semana);
    return h("div", { class: "registro-desafios" },
      h("h3", {}, "Registro de desafíos"),
      h("div", { class: "records" },
        h("div", {}, h("b", {}, String(r.arenas ?? 0)), h("small", {}, "arenas superadas")),
        h("div", {}, h("b", {}, String(r.arenasIntocables ?? 0)), h("small", {}, "intocables")),
        h("div", {}, h("b", {}, `${r.mejorReloj ?? 0} s`), h("small", {}, "mejor Reloj de Arena")),
        h("div", {}, h("b", {}, `×${r.mayorRacha ?? 0}`), h("small", {}, "mayor racha")),
        h("div", {}, h("b", {}, piedra > 0 ? `+${piedra}` : "—"), h("small", {}, "Piedra del Juicio")),
        h("div", {}, h("b", {}, r.mejorJuicio !== undefined ? `+${r.mejorJuicio}` : "—"), h("small", {}, `mejor Juicio · ${r.juiciosATiempo ?? 0} a tiempo`))),
      this.meta.venganzas.length > 0
        ? h("div", { class: "venganzas" },
          h("small", {}, "Venganzas recibidas:"),
          ...this.meta.venganzas.slice(0, 4).map((v) => h("div", { class: "venganza" }, `⚔ ${v.vengador} vengó tu caída en el piso ${v.piso} — recibiste ${v.recompensa} ◆`)))
        : null,
      piedra > 0
        ? h("div", { class: "afijos-semana" },
          h("small", {}, "Afijos del Juicio esta semana (se suman en +2, +4, +7 y +10):"),
          ...afijos.map((x, k) => h("span", { class: "afijo", style: `--c:${INFO_AFIJO_JUICIO[x].color}`, title: INFO_AFIJO_JUICIO[x].descripcion },
            `+${[2, 4, 7, 10][k]} ${INFO_AFIJO_JUICIO[x].nombre}`)))
        : h("p", { class: "sub" }, "Desbloquea el piso 12 para recibir la Piedra del Juicio: las campanas de las arenas ofrecerán desafíos de nivel con afijos semanales."));
  }

  /** Relicario en el inventario: tabla de estrellas, la garantía del bloque y el botón de abrir. */
  /** Caja en el inventario: tabla de estrellas (y la garantía si es un Relicario), abrir una o abrir todas. */
  private detalleCaja(juego: ConPartida, p: Partida, objeto: number): HTMLElement {
    const relicario = objeto === OBJ_RELICARIO;
    const desde = relicario ? NIVEL_MIN_RELICARIO : 0;
    const probs = relicario ? PROB_RELICARIO : PROB_CAJA;
    const falta = relicario ? pendientes(p.piedadRelicario) : {};
    const tabla = h("div", { class: "tabla-relicario" }, ...probs.map((pr, i) => {
      const nivel = desde + i;
      const cuota = falta[nivel];
      const aura = nivel >= NIVEL_MIN_RELICARIO;
      return h("span", { class: `aura-chip${nivel >= 11 ? " prisma" : ""}${aura ? "" : " sin-aura"}`, style: `--aura:${colorEstrella(nivel)}` },
        h("b", {}, `${nivel + 1}★`),
        h("small", {}, aura ? NOMBRE_AURA[nivel - NIVEL_MIN_RELICARIO] : "sin aura"),
        h("small", {}, `${pr * 100 < 1 ? (pr * 100).toFixed(1) : Math.round(pr * 100)} %`),
        cuota !== undefined ? h("small", { class: cuota > 0 ? "falta" : "ok" }, cuota > 0 ? `faltan ${cuota}` : "✓") : null);
    }));
    const buscar = (): Posicion | undefined => [...p.mochila.posiciones()].find((x) => p.mochila.en(x)?.objeto === objeto);
    const abrirUna = (): void => {
      const r = p.abrirCaja(objeto);
      if (!r.ok) {
        this.audio.reproducir("fallo");
        this.toast(r.error === "sin-espacio" ? "Tu mazo está lleno: haz lugar antes de abrirla" : "No te quedan", "#ff9a4d");
        return;
      }
      this.acciones.guardar();
      this.animarRelicario(r.valor.carta, r.valor.garantizada, () => this.abrirInventario(juego, "equipo", buscar()),
        p.mochila.contar(objeto) > 0 ? () => { this.abrirInventario(juego, "equipo", buscar()); abrirUna(); } : undefined, objeto);
    };
    const abrirTodas = (): void => {
      const cartas: Carta[] = [];
      while (p.mochila.contar(objeto) > 0) {
        const r = p.abrirCaja(objeto);
        if (!r.ok) break;
        cartas.push(r.valor.carta);
      }
      if (cartas.length === 0) {
        this.audio.reproducir("fallo");
        this.toast("Tu mazo está lleno: haz lugar antes de abrirlas", "#ff9a4d");
        return;
      }
      this.acciones.guardar();
      this.resumenCajas(cartas, objeto, () => this.abrirInventario(juego, "equipo", buscar()));
    };
    const cantidad = p.mochila.contar(objeto);
    return h("div", { class: "relicario-info" },
      relicario ? h("small", {}, `Garantía: apertura ${p.piedadRelicario.abiertos}/${BLOQUE_RELICARIO} del bloque. Antes de cerrarlo salen al menos 1×12★, 3×11★, 5×10★ y 8×9★.`) : null,
      tabla,
      h("div", { class: "botones" },
        h("button", { class: `principal boton-relicario${relicario ? "" : " menor"}`, onclick: abrirUna }, relicario ? "Abrir relicario" : "Abrir caja"),
        cantidad > 1 ? h("button", { onclick: abrirTodas }, `Abrir todas (${cantidad})`) : null));
  }

  /** "Abrir todas": las cartas que salieron, de la más rara a la más común, con su aura. */
  private resumenCajas(cartas: Carta[], objeto: number, cerrar: () => void): void {
    const orden = [...cartas].sort((a, b) => b.nivel - a.nivel);
    const mejor = orden[0];
    this.audio.reproducir(mejor.nivel >= 9 ? "unico" : mejor.nivel >= 6 ? "fusion" : "raro");
    const capa = h("div", { class: "relicario-capa listo calma", style: `--aura:${colorEstrella(mejor.nivel)}` },
      h("div", { class: "relicario-titulo" }, `${objeto === OBJ_RELICARIO ? "Relicarios" : "Cajas de Almas"} abiertas: ${cartas.length}`),
      h("div", { class: "relicario-estrellas", style: `color:${colorEstrella(mejor.nivel)}` }, `Lo mejor: ${mejor.nivel + 1}★`),
      h("div", { class: "resumen-cajas" }, ...orden.map((c) => miniCarta(c, "", false, () => undefined))),
      h("div", { class: "menu" }, h("button", { class: "principal", onclick: () => { capa.remove(); cerrar(); } }, "Continuar")));
    document.body.append(capa);
  }

  /**
   * Apertura de una caja: tiembla, su luz SUBE estrella por estrella (con el color de cada una) hasta la que
   * tocó —cuanto más rara, más escalones y más suspenso— y estalla mostrando la carta con su aura.
   * Relicario: de 5★ a 12★. Caja de Almas: de 1★ a 6★. Clic para saltar la animación.
   */
  animarRelicario(carta: Carta, garantizada: boolean, cerrar: () => void, otro?: () => void, objeto = OBJ_RELICARIO): void {
    const relicario = objeto === OBJ_RELICARIO;
    const desde = relicario ? NIVEL_MIN_RELICARIO : 0;
    const capa = h("div", { class: `relicario-capa${relicario ? "" : " menor"}` });
    const lienzo = document.createElement("canvas");
    lienzo.width = 240;
    lienzo.height = 200;
    lienzo.className = "relicario-lienzo";
    const titulo = h("div", { class: "relicario-titulo" }, relicario ? "Relicario de Almas" : "Caja de Almas");
    const revelado = h("div", { class: "relicario-revelado" });
    capa.append(titulo, lienzo, revelado);
    document.body.append(capa);
    const g = lienzo.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const escalones = carta.nivel - desde;
    const T_TEMBLOR = relicario ? 1.1 : 0.7;
    const T_ESCALON = relicario ? 0.55 : 0.4;
    const total = T_TEMBLOR + (escalones + 1) * T_ESCALON + 0.4;
    const inicio = performance.now();
    let ultimo = -1;
    let terminado = false;
    const final = colorEstrella(carta.nivel);

    const revelar = (): void => {
      if (terminado) return;
      terminado = true;
      this.audio.reproducir(carta.nivel >= 9 ? "unico" : carta.nivel >= 6 ? "fusion" : carta.nivel >= 4 ? "raro" : "recoger");
      capa.style.setProperty("--aura", final);
      capa.classList.add("listo", `nivel-${carta.nivel + 1}`);
      window.setTimeout(() => capa.classList.add("calma"), 750);
      if (carta.nivel >= 11) capa.classList.add("prisma");
      const aura = carta.nivel >= NIVEL_MIN_RELICARIO ? ` · Aura ${NOMBRE_AURA[carta.nivel - NIVEL_MIN_RELICARIO]}` : "";
      revelado.append(
        h("div", { class: "relicario-estrellas", style: `color:${final}` }, `${carta.nivel + 1}★${aura}`),
        garantizada ? h("div", { class: "relicario-garantia" }, "Garantía del bloque cumplida") : "",
        miniCarta(carta, "", false, () => undefined),
        fichaCarta(carta),
        h("div", { class: "menu" },
          otro !== undefined ? h("button", { class: "principal", onclick: () => { capa.remove(); otro(); } }, relicario ? "Abrir otro" : "Abrir otra") : "",
          h("button", { class: otro === undefined ? "principal" : "", onclick: () => { capa.remove(); cerrar(); } }, "Continuar")));
    };

    const cuadro = (ahora: number): void => {
      if (!capa.isConnected) return;
      const t = terminado ? total : Math.min(total, (ahora - inicio) / 1000);
      g.clearRect(0, 0, lienzo.width, lienzo.height);
      const k = t < T_TEMBLOR ? -1 : Math.min(escalones, Math.floor((t - T_TEMBLOR) / T_ESCALON));
      const nivel = desde + Math.max(0, k);
      if (k !== ultimo && k >= 0) {
        ultimo = k;
        this.audio.reproducir(nivel >= 9 ? "unico" : nivel >= 6 ? "raro" : "recoger");
      }
      // 12★: luz prismática que recorre todos los colores.
      const color = k < 0 ? "#ffffff" : nivel >= 11 ? `hsl(${Math.floor(t * 240) % 360}, 100%, 65%)` : colorEstrella(nivel);
      const fuerza = t < T_TEMBLOR ? t / T_TEMBLOR : 1;
      const brillo = Math.max(0, nivel - 2);
      const cx = 120;
      const base = 150;
      g.save();
      g.translate(cx, base - 40);
      g.globalCompositeOperation = "lighter";
      const rayos = 6 + brillo * 2;
      for (let r = 0; r < rayos; r++) {
        const a = (r / rayos) * Math.PI * 2 + t * (0.6 + brillo * 0.12);
        g.fillStyle = color;
        g.globalAlpha = 0.12 * fuerza + (terminado ? 0.18 : 0);
        g.beginPath();
        g.moveTo(0, 0);
        const largo = 50 + brillo * 10 + (terminado ? 40 : 0);
        g.lineTo(Math.cos(a - 0.08) * largo, Math.sin(a - 0.08) * largo);
        g.lineTo(Math.cos(a + 0.08) * largo, Math.sin(a + 0.08) * largo);
        g.closePath();
        g.fill();
      }
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 44 + brillo * 6);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.5 * fuerza + 0.2 * Math.sin(t * 9) * fuerza;
      g.fillStyle = grad;
      g.fillRect(-120, -120, 240, 240);
      g.restore();
      if (!terminado) {
        const temblor = (0.5 + Math.max(0, k) * 0.4) * fuerza;
        g.save();
        g.translate(cx + Math.round((Math.random() - 0.5) * 2 * temblor * 3), base + Math.round((Math.random() - 0.5) * temblor * 2));
        dibujarRelicario(g, t * 2, 4, !relicario);
        g.restore();
        if (k >= 0) {
          g.fillStyle = color;
          g.font = "bold 18px serif";
          g.textAlign = "center";
          g.fillText(`${nivel + 1}★`, cx, 24);
        }
      }
      if (!terminado && t >= total) revelar();
      requestAnimationFrame(cuadro);
    };
    capa.addEventListener("click", (e) => {
      if (!terminado && e.target !== null && !(e.target instanceof HTMLButtonElement)) revelar();
    });
    this.audio.reproducir("cofre");
    requestAnimationFrame(cuadro);
    // Por si el navegador frena los cuadros (pestaña en segundo plano): la carta se revela igual.
    window.setTimeout(revelar, total * 1000 + 300);
  }

  /**
   * Tu Eco cayó: absorber el recuerdo (recuperas todo y te curas) o dejar que te acompañe como Espectro Temporal
   * (pelea a tu lado este piso y, si lo terminas con vida, te devuelve tu mejor pieza con un templado más).
   * Cerrar sin elegir = absorber.
   */
  decidirEco(op: DecisionEco): void {
    let elegido = false;
    const elegir = (f: () => void): void => {
      if (elegido) return;
      elegido = true;
      f();
    };
    this.abrir("faro",
      h("h2", {}, "Tu Eco se arrodilla"),
      h("p", { class: "sub" }, `${op.eco.nombre}. Peleaba como tú: ${op.perfil}.`),
      h("div", { class: "decision-eco" },
        h("button", { class: "principal", onclick: () => { elegir(op.absorber); this.cerrar(); } },
          h("b", {}, "Absorber el Recuerdo"),
          h("small", {}, `Recuperas lo que perdiste${op.legado !== null ? ` (y ${op.legado})` : ""} y te curas por completo.`)),
        h("button", { class: "pacto-eco", onclick: () => { elegir(op.pactar); this.cerrar(); } },
          h("b", {}, "Dejar que te acompañe"),
          h("small", {}, `Espectro Temporal: pelea a tu lado todo este piso. Si lo terminas con vida, te devuelve ${op.legado ?? "su fuerza"} con un templado más. Si caes, se pierde.`))));
    this.alCerrar = () => elegir(op.absorber);
  }

  /**
   * Hablar con un habitante: su historia y, si tiene, su misión personal (aceptar, pendiente, entregar el recuerdo
   * o cumplida con su recompensa).
   */
  abrirHistoria(juego: ConPartida, servicio: string, nombre: string, mensaje?: HTMLElement): void {
    const p = juego.partida;
    const hi = HISTORIAS.find((x) => x.servicio === servicio);
    const refrescar = (m?: HTMLElement): void => this.abrirHistoria(juego, servicio, nombre, m);
    let mision: HTMLElement | null = null;
    if (hi !== undefined) {
      const estado = p.historias[hi.id];
      const cuerpo: (HTMLElement | null)[] = [h3(hi.titulo)];
      if (estado === undefined) {
        cuerpo.push(
          h("p", { class: "cita" }, `«${hi.pedido}»`),
          h("p", { class: "sub" }, `Misión: baja al piso ${hi.piso}, vence a ${hi.eco.nombre} y trae ${hi.recuerdo.nombre}.`),
          h("p", { class: "sube" }, `Recompensa: ${hi.recompensa}`),
          h("button", { class: "principal", onclick: () => { p.aceptarHistoria(hi.id); this.acciones.guardar(); this.audio.reproducir("nivel"); refrescar(); } }, "Aceptar"));
      } else if (estado === "conocida") {
        if (p.tieneRecuerdo(hi.id)) {
          cuerpo.push(
            h("p", {}, `Llevas ${hi.recuerdo.nombre}.`),
            h("button", {
              class: "principal",
              onclick: () => {
                if (!p.entregarRecuerdo(hi.id)) return;
                this.acciones.guardar();
                this.audio.reproducir("reliquia");
                refrescar(h("div", { class: "resultado sube" }, `«${hi.gracias}»`, h("div", {}, hi.recompensa)));
              },
            }, `Entregar ${hi.recuerdo.nombre}`));
        } else {
          cuerpo.push(
            h("p", { class: "cita" }, `«${hi.pedido}»`),
            h("p", { class: "baja" }, `Pendiente: ${hi.eco.nombre} vaga por el piso ${hi.piso}. Si caes con ${hi.recuerdo.nombre} encima, se pierde.`));
        }
      } else {
        cuerpo.push(h("p", { class: "cita" }, `«${hi.gracias}»`), h("p", { class: "sube" }, `✔ ${hi.recompensa}`));
      }
      mision = h("div", { class: "historia-mision" }, ...cuerpo);
    }
    this.abrir("faro",
      h("h2", {}, nombre),
      h("p", { class: "sub" }, LORE_NPC[servicio] ?? ""),
      mensaje ?? null,
      mision,
      h("div", { class: "menu" }, h("button", { onclick: () => this.cerrar() }, "Despedirse")));
  }

  /** Campana del desafío: la arena normal, o el Juicio si se tiene la piedra. */
  abrirCampana(op: OpcionesCampana): void {
    const d = op.def;
    const pieza = d.pieza !== undefined ? `${NOMBRE_PIEZA[d.destino]} (${NOMBRES_RAREZA[d.pieza]} o mejor)` : null;
    const premios = [`Cofre: ${["madera", "plata", "oro", "mítico"][d.cofre]}`, pieza, d.carta ? "Carta de alma de jefe" : null, `${d.esquirlas} ◆`].filter((x) => x !== null);
    const juicio = op.juicio;
    this.abrir("faro",
      h("h2", { style: `color:${d.color}` }, d.nombre),
      h("p", { class: "sub" }, d.regla),
      h("div", { class: "campana-info" },
        h("div", {}, h("small", {}, "Oleadas"), h("b", {}, String(d.oleadas))),
        d.tiempo !== undefined ? h("div", {}, h("small", {}, "Tiempo"), h("b", {}, `${d.tiempo} s`)) : null,
        h("div", {}, h("small", {}, "Botín con destino"), h("b", {}, NOMBRE_PIEZA[d.destino])),
        h("div", {}, h("small", {}, "Racha"), h("b", {}, op.racha > 0 ? `×${op.racha} → ×${op.racha + 1}` : "—"))),
      h("p", {}, `Premio: ${premios.join(" · ")}`),
      h("p", { class: "sub" }, "Sellos: Intocable (sin recibir golpes) mejora cofre y pieza · encadenar arenas en el descenso sube la racha."),
      juicio !== undefined
        ? h("div", { class: "juicio" },
          h("h3", {}, `El Juicio +${juicio.nivel}`),
          h("p", { class: "sub" }, `Enemigos con ×${juicio.escala.toFixed(2)} de vida y daño · ${juicio.tiempo} s · a tiempo la piedra sube (+1/+2/+3), tarde baja 1. `
            + `Premio: pieza ${NOMBRES_RAREZA[Math.min(5, 2 + Math.floor(juicio.nivel / 3))]} o mejor.`),
          h("div", { class: "afijos-semana" }, ...juicio.afijos.map((x) => h("span", { class: "afijo", style: `--c:${INFO_AFIJO_JUICIO[x].color}` },
            h("b", {}, INFO_AFIJO_JUICIO[x].nombre), ` — ${INFO_AFIJO_JUICIO[x].descripcion}`))))
        : null,
      h("div", { class: "menu" },
        h("button", { class: "principal", onclick: () => { this.cerrar(); op.empezar(false); } }, "Tocar la campana"),
        juicio !== undefined ? h("button", { class: "principal juicio-boton", onclick: () => { this.cerrar(); op.empezar(true); } }, `Invocar el Juicio +${juicio.nivel}`) : null,
        h("button", { onclick: () => this.cerrar() }, "Todavía no")));
  }

  /** Bazar: compra (minialu/Catalogo + comprar) y venta (precioDeVenta) de consumibles, materiales, runas y cartas. */
  abrirBazar(juego: ConPartida, pestana: "comprar" | "vender" = "comprar"): void {
    const p = juego.partida;
    const tabs = h("div", { class: "tabs" },
      h("button", { class: pestana === "comprar" ? "tab on" : "tab", onclick: () => this.abrirBazar(juego, "comprar") }, "Comprar"),
      h("button", { class: pestana === "vender" ? "tab on" : "tab", onclick: () => this.abrirBazar(juego, "vender") }, "Vender"));
    let cuerpo: HTMLElement;
    if (pestana === "comprar") {
      const comprarN = (id: number, n: number): void => {
        let hechas = 0;
        let error = "";
        for (let k = 0; k < n; k++) {
          const r = comprarEnPueblo(p, id);
          if (!r.ok) { error = String(r.error); break; }
          hechas++;
        }
        this.audio.reproducir(hechas > 0 ? "recoger" : "fallo");
        if (hechas === 0) this.toast(textoError(error), "#ff9a4d");
        this.acciones.guardar();
        this.abrirBazar(juego, "comprar");
      };
      const ficha = (c: { id: number; nombre: string; descripcion: string; color: string }): HTMLElement => {
        const precio = precioPueblo(c.id);
        return h("div", { class: "articulo-ficha", style: `--c:${c.color}` },
          h("div", { class: "icono-grande" }, lienzoIcono(iconoObjeto(c.id), 3) ?? h("span", { class: "glifo" }, c.nombre.startsWith("Dado") ? "⚅" : "◆")),
          h("b", {}, c.nombre),
          h("span", { class: "sub" }, c.descripcion),
          h("span", { class: "tienes" }, `En la mochila: ${p.mochila.contar(c.id)}`),
          h("div", { class: "botones" },
            h("button", { class: "principal", disabled: p.esquirlas < precio, onclick: () => comprarN(c.id, 1) }, `${precio} ◆`),
            h("button", { disabled: p.esquirlas < precio * 5, onclick: () => comprarN(c.id, 5) }, `×5 · ${precio * 5} ◆`)));
      };
      const dados = CONSUMIBLES.filter((c) => c.nombre.startsWith("Dado"));
      const consumibles = CONSUMIBLES.filter((c) => !c.nombre.startsWith("Dado"));
      cuerpo = h("div", {},
        h("h3", {}, "Consumibles"), h("div", { class: "catalogo" }, ...consumibles.map(ficha)),
        h("h3", {}, "Dados del Destino · sello 100 % para la fusión"), h("div", { class: "catalogo" }, ...dados.map(ficha)),
        h("h3", {}, "Materiales de forja"), h("div", { class: "catalogo" }, ...MATERIALES.map(ficha)));
    } else {
      const filas: HTMLElement[] = [];
      for (const pos of p.mochila.posiciones()) {
        const pila = p.mochila.en(pos);
        if (pila === null) continue;
        const eq = equipoDe(pila);
        const def = apilable(pila.objeto);
        const valor = valorVenta(p, pos);
        const color = eq !== undefined ? COLORES_RAREZA[eq.rareza] : def?.color ?? "#fff";
        filas.push(h("div", { class: "articulo-ficha venta", style: `--c:${color}` },
          h("div", { class: "icono-grande" }, lienzoIcono(iconoObjeto(pila.objeto), 3)),
          h("b", { style: `color:${color}` }, `${eq?.nombre ?? def?.nombre ?? "?"}${pila.cantidad > 1 ? ` ×${pila.cantidad}` : ""}`),
          h("span", { class: "sub" }, eq !== undefined ? `${NOMBRES_RAREZA[eq.rareza]} · ${NOMBRE_PIEZA[eq.ranura]}` : "Objeto"),
          h("button", {
            class: "principal",
            disabled: valor <= 0,
            onclick: () => {
              const r = vender(p, pos);
              this.audio.reproducir(r.ok ? "recoger" : "fallo");
              this.abrirBazar(juego, "vender");
            },
          }, `+${valor} ◆`)));
      }
      for (const pos of p.mazo.posiciones()) {
        const pila = p.mazo.en(pos);
        const c = pila !== null ? cartaDe(pila) : undefined;
        if (c === undefined) continue;
        filas.push(h("div", { class: "articulo-ficha venta", style: `--c:${alma(c.personaje).colorSec}` },
          h("div", { class: "icono-grande" }, miniCarta(c, "", false, () => undefined)),
          h("b", { style: `color:${alma(c.personaje).colorSec}` }, `${nombreCarta(c)} ${estrellas(c)}`),
          h("span", { class: "sub" }, "Carta de Alma"),
          h("button", {
            class: "principal",
            onclick: () => {
              venderCarta(p, pos);
              this.audio.reproducir("recoger");
              this.abrirBazar(juego, "vender");
            },
          }, `+${valorCarta(p, pos)} ◆`)));
      }
      cuerpo = filas.length > 0 ? h("div", { class: "catalogo" }, ...filas) : h("p", { class: "sub" }, "No llevas nada para vender.");
    }
    this.abrirTienda("bazar", "mercader", this.botonCerrar(),
      cabeceraTienda("mercader", [esquirlas(p.esquirlas)]),
      tabs, cuerpo);
  }

  /** Armería: stock de equipo al azar (cambia en cada vuelta del Pozo). */
  abrirArmeria(juego: ConPartida, mensaje?: HTMLElement): void {
    const p = juego.partida;
    const stock = this.acciones.stockArmero();
    this.abrirTienda("armeria", "armero", this.botonCerrar(),
      cabeceraTienda("armero", [esquirlas(p.esquirlas)]),
      mensaje ?? null,
      tieneArma(p) ? null : h("div", { class: "kit-recluta" },
        h("p", {}, h("b", {}, "Kit de recluta"), " — «¿Te dejó el Pozo con las manos vacías? Toma, que no se diga.»"),
        h("div", { class: "botones" }, ...ORDEN_ESTILOS.map((id) => h("button", {
          onclick: () => {
            const r = kitRecluta(p, p.azar, id);
            this.audio.reproducir(r.ok ? "raro" : "fallo");
            this.acciones.guardar();
            this.abrirArmeria(juego, r.ok ? h("p", { class: "resultado sube" }, `Recibiste: ${r.valor.nombre}`) : h("p", { class: "baja" }, textoError(r.error)));
          },
        }, `${ESTILOS[id].nombre} (gratis)`)))),
      stock.length === 0 ? h("p", { class: "sub" }, "Agotado. Vuelve después de tu próximo descenso.") : null,
      h("div", { class: "stock" }, ...stock.map((a, i) => h("div", { class: "detalle" },
        fichaEquipo(a.equipo, p.equipo[p.ranuraPara(a.equipo)]),
        h("button", {
          class: "principal",
          disabled: p.esquirlas < a.precio,
          onclick: () => {
            const r = comprarAlArmero(p, stock, i);
            this.audio.reproducir(r.ok ? "raro" : "fallo");
            this.acciones.guardar();
            this.abrirArmeria(juego, r.ok ? h("p", { class: "resultado sube" }, `Compraste: ${r.valor.nombre}`) : h("p", { class: "baja" }, textoError(r.error)));
          },
        }, `Comprar · ${a.precio} ◆`)))),
      h("p", { class: "sub" }, "Para vender equipo, ve al Bazar."));
  }

  /** Bóveda de los Caídos: banco (minialu/Inventario + transferir) y esquirlas a salvo. */
  abrirBanco(juego: ConPartida, pestana = this.pestanaBanco): void {
    this.pestanaBanco = pestana;
    const p = juego.partida;
    const banco = this.acciones.banco();
    const refrescar = (): void => this.abrirBanco(juego);
    const ocupadas = (t: number): number => [...banco.inventario.posiciones()].filter((q) => q.pestana === t && banco.inventario.en(q) !== null).length;
    const pestanas = h("div", { class: "tabs" }, ...Array.from({ length: PESTANAS_BANCO }, (_, t) =>
      h("button", { class: t === pestana ? "tab on" : "tab", onclick: () => this.abrirBanco(juego, t) },
        `Bóveda ${["I", "II", "III", "IV"][t]} · ${ocupadas(t)}/${CASILLAS_PESTANA_BANCO}`)));
    const grilla = grillaInventario;
    const mover = (r: { ok: boolean; error?: string }): void => {
      this.audio.reproducir(r.ok ? "recoger" : "fallo");
      if (!r.ok) this.toast(textoError(String(r.error)), "#ff9a4d");
      this.acciones.guardar();
      refrescar();
    };
    const boton = (txt: string, f: () => { ok: boolean }): HTMLElement => h("button", { onclick: () => mover(f()) }, txt);
    this.abrirTienda("banco", "banco", this.botonCerrar(),
      cabeceraTienda("banco", [esquirlas(p.esquirlas)]),
      h("div", { class: "caja-fuerte" },
        h("div", { class: "cofre-moneda" },
          h("small", {}, "En tu bolsa"), h("b", {}, `◆ ${p.esquirlas.toLocaleString("es")}`),
          h("div", { class: "botones" },
            boton("Depositar 100", () => banco.depositarEsquirlas(p, 100)),
            boton("Depositar todo", () => banco.depositarEsquirlas(p, p.esquirlas)))),
        h("div", { class: "cofre-moneda boveda" },
          h("small", {}, "En la bóveda (a salvo)"), h("b", {}, `◆ ${banco.esquirlas.toLocaleString("es")}`),
          h("div", { class: "botones" },
            boton("Retirar 100", () => banco.retirarEsquirlas(p, 100)),
            boton("Retirar todo", () => banco.retirarEsquirlas(p, banco.esquirlas))))),
      h("div", { class: "vista" },
        h("div", { class: "col" }, h("h3", {}, "Mochila (clic para guardar)"), grilla(p.mochila, (pos) => mover(banco.depositar(p, pos)))),
        h("div", { class: "col" }, h("h3", {}, `Bóveda (clic para retirar)`), pestanas,
          grilla(banco.inventario, (pos) => mover(banco.retirar(p, pos)), pestana))));
  }

  /** El Pozo: elegir desde qué piso bajar (hasta el más hondo con guardián vencido + 1). */
  abrirPozo(juego: ConPartida): void {
    const p = juego.partida;
    const moverSeguro = (r: { ok: boolean; error?: string }): void => {
      this.audio.reproducir(r.ok ? "recoger" : "fallo");
      if (!r.ok) this.toast(textoError(String(r.error)), "#ff9a4d");
      this.acciones.guardar();
      this.abrirPozo(juego);
    };
    const pisos = Array.from({ length: p.pisoDesbloqueado }, (_, k) => k + 1);
    this.abrirTienda("pozo", "pozo", this.botonCerrar(),
      cabeceraTienda("pozo", [esquirlas(p.esquirlas)], "Abajo, todo recuerda."),
      h("p", { class: "sub" }, "Bajas con todo lo que llevas. Para volver con tu botín hay que EXTRAER: aguanta 5 s en una zona de "
        + "extracción (verde en el mapa) o toma el portal del guardián. Si caes, pierdes TODO lo que llevas encima (equipo, mochila "
        + "y esquirlas); tu Eco lo guarda en ese piso."),
      h("p", { class: "baja" }, `En riesgo: ◆ ${p.valorEnRiesgo()}`),
      tieneArma(p) ? null : h("p", { class: "baja" }, "No tienes arma: pide el kit de recluta en la Armería antes de bajar."),
      h("h3", {}, "Contenedor seguro (no se pierde al morir)"),
      h("div", { class: "vista" },
        h("div", { class: "col" }, h("h3", {}, "Mochila (clic para asegurar)"), grillaInventario(p.mochila, (pos) => moverSeguro(p.guardarEnSeguro(pos)))),
        h("div", { class: "col" }, h("h3", {}, `Seguro · ${TAM_SEGURO} casillas (clic para sacar)`), grillaInventario(p.seguro, (pos) => moverSeguro(p.sacarDeSeguro(pos))))),
      h("div", { class: "pisos" }, ...pisos.map((n) => {
        const b = bioma(n);
        return h("button", { class: n === p.pisoDesbloqueado ? "principal" : "", style: `border-color:${b.acento}`, onclick: () => this.acciones.descender(n) },
          h("b", { style: `color:${b.acento}` }, `Piso ${n}`), h("small", {}, b.nombre));
      })),
      p.pisoDesbloqueado < PISOS_TOTALES ? h("p", { class: "sub" }, "Vence al guardián de un piso para poder empezar desde el siguiente.") : null,
      h("div", { class: "abismo" },
        h("h3", {}, "El Abismo — pozo sin fin"),
        h("p", { class: "sub" }, "No tiene fondo. Cada piso tiene una GRIETA para seguir bajando, pero casi nunca hay salida: "
          + "están escondidas (no salen en el mapa hasta encontrarlas) y escasean cuanto más bajas. Al llegar a un piso sabrás si "
          + "hay una. Las zonas se repiten en ciclos cada vez más duros y cada 5 pisos un guardián custodia la grieta."),
        h("p", { class: "baja" }, `Récord: profundidad ${this.meta.registro.mejorAbismo ?? 0}`),
        h("div", { class: "pisos" }, ...iniciosAbismo(p.abismoDesbloqueado).map((n) => {
          const b = biomaAbismo(n);
          return h("button", { class: n === 1 ? "principal" : "", style: `border-color:${b.acento}`, onclick: () => this.acciones.descender(n, true) },
            h("b", { style: `color:${b.acento}` }, `Abismo ${n}`), h("small", {}, b.nombre));
        }))));
  }

  /** Faro de cada piso: descansar o volver al pueblo. */
  abrirFaro(op: { puedeDescansar: boolean; descansar: () => void }): void {
    this.abrir("faro",
      h("h2", {}, "Faro de descenso"),
      h("p", { class: "sub" }, "La luz del faro reconforta, pero no lleva a ninguna parte. Para volver al pueblo con tu botín, "
        + "busca una zona de EXTRACCIÓN (verde en el mapa) o vence al guardián."),
      h("div", { class: "menu" },
        h("button", { class: "principal", disabled: !op.puedeDescansar, onclick: () => { this.cerrar(); op.descansar(); } }, op.puedeDescansar ? "Descansar (vida y éter)" : "Ya descansaste en este piso"),
        h("button", { onclick: () => this.cerrar() }, "Seguir explorando")));
  }

  abrirPortal(op: { final: boolean; abismo?: boolean; seguir: () => void; volver?: () => void }): void {
    if (op.abismo === true || op.volver === undefined) {
      this.abrir("faro",
        h("h2", {}, "La Grieta"),
        h("p", { class: "sub" }, "Un desgarro en la roca que baja sin fondo. No hay vuelta atrás por aquí: en el Abismo solo se vuelve "
          + "al pueblo por una SALIDA. Si este piso tenía una y no la encontraste, se pierde."),
        h("div", { class: "menu" },
          h("button", { class: "principal", onclick: () => { this.cerrar(); op.seguir(); } }, "Saltar a la grieta"),
          h("button", { onclick: () => this.cerrar() }, "Todavía no")));
      return;
    }
    const volver = op.volver;
    this.abrir("faro",
      h("h2", {}, op.final ? "El Corazón calla" : "Portal hacia abajo"),
      h("p", { class: "sub" }, op.final ? "El camino a la superficie está abierto."
        : "El guardián cayó. Extrae ahora y pon tu botín a salvo, o sigue bajando arriesgándolo todo: si caes, lo pierdes."),
      h("div", { class: "menu" },
        op.final ? null : h("button", { class: "principal", onclick: () => { this.cerrarForzado(); volver(); } }, "Extraer al pueblo"),
        h("button", { class: op.final ? "principal" : "", onclick: () => { this.cerrar(); op.seguir(); } }, op.final ? "Ascender con el Corazón" : "Seguir bajando (arriesgar)"),
        h("button", { onclick: () => this.cerrar() }, "Todavía no")));
  }

  // =============================== Mapa y pausa ===============================

  abrirMapa(juego: Juego): void {
    // Celdas según el tamaño del piso: los mapas grandes también entran.
    const m = juego.mapa;
    const celda = Math.max(14, Math.min(34, Math.floor(260 / m.ancho), Math.floor(190 / m.alto)));
    const c = h("canvas", { width: m.ancho * celda + 8, height: m.alto * celda + 8, class: "mapa" });
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    dibujarMinimapa(g, m, juego, 4, 4, celda);
    const leyenda: [string, string][] = [
      ["#ffe9a8", "Tú"], ["#ffffff", "Faro"], ["#ff3d3d", "Guardián"], ["#a07cff", "Altar"], ["#ffd23d", "Tesoro"],
      ["#7fe3ff", "Reliquia"], ["#ffb23d", "Mercader"], ["#ff8aff", "Eco"], ["#7dffb0", "Extracción"],
      ["#ff6a3d", "Arena"], ["#ffe9a8", "Bóveda"],
    ];
    this.abrir("mapa", this.botonCerrar(),
      h("h2", {}, `Piso ${juego.partida.piso} · ${bioma(juego.partida.piso).nombre}`),
      c,
      h("div", { class: "leyenda" }, ...leyenda.map(([col, t]) => h("span", {}, h("i", { style: `background:${col}` }), t))),
      h("p", { class: "sub" }, "Las líneas de color en los bordes son barreras: celeste = cristal (Embestida), naranja = raíces (Garra Ígnea). Los pasajes verticales tienen cadenas para subir y bajar (↑/↓)."),
      h("button", { onclick: () => { this.cerrar(); juego.volverAlFaro(); } }, "Volver al Faro"));
  }

  abrirPausa(): void {
    let confirmar = false;
    const botonAbandonar = h("button", {
      class: "peligro",
      onclick: () => {
        if (!confirmar) {
          confirmar = true;
          botonAbandonar.textContent = "¿Seguro? Tu Eco quedará en este piso";
          return;
        }
        this.acciones.abandonar();
      },
    }, "Rendirse");
    const volumen = h("input", { type: "range", min: 0, max: 100, value: Math.round(this.audio.volumen * 100) });
    volumen.addEventListener("input", () => this.audio.cambiarVolumen(Number(volumen.value) / 100));
    this.abrir("pausa",
      h("h2", {}, "Pausa"),
      h("button", { class: "principal", onclick: () => this.cerrar() }, "Continuar"),
      h("button", { onclick: () => this.mostrarControles(() => this.abrirPausa()) }, "Controles"),
      h("label", { class: "volumen" }, "Volumen ", volumen),
      h("button", {
        onclick: () => {
          sprites.activado = !sprites.activado;
          this.acciones.refrescarArte();
          this.abrirPausa();
        },
      }, `Gráficos: ${sprites.activado ? "sprites (Anokolisa · 0x72)" : "clásicos (procedurales)"}`),
      h("button", { onclick: () => this.acciones.guardarYSalir() }, "Guardar y volver al título"),
      botonAbandonar);
  }

  // =============================== Momentos ===============================

  mostrarReliquia(r: Reliquia, alCerrar: () => void): void {
    const info = INFO_RELIQUIA[r];
    this.alCerrar = alCerrar;
    this.abrir("reliquia",
      h("div", { class: "reliquia-grande", style: `--c:${info.color}` }),
      h("h2", { style: `color:${info.color}` }, info.nombre),
      h("p", {}, info.descripcion),
      h("p", { class: "sub" }, "Las reliquias son permanentes: las conservas en todas tus bajadas."),
      h("button", { class: "principal", onclick: () => this.cerrar() }, "Continuar"));
  }

  mostrarMuerte(res: ResumenPartida, eco: Eco): void {
    const b = eco.botin;
    const perdido = b === undefined ? null : h("div", { class: "perdido" },
      h("p", { class: "baja" }, "Lo que llevabas encima se quedó en el Pozo:"),
      h("p", { class: "sub" },
        `${b.equipo.length} piezas equipadas · ${b.pilas.length} pilas de la mochila · ${b.esquirlas} esquirlas`),
      h("div", { class: "lista-perdida" }, ...b.equipo.slice(0, 12).map((o) =>
        h("span", { style: `color:${COLORES_RAREZA[o.rareza]}` }, o.nombre))),
      h("p", { class: "sub" }, "A salvo: el contenedor seguro, tus cartas, tu nivel, los talentos, las runas y el banco."));
    this.abrir("muerte",
      h("h1", { class: "caido" }, "HAS CAÍDO"),
      h("p", { class: "sub" }, `Ante ${eco.causa}, en el piso ${res.pisoAlcanzado}.`),
      this.resumen(res),
      h("div", { class: "eco-nuevo" },
        h("p", {}, "El Pozo te recuerda."),
        h("p", {}, h("b", {}, eco.nombre), ` te esperará en el piso ${eco.piso}`,
          eco.legado !== null ? h("span", {}, ", guardando ", h("b", { style: `color:${COLORES_RAREZA[eco.legado.rareza]}` }, eco.legado.nombre)) : null,
          eco.forma !== null ? h("span", {}, " y tu forma de ", h("b", {}, alma(eco.forma.personaje).nombre)) : null, "."),
        h("p", { class: "sub" }, b !== undefined
          ? "Véncelo y te devolverá TODO lo que perdiste. Si vuelves a caer en ese piso antes, el botín se pierde para siempre."
          : "Véncelo y te devolverá una copia de su legado.")),
      perdido,
      h("div", { class: "menu" },
        h("button", { class: "principal", onclick: () => this.acciones.volverAlPueblo() }, "Volver al pueblo")));
  }

  mostrarVictoria(res: ResumenPartida): void {
    this.abrir("victoria",
      h("h1", { class: "victoria" }, "EL POZO CALLA"),
      h("p", {}, "El Corazón deja de latir. Por primera vez en siglos, nadie recuerda nada aquí abajo."),
      h("p", { class: "sub" }, "Pero el Pozo es antiguo… y los ecos siempre vuelven."),
      this.resumen(res),
      h("div", { class: "menu" },
        h("button", { class: "principal", onclick: () => this.acciones.volverAlPueblo() }, "Volver al pueblo")));
  }

  private resumen(r: ResumenPartida): HTMLElement {
    return h("div", { class: "resumen" },
      h("div", {}, h("small", {}, "Piso"), h("b", {}, r.pisoAlcanzado)),
      h("div", {}, h("small", {}, "Nivel"), h("b", {}, r.nivel)),
      h("div", {}, h("small", {}, "Enemigos"), h("b", {}, r.enemigos)),
      h("div", {}, h("small", {}, "Guardianes"), h("b", {}, r.jefes)),
      h("div", {}, h("small", {}, "Ecos vencidos"), h("b", {}, r.ecos)),
      h("div", { class: "esencia" }, h("small", {}, "Esencia"), h("b", {}, `+${r.esencia} ✧`)));
  }
}
