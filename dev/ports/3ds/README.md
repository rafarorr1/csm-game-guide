# Caoz ARPG · Alpha .01 para 3DS

Edición nativa de un jugador para **Nintendo 3DS/3DS XL/2DS original con homebrew**. Produce `CaozARPG.3dsx`, icono `.smdh` y un ZIP preparado para la SD. Funciona sin navegador ni conexión. El motor C++ usa libctru, citro3d y citro2d; comparte modelos, texturas y poses con el juego web sin modificarlo.

## Qué conserva

- Adreida y Mohamed, ataques básicos/cargados, parry, dash, salto, torbellino/abanico, búmeran y ultimates. Adreidos dura 15 segundos con recarga de 100; el sigilo de Mohamed dura 10 con recarga de 90. Cada parry resta un segundo al ulti.
- Plaza amurallada, casas Scenario, pozo, faroles, carreta, suelo de piedra con vegetación, bosque, lluvia diagonal, luna y niebla. Cuatro variantes de goblin y cuatro de kobold; modelos y materiales adaptados de los recursos actuales.
- Oleadas, Can y sus combos, huida de goblins, Troll y sus proyectiles desviables, segunda fase blindada vulnerable mediante parry. Navegación alrededor de obstáculos, pociones, quemadura y puntuación con multiplicadores que caducan a los tres segundos.
- Tres cartas por nivel y d20: una opción conservadora, otra de riesgo y otra extrema. El 1 elimina ventajas acumuladas; conserva penalidades. Sus efectos se aplican entre niveles.
- Llave y entrada del Troll, casa goblin con la decisión de atacar o salir, y epílogo del mago: desaparición, portal, hechizo, meteorito, destrucción de la plaza y caída al cráter. Final «Fin de Alpha .01».
- HUD táctil en la pantalla inferior, esferas de Alma/Furia, minimapa, cooldowns, pausa, selector de personaje y pantalla de carga. Sonido original precalculado de lluvia, truenos, pasos y combate, con mezcla NDSP; funciona también si el servicio de sonido no está disponible.

## Adaptación gráfica

La pantalla superior usa 400 × 240; la inferior, 320 × 240. La estereoscopía está desactivada para dedicar el presupuesto de GPU a la escena. El exportador aplica Meshoptimizer conservando UV, normales y dos pesos de piel por vértice; PICA200 deforma los personajes con paletas de hasta 24 huesos. Las poses se precalculan en 24 muestras por clip. Los materiales usan RGB565 con mipmaps y disposición nativa por bloques 8 × 8. El conjunto inicial de 22 modelos, poses y texturas ocupa aproximadamente 14.2 MiB, más 411 KiB de sonido.

Los efectos usan buffers limitados y geometría reutilizada. Hay límites de 24 enemigos, 64 proyectiles, 80 efectos y 16 objetos; la navegación usa una rejilla con obstáculos cacheados. El HUD no consume el espacio de combate. SELECT muestra métricas CPU/GPU, cuadros por segundo y memoria lineal libre.

Esta edición reconstruye el combate y la narrativa para la consola; no ejecuta JavaScript ni transfiere todo el motor web. No incluye cooperativo, mundo abierto, editor de cinematográficas, iluminación PBR, sombras dinámicas de alta resolución ni equivalencia exacta de animaciones/cámaras. Los efectos, la destrucción y las escenas están simplificados. El objetivo de fluidez y memoria se debe comprobar en consola física: un emulador no certifica la tasa de cuadros de una Old 3DS.

## Construcción reproducible

Requiere Node.js 22, Python 3 con Pillow 12.3.0 y devkitPro/devkitARM con libctru, citro2d, citro3d, picasso y herramientas 3DS.

```sh
python3 -m pip install Pillow==12.3.0
node dev/ports/3ds/tools/exportar.mjs
make -C dev/ports/3ds -j2
python3 dev/ports/3ds/tools/empaquetar.py
```

También puede usarse `sh dev/ports/3ds/tools/compilar.sh`. `PYTHON_3DS` permite indicar el Python con Pillow del exportador. Los modelos proceden de las fuentes y assets del mismo commit, y los archivos exportados no se versionan. Meshoptimizer se incluye con su licencia MIT en `tools/vendor/`.

GitHub Actions (`.github/workflows/arpg-3ds.yml`) exporta, ejecuta las pruebas de simulación y compila ARM11 con la imagen oficial `devkitpro/devkitarm:20260610`. Valida cabeceras, icono y RomFS, calcula SHA256 y adjunta el paquete `CaozARPG-Old3DS`. No publica la web.

## Pruebas y emulador

```sh
c++ -std=c++17 -O2 -Idev/ports/3ds/include dev/ports/3ds/source/juego.cpp dev/ports/3ds/tools/pruebas.cpp -o /tmp/pruebas-caoz-3ds
/tmp/pruebas-caoz-3ds
```

La batería cubre combate, cartas, navegación, límites de objetos y la progresión narrativa. También se ejecuta con AddressSanitizer y UndefinedBehaviorSanitizer en el anfitrión. El exportador valida mallas, presupuestos, pesos e índices.

`tools/emular.py --azahar /ruta/al/ejecutable` crea un perfil aislado de Azahar con Old 3DS, CPU al 100 %, resolución nativa y temporización de GPU. Acepta `--video`, `--grabar-tas` y `--reproducir-tas archivo.ctm`. La grabación termina al cerrar el emulador normalmente. La guía de usuario está en `LEEME.txt`. `tools/secuencia_azahar.py` genera entradas TAS reproducibles. SELECT + START guarda las dos pantallas PPM y métricas JSON en `sdmc:/3ds/CaozARPG/capturas/`; permite revisar el renderizado real del ejecutable incluso cuando el emulador no admite vídeo con su backend gráfico.

## Referencias de implementación

- [citro3d y PICA200](https://github.com/devkitPro/citro3d)
- [citro2d](https://github.com/devkitPro/citro2d)
- [Ejemplos oficiales devkitPro](https://github.com/devkitPro/3ds-examples)
- [Meshoptimizer](https://github.com/zeux/meshoptimizer)
