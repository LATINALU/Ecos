// Edificios medievales del pueblo, cada uno con la forma de lo que hace:
//   Taberna = posada de entramado con barriles y jarra colgante · Bazar = puesto de mercado con toldo y cajas ·
//   Armería = casa de piedra con armero de lanzas y escudo · Bóveda = fortín de piedra con puerta herrada ·
//   Altar = capilla con rosetón y campanario · Fragua = taller abierto con horno, yunque y fuelle ·
//   Santuario = torre de piedra con menhires rúnicos · el Pozo = brocal con tejadillo, manivela y cubo.
// Todo procedural (rectángulos y polígonos) para que se pueda prerenderizar una vez; lo animado (fuego, humo,
// vitrales) se dibuja aparte en `animarEdificio`.

import { hd } from "../motor/texto-hd.ts";
import type { Luz } from "./render.ts";

export type FormaEdificio = "taberna" | "mercader" | "armero" | "banco" | "altar" | "herrero" | "santuario" | "pozo";

type G = CanvasRenderingContext2D;

/** Texto de un cartel: el texto HD no se puede prerenderizar, así que se devuelve para dibujarlo cada cuadro. */
export interface Rotulo {
  readonly x: number;
  readonly y: number;
  readonly texto: string;
  readonly color: string;
  readonly tam: number;
}

let rotulos: Rotulo[] = [];

const MADERA = "#4a2e1a";
const MADERA_CLARA = "#7a5232";
const MADERA_OSCURA = "#2a1a10";
const PIEDRA = "#5e5868";
const PIEDRA_CLARA = "#7e778a";
const PIEDRA_OSCURA = "#3a3444";
const REVOQUE = "#c8b89a";
const VENTANA = "#ffcf6a";
const HIERRO = "#2a2a32";

function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function poli(g: G, c: string, ...p: number[]): void {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
  g.fill();
}

/** Muro de sillares: hileras desfasadas. */
function sillares(g: G, x: number, y: number, w: number, h: number, base = PIEDRA): void {
  rect(g, x, y, w, h, base);
  for (let fy = 0; fy < h; fy += 7) {
    const des = (fy / 7) % 2 === 0 ? 0 : 7;
    rect(g, x, y + fy, w, 1, PIEDRA_OSCURA);
    for (let fx = -des; fx < w; fx += 14) if (fx > 0) rect(g, x + fx, y + fy, 1, 7, PIEDRA_OSCURA);
    for (let fx = -des + 2; fx < w - 3; fx += 14) if (fx > 0 && (fx + fy) % 3 === 0) rect(g, x + fx, y + fy + 1, 4, 1, PIEDRA_CLARA);
  }
}

/** Tejado a dos aguas con tejas en hileras. */
function tejado(g: G, cx: number, base: number, ancho: number, alto: number, color: string, sombra = "#00000040"): void {
  poli(g, color, cx - ancho / 2, base, cx, base - alto, cx + ancho / 2, base);
  g.save();
  g.beginPath();
  g.moveTo(cx - ancho / 2, base);
  g.lineTo(cx, base - alto);
  g.lineTo(cx + ancho / 2, base);
  g.closePath();
  g.clip();
  for (let y = base - 4; y > base - alto; y -= 5) rect(g, cx - ancho / 2, y, ancho, 1, sombra);
  for (let y = base - 4, k = 0; y > base - alto; y -= 5, k++) {
    for (let x = cx - ancho / 2 + (k % 2) * 4; x < cx + ancho / 2; x += 8) rect(g, x, y - 4, 1, 4, sombra);
  }
  g.restore();
  rect(g, cx - ancho / 2 - 2, base - 1, ancho + 4, 3, MADERA_OSCURA);
}

function ventana(g: G, x: number, y: number, w = 12, h = 12, arco = false, luz = VENTANA): void {
  rect(g, x - 1, y - 1, w + 2, h + 2, MADERA_OSCURA);
  rect(g, x, y, w, h, luz);
  if (arco) {
    g.fillStyle = MADERA_OSCURA;
    g.beginPath();
    g.arc(x + w / 2, y, w / 2 + 1, Math.PI, 0);
    g.fill();
    g.fillStyle = luz;
    g.beginPath();
    g.arc(x + w / 2, y + 0.5, w / 2, Math.PI, 0);
    g.fill();
  }
  rect(g, x + w / 2 - 1, y - (arco ? w / 2 : 0), 1, h + (arco ? w / 2 : 0), MADERA_OSCURA);
  rect(g, x, y + h / 2, w, 1, MADERA_OSCURA);
}

