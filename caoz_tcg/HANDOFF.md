# HANDOFF — para el agente (o la persona) que continúe el desarrollo

Fecha: 2026-09-11 · build 245 (rama feature/aaa-combat-cards) · v20 · dirección: https://juego.caozcontodo.com/

Este documento está escrito para que otro asistente pueda seguir desde aquí sin haber visto
nada antes. Es la puerta de entrada; los detalles están en los archivos que se citan. Orden de
lectura sugerido: este archivo → `AGENTS.md` (las reglas de trabajo, cortas) → `README.md`
(cómo se juega y cómo está montado, largo) → `CHANGELOG.md` (el porqué de cada cambio, con
números) → el código.

---

## 1. Qué es y dónde está

Build245 reemplaza el dibujo plano de la moneda por dos superficies acuñadas,
con Machete y las espadas en el mismo oro satinado (art/moneda-cara-v245.webp y
art/moneda-cruz-v245.webp). Cuatro anillos forman un bisel visual dentro del cuerpo
físico. Luz y reflejos dependen de la orientación; sombra proyectada con contacto
según la altura mínima del cilindro. Cámara sigue menos al objeto, conservando
el encuadre acotado. Ambos assets se precargan, cachean y verifican al publicar.
Conservar primer IIFE físico, resultado, protocolo y botones de244. Sólo beta;
producción242 y main permanecen intactas.

Build244 graba la cara de Machete en el anverso de la moneda y simplifica los
botones a «Cara» / «Cruz». El retrato art/moneda-machete-v244.webp mezcla su
bronce con el oro de Canvas; se precarga y refresca la moneda quieta si llega tarde.
Está en NUCLEO de sw.js y en las verificaciones remotas del publicador.
El reverso de espadas, la física y el protocolo online conservan build243.
Esta versión se publica sólo en beta; producción permanece242 y main intacta.

Build243 sustituye el volado decorativo por moneda-fisica.js. Núcleo puro de
cuerpo rígido y presentación Canvas; el resultado sale de la normal superior al
reposar. final-core comparte elección/presentación en local, campaña y online.
voladoSimular obtiene semillas nuevas y reintenta sólo si queda sin asentar.
El host envía coin.fisica empaquetada; el invitado valida resultado, elección y
trayectoria antes de marcar monedaRecibida y enviar coinAck. Los anfitriones
anteriores sin física se muestran con su resultado estático. No duplicar sorteos.
Cancelar la elección o la reproducción impide iniciar una partida con resultado
nulo. El módulo está en final.js, sw.js y todas las listas de publicar.sh.
Replay acotado para el relevo HTTP: hasta176 poses, 14 bytes por pose,
error de interpolación <.01 de posición y .03 rad. Se validan formato,
reposo y valor; el host dibuja las mismas muestras descomprimidas que el invitado.
Las pruebas incluyen el primer duelo con G=null, cancelación y retransmisiones.
Esta versión se prepara para beta; main y producción se conservan.

Build242 añade 127 ilustraciones provisionales para las cartas sin arte previo (7,21 MB).
Son originales nuevos en art/ y entradas con placeholder:true en encuadres.json;
el catálogo derivado conserva esa marca y el estudio ofrece filtro Provisionales.
No se escriben borradores ni registros de arte de D1. Los diseños propios conservan
prioridad, incluidos los acabados que heredan la imagen Normal. Se protegen Thal,
Augusto, Lucius y los cuatro protagonistas que ya tenían ilustración original.
Los WebP de hasta 512×768 se derivan de PNG de 1024×1536, sin recortar ni ampliar.
El flujo de publicación copia y verifica el listado de encuadres como siempre.
Corrige además la posición de cajón, rareza y foil en cartas ilustradas: la
regla general conarte los hacía relativos y desplazaba el nombre fuera del marco.
cartasIlustradas reproduce el fallo con CSS anterior y pasa en ambas pantallas.
Sin cambios de motor, mazos, balance o reglas. Conservar main intacta.


Build241 renombra la carta a Thal y las menciones visibles relacionadas.
Conserva id tal y todos sus datos de arte y partidas. Catálogo regenerado.


Build240 simplifica el marco dorado en acabados.css: un borde de1.5px, sin
perfiles interiores en carta ni ilustración. Conserva reflejo e indicadores.


Build239 corrige la ficha móvil de Tal: los ajustes publicados sólo tenían claves
 desktop_ y móvil volvía a la base y91. CAOZ_VISTAS.resolver comparte la misma
superficie entre pantallas cuando falta una propia; el ajuste propio prevalece.
El estudio muestra la herencia y los mismos valores que el juego. abrirFicha móvil
usa el selector desde su primer dibujo. No se reescriben los encuadres del usuario.


Build238 añade previsualizaciones reales por superficie al estudio y zoom50–300%.
Las vistas son independientes por dispositivo y acabado; se publican con la misma
instantánea que la imagen. Migración aditiva de vistas en tablas de arte públicas
y privadas; conserva revisiones, blobs y originales. Ver ILUSTRACIONES.md.
Regresión encuadresVistas en ambas pantallas, sabotaje de selección de encuadre,
API/CAS/migración/destinos y UI local con recarga, acabados y anchuras320–1440px.
No se cambiaron las ilustraciones privadas del usuario ni sus publicaciones de arte.
La entrega se valida y despliega con el publicador oficial. Conservar main intacta.


Build237 estabiliza la prueba de clic: espera la promesa real de playFromHand
hasta la entrada completa de Eric, no sólo su salida de la mano. Se observó el
bloqueo real por Sacrificio durante la publicación beta236. El juego no cambia.
Producción236 y sus estudios ya fueron verificados byte a byte y por navegador;
beta permaneció234 al detenerse el arnés. Publicar237 en ambos destinos y verificar.

Build 236 completa el empaquetado del estudio único: publicar.sh copiaba
estudio-publicacion.js/css, pero faltaban en el git add explícito de gh-pages.
La nueva regresión ejecuta la fase real de copia/commit en repositorios locales,
verifica cada JS/CSS de ambos paneles en ambos destinos y conserva la otra PWA.
Sin el arreglo falla por archivos ausentes; con él ambos destinos quedan limpios.
El usuario autorizó expresamente la conexión SFX_BETA_DB, que ya está guardada
en Production. ESTUDIO_UNICO=1 ya está configurado en Production y Preview.
Publicar236 primero en producción y después beta por el flujo oficial, verificar
los catálogos y archivos remotos. Conservar main intacta.

Build 235 unifica /estudio y /sonidos en juego.caozcontodo.com, con borradores
privados y publicación independiente a beta/producción. Ver ESTUDIOS.md.
Su primer despliegue detectó dos archivos del panel sin incluir en git, corregidos
en236. Las bibliotecas y claves existentes se conservan. No merge a main.
Las referencias a producción229 en los bloques históricos siguientes describen
su publicación original; producción234 ya fue publicada y Tal migrado después.

