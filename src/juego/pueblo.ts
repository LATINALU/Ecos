// El pueblo de la superficie ("Último Refugio"): base entre descensos. Una calle de dos pantallas que se recorre
// con el mismo Portador (mismo movimiento y animaciones). Cada edificio tiene su comerciante:
//   Taberna (misiones y descanso) · Bazar (compra/venta) · Armería (equipo) · Bóveda (banco) ·
//   Altar (cartas) · Fragua (yunque) · Santuario (esencia y memorial) · el Pozo (bajar).
// Implementa Contexto para que el Jugador funcione igual que abajo (sin enemigos).

import { hd } from "../motor/texto-hd.ts";
import { BIOMAS, type Bioma } from "../contenido/biomas.ts";
import { ROCA } from "../contenido/atlas.ts";
import { ALTO_SALA, ANCHO_SALA, FILAS, TILE } from "../dominio/mundo/sala.ts";
import type { Meta } from "../dominio/meta.ts";
import type { Partida } from "../dominio/partida.ts";
import type { Audio } from "../motor/audio.ts";
import type { Entrada } from "../motor/entrada.ts";
import type { Tiles } from "../motor/fisica.ts";
import { dibujarRecorte, sprites } from "../motor/sprites.ts";
import type { AtaqueJugador, Contexto, Peligro } from "./contexto.ts";
import { Efectos } from "./efectos.ts";
import type { Criatura } from "./entidades/criatura.ts";
import { Jugador } from "./entidades/jugador.ts";
import type { Proyectil } from "./entidades/proyectil.ts";
import { dibujarPortador } from "./render-portador.ts";
import { animarEdificio, chimeneas, dibujarEdificio, dibujarRotulos, lucesEdificio, type Rotulo } from "./edificios.ts";
import { Iluminacion, dibujarVineta, type Luz } from "./render.ts";

export type Servicio = "taberna" | "mercader" | "armero" | "banco" | "altar" | "herrero" | "santuario" | "pozo";

export interface Npc {
  readonly servicio: Servicio;
  readonly nombre: string;
  readonly edificio: string;
  readonly x: number;
  readonly paleta: readonly [string, string];
  readonly variante: number;
  readonly frases: readonly string[];
  readonly muro: string;
  readonly techo: string;
}

export const COLS_PUEBLO = 72;
export const ANCHO_PUEBLO = COLS_PUEBLO * TILE;
const SUELO = 14 * TILE;

export const NPCS: readonly Npc[] = [
  {
    servicio: "taberna", nombre: "Ilse", edificio: "Taberna «El Último Eco»", x: 80, paleta: ["#7a3a2a", "#ffd27a"], variante: 1,
    frases: ["¿Otra vez de vuelta? El tablón tiene trabajo.", "Los que no vuelven dejan cuentas sin pagar."], muro: "#5a3a28", techo: "#7a2a20",
  },
  {
    servicio: "mercader", nombre: "Tobías", edificio: "Bazar del Pozo", x: 216, paleta: ["#3a5a3a", "#ffb23d"], variante: 3,
    frases: ["Todo se compra, todo se vende.", "¿Pociones? ¿Huesos? Tengo de todo."], muro: "#4a4030", techo: "#2a5a3a",
  },
  {
    servicio: "armero", nombre: "Brunhild", edificio: "Armería Hierro Viejo", x: 352, paleta: ["#6a6a7a", "#ff7a3d"], variante: 0,
    frases: ["Acero nuevo cada vez que volvés.", "Cuanto más bajes, mejor lo que traigo."], muro: "#4a4a58", techo: "#3a3a48",
  },
  {
    servicio: "banco", nombre: "Custodio Vael", edificio: "Bóveda de los Caídos", x: 488, paleta: ["#2a2a40", "#c9a7ff"], variante: 2,
    frases: ["Lo que dejes aquí no lo reclama el Pozo.", "Guardo hasta lo que los muertos olvidaron."], muro: "#3a3448", techo: "#2a2440",
  },
  {
    servicio: "altar", nombre: "Hermana Ceniza", edificio: "Altar de las Almas", x: 624, paleta: ["#e8e0cc", "#a07cff"], variante: 1,
    frases: ["Tres almas, una sola voz.", "Las almas se reconocen entre ellas."], muro: "#5a5068", techo: "#6a4a8a",
  },
  {
    servicio: "herrero", nombre: "Dorn", edificio: "Fragua del Pueblo", x: 760, paleta: ["#5a3a2a", "#ff7a3d"], variante: 0,
    frases: ["Del +6 en adelante, reza.", "Traeme fragmentos y te hago magia."], muro: "#4a3028", techo: "#3a2018",
  },
  {
    servicio: "santuario", nombre: "El Ermitaño", edificio: "Santuario", x: 896, paleta: ["#2a3a4a", "#9fe8ff"], variante: 2,
    frases: ["La esencia de los que caen fortalece al que sigue.", "Tus ecos también me visitan."], muro: "#3a4a5a", techo: "#2a3a5a",
  },
  {
    servicio: "pozo", nombre: "El Pozo", edificio: "El Pozo", x: 1036, paleta: ["#1a1428", "#c9a7ff"], variante: 1,
    frases: ["Abajo, todo recuerda."], muro: "#2a2438", techo: "#1a1428",
  },
];

