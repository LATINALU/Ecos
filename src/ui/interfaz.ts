// Menús en DOM sobre el canvas: título, Santuario, Memorial, inventario (equipo, cartas, stats), Altar,
// mercader, mapa, pausa, reliquias, muerte y victoria. La lógica vive en el dominio; acá solo se muestra
// y se llama a Partida/Meta, mostrando el Resultado (ok / código de error) que devuelven.

import type { Posicion } from "minialu";
import { ALMAS, COLOR_FAMILIA, FAMILIAS, INFO_PASIVA, INFO_TECNICA, alma } from "../contenido/almas.ts";
import { ESTILOS, ORDEN_ESTILOS } from "../contenido/armas.ts";
import { EXITO_REFINADO, REFINADO_MAX, RECETAS, costoRefinado } from "../contenido/recetas.ts";
import { CONJUNTOS, conjunto as defConjunto } from "../contenido/conjuntos.ts";
import { RUNAS, runaDeObjeto } from "../contenido/objetos.ts";
import { SENDAS, TALENTOS, type Senda } from "../contenido/talentos.ts";
import { craftear, faltantes, puedeCraftear, refinarEquipado } from "../dominio/crafteo.ts";
import { bioma, type Bioma } from "../contenido/biomas.ts";
import {
  COLORES_RAREZA, CONSUMIBLES, MAT_FRAGMENTO, MATERIALES, NOMBRES_RAREZA, OBJ_LAGRIMA, OBJ_POLVO, RASGOS_EQUIPO, apilable, unico, type EstiloArma,
} from "../contenido/objetos.ts";
import { COSTO_FUSION, MEJORAS_MAX, NIVEL_MAX_CARTA, PROB_FUSION, RASGOS_CARTA, estrellas, nombreCarta, type Carta } from "../dominio/cartas.ts";
import type { Eco } from "../dominio/eco.ts";
import { valorDesguace, type ObjetoEquipo } from "../dominio/equipo.ts";
import { MEJORAS_SANTUARIO, type Meta } from "../dominio/meta.ts";
import type { OpcionesInicio, Partida, RanuraCarta, ResumenPartida } from "../dominio/partida.ts";
import { HABILIDADES_PORTADOR } from "../dominio/partida.ts";
import { cartaDe, equipoDe } from "../dominio/partida.ts";
import { NOMBRE_STAT, STATS, bloque, type Stat } from "../dominio/stats.ts";
import { INFO_RELIQUIA, RANURAS, RELIQUIAS, type Ranura, type Reliquia } from "../dominio/tipos.ts";
import type { Audio } from "../motor/audio.ts";
import { AYUDA_CONTROLES } from "../motor/entrada.ts";
import type { Juego } from "../juego/juego.ts";
import { iconoEquipo, iconoObjeto, lienzoIcono } from "../juego/iconos.ts";
import { sprites } from "../motor/sprites.ts";
import { h, limpiar } from "./dom.ts";
import { dibujarMinimapa } from "./hud.ts";

export interface Acciones {
  descender(opciones: OpcionesInicio): void;
  continuar(): void;
  /** Piso de la partida guardada, si hay una. */
  descensoGuardado(): number | null;
  aTitulo(): void;
  abandonar(): void;
  guardarYSalir(): void;
  /** Vuelve a dibujar la sala actual (al cambiar entre sprites y arte procedural). */
  refrescarArte(): void;
  guardar(): void;
}

const NOMBRE_RANURA: Readonly<Record<Ranura, string>> = { arma: "Arma", armadura: "Armadura", amuleto: "Amuleto" };
const ERRORES: Readonly<Record<string, string>> = {
  "sin-fondos": "No tienes suficientes esquirlas",
  "sin-espacio": "No hay espacio",
  "distinto-nivel": "Las tres cartas deben tener las mismas estrellas",
  "distinto-tipo": "Las tres cartas deben ser de la misma familia",
  "nivel-maximo": "Esa carta ya está en su máximo de estrellas",
  "al-maximo": "Ya está al máximo",
  "sin-polvo": "Necesitas Polvo de Eco",
  "sin-lagrima": "No tienes Lágrimas de Eco",
  "repetida": "Elige tres cartas distintas",
  "casilla-vacia": "No hay nada ahí",
  "vacia": "No hay nada equipado ahí",
  "no-a-la-venta": "Eso no está a la venta",
  "monto-invalido": "Monto inválido",
  "faltan-materiales": "Faltan materiales",
  "nada-que-refinar": "No tienes nada equipado ahí",
  "requisito": "Primero aprende el talento anterior de esa senda",
  "ya-aprendido": "Ya lo aprendiste",
  "sin-puntos": "No tienes puntos libres",
  "al-tope": "Ese stat llegó a su tope para tu nivel",
  "fallo-refinado": "El refinado falló: se perdieron los materiales (la pieza está intacta)",
  "no-es-runa": "Eso no es una runa",
};

