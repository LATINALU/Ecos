// Raíz de composición: canvas, bucle de paso fijo, entrada, audio, persistencia, interfaz y las dos escenas:
//   título → partidas → PUEBLO ⇄ DESCENSO (Juego)
// El personaje (Partida) es persistente por ranura: baja con todo, vuelve con todo; al caer pierde un 25 %
// de las esquirlas que lleva. El banco y la Meta (reliquias, esencia, ecos) también son de la ranura.

// Fuentes de píxel (OFL, empaquetadas: funcionan sin conexión) y la capa de estética pixel art de la interfaz.
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/jacquard-12/400.css";
import "./ui/pixel.css";
import { instalarMarcos } from "./ui/marcos.ts";
import { CompositorWebGL } from "./motor/compositor.ts";
import { pintor } from "./motor/pintor.ts";
import { postfx } from "./motor/postfx.ts";
import { crearServicioEcos } from "./infra/ecos-compartidos.ts";
import { MAT_FRAGMENTO, OBJ_CAJA_ALMAS, OBJ_POCION, OBJ_RELICARIO } from "./contenido/objetos.ts";
import { generarEquipo } from "./dominio/equipo.ts";
import { crearCarta } from "./dominio/cartas.ts";
import { hd } from "./motor/texto-hd.ts";
import { AzarSistema } from "minialu";
import { Banco } from "./dominio/banco.ts";
import { generarStockArmero, type ArticuloArmero } from "./dominio/comercio.ts";
import { Meta } from "./dominio/meta.ts";
import { Partida } from "./dominio/partida.ts";
import {
  cargarRanura, guardarRanura, metaDesde, migrarGuardadoViejo, resumenRanuras,
} from "./infra/repositorio.ts";
import { Juego, configEcos, type DatosDescenso, type EventosJuego, type InicioJuego } from "./juego/juego.ts";
import { NPCS, Pueblo, type EventosPueblo } from "./juego/pueblo.ts";
import { dibujarPortador, type Pose } from "./juego/render-portador.ts";
import { Audio } from "./motor/audio.ts";
import { Entrada } from "./motor/entrada.ts";
import { sprites } from "./motor/sprites.ts";
import { dibujarHud, dibujarHudPueblo } from "./ui/hud.ts";
/** Solo desarrollo: &sinhud oculta el HUD (capturas). */
const sinHud = new URLSearchParams(location.search).has("sinhud");
import { Interfaz } from "./ui/interfaz.ts";

instalarMarcos();
const servicioEcos = crearServicioEcos();
void servicioEcos.precargar();
import { PISOS_TOTALES } from "./contenido/biomas.ts";

const ANCHO = 480;
const ALTO = 270;
const PASO = 1 / 60;
/** Ranura oculta que usan los parámetros de desarrollo (?auto, ?pueblo): nunca pisa las partidas reales. */
const RANURA_PRUEBAS = 9;

const lienzo = document.getElementById("lienzo") as HTMLCanvasElement;
const capaUi = document.getElementById("capa-ui") as HTMLDivElement;
const marco = document.getElementById("marco") as HTMLDivElement;
// MOTOR: si hay WebGL2, el juego dibuja en un lienzo oculto (albedo) y el compositor lo ilumina y le aplica
// relieve, bloom, ondas de choque y aberración cromática. Sin WebGL2 (o con ?sinwebgl) se dibuja directo como antes.
let compositor: CompositorWebGL | null = null;
const albedo = document.createElement("canvas");
albedo.width = ANCHO;
albedo.height = ALTO;
if (!new URLSearchParams(location.search).has("sinwebgl")) {
  try {
    compositor = new CompositorWebGL(lienzo, ANCHO, ALTO);
    if (new URLSearchParams(location.search).has("sinsombras")) compositor.sombras = 0;
  } catch {
    compositor = null;
  }
}
pintor.activo = compositor !== null;
const capaDepuracion = new URLSearchParams(location.search).get("capa");
postfx.conectar(compositor);
const g = (compositor !== null ? albedo : lienzo).getContext("2d")!;
g.imageSmoothingEnabled = false;
// Capa de texto nítido (alta resolución) encima del juego pixelado.
const lienzoTexto = document.createElement("canvas");
lienzoTexto.id = "lienzo-texto";
lienzo.after(lienzoTexto);
hd.conectar(lienzoTexto, ANCHO);

