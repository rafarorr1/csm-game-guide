# Estudio de ilustraciones del Domo

El editor se abre en `estudio.html` o `/estudio`. Comparte la clave y la sesión
privada del estudio de sonidos **del mismo entorno**. La beta y producción
mantienen sus propias bases y credenciales. El diseño y las operaciones son
independientes de las reglas del juego: aquí se cambia arte y encuadre.

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
Restaurar original recupera la ilustración y encuadre del repositorio; si nunca
hubo imagen original, el juego vuelve al símbolo de la carta.

Una revisión acompaña cada escritura. Si alguien guarda desde otra sesión,
la revisión antigua se rechaza: hay que actualizar y revisar el nuevo estado.
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

`/api/sfx/sesion` gestiona la sesión compartida. `/api/arte/privado` y las
escrituras requieren la cookie firmada. Las escrituras exigen el mismo origen
y `If-Match`. El catálogo público `/api/arte/catalogo` y los archivos
`/api/arte/imagen/<sha256>` se sirven sin sesión para que los jugadores puedan
ver las cartas. El contenido privado y la sesión nunca se guardan en la PWA.

El juego combina los originales con el catálogo público. Consulta cambios al
volver a la pestaña y aproximadamente cada minuto. Si la API no responde,
conserva el arte conocido y los originales; las imágenes públicas descargadas
pueden seguir usándose sin conexión. Actualiza las ilustraciones de los nodos
existentes, sin reiniciar la partida ni sus animaciones.

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