function puerta(g: G, cx: number, suelo: number, w = 16, h = 28, color = MADERA, herrajes = false): void {
  rect(g, cx - w / 2 - 2, suelo - h - 2, w + 4, h + 2, MADERA_OSCURA);
  g.fillStyle = MADERA_OSCURA;
  g.beginPath();
  g.arc(cx, suelo - h, w / 2 + 2, Math.PI, 0);
  g.fill();
  rect(g, cx - w / 2, suelo - h, w, h, color);
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, suelo - h, w / 2, Math.PI, 0);
  g.fill();
  for (let k = 1; k < 4; k++) rect(g, cx - w / 2 + (k * w) / 4, suelo - h - 4, 1, h + 4, "#00000040");
  if (herrajes) for (const fy of [0.25, 0.7]) rect(g, cx - w / 2, suelo - h * (1 - fy), w, 2, HIERRO);
  rect(g, cx + w / 2 - 4, suelo - h / 2, 2, 2, "#d8b04a");
}

/** Cartel de madera colgado de una ménsula, con un ícono del oficio. */
function cartelColgante(g: G, x: number, y: number, icono: (g: G, cx: number, cy: number) => void): void {
  rect(g, x - 2, y, 18, 2, HIERRO);
  rect(g, x + 2, y + 2, 1, 4, HIERRO);
  rect(g, x + 13, y + 2, 1, 4, HIERRO);
  rect(g, x - 1, y + 6, 18, 14, MADERA_OSCURA);
  rect(g, x, y + 7, 16, 12, MADERA_CLARA);
  icono(g, x + 8, y + 13);
}

/** Letrero con el nombre sobre la fachada. */
function letrero(g: G, cx: number, y: number, texto: string, ancho = 84): void {
  rect(g, cx - ancho / 2 - 1, y - 1, ancho + 2, 12, MADERA_OSCURA);
  rect(g, cx - ancho / 2, y, ancho, 10, "#8a6a3e");
  rect(g, cx - ancho / 2, y, ancho, 1, "#b08a52");
  rotulos.push({ x: cx, y: y + 8, texto, color: "#ffe9c0", tam: 7 });
}

function barril(g: G, x: number, suelo: number): void {
  rect(g, x, suelo - 14, 11, 14, MADERA_CLARA);
  rect(g, x + 1, suelo - 15, 9, 1, MADERA_CLARA);
  for (const fy of [3, 10]) rect(g, x, suelo - 14 + fy, 11, 1, HIERRO);
  rect(g, x + 3, suelo - 14, 1, 14, "#00000030");
}

function caja(g: G, x: number, suelo: number, w = 12, h = 10): void {
  rect(g, x, suelo - h, w, h, "#8a6238");
  rect(g, x, suelo - h, w, 1, "#a87a48");
  g.strokeStyle = MADERA_OSCURA;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, suelo - h + 0.5, w - 1, h - 1);
  g.beginPath();
  g.moveTo(x + 1, suelo - h + 1);
  g.lineTo(x + w - 1, suelo - 1);
  g.stroke();
}

// ---------------- Edificios ----------------

function taberna(g: G, cx: number, suelo: number, nombre: string): void {
  const w = 96;
  const x = cx - w / 2;
  // planta baja de piedra, alta de entramado (voladiza)
  sillares(g, x + 4, suelo - 34, w - 8, 34);
  rect(g, x, suelo - 80, w, 46, REVOQUE);
  rect(g, x, suelo - 80, w, 3, MADERA);
  rect(g, x, suelo - 36, w, 4, MADERA);
  for (const fx of [0, 22, 46, 70, 93]) rect(g, x + fx, suelo - 80, 3, 46, MADERA);
  // cruces de san andrés
  g.strokeStyle = MADERA;
  g.lineWidth = 2;
  for (const fx of [3, 73]) {
    g.beginPath();
    g.moveTo(x + fx, suelo - 77);
    g.lineTo(x + fx + 19, suelo - 37);
    g.moveTo(x + fx + 19, suelo - 77);
    g.lineTo(x + fx, suelo - 37);
    g.stroke();
  }
  ventana(g, x + 28, suelo - 70, 12, 14);
  ventana(g, x + 52, suelo - 70, 12, 14);
  tejado(g, cx, suelo - 78, w + 18, 40, "#7a2a20");
  // chimenea
  sillares(g, x + w - 26, suelo - 128, 10, 30);
  ventana(g, x + 10, suelo - 26, 14, 12);
  puerta(g, cx + 10, suelo, 16, 26);
  barril(g, x + 70, suelo);
  barril(g, x + 80, suelo);
  barril(g, x + 75, suelo - 14);
  cartelColgante(g, x - 14, suelo - 64, (g2, ix, iy) => {
    rect(g2, ix - 4, iy - 4, 7, 8, "#e8c060");
    rect(g2, ix - 4, iy - 5, 7, 2, "#ffffff");
    rect(g2, ix + 3, iy - 2, 2, 4, "#e8c060");
  });
  letrero(g, cx, suelo - 96, nombre);
}

