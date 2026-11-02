// Mini constructor de DOM (sin framework): h("div", { class: "x", onclick }, hijos...)

type Hijo = Node | string | number | null | undefined | false;
type Atributos = Record<string, string | number | boolean | ((ev: MouseEvent) => void) | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Atributos = {}, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      e.addEventListener(k.slice(2), v as EventListener);
    } else if (k === "style" && typeof v === "string") {
      e.setAttribute("style", v);
    } else if (v === true) {
      e.setAttribute(k, "");
    } else {
      e.setAttribute(k, String(v));
    }
  }
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    e.append(hijo instanceof Node ? hijo : String(hijo));
  }
  return e;
}

export function limpiar(e: HTMLElement): void {
  while (e.firstChild !== null) e.removeChild(e.firstChild);
}
