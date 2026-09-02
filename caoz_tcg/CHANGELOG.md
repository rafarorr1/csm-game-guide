# Registro de versiones — el TCG del Domo

Qué cambia en cada versión del juego y **por qué**, con los números que lo justifican.
Lo de arriba es lo más reciente.

Cómo se anota una versión nueva:

- **v2, v3…** cuando cambian las reglas, las cartas, los mazos o **la forma de manejar el
  juego** — o sea, cuando una partida se juega distinto. Si el cambio toca al balance, aquí
  va siempre el antes y el después medido con `balance.html`.
- Los arreglos y las mejoras de interfaz no llevan número: van en «Sin numerar» abajo, o en
  el historial de git si son menores.

---

## v7 — Las Canciones de Fender dejan huella · 2026-09-02

### Por qué perdía

Fender llevaba siendo el Líder más débil desde la primera medición: **~41%** de victorias.
Mirando su mazo, el problema salta sin necesidad de simular nada:

- **Sus cuerpos son diminutos.** Matildus 1/1, Discípulo de Rul 1/2, Bartolomeo 1/2,
  Machete 0/2. El más grande es Eric 3/3. Adreida tiene 4/4 y 4/3.
- **Su curva se corta en 3.** No hay una sola carta de Costo 4 o 5. Es coherente con un
  mazo agresivo —cerrar pronto— pero las partidas duran **11 turnos de media**: del quinto
  en adelante tiene 5 a 10 PD y nada que hacer con ellos.

Lo primero que se probó fue abaratar su habilidad, **Sube el Volumen**, de 2 PD a 1. No
movió nada: 41,0. Su habilidad no era el problema.

### Lo que se cambió

**Inspiración pasa a dar +1 ATQ permanente** en vez de hasta el final del turno.

Es un punto por Canción, y el mazo lleva diez. La diferencia es que ahora lo que construyes
se queda: sus cuerpos siguen entrando pequeños, pero cada Canción los deja un poco más
grandes **para el resto de la partida**. Eso arregla las dos cosas a la vez — le da algo
que hacer con los PD de los turnos largos, y convierte a sus 1/2 en amenazas que crecen.

Y refuerza lo que ya era: un bardo cuyo plan es encadenar Canciones. Antes eso era un
estallido de un turno que había que cronometrar; ahora es una campaña.

**Resultado — 6000 partidas en tres tandas:** Fender sube de ~41% a **45-48%** y la brecha
entre el mejor y el peor Líder baja de ~21 a **16-20 puntos**. Es el reparto más compacto
que ha tenido el juego:

```
rafaela ~59   adreida ~58   fender ~46   mohamed ~45   talesin ~42
```

---

## v6 — Adreida deja de ganar 7 de cada 10 · 2026-09-01

### El problema no estaba donde lo buscábamos

Adreida ganaba el **71,6%** de sus partidas y la brecha entre el mejor y el peor Líder era
de **34,6 puntos**. La sospecha inicial —suya y mía— era su pasiva **Intimidante** o su
habilidad **Golpe Directo**. Se probaron ocho variantes, 2000 partidas cada una:

| Cambio | Adreida | Brecha |
|---|---|---|
| Base | 71,6 | 34,6 |
| Golpe Directo cuesta 3 PD | 69,5 | 30,2 |
| Provocar con 5+ ATQ | 64,0 | 23,2 |
| Las dos juntas | 64,9 | 23,9 |
| Provocar 5+ y sin quitar contraataque | 65,5 | 25,4 |
| Provocar sólo al aliado de mayor ATQ | 69,9 | 30,8 |
| Coste 3 + sólo el mayor provoca | 70,4 | 32,4 |
| Sus cuerpos de 4 ATQ cuestan 5 PD | 68,4 | 28,9 |
| Provocar 5+ y sus cuerpos suben a 5 ATQ | **74,2** | 37,6 |

Tres cosas que dijeron los números, y ninguna era la esperada:

**Subir el umbral de Provocar a 5 no modera Intimidante: la apaga.** Todos los personajes
de 4+ ATQ del mazo tenían *exactamente* 4 — ninguno llegaba a 5. La pasiva sólo se
activaría con buffs. Habría dejado a Adreida sin su seña de identidad, el mismo error que
se cometió con Talesin en la v2. Además rompía una lección del tutorial, donde el Mazo de
Brock lleva a Bartolomeo justo a 4 ATQ para enseñar Provocar.

**Combinar cambios resta en lugar de sumar.** Cuatro pruebas distintas salieron peor que
sus partes por separado.

**El poder estaba en los cuerpos, no en la pasiva.** La última variante lo demuestra al
revés: subirles 1 de ATQ la lleva a 74,2 *aunque la pasiva quede casi apagada*.

