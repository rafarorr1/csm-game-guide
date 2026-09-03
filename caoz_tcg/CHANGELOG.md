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

## v10 — La Ascensión de Talesin deja de premiar a los que ya no están · 2026-09-03

### El cambio

A la pasiva **Digno de Ascender** se le añade una frase:

> *Después de ascender, cada Personaje que entre a tu campo nace **Celestial** y con **+2/+2**.*

Lo demás sigue igual: 5 Fichas de Gracia, +5 Alma y +2/+2 a los Celestiales que haya en mesa.

### El fallo que arregla

Su Ascensión era **circular**: para conseguirla tienen que morírsele **cinco aliados**, y el
premio era para **los aliados que le queden vivos**. Medido sobre 150 partidas suyas:

- asciende en el **64%** de ellas — conseguirlo no era el problema;
- pero en el **turno 15**, cuando la partida media dura 11;
- con **0,96 Personajes** en mesa y **0,24 Celestiales**;
- **en 75 de 96 ascensiones el +2/+2 no alcanzaba a nadie.**

Media habilidad de su Líder no llegaba a existir.

### Lo que se descartó antes de dar con esto

Cinco versiones de una carta nueva y tres formas de tocar la pasiva, todas medidas:

| | Talesin | brecha |
|---|---|---|
| Antes | 41,0 | 20,0 |
| Carta «Trascender»: Celestial a todos | 40,2 | 21,2 |
| Carta: + 1 Ficha de Gracia | 41,4 | 20,6 |
| Carta: + 3 Fichas de Gracia | 41,1 | 19,6 |
| Carta: premio en cartas y PD | 42,7 | 18,8 |
| **Pasiva · herencia** | **45,5** | **18,2** |
| Pasiva · botín (3 cartas, +2 PD máx) | 52,2 | 17,2 |
| Pasiva · las dos | 56,8 | 16,1 |

Lo que enseña la tercera fila: **acelerar la Ascensión no servía de nada**. Con tres Fichas de
Gracia de regalo se quedaba en 41,1. El problema nunca fue *cuándo* llegaba el premio, sino que
el premio no valía nada. Por eso ninguna carta lo arreglaba y sí lo hace la pasiva.

Las dos últimas filas se descartaron por pasarse: dejaban a Talesin tercero y primero. Pasar
del último al primero no es balancear.

### Ya en el juego

Cuatro tandas de 2000 partidas con el cambio puesto:

| | Mohamed | Fender | Adreida | Rafaela | Talesin | brecha |
|---|---|---|---|---|---|---|
| Antes | 44,0 | 45,7 | 60,7 | 58,6 | 41,0 | 20,0 |
| Ahora | 41,5 | 44,5 | 59,9 | 58,8 | **45,2** | **18,8** |

Talesin por tanda: 44,5 · 45,4 · 45,2 · 45,6. Poca varianza para lo que suele dar este banco:
el efecto es real.

**Y deja algo a la vista:** el último pasa a ser **Mohamed** (41,5). La brecha se cierra un
punto largo, pero el suelo sigue ahí y ahora tiene otro dueño. Adreida sigue en 60, y ya se
midió que recortarle sus cartas de soporte no la mueve.

Explicado en los cuatro sitios donde se cuenta la pasiva: la ficha del Líder, el aviso del
momento de ascender, el tutorial de Talesin y su guía de estrategia. El editor de cartas lo
lee del propio juego, así que sale solo.

---

## v9 — Tal Habla por el Cadáver deja de ser una carta muerta · 2026-09-03

### El cambio

**Antes:** «Cuando un aliado muere **y controlas un Dragón**: vuelve al campo con 1 PV y +2 ATQ
hasta el final del turno rival.»
**Ahora:** sin el requisito de Dragón.

### Por qué

El banco la venía marcando tanda tras tanda como **trampa que nunca salta**, y al mirar por qué
la respuesta era obvia: el único Dragón de peso del mazo de Talesin es Tal, que cuesta **10 PD**.
La condición no se cumplía casi nunca, así que la carta ocupaba dos huecos de su mazo sin hacer
nada. Sin el requisito hace lo que promete —que tus muertos vuelvan un turno más—, que además
es exactamente el plan de Talesin.

