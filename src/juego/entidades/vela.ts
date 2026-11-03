// Vela / candelabro rompible (Castlevania): cualquier ataque la rompe y suelta corazones o una subarma.
// Es una Criatura para reutilizar el sistema de golpes, pero no daña, no se mueve y no da experiencia.

import type { Contexto } from "../contexto.ts";
import { Criatura } from "./criatura.ts";

export class Vela extends Criatura {
  readonly esObjeto = true;
  /** Índice en la lista de velas de la sala (para no reaparecer rota). */
  readonly indice: number;
  private readonly alta: boolean;

  constructor(x: number, piso: number, indice: number, alta: boolean) {
    super({ nombre: "Vela", hp: 1, ataque: 0, defensa: 0, exp: 0, w: 8, h: alta ? 20 : 12, categoria: "comun" }, x - 4, piso - (alta ? 20 : 12), true);
    this.indice = indice;
    this.alta = alta;
  }

  protected pensar(): void {
    // Quieta.
  }

  override danioContacto(): number {
    return 0;
  }

  override barraJefe(): boolean {
    return false;
  }

  /** Posición de la llama (para la luz dinámica). */
  get llama(): { x: number; y: number } {
    return { x: this.cx, y: this.y - 2 };
  }

  override aplicarDanio(n: number, ctx: Contexto): boolean {
    return super.aplicarDanio(Math.max(n, this.hp), ctx);
  }

  dibujar(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.alta) {
      // Candelabro de hierro
      g.fillStyle = "#3a3448";
      g.fillRect(x + 3, y + 4, 2, 15);
      g.fillRect(x, y + 18, 8, 2);
      g.fillRect(x, y + 4, 8, 1);
      g.fillStyle = "#e8e0cc";
      g.fillRect(x + 1, y + 1, 2, 3);
      g.fillRect(x + 5, y + 1, 2, 3);
      this.llamita(g, x + 2, y);
      this.llamita(g, x + 6, y);
    } else {
      g.fillStyle = "#e8e0cc";
      g.fillRect(x + 2, y + 4, 4, 7);
      g.fillStyle = "#b8a98a";
      g.fillRect(x + 1, y + 10, 6, 2);
      this.llamita(g, x + 4, y + 3);
    }
  }

  private llamita(g: CanvasRenderingContext2D, x: number, y: number): void {
    const t = this.t * 14;
    const alto = 3 + (Math.sin(t) > 0.3 ? 1 : 0);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = "#ff9a3d";
    g.fillRect(x - 1, y - alto, 2, alto);
    g.fillStyle = "#ffe9a8";
    g.fillRect(x - (Math.sin(t * 1.3) > 0 ? 1 : 0), y - alto + 1, 1, alto - 1);
    g.restore();
  }
}
