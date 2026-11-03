// Banco del pueblo ("Bóveda de los Caídos"), igual que el de MiniFighter: otro Inventario (4 pestañas × 40 = 160 casillas) y una
// Billetera. Mover objetos entre mochila y banco es minialu/transferir (todo o nada: si no entra, no se mueve).
// Lo guardado en el banco no se pierde al morir.

import { Billetera, Inventario, exito, fallo, transferir, type Pila, type Posicion, type Resultado } from "minialu";
import { maxPila } from "../contenido/objetos.ts";
import { cargarEn, volcarInventario, type Partida } from "./partida.ts";

export const PESTANAS_BANCO = 4;
export const CASILLAS_PESTANA_BANCO = 40;
export const TAM_BANCO = PESTANAS_BANCO * CASILLAS_PESTANA_BANCO;

export interface DatosBanco {
  readonly pilas: readonly (Pila | null)[];
  readonly esquirlas: number;
}

export class Banco {
  readonly inventario = new Inventario({ pestanas: PESTANAS_BANCO, casillasPorPestana: CASILLAS_PESTANA_BANCO, maxPila });
  readonly billetera = new Billetera({ esquirlas: 0 });

  static restaurar(d: DatosBanco | null | undefined): Banco {
    const b = new Banco();
    if (d !== null && d !== undefined) {
      cargarEn(b.inventario, d.pilas);
      b.billetera.acreditar("esquirlas", Math.max(0, Math.floor(d.esquirlas)));
    }
    return b;
  }

  get esquirlas(): number {
    return this.billetera.saldo("esquirlas");
  }

  depositar(p: Partida, desde: Posicion): Resultado<void, "casilla-vacia" | "sin-espacio" | "objeto-desconocido" | "cantidad-invalida" | "insuficiente"> {
    const r = transferir(p.mochila, desde, this.inventario);
    return r.ok ? exito(undefined) : fallo(r.error);
  }

  retirar(p: Partida, desde: Posicion): Resultado<void, "casilla-vacia" | "sin-espacio" | "objeto-desconocido" | "cantidad-invalida" | "insuficiente"> {
    const r = transferir(this.inventario, desde, p.mochila);
    return r.ok ? exito(undefined) : fallo(r.error);
  }

  depositarEsquirlas(p: Partida, n: number): Resultado<number, "sin-fondos" | "monto-invalido"> {
    const monto = Math.min(Math.floor(n), p.esquirlas);
    if (monto <= 0) return fallo("monto-invalido");
    const r = p.billetera.debitar("esquirlas", monto);
    if (!r.ok) return fallo(r.error);
    this.billetera.acreditar("esquirlas", monto);
    return exito(monto);
  }

  retirarEsquirlas(p: Partida, n: number): Resultado<number, "sin-fondos" | "monto-invalido"> {
    const monto = Math.min(Math.floor(n), this.esquirlas);
    if (monto <= 0) return fallo("monto-invalido");
    const r = this.billetera.debitar("esquirlas", monto);
    if (!r.ok) return fallo(r.error);
    p.billetera.acreditar("esquirlas", monto);
    return exito(monto);
  }

  serializar(): DatosBanco {
    return { pilas: volcarInventario(this.inventario), esquirlas: this.esquirlas };
  }
}
