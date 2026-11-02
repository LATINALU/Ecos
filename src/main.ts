// Raíz de composición: canvas, bucle de paso fijo, entrada, audio, persistencia, juego e interfaz.

import { borrarDescenso, cargarDescenso, cargarMeta, guardarDescenso, guardarMeta } from "./infra/repositorio.ts";
import { Juego, type EventosJuego, type InicioJuego } from "./juego/juego.ts";
import { Audio } from "./motor/audio.ts";
import { Entrada } from "./motor/entrada.ts";
import { sprites } from "./motor/sprites.ts";
import { dibujarHud } from "./ui/hud.ts";
import { Interfaz } from "./ui/interfaz.ts";

const ANCHO = 480;
const ALTO = 270;
const PASO = 1 / 60;

const lienzo = document.getElementById("lienzo") as HTMLCanvasElement;
const capaUi = document.getElementById("capa-ui") as HTMLDivElement;
const marco = document.getElementById("marco") as HTMLDivElement;
const g = lienzo.getContext("2d")!;
g.imageSmoothingEnabled = false;

const meta = cargarMeta();
const audio = new Audio();
const entrada = new Entrada(window);
let juego: Juego | null = null;

const guardar = (): void => guardarMeta(meta);

const ui = new Interfaz(capaUi, meta, audio, {
  descender: (opciones) => iniciar({ tipo: "nueva", opciones }),
  continuar: () => {
    const d = cargarDescenso();
    if (d === null) {
      ui.toast("No se pudo leer el descenso guardado", "#ff9a4d");
      ui.mostrarTitulo();
      return;
    }
    iniciar({ tipo: "continuar", datos: d });
  },
  descensoGuardado: () => cargarDescenso()?.partida.piso ?? null,
  refrescarArte: () => juego?.refrescarArte(),
  guardarYSalir: () => {
    juego?.guardarProgreso();
    juego = null;
    audio.silenciarAmbiente();
    ui.cerrarForzado();
    ui.mostrarTitulo();
  },
  aTitulo: () => {
    juego = null;
    ui.mostrarTitulo();
  },
  abandonar: () => {
    if (juego === null) return;
    ui.cerrarForzado();
    juego.rendirse();
  },
  guardar,
});

const eventos: EventosJuego = {
  mensaje: (t, c) => ui.toast(t, c),
  abrirAltar: () => { if (juego !== null) ui.abrirAltar(juego); },
  abrirMercader: () => { if (juego !== null) ui.abrirMercader(juego); },
  abrirYunque: () => { if (juego !== null) ui.abrirYunque(juego); },
  guardarDescenso: (d) => guardarDescenso(d),
  borrarDescenso: () => borrarDescenso(),
  reliquia: (r) => ui.mostrarReliquia(r, () => entrada.limpiar()),
  jefe: (nombre, titulo) => ui.anunciar(nombre, titulo, "#ff6a6a"),
  nuevoPiso: (piso, b) => ui.anunciarPiso(piso, b),
  muerte: (res, eco) => setTimeout(() => ui.mostrarMuerte(res, eco), 1400),
  victoria: (res) => setTimeout(() => ui.mostrarVictoria(res), 600),
  guardar,
};

function iniciar(inicio: InicioJuego): void {
  audio.activar();
  ui.cerrarForzado();
  entrada.limpiar();
  juego = new Juego(meta, audio, entrada, eventos, inicio);
  guardar();
}

// Guardar al cerrar o esconder la pestaña.
const guardarTodo = (): void => {
  guardar();
  if (juego !== null && !juego.terminado) juego.guardarProgreso();
};
window.addEventListener("beforeunload", guardarTodo);
document.addEventListener("visibilitychange", () => { if (document.hidden) guardarTodo(); });


// ---------------- Escalado entero (pixel perfect) ----------------
function ajustar(): void {
  const escala = Math.max(1, Math.floor(Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO)));
  const w = ANCHO * escala;
  const hh = ALTO * escala;
  marco.style.width = `${w}px`;
  marco.style.height = `${hh}px`;
  lienzo.style.width = `${w}px`;
  lienzo.style.height = `${hh}px`;
  marco.style.setProperty("--escala", String(escala));
}
window.addEventListener("resize", ajustar);
ajustar();

