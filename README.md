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

## Partidas y pueblo

- **3 ranuras de partida**. Cada una tiene su personaje persistente (nivel, equipo, mochila, cartas, talentos,
  misiones), su banco y su mundo (reliquias, esencia, ecos). El guardado viejo se migra solo a la ranura 1.
- **Último Refugio**, el pueblo sobre el Pozo: una calle de dos pantallas que se recorre con el Portador.
  | Edificio | Comerciante | Qué hace |
  |---|---|---|
  | Taberna «El Último Eco» | Ilse | Tablón de misiones (cadena de 15 + encargos repetibles) y memorial |
  | Bazar del Pozo | Tobías | Comprar consumibles y materiales; vender objetos, runas y cartas |
  | Armería Hierro Viejo | Brunhild | 6 piezas al azar que cambian en cada vuelta; kit de recluta gratis si no tienes arma |
  | Bóveda de los Caídos | Custodio Vael | Banco: 60 casillas y esquirlas a salvo de la muerte |
  | Altar de las Almas | Hermana Ceniza | Fusión y mejora de cartas |
  | Fragua del Pueblo | Dorn | Yunque: recetas y refinado |
  | Santuario | El Ermitaño | Mejoras permanentes con esencia |
  | El Pozo | — | Bajar desde cualquier piso con guardián vencido; contenedor seguro de 4 casillas |
- **Extracción (estilo Tarkov)**: no se vuelve gratis. Cada piso tiene 1~2 **zonas de extracción** (rombo verde en
  el mapa, conocidas desde el principio): hay que aguantar **5 s** dentro y cualquier golpe reinicia la cuenta. El
  portal del guardián también ofrece «Extraer» o «Seguir bajando (arriesgar)». El Faro solo deja descansar.
- **Morir = perderlo todo lo que llevas encima**: equipo equipado, mochila, subarma y esquirlas. Se salvan el
  **contenedor seguro** (4 casillas), las cartas, el nivel, los talentos, las runas y el banco. Tu **Eco** se queda
  en ese piso con todo el botín: vencerlo te lo devuelve entero; si vuelves a caer en ese piso antes, el Eco nuevo
  reemplaza al viejo y aquel botín se pierde. El HUD muestra el valor **en riesgo**.
- **Equipo completo (12 ranuras)**: arma · casco · hombros · pecho · cinturón · pantalones · botas (las 6 de
  **set**) · **capa** · 2 anillos · aretes · collar (accesorios de **stats únicos**: siempre traen un rasgo propio).
  | Accesorio | Rasgos únicos |
  |---|---|
  | Capa | Esquiva (hasta 30 %), reducción de daño recibido |
  | Anillos | Robo de vida, daño elemental |
  | Aretes | Éter por golpe, éter máximo, daño de técnica |
  | Collar | Robo de vida, éter máximo, reducción de daño recibido |
- **Armas elementales**: cualquier estilo (espada, mazo, arco, báculo, puños) puede salir de **Fuego** (quema),
  **Hielo** (ralentiza; 4 golpes congelan), **Veneno** (dosis acumulables) o **Rayo** (salta a 2 enemigos y aturde).
  Cuanto más rara el arma, más probable y más fuerte el elemento. Cada zona **resiste** uno (×0,5) y es **débil** a
  otro (×1,5). El arma, su estela y las flechas toman el color del elemento.
- De minialu: banco (`Inventario` + `transferir`), bazar (`Catalogo` + `comprar`, `precioDeVenta`), misiones
  (`RegistroMisiones`), billeteras, fusión y mejora de cartas.
- Desarrollo: `?pueblo=espada&panel=banco` abre un servicio; `?partidas` la pantalla de ranuras (ranura de pruebas oculta).

## Combate

- **Medidor de estilo** (D → C → B → A → S → SS → SSS "¡Frenético!"): sube pegando seguido y *variado*
  (repetir lo mismo rinde la mitad). Da +4 % de daño por rango, éter extra y, desde S, velocidad de ataque.
  Se corta a los 2,4 s sin pegar o si te golpean. Subir a S o más pone cámara lenta un instante.