### Lo que se cambió: tres cuerpos premium menos

Ni la pasiva ni la habilidad se han tocado. Sólo la composición del mazo:

| | Antes | Ahora |
|---|---|---|
| Sir Horton (4/3, c4) | 2 | 1 |
| Eric (3/3, c3) | 2 | 1 |
| Eman 69 (4/3, c4) | 1 | — |
| El Conserje (0/1, c1) | 2 | 3 |
| Machete (0/2, c1) | 2 | 3 |
| Collar Mágico de Agua | 2 | 3 |

Las tres plazas se llenaron con cartas baratas y defensivas. El primer reparto probado subía
Auxilio y Zancada a 4 copias y **las pruebas lo rechazaron**: el máximo por carta son 3. El
reparto legal da el mismo resultado (61,4 y 20,8 de brecha), así que no costó nada.

Sigue siendo un mazo de cuerpos que provocan y pelean: conserva a Lucius, Sir Horton,
Brick y Brock, Eric y Augusto. Lo que pierde es la **densidad** de cuerpos premium, que era
lo que le dejaba plantar un muro tras otro sin que le costara.

**Resultado — 6000 partidas en tres tandas:** Adreida baja a **61-62%** y la brecha a
**20-24 puntos** (varía unos 4 puntos entre tandas; es el ruido normal a 2000 partidas).
De paso, Mohamed sube de 42,9 a ~47: los cuerpos de Adreida eran justo lo que peor llevaba.

---

## v5 — El volado, las habilidades con nombre, y ver lo que roba Manos Largas · 2026-08-28

### El d20 dice qué hace falta y qué ha pasado

Tirabas el dado, salía un número… y ya. Lo que ese número significaba sólo se contaba en el
registro lateral, donde se pierde entre otras líneas.

Ahora el propio diálogo del dado lo dice: **«Necesitas 8 o más»** antes de tirar, y después
**«✔ Se convierte a tu causa»** en verde o **«✘ La campaña no convence a nadie»** en rojo.
Las **nueve** tiradas del juego están explicadas, y hay una prueba que falla si se añade una
sin explicar.

Cuando tira el rival, el diálogo se queda 2,6 s en vez de 1,5: hay más que leer.

### Cada acción se anuncia con texto

Unas jugadas se anunciaban y otras no, sin criterio: **sólo los Hechizos** enseñaban algo al
jugarse, y encima su etiqueta salía **únicamente si la jugaba el rival**. Ahora las cinco
clases dicen lo que pasa — *«Mohamed invoca a Brick y Brock»*, *«coloca Peaje del Puente»*,
*«saca Sombrero de Brick»*, *«cambia el escenario»* — con el color de su clase, y tanto si
juegas tú como si juega el rival. Los ataques también se anuncian siempre, aunque sólo se
hace una pausa para leerlos cuando ataca el rival: en tu turno ya sabes lo que haces.

De una Trampa rival no se dice cuál es, que va boca abajo. Sólo que la ha puesto.

### La moneda no cambia de iconos

Empezaba con un 🪙 genérico y terminaba en 👑 o ⚔️, que salían de la nada. Ahora enseña 👑
desde el principio, alterna entre las dos caras mientras gira, y se para en la que salga.
Los botones llevan el icono de su cara: **👑 CARA** y **⚔️ CRUZ**.

### Manos Largas enseña la carta

La Habilidad de Mohamed saca la carta de arriba del mazo rival y, según lo que sea, se la
queda o la tira. Eso pasaba **sin verse**: la carta salía y desaparecía, y sólo lo contaba
una línea del registro.

Ahora se enseña la carta a tamaño grande, con un cartel que dice a dónde va —**A TU MANO**
en verde si es un Objeto, **A LAS ALCANTARILLAS** si no— y por qué. Espera a que le des a
**Continuar**, y sólo entonces la carta vuela a su destino: nada se mueve antes.

Si lo hace el rival no hay botón, se cierra sola, pero se queda 2,6 segundos para que dé
tiempo a leerla. Y en online el rival ve lo mismo que tú.

### La partida empieza con un volado

Antes quien empezaba salía de un número aleatorio invisible y sólo lo contaba una línea del
registro. Ahora **eliges cara o cruz**, la moneda gira y ves si te toca. Las reglas no
cambian: sigue siendo 50/50 y el segundo sigue robando una carta extra.

No aparece en el tutorial (ahí empiezas tú siempre, para que la lección encaje) ni en online
(el orden lo fija el anfitrión). Y se puede saltar con `{volado:false}`, que es lo que usan
las pruebas — si no, se quedarían esperando un clic que nadie va a dar.