Build 234 añade versiones Normal, Foil y Foil dorado al estudio y al juego.
La prioridad visual es Dorado → Foil → Normal, independiente de la rareza
de reglas. Conserva los registros existentes como Normal, sin reescribirlos.
Cada acabado admite imagen propia o herencia de la imagen Normal con encuadre
independiente. Retirar un acabado conserva su revisión y vuelve al siguiente.
El worker mantiene autenticación y revisiones por variante; la limpieza de
imágenes respeta referencias de todas ellas. Ver ILUSTRACIONES.md para el
contrato compatible y la diferencia entre catálogo público y privado.
acabados.css comparte marcos y reflejos entre estudio y juego. Se incluye en
la precarga de la PWA y en la comprobación byte a byte de publicación.
Publicar sólo beta; producción conserva 229. No hacer merge ni push a main.

Build 233 reemplaza el editor local por estudio.html/js/css, con sesión
compartida con sonidos y tablas ilustraciones/imagenes en el binding SFX_DB
existente. Beta y producción mantienen sus propias bases y claves. Consultar
ILUSTRACIONES.md para contratos, límites, restauración y borradores IndexedDB.
El catálogo de 134 entradas se deriva con generar_catalogo_arte.mjs del motor;
publicar.sh exige que art/catalogo.json esté al día. No hay claves cliente.

arte-remoto.js se carga antes de final-core.js; combina originales con el
catálogo público, actualiza nodos existentes y reintenta imágenes al recuperar
conexión aunque no cambie su revisión. urlArte(id) centraliza sus URLs. La PWA
conserva una caché independiente de la build sólo para arte público; las rutas
privadas nunca pasan por CacheStorage. La ronda de memoria congela su imagen
para que un cambio remoto no altere las parejas a mitad de la prueba.
El único cambio del motor elimina la antigua puerta cliente del editor;
reglas y mazos permanecen iguales. arteRemoto cubre la recuperación y falla
al sabotear el reintento. pruebas_arte.mjs prueba el worker real con SQLite y
credenciales ficticias. La UI se comprueba con sesión real local, subida,
encuadre, segunda sesión, conflicto, restauración y tamaños 320–1440 px.
El servidor del arnés usa ThreadingHTTPServer: una conexión especulativa de
Chrome bloqueaba todas las demás con HTTPServer y agotaba los 420 segundos.
La regresión de concurrencia verifica un GET y POST /resultado manteniendo
abierto un socket ocioso; falla con la clase antigua. El plazo no se amplió.
Publicar sólo beta; producción conserva 229. No hacer merge ni push a main.

Build 232 coloca Campaña antes de Jugar contra el Domo en ambas interfaces.
Los cuatro botones principales comparten el fondo borgoña de Campaña, borde,
texto y sombra. Se elimina la clase gold de Jugar y se sobrescribe el estilo
histórico del primer botón de escritorio para que no vuelva a pintarse oro.
Sin cambios a acciones ni persistencia. Sólo beta; producción conserva 229.

Build 231 añade `mBorrarProgreso` a Extras en ambas pantallas. El diálogo
compartido `confirmarBorradoProgreso()` vive en final-core.js. Sólo el botón
«Sí, borrar todo» llama `borrarProgresoLocal()`, comprueba la eliminación de
seis claves explícitas y recarga para descartar memoria/escenas/identidad.
Campaña, creador y logros respetan el espacio `.prueba` bajo `?test`; en juego
normal borra también los sellos `.simulados`. No usa `localStorage.clear()`.
Conserva preferencias de sonido, arte, acceso al estudio y otros datos.
Ante error intenta restaurar lo leído y mantiene el diálogo con aviso/reintento.
Regresión `borrarProgreso` prueba cancelación, fallo parcial, recarga y primera
campaña. Falla si se omite borrar récords y pasa al restaurarlo. Las pruebas
usan datos ficticios aislados; no se borró el progreso personal del usuario.
Publicar sólo beta; producción sigue 229.

Build 230 reorganiza ambas portadas: `mPlay`, `mCampana`, `mOnline` y
`mExtras`, en ese orden. Online reemplaza el nombre Con amigos. La pantalla
`#extras.portada` contiene los demás botones con sus ids y acciones originales;
el editor continúa exclusivo de escritorio. `showScreen` conserva el fondo y
el oro. Guías recuerda su origen al abrirse; sus pestañas no lo sobrescriben.
Reglas cierra su ventana sin forzar la portada. `extrasBack` vuelve al menú.
No se alteran motor, logros, audio ni red. `menusDorados` recorre ahora Extras
antes de pulsar sus opciones y comprueba el regreso a la pantalla correcta.
Producción 229 fue publicada y verificada; esta nueva build es sólo beta.

Build 229 colorea también las victorias de ensayo en el botón Campaña de la
beta, usando `campanaPruebaDisponible()`. Une las claves de los logros reales
y simulados sólo para presentar los retratos. Reconoce los ensayos anteriores
sin migración ni escrituras. Fuera de beta usa únicamente los logros reales;
el final secreto sigue contando sus sellos de forma independiente. Regresión
`campanaRetratosBeta`, comprobada roja antes del arreglo y verde después.

Build 228 mantiene siempre visibles los seis retratos dentro del botón
`#mCampana`, desde el inicio y aun con cero logros. Al completar cada mazo, su
retrato pasa de gris a color. Corrige la condición de primera victoria de 227.
Desde 229 `campana-honores.js` lee `CAMPANA_LOGROS.leer(false)` y, sólo en
beta, también `leer(true)`. No hay nueva persistencia ni cambios al motor.
`caoz:campana-logros`, `storage`, `showScreen` y el evento `caoz:arte` refrescan
los medallones sin sustituir el botón. Los cuatro retratos ilustrados usan un
primer plano propio; Mohamed y Gero conservan sus símbolos hasta tener arte.
Texto accesible enumera los seis estados. Mantiene el tamaño del botón móvil.
Validación externa: 0/1/6 mazos, nueva campaña, recarga, otra pestaña, ensayos,
activación tocando la imagen y cuatro tamaños/modos de pantalla.
Las builds 227–229 ya están integradas en producción 229.

Build 226 integra la regresión `editorCartas` con el nuevo resultado de memoria: dos
parejas declaradas equivalen a dos Alma, sin dar por hecho el premio fijo.
La publicación de 225 se detuvo antes de subir archivos por esa expectativa
antigua. La build 226 quedó publicada y verificada en beta y producción.

Build 225 corrige los objetivos de Armadura y añade el cierre del menú de
cartas móvil. Una selección `TGT` pendiente tiene prioridad sobre ataques,
líderes, reliquias y fin de turno. Un clic inválido conserva aviso/Cancelar y
recursos. `isTargetable` compara uid+lado y revalida el filtro vigente; el
anfitrión revalida los grupos, cantidades y duplicados recibidos del invitado.

