# ECOS — El Pozo que Recuerda

**ECOS** es un juego de acción y plataformas en 2D, con dibujos en *pixel art*, que se juega en el navegador.
Mezcla dos géneros:

- **Metroidvania**: exploras un mapa de salas conectadas y consigues poderes (las *reliquias*) que abren caminos nuevos.
- **Roguelike**: cada vez que bajas, el mapa se genera de nuevo al azar, y si mueres pierdes lo que llevabas encima.

Eres un **Portador**: alguien que baja a un pozo sin fondo armado con las **almas** de guerreros caídos.
Cada vez que mueres, el Pozo guarda un **Eco** tuyo, una copia de ti que te espera en el piso donde caíste.

> *Cada guerrero que cae en el Pozo deja un eco. El Pozo recuerda a todos.*

Todo lo que se ve —personajes, enemigos, edificios, efectos— está dibujado por código, sin imágenes externas para lo
principal:

- **Iluminación dinámica:** faroles, velas, orbes, fogonazos y hasta los ojos de los monstruos son luces de color; la
  roca proyecta **sombras duras** y sus cantos brillan del lado de cada luz, como piedra húmeda.
- **Física en los efectos:** al romper un escudo, una barrera o un enemigo, los fragmentos rotan, rebotan contra el
  suelo, dejan estela de chispas e iluminan el entorno un instante.
- **Animación procedural:** cadenas y estandartes cuelgan con física (se mecen y se apartan al pasar), y los
  guardianes que caminan apoyan sus patas en el suelo con cinemática inversa.
- **Interfaz pixel art:** fuentes de píxel y marcos de hierro forjado, madera y vidrio dibujados por código.
- **Motor híbrido 2D + WebGL2:** el juego se dibuja con Canvas 2D en un G-Buffer (color, normales y brillo) y un
  compositor WebGL2 le suma relieve iluminado (la roca y las cadenas brillan del lado de cada luz), bloom, **ondas de
  choque** (esquiva perfecta, pisotón, guardia rota, Definitiva) y **aberración cromática** al recibir golpes o con
  poca vida. Sin WebGL2 se ve como antes.
- **Personajes iluminados:** el Portador, los enemigos y la gente del pueblo reciben un borde de luz del lado de
  cada farol o vela (máscara de siluetas en el compositor); los ojos de los enemigos y el aura de la Forma (5★+)
  brillan con bloom, y la capa del Portador es una tela Verlet que ondea con el movimiento y el viento.
- **Sombras y volumen de personajes:** cada personaje proyecta una sombra suave sobre el fondo, alejándose de cada
  luz, y su cuerpo se ilumina del lado de la luz y se oscurece del otro (`?sinsombras` las apaga).
- **Las salas recuerdan la pelea:** la sangre salpica y mancha suelos y paredes, las explosiones y los pisotones
  dejan cráteres de hollín y las flechas quedan clavadas en la roca mientras dure el piso.
- **Estela del arma** del color del aura de tu Forma (prismática en 12★), más ancha cuanto más alto tu estilo.

---

## Índice