### Las cartas del tablero dicen qué saben hacer

Una carta en el tablero enseñaba tribu, palabras clave y números, pero no **el nombre de sus
habilidades**: había que acordarse o ampliarla. Ahora las lleva escritas: *Sacrificio* en
Eric, *Peaje* y *Acertijo* en Brick y Brock, *Mochila* y *Banco de Puntos* en Machete.

Van en chapas doradas y en cursiva, distintas de las palabras clave del juego (Prisa,
Provocar…), que son verdes: unas son reglas generales y otras son lo que hace **esa** carta.

Los nombres **salen del propio texto de la carta**, que ya los escribe en negrita y con dos
puntos. Así no hay una segunda lista que mantener: si se reescribe una carta, su chapa
cambia sola.

---

## v4 — Vuelta al clic, y el turno del rival se entiende · 2026-08-28

### Las cartas se vuelven a jugar pulsándolas

**Se revierte el arrastre de la v3.** Probándolo se trababa: el `#hand` tiene scroll
horizontal y en táctil el navegador se queda el gesto, así que arrastrar peleaba con
desplazar la mano. Se podría haber intentado arreglar con `touch-action`, pero el clic ya
funcionaba y no había ningún problema que resolver. Queda anotado por si algún día se
retoma.

### El turno del rival se lee

Sus jugadas iban a **200 ms**, menos de lo que se tarda en mirar. Ahora **620 ms**. Y antes
de cada ataque se anuncia a quién va: el atacante brilla y sale «X ataca a Y» entre los dos,
con 640 ms para leerlo. Un turno suyo con equipo, Trampa y ataque pasa de un borrón a unos
8 segundos comprensibles.

### Las activaciones enseñan su carta

Los Hechizos ya subían su carta al centro, pero **las Trampas sólo enseñaban su nombre en
texto** y **las Habilidades de Líder no enseñaban nada**. Ahora las tres comparten la misma
animación, con su etiqueta: *🪤 ¡TRAMPA! Risa Incontrolable de Tasha*, *✨ Manos Largas —
Mohamed*, *Adreida lanza Golpe a Sangre Fría*.

**Lo del rival se queda quieto casi el doble de tiempo que lo tuyo** (1 s frente a medio):
lo tuyo ya sabes lo que hace porque lo has elegido; lo suyo hay que leerlo.

### El halo verde, sólo en el tutorial

Jugando no hace falta adorno: las cartas que puedes usar se ven normales y las que no,
apagadas (0,4 de opacidad y más gris). El halo verde se queda en el tutorial, que es donde se
explica qué significa.

### El descuento deja de robarle el color al tipo

Con Mohamed, *Golpe a Sangre Fría* salía con el círculo verde en vez de violeta. No era un
fallo del tipo: es Hechizo de **Engaño** y su pasiva se lo rebaja 1 PD, así que el círculo se
pintaba de verde con un estilo en línea. La información es útil, así que se conserva de otra
forma: el círculo mantiene siempre el color de su clase y el descuento se marca con un
**anillo verde y una flecha ▼**.

---

## v3 — Cada carta tiene su color · 2026-08-28

No toca cartas ni mazos: **el balance de la v2 sigue igual**.

> **Nota:** esta versión también cambiaba las cartas a arrastrarse en vez de pulsarse. Se
> revirtió en la v4 porque se trababa en táctil; lo que queda de la v3 son los colores, el
> Infectado y la salida al menú.

### Cada clase de carta tiene su color

En el borde entero (antes sólo la franja de arriba) y en el círculo del coste, que iba
siempre azul para todas.

| Clase | Color |
|---|---|
| Personaje | azul |
| Hechizo | violeta |
| Trampa | rojo |
| Objeto | amarillo |
| Lugar | verde esmeralda |

Los cinco se distinguen de sobra: el par más parecido, azul y violeta, está a **45,7** de
distancia perceptual (por debajo de 25 se confunden de un vistazo).

**Dos chocaban con colores que ya significaban algo.** El rojo de Trampa contra el halo rojo
de «objetivo válido» estaba a 7,4 — casi el mismo color —, y el verde de Lugar contra el halo
verde de «puedes jugarla», a 16,8. En pantalla se veían como una sola mancha. Se arregló
**separando los dos anillos con un hueco del color del fondo**: primero el borde del tipo,
luego el hueco, luego el halo del estado. Y «puede atacar» dejó de pintar el borde de verde
—ahí manda el tipo— y se quedó con su anillo pulsante y el distintivo de espadas.

### Infectado se ve

