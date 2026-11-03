// COMPOSITOR WebGL2: toma las 3 capas del Pintor Diferido (albedo, normales, emisivo) y en una sola pasada de GPU:
//
//   1. ONDA DE CHOQUE: curva el espacio alrededor de un punto (esquiva perfecta, romper guardia, pisotón, Definitiva).
//   2. ABERRACIÓN CROMÁTICA por TRAUMA: separa rojo y azul hacia los bordes (golpes fuertes, poca vida).
//   3. RELIEVE DE LUCES: hasta 32 luces iluminan los píxeles INCLINADOS del mapa de normales (difusa + especular).
//      Lo plano no cambia: la oscuridad, las sombras duras y el color ya los resolvió el juego en 2D; aquí se suma
//      el volumen (cantos de roca, eslabones de cadena, metal que destella).
//   4. BLOOM de la capa emisiva (9 muestras en cruz a dos distancias).
//   5. DESTELLO de impacto y viñeta que se cierra con el trauma.
//
// Sin dependencias y sin basura por cuadro: los datos de las luces van en Float32Array preasignados.

export interface LuzCompositor {
  /** Píxeles de PANTALLA (0..480, 0..270). */
  readonly x: number;
  readonly y: number;
  readonly radio: number;
  /** RGB 0..1. */
  readonly color: readonly [number, number, number];
  readonly fuerza: number;
}

const VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 color;

uniform sampler2D u_albedo;
uniform sampler2D u_normales;
uniform sampler2D u_emisivo;
uniform vec2 u_res;

#define MAX_LUCES 32
uniform int u_numLuces;
uniform vec3 u_lucesPos[MAX_LUCES];   // x, y en píxeles; z = radio
uniform vec4 u_lucesColor[MAX_LUCES]; // rgb y fuerza

uniform vec3 u_onda;     // x, y (uv), progreso 0..1
uniform float u_trauma;  // 0..1
uniform float u_destello;
uniform float u_relieve; // intensidad global del relieve