Memoria ya no usa la recompensa genérica de ±2: `onPareja` notifica cada
acierto al motor y resta 1 Alma al Editor inmediatamente, una sola vez. Tres
fallos consumen las tres vidas de la prueba y cobran 5 Alma al jugador. Se
conserva lo acertado incluso en derrota; llegar a veinte segundos con vidas
no exige tres parejas. El resultado entrega `parejas`, `fallosMemoria` y
`vidas`. Un acierto letal detiene la prueba y sólo ejecuta el final después de
retirar la nube. Callbacks/resultados de otra partida no pueden cobrar daño.
El reloj también pausa mientras existe `TGT` y reanuda al resolverlo.
Regresiones: `relojObjetivos`, `objetivosEquipo`, `cerrarCartaMovil`,
`pitagorasMemoriaAlma` y
`pitagorasMemoriaResultado`, además de las suites de integración existentes.

Producción 226 está publicada y verificada. El
estudio de sonidos de producción tiene su propia base y credenciales,
independientes de beta; conserva nueve reemplazos en siete archivos únicos.
No copiar bases ni secretos al publicar el código. La producción 226 requirió
reintentar el mismo despliegue de Cloudflare porque la API de sonidos no
respondía; el reintento devolvió el servicio sin cambiar código, datos ni
configuración. Verificar también la API tras publicar. No hacer merge ni
push a main.

Build 224 intensifica la invasión de `pitagoras-mesa.js`: núcleo oscuro detrás
del retrato, masas orgánicas en los bordes, raíces secundarias, niebla procedural,
piel húmeda, ojos rojos y una silueta colosal de Pitágoras tras las cartas.
Reutiliza `art/pitagoras-abismo-v216.webp`, con negro y bordes fundidos en una
caché Canvas de 600 px; una carga tardía sólo llena esa caché, nunca reabre la
escena. Crece con el máximo daño observado; mantiene las
máscaras de cartas/controles, la alternativa sin Canvas y la cancelación de 223.

Láseres: cuatro fases de 2/4/5/6 rayos por secuencia; avisos de
1.30/1.14/1.02/0.94 s y disparos cada 0.62/0.38/0.29/0.24 s. Los rayos de
acecho fijan el blanco al comenzar su aviso, jamás durante el aviso visible.
Se elimina el refugio artificial del borde; se conservan 20 s y 3 vidas.
`.ppImpulso` es un botón real, con recarga de 2.2 s, estado y barra visibles.
Mantenerlo pulsado no repite el impulso. Movimiento, teclado y multitáctil
siguen independientes. `guiasPrueba.laseres` compara trayectorias usando sólo
rayos visibles para validar que la dificultad permite sobrevivir sin trampas.

Final: se conserva la disolución y la mesa despejada de 223. Después el diálogo
y su backdrop nacen transparentes ANTES de `showModal`; `.pitUmbral` funde la
mesa a negro en 2200 ms. Se revela el héroe durante 1800 ms y la frase durante
4200 ms, con 6000 ms completos de lectura y 1400 ms de fundido al negro antes
del menú. Fases: oscuridad → cuarto → revelando → texto → negro. El menú
aparece con su fundido de 900 ms. Movimiento reducido: 240 + 350 ms, mensaje
completo sin letras animadas, lectura igual y negro de 450 ms.
La frase se construye íntegra mediante `textContent`, en tres líneas y spans
`.pitLetra`; sólo cambia su opacidad/filtro. Así no se recortan nombres ni se
recolocan héroe/texto al escribir. `.pitAnuncio` anuncia la frase una sola vez.
Se conserva `PITAGORAS_TIEMPOS.implosion` como alias de `oscuridad`.

Build 223 convierte las seis `CARTAS_EDITOR` en Personajes/Pesadilla de coste 2.
Ataque/vida: Cosecha 2/3, Corte 3/2, Cuadro 3/2, Puente 2/4, Órbita 2/3,
Memoria 2/4. Entran cansadas, permanecen tras el minijuego, atacan con IA normal,
pueden morir/rebotar y van a las Alcantarillas. Máximo 5. No son tokens; quedan
fuera de colección y del banco normal por `set`/`editorJuego`. El mazo secreto
conserva 40 cartas cíclicas, 40 Alma y la base de Adreida. `DECKS` no cambia.

`pruebaDelEditor` y `campanaInterferenciaPitagoras` exigen `editorJuego`: cartas
normales, ataques, muertes y habilidades no abren otra prueba. Una prueba por
carta pagada, una respuesta de ±2 Alma salvo memoria (reglas de 225 arriba),
controles/IA detenidos hasta regresar.
La carta de la transición muestra ataque/vida reales y 20 segundos; en la mesa
usa el mismo grabado del minijuego si todavía no tiene ilustración oficial.

`pitagoras-mesa.js`: `PITAGORAS_MESA.actualizar(G)` al final de ambos render;
`showScreen` distinto de `board` cancela. Capa en coordenadas del visor, sin input,
recorta cartas/controles/texto. Tentáculos aumentan con máximo daño relativo
observado; curarse no reduce invasión. No modifica motor ni coordenadas.

Victoria secreta: `campanaFinalSecreto` guarda `secreto='final'` y espera
`PITAGORAS_MESA.disolver(g)`: 2300 ms de esporas + 700 ms de mesa limpia
(240 + 160 ms con movimiento reducido). Sólo después abre el epílogo previo.
Guardas de partida/id y el resultado de cancelación impiden finales tardíos.
Repetir `disolver` comparte la promesa; un `WeakSet` evita reapariciones.
RAF, temporizadores y observadores se retiran al salir. Los temporizadores
también comprueban la partida actual y la mesa visible si no hay fotogramas.

Atajo beta `/?editor=batalla` o botón en `/?editor=1`: `campanaEnsayarPitagoras`
usa `campanaEnsayoGero` sólo en memoria, con el protagonista guardado o Fender.
No fabrica seis sellos ni sobrescribe la campaña real. `meta.pruebaEditor`
habilita «Beta · Pitágoras −10 Alma» en turno propio sin acción pendiente:
permite recorrer
la invasión y derrota. No aparece en campaña normal, online o producción.

Build 222 comparte la dirección pixel art del FPS con los otros cinco juegos.
`pitagoras-pixel.js` se carga tras fps.js: pintores propios y framebuffer
limitado mediante API.pintarEscena(s,ctx,dibujar). Restaura ancho/alto en finally;
la cuadrícula visual no cambia modelo, proyecciones ni controles DOM.

Cosecha: presionCosecha crece de 0 a 1 entre12 y20 s. Más apariciones,
dobles desde presión>.6, hasta32 enemigos; intervalo final .28 s. Losas2×2
fuera de la cruz central avisan1.25 s y caen.45 s antes de ser huecos.
Caer hiere una vez y devuelve a un punto de la cruz, evitando fuego/enemigos.
Los monstruos también caen, sin contar como disparo acertado. Sólo renderer
consulta esos rectángulos; nunca altera la selección de losas ni el azar.

Corte final: unico→barrido3→barrido/abanico/cruce4. Cada rayo conserva aviso
completo (1.4→1.05 s). Edad negativa significa demora invisible; comienza
telegráfico en0, dispara enaviso. Intervalos.42→.31 s; no se superponen
secuencias completas. El impulso conserva controles y recuperación.

