# Caoz Con Todo — El Juego de Cartas · guía para quien trabaje en este código

Esto es lo que un asistente (o una persona nueva) necesita saber antes de tocar el juego.
Lo que está aquí no se deduce del código; lo que sí se deduce vive en `README.md` (cómo se
juega y cómo está montado) y en `CHANGELOG.md` (el diario de diseño: cada cambio con su
porqué y sus números). **`HANDOFF.md`** es la puerta de entrada larga para quien llega de
fuera: arquitectura, flujo de turno, datos, IA, online, deploy, pruebas, deuda y assets. Todo en español, también los comentarios y los mensajes de commit.

## Qué es

Un TCG jugable en el navegador, ambientado en la serie de D&D «Caoz Con Todo». Dos jugadores
entran al Domo con un Protagonista como Líder y un mazo de 40 cartas. Sin dependencias, sin
build, sin cuentas: archivos sueltos que funcionan con cualquier servidor estático (o
`python3 -m http.server 8745 --directory caoz_tcg`). Dirección oficial:
**https://juego.caozcontodo.com/** (Cloudflare Pages); espejo en GitHub Pages.

## Arquitectura: un motor, dos pantallas

| Archivo | Qué es |
|---|---|
| `motor.js` | **El motor.** Cartas (`C('id',{...})` con hooks async), Líderes, mazos (`DECKS`), reglas, flujo de turno, combate, Trampas, Hechizos Rápidos, la IA (`aiTurn`, `aiScore`, `aiTargets`, `aiPickAttack`), la red del online, las guías (`GUIAS`) y el guion del tutorial (`buildTut`, `TUT_MAZO`). **No toca el DOM**: habla con la pantalla llamando por nombre a `render`, `ask`, `pickCard`, `rollDice`, `log`, `toast`, `setPrompt`, `fx*`, `tutBeat`… |
| `index.html` | La pantalla de escritorio: CSS + JS de la mesa apaisada (lienzo fijo 1500×1040 escalado con `zoom`), menús, carrete de Líderes, galería, guías, online, tutorial y efectos. Manda a los teléfonos a `movil.html` antes de cargar nada (`pointer:coarse` y lado corto < 700 px), salvo con `?escritorio=1`, `?test`, `?foto`, `?pantalla`, `?biblia`. |
| `movil.html` | La pantalla del teléfono, de pie, hecha de cero sobre el mismo motor: texto a tamaño nativo, toque para seleccionar/jugar, pulsación larga (380 ms) para ver la carta, hojas inferiores para ficha y registro, app instalable. |
| `final.js` | Piezas compartidas por las dos pantallas: la cinemática de fin de partida (con Revancha y Menú dentro) y los récords locales (`localStorage`). |
| `sw.js`, `manifest.webmanifest`, `art/icono-*.png` | La PWA: caché «red primero» para HTML/JS y «caché primero» para ilustraciones; iconos generados del logo. |
| `tests.js` | El arnés. Se carga sólo con `?test=1` (`&rapido=1` salta los tutoriales). Suites: motor, cartas, cobertura, tutoriales, regresiones. |
| `balance.html` | El banco de balance: 2880 partidas IA contra IA por tanda (`?auto`). |
| `publicar.sh` | Publica. Con guardas; ver abajo. |
| `estudio.html`, `art/encuadres.json` | El editor de ilustraciones y el índice de encuadres (x, y, z por carta). |
| `biblia.sh` / `biblia.py` | Genera «La Biblia del Domo» en PDF a partir de los datos del propio juego (`?biblia=1`). |

Las tres partes son **scripts clásicos que comparten el ámbito global**. Reglas del corte:

- Al motor va lo que no toca el DOM ni ejecuta nada al cargar. `publicar.sh` rechaza un
  `motor.js` que contenga `document.`, `$(`, `innerHTML` o `.classList`.
- Un alias de nivel superior que nombra una función de pantalla (`const tutShow = tutRender`)
  va con la pantalla: en el motor aborta el archivo entero al cargar.
- Cualquier función nueva que el motor llame «por nombre» tiene que existir en **las dos**
  pantallas (aunque en una sea vacía, como `fichaTactil` en escritorio).
