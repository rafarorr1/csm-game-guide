# Secciones aisladas

Este entorno ofrece vistas acotadas de Colección, El Rey, apertura de sobres, Cuenta e interacciones de cartas. No monta el juego dentro de un iframe,
no crea una partida y no carga IA, online, campaña, sonido ni service worker.
Los cambios hechos aquí no afectan el progreso del jugador.

Desde la raíz del repositorio:

```sh
node dev/secciones/servidor.mjs
```

Estos enlaces locales sólo funcionan en el ordenador que ejecuta el servidor.
Para revisar desde el teléfono, entregar siempre la dirección alojada descrita abajo.

Abrir:

- Escritorio: <http://127.0.0.1:8878/dev/secciones/coleccion.html?estado=sobres>
- Móvil: <http://127.0.0.1:8878/dev/secciones/coleccion.html?vista=movil&estado=sobres>
- Interacciones de cartas: <http://127.0.0.1:8878/dev/secciones/interacciones.html>
- Cartas de la partida: <http://127.0.0.1:8878/dev/secciones/cartas.html> (`?vista=movil` para el teléfono)
- Epílogo de Gero: <http://127.0.0.1:8878/dev/secciones/epilogo-gero.html>
- Pitágoras: <http://127.0.0.1:8878/dev/secciones/pitagoras.html>
- Creador de héroe: <http://127.0.0.1:8878/dev/secciones/heroe.html>
- Mulligan inicial: <http://127.0.0.1:8878/dev/secciones/mulligan.html>
- Invitaciones de sala: <http://127.0.0.1:8878/dev/secciones/invitaciones.html>
- Estudio de nombres: <http://127.0.0.1:8878/dev/secciones/estudio-nombres.html>

El servidor escucha exclusivamente en `127.0.0.1`. Para elegir otro puerto,
usar `--puerto 8880`. No necesita instalar paquetes ni credenciales. Cerrarlo con
`Ctrl+C`. Debe ejecutarse este servidor, no abrir el HTML con doble clic, porque
las dependencias se derivan del código actual en cada solicitud.

## Revisar un cambio

1. Trabajar en una rama temporal según el flujo del proyecto.
2. Cambiar el componente real y recargar esta sección. No mantener una segunda
   versión de la interfaz aquí.
3. Probar los estados relevantes, en escritorio y móvil, y presentar la URL
   de la rama `aislados` en Cloudflare. Todavía no se publica otra versión del juego.
4. Tras aprobar la sección, integrar y ejecutar las guardas completas antes de beta.

Cerrar el diálogo muestra los controles del laboratorio. Allí se puede cambiar
la presentación, los datos de prueba y la serie del muestrario. Cada recarga
construye de nuevo esos datos temporales.

## Interacciones de cartas

La revisión de interacciones está en `/interacciones/`. Es una mesa de escritorio
reducida, con seis cartas reales de mano y Adreida con exactamente 2 PD y ningún
Personaje aliado. La ranura estable (`.handSlot`) recibe el cursor y la carta
visual no, sin mover ninguna vecina, para revisar que el crecimiento no alterna
el hover entre cartas superpuestas. El botón «Probar descarte» abre el selector con
`.gallery.selectorCartas`: su escala máxima es 1.05 y el espacio de cada celda
queda reservado, incluso en una ventana baja. «Usar Golpe Directo» explica el
requisito de objetivo antes de hablar de PD. El volumen aparece dentro de
`#audioExtras`, que es hijo de Extras; no se reproduce ni descarga audio en la
vista aislada.

La sección deriva el renderer y CSS de escritorio, seis datos de carta y los
originales locales de arte. No carga `motor.js`, una partida, el audio ni el
progreso. Su comprobación concreta es:

```sh
node dev/secciones/pruebas_interacciones_exportacion.mjs
```

## Aliento de fuego (pruebas de animación de poderes)

La revisión está en `/fuego/`, con tres animaciones de `caoz_tcg/fx-aliento.js`:

- `entrada(host,{carta,afectados:[{nodo,dano}]})`: sin fuego. La carta brilla en
  verde, lanza una onda de ácido por la mesa y cada afectada destella en verde,
  tiembla, burbujea y muestra su daño al recibirla.
- `ataque(host,{atacante,objetivo,letal:false,dano})`: el fuego verde del
  ataque; el objetivo encaja el golpe (brillo, llamas breves, marcas de quemado
  que se apagan, su daño) y sigue en pie.
- `ataque(host,{atacante,objetivo,imagenObjetivo,letal:true})`: el objetivo arde
  desde el impacto hasta la ceniza. El umbral del quemado sale de los cuantiles
  del frente: a mitad del quemado ha ardido la mitad.

Llamas, chorro y quemado van en WebGL con ruido fbm; brasas, onda, burbujas y
ceniza en Canvas 2D. «Cámara lenta» lo reproduce a 0,35×. Las animaciones de
Thal aún no están conectadas al combate. `quemar(host,{objetivo,color})` sí:
es la muerte de Machete en la partida (build 278), y en la sección se revisa con
«Muere Machete», con la misma llamada.

La misma sección revisa la **Ascensión de Petunia** (`caoz_tcg/fx-ascension.js`,
«Petunia asciende»), aún sin conectar a la partida:
`ascender(host,{objetivo,imagen,imagenNueva,alRevelar})`. La carta se queda gris,
cae un rayo de luz dorada, gira dos vueltas en 3D envuelta en oro (textura en
perspectiva en WebGL) y la cara de Petunia Sagrada se revela desde arriba con el
disolvente del quemado al revés; detrás se abren alas de luz y caen plumas.
`alRevelar()` avisa cuando la cara nueva está entera para ponerla en el DOM; al
acabar el objetivo vuelve a verse. Sin WebGL o con movimiento reducido devuelve
`false` y quien llama cambia la carta directamente.

## Animaciones de poderes

La revisión está en `/poderes/`, con `caoz_tcg/fx-poderes.js` (aún sin conectar a
la partida). Cada botón hace la llamada que hará el juego:

- `esporas(host,{origen,objetivos})`: del muerto salen nubes de esporas hasta
  cada objetivo, que queda **Infectado**: moho oscuro que crece desde los bordes
  y late mientras dura (`infectar`, `curar`).
- `polimorfar(host,{objetivo,imagen,imagenNueva,alCambiar,sacudir})`: la carta
  se retuerce, estalla en humo morado y la nueva cae y sacude la mesa. La
  vuelta es la misma llamada con las caras al revés.
- `congelar(host,{objetivo,origen,impacto})` y `descongelar`: escarcha con
  cristales desde el impacto, vaho y carámbanos; al deshelarse gotea.
- `apagar(host,{objetivo,origen})`: el Collar de Agua; una burbuja apaga el
  fuego entre vapor y estalla en gotas.
- `poseer(host,{objetivo,destino})` y `liberar`: humo negro con ojos rojos y la
  carta apagada; con `destino` (Poseer de Thal) flota hasta allí.
- `gracia(host,{pip,celestiales,alLlenar})`: la quinta Gracia de Talesyn; luz
  celestial en toda la mesa y las Celestiales se vuelven de oro un instante.
- `aturdir(host,{objetivo})`, `despertar` y `risa`: estrellas y pajaritos que
  giran sobre la carta ladeada; la Risa de Tasha la hace temblar entre «¡JA!».
- `llave(host,{desde,hasta,alLlegar})` y `pergamino(host,{objetivo,turno,total})`:
  la Llave vuela girando hasta el contador; el Pergamino se abre y enciende sus
  runas, y en el último turno estalla en luz.

Los estados que duran van en un lienzo dentro de la carta (`canvas.fxEstado`,
`data-fx-<estado>`), con un reloj compartido. Con movimiento reducido no hay
animación, pero los estados se ponen igual, quietos.

```bash
node dev/secciones/pruebas_poderes.mjs
python3 dev/secciones/publicar.py --publicar --seccion poderes --salida /tmp/caoz-poderes
```

## Campos de los Lugares

La revisión está en `/lugares/`, con `caoz_tcg/campo-lugar.js` (aún sin conectar
a la partida). `CAOZ_CAMPO_LUGAR.crear(mesa,{arte,linea})` pinta detrás de las
cartas el escenario del Lugar en juego: su ilustración de fondo (oscurecida,
con deriva lenta), un velo para que se lean las cartas, un suelo propio
(losas con brasas, tablones, adoquines, roca nevada, obsidiana con runas), el
ambiente (brasas y proyectiles, luz de velas, niebla y los guardianes, nieve y
la sombra del dragón, la cúpula que late) y el borde del lado que lo controla.
`poner(id,{lado})` lo abre como un portal sobre el anterior; `quitar()` lo retira.

Las reglas visibles: `perderPD` (Tomsage), `brindis` (Antro), `ataqueAlma`
(Puente: con 8+ pasa, si no los martillos se cruzan), `tiradaAidman` (Montañas:
con 1-3, alud y Aidman) y `muerte` (Domo: −1 Alma al dueño, +1 PD al rival).
Con movimiento reducido el escenario queda quieto y las reglas se aplican sin
animación.

```bash
node dev/secciones/pruebas_lugares.mjs
python3 dev/secciones/publicar.py --publicar --seccion lugares --salida /tmp/caoz-lugares
```

Con `fondo(id)` cada mapa lleva lo que se guardó en el Estudio,
`{url,x,y,z,efectos,intensidad}`: un fondo propio (más claro y sin el suelo
pintado, con su encuadre y zoom) y su propia lista de efectos encima, elegidos
de `CAOZ_CAMPO_LUGAR.EFECTOS` (brasas, humo, proyectiles, velas, polvo,
niebla, guardianes, nieve, lluvia, relámpagos, luciérnagas, sombra de dragón,
cúpula y ascuas), con intensidad de 0,25 a 2. Sin lista usa los de serie del
Lugar (`DE_SERIE`). Las reglas visibles siguen igual. `fondoCambiado()`
repinta la escena en curso.

## Estudio · Campos de batalla (laboratorio)

La revisión está en `/estudio-campos/`: el espacio que tendría el Estudio para
cambiar el fondo de cada Lugar con un diseño propio. Se sube una imagen (se
prepara igual que en el Estudio: WebP de hasta 1600 px y 1,5 MB), se encuadra
con horizontal, vertical y zoom, se eligen los efectos propios del mapa y su
intensidad (también sin cambiar la imagen), y se ve en la mesa real (`campo-lugar.js`) en escritorio y móvil.
«Guardar» sólo lo conserva en memoria: no hay acceso ni peticiones.

```bash
node dev/secciones/pruebas_estudio_campos.mjs
python3 dev/secciones/publicar.py --publicar --seccion estudio-campos --salida /tmp/caoz-estudio-campos
```

## Cortinilla del Domo

La revisión está en `/cortinilla/`: la transición entre la pantalla de carga y
el menú principal, hecha con las cartas del visor 3D (`caoz_tcg/cortinilla.js`
sobre `visor-3d-gl.js` y las texturas de `carta-pintor.js`). La pantalla de
carga avanza mientras se pintan doce cartas en sus tres ediciones; el logo se
convierte en el dorso de una baraja, la baraja se abre en un carrusel 3D que
gira y voltea las cartas, el carrusel se deshace en un torbellino que forma un
muro de cartas que tapa la pantalla (ahí se cambia la carga por el menú), una
ola de luz lo recorre y las cartas se abren desde el centro como hojas de
puerta para dejar ver el menú. Unos 4 s; un toque o una tecla la salta. Sin
WebGL o con movimiento reducido, la carga se funde en el menú.

`CAOZ_CORTINILLA.crear(host,{cartas,logoUrl})` → `preparar(progreso)`,
`reproducir({alCubrir,alAbrir})`, `saltar()`, `destruir()`.

```bash
node dev/secciones/pruebas_cortinilla.mjs
python3 dev/secciones/publicar.py --publicar --seccion cortinilla --salida /tmp/caoz-cortinilla
```

## Invocar una carta

La revisión está en `/invocar/`, con `caoz_tcg/fx-invocar.js` (aún sin conectar
a la partida, donde hoy `fxSummon` hace un pequeño salto). La carta sale de la
mano como carta 3D del visor (`visor-3d-gl.js`, con la cara ya pintada: no
repinta nada), sube hacia la cámara dando una vuelta y cae sobre su casilla:
onda, destello, chispas del color de su edición, polvo y un leve temblor de la
mesa. La legendaria se detiene en lo alto entre rayos de luz y cae con más
fuerza; la del rival viene de arriba; las fichas aparecen del aire. Varias a la
vez comparten un lienzo WebGL y uno 2D.

`CAOZ_FX_INVOCAR.invocar(host,{carta,imagen,desde,lado,acabado,legendaria,aire,sacudir})`
→ `Promise<boolean>` al caer; `false` sin WebGL, sin cara o con movimiento reducido.

```bash
node dev/secciones/pruebas_invocar.mjs
python3 dev/secciones/publicar.py --publicar --seccion invocar --salida /tmp/caoz-invocar
```

## Visor en WebGPU (El Mago del Domo)

La revisión está en `/visor-gpu/`: la carta del visor 3D portada a WebGPU
(`caoz_tcg/visor-3d-gpu.js`, shader en WGSL) junto a la misma carta en WebGL
(`visor-3d-gl.js`, el motor del juego). Misma interfaz (`crear` es asíncrono y
devuelve `null` sin WebGPU); añade MSAA 4×, mipmaps generados en la GPU y
filtrado anisótropo 16×. «Comparar», «WebGPU» o «WebGL»; edición Normal, Foil
o Foil dorado; «Dar la vuelta»; arrastrar para girar. `?solo=gpu|gl` crea un
solo motor. Sin WebGPU, la sección avisa y enseña sólo WebGL.

El escenario por defecto es la tormenta (`?escena=estudio` abre el estudio):
`tormenta-gl.js` y `tormenta-gpu.js` son la misma escena para cada motor, que
el visor recibe con `crear(lienzo,{escena})`. Detrás de la carta, un cielo de
nubes (fbm), tres cordilleras con niebla y el rayo, todo procedural; delante,
hasta 160 000 gotas en 3D que la profundidad esconde detrás de la carta. Los
relámpagos caen cada 3–7 s en instantes fijos (los dos motores y las pruebas
ven el mismo) y encienden nubes, montañas, lluvia y la carta (`e.flash`,
`e.flashDir`, `e.tormenta`; sin ellos el visor del juego queda igual). Calidad
Media, Alta o Extrema (10 000, 40 000 o 160 000 gotas y 4, 6 u 8 octavas de
nubes), «⚡ Relámpago» y trueno sintetizado opcional. Para medir, elige un solo
motor: los FPS aparecen en su panel.

Chrome sin pantalla (el de las pruebas) pierde el dispositivo WebGPU al
presentar el lienzo; por eso las pruebas usan `?presentar=0` y
`CAOZ_VISOR_GPU_REVISION.captura()`, que lee el fotograma de una textura propia
(`capturar()`). En un navegador normal se presenta con normalidad.

```bash
node dev/secciones/pruebas_visor_gpu.mjs
python3 dev/secciones/publicar.py --publicar --seccion visor-gpu --salida /tmp/caoz-visor-gpu
```

## Visor en three.js (El Mago del Domo)

La revisión está en `/visor-three/`: la misma carta y las mismas texturas de
`carta-pintor.js`, esta vez con three.js 0.186.1 para ver qué aporta el motor
(la carta física está en `three-carta.js`, compartida con la mesa).
- **Carta:** `MeshPhysicalMaterial` con:
  - relieve (normal map), metal y rugosidad por zona (el ORM de siempre);
  - laca como `clearcoat`;
  - la película holográfica como iridiscencia de capa fina (`iridescenceMap` = la máscara);
  - destellos inyectados en su shader (`onBeforeCompile`);
  - canto de oro cepillado (`anisotropy`) y dorso con el logo en relieve.
- **Estudio:**
  - un entorno propio con cajas de luz, preconvolucionado con PMREM;
  - dos focos con sombras suaves;
  - haces de luz visibles con polvo;
  - suelo espejo de mármol negro (`Reflector`) y un pedestal de terciopelo (`sheen`);
  - una linterna que sigue al puntero sobre la carta (raycasting).
- **Posproceso:** HDR (media precisión) con MSAA 4×, profundidad de campo, resplandor y tono AgX.
- **Invocar:** lanza un estallido de 5000 chispas de oro animadas en la GPU.
- **Efectos:** cada uno se apaga desde la página, y el marcador enseña fps, llamadas de dibujo y triángulos para ver cuánto cuesta cada uno.

three.js no es una dependencia del juego: `visor-three-construir.mjs`
empaqueta `visor-three-entrada.mjs` (el núcleo y los complementos que usa la
prueba) en `visor-three-vendor.js`, un único script minificado con su
licencia MIT. Así cumple la CSP de las secciones: sólo scripts propios, sin
CDN ni `eval`. Para regenerarlo:

```bash
npm i --prefix /tmp/three three@0.186.1 esbuild@0.25.10
node dev/secciones/visor-three-construir.mjs /tmp/three
node dev/secciones/pruebas_visor_three.mjs
python3 dev/secciones/publicar.py --publicar --seccion visor-three --salida /tmp/caoz-visor-three
```

## La mesa en three.js (maqueta de partida)

La revisión está en `/mesa-three/`: una partida a medias (Gero contra Talesin)
vista desde la silla del jugador, con las mismas cartas físicas del visor. La
carta está en `three-carta.js`, que comparten las dos pruebas: relieve, laca,
iridiscencia, destellos y un disolverse en brasas cuando muere.
`carta-pintor.js` pinta la cara con `cifras:false`, y el ataque y la vida van
encima, vivos: se ponen rojos al recibir daño.

- **La mesa:**
  - madera con vetas en relieve y un tapete de cuero repujado en oro con sus zonas (cinco huecos por campo, trampas, protagonista, mazo y cementerio) y runas que laten;
  - una lámpara con sombras, dos velas con llama y sombras, y polvo en la luz.
- **Recursos:**
  - el Alma, un cristal de vidrio que refracta (transmisión y dispersión) con su número encima;
  - los PD, gemas que se encienden; las Llaves, fichas de oro.
- **Posproceso:** HDR con MSAA, oclusión ambiental (GTAO: el contacto de las cartas con el tapete), profundidad de campo, resplandor y AgX.
- **Jugar:**
  - la mano va pegada a la cámara y la carta bajo el puntero se levanta;
  - al pulsarla vuela a su hueco y cae con una onda, chispas y un temblor; si es dorada, con un pilar de luz;
  - los Hechizos estallan y van al cementerio;
  - para atacar, pulsa una de tus cartas y después una enemiga (o el cristal rival): la carta embiste, salen los números de daño y la que muere arde y va al cementerio;
  - «Turno del rival» roba, juega y ataca; «Demostración» hace todo seguido.

