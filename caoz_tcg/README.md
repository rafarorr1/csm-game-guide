# Caoz Con Todo — El Juego de Cartas del Domo

Simulador jugable del TCG. Single-file: `index.html`, sin dependencias, sin build.
Ábrelo y ya.

```bash
python3 -m http.server 8745 --directory caoz_tcg
```

También está registrado en `.claude/launch.json` como `caoz-tcg`.

## Qué hay dentro

| Modo | Qué es |
|---|---|
| **🎓 Tutorial** | Partida guiada de 34 pasos narrada por el DM Gero, **con el mazo que tú elijas**, pensada para alguien que **nunca ha jugado un TCG**. Avanza al ritmo del jugador y —lo importante— **pausa la partida durante el turno del rival** para explicar cada jugada suya: qué carta bajó y por qué, de dónde sale el Provocar, qué pasa en un combate, por qué salta tu Trampa. Al terminar, la partida sigue siendo real: la juegas hasta ganar. |
| **⚔️ Partida contra el Domo** | Los 5 Protagonistas con sus 5 mazos preconstruidos de 40 cartas, contra una IA que juega curva, quita, buffs, trampas, habilidades activadas y respuestas rápidas. |
| **👥 Jugar con un amigo (online)** | Uno crea la sala y recibe un **código de 5 caracteres**; el otro lo escribe y a jugar. Sin cuentas, sin instalar nada, sin servidor propio. |
| **📖 Guías de estrategia** | Una guía por Protagonista escrita sobre su lista real: cómo ganas, el motor, plan por turnos, la jugada estrella, mulligan, cómo pierdes, enfrentamientos y el mazo entero. Con la dificultad y el winrate medido en las partidas de prueba. |
| **🃏 Ver todas las cartas** | Galería filtrable por tipo con el texto completo de las 84 cartas. |
| **📜 Reglas completas** | Referencia de reglas, también accesible en mitad de la partida. |

Implementado del documento de diseño: **5 Líderes** (pasiva + habilidad, y la
alterna de Adreida), **25 Personajes**, **38 Hechizos** (13 originales + 25 del
Grimorio), **8 Trampas**, **8 Objetos**, **5 Lugares** y **4 fichas** (Petunia
Sagrada, Ilusión, Poseído, Dragón Celestial Morado). Total 84 cartas jugables +
5 Líderes + 4 fichas.

> El documento dice "92 cartas" contando 28 Personajes; la lista nominal del
> propio documento tiene 25 más las fichas. Aquí están todas las que aparecen
> con nombre y estadísticas.

### Cómo está hecho el tutorial

Tres tipos de paso, en una sola lista (`TUT_STEPS`):

- **`say`** — Gero explica algo; avanzas con el botón. Su texto puede ser un array:
  se muestra en burbujas encadenadas en vez de en un ladrillo.
- **`task`** — tienes que hacer algo. Lleva un predicado `wait:(g)=>bool` sobre el
  estado de la partida y un `allow:{...}` que declara **qué se puede tocar**:
  `{hand:['discipulo']}`, `{end:true}`, `{leader:true}`, `{attack:'face'}` o
  `{free:true}`. Todo lo demás de la mano y los botones se bloquea y se pone en
  gris, para que no te pierdas jugando otra cosa mientras aprendes. Elegir
  objetivo de un Hechizo permitido nunca se bloquea. **No hay botón para saltar**
  ni el paso ni el tutorial: se avanza jugando.
- **`beat`** — espera un **evento del motor** (`turno`, `juega`, `ataque`, `muerte`,
  `trampa`, `finTurno`, `dado`) con un filtro opcional `when`. Cuando el evento
  ocurre, `tutBeat()` **bloquea el motor** (`await` sobre una promesa que resuelve
  el botón) y explica lo que acaba de pasar. Esto es lo que convierte el turno del
  rival de un borrón de dos segundos en una lección.

