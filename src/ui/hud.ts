// HUD dibujado en el canvas: vida, éter, experiencia, forma/técnica, frascos, esquirlas, minimapa y jefe.

import { INFO_TECNICA, alma } from "../contenido/almas.ts";
import { bioma } from "../contenido/biomas.ts";
import { OBJ_ETER, OBJ_POCION } from "../contenido/objetos.ts";
import { SUBARMAS } from "../contenido/subarmas.ts";
import { estrellas } from "../dominio/cartas.ts";
import { dibujarIconoSubarma } from "../juego/entidades/objetos.ts";
import { aperturas, type MapaPiso } from "../dominio/mundo/generador.ts";
import { SEGUNDOS_EXTRACCION, type Juego } from "../juego/juego.ts";
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

function texto(g: CanvasRenderingContext2D, t: string, x: number, y: number, color = "#ffffff", alinear: CanvasTextAlign = "left"): void {
  g.textAlign = alinear;
  g.fillStyle = "#000000";
  g.fillText(t, x + 1, y + 1);
  g.fillStyle = color;
  g.fillText(t, x, y);
  g.textAlign = "left";
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

  // Técnica
  if (a !== null && forma !== null) {
    const tec = INFO_TECNICA[a.tecnica];
    const costo = p.costoTecnica(tec.costo);
    const puede = p.mp >= costo;
    texto(g, `L · ${tec.nombre} (${costo})`, 6, 38, puede ? "#ffffff" : "#777788");
    texto(g, `${a.nombre} ${estrellas(forma)}`, 6, 48, a.colorSec);
  } else {
    texto(g, "Sin Forma (I para equipar)", 6, 38, "#777788");
  }

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
    const prog = Math.min(1, juego.cargaExtraccion / SEGUNDOS_EXTRACCION);
    texto(g, `EXTRAYENDO ${Math.ceil(SEGUNDOS_EXTRACCION - juego.cargaExtraccion)} s`, 240, 200, "#7dffb0", "center");
    barra(g, 180, 204, 120, 4, prog, "#7dffb0");
  }

  // Piso
  const b = bioma(p.piso);
  texto(g, `Piso ${p.piso} · ${b.nombre}`, 476, 262, b.acento, "right");

  dibujarMinimapa(g, juego.mapa, juego, 406, 4);
  dibujarCombo(g, juego);

  // Jefe
  const jefe = juego.jefeActivo();
  if (jefe !== undefined) {
    const w = 260;
    const x = 240 - w / 2;
    texto(g, jefe.nombre, 240, 236, "#ffd0d0", "center");
    barra(g, x, 240, w, 5, jefe.hp / jefe.hpMax, jefe.hp / jefe.hpMax < 0.5 ? "#ff3d3d" : "#d83a5a", "#2a0a10");
  }
}

export function dibujarMinimapa(g: CanvasRenderingContext2D, mapa: MapaPiso, juego: Juego, ox: number, oy: number, celda = 9): void {
  const w = mapa.ancho * celda;
  const h = mapa.alto * celda;
  g.fillStyle = "#000000aa";
  g.fillRect(ox - 2, oy - 2, w + 4, h + 4);
  const actual = juego.salaActualId();
  for (const s of mapa.salas) {
    const visitada = juego.salaVisitada(s.id);
    const vecinaVisitada = !visitada && Object.values(aperturas(mapa, s.id)).some((v) => v !== undefined && juego.salaVisitada(v.destino));
    if (!visitada && !vecinaVisitada) continue;
    const x = ox + s.x * celda;
    const y = oy + s.y * celda;
    g.fillStyle = s.id === actual ? "#ffe9a8" : visitada ? "#5a5470" : "#2a2638";
    g.fillRect(x + 1, y + 1, celda - 2, celda - 2);
    if (visitada) {
      const icono: Partial<Record<string, string>> = {
        jefe: "#ff3d3d", altar: "#a07cff", tesoro: "#ffd23d", reliquia: "#7fe3ff", mercader: "#ffb23d", eco: "#ff8aff", inicio: "#ffffff",
      };
      const c = icono[s.tipo];
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
  g.font = `bold ${Math.round(20 * pulso)}px monospace`;
  g.fillStyle = "#000000";
  g.fillText(r.nombre, x + 1, y + 1);
  g.fillStyle = r.color;
  g.fillText(r.nombre, x, y);
  g.font = "bold 8px monospace";
  g.fillStyle = "#000000";
  g.fillText(r.titulo, x + 1, y + 11);
  g.fillStyle = r.color;
  g.fillText(r.titulo, x, y + 10);
  if (c.golpes >= 2) {
    g.font = "bold 11px monospace";
    g.fillStyle = "#000000";
    g.fillText(`${c.golpes} golpes`, x + 1, y + 24);
    g.fillStyle = "#ffffff";
    g.fillText(`${c.golpes} golpes`, x, y + 23);
  }
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
