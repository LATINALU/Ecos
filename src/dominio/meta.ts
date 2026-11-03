// Progresión permanente (entre partidas): reliquias, esencia, mejoras del Santuario, Ecos y registro.
// La esencia vive en una Billetera de minialu; las mejoras se compran con "todo o nada" igual que la tienda.

import { registrarCicatriz, type Cicatriz } from "./cicatrices.ts";
import { Billetera, exito, fallo, type ErrorPago, type Resultado } from "minialu";
import { registrarEco, type Eco } from "./eco.ts";
import { RELIQUIAS, type Reliquia, PISOS_RELIQUIA } from "./tipos.ts";

export type IdMejora = "vigor" | "frascos" | "afinidad" | "codicia" | "memoria";

export interface DefMejora {
  readonly id: IdMejora;
  readonly nombre: string;
  readonly descripcion: string;
  readonly maximo: number;
  readonly costos: readonly number[];
}

export const MEJORAS_SANTUARIO: readonly DefMejora[] = [
  { id: "vigor", nombre: "Vigor del Portador", descripcion: "+15 de vida máxima por nivel.", maximo: 5, costos: [30, 60, 100, 160, 240] },
  { id: "frascos", nombre: "Cinturón de frascos", descripcion: "+1 Poción de Vida al empezar.", maximo: 3, costos: [40, 90, 160] },
  { id: "afinidad", nombre: "Afinidad de Alma", descripcion: "Tu carta inicial empieza con +1★.", maximo: 2, costos: [80, 200] },
  { id: "codicia", nombre: "Ojo del Codicioso", descripcion: "+12 % de esquirlas por nivel.", maximo: 4, costos: [35, 70, 120, 190] },
  { id: "memoria", nombre: "Memoria del Pozo", descripcion: "Empiezas con 40 esquirlas más por nivel.", maximo: 3, costos: [50, 110, 200] },
];

export interface Registro {
  partidas: number;
  muertes: number;
  victorias: number;
  jefes: number;
  ecosVencidos: number;
  mejorPiso: number;
  /** Profundidad más honda alcanzada en el Abismo (guardados viejos no lo tienen). */
  mejorAbismo?: number;
  enemigos: number;
  /** Registro de desafíos (guardados viejos no lo tienen). */
  arenas?: number;
  arenasIntocables?: number;
  /** Reloj de Arena: más segundos sobrantes. */
  mejorReloj?: number;
  /** Juicio: nivel más alto superado a tiempo, y Juicios superados a tiempo. */
  mejorJuicio?: number;
  juiciosATiempo?: number;
  mayorRacha?: number;
}

export interface DatosMeta {
  readonly version: 1;
  readonly esencia: number;
  readonly reliquias: readonly Reliquia[];
  readonly mejoras: Readonly<Partial<Record<IdMejora, number>>>;
  readonly ecos: readonly Eco[];
  readonly registro: Readonly<Registro>;
  readonly almasVistas: readonly number[];
  /** Resonancias de mazo descubiertas (Códice). Guardados viejos no lo tienen. */
  readonly resonancias?: readonly string[];
  /** Cicatrices del Pozo: dónde caíste y quién te mató. */
  readonly cicatrices?: readonly Cicatriz[];
  /** Otros Portadores que vengaron tus caídas (Ecos asíncronos). */
  readonly venganzas?: readonly VenganzaRecibida[];
}

export interface VenganzaRecibida {
  readonly piso: number;
  readonly vengador: string;
  readonly recompensa: number;
  readonly fecha: number;
}

export type ErrorMejora = "desconocida" | "al-maximo" | ErrorPago;

export class Meta {
  private readonly billetera: Billetera;
  private readonly reliquias: Set<Reliquia>;
  private readonly mejoras: Partial<Record<IdMejora, number>>;
  private ecos: Eco[];
  readonly registro: Registro;
  private readonly almasVistas: Set<number>;
  private readonly resonancias: Set<string>;
  private cicatrices: Cicatriz[];
  venganzas: VenganzaRecibida[];

  constructor(datos: DatosMeta) {
    this.billetera = new Billetera({ esencia: datos.esencia });
    this.reliquias = new Set(datos.reliquias.filter((r) => RELIQUIAS.includes(r)));
    this.mejoras = { ...datos.mejoras };
    this.ecos = [...datos.ecos];
    this.registro = { ...datos.registro };
    this.almasVistas = new Set(datos.almasVistas);
    this.resonancias = new Set(datos.resonancias ?? []);
    this.cicatrices = [...(datos.cicatrices ?? [])];
    this.venganzas = [...(datos.venganzas ?? [])];
  }