Sin botón de saltar, lo que impide quedarse encerrado es `tutSatisfiable()`: en
cada sondeo comprueba si el paso se puede cumplir **ahora** (¿tienes esa carta y
te alcanzan los PD? ¿hay alguien que pueda atacar? ¿es tu turno?). Si no lo es
durante ~7 s, Gero pasa solo; y un `beat` que lleva una ronda entera sin recibir
su evento también avanza. Sólo salta cuando es genuinamente imposible, así que
pensarte la jugada nunca lo dispara.

Durante un beat, `body.tutpause` desactiva los clics del tablero para que no se
pueda jugar por encima de la explicación.

Detalle que importa más de lo que parece: en un paso `task` **no hay botón**.
Antes había uno dorado que decía «Entendido →», igual que el de los pasos de
información; el jugador lo pulsaba creyendo que cerraba el mensaje, se saltaba la
jugada sin hacerla y el turno nunca terminaba — con lo que el siguiente `beat`
esperaba para siempre a un rival que no llegaba a jugar. Como red de seguridad,
un `beat` en espera detecta si sigue siendo el turno del jugador y cambia el
cartel a «👉 termina tu turno para que Adreida juegue», resaltando el botón.

### Un tutorial por mazo

El tutorial no enseña «el juego» en abstracto: enseña **tu** mazo. Al entrar
eliges Protagonista en la misma pantalla de siempre (con su dificultad en
estrellas y su lema) y los 34 pasos se **generan** para esa lista.

`TUT_MAZO[lid]` es la receta de cada Protagonista, y son datos, no texto:

```js
fender:{ c1:'discipulo', c2:'bartolomeo', quita:'burla', trampa:'tasha',
         mano:[...5 cartas...], top:[...6 cartas que robarás...],
         quitaTxt:'…', quitaExtra:'…', trampaTxt:'…' }
```

- `c1` — la criatura barata con la que aprendes a bajar y a atacar.
- `c2` — la segunda, que enseña Prisa / Provocar / el cuerpo grande del mazo.
- `quita` — **cómo quita este mazo un bloqueador**: Fender se lo lleva con *Burla
  Viciosa* (y de paso enseña Inspiración), Mohamed con *Sangre Fría*, Adreida con
  un *Machetazo*, Rafaela con una *Saeta*, Talesin con un *Proyectil*.
- `trampa` — la Trampa característica, para que veas saltar la tuya.
- `mano` y `top` fijan la mano inicial y las seis cartas que robarás, así que la
  lección siempre encaja con lo que tienes delante.

`buildTut(lid)` monta la lista con esa receta, y los cuatro pasos finales se
escriben solos desde `GUIAS[lid]`: cómo ganas, el motor y la jugada estrella, y
las tres formas de perder con ese mazo. Estrategia y tutorial no se pueden
desincronizar porque son la misma fuente.

Dos cosas que costaron un bug cada una:

- Las condiciones de los pasos miran **si la carta salió de tu mano**
  (`!P(ME).hand.includes(id)`), no cuántas criaturas hay en el campo. Con lo
  segundo el tutorial se colgaba en cuanto el rival mataba a la criatura recién
  bajada — que con Talesin pasa casi siempre.
- **La partida puede acabar antes de la lección.** Con Fender ganas por turno 8,
  o sea antes del paso 25: cerrabas el tutorial sin haber visto nunca cómo se juega
  tu mazo — justo lo que venías a aprender. Ahora `endGame()` salta a los pasos
  marcados `strat:true`, Gero termina de contarlo y sólo entonces sale el cartel de
  victoria (`TUT.endArgs`). Como después del fin ya no llegan eventos del motor, un
  `beat` pendiente se lee como un cartel normal.