1. [Cómo empezar a jugar](#cómo-empezar-a-jugar)
2. [Controles](#controles)
3. [La idea del juego en un minuto](#la-idea-del-juego-en-un-minuto)
4. [El pueblo](#el-pueblo-último-refugio)
5. [El Pozo: bajar, pelear y volver](#el-pozo-bajar-pelear-y-volver)
6. [El Abismo: el pozo sin fin](#el-abismo-el-pozo-sin-fin)
7. [Combate](#combate)
8. [Armas](#armas)
9. [Cartas de Alma](#cartas-de-alma)
10. [Cajas de Almas y Relicarios](#cajas-de-almas-y-relicarios)
11. [Equipo, rarezas y el inventario](#equipo-rarezas-y-el-inventario)
12. [Reliquias: los poderes permanentes](#reliquias-los-poderes-permanentes)
13. [Salas de desafío (arenas)](#salas-de-desafío-arenas)
14. [El Juicio: desafíos de lategame](#el-juicio-desafíos-de-lategame)
15. [Progresión del Portador](#progresión-del-portador)
16. [Ecos: lo que dejas al morir](#ecos-lo-que-dejas-al-morir)
17. [Misiones](#misiones)
18. [Consejos para empezar](#consejos-para-empezar)
19. [Para desarrolladores](#para-desarrolladores)

---

## Cómo empezar a jugar

Necesitas [Node.js](https://nodejs.org) (versión 18 o superior) y `git`.

ECOS usa la librería [minialu](https://github.com/LATINALU/minialu) directamente desde su código, así que las dos
carpetas tienen que estar **una al lado de la otra**:

```bash
git clone https://github.com/LATINALU/minialu.git
git clone https://github.com/LATINALU/Ecos.git
cd Ecos
npm install
npm run dev
```

Abre en el navegador la dirección que aparece (normalmente `http://localhost:5173`).

La partida se guarda sola en el navegador. Hay **3 ranuras de partida**, así que pueden jugar varias personas en la
misma computadora.

---

## Controles

| Tecla | Qué hace |
|---|---|
| **A / D** o **← →** | Moverse |
| **Espacio** o **Z** | Saltar |
| **J** o **X** | Golpe (encadena un combo). Mantener y soltar: **ataque cargado** |
| **K** o **C** | Patada: rompe la guardia de los enemigos con escudo. En el aire con **↓**: pisotón |
| **L / U / O** (o **V / B / N**) | Habilidades I, II y III de tus cartas de alma (gastan éter) |
| **P** o **F** | Habilidad **Definitiva** (se carga peleando) |
| **Shift** (quieto) | Paso atrás invulnerable. Justo antes de que te peguen: **esquiva perfecta** |
| **Shift + dirección** | Embestida (cuando tienes esa reliquia) |
| **↓** | Agacharse. **↓ + Salto**: deslizarse (sobre una plataforma: bajar de ella) |
| **↑ + J** | Golpe ascendente (lanza a los enemigos al aire) |
| **↑ + K** | Subarma (cuchillos, hachas…; gasta corazones ♥ que dan las velas) |
| **E** | Interactuar: hablar, abrir cofres, tocar campanas, usar portales |
| **Q** | Poción de vida |
| **R** | Frasco de éter |
| **I** o **Tab** | Inventario |
| **M** | Mapa del piso |
| **Esc** | Pausa (desde ahí se guarda y se sale) |

---

## La idea del juego en un minuto

1. Empiezas en el **pueblo**: compras, mejoras tu equipo y aceptas misiones.
2. Bajas al **Pozo**: cada piso es un mapa nuevo lleno de monstruos, cofres y secretos.
3. Todo lo que encuentras va a tu mochila, pero **está en riesgo**: si mueres, lo pierdes.
4. Para quedártelo tienes que **extraer**: encontrar una zona de extracción (verde en el mapa) o vencer al guardián
   del piso y tomar su portal hacia el pueblo.
5. Vuelves más fuerte, mejoras tu equipo y bajas otra vez, cada vez más hondo.

Es una decisión constante: **¿sigo bajando para conseguir algo mejor, o vuelvo ahora con lo que tengo?**

---

## El pueblo (Último Refugio)

El pueblo es un lugar seguro, al borde del abismo. Cada edificio tiene un servicio, y cada habitante, un pasado
atado al Pozo (acércate y pulsa **↑** para hablar con ellos):

| Edificio | Qué ofrece |
|---|---|
| **Taberna «El Último Eco»** | Tablón de **misiones**, el **registro de desafíos** y el memorial de tus Ecos |
| **Bazar del Pozo** | Comprar pociones, éter, Polvo de Eco, Dados del Destino y materiales; vender lo que no uses |
| **Armería Hierro Viejo** | Comprar equipo (el surtido cambia tras cada descenso); si no tienes arma, te regalan una para empezar |
| **Bóveda** | Un **banco** para guardar objetos a salvo (lo que está ahí no se pierde nunca) |
| **Capilla (Altar de las Almas)** | **Fusionar** y **mejorar** cartas de alma |
| **Fragua** | Forjar equipo con materiales y **refinar** lo que llevas puesto |
| **Santuario** | Mejoras permanentes que se pagan con **esencia** |
| **El Pozo** | Bajar al Pozo (eligiendo el piso inicial) o al **Abismo** |

### Historias del pueblo

Cuatro habitantes te piden algo personal. Aparece un **«!»** sobre su cabeza cuando estás cerca de poder hacerlo:

| Quién | Misión | Recompensa permanente |
|---|---|---|
| **Dorn** (Fragua) | Fue Portador y volvió del piso 18 sin piernas. Vence a su Eco joven y trae su martillo | **Forja Mítica**: forjar piezas Míticas con nombre |
| **Hermana Ceniza** (Altar) | Su gemelo cayó en el piso 9. Trae su rosario | **+10 %** de éxito en todas las fusiones |
| **Ilse** (Taberna) | Su hija Marta bajó con 16 años y no volvió del piso 5. Trae su cinta | Cada descenso empiezas con una **poción y un éter** extra |
| **Custodio Vael** (Bóveda) | Un Portador juró volver por su cofre. Su Eco vaga por el piso 14 | Si mueres, **conservas tu arma** |

El recuerdo se pierde si mueres con él encima: el Eco vuelve a esperarte.

### Un pueblo que renace

El pueblo cambia con tu progreso (pisos superados y esencia invertida en el Santuario): al principio está en
**ruinas**, oscuro, con escombros y lloviendo ceniza; a medida que avanzas se encienden los faroles (de **éter** al
final), aparecen estandartes, los **trofeos de los Guardianes** que venciste cuelgan junto a la Taberna y
**aventureros** pasean comentando tus hazañas.

Dentro del Pozo **no hay tiendas**: para comprar, fusionar o forjar hay que volver a la superficie. La única excepción
es el Abismo (ver más abajo).

---

## El Pozo: bajar, pelear y volver

El Pozo tiene **24 pisos**, cada uno con su zona (Osario Hundido, Bosque Micelio, Forja Ahogada, Catacumbas de
Escarcha, Ciudad Sumergida, Biblioteca de Ceniza… y más). Cada zona tiene su paisaje, sus monstruos y su
**guardián** (el jefe del piso).

### El mapa de cada piso

- Cada piso es una red de salas que se genera al azar al llegar. Nunca hay dos iguales. Los pisos son **grandes**:
  de 18 salas en el piso 1 a 40 en los más hondos (y hasta 44 en el Abismo).
- Las salas se conectan por puertas laterales y por pasajes verticales con **cadenas** para trepar.
- Algunas puertas están bloqueadas por **cristales** o **muros de raíces**: se rompen con ciertas reliquias.
- **Regla de oro:** el juego nunca te pone un obstáculo que no puedas superar. Si una puerta pide una reliquia, o ya la
  tienes o está en ese mismo piso. Si un jefe vuela y no tienes doble salto, la sala tiene escalones para alcanzarlo.

### Tipos de sala

| Sala | Qué hay |
|---|---|
| **Inicio** | El **Faro**: descansas una vez por piso (recuperas vida y éter) |
| **Normal** | Monstruos, velas para romper y, a veces, un cofre |
| **Tesoro** | Un cofre de buena calidad |
| **Reliquia** | Una reliquia nueva (en algunos pisos) |
| **Bóveda** | Un cofre de oro o mítico custodiado por élites |
| **Arena** | Un desafío opcional con oleadas (ver [Salas de desafío](#salas-de-desafío-arenas)) |
| **Eco** | Tu Eco de una partida anterior, esperando para pelear |
| **Extracción** | Zona verde: quédate 5 segundos dentro y vuelves al pueblo con todo |
| **Guardián** | El jefe del piso. Al vencerlo se abre un portal: extraer o seguir bajando |

### Riesgo y extracción

- Lo que recoges en el Pozo está **"en riesgo"** (se muestra abajo a la derecha).
- Para extraer, quédate **5 segundos** dentro de la zona verde. Salir o recibir un golpe reinicia la cuenta.
- Los pisos grandes tienen hasta **3 zonas de extracción** (una cerca del inicio, otra a media distancia y otra al fondo).
- Si lo logras, o si tomas el portal del guardián, todo pasa a ser tuyo de verdad. Si **mueres**, lo pierdes.
- Al vencer al guardián de un piso, desde el pueblo podrás empezar a bajar **desde el piso siguiente**.

### Peso del Eco (codicia)

Cada piso que bajas **seguido** sin volver al pueblo suma **Peso del Eco** (se ve abajo a la derecha):

- Cada punto da **+25 % de hallazgos raros** (mejor botín y más Relicarios en las élites).
- El Peso vuelve a cero cuando empiezas un descenso nuevo desde el pueblo.

### Cofres

Los cofres tienen 4 calidades: **madera**, **plata**, **oro** y **mítico**. Cuanto más hondo, mejores cofres.

---

## El Abismo: el pozo sin fin

El Abismo es un modo alternativo, **infinito**:

- Las zonas se repiten en **ciclos** (I, II, III…) y cada ciclo es más difícil.
- Cada piso tiene una **Grieta** que solo baja: no se puede volver por ahí.
- La única forma de volver al pueblo es encontrar una **SALIDA**. Son escasas, están escondidas y no salen en el mapa
  hasta que las encuentras. Al llegar a un piso, el juego te avisa si este tiene una ("sientes una corriente de aire…").
- Si pasan 3 pisos seguidos sin salida, el siguiente seguro tiene una.
- Cada 5 pisos un guardián custodia la Grieta. Vencerlo te deja empezar el Abismo desde más abajo la próxima vez.
- Como de aquí no se sube, el Abismo **sí tiene servicios**: altar de almas, yunque y, en algunos pisos, un
  **mercader errante** que vende piezas raras (Épicas o Legendarias) a precio alto.
- Se guarda tu récord de profundidad.

---

## Combate

- **Combos:** golpe, patada y habilidades se encadenan en cualquier orden. Saltar cancela un golpe.
- **Medidor de estilo** (D → C → B → A → S → SS → SSS): sube si pegas seguido **y variado**. Cada rango da más daño,
  más éter y, desde S, más velocidad. Se corta si dejas de pegar o si te golpean.
- **Esquiva perfecta:** esquivar justo cuando algo te iba a pegar → cámara lenta, éter extra y crítico seguro.
- **Peso en cada golpe:** el juego se congela unos milisegundos al conectar (más en críticos, remates, el mazo y los
  ataques cargados) y el enemigo tiembla antes de salir despedido. Cada espadazo deja un arco de corte blanco y del
  color del aura de tu Forma.
- **La patada mueve el mundo:** el enemigo sale volando. Contra un **muro** recibe daño de impacto y queda aturdido;
  contra otros monstruos los arrolla **como bolos** (¡CHUZA!); sobre **púas**, muere al instante.
- **Música que reacciona a tu estilo:** en D y C solo suenan percusión y bajo; en A entra la melodía; en S un coro y en
  SS una guitarra distorsionada. Al llegar a S, SS y SSS el Pozo **susurra** el nombre del rango.
- **Ataque cargado:** mantener **J** y soltar. Cada arma tiene el suyo.
- **Golpes aéreos:** acertar en el aire te mantiene arriba y recarga el salto y la embestida.
- **Enemigos élite:** más grandes, con borde dorado y **afijos** (Veloz, Blindado, Vampiro, Regenerador, Explosivo,
  Furioso). Sueltan mejor botín.
- **Guardianes:** cada uno tiene sus propios ataques anunciados y una **segunda fase** al bajar a la mitad de vida.

---

## Armas

Hay **cuatro familias de armas**, cada una con distinto alcance y sus propias **pasivas de ataque**:

| Arma | Alcance | Pasivas |
|---|---|---|
| **Espada** | Medio | *Sangría*: el corte final del combo te cura un poco · *Filo preciso*: más probabilidad de crítico |
| **Mazo** | Largo | *Quebrantahuesos*: ignora parte de la defensa · *Rompeguardias*: atraviesa escudos |
| **Báculo** | Medio | *Canalizador*: potencia las habilidades · el último golpe del combo lanza un **orbe de éter** |
| **Arco** | A distancia | *Ojo de halcón*: más daño cuanto más lejos está el enemigo · *Punta barbada*: críticos más fuertes |

Sin arma peleas a puño limpio. Cualquier arma que equipes cambia tu forma de pelear.

---

## Cartas de Alma

Las cartas son el corazón de tu personaje. Cada una contiene el alma de un guerrero caído, con sus **stats**, sus
**habilidades** y su **pasiva**. Hay **12 almas** en 4 familias.

### El mazo de 5 ranuras

| Ranura | Tecla | Qué da |
|---|---|---|
| **Forma** | — | Tu apariencia, tus ataques básicos y el 100 % de los stats de la carta |
| **Habilidad I** | L | Una habilidad activa y una pasiva |
| **Habilidad II** | U | Otra habilidad activa y otra pasiva |
| **Habilidad III** | O | Otra más |
| **Definitiva** | P | La habilidad más poderosa (se carga peleando) |

### Estrellas, rasgos y aura

- Cada carta tiene de **1★ a 12★**. Más estrellas = stats mucho más altos.
- Algunas cartas traen un **rasgo** extra (Afilada, Veloz, Eterna, Furiosa, Vampírica, Colosal).
- Muy pocas salen **Resplandecientes**: +20 % a todo.
- Las cartas de **5★ en adelante** tienen un **aura** que brilla detrás del retrato y dice su rareza de un vistazo:

| 5★ | 6★ | 7★ | 8★ | 9★ | 10★ | 11★ | 12★ |
|---|---|---|---|---|---|---|---|
| Gris | Morada | Verde | Azul | Roja | Dorada | Plateada | **Prismática** (arcoíris) |

### Mutaciones: las estrellas cambian lo que hace la habilidad

Subir de estrella no solo da más números. Al llegar a **5★, 9★ y 12★**, cada habilidad **muta** según su forma.
Por ejemplo, las habilidades que lanzan proyectiles:

- **5★ Eco:** donde termina el proyectil queda un eco tuyo que estalla.
- **9★ Paso del Eco:** si repites la tecla durante el enfriamiento, te teletransportas al eco cortando todo a tu paso.
- **12★ Coro de Ecos:** al usar tu Definitiva, todos tus ecos la imitan.

Las embestidas dejan estelas y se encadenan, las novas atraen y dejan agujeros negros, las ondas abren grietas y
levantan columnas, los rayos saltan en cadena… La ficha de cada carta muestra sus tres mutaciones y cuáles tienes.

### Resonancias de Mazo (combinaciones secretas)

Cada habilidad tiene una **esencia** (Fuego, Hielo, Veneno, Tormenta, Tierra, Viento, Sombra o Arcano). Si usas una
habilidad y, en menos de 1,5 s, otra de **otra ranura** cuya esencia combina, **resuenan** en un efecto que no existe
en ninguna de las dos cartas: Fuego + Viento = **Tornado de Ceniza**, Sombra + Arcano = **Eclipse Menor**… Hay 10
por descubrir, y el **Códice de Resonancias** (pestaña Cartas) anota las que encuentras.

### Fusión y mejora (en el Altar)

- **Fusión:** pones 3 cartas con la misma cantidad de estrellas y sale una de las tres con una estrella más. La
  probabilidad de éxito baja a medida que subes. Si falla, la carta se "reforja" con stats nuevos (nunca pierdes todo).
- **Sello 100 %:** si pones un **Dado del Destino** de esa estrella o una **Lágrima de Eco** en la 4.ª ranura, la
  fusión sale segura.
- **Mejora:** el **Polvo de Eco** sube los stats de una carta (hasta 5 veces).

---

## Cajas de Almas y Relicarios

Las cartas **no caen sueltas**: salen de cajas que se abren desde el inventario, con una animación en la que la luz
sube estrella por estrella hasta la que te tocó.

### Caja de Almas (1★ a 6★)

La sueltan los monstruos comunes, las élites y los cofres comunes.

| 1★ | 2★ | 3★ | 4★ | 5★ | 6★ |
|---|---|---|---|---|---|
| 34 % | 27 % | 19 % | 11 % | 6,5 % | 2,5 % |

### Relicario de Almas (5★ a 12★)

Todo **guardián** suelta uno seguro; también los cofres de oro y míticos.

| 5★ | 6★ | 7★ | 8★ | 9★ | 10★ | 11★ | 12★ |
|---|---|---|---|---|---|---|---|
| 45 % | 25 % | 14 % | 8 % | 4,5 % | 2,2 % | 1 % | 0,3 % |

**Garantía:** cada **100 relicarios** abiertos te aseguran al menos **1 de 12★, 3 de 11★, 5 de 10★ y 8 de 9★**,
aunque tengas la peor suerte del mundo. El inventario muestra cuántos llevas del bloque y qué falta.

Si tienes varias cajas, **"Abrir todas"** las abre de una vez y muestra el resultado ordenado de la mejor a la peor.

---

## Equipo, rarezas y el inventario

### Rarezas

| Común | Poco común | Raro | Épico | Legendario | Mítico |
|---|---|---|---|---|---|
| gris | verde | azul | morado | naranja | rojo |

- Cada pieza sale con **stats al azar** dentro de su rango, más **modificadores** que dependen de la rareza: casi
  nunca hay dos piezas iguales.
- Las piezas **Míticas con nombre** tienen efectos únicos.
- **Conjuntos de armadura:** llevar 2, 4 o 6 piezas del mismo set da bonos extra.
- **Runas:** 2 ranuras de pasivas equipables, en 4 rarezas. Tres iguales se funden en una mejor.
- **Templado:** en la Fragua puedes subir una pieza hasta **+10** y **nunca falla**. Desde +6 eliges:
  **Templado Seguro** (caro) o **Templado Abisal** (barato, pero sella un **pacto** en la pieza: un bono salvaje junto
  con una maldición, como *Filo Hambriento*: +40 % de daño crítico, pero recibes +15 % de daño).

### 12 ranuras de equipo

Arma · Casco · Hombros · Pecho · Cinturón · Pantalones · Botas · Capa · Collar · Aretes · Anillo I · Anillo II.

### El inventario (tecla I)

Tiene tres columnas:

- **Personaje:** tu figura en el centro con las 12 ranuras alrededor. Detrás de la figura brilla el aura de tu Forma.
  Muestra tu **Poder** (una cifra que resume tu equipo), tus runas y tus stats principales.
- **Mochila (60 casillas):** barra de capacidad, **filtros** (Equipo, Cajas, Consumibles, Runas, Materiales) y botón
  **Ordenar**. Cada casilla tiene el color de su rareza, el nivel de la pieza y una flecha **▲ verde** si es mejor que
  lo que llevas puesto (o **▼ roja** si es peor).
- **Detalle:** la ficha del objeto elegido, comparada con lo que llevas, y sus acciones: Equipar, Desguazar (por
  esquirlas), Engarzar runa, Abrir caja.

Las otras pestañas del inventario son **Cartas de Alma** (tu mazo), **Habilidades** (puntos de stats y talentos) y
**Stats y daño** (el desglose completo de tus números).

---

## Reliquias: los poderes permanentes

Las reliquias **no se pierden nunca**, ni siquiera al morir. Aparecen en pisos concretos y abren caminos nuevos:

| Reliquia | Qué hace |
|---|---|
| **Embestida del Errante** | Shift + dirección: te lanzas invulnerable. Rompe los **cristales** |
| **Alas de Ceniza** | Doble salto: alcanzas cornisas altas |
| **Garra Ígnea** | Tus golpes queman. Reduce a cenizas los **muros de raíces** |
| **Botas del Céfiro** | Te mueves más rápido y el paso atrás se recarga antes |
| **Corazón del Eco** | Las pociones curan más y empiezas cada descenso con una extra |
| **Ojo del Abismo** | El mapa de cada piso se revela entero al llegar |
| **Mano del Avaro** | Más esquirlas y ningún cofre de madera |
| **Lágrima del Pozo** | La Definitiva empieza cada piso cargada al 40 % |

---

## Salas de desafío (arenas)

En el Pozo, en lugar de tiendas, hay **arenas**: salas donde se consigue buen equipo peleando. Son **opcionales**: en
el centro hay una **Campana del Desafío** y nada empieza hasta que la tocas. Al tocarla se sellan las puertas y llegan
las oleadas.

**Frenesí:** mientras dura la arena, el Pozo se enfurece. La música se acelera, los bordes de la pantalla laten en
rojo, brotan **Manos del Abismo** bajo tus pies y llegan **refuerzos** por los lados mientras quede alguien de la
oleada en pie (con un tope, para que siempre se pueda limpiar). Es más violento cuanto más hondo el piso, cuanto más
avanza la arena y en el Juicio. En el Duelo solo brotan manos: es un uno contra uno.

| Arena | Regla | Premio especial |
|---|---|---|
| **Arena de Sangre** | Oleadas que crecen; un campeón élite cierra la última | Cofre según la profundidad |
| **Reloj de Arena** | 3 oleadas contra el reloj | A tiempo: mejor cofre. Tarde: peor |
| **Foso de Campeones** | Pocos rivales, todos élites | Una pieza Rara o mejor |
| **La Marea** | 4 oleadas con muchísimos enemigos | Una montaña de esquirlas |
| **Duelo del Campeón** | Un solo rival enorme con 3 afijos | Una carta de jefe (Relicario) |

Además:

- **Botín con destino:** cada arena anuncia de antemano qué tipo de pieza da (un anillo, unas botas, un arma…), para
  que puedas buscar exactamente lo que te falta.
- **Sellos de mérito:** terminar **sin recibir golpes** (*Intocable*) mejora el cofre y la pieza; con pocos golpes,
  ganas más esquirlas.
- **Racha:** encadenar arenas en un mismo descenso (sin volver al pueblo) mejora el premio de la siguiente.

---

## El Juicio: desafíos de lategame

Al desbloquear el piso 12 recibes la **Piedra del Juicio**. A partir de ahí, cada campana de arena te deja elegir entre
la arena normal o **invocar el Juicio** (inspirado en las *Míticas+* de World of Warcraft):

- La piedra tiene un **nivel** (empieza en +2). Cuanto más alto, más fuertes los enemigos (+9 % de vida y daño por
  nivel).
- **Siempre hay contrarreloj.** Si terminas a tiempo, la piedra **sube** +1, +2 o +3 según cuánto tiempo sobró. Si
  llegas tarde, **baja** un nivel.
- **Afijos** que se suman con el nivel y **cambian cada semana**:

| Nivel | Afijo (uno por semana) |
|---|---|
| +2 | **Fortificado** (comunes más fuertes) o **Tiránico** (élites más fuertes) |
| +4 | **Reforzado** (al morir uno, los demás se fortalecen), **Enfurecido** (pegan más fuerte con poca vida) o **Sanguino** (dejan charcos de sangre) |
| +7 | **Volcánico** (erupciones bajo tus pies), **Explosivo** (estallan al morir) o **Espectral** (sombras voladoras entre oleadas) |
| +10 | **Abisal**, afijo de temporada: muchos enemigos son élites |

- El premio crece con el nivel: desde una pieza Rara en +2 hasta **Míticas** desde +9.
- En la Taberna se ven tu nivel de piedra, tu mejor Juicio y los afijos de esta semana.

---

## Progresión del Portador

- **Niveles:** ganas experiencia peleando. Cada nivel da **3 puntos de stats** y **1 punto de talento**.
- **Talentos:** 18 talentos en varias *sendas* (Filo, Vendaval, Eco, Arsenal…) que cambian cómo juegas.
- **Stats:** Vida, Éter, Golpe, Patada, Técnica, Defensa, Crítico, Suerte (mejor botín) y Regeneración.
- **Santuario:** mejoras permanentes pagadas con **esencia**, que se gana al terminar cada descenso y con algunas misiones.
- **Monedas:** las **esquirlas** (◆) se usan para casi todo; la **esencia** es para el Santuario.

---

## Ecos: lo que dejas al morir

Cuando mueres, el Pozo crea tu **Eco**: una copia de ti, con tu Forma, tus stats y tu mejor pieza de equipo, que te
espera en el piso donde caíste. Puede haber hasta 3 Ecos a la vez. El jefe final, **El Que Recuerda**, pelea con las
técnicas de todos tus Ecos.

- **Tu Eco aprende de ti.** El juego anota cómo peleas en cada descenso (si te mantienes lejos, si atacas desde el
  aire, si esquivas a último momento, si pateas, si abusas de las habilidades, tu ritmo y tu arma) y tu Eco **pelea
  igual**: si eras un arquero que huía, te hará *kiting* por la sala y te disparará; si vivías en el aire, te caerá en
  picado; si esquivabas, esquivará tus golpes. El cartel del duelo dice qué aprendió.
- **Absorber o pactar.** Al vencerlo eliges:
  - **Absorber el Recuerdo:** recuperas lo que perdiste y te curas por completo.
  - **Dejar que te acompañe:** se vuelve un **Espectro Temporal** que pelea a tu lado todo ese piso. Si lo terminas
    con vida, te devuelve tu mejor pieza **con un templado más**. Si caes, se pierde.
- **Cicatrices del Pozo.** Si un monstruo te mata, la próxima vez que pases por ese piso habrá una sala con **tus
  armas rotas clavadas en el suelo**, tu sangre seca y ese mismo monstruo convertido en el **«Devorador de [tu
  nombre]»**: más fuerte, con sus mismos afijos y usando una de tus habilidades. Vencerlo cierra la cicatriz.
- **Ecos de otros Portadores.** A veces, en la sala del Eco te espera el de **otro Portador** que cayó en ese piso.
  Si lo vences, usas una versión **Espectral** de su arma durante ese descenso, y a él le llega a su Taberna: *«Un
  Portador vengó tu caída en el piso N — Recibes X esquirlas»*. Hoy se comparten entre las partidas de la misma
  computadora; con un servidor (variable `VITE_ECOS_URL`) se comparten en línea.

## Misiones

La Taberna tiene un tablón con **138 misiones** repartidas por zona, en varias líneas (exploración, combate, alma y el
guardián) más **encargos repetibles** (cazar criaturas, traer botín, superar arenas). Puedes tener hasta **3 activas**
y dan experiencia, esquirlas, objetos y esencia.

---

## Consejos para empezar

- **Extrae seguido al principio.** Volver con poco es mejor que perderlo todo.
- **Guarda en la Bóveda** lo que no quieras arriesgar nunca.
- **Mira las flechas ▲** en la mochila: te dicen al instante si algo es mejor que lo que llevas.
- **Abre las cajas en el pueblo** y fusiona en el Altar las cartas repetidas de la misma estrella.
- **Las arenas valen la pena** cuando te sientes fuerte: el botín con destino te deja completar tu equipo.
- **Aprende la esquiva perfecta** (Shift justo antes del golpe): da crítico seguro y cámara lenta.
- **No temas morir:** tu Eco te espera para devolverte tu mejor pieza.

---

## Para desarrolladores

```bash
npm run dev      # servidor de desarrollo
npm test         # pruebas (Vitest)
npm run build    # comprobación de tipos + compilación
```

- **Tecnología:** Vite + TypeScript estricto + Vitest. Dibujo en Canvas 2D a 480×270, ampliado; menús en HTML.
- **Mecánicas base** (inventario, botín, fusión de cartas, monedas, misiones, curvas de nivel): librería
  [minialu](https://github.com/LATINALU/minialu).

### Estructura

| Carpeta | Qué contiene |
|---|---|
| `src/dominio/` | Reglas del juego, puras y probadas: partida, botín, cartas, equipo, generación de mapas, Abismo, arenas, Juicio, relicarios |
| `src/contenido/` | Datos: almas, biomas y jefes, armas, objetos, misiones, talentos, plantillas de salas |
| `src/juego/` | El juego en tiempo real: escena, jugador, enemigos, jefes, pueblo, edificios, efectos |
| `src/ui/` | Menús, tiendas, inventario, HUD y estilos |
| `src/motor/` | Física, teclado, audio y música por capas, sprites, texto, y el motor gráfico: `pintor.ts` (G-Buffer), `compositor.ts` (WebGL2), `postfx.ts`, `verlet.ts`, `trazos.ts`, `superficie.ts` (cicatrices de sala), `particulas.ts` (SOA) |
| `test/` | Pruebas del dominio |

### Atajos de desarrollo (solo en `npm run dev`)

| URL | Qué hace |
|---|---|
| `&sinwebgl` · `&capa=normales` | Desactivar el compositor WebGL2 · ver una capa del G-Buffer |
| `&batalla` | Simula una pelea en la sala para ver sangre, cráter y flechas clavadas |
| `?auto=espada&piso=7` | Empieza directo en el piso 7 con una espada (`espada`, `pesada`, `baston`, `arco`) |
| `&jefe` · `&tiposala=arena` | Ir a la sala del guardián o a la primera arena del piso |
| `&abismo` | Empezar en el Abismo |
| `&juicio=8&campana` | Piedra del Juicio +8 y abrir la campana (`&campana=juicio` empieza directo) |
| `&botin` | Suelta un abanico de botín de todas las rarezas |
| `?pueblo=espada&panel=taberna` | Abrir un servicio del pueblo |
| `?pueblo=espada&surtido&cajas=9&relicarios=3&forma=10&inventario` | Inventario lleno de ejemplo |
| `?pueblo=espada&cartas&inventario&tab=cartas` | Una carta de cada estrella de 5★ a 12★ |
| `?pueblo=espada&animar=12` | Ver la animación de apertura de un relicario |