### Lo que mide el banco: nada

Seis tandas de 2000 partidas con el cambio, frente a tres sin él:

| | Mohamed | Fender | Adreida | Rafaela | Talesin | brecha |
|---|---|---|---|---|---|---|
| Antes | 43,3 | 45,4 | 59,8 | 60,3 | 41,1 | 20,2 |
| Después | 44,0 | 45,7 | 60,7 | 58,6 | **41,0** | **20,0** |

**El balance no se mueve.** Talesin se queda igual, y sus tandas van de 38,6 a 43,2: pura
varianza. Una medición anterior de sólo dos tandas había dado +1,3 y parecía una mejora — no lo
era, era ruido. Con 12000 partidas el efecto desaparece.

Lo que sí cambia, y es consistente en las seis tandas: **ninguna trampa del juego se queda sin
saltar**. Antes ésta salía siempre en esa lista.

Se hace igualmente, y por eso: una carta muerta en un mazo es peor que una carta débil. La
débil la juegas y decides que no valía; la muerta ocupa sitio y no llega a existir. Arreglarla
es diseño, no balance, y conviene no confundir las dos cosas.

---

## Sin numerar — El Cajón: 23 cartas nuevas, todavía fuera del juego · 2026-09-03

No cambia ninguna partida: **ninguna de estas cartas está en un mazo**, así que no puede
salir jugando. Se ven en «Ver todas las cartas» → **🗄️ El Cajón**, que es donde se prueban
antes de decidir si entran.

### De las 25 propuestas, 23

Dos ya existían con el mismo nombre y el mismo efecto, así que no se duplicaron:

| Propuesta | Ya estaba como |
|---|---|
| Copia de Jabón | **Copia de Jabón** (3 PD) — «elige un Objeto rival, copia a tu mano» |
| Trampa de Escalera Colapsable | **Colapso de Paja** (3 PD) — Costo 4+ que ataca: 4 de fuego, cancela y aturde |

Otras dos rozaban cartas existentes y se hicieron distintas a propósito, para que aporten en
vez de repetir:

- **Rulchete de Bajo Presupuesto** — el `rulchete` de siempre transforma un aliado en un Dragón
  7/7; éste invoca una ficha 0/6 con Provocar. Uno es una amenaza, el otro un escudo.
- **Esporas de Sir Horton** — las `esporas` existentes infectan a todo el campo rival cuando
  muere un aliado; ésta infecta **y** posee a un solo objetivo. Área contra precisión.

### Nada de reglas nuevas

Están hechas con el vocabulario que el motor ya resuelve —Aturdido, Infectado, Poseído, Prisa,
Sigilo, Arquero, fichas, daño de Fuego, destruir Objetos—, así que no hubo que tocar el motor.
Donde el efecto original pedía una regla que no existe, se cambió por la pieza más cercana:

- *doble ataque* → **Arquero** (golpea sin recibir contraataque);
- *atacar a 3 objetivos* → 1 daño a tres rivales distintos, que es lo mismo contado en daño;
- *robar una unidad* → **Poseído**, que ya es el «cambia de bando» del juego.

Tres cartas cambiaron de tipo respecto a la propuesta: los Lentes, la Espada de Luz, los
Brazos de Agua, el iPad Kid y la Espada de la Bóveda son **Objetos**, no Hechizos — se
equipan, que es lo que decía su texto.

### Comprobado

El arnés juega las 23 con un tablero preparado para que todas tengan objetivo válido, dispara
las 6 trampas y verifica que ninguna se ha colado en un mazo. Tres rondas seguidas en verde.

### ¿Y si las metiéramos en los mazos? — medido antes de decidir

`balance.html?cajon=1` y `?cajon=2` parchean las listas **en memoria** y juegan con ellas. Los
mazos del juego no se tocan: al recargar sin el parámetro vuelven a ser los de siempre. Cada
propuesta quita tantas cartas como mete, así que los mazos siguen siendo de 40.