Memoria usa diez ids CARDS reales, una única pareja por ronda; exposición
1.5→1.3 s (+.5), elección5→4 s. La ilustración/fallback se congela por id
al comenzar la ronda, sin cambios por descarga tardía ni copias diferentes.
Cartas ocultas borran nombres, cifras y canvas, también en accesibilidad.

Build 221 pule controles y cambia duelo por memoria, conservando seis ids.
FPS: `.ppDisparo` es un tercer control independiente del stick derecho. El
modelo expone acierto/baja/fallo, ultimoDisparo {x,y,d,acerto,letal,id} y caidos
con edad<.6 s. Sólo impactos de disparos producen confirmación; contacto de
monstruo produce dolor. El renderer usa un atlas pixelado y no muta el modelo.

Cosecha interpola p.a por el arco corto, con prioridad a puntería, autoapuntado
al disparar o movimiento. Las balas salen según p.a real. avisoMarca describe
pulso de 2→12 Hz; se dibuja estático con movimiento reducido. Tras 1.1 s de
aviso: explosión .26 s, aro 1.7 s y ceniza .65 s. El aro hiere sólo su banda.

Carrera: jugador.x y carril son enteros -1/0/1; carrilVisual y carrilCambio
animan el salto lateral, sin cambiar la lógica de colisión. Cada input mx
necesita un flanco; dos botones .ppCarrilBoton sustituyen la palanca izquierda.
Velocidad y oleadas progresan con t. La guía usa cambios y saltos reales.

Memoria: tipo duelo / carta editorduelo, nombre La memoria del Editor.
Entrada elegir índice|null. cartasMemoria, elegidasMemoria, faseMemoria,
rondaMemoria, parejas y hastaMemoria viven en el modelo determinista; ocultar
la pestaña consume plazos. Una pareja, 5→6→7 cartas y 1.5→1.3 s de exposición;
5→4 s para elegir. Tres vidas; desde 225 cada pareja resta 1 Alma y tres fallos cuestan 5 Alma;
se puede sobrevivir veinte segundos con menos de tres parejas. La guía
recuerda sólo cartas reveladas y requiere memoria persistente entre pasos.

Extensión UI: API.montadores[tipo](s,{nodo,escuchar}) tras construir s.ui;
API.actualizadores[tipo](s) desde pintar. s.ui incluye controles; s.elegir se
consume por fotograma. Los montadores registran limpieza en s.limpiar. Memoria
usa botones .ppMemoriaCarta, sin joysticks, con foco/teclado y sin scroll.

Build 220 transforma La cosecha en cenital real: proyección ortogonal y ejes
idénticos entre pantalla, teclado, mando de movimiento, puntería y proyectiles.
El id histórico `isometrico` se conserva para partidas/pruebas y cartas;
`topdown` es también alias de entrada. El modelo de sus peligros no cambia.

`pitagoras-mundos.js` añade carrera (El último puente), orbital (Órbita muerta)
y duelo (El filo del Editor), con reglas puras, pintores y guías del arnés.
Se carga después de pruebas.js; envuelve modelo.crear/paso para sus tipos,
añade metadatos de controles y API.pintores. No repetir su registro.
CARTAS_EDITOR tiene seis hechizos y el mazo del jefe alterna módulo length,
sin modificar los seis mazos del jugador. Todos conservan 20 s, 3 vidas y
resultado de ±2 Alma. El nuevo renderer de láseres no cambia sus colisiones.

`pitagoras-cine.js` pinta humo con WebGL limitado y alternativa Canvas, seis
ilustraciones procedurales para las cartas y materiales de HUD. Se reutiliza
un contexto; no hay RAF propio. Conserva opacidad total al cambiar escena y
fundido simple con movimiento reducido. `pitagoras-fps.js` registra el pintor
FPS con texturas, iluminación y profundidad, sobre el mismo raycast/modelo.
Los cuatro módulos nuevos están en final.js, SW, sintaxis y publicación.

`pitagoras-laboratorio.js`: /?editor=1 abre un selector de seis pruebas sólo en
beta/localhost. Usa la miniatura guardada como apariencia, pero no escribe
campaña, honores ni récords. Los seis botones inician el juego real con nube;
al regresar se pueden probar otros. No está disponible en producción/online.
Su cierre restaura eventos y viewport. No agregarlo al menú de producción.

Regresiones: topdown con inputs reales + sabotaje de la antigua rotación;
modelos de seis pruebas (supervivencia, derrota, semilla y choques concretos),
cartas, ciclo de seis, cancelación y scroll en ambos clientes. Revisar también
el laboratorio en móvil pequeño/horizontal y la cobertura de humo sin WebGL.


Build 219 usa `cinematica:true` desde el puente del combate. La API directa
conserva la introducción manual para el arnés. En juego real no se abren
paneles: carta 1150 ms → nube 900 ms → revelado 1000 ms → prueba. Resultado
950 ms → cobertura 800 ms → regreso 900 ms. El reloj empieza tras el revelado.
El motor registra tres cartas editorJuego (hechizos de 2 PD, 20 s / 3 vidas /
2 Alma, no contrarrestables), exclusivas del jefe local. setupMatch sustituye
sólo su mazo antes del robo inicial por 40 cartas alternadas. El puente elige
la prueba según el id pagado; omite la animación genérica de hechizo para
mostrar una sola carta. No modificar los seis DECKS ni LEADERS compartidos.
`ppMesaVisible` transparenta diálogo/backdrop y oculta sólo su shell; nunca
se cierra el diálogo en mitad del humo. `resolver` retira nube, RAF, timers
y bloqueo de scroll. Movimiento reducido acorta la entrada y funde el humo.
El sprite `art/esbirro-editor-v219.webp` conserva alfa; carga sin bloquear y
usa la criatura Canvas previa si falla. Se precarga en SW. Suite
`pitagorasTransiciones` cubre flujo automático y limpiezas en ambos clientes.


Build 218 elimina las pausas de las pruebas a petición del usuario. No hay
botón de pausa ni pausa por Escape, blur, visibilidad o un fotograma lento.
El modelo consume el tiempo transcurrido al recuperar un fotograma, incluidos
los peligros: ocultar la pestaña no regala una victoria. Blur sólo libera los
controles pulsados. La salida se ofrece antes de empezar y en el resultado.
`bloquearDesplazamiento` fija body, bloquea overflow de html/body y cancela
wheel/touchmove mientras vive el diálogo; restaura el desplazamiento al cerrar.
La suite `pitagorasSinPausa` cubre ambos clientes y los tres juegos; prueba
foco, teclado, tiempo ausente, scroll y limpieza.

Build 217 valida también el jugador activo al reanudar `ofrecerManoNueva`.
Pasar de turno durante el reparto visual ya no abre una pregunta atrasada
sobre una prueba del Editor. Suite `manoNuevaTurno` en ambos clientes.