- Los ids que mira el tutorial (`hi:` en `buildTut`) existen en las dos pantallas: `#hand`,
  `#myField`, `#foeField`, `#leaderMe`, `#leaderFoe`, `#controls`, `#barMe`, `#barFoe`.

## El motor, lo que no es obvio

- Las estadísticas se **recalculan enteras** en `recalc()`: `base + pA/pH (permanente) +
  tA/tH (fin de turno) + nA/nH (fin del turno rival) + aA/aH (auras) + objetos`. Nunca mutar
  `atk`/`maxHp` a mano. El daño va en `u.dmg`.
- `doAttack` usa `G.resolving` como reentrada; `G.busy` es «la IA está jugando». No mezclar.
- `nap(ms)` es la pausa de animación: devuelve al instante con `G.fast` o con la pestaña
  escondida. `FXON()` apaga todo efecto con `fast`, `silent`, `auto` o `document.hidden`.
- **Nunca** esperar a `Animation.finished`: puede no resolverse jamás con la pestaña
  estrangulada y cuelga el motor. Encadenar con `sleep()`/`nap()`. `publicar.sh` lo grepea.
- Nada de `preserve-3d`. Si la posición de un elemento vive en `transform`, animar
  `translate`/`scale`/`rotate` (propiedades sueltas), no `transform`. `element.animate` con
  `fill:'forwards'` o `fxGone()`; un nodo que se rehace no puede animarse: `render()`
  reconcilia por `data-uid`/`data-card`, no vacía y vuelve a crear.
- Online: **anfitrión autoritativo**. El anfitrión corre el motor y publica el estado
  volteado; el invitado sólo dibuja y manda intenciones (`gIntent`) con acuse. Las decisiones
  del invitado viajan como `netAsk` (`ask`, `pick`, `from`, `roll`, `targets`). Relevos
  públicos: MQTT sobre WebSocket (principal, no pasa por CORS) + ntfy HTTP con sondeo.
  Mensajes nuevos se despachan en `netRecv`; el anfitrión valida cada intención en `netRunActs`.
- `?foto=lider,rival` monta una partida sin volado para mirar la mesa; `?pantalla=menu|select|guide`.
- El tutorial: `TUT_STEPS` con pasos `say` (burbujas), `task` (predicado `wait(g)`) y `beat`
  (espera un evento del motor y lo bloquea). `tutCan()` limita lo que se puede pulsar en cada
  paso; **si la interfaz te pide una acción, esa acción tiene que estar habilitada**. Cambiar
  `DECKS` rompe en silencio el guion del rival (`TUT_FOE_SCRIPT`), los robos (`TUT_MAZO[].top`)
  y las cartas clave de las guías (`GUIAS[].motor`): hay una regresión que lo caza.

## Cómo se trabaja

1. **Antes de tocar una carta o un mazo**: leer las cartas que sostienen ese mazo (Las
   Montañas abaratan Dragones, Tal deja jugar el Pergamino sin Llaves…). Después del cambio,
   `balance.html?auto` y comparar con el CHANGELOG: la variación normal entre tandas es de
   ±2 puntos. Ninguna carta que esté en un mazo debe quedarse sin jugarse.
2. **Cada bug que costó tiempo acaba como regresión en `tests.js`**, y se valida **por
   sabotaje**: revertir el arreglo y comprobar que la prueba se pone roja. Una prueba que
   nunca falla no prueba nada. En pruebas, no `await` sobre cosas que esperan un clic
   (`resolveTargets`, `pickCard`, `ask`): parchear la global (`window.pickCard = async
   () => id`) o forzar `G.auto`. El motor llama a las globales por nombre, así que el parche
   funciona; `TCG.doAttack` es una copia que el motor no usa.
3. **Build.** Cada publicación sube el número en cuatro sitios y `publicar.sh` exige que
   coincidan con `git rev-list --count HEAD -- caoz_tcg/`: `const BUILD` y los `?b=` de
   `motor.js` y `final.js` en `index.html` **y** en `movil.html`, y `const VERSION` en
   `sw.js` (sin eso la app instalada no se entera de que hay versión nueva). Un commit en
   `caoz_tcg/` sin subir la build deja `publicar.sh` en rojo.