// ---------------- Teclas de menú ----------------
function teclasDeMenu(): void {
  if (juego === null || juego.terminado) return;
  const abierto = ui.abierto;
  if (entrada.recienSiempre("pausa")) {
    if (abierto !== null) ui.cerrar();
    else ui.abrirPausa();
  } else if (entrada.recienSiempre("inventario")) {
    if (abierto === "inventario") ui.cerrar();
    else if (abierto === null) ui.abrirInventario(juego);
  } else if (entrada.recienSiempre("mapa")) {
    if (abierto === "mapa") ui.cerrar();
    else if (abierto === null) ui.abrirMapa(juego);
  }
}

// ---------------- Fondo animado del título ----------------
const brasas = Array.from({ length: 70 }, () => ({ x: Math.random() * ANCHO, y: Math.random() * ALTO, v: 6 + Math.random() * 20, r: Math.random() }));
function dibujarTitulo(t: number, dt: number): void {
  const grad = g.createLinearGradient(0, 0, 0, ALTO);
  grad.addColorStop(0, "#07050c");
  grad.addColorStop(1, "#1d1428");
  g.fillStyle = grad;
  g.fillRect(0, 0, ANCHO, ALTO);
  // el pozo
  for (let i = 0; i < 9; i++) {
    const r = 30 + i * 22 + Math.sin(t * 0.6 + i) * 3;
    g.strokeStyle = `rgba(160,124,255,${0.18 - i * 0.017})`;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(ANCHO / 2, ALTO * 0.78, r * 1.6, r * 0.35, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalCompositeOperation = "lighter";
  for (const b of brasas) {
    b.y -= b.v * dt;
    if (b.y < -4) {
      b.y = ALTO + 4;
      b.x = Math.random() * ANCHO;
    }
    g.fillStyle = b.r < 0.5 ? "#a07cff" : "#ffb23d";
    g.globalAlpha = 0.4 + Math.sin(t * 3 + b.x) * 0.3;
    g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

// ---------------- Bucle ----------------
let acumulado = 0;
let anterior = performance.now();
let reloj = 0;

function cuadro(ahora: number): void {
  const dt = Math.min(0.1, (ahora - anterior) / 1000);
  anterior = ahora;
  reloj += dt;

  teclasDeMenu();
  const pausado = juego === null || ui.abierto !== null;
  entrada.bloqueada = pausado;
  if (juego !== null && !pausado) {
    acumulado += dt;
    while (acumulado >= PASO) {
      juego.actualizar(PASO);
      entrada.finPaso();
      acumulado -= PASO;
    }
  } else {
    acumulado = 0;
    if (juego !== null && juego.terminado) juego.actualizar(dt);
    entrada.finPaso();
  }

  if (juego !== null) {
    juego.dibujar(g);
    if (!juego.terminado) dibujarHud(g, juego);
  } else {
    dibujarTitulo(reloj, dt);
  }
  requestAnimationFrame(cuadro);
}

// Los sprites cargan en paralelo; mientras tanto (o si fallan) se dibuja el arte procedural.
void sprites.cargar().then(() => {
  if (ui.abierto === "titulo") ui.mostrarTitulo();
  // Solo en desarrollo: ?auto=<estilo> empieza una partida directa (para capturas y pruebas visuales).
  const auto = import.meta.env.DEV ? new URLSearchParams(location.search).get("auto") : null;
  if (auto !== null) {
    iniciar({ tipo: "nueva", opciones: { estilo: (["espada", "punos", "pesada", "baston"].includes(auto) ? auto : "espada") as "espada" } });
    const q = new URLSearchParams(location.search);
    if (q.has("sala") || q.has("piso")) juego?.depurarIr(Number(q.get("piso") ?? 1), Number(q.get("sala") ?? 0));
  }
});
ui.mostrarTitulo();
requestAnimationFrame(cuadro);
