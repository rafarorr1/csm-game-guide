# Registro de versiones — el TCG del Domo

Qué cambia en cada versión del juego y **por qué**, con los números que lo justifican.
Lo de arriba es lo más reciente.

Cómo se anota una versión nueva:

- **v2, v3…** cuando cambian las reglas, las cartas o los mazos — o sea, cuando una partida
  se juega distinto. Aquí va siempre el antes y el después medido con `balance.html`.
- Los arreglos y las mejoras de interfaz no llevan número: van en «Sin numerar» abajo, o en
  el historial de git si son menores.

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

- **Estudio de cartas** (`estudio.html`) para ver las ilustraciones puestas antes de mandarlas
  al juego, y **banco de balance** (`balance.html`), que es el que produce los números de
  arriba.
- **Tutorial por mazo**: eliges Protagonista y los 34 pasos se generan para esa lista.
- Arreglos del tutorial: cartas repetidas en la mano, pasos que no esperaban a que pudieras
  cumplirlos, y la lección de estrategia que se perdía si ganabas antes de llegar a ella.
- El arnés de pruebas (`tests.js`, `?test=1`) y la publicación con freno (`publicar.sh`).