  static nueva(): Meta {
    return new Meta({
      version: 1, esencia: 0, reliquias: [], mejoras: {}, ecos: [], almasVistas: [],
      registro: { partidas: 0, muertes: 0, victorias: 0, jefes: 0, ecosVencidos: 0, mejorPiso: 0, enemigos: 0 },
    });
  }

  get esencia(): number {
    return this.billetera.saldo("esencia");
  }

  ganarEsencia(n: number): void {
    this.billetera.acreditar("esencia", Math.max(0, Math.round(n)));
  }

  tieneReliquia(r: Reliquia): boolean {
    return this.reliquias.has(r);
  }

  listaReliquias(): Reliquia[] {
    return RELIQUIAS.filter((r) => this.reliquias.has(r));
  }

  otorgarReliquia(r: Reliquia): boolean {
    if (this.reliquias.has(r)) return false;
    this.reliquias.add(r);
    return true;
  }

  /** La reliquia que el Pozo ofrece en un piso: la primera que falta, una por piso. */
  reliquiaParaPiso(piso: number): Reliquia | undefined {
    const faltan = RELIQUIAS.filter((r) => !this.reliquias.has(r));
    return PISOS_RELIQUIA.includes(piso) ? faltan[0] : undefined;
  }

  nivelMejora(id: IdMejora): number {
    return this.mejoras[id] ?? 0;
  }

  costoMejora(id: IdMejora): number | undefined {
    const def = MEJORAS_SANTUARIO.find((m) => m.id === id);
    if (def === undefined) return undefined;
    return def.costos[this.nivelMejora(id)];
  }

  comprarMejora(id: IdMejora): Resultado<number, ErrorMejora> {
    const def = MEJORAS_SANTUARIO.find((m) => m.id === id);
    if (def === undefined) return fallo("desconocida");
    const nivel = this.nivelMejora(id);
    if (nivel >= def.maximo) return fallo("al-maximo");
    const pago = this.billetera.debitar("esencia", def.costos[nivel]);
    if (!pago.ok) return fallo(pago.error);
    this.mejoras[id] = nivel + 1;
    return exito(nivel + 1);
  }

  listaEcos(): readonly Eco[] {
    return this.ecos;
  }

  ecoDelPiso(piso: number): Eco | undefined {
    return this.ecos.find((e) => e.piso === piso);
  }

  registrarMuerte(eco: Eco): void {
    this.ecos = registrarEco(this.ecos, eco);
    this.registro.muertes++;
  }

  vencerEco(uid: string): void {
    this.ecos = this.ecos.filter((e) => e.uid !== uid);
    this.registro.ecosVencidos++;
  }

  verAlma(id: number): void {
    this.almasVistas.add(id);
  }

  marcarCicatriz(c: Cicatriz): void {
    this.cicatrices = registrarCicatriz(this.cicatrices, c);
  }

  cicatrizDelPiso(piso: number): Cicatriz | undefined {
    return this.cicatrices.find((c) => c.piso === piso);
  }

  /** Vencer al Devorador cierra la cicatriz. */
  cerrarCicatriz(piso: number): void {
    this.cicatrices = this.cicatrices.filter((c) => c.piso !== piso);
  }

  /** Anota una resonancia en el Códice. Devuelve true si es nueva. */
  descubrirResonancia(id: string): boolean {
    if (this.resonancias.has(id)) return false;
    this.resonancias.add(id);
    return true;
  }

  resonanciaDescubierta(id: string): boolean {
    return this.resonancias.has(id);
  }

  almaVista(id: number): boolean {
    return this.almasVistas.has(id);
  }

  serializar(): DatosMeta {
    return {
      version: 1,
      esencia: this.esencia,
      reliquias: [...this.reliquias],
      mejoras: { ...this.mejoras },
      ecos: [...this.ecos],
      registro: { ...this.registro },
      almasVistas: [...this.almasVistas],
      resonancias: [...this.resonancias],
      cicatrices: [...this.cicatrices],
      venganzas: [...this.venganzas],
    };
  }
}
