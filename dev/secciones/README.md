# Secciones aisladas

Este entorno abre **sólo la Colección real**. No monta el juego dentro de un iframe,
no crea una partida y no carga IA, online, campaña, sonido ni service worker.
Los cambios hechos aquí no afectan el progreso del jugador.

Desde la raíz del repositorio:

```sh
node dev/secciones/servidor.mjs
```

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
3. Probar los estados relevantes, en escritorio y móvil, y presentar el enlace
   local al usuario. Todavía no hace falta publicar otra versión completa.
4. Tras aprobar la sección, integrar y ejecutar las guardas completas antes de beta.

Cerrar el diálogo muestra los controles del laboratorio. Allí se puede cambiar
entre **jugador nuevo**, **dos sobres**, **acabados desbloqueados** y **sobre
anterior de tres cartas**. Cada recarga construye de nuevo esos datos temporales.
Las Doradas del escenario «Acabados desbloqueados» son fixtures de desarrollo;
no implementan ni simulan un canje de códigos.

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
paginación, acabados, apertura de cinco cartas, reapertura del sobre pendiente y
navegación de regreso. Estas pruebas acotadas no sustituyen la integración final.

## Añadir otra sección

Crear su entrada y adaptadores en esta carpeta. Reutilizar los componentes reales,
cargar sólo datos y ganchos necesarios y documentar cualquier dependencia omitida.
Añadir explícitamente las rutas necesarias al servidor y pruebas de aislamiento.
No usar el HTML completo del juego oculto para suplir una dependencia ausente.
