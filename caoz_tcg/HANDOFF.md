# HANDOFF — para el agente (o la persona) que continúe el desarrollo

Fecha: 2026-09-07 · build 180 (beta, rama feature/aaa-combat-cards) · v18 · dirección: https://juego.caozcontodo.com/

Este documento está escrito para que otro asistente pueda seguir desde aquí sin haber visto
nada antes. Es la puerta de entrada; los detalles están en los archivos que se citan. Orden de
lectura sugerido: este archivo → `AGENTS.md` (las reglas de trabajo, cortas) → `README.md`
(cómo se juega y cómo está montado, largo) → `CHANGELOG.md` (el porqué de cada cambio, con
números) → el código.

---

## 1. Qué es y dónde está

Un juego de cartas coleccionables (TCG) jugable en el navegador, en español, ambientado en la
serie de D&D «Caoz Con Todo» de Rafa. Dos jugadores entran al Domo con un Protagonista como
Líder y un mazo de 40 cartas; gana quien deja el Alma rival en 0, quien formula el Deseo con el
Pergamino tras sobrevivir dos turnos, o quien reúne la corte con El Rey.

- **Repo:** GitHub `rafarorr1/csm-game-guide`, carpeta `caoz_tcg/`, rama `main`. Es la única
  carpeta versionada del repo (el resto está en `.gitignore` a propósito).
- **Publicado en:** `https://juego.caozcontodo.com/` (Cloudflare Pages) y, de espejo,
  `https://rafarorr1.github.io/csm-game-guide/tcg/` (GitHub Pages). Los dos sirven la rama
  `gh-pages`, carpeta `tcg/`.
- **Sin dependencias, sin build, sin cuentas.** Archivos sueltos. Para trabajar:
  `python3 -m http.server 8745 --directory caoz_tcg` y abrir `http://localhost:8745/`.
- Seis Protagonistas (Mohamed, Fender, Adreida, Gero, Rafaela, Talesyn), 84 cartas del set
  base + 21 del Cajón (hechas, fuera de los mazos) + fichas = 122 en `CARDS`. Modos: tutorial
  guiado por mazo, partida contra la IA, online contra un amigo, galería, guías, récords.

## 2. Arquitectura: un motor, dos pantallas, piezas compartidas

```
motor.js      el motor: cartas, Líderes, mazos, reglas, turno, combate, IA, red, guías,
              guion del tutorial. NO toca el DOM.
index.html    pantalla de escritorio (CSS + JS). Redirige a los teléfonos a movil.html.
movil.html    pantalla del teléfono, de pie. Hecha de cero sobre el mismo motor.
final.js      cargador de final-core.js (final, récords y volado) y polish-aaa.js
              (cartas y animaciones de combate), compartidos por las dos pantallas.
sw.js         service worker (la app instalable). manifest.webmanifest + art/icono-*.png.
tests.js      arnés (?test=1). balance.html: banco de balance. estudio.html: editor de arte.
publicar.sh   publicación con guardas. servidor_pruebas.py / leer_resultado.py: su apoyo.
biblia.sh/.py La Biblia del Domo en PDF, generada desde los datos del juego.
```

Los tres scripts (`motor.js`, `final.js`, el inline de cada pantalla) son **scripts clásicos que
comparten el ámbito global**. El motor llama a la pantalla **por nombre**: `render()`,
`ask()`, `pickCard()`, `pickFrom()`, `rollDice()`, `log()`, `toast()`, `setPrompt()`,
`clearPrompt()`, `fx*()`, `tutRender()`/`tutBeat()`/`tutNext()`/`tutEnd()`, `showEnd()`,
`startMatch()`, `netStatus()`, `chatRecibe()`… Cada una existe en las dos pantallas (en una
puede ser vacía: `fichaTactil` en escritorio). Si añades una llamada nueva desde el motor,
añádela en `index.html` **y** en `movil.html`.

Cómo se decidió el corte (v15): al motor va lo que no toca el DOM ni ejecuta nada al cargar.
`publicar.sh` rechaza un `motor.js` con `document.`, `$(`, `innerHTML` o `.classList`.
Un alias de nivel superior que nombre una función de pantalla (`const tutShow = tutRender`)
va con la pantalla: en el motor aborta el archivo entero al cargar.

`window.TCG` (definido en cada pantalla) expone el motor para consola y pruebas. Ojo:
`TCG.doAttack` es una copia; para espiar o parchear hay que usar la global (`window.doAttack`),
que es la que el motor llama.

