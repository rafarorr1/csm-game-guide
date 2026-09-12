# Secciones aisladas

Este entorno ofrece vistas acotadas de Colección, El Rey y apertura de sobres. No monta el juego dentro de un iframe,
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

## Colección: copias y muestrario de ediciones

Debajo de cada carta sólo aparecen los marcadores de las ediciones que posee
el jugador, sin contador ni texto. Las ediciones bloqueadas no se dibujan;
la equipada queda resaltada. Desbloquear una edición añade su marcador,
pero recibir otra copia de la misma no añade otro.
El detalle muestra la cantidad de cada edición por separado, incluida `0 copias`
para una edición bloqueada. La ilustración del listado corresponde al acabado
elegido; mirar otra versión en el detalle no la equipa. «Usar» cambia esa elección
sin aumentar cantidades. El pie de Colección sigue contando cartas Normales y
ediciones especiales distintas, no el total de copias.

| Escenario (`estado`) | Datos temporales |
|---|---|
| `nuevo` | Una copia Normal por ID, ninguna premium y ningún sobre. |
| `sobres` | El mismo inventario inicial y dos sobres por abrir. Es el escenario predeterminado. |
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

### Cantidades y límites de migración

`cantidad(id)` devuelve el total; `cantidad(id, acabado)` devuelve una edición.
Normal empieza con una copia implícita. `otorgarCopia` suma una copia explícita;
`desbloquear` es idempotente y no suma si la edición ya estaba desbloqueada.
Cada nuevo sobre suma todas sus copias y guarda el contenido pendiente en la
misma escritura. Si el guardado falla, no se descuenta el sobre ni se conceden
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
```

Después de publicar, `BASE_URL=https://aislados.caoz-tcg.pages.dev/coleccion/`
permite repetir `pruebas_coleccion_copias.mjs` sobre el paquete servido,
sin arrancar un servidor local ni tocar el progreso real.

Comprueban los marcadores poseídos, las cantidades del detalle, la selección visual, el aislamiento del muestrario,
los protagonistas y los originales por acabado. Las pruebas del estudio usan
respuestas simuladas y no escriben en sus bases de datos. Revisar también en
móvil y escritorio que el total no se recorte y que cada serie conserve su
imagen y encuadre al abrir el detalle y regresar al listado.

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

Antes de publicar, revisar en 320×568, 390×844 y escritorio: arrastrar sin
abrir, cinco revelaciones sin saltos por toques rápidos, quinta carta esperando un toque
explícito antes del resumen, cinco cartas visibles sin superposición/scroll y regreso al
menú una sola vez. Probar reinicio durante la apertura, teclado y movimiento
reducido. Se comprueban errores y recursos fallidos.
