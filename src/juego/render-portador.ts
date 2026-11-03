import { CuerdaVerlet } from "../motor/verlet.ts";
// Dibujo procedural del Portador (y de los Ecos): poses animadas + capa con física (verlet).
// Todo se dibuja en coordenadas locales: origen en los PIES, mirando a la derecha; el espejo lo hace la
// transformación. Así cada pose es una lista corta de rectángulos y queda legible a 12×22 px.

export type Pose =
  | "quieto" | "correr" | "saltar" | "caer" | "agachado" | "deslizar" | "atras" | "pared"
  | "golpe" | "golpeAlto" | "patada" | "lanzar" | "herido" | "trepar";

export interface PaletaPortador {
  readonly cuerpo: string;
  readonly acento: string;
  readonly piel?: string;
  readonly arma?: string;
}

const OSCURO = "#0d0b12";
const BOTAS = "#1a1622";

/** Capa con física: una cadena de puntos que cuelga de los hombros y sigue el movimiento. */
/** Capa del Portador: una CuerdaVerlet del motor anclada a los hombros. */
export class Capa {
  private readonly cuerda: CuerdaVerlet;

  constructor(segmentos = 7, largo = 2.6) {
    this.cuerda = new CuerdaVerlet({ x: 0, y: 0, segmentos: segmentos - 1, largoSegmento: largo, gravedad: 520, friccion: 0.9, iteraciones: 3 });
  }

  reiniciar(x: number, y: number): void {
    this.cuerda.reiniciar(x, y);
  }

  /** `ax, ay` = hombros (mundo). `dir` empuja la capa hacia atrás aunque esté quieto. */
  actualizar(ax: number, ay: number, dir: number, dt: number, viento = 0): void {
    const c = this.cuerda;
    if (Math.abs(c.x[0] - ax) > 40 || Math.abs(c.y[0] - ay) > 40) c.reiniciar(ax, ay);
    c.anclar(ax, ay);
    // El empuje crece hacia la punta (más tela al viento): la capa se ve aunque el Portador esté quieto.
    c.actualizar(dt, (-dir * 220 + viento) * 2);
  }

  dibujar(g: CanvasRenderingContext2D, exterior: string, interior: string): void {
    const c = this.cuerda;
    for (let i = 1; i < c.n; i++) {
      const ancho = Math.max(2, 6 - i * 0.5);
      for (let k = 0; k < 3; k++) {
        const t = k / 3;
        const x = c.x[i - 1] + (c.x[i] - c.x[i - 1]) * t;
        const y = c.y[i - 1] + (c.y[i] - c.y[i - 1]) * t;
        g.fillStyle = exterior;
        g.fillRect(Math.round(x - ancho / 2), Math.round(y), Math.ceil(ancho), 2);
        g.fillStyle = interior;
        g.fillRect(Math.round(x - ancho / 2), Math.round(y), 1, 2);
      }
    }
  }

  /** Borde de la capa en la capa emisiva: brilla con el aura de la Forma (5★+). */
  dibujarAura(e: CanvasRenderingContext2D, color: string): void {
    const c = this.cuerda;
    e.strokeStyle = color;
    e.lineWidth = 1;
    e.globalAlpha = 0.8;
    e.beginPath();
    for (let i = 1; i < c.n; i++) {
      const ancho = Math.max(2, 6 - i * 0.5);
      const x = Math.round(c.x[i] + ancho / 2);
      const y = Math.round(c.y[i]);
      if (i === 1) e.moveTo(x, y);
      else e.lineTo(x, y);
    }
    e.stroke();
    e.globalAlpha = 1;
  }
}

export interface OpcionesPortador {
  /** Familia de la Forma: 0 Hoja (yelmo con penacho), 1 Sombra (capucha), 2 Arcano (sombrero), 3 Bestia (orejas). */
  readonly variante?: number;
  /** Avance del ataque (0 = preparación, 1 = remate) para rotar el brazo. */
  readonly progreso?: number;
  /** >1 estira (salto), <1 aplasta (aterrizaje). */
  readonly estiramiento?: number;
}

export interface Mano {
  readonly manoX: number;
  readonly manoY: number;
  /** Ángulo del brazo en el mundo (radianes), para orientar el arma. */
  readonly angulo: number;
}

/**
 * Dibuja al Portador con su origen en (cx, pies). `t` = tiempo (s) para animar.
 * Devuelve la mano delantera y el ángulo del brazo (para enganchar y rotar el arma).
 */