| | Mohamed | Fender | Adreida | Rafaela | Talesin | brecha |
|---|---|---|---|---|---|---|
| **Mazos de hoy** | 43,3 | 45,4 | 59,8 | 60,3 | 41,1 | **20,2** |
| **A** — cambios en los cinco | 42,3 | 50,8 | 68,3 | 49,6 | 38,9 | **29,5** |
| **B** — sólo a los tres flojos | 45,2 | 45,6 | 60,4 | 58,7 | 40,1 | **20,5** |

Tres tandas de 2000 partidas cada fila.

**A empeora el balance**, y de forma consistente (31,0 · 29,5 · 27,9). Dos culpables:

- **Espada de Luz Celestial en Adreida.** +3 ATQ cruza el umbral de 4 y su pasiva regala
  Provocar: la sinergia que la hacía atractiva es justo la que la rompe. Adreida ya era de las
  fuertes y se va a 68.
- **Cambiarle remoción por curación a Rafaela.** Perder Manos Ardientes y Ceguera por el Humo
  de Bob Carly la hunde 10 puntos. Curar 2 a todo el campo no sustituye a matar algo.

**B no mueve nada**: 20,5 contra 20,2 es ruido. Ninguno de esos tres cambios se nota.

Y una lección de método que conviene no olvidar: **los porcentajes son relativos entre sí**.
En A, el +5,4 de Fender y buena parte del +8,5 de Adreida no eran mérito de sus cartas nuevas,
sino del desplome de Rafaela — hay menos partidas que perder contra ella. Se ve al comparar con
B, donde Fender lleva las mismas cartas y sube 0,2. Un Líder puede «mejorar» sin tocarlo.

**Conclusión: ninguna de estas cartas mejora el juego tal como está.** Las que hacen algo lo
hacen para mal. Se quedan en el Cajón para los mazos de Gero y Pitágoras, que es donde se
diseñaron para ir.

---

## v8 — Mano nueva: el barajado deja de decidir partidas · 2026-09-02

### La regla

**Si en tu primer turno no puedes jugar absolutamente nada**, el juego te ofrece devolver la
mano al mazo, barajarlo y robar otra del mismo tamaño.

Condiciones, todas a la vez:

- es tu **primer** turno (turno 1 o 2, según quién empiece);
- **ninguna** carta de tu mano es jugable ahora mismo — no sólo por el Costo: `canPlay` mira
  también el sitio en el campo, los requisitos y si hay objetivos válidos;
- **una sola vez** por jugador y partida. La segunda mano es la que hay.

Vale para los dos lados. La CPU la toma siempre que le toca, así que no es una ventaja del
jugador: es la misma red para los dos.

### Por qué

Con 1 PD el primer turno, una mano sin nada de Costo 1 no es una mano difícil: es un turno
perdido de regalo, decidido por el barajado antes de que juegues nada. Esto no te da poder
—sólo aparece cuando ya no podías hacer nada—, sólo quita partidas resueltas por el reparto.

### Lo que mide el banco

Tres tandas de 2000 partidas con la regla y tres sin ella, todo lo demás igual:

| | brecha entre Líderes | turnos muertos |
|---|---|---|
| **Sin** la regla | 20,5 · 20,5 · 20,6 → **20,5** | 18 · 24 · 29 → **~24** |
| **Con** la regla | 21,8 · 23,9 · 18,8 → **21,5** | 13 · 20 · 13 → **~15** |

Los dos números dicen cosas distintas y las dos importan:

- **El balance no se mueve.** Un punto de brecha, con las tandas *con* la regla yendo de 18,8 a
  23,9: eso es el ruido de siempre, no un efecto. Ningún Líder gana ni pierde por esto —los
  cinco se quedan donde estaban: adreida ~61, rafaela ~58, fender ~45, mohamed ~44, talesin ~40.
- **Los turnos muertos caen un 35%**, de ~24 a ~15 por tanda. Ése era el objetivo, y es lo
  único que la regla cambia de verdad.

No bajan a cero, y está bien que no lo hagan: la regla sólo mira el primer turno. Un turno
muerto en el sexto sigue siendo parte del juego.