## 3. El motor y el flujo de turno

Estado global `G` (creado en `newGame`): `pl:[jugador0, jugador1]` (`P(s)`), `active`,
`turnNo` (cuenta medios turnos; el turno «humano» es `Math.ceil(turnNo/2)`), `phase`
(`inicio` → `puntos` → `principal` → `combate` → `final`), `over`, `log`, `place` (el Lugar
activo), `busy` (la IA juega), `resolving` (reentrada de `doAttack`), `fast`/`silent`/`auto`
(modos de prueba), `tutorial`, `online`/`guest`. `ME = 0` siempre es «yo» en la pantalla; en
línea el anfitrión voltea el estado para que el invitado también se vea como 0.

Un jugador (`newPlayer`): `leaderId`, `L` (el Líder), `deck`, `hand`, `field` (unidades),
`traps`, `grave`, `relics`, `alma` (20), `pd`/`pdMax` (Puntos, tope 10, +1 por turno),
`banked` (Machete guarda 2), `llaves`, `leaderUsed`, `attacked`, `scrollTurns`, `limbo`,
`clouds`, `gracia`/`ascended` (Talesyn), `manoRehecha`.

Una unidad (`mkUnit`): `uid`, `card`, `side`, `owner`, `tribes`, `dmg`, modificadores
`pA/pH` (permanentes), `tA/tH` (hasta fin de turno), `nA/nH` (hasta fin del turno rival),
`aA/aH` (auras), `keysOwn`/`aKeys`/`keys` (palabras clave propias, por aura, y la unión),
`objs`, `sick` (entró este turno), `attacked`, `stunned`, `infected`, `possessed`, etc.
**`atk` y `maxHp` los calcula `recalc()` entero cada vez**; nunca se mutan a mano.

Flujo:

1. `setupMatch(a, b, opts)` → `newGame`, reparto (5 cartas, 6 el segundo), `startTurn(first)`.
   En las pantallas, `startMatch()` envuelve esto con la cortinilla VS y el volado.
2. `startTurn(s)`: limpia banderas, Cuerda Dimensional, **Fase de Puntos** (`pdMax+1`, `pd` =
   `pdMax − pdTax + banked + pdBonus`, +1 al segundo jugador en su primer turno), quita
   `sick`/`stunned`, `recalc`, comprueba **El Rey** (corte reunida = victoria), roba 1
   (`draw`), `onStart` de cada carta, infección, regeneración, metal caliente, cartel de turno
   (`fxBanner`), pasiva de Gero (d20: 15+ → +2 PD, 10− → −1 Alma), Pergamino (`scrollTurns`,
   victoria a 2), `ofrecerManoNueva` (mano muerta en el primer turno), y si es la IA →
   `aiTurn()`; si es humano, arranca el reloj de 1:30 (`relojArranca`).
3. Fase principal: `playFromHand(s, id, forcedTargets)` — `canPlay` (coste con `costOf`,
   hueco, `req`, objetivos), paga, resuelve objetivos (`resolveTargets` → `targetPool`), y
   según el tipo: Hechizo (ventana de Trampas `hechizoOHabilidad` → ventana de Rápidos →
   `antesDeHechizo` (Acertijo) → `cast` → `trasHechizo` (Inspiración de Fender, tumba,
   `recalc`, `checkDeaths`)), Personaje (`mkUnit`, `cloudCheck`, `enter`, Rebaño de Rul,
   Aldrick), Trampa (boca abajo, log privado), Objeto (`relic` o equipo en `objs`), Lugar.
   `useLeader(s)` (Habilidad, una vez por turno), `useAct(u)` (habilidad activada de una
   carta), `useRelic(s, r)`.
4. Combate: `canAttack(u)` (vivo, no atacó, no aturdido, ATQ>0, no `sick` salvo Prisa,
   `noAttack`, `blind`, Cláusula, Peaje de Brick y Brock), `legalTargets(u)` (Provocar,
   Vuelo/Arquero, Sigilo, `face`), `doAttack(u, t)` (ventana de Trampas `ataque`, embestida,
   daño simultáneo, `dmgU`/`dmgFace`, contraataque, `checkDeaths`). **Regla «debe atacar si
   puede»** (`mustAttack`): `pedirTerminarTurno` frena el fin de turno y `endTurn` los hace
   atacar solos si se cierra igual (`atacantesObligados`, `cumplirAtaquesObligados`).