La criatura Infectada se pone **verde** con su símbolo ☣, y **el daño de la infección sale en
verde** en vez de rojo: al ver el número ya sabes que lo que le pasa es la infección y no un
golpe. Ese verde está a 39,5 del verde de Lugares, así que no se confunden.

### Se puede salir al menú

Faltaba: desde una partida no había forma de volver al menú. Las guías, la selección de Líder
y el cartel de fin sí la tenían; una partida empezada era un callejón sin salida salvo
recargando la página. El botón va junto a Reglas, pide confirmación porque la partida se
pierde, y en online avisa al rival para que no se quede esperando. No lleva el bloqueo del
tutorial: el tablero se bloquea para que no te pierdas, pero irse siempre tiene que poder
hacerse.

---

## v2 — Composición de mazos · 2026-08-28

Primer rebalanceo. **Ninguna carta cambia lo que hace**: solo entran y salen copias de las
listas. Los cinco mazos siguen con 40 cartas y máximo 3 copias por carta.

### Efecto medido

2000 partidas, el bot jugando en los dos lados, antes y después.

| Mazo | v1 | v2 | |
|---|---|---|---|
| Adreida | 83,1 % | **72,9 %** | −10 |
| Rafaela | 54,6 % | 56,1 % | +2 |
| Mohamed | 35,5 % | **43,0 %** | +8 |
| Talesin | 37,8 % | 40,4 % | +3 |
| Fender | 39,0 % | 37,6 % | −1 |
| **Brecha** | **47,6** | **35,2** | −12 |

De regalo, dos cosas que no se buscaban:

- **Ninguna carta se queda sin jugarse.** En v1 había tres que estaban en un mazo y no se
  jugaban nunca (Contrahechizo, Púas Plateadas, Palabra de Curación): las tres son Rápidas y
  el bot no las usa. Salieron de las listas.
- **La ventaja de empezar baja de 54,1 % a 52,4 %**, más cerca del ideal.

Lo demás sigue sano: 11 turnos por jugador, las dos rutas de victoria vivas (13,5 % por
Pergamino), 0 errores y 0 partidas colgadas en 2000.

### Adreida — de 10 cuerpos de 4+ ATQ a 4

| Fuera | | Dentro | |
|---|---|---|---|
| Mazo de Brock | ×1 (quedan 1) | El Conserje | ×2 |
| Arco Dorado de Juan | ×1 | Bartolomeo | ×1 |
| Trol de la Mano Larga | ×2 | Machete (Glip) | ×1 |
| Juan Gabriel | ×1 | Augusto Bale | ×1 |
| Eman 69 | ×1 | Auxilio | ×1 |
| Talia Boss | ×1 | Armadura Mágica | ×1 |
| Edbor | ×1 | Zancada Larga | ×1 |
| Contrahechizo | ×1 | Saeta Guía | ×1 |

El equipo sale porque el Mazo de Brock da +3 ATQ: convertía cualquier cuerpo pequeño en uno
de 4+ y le devolvía el Provocar de *Intimidante*. Quitar gigantes sin quitar el equipo no
servía de nada.

**Se conserva 1 Mazo de Brock a propósito**: el tutorial enseña Objetos y Provocar con esa
carta exacta, y quitarla del todo dejaba la lección sin sostén.

### Mohamed — la respuesta que le faltaba a todo el mundo

| Fuera | | Dentro | |
|---|---|---|---|
| Gema del Conserje | ×1 | **Pergamino de Bola de Fuego** | ×1 |
| Copia de Jabón | ×1 | **Nube de Dagas** | ×2 |
| Disfrazarse | ×1 | Rayo de Escarcha | ×1 |
| El Conserje | ×1 | | |

Bola de Fuego (4 daño a todos los Personajes rivales) y Nube de Dagas **no estaban en ningún
mazo**. Es el cambio que más rinde: +10 puntos.

### Talesin — abaratar sin desarmarlo

| Fuera | | Dentro | |
|---|---|---|---|
| El Mago del Domo (8 PD) | ×1 | Rayo de Escarcha | ×2 |
| Lucy Fernando (6 PD) | ×1 | Nube de Dagas | ×1 |
| Púas Plateadas | ×2 | Proyectil Mágico | ×1 |
| Contrahechizo | ×1 | Rayo Abrasador | ×1 |
| Contrato del Notario | ×1 | Disipar Magia | ×1 |
| | | El Conserje | ×1 |

Su coste medio era 3,08, el más caro con diferencia, y las partidas duran 10 turnos: no
llegaba a jugar la mitad de su mazo.

