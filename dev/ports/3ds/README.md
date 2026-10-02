# Las Grietas del Editor · adaptación 3DS

Prototipo nativo para **3DS/2DS original con homebrew**, separado del juego web. Produce `LasGrietas3DS.3dsx` y su icono `.smdh`. No es una conversión automática de three.js ni una versión con equivalencia completa: el motor de juego y renderizado son C++/libctru/citro3d.

## Contenido y límites

Incluye selección de Adreida/Mohamed, movimiento y combate, carga y cansancio, parry, dash, salto, habilidades y ulti; oleadas en la plaza, Can y sus refuerzos, troll con blindaje a media vida, proyectiles con parry, botín y elección con d20 entre niveles. La IA nativa usa separación y búsqueda local de dirección alrededor de obstáculos. La simulación funciona por tiempo transcurrido, sin interpolador de ticks a 60 Hz.

Los modelos y poses proceden de `dev/secciones/arpg-three-modelos.js` y del módulo de animación de Adreida. La exportación agrupa vértices por celda y hueso, elimina triángulos degenerados y conserva el esqueleto rígido. Adreida queda en unos 2.645 triángulos, los goblins en unos 1.015. Cada personaje requiere una llamada de dibujo; sus matrices se calculan previamente y se interpolan en CPU, mientras PICA200 transforma los vértices. La geometría de las casas y el pozo procede de `casas-three.js`, con colores horneados en lugar de materiales web.

Quedan fuera el cooperativo, el mundo abierto, la estereoscopía, el editor y la equivalencia exacta de texturas, sombras, partículas, comportamiento y todas las variantes de muerte. Los cráteres se representan como marcas de impacto; el relieve perforado y las estelas avanzadas de la web no están trasladados. Esta adaptación no cambia ni reemplaza el juego web.

El objetivo es una experiencia viable a 400 × 240 en la pantalla superior, con HUD en la inferior. **El arranque y rendimiento en hardware físico están pendientes; compilar no los demuestra.**

## Construcción

Requiere Node.js para exportar y devkitPro/devkitARM con libctru, citro3d, picasso y herramientas 3DS para compilar.

```sh
node dev/ports/3ds/tools/exportar.mjs
make -C dev/ports/3ds
```

La compilación de GitHub Actions usa la imagen oficial `devkitpro/devkitarm:20260610`; exporta desde la versión del juego en el mismo commit, ejecuta pruebas de la simulación y entrega un ZIP con la carpeta para la SD. Sólo se dispara para cambios de este port en `feature/visor-3d-coleccion` o manualmente. No publica la web ni usa secretos del proyecto.

Prueba local de lógica, sin SDK ni consola:

```sh
c++ -std=c++17 -O2 -Idev/ports/3ds/include dev/ports/3ds/source/juego.cpp dev/ports/3ds/tools/pruebas.cpp -o /tmp/pruebas-grietas-3ds
/tmp/pruebas-grietas-3ds
```

`LEEME.txt` documenta instalación, controles y limitaciones. Los binarios exportados, objetos y ejecutables no se versionan: se reconstruyen desde sus fuentes. El renderizado no necesita JavaScript, WebGL, un navegador ni conexión.

## Referencias

- [citro3d y GPU PICA200](https://github.com/devkitPro/citro3d)
- [Ejemplos oficiales devkitPro para 3DS](https://github.com/devkitPro/3ds-examples)
- [Manual de picasso](https://github.com/devkitPro/picasso/blob/master/Manual.md)
- [Especificaciones del navegador de Nintendo](https://en-americas-support.nintendo.com/app/answers/detail/a_id/13802)