export interface EventosPueblo {
  abrirServicio(s: Servicio): void;
  mensaje(texto: string, color: string): void;
}

class CallePueblo implements Tiles {
  readonly cols = COLS_PUEBLO;

  tile(tx: number, ty: number): number {
    if (ty >= 14) return 1;
    return tx <= 0 || tx >= COLS_PUEBLO - 1 ? 1 : 0;
  }
}

export class Pueblo implements Contexto {
  readonly partida: Partida;
  readonly tiles = new CallePueblo();
  readonly jugador = new Jugador();
  readonly fx = new Efectos();
  readonly audio: Audio;
  readonly bioma: Bioma = BIOMAS[0];
  readonly piso = 1;
  readonly criaturas: readonly Criatura[] = [];
  private readonly entrada: Entrada;
  private readonly eventos: EventosPueblo;
  private readonly luz = new Iluminacion(ANCHO_SALA, 270);
  private fondo: HTMLCanvasElement | null = null;
  private rotulos: Rotulo[] = [];
  private t = 0;
  private camX = 0;
  private frase = new Map<Servicio, number>();

  constructor(partida: Partida, meta: Meta, audio: Audio, entrada: Entrada, eventos: EventosPueblo, desde: "inicio" | "pozo" = "inicio") {
    this.partida = partida;
    this.audio = audio;
    this.entrada = entrada;
    this.eventos = eventos;
    this.jugador.reliquias = new Set(meta.listaReliquias());
    const x = desde === "pozo" ? NPCS[NPCS.length - 1].x - 50 : NPCS[0].x + 40;
    this.jugador.colocar(x, SUELO - this.jugador.h);
    partida.curarTodo();
  }

  // ---- Contexto (sin enemigos: los golpes no pegan a nadie)
  agregarProyectil(_p: Proyectil): void {}
  agregarCriatura(_c: Criatura): void {}
  agregarPeligro(_p: Peligro): void {}
  golpearJugador(): void {}
  golpearCriatura(_c: Criatura, _a: AtaqueJugador): boolean {
    return false;
  }
  golpearArea(): number {
    return 0;
  }
  tocarBarreras(): void {}
  mensaje(texto: string, color = "#ffffff"): void {
    this.eventos.mensaje(texto, color);
  }

  /** El NPC al alcance (para la etiqueta y para E). */
  cercano(): Npc | undefined {
    return NPCS.find((n) => Math.abs(this.jugador.cx - n.x) < (n.servicio === "pozo" ? 34 : 22));
  }

