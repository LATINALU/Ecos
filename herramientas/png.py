"""PNG mínimo en Python puro: leer (RGBA/RGB/paleta, 8 bits, sin entrelazado) y escribir RGBA."""
import struct
import zlib


def leer(ruta):
    b = open(ruta, "rb").read()
    assert b[:8] == b"\x89PNG\r\n\x1a\n"
    i = 8
    datos = b""
    pal = None
    trns = None
    while i < len(b):
        n = struct.unpack(">I", b[i:i + 4])[0]
        tipo = b[i + 4:i + 8]
        c = b[i + 8:i + 8 + n]
        if tipo == b"IHDR":
            w, h, prof, color, _, _, inter = struct.unpack(">IIBBBBB", c)
        elif tipo == b"PLTE":
            pal = [tuple(c[k:k + 3]) for k in range(0, n, 3)]
        elif tipo == b"tRNS":
            trns = c
        elif tipo == b"IDAT":
            datos += c
        i += 12 + n
    assert prof == 8 and inter == 0, (prof, inter)
    canales = {6: 4, 2: 3, 3: 1, 0: 1, 4: 2}[color]
    crudo = zlib.decompress(datos)
    stride = w * canales
    filas = []
    prev = bytearray(stride)
    p = 0
    for _ in range(h):
        f = crudo[p]
        lin = bytearray(crudo[p + 1:p + 1 + stride])
        p += 1 + stride
        for x in range(stride):
            a = lin[x - canales] if x >= canales else 0
            up = prev[x]
            c = prev[x - canales] if x >= canales else 0
            if f == 1:
                lin[x] = (lin[x] + a) & 255
            elif f == 2:
                lin[x] = (lin[x] + up) & 255
            elif f == 3:
                lin[x] = (lin[x] + (a + up) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(up - c), abs(a - c), abs(a + up - 2 * c)
                pr = a if pa <= pb and pa <= pc else up if pb <= pc else c
                lin[x] = (lin[x] + pr) & 255
        filas.append(lin)
        prev = lin
    px = []
    for lin in filas:
        fila = []
        for x in range(w):
            if color == 6:
                fila.append(tuple(lin[x * 4:x * 4 + 4]))
            elif color == 2:
                fila.append(tuple(lin[x * 3:x * 3 + 3]) + (255,))
            elif color == 3:
                k = lin[x]
                al = trns[k] if trns is not None and k < len(trns) else 255
                fila.append(pal[k] + (al,))
            elif color == 4:
                fila.append((lin[x * 2],) * 3 + (lin[x * 2 + 1],))
            else:
                fila.append((lin[x],) * 3 + (255,))
        px.append(fila)
    return w, h, px


def escribir(ruta, w, h, px):
    crudo = b"".join(b"\x00" + bytes(v for p in fila for v in p) for fila in px)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(ruta, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(crudo, 9)) + chunk(b"IEND", b""))


def recorte(px, x, y, w, h, escala=1, fondo=None):
    out = []
    for yy in range(y, y + h):
        fila = []
        for xx in range(x, x + w):
            p = px[yy][xx]
            if fondo is not None and p[3] == 0:
                p = fondo
            fila.extend([p] * escala)
        for _ in range(escala):
            out.append(list(fila))
    return out