- **Cancelaciones y búfer**: golpe → patada → técnica en cualquier orden; lo apretado antes de tiempo se guarda 0,2 s
  y sale apenas termina la parte activa. Saltar cancela golpes.
- **Aturdimiento al golpear**: cada golpe frena al enemigo un instante (los jefes no se dejan).
- **Combos aéreos**: acertar en el aire te sostiene y recarga el salto aéreo y la embestida.
- **Estocada**: golpe durante el paso atrás o la embestida.
- **Ataque cargado** (mantener J y soltar): Tajo Lunar (espada), Sismo (mazo), Nova (báculo), Flecha Perforante (arco),
  Ráfaga (puños).
- **Esquiva perfecta**: esquivar justo cuando algo te iba a pegar → cámara lenta, +15 de éter y crítico seguro.
- **Desvío**: el golpe cuerpo a cuerpo devuelve los proyectiles enemigos más fuertes.

## Las 10 zonas

| Piso | Zona | Guardián | Forma / ataques |
|---|---|---|---|
| 1 | Osario Hundido | Guardián del Osario | caballero: carga, salto, barrido, lluvia de huesos |
| 2 | Bosque Micelio | Madre Micelio | esporas, raíces, invoca polillas |
| 3 | Forja Ahogada | Fragua Viviente | gólem: carga, salto, lluvia, ráfaga · minas, anillo |
| 4 | Catacumbas de Escarcha | Reina del Invierno Callado | reina: rayos, lluvia, láser, teletransporte |
| 5 | Ciudad Sumergida | Leviatán de Cripta | bestia: carga, salto, anillo, ráfaga · invoca |
| 6 | Biblioteca de Ceniza | Archivista Quemado | máscara: anillo, teletransporte, técnicas de alma |
| 7 | Jardín de Espinas | Rosa Carnívora | flor: raíces, anillo, invoca, ráfaga · minas |
| 8 | Engranaje Olvidado | Autómata Coloso | gólem: láser, carga, minas, salto |
| 9 | Necrópolis Estelar | Astrónomo Muerto | espectro: lluvia de estrellas, rayos, teletransporte |
| 10 | Corazón del Pozo | El Que Recuerda | usa las técnicas de tus Ecos |

Cada zona tiene paleta, tinte, fondo con paralaje, partículas, primer plano, nombres y sprites de criaturas propios.
Los jefes 3–9 usan el **motor de jefes configurable** (`juego/entidades/jefe-configurable.ts`): forma visual +
repertorio de 12 patrones anunciados, con segunda fase al 50 %. Agregar un jefe nuevo es agregar datos en `biomas.ts`.

## Builds: runas, conjuntos y mejoras

- **Runas** (2 ranuras, pasivas equipables): Brasa, Vampiro, Viento, Acero, Avaro, Calma, Eco, Furia, Coleccionista,
  Escarcha. Caen de élites, cofres y siempre de los guardianes.
- **Conjuntos de armadura** (5 sets; solo casco, hombros, pecho, cinturón, pantalones y botas) con bonos a 2, 4 y
  **6 piezas** (set completo: bono de daño): Vigía del Osario, Escarcha Eterna, Marea Abisal, Engranaje Olvidado,
  Manto Astral. Cada guardián suelta una pieza del conjunto de su zona.
- **Refinado hasta +10**: del +6 en adelante puede fallar (75 % → 22 %); se pierden los materiales, nunca la pieza.
- **Armas nuevas** con rasgos propios: Estoque (rápido), Hoja Bastarda (alcance), Lucero del Alba (crítico),
  Arco Largo (alcance), Garras de Hierro, Cetro del Abismo; Armadura de Placas y Talismán.
- **Stats nuevos**: Suerte (mejor botín) y Regeneración (vida cada 5 s).
- **16 talentos**: se suma la Senda del Arsenal (Carcaj Lleno, Corazón Valiente, Armas Gemelas, Lluvia de Acero)
  y un grado 4 en cada senda (Ejecutor, Paso Fantasma, Eco Resonante).
