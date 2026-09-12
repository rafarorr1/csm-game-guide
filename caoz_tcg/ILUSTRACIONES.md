# Estudio de ilustraciones del Domo

**Build 235:** el flujo vigente está en [ESTUDIOS.md](ESTUDIOS.md): estudio
único, guardado privado y botones separados para beta y producción. Los detalles
históricos de guardado directo por entorno que siguen corresponden a234.

El editor se abre en `estudio.html` o `/estudio`. Comparte la clave y la sesión
privada del estudio de sonidos **del mismo entorno**. La beta y producción
mantienen sus propias bases y credenciales. El diseño y las operaciones son
independientes de las reglas del juego: aquí se cambia arte y encuadre.

## Encuadres por vista · build 238

El estudio ofrece previsualizaciones con los mismos constructores y CSS del juego,
en escritorio y móvil. Cambiar de vista conserva los ajustes pendientes: cada
superficie y acabado tiene sus propios controles horizontal, vertical y zoom.
Las cartas incluyen mano, campo (personajes), ficha ampliada, colección, descarte,
carta revelada y memoria. Los protagonistas incluyen selección, VS, fin de partida,
barra de combate, ficha ampliada, campaña, ruta y retrato de logros.

El zoom admite **50–300%**. Por debajo de100 la imagen se reduce dentro de su marco;
el marco, las reglas y las cifras conservan su tamaño. «Usar encuadre heredado» retira
sólo la excepción de la vista elegida. Desde239, si falta un ajuste propio se usa
la misma vista de la otra pantalla; si tampoco existe, se conserva la base de esa
versión. El estudio muestra la herencia y no reescribe los diseños guardados.

`vistas` acompaña a x/y/z como mapa opcional (p. ej. `movil_detalle`). Las tablas
reciben una columna TEXT mediante migración aditiva. La misma revisión CAS protege
imagen, acabado y vistas; las publicaciones incluyen el mapa en la instantánea.
Un cliente antiguo que no envía `vistas` las conserva; DELETE las retira junto a
esa versión. El consumidor guarda también el mapa público para abrir sin red.
`arte-vistas.js` identifica superficies; `estudio-vista.js` funciona sólo dentro
de un iframe de previsualización del mismo origen, sin iniciar partidas reales.

## Ilustraciones provisionales · build 242

Las cartas que aún no tenían diseño reciben una ilustración provisional, basada
en su descripción y habilidad. Se guardan como originales nuevos en `art/`, con
`placeholder:true` en su entrada de `encuadres.json`; el generador conserva esa
marca en `catalogo.json`. El filtro **Provisionales** permite encontrarlas juntas.
Una imagen propia, incluida la heredada desde Normal por un acabado, se muestra
como Reemplazada. Los originales anteriores y los diseños privados o publicados
del estudio se conservan. No se escriben ni se publican borradores de D1.

Cada archivo del juego mide hasta 512×768 y conserva la proporción de su original.
El encuadre es ajustable y no modifica la imagen. Los PNG de generación, los WebP
y las descripciones utilizadas se entregan aparte en la galería descargable.
Normal, Foil y Dorado conservan sus controles de diseño en el estudio.

## Versiones y acabados

Cada carta tiene tres versiones: **Normal**, **Foil** y **Foil dorado**. El
jugador empieza con todas las normales y elige cada acabado desbloqueado desde
Colección de cartas. Publicar arte premium no lo desbloquea ni lo equipa. Esta elección es visual:
no cambia la rareza, el coste, las estadísticas ni las reglas. Las imágenes
y encuadres anteriores se conservan como Normal.

En el estudio, cada versión tiene su propia vista previa y guardado. «Usar
esta ilustración» crea un acabado que reutiliza la imagen de Normal, incluido
cualquier reemplazo posterior de esa imagen; su encuadre se guarda por separado.
También se puede subir una ilustración propia para cada acabado. Si una carta
todavía usa un símbolo, el acabado puede aplicarse sobre ese símbolo.
El selector del estudio indica qué diseños están disponibles y cuáles
heredan la ilustración Normal. Abrir una versión para verla no la publica.

Retirar un diseño premium conserva el acabado desbloqueado del jugador y
muestra la ilustración Normal con ese acabado.
Restaurar Normal devuelve el original del repositorio sin retirar las otras
versiones. Se conservan las revisiones de los acabados retirados para rechazar
guardados antiguos. Cambiar de carta o versión con una prueba pendiente pide
descartarla antes de continuar.

## Biblioteca y guardado