**Mirar la mano y bajar cartas.**

La mano copia la de la mesa de siempre (`#hand .handSlot`):
- **Al pasar por encima**, la carta:
  - se endereza, sube desde su base y crece hasta leerse (hasta 1,7×), sin salirse nunca de la pantalla;
  - se inclina con el puntero y aparta a sus vecinas;
  - entra rápido y se va despacio;
  - lleva el foco del posproceso consigo, así que la mesa se desenfoca detrás;
  - tapa las etiquetas del Alma que tiene debajo, en vez de dejar que se pinten encima.
- **Sin parpadeo:** el puntero lo recibe la ranura, un rectángulo invisible que no crece, no la carta ampliada. Cada carta monta sobre la de su izquierda.
- **PD:** las que puedes pagar brillan en el canto; las demás se ven apagadas y, al mirarlas, dicen por qué («Te faltan 2 PD…»).
- **En la mano:** una luz de lectura que viaja con la cámara y un reflejo del entorno más tenue evitan que la laca refleje la caja de luz como un velo.

**Para bajarla:**
- **Pulsar** la lleva al primer hueco libre, como en la mesa de siempre.
- **Arrastrar:**
  - la carta sigue al puntero sobre la mesa, inclinada por su velocidad;
  - se encienden los huecos libres, y el que queda debajo muestra la silueta de dónde caerá;
  - al soltar cae exactamente ahí; soltada fuera, vuelve a la mano;
  - sin PD no se levanta y lo dice;
  - los Hechizos y las Trampas se lanzan soltándolos sobre la mesa.
- **En táctil**, donde no hay «pasar por encima»: tocar la abre en grande con «Jugar» (desactivado si no se puede pagar) y «Cerrar».

Las cartas del campo recuerdan su hueco. Cuando una muere, el suyo queda libre.

Las reglas son una maqueta, no el motor del juego. En horizontal se ve la mesa
entera; en vertical, los dos campos, y lo demás se ve mirando alrededor
(arrastrando). La revisión (`CAOZ_MESA_THREE_REVISION`) avanza el tiempo a pasos
fijos, cediendo el turno entre pasos, para que las animaciones encadenadas
sigan como en tiempo real.

```bash
node dev/secciones/pruebas_mesa_three.mjs
python3 dev/secciones/publicar.py --publicar --seccion mesa-three --salida /tmp/caoz-mesa-three
```

## Las casas de Tomsage (three.js)

La revisión está en `/casas-three/`: una calle de noche con los tres tipos de
casa del módulo `casas-three.js`, que también usa la plaza del ARPG.

- **Tipos:**
  - la entramada: dos plantas, la de arriba volada sobre ménsulas;
  - la taberna La Jarra Rota: planta baja de sillares, letrero colgado y toneles;
  - la cabaña de piedra: con buhardilla y chimenea exterior.
- **Ventanas con interior mapping:**
  - cada cristal es un solo cuadro, pero su shader sigue la mirada dentro de una habitación (papel pintado, suelo de tablas, vigas, un cuadro, la chimenea encendida y la lámpara) con perspectiva que cambia al moverse;
  - encima, cortinas, vidrio emplomado en rombos y el reflejo del cielo;
  - un halo cálido en la fachada y la luz que cae al suelo, sin luces reales;
  - la semilla de cada ventana (qué habitación y si está encendida) llega al shader con `flat`: interpolada, el hash la convertía en moteado.
- **Texturas pintadas por código, con relieve:** yeso con manchas, grietas y desconchones; roble; sillares; tablas con herrajes. Los tejados y el pozo usan las tejas de barro aportadas en `clay-shingles1-bl.zip`, con color y normal OpenGL a 1024 px y oclusión/rugosidad empaquetadas a 512 px. Todos comparten los tres mapas locales de `texturas-casas/` (1.68 MB), repetidos cada 4 m; oclusión al 50 %, relieve 0.7, sin desplazamiento. Si un mapa falla, permanece la textura procedural de respaldo. La base de las paredes se oscurece con color por vértice.
- **Coste:**
  - las casas normales quedan por debajo de 3.500 triángulos; la taberna, con sus tres toneles detallados, usa unos 7.300;
  - `fundir()` junta todas las casas en una malla por material, así que la calle entera son como máximo 14 mallas;
  - las farolas no tienen sombra, porque una luz puntual con sombra dibuja la escena seis veces.
- Cámara orbital, vistas de cada casa, noche o atardecer, y botón para apagar las luces de dentro.

```bash
node dev/secciones/pruebas_casas_three.mjs
python3 dev/secciones/publicar.py --publicar --seccion casas-three --salida /tmp/caoz-casas-three
```

Las cajas y barriles se construyen en `casas-three.js` mediante `utileria('caja'|'barril', opciones)`. La caja tiene tablones separados, marco, refuerzos diagonales, escuadras y clavos. El barril tiene 16 duelas abombadas, cuatro aros con remaches, tapas de siete tablas y tapón. Comparten dos materiales mates (roble y forja), y se funden con el barrio sin añadir llamadas por objeto ni actualizaciones por fotograma. También reemplazan los toneles de la taberna. La vista `casas-three.html?solo=utileria` permite inspeccionarlos de cerca; el juego conserva sus ubicaciones y colisiones.

## Caoz ARPG (ARPG en three.js, proyecto paralelo)

La revisión está en `/arpg-three/`: el Hito 1 de la propuesta de un ARPG al
estilo Diablo con los personajes del juego. Es una sala jugable: Adreida, la
Guerrera Semiorca, defiende la plaza de Tomsage bajo asedio contra cuatro
oleadas, y al final entra Can, el de los Goblins.

- **Modelos 3D sencillos:**
  - hechos con primitivas de three.js en `arpg-three-modelos.js`, sin archivos de modelo;
  - Adreida (con su hacha de doble filo), el Goblin de Camino, el Kobold lancero, el Saqueador y Can, con los colores de sus cartas;
  - cada uno tiene un esqueleto de huesos y una malla con piel por material (tres llamadas de dibujo por personaje);
  - las animaciones son procedurales: andar, tajo, aviso, torbellino, salto, grito, lanzar, aturdido y muerte;
  - al morir se deshacen en brasas.
- **La plaza:**
  - ciudad rodeada por una muralla de 24 paños, a 26 m del centro, con las casas dentro del recinto. La colisión coincide con las caras interiores de piedra. Tres portones alineados con las calles dejan entrar a los invasores; un sello ámbar visible impide que el jugador los cruce. Las oleadas aparecen fuera de esos portones y avanzan por ellos;
  - prueba de límites y portones: `node dev/secciones/pruebas_arpg_muralla.mjs`;
  - adoquines con relieve, las casas de Tomsage (`casas-three.js`, con su interior tras las ventanas; tres arden), el pozo, un carro, barriles y braseros;
  - piso predeterminado con la textura aportada en `angled-blocks-vegetation-bl.zip`, también al abrir el juego sin parámetros. **Pausa → Textura del piso** permite comparar con los adoquines originales sin reiniciar; `?piso=actual` elige ese material explícitamente. La elección se conserva en los enlaces de etapas. `&captura=1` permite comparar el mismo encuadre quieto. Los tres mapas locales de `texturas-piso/` (1024 × 1024, unos 2.7 MB en total) aportan color sRGB, normales OpenGL y oclusión/rugosidad empaquetadas; repetición de 7.2 m (piedras un 50 % mayores que en la primera prueba), relieve 0.7 y oclusión al 50 %. No añade polígonos, desplazamiento ni llamadas de dibujo; los tres mapas son compartidos con las piedras del salto y los bordes de cráter. Si fallan al cargar, conserva el material original y muestra el aviso. Fuentes y tratamiento en `texturas-piso/procedencia.json`;
  - luna azul plateada con iluminación lateral y sombras, cielo frío de relleno, la luz cálida que lleva Adreida (el radio de luz de Diablo) y el fuego. La bruma azul de distancia comienza después del 62 % de la distancia de cámara y se completa a 2.65 veces esa distancia; se adapta al zoom y al encuadre cooperativo, sin otra pasada de render ni partículas adicionales;
  - lluvia ligera y charcos con bordes irregulares y ondas pequeñas (`arpg-three-clima.js`). Las gotas se animan en GPU alrededor de la cámara y se recortan bajo los tejados; los charcos evitan casas/obstáculos y respetan los agujeros del salto. Sólo dos mallas adicionales, sin luces nuevas, sombras, cámaras de reflejo ni posproceso. 440 gotas y 28 charcos en la plaza; el mundo abierto reparte 130 charcos. La opción de movimiento reducido usa 220 gotas y elimina el destello;
  - tormenta lejana: resplandor suave de 1.8 s sobre la luz de cielo existente, cada 28–50 s, seguido de un retumbo grave 3.8–6.2 s después. La lluvia y los truenos se sintetizan localmente con Web Audio, sin descargas ni cambios de CSP. El audio empieza con el primer clic/tecla; si el navegador no admite activarlo desde el mando, basta un clic en el juego. Se silencia al pausar, abrir las cartas, ocultar la pestaña o activar otra partida. **Pausa → Lluvia y charcos / Sonido de lluvia y truenos lejanos** permite desactivarlos; ambas preferencias se guardan localmente. Prueba focalizada: `node dev/secciones/pruebas_arpg_clima.mjs`;
  - todo lo estático se funde por material;
  - una pasada de saneado cambia cualquier píxel NaN o infinito por negro antes del resplandor (en Metal, en Mac, un solo NaN se agrandaba en cuadros negros).
- **Esferas de Alma y Furia:** QuickLiquid 0.1.2 (MIT, revisión `fbb19b5f1cd4097e62831da44df0bee0097433ca`) aporta la lente refractiva y los resortes del movimiento. `arpg-three-orbes.js` dibuja el líquido interior rojo/dorado con superficie ondulada, corrientes y burbujas; el nivel sigue los recursos reales, y su balanceo responde a la aceleración y a ganar/perder recurso. Los números exactos quedan fuera de la lente, con semántica accesible de medidor. Dos lienzos de 192 × 192 a un máximo de 30 FPS, un mapa de refracción compartido y una muestra de desplazamiento por esfera; sin React, CDN, luces, pasadas three.js ni bucle de animación continuo adicional. El reloj se detiene con la partida; movimiento reducido conserva niveles estáticos. QuickLiquid conserva su alternativa CSS en navegadores sin refracción SVG. Procedencia y licencia: `quick-liquid-procedencia.json` y `quick-liquid-LICENSE.txt`. Prueba: `node dev/secciones/pruebas_arpg_orbes.mjs`.
- **Dos personajes (se elige arriba, o con `?heroe=mohamed`):**
  - Adreida, cuerpo a cuerpo, con el hacha a dos manos (el combo de tres hachazos, Torbellino, Salto con el hacha clavada que arranca 24 fragmentos de adoquín: salen despedidos, giran, rebotan y desaparecen en unos tres segundos; reserva de 72 fragmentos en una sola malla reutilizable). Los fragmentos comparten los mapas del piso elegido y toman una porción de sus UV al nacer: el color, relieve y vegetación permanecen adheridos durante el vuelo y los giros. Alternar el piso de prueba también cambia los escombros, reutilizando los dos materiales;
  - Mohamed, a distancia, con una pistola de chispa: el clic dispara hacia el cursor (se puede andar, más despacio, mientras dispara); seis balas y recarga sola (1,1 s); Q, Abanico de siete balas; clic derecho, Backflip al cursor: al caer, los enemigos que lo ven (a 6 m y mirando hacia él) se quedan impresionados, aturdidos 2,6 s (Can, 1,2 s); 100 de Alma;
  - una línea de puntería sale del cañón y termina en el primer enemigo u obstáculo (o al agotar el alcance); el extremo se vuelve rojo al apuntar a un enemigo. La pistola sigue el cursor incluso sin disparar. Las balas salen de la pose actual y siguen exactamente ese eje, sin retraso al girar ni desviación vertical; el Abanico se abre alrededor de la misma dirección. Con mando o puntería automática, el cañón ajusta la altura al primer enemigo en la dirección indicada, para alcanzar también a los goblins cercanos; respeta las coberturas y no busca enemigos fuera de esa línea. La colisión recorre todo el segmento de cada fotograma para no atravesar enemigos ni coberturas. `node dev/secciones/pruebas_arpg_disparos.mjs` comprueba trayectoria, daño, buffs y Furia en solo/cooperativo a distintas distancias y FPS;
  - dos propuestas de bala (se elige en Efectos o con `?balas=trazadora`): A, la bola de plomo de una pistola de chispa con un trazo corto al rojo y chispas; B, una bala alargada de latón con ojiva de cobre y una estela larga y fina de luz; no interrumpen a los enemigos pero dan Furia; el parry y el dash son iguales para los dos; Mohamed conserva Provocar en E.
- **Combo de Can · Centro → lados:** sus ataques normales encadenan un cono frontal de 60° y 4,6 m de radio (aviso de 1,05 s; 32 de daño) y dos conos laterales de 60° y el mismo radio, orientados a ±60° del frente (aviso de 0,55 s; 27 de daño). Entre impactos pasan unos 0,77 s, según el cuadro. Los tres sectores tienen a Can como centro, también si recibe empuje; sus ángulos conservan la dirección inicial de la cadena. Cubren el semicírculo frontal en dos tiempos: primero el sector del medio, después los dos de los lados. Puedes salir del cono central y volver a él antes del segundo impacto. El borde se vuelve blanco azulado durante los últimos 0,18 s, la ventana para iniciar el parry perfecto. Un parry en cualquiera de los golpes cancela la cadena y deja a Can aturdido/expuesto; en cooperativo también protege al compañero del mismo impacto. El bloqueo tardío sólo reduce el daño. Las escoltas aplazan nuevos avisos durante el combo. Tras ambos golpes Can recupera 1,05 s y respeta su cooldown; sigue alternando con su golpazo circular imparable y conserva los refuerzos a media vida. El inspector permite invocar **Can · Centro y lados**. `node dev/secciones/pruebas_arpg_can.mjs` comprueba zonas y hueco en cuatro orientaciones, tiempos a 30/60/120/144 FPS, parry, bloqueo, dash, cooperativo, poses y retirada de marcas.
- Los proyectiles de los kobolds se representan como flechas doradas luminosas, con punta ancha, asta, plumas y estela afilada. El brillo de la punta pasa a blanco dorado durante la ventana de parry; al desviarlas conservan su silueta.
- **Mando PS5 (DualSense):** USB o Bluetooth mediante Gamepad API con distribución estándar. Pulsa un botón para que el navegador lo detecte y suéltalo. Stick izquierdo: mover; derecho: apuntar; R2 o cuadrado: atacar; cruz: dash; círculo: salto inmediato de Adreida de 5 m; durante el vuelo, tirar del stick izquierdo hacia atrás lo acorta hasta 1 m (hacia delante recupera el alcance original), conservando la animación de 0,72 s. Al despegar apunta hacia el stick izquierdo (si está centrado, hacia donde mira; respeta los límites y obstáculos de la plaza) / backflip inmediato de Mohamed; L1 o L2: parry; R1: Torbellino / Abanico; triángulo: Hacha búmeran / Provocar. Zona muerta del 18 %, habilidades por pulsación; Adreida carga el básico al mantener y golpea al soltar; Mohamed sigue disparando al mantener. Al perder foco o desconectar se libera el control; al volver hay que soltar botones y sticks. Teclado, ratón y táctil siguen disponibles.
- **Etapa 2 · Cobro de piso:** en la misma plaza, después de vencer a Can y su escolta, hay 8 s para recoger el botín. Se conservan cartas, estadísticas y Llave del Mago, y se recuperan hasta 40 de Alma. El nivel tiene tres fases: seis cobradores; cuatro cobradores y dos lanceros; y finalmente El Recaudador, un troll de 3 m y 1100 de vida, con seis goblins cobradores de escolta. Sus ataques rotan entre barrido (permite parry), mazazo circular imparable (avisa 1,5 s) y lanzamiento de goblin (avisa 1,4 s). El mazazo arranca cinco piedras: vuelan en arco y caen en zonas marcadas, con 22 de daño por impacto y entre 1,45 y 1,93 s para apartarse. Los destinos se fijan al despegar. Los círculos pasan de naranja a dorado a 0,55 s de caer y a blanco azulado durante los últimos 0,25 s, la ventana del parry. El troll saca un cobrador, lo sujeta con la mano izquierda y lo lanza: causa 24 de daño al caer y se incorpora al combate después de 1,2 s aturdido; no deja botín. Un parry perfecto devuelve tanto piedras como goblins: al alcanzar al troll lo aturden y abren su armadura. Un bloqueo normal sólo reduce el daño. Se mantiene el límite de cuatro enemigos contando también los goblins sujetos y en vuelo. Al 50 % de vida empieza la segunda fase (un golpe no puede saltársela): se mueve un 20 % más rápido, y sus avisos y pausas entre ataques duran un 15 % menos; aura violeta y blindaje contra todo daño, salvo los 2,5 s de aturdimiento causados por un parry perfecto. El salto, el backflip, los bloqueos normales y la recuperación tras el mazazo no abren la armadura. El HUD indica cuándo está vulnerable; al morir el jefe o reiniciar se limpian sus proyectiles. La victoria requiere derrotar a todos los cobradores restantes. Acceso directo: `arpg-three.html?etapa=2&heroe=adreida` (también admite Mohamed); reiniciar conserva la etapa de la URL.
- **Control a lo Hades:**
  - WASD (o flechas) mueve;
  - Adreida corre con el ciclo completo **Fast Run.fbx** aportado por el usuario: cadera, torso, cabeza, piernas, pies y brazo izquierdo. Se adapta a sus proporciones y mantiene 5,8 m/s, con 3,1 m por ciclo (unos 0,53 s). La marcha lenta conserva los apoyos con IK y 1,35 m por ciclo; ambas se mezclan según el stick. La derecha sostiene el hacha sobre el hombro; la izquierda acompaña la zancada;
  - los clics cortos encadenan tres hachazos: tajo, revés y un hachazo vertical. Mantener y soltar prepara un golpe cargado: 0,9 s para cargar al máximo, hasta ×3 el daño de ese básico y más empuje; queda inmóvil mientras carga. El brillo y el porcentaje del botón indican la carga;
  - Adreida utiliza el modelo aprobado de Scenario / Tripo 3.1, con piel verde oliva, cabello oscuro, top y falda de cuero, hombrera con púas y cinturón de cráneos. El cuerpo tiene 15.408 triángulos; con el hacha independiente suma unas 18.500 y cuatro llamadas de dibujo;
  - Adreida descansa el hacha de doble filo sobre el hombro derecho, con la cabeza detrás y ambas manos delante del pecho; la empuña con las dos manos al atacar: cada pose dice dónde va la empuñadura y hacia dónde apunta el hacha, y los dos brazos llegan con cinemática inversa (la derecha junto al pomo y la izquierda 30 cm hacia la cabeza, siempre sobre el mango y dentro del alcance de ambos brazos);
  - en cada impacto la cabeza del hacha barre la zona que golpea, con un rastro de corte;
  - el combo empieza lento; los resultados de cartas de rapidez modifican su velocidad para el siguiente nivel;
  - con el ratón encima de un enemigo se apunta a él;
  - Espacio es el parry: Adreida alza el hacha 0,35 s y se gira sola hacia el golpe que llega; su cuerpo y su hacha brillan en dorado durante el parry, con un destello que se desvanece durante 0,3 s si es perfecto;
    - si el golpe llega en las primeras 0,18 s es perfecto: no hace daño, aturde al atacante 2 s (1 s a Can) y lo deja expuesto (le haces el doble), con un parón, +20 de Furia y reinicio de todos los cooldowns de habilidades (los costes de Furia se mantienen); una lanza desviada vuelve contra quien la lanzó (el triple de daño);
    - las lanzas de los kobolds brillan (un halo naranja que late y una estela densa); cuando el halo se vuelve blanco y grande, está en la ventana del parry perfecto (para las lanzas, 0,25 s);
    - más tarde, solo bloquea: recibe el 30%;
    - un parry al aire deja medio segundo sin poder repetirlo; por la espalda no se para, ni el golpazo de Can (zona violeta, «¡Imparable!»);
  - Shift es el dash (cooldown de 1,05 s; un instante invulnerable; atravesar un golpe da «¡Esquivado!» y Furia);
  - clic derecho, Salto al cursor; Q, Torbellino; E, Hacha búmeran;
  - durante Torbellino, Shift / cruz conserva el giro y su estela durante todo el dash, dañando a los enemigos a lo largo del recorrido. Mantiene el coste inicial de 30 de Furia y un impacto por enemigo cada 0,2 s; el dash conserva su cooldown e invulnerabilidad. Al terminar continúa el tiempo restante de los 1,35 s originales; si se activa al final del giro, éste se prolonga sólo hasta acabar el dash. `node dev/secciones/pruebas_arpg_torbellino.mjs` comprueba trayectoria, cadencia, transiciones y cooperativo a distintos FPS;
  - la Furia sube al golpear y al recibir golpes.