Build 216 cambia el secreto a terror: `campana-deseo.js` congela el ascenso a
2400 ms, espera 450 ms y entrega el pie normalizado de la miniatura a
`montarRevelacionPitagoras`. Ojos a 2200 ms, aparición a 3600 y encuentro a
7600; se habilita Combatir sobre la misma escena, imagen y canvas del viajero.
El arte original
es `art/pitagoras-abismo-v216.webp` (177 KiB). Los estados históricos `reto` y
`esporas` se reanudan mediante `revelacion`, sin el antiguo botón intermedio.

`pitagoras-pruebas.js` contiene tres modelos deterministas y su UI Canvas:
isométrico, láseres y FPS por raycasting. API `PITAGORAS_PRUEBAS.iniciar` devuelve
una promesa `{sobrevivio,cancelado,abandonado?}`; `cancelar()` resuelve una vez y
limpia entradas, RAF y timers. Cada prueba dura 20 segundos sin pausa y concede
3 vidas locales. El tiempo oculto también simula peligros y daño al volver;
nunca premiarlo sin ejecutar el modelo. Sin dependencias ni conexión adicional.

`pitagoras-combate.js` alterna las pruebas por `G.editorPruebas`, preserva el
estado previo de `G.resolving` y expone `campanaInterferenciaPitagoras` al motor.
El helper `pruebaDelEditor` sólo atiende cartas del FOE en campaña secreta local;
los caminos normal, contrarrestado y Rápido esperan la misma promesa. No actúa
por fichas creadas, habilidades, online, auto, fast ni silent. Al volver aplica
exactamente 2 de Alma al Editor si sobrevivió, al ME si perdió; una cancelación
no cobra daño. Revalidar la identidad de G después de cada espera: una acción
anterior nunca debe terminar ni desbloquear una revancha o partida nueva.
`campanaCancelarInterferencia` se llama al salir, comenzar partida y terminarla.

Las suites `pitagorasMinijuegosModelo`, `pitagorasIntegracion` y
`pitagorasRevelacion` y `pitagorasContinuidad` cubren la supervivencia y ambos
clientes,
incluidas carga lenta, imagen fallida, guardas, hechizos contrarrestados y
cancelación durante respuestas a ataques/tiradas. Mantener también las pruebas
puras y de controles del módulo, además del recorrido beta real de Gero.

Build 215 añade `campanaBotonFinalGero` a los controles de ambas pantallas.
Sólo beta/local contra Gero; `campanaProbarFinalGero` también valida llamadas
sin botón y bloquea online, decisiones pendientes y turnos de IA. El ensayo
`campanaEnsayoGero` vive sólo en memoria: `campanaLeer/Guardar` lo usan sin
reemplazar `CAMPANA_CLAVE`; `abrirCampana` lo descarta para recuperar el avance
original. La meta `pruebaFinalGero` permite continuar automáticamente tras la
Victoria y forzar el secreto sólo dentro de ese ensayo. No fabrica seis sellos.
Regresión `betaFinalGero` en ambas interfaces y comprobación por sabotaje.

Build 214 añade `dado-fisico.js`: simulación pura de un icosaedro y presentación
Canvas. `resolverD20` recoge el gesto, simula y entrega la cara final a `roll`;
`rollDice` acepta una trayectoria autoritativa. El anfitrión elige la semilla
tras recibir el impulso limitado del invitado; el paquete lleva muestras de
posición/orientación, por lo que no depende de diferencias numéricas entre
Safari y Chrome. No aceptar un valor elegido por el invitado. El arnés histórico
no activa física; `CAOZ_D20_PRUEBA=true` permite ensayarla en suites específicas.
Los timers tienen salida al ocultar/cerrar y no dependen de Animation.finished.

`campana-secreto.js` guarda sellos por mazo en `caoz.campana.logros.v1`, separados
de `CAMPANA_CLAVE`; sufijo `.simulados` para los botones beta y `.prueba` para
el arnés. API `CAMPANA_LOGROS.leer/tiene/total/ganador(prueba)` y evento
`caoz:campana-logros`. El progreso conserva `secreto`: ascenso, revelacion (antes reto/esporas),
trono, combate, final y completado. En la sexta marca se interrumpe el ascenso
normal a los 2400 ms; antes de seis marcas conserva el deseo habitual.

`campana-pitagoras.js` dibuja el Editor, su retrato y las escenas de esporas y
final con APIs que devuelven `destruir()`. `campana-honores.js` pinta sellos en
los selectores, nombre ganador en la portada y adapta la identidad rival de
VS/tablero/final. El mazo sigue siendo Adreida; `G.campana.jefeSecreto` determina
la apariencia y la copia local de `P(FOE).L`, nunca `LEADERS.adreida`.
Sellos reales se obtienen con nuevas victorias; no se infieren triunfos pasados
ni ensayos de versiones anteriores. No hay backend ni sincronización entre
dispositivos para estos logros.

Build 208 añade el banco original de 34 SFX, el mezclador compartido
`audio-domo.js` y el estudio privado `sonidos.html`. El motor no cambia.
La API `_worker.js` guarda reemplazos en D1, con cookie HttpOnly, validación
WAV, comprobación de origen y revisiones para evitar pisar otro guardado.
Requiere `SFX_DB`, `SFX_ADMIN_HASH` y `SFX_SESSION_KEY` sólo en el entorno que
se habilite. Ver `SONIDOS.md`; ninguna credencial va en Git. La activación
remota depende de conectar estas vinculaciones en Cloudflare. El banco local
funciona también cuando el backend no responde. El SW nunca cachea sesiones
ni datos privados. Los originales y los reemplazos con hash se pueden guardar
para reproducción sin conexión; restaurar devuelve al archivo original.


Build 207 pule la geometría de `campana-personaje.js` y añade
`campanaPintarMalla`: WebGL compartido con profundidad por píxel y alternativa
CPU cuando falta o se pierde el contexto. No volver a ordenar las caras de
las miniaturas por profundidad media; la regresión `campanaMiniatura` detecta
el fallo con dos superficies cruzadas y distintos órdenes de pintado.
`campanaRetrato` cachea hasta 12 apariencias; `campanaCartaJugador` y las
adaptaciones del líder/ficha usan la misma foto. El VS recibe el personaje
por opciones (todavía no existe G); el final lo lee de `G.campana.personaje`
y decide por el lado ME, nunca por el id del mazo. Nombres siempre como texto.

`campanaPoseGolpe` contiene la secuencia de 940 ms de la mesa. La orientación
sigue al rival, incluido el final del trayecto. `golpear` y `saltarHacia`
conservan sus contratos de cancelación. El personaje sigue siendo cosmético;
no se modifican motor, balance, mazos ni el online.

Build 206 incorpora `campana-personaje.js`, cargado por `final.js` después del
núcleo compartido. `abrirCampana` abre `campanaCrear` para partidas nuevas y
conserva `campanaRuta` para avances existentes. `campanaElegir` es el segundo
paso (mazo). El borrador usa `CAMPANA_CLAVE + '.creador'`; el avance confirmado
mantiene `version:1` y añade `personaje` opcional, normalizado contra catálogos
cerrados. Sólo al confirmar el mazo se sustituye la campaña y se borra el
borrador. No añadir apariencia a `LEADERS` ni mutar las reglas por el aspecto:
`lider` sigue decidiendo el mazo y las habilidades.