**Tal, el Dragón Negro y Las Montañas de Tal se quedan.** La primera versión de este cambio
también los quitaba, y era un error doble. Uno de identidad: el mazo se llama «Ascensión»,
su arquetipo es *Sacrificio · Rampa · Tal*, y sin Tal la rampa no tiene a qué subir. Y otro
de mecánica, que se ve leyendo las cartas: **Las Montañas abaratan a los Dragones 2 PD**, así
que Tal sale por 8 y no por 10, y **Tal permite jugar el Pergamino sin Llaves** — o sea que
quitarlo dejaba al Pergamino y a El Domo, que duplica Llaves, sin la mitad de su plan.

Medido, además, quitarlos le hacía **perder**: Talesin caía a 34,4 % sin ellos y sube a
**40,4 %** con ellos. La versión que conserva la identidad del mazo es también la que
funciona mejor.

### Fender — más cuerpos, menos cartas que se quedaban en la mano

| Fuera | | Dentro | |
|---|---|---|---|
| Palabra de Curación | ×2 | Rayo de Escarcha | ×3 |
| Calentar Metal | ×1 | Adolfo y Remus | ×1 |
| Hongos del Bosque | ×1 | Eric | ×1 |
| Bob Carly | ×2 | Zancada Larga | ×1 |

### Rafaela — un retoque

| Fuera | | Dentro | |
|---|---|---|---|
| Palabra de Curación | ×1 | Saeta Guía | ×1 |

### Arrastres

Cambiar las listas obliga a revisar tres sitios que las citan por su nombre:

- **Guion del rival en el tutorial**: jugaba el Trol en su séptimo turno → ahora Brick y Brock.
- **Robos guionizados** (`TUT_MAZO[...].top`): Fender robaba Palabra de Curación y Bob Carly,
  Talesin robaba Púas Plateadas y Adreida el Trol. Sustituidos por cartas que siguen dentro.
- **Cartas clave de las guías** (`GUIAS[...].motor`): Adreida destacaba a Talia y al Trol, y
  Fender a Bob Carly; las dos actualizadas. La de Talesin sigue destacando a Tal y a Las
  Montañas, que se quedan en su mazo.

Hay una comprobación para esto: recorre `TUT_MAZO`, `TUT_FOE_SCRIPT` y `GUIAS[].motor` y
avisa si alguno cita una carta que ya no está en el mazo correspondiente. **Pasarla antes de
dar por buena cualquier versión que toque las listas.**

### Cómo quedan los mazos

Las cinco listas completas tras los cambios. Generadas desde el propio juego, no a mano.

#### Mohamed — «El Mago Pitero»

*Control · Engaño · Llaves* · 40 cartas · coste medio **2.50 PD** · cuerpos de 4+ ATQ: **3**

**Personajes (15)**

| | Carta | Coste | ATQ/PV | Tribu |
|---|---|---|---|---|
| 2× | El Conserje (Viejo Micket) | 1 | 0/1 | Kobold |
| 2× | Machete (Glip) | 1 | 0/2 | Goblin |
| 2× | Bartolomeo | 2 | 1/2 | Humano · Sirviente · Casa Boss |
| 3× | Brick y Brock | 3 | 3/4 | Goblin · Ogro |
| 2× | Minus | 3 | 2/5 | Minotauro · Valoria |
| 1× | Rantiago, el Mirrey | 3 | 2/2 | Dragón · Mirrey |
| 1× | Trol de la Mano Larga | 5 | 6/5 | Trol |
| 1× | Lucy Fernando (Lucifer) | 6 | 5/5 | Diablo · Infernal |
| 1× | El Mago del Domo | 8 | 4/8 | Humano · Mago |

**Hechizos (16)**

| | Carta | Coste |
|---|---|---|
| 3× | Ilusión Menor | 1 |
| 2× | Mensaje | 1 |
| 1× | Rayo de Escarcha | 1 |
| 2× | Disipar Magia | 2 |
| 2× | El Acertijo del Chícharo Castigado | 2 |
| 3× | Golpe a Sangre Fría | 3 |
| 2× | Nube de Dagas | 3 |
| 1× | Pergamino de Bola de Fuego | 5 |

**Trampas (4)**

| | Carta | Coste |
|---|---|---|
| 2× | Peaje del Puente | 1 |
| 1× | Risa Incontrolable de Tasha | 2 |
| 1× | Contrato del Notario Infernal | 4 |

**Objetos (4)**

| | Carta | Coste |
|---|---|---|
| 1× | Barra de Jabón | 1 |
| 1× | Sombrero de Brick | 1 |
| 1× | Llave del Mago | 3 |
| 1× | Pergamino de Deseo Ilimitado | 7 |

**Lugares (1)**

| | Carta | Coste |
|---|---|---|
| 1× | El Puente de Brick y Brock | 1 |

#### Fender — «Gira Mundial»