5. `endTurn()`: reloj fuera, ataques obligados, Maratón de K-dramas (Adreida), Antro Juan,
   fin de efectos `tA/tH`, límite de mano (8: descarte), Machete guarda 2, `startTurn(1−s)`.
6. Daño y muerte: `dmgU(u, n, {src, fire…})` (inmunidades, Fuego, Infección, `fxHit`),
   `dmgFace(s, n)`, `healU`, `checkDeaths()` → `killUnit(u)` (`die`, Llaves del Conserje,
   Mago del Domo, Puntos Robados, `fxDeath`, Alcantarillas), `destroy` para Objetos.
7. Ventanas: `trapWindow(side, evento, ev)` (una Trampa por evento: `ataque`, `hechizoOHabilidad`,
   `letal`…), `fastWindow(side, ctx)` (Hechizos Rápidos del bando pasivo: `contrahechizo`
   contra Hechizos, `puas` contra d20, el resto en ataque/hechizo). `roll(label, side, meta)`
   tira el d20 (`rollDice` en pantalla, interactivo para el humano), repetición (Púas), Pifia
   (1 → −1 Alma).

Rutas de victoria: `endGame(winner, why)` (en la pantalla) por Alma 0, Pergamino (2 turnos) o
Corte reunida (El Rey + 3 aliados vivos al empezar tu turno).

## 4. Estructura de cartas y datos

Todo en `motor.js`. Una carta es un objeto declarativo registrado con `C('id', {...})`:

```js
C('horton',{n:'Sir Horton', t:'personaje', c:3, a:4, h:4, tr:['Humano','Paladín'], r:1, art:'🛡️',
  x:'<b>Arrogante:</b> debe atacar cada turno si puede. …',   // el texto que ve el jugador
  keys:['prisa'], mustAttack:true,
  die: async(g,s,u)=>{ … } });
```

Campos comunes: `n` nombre, `t` tipo (`personaje|hechizo|trampa|objeto|lugar`), `c` coste,
`a`/`h` ATQ/PV, `tr` tribus, `r` rareza (2 = foil), `art` emoji, `x` texto (HTML),
`sub` subtipos de Hechizo (`fuego|fe|engano|cancion|contrato|rapido`), `keys` palabras clave
(`prisa|provocar|vuelo|sigilo|arquero|regeneracion|sinhonor`), `set:'cajon'` (fuera de los
mazos), `token:true` (fichas). Hooks async `(g, s, u, ts)`: `enter`, `die`, `onStart`,
`onAnyStart`, `aura(g,s,u)` (suma `aA/aH/aKeys`, se recalcula siempre), `act:{n,cost,tg,do,req}`,
`cast(g,s,ts)`, `tg:[{k,min,max,label,f,rep}]` (grupos de objetivos: `unidadAliada`,
`unidadEnemiga`, `unidad`, `objetivoEnemigo` (incluye `'face'`), `objetoEnemigo`), `req(g,s)`
(condición de juego: filtra el botón de la mano y a la IA a la vez), `enterTg`, Trampas
`on`+`can`+`fire`, Rápidos `fast`+`counter`/`reroll`/`heal`, Objetos `equip`/`relic`/`relicAct`/
`objSlots`, Lugares `aura`/`endPhase`, y banderas de reglas (`noAttack`, `toll`, `clause`,
`scroll`, `bank`, `uncounterable`, `spellProof`…).

`LEADERS[id]`: `n`, `ep` (epíteto), `art`, `arch`, `pasiva`/`hab` (texto), `habName`,
`habCost`, `habReq`, `habTg`, `hab_do`, `lore`. `DECKS[id]`: `n`, `d` (arquetipo), `plan`,
`list:[[cardId, copias], …]` (40 cartas). `GUIAS[id]`: la guía de estrategia (dif, lema, motor,
turnos, combo, mano, pierdes, vs). `TUT_MAZO[id]` + `buildTut(lid)`: el tutorial por mazo.
`ARTE` (de `art/encuadres.json`): encuadre `{x,y,z}` por id de carta o `lider_<id>`; si una
carta no tiene entrada, se dibuja con su emoji.