`campanaGeometriaPersonaje` genera las caras compartidas entre el visor y la
mesa; la mesa conserva sus animaciones y cámara. `campanaLimpiarCreador` libera
el visor al navegar. El módulo está incluido en SW y publicación. Para probar
el creador con un avance anterior, usar Reiniciar → Crear nuevo personaje.
La suite `campanaCreador` prueba el recorrido y la conservación del personaje;
`campana`, `campanaEntrada` y `campanaDeseo` usan ya la entrada de dos pasos.

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
`a`/`h` ATQ/PV, `tr` tribus, `r` rareza (2 = legendaria; el acabado se administra aparte), `art` emoji, `x` texto (HTML),
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
- `estudio.html/js/css`: panel privado de encuadres y reemplazos en D1, con sesión
  compartida con sonidos. Ya no usa el iframe ni la antigua contraseña cliente.
  Recupera borradores IndexedDB de forma explícita. Ver `ILUSTRACIONES.md`.
- Los originales versionados van como `art/<id>.webp` y una entrada en
  `encuadres.json`. Los reemplazos del panel se sirven por hash desde la API;
  `arte-remoto.js` los combina con los originales. Proporción de referencia 5:7.
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

## Campaña (prototipo build 181)

Entrada en ambos menús; implementación compartida en final-core.js. Seis rivales:
Mohamed, Fender, Talesyn, Rafaela, Adreida y Gero. Progreso local por escalón, no
partidas a medias. Alma rival 16/20/24/28/32/40; no modifica mazos ni IA.
setupMatch recibe opts.campana y showEnd deriva el resultado al flujo de campaña.
Suite campana: derrota, seis victorias, duplicados, recarga y aislamiento.

Build 182: selección de campaña con carrusel de cartas del estilo de escritorio,
flechas y gesto horizontal. La escalera asciende visualmente desde abajo; sólo
se muestran identidades vencidas y el próximo rival. Se conserva el guardado v1.

Build 183: mapa en tablero de mesa con perspectiva CSS, encuentros pulsables
y peón del Protagonista. Tras ganar, Avanzar en el mapa muestra el desplazamiento
al siguiente encuentro; movimiento reducido respeta la posición sin animación.

Build 184: campanaCrearNiebla deriva una máscara SVG del escalón guardado.
La capa decorativa cubre sólo la región pendiente; al avanzar, la anterior
se desvanece sobre la nueva y se retira con temporizador. No hay niebla desde
la etapa 5, ni animación con movimiento reducido. No cambia el guardado v1.

Build 185: diálogo de campaña con cabecera, contenido flexible y campanaAcciones.
campanaAjustarVentana sigue visualViewport; data-vista seleccion/mapa reparte
la altura disponible sin scroll. En horizontal bajo se distribuye en dos columnas.
Suite campanaPantalla cubre tamaños, giros, protagonistas y etapas sin recortes.

Build 186: abrirCampana llama a campanaAnimarEntrada tras montar el selector/mapa.
.campanaBarrido comparte el CSS de #barrido y vive dentro del diálogo (capa modal).
campanaLimpiarEntrada cancela temporizador y efectos al navegar/cerrar; close
comprueba !d.open para no limpiar una reapertura rápida. Movimiento reducido
omite el efecto. Suite campanaEntrada cubre inicio, reentrada, doble toque y limpieza.

Build 187: campanaAcercarMapa anima .campanaCamara con escala y desplazamiento
hacia el encuentro durante 500 ms. campanaCombatir espera el temporizador antes
de cerrar el diálogo y arrancar el VS. campanaCancelarZoom restaura controles y
resuelve el viaje cancelado al cerrar o navegar. Movimiento reducido lo omite.
El primer naipe del VS sigue siendo el jugador local; sólo el CSS móvil lo sitúa
al 72% de alto y al rival al 28%. Suites campanaCombate y versusMovil.


Build 188: beta accesible también en https://beta.caoz-tcg.pages.dev/ para redes
móviles que no enrutan github.io. publicar.sh --beta verifica GitHub y llama a
beta_cloudflare.py: crea/avanza únicamente refs/heads/beta con un árbol que
contiene tcg = gh-pages:tcg-beta. No cambia el checkout, gh-pages/tcg ni main.
Cloudflare lo toma como preview (producción sigue ligada a gh-pages); se verifica
byte a byte también en Cloudflare. Si el contenido ya estaba publicado se puede
repetir --beta para reintentar el preview. El script exige gh-pages limpio y
sin commits locales pendientes de enviar; rechaza una rama beta ajena y nunca
fuerza el push. pruebas_publicacion.py comprueba aislamiento, bytes, reintentos,
avance y guardas con repositorios temporales; sabotaje enviando tcg detectado.
El juego conserva el comportamiento de build 187; sólo cambia la entrega.


Build 189: todos los menús usan el barrido dorado al entrar y regresar.
animarTransicionMenu/limpiarTransicionMenu en final-core.js comparten los
temporizadores de pantalla y ventana; cerrarOv también es compartida. openOv
anima sólo la primera apertura desde una portada; volver a dibujar filtros
no reinicia la entrada. barridoModal vive dentro de ov, como hermano del panel,
para pasar por delante sin interceptar toques ni desplazarse con la colección.
Campaña limpia el efecto anterior al entrar y campanaVolverAlMenu anima el
regreso incluso cuando el menú ya estaba debajo; Escape usa esa misma salida.
showScreen cancela los efectos al pasar al tablero y deja el VS como entrada.
Movimiento reducido omite las animaciones. Suite menusDorados cubre ocho menús,
regresos, Escape, fondo, navegación rápida y aislamiento de las reglas en combate,
en ambas interfaces. Rojo reproducido antes del arreglo y revisión visual con clics.


Build 190: regresar al principal mantiene su logo y botones visibles desde el
primer instante. animarTransicionMenu omite la clase entra cuando el destino
es #menu; conserva el barrido dorado de 450 ms y las entradas de los secundarios.
La aparición escalonada anterior ocultaba el principal entre 400 y 600 ms.
menusDorados ahora comprueba la opacidad inmediata y durante el barrido desde
los ocho menús, incluidos Escape y fondo. Rojo reproducido antes del arreglo.


