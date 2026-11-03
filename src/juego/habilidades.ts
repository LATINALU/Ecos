// Motor de habilidades del mazo de almas. Cada habilidad del Grimorio es una "forma" (primitiva) con parámetros;
// acá se convierte en proyectiles, áreas de golpe, acciones del cuerpo o potenciadores.
// Las Definitivas usan las mismas formas, con más daño, más cantidad y más espectáculo.

import type { EfectoHabilidad } from "../contenido/grimorio.ts";
import type { HabilidadEquipada } from "../dominio/partida.ts";
import type { AtaqueJugador, Contexto } from "./contexto.ts";
import type { Criatura } from "./entidades/criatura.ts";
import type { Jugador } from "./entidades/jugador.ts";
import { Proyectil } from "./entidades/proyectil.ts";

/** Traduce los efectos de la habilidad a un ataque. */
export function ataqueDeHabilidad(potencia: number, efectos: readonly EfectoHabilidad[], definitiva: boolean, empuje = 120): AtaqueJugador {
  const elementos = efectos.filter((e): e is "hielo" | "veneno" => e === "hielo" || e === "veneno");
  return {
    potencia,
    tipo: "tecnica",
    empuje,
    ...(efectos.includes("quema") ? { quema: true } : {}),
    ...(efectos.includes("ralentiza") ? { ralentiza: true } : {}),
    ...(efectos.includes("aturde") ? { aturde: definitiva ? 1.4 : 0.8 } : {}),
    ...(efectos.includes("cura") ? { curaPct: definitiva ? 0.015 : 0.025 } : {}),
    ...(efectos.includes("lanzar") ? { lanzar: true } : {}),
    ...(elementos.length > 0 ? { elementos } : {}),
    ...(definitiva ? { definitiva: true } : {}),
  };
}

function objetivosCercanos(j: Jugador, ctx: Contexto, alcance: number): Criatura[] {
  return ctx.criaturas
    .filter((c) => !c.muerto && !("esObjeto" in c) && Math.abs(c.cx - j.cx) < alcance && Math.abs(c.cy - j.cy) < 150)
    .sort((a, b) => Math.hypot(a.cx - j.cx, a.cy - j.cy) - Math.hypot(b.cx - j.cx, b.cy - j.cy));
}

function rayoSobre(ctx: Contexto, x: number, pie: number, color: string, ataque: AtaqueJugador, dir: number): void {
  for (let yy = Math.max(0, pie - 200); yy < pie; yy += 6) {
    ctx.fx.chispas(x + (Math.random() - 0.5) * 6, yy, color, 1, { velocidad: 20, vida: 0.25, gravedad: 0, brillo: true });
  }
  ctx.fx.chispas(x, pie, "#ffffff", 16, { velocidad: 140, brillo: true });
  ctx.golpearArea({ x: x - 14, y: pie - 40, w: 28, h: 42 }, ataque, dir, new Set());
}