- Desarrollo: `?auto=espada&piso=7&jefe` lleva directo al guardián de una zona; `?auto=arco&piso=3&extraccion&dentro`
  a una sala de extracción, parado en la zona.

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

## Armas, azar y almas

- **5 estilos**: Espada, Puños, Mazo, Báculo y **Arco** (dispara flechas; el tercer golpe suelta tres en abanico).
  El arma rota con el brazo durante el golpe y su largo depende del alcance.
- **Equipo con más azar**: calidad de forja 75–130 % ("Endeble" / "Magistral") y **rasgos** según rareza:
  alcance, velocidad de ataque, daño crítico, éter por golpe y velocidad de movimiento. Único nuevo: *Susurro del Pozo*
  (flechas perforantes).
- **Cartas con más azar**: rasgos (Afilada, Veloz, Eterna, Furiosa, Vampírica, Colosal; más probables con más ★) y
  la variante **Resplandeciente** (3 %, +20 % de stats, borde dorado).
- **12 almas**: Iskra, Morrigan, Bruno y Fenra se suman con técnicas nuevas (**Rayo del Abismo**, **Remolino de Hojas**)
  y pasivas nuevas (Chispa Letal, Vendaval, Espinas).
- El Portador cambia de **tocado según la familia** de su Forma (yelmo con penacho, capucha, sombrero, orejas).
- Animación: brazo y arma con preparación → golpe → seguimiento, estela en media luna, estiramiento al saltar,
  aplastamiento al aterrizar y polvo al girar. Desarrollo: `?galeria` muestra todas las poses.

## Salas y pasajes

- **Cadenas** en todos los pasajes verticales: ↑/↓ para trepar en ambos sentidos, Salto para soltarse.
  Subir ya no depende del Doble Salto: siempre se puede volver por donde se bajó.
- **Interiores procedurales** (`src/dominio/mundo/interiores.ts`): 3 de cada 4 salas normales se generan a partir de 5
  motivos (escalonada, pilares, techo bajo, foso de púas, puentes) con piezas al azar y enemigos ubicados con sentido.
  Cada sala pasa un **validador de alcanzabilidad** (BFS con el alcance real del salto); si no se puede recorrer,
  se regenera. La misma semilla da la misma sala, así que el guardado la reconstruye igual.
- Las plantillas hechas a mano se cruzan siempre de puerta a puerta; algunas plataformas altas quedan como premio
  para el Doble Salto.

## Movimiento y subarmas (estilo Castlevania moderno)

- **Paso atrás** (Shift sin dirección): retroceso con invulnerabilidad; se cancela con golpe o salto.
- **Agacharse** (↓): los proyectiles altos pasan por encima; el golpe sale bajo.
- **Barrida** (↓ + Salto): patada baja que lanza a los enemigos.
- **Saltar cancela** golpes, patadas y lanzamientos.
- **Subarmas** (↑ + Patada): Daga (1♥), Hacha en arco (2♥), Agua Bendita con llamas (2♥), Cruz bumerán (3♥).
  Los **corazones** salen de **velas y candelabros** rompibles en cada sala (que también pueden soltar una subarma).

## Motor gráfico

- Portador procedural con **poses animadas** (ciclo de carrera de 6 cuadros, salto, caída, agachado, barrida, golpe…),
  **capa con física verlet** y **estelas fantasma** en movimientos rápidos.
- **Bloom**: proyectiles, chispas y llamas se dibujan en una capa emisiva que se difumina y se suma.
- **Luces dinámicas** con parpadeo: faroles y ventanas del decorado, velas, proyectiles, botín y jefes.
- **Primer plano** con paralaje rápido, **gradación de color** por bioma y **viñeta**.

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

A/D moverse · ↓ agacharse · ↓+Salto barrida (en plataformas: bajar) · Shift quieto = paso atrás · Shift + dirección = embestida · ↑+K subarma (gasta ♥ de las velas) · Espacio saltar · J golpe (combo ×3) · K patada (rompe guardias; ↓ en el
aire = pisotón con rebote) · L técnica · Shift embestida · E interactuar · Q/R pociones · I inventario/habilidades · M mapa · Esc pausa (guardar y salir). ↑ + J: golpe ascendente.