  actualizar(dt: number): void {
    this.t += dt;
    this.jugador.actualizar(dt, this, this.entrada);
    this.fx.actualizar(dt);
    if (Math.random() < dt * 6) {
      // luciérnagas y brasas de los faroles
      this.fx.ambiente(Math.random() * ANCHO_PUEBLO, 120 + Math.random() * 100, Math.random() < 0.6 ? "#ffe27a" : "#c9a7ff", -6, true);
    }
    for (const e of NPCS) {
      for (const [hx, hy] of chimeneas(e.servicio, e.x, SUELO)) {
        if (Math.random() < dt * (e.servicio === "herrero" ? 9 : 4)) this.fx.ambiente(hx + Math.random() * 6, hy, e.servicio === "herrero" && Math.random() < 0.3 ? "#ff9a3d" : "#6a6478", -14, e.servicio === "herrero");
      }
    }
    const n = this.cercano();
    if (n !== undefined && this.entrada.recien("interactuar")) {
      const i = (this.frase.get(n.servicio) ?? -1) + 1;
      this.frase.set(n.servicio, i);
      this.audio.reproducir("puerta");
      this.eventos.abrirServicio(n.servicio);
    }
    this.camX = Math.max(0, Math.min(ANCHO_PUEBLO - ANCHO_SALA, this.jugador.cx - ANCHO_SALA / 2));
  }

  // ---------------- Dibujo ----------------