function bazar(g: G, cx: number, suelo: number, nombre: string): void {
  const w = 98;
  const x = cx - w / 2;
  // casa del fondo
  rect(g, x + 8, suelo - 70, w - 16, 70, "#6a5640");
  for (const fx of [8, 40, 72]) rect(g, x + 8 + fx, suelo - 70, 2, 70, MADERA);
  tejado(g, cx, suelo - 68, w, 28, "#2a5a3a");
  ventana(g, x + 22, suelo - 62, 10, 10);
  ventana(g, x + 66, suelo - 62, 10, 10);
  // toldo a rayas
  for (let k = 0; k < 10; k++) {
    poli(g, k % 2 === 0 ? "#c83a3a" : "#f0e0c0", x + 2 + k * 9.6, suelo - 46, x + 2 + (k + 1) * 9.6, suelo - 46, x + 2 + (k + 1) * 9.6 + 3, suelo - 36, x + 2 + k * 9.6 + 3, suelo - 36);
  }
  for (let k = 0; k < 10; k++) {
    g.fillStyle = k % 2 === 0 ? "#c83a3a" : "#f0e0c0";
    g.beginPath();
    g.arc(x + 9.8 + k * 9.6, suelo - 36, 4.8, 0, Math.PI);
    g.fill();
  }
  // postes y mostrador
  rect(g, x + 4, suelo - 46, 3, 46, MADERA);
  rect(g, x + w - 7, suelo - 46, 3, 46, MADERA);
  rect(g, x + 8, suelo - 18, w - 16, 4, MADERA_CLARA);
  rect(g, x + 10, suelo - 14, w - 20, 14, MADERA);
  // mercadería: frascos, manzanas, telas
  const colores = ["#ff4d6d", "#4dc9ff", "#7dff9a", "#ffd23d", "#c9a7ff"];
  for (let k = 0; k < 8; k++) {
    rect(g, x + 14 + k * 9, suelo - 24, 4, 6, colores[k % colores.length]);
    rect(g, x + 15 + k * 9, suelo - 26, 2, 2, "#d8d0c0");
  }
  // ristras colgando del toldo
  for (const fx of [16, 40, 64, 84]) {
    rect(g, x + fx, suelo - 34, 1, 6, "#8a7a5a");
    rect(g, x + fx - 2, suelo - 28, 5, 5, fx % 3 === 0 ? "#d8b04a" : "#a05a2a");
  }
  caja(g, x - 6, suelo);
  caja(g, x + w - 4, suelo, 10, 8);
  // sacos
  g.fillStyle = "#b09a6a";
  g.beginPath();
  g.ellipse(x + w + 2, suelo - 13, 5, 5, 0, 0, Math.PI * 2);
  g.fill();
  letrero(g, cx, suelo - 106, nombre);
}