- **Quién ataca y cuándo:**
  - cada ataque dibuja en el suelo su zona exacta (cono, línea del kobold o círculo del golpazo de Can), que se llena hasta el golpe; lo que se ve es lo que golpea;
  - el atacante lleva un «!» y un contorno rojo que crece;
  - en el último tramo se fija: deja de girar, la zona y el «!» se encienden, y es el momento de salir o esquivar;
  - quien ataca desde fuera de la pantalla tiene su flecha en el borde;
  - al recibir un golpe, un arco rojo en el borde marca de dónde vino y el atacante destella;
  - como mucho dos enemigos se acercan para atacar cuerpo a cuerpo a la vez; los demás se reparten alrededor, a unos 4 m, y los relevos rotan aproximadamente cada 7 s. La primera línea conserva su plaza durante la recuperación y el enfriamiento: guarda la distancia y mira al jugador, sin volver al anillo después de cada golpe. Los comienzos de los ataques se separan al menos 0,55 s; sólo un kobold prepara o lanza a la vez.
  - los enemigos rodean el pozo, el abrevadero y los demás obstáculos con rutas locales de celdas de 65 cm cuando no hay paso directo. La ruta considera el radio de cada enemigo, conserva el lado elegido y se recalcula si cambia el destino o un empujón la bloquea. No empiezan un golpe cuerpo a cuerpo a través de un obstáculo. `pruebas_arpg_ritmo.mjs` cubre guardia, relevos, rutas y llegada al combate desde detrás del pozo.