- Durante un `beat` el tablero se bloquea… **salvo si todavía es tu turno**. Un
  beat espera un evento que casi siempre viene del rival; si te quedaba turno, el
  cartel te decía «pulsa Terminar turno» con el botón deshabilitado y la partida no
  volvía a moverse jamás. `tutAllow()` devuelve ahora `{free:true}` mientras
  `G.active===ME`. Regla que vale para todo: **si la interfaz pide una acción, esa
  acción tiene que estar habilitada.**
- Los pasos de atacar aceptan también que **termines el turno**. Talesin juega
  cuerpos de 1 punto de vida: llega el momento de golpear y a veces no queda
  nadie en pie. El paso lo dice y te deja seguir en vez de esperar a la red de
  seguridad.

El **rival va guionizado** durante el tutorial (`TUT_FOE_SCRIPT`: una lista de
`{play:[...], attack:bool}` por turno) para que la narración siempre encaje con lo
que hay en la mesa — el Objeto que dispara *Provocar*, el choque que enseña el daño
simultáneo, el ataque que salta la Trampa. Cuando el guion se agota, vuelve la IA
normal. Dos mecanismos evitan que se desincronice: `tutFlush()` cierra de golpe las
tareas ya cumplidas antes de procesar un evento, y `tutBeat()` mira hasta 3 pasos
por delante por si el motor se adelantó (sin saltarse nunca una tarea pendiente).

## Cómo funciona el online

**Transporte: dos naturalezas a la vez.** No hay backend. Se publica y se escucha
por los seis canales de `MQTT_URLS` + `HTTP_RELAYS` en paralelo, y el primero que
funcione lleva la partida:

- **MQTT sobre WebSocket** (`broker.emqx.io`, `test.mosquitto.org`,
  `broker.hivemq.com`). Cliente MQTT 3.1.1 mínimo escrito a mano —CONNECT,
  SUBSCRIBE, PUBLISH QoS0, PING— sin librerías. Es la vía principal: los
  WebSockets **no pasan por CORS**, usan otros dominios y puertos, y empujan al
  instante.
- **HTTP (ntfy)** con sondeo `GET /<topic>/json?poll=1&since=<id>`, que recupera
  lo enviado mientras no mirabas.

Tres cosas que costaron fallos reales en producción y conviene no deshacer:

- **La cola no descarta un mensaje jamás.** La primera versión lo tiraba si en ese
  instante no había ninguna vía conectada — y al arrancar tardan un segundo en
  abrirse, así que el `join` se perdía y la sala esperaba para siempre. Ahora se
  reintenta hasta entregarlo.
- **Un canal caído se aparta 30 s** (`ch.saltar`). Si no, cada mensaje se comía el
  tiempo de espera de los relevos muertos: la partida iba a un turno cada 30 s.
- **Las intenciones del invitado se confirman.** Cada una lleva `aid`; si no llega
  el acuse en 3,5 s se reenvía sola, y el anfitrión ignora las repetidas por ese
  identificador, así que nunca se ejecutan dos veces. En un relevo público se
  pierden mensajes: el protocolo tiene que sobrevivir a eso, no confiar en que no
  pase.

`?relay=https://otro/` fuerza un único relevo HTTP — útil para probar en local.

**Arquitectura: anfitrión autoritativo.** El anfitrión corre el motor entero y
publica una fotografía del estado **ya volteada a la perspectiva del invitado**
(él se ve siempre como jugador 0). El invitado no ejecuta reglas: reconstruye ese
estado, lo dibuja con la interfaz de siempre y manda **intenciones**
(`play`/`attack`/`end`/`leader`/`act`/`relic`). Se eligió así, y no lockstep, por
una razón concreta: con dos motores en paralelo habría que sincronizar barajados
y d20, y cualquier divergencia rompería la partida en silencio. Con un solo motor
no hay nada que cuadrar.

**Decisiones a distancia.** Cuando el motor necesita algo del bando rival —elegir
objetivos, responder una pregunta, un Hechizo Rápido, tirar el d20— el anfitrión
manda una petición con la lista de opciones legales y **espera la respuesta**
(`netAsk`, con 90 s de margen antes de resolver solo). El invitado la contesta con
su interfaz normal: `stepTarget` acepta un `poolRef` ya calculado.