function armeria(g: G, cx: number, suelo: number, nombre: string): void {
  const w = 92;
  const x = cx - w / 2;
  sillares(g, x, suelo - 76, w, 76, "#56525e");
  // almenas pequeñas
  for (let k = 0; k < 7; k++) sillares(g, x + k * 14, suelo - 84, 9, 8, "#56525e");
  rect(g, x - 2, suelo - 77, w + 4, 3, PIEDRA_OSCURA);
  ventana(g, x + 14, suelo - 62, 8, 14, true);
  ventana(g, x + 70, suelo - 62, 8, 14, true);
  puerta(g, cx, suelo, 18, 30, MADERA, true);
  // escudo heráldico sobre la puerta
  poli(g, "#8a2a2a", cx - 8, suelo - 64, cx + 8, suelo - 64, cx + 8, suelo - 56, cx, suelo - 48, cx - 8, suelo - 56);
  rect(g, cx - 1, suelo - 63, 2, 13, "#d8b04a");
  rect(g, cx - 6, suelo - 58, 12, 2, "#d8b04a");
  // armero exterior: lanzas, espada y hacha
  rect(g, x + w + 2, suelo - 30, 22, 3, MADERA);
  rect(g, x + w + 2, suelo - 6, 22, 3, MADERA);
  for (let k = 0; k < 4; k++) {
    rect(g, x + w + 5 + k * 5, suelo - 44, 1, 44, MADERA_CLARA);
    poli(g, "#c8c8d8", x + w + 4 + k * 5, suelo - 44, x + w + 5.5 + k * 5, suelo - 50, x + w + 7 + k * 5, suelo - 44);
  }
  // escudo redondo apoyado
  g.fillStyle = "#6a3a20";
  g.beginPath();
  g.arc(x - 8, suelo - 10, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#a8a8b8";
  g.beginPath();
  g.arc(x - 8, suelo - 10, 3, 0, Math.PI * 2);
  g.fill();
  cartelColgante(g, x - 18, suelo - 70, (g2, ix, iy) => {
    rect(g2, ix - 1, iy - 6, 2, 9, "#d8d8e8");
    rect(g2, ix - 4, iy + 2, 8, 1, "#d8b04a");
    rect(g2, ix - 1, iy + 3, 2, 3, MADERA_OSCURA);
  });
  letrero(g, cx, suelo - 100, nombre);
}

function boveda(g: G, cx: number, suelo: number, nombre: string): void {
  const w = 90;
  const x = cx - w / 2;
  // zócalo ancho y muros gruesos con contrafuertes
  sillares(g, x - 4, suelo - 10, w + 8, 10, PIEDRA_OSCURA);
  sillares(g, x, suelo - 80, w, 70, "#4a4458");
  for (const fx of [-6, w - 2]) poli(g, PIEDRA_OSCURA, x + fx, suelo - 10, x + fx + 8, suelo - 10, x + fx + 8, suelo - 70, x + fx + 4, suelo - 76);
  // frontón con columnas (aire de cámara del tesoro)
  poli(g, "#5a5468", x - 4, suelo - 80, cx, suelo - 104, x + w + 4, suelo - 80);
  rect(g, x - 6, suelo - 81, w + 12, 3, PIEDRA_CLARA);
  for (const fx of [14, 30, 58, 74]) {
    rect(g, x + fx, suelo - 76, 5, 66, PIEDRA_CLARA);
    rect(g, x + fx - 1, suelo - 78, 7, 3, "#9a94a8");
  }
  // ventanas con barrotes
  for (const fx of [21, 65]) {
    rect(g, x + fx, suelo - 60, 6, 14, "#c9a7ff");
    for (let k = 0; k < 3; k++) rect(g, x + fx + k * 2, suelo - 60, 1, 14, HIERRO);
  }
  // puerta de hierro remachada
  rect(g, cx - 11, suelo - 34, 22, 34, HIERRO);
  g.fillStyle = HIERRO;
  g.beginPath();
  g.arc(cx, suelo - 34, 11, Math.PI, 0);
  g.fill();
  for (let fy = 0; fy < 5; fy++) for (let fx = 0; fx < 4; fx++) rect(g, cx - 8 + fx * 5, suelo - 38 + fy * 7, 1, 1, "#8a8a9a");
  g.fillStyle = "#d8b04a";
  g.beginPath();
  g.arc(cx, suelo - 18, 3, 0, Math.PI * 2);
  g.fill();
  // moneda en el frontón
  g.fillStyle = "#d8b04a";
  g.beginPath();
  g.arc(cx, suelo - 90, 5, 0, Math.PI * 2);
  g.fill();
  rect(g, cx - 1, suelo - 93, 2, 6, "#8a6a1a");
  letrero(g, cx, suelo - 120, nombre);
}

function capilla(g: G, cx: number, suelo: number, nombre: string): void {
  const w = 74;
  const x = cx - w / 2;
  sillares(g, x, suelo - 70, w, 70, "#6a6278");
  tejado(g, cx, suelo - 68, w + 10, 34, "#4a3a6a");
  // campanario
  sillares(g, cx - 9, suelo - 130, 18, 40, "#6a6278");
  rect(g, cx - 5, suelo - 124, 10, 12, "#1a1428");
  g.fillStyle = "#1a1428";
  g.beginPath();
  g.arc(cx, suelo - 124, 5, Math.PI, 0);
  g.fill();
  g.fillStyle = "#c8a040";
  g.beginPath();
  g.arc(cx, suelo - 117, 3, Math.PI, 0);
  g.fill();
  rect(g, cx - 3, suelo - 117, 6, 2, "#c8a040");
  poli(g, "#4a3a6a", cx - 12, suelo - 130, cx, suelo - 152, cx + 12, suelo - 130);
  rect(g, cx, suelo - 162, 1, 10, "#d8b04a");
  rect(g, cx - 3, suelo - 158, 7, 1, "#d8b04a");
  // rosetón (vitral)
  g.fillStyle = MADERA_OSCURA;
  g.beginPath();
  g.arc(cx, suelo - 52, 10, 0, Math.PI * 2);
  g.fill();
  const vit = ["#a07cff", "#ff6aa8", "#6ac8ff", "#ffd23d"];
  for (let k = 0; k < 8; k++) {
    g.fillStyle = vit[k % vit.length];
    g.beginPath();
    g.moveTo(cx, suelo - 52);
    g.arc(cx, suelo - 52, 8, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4);
    g.fill();
  }
  rect(g, cx - 2, suelo - 54, 4, 4, "#ffffff");
  // ventanas ojivales
  ventana(g, x + 8, suelo - 46, 7, 18, true, "#a07cff");
  ventana(g, x + w - 15, suelo - 46, 7, 18, true, "#a07cff");
  puerta(g, cx, suelo, 16, 24, "#5a3a5a", true);
  // escalones
  rect(g, cx - 14, suelo - 3, 28, 3, PIEDRA_CLARA);
  letrero(g, cx, suelo - 86, nombre, 72);
}

function fragua(g: G, cx: number, suelo: number, nombre: string): void {
  const w = 100;
  const x = cx - w / 2;
  // pared del fondo y techo a un agua sobre postes (taller abierto)
  sillares(g, x + 4, suelo - 62, w - 8, 62, "#4a3c38");
  poli(g, "#3a2018", x - 6, suelo - 58, x + w + 6, suelo - 74, x + w + 6, suelo - 66, x - 6, suelo - 50);
  for (let k = 0; k < 12; k++) rect(g, x - 4 + k * 9, suelo - 62 - k * 1.4, 1, 8, "#00000050");
  rect(g, x - 2, suelo - 54, 4, 54, MADERA);
  rect(g, x + w - 2, suelo - 68, 4, 68, MADERA);
  // horno de piedra con boca encendida y chimenea alta
  sillares(g, x + 56, suelo - 40, 32, 40, "#5a4a44");
  sillares(g, x + 64, suelo - 120, 16, 50, "#5a4a44");
  rect(g, x + 62, suelo - 72, 20, 3, PIEDRA_OSCURA);
  g.fillStyle = "#1a0a04";
  g.beginPath();
  g.arc(x + 72, suelo - 16, 9, Math.PI, 0);
  g.fill();
  rect(g, x + 63, suelo - 16, 18, 12, "#1a0a04");
  // yunque sobre tocón
  rect(g, x + 22, suelo - 12, 12, 12, MADERA);
  poli(g, "#3a3a44", x + 14, suelo - 20, x + 42, suelo - 20, x + 38, suelo - 15, x + 30, suelo - 15, x + 30, suelo - 12, x + 26, suelo - 12, x + 26, suelo - 15, x + 18, suelo - 15);
  rect(g, x + 14, suelo - 21, 28, 1, "#6a6a78");
  // fuelle, tenazas y barril de temple
  poli(g, "#6a4028", x + 40, suelo - 28, x + 54, suelo - 32, x + 54, suelo - 22, x + 40, suelo - 26);
  barril(g, x + 6, suelo);
  rect(g, x + 7, suelo - 13, 9, 2, "#4a7aa8");
  for (const fx of [8, 14, 20]) rect(g, x + fx, suelo - 52, 1, 14, "#8a8a98");
  cartelColgante(g, x + w + 4, suelo - 64, (g2, ix, iy) => {
    poli(g2, "#3a3a44", ix - 6, iy - 2, ix + 6, iy - 2, ix + 4, iy + 1, ix + 1, iy + 1, ix + 1, iy + 4, ix - 1, iy + 4, ix - 1, iy + 1, ix - 4, iy + 1);
    rect(g2, ix - 6, iy - 3, 12, 1, "#9a9aa8");
  });
  letrero(g, cx - 10, suelo - 92, nombre);
}

function santuario(g: G, cx: number, suelo: number, nombre: string): void {
  // torre redonda de piedra con hiedra y menhires
  const w = 40;
  const x = cx - w / 2;
  sillares(g, x, suelo - 110, w, 110, "#4a5664");
  rect(g, x - 3, suelo - 112, w + 6, 4, PIEDRA_OSCURA);
  for (let k = 0; k < 5; k++) sillares(g, x - 3 + k * 10, suelo - 120, 6, 8, "#4a5664");
  poli(g, "#2a3a5a", x - 6, suelo - 120, cx, suelo - 150, x + w + 6, suelo - 120);
  ventana(g, cx - 4, suelo - 96, 8, 14, true, "#9fe8ff");
  ventana(g, cx - 4, suelo - 66, 8, 12, true, "#9fe8ff");
  puerta(g, cx, suelo, 14, 24, "#2a3a4a");
  // hiedra
  g.fillStyle = "#3a6a3a";
  for (let k = 0; k < 40; k++) {
    const hy = suelo - 6 - ((k * 37) % 90);
    const hx = x + ((k * 13) % 8) + (k % 2 === 0 ? 0 : w - 10);
    g.fillRect(hx, hy, 3, 2);
  }
  // menhires rúnicos a los lados
  for (const [dx, alto] of [[-38, 30], [-26, 20], [30, 26], [42, 18]] as const) {
    poli(g, "#6a7484", cx + dx - 5, suelo, cx + dx - 4, suelo - alto, cx + dx + 2, suelo - alto - 4, cx + dx + 5, suelo);
    rect(g, cx + dx - 1, suelo - alto + 6, 2, 2, "#9fe8ff");
    rect(g, cx + dx - 1, suelo - alto + 12, 2, 4, "#9fe8ff");
  }
  letrero(g, cx, suelo - 168, nombre, 60);
}

function pozo(g: G, cx: number, suelo: number): void {
  // brocal redondo de piedra
  sillares(g, cx - 30, suelo - 22, 60, 22, "#5a5468");
  rect(g, cx - 32, suelo - 24, 64, 4, PIEDRA_CLARA);
  rect(g, cx - 26, suelo - 26, 52, 2, "#0a0614");
  // postes, tejadillo y manivela
  rect(g, cx - 28, suelo - 74, 5, 52, MADERA);
  rect(g, cx + 23, suelo - 74, 5, 52, MADERA);
  tejado(g, cx, suelo - 72, 76, 22, "#5a2a20");
  rect(g, cx - 26, suelo - 62, 52, 4, MADERA_CLARA);
  rect(g, cx + 28, suelo - 62, 8, 2, HIERRO);
  rect(g, cx + 34, suelo - 62, 2, 8, HIERRO);
  // cuerda y cubo
  rect(g, cx, suelo - 58, 1, 22, "#c8b890");
  rect(g, cx - 4, suelo - 38, 9, 8, MADERA_CLARA);
  rect(g, cx - 4, suelo - 36, 9, 1, HIERRO);
  // carteles de aviso
  rect(g, cx - 50, suelo - 30, 2, 30, MADERA);
  rect(g, cx - 60, suelo - 30, 22, 12, MADERA_CLARA);
  rotulos.push({ x: cx - 49, y: suelo - 21, texto: "POZO", color: MADERA_OSCURA, tam: 6 });
  rect(g, cx + 48, suelo - 30, 2, 30, MADERA);
  rect(g, cx + 38, suelo - 30, 22, 12, "#3a2448");
  rotulos.push({ x: cx + 49, y: suelo - 21, texto: "ABISMO", color: "#c98aff", tam: 6 });
  letrero(g, cx, suelo - 112, "El Pozo · El Abismo", 90);
}

/** Dibuja el edificio y devuelve los textos de sus carteles (para pintarlos con `dibujarRotulos`). */
export function dibujarEdificio(g: G, forma: FormaEdificio, cx: number, suelo: number, nombre: string): Rotulo[] {
  const n = nombre.replace(/«|»/g, "");
  rotulos = [];
  switch (forma) {
    case "taberna": taberna(g, cx, suelo, n); break;
    case "mercader": bazar(g, cx, suelo, n); break;
    case "armero": armeria(g, cx, suelo, n); break;
    case "banco": boveda(g, cx, suelo, n); break;
    case "altar": capilla(g, cx, suelo, n); break;
    case "herrero": fragua(g, cx, suelo, n); break;
    case "santuario": santuario(g, cx, suelo, n); break;
    case "pozo": pozo(g, cx, suelo); break;
  }
  return rotulos;
}

export function dibujarRotulos(g: G, lista: readonly Rotulo[]): void {
  for (const r of lista) hd.texto(g, r.texto, r.x, r.y, { color: r.color, alinear: "center", tam: r.tam });
}

/** Lo que se mueve: fuego de la fragua, humo, vitrales que respiran, el brillo del Pozo. */
export function animarEdificio(g: G, forma: FormaEdificio, cx: number, suelo: number, t: number): void {
  g.save();
  switch (forma) {
    case "herrero": {
      const x = cx - 50;
      const f = 0.7 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.15;
      g.globalCompositeOperation = "lighter";
      g.fillStyle = `rgba(255,120,40,${0.55 * f})`;
      g.beginPath();
      g.arc(x + 72, suelo - 12, 9, Math.PI, 0);
      g.fill();
      rect(g, x + 64, suelo - 12, 16, 8, `rgba(255,190,80,${0.7 * f})`);
      for (let k = 0; k < 3; k++) rect(g, x + 66 + k * 5, suelo - 18 - ((t * 20 + k * 3) % 6), 2, 3, "#ffd27a");
      break;
    }
    case "altar": {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.25 + Math.sin(t * 1.5) * 0.15;
      g.fillStyle = "#a07cff";
      g.beginPath();
      g.arc(cx, suelo - 52, 13, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "santuario": {
      g.globalCompositeOperation = "lighter";
      for (const [dx, alto] of [[-38, 30], [-26, 20], [30, 26], [42, 18]] as const) {
        g.globalAlpha = 0.4 + Math.sin(t * 2 + dx) * 0.3;
        rect(g, cx + dx - 2, suelo - alto + 5, 4, 12, "#9fe8ff");
      }
      break;
    }
    case "pozo": {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.35 + Math.sin(t * 1.2) * 0.12;
      g.fillStyle = "#a07cff";
      g.beginPath();
      g.ellipse(cx, suelo - 25, 26, 4, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    default:
      break;
  }
  g.restore();
}

/** Puntos de humo (chimeneas) para que el pueblo eche partículas. */
export function chimeneas(forma: FormaEdificio, cx: number, suelo: number): readonly (readonly [number, number])[] {
  switch (forma) {
    case "taberna": return [[cx - 48 + 75, suelo - 128]];
    case "herrero": return [[cx - 50 + 72, suelo - 120]];
    default: return [];
  }
}

/** Luces cálidas de cada edificio (ventanas, horno, vitrales). */
export function lucesEdificio(forma: FormaEdificio, cx: number, suelo: number, t: number): Luz[] {
  switch (forma) {
    case "taberna": return [{ x: cx - 14, y: suelo - 62, r: 40, fuerza: 0.9 }, { x: cx - 30, y: suelo - 20, r: 30, fuerza: 0.8 }];
    case "mercader": return [{ x: cx, y: suelo - 24, r: 46, fuerza: 0.8 }];
    case "armero": return [{ x: cx - 28, y: suelo - 56, r: 26, fuerza: 0.7 }, { x: cx + 28, y: suelo - 56, r: 26, fuerza: 0.7 }];
    case "banco": return [{ x: cx, y: suelo - 30, r: 34, fuerza: 0.6 }];
    case "altar": return [{ x: cx, y: suelo - 52, r: 44 + Math.sin(t * 1.5) * 4, fuerza: 0.9 }];
    case "herrero": return [{ x: cx + 22, y: suelo - 14, r: 64 + Math.sin(t * 13) * 5, fuerza: 1 }];
    case "santuario": return [{ x: cx, y: suelo - 90, r: 36, fuerza: 0.8 }, { x: cx, y: suelo - 10, r: 50, fuerza: 0.6 }];
    case "pozo": return [{ x: cx, y: suelo - 24, r: 60, fuerza: 0.6 }];
  }
}
