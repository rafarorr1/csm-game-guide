# Camino antiguo de Tomsage · Kiln

Tres módulos del sendero generados mediante el SDK real `@instruktlabs/kiln@1.1.0`. Las piedras tienen biseles y bordes deformados, UV a escala métrica y colores de vértice minerales con musgo sutil. El hito conserva un frente tallado hacia +Z: sus surcos son depresiones de la geometría, no una imagen ni una malla superpuesta.

| ID | Dimensiones X/Y/Z (m) | Triángulos | Piezas nombradas | Materiales |
| --- | --- | ---: | ---: | ---: |
| pavimento | 2,4 / 0,06 / 1,8 | 528 | 12 | 1 |
| borde | 2 / 0,24 / 0,40 | 308 | 7 | 1 |
| hito | 0,55 / 0,95 / 0,40 | 462 | 3 | 1 |

El pavimento conserva ocho losas en hiladas incompletas y cuatro astillas pequeñas separadas. Se estrecha en ambos extremos, tiene esquinas ausentes y cortes oblicuos; no forma un rectángulo de 4×3 piezas. Esta silueta responde a la revisión de la cámara real del tutorial.

La base está en Y=0 y el centro en XZ=0; X sigue la longitud del camino y Z su ancho. Hundir el pavimento a Y=−0,025 deja su superficie aproximadamente a 2,5–3,5 cm del suelo. El conversor comprueba un desnivel de las caras superiores inferior a 14 mm. Es decoración: no altera los pies del personaje ni las colisiones del tutorial.

## Reconstrucción

Desde la raíz del repositorio, con Node 24 y Kiln 1.1.0 instalado en la carpeta hermana `../kiln-install`:

```sh
node dev/secciones/sendero-kiln/generar.mjs
python3 dev/secciones/sendero-kiln/preparar.py
```

El generador acepta como primer argumento otra carpeta de instalación. No instala paquetes ni configura MCP. El conversor sólo usa la biblioteca estándar de Python: lee los GLB entregados, fija transformaciones, conserva `COLOR_0` y reúne sus primitivas. No vuelve a fabricar las formas.

- `fuente.kiln.js` contiene las tres composiciones, los parámetros y las semillas fijas.
- `fuentes/*.kiln.js` conserva la fuente exacta evaluada para cada módulo.
- `glb/*.glb` conserva los nodos nombrados por piedra, un material blanco y sus colores. Son GLB producidos por Kiln.
- `generacion.json` registra versión e integridad npm, opciones, hashes y recibos de Kiln.
- `datos.js` expone `window.CAOZ_SENDERO_KILN={version:1,modulos:[...]}`: una geometría indexada por módulo, atributos Float32 e índices Uint16 en base64.
- `procedencia.json` registra medidas, conteos, hashes, comprobaciones y rangos de vértices/índices por pieza.

Los presupuestos son 700, 500 y 650 triángulos respectivamente. La fuente aplica `geometryDiagnostics` a cada pieza; el conversor verifica material único, posiciones/colores/UV finitos, índices, normales, orientación exterior, ausencia de triángulos degenerados y dimensiones finales.

## Integración y límites

El material del runtime reutiliza los mapas de roca del bosque: `roca-color.webp`, `roca-normal.webp` y `roca-superficie.webp`. No se añaden imágenes. La integración debe compartir las texturas que el mundo ya tiene cargadas y agrupar/instanciar las apariciones, manteniendo el descarte por zonas. El conteo por asset no demuestra por sí solo coste final ni FPS.

Se usó explícitamente el exportador Three experimental de Kiln para conservar colores de vértice, con `geometryPolicy: strict`, `optimize: off` e `instance: off`. Los GLB conservan piezas independientes; `datos.js` las concatena en una malla por módulo. La revisión geométrica y de reproducibilidad de estos archivos no califica todas las funciones del exportador ni certifica calidad artística.

Kiln queda en la fase de autoría. El navegador sólo recibe los datos y las texturas locales; no importa el SDK, no ejecuta las fuentes ni necesita un GLTFLoader o cambios de CSP.

## Revisión integrada

El tutorial coloca 54 piezas de los seis tipos (incluidos los tres muros del piloto): 27.390 triángulos en todo el camino, agrupados en 27 lotes espaciales con un material. La parte final ensancha el pavimento a dos filas y alterna la orientación de las losas. No se añaden luces, texturas ni pases de sombra.

`revision-juego.json` registra ocho vistas durante un recorrido completo. La diferencia entre ocultar y mostrar el kit en el mismo cuadro fue de 5–11 envíos y 7.458–12.386 triángulos, según la cámara. Es coste geométrico observado, no tiempo GPU ni una garantía de FPS. Las pruebas verifican exclusiones, altura del pavimento, material único, limpieza y entrada a la arena.
