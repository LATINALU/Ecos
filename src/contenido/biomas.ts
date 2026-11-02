// Los tres pisos del Pozo. Cada bioma define paleta, atmósfera, nombres de sus criaturas y su guardián.

export type ConductaEnemigo = "caminante" | "saltador" | "volador" | "torreta" | "escudero";

export interface DefEnemigo {
  readonly conducta: ConductaEnemigo;
  readonly hp: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
  readonly w: number;
  readonly h: number;
  readonly velocidad: number;
}

export const ENEMIGOS: Readonly<Record<ConductaEnemigo, DefEnemigo>> = {
  caminante: { conducta: "caminante", hp: 30, ataque: 8, defensa: 2, exp: 6, w: 14, h: 14, velocidad: 38 },
  saltador: { conducta: "saltador", hp: 26, ataque: 9, defensa: 1, exp: 7, w: 14, h: 12, velocidad: 70 },
  volador: { conducta: "volador", hp: 18, ataque: 7, defensa: 0, exp: 6, w: 12, h: 10, velocidad: 48 },
  torreta: { conducta: "torreta", hp: 34, ataque: 9, defensa: 3, exp: 8, w: 16, h: 16, velocidad: 0 },
  escudero: { conducta: "escudero", hp: 50, ataque: 11, defensa: 6, exp: 11, w: 16, h: 20, velocidad: 30 },
};

export type IdJefe = "guardian" | "madre" | "recuerda";

export interface DefJefe {
  readonly id: IdJefe;
  readonly nombre: string;
  readonly titulo: string;
  readonly hp: number;
  readonly ataque: number;
  readonly defensa: number;
  readonly exp: number;
  readonly w: number;
  readonly h: number;
}

export interface Bioma {
  readonly nombre: string;
  readonly lema: string;
  readonly cielo: readonly [string, string];
  readonly roca: string;
  readonly rocaClaro: string;
  readonly rocaOscuro: string;
  readonly plataforma: string;
  readonly acento: string;
  readonly niebla: string;
  /** Oscuridad de la sala (0 = sin sombra, 1 = negro salvo luces). */
  readonly oscuridad: number;
  readonly particula: "polvo" | "esporas" | "brasas";
  /** Tinte que se aplica a los sprites de terceros (color, intensidad 0~1) para que cada piso tenga su ánimo. */
  readonly tinte: readonly [string, number];
  readonly nombres: Readonly<Record<ConductaEnemigo, string>>;
  readonly colores: Readonly<Record<ConductaEnemigo, readonly [string, string]>>;
  readonly jefe: DefJefe;
}

export const BIOMAS: readonly Bioma[] = [
  {
    nombre: "Osario Hundido",
    lema: "Aquí los huesos todavía discuten quién cayó primero.",
    cielo: ["#120f1c", "#2a2238"],
    roca: "#4a4458", rocaClaro: "#6e6684", rocaOscuro: "#2b2735", plataforma: "#b8a98a", acento: "#c9b8ff",
    niebla: "rgba(150,130,200,0.06)", oscuridad: 0.55, particula: "polvo", tinte: ["#2a1f44", 0.18],
    nombres: { caminante: "Osamenta", saltador: "Cráneo Saltarín", volador: "Murciélago Pálido", torreta: "Gárgola", escudero: "Centinela de Hueso" },
    colores: {
      caminante: ["#d9d0bd", "#7a6f5c"], saltador: ["#e8e0cc", "#ff5a5a"], volador: ["#8d7fb0", "#ffde59"],
      torreta: ["#6e6684", "#ff8a3d"], escudero: ["#cfc6b0", "#5a5a7a"],
    },
    jefe: { id: "guardian", nombre: "Guardián del Osario", titulo: "Aquel que Cierra la Puerta", hp: 650, ataque: 14, defensa: 6, exp: 120, w: 34, h: 44 },
  },
  {
    nombre: "Bosque Micelio",
    lema: "Las esporas recuerdan cada paso. Algunas, cada nombre.",
    cielo: ["#06151a", "#0f2e2c"],
    roca: "#2d4a45", rocaClaro: "#3f6b5f", rocaOscuro: "#16292a", plataforma: "#6fbf8f", acento: "#5fffd0",
    niebla: "rgba(80,255,200,0.05)", oscuridad: 0.62, particula: "esporas", tinte: ["#1f6b5a", 0.45],
    nombres: { caminante: "Andarín Fúngico", saltador: "Sapo de Musgo", volador: "Polilla Luminosa", torreta: "Hongo Escupidor", escudero: "Guardia Corteza" },
    colores: {
      caminante: ["#8fbf7a", "#3d5a3a"], saltador: ["#4f8f4a", "#ffef7a"], volador: ["#bff7ff", "#5fffd0"],
      torreta: ["#c85a8a", "#ffd0f0"], escudero: ["#7a5a3a", "#5fffd0"],
    },
    jefe: { id: "madre", nombre: "Madre Micelio", titulo: "La que Florece en los Caídos", hp: 1400, ataque: 20, defensa: 9, exp: 260, w: 48, h: 40 },
  },
  {
    nombre: "Forja Ahogada",
    lema: "El fuego no se apagó cuando llegó el agua. Solo aprendió a esperar.",
    cielo: ["#140809", "#2c1210"],
    roca: "#4a2e2a", rocaClaro: "#7a463a", rocaOscuro: "#24120f", plataforma: "#e08a3d", acento: "#ffb23d",
    niebla: "rgba(255,120,60,0.06)", oscuridad: 0.5, particula: "brasas", tinte: ["#b0441f", 0.38],
    nombres: { caminante: "Autómata Roto", saltador: "Brasa Viva", volador: "Chispa Errante", torreta: "Fuelle Maldito", escudero: "Yunque Andante" },
    colores: {
      caminante: ["#8a7a6a", "#ff7a3d"], saltador: ["#ff7a3d", "#ffe08a"], volador: ["#ffd23d", "#ffffff"],
      torreta: ["#5a4a4a", "#ff4d2d"], escudero: ["#6a6a7a", "#ffb23d"],
    },
    jefe: { id: "recuerda", nombre: "El Que Recuerda", titulo: "Corazón del Pozo", hp: 2600, ataque: 27, defensa: 12, exp: 500, w: 40, h: 48 },
  },
];

export const PISOS_TOTALES = BIOMAS.length;

export function bioma(piso: number): Bioma {
  return BIOMAS[Math.max(0, Math.min(piso - 1, BIOMAS.length - 1))];
}

export function escalaEnemigo(piso: number): { hp: number; ataque: number; defensa: number; exp: number } {
  const p = Math.max(0, piso - 1);
  return { hp: 1 + 0.9 * p, ataque: 1 + 0.65 * p, defensa: 1 + 0.5 * p, exp: 1 + 0.8 * p };
}

/** Salas por piso. */
export const SALAS_POR_PISO: readonly number[] = [9, 11, 13];
