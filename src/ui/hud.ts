// HUD dibujado en el canvas: vida, éter, experiencia, forma/técnica, frascos, esquirlas, minimapa y jefe.

import { hd } from "../motor/texto-hd.ts";
import { alma } from "../contenido/almas.ts";
import { TECLA_RANURA_ALMA, grimorio, type FormaHabilidad } from "../contenido/grimorio.ts";
import { CARGA_DEFINITIVA } from "../dominio/partida.ts";
import { bioma } from "../contenido/biomas.ts";
import { OBJ_ETER, OBJ_POCION } from "../contenido/objetos.ts";
import { SUBARMAS } from "../contenido/subarmas.ts";
import { estrellas } from "../dominio/cartas.ts";
import { dibujarIconoSubarma } from "../juego/entidades/objetos.ts";
import { aperturas, type MapaPiso } from "../dominio/mundo/generador.ts";
import type { Juego } from "../juego/juego.ts";
import type { Pueblo } from "../juego/pueblo.ts";
import type { Meta } from "../dominio/meta.ts";

function barra(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, fondo = "#1a1622"): void {
  g.fillStyle = "#000000";
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = fondo;
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
  g.fillStyle = "#ffffff33";
  g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 1);
}

function texto(g: CanvasRenderingContext2D, t: string, x: number, y: number, color = "#ffffff", alinear: CanvasTextAlign = "left", tam = 8): void {
  hd.texto(g, t, x, y, { color, alinear, tam });
}

export function dibujarHud(g: CanvasRenderingContext2D, juego: Juego): void {
  const p = juego.partida;
  const s = p.stats();
  g.font = "bold 8px monospace";

  // Retrato de la forma
  const forma = p.forma;
  const a = forma !== null ? alma(forma.personaje) : null;
  g.fillStyle = "#000000aa";
  g.fillRect(4, 4, 22, 22);
  g.fillStyle = a?.color ?? "#444455";
  g.fillRect(6, 6, 18, 18);
  g.fillStyle = a?.colorSec ?? "#888899";
  g.fillRect(9, 9, 12, 4);
  g.fillRect(12, 15, 6, 6);

  barra(g, 30, 6, 110, 6, p.hp / s.hp, p.hp / s.hp < 0.3 ? "#ff2d4d" : "#e8445f");
  texto(g, `${Math.ceil(p.hp)}/${s.hp}`, 144, 12, "#ffccd5");
  barra(g, 30, 15, 80, 4, p.mp / s.mp, "#4dc3ff");
  texto(g, `${Math.floor(p.mp)}`, 114, 20, "#bfe9ff");
  const n = p.curva.nivelDe(p.experiencia);
  barra(g, 30, 22, 80, 2, n.porcentaje / 100, "#ffe27a");
  texto(g, `Nv ${n.nivel}`, 114, 27, "#ffe27a");

  // Forma y su pasiva de ataques básicos
  if (a !== null && forma !== null) {
    texto(g, `${a.nombre} ${estrellas(forma)}`, 6, 38, a.colorSec);
    texto(g, `Básicos: ${grimorio(forma.personaje).pasivas[0].nombre}`, 6, 48, "#d8d0e8", "left", 7);
  } else {
    texto(g, "Sin Forma (I → Cartas)", 6, 38, "#777788");
  }
  dibujarBarraHabilidades(g, juego);

  // Puntos sin gastar
  const libres = p.puntos.disponibles + p.puntosTalento();
  if (libres > 0 && Math.floor(performance.now() / 500) % 2 === 0) texto(g, `I · ${libres} puntos de habilidad`, 6, 58, "#ffd27a");

  // Frascos y esquirlas
  texto(g, `Q ♥${p.mochila.contar(OBJ_POCION)}`, 6, 262, "#ff8aa0");
  texto(g, `R ✦${p.mochila.contar(OBJ_ETER)}`, 50, 262, "#8ad8ff");
  texto(g, `◆ ${p.esquirlas}`, 94, 262, "#9fe8ff");

  // Corazones y subarma (↑ + Patada)
  texto(g, `♥ ${p.corazones}`, 150, 262, "#ff6a8a");
  g.fillStyle = "#000000aa";
  g.fillRect(186, 250, 16, 16);
  g.strokeStyle = p.subarma !== null ? SUBARMAS[p.subarma].color : "#444455";
  g.lineWidth = 1;
  g.strokeRect(186.5, 250.5, 15, 15);
  if (p.subarma !== null) {
    dibujarIconoSubarma(g, p.subarma, 194, 258);
    const puede = p.corazones >= SUBARMAS[p.subarma].costo;
    texto(g, `↑K ${SUBARMAS[p.subarma].costo}♥`, 206, 262, puede ? "#ffd0d8" : "#776677");
  }

  // Extracción: valor en riesgo y progreso de la zona.
  texto(g, `En riesgo ◆${p.valorEnRiesgo()}`, 476, 251, "#ffb0a0", "right");
  if (juego.cargaExtraccion > 0) {
    const total = juego.duracionExtraccion;
    const prog = Math.min(1, juego.cargaExtraccion / total);
    const fuera = !juego.enZonaExtraccion;
    texto(g, fuera ? `¡VUELVE A LA ZONA! ${Math.ceil(total - juego.cargaExtraccion)} s` : `EXTRAYENDO ${Math.ceil(total - juego.cargaExtraccion)} s`, 240, 200, fuera ? "#ff6a6a" : "#7dffb0", "center");
    barra(g, 180, 204, 120, 4, prog, fuera ? "#ff6a6a" : "#7dffb0");
  }
  // Peso del Eco: pisos seguidos sin volver al pueblo.
  if (p.pesoEco > 0) texto(g, `Peso del Eco ×${p.pesoEco} · +${p.pesoEco * 25} % hallazgos`, 476, 241, "#c9a7ff", "right");

  // Piso
  const b = bioma(p.piso);
  texto(g, `Piso ${p.piso} · ${b.nombre}`, 476, 262, b.acento, "right");

  // Mapas grandes del Pozo Profundo: celdas más chicas para que entren.
  const celda = Math.max(5, Math.min(9, Math.floor(84 / juego.mapa.ancho), Math.floor(60 / juego.mapa.alto)));
  dibujarMinimapa(g, juego.mapa, juego, 478 - juego.mapa.ancho * celda - 2, 4, celda);
  dibujarCombo(g, juego);

  // Jefe
  const jefe = juego.jefeActivo();
  if (jefe !== undefined) {
    const w = 260;
    const x = 240 - w / 2;
    texto(g, jefe.nombre, 240, 214, "#ffd0d0", "center");
    barra(g, x, 218, w, 5, jefe.hp / jefe.hpMax, jefe.hp / jefe.hpMax < 0.5 ? "#ff3d3d" : "#d83a5a", "#2a0a10");
  }
}

