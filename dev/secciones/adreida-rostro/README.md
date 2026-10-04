# Rostro expresivo de Adreida

La identidad y los detalles de superficie proceden de una cabeza de Adreida generada con sus referencias en Scenario. La malla que se deforma usa una plantilla anatómica de MakeHuman/MPFB: loops alrededor de ojos y boca, cavidades y unidades de acción facial. La plantilla se adapta a la cabeza propia de Adreida; no se usa su apariencia humana original.

El rostro tiene 20 canales de expresión, dos ojos independientes y una unión al hueso de la cabeza del personaje. La geometría del cuerpo conserva posiciones, pesos y correctivos de agarre: `indicesCuerpo` retira únicamente los triángulos de la cara y orejas anteriores, conservando pelo y collar. `arpg-three-adreida.js` lee esa máscara al montar la geometría y utiliza los índices originales cuando los datos del rostro no están disponibles.

## Procedencia

Los datos anatómicos se obtuvieron de [MakeHuman Community / MPFB2](https://github.com/makehumancommunity/mpfb2), commit `d0a32e57a7f915cb2f2b95410e2117648c7bbb7e`:

- [Malla base y UV](https://github.com/makehumancommunity/mpfb2/blob/d0a32e57a7f915cb2f2b95410e2117648c7bbb7e/src/mpfb/data/3dobjs/base.obj).
- [Unidades de expresión](https://github.com/makehumancommunity/mpfb2/tree/d0a32e57a7f915cb2f2b95410e2117648c7bbb7e/src/mpfb/data/targets/expression/units/caucasian).
- [Puntos anatómicos del rig](https://github.com/makehumancommunity/mpfb2/blob/d0a32e57a7f915cb2f2b95410e2117648c7bbb7e/src/mpfb/data/rigs/rigify/rig.human.json).

Esos datos están bajo **CC0-1.0**. La [declaración de licencias del proyecto](https://github.com/makehumancommunity/mpfb2/blob/d0a32e57a7f915cb2f2b95410e2117648c7bbb7e/LICENSE.md) distingue los assets CC0 del código GPL; este juego no incorpora ni ejecuta el complemento GPL de MPFB. Se incluye el texto de CC0 en `fuentes/LICENSE.ASSETS.md`. `fuentes/procedencia-descarga.json` registra URLs fijadas al commit, tamaños y SHA-256 de las descargas. La denominación histórica de la carpeta de targets se conserva sólo para identificar su procedencia.

Las dos generaciones de Scenario consumieron **103 CU reales**:

| Recurso | Modelo | Trabajo | Asset | CU |
| --- | --- | --- | --- | ---: |
| Concepto de cabeza de Adreida | `model_openai-gpt-image-2-5-sunburst` | `job_P8euFUPqH1sxTyFWD1JDh4R4` | `asset_Cj1nsVbwmqfrtJEQ8fiSXCN9` | 13 |
| Sculpt 3D | `model_tripo-v3-1-image-to-3d` | `job_i8G5JphaRpt9gBUK7eQmaCPi` | `asset_pZK3L6g5TeG8RUz6QEh4avSo` | 90 |

La licencia CC0 de la plantilla no se extiende automáticamente a las referencias o al contenido generado con Scenario. Los scripts de adaptación, atlas y selección de la cabeza anterior se escribieron para este proyecto.

## Archivos y reconstrucción

`fuentes/cabeza-mpfb-con-targets.json` contiene sólo la cabeza extraída de la malla base, sus UV y los deltas faciales remapeados. La plantilla inicial tiene 4,352 vértices y 4,326 quads. `fuentes/landmarks.json` identifica vértices anatómicos y máscaras de labios, párpados y cavidades que deben protegerse al ajustar o proyectar detalles.

La carpeta de trabajo usada para esta versión es `outputs/cara-adreida`, fuera del repositorio. Conserva `fuente-orientada.blend`, `anclas-adreida.json`, el sculpt original, las vistas de referencia y los archivos intermedios. Para reconstruir se necesita esa carpeta de trabajo, Blender 5.2 y Python con NumPy/Pillow. Desde la raíz del repositorio, sustituyendo `/ruta/cara-adreida` por su ubicación:

```sh
python3 dev/secciones/adreida-rostro/seleccionar_cabeza_anterior.py /ruta/cara-adreida
blender --background --factory-startup --python-exit-code 1 --python dev/secciones/adreida-rostro/preparar.py -- /ruta/cara-adreida ajustar
blender --background --factory-startup --python-exit-code 1 --python dev/secciones/adreida-rostro/preparar.py -- /ruta/cara-adreida hornear 2048
python3 dev/secciones/adreida-rostro/atlas.py /ruta/cara-adreida
blender --background --factory-startup --python-exit-code 1 --python dev/secciones/adreida-rostro/preparar.py -- /ruta/cara-adreida exportar
```

`preparar.py` adapta la plantilla mediante anclas anatómicas y una deformación RBF, transporta los targets por la misma deformación y limita la proyección adicional de superficie. Los labios, párpados y cavidades están protegidos para evitar que una superficie generada cerrada borre sus loops. La fuente utiliza el ajuste de encaje de −0.020 m en Y y +0.035 m en Z del juego; se aplica una sola vez durante el proceso, sin mover el cuerpo original. Las anclas distinguen posiciones de fuente y posiciones finales.

`seleccionar_cabeza_anterior.py` genera `mascara-cabeza-anterior.json` y `diagnostico-retiro-cabeza.png`, sin Blender y sin modificar `datos.js`. La máscara se calibra con las islas UV, el color, las coordenadas y los pesos de `adreida-piernas-scenario/datos.js`; no es una segmentación universal para otros cuerpos. Conserva todos los atributos y elimina 358 de los 61,204 triángulos del cuerpo actual. Si cambia ese cuerpo o su atlas, hay que volver a revisar el diagnóstico antes de exportar.

Antes del ajuste se desparenta el sculpt conservando su matriz mundial: el nodo original del GLB está rotado y los offsets deben aplicarse en coordenadas mundiales. El horneado produce color y normal; `atlas.py` añade los materiales de ojos, dientes y mucosa y empaqueta los mapas WebP. La exportación produce `datos.js`, `auditoria.json` y `Adreida-rostro-editable.blend`, con las texturas empaquetadas, pivotes oculares y shape keys editables. También guarda `Adreida-rostro.glb` para otros programas. Los dientes inferiores siguen `jawOpen` mediante un driver. `auditoria.json` registra las cifras del último export: no sustituye la revisión visual.

## Expresiones y presupuesto

Los canales son `eyeBlinkLeft/Right`, `eyeSquintLeft/Right`, `eyeWideLeft/Right`, `browDownLeft/Right`, `browOuterUpLeft/Right`, `browInnerUp`, `jawOpen`, `mouthSmileLeft/Right`, `mouthFrownLeft/Right`, `mouthPressLeft/Right` y `mouthSneerLeft/Right`. Se usan valores normalizados de 0 a 1 y mezclas moderadas; combinaciones extremas requieren correctivos específicos. Son nombres de control propios compatibles con el runtime, no una certificación de calibración ARKit ni una captura FACS de la actriz.

Los morphs se limitan al rostro y los ojos se orientan por separado. No hay un sistema de físicas facial, un modelo remoto ni generación durante la partida. La versión revisada exporta tres mallas, 6,382 vértices y 11,824 triángulos, con mapas de 2048 × 2048; consultar `auditoria.json` después de cada reconstrucción. El coste real en la escena debe medirse con el render del juego, especialmente en primeros planos y cooperativo.

## Límites y revisión visual

Esta base permite editar actuación facial sin diálogo y continuar el trabajo en Blender; no convierte automáticamente una generación en un personaje AAA terminado. Revisar de frente, perfil y tres cuartos: cierre palpebral, contacto de labios, dientes, intersecciones con el pelo, unión del cuello y reconocimiento de Adreida. Después probar las mezclas de expresiones y los planos cinematográficos reales.

Los detalles, el horneado y los correctivos necesitan esa revisión conjunta. El rig no incluye fonemas, captura facial ni un sistema de arrugas dinámicas. La sutileza de mirada, asimetrías y ritmo de la actuación se ajusta con los controles del juego y sus secuencias, manteniendo el cuerpo y sus animaciones existentes.

## Comprobación de esta versión

El juego y el visor facial cargaron en el navegador sin errores de consola. Pasaron `pruebas_arpg_rostro_runtime.mjs`, `pruebas_arpg_rostro_adreida.mjs` y `pruebas_arpg_final_mago.mjs`: el cierre palpebral oculta al menos el 99% de cada globo desde frente; mirada y expresiones no alteran el agarre; la cara no aparece en FPS; la actuación y sus búsquedas de cuadro son reversibles. No es una medición de rendimiento de toda la partida ni una certificación de calidad AAA.