migrarGuardadoViejo();

const audio = new Audio();
const entrada = new Entrada(window);

// ---------------- Estado de la sesión ----------------
let ranura: number | null = null;
let nombreRanura = "";
let creada = Date.now();
let meta = Meta.nueva();
let partida: Partida | null = null;
let banco = new Banco();
let stock: ArticuloArmero[] = [];
let juego: Juego | null = null;
let pueblo: Pueblo | null = null;

/** Guarda la ranura activa. `descenso`: undefined = no tocar el guardado; null = borrarlo. */
function guardarTodo(descenso?: DatosDescenso | null): void {
  if (ranura === null) return;
  const anterior = cargarRanura(ranura);
  guardarRanura(ranura, {
    nombre: nombreRanura,
    creada,
    meta: meta.serializar(),
    personaje: partida?.serializar() ?? anterior?.personaje ?? null,
    banco: banco.serializar(),
    descenso: descenso !== undefined ? descenso : anterior?.descenso ?? null,
  });
}

const ui = new Interfaz(capaUi, meta, audio, {
  ranuras: () => resumenRanuras(),
  jugarRanura: (i) => jugarRanura(i),
  crearPartida: (i, nombre, opciones) => {
    const existente = cargarRanura(i);
    // Una ranura migrada del formato viejo (sin personaje) conserva su mundo; si no, todo nuevo.
    meta = existente !== null && existente.personaje === null ? metaDesde(existente.meta) : Meta.nueva();
    ui.usarMeta(meta);
    ranura = i;
    nombreRanura = nombre;
    creada = Date.now();
    banco = new Banco();
    partida = new Partida(meta, (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, opciones);
    guardarTodo(null);
    entrarPueblo("inicio");
    ui.anunciar(`Bienvenido, ${nombre}`, "Último Refugio · el pueblo sobre el Pozo", "#ffd27a");
  },
  descender: (piso, abismo) => descender(piso, abismo ?? false),
  volverAlPueblo: () => entrarPueblo("pozo"),
  stockArmero: () => stock,
  banco: () => banco,
  aTitulo: () => aTitulo(),
  abandonar: () => {
    if (juego === null) return;
    ui.cerrarForzado();
    juego.rendirse();
  },
  guardarYSalir: () => {
    if (juego !== null) juego.guardarProgreso();
    else guardarTodo();
    aTitulo();
  },
  refrescarArte: () => juego?.refrescarArte(),
  guardar: () => guardarTodo(),
});

function aTitulo(): void {
  juego = null;
  pueblo = null;
  audio.silenciarAmbiente();
  ui.cerrarForzado();
  ui.mostrarTitulo();
}

function jugarRanura(i: number): void {
  const d = cargarRanura(i);
  if (d === null) {
    ui.mostrarPreparacion(i);
    return;
  }
  ranura = i;
  nombreRanura = d.nombre;
  creada = d.creada;
  meta = metaDesde(d.meta);
  ui.usarMeta(meta);
  banco = Banco.restaurar(d.banco);
  audio.activar();
  if (d.descenso !== null) {
    // Retomar el descenso donde quedó.
    ui.cerrarForzado();
    entrada.limpiar();
    pueblo = null;
    iniciarJuego({ tipo: "continuar", datos: d.descenso });
    return;
  }
  if (d.personaje === null) {
    ui.mostrarPreparacion(i);
    return;
  }
  partida = Partida.restaurar(meta, d.personaje);
  entrarPueblo("inicio");
}

function entrarPueblo(desde: "inicio" | "pozo"): void {
  if (partida === null) return;
  juego = null;
  audio.silenciarAmbiente();
  ui.cerrarForzado();
  entrada.limpiar();
  stock = generarStockArmero(new AzarSistema(), Math.max(partida.pisoDesbloqueado, meta.registro.mejorPiso));
  pueblo = new Pueblo(partida, meta, audio, entrada, eventosPueblo, desde);
  guardarTodo(null);
  recibirVenganzas();
}

/** Ecos asíncronos: si otro Portador vengó una de tus caídas, te llega a la Taberna (y las esquirlas). */
function recibirVenganzas(): void {
  const autor = `ranura-${ranura ?? 0}`;
  void servicioEcos.venganzas(autor).then((lista) => {
    if (lista.length === 0 || partida === null) return;
    for (const v of lista) {
      partida.billetera.acreditar("esquirlas", v.recompensa);
      meta.venganzas = [v, ...meta.venganzas].slice(0, 8);
      ui.toast(`⚔ ${v.vengador} vengó tu caída en el piso ${v.piso} — Recibes ${v.recompensa} esquirlas`, "#7dffb0");
    }
    guardarTodo(null);
  });
}

function descender(piso: number, abismo = false): void {
  if (partida === null) return;
  audio.activar();
  ui.cerrarForzado();
  entrada.limpiar();
  pueblo = null;
  iniciarJuego({ tipo: "descenso", partida, piso, abismo });
  guardarTodo();
}

function iniciarJuego(inicio: InicioJuego): void {
  // Quién juega y dónde viven los Ecos compartidos (otras ranuras de esta PC, o un servidor si VITE_ECOS_URL).
  configEcos.servicio = servicioEcos;
  configEcos.nombre = nombreRanura !== "" ? nombreRanura : "un Portador";
  configEcos.autor = `ranura-${ranura ?? 0}`;
  juego = new Juego(meta, audio, entrada, eventos, inicio);
  partida = juego.partida;
}

const eventosPueblo: EventosPueblo = {
  mensaje: (t, c) => ui.toast(t, c),
  abrirServicio: (s) => {
    if (pueblo === null) return;
    switch (s) {
      case "taberna": ui.abrirTaberna(pueblo); break;
      case "mercader": ui.abrirBazar(pueblo); break;
      case "armero": ui.abrirArmeria(pueblo); break;
      case "banco": ui.abrirBanco(pueblo); break;
      case "altar": ui.abrirAltar(pueblo); break;
      case "herrero": ui.abrirYunque(pueblo); break;
      case "santuario": ui.mostrarSantuario(); break;
      case "pozo": ui.abrirPozo(pueblo); break;
    }
  },
  hablar: (s) => {
    if (pueblo === null) return;
    ui.abrirHistoria(pueblo, s, NPCS.find((n) => n.servicio === s)?.nombre ?? "");
  },
};

const eventos: EventosJuego = {
  mensaje: (t, c) => ui.toast(t, c),
  abrirAltar: () => { if (juego !== null) ui.abrirAltar(juego); },
  abrirMercader: () => { if (juego !== null) ui.abrirMercader(juego, juego.errante()); },
  abrirCampana: (op) => ui.abrirCampana(op),
  decidirEco: (op) => ui.decidirEco(op),
  abrirYunque: () => { if (juego !== null) ui.abrirYunque(juego); },
  abrirFaro: (op) => ui.abrirFaro(op),
  abrirPortal: (op) => ui.abrirPortal(op),
  volverAlPueblo: (motivo) => {
    entrarPueblo("pozo");
    ui.toast(motivo === "extraccion" ? "¡Extracción completada! Todo tu botín está a salvo" : "Extrajiste por el portal del guardián con tu botín", "#7dffb0");
  },
  guardarDescenso: (d) => guardarTodo(d),
  borrarDescenso: () => guardarTodo(null),
  reliquia: (r) => ui.mostrarReliquia(r, () => entrada.limpiar()),
  jefe: (nombre, titulo) => ui.anunciar(nombre, titulo, "#ff6a6a"),
  nuevoPiso: (piso, b, abismo) => ui.anunciarPiso(piso, b, abismo),
  muerte: (res, eco) => setTimeout(() => {
    guardarTodo(null);
    ui.mostrarMuerte(res, eco);
  }, 1400),
  victoria: (res) => setTimeout(() => {
    partida?.curarTodo();
    guardarTodo(null);
    ui.mostrarVictoria(res);
  }, 600),
  guardar: () => guardarTodo(),
};

// Guardar al cerrar o esconder la pestaña.
const guardarAlSalir = (): void => {
  if (juego !== null && !juego.terminado) juego.guardarProgreso();
  else if (pueblo !== null) guardarTodo();
};
window.addEventListener("beforeunload", guardarAlSalir);
document.addEventListener("visibilitychange", () => { if (document.hidden) guardarAlSalir(); });

// ---------------- Escalado entero (pixel perfect) ----------------
function ajustar(): void {
  const escala = Math.max(1, Math.floor(Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO)));
  const w = ANCHO * escala;
  const hh = ALTO * escala;
  marco.style.width = `${w}px`;
  marco.style.height = `${hh}px`;
  lienzo.style.width = `${w}px`;
  lienzo.style.height = `${hh}px`;
  hd.redimensionar(w, hh);
  marco.style.setProperty("--escala", String(escala));
}
window.addEventListener("resize", ajustar);
ajustar();

