// Medidor de estilo (combo): premia pegar seguido y VARIADO. Sube de rango D → SSS, da daño extra y, en S o más,
// velocidad de ataque. Se cae si dejás de pegar 2,4 s o si te golpean. Lógica pura (sin dibujo): la testea vitest.

export interface Rango {
  readonly nombre: string;
  readonly titulo: string;
  readonly puntos: number;
  readonly color: string;
}

export const RANGOS: readonly Rango[] = [
  { nombre: "D", titulo: "Despierto", puntos: 0, color: "#8a84a0" },
  { nombre: "C", titulo: "Certero", puntos: 6, color: "#7fe3ff" },
  { nombre: "B", titulo: "Brutal", puntos: 14, color: "#7dff9a" },
  { nombre: "A", titulo: "Atroz", puntos: 26, color: "#ffe27a" },
  { nombre: "S", titulo: "Salvaje", puntos: 42, color: "#ffb23d" },
  { nombre: "SS", titulo: "Sangriento", puntos: 62, color: "#ff6a3d" },
  { nombre: "SSS", titulo: "¡FRENÉTICO!", puntos: 88, color: "#ff3d6a" },
];

export const VENTANA_COMBO = 2.4;

/** Cuántos puntos da cada tipo de acción (lo variado vale más). */
export type AccionEstilo = "golpe" | "patada" | "tecnica" | "subarma" | "cargado" | "estocada" | "aereo" | "desvio" | "esquiva" | "muerte";

const PUNTOS: Readonly<Record<AccionEstilo, number>> = {
  golpe: 1, patada: 1.5, tecnica: 2, subarma: 1.5, cargado: 3, estocada: 2, aereo: 1.5, desvio: 4, esquiva: 4, muerte: 2,
};

export class MedidorCombo {
  golpes = 0;
  puntos = 0;
  /** Segundos desde la última acción que sumó. */
  private quieto = 0;
  private recientes: AccionEstilo[] = [];
  mejorCombo = 0;

  /** Registra una acción. Devuelve el rango nuevo si subió (para festejarlo). */
  registrar(a: AccionEstilo): Rango | null {
    const antes = this.indiceRango;
    if (a !== "muerte" && a !== "esquiva" && a !== "desvio") this.golpes++;
    // Repetir siempre lo mismo rinde la mitad; variar, el doble.
    const repetidas = this.recientes.filter((r) => r === a).length;
    const variedad = repetidas === 0 ? 1.5 : repetidas >= 3 ? 0.5 : 1;
    this.puntos += PUNTOS[a] * variedad;
    this.recientes.push(a);
    if (this.recientes.length > 4) this.recientes.shift();
    this.quieto = 0;
    this.mejorCombo = Math.max(this.mejorCombo, this.golpes);
    return this.indiceRango > antes ? RANGOS[this.indiceRango] : null;
  }

  /** Avanza el tiempo; si pasó la ventana, el combo se corta. */
  actualizar(dt: number): void {
    this.quieto += dt;
    if (this.quieto > VENTANA_COMBO) this.reiniciar();
  }

  /** Recibir daño corta el combo (y baja el estilo). */
  recibirDanio(): void {
    this.reiniciar();
  }

  reiniciar(): void {
    this.golpes = 0;
    this.puntos = 0;
    this.recientes = [];
  }

  get indiceRango(): number {
    let i = 0;
    for (let k = 0; k < RANGOS.length; k++) if (this.puntos >= RANGOS[k].puntos) i = k;
    return i;
  }

  get rango(): Rango {
    return RANGOS[this.indiceRango];
  }

  /** Fracción de la ventana que queda (para la barrita del HUD). */
  get resto(): number {
    return Math.max(0, 1 - this.quieto / VENTANA_COMBO);
  }

  /** +4 % de daño por rango (hasta +24 % en SSS). */
  get multiplicadorDanio(): number {
    return 1 + this.indiceRango * 0.04;
  }

  /** Velocidad de ataque extra en S o más. */
  get bonoVelocidad(): number {
    return this.indiceRango >= 4 ? 0.1 + (this.indiceRango - 4) * 0.05 : 0;
  }

  /** Éter extra por golpe según el rango. */
  get bonoEter(): number {
    return Math.floor(this.indiceRango / 2);
  }
}