*Aggro · Canciones · Tempo* · 40 cartas · coste medio **1.70 PD** · cuerpos de 4+ ATQ: **0**

**Personajes (18)**

| | Carta | Coste | ATQ/PV | Tribu |
|---|---|---|---|---|
| 3× | Discípulo de Rul | 1 | 1/2 | Elfo · Discípulo |
| 1× | Machete (Glip) | 1 | 0/2 | Goblin |
| 3× | Matildus | 1 | 1/1 | Elfo · Discípulo |
| 3× | Adolfo y Remus | 2 | 2/2 | Elfo · Discípulo |
| 3× | Bartolomeo | 2 | 1/2 | Humano · Sirviente · Casa Boss |
| 1× | Petunia | 2 | 1/3 | Bestia · Vaca |
| 3× | Eric | 3 | 3/3 | Humano · Paladín · Casa Boss |
| 1× | Titaus | 3 | 2/3 | Elfa · Discípulo |

**Hechizos (16)**

| | Carta | Coste |
|---|---|---|
| 3× | Burla Viciosa | 1 |
| 3× | Canción de Taberna | 1 |
| 3× | Rayo de Escarcha | 1 |
| 3× | Zancada Larga | 1 |
| 3× | Balada de Valoria | 3 |
| 1× | Paso Atronador | 3 |

**Trampas (3)**

| | Carta | Coste |
|---|---|---|
| 1× | Destello Protector | 2 |
| 2× | Risa Incontrolable de Tasha | 2 |

**Objetos (2)**

| | Carta | Coste |
|---|---|---|
| 1× | Sombrero de Brick | 1 |
| 1× | Mazo de Brock | 2 |

**Lugares (1)**

| | Carta | Coste |
|---|---|---|
| 1× | Antro Juan | 2 |

#### Adreida — «De Frente»

*Midrange · Paladines · Provocar* · 40 cartas · coste medio **2.27 PD** · cuerpos de 4+ ATQ: **4**

**Personajes (18)**

| | Carta | Coste | ATQ/PV | Tribu |
|---|---|---|---|---|
| 2× | El Conserje (Viejo Micket) | 1 | 0/1 | Kobold |
| 2× | Machete (Glip) | 1 | 0/2 | Goblin |
| 3× | Bartolomeo | 2 | 1/2 | Humano · Sirviente · Casa Boss |
| 3× | Augusto Bale | 3 | 2/4 | Humano · Tomsage |
| 1× | Brick y Brock | 3 | 3/4 | Goblin · Ogro |
| 2× | Eric | 3 | 3/3 | Humano · Paladín · Casa Boss |
| 1× | Aldrick Boss | 4 | 2/3 | Humano · Noble · Casa Boss |
| 1× | Eman 69 | 4 | 4/3 | Humano · Cazarrecompensas |
| 1× | Lucius Bale | 4 | 4/4 | Humano · Paladín · Tomsage |
| 2× | Sir Horton | 4 | 4/3 | Humano · Paladín |

**Hechizos (13)**

| | Carta | Coste |
|---|---|---|
| 3× | Armadura Mágica | 1 |
| 3× | Zancada Larga | 1 |
| 3× | Auxilio | 2 |
| 3× | Saeta Guía | 2 |
| 1× | Modificar las Reglas | 5 |

**Trampas (5)**

| | Carta | Coste |
|---|---|---|
| 2× | Destello Protector | 2 |
| 1× | Esporas del Demonio | 2 |
| 2× | Colapso de Paja | 3 |

**Objetos (3)**

| | Carta | Coste |
|---|---|---|
| 2× | Collar Mágico de Agua | 2 |
| 1× | Mazo de Brock | 2 |

**Lugares (1)**

| | Carta | Coste |
|---|---|---|
| 1× | Tomsage bajo asedio | 2 |

#### Rafaela — «Los Doce Discípulos»

*Enjambre · Fe · Aguante* · 40 cartas · coste medio **2.05 PD** · cuerpos de 4+ ATQ: **1**

**Personajes (17)**

| | Carta | Coste | ATQ/PV | Tribu |
|---|---|---|---|---|
| 3× | Discípulo de Rul | 1 | 1/2 | Elfo · Discípulo |
| 1× | El Conserje (Viejo Micket) | 1 | 0/1 | Kobold |
| 2× | Machete (Glip) | 1 | 0/2 | Goblin |
| 3× | Matildus | 1 | 1/1 | Elfo · Discípulo |
| 2× | Adolfo y Remus | 2 | 2/2 | Elfo · Discípulo |
| 1× | Petunia | 2 | 1/3 | Bestia · Vaca |
| 1× | Minus | 3 | 2/5 | Minotauro · Valoria |
| 3× | Titaus | 3 | 2/3 | Elfa · Discípulo |
| 1× | Juan Gabriel | 6 | 5/6 | Humano · Valoria · Arquero |

