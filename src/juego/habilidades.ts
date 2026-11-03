// Motor de habilidades del mazo de almas. Cada habilidad del Grimorio es una "forma" (primitiva) con parámetros;
// acá se convierte en proyectiles, áreas de golpe, acciones del cuerpo o potenciadores.
// Las Definitivas usan las mismas formas, con más daño, más cantidad y más espectáculo.
//
// MUTACIONES (contenido/mutaciones.ts): al cruzar 5★, 9★ y 12★ cada forma cambia lo que hace (ecos, estelas,
// grietas, columnas, agujeros negros…). Se resuelven aquí con los "efectos vivos" del juego (zonas, ecos y
// acciones programadas).

import type { EfectoHabilidad } from "../contenido/grimorio.ts";
import { tierMutacion } from "../contenido/mutaciones.ts";
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
  ctx.fx.fogonazo(x, pie - 20, color, 60, 0.25);
  ctx.golpearArea({ x: x - 14, y: pie - 40, w: 28, h: 42 }, ataque, dir, new Set());
}

function novaEn(ctx: Contexto, x: number, y: number, r: number, color: string, ataque: AtaqueJugador, dir: number, fuerte: boolean): void {
  ctx.audio.reproducir("explosion");
  ctx.fx.sacudir(fuerte ? 8 : 3);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    ctx.fx.chispas(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.35, color, 1,
      { velocidad: r * 2.2, angulo: a, apertura: 0.1, vida: 0.4, gravedad: 0, brillo: true });
  }
  ctx.fx.fogonazo(x, y, color, r * 1.6, 0.35);
  ctx.golpearArea({ x: x - r, y: y - r * 0.7, w: r * 2, h: r * 1.4 }, { ...ataque, empuje: 200 }, dir, new Set());
}

function lluviaEn(ctx: Contexto, centro: number, pie: number, ancho: number, n: number, visual: Proyectil["op"]["tipo"], color: string, ataque: AtaqueJugador, definitiva: boolean): void {
  for (let k = 0; k < n; k++) {
    const x = centro - ancho / 2 + (ancho * (k + Math.random() * 0.8)) / n;
    const alto = 150 + (k % 4) * 30 + Math.random() * 20;
    const vy = 320;
    ctx.agregarProyectil(new Proyectil({
      tipo: visual, x, y: pie - alto, vx: 0, vy, w: 10, h: 10, vida: alto / vy + 0.1,
      atraviesa: false, atraviesaParedes: true, explota: definitiva ? 22 : 14, color,
      ataqueJugador: { ...ataque, empuje: 90 },
    }));
  }
}