### Cubierto por el arnés

`tests.js` comprueba las cuatro cosas que no pueden fallar: que se ofrece con la mano muerta,
que rebarajar no pierde ni inventa cartas, que no se puede repetir, y que **no** se ofrece
teniendo algo jugable.

### Cómo se presenta

La pregunta va **sobre unas cartas concretas**, así que taparlas era justo lo que no podía
hacer. El cartel sale sin velo ni desenfoque, arriba del todo y lejos de la mano, y sólo él
recibe el ratón: la mesa se ve entera y puedes pasar el cursor por tus cartas para leerlas
mientras decides.

Además la mano se **reparte a la vista** antes de preguntar —una carta tras otra saliendo del
mazo, con su pausa— y la nueva también. Preguntar de golpe sobre unas cartas que aún no has
mirado no es una decisión, es un susto.

Un detalle que sólo se ve al usarlo: las cartas que no puedes jugar salen apagadas a
propósito, pero en este momento son **todas**, y es justo cuando hay que mirarlas. Mientras el
cartel está en pantalla, la mano se enciende.

### Lo que salió al añadirla

Tres cosas que no se veían venir, las tres del mismo sitio: la pregunta comparte overlay con
todo lo demás y llega justo después del volado.

- **Se comía el cartel del volado.** El primer turno empieza al acabar el volado, que es
  exactamente cuando esto salta, y la pregunta reemplazaba el cartel antes de que diera tiempo
  a leer quién empieza. Ahora espera a que el overlay quede libre. Esto le pasaba al jugador,
  no sólo a las pruebas.
- **Colgaba las pruebas que juegan como jugador.** El juego se para a preguntar y en el arnés
  no hay nadie que conteste. Sólo ocurría cuando el barajado daba una mano muerta, así que se
  veía como una tanda lenta o un fallo raro en otra prueba. El arnés contesta ahora que sí; el
  juego no tiene por qué saber que lo están probando.
- **Destapó un fallo viejo en la prueba del volado**, que leía a quién le tocaba empezar de la
  partida *anterior*: hasta que `newGame` corre, `G` sigue siendo el de antes. Pasaba
  desapercibido porque casi siempre coincidía.
- **Y podía aparecer sobre una partida que ya no existía.** La pregunta se para a esperarte, y
  mientras espera puede empezar otra partida —desde el menú, o encadenando—. Al volver, seguía
  como si nada y se plantaba encima de la nueva, pisando lo que hubiera en pantalla, empezando
  por el cartel del volado. Ahora comprueba que su partida sigue viva en cada pausa. Es el
  mismo cuidado que ya llevaba el turno de la CPU, y por la misma razón.

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

- **Cortinilla de VS al empezar la partida** (build 98). Entre elegir rival y ver la mesa, las
  dos cartas entran desde los lados, chocan en el centro con destello y fuego, aguantan cuatro
  segundos con el <b>VS</b> en medio y se apartan revelando el tablero. Sólo la ve quien juega:
  en partidas automáticas, silenciosas o del arnés no se monta siquiera — cuatro segundos de
  adorno no pueden colarse en una tanda de 2000 partidas.
- **Los avisos de pantalla se apilan en vez de pisarse.** Todos salían en el centro exacto del
  tapete, así que dos a la vez quedaban uno encima del otro y no se leía ninguno. Con **Puntos
  Robados** pasaba siempre: gana un contador por cada rival que muere, y en un turno mueren
  varios. Ahora cada aviso ocupa su fila y, cuando uno se va, los de abajo suben a su sitio.
