// Música por capas (stems) sintetizada en tiempo real, reactiva al medidor de estilo.
//
//   Capa          | Suena desde | Qué es
//   --------------|-------------|------------------------------------------------------------------
//   Percusión     | siempre     | bombo, charles y caja procesados (ruido filtrado)
//   Bajo          | siempre     | línea grave en la escala de la zona
//   Melodía       | rango A     | arpegio/melodía con la escala menor de la zona
//   Coro          | rango S     | acordes de "voces" (diente de sierra por filtros de formantes)
//   Guitarra      | rango SS    | riff distorsionado (onda cuadrada saturada con waveshaper)
//
// Cada capa tiene su propia ganancia; al cambiar de rango se funden suavemente. Un planificador con
// anticipación ("lookahead") agenda las notas en el reloj de WebAudio, así el ritmo no depende de los cuadros.
// Al llegar a S, SS y SSS, un SUSURRO DEL POZO anuncia el rango (voz del navegador, grave y lenta, más un
// soplo de ruido filtrado).

type Capa = "percusion" | "bajo" | "melodia" | "coro" | "guitarra";

/** Escalas (semitonos) y tónica por zona: cada bioma suena distinto. */
const TONICAS = [45, 43, 40, 47, 42, 44, 41, 39, 46, 38]; // MIDI
const ESCALA_MENOR = [0, 2, 3, 5, 7, 8, 10];
const ESCALA_FRIGIA = [0, 1, 3, 5, 7, 8, 10];

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class Musica {
  private readonly ctx: AudioContext;
  private readonly salida: GainNode;
  private readonly capas: Record<Capa, GainNode>;
  private reloj: number | null = null;
  private paso = 0;
  private siguiente = 0;
  private bioma = 0;
  private nivel = -1;
  private tempo = 104;
  private tension = false;
  private ruidoBuf: AudioBuffer | null = null;
  private readonly distorsion: WaveShaperNode;

  constructor(ctx: AudioContext, destino: AudioNode) {
    this.ctx = ctx;
    this.salida = ctx.createGain();
    this.salida.gain.value = 0.55;
    this.salida.connect(destino);
    const capa = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.salida);
      return g;
    };
    this.capas = { percusion: capa(0.9), bajo: capa(0.8), melodia: capa(0), coro: capa(0), guitarra: capa(0) };
    this.distorsion = ctx.createWaveShaper();
    const curva = new Float32Array(1024);
    for (let i = 0; i < curva.length; i++) {
      const x = (i / (curva.length - 1)) * 2 - 1;
      curva[i] = Math.tanh(x * 6);
    }
    this.distorsion.curve = curva;
    const filtroGuit = ctx.createBiquadFilter();
    filtroGuit.type = "lowpass";
    filtroGuit.frequency.value = 2400;
    this.distorsion.connect(filtroGuit).connect(this.capas.guitarra);
  }

  iniciar(bioma: number): void {
    this.bioma = Math.max(0, bioma) % TONICAS.length;
    this.detener();
    this.paso = 0;
    this.siguiente = this.ctx.currentTime + 0.1;
    this.reloj = window.setInterval(() => this.planificar(), 25);
    this.intensidad(0, true);
  }

  detener(): void {
    if (this.reloj !== null) window.clearInterval(this.reloj);
    this.reloj = null;
  }

  /**
   * Rango de estilo (0 = D … 6 = SSS) → qué capas suenan. Devuelve true si cambió el escalón musical.
   * `inmediato`: sin fundido (al empezar).
   */
  /** Extracción en curso: el tempo se acelera y entran todas las capas. */
  tensar(on: boolean): void {
    if (this.tension === on) return;
    this.tension = on;
    this.tempo = on ? 148 : 104;
    this.nivel = -1;
  }

  intensidad(rango: number, inmediato = false): boolean {
    const nivel = this.tension ? 3 : rango >= 5 ? 3 : rango >= 4 ? 2 : rango >= 3 ? 1 : 0;
    if (nivel === this.nivel && !inmediato) return false;
    this.nivel = nivel;
    const t = this.ctx.currentTime;
    const fundir = (c: Capa, v: number): void => {
      const g = this.capas[c].gain;
      g.cancelScheduledValues(t);
      if (inmediato) g.setValueAtTime(v, t);
      else g.setTargetAtTime(v, t, 0.6);
    };
    fundir("percusion", 0.9);
    fundir("bajo", 0.8);
    fundir("melodia", nivel >= 1 ? 0.55 : 0);
    fundir("coro", nivel >= 2 ? 0.35 : 0);
    fundir("guitarra", nivel >= 3 ? 0.22 : 0);
    return true;
  }

  // ---------------- Planificador ----------------

  private planificar(): void {
    const dur16 = 60 / this.tempo / 4;
    while (this.siguiente < this.ctx.currentTime + 0.12) {
      this.tocarPaso(this.paso, this.siguiente, dur16);
      this.siguiente += dur16;
      this.paso = (this.paso + 1) % 64;
    }
  }

  private tocarPaso(p: number, t: number, d: number): void {
    const s = p % 16;
    const compas = Math.floor(p / 16);
    const tonica = TONICAS[this.bioma];
    const escala = this.bioma % 3 === 1 ? ESCALA_FRIGIA : ESCALA_MENOR;
    const grado = (n: number, oct = 0): number => tonica + escala[((n % 7) + 7) % 7] + 12 * (oct + Math.floor(n / 7));
    // Progresión de 4 compases: i – VI – iv – v (grados 0, 5, 3, 4)
    const raiz = [0, 5, 3, 4][compas];
    const intenso = this.nivel >= 2;

    // Percusión
    if (s % 8 === 0 || (intenso && s === 10)) this.bombo(t);
    if (s === 4 || s === 12) this.caja(t);
    if (s % 2 === 0 || intenso) this.charles(t, s % 4 === 2 ? 0.12 : 0.06);

    // Bajo: negras en la raíz, con la quinta en los contratiempos
    if (s % 4 === 0) this.nota(this.capas.bajo, midi(grado(raiz) - 12), t, d * 3.2, "triangle", 0.5);
    if (s === 14) this.nota(this.capas.bajo, midi(grado(raiz + 4) - 12), t, d * 1.5, "triangle", 0.35);

    // Melodía: arpegio del acorde con un motivo que cambia cada dos compases
    if (this.nivel >= 1 && s % 2 === 0) {
      const motivo = compas % 2 === 0 ? [0, 2, 4, 2, 4, 6, 4, 2] : [0, 4, 2, 6, 4, 2, 0, 2];
      this.nota(this.capas.melodia, midi(grado(raiz + motivo[s / 2], 1)), t, d * 1.8, "square", 0.12);
    }

    // Coro: acorde largo en cada compás (raíz, tercera y quinta) por formantes
    if (this.nivel >= 2 && s === 0) {
      for (const k of [0, 2, 4]) this.voz(midi(grado(raiz + k, 1)), t, d * 15);
    }

    // Guitarra: riff galopante en la raíz
    if (this.nivel >= 3 && (s % 4 === 0 || s % 4 === 3 || s % 4 === 1)) {
      const n = s % 8 === 7 ? grado(raiz + 1) : grado(raiz);
      this.nota(this.distorsion, midi(n), t, d * 0.9, "square", 0.25);
      this.nota(this.distorsion, midi(n + 7), t, d * 0.9, "square", 0.18);
    }
  }

  // ---------------- Instrumentos ----------------

  private nota(destino: AudioNode, f: number, t: number, dur: number, tipo: OscillatorType, vol: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(destino);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private voz(f: number, t: number, dur: number): void {
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 14;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.35);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.3);
    // Formantes de una "a" abierta
    for (const [fr, q, v] of [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.25]] as const) {
      const b = this.ctx.createBiquadFilter();
      b.type = "bandpass";
      b.frequency.value = fr;
      b.Q.value = q;
      const gv = this.ctx.createGain();
      gv.gain.value = v;
      o.connect(b).connect(gv).connect(g);
    }
    g.connect(this.capas.coro);
    o.start(t);
    o.stop(t + dur + 1.5);
  }

  private ruido(): AudioBuffer {
    if (this.ruidoBuf === null) {
      const n = this.ctx.sampleRate;
      this.ruidoBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.ruidoBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.ruidoBuf;
  }

  private golpeRuido(t: number, dur: number, tipo: BiquadFilterType, freq: number, vol: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.ruido();
    const f = this.ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.capas.percusion);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private bombo(t: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.capas.percusion);
    o.start(t);
    o.stop(t + 0.3);
  }

  private caja(t: number): void {
    this.golpeRuido(t, 0.16, "bandpass", 1800, 0.35);
  }

  private charles(t: number, vol: number): void {
    this.golpeRuido(t, 0.04, "highpass", 7000, vol);
  }

  // ---------------- Susurro del Pozo ----------------

  /** El Pozo susurra el nombre del rango (S, SS, SSS). */
  susurrar(texto: string, destino: AudioNode): void {
    // Soplo: ruido filtrado que crece y se apaga.
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.ruido();
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(f).connect(g).connect(destino);
    src.start(t);
    src.stop(t + 1);
    // Voz: la del sistema, lenta y grave, como un susurro (si el navegador la ofrece).
    try {
      if (typeof speechSynthesis === "undefined") return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      const voces = speechSynthesis.getVoices();
      const es = voces.find((v) => v.lang.startsWith("es"));
      if (es !== undefined) u.voice = es;
      u.lang = es?.lang ?? "es-ES";
      u.rate = 0.75;
      u.pitch = 0.2;
      u.volume = 0.7;
      speechSynthesis.speak(u);
    } catch {
      // Sin voz: queda el soplo.
    }
  }
}
