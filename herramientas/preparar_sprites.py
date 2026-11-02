"""Prepara los sprites de terceros para el juego (ver recursos/CREDITOS.md).

    python -I herramientas/preparar_sprites.py

Lee recursos/extraido/ y escribe:
  public/sprites/castillo.png      atlas del Generic Dungeon Pack (Anokolisa / Vaca Roxa, CC0)
  public/sprites/criaturas.png     personajes de microFantasy (0x72, CC0), sin recortar
  public/sprites/iconos.png        íconos de objetos de microFantasy, en celdas de 16×16
  src/contenido/sprites.generado.ts  rectángulos de animación (con pies y centro) e índice de íconos

Solo usa la biblioteca estándar (png.py es un lector/escritor PNG mínimo).
"""
import json
import os
import shutil
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "herramientas"))
import png  # noqa: E402

EXTRAIDO = os.path.join(RAIZ, "recursos", "extraido")
CASTILLO = os.path.join(EXTRAIDO, "generic-dungeon", "Final", "Assets", "Assets.png")
MF = os.path.join(EXTRAIDO, "microfantasy", "microFantasy.v0.4")
SALIDA = os.path.join(RAIZ, "public", "sprites")
TS = os.path.join(RAIZ, "src", "contenido", "sprites.generado.ts")

# Personajes de microFantasy que usamos como monstruos.
ANIMACIONES = [
    "lizard_idle", "lizard_run", "lizard_attack",
    "dwarf_idle", "dwarf_run", "dwarf_attack",
    "troll_idle", "troll_run", "troll_attack",
    "wizard_idle", "wizard_attack",
    "rhino_idle", "rhino_run", "rhino_attack",
    "mooseman_idle", "mooseman_run", "mooseman_attack",
]

ICONOS = [
    "sword", "big_axe", "magic_staff", "cleaver", "anime_sword", "halberd", "spear", "staff", "axe",
    "shield_blue", "shield_red", "shield_green", "shield_yellow",
    "potion_red", "potion_blue", "potion_green", "potion_yellow",
    "key_gold", "key_silver",
]


def main():
    os.makedirs(SALIDA, exist_ok=True)
    shutil.copyfile(CASTILLO, os.path.join(SALIDA, "castillo.png"))

    # --- Criaturas: copiar la hoja sin recortar y medir cada cuadro (dónde están los pies y el centro).
    hoja = os.path.join(MF, "characters", "all_no_trim.png")
    shutil.copyfile(hoja, os.path.join(SALIDA, "criaturas.png"))
    _, _, px = png.leer(hoja)
    datos = json.load(open(os.path.join(MF, "characters", "all_no_trim.json"), encoding="utf-8"))
    anims = {}
    for nombre in ANIMACIONES:
        cuadros = []
        for f in datos[nombre]["frames"]:
            x, y, w, h = f["x"], f["y"], f["w"], f["h"]
            opacos = [(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w) if px[yy][xx][3] > 0]
            pie = max(yy for _, yy in opacos) - y + 1
            xs = [xx for xx, _ in opacos]
            centro = round((min(xs) + max(xs) + 1) / 2 - x)
            cuadros.append([x, y, w, h, f["duration"], pie, centro])
        anims[nombre] = cuadros

    # --- Íconos: cada uno centrado abajo en una celda de 16×16.
    celdas = []
    for nombre in ICONOS:
        w, h, ipx = png.leer(os.path.join(MF, "items", nombre + ".png"))
        celda = [[(0, 0, 0, 0)] * 16 for _ in range(16)]
        ox = (16 - w) // 2
        oy = 16 - h if h <= 16 else 0
        for yy in range(min(h, 16)):
            for xx in range(min(w, 16)):
                celda[oy + yy][ox + xx] = ipx[yy][xx]
        celdas.append(celda)
    ancho = 16 * len(celdas)
    atlas = [[p for c in celdas for p in c[fila]] for fila in range(16)]
    png.escribir(os.path.join(SALIDA, "iconos.png"), ancho, 16, atlas)

    with open(TS, "w", encoding="utf-8") as f:
        f.write("// GENERADO por herramientas/preparar_sprites.py — no editar a mano.\n")
        f.write("// Cuadro: [x, y, ancho, alto, duraciónMs, pie (fila de los pies), centro (x del cuerpo)].\n\n")
        f.write("export type CuadroSprite = readonly [number, number, number, number, number, number, number];\n\n")
        f.write("export const ANIMACIONES_CRIATURAS: Readonly<Record<string, readonly CuadroSprite[]>> = ")
        f.write(json.dumps(anims, separators=(",", ":")))
        f.write(";\n\n/** Índice de cada ícono en public/sprites/iconos.png (celdas de 16×16). */\n")
        f.write("export const ICONOS: Readonly<Record<string, number>> = ")
        f.write(json.dumps({n: i for i, n in enumerate(ICONOS)}))
        f.write(";\n")
    print("OK:", len(anims), "animaciones,", len(ICONOS), "íconos ->", SALIDA)


if __name__ == "__main__":
    main()