Build 191: prototipo de mesa D&D en campana-mesa.js, cargado por final.js tras
final-core.js. crearMesaCampana recibe etapa, líder, casillas y etapaAnterior;
retorna foco(etapa), girar(delta), destruir() y activa. campanaMesaEscena se
libera desde campanaCabecera, campanaCerrar y el evento close. Conserva el mapa
HTML accesible como alternativa si Canvas no está disponible; la niebla DOM
mantiene sus metadatos mientras la bruma visible se proyecta en la mesa.
La geometría, los materiales de madera/pergamino y las miniaturas son locales,
sin bibliotecas ni modelos externos. Cámara con perspectiva, arrastre horizontal
y botones; las etiquetas y el foco del acercamiento usan la misma proyección.
Cachea materiales por ventana y la escena estática por cámara/tamaño; actualiza
bruma/velas hasta 15 fps y pausa el dibujo con documento oculto o movimiento
reducido. ResizeObserver usa clientWidth/Height para no medir la escala de entrada.
Avance de 1100 ms interpola la miniatura y la niebla; se cancela la vieja animación
porcentual del peón HTML en esta vista para mantener TÚ sobre su ficha. Regresión
campanaMesa (incluido sabotaje de esa cancelación), campanaPantalla y suite de
campaña cubren integración, limpieza, encaje y avance. sw.js y publicar.sh incluyen
el módulo nuevo en precaché, sintaxis, copia y verificación de bytes.
Publicación prevista sólo por --beta; producción permanece en 190.


Build 192: al verificar la mesa instalada desde Cloudflare se reprodujo un fallo
anterior del worker: /movil (redirección de movil.html) devolvía 504 en la primera
recarga sin red, aunque movil.html estaba precargado. sw.js resuelve index/movil/
estudio sin extensión contra sus archivos HTML, limitados al ámbito registrado.
La raíz conserva su alternativa index.html y las rutas desconocidas siguen en
504. pwaSinConexion ejecuta el worker real con fetch caído y caché recién
instalada, en / y /tcg-beta/; rojo antes del arreglo. Conserva la mesa de 191.
La prueba de navegación real también mostró que Chrome rechaza un Response
precargado con redirected=true cuando navega sin red. sinRedireccion conserva
el cuerpo, estado y cabeceras en una respuesta nueva para las alternativas HTML
y las copias directas de código/documentos. Se verificó el rojo al retirar esa
normalización, y el ciclo completo en navegador con servidor local que reproduce
los 308 de Cloudflare, en móvil y escritorio, incluyendo combate tras recarga.


Build 193: cámara fija en campana-mesa.js (yaw .28, elevación .74), sin API ni
controles de giro. CAMPANA_ESPERAS en final-core.js es la fuente de posiciones
separadas para esperar cada combate, compartida con el mapa HTML alternativo.
La escena ofrece saltarHacia(etapa) -> {promesa,cancelar} y reposar(); el primer
método interpola tres saltos de 900 ms y usa un temporizador independiente del
dibujo. Movimiento reducido/documento oculto completan el viaje inmediatamente.
Se conservan el avance entre etapas y la niebla; no se modifica el motor.

campanaSeleccionar abre la preparación sólo desde una mesa visible y bloquea
reentradas. campanaPreparando conserva viaje, controles y diálogo; al llegar,
campanaMostrarEncuentro abre #campanaEncuentroPanel en la capa modal con datos
de CAMPANA_RIVALES y DECKS. La confirmación llama a campanaCombatir (zoom + VS);
volver/Escape restaura la posición y el foco sin rehacer la mesa ni escribir
avance. campanaLimpiarPreparacion cancela viajes y avisos al cerrar/navegar para
impedir una ventana tardía. La alternativa HTML anima con WAAPI y temporizador.
Suite campanaEncuentro cubre espera antes del aviso, seis especificaciones,
confirmación única, regreso, Escape y cierre durante los saltos; campanaMesa
comprueba cámara fija y alternativa sin Canvas, y campanaPantalla incluye el
aviso en cinco tamaños. Centrado del diálogo reproducido en rojo antes del arreglo.


Build 194: corrección del solapamiento móvil entre cartas y Lugar. .midrow y
.zona no se comprimen; las filas de Personajes reservan 9 px arriba y 5 abajo
para cifras e indicador de ataque. ajustarCampo mide el alto real de #field,
Lugar y Trampas, y limita --cw/--ch sólo dentro del campo. Si hace falta,
reduce la mano para conservar 44 px tocables en mesa. Se ejecuta al renderizar
y al ajustar el visor; ResizeObserver recoge cambios de alto por selección de
mano, ayudas y acciones. No toca el motor, el escritorio ni la campaña.
Suite terrenoMovil valida separación, tamaño tocable, límites del campo y de
los controles en 320×568, 390×664, 402×812 (app) y 430×932; dos/cinco cartas,
Lugar añadido/cambiado/retirado, Reliquia, mano seleccionada y ficha del Lugar.
El primer pase con el reparto antiguo falló por invasión del indicador de
ataque; el terreno también desbordaba su franja en la reproducción visual.


Build 195 publica el arreglo de 194. El flujo habitual sin ventana agotó 300 s
dos veces; las 23 suites pasaron en ventana visible en 205,4 s. --visible en
publicar.sh cambia únicamente el modo de lanzamiento de Chrome (con ventana y
aceleración normal); no omite suites, no acepta resultados externos y conserva
el límite, la parada ante fallos y las verificaciones de publicación. Usar
./publicar.sh --beta --visible cuando la revisión sin ventana se estrangule.


Build 196 (beta): campanaFinal ahora reutiliza cinematicaFinal; la acción
principal admite textoPrincipal. La campaña marca G.campanaResuelta una vez y
guarda mesaPendiente=etapa vencida antes de incrementar etapa. campanaRuta
representa ese encuentro hasta terminar golpear() y pulsar Seguir; luego limpia
mesaPendiente y anima desde campanaPosicionEncuentro del vencido hasta el nuevo.
enEncuentro conserva la posición junto al rival al volver/cargar. Revancha de
derrota llama directamente a campanaCombatir. La alternativa sin Canvas también
anima golpe/caída; desmontar la escena cancela la animación y su promesa.

campana-mesa.js: golpear() dura 1250 ms (temporizador independiente de rAF),
interpola una embestida y rota las caras del enemigo hasta quedar tumbado.
En etapas posteriores todos los vencidos se dibujan caídos. La bruma se dibuja
en un lienzo transparente y se despeja con destination-out alrededor de las
miniaturas reveladas y del jugador. Zoom 1.18, yaw .18, elevación .82, recuadro
ajustado para que quepan las dos piezas actuales. Texturas y árboles más verdes.
Suite campanaContinuidad y azarYCriticos; campana mantiene su prueba de progreso
sin cinemática (stub explícito) y ahora pulsa Seguir después del derribo.


Build 197 (beta): campana-mesa.js vincula el límite de bruma a posicionJugador,
guarda huellas locales del recorrido y abre el claro del rival según distancia
(22 a 13 unidades del mapa). Los vencidos siguen despejados. El sello de final
usa top:50%, left/right:0 y título sin rotación. Thunder step conserva el id
pasoatronador y sus reglas. victoriaCentrada y campanaContinuidad comprueban
centrado, nombre y ausencia de despeje prematuro; sabotajes detectados.