export function dibujarPortador(
  g: CanvasRenderingContext2D, cx: number, pies: number, dir: number, pose: Pose, pal: PaletaPortador, t: number,
  op: OpcionesPortador = {},
): Mano {
  const est = op.estiramiento ?? 1;
  const prog = Math.max(0, Math.min(1, op.progreso ?? 0.6));
  g.save();
  g.translate(Math.round(cx), Math.round(pies));
  g.scale((dir < 0 ? -1 : 1) * (2 - est), est);
  let anguloBrazo = 1.2;
  const r = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };

  let mano = { x: 5, y: -12 };
  const cuerpo = pal.cuerpo;
  const acento = pal.acento;

  if (pose === "trepar") {
    // De espaldas, agarrado a la cadena: brazos y piernas alternados.
    const f = Math.floor(t * 8) % 2;
    r(-4, -6 + f, 3, 6 - f, BOTAS);
    r(1, -6 + (1 - f), 3, 6 - (1 - f), BOTAS);
    r(-4, -16, 8, 10, cuerpo);
    r(-4, -9, 8, 1, OSCURO);
    r(-3, -22, 7, 7, cuerpo);
    r(-3, -22, 7, 1, acento);
    r(-4, -16, 8, 2, acento);
    r(-6, -21 + f * 3, 2, 6, cuerpo);
    r(4, -21 + (1 - f) * 3, 2, 6, cuerpo);
    g.restore();
    return { manoX: Math.round(cx), manoY: Math.round(pies) - 20, angulo: -Math.PI / 2 };
  }
  if (pose === "agachado" || pose === "deslizar") {
    // Cuerpo bajo: 14 px de alto.
    const largo = pose === "deslizar";
    r(-5, -3, 4, 3, BOTAS);
    r(largo ? 1 : 0, -3, largo ? 6 : 4, 3, BOTAS);
    r(-4, -10, 8, 7, cuerpo);
    r(-4, -6, 8, 1, OSCURO);
    dibujarCabeza(r, op.variante ?? 1, -3, -16, cuerpo, acento, t);
    r(-4, -10, 8, 2, acento);
    if (largo) r(4, -2, 4, 1, "#ffffff55");
    mano = { x: 5, y: -7 };
  } else {
    const fase = ((Math.floor(t * 12) % 6) + 6) % 6;
    const respira = pose === "quieto" ? (Math.sin(t * 3) > 0.6 ? 1 : 0) : 0;
    // ---- Piernas
    let piernaA = 0;
    let piernaB = 0;
    let altoA = 6;
    let altoB = 6;
    if (pose === "correr") {
      const ciclo = [[-2, 2], [-1, 1], [0, 0], [2, -2], [1, -1], [0, 0]][fase];
      piernaA = ciclo[0];
      piernaB = ciclo[1];
      altoA = fase === 2 ? 5 : 6;
      altoB = fase === 5 ? 5 : 6;
    } else if (pose === "saltar") {
      piernaA = -1;
      piernaB = 2;
      altoA = 5;
      altoB = 4;
    } else if (pose === "caer" || pose === "pared") {
      piernaA = -2;
      piernaB = 1;
      altoB = 5;
    } else if (pose === "patada") {
      piernaB = 4;
    } else if (pose === "atras") {
      piernaA = -3;
      piernaB = 1;
    }
    r(-4 + piernaA, -altoA, 3, altoA, BOTAS);
    if (pose === "patada") {
      r(1, -9, 7, 3, BOTAS);
      r(7, -9, 2, 3, acento);
    } else {
      r(1 + piernaB, -altoB, 3, altoB, BOTAS);
    }
    // ---- Brazo trasero
    const balanceo = pose === "correr" ? [1, 2, 1, -1, -2, -1][fase] : 0;
    r(-5 - balanceo, -15 + respira, 2, 6, cuerpo);
    // ---- Torso
    const inclina = pose === "correr" || pose === "atras" ? 1 : 0;
    r(-4 + inclina, -16 + respira, 8, 10, cuerpo);
    r(-4 + inclina, -9 + respira, 8, 1, OSCURO);
    r(-1 + inclina, -9 + respira, 2, 1, "#c9a76a");
    // bufanda / cuello
    r(-4 + inclina, -16 + respira, 8, 2, acento);
    // ---- Cabeza según la familia de la Forma
    const cabezaY = -22 + respira + (pose === "golpe" && prog > 0.4 ? 1 : 0);
    const hx = -3 + inclina + (pose === "golpe" && prog > 0.4 ? 1 : 0);
    dibujarCabeza(r, op.variante ?? 1, hx, cabezaY, cuerpo, acento, t);
    // ---- Brazo delantero
    if (pose === "golpe" || pose === "golpeAlto") {
      // Arco del brazo: preparación atrás/arriba → golpe → seguimiento abajo.
      const desde = pose === "golpe" ? -2.3 : 0.9;
      const hasta = pose === "golpe" ? 0.9 : -1.7;
      const curva = 1 - Math.pow(1 - prog, 2);
      anguloBrazo = desde + (hasta - desde) * curva;
      const hombroX = 1 + inclina;
      const hombroY = -15 + respira;
      for (let k = 0; k <= 5; k++) r(Math.round(hombroX + Math.cos(anguloBrazo) * k), Math.round(hombroY + Math.sin(anguloBrazo) * k), 2, 2, cuerpo);
      mano = { x: Math.round(hombroX + Math.cos(anguloBrazo) * 6), y: Math.round(hombroY + Math.sin(anguloBrazo) * 6) };
    } else if (pose === "lanzar") {
      r(3, -17, 5, 2, cuerpo);
      mano = { x: 8, y: -17 };
    } else if (pose === "herido") {
      r(-7, -16, 3, 2, cuerpo);
      mano = { x: -7, y: -16 };
    } else if (pose === "pared") {
      r(4, -18, 2, 5, cuerpo);
      mano = { x: 5, y: -18 };
    } else {
      r(2 + balanceo, -15 + respira, 2, 6, cuerpo);
      mano = { x: 3 + balanceo, y: -10 + respira };
    }
  }
  g.restore();
  const s = dir < 0 ? -1 : 1;
  const ang = s > 0 ? anguloBrazo : Math.PI - anguloBrazo;
  return { manoX: Math.round(cx + mano.x * s * (2 - est)), manoY: Math.round(pies + mano.y * est), angulo: ang };
}