export function ejecutarHabilidad(j: Jugador, ctx: Contexto, h: HabilidadEquipada, definitiva: boolean): void {
  const d = h.def;
  const efectos = d.efectos ?? [];
  const ataque = ataqueDeHabilidad(h.potencia, efectos, definitiva);
  const color = d.color;
  const n = h.cantidad;
  if (definitiva) {
    ctx.fx.destellar(color, 0.7);
    ctx.fx.sacudir(6);
    ctx.fx.texto(j.cx, j.y - 26, d.nombre.toUpperCase(), color, true);
    ctx.fx.chispas(j.cx, j.cy, color, 40, { velocidad: 160, brillo: true, gravedad: 0 });
    j.invuln = Math.max(j.invuln, 0.6);
  }
  switch (d.forma) {
    case "proyectil": {
      j.poseLanzar(0.25);
      const vel = d.velocidad ?? 300;
      const apertura = n > 1 ? (d.abanico ?? 0.2) : 0;
      for (let k = 0; k < n; k++) {
        const ang = n > 1 ? -apertura / 2 + (apertura * k) / (n - 1) : 0;
        const grande = (d.radio ?? 0) >= 40;
        ctx.agregarProyectil(new Proyectil({
          tipo: d.visual ?? "orbe", x: j.cx + j.dir * 8, y: j.cy - 2,
          vx: Math.cos(ang) * vel * j.dir, vy: Math.sin(ang) * vel,
          w: grande ? 18 : d.visual === "lanza" ? 18 : 10, h: grande ? 18 : d.visual === "lanza" ? 5 : 8,
          vida: Math.min(2.6, 420 / vel + 0.4), atraviesa: d.atraviesa === true, explota: d.radio ?? 0, color,
          ataqueJugador: { ...ataque, empuje: grande ? 220 : 110 },
        }));
      }
      break;
    }
    case "boomerang":
      j.poseLanzar(0.25);
      ctx.agregarProyectil(new Proyectil({
        tipo: d.visual === "hoja" ? "hoja" : "hacha", x: j.cx + j.dir * 8, y: j.cy - 4, vx: j.dir * 300, vy: 0, w: 14, h: 14, vida: 1.6,
        atraviesa: true, atraviesaParedes: true, boomerang: true, color, ataqueJugador: { ...ataque, empuje: 140 },
      }));
      break;
    case "embestida":
      j.iniciarAccionHabilidad("tajo", definitiva ? 0.5 : 0.26, { ...ataque, empuje: 140 }, color);
      ctx.fx.destellar(color, 0.2);
      break;
    case "garras":
      j.iniciarAccionHabilidad("zarpazo", n * 0.13 + 0.04, { ...ataque, empuje: 70 }, color, n);
      if (definitiva) j.invuln = Math.max(j.invuln, n * 0.13 + 0.1);
      break;
    case "onda":
      j.iniciarAccionHabilidad("terremoto", j.enSuelo ? 0.3 : 1.2, { ...ataque, empuje: 160 }, color);
      break;
    case "salto":
      // Salta y cae: ondas al aterrizar (y un estallido en las Definitivas).
      j.vy = -320;
      j.radioCaida = d.radio ?? (definitiva ? 110 : 0);
      j.iniciarAccionHabilidad("terremoto", 1.4, { ...ataque, empuje: 180 }, color);
      break;
    case "rayo": {
      j.poseLanzar(0.3);
      const objetivos = objetivosCercanos(j, ctx, definitiva ? 480 : 220);
      ctx.audio.reproducir("explosion");
      ctx.fx.sacudir(definitiva ? 6 : 4);
      if (objetivos.length === 0) {
        rayoSobre(ctx, j.cx + j.dir * 60, j.y + j.h, color, ataque, j.dir);
        break;
      }
      // Si hay menos objetivos que rayos, los rayos que sobran vuelven a caer sobre los mismos (en las Definitivas).
      const total = definitiva ? n : Math.min(n, objetivos.length);
      for (let k = 0; k < total; k++) {
        const c = objetivos[k % objetivos.length];
        rayoSobre(ctx, c.cx + (k >= objetivos.length ? (Math.random() - 0.5) * 10 : 0), c.y + c.h, color, ataque, j.dir);
      }
      break;
    }
    case "orbita":
      j.poseLanzar(0.2);
      for (let k = 0; k < n; k++) {
        ctx.agregarProyectil(new Proyectil({
          tipo: d.visual === "hacha" ? "hacha" : "hoja", x: j.cx, y: j.cy, vx: 0, vy: 0, w: 10, h: 10, vida: d.duracion ?? 4,
          atraviesa: true, atraviesaParedes: true, color,
          orbita: { radio: d.radio ?? 24, fase: (k / n) * Math.PI * 2, velocidad: 7, rehit: 0.45 },
          ataqueJugador: { ...ataque, empuje: 60 },
        }));
      }
      break;
    case "nova": {
      j.poseLanzar(0.3);
      const r = d.radio ?? 50;
      ctx.audio.reproducir("explosion");
      ctx.fx.sacudir(definitiva ? 8 : 3);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        ctx.fx.chispas(j.cx + Math.cos(a) * r * 0.5, j.cy + Math.sin(a) * r * 0.35, color, 1,
          { velocidad: r * 2.2, angulo: a, apertura: 0.1, vida: 0.4, gravedad: 0, brillo: true });
      }
      ctx.golpearArea({ x: j.cx - r, y: j.cy - r * 0.7, w: r * 2, h: r * 1.4 }, { ...ataque, empuje: 200 }, j.dir, new Set());
      break;
    }
    case "lluvia": {
      j.poseLanzar(0.3);
      const ancho = d.radio ?? 100;
      const centro = j.cx + j.dir * ancho * 0.45;
      const pie = j.y + j.h;
      for (let k = 0; k < n; k++) {
        const x = centro - ancho / 2 + (ancho * (k + Math.random() * 0.8)) / n;
        const alto = 150 + (k % 4) * 30 + Math.random() * 20;
        const vy = 320;
        ctx.agregarProyectil(new Proyectil({
          tipo: d.visual ?? "orbe", x, y: pie - alto, vx: 0, vy, w: 10, h: 10, vida: alto / vy + 0.1,
          atraviesa: false, atraviesaParedes: true, explota: definitiva ? 22 : 14, color,
          ataqueJugador: { ...ataque, empuje: 90 },
        }));
      }
      break;
    }
    case "aura": {
      j.poseLanzar(0.3);
      j.aplicarBuff(d.buff ?? {}, d.duracion ?? 5);
      const r = d.radio ?? 36;
      ctx.fx.destellar(color, 0.3);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        ctx.fx.chispas(j.cx, j.cy, color, 1, { velocidad: r * 2, angulo: a, apertura: 0.1, vida: 0.35, gravedad: 0, brillo: true });
      }
      ctx.golpearArea({ x: j.cx - r, y: j.cy - r * 0.7, w: r * 2, h: r * 1.4 }, { ...ataque, empuje: 220 }, j.dir, new Set());
      break;
    }
  }
}