El catálogo se genera desde `CARDS`, `LEADERS` y `DECKS` del motor, e incluye
cartas, fichas y protagonistas. `art/catalogo.json` describe cada entrada y su
ilustración original, si existe. `node generar_catalogo_arte.mjs --comprobar`
impide publicar un catálogo desactualizado; para actualizarlo ejecutar ese
script sin la opción `--comprobar`.

Seleccionar un archivo o cambiar su encuadre sólo prepara una vista previa.
Guardar publica el reemplazo o encuadre en el entorno indicado. Las imágenes
se convierten en el navegador a un archivo pequeño; el servidor valida también
su formato, tamaño y dimensiones. Admite WebP, PNG y JPEG estáticos hasta
1.500.000 bytes. El encuadre usa x/y entre 0 y 100, zoom entre 50 y 300.
Restaurar Normal original recupera la ilustración y encuadre del repositorio;
si nunca hubo imagen original, esa versión vuelve al símbolo de la carta.

Una revisión acompaña cada escritura. Si alguien guarda desde otra sesión,
la revisión antigua se rechaza: hay que actualizar y revisar el nuevo estado.
La revisión corresponde a una versión concreta, por lo que modificar Normal
no sobrescribe el diseño o el encuadre de Foil dorado.
Los originales del repositorio no se sobrescriben. Se mantiene además el
archivo remoto anterior y se retiran los archivos huérfanos tras 24 horas.

## Borradores del editor anterior

El editor anterior guardaba imágenes y encuadres en IndexedDB, base
`caoz-tcg-arte`, almacén `arte`. Esos datos pertenecen a ese navegador y ese
origen. El nuevo estudio permite recuperar un borrador local y previsualizarlo;
la publicación siempre requiere una acción explícita. Abrir el panel no elimina
ni publica los archivos antiguos.

## Acceso por internet

Se aprovecha la configuración del estudio de sonidos en Cloudflare Pages:
`SFX_DB`, `SFX_ADMIN_HASH` y `SFX_SESSION_KEY`. No hay otra contraseña incrustada
en el cliente, ni una segunda base que configurar. Las tablas `ilustraciones`
e `imagenes` están separadas de las tablas de sonido; se crean al recibir la
primera consulta. Publicar conserva los reemplazos guardados en D1.
La tabla `ilustraciones` conserva los registros normales existentes;
`ilustraciones_acabados` guarda Foil y Dorado. `imagenes` comparte archivos
por su hash, y su limpieza considera todas las versiones y sus anteriores.

`/api/sfx/sesion` gestiona la sesión compartida. `/api/arte/privado` y las
escrituras requieren la cookie firmada. Las escrituras exigen el mismo origen
y `If-Match`. El catálogo público `/api/arte/catalogo` y los archivos
`/api/arte/imagen/<sha256>` se sirven sin sesión para que los jugadores puedan
ver las cartas. El contenido privado y la sesión nunca se guardan en la PWA.

Las escrituras usan `/api/arte/carta/:id/:acabado`, donde el acabado es
`normal`, `foil` o `dorado`; la ruta anterior sin acabado sigue siendo Normal.
Cada fila de catálogo añade `acabado` (ganador) y `variantes` con sus tres
registros. Los campos planos públicos representan al ganador efectivo;
los privados conservan Normal para compatibilidad con el estudio anterior.
Un registro premium usa `activo` y `heredada`; un acabado retirado conserva
su revisión pero tiene `activo:false`. Una versión nunca creada es `null`.
Los campos de imagen de una variante heredada se resuelven desde Normal.

El juego combina los originales con el catálogo público. Consulta cambios al
volver a la pestaña y aproximadamente cada minuto. Si la API no responde,
conserva el arte conocido y los originales; las imágenes públicas descargadas
pueden seguir usándose sin conexión. Actualiza las ilustraciones de los nodos
existentes, sin reiniciar la partida ni sus animaciones.
`acabados.css` comparte el marco y los reflejos entre estudio y ambas pantallas.
Normal no tiene foil, Foil presenta reflejos iridiscentes y Dorado un marco
metálico dorado. El acabado se identifica mediante `data-acabado`; no se
deduce de la estrella de rareza. Respeta la preferencia de movimiento reducido.

GitHub Pages y un servidor estático no ejecutan este backend. El panel informa
del problema; el juego continúa con sus originales. Las pruebas locales del
backend usan SQLite y credenciales ficticias, sin tocar datos personales.

## Publicación y pruebas