void main() {
  vec2 uv = v_uv;
  float aspecto = u_res.x / u_res.y;

  // 1. Onda de choque
  if (u_onda.z > 0.0 && u_onda.z < 1.0) {
    vec2 d = uv - u_onda.xy;
    d.x *= aspecto;
    float dist = length(d);
    float r = u_onda.z * 0.6;
    float grosor = 0.05;
    float m = smoothstep(r - grosor, r, dist) * smoothstep(r + grosor, r, dist);
    vec2 dn = dist > 0.0001 ? normalize(d) : vec2(0.0);
    dn.x /= aspecto;
    uv += dn * m * 0.035 * (1.0 - u_onda.z);
  }

  // 2. Aberración cromática
  float s = u_trauma * 0.008 * length(uv - 0.5);
  vec3 alb;
  alb.r = texture(u_albedo, uv + vec2(s, 0.0)).r;
  alb.g = texture(u_albedo, uv).g;
  alb.b = texture(u_albedo, uv - vec2(s, 0.0)).b;

  // 3. Relieve: solo los píxeles inclinados reaccionan a las luces
  vec3 n = texture(u_normales, uv).rgb * 2.0 - 1.0;
  n.y = -n.y; // en pantalla Y crece hacia abajo
  float inclinacion = clamp(length(n.xy) * 1.4, 0.0, 1.0);
  vec3 relieve = vec3(0.0);
  vec2 p = uv * u_res;
  if (inclinacion > 0.05) {
    vec3 nn = normalize(n);
    for (int i = 0; i < MAX_LUCES; i++) {
      if (i >= u_numLuces) break;
      vec2 d = u_lucesPos[i].xy - p;
      float dist = length(d);
      float radio = u_lucesPos[i].z;
      if (dist >= radio) continue;
      vec3 L = normalize(vec3(d, radio * 0.25));
      float difusa = max(dot(nn.xy, normalize(d + 0.0001)), 0.0) * inclinacion;
      float especular = pow(max(dot(nn, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 24.0) * 0.5 * inclinacion;
      float aten = pow(1.0 - dist / radio, 2.0);
      relieve += u_lucesColor[i].rgb * (difusa * 0.9 + especular) * aten * u_lucesColor[i].a;
    }
    relieve *= u_relieve;
  }

  // 4. Bloom del emisivo
  // El emisivo llega ya difuminado (bloom) desde el Pintor: aquí solo se suaviza un píxel.
  vec2 t = 1.0 / u_res;
  vec3 e = texture(u_emisivo, uv).rgb * 0.6
    + (texture(u_emisivo, uv + vec2(t.x, 0.0)).rgb + texture(u_emisivo, uv - vec2(t.x, 0.0)).rgb
     + texture(u_emisivo, uv + vec2(0.0, t.y)).rgb + texture(u_emisivo, uv - vec2(0.0, t.y)).rgb) * 0.1;

  // 5. Composición, destello y viñeta del trauma
  vec3 c = alb * (1.0 + relieve) + relieve * 0.3 + e * 1.15;
  c = mix(c, vec3(1.0), u_destello * 0.35);
  float vin = 1.0 - smoothstep(0.42, 0.9, length(v_uv - 0.5));
  c *= mix(1.0 - u_trauma * 0.45, 1.0, vin);
  color = vec4(c, 1.0);
}`;

export class CompositorWebGL {
  private readonly gl: WebGL2RenderingContext;
  private readonly programa: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly texturas: WebGLTexture[];
  private readonly loc: Record<string, WebGLUniformLocation | null>;
  private readonly maxLuces = 32;
  private readonly pos = new Float32Array(32 * 3);
  private readonly col = new Float32Array(32 * 4);
  private numLuces = 0;
  private onda: [number, number, number] = [0.5, 0.5, 0];
  private velocidadOnda = 2.2;
  private trauma = 0;
  /** Trauma que no baja de este valor (vida crítica). */
  traumaMinimo = 0;
  private destello = 0;
  /** Intensidad global del relieve (0 lo apaga). */
  relieve = 1;

  constructor(lienzo: HTMLCanvasElement, private readonly ancho = 480, private readonly alto = 270) {
    const gl = lienzo.getContext("webgl2", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (gl === null) throw new Error("WebGL2 no disponible");
    this.gl = gl;
    this.programa = this.crearPrograma(VS, FS);
    this.vao = this.crearQuad();
    this.texturas = [0, 1, 2].map((u) => this.crearTextura(u));
    // El color de los lienzos 2D llega premultiplicado por su alfa: así el halo del bloom se desvanece en vez de
    // verse como un disco sólido (sin esto el navegador "des-premultiplica" y los bordes tenues salen a pleno brillo).
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.useProgram(this.programa);
    gl.uniform1i(gl.getUniformLocation(this.programa, "u_albedo"), 0);
    gl.uniform1i(gl.getUniformLocation(this.programa, "u_normales"), 1);
    gl.uniform1i(gl.getUniformLocation(this.programa, "u_emisivo"), 2);
    this.loc = Object.fromEntries(["u_res", "u_numLuces", "u_lucesPos", "u_lucesColor", "u_onda", "u_trauma", "u_destello", "u_relieve"]
      .map((n) => [n, gl.getUniformLocation(this.programa, n)]));
    gl.uniform2f(this.loc.u_res, ancho, alto);
  }

  iniciarCuadro(): void {
    this.numLuces = 0;
  }

  agregarLuz(l: LuzCompositor): void {
    if (this.numLuces >= this.maxLuces) return;
    const i = this.numLuces++;
    this.pos[i * 3] = l.x;
    this.pos[i * 3 + 1] = l.y;
    this.pos[i * 3 + 2] = l.radio;
    this.col[i * 4] = l.color[0];
    this.col[i * 4 + 1] = l.color[1];
    this.col[i * 4 + 2] = l.color[2];
    this.col[i * 4 + 3] = l.fuerza;
  }

  /** Onda expansiva centrada en (x, y) de pantalla. */
  ondaDeChoque(x: number, y: number, velocidad = 2.2): void {
    this.onda = [x / this.ancho, y / this.alto, 0.01];
    this.velocidadOnda = velocidad;
  }

  agregarTrauma(cantidad: number, destello = 0): void {
    this.trauma = Math.min(1, this.trauma + cantidad);
    this.destello = Math.min(1, Math.max(this.destello, destello));
  }

  renderizar(dt: number, albedo: TexImageSource, normales: TexImageSource, emisivo: TexImageSource): void {
    if (this.onda[2] > 0) {
      this.onda[2] += dt * this.velocidadOnda;
      if (this.onda[2] >= 1) this.onda[2] = 0;
    }
    this.trauma = Math.max(this.traumaMinimo, this.trauma - dt * 1.6);
    this.destello = Math.max(0, this.destello - dt * 7);
    const gl = this.gl;
    gl.viewport(0, 0, this.ancho, this.alto);
    gl.useProgram(this.programa);
    [albedo, normales, emisivo].forEach((fuente, u) => {
      gl.activeTexture(gl.TEXTURE0 + u);
      gl.bindTexture(gl.TEXTURE_2D, this.texturas[u]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
    });
    gl.uniform1i(this.loc.u_numLuces, this.numLuces);
    if (this.numLuces > 0) {
      gl.uniform3fv(this.loc.u_lucesPos, this.pos, 0, this.numLuces * 3);
      gl.uniform4fv(this.loc.u_lucesColor, this.col, 0, this.numLuces * 4);
    }
    gl.uniform3f(this.loc.u_onda, this.onda[0], this.onda[1], this.onda[2]);
    gl.uniform1f(this.loc.u_trauma, this.trauma * this.trauma);
    gl.uniform1f(this.loc.u_destello, this.destello);
    gl.uniform1f(this.loc.u_relieve, this.relieve);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private crearTextura(unidad: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unidad);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.ancho, this.alto, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  private crearQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private crearPrograma(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compilar(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.compilar(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Programa WebGL2: ${gl.getProgramInfoLog(p) ?? ""}`);
    return p;
  }

  private compilar(tipo: number, codigo: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(tipo)!;
    gl.shaderSource(s, codigo);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Shader: ${gl.getShaderInfoLog(s) ?? ""}`);
    return s;
  }
}