function textoError(e: string): string {
  return ERRORES[e] ?? e;
}

function formatoStats(stats: Readonly<Record<string, number>>): HTMLElement {
  return h("div", { class: "stats" }, ...STATS.filter((s) => (stats[s] ?? 0) !== 0).map((s) =>
    h("span", { class: "stat" }, `${NOMBRE_STAT[s]} `, h("b", {}, `+${stats[s]}`))));
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
    h("div", { class: "sub" }, `${NOMBRES_RAREZA[o.rareza]} · ${NOMBRE_RANURA[o.ranura]} · Nv ${o.nivel}`),
    formatoStats(o.stats),
    o.calidad !== undefined ? h("div", { class: o.calidad >= 1.1 ? "sube" : o.calidad < 0.9 ? "baja" : "sub" }, `Calidad de forja: ${Math.round(o.calidad * 100)} %`) : null,
    ...Object.entries(o.rasgos ?? {}).map(([id, v]) => {
      const def = RASGOS_EQUIPO.find((r) => r.id === id);
      return def === undefined || v === undefined ? null : h("div", { class: "rasgo" }, `◈ ${def.nombre} ${def.formato(v)}`);
    }),
    u !== undefined ? h("div", { class: "efecto" }, `✦ ${u.descripcion}`) : null,
    u !== undefined ? h("div", { class: "cita" }, `«${u.cita}»`) : null,
    o.conjunto !== undefined ? (() => {
      const c = defConjunto(o.conjunto);
      return h("div", { class: "conjunto", style: `--c:${c.color}` },
        h("b", {}, `Conjunto: ${c.nombre}`),
        h("div", {}, `(2) ${c.dos.descripcion}`),
        h("div", {}, `(3) ${c.tres.descripcion}`));
    })() : null,
    dif);
}

function fichaCarta(c: Carta): HTMLElement {
  const a = alma(c.personaje);
  const t = INFO_TECNICA[a.tecnica];
  return h("div", { class: "ficha" },
    h("div", { class: "nombre", style: `color:${a.colorSec}` }, nombreCarta(c)),
    h("div", { class: "sub" }, h("span", { style: `color:${COLOR_FAMILIA[c.tipo]}` }, FAMILIAS[c.tipo]), ` · ${estrellas(c)} · mejoras ${c.mejoras}/${MEJORAS_MAX}`),
    formatoStats(c.stats),
    c.brillante === true ? h("div", { class: "brillo" }, "✧ Resplandeciente: +20 % a todos sus stats") : null,
    c.rasgo !== undefined ? h("div", { class: "rasgo" }, `◈ Rasgo ${RASGOS_CARTA[c.rasgo].nombre}: ${RASGOS_CARTA[c.rasgo].descripcion} (solo como Forma)`) : null,
    h("div", { class: "efecto" }, `Técnica: ${t.nombre} (${t.costo} éter, ${Math.round(t.mult * 100)} % de Técnica${t.impactos > 1 ? ` ×${t.impactos}` : ""}) — ${t.descripcion}`),
    h("div", { class: "pasiva" }, `Pasiva · ${INFO_PASIVA[a.pasiva].nombre}: ${INFO_PASIVA[a.pasiva].descripcion}`),
    h("div", { class: "cita" }, `«${a.lore}»`));
}