export function ejecutarHabilidad(j: Jugador, ctx: Contexto, h: HabilidadEquipada, definitiva: boolean): void {
  const d = h.def;
  const efectos = d.efectos ?? [];
  const ataque = ataqueDeHabilidad(h.potencia, efectos, definitiva);
  const color = d.color;
  const n = h.cantidad;
  // Mutaciones activas según las estrellas de la carta (necesitan los efectos vivos del mundo).
  const tier = tierMutacion(h.carta.nivel);
  const vivos = ctx.vivos;
  const mut = (k: 1 | 2 | 3): boolean => tier >= k && vivos !== undefined;
  const parte = (mult: number, extra: Partial<AtaqueJugador> = {}): AtaqueJugador => ({ ...ataque, potencia: ataque.potencia * mult, ...extra });
  const pie = j.y + j.h;
  if (definitiva) {
    ctx.fx.destellar(color, 0.7);
    ctx.fx.sacudir(6);
    ctx.fx.texto(j.cx, j.y - 26, d.nombre.toUpperCase(), color, true);
    ctx.fx.chispas(j.cx, j.cy, color, 40, { velocidad: 160, brillo: true, gravedad: 0 });
    j.invuln = Math.max(j.invuln, 0.6);
  }
  switch (d.forma) {
    case "proyectil":
    case "boomerang": {
      j.poseLanzar(0.25);
      const lanzados: Proyectil[] = [];
      if (d.forma === "boomerang") {
        lanzados.push(new Proyectil({
          tipo: d.visual === "hoja" ? "hoja" : "hacha", x: j.cx + j.dir * 8, y: j.cy - 4, vx: j.dir * 300, vy: 0, w: 14, h: 14, vida: 1.6,
          atraviesa: true, atraviesaParedes: true, boomerang: true, color, ataqueJugador: { ...ataque, empuje: 140 },
        }));
      } else {
        const vel = d.velocidad ?? 300;
        const apertura = n > 1 ? (d.abanico ?? 0.2) : 0;
        for (let k = 0; k < n; k++) {
          const ang = n > 1 ? -apertura / 2 + (apertura * k) / (n - 1) : 0;
          const grande = (d.radio ?? 0) >= 40;
          lanzados.push(new Proyectil({
            tipo: d.visual ?? "orbe", x: j.cx + j.dir * 8, y: j.cy - 2,
            vx: Math.cos(ang) * vel * j.dir, vy: Math.sin(ang) * vel,
            w: grande ? 18 : d.visual === "lanza" ? 18 : 10, h: grande ? 18 : d.visual === "lanza" ? 5 : 8,
            vida: Math.min(2.6, 420 / vel + 0.4), atraviesa: d.atraviesa === true, explota: d.radio ?? 0, color,
            ataqueJugador: { ...ataque, empuje: grande ? 220 : 110 },
          }));
        }
      }
      for (const p of lanzados) {
        ctx.agregarProyectil(p);
        // 5★ Eco: donde termina el proyectil queda un eco tuyo que estalla (uno por lanzamiento).
        if (mut(1) && p === lanzados[Math.floor(lanzados.length / 2)]) {
          const dir = j.dir;
          vivos!.alTerminar(p, (x, y) => {
            vivos!.crearEco(x, y + 12, color, dir);
            novaEn(ctx, x, y, 26, color, parte(0.45), dir, false);
          });
        }
      }
      break;
    }
    case "embestida": {
      const desde = j.cx;
      const dur = definitiva ? 0.5 : 0.26;
      j.iniciarAccionHabilidad("tajo", dur, { ...ataque, empuje: 140 }, color);
      ctx.fx.destellar(color, 0.2);
      // 5★ Estela cortante · 12★ Ruptura (al terminar).
      if (mut(1)) {
        vivos!.programar(dur, () => {
          const x0 = Math.min(desde, j.cx);
          const ancho = Math.max(24, Math.abs(j.cx - desde));
          vivos!.zona({ x: x0, y: j.y + 4, w: ancho, h: j.h - 4, dur: 1.2, tick: 0.3, ataque: parte(0.35, { empuje: 20 }), color, forma: "grieta" });
        });
      }
      if (mut(3)) vivos!.programar(dur, () => novaEn(ctx, j.cx, j.cy, 70, color, parte(1.2), j.dir, true));
      break;
    }
    case "garras": {
      // 12★ Mil Garras: el doble de zarpazos. 9★ Frenesí: cada zarpazo cura.
      const golpes = mut(3) ? n * 2 : n;
      const atq = mut(2) ? { ...ataque, empuje: 70, curaPct: (ataque.curaPct ?? 0) + 0.01 } : { ...ataque, empuje: 70 };
      j.iniciarAccionHabilidad("zarpazo", golpes * 0.13 + 0.04, atq, color, golpes);
      if (definitiva || mut(3)) j.invuln = Math.max(j.invuln, golpes * 0.13 + 0.1);
      // 5★ Media luna al final.
      if (mut(1)) {
        vivos!.programar(golpes * 0.13, () => ctx.agregarProyectil(new Proyectil({
          tipo: "hoja", x: j.cx + j.dir * 10, y: j.cy - 4, vx: j.dir * 380, vy: 0, w: 16, h: 16, vida: 0.8, atraviesa: true,
          color, ataqueJugador: parte(0.8, { empuje: 120 }),
        })));
      }
      break;
    }
    case "onda": {
      // 9★ Succión: antes del golpe, el suelo atrae a los enemigos.
      if (mut(2)) vivos!.zona({ x: j.cx - 90, y: j.cy - 50, w: 180, h: 100, dur: 0.35, tick: 1, ataque: parte(0.05, { empuje: 0 }), color, forma: "aura", atrae: 200 });
      j.iniciarAccionHabilidad("terremoto", j.enSuelo ? 0.3 : 1.2, { ...ataque, empuje: 160 }, color);
      // 5★ Grietas a ambos lados.
      if (mut(1)) {
        vivos!.programar(0.3, () => {
          for (const lado of [-1, 1]) vivos!.zona({ x: j.cx + lado * 45 - 35, y: pie - 14, w: 70, h: 14, dur: 1.5, tick: 0.35, ataque: parte(0.3, { empuje: 10 }), color, forma: "grieta" });
        });
      }
      // 12★ Erupción: columnas que avanzan hacia ambos lados.
      if (mut(3)) {
        for (let k = 0; k < 8; k++) {
          const lado = k % 2 === 0 ? 1 : -1;
          vivos!.programar(0.3 + Math.floor(k / 2) * 0.12, () => vivos!.zona({ x: j.cx + lado * (40 + Math.floor(k / 2) * 34) - 10, y: pie - 64, w: 20, h: 64, dur: 0.7, tick: 0.3, ataque: parte(0.7, { lanzar: true }), color, forma: "columna" }));
        }
      }
      break;
    }
    case "salto":
      // Salta y cae: ondas al aterrizar (y un estallido en las Definitivas).
      j.vy = -320;
      j.radioCaida = (d.radio ?? (definitiva ? 110 : 0)) * (mut(3) ? 2 : mut(2) ? 1.6 : 1) || (mut(2) ? 70 : 0);
      j.iniciarAccionHabilidad("terremoto", 1.4, { ...ataque, empuje: 180 }, color);
      if (mut(1)) vivos!.programar(0.9, () => vivos!.zona({ x: j.cx - 40, y: j.y + j.h - 14, w: 80, h: 14, dur: 1.6, tick: 0.35, ataque: parte(0.3, { empuje: 10 }), color, forma: "grieta" }));
      if (mut(3)) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          vivos!.programar(0.95 + k * 0.05, () => vivos!.zona({ x: j.cx + Math.cos(a) * 70 - 10, y: j.y + j.h - 60, w: 20, h: 60, dur: 0.7, tick: 0.3, ataque: parte(0.6), color, forma: "columna" }));
        }
      }
      break;
    case "rayo": {
      j.poseLanzar(0.3);
      // 12★ Juicio: sobre todos los enemigos a la vista.
      const objetivos = objetivosCercanos(j, ctx, mut(3) ? 520 : definitiva ? 480 : 220);
      ctx.audio.reproducir("explosion");
      ctx.fx.sacudir(definitiva ? 6 : 4);
      if (objetivos.length === 0) {
        rayoSobre(ctx, j.cx + j.dir * 60, pie, color, ataque, j.dir);
        break;
      }
      const total = mut(3) ? Math.max(n, objetivos.length) : definitiva ? n : Math.min(n, objetivos.length);
      for (let k = 0; k < total; k++) {
        const c = objetivos[k % objetivos.length];
        const x = c.cx + (k >= objetivos.length ? (Math.random() - 0.5) * 10 : 0);
        rayoSobre(ctx, x, c.y + c.h, color, ataque, j.dir);
        // 9★ Columna que queda.
        if (mut(2)) vivos!.zona({ x: x - 9, y: c.y + c.h - 70, w: 18, h: 70, dur: 1, tick: 0.33, ataque: parte(0.3, { empuje: 0 }), color, forma: "columna" });
        // 5★ Cadena: salta a un segundo enemigo cercano.
        if (mut(1)) {
          const otro = ctx.criaturas.find((o) => o !== c && !o.muerto && !("esObjeto" in o) && Math.hypot(o.cx - c.cx, o.cy - c.cy) < 120);
          if (otro !== undefined) vivos!.programar(0.12, () => rayoSobre(ctx, otro.cx, otro.y + otro.h, color, parte(0.6), j.dir));
        }
      }
      break;
    }
    case "orbita": {
      j.poseLanzar(0.2);
      const radio = (d.radio ?? 24) * (mut(1) ? 1.4 : 1);
      const duracion = (d.duracion ?? 4) * (mut(1) ? 1.5 : 1);
      const anillos: { r: number; vel: number }[] = [{ r: radio, vel: 7 }];
      if (mut(3)) anillos.push({ r: radio * 1.8, vel: -6 });
      for (const an of anillos) {
        for (let k = 0; k < n; k++) {
          ctx.agregarProyectil(new Proyectil({
            tipo: d.visual === "hacha" ? "hacha" : "hoja", x: j.cx, y: j.cy, vx: 0, vy: 0, w: 10, h: 10, vida: duracion,
            atraviesa: true, atraviesaParedes: true, color,
            orbita: { radio: an.r, fase: (k / n) * Math.PI * 2, velocidad: an.vel, rehit: 0.45 },
            ataqueJugador: { ...ataque, empuje: 60 },
          }));
        }
      }
      // 9★ Disparo final: al terminar, las hojas salen disparadas hacia afuera.
      if (mut(2)) {
        vivos!.programar(duracion, () => {
          const total = n * anillos.length;
          for (let k = 0; k < total; k++) {
            const a = (k / total) * Math.PI * 2;
            ctx.agregarProyectil(new Proyectil({
              tipo: "hoja", x: j.cx, y: j.cy, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, w: 10, h: 10, vida: 0.8, atraviesa: true,
              color, ataqueJugador: parte(0.7, { empuje: 100 }),
            }));
          }
        });
      }
      break;
    }
    case "nova": {
      j.poseLanzar(0.3);
      const r = d.radio ?? 50;
      // 9★ Gravedad: primero atrae, después estalla.
      const retraso = mut(2) ? 0.35 : 0;
      if (mut(2)) vivos!.zona({ x: j.cx - r * 1.4, y: j.cy - r, w: r * 2.8, h: r * 2, dur: retraso, tick: 1, ataque: parte(0.05, { empuje: 0 }), color, forma: "agujero", atrae: 220 });
      const estallar = (): void => novaEn(ctx, j.cx, j.cy, r, color, ataque, j.dir, definitiva);
      if (retraso > 0) vivos!.programar(retraso, estallar);
      else estallar();
      // 5★ Réplica.
      if (mut(1)) vivos!.programar(retraso + 0.45, () => novaEn(ctx, j.cx, j.cy, r * 0.85, color, parte(0.7), j.dir, false));
      // 12★ Singularidad.
      if (mut(3)) vivos!.programar(retraso, () => vivos!.zona({ x: j.cx + j.dir * 40 - 35, y: j.cy - 35, w: 70, h: 70, dur: 2.5, tick: 0.35, ataque: parte(0.3, { empuje: 0 }), color, forma: "agujero", atrae: 130, final: parte(1.5) }));
      break;
    }
    case "lluvia": {
      j.poseLanzar(0.3);
      const ancho = d.radio ?? 100;
      const centro = j.cx + j.dir * ancho * 0.45;
      const cuantos = mut(1) ? Math.round(n * 1.5) : n;
      lluviaEn(ctx, centro, pie, ancho, cuantos, d.visual ?? "orbe", color, ataque, definitiva);
      if (mut(2)) vivos!.programar(0.5, () => vivos!.zona({ x: centro - ancho / 2, y: pie - 16, w: ancho, h: 16, dur: 2.2, tick: 0.4, ataque: parte(0.25, { empuje: 0 }), color, forma: "grieta" }));
      if (mut(3)) vivos!.programar(1, () => lluviaEn(ctx, centro, pie, ancho, cuantos, d.visual ?? "orbe", color, ataque, definitiva));
      break;
    }
    case "aura": {
      j.poseLanzar(0.3);
      const buff = d.buff ?? {};
      // 12★ Avatar: el doble de fuerte y empiezas invulnerable.
      const b = mut(3) ? Object.fromEntries(Object.entries(buff).map(([k, v]) => [k, (v as number) * 2])) : buff;
      j.aplicarBuff(b, d.duracion ?? 5);
      if (mut(3)) j.invuln = Math.max(j.invuln, 1);
      const r = d.radio ?? 36;
      ctx.fx.destellar(color, 0.3);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        ctx.fx.chispas(j.cx, j.cy, color, 1, { velocidad: r * 2, angulo: a, apertura: 0.1, vida: 0.35, gravedad: 0, brillo: true });
      }
      ctx.golpearArea({ x: j.cx - r, y: j.cy - r * 0.7, w: r * 2, h: r * 1.4 }, { ...ataque, empuje: 220 }, j.dir, new Set());
      if (mut(1)) vivos!.zona({ x: j.cx - r * 1.5, y: j.cy - r, w: r * 3, h: r * 2, dur: d.duracion ?? 5, tick: 0.5, ataque: parte(0.25, { empuje: 40 }), color, forma: "aura", sigueJugador: true });
      if (mut(2)) vivos!.programar(d.duracion ?? 5, () => novaEn(ctx, j.cx, j.cy, r * 2, color, parte(1.5), j.dir, true));
      break;
    }
  }
}