**Cuidados.**
- La cola de envío **agrupa**: si hay dos estados pendientes sólo se manda el
  último, y hay 200 ms entre mensajes para no saturar el relevo público.
- El registro distingue **líneas privadas** (`log(txt, cls, true)`): lo que robas
  o buscas no viaja al rival. Si añades una carta que revele información sólo a su
  dueño, márcala así.
- La mano del rival y su mazo se mandan como huecos vacíos, no como cartas.
- La pantalla de sala muestra un **diagnóstico** (enviados/recibidos/fallos y por
  qué relevo va la partida). Si alguien reporta que no conecta, eso dice dónde
  mirar sin adivinar.

**Límites honestos.** El anfitrión ejecuta la partida, así que su máquina conoce
el estado completo: es una mesa entre amigos, no un torneo. Y el código es la
única llave de la sala.

## El tapete

El tablero es un tapete con textura de fieltro, filo dorado, las zonas rotuladas
en el canto (TRAMPAS · CAMPO RIVAL · TU CAMPO · TRAMPAS) y los huecos marcados,
para que se lea como una mesa de verdad aunque esté vacía.

Cada jugador tiene su **Líder como carta** en el borde de su lado del tapete, no
como icono en una barra: lleva su ❤️ Alma, su Habilidad con el costo, y al pasar
el cursor enseña pasiva, habilidad y lore. **Atacar al Alma es golpear esa carta**
y **usar la Habilidad es hacerle clic** — se ilumina en verde cuando puedes.

A la izquierda, el **raíl** con las cuatro pilas — mazo y alcantarillas de cada
jugador:

- **Mazo** — cuántas cartas quedan por robar. Al robar sale una carta volando de
  ahí, así el contador significa algo.
- **Alcantarillas** — el número y **la carta de arriba a la vista**; clic para
  revisar todo el descarte de los dos jugadores.

Esos contadores se quitaron de las barras superiores para no duplicarlos.
`renderPiles()` los dibuja; el raíl se estrecha en pantallas pequeñas
(92 → 70 → 54 px) y el tablero no desborda a 375 px.

## Cómo se juega en la interfaz

- **Borde verde con pulso y distintivo ⚔** = ese Personaje puede atacar ya.
- **Pasa el cursor por cualquier carta** para verla completa: texto de reglas
  entero, palabras clave y estados, objetos equipados con su propio texto, y las
  estadísticas actuales frente a las base (`Base 6/5 · ahora 6/8`).
- **Clic en una carta de la mano** para jugarla. Borde verde = la puedes pagar y
  tiene objetivos válidos; gris = no (pasa el cursor o haz clic y te dice por qué).
- **Clic en un Personaje tuyo** lo selecciona para atacar; después clic en un
  Personaje rival o en el **retrato del rival** para golpear su Alma. Si no puede
  atacar, te explica el motivo (enfermedad de invocación, Aturdido, Cláusula…).
- Los objetivos legales se marcan con un halo rojo pulsante.
- **Escape** cancela una selección; **Espacio** termina el turno.
- Las **Trampas** se activan solas cuando ocurre su condición, como en la mesa.
- Cuando el rival hace algo a lo que puedes responder con un **Hechizo Rápido**
  (Contrahechizo, Púas Plateadas, Palabra de Curación) se abre una ventana de
  respuesta. Solo aparece si tienes carta y PD para usarla.

## Efectos visuales

Todo evento del juego se **ve**, no solo se escribe en el log:

| Evento | Qué se ve |
|---|---|
| Ataque | El atacante embiste hacia su objetivo y un tajo cruza el punto de impacto |
| Daño a un Personaje | Sacudida, destello rojo, ráfaga y un `−N` flotante |
| Daño al Alma | Temblor del tablero, viñeta roja, sacudida del retrato y un `−N` grande |
| Curación | Destello verde y `+N` |
| Buff / debuff | `+2 ATQ +1 PV` en dorado (o rojo si baja) |
| Hechizo | La carta sube al centro, crece y estalla en un anillo del **color de su subtipo** (Fuego naranja, Fe dorado, Engaño morado, Canción azul…) |
| Personaje que entra | Aparece con un rebote |
| Muerte | La carta se ladea, se apaga y cae, con una calavera flotante |
| **d20** | Se abre el dado con el nombre de la carta y **lo tiras tú**: gira, se para, y sólo al pulsar Continuar se aplica el efecto. 20 dorado con ¡CRÍTICO!, 1 rojo con ¡PIFIA! Las del rival se lanzan solas y se cierran a 1,5 s |
| Trampa | Cartel volteándose con el nombre de la Trampa |
| **Objeto que actúa** | Chapa con su icono y qué hizo: al equiparse, cuando el Collar de Agua para el Fuego, cuando la Barra de Jabón recupera Copia de Jabón, cuando Arma Mágica lo devuelve a la mano, cuando Puntos Robados suma contador o el Pergamino avanza |
| Robar | Una carta sale volando del mazo hacia tu mano |
| Muerte | La carta cae girando **hacia la pila de Alcantarillas**, que da un pulso al recibirla |
| Cambio de turno | Rótulo "TU TURNO" / "TURNO DE X" |
| Llaves y PD | El contador de la barra da un pulso |

Los números son **placas**, no texto suelto: fondo casi opaco, borde y resplandor
del color del efecto, 36 px (58 px para el Alma), tipografía tabular y una pausa
de ~0,5 s quietos antes de desvanecerse, que es lo que da tiempo a leerlos. Si
caen varios seguidos en el mismo sitio se escalonan, y se recolocan solos para no
salirse por los bordes de la pantalla. El contador concreto que cambió dentro de
la carta (ATQ o PV) pega un salto iluminado, para que se vea *dónde* miró.
Los tamaños están en `.fxnum` con sus dos *media queries*.

Tres decisiones de implementación que conviene conocer antes de tocarlo:

- **Los buffs se detectan solos.** `renderField` guarda el ATQ/PV anterior en el
  `dataset` de cada carta y anuncia cualquier cambio. Así funciona con las 84
  cartas sin escribir un efecto por carta, y también con auras y equipo.
- **Las cartas del campo persisten entre renders.** Antes `render()` hacía
  `innerHTML=''` y las reconstruía, lo que mataba cualquier animación en curso.
  Ahora `renderField` reutiliza el elemento por `data-uid` y solo actualiza su
  contenido. Es lo que hace posible sacudir, embestir o desvanecer una carta.
- **Si un efecto sale de su contenedor, anima un clon sobre `#fx`.** La fila del
  campo lleva `overflow-x:auto` (para no pisar la carta de Líder), así que la
  carta que muere se recortaba en el borde en vez de llegar a la pila. El clon en
  la capa de efectos no lo sufre. Lo mismo vale para cualquier cosa que cruce
  zonas del tapete.
- **El orden importa: primero se ve, luego pasa.** `roll()` muestra el dado
  ANTES de abrir las ventanas de repetición (Púas Plateadas, Destello Protector)
  y antes de aplicar la Pifia. Si añades un efecto que reaccione a una tirada,
  colócalo después de `rollDice()`, no antes.
- **La duración se encadena con `sleep()`, nunca con `Animation.finished`.** Esa
  promesa puede quedarse sin resolver aunque `playState` ya sea `"finished"`
  (pasa cuando el navegador estrangula la pestaña) y **cuelga el motor**, porque
  el daño espera a que acabe la animación. Verificado en vivo. Si añades un
  efecto nuevo, usa `await nap(ms)` y `fxGone(el, ms)`.