Para añadir una carta: `C(...)` + meterla en un `DECKS[].list` (o `set:'cajon'`) + caso en
`aiScore` si la IA debe valorarla + si cita cantidades, revisar `GUIAS`, `TUT_MAZO` y
`TUT_FOE_SCRIPT` (hay una regresión que caza cartas citadas que ya no están). Luego el banco.
Sección «Añadir una carta / Añadir un Líder» en `README.md`.

## 5. La IA

Un solo nivel. `aiTurn()` (motor): fase principal en bucle — puntúa cada carta jugable con
`aiScore(id, s)` (valor base por coste/estadísticas + casos por carta, curva, quitar, buffs,
Trampas, Lugares), juega la mejor mientras haya PD, usa la Habilidad del Líder y las
activadas; objetivos con `aiTargets(s, groups, self, card)` (prioriza matar, lo caro, lo raro);
combate en bucle con `aiPickAttack(u)` (mata sin morir > daño > cara; con `face` si el ATQ
llega al Alma). Respuestas rápidas en `aiFast` (contrahechizo contra coste ≥ 4, repetición
contra 15+). `autoTurn(s)` es la misma IA jugando por cualquier bando (banco y arnés).
En el tutorial el rival va guionizado (`tutFoeTurn`, `TUT_FOE_SCRIPT`).

Mejorarla es un pendiente conocido (véase §10). Toda mejora se mide en `balance.html`.

## 6. Online / multijugador

Sin cuentas ni servidor propio. **Anfitrión autoritativo**: corre el motor entero y publica
el estado ya volteado (`netSnap` → `netPushState` → mensaje `state`); el **invitado sólo
dibuja** (`netApply` reconstruye `G` con `mkUnit`) y manda **intenciones** (`gIntent`:
`play|attack|leader|act|relic|end`) con acuse (`aid`, reenvío a 3,5 s, `hechas` descarta
repetidas). El anfitrión valida cada intención en `netRunActs`/`netDoAct` y responde `ack`
o `nope` con motivo. Las decisiones del invitado (`ask`, `pickCard`, `pickFrom`, d20,
objetivos) viajan como `prompt`/`reply` (`netAsk` con `fallback` a los 90 s;
`netGuestPrompt`, `guestTargets` con `poolRef`). Efectos: `netFx` acumula y viaja con el
estado; `netPlayFx` los reproduce.

Transporte de **dos naturalezas en paralelo** (`netConnect`): MQTT sobre WebSocket
(`MQTT_URLS`: emqx, mosquitto, hivemq; cliente 3.1.1 mínimo escrito a mano en `chMqtt`) y
ntfy HTTP con sondeo (`HTTP_RELAYS`; `chHttp`). El código de sala (5 letras, `netCode`) es el
canal. `netPump` no suelta un mensaje hasta entregarlo; un canal que falla se aparta 30 s.
Mensajes: `join`, `welcome`, `state`, `act`, `ack`, `nope`, `prompt`, `reply`, `chat`, `bye`,
`revancha`/`revanchaOk`/`revanchaNo`. `NETDIARIO` (pantalla) guarda un diario descargable.

Enlace de invitación: `?sala=CÓDIGO` abre el vestíbulo del invitado ya en esa sala (botón
«Compartir enlace» al crearla). Revancha en la misma sala desde la cinemática.

**No hacer benchmarks contra los relevos públicos**: ntfy bloquea la IP.

## 7. Deploy: GitHub Pages + Cloudflare Pages

- `./publicar.sh` (desde `caoz_tcg/`) es la única forma de publicar. Pasos: (1) sintaxis de
  los cuatro scripts, la regla de `Animation.finished`, motor sin DOM, **builds coincidentes**
  (`const BUILD` y `?b=` de `motor.js`/`final.js` en `index.html` y `movil.html`, `VERSION`
  en `sw.js`, todos iguales a `git rev-list --count HEAD -- caoz_tcg/`), árbol limpio;
  (2) arnés en Chrome sin ventana (`?test=1&rapido=1`; `--completo` añade los tutoriales) — la
  página avisa por `POST /resultado` a `servidor_pruebas.py`; rojo = no se publica;
  (3) copia **por nombre** de `index.html`, `motor.js`, `movil.html`, `final.js`, `sw.js`,
  `manifest.webmanifest`, `tests.js`, `estudio.html`, `art/` a la rama `gh-pages` (worktree
  en `../csm-game-guide-pages` o similar; el script lo resuelve) y push; (4) verificación
  **byte a byte** de lo servido por GitHub Pages y, después, por Cloudflare
  (`juego.caozcontodo.com` y `caoz-tcg.pages.dev`).