function miniCarta(c: Carta | null, etiqueta: string, sel: boolean, onclick: () => void): HTMLElement {
  if (c === null) return h("button", { class: `carta vacia${sel ? " sel" : ""}`, onclick }, h("small", {}, etiqueta), "—");
  const a = alma(c.personaje);
  return h("button", { class: `carta${sel ? " sel" : ""}${c.brillante === true ? " brillante" : ""}`, style: `--c1:${a.color};--c2:${a.colorSec};--fam:${COLOR_FAMILIA[c.tipo]}`, onclick },
    h("small", {}, etiqueta),
    h("span", { class: "retrato" }),
    h("b", {}, a.nombre),
    h("span", { class: "estrellas" }, estrellas(c) + (c.mejoras > 0 ? ` +${c.mejoras}` : "")),
    c.rasgo !== undefined ? h("small", { class: "rasgo" }, RASGOS_CARTA[c.rasgo].nombre) : null);
}

export class Interfaz {
  private readonly panel: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly meta: Meta;
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

  private abrir(nombre: string, ...contenido: (Node | null)[]): void {
    limpiar(this.panel);
    this.panel.className = `panel panel-${nombre}`;
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

  anunciarPiso(piso: number, b: Bioma): void {
    this.anunciar(`Piso ${piso} — ${b.nombre}`, b.lema, b.acento);
  }

  // =============================== Título ===============================

  mostrarTitulo(): void {
    const m = this.meta;
    const reliquias = h("div", { class: "reliquias" }, ...RELIQUIAS.map((r) =>
      h("span", { class: m.tieneReliquia(r) ? "rel si" : "rel no", style: `--c:${INFO_RELIQUIA[r].color}`, title: INFO_RELIQUIA[r].descripcion },
        m.tieneReliquia(r) ? INFO_RELIQUIA[r].nombre : "???")));
    this.abrir("titulo",
      h("div", { class: "titulo" },
        h("h1", {}, "ECOS"),
        h("div", { class: "lema" }, "El Pozo que Recuerda"),
        h("p", { class: "intro" },
          "Cada guerrero que cae en el Pozo deja un eco. Tú bajas a buscar el Corazón que los guarda a todos. ",
          "Cuando mueras —y morirás— tu Eco te esperará abajo, con tu forma y tu mejor arma."),
        h("div", { class: "menu" },
          this.acciones.descensoGuardado() !== null
            ? h("button", { class: "principal", onclick: () => { this.audio.activar(); this.acciones.continuar(); } }, `Continuar descenso · Piso ${this.acciones.descensoGuardado()}`)
            : null,
          h("button", { class: this.acciones.descensoGuardado() === null ? "principal" : "", onclick: () => { this.audio.activar(); this.mostrarPreparacion(); } },
            this.acciones.descensoGuardado() === null ? "Descender" : "Nuevo descenso"),
          h("button", { onclick: () => { this.audio.activar(); this.mostrarSantuario(); } }, `Santuario · ${m.esencia} esencia`),
          h("button", { onclick: () => this.mostrarMemorial() }, `Memorial · ${m.listaEcos().length} ecos`),
          h("button", { onclick: () => this.mostrarControles(() => this.mostrarTitulo()) }, "Controles")),
        reliquias,
        h("div", { class: "creditos" }, "Arte de escenario y criaturas: Anokolisa (Vaca Roxa) y 0x72 · CC0"),
        h("div", { class: "pie" }, `Descensos ${m.registro.partidas} · Muertes ${m.registro.muertes} · Victorias ${m.registro.victorias} · Mejor piso ${m.registro.mejorPiso}`)));
  }

  /** Antes de bajar: elegir arma inicial (estilo de combate) y alma inicial. */
  mostrarPreparacion(estilo: EstiloArma = "espada", almaId: number | null = null): void {
    const m = this.meta;
    const hayGuardado = this.acciones.descensoGuardado() !== null;
    const armas = h("div", { class: "estilos" }, ...ORDEN_ESTILOS.map((id) => {
      const e = ESTILOS[id];
      return h("button", { class: `estilo${id === estilo ? " sel" : ""}`, style: `--c:${e.color}`, onclick: () => this.mostrarPreparacion(id, almaId) },
        h("span", { class: `icono-estilo ${id}` }),
        h("b", {}, e.nombre),
        h("small", {}, `Combo de ${e.mults.length}`),
        h("span", { class: "sub" }, e.descripcion));
    }));
    const vistas = ALMAS.filter((a) => m.almaVista(a.id));
    const almas = h("div", { class: "almas" },
      h("button", { class: `alma${almaId === null ? " sel" : ""}`, onclick: () => this.mostrarPreparacion(estilo, null) },
        h("span", { class: "retrato azar" }), h("b", {}, "Al azar"), h("small", {}, "Que el Pozo decida")),
      ...vistas.map((a) => h("button", {
        class: `alma${almaId === a.id ? " sel" : ""}`, style: `--c1:${a.color};--c2:${a.colorSec}`, title: a.lore,
        onclick: () => this.mostrarPreparacion(estilo, a.id),
      }, h("span", { class: "retrato" }), h("b", {}, a.nombre), h("small", {}, INFO_TECNICA[a.tecnica].nombre), h("small", { class: "pasiva" }, INFO_PASIVA[a.pasiva].nombre))));
    const elegida = almaId !== null ? alma(almaId) : null;
    this.abrir("preparacion",
      h("h2", {}, "Preparar el descenso"),
      h("h3", {}, "Arma inicial — define tu combo"),
      armas,
      h("h3", {}, "Alma inicial — tu Forma, su técnica y su pasiva"),
      vistas.length === 0 ? h("p", { class: "sub" }, "Todavía no conoces ningún alma: la primera será al azar. Las almas que encuentres quedarán disponibles aquí.") : null,
      almas,
      elegida !== null ? h("p", { class: "sub" }, `${elegida.nombre}: ${INFO_TECNICA[elegida.tecnica].descripcion} · ${INFO_PASIVA[elegida.pasiva].descripcion}`) : null,
      hayGuardado ? h("p", { class: "baja" }, "Empezar un descenso nuevo reemplaza el que tienes guardado.") : null,
      h("div", { class: "menu fila" },
        h("button", { onclick: () => this.mostrarTitulo() }, "Volver"),
        h("button", { class: "principal", onclick: () => this.acciones.descender({ estilo, alma: almaId ?? undefined }) }, "Descender")));
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
    this.abrir("santuario",
      h("h2", {}, "Santuario"),
      h("p", { class: "sub" }, "La esencia de cada descenso fortalece al próximo Portador."),
      h("div", { class: "esencia" }, `${m.esencia} ✧ esencia`),
      ...filas,
      h("button", { class: "principal", onclick: () => this.mostrarTitulo() }, "Volver"));
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
          h("span", { class: "retrato" }), h("b", {}, a.nombre), h("small", {}, a.titulo), h("small", {}, INFO_TECNICA[a.tecnica].nombre))
        : h("div", { class: "alma oculta" }, h("span", { class: "retrato" }), h("b", {}, "???")))),
      h("button", { class: "principal", onclick: () => this.mostrarTitulo() }, "Volver"));
  }

  // =============================== Inventario ===============================

  abrirInventario(juego: Juego, pestana: "equipo" | "cartas" | "habilidades" | "stats" = "equipo", seleccion?: Posicion | Ranura | RanuraCarta): void {
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

  private vistaEquipo(juego: Juego, p: Partida, sel?: Posicion | Ranura | RanuraCarta): HTMLElement {
    const ranuras = h("div", { class: "ranuras" }, ...RANURAS.map((r) => {
      const o = p.equipo[r];
      return h("button", {
        class: `ranura${sel === r ? " sel" : ""}`, style: o !== null ? `border-color:${COLORES_RAREZA[o.rareza]}` : "",
        onclick: () => this.abrirInventario(juego, "equipo", r),
      }, h("small", {}, NOMBRE_RANURA[r]),
      o !== null ? h("span", { class: "con-icono", style: `color:${COLORES_RAREZA[o.rareza]}` }, lienzoIcono(iconoEquipo(o), 2), o.nombre) : "—");
    }));
    const grilla = h("div", { class: "grilla" });
    for (const pos of p.mochila.posiciones()) {
      const pila = p.mochila.en(pos);
      const eq = pila !== null ? equipoDe(pila) : undefined;
      const cons = pila !== null ? apilable(pila.objeto) : undefined;
      const esSel = typeof sel === "object" && sel.casilla === pos.casilla;
      grilla.append(h("button", {
        class: `celda${esSel ? " sel" : ""}${pila === null ? " vacia" : ""}`,
        style: eq !== undefined ? `--c:${COLORES_RAREZA[eq.rareza]}` : cons !== undefined ? `--c:${cons.color}` : "",
        title: eq?.nombre ?? cons?.nombre ?? "",
        onclick: () => this.abrirInventario(juego, "equipo", pos),
      }, pila !== null
        ? lienzoIcono(eq !== undefined ? iconoEquipo(eq) : iconoObjeto(pila.objeto))
          ?? h("span", { class: eq !== undefined ? `icono ${eq.ranura}` : "icono pocion" })
        : null,
      pila !== null && pila.cantidad > 1 ? h("small", {}, pila.cantidad) : null));
    }
    let detalle: HTMLElement = h("div", { class: "detalle sub" }, "Elige un objeto para ver sus detalles. Equipo: botón Equipar. Lo que no sirva, desguázalo por esquirlas.");
    if (typeof sel === "string" && (RANURAS as readonly string[]).includes(sel)) {
      const r = sel as Ranura;
      const o = p.equipo[r];
      if (o !== null) {
        detalle = h("div", { class: "detalle" }, fichaEquipo(o),
          h("button", {
            onclick: () => {
              const res = p.desequipar(r);
              if (!res.ok) this.toast(textoError(res.error), "#ff9a4d");
              this.abrirInventario(juego, "equipo");
            },
          }, "Quitar"));
      }
    } else if (typeof sel === "object") {
      const pila = p.mochila.en(sel);
      const eq = pila !== null ? equipoDe(pila) : undefined;
      const cons = pila !== null ? apilable(pila.objeto) : undefined;
      if (eq !== undefined) {
        detalle = h("div", { class: "detalle" }, fichaEquipo(eq, p.equipo[eq.ranura]),
          h("div", { class: "botones" },
            h("button", {
              class: "principal",
              onclick: () => {
                p.equiparDesde(sel);
                this.audio.reproducir("recoger");
                this.abrirInventario(juego, "equipo", eq.ranura);
              },
            }, "Equipar"),
            h("button", {
              onclick: () => {
                const r = p.desguazar(sel);
                if (r.ok) {
                  this.audio.reproducir("romper");
                  this.toast(`Desguazado: +${r.valor} esquirlas`, "#9fe8ff");
                }
                this.abrirInventario(juego, "equipo");
              },
            }, `Desguazar (+${valorDesguace(eq)} ◆)`)));
      } else if (cons !== undefined && pila !== null) {
        const runa = runaDeObjeto(pila.objeto);
        detalle = h("div", { class: "detalle" },
          h("div", { class: "ficha" }, h("div", { class: "nombre", style: `color:${cons.color}` }, `${cons.nombre} ×${pila.cantidad}`), h("div", { class: "sub" }, cons.descripcion)),
          runa !== undefined ? h("div", { class: "botones" }, ...([0, 1] as const).map((k) => h("button", {
            class: k === 0 ? "principal" : "",
            onclick: () => {
              const res = p.engarzarRuna(sel, k);
              if (!res.ok) this.toast(textoError(res.error), "#ff9a4d");
              else this.audio.reproducir("raro");
              this.abrirInventario(juego, "equipo");
            },
          }, `Engarzar en Runa ${k === 0 ? "I" : "II"}`))) : null);
      }
    }
    const runas = h("div", { class: "ranuras" }, ...([0, 1] as const).map((k) => {
      const r = p.runas[k];
      const def = r !== null ? RUNAS.find((x) => x.id === r) : undefined;
      return h("button", {
        class: "ranura", style: def !== undefined ? `border-color:${def.color}` : "", title: def?.descripcion ?? "Engarza una runa desde la mochila",
        onclick: () => {
          if (r === null) return;
          const res = p.quitarRuna(k);
          if (!res.ok) this.toast(textoError(res.error), "#ff9a4d");
          this.abrirInventario(juego, "equipo");
        },
      }, h("small", {}, `Runa ${k === 0 ? "I" : "II"}`), def !== undefined ? h("span", { style: `color:${def.color}` }, def.nombre) : "—");
    }));
    return h("div", { class: "vista" }, h("div", { class: "col" }, h("h3", {}, "Equipado"), ranuras, runas, h("h3", {}, `Mochila · ◆ ${p.esquirlas}`), grilla), detalle);
  }

  private vistaCartas(juego: Juego, p: Partida, sel?: Posicion | Ranura | RanuraCarta): HTMLElement {
    const ranuras: [RanuraCarta, string][] = [["forma", "Forma"], [0, "Resonancia I"], [1, "Resonancia II"]];
    const slots = h("div", { class: "slots-cartas" }, ...ranuras.map(([r, txt]) =>
      miniCarta(p.cartaEn(r), txt, sel === r, () => this.abrirInventario(juego, "cartas", r))));
    const mazo = h("div", { class: "grilla cartas" });
    for (const pos of p.mazo.posiciones()) {
      const pila = p.mazo.en(pos);
      const c = pila !== null ? cartaDe(pila) ?? null : null;
      const esSel = typeof sel === "object" && sel.casilla === pos.casilla;
      if (c === null) mazo.append(h("div", { class: "carta vacia mini" }));
      else mazo.append(miniCarta(c, "", esSel, () => this.abrirInventario(juego, "cartas", pos)));
    }
    let detalle: HTMLElement = h("div", { class: "detalle sub" },
      "La Forma te da el 100 % de sus stats y su técnica. Cada Resonancia aporta el 35 % (50 % si es de la misma familia que tu Forma).");
    if (sel === "forma" || sel === 0 || sel === 1) {
      const c = p.cartaEn(sel);
      if (c !== null) {
        detalle = h("div", { class: "detalle" }, fichaCarta(c),
          h("button", {
            onclick: () => {
              const r = p.retirarCarta(sel);
              if (!r.ok) this.toast(textoError(r.error), "#ff9a4d");
              this.abrirInventario(juego, "cartas");
            },
          }, "Retirar al mazo"));
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
          h("div", { class: "botones" },
            h("button", { class: "principal", onclick: () => asignar("forma") }, "Usar como Forma"),
            h("button", { onclick: () => asignar(0) }, "Resonancia I"),
            h("button", { onclick: () => asignar(1) }, "Resonancia II")));
      }
    }
    return h("div", { class: "vista" }, h("div", { class: "col" }, h("h3", {}, "Equipadas"), slots, h("h3", {}, "Mazo"), mazo), detalle);
  }

  private vistaHabilidades(juego: Juego, p: Partida): HTMLElement {
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
    const pasiva = p.pasiva();
    const danio = h("div", { class: "danios" },
      h("div", {}, h("small", {}, `Golpe (${estilo.nombre})`), h("b", {}, `${pot.golpe}`), h("small", {}, `combo completo ${pot.combo}`)),
      h("div", {}, h("small", {}, "Patada"), h("b", {}, `${pot.patada}`), h("small", {}, "rompe guardias")),
      h("div", {}, h("small", {}, pot.tecnicaNombre ?? "Técnica"), h("b", {}, pot.tecnicaNombre === null ? "—" : `${pot.tecnica}`), h("small", {}, pot.tecnicaNombre === null ? "sin Forma" : `${pot.costoTecnica} éter`)),
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
      pasiva !== null ? h("div", { class: "pasiva" }, `Pasiva de tu Forma · ${INFO_PASIVA[pasiva].nombre}: ${INFO_PASIVA[pasiva].descripcion}`) : null,
      h("h3", {}, "Desglose de stats"),
      tabla,
      total.hp !== sinVidrio ? h("div", { class: "sub" }, `Sangre de Vidrio reduce tu vida de ${sinVidrio} a ${total.hp}.`) : null,
      ...efectos,
      h("h3", {}, "Conjuntos y runas"),
      ...[...p.piezasConjunto()].map(([id, n]) => {
        const c = CONJUNTOS.find((x) => x.id === id)!;
        return h("div", { class: "conjunto", style: `--c:${c.color}` },
          h("b", {}, `${c.nombre} (${n}/3)`),
          h("div", { class: n >= 2 ? "sube" : "sub" }, `(2) ${c.dos.descripcion}`),
          h("div", { class: n >= 3 ? "sube" : "sub" }, `(3) ${c.tres.descripcion}`));
      }),
      ...p.runas.filter((r) => r !== null).map((r) => {
        const def = RUNAS.find((x) => x.id === r)!;
        return h("div", { style: `color:${def.color}` }, `◆ ${def.nombre}: ${def.descripcion}`);
      }),
      p.piezasConjunto().size === 0 && p.runas.every((r) => r === null) ? h("p", { class: "sub" }, "Sin conjuntos ni runas. Las piezas de conjunto caen en cada zona y los guardianes siempre sueltan una.") : null,
      h("h3", {}, "Reliquias"),
      h("div", { class: "reliquias" }, ...RELIQUIAS.map((r) =>
        h("span", { class: this.meta.tieneReliquia(r) ? "rel si" : "rel no", style: `--c:${INFO_RELIQUIA[r].color}`, title: INFO_RELIQUIA[r].descripcion },
          this.meta.tieneReliquia(r) ? INFO_RELIQUIA[r].nombre : "???"))),
      h("div", { class: "sub" }, `Enemigos ${p.enemigos} · Jefes ${p.jefes} · Ecos vencidos ${p.ecosVencidos}`));
  }

  // =============================== Altar ===============================

  abrirAltar(juego: Juego, elegidas: Posicion[] = [], lagrima = false, mensaje?: HTMLElement): void {
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
    let info: HTMLElement = h("p", { class: "sub" }, "Elige tres cartas de la misma familia y estrellas.");
    let fusionar: HTMLElement | null = null;
    if (sel.length > 0) {
      const n = sel[0].nivel;
      const compatibles = sel.every((c) => c.nivel === n && c.tipo === sel[0].tipo);
      const costo = COSTO_FUSION[n] ?? 0;
      const prob = n >= NIVEL_MAX_CARTA ? 0 : lagrima ? 1 : PROB_FUSION[n];
      info = h("div", {},
        h("p", {}, `Elegidas ${sel.length}/3 · ${FAMILIAS[sel[0].tipo]} ${"★".repeat(n + 1)}`),
        !compatibles ? h("p", { class: "baja" }, "No coinciden en familia o estrellas.") : null,
        h("p", {}, `Costo: ${costo} ◆ (tienes ${p.esquirlas}) · Probabilidad de subir: ${Math.round(prob * 100)} %`),
        h("label", { class: "check" },
          h("input", { type: "checkbox", checked: lagrima, onclick: () => this.abrirAltar(juego, elegidas, !lagrima) }),
          ` Usar Lágrima de Eco (tienes ${p.mochila.contar(OBJ_LAGRIMA)}): éxito seguro`));
      if (sel.length === 3) {
        fusionar = h("button", {
          class: "principal",
          onclick: () => {
            const r = p.fusionar([elegidas[0], elegidas[1], elegidas[2]], lagrima);
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
        }, "Fusionar");
      }
    }

    // Mejora con Polvo de Eco
    const polvo = p.mochila.contar(OBJ_POLVO);
    const mejorables: [RanuraCarta | Posicion, Carta][] = [];
    for (const r of ["forma", 0, 1] as const) {
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
      }, `${obj === "forma" ? "Forma" : obj === 0 ? "Res. I" : "Res. II"}: ${alma(c.personaje).nombre} ${estrellas(c)} (${c.mejoras}/${MEJORAS_MAX})`)));

    this.abrir("altar", this.botonCerrar(),
      h("h2", {}, "Altar de las Almas"),
      h("div", { class: "vista" },
        h("div", { class: "col" }, h("h3", {}, "Fusión: tres almas, una sola voz"), grilla),
        h("div", { class: "detalle" }, info, fusionar, mensaje ?? null,
          h("h3", {}, `Mejora · Polvo de Eco: ${polvo}`),
          h("p", { class: "sub" }, "Cada polvo suma +1~+5 a todos los stats de una carta equipada (máx. 5 veces)."),
          mejora)));
  }

  // =============================== Yunque ===============================

  abrirYunque(juego: Juego, resultado?: HTMLElement): void {
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
      const costo = costoRefinado(nivel);
      return h("div", { class: "receta" },
        h("b", { style: o !== null ? `color:${COLORES_RAREZA[o.rareza]}` : "" }, o?.nombre ?? `${NOMBRE_RANURA[ranura]}: nada equipado`),
        h("span", { class: "sub" }, o === null ? "" : nivel >= REFINADO_MAX ? "Refinado al máximo" : `+12 % a todo · Fragmento de Eco ${p.mochila.contar(MAT_FRAGMENTO)}/${costo.fragmentos} · ◆ ${costo.esquirlas} · éxito ${Math.round((EXITO_REFINADO[nivel] ?? 0) * 100)} %`),
        h("button", {
          disabled: o === null || nivel >= REFINADO_MAX,
          onclick: () => {
            const res = refinarEquipado(p, ranura);
            if (!res.ok) {
              this.audio.reproducir("fallo");
              refrescar(h("p", { class: "baja" }, textoError(res.error)));
              return;
            }
            this.audio.reproducir("fusion");
            refrescar(h("div", { class: "resultado sube" }, "¡Refinado!", fichaEquipo(res.valor)));
          },
        }, `Refinar (+${nivel}→+${nivel + 1})`));
    });
    this.abrir("yunque", this.botonCerrar(),
      h("h2", {}, "Yunque del Faro"),
      h("p", { class: "cita" }, "«Todo lo que se rompe aquí abajo puede volver a ser útil.»"),
      materiales,
      h("div", { class: "esencia" }, `◆ ${p.esquirlas} esquirlas`),
      resultado ?? null,
      h("h3", {}, "Recetas"), ...recetas,
      h("h3", {}, "Refinar equipo puesto"), ...refinar);
  }

  // =============================== Mercader ===============================

  abrirMercader(juego: Juego): void {
    const p = juego.partida;
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
          this.abrirMercader(juego);
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
            this.abrirMercader(juego);
          },
        }, `+${valorDesguace(eq)} ◆`)));
    }
    this.abrir("mercader", this.botonCerrar(),
      h("h2", {}, "Mercader del Pozo"),
      h("p", { class: "cita" }, "«Abajo todo se paga. Arriba también, pero allá lo olvidan.»"),
      h("div", { class: "esencia" }, `◆ ${p.esquirlas} esquirlas`),
      h("h3", {}, "Comprar"), ...venta,
      h("h3", {}, "Desguazar equipo"), desguace.length > 0 ? h("div", {}, ...desguace) : h("p", { class: "sub" }, "No llevas equipo para desguazar."));
  }

  // =============================== Mapa y pausa ===============================

  abrirMapa(juego: Juego): void {
    const c = h("canvas", { width: 7 * 34 + 8, height: 5 * 34 + 8, class: "mapa" });
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    dibujarMinimapa(g, juego.mapa, juego, 4, 4, 34);
    const leyenda: [string, string][] = [
      ["#ffe9a8", "Tú"], ["#ffffff", "Faro"], ["#ff3d3d", "Guardián"], ["#a07cff", "Altar"], ["#ffd23d", "Tesoro"],
      ["#7fe3ff", "Reliquia"], ["#ffb23d", "Mercader"], ["#ff8aff", "Eco"],
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
      h("button", { onclick: () => this.acciones.guardarYSalir() }, "Guardar y volver a la superficie"),
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
    this.abrir("muerte",
      h("h1", { class: "caido" }, "HAS CAÍDO"),
      h("p", { class: "sub" }, `Ante ${eco.causa}, en el piso ${res.pisoAlcanzado}.`),
      this.resumen(res),
      h("div", { class: "eco-nuevo" },
        h("p", {}, "El Pozo te recuerda."),
        h("p", {}, h("b", {}, eco.nombre), ` te esperará en el piso ${eco.piso}`,
          eco.legado !== null ? h("span", {}, ", guardando ", h("b", { style: `color:${COLORES_RAREZA[eco.legado.rareza]}` }, eco.legado.nombre)) : null,
          eco.forma !== null ? h("span", {}, " y tu forma de ", h("b", {}, alma(eco.forma.personaje).nombre)) : null, "."),
        h("p", { class: "sub" }, "Véncelo para recuperar lo que llevabas.")),
      h("div", { class: "menu" },
        h("button", { class: "principal", onclick: () => this.mostrarPreparacion() }, "Descender de nuevo"),
        h("button", { onclick: () => this.acciones.aTitulo() }, "Volver a la superficie")));
  }

  mostrarVictoria(res: ResumenPartida): void {
    this.abrir("victoria",
      h("h1", { class: "victoria" }, "EL POZO CALLA"),
      h("p", {}, "El Corazón deja de latir. Por primera vez en siglos, nadie recuerda nada aquí abajo."),
      h("p", { class: "sub" }, "Pero el Pozo es antiguo… y los ecos siempre vuelven."),
      this.resumen(res),
      h("div", { class: "menu" },
        h("button", { class: "principal", onclick: () => this.mostrarPreparacion() }, "Descender otra vez"),
        h("button", { onclick: () => this.acciones.aTitulo() }, "Volver a la superficie")));
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