type Pincel = (x: number, y: number, w: number, h: number, c: string) => void;

/** Tocado según la familia: el mismo Portador se ve distinto con cada Forma. */
function dibujarCabeza(r: Pincel, variante: number, x: number, y: number, cuerpo: string, acento: string, t: number): void {
  switch (variante) {
    case 0: // Hoja: yelmo cerrado con visera y penacho
      r(x, y, 7, 7, "#9a94a8");
      r(x, y, 7, 1, "#c8c2d6");
      r(x + 2, y + 3, 5, 1, OSCURO);
      r(x + 4, y + 3, 1, 1, acento);
      r(x - 1, y - 2, 3, 2, acento);
      r(x - 2, y - 1 + (Math.sin(t * 6) > 0 ? 1 : 0), 2, 3, acento);
      break;
    case 2: // Arcano: sombrero puntiagudo con banda
      r(x, y + 1, 7, 6, cuerpo);
      r(x + 3, y + 3, 4, 3, OSCURO);
      r(x + 5, y + 4, 1, 1, acento);
      r(x - 2, y + 1, 11, 1, cuerpo);
      r(x, y - 1, 7, 2, cuerpo);
      r(x + 1, y - 3, 5, 2, cuerpo);
      r(x, y - 5, 4, 2, cuerpo);
      r(x - 2, y - 6, 3, 1, cuerpo);
      r(x, y, 7, 1, acento);
      break;
    case 3: // Bestia: capucha con orejas
      r(x, y, 7, 7, cuerpo);
      r(x, y - 2, 2, 2, cuerpo);
      r(x + 4, y - 2, 2, 2, cuerpo);
      r(x, y - 3, 1, 1, acento);
      r(x + 5, y - 3, 1, 1, acento);
      r(x + 3, y + 3, 4, 3, OSCURO);
      r(x + 4, y + 4, 1, 1, acento);
      r(x + 6, y + 4, 1, 1, acento);
      break;
    default: // Sombra: capucha clásica con punta
      r(x, y, 7, 7, cuerpo);
      r(x - 2, y + 1, 2, 2, cuerpo);
      r(x, y, 7, 1, acento);
      r(x + 3, y + 3, 4, 3, OSCURO);
      r(x + 5, y + 4, 1, 1, acento);
  }
}