- **Cloudflare Pages**: proyecto `caoz-tcg` en la cuenta de Rafa, conectado a este repo, rama
  de producción `gh-pages`, sin build, directorio de salida `tcg`. Publica solo al recibir el
  push. El dominio `juego.caozcontodo.com` es un CNAME en **GoDaddy** hacia
  `caoz-tcg.pages.dev`. La raíz `caozcontodo.com` es la web de Rafa: **no tocar**.
- Por qué dos: la operadora móvil de Rafa (y de su público) no enruta `*.github.io` en 5G.
- Después de publicar: `git push origin main`. La app instalada se actualiza sola al abrirse
  con red (HTML/JS «red primero»; la caché lleva la build en el nombre y borra las viejas).

## 8. Pruebas: qué hay y cómo correrlas

- `index.html?test=1` en un navegador (o `?test=1&rapido=1` sin tutoriales; `?test=motor`
  una suite suelta). Se ve un panel con el resultado. Suites en `tests.js`:
  - `motor`: 300–432 partidas IA contra IA en ~0,3 s (sin errores, sin cuelgues).
  - `cartas`: las 116 cartas jugables se juegan en un escenario preparado.
  - `cobertura`: qué se ejercita (cartas jugadas, Trampas que saltan).
  - `tutoriales`: los seis tutoriales a clics, 34/34 pasos, con el contador de rescates
    (`TUT.rescates`). Lentos (~2,5 min); sólo con `--completo` o sin `rapido`.
  - `regresiones`: un caso por cada fallo que costó tiempo (unos 30). Algunas **leen el código
    fuente** (`fuente()` trae `index.html` + `motor.js`) para prohibir patrones.
- Sin ventana: lo hace `publicar.sh`; a mano, el bloque de `servidor_pruebas.py` + Chrome
  `--headless` que hay en el propio script (con `--disable-background-timer-throttling` etc.:
  con el Mac cargado Chrome estrangula la página y da rojos falsos de efectos o no termina).
- **Norma**: cada bug arreglado deja una regresión, **validada por sabotaje** (revertir el
  arreglo y ver la prueba en rojo). En pruebas no se `await` nada que espere un clic
  (`resolveTargets`, `pickCard`, `ask`): se parchea la global o se usa `G.auto`.
- `balance.html?auto`: 2880 partidas por tanda; las cifras de referencia están en
  `CHANGELOG.md` (hoy: Mohamed ~40, Fender ~41, Adreida ~56, Gero ~55, Rafaela ~52,
  Talesyn ~41; ±2 entre tandas). `?cajon=1` simula el Cajón dentro de los mazos.

## 9. Reglas de estilo y decisiones que no se rompen

- Español en todo: código, comentarios (largos, explican el porqué), commits, CHANGELOG.
- Sin dependencias, sin bundler, sin TypeScript. Doble clic tiene que seguir funcionando.
- Un motor y dos pantallas; nada de DOM en el motor; cualquier llamada nueva del motor existe
  en las dos pantallas.
- `recalc()` es la única fuente de `atk`/`maxHp`.
- Nunca `Animation.finished`; nunca `preserve-3d`; animar `translate`/`scale`/`rotate` si la
  posición vive en `transform`; `render()` reconcilia nodos (por `data-uid`/`data-card`), no
  los rehace; todo efecto detrás de `FXON()` y encadenado con `nap()`.
- Si la interfaz pide una acción, esa acción está habilitada (lección del tutorial).
- Un botón que salta contenido nunca se parece al que lo confirma.
- Antes de reportar que una mecánica está rota, comprobar que el medidor mide.
- Cambios de cartas o mazos: leer las cartas que sostienen el mazo, medir antes y después,
  anotarlo en `CHANGELOG.md` con número de versión. Ninguna carta de un mazo sin jugarse.
- Publicar sólo con el arnés en verde y comprobación byte a byte; `git add` por nombre en
  `gh-pages` (ahí vive otra PWA).
- Ramas por tarea; `main` siempre jugable.
- iPhone instalado (iOS 26): vista de pantalla-menos-barra anclada arriba, 62 px negros abajo
  que no se pueden pintar; bloque opaco bajo la barra; el menú se centra con márgenes
  automáticos. Diagnóstico: pulsación larga sobre el número de build en el menú del teléfono.