- **Ritmo de combate (referencia: [Hades II, video de penguinz0](https://www.youtube.com/watch?v=6a4LIrDkyag)):**
  - propuesta: leer el aviso → abrir espacio con movimiento/parry/dash → contraatacar durante la recuperación;
  - goblins a 2,85 m/s (antes 3,8), aviso de 0,85 s y recuperación de 0,8 s. Mohamed puede ganar distancia incluso mientras dispara; los saqueadores y Can mantienen su peso con avisos y recuperaciones más largos;
  - la dificultad sigue en el daño (goblin 13, kobold 16, saqueador 24, Can 32 y su golpazo 48), no en perseguir todos el mismo punto; Adreida empieza con 120 de Alma y Can conserva sus 800 de vida;
  - oleadas de 6, 8, 10 y Can con 4 escoltas. Entradas en grupos de hasta tres, separadas 0,75 s dentro del grupo y al menos 2,4 s entre grupos; los refuerzos esperan a que baje la presión. Límites de 4/5/6/5 enemigos vivos según la oleada, para las entradas normales. La llamada de Can tiene su propia llegada masiva, descrita abajo;
  - tres segundos de respiro entre oleadas para recoger botín y recolocarse. El HUD muestra los enemigos que faltan por entrar y la cuenta atrás;
  - la separación entre enemigos deja huecos; los que esperan mantienen distancia, pero pueden agruparse con Provocar para aprovechar las habilidades de área.

  Revisión acotada de IA y oleadas (sin navegador ni batería completa):
  `node dev/secciones/pruebas_arpg_ritmo.mjs`.
- **Botín:**
  - los Objetos del juego caen como cartas físicas (`three-carta.js`) en Normal, Foil o Dorado, con su columna de luz;
  - con el ratón encima (o al tocarla) la carta se levanta y crece para leerla;
  - se recoge pisándola y se guarda, sin modificar estadísticas;
  - Can suelta la Llave del Mago dorada (la llave de la primera Grieta, para el Hito 3).
- **Roguelike · Cartas y destino:** cada nivel completo (Asedio o Cobro de piso, no cada fase interna) genera tres cartas distintas del catálogo con riesgos barajados: Conservadora (2–20, +10 %; sólo falla con 1), Temeraria (17–20, +50 % / −10 %) y Descomunal (19–20, +200 % / −15 %). Para cooldown de dash, los beneficios son −8/−30/−60 %; las dos arriesgadas penalizan con +10/+15 %. Se garantizan drops en las bajas 1, 3 y 5; los goblins invocados no cuentan. Si faltan drops al terminar, aparecen junto al héroe. La Llave del Mago es independiente de estas tres cartas.
  - Recoger no aplica buffs: después de derrotar al jefe y su escolta y recoger las tres, el combate se pausa en un diálogo. Eliges una carta, descartas las otras dos y tiras una sola vez. Cada d20 y reparto usan `crypto.getRandomValues` con rechazo del resto para evitar sesgo; no dependen de la semilla del combate.
  - El 1 (5 % siempre) elimina todos los efectos positivos de toda la partida; conserva todas las penalizaciones. El resto aplica el beneficio o el riesgo anunciado. Los efectos se acumulan multiplicándose. Básicos afecta al combo y la pistola; habilidades afecta al Salto/Torbellino de Adreida y Abanico de Mohamed; rapidez afecta al ataque y recarga; vida modifica el máximo conservando el porcentaje de salud; dash modifica el cooldown, no la invulnerabilidad.
  - Tras el ogro puedes iniciar otra vuelta conservando efectos, con +25 % de vida y +10 % de daño base por vuelta para los enemigos. Reiniciar o cambiar de héroe comienza una partida limpia. Ratón/táctil: carta y confirmar; teclado: Tab/Enter; DualSense: izquierda/derecha y ×. El 1 crítico también puede reducir tu vida máxima al retirar un buff.
  - Pruebas acotadas: `node dev/secciones/pruebas_arpg_destino.mjs` (reparto, 20 caras, acumulación, crítico, inventario y transiciones).
- **Táctil:** palanca, Atacar (apunta solo al más cercano), Esquiva y los demás botones.
- **Demostración:** juega sola leyendo sólo los avisos, como un jugador; se detiene en la elección de destino para que el usuario acepte el riesgo.

Comprobación acotada de la línea de puntería y los disparos de Mohamed:

```bash
node dev/secciones/pruebas_arpg_punteria.mjs
```

```bash
node dev/secciones/pruebas_arpg_three.mjs
python3 dev/secciones/publicar.py --publicar --seccion arpg-three --salida /tmp/caoz-arpg-three
```

```bash
node dev/secciones/pruebas_fuego.mjs
python3 dev/secciones/publicar.py --publicar --seccion fuego --salida /tmp/caoz-fuego
```

## Cartas de la partida

La revisión está en `/cartas/` (escritorio) y `/cartas/movil.html` (teléfono).
Muestra la mano del rival con el dorso pintado, su mesa y la tuya, tu mano con
los cinco tipos de carta, las tres ediciones y la ficha ampliada. Las cartas
salen del renderer real de cada pantalla (`cardEl`, `ilustrar`) y la ficha de
`inspectHTML` del motor; `carta-juego.js` les pone la cara del pintor sin cifras
y deja coste, ATQ y VIDA vivos sobre sus gemas. La mesa se simula con cartas
reales marcadas como unidad: sus cifras cambian como las reescribe el render
(mejorada, herida, ya atacó, Foil) y «Simular un golpe» las cambia sin repintar.

```bash
node dev/secciones/pruebas_cartas.mjs
python3 dev/secciones/publicar.py --publicar --seccion cartas --salida /tmp/caoz-cartas
```

## Mulligan inicial

La revisión está en `/mulligan/`. Muestra el mismo selector compartido que usa
la mesa: se conservan las cartas no elegidas y se pueden señalar cero, una o
dos por índice, incluidas copias repetidas. La descripción explica la regla
completa: primero se roban los reemplazos y sólo entonces las cartas elegidas
regresan y se barajan, por lo que una misma copia no puede volver de inmediato.

No hay partida, mazo real, IA, red, sonido ni progreso del jugador. La página
mantiene una mano y un mazo de demostración exclusivamente en memoria para
probar conservar, cambiar una, cambiar dos, restablecer la muestra, cerrar con
Escape y tocar el velo. El núcleo del selector se copia desde
`caoz_tcg/mulligan-ui.js` y `caoz_tcg/mulligan-ui.css`; no mantiene una segunda
implementación de la interacción.

Local: <http://127.0.0.1:8878/dev/secciones/mulligan.html>. Al publicar la
revisión: <https://aislados.caoz-tcg.pages.dev/mulligan/>.

```sh
node dev/secciones/pruebas_mulligan_exportacion.mjs
python3 dev/secciones/publicar.py --seccion mulligan --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion mulligan --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Estudio de nombres de cartas

La revisión está en `/estudio-nombres/`. Muestra cinco cartas reales derivadas
del catálogo actual y deja cambiar únicamente su título visible. El editor usa
`caoz_tcg/nombres-cartas.js` byte a byte: normaliza espacios, aplica el límite
vigente y rechaza caracteres que no pueden mostrarse con seguridad. Los IDs,
estadísticas, reglas, mazos y nombres canónicos del motor no se modifican.

«Guardar borrador» conserva el cambio sólo en un `Map` de memoria de la página;
«Restaurar original» elimina ese borrador. Los tres indicadores explican el
recorrido previsto (local → pendiente de beta → producción), pero son una
simulación explícita: no hay acceso, petición HTTP, publicación ni progreso del
jugador. Al recargar se pierde la muestra temporal.

Local: <http://127.0.0.1:8878/dev/secciones/estudio-nombres.html>. Al publicar
la revisión: <https://aislados.caoz-tcg.pages.dev/estudio-nombres/>.

```sh
node dev/secciones/pruebas_estudio_nombres_exportacion.mjs
python3 dev/secciones/publicar.py --seccion estudio-nombres --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion estudio-nombres --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Portal del Domo

La revisión está en `/portal/`. Reutiliza `caoz_tcg/portal.html`, `portal.css`
y `portal.js`, pero inyecta un transporte exclusivamente en memoria para poder
probar la entrada sin hablar con el Worker, guardar una sesión, abrir Beta o
salir del laboratorio. La clave de la revisión sólo existe en
`portal-preview.js`; el componente real sólo conoce el contrato
`/api/portal/sesion` que resolverá el Worker al integrarse.

Las cinco puertas representan Producción, Beta, Estudio de Cartas, Estudio de
Sonidos y Juego Físico. En esta vista no abren sus destinos reales: cada una
deja una confirmación visible para que la revisión no salga del entorno
aislado ni escriba datos.

Local: <http://127.0.0.1:8878/dev/secciones/portal.html>. Al publicar la
revisión: <https://aislados.caoz-tcg.pages.dev/portal/>.

```sh
node dev/secciones/pruebas_portal_exportacion.mjs
python3 dev/secciones/publicar.py --seccion portal --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion portal --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Invitaciones de sala

La revisión está en `/invitaciones/`. Presenta las dos rutas de una misma sala:
«Compartir código — tiene la app» genera únicamente el código y la instrucción
para abrir **Con amigos → Unirme con un código**; «Compartir enlace — navegador»
genera una URL de la misma edición con `sala`. El selector Producción/Beta hace
visible que la beta no intenta enviar a la instalación de producción.

«Simular apertura del enlace» abre el puente que verá quien llegue al navegador:
puede copiar el código para usar la app instalada o seguir con la entrada en el
navegador. La captura directa de una PWA queda en manos del sistema operativo y
del navegador; el puente conserva la invitación cuando esa captura no ocurre.

El navegador recibe una copia byte a byte de
`caoz_tcg/invitaciones-compartidas.js`, que es la única fuente de normalización,
texto y URL. No hay sala real, acceso, relevos, cuenta ni progreso persistente.

Local: <http://127.0.0.1:8878/dev/secciones/invitaciones.html>. Al publicar la
revisión: <https://aislados.caoz-tcg.pages.dev/invitaciones/>.

```sh
node dev/secciones/pruebas_invitaciones_exportacion.mjs
python3 dev/secciones/publicar.py --seccion invitaciones --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion invitaciones --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Epílogo de Gero: deseo y tres sobres

La revisión está en `/epilogo-gero/` y comienza con un único control de
laboratorio que sustituye el combate que esta página no carga. Tras pulsarlo,
la secuencia que se revisa es exactamente: victoria contra Gero → formulario de
deseo → fuego → «Deseo concedido» → fundido a negro → selección de tres sobres
a pantalla completa → fundido a negro → menú de laboratorio. En el juego el
primer paso no muestra ese control: se inicia automáticamente al terminar la
victoria.

El formulario y la cinemática se cargan desde `campana-deseo.js`. La recompensa
usa `coleccion-modelo.js`, `coleccion-ui.js`, `coleccion.css` y los sobres reales:
las tres colecciones se recorren con un carrete horizontal y se eligen con los
controles reales del componente. Los datos de cartas, Protagonistas y renderer
se derivan del motor en Node; el navegador no recibe `motor.js`, una partida,
IA, online, sonido, service worker ni el avance del jugador. `memoria.js`
intercepta todo el almacenamiento antes de cargar los componentes.

El adaptador llama al contrato que debe conservar la integración:

```js
abrirRecompensaSobres({origen:'campana', referencia:id, finalCampana:true, onConfirmar})
```

`campana-deseo.js` entrega el fundido a `campanaAbrirSobresFinal`, el mismo
puente que usa la integración de campaña; éste concede la recompensa efímera y
llama a la API anterior. `onConfirmar` realiza el fundido final sólo después de
guardar los tres sobres. No se concede ni guarda nada fuera de esta memoria
temporal.

Local: <http://127.0.0.1:8878/dev/secciones/epilogo-gero.html>.
Al publicar la revisión: <https://aislados.caoz-tcg.pages.dev/epilogo-gero/>.

```sh
node dev/secciones/pruebas_epilogo_gero_exportacion.mjs
python3 dev/secciones/publicar.py --seccion epilogo-gero --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion epilogo-gero --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Pitágoras: presión del jefe final

La revisión está en `/pitagoras/`. Abre el minijuego real de **El último
puente** mediante `pitagoras-pruebas.js`, `pitagoras-mundos.js`,
`pitagoras-cine.js` y `pitagoras-pixel.js`; no monta el motor, una campaña, IA,
sonido, red ni datos del jugador. El fixture sólo aporta una semilla temporal,
Talesyn como viajero y las seis cartas actuales del Editor, derivadas del
catálogo del motor al exportar.

La página sirve para revisar que el puente escale pronto, mantenga lectura de
carril/salto y que las cartas del ciclo del jefe tengan la presencia esperada.
También publica una lectura estática y verificable del Ritual inicial (2 PD,
incluida su excepción de segundo jugador), el bloqueo de una Pesadilla por
turno y las prioridades/bonos de las seis Pesadillas. Esos datos se extraen de
`motor.js` durante la exportación; el adaptador no ejecuta la IA ni implementa
otra versión de las reglas. Se puede cambiar la semilla para recorrer otra
secuencia sin escribir ningún dato. El arte que carga `pitagoras-pruebas.js`
se exporta en `juego/art/esbirro-editor-v219.webp`, con sus bytes y hash de
procedencia verificados.

Local: <http://127.0.0.1:8878/dev/secciones/pitagoras.html>. Al publicar la
revisión: <https://aislados.caoz-tcg.pages.dev/pitagoras/>.

```sh
node dev/secciones/pruebas_pitagoras_exportacion.mjs
python3 dev/secciones/publicar.py --seccion pitagoras --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion pitagoras --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Cuenta: acceso obligatorio y continuidad offline

La revisión de `feature/acceso-correo-offline` usa la
[ruta pública existente de cuentas](https://aislados.caoz-tcg.pages.dev/cuenta/);
su publicación y verificación de los 13 archivos se registran en `caoz_tcg/HANDOFF.md`.
Está lista para revisión; el recorrido móvil/escritorio pasó 60 comprobaciones.
Beta conserva 258 y producción 257. La siguiente build se asignará al integrar
después de aprobar la sección.

Se entra con correo y código de prueba; ya no hay salida como invitado. El
coordinador, modelo, interfaz, adaptador de progreso y sincronizador son los
del juego. Sólo se inyectan un transporte y un almacenamiento en memoria:
no se envían correos, no se crean cuentas reales y no se consulta el avance
del jugador. El buzón visible permite rellenar el código sin confirmarlo solo.

Tras entrar, «Simular victoria» aumenta el contador local y se compara con el
de la cuenta de prueba. Activa «Sin conexión», suma victorias y pulsa
«Recargar app»: reconstruye los componentes conservando esa misma memoria.
Al reconectar, la cola sincroniza el avance pendiente. Una primera entrada
sin red permanece bloqueada; una cuenta ya verificada y vinculada puede
continuar offline. No se simula reanudar una batalla.

«Escenarios» permite probar cuenta nueva (`estado=vacio`, predeterminado),
progreso local (`nuevo`), recuperación (`entrar`) y dos avances (`conflicto`).
La recarga real del navegador o «Reiniciar prueba» reinicia la demostración;
«Recargar app» conserva sus datos temporales para probar el cierre offline.

Local: <http://127.0.0.1:8878/dev/secciones/cuenta.html>. Las pruebas acotadas son
`pruebas_cuenta_modelo.mjs`, `pruebas_cuenta_acceso.mjs`,
`pruebas_cuenta_entradas.mjs`, `pruebas_cuenta_exportacion.mjs` y
`pruebas_cuenta_ui.mjs`. Las de servicio/progreso y caché cubren la persistencia
y exclusión de la API. El publicador
acepta `--seccion cuenta`. [Contrato y plan de integración](CUENTAS.md).

## Colección: copias y muestrario de ediciones

La revisión de sobres reúne tres colecciones: Trucos del Domo (48 cartas),
Juramentos del Domo (46) y Caos y Dragones (48). Entre las tres se conserva el
catálogo completo de 134 cartas. `?estado=sobres&pestana=sobres` abre directamente
el carrusel con tres sobres sellados (uno de cada tipo), también desde
`/coleccion/` publicado. `estado=premio-domo` permite elegir uno y
`estado=premio-campana` permite combinar tres. Guardarlos no concede cartas.
Trucos es azul, Juramentos verde y Caos rojo. La biblioteca conserva ese color
al abrir la envoltura 3D y permite deslizar con dedo/ratón o usar flechas/teclado.
Se mantienen las cinco cartas por sobre: tres Normales, una Foil y quinta 50/50.

Debajo de cada carta sólo aparecen los marcadores de las ediciones que posee
el jugador, sin contador ni texto. Las ediciones bloqueadas no se dibujan;
la equipada queda resaltada. Desbloquear una edición añade su marcador,
pero recibir otra copia de la misma no añade otro.
Las ediciones aún bloqueadas se ven desenfocadas en el detalle, tanto en las
columnas de escritorio como al cambiar de pestaña en móvil. El nombre y las
acciones siguen legibles. Se usa el desbloqueo permanente del inventario: una
edición conseguida conserva su imagen nítida aunque se gasten sus copias en un
canje. La disponibilidad de ilustraciones en el estudio no la desbloquea.
Revisión directa: `/coleccion/?estado=nuevo&carta=tal` (Normal propia, Foil y
Dorada pendientes). Integrada y publicada en beta 258; producción conserva build 257.

El detalle muestra la cantidad de cada edición por separado, incluida `0 copias`
para una edición bloqueada. La ilustración del listado corresponde al acabado
elegido; mirar otra versión en el detalle no la equipa. «Usar» cambia esa elección
sin aumentar cantidades. El pie de Colección sigue contando cartas Normales y
ediciones especiales distintas, no el total de copias.

| Escenario (`estado`) | Datos temporales |
|---|---|
| `nuevo` | Una copia Normal por ID, ninguna premium y ningún sobre. |
| `sobres` | Inventario inicial y tres sobres sellados, uno de cada colección. Predeterminado. |
| `premio-domo` | Victoria preparada: elegir un sobre y guardarlo. |
| `premio-campana` | Campaña terminada: elegir tres sobres, iguales o combinados. |
| `legado-sobres` | Cinco sobres antiguos sin tipo: elegir tres y luego dos, sin perder saldo. |
| `canjes` | Cinco Normales ganadas de Thal y cuatro Foil, para probar mejoras encadenadas. |
| `ediciones` | Copias repetidas de Eric, Thal y el protagonista `lider_fender`, con las cantidades de la tabla siguiente. Thal comienza usando Dorada. |
| `muestrario` | Una copia de cada acabado para todos los IDs. `acabado=normal`, `foil` o `dorado` equipa esa serie en toda la rejilla; por defecto usa Normal. |
| `legacy` | Un sobre pendiente anterior de tres cartas, ya concedidas, con Foil, Dorada y un protagonista. Reabrirlo conserva ese resultado. |

Cantidades conocidas del fixture `ediciones`:

| ID | Normal | Foil | Dorada | Total debajo de la carta |
|---|---:|---:|---:|---:|
| `eric` | 1 | 3 | 2 | 6 |
| `tal` | 1 | 5 | 1 | 7 |
| `lider_fender` | 1 | 2 | 4 | 7 |

El resto conserva una Normal y cero premium. Los dos fixtures conceden sus
copias mediante `otorgarCopia` del modelo real. Las Doradas sirven para revisar
la interfaz y las ilustraciones; no implementan ni simulan un canje de códigos.
El muestrario permite recorrer también las cartas fuera de los mazos y los
protagonistas, conservando la búsqueda y los filtros de Colección.

Ejemplos locales:

- Cantidades en móvil: <http://127.0.0.1:8878/dev/secciones/coleccion.html?vista=movil&estado=ediciones>
- Serie Foil: <http://127.0.0.1:8878/dev/secciones/coleccion.html?estado=muestrario&acabado=foil>
- Thal Dorada en detalle: <http://127.0.0.1:8878/dev/secciones/coleccion.html?vista=movil&estado=muestrario&acabado=dorado&carta=tal>

Los parámetros `estado`, `acabado` y `carta` también se aceptan en la entrada
alojada `/coleccion/`, que elige móvil o escritorio y los conserva. El parámetro
opcional `carta` abre directamente un ID conocido desde esa entrada, el HTML
del laboratorio o las páginas exportadas `movil.html` y `escritorio.html`.

Cada acabado tiene su original local y su encuadre. La disponibilidad de una
ilustración premium no concede esa edición al inventario real. El laboratorio
sólo consulta esos originales públicos: permite revisar las series sin traer
reemplazos ni ajustes privados del estudio.

### Diseño de carta de Colección

Las cartas de Colección se pintan en canvas con `carta-pintor.js`, a partir de
`CARDS`: Normal y Foil con el diseño clásico (ilustración enmarcada, placas
metálicas de nombre y tipo, gema de coste, pergamino de reglas, gemas de
ATQ/VIDA con la cifra centrada) y la Dorada en full art. El pintor produce color,
relieve (altura → normal map), rugosidad/metal y máscara holográfica.
`carta-diseno.js` usa el color con el relieve ya iluminado (horneado) en la
rejilla, el detalle y los sobres, y sólo pinta las cartas cercanas a la
pantalla, de una en una. El proveedor de arte sigue colocando la ilustración de
cada edición en la propia carta (`[data-arte-id]`, `--ex/--ey/--ez` y un
`.marcoDibujo` invisible); el pintor lee de ahí la imagen y su encuadre, y
repinta si cambian. El nombre queda además como texto `.nombreCarta`
transparente sobre el pintado. Las revisiones se agrupan en un fotograma: ningún
temporizador por carta. Tipografías Cinzel y Cormorant
Garamond en `caoz_tcg/fuentes/` (OFL); las cifras de reglas usan Cinzel porque
Cormorant sólo trae cifras antiguas. Los Protagonistas conservan su retrato y el
tablero y la mano no cambian todavía.

### Detalle en 3D de una carta

Tocar una carta de la rejilla abre su detalle, que es la carta en 3D a
pantalla completa: el panel pierde marco, pestañas y pie, y `visor-3d.js`
montado dentro de Colección (`CAOZ_VISOR3D.montar`) llena todo sobre una
nebulosa del color de la edición. Los controles flotan en cristal a la derecha
(abajo en el teléfono) y la escena les reserva sitio (`--reserva-der`). Con WebGL,
`visor-3d-gl.js` la dibuja con las cuatro texturas del pintor: grosor real,
relieve, metal y laca que reflejan un estudio procedural, una luz lateral que
sigue al puntero y holo con destellos según el ángulo; sin WebGL o con un
Protagonista, capas CSS sin `preserve-3d`. Debajo gira un anillo rúnico y suben
partículas del color de la edición.

Las pestañas Normal/Foil/Dorada cambian la edición de la misma escena (no se
rehace el WebGL) y debajo quedan su cantidad, Usar y el canje: los mismos
controles `.coleccionVersion` de antes, con sus fichas ocultas. Una edición
bloqueada se ve velada y nunca nítida en WebGL. Voltear y pantalla completa
(el visor como diálogo) flotan junto a la carta; volver a la rejilla libera la
escena.

Revisión directa: `/coleccion/?estado=ediciones&carta=tal`.

```sh
node dev/secciones/pruebas_coleccion_visor3d.mjs
node dev/secciones/pruebas_coleccion_visor3d.mjs --sabotaje
```

### Cantidades y límites de migración

`cantidad(id)` devuelve el total; `cantidad(id, acabado)` devuelve una edición.
Normal empieza con una copia implícita. `otorgarCopia` suma una copia explícita;
`desbloquear` es idempotente y no suma si la edición ya estaba desbloqueada.
Elegir un premio guarda sus tipos, sin conceder cartas ni consumir azar. Los
sobres antiguos sin tipo pasan a elecciones pendientes; cada tanda contiene
hasta tres. Abrir descuenta uno del tipo seleccionado, suma todas sus copias y
guarda el contenido pendiente en la misma escritura. Si el guardado falla, no se descuenta el sobre ni se conceden
copias. Reabrir su presentación o cambiar el acabado elegido no vuelve a sumar.

Se conserva la clave y el formato de progreso v1. Los datos antiguos sin
contadores se interpretan como una Normal por ID y al menos una copia por cada
premium ya desbloqueado. No se puede recuperar cuántos duplicados se obtuvieron
antes: ese historial nunca se guardó. El pendiente legado de tres cartas se
conserva como premio ya concedido; no sirve para reconstruir ni aumentar ese
historial. La migración se incorpora al siguiente guardado correcto. Estos
contadores siguen siendo locales, sin sincronización entre dispositivos.

## Procedencia y límites

- `coleccion-ui.js`, `coleccion.css`, `coleccion-modelo.js`, `arte-remoto.js`,
  `arte-vistas.js` y `acabados.css` se sirven directamente desde `caoz_tcg/`.
- Las funciones `cardEl`, `ponerDibujo`, `ilustrar`, `ilustrarLider`,
  `cartaDeLiderVS` y sus auxiliares se extraen automáticamente de la pantalla
  elegida. El compilador nativo de JavaScript identifica el final de cada
  declaración: no se busca una llave por coincidencia simple. Si falta una
  función, se duplica o cambia su contrato, la generación falla con un error.
- Se sirven los estilos reales del HTML elegido y `AAA_CSS` de `polish-aaa.js`.
  No se ejecuta ese módulo de efectos. `aislado.css` estiliza únicamente los
  controles del laboratorio, no la Colección.
- Los datos de cartas, protagonistas y mazos se serializan desde el motor en una
  VM de Node sin DOM, red, almacenamiento ni temporizadores. El navegador recibe
  datos JSON, **no el motor**. El único estado de partida es `G = null`.
- `attachInspect` y `pulsacionLarga` son adaptadores vacíos: esos ganchos añaden el
  inspector de combate a la carta original, pero la Colección clona esa carta y
  elimina sus listeners. No se pretende probar el inspector desde esta sección.
- `memoria.js` sustituye los almacenes de la página **antes de cargar componentes**
  por objetos en memoria. Nunca lee ni copia el almacenamiento real. Tampoco
  conserva los datos de prueba al recargar.
- El proveedor de arte usa los originales locales. El catálogo remoto responde
  vacío en este servidor: no se conecta al estudio de beta o producción ni copia
  ajustes privados. Para validar una publicación remota se usan después las
  pruebas de integración habituales.
- El servidor sólo permite GET/HEAD sobre una lista de componentes y assets.
  No expone los HTML completos del juego ni permite operaciones de escritura.
  La política CSP bloquea conexiones externas, iframes y workers.

El manifiesto de procedencia está enlazado en el laboratorio e incluye hashes
SHA-256 de fuentes y funciones. Los archivos generados viven en memoria; no hay
copias generadas para editar o versionar.

## Comprobaciones

```sh
node dev/secciones/pruebas.mjs
```

Comprueba extracción de funciones y sus fallos, datos reales, procedencia,
aislamiento del almacenamiento, componentes servidos y bloqueos HTTP/CSP.
Además, al cambiar Colección, revisar sus interacciones en el navegador: búsqueda,
tres columnas, scroll del listado y regreso a su posición, acabados, apertura de cinco cartas, reapertura del sobre pendiente y
navegación de regreso. Estas pruebas acotadas no sustituyen la integración final.

Para cambios en cantidades o en las series del muestrario, usar las regresiones
específicas de esa sección:

```sh
node caoz_tcg/pruebas_coleccion.mjs
node caoz_tcg/pruebas_arte_ediciones.mjs
node caoz_tcg/pruebas_originales_acabados.mjs
node dev/secciones/pruebas_coleccion_copias.mjs
node dev/secciones/pruebas_coleccion_muestrario.mjs
node dev/secciones/pruebas_coleccion_protagonistas.mjs
node dev/secciones/pruebas_coleccion_visor3d.mjs
```

Después de publicar, `BASE_URL=https://aislados.caoz-tcg.pages.dev/coleccion/`
permite repetir `pruebas_coleccion_copias.mjs` sobre el paquete servido,
sin arrancar un servidor local ni tocar el progreso real.

Comprueban los marcadores poseídos, las cantidades del detalle, la selección visual, el aislamiento del muestrario,
los protagonistas y los originales por acabado. Las pruebas del estudio usan
respuestas simuladas y no escriben en sus bases de datos. Revisar también en
móvil y escritorio que el total no se recorte y que cada serie conserve su
imagen y encuadre al abrir el detalle y regresar al listado.

### Elección de recompensas y biblioteca de sobres

```sh
node caoz_tcg/pruebas_coleccion.mjs --sabotaje
node caoz_tcg/pruebas_recompensas_domo.mjs
node dev/secciones/pruebas_sobres_apertura.mjs --sabotaje
node dev/secciones/pruebas_coleccion_canjes.mjs
node dev/secciones/pruebas_sobres_elegidos.mjs
```

Los dos últimos usan Playwright instalado (opcional `PLAYWRIGHT_MODULE`) y
navegadores temporales, en 1440×900, 390×844 y 320×568. Aceptan `BASE_URL` para
repetirlos sobre `/coleccion/` publicado y `--capturas /ruta` para guardar
capturas fuera del worktree. La prueba de sobres recorre elección 1/3,
repetidos, fallo de escritura y reintento, arrastre de ratón y swipe táctil,
navegación por teclado, tipo consumido, color, reapertura y legado. La de
canjes mantiene la regresión de cantidades, desbloqueos permanentes y marcadores.
La prueba VM de recompensas prepara la conexión con las victorias reales y los
epílogos; su aspecto en el juego completo se revisará tras aprobar la sección.

## Añadir otra sección

Crear su entrada y adaptadores en esta carpeta. Reutilizar los componentes reales,
cargar sólo datos y ganchos necesarios y documentar cualquier dependencia omitida.
Añadir explícitamente las rutas necesarias al servidor y pruebas de aislamiento.
No usar el HTML completo del juego oculto para suplir una dependencia ausente.

## Revisión desde el teléfono: GitHub y Cloudflare

Dirección estable: https://aislados.caoz-tcg.pages.dev/coleccion/ . Es pública,
funciona sin sesión de ChatGPT y elige móvil/escritorio automáticamente.
La rama `aislados` del mismo repositorio contiene sólo el paquete de revisión:
`tcg/coleccion/`. Cloudflare publica esa rama como preview, usando el mismo
proyecto `caoz-tcg` y salida `tcg` que la beta, con dirección independiente.
No se modifica la rama `beta`, `gh-pages`, producción ni el progreso real.

Desde la rama de la sección, con los cambios guardados en un commit:

```sh
python3 dev/secciones/publicar.py --solo-preparar --salida /ruta/nueva/de/salida
python3 dev/secciones/publicar.py --publicar
```

El primer comando permite revisar el paquete sin subirlo. El segundo ejecuta las
comprobaciones acotadas, exporta los componentes reales, registra su SHA de origen y
hashes, y envía sólo `refs/heads/aislados`. Conserva otras secciones de la misma rama.
Rechaza fuentes sucias, cambios de revisión durante la preparación, una rama destino
ajena y publicaciones concurrentes. No usa `publicar.sh` ni ejecuta la batería del
juego completo. La URL debe verificarse contra el paquete enviado antes de entregarla:

```sh
python3 dev/secciones/publicar.py --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/que/imprimio/el/publicador
```

El exportador incluye ambas presentaciones, arte local público y datos temporales.
Excluye motor, partida, estudios, backend, audio y service worker. El adaptador estático
redirige sólo la petición del catálogo remoto a un JSON vacío local; no añade
credenciales ni contacta los estudios. Los sobres son fixtures en memoria, sin
habilitar privilegios beta en el dominio nuevo. El paquete incluye una página 404
para no confundir recursos ausentes con el índice y cabeceras para evitar caché vieja.

La configuración de Cloudflare debe conservar producción `gh-pages`, directorio `tcg`,
y previews personalizados `beta` y `aislados`. Las ramas fuente no despliegan.
No copiar la configuración de bases de datos ni los estudios a los archivos publicados.
No agregar una sección nueva pasando cualquier directorio al publicador: registrar su
exportador y comprobaciones explícitas antes de habilitarla.

Comprobaciones adicionales del paquete y su publicación:

```sh
node dev/secciones/pruebas_exportacion.mjs
python3 dev/secciones/pruebas_publicar.py
```

Las pruebas usan repositorios temporales y no publican en internet. La vista anterior
alojada con Sites queda fuera del flujo vigente; las futuras revisiones de este juego
usan GitHub/Cloudflare por instrucción del usuario.

## El Rey: corte defendible

La revisión de la carta y su condición de victoria está en
https://aislados.caoz-tcg.pages.dev/rey/ . Usa las cartas/render reales y extrae
`avanceCorte` del motor; no carga una partida, IA, campaña ni progreso real en
el navegador. Permite avanzar inicios de turno, retirar/reponer miembros de la
corte y comprobar que el primer inicio no gana y una corte rota vuelve a cero.
Las fichas de Can conservan su función. Las regresiones de motor y simulaciones
acotadas se ejecutan en Node antes de presentar esta sección.

Desde la rama de revisión, limpia y guardada:

```sh
node dev/secciones/pruebas_regresion_rey.mjs
node dev/secciones/pruebas_regresion_rey.mjs --balance
python3 dev/secciones/publicar.py --seccion rey --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion rey --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

El registro de secciones es explícito: `coleccion` (predeterminado), `rey` y `sobres`.
Cada publicación conserva íntegras las carpetas de las otras secciones y rechaza
cambiar las cabeceras comunes si afectara a la hermana. No usar esta vista como
aprobación de integración ni publicar beta/producción sin revisión previa.


## Sobres: Sello del Domo

Revisión independiente: https://aislados.caoz-tcg.pages.dev/sobres/ .
El usuario eligió **Sello del Domo**. La funda mantiene su rotura superior
que se enrolla y desciende fuera de cuadro. Durante las cinco revelaciones
no se acumulan miniaturas. La quinta permanece hasta un toque adicional o
«Ver todas las cartas», incluso con movimiento reducido o pestaña oculta; «Volver» regresa al menú de sobres del laboratorio.
La vista conjunta usa 3+2 en teléfono y cinco en una fila en escritorio ancho.
Las cartas conservan nombre y marco, muestran el arte sin zoom y ocultan el
panel de habilidades/tribu. No hay un nombre repetido debajo de la carta.
El estilo se limita al componente de sobres.

Los cinco frentes se construyen una vez en una reserva oculta al montar el
sobre. La apertura espera la descarga y decodificación de todas sus imágenes;
los volteos y el resumen mueven esos mismos nodos, sin crear nuevas imágenes.
Una conexión lenta muestra «Cargando tus ilustraciones…» antes de abrir.
Un fallo o espera de 20 segundos permite reintentar con el sobre cerrado.
Destruir/reiniciar cancela los listeners y esperas, sin abrir otra instancia.

El componente reutilizable `sobres-apertura.js/css` recibe las cartas y su
renderer; `onVolver` entrega el control al menú que lo monta, una sola vez.
`sobres-escena.js` dibuja malla/materiales en WebGL, con alternativa Canvas 2D
ante indisponibilidad o pérdida de contexto. El laboratorio carga cinco
cartas reales, arte público y renderer existente. No consume sobres,
no desbloquea cartas ni ejecuta el motor.

El usuario aprobó la integración para beta 251. Colección utiliza estos mismos
módulos con los premios reales de `coleccion-modelo.js`; la vista aislada
conserva los datos temporales. El adaptador destruye la escena al salir y
retoma el contenido pendiente sin gastar otro sobre. Si `onVolver` devuelve
`false` porque no pudo guardar, el resumen permanece disponible para reintentar.

```sh
node dev/secciones/pruebas_sobres_exportacion.mjs
node dev/secciones/pruebas_sobres_apertura.mjs
python3 dev/secciones/pruebas_publicar.py
node dev/secciones/sobres-exportar.mjs /ruta/nueva/para/revision-local
python3 dev/secciones/publicar.py --seccion sobres --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion sobres --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

### El sobre y su bonche con el diseño del visor (build 275)

La funda se pinta como las cartas: color, material (metal y rugosidad) y altura
del relieve en tres lienzos por cara, con la ilustración de portada de cada
colección (`magodomo`, `discipulo`, `tal`), el logo y los textos en relieve y
Cinzel. El shader usa la misma luz que la carta del visor (estudio procedural,
luz que sigue el giro, laca y película holográfica) y el sobre se mece en reposo.
Con WebGL, pintor y `carta-diseno.js`, `sobres-revelacion.js` saca las cinco
cartas del sobre como cartas del visor 3D (`visor-3d-gl.js`, una ranura por
carta): bonche boca abajo con el dorso del logo, volteo con grosor, relieve,
metal y holo de su edición, chispas del color de la edición y motas de la
colección. El DOM sigue llevando las fases, la cuenta y el resumen; sin el
módulo o sin WebGL, la apertura usa sus cartas planas. En Colección la apertura
ocupa la pantalla completa, como el detalle. `pruebas_sobres_revelacion.mjs`
recorre los dos caminos y el movimiento reducido.

Antes de publicar, revisar en 320×568, 390×844 y escritorio: arrastrar sin
abrir, cinco revelaciones sin saltos por toques rápidos, quinta carta esperando un toque
explícito antes del resumen, cinco cartas visibles sin superposición/scroll y regreso al
menú una sola vez. Probar reinicio durante la apertura, teclado y movimiento
reducido. Se comprueban errores y recursos fallidos.

## Héroe: forjado en el Domo

La revisión `/heroe/` carga el mismo `campana-personaje.js` de campaña:
normalización, malla, retratos, previsualización, pestañas y controles. El host
aporta sólo el diálogo y botones mínimos para revisar identidad, silueta,
rostro, atuendo, equipo, predefinidos y giro manual. No monta campaña, motor,
mazos, IA, audio, red ni progreso real; `memoria.js` sustituye el almacenamiento
antes de cargar el componente.

Local: <http://127.0.0.1:8878/dev/secciones/heroe.html>. Al publicar:
<https://aislados.caoz-tcg.pages.dev/heroe/>.

```sh
node dev/secciones/pruebas_heroe_exportacion.mjs
python3 dev/secciones/publicar.py --seccion heroe --publicar --salida /ruta/nueva
python3 dev/secciones/publicar.py --seccion heroe --verificar https://aislados.caoz-tcg.pages.dev --salida /ruta/nueva
```

## Teaser del juego (animatic de 20 s)

La revisión está en `/teaser/`: el animatic del teaser para el pitch (16:9,
sin música, termina en el logo sin frase). No copia animaciones: una sola
línea de tiempo (`teaser-mesa.js`) dirige los módulos reales del juego.

| Tiempo | Plano | Módulo |
|---|---|---|
| 0,0–4,45 s | El Mago del Domo dorado en la tormenta; los relámpagos lo iluminan y se da la vuelta | `visor-3d-gl.js` + `tormenta-gl.js` |
| 4,45–6,9 s | Thal dorado, invocación legendaria en la tormenta | `fx-invocar.js` |
| 6,9–8,8 s | El aliento de Thal reduce a ceniza a El Rey | `fx-aliento.js` |
| 8,8–11,4 s | Montaje: Rayo de Escarcha, Polimorfia, Ascensión de Petunia | `fx-poderes.js`, `fx-ascension.js` |
| 11,4–12,0 s | Silencio: una gota en la oscuridad | lienzo propio |
| 12,0–16,1 s | La colección en rueda, torbellino y muro, que se abre | `cortinilla.js` |
| 14,6–20,0 s | El logo sobre la tormenta, con el último relámpago; fundido | lienzo propio + tormenta |

«Repetir» y «Empezar en…» recargan la página (los efectos no se rebobinan);
`?desde=s` empieza en ese segundo y `?auto=1` arranca solo.

Con `?captura=1`, `teaser-reloj.js` (se carga antes que los módulos) sustituye
`requestAnimationFrame`, `performance.now`, `setTimeout` y las Web Animations
por un reloj virtual: cada módulo dibuja exactamente el fotograma pedido,
aunque pintarlo tarde segundos. Así se exporta el vídeo:

```bash
node dev/secciones/teaser-fotogramas.mjs /tmp/teaser-png --fps 30 --ancho 1920 --alto 1080
ffmpeg -framerate 30 -i /tmp/teaser-png/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 16 teaser.mp4
node dev/secciones/pruebas_teaser.mjs
python3 dev/secciones/publicar.py --publicar --seccion teaser --salida /tmp/caoz-teaser
```

## Pruebas de Pitágoras en 3D (dentro de sus cartas doradas)

La revisión está en `/pesadillas-3d/` (sustituye a `/cosecha-3d/`): cada
prueba del Editor con su modelo real, dibujada en 3D con el mundo de la edición
dorada de su carta. `pitagoras-mundo-3d.js` es el motor común (cámara y
proyección del puntero, telón con el arte de la carta, figuras en 2,5D con
sombras proyectadas, y el paso a resolución completa sin el filtro de pixel
art de `pitagoras-pixel.js`); cada prueba registra su mundo con
`CAOZ_MUNDO_3D.registrar(tipo,{…})`:

| Prueba | Módulo | Mundo |
|---|---|---|
| I · La cosecha | `pitagoras-cosecha-3d.js` | losas verdes sobre lava, el Segador alzándose del abismo, fantasmas de humo, estrellas de oro |
| II · El corte final | `pitagoras-corte-3d.js` | nave de catedral pulida, columnas verdes, el espectro coronado; avisos ámbar y haces de luz dorada |
| III · Fuera de cuadro | `pitagoras-cuadro-3d.js` | primera persona en el archivo: estanterías, columnas de lapislázuli, bóvedas, el cuadro de la carta en la pared; espectros rojos y la mano con la estrella de oro |
| IV · El último puente | `pitagoras-puente-3d.js` | carrera por tres carriles (lapislázuli con estrellas, bermellón, verde con flores) hacia la torre del arte; columnas talladas, sellos de ondas de oro, braseros y bloques que caen al vacío |
| V · El último asalto | `pitagoras-dragon.js` + `pitagoras-dragon-3d.js` | **juego nuevo a lo Punch-Out**: el guerrero, de espaldas, contra el Dragón Celestial Morado de la edición dorada (alas con estrellas, halo, garras, fauces), montado por piezas pintadas; arena de piedra y oro, nubes de manuscrito y el reino del arte en el horizonte |

**V · El último asalto sustituye a «Órbita muerta»** en el hueco V (tipo
`orbital`), con reglas nuevas, no sólo el dibujo. `pitagoras-dragon.js`
reemplaza la prueba de `pitagoras-mundos.js` allí donde se carga (por ahora
sólo en esta sección; el juego sigue con la versión anterior hasta que se
integre). El dragón avisa cada ataque con su pose:
- zarpazo (brazo alzado a un lado): esquiva hacia el otro lado;
- fuego (cabeza atrás, pecho encendido): agáchate; golpearlo mientras carga lo interrumpe (contra: doble daño);
- mordisco (cabeza baja, fauces abiertas) y aplastar (las dos garras arriba): esquiva a un lado.

Izquierda o A/S/D: esquivar o agacharse. Derecha, Espacio o clic: golpe.
Tras una esquiva, el dragón queda aturdido y es el momento de golpear.
Golpear su guardia no sirve: bloquea y ataca antes. A 0 de vida cae, se
levanta entero y pelea más rápido. Se mantiene el contrato: 20 s y 3 vidas,
y si la superas Pitágoras pierde 2 Alma.

Las piezas se pintan una vez en un atlas: cabeza, fauces, brazos, garras,
alas, halo y guerrero. La pose de cada instante (`rig`) sirve para el pintor
3D y para el clásico. Al integrarla habrá que:
- reescribir las pruebas de «Órbita» de `caoz_tcg/tests.js`;
- dar a la carta del hueco V su nombre y su arte (hoy es «Órbita muerta»);
- actualizar el texto de la carta en `motor.js`.

Sólo presentación: los pintores leen `s.modelo` y nunca lo escriben (las
pruebas comparan el estado con el pintor clásico). Sin WebGL o con movimiento
reducido sigue el pintor anterior. `?prueba=laseres` elige la prueba; «Ver con
el bot» usa el bot de revisión (La cosecha, Fuera de cuadro) o la guía del
modelo (El corte final, El último puente, El último asalto) sin perder vidas; `CAOZ_PESADILLAS3D_REVISION.mirarHeroe(x,y)`
comprueba el encuadre y, en primera persona (misma geometría que el raycaster), `delante(d)` que el disparo cae en el centro de la retícula. En la carrera,
`carrilHeroe(c)` comprueba que el héroe y el tramo que viene queden a la vista.
En el asalto, `asalto()` comprueba dónde se ven el halo, las alas y el guerrero, y
`posar(ataque,estado,k,accion)` pone al dragón en cualquier pose para revisarla;
las reglas se prueban con cada ataque frente a cada esquiva.

```bash
node dev/secciones/pruebas_pesadillas_3d.mjs
python3 dev/secciones/publicar.py --publicar --seccion pesadillas-3d --salida /tmp/caoz-pesadillas-3d
```

- **Rendimiento del ARPG:** densidad de render limitada a 1,5× en juego (2× en captura); oclusión GTAO a media resolución y 8 muestras; resplandor a media resolución adicional sobre sus niveles internos. Conserva modelos, sombras, HDR y MSAA 4×. Las escalas se reaplican al redimensionar.

### Ajustes de control y rendimiento (30 de septiembre)

- El parry cancela inmediatamente básicos, carga y Torbellino/Abanico en tierra, incluso durante el parón de impacto. Un básico mantenido debe soltarse antes de volver a cargar después del parry. No cancela un salto ni un dash.
- La corrección aérea sólo se activa en saltos de Adreida iniciados con mando; ratón y backflip mantienen sus destinos. El alcance se recorta progresivamente entre 5 y 4 m; la altura, el impacto y la duración no cambian.
- La escena comienza con densidad máxima de 1,25 píxeles por píxel CSS, y ajusta su resolución entre el 70 y el 100 % de ese valor cuando los FPS permanecen bajos. Conserva sombras (mapa de 1024), oclusión, halo y MSAA de 2 muestras; el HUD no baja de resolución. Tras seis mediciones por encima de 58 FPS recupera detalle gradualmente. Capturas y renders aislados conservan su resolución fija, sombras de 2048 y MSAA de 4 muestras. El contador muestra la densidad efectiva.
- Diagnóstico local previo: 25 FPS con todos los efectos; aproximadamente 34 sin oclusión, 43 sin oclusión ni halo y 51 también sin sombras en la misma escena. Son muestras orientativas de ese viewport, no un benchmark universal.
- Tras optimizar: muestra de 50 FPS con los tres efectos activos, MSAA 2× y densidad 1,25 en la oleada inicial. No garantiza esa tasa en todos los combates.
- Prueba puntual de estas interacciones: `node dev/secciones/pruebas_arpg_adreida_control.mjs`.

### Peso del hachazo y perfil de rendimiento

- Se retiró el título y el bloque de instrucciones superior; los controles siguen disponibles.
- Adreida se planta desde la primera pulsación de carga, sin caminar ni desplazarse por separación con enemigos. Puede orientar el golpe y cancelarlo con parry o dash.
- A carga completa añade 16 unidades de impulso al básico (antes 3), 0,65 m de alcance, más torsión del torso, flexión de rodillas, una estela mayor y chispas/polvo de impacto. Los jefes conservan su resistencia al empuje.
- Oclusión ambiental desactivada inicialmente (se puede activar con su casilla). Sombras y halo permanecen activos. El render normal tiene un presupuesto máximo de un millón de píxeles antes de la escala adaptativa; las capturas mantienen calidad fija. Las pestañas ocultas pausan simulación y renderizado para evitar que dos partidas compitan por GPU.

- Si el navegador mantiene varias pestañas visibles, `BroadcastChannel` cede el renderizado a la última activada. Las otras muestran «Continuar aquí» y suspenden lógica y GPU; las capturas aisladas no participan. El contador distingue tiempo de lógica y envío del render (no es una medición GPU).

### Pausa, acabado de materiales y avance del cargado

- Escape o Options/Start (botón estándar 9) abre/cierra el menú de pausa; × o Continuar reanuda. La pausa congela enemigos, proyectiles, animaciones y cooldowns; se libera la entrada acumulada y se cancela una carga pendiente. La elección de cartas conserva su propio menú.
- Las puertas sobresalen 7,5 cm del plano del muro: antes su cara exterior coincidía con él y producía z-fighting. Los tiradores acompañan la nueva posición.
- Agua del pozo y metal de Adreida más rugosos, con reflejo de entorno atenuado, para reducir destellos especulares hacia cámara.
- El golpe cargado avanza progresivamente hasta 65 cm durante el barrido, sujeto a obstáculos y separación con enemigos; cargar sigue inmóvil. Parry cancela el avance pendiente. Sacudidas leves: 0,12 de intensidad en el cargado y 0,16 al aterrizar el salto; se respeta movimiento reducido.

### Recuperación y falda articulada de Adreida

- Sólo el básico cargado al 100 % entra en `recuperacion`: mantiene la pose al final del barrido durante 0,3 s, sin caminar, dash ni parry. No modifica la recuperación de cargas parciales. La separación con enemigos tampoco desplaza esa pose.
- Sacudida del cargado 0,28 y del salto 0,32, con caída exponencial para que se perciban varios cuadros sin un corte brusco; se sigue respetando movimiento reducido.
- Falda y faldón de piel divididos en siete paños con huesos propios. Se abren con la orientación de los muslos y regresan amortiguados, con un pequeño balanceo al caminar. Es una aproximación procedural de tela, sin simulación física de tela completa, y conserva las tres mallas del personaje.
- Verificación puntual: `node dev/secciones/pruebas_arpg_adreida_control.mjs` y `node dev/secciones/pruebas_arpg_falda.mjs`.

### Carta conservadora, d20 visible y escudazo

- Cada reparto garantiza Conservadora (2–20, 95 %: +10 % a su estadística o −8 % al cooldown del dash), Temeraria (17–20) y Descomunal (19–20). El 1 sigue eliminando todos los buffs positivos, incluso al escoger Conservadora.
- El d20 se anima durante aproximadamente 1,1 s antes de aplicar efectos. Una única tirada uniforme determina el resultado; los números intermedios son visuales. Cartas, tirada y continuación quedan bloqueadas durante la animación.
- Saqueadores del primer nivel: velocidad 2,85 (antes 2,35), aviso básico 0,85 s, recuperación 0,8 s y cooldown 1,15 s. Conservan turnos y límites de presión. Alternan, estando cerca, un escudazo anunciado de 0,65 s y 14 de daño que empuja al héroe; parry perfecto y dash evitan el empuje. El bloqueo reduce daño sin desplazamiento.
- Pruebas puntuales: `pruebas_arpg_destino.mjs`, `pruebas_arpg_ritmo.mjs` y `pruebas_arpg_escudo.mjs`.

### Cooperativo local, ultis y mundo abierto (primera versión)

En **Partida** se elige un jugador, cooperativo con teclado/ratón + mando, o dos mandos estándar. En cooperativo J1 es Adreida y J2 Mohamed. Cada héroe conserva su entrada, vida, Furia, ataques y cooldowns; comparten escena, cámara y selección de cartas. La cámara centra a los personajes vivos y se aleja al separarse. Desconectar un mando no entrega su personaje al otro jugador. Cae la partida cuando ambos mueren; un compañero caído regresa con media vida al resolver el destino entre niveles o campamentos.

Las tres cartas y el d20 son del equipo: se elige una sola carta, se tira una sola vez y el mismo resultado modifica a ambos. Un 1 retira los buffs positivos de los dos y conserva las penalizaciones. Los porcentajes de vida mantienen la proporción de salud de cada personaje. Las habilidades habituales se recargan con un parry; la ulti sólo recibe **−1 s**, en el contador del jugador que paró.

**R / L3** activa la ulti, disponible inicialmente, con cooldown de **90 s desde la activación**. Adreida invoca a **Adreidos** durante 30 s: una primera representación basada en el modelo de Adreida, con nombre y acento turquesa, que la sigue, rodea el pozo y los demás obstáculos para acercarse a enemigos y los golpea; luego desaparece. Comparte las rutas persistentes y el límite de dos búsquedas nuevas por cuadro con los enemigos. Comprueba la línea libre al atacar para no golpear a través de coberturas. Mohamed activa **Velo azul** durante 10 s: silueta tenue y daga azul en la mano izquierda. Los enemigos dejan de seleccionarlo como objetivo (los ataques ya fijados y los proyectiles aún pueden alcanzarlo). El básico pasa a ser una puñalada de alcance corto cada 0,6 s: por detrás, dentro de un cono de 120°, causa exactamente cinco veces el daño base de un disparo con sus buffs; por delante causa una vez ese daño. No consume balas. El golpe no cancela los 10 s de sigilo. Pausa, selección de cartas y pausa de pestaña congelan estos tiempos igual que el resto del combate.

El exterior de la muralla contiene pasto y árboles; se retiró la segunda fila de casas y se dejó margen para los tejados interiores. El fogonazo y los impactos de Mohamed son más pequeños, las balas ya no generan chispas aleatorias en vuelo y su metal tiene menos reflejo.

**Mundo abierto · Prototipo** (`?mundo=abierto`, combinable con `&coop=1` y `&mandos=2`) conserva Tomsage como punto de partida, abre sus tres portones y extiende el terreno hasta unos **220 m de diámetro**, con borde de roca visible. Hay caminos, bosque y tres campamentos: norte, este y cantera del Recaudador. Acercarse activa un grupo de enemigos; despejarlo y recoger sus tres cartas abre el destino compartido. Después se puede seguir explorando. El mapa registra las celdas visitadas por cualquiera de los jugadores, oculta zonas y campamentos no descubiertos y se amplía con **M**. Es progreso de la partida actual; reiniciar lo borra. El asedio original conserva los portones sellados y sus oleadas.

Verificación acotada: `node dev/secciones/pruebas_arpg_aventura.mjs` cubre aplicación compartida de efectos, crítico, independencia de contextos y mandos, desconexión, cooldown y reducción por parry, asistencia de 30 s, daño de daga, selección de blancos durante sigilo, descubrimiento del mapa y colisión en los portones. Se revisaron además las regresiones de carga, salto, pausa, escudos, ritmo, cartas y troll. La revisión integrada en navegador comprobó movimiento simultáneo, ultis y expiración, puñalada de 45 con ATQ 9, reinicio, salida por el portón, activación de campamento, tres cartas, animación del d20 y regreso a explorar. Los mandos se verificaron con lecturas simuladas; falta la prueba física con dos DualSense.

### Balance y botín cooperativo

El cooperativo multiplica por dos el número de enemigos de cada oleada y campamento, incluidos Can y El Recaudador, y su vida máxima (también en vueltas posteriores). Duplica los límites de población, el tamaño de los refuerzos y las plazas de acercamiento; los avisos y daño por golpe mantienen sus valores. Ejemplos: goblin 34 → 68 de vida, troll 1100 → 2200, primera oleada 6 → 12 goblins. Las invocaciones de Can también duplican su número; el troll conserva un goblin por lanzamiento, con vida duplicada y límite de población ampliado.

Las cartas físicas del cooperativo usan acabado mate: rugosidad 0,95, metal 0, sin laca, iridiscencia, anisotropía, reflejo especular, reflejo de entorno ni destellos. La luz del botín baja al 25 % y el incremento al mirarlo pasa de 22 a 3. Se conserva la ilustración, el color de edición y el halo atenuado. Estos ajustes pertenecen al ARPG y no modifican el módulo compartido `three-carta.js` ni el juego de cartas.

`node dev/secciones/pruebas_arpg_balance_coop.mjs` comprueba vida, composición de oleadas y campamentos, refuerzos iniciales, plazas de ataque y materiales, tanto en solitario como en cooperativo.

Las cartas de botín no reaccionan al cursor: conservan su tamaño, orientación ambiental e iluminación y no interceptan la selección de enemigos. Se recogen pasando por encima. En táctil se mantiene la lectura mediante un toque explícito.

### Liberación de carga, pociones y efectos

La entrada de Adreida distingue el botón sostenido de un clic pendiente: el pendiente ya no mantiene una carga. Se recoge `pointerup` también fuera del lienzo y se cancela con seguridad al perder captura; la pérdida automática de captura después de soltar normalmente no cancela el golpe. Se conserva la recuperación intencional de 0,3 s tras el cargado completo. La prueba `pruebas_arpg_adreida_control.mjs` cubre liberación, pendiente residual, pérdida de captura y clic corto.

Los braseros tienen las tres llamas ancladas en el centro de su copa, sin dispersión aleatoria. La altura de la llama crece verticalmente en el mundo, aunque su anchura mire hacia la cámara. El botín de vida usa frascos rojos con hombros, cuello, corcho y etiqueta, apoyados en el suelo; conserva la atracción y la curación del 20 % de Alma máxima. Sus geometrías y materiales se comparten entre pociones. La probabilidad por baja es del 9 % para goblins, 12.5 % para cobradores, 10 % para arqueros y 20 % para saqueadores con escudo (la mitad de la frecuencia anterior). Can mantiene dos pociones y el troll tres como recompensa de jefe.

Se reduce a la mitad la intensidad anterior del resplandor (bloom 0,5 → 0,25) y de la oclusión ambiental (0,85 → 0,425). La oclusión mantiene su interruptor y sigue desactivada por defecto.

### Estadísticas y pantalla completa

El cajón «Diagnóstico», cerrado al entrar, reúne FPS, CPU, render, resolución, GPU, atributos y ayuda de controles. Se abre desde la esquina inferior izquierda y funciona también a pantalla completa. «Mostrar atributos del personaje», en pausa, controla esas cifras dentro del cajón; la preferencia se conserva en el navegador. Alma, Furia, munición y cartas permanecen en el HUD. «Pantalla completa» amplía únicamente el escenario; los diálogos de pausa y destino siguen disponibles. Se sale desde el mismo botón en pausa o con Escape del navegador. El tamaño de render se adapta automáticamente.

### Resolución interna y objetivo de 1080p

El presupuesto de renderizado normal pasa de 1.000.000 a 2.073.600 píxeles. A pantalla completa de 1920 × 1080, la escena se dibuja a 1920 × 1080 con escala adaptativa 1; anteriormente quedaba cerca de 1333 × 750 y se ampliaba. El HUD permanece a resolución nativa. En monitores mayores se mantiene el presupuesto de 1080p, respetando su proporción; en ventanas pequeñas se conserva el límite de densidad 1,25×. Las capturas mantienen su configuración de hasta 2×.

La partida normal conserva la resolución adaptativa: ante menos de 45 FPS sostenidos puede reducir cada dimensión hasta el 70 %, y recupera nitidez cuando el rendimiento mejora. El diagnóstico inferior muestra el ancho y alto internos efectivos. No confundir estos valores con el tamaño CSS del escenario ni con la resolución del monitor.

El inspector inicia con **1920 × 1080 fijos**, sin adaptación. Su vista previa es 16:9 y puede ser menor; el renderizador y todos los efectos procesan el búfer completo. «Adaptada a la ventana» permite volver al modo anterior. El informe v3 registra por separado dimensiones de la vista y del búfer WebGL; cualquier cambio durante una captura la cancela. `node dev/secciones/pruebas_arpg_resolucion.mjs` verifica 1080p, Retina/4K, móvil, adaptación, capturas y el modo fijo del inspector.

### Actualización por cuadro

Se retiró el paso fijo de 60 Hz y la interpolación entre estados. El combate, la IA, los proyectiles, los personajes y la cámara se actualizan una vez por imagen con el tiempo real transcurrido. A 120 FPS también se calculan las poses a 120 FPS; no hay cuadros intermedios que repitan un esqueleto anterior ni se cambian sus transformaciones durante el dibujo. La mezcla propia de las animaciones sigue formando parte de la pose, antes de resolver el agarre del arma.

`arpg-three-tiempo.js` sólo valida y acota el delta: hasta 50 ms por imagen, sin acumulador ni lotes para recuperar retrasos. Las interrupciones superiores a 250 ms se descartan; la pausa y las pestañas inactivas suspenden lógica y dibujo. El hitstop conserva su dilatación temporal. A frecuencias distintas puede haber diferencias de hasta un cuadro en los cambios de estado; ya no se promete una simulación idéntica entre tasas de FPS.

El inspector muestra **Actualización por cuadro** y permite limitar la imagen a 30, 60 o 120 FPS para revisar el resultado. «+1 cuadro» y las capturas de referencia conservan un avance explícito de 1/60 s, sólo como herramientas de revisión. La partida normal y la reproducción libre del inspector usan el tiempo real. `CAOZ_ARPG_THREE_REVISION.avanzar(s, fps)` actualiza una vez por cuadro de la frecuencia solicitada.

`node dev/secciones/pruebas_arpg_tiempo.mjs` comprueba deltas a 30/60/120/144 FPS, cuadros irregulares, suspensión y ausencia de transformaciones temporales al dibujar los ocho personajes. Con las reglas reales verifica marcha, salto de 5 m, carga completa, parry y recarga de Mohamed en solitario y cooperativo.

### Inspector local de combate, animación y rendimiento

Arrancar `node dev/secciones/arpg-inspector-servidor.mjs 8883` y abrir `http://127.0.0.1:8883/dev/secciones/arpg-inspector.html?inspector=1`. La herramienta sirve la página y los modelos reales; sus paneles, estilos y módulo de métricas no forman parte de la exportación pública. La partida normal no registra muestras del inspector.

Permite reiniciar una escena sin oleadas, elegir Adreida o Mohamed, ajustar daño/velocidad de ataque, añadir enemigos con vida/velocidad/daño configurables, congelar y avanzar un cuadro. La vista de poses tiene una fase ajustable y repetición; los botones de ataques reales ejecutan el combate, incluyendo salto con piedras y carga. Los ajustes se aplican sólo en memoria y se pueden descargar como JSON; no alteran automáticamente el balance del repositorio.

El inspector v4 añade **Transiciones de Adreida**: entrada al caminar (0–0,30 s), entrada a la carga (0–0,18 s), vuelta al reposo (0–0,40 s) y amplitud de zancada (0,75–1,15). «Aplicar transiciones» cambia la sesión. «Probar secuencia completa» reinicia una escena con Adreida y ejecuta controles reales: caminar 0,75 s → mantener básico 1,05 s → soltar → golpe → cansancio → reposo. La tira de pasos señala el estado actual; «Congelar» y «+1 cuadro» también funcionan durante la secuencia. Los tiempos de impacto, el daño y los 0,3 s de recuperación pertenecen al combate y no se alteran al mezclar poses. La velocidad de ataque se sigue ajustando desde su control propio.

«Guardar variante» conserva una configuración en el almacenamiento local de ese navegador y origen; «Cargar guardada» la recupera después de recargar. «Restablecer» vuelve a los valores originales sin borrar la variante. En «Compartir o importar animación» se puede descargar el JSON o pegarlo para importarlo. El formato tiene versión y personaje, valida todos los rangos y rechaza el archivo completo si algún valor es inválido. Los ajustes del inspector no se aplican automáticamente a la partida pública ni escriben código. El informe de rendimiento incluye la configuración de animación usada.

`arpg-three-adreida-animacion.js` concentra las poses de caminar/reposo/combo, el impulso del cargado, el agarre a dos manos, la falda y la mezcla. `arpg-three-modelos.js` conserva la geometría y las poses compartidas; el combate entrega estado, fase, potencia y paso de tiempo. La mezcla usa cuaterniones y objetivos de agarre **antes** de resolver los brazos por IK; la falda sigue las piernas ya mezcladas. Cada modelo tiene sus propios búferes, incluidos Adreidos y el cooperativo, sin aumentar las tres mallas del personaje. En el barrido del ataque y durante el cansancio se conserva la pose exacta, y el visor por fases desactiva la mezcla. El módulo se carga antes de los modelos tanto en el juego como en el visor y la exportación.

Al recoger el hacha, la orientación del mango sigue una rotación esférica y las manos describen un arco de hasta 24 cm hacia delante: el apoyo izquierdo no atraviesa el hombro. El plano del codo define también la torsión del brazo y antebrazo, evitando la inversión de muñeca que aparecía al volver del tajo (se midió un cambio de 130° entre dos cuadros de recuperación). Este recorrido también se usa al salir del cansancio del cargado. Goblins, cobradores, lanceros, escudos, jefes y Mohamed mezclan la última pose de recuperación con la guardia durante 0,16 s; los avisos y poses de impacto se mantienen exactos. El retroceso de la pistola forma parte del modelo antes de guardar la pose, de modo que su regreso tampoco salta al dejar de disparar.

`node dev/secciones/pruebas_arpg_animacion.mjs` verifica continuidad al cambiar de estado, manos sobre el mango, sincronía del impacto, recuperación inmóvil, equivalencia a 30/60/120 Hz, independencia entre modelos e importación atómica. Incluye los tres hachazos normales/cargados a 60 Hz y la transición desde recuperación o disparo a guardia de todos los tipos de personaje. Las pruebas de agarre, falda y control de Adreida cubren las poses y reglas existentes.

Comprobación de esta separación (1 de octubre de 2026, Apple M2 Max): referencia cooperativa, 24 enemigos, 1920 × 1080 fijos, sombras y halo, 90 cuadros de calentamiento y 600 medidos: **125,5 FPS**, p95 **8,8 ms**, GPU **5,84 ms**. Héroes quietos y protegidos, enemigos activos; no representa todas las situaciones del juego. Otra vista del inspector seguía dibujando durante una primera captura (41,8 FPS); se pausó con Escape antes de repetir. «Congelar» detiene la simulación del inspector, pero mantiene su render; para dejar otra pestaña sin consumo de GPU, usar la pausa del juego.

Las referencias `plaza-0-v3`, `plaza-12-v3` y `plaza-24-v3` reinician la semilla 11 con Adreida sola, ocho goblins/dos kobolds/dos saqueadores, o ambos héroes con el doble de enemigos y vida. La captura mantiene vivos a los dos héroes y bloquea las entradas. Usa paso fijo de 1/60 s, cámara 1 y resolución adaptativa desactivada. «Comparar efectos» mide Base, Sin sombras, Sin halo y Con oclusión, y repite en orden inverso: 90 cuadros de calentamiento y 300 medidos por caso. La medición individual registra 600. Ocultar la pestaña, cambiar el tamaño o pulsar Escape cancela la captura. Comparar sólo con el mismo equipo, tamaño, escala y versión del código; dejar las otras partidas pausadas, incluidas las abiertas en otros puertos o en la web pública.

El informe muestra y descarga muestras, entorno, FPS medio, p50/p95/máximo del intervalo entre cuadros, cuadros superiores a 33,34 ms, tiempo CPU de simulación, tiempo CPU de envío de dibujo, llamadas y triángulos. Cuando está disponible, `EXT_disjoint_timer_query_webgl2` mide la duración de GPU cada diez cuadros, recoge resultados asíncronos y descarta consultas inválidas; en otros navegadores se muestra N/D. El envío de CPU y el intervalo entre cuadros no sustituyen esa medida. Los percentiles usan intervalos sin recorte. La interfaz se actualiza cuatro veces por segundo. Los FPS pueden estar limitados por la pantalla: una mejora de GPU puede aumentar el margen disponible sin elevar los FPS.

La pasada de normales de GTAO reutiliza las sombras calculadas en ese mismo cuadro por la pasada principal. El estado de actualización de sombras se restaura incluso si ocurre un error; personajes y luces móviles siguen actualizando sus sombras en el siguiente cuadro. Se conservan MSAA, HDR, orden de efectos e intensidades. El parámetro `referencia=1`, sólo dentro del inspector, permite comparar con el render anterior.

`node dev/secciones/pruebas_arpg_inspector.mjs` verifica percentiles, muestras opcionales de GPU y que la exportación jugable no incluya las herramientas.

Comprobación del 1 de octubre de 2026: Apple M2 Max, navegador integrado (ANGLE/Metal), escenario de 892 × 562 px CSS, DPR 1,25, HDR y MSAA 2×. Dos rondas de 300 cuadros por perfil. Con oclusión activada, las llamadas medias por cuadro cambiaron así:

| Escena | Antes | Después | Triángulos antes → después |
| --- | ---: | ---: | ---: |
| Adreida sola | 109 | 91 | 266.048 → 199.848 |
| Combate, 12 enemigos | 234,59 | 192,59 | 329.018 → 247.472 |
| Cooperativo, 24 enemigos | 368,58 | 299,58 | 397.633 → 299.381 |

Con la configuración base (oclusión apagada) el trabajo de dibujo permanece igual. Las tres escenas finales rondaron 120 FPS y no registraron intervalos superiores a 33,34 ms. La simulación media del perfil base costó 0,35 / 0,67 / 0,80 ms; la GPU, 4,65 / 4,92 / 5,10 ms. Los tiempos de GPU variaron entre rondas incluso sin cambios de dibujo: no se atribuye esa variación a la optimización ni se promete la misma tasa a pantalla completa, en otros equipos o con varias partidas abiertas. Se descartó una prueba de buffers de posprocesado sin MSAA porque no mostró una mejora consistente.

Repetición a **1920 × 1080 internos fijos** el mismo día, M2 Max/ANGLE Metal, HDR y MSAA 2×, vista previa 892 × 502, otras partidas pausadas. Se registraron 7.200 cuadros entre tres escenas, cuatro perfiles y dos rondas; la resolución interna permaneció en 1920 × 1080 y no hubo intervalos mayores a 33,34 ms.

| Escena | FPS base | p95 base, peor ronda | GPU base | GPU con oclusión |
| --- | ---: | ---: | ---: | ---: |
| Adreida sola | 120,0 | 9,1 ms | 6,09 ms | 7,03 ms |
| Combate, 12 enemigos | 120,0 | 9,1 ms | 6,45 ms | 7,26 ms |
| Cooperativo, 24 enemigos | 120,0 | 9,3 ms | 6,42 ms | 7,47 ms |

FPS y tiempos de GPU son promedios de las dos rondas. También se midieron Sin sombras y Sin halo; los cuatro perfiles rondaron 120 FPS. Esta comprobación supera el objetivo de 60 FPS en ese equipo y esas escenas cortas, sin representar una garantía para otras GPU o todos los encuentros del juego. Se verificó en navegador alternar resolución de ventana y 1080p fijo, sin errores de consola, además de las pruebas de cálculo de resolución y controles.


### Goblin de Camino: plantilla para ilustración manual

`arte-goblin/exportar.mjs` prepara un kit UV de 4096 × 4096 con las 39 piezas reales del goblin, sin cambiar el modelo de la partida. Requiere Node y los módulos `sharp` y `jszip` (o rutas en `SHARP_MODULE` y `JSZIP_MODULE`):

```sh
node dev/secciones/arte-goblin/exportar.mjs /ruta/vacia/goblin-para-pintar
node /ruta/vacia/goblin-para-pintar/servidor.mjs
```

El kit incluye un PNG con colores base, una guía transparente PNG/SVG, un OpenRaster con tres capas, el OBJ/MTL estático, la correspondencia `goblin-uv.json` y un visor local en `http://127.0.0.1:8886/`. Las caras de las cajas se abren en cruz y las tapas de los cilindros se separan; no comparten pintura los lados izquierdo y derecho. Ocho píxeles de sangrado protegen las costuras. El exportador valida los 13,956 vértices contra las tres mallas originales; el visor comprueba sus huellas SHA-256 antes de aplicar las UV.

Se pinta sobre `goblin-pintar.png`, con `goblin-guia.png` en otra capa. Se devuelve un PNG sRGB de 4096 × 4096, con colores base y pintura fusionados, guía oculta y piezas sin mover. El visor permite probar el PNG en reposo y en movimiento, sin enviarlo a un servidor. La plantilla afecta al color; no modifica silueta, rig ni animaciones. Al integrar una ilustración se conserva el mapa UV de este kit y se puede reducir la resolución de la textura de juego después de comprobar la calidad.

El taller incluye un localizador interactivo de las 39 piezas: clic en el goblin o en el atlas, resaltado por UV, recorte ampliado, nombre, orientación y opciones para acercar o aislar la pieza. El cursor del recorte se transforma mediante coordenadas baricéntricas en un punto sobre el triángulo animado, y un clic en 3D sitúa el mismo punto en la plantilla. La guía se puede activar sin alterar la pintura. `node dev/secciones/arte-goblin/pruebas.mjs` verifica correspondencia de piezas y puntos en reposo, caminata y ataque, huellas geométricas, normales y rechazo de zonas vacías.

El goblin suavizado utiliza 4,652 triángulos (antes 1,348), y el cobrador 5,004 (antes 1,440). Aumentan los segmentos de cabeza, gorro, orejas y extremidades; mandíbula, cadera, bolsa y botas redondean sus esquinas. Las normales interpoladas y una variación de color por cara mucho menor eliminan el aspecto facetado. Ambos conservan tres mallas, los mismos huesos, dimensiones de combate y animaciones; el material sigue dibujando sólo las caras frontales. El resto de personajes conserva su geometría. Esto aumenta trabajo de vértices, pero no las llamadas de dibujo; no implica una garantía de FPS sin medir en la partida.

La nueva plantilla es **UV v2** (`goblin-uv-v2.json`); conserva los nombres, números y casillas, pero cambia la geometría y algunas coordenadas internas. No mezclar el PNG, el mapa de UV y el modelo de kits distintos. Se conserva el manifiesto v1 como referencia histórica y los kits previos no se sobrescriben. Una ilustración ya empezada en v1 requiere adaptación antes de utilizarse con el modelo nuevo.


El kit también incluye un **cuaderno autónomo de 6000 × 7200**: `goblin-cuaderno.ora` contiene 39 fichas con ubicación sobre el modelo completo, dos detalles orientados (frente/espalda o izquierda/derecha) y orientación en colores y letras. Las referencias se proyectan de la geometría real; las regiones del plano se clasifican por normales transformadas en la pose de construcción (+Z frente, −Z espalda, +X izquierda, −X derecha, +Y arriba, −Y abajo). Los colores expresan orientación, no parejas de costuras. La ubicación dorada se superpone al cuerpo gris para identificar también partes cubiertas por ropa. `guia-pintura.mjs` genera las láminas y capas, sin navegador ni imágenes inventadas.

Se pinta en «Mi ilustración» y se oculta «Orientación y bordes» antes de devolver el PNG completo. `goblin-cuaderno-base.png` y `goblin-cuaderno-bordes.png` permiten el mismo flujo en otros editores. `cuaderno.js` comparte entre exportador y visor las 39 zonas de extracción: el PNG de 6000 × 7200 se convierte automáticamente al atlas 4096 × 4096, sin interpolación; nombres y referencias quedan fuera. El exportador comprueba una reconstrucción idéntica píxel por píxel. El atlas, OBJ, UV y modelo v2 se conservan; no se necesita adaptar una ilustración ya empezada en la versión suavizada.

### Adreida de Scenario en el juego

`arpg-three-adreida.js` monta el modelo aprobado sobre el esqueleto y las animaciones existentes. Conserva 1,95 m de altura lógica, 1,913112 m de altura visual del archivo normalizado, radio de colisión de 0,42 m, longitudes de brazos/piernas y puntos de agarre. Los cuatro pesos por vértice suavizan las articulaciones; siete huesos acompañan la falda. Las manos de la pose A se cierran sobre el mango durante la preparación del recurso.

El cuerpo usa un material PBR con color, normal y superficie a 1024 px. Comparte geometría y texturas con Adreidos, con esqueleto y efectos independientes. Conserva los destellos de daño/parry y la disolución. El hacha original mantiene sus tres materiales, trayectoria, estela y búmeran: al lanzarla sólo desaparece el arma en la mano. El agarre de reposo deja espacio delante del pecho y el codo izquierdo se orienta hacia delante para que el brazo cruce por fuera del torso; en reposo y combate usa las dos manos. Al caminar o correr usa sólo la derecha, sin limitar la posición del hacha por el alcance del brazo izquierdo. El modelo clásico sigue disponible con `crear('adreida',{modeloAdreida:'clasico'})`.

Los recursos viven en `adreida-scenario/`, se sirven localmente y se incluyen en el exportador sin CDN ni solicitudes a Scenario durante la partida. `procedencia.json` identifica el asset y su GLB original mediante SHA-256. Para reconstruir: `python dev/secciones/adreida-scenario/preparar.py /ruta/adreida-caoz.glb` (numpy y Pillow). La preparación separa brazos y falda por conectividad de la superficie, evitando pesos cruzados en piezas próximas. Los dedos se cierran desde los nudillos conservando la palma; el eje de enlace de la mano coloca el mango a través de su ancho. Pruebas focalizadas: `pruebas_arpg_adreida_scenario.mjs`, `pruebas_arpg_agarre.mjs`, `pruebas_arpg_animacion.mjs` y `pruebas_arpg_bumeran.mjs`.

La marcha comparte su longitud de zancada entre el personaje, Adreidos y el visor (5,8 m/s a velocidad normal). Los apoyos de marcha son lineales; la carrera usa el movimiento completo de Fast Run, incluidos la rodadura del pie y los intervalos con ambos pies en el aire. Se verifican 1.200 muestras de velocidades y ajustes, continuidad al repetir el ciclo y altura de las suelas. Al mezclar velocidades, unos pocos vértices extremos de las botas evitan penetraciones sin recorrer la piel completa.

La carrera principal procede de **Fast Run.fbx**, clip Mixamo aportado por el usuario el 2 de octubre de 2026 (17 fotogramas a 30 FPS, 0,533 s). Se hornean 64 muestras periódicas adaptadas al esqueleto existente: cadera, pecho, cabeza, muslos, rodillas, pies y brazo libre. El brazo derecho se reserva para el agarre del hacha, ajustado a la inclinación del torso; el izquierdo deja espacio para la hombrera más ancha de Adreida. Las transiciones recuperan el agarre a dos manos antes del impacto. Se conserva la escala del modelo y se aplica también a Adreidos. El FBX de 15,6 MB se convierte en unos 24 KB de datos de animación: no se carga su maniquí, texturas, rig ni un motor adicional en el navegador. `adreida-scenario/extraer-fast-run.py` extrae el movimiento con Blender; `preparar-fast-run.mjs` lo adapta y regenera el bloque de datos. `fast-run-procedencia.json` documenta origen, SHA-256 y comandos.

Para la marcha lenta y la transición se conserva la referencia corporal CC0 de Quaternius. Fuente: [copia en GitHub de la biblioteca Standard](https://github.com/Seyamalam/blood-league-kickoff/tree/aa02a4e6d8337a0604d2da131bcbbeb1f01badf0/public/assets/vendor/quaternius), de [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html). La licencia y procedencia están en `adreida-scenario/quaternius-LICENCIA.txt` y `movimiento-procedencia.json`. `node dev/secciones/adreida-scenario/preparar-movimiento.mjs /ruta/universal-animation-library.glb` verifica su SHA-256 y regenera únicamente el bloque compacto de datos en `arpg-three-adreida-animacion.js`. La partida no descarga recursos externos. Las pruebas miden el giro visible del pecho, la compensación de cadera, la mirada, el agarre y el cierre del ciclo.

Referencias de GitHub revisadas para esta mejora: [Ossos, LimbSolver y SwingTwistBase](https://github.com/sketchpunklabs/ossos/tree/d1325d878f4875d0eafe42f8861a853263d57081/src/ikrig/solvers), sobre IK de dos huesos y dirección de flexión, y [Sketchbook, estados de movimiento](https://github.com/swift502/Sketchbook/tree/62f4b7986fd1ce1e4f91daba89ef032c20a6ce55/src/ts/characters/character_states), sobre transiciones entre caminar y correr. Ambos usan licencia MIT. Son referencias de diseño: esta implementación mantiene el solver local y no incorpora sus bibliotecas ni sus clips, ni añade mallas o llamadas de dibujo.

### Goblins de Scenario en el juego

El goblin aprobado de Scenario / Tripo 3.1 reemplaza al cuerpo de primitivas en partidas y en el visor. `arpg-three-goblin.js` adapta sus 7,872 triángulos al esqueleto procedural existente, con pesos suaves en hombros, codos, cintura y piernas. Conserva los avisos de ataque, destellos, disolución, armas arrojadizas y las 24 caídas. La muerte por corte crea dos secciones cerradas en la cintura; las caras no conectan ambas mitades. El contacto con el suelo toma en cuenta todos los pesos del vértice.

Las cuatro variantes mantienen sombreros, armas, tamaños y orejas. El cobrador conserva su bolsa y moneda. El cuerpo usa tres mapas PBR locales de 1024 × 1024, compartidos por toda la horda; cada variante comparte su geometría, pero tiene un esqueleto independiente. Son tres llamadas de dibujo por goblin y cuatro para la antorcha. Las armas mantienen la madera y el metal que ya se habían elegido. No se añade un cargador GLTF, servicios remotos, CDN ni físicas por personaje.

`goblin-scenario/preparar.py` compila el GLB aprobado y normalizado a 1.15 m (identificado por SHA-256) a `datos.js` y sus mapas. Requiere Python, numpy y Pillow sólo para reconstruir los recursos; `procedencia.json` registra el asset de Scenario. Para regenerar: `python dev/secciones/goblin-scenario/preparar.py /ruta/goblin-caoz-115cm.glb`. Prueba focalizada: `node dev/secciones/pruebas_arpg_goblin_scenario.mjs`. El visor de cuatro variantes se abre con `modelos-visor.html?tipo=goblin&comparar=1`.

El cuaderno UV sigue usando el modelo clásico mediante `fabrica(THREE,{pielGoblin:false})`; también se puede pedir `crear('goblin',{modeloGoblin:'clasico'})`. Las texturas descritas abajo corresponden al modelo clásico y a los accesorios conservados.

### Piel de los goblins (modelo clásico)

Goblin de Camino y cobrador usan el material aportado en `goblin-skin-bumpy-bl-q9btow.zip`: color sRGB, normales OpenGL y un mapa de superficie con oclusión en rojo y rugosidad en verde. Los tres archivos locales de `texturas-goblin/` son de 1024 × 1024 y suman unos 4.4 MB; `procedencia.json` documenta sus fuentes y tratamiento. El relieve tiene intensidad 0.7, la oclusión del material se aplica al 50 %, y la piel conserva metalness=0. No hay desplazamiento de vértices ni nuevos polígonos.

La máscara por vértice `pielReal` limita la textura a las 16 piezas de piel expuesta: cabeza, mandíbula, nariz, orejas, pecho, brazos, antebrazos, manos, muslos y pantorrillas. La ropa utiliza su propia máscara; botas, ojos, cejas y colmillos conservan sus materiales. Se mantienen tres mallas por personaje. Las texturas se cargan una vez por fábrica y se comparten entre todas sus instancias; las UV de detalle respetan aproximadamente un metro por repetición y viajan con los huesos, para que el patrón no se deslice durante una animación.

La ropa usa la arpillera manchada de **FreePBR.com**, aportada en `burlap-stained1-bl.zip`. La máscara `telaReal` cubre ocho piezas: gorro, chaleco, dos brazales, pantalón, faldón y las dos piezas del pañuelo. Este último mantiene el tinte rojo o morado del enemigo. Los tres mapas `ropa-*.webp` son de 512 × 512, con normales OpenGL al 0.38, rugosidad mínima 0.85 y oclusión al 50 %. No añade mallas, polígonos ni luces. `procedencia-ropa.json` conserva fuentes, tratamiento, crédito y aviso original.

El filo del hacha mira al frente mediante una media vuelta del agarre sobre el eje del mango, aplicada en las poses de ambos goblins. La hoja usa la pintura turquesa oxidada de `worn-rusted-painted-bl.zip`, con tres mapas `hacha-*.webp` de 512 × 512 compartidos: color, normal OpenGL (0.45) y oclusión/rugosidad/metalicidad empaquetadas. La máscara `hachaReal` deja intactos el mango y la moneda de latón del cobrador. La rugosidad mínima es 0.58 y la metalicidad se modera al 65 % para evitar destellos fuertes. `procedencia-hacha.json` documenta los archivos originales. No añade mallas ni modifica las piezas del atlas.

El mango usa `wood-veneer1-ue.zip`, limitado a la pieza 20 mediante `maderaReal`. La veta recorre el eje del cilindro y sigue la mano durante las animaciones. Los tres mapas `mango-*.webp` de 512 × 512 se comparten entre goblins y cobradores: color sRGB, normal convertida de DirectX a OpenGL invirtiendo el canal verde (intensidad 0.6) y oclusión/rugosidad empaquetadas. La madera conserva metalicidad cero, rugosidad mínima 0.7 y oclusión al 50 %. `procedencia-mango.json` documenta la conversión. Mantiene las tres mallas del personaje y la hoja oxidada.

La geometría y el atlas del cuaderno UV v2 siguen intactos. Su visor pide `fabrica(THREE,{pielGoblin:false})`, para mostrar la ilustración cargada sin sustituirla por la piel del juego. Los mapas se resuelven desde la URL de `arpg-three-modelos.js`, quedan incluidos en la exportación y se sirven mediante una lista explícita de archivos locales. `node dev/secciones/pruebas_arpg_piel_goblin.mjs` comprueba las máscaras de las 16 piezas de piel, las ocho de ropa, la hoja y el mango, la reutilización de texturas, los espacios de color, la compatibilidad del cuaderno, los otros personajes y los recursos exportados.


### Cuatro variantes de goblin

Las apariciones de goblins de camino y cobradores recorren una bolsa barajada con cuatro siluetas. Cada grupo de cuatro incluye todas. El cuerpo de Scenario comparte sus mapas PBR y las armas conservan el metal oxidado y la madera:

| Variante | Arma | Sombrero | Tamaño corporal | Orejas |
| --- | --- | --- | --- | --- |
| Clásico | Hacha original | Casquete original | 100 % | Originales |
| Bruto | Dos hachas | Casco metálico remachado | 110 % | 80 % |
| Pícaro | Cuchillo | Gorro de tela caído | 90 % | 125 % |
| Vigía | Antorcha | Sombrero de ala ancha | 105 % | 65 % |

`crear(tipo,{varianteGoblin})` permite elegir `clasico`, `dosHachas`, `cuchillo` o `antorcha`; omitir la opción conserva el modelo original y su cuaderno UV. La escala se aplica a huesos y geometría durante la construcción; altura y radio siguen esa proporción sin escalar dos veces la raíz. El bruto ataca con ambos brazos, el pícaro tiene una estocada compacta y el vigía sostiene la antorcha erguida. Conservan el daño y los avisos de su tipo de enemigo. Cada modelo sigue usando **tres mallas** (4,652–5,018 triángulos; el cobrador añade 352). La llama comparte el material de los ojos, se anima con un hueso y se apaga al morir, sin luces dinámicas adicionales.

`modelos-visor.html?tipo=goblin&comparar=1` muestra las cuatro juntas a escala relativa real; el selector permite examinarlas individualmente, también con `?tipo=goblin&variante=antorcha`. Las animaciones y caídas se pueden recorrer con los controles existentes. `node dev/secciones/pruebas_arpg_variantes_goblin.mjs` verifica reparto, dimensiones, pesos del esqueleto, armas, presupuesto geométrico y contacto final de las caídas en ambos tipos de goblin.

### Hacha búmeran de Adreida

**E / 3 / triángulo** sustituye a Provocar únicamente para Adreida. Prepara el lanzamiento durante 0.2 s y arroja su propia hacha en línea recta: 4 m de alcance a 16 m/s, sin coste de Furia y con 10 s de enfriamiento. Al llegar al límite, o al encontrar una cobertura, empieza un regreso curvo hacia su mano de aproximadamente 1.05 s. El ratón o la orientación del mando modifican la curva mientras gira Adreida; el extremo de la trayectoria sigue su mano aunque camine o haga dash. El regreso atraviesa coberturas para que el arma siempre se recupere. Una estela azul distingue su hacha de las doradas enemigas.

Puede golpear una vez de ida y otra de vuelta a cada enemigo: cada impacto causa 150 % del ataque, aplica el modificador de habilidades, empuja y genera 4 de Furia. Mientras está fuera, Adreida conserva movimiento, dash y parry, pero no puede hacer básicos, cargados ni Torbellino. Un parry refresca el enfriamiento, aunque no permite duplicar el hacha que sigue en vuelo. Las poses de lanzamiento, brazos libres y recogida acompañan al arma; se oculta solamente la geometría del hacha en la mano, incluidas sus sombras. Las mallas del proyectil se reutilizan y no añaden luces dinámicas.

El inspector incluye **Búmeran** y **Dirección del regreso** para revisar la curva cuadro a cuadro. `node dev/secciones/pruebas_arpg_bumeran.mjs` comprueba lanzamiento, manos, bloqueos, enfriamiento, impactos por tramo y dueño cooperativo, giros, carrera, coberturas y retirada al morir a 20/30/60/144 FPS.

### Hachas arrojadas y quemadura de antorcha

Los goblins clásicos y los brutos de dos hachas, incluidos los cobradores, pueden arrojar un hacha cuando están a 3–8 metros, tienen línea de visión y les corresponde un turno de ataque. Cada intento disponible tiene un 30 % de probabilidad y deja pasar 3.5–5.5 segundos antes de volver a intentarlo. Comparten los cupos de presión del combate; no empiezan otro lanzamiento mientras hay un aviso a distancia o un hacha volando. El aviso **«¡Hacha!»** dura 1.05 segundos y fija la dirección a mitad de la preparación. El proyectil gira, conserva las texturas del arma y describe una parábola: sale a 0.95 m de altura, sube 1.8 m adicionales y desciende a la altura del blanco a la distancia de lanzamiento (3–8 m). Puede pasar por encima del jugador durante el ascenso; el parry se resuelve al llegar a su cuerpo. La estela sigue la pendiente del vuelo. Viaja a 10 m/s en horizontal hasta 10 metros y causa el 85 % del daño cuerpo a cuerpo. El filo brilla en dorado, gira ligeramente inclinado para mostrar su cara y lleva una estela dorada de dos cintas cruzadas, orientada al vuelo. Pasa a blanco cálido al entrar en la ventana de parry; un parry perfecto lo devuelve con daño triple. Los obstáculos lo detienen. La geometría y los materiales se reutilizan entre proyectiles, sin luces nuevas.

Un golpe de antorcha que alcanza a **Adreida** le aplica quemadura durante **5 segundos**, con **2 puntos de daño cada segundo** antes de las mitigaciones existentes. Nueve llamas se anclan a los huesos de la falda y el torso; siguen el movimiento de la ropa sin encender el pelo ni el arma. El humo asciende desde la tela en una reserva de veinte motas y se disipa en 1.6 segundos tras apagarse. Llamas y humo suman dos llamadas de dibujo, sin luces ni sombras nuevas, y se liberan al reiniciar. Las brasas, el borde naranja y el contador bajo su retrato completan el efecto. Otro golpe renueva la duración sin acumular quemaduras ni reiniciar el pulso de daño. Un dash válido lo apaga inmediatamente; pulsarlo mientras está en enfriamiento no basta. Parry, bloqueo e invulnerabilidad evitan que ese golpe prenda fuego. El tiempo se detiene con la pausa, se limpia al morir y pertenece a cada personaje en cooperativo. Mohamed no recibe este estado.

El inspector permite seleccionar la variante al invocar enemigos para reproducir ambos ataques. `node dev/secciones/pruebas_arpg_hachas_fuego.mjs` comprueba la IA, los impactos y devoluciones a 20/30/60/144 FPS, obstáculos, flechas existentes, reutilización de las hachas y duración, renovación y cancelación del fuego.

### Caídas de goblins según el golpe letal

Goblins de Camino y cobradores tienen **24 coreografías: dos por cada una de 12 causas**. Al morir se elige una variante al azar, independiente de la semilla de daño y botín. La causa y dirección se capturan en el impacto letal y ya no cambian por golpes posteriores.

| Ataque que mata | Variante 1 | Variante 2 |
| --- | --- | --- |
| Primer tajo | Cae sobre un costado | Dobla rodillas y cae de espaldas |
| Revés | Gira y cae lateralmente | Tropieza de lado |
| Remate del combo | Derribo de espaldas | Se dobla y desploma hacia delante |
| Cargado (desde media carga) | Una rodada completa sobre hombros | Una rodada completa de costado |
| Torbellino | Pirueta y caída lateral | Barrido de piernas y caída frontal |
| Aterrizaje de Adreida | Sale despedido y rebota | Vuelco y caída frontal |
| Disparo de Mohamed | Pierde fuerza en las rodillas | Se encoge y cae de lado |
| Abanico de Mohamed | Tambalea y cae hacia atrás | Giro corto y desplome |
| Daga frontal | Se dobla sobre el abdomen | Rodilla y caída lateral |
| Daga por la espalda | Cae de bruces | Gira y se desploma |
| Golpe de Adreidos | Derribo diagonal | Tropiezo y caída frontal |
| Proyectil devuelto con parry | Impacto y espalda | Giro y costado |

El parry cuerpo a cuerpo, Provocar, dash y backflip no causan daño y no generan una muerte propia. Disparo/abanico conservan su causa y trayectoria en vuelo aunque Mohamed cambie de estado; Adreidos usa su posición de impacto, y el proyectil devuelto conserva a su defensor en cooperativo.

Las caídas duran entre 0,95 y 1,65 s; después reposan 0,35 s y se disuelven durante 0,9 s. Un muerto deja inmediatamente de atacar, bloquear el paso y contar como vivo, y entrega el botín una sola vez. El desplazamiento se detiene antes de atravesar el pozo, otros obstáculos o la muralla. El polvo es bajo y breve: sólo aparece con impulso suficiente al tocar el piso, añade una segunda nube menor en los rebotes y pequeñas emisiones cada 40 cm durante la rodada. El polvo de roce se detiene al quedar inmóvil o chocar con un obstáculo; usa la reserva de partículas del juego.

Son poses del esqueleto existente, con las mismas tres mallas y polígonos. El apoyo contra el suelo usa extremos precalculados por hueso y tipo, compartidos entre instancias; no añade un motor físico. Los giros completos conservan su ángulo continuo y la entrada desde la pose anterior se mezcla durante 90 ms. Todas las variantes relajan torso, piernas y manos hasta quedar acostadas; las pruebas comprueban el apoyo de cadera, torso y cabeza, no sólo el vértice más bajo de un arma. El pivote horizontal está en la cadera. En el cargado, el 80 % de los 2,30/2,05 m se recorre durante la vuelta con la misma curva angular; el giro de costado orienta el cuerpo perpendicularmente al avance.

Para revisar: `modelos-visor.html?tipo=goblin&anim=muerte-cargado-1` (también `tipo=cobrador`). El selector contiene las 24 variantes y la caída en dos mitades; **Momento** congela y recorre la animación, **Repetir** la reinicia y **Velocidad** permite cámara lenta. La cámara y la cuadrícula del suelo permanecen fijas durante la caída para hacer visible su avance; el visor usa la misma trayectoria y emisor de polvo que el combate, también al recorrer el tiempo manualmente. `pruebas_arpg_muertes_goblin.mjs` verifica ambas variantes en ambos modelos, apoyo, continuidad, rodada de 360°, pose final inmóvil, recorrido a 30/60/120 FPS, obstáculos, causa inmutable y limpieza. Las pruebas de control y disparos comprueban además que los ataques reales entregan la causa correcta.


### Impactos, escenario y movimientos · octubre de 2026

El aterrizaje de Adreida abre un cráter irregular con el fondo 32 cm bajo el piso y un borde de adoquín que comparte sus texturas. Dura cinco segundos de juego, incluida la pausa del impacto; durante los últimos 1,5 s pierde opacidad progresivamente, conservando su radio y profundidad. El piso reaparece con cobertura complementaria: no se contrae el agujero ni se añade otra pasada de render. El menú de pausa congela ese tiempo. `arpg-three-impactos.js` mantiene como máximo ocho cráteres y libera su geometría al desaparecer o reiniciar. El mismo módulo dibuja una cinta ámbar desde el filo real del hacha en los golpes cargados, con un núcleo fino y una cola de 0,19 s.

La sacudida del golpe cargado y del salto es mayor y avanza con el tiempo del cuadro, sin ralentizarse por el parón del impacto. Incluye un giro breve de cámara y respeta la preferencia de movimiento reducido. Los enemigos vivos reaccionan al impacto con torso y cabeza; el empuje, las chispas y el polvo conservan el sentido del golpe. Las flechas devueltas muestran sólo «¡Parry!»; los conos de Can conservan sus avisos visuales sin los rótulos «Centro» y «Lados».

Un goblin de camino o cobrador que muere por un golpe cargado al 100 % tiene un **33 % de probabilidad de partirse por la cintura**. Las mitades se separan, giran y apoyan independientemente en el suelo antes de disolverse. La carga parcial conserva las dos rodadas anteriores. No añade mallas ni un motor físico. Se puede revisar en `modelos-visor.html?tipo=goblin&anim=muerte-partida`.

Los faroles tienen zócalo de piedra, columna con anillos de cobre, jaula de forja, paneles ámbar y remate. Las llamas quedan dentro de la jaula; se reutilizan las dos luces existentes y se funde la geometría estática por material. Las casas interpuestas entre cámara y cualquiera de los jugadores bajan suavemente hasta un 18 % de cobertura mediante tramado; recuperan su aspecto al dejar de ocultarlos. Siguen agrupadas por material, sin duplicar las llamadas por cada casa.

La carrera de Adreida tiene apoyo y despegue de talón, recogida de rodilla, articulación de tobillo, desplazamiento de cadera y contramovimiento de torso y cabeza. Las piernas resuelven el alcance de cada pie con dos articulaciones; el cuerpo se inclina al girar y las manos acompañan el peso del hacha. Las transiciones de carga, impacto y cansancio conservan sus tiempos.

La IA elige destinos con espacio libre, anticipo corto del movimiento y flanqueo; evita a sus vecinos sin abandonar la ruta alrededor del pozo. Las decisiones se espacian entre 0,24 y 0,345 s y se calculan como máximo dos rutas nuevas por cuadro. En cooperativo conserva su objetivo para no cambiarlo continuamente. Los arqueros buscan línea libre antes de disparar; los goblins cercanos pueden apartarse lateralmente al ver una carga, con enfriamiento de 3,2 s. Se mantienen dos atacantes simultáneos en solitario y cuatro en cooperativo.

Tras «¡A mí, goblins!», llegan **12 goblins (24 en cooperativo)** por los tres portones en grupos separados por 0,42 s. No atraviesan las murallas. La cola tiene un límite de 32 enemigos vivos para evitar picos sin control y debe terminar antes de avanzar la oleada. En el mapa abierto llegan por tres direcciones alrededor de Can.

Comprobaciones acotadas: `pruebas_arpg_impactos.mjs` (cráteres y casas), `pruebas_arpg_muertes_goblin.mjs` (probabilidad y apoyo de ambas mitades), `pruebas_arpg_ritmo.mjs` (rutas, turnos y refuerzos), `pruebas_arpg_animacion.mjs` y `pruebas_arpg_can.mjs` (continuidad y combate).


### Huida tras la muerte de Can y piedras del Troll

Al morir Can, goblins de camino y cobradores vivos cancelan su ataque y corren asustados hacia el portón más cercano. La pose inclina el cuerpo y levanta la mano libre; corren a un mínimo de 4,5 m/s. Se cancelan los refuerzos goblin pendientes de esa oleada. La ruta sigue evitando obstáculos y abre el paso por la puerta sólo al alcanzarla; el jugador conserva el sello de la muralla. En mundo abierto se alejan de Can. No vuelven a atacar después de ser interrumpidos.

Cada goblin desaparece sólo cuando una esfera que incluye cuerpo y arma queda completamente fuera del encuadre actual, con una reacción mínima de 0,35 s. La retirada libera sus mallas y no cuenta como baja ni genera botín. Mientras sigan visibles, se les puede golpear. La comparación de llegada a un punto de ruta y la de movimiento comparten tolerancia de 5 mm para no quedar parados a centímetros del siguiente punto. El inspector incluye **Derrotar a Can · Probar huida**; se añaden Can y goblins con los controles habituales.

El mazazo circular del Troll mantiene aviso, daño y escombros centrados en su cuerpo. Las cinco piedras peligrosas salen desde un anillo a 1,2 m de él, con direcciones separadas por 72°, y caen entre 3,8 y 5,6 m de su posición al golpear. No se centran en el jugador ni lo siguen en vuelo. Se conservan los círculos de aviso, sus colores, las ventanas de parry y las devoluciones que abren su armadura; junto a obstáculos o muralla, los destinos se ajustan al terreno.

Comprobaciones: `node dev/secciones/pruebas_arpg_huida.mjs` (doce huidos, portones, pozo, retirada fuera del encuadre, interrupciones, pose y puntos de ruta cercanos) y `node dev/secciones/pruebas_arpg_troll_combate.mjs` (distribución radial, daño, invulnerabilidad, parry y blindaje). Las pruebas de Can y de ritmo cubren los ataques y oleadas que continúan normalmente.

### Prueba de IA con Yuka

Yuka queda activo por defecto para goblins y cobradores. `?ia=yuka` y `?ia=clasica` permiten comparar en la misma página. También se cambia durante la partida en **Pausa → Comportamiento de goblins**, o en **Inspector → IA de goblins**. Cambiar conserva posiciones, vida, rutas y ataques ya avisados; reiniciar o recargar conserva el modo indicado en la URL. El inspector muestra las intenciones y guarda el modo en los informes de rendimiento. Un cambio de IA invalida una medición en curso.

`arpg-three-ia.js` usa `Think`, `GoalEvaluator` y objetivos de Yuka para elegir entre **presionar, flanquear, cubrir y lanzar**. El clásico favorece lanzar cuando tiene línea libre; el bruto de dos hachas prioriza acercarse cuando no puede lanzar; el cuchillo busca un flanco más amplio y la antorcha uno más corto. Un bloqueo puede motivar buscar otro ángulo. Sin turno, se mantiene una posición en el anillo exterior. No aumenta velocidad, daño ni frecuencia de lanzamientos.

Las evaluaciones se espacian entre 0,27 y 0,345 s de simulación, según el enemigo; recibir o perder turno, cambiar de objetivo o ser provocado invalida la espera. El ángulo del flanqueo se fija al empezar, dura aproximadamente un segundo y no se intenta otra vez hasta pasados 3,2 s. A distancia de golpe se conserva la guardia. La navegación A*, separación, selección de jugador cooperativo, avisos, parry y director de dos/cuatro atacantes siguen siendo los del juego. Can, troll, saqueadores, arqueros y Adreidos mantienen su comportamiento anterior en esta primera prueba.

`yuka-goals-vendor.js` contiene sólo cinco clases oficiales de Yuka 0.7.8 (`Logger`, `Goal`, `CompositeGoal`, `GoalEvaluator`, `Think`), concatenadas dentro de una función y sin sus declaraciones import/export. Fuente fijada al [commit 1059130 de Mugen87/yuka](https://github.com/Mugen87/yuka/tree/10591304811222d6856020d5de129b39ef43b58d); el encabezado enumera los archivos para reproducir el empaquetado. Se conservan el código y comentarios originales del tercero y su licencia MIT en `yuka-LICENSE.txt`. Todo se sirve y exporta localmente, sin CDN ni scripts en línea.

Comprobaciones específicas:

- `node dev/secciones/pruebas_arpg_ia.mjs`: roles, cobertura, persistencia, turnos, provocación, 20/30/60/144 FPS, cambio de jugador y cambio de modo durante un aviso.
- `node dev/secciones/pruebas_arpg_ritmo.mjs --yuka`: ritmo, rutas del pozo, participación de todos los goblins y oleadas con Yuka; sin `--yuka` comprueba la IA anterior.
- Añadir `--medir` compara CPU de IA/combate de 24 goblins con semilla 11, cuatro rondas alternadas por modo y 1200 pasos medidos por ronda. Es una medición sin modelos ni renderizador: **no mide FPS ni coste de GPU**. La revisión inicial dio 0,156–0,158 ms/paso con Yuka y 0,167–0,175 ms/paso con la IA anterior en este equipo; repetir para comparar cambios.
- `pruebas_arpg_hachas_fuego.mjs` conserva la comprobación de los ataques y parry; `pruebas_arpg_inspector.mjs` verifica que proveedor local, adaptador y licencia se exportan juntos.

### Propuesta de HUD · Caoz ARPG

Interfaz de obsidiana, latón y marfil con iconos vectoriales locales. Dos esferas grandes de Alma (roja, izquierda) y Furia (ámbar, derecha) flanquean las siete habilidades. Se vacían verticalmente y muestran la cantidad actual y máxima en el centro. El retrato y nombre quedan sobre las habilidades; en pantallas pequeñas las esferas suben para conservar espacio. El HUD muestra la recarga en segundos, adapta las teclas al mando y mantiene la munición de Mohamed y las tres cartas del destino visibles sin abrir las métricas. La misión queda arriba a la izquierda y el objetivo arriba al centro. La selección de personaje, etapas, efectos, cooperativo y demostración están en pausa. El diseño se adapta a escritorio, móvil y controles táctiles; no agrega luces, texturas ni posprocesado al render.

### Código externo evaluado · 2 de octubre de 2026

Estas opciones se revisaron en sus repositorios originales. Son propuestas, todavía no dependencias del juego:

| Proyecto | Aplicación posible en Caoz | Cuándo conviene |
| --- | --- | --- |
| [navcat](https://github.com/isaac-mason/navcat) · MIT | Malla navegable, caminos suaves y multitudes; complemento a las decisiones de Yuka. JavaScript puro, datos serializables en JSON. | Primera prueba para rutas del mundo abierto: generar el mapa antes de jugar y comparar atascos/coste con el A* actual. |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) · MIT | Acelerar rayos y consultas contra geometría compleja. | Al añadir colisión real con escenarios grandes; no sustituye una medición ni acelera por sí solo el dibujado. Las colisiones actuales con círculos/cajas ya son baratas. |
| [howler.js](https://github.com/goldfire/howler.js) · MIT | Sonidos simultáneos, volumen, fundidos y audio espacial para golpes, pasos y ambiente. | Al incorporar el diseño sonoro; archivos locales, voces limitadas y desbloqueo de audio con el primer gesto del usuario. |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform) · MIT | Optimizar modelos glTF/GLB y texturas durante la preparación de recursos. | Cuando incorporemos modelos exportados de Blender; herramienta de desarrollo, sin coste de ejecución por sí misma. No optimiza automáticamente nuestras primitivas actuales. |

[Recast Navigation](https://github.com/isaac-mason/recast-navigation-js) es otra opción de navegación (WASM, multitudes y obstáculos temporales). Para nuestra CSP actual, navcat ofrece una prueba más directa. [Rapier](https://github.com/dimforge/rapier) sería candidato para objetos empujables y destrucción física; supone integrar simulación y WebAssembly, por lo que conviene reservarlo para una necesidad concreta y medir antes de reemplazar colisiones ligeras. No se incorporó ningún motor o biblioteca adicional con esta revisión de arte.
