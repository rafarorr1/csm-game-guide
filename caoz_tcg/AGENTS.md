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
| `final.js` | Cargador de módulos compartidos. `final-core.js` conserva la cinemática, menús y coordinación; campaña, sonido, acabados y Colección tienen módulos propios. |
| `coleccion-modelo.js`, `coleccion-ui.js`, `coleccion-juego.js`, `coleccion.css` | Inventario/acabados, interfaz y conexión con el juego. Primera sección con entorno aislado en `../dev/secciones/`. |
| `sw.js`, `manifest.webmanifest`, `art/icono-*.png` | La PWA: caché «red primero» para HTML/JS y «caché primero» para ilustraciones; iconos generados del logo. |
| `tests.js` | El arnés. Se carga sólo con `?test=1` (`&rapido=1` salta los tutoriales). Suites: motor, cartas, cobertura, tutoriales, regresiones. |
| `balance.html` | El banco de balance: 2880 partidas IA contra IA por tanda (`?auto`). |
| `publicar.sh` | Publica. Con guardas; ver abajo. |
| `estudio.html/js/css`, `arte-remoto.js` | Estudio privado de ilustraciones, sesión compartida con sonidos y reemplazos persistentes en D1. Originales en `art/encuadres.json`; catálogo derivado en `art/catalogo.json`. Ver `ILUSTRACIONES.md`. |
| `biblia.sh` / `biblia.py` | Genera «La Biblia del Domo» en PDF a partir de los datos del propio juego (`?biblia=1`). |

El motor y las pantallas siguen siendo **scripts clásicos que comparten el ámbito global**. Reglas del corte:

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

### Primero se revisa la sección aislada — instrucción del usuario, 2026-09-11

Cuando el usuario pida un cambio en una sección concreta, seguir este orden:

1. Preparar una vista interactiva aislada de esa sección con el cambio solicitado
   y presentarla con un acceso directo de GitHub/Cloudflare para revisarla desde
   el teléfono, sin login de ChatGPT. Usar `../dev/secciones/publicar.py`: rama
   `aislados`, independiente de beta/producción. Usar el componente real y
   sólo los datos/dependencias necesarios; mantener separados el progreso y los
   datos de prueba. Conservar el resto del juego. No basta una propuesta en texto.
2. Antes de presentarla, comprobar únicamente esa sección y sus interacciones
   relevantes, en móvil y escritorio cuando corresponda. No ejecutar todavía
   la batería completa ni publicar una nueva versión del juego en beta.
3. Esperar a que el usuario apruebe la sección. Entonces integrar el cambio al
   juego, ejecutar las validaciones completas requeridas y publicar en beta
   mediante el mecanismo existente, verificando lo servido.
4. Producción es un paso posterior, con autorización del usuario para esa versión.

Esta secuencia responde a una petición explícita del usuario para agilizar las
iteraciones; prevalece sobre cualquier lectura del flujo general que obligue a
probar o publicar todo antes de enseñar el cambio. No repetir una aprobación ya
recibida para el mismo paso. Una instrucción posterior explícita puede cambiar
el orden. La vista aislada no sustituye las pruebas de integración posteriores.

### Validación e integración

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
3. **Build.** Identifica una versión del juego, no una cantidad de commits. Mantener iguales
   `const BUILD`, los `?b=` de scripts en ambos HTML y `VERSION` en `sw.js`. Incrementar al
   cambiar archivos que se publican; documentación, herramientas y merges sin cambios del
   paquete no consumen build. `verificar_release.py` rechaza retrocesos y bytes diferentes
   bajo una build ya publicada, incluyendo arte/audio y `tests.js`.
4. **Publicar exige destino explícito**, desde `caoz_tcg/`: `./publicar.sh --beta` sólo en
   `develop`; `./publicar.sh --produccion` sólo en `main`. `--solo-pruebas` funciona en
   cualquier rama y permite cambios locales. `--completo` añade tutoriales. El publicador
   verifica sintaxis, motor sin DOM, animaciones, builds y árbol del juego limpio; corre
   el arnés en Chrome y vuelve a comprobar rama/commit/archivos antes de copiar por nombre
   a `gh-pages` (**nunca `git add -A`** allí). Verifica byte a byte lo servido. `--beta`
   conserva `/tcg/`, actualiza `/tcg-beta/` y el preview Cloudflare de la rama `beta`.
   Producción usa `gh-pages:tcg`. Las ramas de código no disparan despliegues Cloudflare.
   Integrar y subir la rama fuente correspondiente antes de publicar; no hacer push a
   `main` como paso automático después de una beta. Flujo completo en `../dev/README.md`.
5. Si el arnés no termina o da un rojo de efectos con el Mac cargado, no es el juego: correr
   `index.html?test=1&rapido=1` en una pestaña visible y comparar. Con el ordenador ocupado
   el Chrome sin ventana se estrangula (por eso van los `--disable-background-*` y 300 s).
6. Ramas: `main` refleja producción; `develop` integra beta. Una rama por tarea desde
   `origin/develop`, con vista aislada aprobada antes de la integración. No usar la antigua
   `feature/aaa-combat-cards` para nuevos cambios.
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