  private prerender(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = ANCHO_PUEBLO;
    c.height = ALTO_SALA;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    // Murallas y casitas del fondo (siluetas), luego cada edificio según su oficio.
    g.fillStyle = "#1c1626";
    for (let x = 0; x < ANCHO_PUEBLO; x += 46) {
      const h = 40 + ((x * 7) % 23);
      g.fillRect(x + 4, SUELO - h, 34, h);
      g.beginPath();
      g.moveTo(x, SUELO - h);
      g.lineTo(x + 21, SUELO - h - 18);
      g.lineTo(x + 42, SUELO - h);
      g.fill();
    }
    g.fillStyle = "#ffcf6a55";
    for (let x = 0; x < ANCHO_PUEBLO; x += 46) if ((x / 46) % 3 !== 1) g.fillRect(x + 16, SUELO - 30 - ((x * 7) % 11), 3, 4);
    this.rotulos = NPCS.flatMap((n) => dibujarEdificio(g, n.servicio, n.x, SUELO, n.edificio));
    // Faroles entre edificios
    for (let i = 0; i < NPCS.length - 1; i++) {
      const x = (NPCS[i].x + NPCS[i + 1].x) / 2;
      g.fillStyle = "#1a1622";
      g.fillRect(x - 1, SUELO - 46, 3, 46);
      g.fillRect(x - 4, SUELO - 48, 9, 3);
      g.fillStyle = "#ffe9a8";
      g.fillRect(x - 3, SUELO - 56, 7, 8);
    }
    // Calle empedrada
    const atlas = sprites.imagen("castillo");
    for (let tx = 0; tx < COLS_PUEBLO; tx++) {
      for (let ty = 14; ty < FILAS; ty++) {
        if (atlas !== null) {
          dibujarRecorte(g, atlas, ty === 14 ? ROCA.arriba : ROCA.interior, tx * TILE, ty * TILE);
        } else {
          g.fillStyle = ty === 14 ? "#6e6684" : "#3a3448";
          g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }
    return c;
  }

  dibujar(g: CanvasRenderingContext2D): void {
    if (this.fondo === null) this.fondo = this.prerender();
    const cam = Math.round(this.camX);
    // Cielo de atardecer, estrellas, montañas y el resplandor del Pozo
    const grad = g.createLinearGradient(0, 0, 0, 270);
    grad.addColorStop(0, "#120c22");
    grad.addColorStop(0.6, "#3a2240");
    grad.addColorStop(1, "#6a3a3a");
    g.fillStyle = grad;
    g.fillRect(0, 0, ANCHO_SALA, 270);
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 + 13) % ANCHO_SALA;
      const sy = (i * 53) % 110;
      g.fillStyle = Math.sin(this.t * 2 + i) > 0.6 ? "#ffffff" : "#8a84a0";
      g.fillRect(sx, sy, 1, 1);
    }
    g.fillStyle = "#f2e6d0";
    g.beginPath();
    g.arc(80 - cam * 0.05, 40, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1e1428";
    for (let i = 0; i < 12; i++) {
      const mx = i * 70 - cam * 0.2;
      g.beginPath();
      g.moveTo(mx, 200);
      g.lineTo(mx + 40, 120 + ((i * 37) % 40));
      g.lineTo(mx + 90, 200);
      g.fill();
    }
    // Castillo en la colina (parallax lento)
    const cx0 = 300 - cam * 0.12;
    g.fillStyle = "#170f22";
    g.beginPath();
    g.ellipse(cx0, 205, 150, 50, 0, Math.PI, 0);
    g.fill();
    for (const [dx, w, h] of [[-50, 16, 70], [-26, 40, 50], [18, 14, 84], [40, 30, 44], [70, 12, 60]] as const) {
      g.fillRect(cx0 + dx, 165 - h, w, h + 10);
      for (let k = 0; k < w; k += 5) g.fillRect(cx0 + dx + k, 161 - h, 3, 4);
    }
    g.fillStyle = "#ffcf6a88";
    g.fillRect(cx0 + 22, 100, 2, 3);
    g.fillRect(cx0 - 45, 118, 2, 3);
    g.fillRect(cx0 + 50, 140, 2, 3);
    g.fillStyle = "#c83a3a";
    g.fillRect(cx0 + 25, 66, 1, 12);
    g.fillRect(cx0 + 26, 66 + Math.round(Math.sin(this.t * 3)), 7, 4);

    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25 + Math.sin(this.t) * 0.05;
    g.fillStyle = "#a07cff";
    g.beginPath();
    g.ellipse(ANCHO_PUEBLO - 80 - cam * 0.6, 210, 120, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.save();
    g.translate(-cam, -2);
    g.drawImage(this.fondo, 0, 0);
    for (const n of NPCS) if (Math.abs(n.x - cam - ANCHO_SALA / 2) < ANCHO_SALA) animarEdificio(g, n.servicio, n.x, SUELO, this.t);
    dibujarRotulos(g, this.rotulos.filter((r) => Math.abs(r.x - cam - ANCHO_SALA / 2) < ANCHO_SALA / 2 + 60));
    // Comerciantes
    for (const n of NPCS) {
      if (n.servicio === "pozo") continue;
      const dir = this.jugador.cx < n.x ? -1 : 1;
      dibujarPortador(g, n.x - 24, SUELO, dir, "quieto", { cuerpo: n.paleta[0], acento: n.paleta[1] }, this.t + n.x, { variante: n.variante });
    }
    this.jugador.dibujar(g, this);
    this.fx.dibujarParticulas(g);
    g.restore();

    // Luces: ventanas, faroles, el Portador
    const luces: Luz[] = [{ x: this.jugador.cx - cam, y: this.jugador.cy, r: 80 }];
    for (const n of NPCS) {
      for (const l of lucesEdificio(n.servicio, n.x, SUELO - 2, this.t)) luces.push({ ...l, x: l.x - cam });
    }
    for (let i = 0; i < NPCS.length - 1; i++) {
      const x = (NPCS[i].x + NPCS[i + 1].x) / 2;
      luces.push({ x: x - cam, y: SUELO - 52, r: 52 + Math.sin(this.t * 7 + i) * 3, fuerza: 0.9 });
    }
    this.luz.dibujar(g, 0.38, luces, "rgba(0,0,0,0)");
    dibujarVineta(g);

    // Etiqueta del comerciante cercano
    g.save();
    g.translate(-cam, 0);
    const cerca = this.cercano();
    if (cerca !== undefined) {
      const frases = cerca.frases;
      const linea = frases[(this.frase.get(cerca.servicio) ?? 0) % frases.length];
      const texto = cerca.servicio === "pozo" ? "E · Bajar al Pozo o al Abismo" : `E · ${cerca.nombre} — ${cerca.edificio}`;
      g.font = "bold 8px monospace";
      const w = Math.max(g.measureText(texto).width, g.measureText(linea).width) + 10;
      const x = Math.round(Math.max(cam + 4, Math.min(cam + ANCHO_SALA - w - 4, cerca.x - w / 2)));
      const y = SUELO - 130;
      g.fillStyle = "#000000cc";
      g.fillRect(x, y, w, 24);
      hd.texto(g, texto, x + 5, y + 10, { color: "#ffe9a8" });
      hd.texto(g, linea, x + 5, y + 20, { color: "#c9c0d8", tam: 7, negrita: false });
    }
    this.fx.dibujarTextos(g);
    g.restore();
  }
}
