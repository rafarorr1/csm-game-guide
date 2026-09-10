# Estudio de ilustraciones del Domo

El editor se abre en `estudio.html` o `/estudio`. Comparte la clave y la sesión
privada del estudio de sonidos **del mismo entorno**. La beta y producción
mantienen sus propias bases y credenciales. El diseño y las operaciones son
independientes de las reglas del juego: aquí se cambia arte y encuadre.

## Versiones y acabados

Cada carta tiene tres versiones: **Normal**, **Foil** y **Foil dorado**. El
juego elige automáticamente Dorado → Foil → Normal. Esta elección es visual:
no cambia la rareza, el coste, las estadísticas ni las reglas. Las imágenes
y encuadres anteriores se conservan como Normal.

En el estudio, cada versión tiene su propia vista previa y guardado. «Usar
esta ilustración» crea un acabado que reutiliza la imagen de Normal, incluido
cualquier reemplazo posterior de esa imagen; su encuadre se guarda por separado.
También se puede subir una ilustración propia para cada acabado. Si una carta
todavía usa un símbolo, el acabado puede aplicarse sobre ese símbolo.
El selector indica qué versión está en juego, cuáles están disponibles y
cuáles no se han creado. Abrir una versión para verla no la publica.

Retirar Foil dorado deja disponible Foil o Normal; retirar Foil conserva Normal.
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
1.500.000 bytes. El encuadre usa x/y entre 0 y 100, zoom entre 100 y 300.
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