/** Barra de habilidades del mazo de almas: L, U, O y la Definitiva (P) con su carga. */
function dibujarBarraHabilidades(g: CanvasRenderingContext2D, juego: Juego): void {
  const p = juego.partida;
  const j = juego.jugador;
  const y = 230;
  ([1, 2, 3, 4] as const).forEach((r, k) => {
    const x = 246 + k * 25;
    const h = p.habilidad(r);
    const definitiva = r === 4;
    g.fillStyle = "#000000bb";
    g.fillRect(x - 1, y - 1, 22, 22);
    if (h === null) {
      g.strokeStyle = "#3a3448";
      g.strokeRect(x + 0.5, y + 0.5, 19, 19);
      texto(g, TECLA_RANURA_ALMA[r], x + 10, y + 13, "#555066", "center", 7);
      return;
    }
    const color = h.def.color;
    const listo = definitiva ? p.cargaDefinitiva >= CARGA_DEFINITIVA : j.enfriamiento(r) <= 0 && p.mp >= h.costo;
    // Fondo y relleno de carga (Definitiva) o de enfriamiento.
    g.fillStyle = "#1a1622";
    g.fillRect(x, y, 20, 20);
    g.globalAlpha = listo ? 0.55 : 0.25;
    g.fillStyle = color;
    if (definitiva) {
      const f = Math.min(1, p.cargaDefinitiva / CARGA_DEFINITIVA);
      g.fillRect(x, y + 20 - Math.round(20 * f), 20, Math.round(20 * f));
    } else {
      g.fillRect(x, y, 20, 20);
    }
    g.globalAlpha = 1;
    dibujarIconoHabilidad(g, h.def.forma, x + 10, y + 10, listo ? "#ffffff" : "#8a84a0");
    if (!definitiva && j.enfriamiento(r) > 0) {
      const f = j.enfriamiento(r) / Math.max(0.1, h.cd);
      g.fillStyle = "#000000aa";
      g.fillRect(x, y, 20, Math.round(20 * f));
      texto(g, `${Math.ceil(j.enfriamiento(r))}`, x + 10, y + 14, "#ffffff", "center", 8);
    }
    const borde = definitiva ? (listo && Math.floor(performance.now() / 250) % 2 === 0 ? "#ffffff" : "#ffd27a") : listo ? color : "#4a4458";
    g.strokeStyle = borde;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, 19, 19);
    texto(g, TECLA_RANURA_ALMA[r], x + 1, y - 2, definitiva ? "#ffd27a" : "#d8d0e8", "left", 6);
    if (!definitiva) texto(g, `${h.costo}`, x + 19, y + 19, p.mp >= h.costo ? "#8ad8ff" : "#ff6a6a", "right", 5);
    else if (!listo) texto(g, `${Math.floor(p.cargaDefinitiva)}%`, x + 10, y + 19, "#ffd27a", "center", 5);
  });
  if (j.buffActivo) texto(g, "Aura activa", 296, y - 3, "#ffe08a", "center", 6);
}