`nap()` y `FXON()` se anulan solos cuando `document.hidden` es cierto: si el
jugador se va a otra pestaña el navegador estrangula los temporizadores a ~1 s,
así que la partida se resuelve al instante y no parece colgada al volver.

## Las guías de estrategia

Viven en `GUIAS` (sección 15), una entrada por Líder. Están escritas **sobre las
listas reales de `DECKS`**: si cambias un mazo, revisa su guía — los números que
cita (cuántas fuentes de Llave, cuántos Personajes de Costo 1‑2, qué sale en qué
turno) dejan de ser ciertos.

Cada guía tiene: `lema`, `ganas`, `motor` (los ids de las 5 cartas clave, que se
dibujan como cartas de verdad) + `motorTxt`, `turnos` (tramo → qué haces),
`combo` (la jugada estrella con sus números), `mano` (qué conservar de salida),
`pierdes` (los errores que cuestan la partida) y `vs` (los cuatro
enfrentamientos). `GUIA_DATOS` guarda el winrate medido en el arnés, que es lo
que hace honesta la nota de dificultad.

## Arquitectura

Todo el juego vive en un `<script>` dentro de `index.html`, en 13 secciones
numeradas y comentadas:

1. `LEADERS` — los 5 Protagonistas.
2. `CARDS` — la base de datos de cartas.
3. `DECKS` — los 5 mazos preconstruidos.
4. Estado y motor (daño, muertes, estados, robo, d20, ventanas de Trampa/Rápido).
5. Flujo de turno (`startTurn` / `endTurn`).
6. Jugar cartas (`playFromHand`, `useLeader`, `useAct`).
7. Combate (`canAttack`, `legalTargets`, `doAttack`).
8. Objetivos (`targetPool`, `resolveTargets`).
9. Interfaz (render, diálogos, inspector).
10. IA (`aiScore`, `aiTargets`, `aiPickAttack`, `aiTurn`).
11. Tutorial (`TUT_MAZO` + `buildTut()` → `TUT_STEPS`).
12. Pantallas.
13. Arranque.

### Modelo de datos

Una carta es un objeto declarativo con *hooks* asíncronos:

```js
C('horton',{n:'Sir Horton', t:'personaje', c:4, a:4, h:3,
  tr:['Humano','Paladín'], r:1, art:'🐴',
  x:'texto de reglas en HTML',
  mustAttack:true,
  die:async(g,s,u)=>{ ... }          // s = bando, u = la unidad
});
```

Hooks disponibles: `enter` / `enterTg` (al entrar, con objetivos),
`die` (al morir), `onStart` (inicio del turno de su controlador),
`aura` (efecto continuo, se recalcula solo), `act` (habilidad activada con
costo), `keys` (palabras clave), `cast` + `tg` (Hechizos), `on` + `can` + `fire`
(Trampas), `mod` / `gkeys` / `grants` (Objetos), `req` (condición para poder
jugarla).

Las **estadísticas se recalculan enteras** en `recalc()` a partir de
`base + permanentes(pA/pH) + temporales(tA/tH) + hasta-el-turno-rival(nA/nH) +
auras(aA/aH) + objetos`. Nunca se mutan `atk`/`maxHp` a mano: se toca el
modificador y se recalcula. El **daño (`u.dmg`) se guarda** en la unidad, como
en las reglas.

### Añadir una carta

1. Añade un `C('id',{...})` en la sección del tipo que toque.
2. Si necesita objetivos, declara `tg:[{k:'unidadEnemiga',min:1,max:1,f:u=>...}]`.
   Los selectores son `unidadAliada`, `unidadEnemiga`, `unidad`,
   `objetivoEnemigo` (incluye el Alma) y `objetoEnemigo`.
3. Si solo se puede jugar en ciertas condiciones, añade `req:(g,s)=>...` —
   **la misma condición filtra el botón de la mano y a la IA**.