// ---------------- Teclas de menú ----------------
function teclasDeMenu(): void {
  const escena = juego !== null && !juego.terminado ? juego : pueblo;
  if (escena === null) return;
  const abierto = ui.abierto;
  if (entrada.recienSiempre("pausa")) {
    if (abierto !== null) ui.cerrar();
    else ui.abrirPausa();
  } else if (entrada.recienSiempre("inventario")) {
    if (abierto === "inventario") ui.cerrar();
    else if (abierto === null) ui.abrirInventario(escena);
  } else if (entrada.recienSiempre("mapa") && juego !== null) {
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

// ---------------- Galería de poses (solo desarrollo: ?galeria) ----------------
const galeria = import.meta.env.DEV && new URLSearchParams(location.search).has("galeria");
if (galeria) ui.cerrarForzado();
function dibujarGaleria(c: CanvasRenderingContext2D, t: number): void {
  c.fillStyle = "#1a1428";
  c.fillRect(0, 0, ANCHO, ALTO);
  const poses: Pose[] = ["quieto", "correr", "saltar", "caer", "agachado", "deslizar", "atras", "pared", "patada", "lanzar", "trepar", "herido"];
  const paletas = [["#9c8f7a", "#e0c48a"], ["#3b3550", "#b48cff"], ["#2f3a6e", "#9fe8ff"], ["#5b4636", "#ffe08a"]];
  c.save();
  c.scale(2, 2);
  paletas.forEach(([cuerpo, acento], fila) => {
    poses.forEach((pose, i) => dibujarPortador(c, 10 + i * 19, 30 + fila * 32, 1, pose, { cuerpo, acento }, t, { variante: fila }));
  });
  c.restore();
}

// ---------------- Bucle ----------------
let acumulado = 0;
let anterior = performance.now();
let reloj = 0;

function cuadro(ahora: number): void {
  // El tiempo del primer cuadro puede ser anterior a la carga del script: nunca dejar que dt sea negativo.
  const dt = Math.max(0, Math.min(0.1, (ahora - anterior) / 1000));
  anterior = ahora;
  reloj += dt;

  teclasDeMenu();
  if (compositor !== null) {
    pintor.limpiar();
    compositor.iniciarCuadro();
  }
  const escena = juego ?? pueblo;
  const pausado = escena === null || ui.abierto !== null;
  entrada.bloqueada = pausado;
  if (escena !== null && !pausado) {
    acumulado += dt;
    while (acumulado >= PASO) {
      escena.actualizar(PASO);
      entrada.finPaso();
      acumulado -= PASO;
    }
  } else {
    acumulado = 0;
    if (juego !== null && juego.terminado) juego.actualizar(dt);
    entrada.finPaso();
  }

  if (galeria) {
    dibujarGaleria(g, reloj);
  } else if (juego !== null) {
    juego.dibujar(g);
    if (!juego.terminado && !(import.meta.env.DEV && sinHud)) dibujarHud(g, juego);
  } else if (pueblo !== null) {
    pueblo.dibujar(g);
    dibujarHudPueblo(g, pueblo, meta, nombreRanura);
  } else {
    dibujarTitulo(reloj, dt);
  }
  if (compositor !== null) {
    // Solo desarrollo: ?capa=normales|emisivo muestra esa capa del G-Buffer en lugar del color.
    const ver = import.meta.env.DEV ? capaDepuracion : null;
    const fuente = ver === "normales" ? pintor.normales.canvas : ver === "emisivo" ? pintor.emisivo.canvas : albedo;
    compositor.renderizar(dt, ver === "mascara" ? pintor.cerrarMascara() : fuente, pintor.normales.canvas, pintor.emisivoConBloom(), pintor.cerrarMascara());
  }
  hd.pintar();
  requestAnimationFrame(cuadro);
}

// ---------------- Arranque ----------------
void sprites.cargar().then(() => {
  if (ui.abierto === "titulo" && !galeria) ui.mostrarTitulo();
  if (!import.meta.env.DEV) return;
  // Solo en desarrollo, con una ranura de pruebas oculta:
  //   ?auto=<estilo>&piso=N&sala=M&jefe  → personaje nuevo directo al Pozo
  //   ?auto=<estilo>&extraccion[&dentro]  → sala con zona de extracción (dentro: parado en ella)
  //   ?pueblo=<estilo>                   → personaje nuevo en el pueblo
  const q = new URLSearchParams(location.search);
  if (q.has("partidas")) {
    ui.mostrarPartidas();
    return;
  }
  const auto = q.get("auto") ?? q.get("pueblo");
  if (auto === null) return;
  const estilo = (["espada", "punos", "pesada", "baston", "arco"].includes(auto) ? auto : "espada") as "espada";
  ranura = RANURA_PRUEBAS;
  nombreRanura = "Pruebas";
  meta = Meta.nueva();
  ui.usarMeta(meta);
  banco = new Banco();
  partida = new Partida(meta, q.has("semilla") ? Number(q.get("semilla")) : (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, { estilo });
  partida.pisoDesbloqueado = PISOS_TOTALES;
  partida.abismoDesbloqueado = 999;
  partida.revisarPiedraJuicio();
  if (q.has("juicio")) partida.piedraJuicio = Math.max(2, Number(q.get("juicio") ?? 2));
  // &mazo=a,b,c,d,e → mazo de almas completo (ids de alma) a 4★; &mazo solo → al azar. &cargada → Definitiva llena.
  if (q.has("mazo")) {
    const ids = (q.get("mazo") ?? "").split(",").filter((x) => x !== "").map(Number);
    for (let r = 0; r < 5; r++) partida.almas[r] = crearCarta(partida.azar, ids[r] ?? Math.floor(Math.random() * 12), 3);
  }
  // &relicarios=N → N Relicarios de Almas en la mochila; &animar=12 → animación de apertura de una carta de 12★.
  if (q.has("relicarios")) partida.mochila.agregar(OBJ_RELICARIO, Number(q.get("relicarios") ?? 3));
  // &cajas=N → Cajas de Almas; &surtido → equipo de todas las rarezas y consumibles; &forma=N → Forma de N★;
  // &cartas → una carta de cada estrella de 5★ a 12★ en el mazo (para ver las auras).
  if (q.has("cajas")) partida.mochila.agregar(OBJ_CAJA_ALMAS, Number(q.get("cajas") ?? 5));
  if (q.has("surtido")) {
    for (let r = 0; r < 12; r++) partida.recoger({ tipo: "equipo", equipo: { ...generarEquipo(partida.azar, 6 + r, (r % 6) as 0) } });
    partida.mochila.agregar(OBJ_POCION, 4);
    partida.mochila.agregar(MAT_FRAGMENTO, 17);
  }
  if (q.has("forma")) partida.forma = crearCarta(partida.azar, partida.forma?.personaje ?? 0, Math.max(0, Math.min(11, Number(q.get("forma")) - 1)));
  if (q.has("cartas")) for (let n = 4; n <= 11; n++) partida.recoger({ tipo: "carta", carta: crearCarta(partida.azar, n % 12, n) });
  // &desbloqueado=N → pisos superados (cambia cómo se ve el pueblo); &hablar=herrero → historia de ese habitante.
  if (q.has("desbloqueado")) partida.pisoDesbloqueado = Number(q.get("desbloqueado"));
  if (q.has("pueblo")) {
    entrarPueblo("inicio");
    if (q.has("hablar") && pueblo !== null) eventosPueblo.hablar(q.get("hablar") as "herrero");
    if (q.has("animar")) ui.animarRelicario(crearCarta(partida.azar, Math.floor(Math.random() * 12), Math.max(4, Math.min(11, Number(q.get("animar")) - 1))), false, () => undefined);
    // &x=N → parar al Portador en esa x de la calle (capturas del pueblo).
    if (q.has("x") && pueblo !== null) pueblo.jugador.colocar(Number(q.get("x")), 14 * 16 - pueblo.jugador.h);
    // &panel=taberna|mercader|armero|banco|altar|herrero|santuario|pozo abre ese servicio (capturas).
    const panel = q.get("panel");
    if (panel !== null) {
      partida.billetera.acreditar("esquirlas", 5000);
      eventosPueblo.abrirServicio(panel as "taberna");
    }
    if (q.has("inventario") && pueblo !== null) {
      const tab = (q.get("tab") ?? "equipo") as "equipo" | "cartas" | "habilidades" | "stats";
      const relic = [...partida.mochila.posiciones()].find((x) => partida?.mochila.en(x)?.objeto === OBJ_RELICARIO);
      ui.abrirInventario(pueblo, tab, tab === "cartas" ? (Number(q.get("sel") ?? 1) as 1) : q.has("relicarios") ? relic : undefined);
    }
    return;
  }

  // &cicatriz → el piso tiene la cicatriz de una caída (y vas directo a esa sala). &decision → diálogo del Eco vencido.
  if (q.has("cicatriz")) {
    meta.marcarCicatriz({
      piso: Number(q.get("piso") ?? 1), portador: "Lucía", asesino: { nombre: "Cráneo Saltarín", conducta: "caminante", elite: true, afijos: ["explosivo", "veloz"] },
      arma: "espada", colorArma: "#c8d0e0", almaTecnica: 3, fecha: Date.now(),
    });
  }
  descender(Number(q.get("piso") ?? 1), q.has("abismo"));
  if (q.has("cicatriz") && juego !== null) juego.depurarCicatriz();
  // &peso=N → Peso del Eco.
  if (q.has("peso") && partida !== null) partida.pesoEco = Number(q.get("peso"));
  if (q.has("batalla") && juego !== null) juego.depurarBatalla();
  if (q.has("decision") && juego !== null) juego.depurarDecisionEco();
  if (q.has("cargada") && partida !== null) partida.cargaDefinitiva = 100;
  if (q.has("botin") && juego !== null) juego.depurarBotin();
  // &tiposala=arena|boveda|tesoro → primera sala de ese tipo del piso.
  const tipoSala = q.get("tiposala");
  if (tipoSala !== null && juego !== null) {
    const s = juego.mapa.salas.find((x) => x.tipo === tipoSala);
    if (s !== undefined) juego.depurarIr(Number(q.get("piso") ?? 1), s.id);
  }
  if (q.has("sala")) juego?.depurarIr(Number(q.get("piso") ?? 1), Number(q.get("sala") ?? 0));
  // &campana → abre el diálogo de la campana; &campana=normal|juicio → empieza el desafío directamente.
  if (q.has("campana") && juego !== null) {
    const modo = q.get("campana");
    juego.depurarCampana(modo === "normal" || modo === "juicio" ? modo : undefined);
  }
  if (q.has("patada") && juego !== null) juego.depurarPatada();
  if (q.has("jefe") && juego !== null) juego.depurarIr(Number(q.get("piso") ?? 1), juego.mapa.jefe);
  if (q.has("extraccion") && juego !== null) {
    juego.depurarIr(Number(q.get("piso") ?? 1), 0);
    const ex = juego.mapa.extracciones?.[0];
    if (ex !== undefined) juego.depurarIr(Number(q.get("piso") ?? 1), ex);
    const z = juego.zonaExtraccion;
    if (z !== null && q.has("dentro")) juego.jugador.colocar(z.x + 8, z.y + z.h - juego.jugador.h);
  }
});
if (!galeria) ui.mostrarTitulo();
requestAnimationFrame(cuadro);