/** Iconos simples de cada forma de habilidad. */
function dibujarIconoHabilidad(g: CanvasRenderingContext2D, forma: FormaHabilidad, cx: number, cy: number, color: string): void {
  g.fillStyle = color;
  const r = (dx: number, dy: number, w: number, h: number): void => g.fillRect(cx + dx, cy + dy, w, h);
  switch (forma) {
    case "proyectil": r(-5, -1, 6, 3); r(1, -2, 3, 5); r(4, -1, 2, 3); break;
    case "boomerang": r(-5, -4, 3, 3); r(-3, -2, 3, 3); r(-1, 0, 3, 3); r(2, -2, 3, 3); r(4, -4, 2, 3); break;
    case "embestida": r(-6, -1, 10, 2); r(2, -3, 2, 6); r(4, -2, 2, 4); r(-6, -4, 3, 1); r(-6, 3, 3, 1); break;
    case "garras": r(-4, -5, 1, 9); r(-1, -5, 1, 9); r(2, -5, 1, 9); r(-4, -5, 7, 1); break;
    case "onda": r(-6, 3, 12, 2); r(-6, 0, 2, 3); r(4, 0, 2, 3); r(-1, -3, 2, 6); break;
    case "salto": r(-1, -6, 2, 7); r(-3, -3, 6, 1); r(-6, 3, 12, 2); break;
    case "rayo": r(0, -6, 2, 4); r(-2, -2, 4, 2); r(-1, 0, 2, 3); r(-3, 3, 3, 2); break;
    case "orbita": r(-1, -6, 2, 2); r(-6, -1, 2, 2); r(4, -1, 2, 2); r(-1, 4, 2, 2); r(-1, -1, 2, 2); break;
    case "nova": r(-1, -1, 2, 2); r(-6, -1, 3, 2); r(3, -1, 3, 2); r(-1, -6, 2, 3); r(-1, 3, 2, 3); r(-4, -4, 2, 2); r(2, 2, 2, 2); r(2, -4, 2, 2); r(-4, 2, 2, 2); break;
    case "lluvia": r(-5, -5, 2, 4); r(-1, -3, 2, 4); r(3, -6, 2, 4); r(-3, 2, 2, 4); r(2, 2, 2, 4); break;
    case "aura": r(-5, -5, 10, 1); r(-5, 4, 10, 1); r(-5, -5, 1, 10); r(4, -5, 1, 10); r(-2, -2, 4, 4); break;
  }
}