4. Métela en algún mazo de `DECKS` (máx. 3 copias, 1 si es ★).
5. Si la IA debe valorarla distinto, añade su caso en `aiScore`.

### Añadir un Líder

Un objeto en `LEADERS` con `pasiva` (texto), `habCost`, `habName`, `habTg`
opcional y `hab_do`. Las pasivas que son continuas se aplican en `recalc()`
(mira `Intimidante` de Adreida) o en el punto del flujo que toque (`Inspiración`
de Fender está en `playFromHand`, `Rebaño de Rul` también, `Digno de Ascender`
en `killUnit`). Luego su mazo en `DECKS`.

## Interpretaciones de reglas

El documento deja algunas cosas abiertas; así se resolvieron:

- **Aturdido** dura hasta el final del siguiente turno de su controlador, así
  que se pierde exactamente un turno propio.
- **Provocar inalcanzable**: si el único Provocar rival tiene Vuelo y tú no
  puedes alcanzarlo, quedas libre para atacar a otros o al Alma.
- **Combate simultáneo**: el contraataque usa el ATQ del defensor *antes* de
  recibir el golpe, aunque muera.
- **Trampas**: se activan automáticamente (una sola por evento, como dicen las
  reglas). Las decisiones que la carta deja al rival (Peaje, Calentar Metal,
  Lucy Fernando) sí se preguntan.
- **Hechizos Rápidos**: hay ventana de respuesta al declarar un ataque, al
  lanzar un Hechizo y al tirar un d20. No hay límite por turno — es una de las
  palancas que el documento deja pendiente de decidir.
- **Pifia**: el 1 natural cuesta 1 Alma en cualquier tirada de carta, además de
  lo que diga la tabla propia de la carta.
- **Rulchete** revierte al final de tu siguiente turno conservando el daño en
  proporción.
- **Campo lleno**: los efectos que ponen Personajes (fichas, robos de control,
  Tal Habla por el Cadáver) simplemente no entran si ya hay 5.

## Datos de playtest

El simulador trae un arnés que juega partidas solo, sin animaciones ni render.
En consola:

```js
await TCG.setupMatch('fender','adreida',{fast:true,auto:true,silent:true});
while(!TCG.G.over) await TCG.autoTurn(0);   // bando 0 con la misma IA
```

**320 partidas** (los 20 emparejamientos × 16), ambos bandos con la misma IA:

| | Winrate |
|---|---|
| Adreida | 90 % |
| Rafaela | 52 % |
| Fender | 37 % |
| Mohamed / Talesin | 36 % |

- 0 errores, 0 partidas sin resolver.
- **Turno medio de cierre: 10.**
- **16 % de las partidas las gana el Pergamino**, no el daño — la condición
  alternativa está viva.

Lectura, con la advertencia de que un bot codicioso favorece el midrange de
cuerpos grandes: **Adreida está muy por encima**. *Intimidante* hace que casi
todo su mazo tenga Provocar gratis, así que ataca cuándo y a quién quiere y el
rival no. Palancas obvias si quieres tocarlo: subir el umbral de *Intimidante* a
5 ATQ, limitarlo a Paladines, o bajar la densidad de cuerpos 4+ del mazo. Lo
contrario de lo que temía la sección 12 del documento: aquí el aggro de Fender
**no** gana demasiado antes del turno 6; se queda corto contra los muros.

## Notas técnicas

- Las pausas de animación se saltan con `G.fast`, así que el arnés corre una
  partida completa en ~12 ms. Ojo: en una pestaña en segundo plano el navegador
  estrangula `setTimeout` a ~1 s, y sin `fast` eso hace que el juego parezca
  colgado — no lo está.
- `G.auto` hace que los diálogos y la selección de objetivos del jugador humano
  los resuelva la IA (solo para pruebas).
- `window.TCG` expone el motor entero para depurar desde consola.
