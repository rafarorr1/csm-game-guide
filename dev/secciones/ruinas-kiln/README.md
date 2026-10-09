# Ruinas de Tomsage · piloto Kiln

Tres módulos estáticos generados mediante el SDK real `@instruktlabs/kiln@1.1.0`: muro quebrado, esquina y remate escalonado. Cada piedra tiene biseles, ligeras deformaciones, UV a escala métrica y color de vértices con variación mineral y musgo discreto. El visor aplica los mapas de roca ya existentes del bosque; no se añaden imágenes.

| Módulo | Dimensiones X/Y/Z (m) | Triángulos | Piedras editables | Materiales |
| --- | --- | ---: | ---: | ---: |
| recto | 2 / 0,86 / 0,42 | 704 | 16 | 1 |
| esquina | 2 / 0,84 / 2 | 1.100 | 25 | 1 |
| remate | 2 / 0,88 / 0,42 | 704 | 16 | 1 |

## Reconstrucción

Desde la raíz del repositorio, con Node 24 y Kiln 1.1.0 ya instalado en la carpeta hermana `../kiln-install`:

```sh
node dev/secciones/ruinas-kiln/generar.mjs
python3 dev/secciones/ruinas-kiln/preparar.py
```

Para preparar esa dependencia por primera vez, fuera del paquete del juego:

```sh
npm install --prefix ../kiln-install --save-exact --ignore-scripts --include=optional @instruktlabs/kiln@1.1.0
```

`generar.mjs` admite como primer argumento otra carpeta de instalación de Kiln. No instala paquetes ni crea configuración MCP. `preparar.py` sólo usa la biblioteca estándar de Python y admite como argumento una carpeta con los tres GLB; comprueba sus hashes contra la generación registrada.

- `fuente.kiln.js`: plantilla procedural editable; contiene las tres composiciones y sus semillas fijas.
- `fuentes/*.kiln.js`: fuentes exactas que Kiln ejecutó para cada módulo, utilizables de forma individual con Kiln.
- `glb/*.glb`: GLB producidos por Kiln; conservan un nodo nombrado por piedra y un material blanco compartido con color de vértices. No incluyen las texturas del bosque.
- `generacion.json`: versión e integridad npm, configuración de exportación, hashes, validación de la fuente y recibos de Kiln.
- `preparar.py`: lee los GLB, aplica matrices de nodos a vértices y normales, conserva `COLOR_0`, concatena las primitivas y verifica medidas, orientación, índices y presupuesto.
- `datos.js`: `window.CAOZ_RUINAS_KILN`, con una geometría indexada por módulo, atributos Float32 y índices Uint16 en base64. Base Y=0, centro XZ=0.
- `procedencia.json`: hashes y tamaños de entrega, comprobaciones y rangos de vértices/índices de cada piedra.

## Límites de esta prueba

Se seleccionó explícitamente el **exportador Three experimental** de Kiln para conservar colores de vértices. La exportación y la conversión de estos tres GLB se verificaron; esa prueba no califica todas las funciones del exportador. No se activaron instancing ni consolidación de Kiln: los GLB mantienen piezas separadas. La conversión local las reúne en una sola malla por módulo para el visor, donde comparten material.

Los rangos por piedra permiten preparar una futura versión fragmentada para las cinemáticas, pero este piloto no implementa destrucción, colisiones ni comportamiento de juego. Tampoco contiene LOD automático. Los chequeos geométricos no certifican calidad visual ni un framerate; esas decisiones requieren la cámara, iluminación y medición del juego.

El runtime usa únicamente geometría y texturas locales. No importa Kiln, no ejecuta sus fuentes y no necesita un GLTFLoader ni cambiar la CSP.

## Revisión local · 9 de octubre de 2026

`revision-visor.json` guarda la comprobación de carga, controles, descargas y vista móvil, junto con la comparación del botón del visor (90 fotogramas de preparación y 180 muestras por caso). Se revisaron las tres piezas, el conjunto y la malla desde varios ángulos. Con 300 módulos se mantienen tres envíos de muros y tres de sombras; el suelo añade otro. Esta medición pertenece al visor aislado y al equipo indicado en el informe, no al combate ni a todos los dispositivos.