export function dibujarMinimapa(g: CanvasRenderingContext2D, mapa: MapaPiso, juego: Juego, ox: number, oy: number, celda = 9): void {
  const w = mapa.ancho * celda;
  const h = mapa.alto * celda;
  g.fillStyle = "#000000aa";
  g.fillRect(ox - 2, oy - 2, w + 4, h + 4);
  const actual = juego.salaActualId();
  // Ojo del Abismo: el mapa entero se ve desde el principio.
  const todo = juego.jugador.reliquias.has("ojoAbismo");
  for (const s of mapa.salas) {
    const visitada = juego.salaVisitada(s.id) || todo;
    const vecinaVisitada = !visitada && Object.values(aperturas(mapa, s.id)).some((v) => v !== undefined && juego.salaVisitada(v.destino));
    if (!visitada && !vecinaVisitada) continue;
    const x = ox + s.x * celda;
    const y = oy + s.y * celda;
    g.fillStyle = s.id === actual ? "#ffe9a8" : visitada ? "#5a5470" : "#2a2638";
    g.fillRect(x + 1, y + 1, celda - 2, celda - 2);
    if (visitada) {
      const icono: Partial<Record<string, string>> = {
        jefe: "#ff3d3d", altar: "#a07cff", tesoro: "#ffd23d", reliquia: "#7fe3ff", mercader: "#ffb23d", eco: "#ff8aff", inicio: "#ffffff",
        arena: "#ff6a3d", boveda: "#ffe9a8",
      };
      const c = juego.abismo && s.tipo === "jefe" ? "#b04dff" : icono[s.tipo];
      if (c !== undefined) {
        g.fillStyle = c;
        g.fillRect(x + celda / 2 - 1, y + celda / 2 - 1, 2, 2);
      }
      // puertas
      const ap = aperturas(mapa, s.id);
      g.fillStyle = "#8a84a0";
      if (ap.der !== undefined) g.fillRect(x + celda - 1, y + celda / 2 - 1, 2, 2);
      if (ap.aba !== undefined) g.fillRect(x + celda / 2 - 1, y + celda - 1, 2, 2);
      for (const [dir, v] of Object.entries(ap)) {
        if (v?.barrera === undefined) continue;
        g.fillStyle = v.barrera === "cristal" ? "#7fe3ff" : "#ff7a3d";
        if (dir === "izq") g.fillRect(x, y + 2, 1, celda - 4);
        if (dir === "der") g.fillRect(x + celda - 1, y + 2, 1, celda - 4);
      }
    }
  }
  // Las extracciones se conocen desde el principio (como los mapas de salida): un rombo verde parpadeante.
  const brillo = Math.floor(performance.now() / 400) % 2 === 0;
  for (const id of mapa.extracciones ?? []) {
    const s = mapa.salas[id];
    if (s === undefined) continue;
    // Abismo: las salidas están ocultas hasta encontrarlas (o con el Ojo del Abismo).
    if (juego.abismo && !todo && !juego.salaVisitada(id)) continue;
    const x = ox + s.x * celda + celda / 2;
    const y = oy + s.y * celda + celda / 2;
    g.fillStyle = brillo ? "#7dffb0" : "#3d9a6a";
    g.fillRect(x - 1, y - 2, 2, 4);
    g.fillRect(x - 2, y - 1, 4, 2);
  }
}

/** Medidor de estilo: golpes, rango (D → SSS) y la barrita que se vacía si dejás de pegar. */
function dibujarCombo(g: CanvasRenderingContext2D, juego: Juego): void {
  const c = juego.combo;
  if (c.golpes < 2 && c.puntos < 1) return;
  const r = c.rango;
  const x = 476;
  const y = 66;
  const pulso = 1 + Math.max(0, Math.sin(performance.now() / 90)) * (c.indiceRango >= 4 ? 0.15 : 0);
  g.save();
  g.textAlign = "right";
  hd.texto(g, r.nombre, x, y, { color: r.color, alinear: "right", tam: 20 * pulso, titulo: true });
  hd.texto(g, r.titulo, x, y + 10, { color: r.color, alinear: "right", tam: 8 });
  if (c.golpes >= 2) hd.texto(g, `${c.golpes} golpes`, x, y + 23, { color: "#ffffff", alinear: "right", tam: 10 });
  g.fillStyle = "#000000aa";
  g.fillRect(x - 60, y + 27, 60, 3);
  g.fillStyle = r.color;
  g.fillRect(x - 60, y + 27, Math.round(60 * c.resto), 3);
  g.restore();
}

/** HUD del pueblo: quién sos, cuánto tenés y qué teclas usar. */
export function dibujarHudPueblo(g: CanvasRenderingContext2D, pueblo: Pueblo, meta: Meta, nombre: string): void {
  const p = pueblo.partida;
  const s = p.stats();
  g.font = "bold 8px monospace";
  g.fillStyle = "#000000aa";
  g.fillRect(4, 4, 168, 34);
  texto(g, `${nombre} · Nv ${p.nivel()}`, 8, 14, "#ffe9a8");
  texto(g, `♥ ${s.hp}  ✦ ${s.mp}  ◆ ${p.esquirlas}  ✧ ${meta.esencia}`, 8, 24, "#d8d0e8");
  texto(g, `Puedes bajar hasta el piso ${p.pisoDesbloqueado}`, 8, 34, "#a09ab8");
  const completas = p.misiones.listaActivas().filter((m) => p.misiones.completa(m.id)).length;
  if (completas > 0 && Math.floor(performance.now() / 500) % 2 === 0) texto(g, `${completas} misión(es) lista(s) para entregar en la taberna`, 8, 50, "#ffd27a");
  texto(g, "E hablar · I inventario · Esc pausa", 476, 262, "#a09ab8", "right");
  texto(g, "Último Refugio", 6, 262, "#ffd27a");
}
