# ECOS — El Pozo que Recuerda

Metroidvania roguelike de plataformas en pixel art (todo dibujado por código), construido sobre las mecánicas de
[`minialu`](../minialu) (la librería sacada de MiniFighter).

> Cada guerrero que cae en el Pozo deja un eco. Cuando mueras, tu **Eco** te esperará en el piso donde caíste,
> con tu Forma, tus stats y tu mejor pieza de equipo. Véncelo para recuperarla. El jefe final, **El Que Recuerda**,
> pelea con las técnicas de todos tus Ecos.

## Jugar

ECOS usa la librería [minialu](https://github.com/LATINALU/minialu) directamente desde el código fuente, así que
las dos carpetas tienen que estar una al lado de la otra:

```bash
git clone https://github.com/LATINALU/minialu.git
git clone https://github.com/LATINALU/Ecos.git
cd Ecos
npm install
npm run dev        # http://localhost:5173
npm test           # 26 pruebas (dominio, progresión, crafteo, guardado y física)
npm run build      # tsc + vite build
```

Requiere la carpeta hermana `Desktop\minialu` (alias `minialu` en `vite.config.ts` y `tsconfig.json`).

## Sistemas

| Sistema | Qué hace | De minialu |
|---|---|---|
| Cartas de Alma | 8 almas en 4 familias, 1★–7★. **Forma** (100 % de stats + técnica) y 2 **Resonancias** (35 %, 50 % si es la misma familia) | `generarStats`, `tirarRareza`, `fusionar`, `mejorar` |
| Altar | Fusión 3→1 con probabilidad por estrella, Lágrima de Eco = éxito seguro; mejora con Polvo de Eco | cartas |
| Stats por capas | Base + nivel + Santuario + Forma + Resonancias + equipo, con desglose en el menú | `componerStats` |
| Botín | Monstruos "cada-uno", cofres "ponderado", jefes con único garantizado; haz de luz por rareza | `tirarDrop`, `probabilidadReal` |
| Equipo | 5 rarezas con afijos al azar + **8 únicos** con efectos (Filo Gemelo, Sangre de Vidrio, Manto del Eco…) | — |
| Inventario | Mochila y mazo de 24 casillas, todo o nada | `Inventario` |
| Mercader | Catálogo único + compra; desguace de equipo por esquirlas | `Catalogo`, `comprar`, `Billetera` |
| Niveles | Curva de EXP por partida; subir cura | `curvaPolinomica` |
| Mundo | Pisos generados con **llave y cerradura**: barreras de cristal/raíces y pozos verticales, validados con un punto fijo para que el jefe siempre se pueda alcanzar | `AzarSemilla` |
| Reliquias (permanentes) | Embestida (rompe cristales), Alas de Ceniza (doble salto, sube pozos), Garra Ígnea (quema raíces y enemigos) | — |
| Santuario | Mejoras permanentes pagadas con esencia | `Billetera` |
| Ecos | Al morir: Eco con tu legado; uno por piso, máximo 3 | — |

Pisos: **Osario Hundido** (Guardián del Osario) → **Bosque Micelio** (Madre Micelio) → **Forja Ahogada** (El Que Recuerda).

## Progresión del Portador

- **Arma inicial y estilo:** Espada (combo de 3), Puños (4 golpes rápidos), Martillo (2 golpes que aturden) o Bastón
  (técnicas +25 % y −20 % de costo). Cualquier arma que equipes cambia tu estilo.
- **Alma inicial:** se elige entre las almas que ya conociste. Cada alma tiene técnica y **pasiva** propia.
- **Habilidades:** 3 puntos de stats por nivel (minialu `PuntosHabilidad`) + 1 punto de talento por nivel.
  Talentos en 3 sendas: Filo (Remate, Corte Final, Sed de Sangre), Vendaval (Salto de Pared, Ligereza, Doble Embestida)
  y Eco (Eco de Técnica, Resonancia Profunda, Golpe de Éter).
- **Golpe ascendente:** ↑ + golpe lanza a los enemigos al aire.
- **Yunque** (sala del Faro de cada piso): recetas con materiales de cada bioma + Fragmentos de Eco; forja equipo y
  refina lo equipado (+12 % por nivel, hasta +5). Todo o nada, como en minialu.
- **Guardado:** el descenso en curso se guarda al cambiar de sala, al entrar a un piso y al cerrar la pestaña.
  "Continuar descenso" en el título. Morir o ganar borra el guardado.

## Gráficos

- **Escenario:** tileset del *Generic Dungeon Pack* (Anokolisa / Vaca Roxa, CC0), teñido por bioma (violeta, verde, brasa):
  muros con bordes, losas con soporte de madera, pinchos, cadenas, faroles, estandartes, ventanas góticas y cofres animados.
- **Monstruos:** personajes animados de *microFantasy* (0x72, CC0): lagarto (caminante), rinoceronte (saltador),
  troll (escudero) y mago (torreta). Los voladores, los jefes, los Ecos y **el Portador siguen siendo procedurales**
  (el Portador cambia de colores según su Forma).
- **Íconos** de armas, armaduras, pociones y fragmentos en el botín y en la mochila.
- **Respaldo:** si una imagen no carga, se dibuja el arte procedural. En pausa se puede alternar "sprites / clásicos".
- Origen y licencias: `recursos/CREDITOS.md`. Para regenerar `public/sprites/` y `src/contenido/sprites.generado.ts`:
  `python -I herramientas/preparar_sprites.py` (solo biblioteca estándar).
- Desarrollo: `?auto=espada&piso=2&sala=3` empieza una partida y salta a esa sala (solo en `npm run dev`).

## Arquitectura

```
src/
  dominio/     puro y testeado: cartas, equipo, botín, eco, meta, partida, stats, mundo/ (generador, salas)
  contenido/   datos: almas, objetos y únicos, biomas y jefes, plantillas de salas
  motor/       entrada, física por tiles, audio sintetizado (WebAudio)
  juego/       escena (Juego implementa Contexto), entidades (jugador, enemigos, jefes, Eco), render y efectos
  ui/          HUD en canvas y menús en DOM
  infra/       guardado de la progresión en localStorage
```

## Controles

A/D moverse · Espacio saltar (↓+salto baja de plataformas) · J golpe (combo ×3) · K patada (rompe guardias; ↓ en el
aire = pisotón con rebote) · L técnica · Shift embestida · E interactuar · Q/R pociones · I inventario/habilidades · M mapa · Esc pausa (guardar y salir). ↑ + J: golpe ascendente.
