// Teclado → acciones. "recien" = se apretó en este paso de simulación (se consume al final del paso).

export type Accion =
  | "izq" | "der" | "arr" | "aba" | "saltar" | "golpe" | "patada" | "tecnica" | "embestida"
  | "interactuar" | "pocion" | "eter" | "inventario" | "mapa" | "pausa";

const TECLAS: Readonly<Record<string, Accion>> = {
  ArrowLeft: "izq", KeyA: "izq",
  ArrowRight: "der", KeyD: "der",
  ArrowUp: "arr", KeyW: "arr",
  ArrowDown: "aba", KeyS: "aba",
  Space: "saltar", KeyZ: "saltar",
  KeyJ: "golpe", KeyX: "golpe",
  KeyK: "patada", KeyC: "patada",
  KeyL: "tecnica", KeyV: "tecnica",
  ShiftLeft: "embestida", ShiftRight: "embestida",
  KeyE: "interactuar",
  KeyQ: "pocion",
  KeyR: "eter",
  KeyI: "inventario", Tab: "inventario",
  KeyM: "mapa",
  Escape: "pausa",
};

export const AYUDA_CONTROLES: ReadonlyArray<readonly [string, string]> = [
  ["A / D  ·  ← →", "Moverse"],
  ["Espacio  ·  Z", "Saltar (cancela golpes)"],
  ["J  ·  X", "Golpe (combo según el arma). Mantener y soltar: ataque cargado"],
  ["J tras esquivar", "Estocada: golpe durante el paso atrás o la embestida"],
  ["K  ·  C", "Patada: rompe guardias; en el aire con ↓ es un pisotón"],
  ["L  ·  V", "Técnica de tu Forma (gasta éter)"],
  ["↓", "Agacharse (los proyectiles altos pasan por encima; golpe bajo)"],
  ["↓ + Salto", "Deslizarse con una patada baja (en una plataforma: bajar)"],
  ["Shift (quieto)", "Paso atrás invulnerable. Justo antes de un golpe: ¡esquiva perfecta!"],
  ["Shift + dirección", "Embestida (reliquia)"],
  ["↑ + K", "Subarma (gasta ♥; rompe velas para conseguir corazones)"],
  ["E", "Interactuar (cofres, altar, mercader, reliquias, portal)"],
  ["Q  /  R", "Poción de vida  /  Frasco de éter"],
  ["I  ·  Tab", "Inventario, cartas y stats"],
  ["M", "Mapa del piso (y volver al Faro)"],
  ["Esc", "Pausa"],
];

export class Entrada {
  private readonly abajo = new Set<Accion>();
  private readonly recientes = new Set<Accion>();
  private readonly soltadas = new Set<Accion>();
  bloqueada = false;

  constructor(destino: Window) {
    destino.addEventListener("keydown", (e) => {
      const a = TECLAS[e.code];
      if (a === undefined) return;
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!e.repeat) this.recientes.add(a);
      this.abajo.add(a);
    });
    destino.addEventListener("keyup", (e) => {
      const a = TECLAS[e.code];
      if (a === undefined) return;
      this.abajo.delete(a);
      this.soltadas.add(a);
    });
    destino.addEventListener("blur", () => this.abajo.clear());
  }

  pulsada(a: Accion): boolean {
    return !this.bloqueada && this.abajo.has(a);
  }

  recien(a: Accion): boolean {
    return !this.bloqueada && this.recientes.has(a);
  }

  /** Para menús: lee la tecla aunque el juego esté bloqueado. */
  recienSiempre(a: Accion): boolean {
    return this.recientes.has(a);
  }

  soltada(a: Accion): boolean {
    return this.soltadas.has(a);
  }

  finPaso(): void {
    this.recientes.clear();
    this.soltadas.clear();
  }

  limpiar(): void {
    this.abajo.clear();
    this.recientes.clear();
    this.soltadas.clear();
  }
}