**Hechizos (17)**

| | Carta | Coste |
|---|---|---|
| 3× | Taumaturgia | 1 |
| 1× | Auxilio | 2 |
| 2× | Bendición de Rul | 2 |
| 1× | Ceguera/Sordera | 2 |
| 2× | Leche de Petunia | 2 |
| 2× | Manos Ardientes | 2 |
| 3× | Saeta Guía | 2 |
| 2× | Espíritus Guardianes | 4 |
| 1× | Rulchete, la Polimorfia Verdadera | 5 |

**Trampas (3)**

| | Carta | Coste |
|---|---|---|
| 2× | Destello Protector | 2 |
| 1× | Esporas del Demonio | 2 |

**Objetos (2)**

| | Carta | Coste |
|---|---|---|
| 1× | Barra de Jabón | 1 |
| 1× | Collar Mágico de Agua | 2 |

**Lugares (1)**

| | Carta | Coste |
|---|---|---|
| 1× | Antro Juan | 2 |

#### Talesin — «Ascensión»

*Sacrificio · Rampa · Tal* · 40 cartas · coste medio **2.70 PD** · cuerpos de 4+ ATQ: **4**

**Personajes (17)**

| | Carta | Coste | ATQ/PV | Tribu |
|---|---|---|---|---|
| 3× | El Conserje (Viejo Micket) | 1 | 0/1 | Kobold |
| 1× | Machete (Glip) | 1 | 0/2 | Goblin |
| 3× | Matildus | 1 | 1/1 | Elfo · Discípulo |
| 1× | Petunia | 2 | 1/3 | Bestia · Vaca |
| 1× | Bob Carly | 3 | 1/6 | Bestia · Caracol |
| 3× | Eric | 3 | 3/3 | Humano · Paladín · Casa Boss |
| 1× | Rantiago, el Mirrey | 3 | 2/2 | Dragón · Mirrey |
| 1× | Eman 69 | 4 | 4/3 | Humano · Cazarrecompensas |
| 1× | Sir Horton | 4 | 4/3 | Humano · Paladín |
| 1× | Edbor | 5 | 5/4 | Humano · Paladín · Oathbreaker |
| 1× | Tal, el Dragón Negro | 10 | 9/9 | Dragón |

**Hechizos (13)**

| | Carta | Coste |
|---|---|---|
| 1× | Hongos del Bosque | 1 |
| 2× | Rayo de Escarcha | 1 |
| 1× | Cuerda Dimensional | 2 |
| 2× | Disipar Magia | 2 |
| 2× | Proyectil Mágico | 2 |
| 1× | Nube de Dagas | 3 |
| 2× | Rayo Abrasador | 3 |
| 2× | Aliento de Ácido | 4 |

**Trampas (4)**

| | Carta | Coste |
|---|---|---|
| 2× | Esporas del Demonio | 2 |
| 2× | Tal Habla por el Cadáver | 3 |

**Objetos (4)**

| | Carta | Coste |
|---|---|---|
| 2× | Puntos Robados | 2 |
| 1× | Llave del Mago | 3 |
| 1× | Pergamino de Deseo Ilimitado | 7 |

**Lugares (2)**

| | Carta | Coste |
|---|---|---|
| 1× | Las Montañas de Tal | 3 |
| 1× | El Domo | 4 |

### Lo que esta versión NO arregla

Adreida sigue en 72,9 %. Se probaron seis palancas y ninguna la baja de ~70 % moviendo solo
cartas:

| Palanca | Adreida queda en |
|---|---|
| Esta v2 | 72,9 % |
| v2 + *Intimidante* solo a Paladines | 70,9 % |
| v2 + *Golpe Directo* sin anular el contraataque | 69,8 % |
| Quitarle *Intimidante* entera, sin tocar mazos | 62,5 % |
| Quitar solo el «sin contraataque», sin tocar mazos | 83,3 % — nada |
| Mejorar el bot contra cuerpos grandes | 83,8 % — nada |

El experimento que lo explica: **Fender con el mazo de Adreida sube a 52,9 %** y **Adreida
con el mazo de Fender baja a 53,4 %**. Cada mitad vale unos +14 puntos por separado, pero
juntas valen +44. No hay una carta rota: hay una acumulación de ventajas que se refuerzan.

**Cerrar la brecha pide tocar estadísticas o costes**, que es lo que queda para la v3.

### Cómo leer estos números