Se publica mediante `publicar.sh --beta --visible`, incluyendo el estudio,
catálogo, consumidor de arte, worker y rutas. El publicador valida la sintaxis,
el catálogo derivado y los contratos de imágenes y sonidos; después compara
los archivos servidos byte a byte. La producción se publica únicamente cuando
el usuario lo solicita. No se copian bases ni secretos entre entornos.

`pruebas_arte.mjs` cubre acceso, origen, catálogo, imágenes y dimensiones,
encuadres, revisión concurrente, restauración, limpieza y aislamiento del sonido.
La comprobación visual del panel debe incluir escritorio y móvil, recuperación
de borrador, vista previa sin guardar, recarga en otra sesión y conflicto.

## Colección del jugador (build249)

### Originales de Foil y Dorado — revisión aislada posterior a beta251

Cada entrada de `art/encuadres.json` conserva su encuadre Normal y puede añadir
`variantes.foil` y `variantes.dorado`: `url`, `x`, `y`, `z`, `vistas` opcionales,
`placeholder` y `estilo`. Los archivos son `art/<id>-<acabado>-v1.webp`; Thal
conserva `art/tal-dorado-final-v1.webp`. No se modifica la ilustración Normal.
El catálogo generado añade `originales.normal/foil/dorado`; `original` sigue
siendo Normal para los consumidores anteriores.

La prioridad por edición es: reemplazo exacto activo del estudio (incluida
herencia explícita), original local de esa edición, Normal. Elegir Foil no
adopta automáticamente Dorado. El estudio muestra el original de cada edición
y sus vistas; el primer ajuste de un premium local copia sus mismos bytes a
la biblioteca, evitando que el backend lo interprete como herencia de Normal.
Restaurar retira el reemplazo y devuelve su original premium. La biblioteca
privada sólo cambia al pulsar Guardar; estos assets no escriben en ella.

Las cantidades se guardan junto a los desbloqueos bajo la misma clave de
inventario. `cantidad(id)` devuelve el total y `cantidad(id, acabado)` la
edición. Las Normales iniciales cuentan una. Cada carta de un sobre suma otra
copia, incluso repetida; reabrir, equipar o desbloquear de nuevo no suma.
El inventario anterior sólo registraba propiedad: cada premium poseído migra
a una copia, sin reconstruir duplicados históricos que no se almacenaron.

`coleccion-modelo.js` guarda inventario, selección y sobres en localStorage.
Normal está disponible para todas las cartas y protagonistas. Foil y Dorado se
desbloquean por separado; abrir un sobre nunca cambia la selección equipada.
Cada acabado usa sus imágenes y encuadres publicados, o hereda Normal si no
tiene diseño propio. Las vistas del estudio fuerzan el acabado sin tocar el
inventario. `coleccion-ui.js`/`coleccion.css` muestran las tres versiones y sobres.

El progreso pertenece a este navegador o app, sin sincronización de cuentas.
Beta, producción y pruebas tienen claves separadas; escritorio y móvil del
mismo entorno comparten inventario. «Borrar todo tu progreso» también elimina
sobres, acabados obtenidos y selecciones; Normal sigue disponible.

Cada campaña completada concede un sobre mediante
`CAOZ_COLECCION.concederSobreCampana(runId)`. Premio y recibo por recorrido se
guardan juntos; las recargas reintentan sin duplicar. Gero termina el recorrido
normal; cuando abre el secreto, se espera la victoria sobre Pitágoras. Si falla
el inventario, sobresPendientes acompaña el siguiente recorrido hasta guardar
la recompensa; empezar otra campaña no la pierde. Los
ensayos efímeros fuera de campaña y el laboratorio no conceden premios.

Cada sobre nuevo tiene cinco Foil aleatorias, sin repetir ID dentro del sobre
si el catálogo tiene al menos cinco cartas. El inventario no altera el sorteo:
pueden ser ediciones ya obtenidas. Una escritura guarda desbloqueos, contador y
resultado pendiente. Los pendientes anteriores de tres cartas siguen válidos y
no se sortean de nuevo. Beta/local conserva el botón para probar sobres.
Las Doradas se reservan al futuro canje de códigos de cartas físicas; el panel
lo explica y no simula validaciones ni desbloqueos. Las Doradas de pruebas
anteriores se conservan. No hay cuentas ni sincronización entre dispositivos.

`coleccion-juego.js` comparte únicamente las selecciones cosméticas en
join/welcome: el rival conserva sus acabados; la IA y clientes antiguos muestran
Normal. No se modifica el motor, mazos, daño ni mensajes de estado.