- **Elegir Protagonista es un carrete, en dos pasos** (build 95). Antes eran cinco fichas idénticas en fila y
  había que leerlas todas para decidir; ahora las cinco van en abanico, la elegida al frente a
  tamaño completo con su retrato, y debajo una ficha con lo que hay que leer de ella: pasiva,
  habilidad, mazo y dificultad. Se gira con las flechas, con el teclado o pulsando una carta.
  La posición de cada carta sale de **una sola variable** —su distancia al frente, dando la
  vuelta— y de ahí salen desplazamiento, giro, escala y brillo, así que el movimiento es
  coherente y se anima solo.
  Las cartas giran **en el espacio**, no inclinadas en el plano: la perspectiva la pone la
  pista y cada carta rota sobre su eje vertical y se aleja según lo lejos que esté del frente,
  así que se les ve el canto y el abanico tiene fondo. Sin `preserve-3d`, que en este proyecto
  ya rompió una vez el poder pulsar las cartas: basta con la perspectiva en el contenedor.
  Y son **dos pasos**: primero tu Protagonista y, al aceptarlo, tu rival — con el mismo carrete,
  para que la segunda decisión no parezca un apéndice de la primera. Antes el rival era una
  fila de fichas idénticas debajo, compitiendo con la tuya. Dos puntitos dicen por dónde vas, el
  botón de atrás vuelve un paso en vez de salir, y «🎲 Al azar» sirve para los dos.
  **El carrete se desliza.** Antes saltaba, y no por falta de animación: se rehacía la pista
  entera en cada giro, así que los nodos eran nuevos y el navegador no tenía nada que mover.
  Ahora las cartas se crean una vez y sólo cambian su distancia al frente.
  **La ficha tiene alto fijo** — cabe el texto del Líder más largo y los demás lo centran
  dentro. Con alto variable, el bloque crecía o encogía al girar y el carrete daba un salto.
  Y el paso del rival **tiñe la sala de rojo**: no es adorno, dice sin palabras que ya no
  estás eligiendo lo tuyo. Los nombres se centran, la letra de la ficha crece, y se van la
  cinta de «ELEGIDO» —la carta del frente ya se distingue de sobra— y el botón de la guía.
  **El nombre no se mueve nunca** (build 96): la ficha va en dos partes, el nombre y el
  arquetipo clavados arriba y el texto repartido en lo que sobra. Centrando el bloque entero,
  el título subía o bajaba según lo largo que fuera lo de abajo —con Talesin quedaba 6 px más
  alto— y al girar el carrete daba un brinco. Ahora el nombre cae a la misma altura con los
  cinco y el texto queda con el mismo hueco arriba que abajo.
- **El tutorial deja de hablar de la carta equivocada, y sólo permite lo que necesita**
  (build 91). Dos lecciones se armaban dando por hecho qué había bajado el rival: una llamaba
  **Objeto** a lo que fuera —llegó a decirlo de Augusto Bale— y la otra explicaba la habilidad
  de Bartolomeo aunque hubiera jugado otra cosa. Pasaba porque el guion del rival, cuando no
  podía jugar la carta prevista, se la saltaba **en silencio** y desplazaba las lecciones un
  turno. Ahora los textos se arman con la carta que de verdad ha bajado —Objeto, Personaje o
  Hechizo, con sus números y su texto—, y el guion baja lo que pueda en vez de pasar el turno
  en blanco, para que la lección no se quede esperando.
  Y lo segundo: mientras el tutorial esperaba una jugada del rival te dejaba hacer **cualquier
  cosa** en tu turno. Ahora sólo deja terminar el turno, que es lo único que hace falta para
  llegar al del rival. De los 34 pasos no queda ninguno abierto, y el arnés lo comprueba paso
  por paso. Los cinco tutoriales siguen llegando al final sin un solo paso atascado.
- **La mesa deja de moverse al bajar cartas** (build 90). Las filas de campo no reservaban
  altura: vacías medían 7 px y con cartas 117. Como el tapete reparte el espacio sobrante entre
  sus cinco carriles, bajar un Personaje recolocaba el tablero entero —el campo rival subía
  17 px, la fila del medio 25, las trampas 10— y las zonas acababan pisándose entre ellas.
  Ahora cada fila reserva siempre la altura de su hueco dibujado, esté vacía o llena, así que la
  fila y su guía quedan alineadas pase lo que pase. Comprobado con la mesa vacía, con una carta
  y con los dos campos llenos más trampas: las cinco zonas dan exactamente las mismas
  coordenadas, sin un solo solape, y tampoco se mueven al señalar o seleccionar una carta.