Los juega el bot del juego, en los dos lados. La comparación entre mazos es justa, pero mide
lo bien que le va a cada uno **en manos de este bot**. Fender y Talesin dependen de encadenar
jugadas, que es lo que peor hace un bot, así que sus números pueden estar por debajo de lo
que valen en manos de una persona.

---

## v1 — Versión inicial

Las cinco listas del documento de diseño original, tal cual. 84 cartas jugables más 4 fichas,
5 Protagonistas, mazos precon de 40.

---

## Sin numerar

Arreglos y mejoras que no cambian cómo se juega. El detalle está en el historial de git.

- **Los Líderes también se pueden ilustrar** (build 70). El juego sólo ponía ilustraciones a
  las cartas, así que un Líder dibujado en el editor no se veía por ningún lado. Ahora sale en
  la pantalla de elegir Protagonista, en el panel de la mesa y en la ficha grande que aparece
  al pasar por encima. El editor los nombra `lider_<id>`.
- **Sincronizar ya no borra lo que no tengas a mano.** El editor reescribía `encuadres.json`
  entero con lo que hubiera en ese navegador, y como el almacén es por navegador y por puerto,
  sincronizar una carta desde otro sitio dejaba fuera del índice a todas las demás: los `.webp`
  seguían en la carpeta, pero el juego dejaba de verlos. Pasó de verdad —Augusto y Lucius
  desaparecieron del índice al sincronizar a Fender— y se recuperaron antes de publicar. Ahora
  el índice se funde con el que ya había y sólo se retiran las entradas cuya imagen ya no está.
  El ZIP hace lo mismo.
- **El editor de cartas entra por el menú** (build 68). `estudio.html` viaja con el juego y
  se publica con él, así que una actualización manda las dos cosas a la vez y el botón nunca
  apunta a una página que no existe. En tu ordenador se abre directo; publicado pide una
  contraseña. **Esa contraseña oculta, no protege**: la página se descarga entera en el
  navegador de quien entra, así que la comprobación se puede saltar leyendo el código —se
  guarda el hash en vez del texto para que no se lea de un vistazo, y nada más. No es grave
  porque el editor sólo escribe en el navegador de quien lo abre y en carpetas que esa
  persona elige a mano: desde ahí nadie puede tocar este juego ni sus ilustraciones.
  Protección de verdad pide un servidor.
- **El editor sabe qué ilustraciones ya están puestas.** Guardaba tus imágenes sólo en el
  almacén del navegador, que es por origen —el puerto cuenta—, así que abrirlo en otro puerto
  lo dejaba en blanco y daba por perdidas ilustraciones ya publicadas. Ahora también lee
  `art/encuadres.json`, que es lo que de verdad viaja con el juego.
- **Arreglado el dibujo superpuesto al emoji en el editor.** Las cartas llegan del juego ya
  ilustradas desde `art/`, y el editor añadía encima su propia decisión: quedaban marcadas a
  la vez como con dibujo y sin dibujo, y se pintaba el emoji sobre la ilustración.
- **Todas las cartas se maquetan igual** (build 66). Hasta ahora convivían dos diseños: las
  que ya tenían ilustración usaban el dibujo a sangre con el pie de datos abajo, y las demás
  seguían con el recuadro de arte a media carta. Como las ilustraciones van entrando de una
  en una, el mosaico parecía de dos juegos distintos. Ahora el acomodo es el mismo para las
  84: lo único que cambia es si el fondo lo pone un dibujo o el emoji sobre el color de su
  clase.
- **El texto se ajusta también en vertical.** El de reglas está limitado a cuatro líneas y
  **39 de las 84 cartas se cortaban a media frase**, justo donde dice qué hace la carta. No
  bastaba con encoger la letra —el límite se mide en líneas, así que al bajar la fuente
  encogía la caja con ella—: ahora se mide el hueco que ocupa a su tamaño normal, se busca la
  fuente con la que el texto entero cabe en ese mismo hueco y se suben las líneas
  permitidas. La carta no crece y quedan 3 cartas recortadas en vez de 39; esas tres se leen
  al pasar el cursor por encima.

- **Estudio de cartas** (`estudio.html`) para ver las ilustraciones puestas antes de mandarlas
  al juego, y **banco de balance** (`balance.html`), que es el que produce los números de
  arriba.
- **Tutorial por mazo**: eliges Protagonista y los 34 pasos se generan para esa lista.
- Arreglos del tutorial: cartas repetidas en la mano, pasos que no esperaban a que pudieras
  cumplirlos, y la lección de estrategia que se perdía si ganabas antes de llegar a ella.
- El arnés de pruebas (`tests.js`, `?test=1`) y la publicación con freno (`publicar.sh`).