4. **Publicar = `./publicar.sh`** (desde `caoz_tcg/`). Comprueba sintaxis, la regla de
   `Animation.finished`, el motor sin DOM, las builds, árbol limpio; corre el arnés en Chrome
   sin ventana (`servidor_pruebas.py` recibe el resultado por `POST /resultado`); copia los
   archivos por su nombre a la rama `gh-pages` (**nunca `git add -A`**: ahí vive también otra
   PWA); y verifica byte a byte lo servido por GitHub Pages y por Cloudflare
   (`juego.caozcontodo.com` y `caoz-tcg.pages.dev`). Cloudflare Pages está conectado a la rama
   `gh-pages`, carpeta `tcg`, y publica solo. `--completo` añade los tutoriales; `--beta`
   publica en `/tcg-beta/`. Después, `git push origin main`.
5. Si el arnés no termina o da un rojo de efectos con el Mac cargado, no es el juego: correr
   `index.html?test=1&rapido=1` en una pestaña visible y comparar. Con el ordenador ocupado
   el Chrome sin ventana se estrangula (por eso van los `--disable-background-*` y 300 s).
6. Ramas: `main` siempre jugable; una rama por cosa; merge cuando el arnés está en verde.
   Commits en español, con el porqué. Cada versión que cambia cómo se juega lleva número en
   `CHANGELOG.md` (v18 hoy); lo demás va «sin numerar».

## El teléfono y la app instalada (iOS)

- En Safari el alto se mide con `visualViewport` (`--vh`), no con `100dvh`: en Chrome de
  iPhone la primera carga contaba la barra de direcciones.
- Instalada como app (`navigator.standalone`, clase `html.app` que pone `ajustarLienzo`):
  iOS da una vista de pantalla-menos-barra anclada arriba (812 de 874 en un iPhone 16 Pro) y
  deja negros los píxeles de abajo: no se pueden pintar. Se llena la vista sin medir, con un
  bloque **opaco** bajo la barra de estado (+24 px; iOS difumina lo que quede debajo) y la
  interfaz 44 px por debajo. Barra de estado en modo `black` (con `black-translucent` no cambia
  la geometría y sí el velo).
- Diagnóstico sin ordenador: **pulsación larga sobre el número de build** en el menú del
  teléfono enseña las medidas reales (alto del visor, `#app`, márgenes).
- El menú del teléfono se centra con márgenes automáticos, no con `justify-content:center`:
  centrado, al desbordar recorta arriba y abajo y Safari no aplica `safe center` en columnas.
- Para probar en el panel de un navegador de escritorio: `movil.html` se ve como un teléfono
  centrado de 520 px; la pulsación larga se simula con `PointerEvent`. La emulación táctil
  de algunos paneles cuelga los clics: mejor ratón.

## Lo que no hay que hacer

- Reescribir la IA o el balance «a ojo»: se mide con el banco, antes y después.
- Tocar `caozcontodo.com` raíz en GoDaddy (es la web de Rafa); el juego es el subdominio
  `juego`, CNAME a `caoz-tcg.pages.dev`.
- Meter dependencias, bundlers o TypeScript. El juego tiene que seguir abriéndose con doble clic.
- Hacer benchmarks contra los relevos públicos del online (ntfy bloquea la IP).
- Dar por publicado algo sin la comprobación byte a byte: GitHub Pages sirve la versión vieja
  durante varios intentos.

## Pendiente conocido

- Sonido: `audio-domo.js` + `audio/catalogo.json`; estudio privado `sonidos.html` y API `_worker.js`. Ver `SONIDOS.md`. El juego conserva el banco original sin API.
- El Cajón: 21 cartas hechas y jugables (`set:'cajon'`) fuera de los mazos, a la espera de
  decidir si entran en los seis o forman un séptimo Protagonista. Constructor de mazos después.
- Dificultad de la IA (hoy hay una sola).
- Retratos de Mohamed y Gero (los únicos con emoji); `augusto.webp` y `lucius.webp` son la misma imagen.
- En online el invitado no ve la animación de muerte de las cartas.