- **El texto ya no toca el filo de la carta** (build 79). El pie se estira 5 px fuera de la carta
  para que su velo llegue al borde, y el relleno de abajo —.3 em— no llegaba a devolver ese
  margen: en las cartas sin números, Hechizos y Trampas, la última línea acababa contra el
  canto. Ahora ninguna de las 84 queda pegada.
- **El editor enseña a los Líderes como se ven jugando** (build 77). Salían como tres cartas, y
  un Líder no se ve nunca así: sale en el panelito de la mesa y en la tarjeta de elegir
  Protagonista. Se encuadraba para un formato que no existe. Ahora se replican esos dos
  montajes, con las mismas clases y el mismo CSS del juego.
- **El panel del Líder con dibujo vuelve a tener forma de carta.** Al esconder el emoji se
  escondían también sus 26 px de alto, y el panel quedaba cuadrado —distinto al de un Líder sin
  dibujo. Se le guarda el hueco: ahí es además donde cae la cara de la ilustración.
- **La ilustración nunca se sale de su carta** (build 73). Al poner un dibujo a un Líder, en el
  editor la tarjeta se estiraba hasta tapar la interfaz entera —los menús desaparecían—. La
  imagen se metía a su tamaño real, 750×1050 px, porque las reglas que la encajan colgaban de
  `.card` y una tarjeta de Líder no es una carta: se quedaba fuera y entraba en el flujo.
  Ahora el dibujo va dentro de una caja que recorta, y las reglas cuelgan de la propia imagen
  en vez de su contenedor, así que valen en cualquier sitio donde se ponga una. Da igual el
  tamaño del archivo y da igual cuánto la acerques: se queda dentro de la carta. Comprobado
  con una imagen de 7000×5000 al 300 % de acercamiento —las tres vistas siguen midiendo
  74×106, 112×158 y 224×316.
- **Retirada la ilustración de Fender** para poder rehacerla. Y al hacerlo se vio que publicar
  sólo copiaba: el archivo de una ilustración quitada se quedaba en la web para siempre. No se
  veía —el índice ya no la nombra— pero ahí seguía. Ahora se retira también de lo publicado.
- **Una ilustración a medio guardar ya no tira el editor** (build 72). Al convertir la imagen,
  el navegador puede devolver nada —según el formato o el tamaño—, y eso se guardaba igual: un
  registro sin imagen. Al abrir el editor reventaba antes de pintar nada, y en cada recarga
  otra vez, sin más salida que borrar los datos del navegador a mano. Ahora esos registros se
  saltan, se limpian y se dice cuáles eran; y de entrada no se guardan: si la conversión falla
  se reintenta en png y, si tampoco, se avisa sin tocar nada.
  De paso, el aviso de arranque dejó de echarle la culpa al servidor pasara lo que pasara
  —mandaba a levantar uno que ya estaba levantado.
- **El encuadre se ajusta dentro del editor: mover y acercar** (build 71). Antes sólo se podía
  subir o bajar la ilustración; para cualquier otro ajuste había que reencuadrarla fuera y
  volver a cargarla. Ahora se arrastra la carta grande para moverla y se usa la rueda para
  acercar, con deslizadores y un botón de centrar como respaldo. El encuadre pasa de un número
  a tres —`{x, y, z}`—, y **los encuadres antiguos siguen valiendo**: un número suelto se lee
  como el desplazamiento vertical de siempre.
  Para esto el dibujo pasa de ser un fondo a ser una imagen dentro de la carta, que es lo que
  permite acercarlo sin recalcular nada a cada tamaño de carta.
- **Preguntar antes de borrar una ilustración.** «Quitar» borraba en el acto, y la imagen sólo
  vive en tu navegador. Ahora pide confirmación, y avisa aparte si esa carta ya está publicada
  —en ese caso el `.webp` sigue en la carpeta y el juego la seguirá enseñando.
- **La fusión del índice, con pruebas.** La pieza que ya borró ilustraciones una vez se sacó
  aparte y tiene cinco comprobaciones que se ejecutan con `estudio.html?prueba=1`. Una es
  exactamente el caso que falló: sincronizar sin nada cargado no debe borrar nada.
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