Build 198 (beta): escala de mesa 1.298 (+10 %). Continuar oculta el nombre
futuro. campanaVencerPrueba crea el estado de victoria de campaña y reutiliza
campanaFinal sin iniciar turnos ni registrar récords normales. El botón vive
en campanaEncuentroPanel y sólo aparece en localhost, 127.0.0.1, beta.caoz-tcg.pages.dev
y GitHub /tcg-beta/. Retirar campanaPruebaDisponible/campanaVencerPrueba y su
botón cuando termine la revisión. Suite campanaPruebaBeta prueba seis etapas,
doble clic y texto sin spoilers en ambas interfaces.


Build 199 (beta): campana-mesa centra el centroide de su superficie, no su caja
proyectada ni una compensación por rival. Gero: capa/capucha/libro. API encuadre
para comprobar geometría. cinematicaFinal admite prepararRevancha antes del
fundido; campaña monta mesa bajo .fin en el diálogo, evita el menú de fondo y
callbacks duplicados. campanaSinDestello prueba el fundido real.

campana-deseo.js se carga después de final-core; campanaRuta deriva a él al llegar
a etapa 6 sin mesaPendiente. Diálogo opaco, texto como texto, simulación de envío
900 ms, fuego 3000 ms (500 ms con movimiento reducido), cinco segundos del mensaje
y 1100 ms negro antes del menú. Borrador y deseo simulado se guardan en el progreso
local. No hay fetch, colas, secretos ni backend publicado; envío GitHub cancelado
por ahora por el usuario. El material preparado para futuro está fuera del repo
en work/registro-deseos-futuro. Se creó sólo README en rama campaign-wishes,
sin deseos enviados. No hace falta configurar Cloudflare en esta versión.

PUBLICAR integra módulo de deseo y SW lo precarga. Campaña antigua stubea
campanaAbrirDeseo para conservar alcance, campanaDeseo cubre cierre completo
simulado y cero peticiones de red. La niebla descarta etapa 6 antes de buscar
un rival, para mantener funcional el mapa alternativo ya completo.


Build 200: abrirCampana detecta etapa 6 con deseo guardado y abre campanaElegir,
compatible con progresos de 199. Confirmar genera otro id, etapa 0, sin deseo.
La secuencia después del fuego es concedido 3000 ms → fundido 1000 ms → negro 3000 ms
→ menú. campanaDeseo comprueba tiempos, relectura del guardado y nueva selección;
el espía fetch permite las ilustraciones del selector pero detecta envíos del
deseo. Rojo del reinicio reproducido restaurando la condición anterior.


Build 201: campanaAscenderAlDeseo en campana-deseo.js se inicia al resolver
golpear de victoria 5. Mantiene mesaPendiente hasta terminar rayo 5000 ms y
blanco 1000 ms; después limpia pendiente y abre campanaAbrirDeseo antes de retirar
el blanco. campanaCancelarAscenso desde campanaCerrar elimina timers/rAF y
restaura altura. crearMesaCampana expone elevar(0..1) y focoJugador; eleva
geometría y etiqueta juntos hasta 2.2 unidades. Alternativa HTML usa translate.
Movimiento reducido mantiene luz y tiempos sin elevar. Victoria omite .toca;
la posibilidad de tocar para acelerar permanece, sólo desaparece el aviso.
Suite campanaAscenso y check en campanaSinDestello. Las suites antiguas de
progreso stubean ascenso para conservar su alcance. Publicación sólo beta.

Regresiones: el caso visual Infectado usa newGame + campo sólo con Discípulo,
en vez de startMatch (podía retornar por ocupado y conservar a Eric del caso
anterior). El diagnóstico quedó esperando «¿Eric se sacrifica en su lugar?».
No cambia motor ni interacción de jugadores; evita azar e interferencia del arnés.


Build 202: el cierre aprovecha los tres segundos finales para revelar el menú.
Después de concedido 3000 ms y fundido a negro 1000 ms, showScreen monta el menú
bajo #campanaDeseo, retira el mensaje y limpia el barrido dorado; fase menu
desvanece la cobertura negra durante 3000 ms con backdrop transparente. El
diálogo mantiene los controles bloqueados hasta finalizar y se limpia igual
que antes. Continúan el deseo simulado y el reinicio de campaña.

El rayo mide 210–360 px, se abre en cono hacia la ficha y conserva un núcleo
translúcido. ascensoResplandor se centra con translate independiente de scale:
desde 3800 hasta 5000 ms crece un degradado radial cuyo centro blanco alcanza
todas las esquinas. Los cinco segundos de ascenso y el segundo de blanco
completo se conservan. Movimiento reducido usa un fundido uniforme sin expansión.
Las suites campanaAscenso/campanaDeseo comprueban estados intermedios, origen
del brillo y menú preparado bajo un velo parcialmente transparente. Se verificó
el rojo al suprimir cada fundido. Publicación sólo beta; producción 195.


Build 203: el rayo primero cae como un haz recto angosto durante 650 ms.
Al alcanzar la ficha, abrirHazAscenso/abrirNucleoAscenso interpolan los polígonos
hasta el cono de 202 durante 850 ms; abrirHaloAscenso despliega el halo al mismo
tiempo. Las tres animaciones se omiten con movimiento reducido. Conserva
ascenso, resplandor a blanco y revelado del menú. Revisión visual de caída,
apertura intermedia y cono final en ambas pantallas. Sólo beta.


Build 203 se publicó también en producción con autorización explícita del
usuario: gh-pages a359cfd, fuente 336c27d. Actualización desde 195 conserva
campaña y arranca sin red; selección, VS, volado y partida verificados en ambas
pantallas. No se hizo merge a main.

Build 204 (beta): Rantiago online quedaba esperando la confirmación del
invitado. roll enviaba la misma tirada por prompt y por fx; al llegar el estado
con ese fx se reemplazaba el botón del diálogo interactivo. La promesa original
no se resolvía hasta el fallback de 90 s, así que el +2 seguía pendiente.
Se reprodujo en dos clientes con 13: una tirada interactiva y otra automática,
NET.pending activo, pA=0. El dado del invitado ahora viaja sólo por prompt,
con meta serializada. metaViva reconstruye el resultado en netGuestPrompt;
roll también prepara la comparación para las tiradas locales (antes faltaba
el texto de éxito/error porque las cartas sólo declaraban min/max).

La suite rantiago reproduce el rojo previo y comprueba anfitrión/invitado en
ambas combinaciones de pantallas, una tirada por cliente, confirmación, ataque
visible y sincronización. Además prueba 10/11/20 en local, campaña e IA,
permanencia durante dos cambios de turno y daño real. No modifica costes,
estadísticas, objetivos, azar ni reglas del +2. Publicación beta; producción 203.


Build 209: easter egg en la selección normal del jugador. Lógica compartida al
final de final-core.js; secuencia [1,-1,1,-1,1,1,-1,-1], dirección física del dedo
en gestos. Envuelve girarCarrete sin modificar motor.js. Teclado centralizado,
repetición ignorada y estado reiniciado al salir/elegir rival/usar otro control.
Diálogo nativo comicSecreto, sin descarga hasta disponer del cómic. Añadir el
PDF y su enlace dentro de revelar() cuando esté aprobado. Suite comicSecreto.
