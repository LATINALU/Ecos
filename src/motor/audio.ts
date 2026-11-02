// Sonido sintetizado con WebAudio (sin archivos): efectos y un zumbido ambiental por bioma.

export type Sonido =
  | "salto" | "golpe" | "patada" | "impacto" | "critico" | "muerte" | "recoger" | "raro" | "unico"
  | "herido" | "tecnica" | "explosion" | "embestida" | "romper" | "nivel" | "puerta" | "jefe" | "cofre"
  | "reliquia" | "fusion" | "fallo" | "bloqueo" | "pocion";

export class Audio {
  private ctx: AudioContext | null = null;
  private maestro: GainNode | null = null;
  private ambiente: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  volumen = 0.5;

  /** Los navegadores exigen un gesto del usuario antes de sonar. */
  activar(): void {
    if (this.ctx !== null) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = this.volumen;
      this.maestro.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  cambiarVolumen(v: number): void {
    this.volumen = Math.max(0, Math.min(1, v));
    if (this.maestro !== null) this.maestro.gain.value = this.volumen;
  }

  private tono(freq: number, dur: number, tipo: OscillatorType, vol: number, freqFinal?: number, retraso = 0): void {
    if (this.ctx === null || this.maestro === null) return;
    const t = this.ctx.currentTime + retraso;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFinal !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqFinal), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.maestro);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private ruido(dur: number, vol: number, filtro = 1200, retraso = 0): void {
    if (this.ctx === null || this.maestro === null) return;
    const t = this.ctx.currentTime + retraso;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filtro;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.maestro);
    src.start(t);
  }

  reproducir(s: Sonido): void {
    switch (s) {
      case "salto": this.tono(280, 0.12, "square", 0.06, 520); break;
      case "golpe": this.ruido(0.07, 0.12, 2400); this.tono(180, 0.06, "triangle", 0.08, 90); break;
      case "patada": this.ruido(0.1, 0.16, 900); this.tono(120, 0.1, "triangle", 0.12, 60); break;
      case "impacto": this.ruido(0.08, 0.2, 1600); this.tono(90, 0.08, "square", 0.08, 50); break;
      case "critico": this.ruido(0.12, 0.25, 3000); this.tono(880, 0.12, "square", 0.07, 220); break;
      case "muerte": this.ruido(0.25, 0.2, 700); this.tono(200, 0.3, "sawtooth", 0.06, 40); break;
      case "recoger": this.tono(660, 0.07, "square", 0.05); this.tono(990, 0.09, "square", 0.05, undefined, 0.06); break;
      case "raro": [523, 659, 784, 1046].forEach((f, i) => this.tono(f, 0.14, "triangle", 0.07, undefined, i * 0.06)); break;
      case "unico": [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tono(f, 0.22, "sawtooth", 0.05, undefined, i * 0.07)); break;
      case "herido": this.tono(220, 0.18, "sawtooth", 0.12, 70); this.ruido(0.1, 0.15, 800); break;
      case "tecnica": this.tono(330, 0.25, "sawtooth", 0.07, 880); break;
      case "explosion": this.ruido(0.35, 0.3, 500); this.tono(80, 0.3, "sine", 0.2, 30); break;
      case "embestida": this.ruido(0.15, 0.1, 4000); this.tono(500, 0.12, "sine", 0.05, 200); break;
      case "romper": this.ruido(0.3, 0.25, 3500); [1200, 900, 1500].forEach((f, i) => this.tono(f, 0.1, "triangle", 0.05, undefined, i * 0.04)); break;
      case "nivel": [392, 494, 587, 784].forEach((f, i) => this.tono(f, 0.18, "square", 0.06, undefined, i * 0.08)); break;
      case "puerta": this.tono(110, 0.2, "sine", 0.08, 70); break;
      case "jefe": this.tono(55, 1.2, "sawtooth", 0.12, 40); this.tono(82, 1.2, "sawtooth", 0.08, 60); this.ruido(1, 0.1, 300); break;
      case "cofre": this.tono(300, 0.1, "square", 0.06, 600); this.tono(600, 0.25, "triangle", 0.06, 1200, 0.1); break;
      case "reliquia": [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => this.tono(f, 0.4, "triangle", 0.06, undefined, i * 0.1)); break;
      case "fusion": this.tono(200, 0.6, "sine", 0.1, 1200); this.ruido(0.5, 0.08, 2000, 0.3); break;
      case "fallo": this.tono(200, 0.15, "square", 0.06, 150); this.tono(150, 0.2, "square", 0.06, 100, 0.12); break;
      case "bloqueo": this.tono(1400, 0.06, "square", 0.06, 900); this.ruido(0.05, 0.1, 5000); break;
      case "pocion": this.tono(400, 0.3, "sine", 0.08, 900); break;
    }
  }

  /** Zumbido de fondo: dos osciladores graves desafinados, distinto por bioma. */
  ambientar(bioma: number): void {
    if (this.ctx === null || this.maestro === null) return;
    this.silenciarAmbiente();
    const bases = [55, 49, 41.2];
    const base = bases[Math.max(0, Math.min(bioma, bases.length - 1))];
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(this.maestro);
    const osc = [base, base * 1.503, base * 2.01].map((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = i * 7;
      o.connect(gain);
      o.start();
      return o;
    });
    this.ambiente = { osc, gain };
  }

  silenciarAmbiente(): void {
    if (this.ambiente === null) return;
    for (const o of this.ambiente.osc) o.stop();
    this.ambiente.gain.disconnect();
    this.ambiente = null;
  }
}