## 10. Bugs conocidos y deuda técnica

Bugs / limitaciones:
- En online el **invitado no ve la animación de muerte** de las cartas (llega el estado ya
  sin la carta). Habría que mandar un `fx` de muerte antes del estado.
- `augusto.webp` y `lucius.webp` son la **misma imagen**; Mohamed y Gero no tienen retrato
  (van con emoji). Sólo Rafa puede aportar arte.
- La galería de escritorio dice «Pasa el cursor» aunque se esté en táctil (menor).
- Reloj online de 90 segundos: el anfitrión controla ambos turnos y sincroniza el tiempo al invitado.
- Gero: su pasiva rueda todos los turnos; en el tutorial espera al paso 20 a propósito.

Deuda técnica:
- `index.html` (5.200 líneas) y `movil.html` (2.200) duplican el CSS de carta y varias
  pantallas (galería, guías, online). Se hizo así a propósito para no arriesgar el escritorio;
  candidatos a compartir vía `final.js` (como ya hacen la cinemática y los récords).
- `render()` repinta el tablero entero en cada llamada (barato, pero llamado ~60 veces desde
  el motor); la mano y los campos ya reconcilian nodos.
- El arnés en Chrome sin ventana es sensible a la carga del Mac (rojos falsos de efectos,
  cuelgues a 300 s): correrlo en pestaña visible si dudas.
- Los `?b=` de los scripts y `VERSION` de `sw.js` se suben a mano en cuatro sitios; podría
  hacerlo `publicar.sh`.
- `PROPUESTA-BALANCE-v2.md` es histórico (ya aplicado); podría archivarse.
- 21 cartas del Cajón sin destino decidido. Una sola dificultad de IA. Sin sonido.

## 11. Assets

- `art/` (versionado): `logo.webp` (1600×900, el logo recortado del original),
  `lider_{adreida,fender,rafaela,talesin}.webp` (retratos de Líder; falta mohamed y gero),
  `augusto.webp`, `lucius.webp` (ilustraciones de carta; duplicadas), `encuadres.json`
  (encuadre por id: `{x,y,z}` o un número = centro vertical), `icono-192/512/512-maskable/180.png`
  (iconos de la app, generados del logo con PIL; ver el script en el CHANGELOG v17).
- `ParaSpotify.png` (raíz, 6,3 MB): el **logo original** que pasó Rafa; `logo.webp` sale de él.
- `plantilla/carta-plantilla.svg` y `.png`: la plantilla de carta para maquetar ilustraciones.
- `estudio.html`: el editor de encuadres. Carga `index.html` en un iframe y usa sus cartas;
  «Sincronizar con el juego» y «Exportar» (`exportar-datos.sh`) escriben `art/encuadres.json`
  y las ilustraciones. Está protegido con contraseña en la web (`LLAVE_ESTUDIO`, un hash).
- Las ilustraciones nuevas van como `art/<id>.webp` (proporción de carta, 750×1050 de
  referencia) y una entrada en `encuadres.json`; el juego las recoge solo (`cargarArte`).
- `biblia.sh` genera `La-Biblia-del-Domo.pdf` (todas las cartas, Líderes, mazos, guías y
  reglas) desde el propio juego; es la forma más cómoda de leer el contenido.

## 12. Cómo arrancar a trabajar (checklist)

1. Clonar el repo y servir `caoz_tcg/` con cualquier servidor estático. Abrir `index.html`
   (escritorio) y `movil.html` (teléfono; en escritorio se ve como un teléfono centrado).
2. Leer `AGENTS.md`. Correr `index.html?test=1&rapido=1` y ver todo en verde (~2 min).
3. Hacer el cambio en una rama. Si toca cartas/mazos/IA: `balance.html?auto` antes y después.
4. Añadir regresión si es un bug; validarla por sabotaje.
5. Subir la build en los cuatro sitios; escribir la entrada de `CHANGELOG.md` (con el porqué y
   los números); commit en español.
6. `./publicar.sh` desde `caoz_tcg/`; si termina en verde, `git push origin main`.
7. Probar en el teléfono de Rafa (él): app instalada, cerrar del todo y abrir dos veces.

Contacto/propietario: Rafa (rafarorr1). Decide él: qué cartas cambian, qué entra del Cajón,
el arte, y cuándo se publica algo que cambia cómo se juega.
